# Marketplace Barang Bekas dengan Sistem Escrow

Marketplace jual-beli barang bekas dengan sistem rekening bersama (escrow) — dana pembeli ditahan sistem hingga barang dikonfirmasi diterima, baru diteruskan ke penjual.

## Status Pengembangan

Project ini dibangun bertahap. Status saat ini:

- [x] Struktur folder backend (modular)
- [x] Prisma schema lengkap (24 model, 14 enum)
- [x] `.env.example` & validasi environment variables
- [x] Modul Auth (register, login, refresh token rotation, logout, forgot/reset password)
- [x] Modul Chat realtime (Socket.IO + REST)
- [x] Modul Product & Upload (CRUD produk, multi-foto Cloudinary, validasi MIME/size/UUID)
- [x] Modul Marketplace (search/filter/sort, wishlist, follow seller, category list)
- [x] Seed kategori produk (7 parent, 30+ subcategory)
- [ ] Hardening security (account lockout, CAPTCHA Cloudflare Turnstile, email verification)
- [ ] Modul Order + Escrow flow
- [ ] Integrasi Payment (Midtrans sandbox)
- [ ] Modul Notification (Socket.IO push)
- [ ] Modul Admin & Dispute resolution
- [ ] Frontend (Next.js)
- [ ] Docker Compose
- [ ] API Documentation & ERD

## Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Shadcn UI |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT + Refresh Token Rotation, bcrypt |
| Storage | Cloudinary |
| Payment | Midtrans (sandbox) |
| Cache | Redis |
| Realtime | Socket.IO |

## Struktur Folder

```
marketplace-escrow/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── middlewares/
│   │   ├── validators/
│   │   ├── sockets/
│   │   ├── jobs/
│   │   ├── lib/
│   │   ├── utils/
│   │   ├── config/
│   │   └── types/
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/          (akan diisi setelah backend inti selesai)
├── database/          (dump, ERD, dsb.)
├── docker/
├── docs/              (API docs, flowchart, ERD)
└── README.md
```

## Menjalankan Backend (setup awal)

```bash
cd backend
npm install
cp .env.example .env   # lalu isi nilai sebenarnya
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Prasyarat: PostgreSQL & Redis berjalan secara lokal (atau lewat Docker — akan ditambahkan).

## Skema Database

Lihat `backend/prisma/schema.prisma`. Ringkasan domain:

- **User & Auth**: User, RefreshToken, Session, PasswordResetToken, Address
- **Catalog**: Category, Product, ProductImage, Wishlist, Follow
- **Transaksi**: Order, OrderItem, Payment, Escrow, Wallet, Withdrawal, Dispute
- **Reputasi**: Review, Rating
- **Komunikasi**: ChatRoom, ChatMessage, Notification
- **Moderasi**: Report, AuditLog

Beberapa tabel (`Wallet`, `Withdrawal`, `AuditLog`) ditambahkan di luar daftar awal karena diperlukan agar flow escrow → saldo penjual → pencairan dana bisa direpresentasikan dengan benar di database, bukan disimulasikan di memori.

## Lisensi

Belum ditentukan.
