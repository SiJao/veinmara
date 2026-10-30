# Panduan Web VEINMARA

Web: **https://veinmara.216326.workers.dev** (nanti bisa diganti domain sendiri, mis. `veinmaragen.com`).

| Bagian | Di mana |
|---|---|
| Halaman, CSS, JS, gambar bawaan | Cloudflare Workers (file statis) |
| API (`/api/...`) & kunci web | `worker/index.js` |
| Isi web, artikel, album, daftar undangan, **foto** | Database **D1** `veinmara` |
| Pengaturan | `wrangler.jsonc` |

Setiap **push ke GitHub (main)** otomatis di-deploy oleh Cloudflare dalam ±1 menit.
Tabel database dibuat otomatis saat web pertama kali dipakai.

## 1. Client ID Google (sudah diisi)

Control Panel dan halaman undangan memakai login Google. Client ID ada di `wrangler.jsonc` (`GOOGLE_CLIENT_ID`).
Kalau suatu saat perlu dibuat ulang:

1. **console.cloud.google.com** → login akun sekolah → project `Veinmara`.
2. **Google Auth Platform → Clients → Create client** → **Web application**:
   - **Authorized JavaScript origins**: `https://veinmara.216326.workers.dev`
     (tambahkan juga domain sendiri kalau sudah ada, mis. `https://veinmaragen.com`)
3. Salin Client ID → di GitHub edit `wrangler.jsonc` → `"GOOGLE_CLIENT_ID": "..."` → **Commit**.

> Pengaturan lewat dashboard Cloudflare (Settings → Variables) akan **tertimpa** saat deploy berikutnya —
> selalu ubah lewat `wrangler.jsonc`.

## 2. Control Panel

Buka `https://veinmara.216326.workers.dev/admin` → **Masuk dengan Google** (hanya akun di `ADMIN_EMAIL`).
Pertama kali database kosong: Control Panel memuat isi bawaan — tekan **Simpan** untuk menerbitkannya.

| Tab | Isi |
|---|---|
| Acara & Countdown | Tanggal, jam, tempat peresmian + **Kunci web** |
| Halaman | Judul halaman, pesan Panggung Gembira, **teks undangan** (template) |
| Ketua & Wakil | Nama, kelas, asal, dan foto (otomatis dipotong 3:4 & dikecilkan) |
| Momen Penting | Tambah, ubah, urutkan, hapus momen di timeline |
| Artikel | Tulis artikel (tebal, miring, subjudul, daftar, kutipan, tautan, gambar) + thumbnail 16:9 |
| Dokumentasi | Album per acara: unggah banyak foto sekaligus, keterangan, urutan, sampul |
| Undangan | Daftar tamu: email, nama, keterangan; impor CSV; siapa yang sudah membuka |

Isi web (3 tab pertama + Ketua & Wakil + Momen) disimpan dengan tombol **Simpan** di bawah layar.
Artikel & album punya tombol **Simpan** sendiri dan status **Draf/Terbit** (draf tidak tampil di web).

Menambah admin lain: tulis beberapa email dipisah koma di `ADMIN_EMAIL` (`wrangler.jsonc`).

## 3. Kunci web

Tab **Acara & Countdown → Kunci web**:

| Pilihan | Artinya |
|---|---|
| **Otomatis** | Terkunci sampai hitung mundur habis, lalu terbuka sendiri |
| **Kunci** | Tetap terkunci walau hitung mundur sudah habis |
| **Buka** | Web terbuka sekarang |

Selama terkunci, pengunjung yang membuka beranda, artikel, dokumentasi, atau Panggung Gembira hanya melihat hitung mundur —
isi web tidak dikirim sama sekali (tidak bisa diintip lewat *View source*). **Undangan** dan **Control Panel** tetap bisa dibuka,
dan admin yang sedang masuk tetap melihat web lengkap. Perubahan berlaku paling lama ±15 detik setelah **Simpan**.

## 4. Undangan

1. Tab **Undangan**: tambah tamu satu per satu, atau **Impor CSV** `email,nama,keterangan` per baris (bisa ditempel dari Google Sheets).
   Hanya email **@daarululuumlido.com**.
2. Tab **Halaman → Undangan → Teks undangan**: ubah kalimatnya. Tombol **+ Nama**, **+ Keterangan**, **+ Tanggal**, **+ Jam**, **+ Tempat**
   menyisipkan isian yang otomatis diganti untuk tiap tamu. Pratinjau di bawahnya menunjukkan hasilnya. Lalu **Simpan**.
3. Bagikan link `https://veinmara.216326.workers.dev/undangan.html` (tidak ada di menu). Tamu masuk dengan akun Google sekolah
   dan melihat undangan dengan namanya sendiri. Kolom **Dibuka** di tab Undangan menunjukkan siapa yang sudah membukanya.

> Kalau tamu melihat pesan bahwa aplikasi diblokir, admin Google Workspace sekolah membatasi aplikasi pihak ketiga —
> minta admin TI sekolah mengizinkan Client ID tadi (Admin console → Security → API controls).

## Kuota gratis

| Batas | Kira-kira |
|---|---|
| Database D1: 500 MB | ±1.500 foto album (foto + versi kecil ±290 KB) + semua teks |
| Worker: 100.000 permintaan/hari | Dihitung: API, gambar unggahan, dan halaman yang bisa dikunci. Foto disimpan browser pengunjung, jadi tidak diunduh berulang |
| File statis (CSS, JS, gambar bawaan) | Tidak terbatas & gratis |

Cek pemakaian: dashboard Cloudflare → **Storage & Databases → D1 → veinmara** dan **Workers & Pages → veinmara → Metrics**.
Kalau database mulai penuh, foto bisa dipindah ke R2 tanpa mengubah halaman web.

## Melihat & mencadangkan data

- Dashboard → **D1 → veinmara → Console**: bisa menjalankan SQL, mis. `SELECT email, nama, dibuka FROM vm_undangan;`
- Jangan menghapus baris `session_secret` di tabel `vm_konten` (kalau terhapus, semua orang otomatis keluar — tidak berbahaya, tapi harus masuk lagi).
- D1 menyimpan riwayat 7 hari di paket gratis (**Time Travel**): data bisa dikembalikan ke titik waktu sebelumnya dari dashboard.

## Kalau ada masalah

| Gejala | Penyebab |
|---|---|
| "Login Google belum diatur" | `GOOGLE_CLIENT_ID` di `wrangler.jsonc` kosong |
| Tombol Google error *origin_mismatch* | Alamat web belum ada di **Authorized JavaScript origins** (langkah 1.2) |
| "Akun ... bukan admin" | Email itu tidak ada di `ADMIN_EMAIL` |
| "Email ... tidak ada dalam daftar undangan" | Tambahkan email itu di tab Undangan |
| "Database belum dihubungkan" | Bagian `d1_databases` di `wrangler.jsonc` terhapus / ID salah |
| Web masih terkunci padahal sudah Buka | Tunggu ±15 detik lalu muat ulang; pastikan sudah tekan **Simpan** |
| Deploy gagal | Dashboard → Workers & Pages → veinmara → **Deployments** → buka log build |
| Perubahan tampilan tidak muncul | Refresh paksa (Ctrl+F5) |
