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

Perubahan langsung tampil di web setelah **Simpan** (cukup refresh halaman).

## Memperbarui web (kalau kodenya berubah di GitHub)

Ulangi langkah 3 (Download ZIP → upload → extract → timpa). Isi dari Control Panel (database) dan foto (`uploads/foto/`) **tidak hilang**, dan file konfigurasi di folder home tidak tersentuh.

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
