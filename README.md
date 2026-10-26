# Web VEINMARA Generation

Web statis angkatan Kelas Akhir 2026–2027, Pesantren Modern Daarul 'Uluum Lido.
Tidak butuh server/database — cukup buka `index.html` di browser.

## Struktur

| File / folder | Isi |
|---|---|
| `index.html` | Kerangka halaman |
| `style.css` | Tampilan & animasi |
| `main.js` | Interaksi (hitung mundur, filosofi logo, animasi scroll) |
| `data.js` | **Semua isi web** — ubah teks di sini saja |
| `assets/web/` | Gambar & font yang dipakai web (sudah dikecilkan) |
| `assets/EMBLEM LOGO`, `LOGO ANGKATAN`, `FONT` | File asli dari Drive (besar, **jangan di-upload ke hosting**) |
| `konten/` | Teks sumber + arsip internal (struktur lengkap) — **jangan di-upload** |

## Menambah foto ketua & wakil

1. Siapkan foto potret **3:4** (±600×800 px), format `.jpg`, ukuran < 300 KB.
2. Simpan di `assets/web/foto/` dengan nama:
   `tmi-putra-ketua.jpg`, `tmi-putra-wakil.jpg`, `tmi-putri-ketua.jpg`, `tmi-putri-wakil.jpg`,
   `tahfizh-putra-ketua.jpg`, `tahfizh-putra-wakil.jpg`, `tahfizh-putri-ketua.jpg`, `tahfizh-putri-wakil.jpg`
3. Selama foto belum ada, web otomatis menampilkan inisial nama.

## Menambah momen penting

Di `data.js`, tambahkan item baru pada `momen: [ ... ]` (tanggal, judul, tempat, isi).

## Upload ke hosting

Yang di-upload cukup: `index.html`, `style.css`, `main.js`, `data.js`, dan folder `assets/web/`.

## Catatan font

- **Chocolatier** (judul) dan **Rosellinda Alyamore** (tulisan "Generation", "Vein", "Mara") berlisensi *Personal Use* — boleh untuk web non-komersial ini, **tidak boleh** dipakai untuk jualan/merchandise.
- Rosellinda versi gratis menampilkan tulisan "WARNING" di tempat angka — jangan dipakai untuk teks yang berisi angka.
- Teks isi memakai **Hanken Grotesk** dan ayat memakai **Amiri** (Google Fonts, gratis) — perlu internet; tanpa internet otomatis memakai font bawaan.
