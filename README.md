# Fina

Aplikasi keuangan pribadi untuk mencatat pemasukan dan pengeluaran, dengan bantuan AI untuk
membaca kalimat, suara, dan foto struk. Fina dipakai bersama oleh dua akun pada satu buku kas.

Fina diturunkan dari [wpu-finagent](https://github.com/sandhikagalih/wpu-finagent) karya
Sandhika Galih (Web Programming Unpas), lalu dikembangkan lebih jauh.

## Tentang repo ini

Ini salinan publik dari aplikasi yang dipakai sehari-hari. Email, nama, konfigurasi Firebase, dan
alamat aplikasi sudah diganti dengan contoh, jadi repo ini tidak bisa langsung terhubung ke data
siapa pun. Pemilik pada contoh ini bernama Andi dan pasangannya Sari.

## Fitur

- **Catat transaksi** lewat form manual, kalimat bebas (Catat AI), suara, atau foto struk.
- **Dashboard** bulan berjalan: arus kas harian, distribusi kategori, alokasi 50/30/20.
- **Finn**, asisten chat yang membaca ringkasan keuangan, dengan jawaban bertahap.
- **Audit** kesehatan keuangan oleh AI.
- **Riwayat** dengan pencarian, filter, ekspor CSV, dan Log Aktivitas.
- **Pengaturan** anggaran, kategori dan subkategori, serta cadangan dan pemulihan data.

## Teknologi

| Bagian   | Yang dipakai                                            |
| -------- | ------------------------------------------------------- |
| Tampilan | React, Vite, Tailwind CSS v4                            |
| Server   | Express (`server.ts`), dijalankan langsung oleh Node 22 |
| Login    | Firebase Auth dengan akun Google                        |
| Data     | Cloud Firestore                                         |
| AI       | Gemini, hanya dipanggil dari server                     |
| Hosting  | Google AI Studio (Cloud Run)                            |

## Struktur folder

```
server.ts              Pintu masuk server; AI Studio menjalankan file ini
server/
  auth.ts              Verifikasi token login dan pembatas laju permintaan
  gemini.ts            Koneksi ke Gemini, satu-satunya tempat kunci dibaca
  geminiQuota.ts       Pemilihan model Gemini dan penanganan kuota
  chatStream.ts        Pengiriman jawaban Finn secara bertahap
  requestDate.ts       Validasi tanggal acuan dari browser
  webApp.ts            Menyajikan tampilan: Vite saat pengembangan, dist/ saat produksi
  routes/              Satu file per rute AI: parseText, parseReceipt, audit, chat
firestore.rules        Aturan siapa boleh membaca dan menulis data
src/
  App.tsx              Kerangka aplikasi: login, pemuatan data, navigasi
  components/          Layar dan bagian tampilan
  hooks/               Logika tampilan yang dipakai ulang
  services/
    firestoreService.ts   Daftar fungsi Firestore yang dipakai komponen
    firestore/            Isinya per topik: transactions, settings, activity, ledger, backup
  utils/               Logika murni: tanggal, kategori, cadangan, log, parser
  types/               Bentuk data
test/                  Test unit (cepat, tanpa browser)
e2e/                   Uji browser dan rules terhadap emulator Firebase
```

Aturan umumnya: perhitungan dan aturan bisnis ditulis di `src/utils` agar bisa diuji tanpa
browser, komponen hanya mengurus tampilan, dan semua akses Firestore lewat
`src/services/firestoreService.ts`.

## Memakai Fina untuk diri sendiri

1. Buat proyek Firebase dengan Authentication (Google) dan Cloud Firestore.
2. Isi `firebase-applet-config.json` dengan konfigurasi web dari Firebase Console.
3. Samakan `FIREBASE_PROJECT_ID` di `server/auth.ts` dengan `projectId` tadi.
4. Ganti email di `src/utils/members.ts` dan `firestore.rules`. Keduanya harus sama, dan email
   pertama menjadi pemilik buku kas.
5. Terapkan `firestore.rules` ke database, lalu isi secret `GEMINI_API_KEY`.

## Menjalankan di komputer sendiri

Butuh Node.js 22.

```bash
npm install
cp .env.example .env     # lalu isi GEMINI_API_KEY
npm run dev              # buka http://localhost:3000
```

Tanpa `GEMINI_API_KEY`, aplikasi tetap berjalan. Fitur AI membalas pesan bahwa kunci belum
terpasang, dan Catat AI memakai parser lokal.

Versi lokal terhubung ke database di `firebase-applet-config.json`. Kalau itu database yang
Anda pakai sehari-hari, transaksi yang dicatat di sini adalah transaksi sungguhan.

## Perintah

| Perintah         | Fungsi                                  |
| ---------------- | --------------------------------------- |
| `npm run dev`    | Menjalankan server pengembangan         |
| `npm run lint`   | Memeriksa tipe TypeScript               |
| `npm test`       | Menjalankan test unit                   |
| `npm run build`  | Membangun aplikasi ke folder `dist`     |
| `npm run format` | Merapikan format kode dengan Prettier   |
| `npm run e2e`    | Menjalankan uji browser, lihat di bawah |

## Uji browser

Uji di `e2e/` menjalankan aplikasi sungguhan terhadap emulator Firebase, dengan rules dari
repo ini dan AI tiruan. Uji ini tidak menyentuh data asli dan tidak memakai kuota Gemini.

Butuh Java untuk emulator. Alatnya dipasang terpisah agar instalasi aplikasi tetap ringan:

```bash
cd e2e && npm install && npx playwright install chromium && cd ..
npm run e2e                  # semua uji
npm run e2e -- categories    # hanya file yang namanya memuat kata itu
```

## Alur perubahan sampai tayang

1. Perubahan dikerjakan di branch, lalu digabung ke `main` lewat pull request.
2. Di Google AI Studio: **Pull** dari GitHub, lalu **Publish**.

Dua hal tidak ikut otomatis saat Publish:

- **Kunci Gemini** disimpan sebagai secret `GEMINI_API_KEY` di AI Studio. Kunci tidak boleh
  ditulis di kode, dan `test/noSecrets.test.ts` memeriksa seluruh folder `server/`.
- **`firestore.rules`** diterapkan ke database secara terpisah, lewat agen AI Studio atau tab
  Rules di Firebase Console. Jika rules lama masih aktif, aplikasi menampilkan peringatan.

`/api/health` melaporkan apakah kunci Gemini terbaca, tanpa menampilkan nilainya.

## Data di Firestore

```
ledger/main                          Penunjuk ke akun pemilik buku kas
users/{uid pemilik}/
  transactions/{id}                  Transaksi, termasuk siapa pencatatnya
  activity/{id}                      Log Aktivitas, hanya bisa ditambah
  settings/budget                    Anggaran dan target
  settings/categories                Daftar kategori dan subkategori
  settings/audit                     Hasil audit terakhir
  settings/chat                      Chat Finn milik pemilik
  settings/chat_{uid}                Chat Finn milik anggota lain
  settings/receipt_{id transaksi}    Foto struk
```

Semua data ada di bawah akun pemilik. Anggota lain mengakses buku kas yang sama.

## Akses dan keamanan

- Hanya email yang terdaftar yang bisa masuk. Daftarnya ada di **dua tempat yang harus
  sama**: `src/utils/members.ts` dan `firestore.rules`.
- Server memeriksa token login pada setiap permintaan AI dan membatasi 30 permintaan per menit.
- Log Aktivitas tidak bisa diubah atau dihapus dari aplikasi.
- Chat Finn bersifat pribadi per akun.
- Data yang dikirim ke Gemini mengikuti ketentuan paket Gemini yang dipakai. Pada paket
  gratis, Google dapat memakai dan meninjau konten tersebut.

## Batas paket gratis

- Firestore: 50.000 pembacaan dan 40.000 penulisan per hari. Karena itu aplikasi hanya memuat
  tiga bulan terakhir saat dibuka, dan memuat riwayat lama saat diminta.
- Gemini: kuota harian terbatas. Model yang kena limit dilewati sampai kuotanya pulih.

## File dari Google AI Studio

`metadata.json`, `firebase-applet-config.json`, `firebase-blueprint.json`, `index.html`,
`vite.config.ts`, dan `tsconfig.json` berasal dari AI Studio dan sengaja tidak dirapikan.
`firebase-blueprint.json` belum menggambarkan buku kas bersama dan Log Aktivitas.
`firebase-applet-config.json` di repo ini hanya berisi contoh dan harus diisi sendiri.
