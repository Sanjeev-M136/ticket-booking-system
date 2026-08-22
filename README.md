# Ticket Booking Platform

A high-concurrency ticket booking platform for movies and concerts featuring interactive seat selection, configurable hold TTL auto-release, automated waitlist reallocation on cancellation, and instant QR code ticket generation.

---

## 1. Setup Guide

### Prerequisites
- Node.js (v18+)
- npm

### Local Installation
```bash
# 1. Clone repository
git clone https://github.com/Sanjeev-M136/ticket-booking-system.git
cd ticket-booking-system

# 2. Install dependencies
npm install

# 3. Initialize SQLite Database
npx prisma db push

# 4. Seed initial Event & Seat Matrix
node seed.js

# 5. Start Application
node server.js
