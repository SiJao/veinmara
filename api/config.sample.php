<?php
/*
 * CONTOH konfigurasi server VEINMARA.
 *
 * 1. Salin file ini menjadi  veinmara-config.php
 * 2. Taruh di folder HOME cPanel (satu tingkat DI ATAS public_html), bukan di dalam public_html.
 * 3. Isi data database & kata sandi admin di bawah.
 *
 * JANGAN commit file hasil isian ke GitHub.
 */
return [
    // Database MySQL dari cPanel → "MySQL® Databases"
    'db_dsn'  => 'mysql:host=localhost;dbname=NAMAUSER_veinmara;charset=utf8mb4',
    'db_user' => 'NAMAUSER_vmadmin',
    'db_pass' => 'ISI_PASSWORD_DATABASE',

    // Kata sandi untuk masuk ke Control Panel (admin.html). Buat yang panjang & unik.
    'admin_password' => 'GANTI_DENGAN_KATA_SANDI_ADMIN',

    // (Opsional, lebih aman) ganti baris di atas dengan hash bcrypt:
    // 'admin_password_hash' => '$2y$10$....',

    // Undangan: login Google khusus akun sekolah. Client ID dari Google Cloud Console
    // (lihat PANDUAN-CPANEL.md bagian "Undangan"). Kosong = halaman undangan belum bisa login.
    'google_client_id' => '',
    'undangan_domain' => 'daarululuumlido.com',
];
