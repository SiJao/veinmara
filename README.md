# Web VEINMARA Generation

Web angkatan Kelas Akhir 2026–2027, Pesantren Modern Daarul 'Uluum Lido.
Halaman statis (tanpa server). Isi yang sering berubah diedit lewat **Control Panel** yang tersambung ke Firebase.

## Halaman

| Halaman | Isi |
|---|---|
| `index.html` | Beranda: hitung mundur peresmian, filosofi nama & logo, ketua & wakil, momen penting |
| `undangan.html` | Undangan — sementara *Coming Soon* |
| `panggung-gembira.html` | Panggung Gembira — sementara *Coming Soon* |
| `admin.html` | **Control Panel** (khusus admin, perlu login) |

## Struktur file

| File / folder | Isi |
|---|---|
| `style.css`, `admin.css` | Tampilan web & control panel |
| `fx.js` | Efek bersama: navigasi, garis nadi emas, titik cahaya |
| `main.js` | Beranda (hitung mundur, filosofi logo, animasi scroll) |
| `soon.js` | Halaman Coming Soon |
| `admin.js` | Control panel (Firebase Auth + Firestore) |
| `content.js` | Memuat isi online dari Firestore; kalau gagal pakai `data.js` |
| `data.js` | **Isi bawaan** + filosofi logo (tidak diedit dari control panel) |
| `firebase-config.js` | Kunci project Firebase — lihat **PANDUAN-FIREBASE.md** |
| `firestore.rules` | Aturan keamanan database (ditempel di Firebase Console) |
| `vendor/` | anime.js 4.5.0 (animasi) |
| `assets/web/` | Gambar & font yang dipakai web (sudah dikecilkan) |
| `assets/EMBLEM LOGO`, `LOGO ANGKATAN`, `FONT` | File asli dari Drive (besar, tidak di-push) |
| `konten/` | Teks sumber + arsip internal (struktur lengkap) — tidak di-push |

## Mengedit isi

Setelah Firebase disiapkan (**PANDUAN-FIREBASE.md**), semua ini diedit dari `admin.html`:
tanggal/jam/tempat peresmian, halaman Undangan & Panggung Gembira, ketua & wakil (termasuk foto), dan momen penting.

Selama Firebase belum disiapkan, web memakai isi bawaan di `data.js` — foto ketua & wakil bisa ditaruh manual di
`assets/web/foto/` (`tmi-putra-ketua.jpg`, `tmi-putra-wakil.jpg`, … `tahfizh-putri-wakil.jpg`, potret 3:4).
Tanpa foto, web menampilkan inisial nama.

## Catatan

- Control panel harus dibuka dari alamat online (GitHub Pages) atau server lokal (`npx serve`), **bukan** klik dua kali.
- Kalau Windows/HP memakai pengaturan "kurangi gerakan" (Animation effects: Off), web sengaja tampil tanpa animasi.
- **Font:** Chocolatier & Rosellinda Alyamore berlisensi *Personal Use* — boleh untuk web non-komersial ini, tidak untuk jualan/merchandise. Rosellinda versi gratis menampilkan "WARNING" di tempat angka — jangan dipakai untuk teks berangka. Teks isi memakai Hanken Grotesk & Amiri (Google Fonts).
