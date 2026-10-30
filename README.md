# Web VEINMARA Generation

Web angkatan Kelas Akhir 2026–2027, Pesantren Modern Daarul 'Uluum Lido.
Di-hosting di cPanel (PHP + MySQL). Isi yang sering berubah diedit lewat **Control Panel** — lihat **PANDUAN-CPANEL.md**.

## Halaman

| Halaman | Isi |
|---|---|
| `index.html` | Beranda: hitung mundur peresmian, filosofi nama & logo, ketua & wakil, momen penting |
| `undangan.html` | Undangan — tidak ada di menu; tamu masuk dengan akun Google @daarululuumlido.com yang ada di daftar undangan |
| `panggung-gembira.html` | Panggung Gembira — sementara *Coming Soon* |
| `artikel.html` | Daftar artikel; `artikel.html?id=...` = satu artikel |
| `dokumentasi.html` | Daftar album foto; `dokumentasi.html?id=...` = galeri satu album |
| `admin.html` | **Control Panel** (khusus admin, perlu login) |

## Struktur file

| File / folder | Isi |
|---|---|
| `style.css`, `admin.css` | Tampilan web & control panel |
| `fx.js` | Efek bersama: navigasi, garis nadi emas, titik cahaya |
| `main.js` | Beranda (hitung mundur, filosofi logo, animasi scroll) |
| `soon.js` | Halaman Coming Soon |
| `admin.js` | Control panel (login kata sandi, simpan lewat API) |
| `admin-entri.js` | Control panel: editor artikel & album dokumentasi |
| `artikel.js`, `dokumentasi.js` | Halaman artikel & dokumentasi (galeri + foto layar penuh) |
| `rich.js` | Pembersih isi artikel (hanya format aman yang tampil) |
| `undangan.js`, `admin-tamu.js` | Login Google undangan & pengelolaan daftar tamu |
| `api/undangan.php`, `api/tamu.php`, `api/_google.php` | Login undangan (cek tanda tangan Google + daftar), daftar tamu (admin) |
| `api/` | Backend PHP: `auth.php` (login), `content.php` (isi web), `foto.php` (foto ketua/wakil), `entri.php` (artikel & album), `gambar.php` (gambar artikel/album) |
| `api/config.sample.php` | Contoh konfigurasi server — salinan berisi password **tidak** di-commit |
| `uploads/` | Gambar yang diunggah dari Control Panel (hanya di server): `foto/` ketua & wakil, `artikel/<id>/`, `album/<id>/` |
| `content.js` | Memuat isi dari `api/content.php`; kalau gagal pakai `data.js` |
| `data.js` | **Isi bawaan** + filosofi logo (tidak diedit dari control panel) |
| `vendor/` | anime.js 4.5.0 (animasi) |
| `assets/web/` | Gambar & font yang dipakai web (sudah dikecilkan) |
| `assets/EMBLEM LOGO`, `LOGO ANGKATAN`, `FONT` | File asli dari Drive (besar, tidak di-push) |
| `konten/` | Teks sumber + arsip internal (struktur lengkap) — tidak di-push |
| `.assetsignore` | File yang tidak ikut diunggah ke Cloudflare Workers (`api/`, dokumen `.md`, dll.) |

## Mengedit isi

Setelah web dipasang di cPanel (**PANDUAN-CPANEL.md**), semua ini diedit dari `admin.html`:
tanggal/jam/tempat peresmian, halaman Undangan & Panggung Gembira, ketua & wakil (termasuk foto), momen penting,
artikel (dengan thumbnail) dan album dokumentasi. Artikel & album punya tombol Simpan sendiri dan status Draf/Terbit.

Kalau dibuka tanpa server (mis. klik dua kali), web memakai isi bawaan di `data.js` — foto ketua & wakil bisa ditaruh manual di
`assets/web/foto/` (`tmi-putra-ketua.jpg`, `tmi-putra-wakil.jpg`, … `tahfizh-putri-wakil.jpg`, potret 3:4).
Tanpa foto, web menampilkan inisial nama.

## Catatan

- Control panel harus dibuka dari alamat hosting (`https://domainmu/admin.html`), **bukan** klik dua kali.
- Kalau Windows/HP memakai pengaturan "kurangi gerakan" (Animation effects: Off), web sengaja tampil tanpa animasi.
- **Font:** Chocolatier & Rosellinda Alyamore berlisensi *Personal Use* — boleh untuk web non-komersial ini, tidak untuk jualan/merchandise. Rosellinda versi gratis menampilkan "WARNING" di tempat angka — jangan dipakai untuk teks berangka. Teks isi memakai Hanken Grotesk & Amiri (Google Fonts).
