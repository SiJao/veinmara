# Panduan Memasang Web VEINMARA di cPanel

Untuk hosting cPanel (mis. cpanel.gratis) yang punya **PHP 7.4+** dan **MySQL**. Dilakukan sekali, ±15 menit.

## 1. Buat database MySQL

1. Masuk cPanel → **MySQL® Databases**.
2. **Create New Database**: isi `veinmara` → nama lengkapnya jadi `namauser_veinmara`. Catat.
3. **MySQL Users → Add New User**: isi nama (mis. `vmadmin`) + kata sandi kuat → nama lengkap `namauser_vmadmin`. Catat keduanya.
4. **Add User To Database**: pilih user & database tadi → **Add** → centang **ALL PRIVILEGES** → **Make Changes**.

Tabel dibuat **otomatis** saat web pertama kali dipakai — tidak perlu import apa pun.

## 2. Buat file konfigurasi (berisi kata sandi — JANGAN di-upload ke GitHub)

1. Buka file `api/config.sample.php` dari repo, salin isinya.
2. cPanel → **File Manager** → buka folder **home** (folder paling atas, yang berisi `public_html` — **bukan di dalam** `public_html`).
3. **+ File** → nama `veinmara-config.php` → **Edit** → tempel, lalu isi:
   - `dbname=` → nama database dari langkah 1.2
   - `db_user`, `db_pass` → user & kata sandi database dari langkah 1.3
   - `admin_password` → **kata sandi untuk masuk Control Panel** (buat yang panjang & unik, berbeda dari kata sandi database)
4. **Save**.

> File di luar `public_html` tidak bisa dibuka siapa pun dari internet.

## 3. Upload web

1. Di GitHub repo **SiJao/veinmara** → tombol hijau **Code → Download ZIP**.
2. cPanel → **File Manager** → masuk `public_html` → **Upload** → pilih ZIP tadi.
3. Klik kanan ZIP → **Extract**. Akan muncul folder `veinmara-main`.
4. Masuk `veinmara-main` → **Select All** → **Move** → tujuan `/public_html` → hapus folder `veinmara-main` & file ZIP yang sudah kosong.

> Kalau ingin web di subfolder (mis. `domainmu/veinmara`), pindahkan ke `public_html/veinmara` saja — konfigurasi tetap ditemukan.

## 4. Aktifkan HTTPS

cPanel → **SSL/TLS Status** (atau **Let's Encrypt**) → pastikan domain sudah ber-SSL. Login admin **harus** lewat `https://`.

## 5. Mulai memakai Control Panel

1. Buka `https://domainmu/admin.html` → masukkan kata sandi admin.
2. Pertama kali database masih kosong: Control Panel memuat isi bawaan. Tekan **Simpan** untuk menerbitkannya.

| Tab | Isi |
|---|---|
| Acara & Countdown | Tanggal, jam, dan tempat peresmian (hitung mundur di beranda) |
| Halaman | Undangan & Panggung Gembira: tampil/sembunyi di menu, judul, pesan "Coming Soon" |
| Ketua & Wakil | Nama, kelas, asal, dan foto (otomatis dipotong 3:4 & dikecilkan) |
| Momen Penting | Tambah, ubah, urutkan, hapus momen di timeline |
| Artikel | Tulis artikel (tebal, miring, subjudul, daftar, kutipan, tautan, gambar) + thumbnail 16:9 |
| Dokumentasi | Album per acara: unggah banyak foto sekaligus, keterangan, urutan, sampul |

Perubahan langsung tampil di web setelah **Simpan** (cukup refresh halaman).

**Artikel & Dokumentasi** disimpan per artikel/album dengan tombol **Simpan** di bawah editornya.
Yang baru dibuat berstatus **Draf** (tidak tampil di web) sampai **Terbitkan** dicentang lalu disimpan.
3 artikel & 3 album terbaru juga tampil di beranda.

> Kuota hosting gratis terbatas. Satu foto album ±250 KB (+ versi kecil ±40 KB), jadi 100 foto ≈ 30 MB.
> Cek sisa kuota di cPanel → **Disk Usage**.

## 6. Undangan (login Google akun sekolah)

Halaman `undangan.html` **tidak ada di menu**. Bagikan link-nya; tamu masuk dengan akun Google
**@daarululuumlido.com**, lalu server mengecek apakah emailnya ada di daftar undangan.

### 6a. Buat Client ID Google (sekali saja, ±10 menit)

1. Buka **console.cloud.google.com** → login dengan akun sekolah → **Select a project → New Project** → nama `Veinmara` → **Create**.
2. Menu **APIs & Services → OAuth consent screen** (atau **Google Auth Platform → Branding**):
   - App name `VEINMARA Generation`, user support email = emailmu.
   - Audience / User type: pilih **Internal** kalau ada (hanya akun sekolah yang bisa masuk — paling cocok).
     Kalau Internal tidak bisa dipilih, pilih **External** lalu **Publish app** (status *In production*).
   - Scope tidak perlu ditambah (cukup bawaan: email, profile).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**, nama `Web Veinmara`.
   - **Authorized JavaScript origins** → tambahkan alamat web, mis. `https://domainmu` (tanpa garis miring di akhir).
     Kalau web ada di subfolder, tetap isi domainnya saja.
   - Redirect URI dikosongkan → **Create**.
4. Salin **Client ID** (bentuknya `123456-abc.apps.googleusercontent.com`). Ini bukan rahasia; *Client secret* tidak dipakai.
5. Buka `veinmara-config.php` di folder home → isi `'google_client_id' => 'CLIENT_ID_TADI',` (lihat contoh di `api/config.sample.php`) → **Save**.

### 6b. Cek & isi daftar

1. Control Panel → tab **Undangan** → **Cek koneksi**. Ketiganya harus ✓.
   Kalau "Hosting bisa menghubungi Google" ✕, hosting memblokir koneksi keluar — login undangan tidak bisa dipakai di hosting itu.
2. Tambah tamu satu per satu, atau **Impor CSV**: `email,nama,keterangan` per baris (bisa ditempel langsung dari Google Sheets).
3. Teks undangan diatur di tab **Halaman → Undangan → Pesan** (tampil setelah tamu masuk).
4. Kolom **Dibuka** menunjukkan siapa yang sudah membuka undangannya.

> Kalau tamu melihat pesan bahwa aplikasi diblokir, admin Google Workspace sekolah membatasi aplikasi pihak ketiga —
> minta admin TI sekolah mengizinkan Client ID tadi (Admin console → Security → API controls).

## Memperbarui web (kalau kodenya berubah di GitHub)

Ulangi langkah 3 (Download ZIP → upload → extract → timpa). Isi dari Control Panel (database) dan semua gambar yang diunggah (`uploads/`) **tidak hilang**, dan file konfigurasi di folder home tidak tersentuh.

## Keamanan yang sudah dipasang

- Kata sandi admin dicek di server; salah **5×** dalam 15 menit → diblokir sementara.
- Login berakhir otomatis setelah 2 jam tidak aktif.
- Setiap penyimpanan butuh token keamanan (anti-CSRF).
- Foto dicek benar-benar JPEG; folder `uploads/foto` tidak bisa menjalankan skrip.

## Kalau ada masalah

| Gejala | Penyebab |
|---|---|
| Control Panel: "Konfigurasi server belum dibuat" | `veinmara-config.php` belum ada / salah tempat (harus di folder home) |
| "Database tidak bisa dihubungi" | Nama database/user/kata sandi di konfigurasi salah, atau user belum ditambahkan ke database |
| "Kata sandi salah" | Cek `admin_password` di `veinmara-config.php` |
| "Terlalu banyak percobaan salah" | Tunggu 15 menit |
| Web tidak berubah setelah Simpan | Refresh paksa (Ctrl+F5) |
| Undangan: "Login undangan belum diatur" | `google_client_id` belum diisi di `veinmara-config.php` |
| Tombol Google error *origin_mismatch* / tidak muncul | Alamat web belum ditambahkan di **Authorized JavaScript origins** (6a langkah 3) |
| "Email ... tidak ada dalam daftar undangan" | Tambahkan email itu di tab Undangan |
