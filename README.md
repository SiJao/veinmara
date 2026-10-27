# Web VEINMARA Generation

Web angkatan Kelas Akhir 2026–2027, Pesantren Modern Daarul 'Uluum Lido.
Di-hosting di cPanel (PHP + MySQL). Isi yang sering berubah diedit lewat **Control Panel** — lihat **PANDUAN-CPANEL.md**.

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
| `admin.js` | Control panel (login kata sandi, simpan lewat API) |
| `api/` | Backend PHP: `auth.php` (login), `content.php` (isi web), `foto.php` (upload foto) |
| `api/config.sample.php` | Contoh konfigurasi server — salinan berisi password **tidak** di-commit |
| `uploads/foto/` | Foto ketua & wakil yang diunggah dari Control Panel (hanya di server) |
| `content.js` | Memuat isi dari `api/content.php`; kalau gagal pakai `data.js` |
| `data.js` | **Isi bawaan** + filosofi logo (tidak diedit dari control panel) |
| `vendor/` | anime.js 4.5.0 (animasi) |
| `assets/web/` | Gambar & font yang dipakai web (sudah dikecilkan) |
| `assets/EMBLEM LOGO`, `LOGO ANGKATAN`, `FONT` | File asli dari Drive (besar, tidak di-push) |
| `konten/` | Teks sumber + arsip internal (struktur lengkap) — tidak di-push |

## Mengedit isi

Setelah web dipasang di cPanel (**PANDUAN-CPANEL.md**), semua ini diedit dari `admin.html`:
tanggal/jam/tempat peresmian, halaman Undangan & Panggung Gembira, ketua & wakil (termasuk foto), dan momen penting.

Kalau dibuka tanpa server (mis. klik dua kali), web memakai isi bawaan di `data.js` — foto ketua & wakil bisa ditaruh manual di
`assets/web/foto/` (`tmi-putra-ketua.jpg`, `tmi-putra-wakil.jpg`, … `tahfizh-putri-wakil.jpg`, potret 3:4).
Tanpa foto, web menampilkan inisial nama.

## Catatan

- Control panel harus dibuka dari alamat hosting (`https://domainmu/admin.html`), **bukan** klik dua kali.
- Kalau Windows/HP memakai pengaturan "kurangi gerakan" (Animation effects: Off), web sengaja tampil tanpa animasi.
- **Font:** Chocolatier & Rosellinda Alyamore berlisensi *Personal Use* — boleh untuk web non-komersial ini, tidak untuk jualan/merchandise. Rosellinda versi gratis menampilkan "WARNING" di tempat angka — jangan dipakai untuk teks berangka. Teks isi memakai Hanken Grotesk & Amiri (Google Fonts).
