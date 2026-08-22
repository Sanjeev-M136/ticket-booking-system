const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.showSeat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.waitlist.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { name: 'Customer One', email: 'customer1@example.com', role: 'CUSTOMER' }
  });

  const event = await prisma.event.create({
    data: {
      title: 'Neon Nights Concert 2026',
      venue: 'Grand Arena',
      date: '2026-09-20',
      time: '20:00',
      standardPrice: 40,
      premiumPrice: 85
    }
  });

  for (let i = 1; i <= 16; i++) {
    await prisma.showSeat.create({
      data: {
        eventId: event.id,
        seatLabel: `A${i}`,
        category: i <= 8 ? 'PREMIUM' : 'STANDARD',
        status: 'AVAILABLE'
      }
    });
  }

  console.log('Database seeded successfully!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
