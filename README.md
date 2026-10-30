# Web VEINMARA Generation

Web angkatan Kelas Akhir 2026–2027, Pesantren Modern Daarul 'Uluum Lido.
Berjalan di **Cloudflare Workers + database D1**: https://veinmara.216326.workers.dev.
Isi yang sering berubah diedit lewat **Control Panel** (`/admin`, login Google). Cara pakai & pengaturan: **PANDUAN.md**.

## Halaman

| Halaman | Isi |
|---|---|
| `index.html` | Beranda: hitung mundur peresmian, filosofi nama & logo, ketua & wakil, momen, artikel & album terbaru |
| `artikel.html` | Daftar artikel; `artikel.html?id=...` = satu artikel |
| `dokumentasi.html` | Daftar album foto; `dokumentasi.html?id=...` = galeri satu album |
| `undangan.html` | Undangan — tidak ada di menu; tamu masuk dengan akun Google @daarululuumlido.com yang ada di daftar undangan |
| `panggung-gembira.html` | Panggung Gembira — sementara *Coming Soon* |
| `terkunci.html` | Hitung mundur saja — tampil menggantikan halaman lain selama web **dikunci** |
| `admin.html` | **Control Panel** (khusus admin) |

## Struktur folder

| Folder / file | Isi |
|---|---|
| `css/` | `style.css` (web), `admin.css` (Control Panel) |
| `js/` | Skrip halaman — lihat tabel di bawah |
| `assets/web/` | Logo, 11 gambar unsur logo, font |
| `vendor/` | anime.js 4.5.0 (animasi) |
| `worker/index.js` | Server: API (`/api/...`), gambar unggahan (`/uploads/...`), kunci web, login Google |
| `wrangler.jsonc` | Pengaturan Cloudflare: database, Client ID Google, email admin |
| `.assetsignore` | File yang tidak ikut diunggah sebagai file web |
| `konten/` | Teks sumber + arsip internal (struktur lengkap) — **hanya lokal, tidak di-push** |

| Skrip (`js/`) | Dipakai di |
|---|---|
| `data.js` | Isi bawaan + filosofi logo (dipakai kalau server tidak terjangkau) |
| `content.js` | Semua halaman: memuat isi dari `api/content` & artikel/album dari `api/entri` |
| `fx.js` | Semua halaman: menu, garis nadi emas, titik cahaya, kartu artikel/album |
| `rich.js` | Pembersih isi artikel & template undangan (hanya format aman yang tampil) |
| `main.js` | Beranda |
| `artikel.js`, `dokumentasi.js` | Artikel & dokumentasi (galeri + foto layar penuh) |
| `soon.js`, `undangan.js` | Halaman Coming Soon & undangan (login Google tamu) |
| `terkunci.js` | Halaman kunci (hitung mundur, terbuka sendiri saat waktunya tiba) |
| `admin.js`, `admin-entri.js`, `admin-tamu.js` | Control Panel: isi web & kunci, artikel/album, daftar undangan |

## Catatan

- Setiap push ke GitHub (`main`) otomatis di-deploy Cloudflare (±1 menit).
- Kalau Windows/HP memakai pengaturan "kurangi gerakan" (Animation effects: Off), web sengaja tampil tanpa animasi.
- **Font:** Chocolatier & Rosellinda Alyamore berlisensi *Personal Use* — boleh untuk web non-komersial ini, tidak untuk jualan/merchandise. Rosellinda versi gratis menampilkan "WARNING" di tempat angka — jangan dipakai untuk teks berangka. Teks isi memakai Hanken Grotesk & Amiri (Google Fonts).
