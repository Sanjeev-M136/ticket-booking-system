const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const QRCode = require('qrcode');

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const HOLD_DURATION_MS = 60 * 1000;

setInterval(async () => {
  const now = new Date();
  await prisma.showSeat.updateMany({
    where: { status: 'HELD', holdExpiresAt: { lte: now } },
    data: { status: 'AVAILABLE', heldByUserId: null, holdExpiresAt: null }
  });
}, 3000);

app.get('/api/events/init', async (req, res) => {
  const event = await prisma.event.findFirst();
  const user = await prisma.user.findFirst();
  if (!event || !user) return res.status(404).json({ error: 'Run node seed.js first' });
  const rawSeats = await prisma.showSeat.findMany({ where: { eventId: event.id } });
  const seats = rawSeats.sort((a, b) =>
    a.seatLabel.localeCompare(b.seatLabel, undefined, { numeric: true, sensitivity: 'base' })
  );
  res.json({ event, user, seats });
});

app.post('/api/seats/hold', async (req, res) => {
  const { eventId, seatId, userId } = req.body;
  const holdExpiry = new Date(Date.now() + HOLD_DURATION_MS);
  try {
    const updated = await prisma.showSeat.updateMany({
      where: { id: seatId, eventId: eventId, status: 'AVAILABLE' },
      data: { status: 'HELD', heldByUserId: userId, holdExpiresAt: holdExpiry }
    });
    if (updated.count === 0) return res.status(409).json({ error: 'Seat no longer available or already held.' });
    res.json({ message: 'Seat held successfully', expiresAt: holdExpiry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings/confirm', async (req, res) => {
  const { eventId, seatId, userId } = req.body;
  try {
    const seat = await prisma.showSeat.findFirst({
      where: { id: seatId, eventId, heldByUserId: userId, status: 'HELD', holdExpiresAt: { gt: new Date() } },
      include: { event: true }
    });
    if (!seat) return res.status(400).json({ error: 'Seat hold expired or invalid.' });
    const bookingRef = `BK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const amount = seat.category === 'PREMIUM' ? seat.event.premiumPrice : seat.event.standardPrice;
    const booking = await prisma.booking.create({
      data: { userId, eventId, bookingReference: bookingRef, totalAmount: amount, status: 'CONFIRMED' }
    });
    await prisma.showSeat.update({
      where: { id: seatId },
      data: { status: 'BOOKED', bookingId: booking.id, heldByUserId: null, holdExpiresAt: null }
    });
    const qrCode = await QRCode.toDataURL(bookingRef);
    res.json({ message: 'Booking confirmed!', bookingReference: bookingRef, qrCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings/cancel', async (req, res) => {
  const { bookingId } = req.body;
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { seats: true }
    });
    if (!booking || booking.status !== 'CONFIRMED') return res.status(400).json({ error: 'Cannot cancel booking.' });
    await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
    for (const seat of booking.seats) {
      const waitlisted = await prisma.waitlist.findFirst({
        where: { eventId: booking.eventId, category: seat.category, status: 'WAITING' },
        orderBy: { createdAt: 'asc' }
      });
      if (waitlisted) {
        const offerExpiry = new Date(Date.now() + HOLD_DURATION_MS);
        await prisma.showSeat.update({
          where: { id: seat.id },
          data: { status: 'HELD', heldByUserId: waitlisted.userId, holdExpiresAt: offerExpiry, bookingId: null }
        });
        await prisma.waitlist.update({
          where: { id: waitlisted.id },
          data: { status: 'OFFERED', offeredSeatId: seat.id, offerExpiresAt: offerExpiry }
        });
      } else {
        await prisma.showSeat.update({
          where: { id: seat.id },
          data: { status: 'AVAILABLE', heldByUserId: null, holdExpiresAt: null, bookingId: null }
        });
      }
    }
    res.json({ message: 'Booking cancelled successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/waitlist/join', async (req, res) => {
  const { eventId, userId, category } = req.body;
  const entry = await prisma.waitlist.create({ data: { eventId, userId, category, status: 'WAITING' } });
  res.json({ message: 'Added to waitlist', entry });
});

app.listen(3000, () => console.log('🚀 Server is running on http://localhost:3000'));
