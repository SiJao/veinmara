# Panduan Web VEINMARA di Cloudflare

Web versi Cloudflare: **https://veinmara.216326.workers.dev** (nanti bisa diganti domain sendiri, mis. `veinmaragen.com`).

| Bagian | Di mana |
|---|---|
| Halaman, CSS, JS, gambar bawaan | Cloudflare Workers (file statis) |
| API (`/api/...`) | `worker/index.js` — alamatnya sama dengan versi PHP, jadi halaman web tidak berubah |
| Isi web, artikel, album, daftar undangan, **foto** | Database **D1** `veinmara` |
| Pengaturan | `wrangler.jsonc` |

Setiap **push ke GitHub (main)** otomatis di-deploy oleh Cloudflare dalam ±1 menit.
Tabel database dibuat otomatis saat web pertama kali dipakai. Data di cPanel **tidak** ikut pindah — isi ulang lewat Control Panel.

## 1. Buat Client ID Google (wajib — untuk login Control Panel & undangan)

Di versi Cloudflare, Control Panel **tidak memakai kata sandi**: admin masuk dengan akun Google
yang tertulis di `ADMIN_EMAIL` (`wrangler.jsonc`).

1. Buka **console.cloud.google.com** → login dengan akun sekolah → **New Project** → nama `Veinmara` → **Create**.
2. **Google Auth Platform → Branding / OAuth consent screen**: App name `VEINMARA Generation`, support email = emailmu.
   Audience: **Internal** (hanya akun sekolah). Kalau tidak bisa, pilih **External** lalu **Publish app**.
3. **Clients / Credentials → Create OAuth client ID** → **Web application**:
   - **Authorized JavaScript origins**: `https://veinmara.216326.workers.dev`
     (nanti tambahkan juga domain sendiri, mis. `https://veinmaragen.com`)
   - Redirect URI dikosongkan → **Create**.
4. Salin **Client ID** (`123456-abc.apps.googleusercontent.com` — bukan rahasia).
5. Di GitHub buka `wrangler.jsonc` → ✏️ Edit → isi `"GOOGLE_CLIENT_ID": "CLIENT_ID_TADI"` → **Commit**.
   Tunggu ±1 menit sampai Cloudflare selesai deploy.

> Pengaturan lewat dashboard Cloudflare (Settings → Variables) akan **tertimpa** saat deploy berikutnya —
> selalu ubah lewat `wrangler.jsonc`.

## 2. Mulai memakai

1. Buka `https://veinmara.216326.workers.dev/admin` → **Masuk dengan Google** → pilih akun admin.
2. Database masih kosong: Control Panel memuat isi bawaan. Tekan **Simpan** untuk menerbitkannya.
3. Tab dan cara pakainya sama dengan versi cPanel (lihat PANDUAN-CPANEL.md §5–§6b, kecuali bagian `veinmara-config.php`).

Menambah admin lain: tulis beberapa email dipisah koma di `ADMIN_EMAIL`, mis. `"216326@daarululuumlido.com,123456@daarululuumlido.com"`.

## Kuota gratis

| Batas | Kira-kira |
|---|---|
| Database D1: 500 MB | ±1.500 foto album (foto + versi kecil ±290 KB) + semua teks |
| Worker: 100.000 permintaan/hari | Hanya API & gambar unggahan yang dihitung; foto disimpan browser pengunjung, jadi tidak diunduh berulang |
| File statis | Tidak terbatas & gratis |

Cek pemakaian: dashboard Cloudflare → **Storage & Databases → D1 → veinmara** (ukuran database) dan **Workers & Pages → veinmara → Metrics**.
Kalau database mulai penuh, foto bisa dipindah ke R2 tanpa mengubah halaman web.

## Melihat & mencadangkan data

- Dashboard → **D1 → veinmara → Console**: bisa menjalankan SQL, mis. `SELECT email, nama, dibuka FROM vm_undangan;`
- Jangan menghapus baris `session_secret` di tabel `vm_konten` (kalau terhapus, semua orang otomatis keluar — tidak berbahaya, tapi harus masuk lagi).
- D1 menyimpan riwayat 7 hari di paket gratis (**Time Travel**): data bisa dikembalikan ke titik waktu sebelumnya dari dashboard.

## Kalau ada masalah

| Gejala | Penyebab |
|---|---|
| "Login Google belum diatur" | `GOOGLE_CLIENT_ID` di `wrangler.jsonc` masih kosong |
| Tombol Google error *origin_mismatch* | Alamat web belum ada di **Authorized JavaScript origins** (langkah 1.3) |
| "Akun ... bukan admin" | Email itu tidak ada di `ADMIN_EMAIL` |
| "Database belum dihubungkan" | Bagian `d1_databases` di `wrangler.jsonc` terhapus / ID salah |
| Deploy gagal | Dashboard → Workers & Pages → veinmara → **Deployments** → buka log build |
| Perubahan tidak muncul | Refresh paksa (Ctrl+F5) |
