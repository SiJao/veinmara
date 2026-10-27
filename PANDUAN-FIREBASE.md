# Panduan Menyiapkan Firebase (Control Panel)

Dilakukan **sekali saja**, ±15 menit. Semua gratis (paket Spark) — tidak perlu kartu kredit.

## 1. Buat project

1. Buka <https://console.firebase.google.com> → **Add project / Tambahkan project**.
2. Nama: `veinmara` → Google Analytics **tidak perlu** (matikan) → **Create project**.

## 2. Aktifkan login email

1. Menu kiri **Build → Authentication** → **Get started**.
2. Tab **Sign-in method** → **Email/Password** → aktifkan (Enable) → **Save**.
3. Tab **Users** → **Add user** → isi email & kata sandi admin → **Add user**.
4. Di daftar Users, salin **User UID** akun tadi (deretan huruf-angka panjang). Simpan, dipakai di langkah 3.

## 3. Buat database + aturan keamanan

1. Menu **Build → Firestore Database** → **Create database**.
2. Lokasi: **asia-southeast2 (Jakarta)** → mode **Production** → **Create**.
3. Tab **Rules** → hapus isi yang ada → tempel seluruh isi file `firestore.rules` dari repo ini.
4. Ganti teks `GANTI_DENGAN_UID_ADMIN` dengan **User UID** dari langkah 2.4 → **Publish**.

> Aturan ini membuat **semua orang hanya bisa membaca**, dan **hanya akun admin itu** yang bisa menyimpan.

## 4. Hubungkan web ke Firebase

1. Ikon ⚙️ **Project settings** → bagian **Your apps** → klik ikon **Web `</>`**.
2. Nama app: `veinmara-web` → **Register app** (Firebase Hosting tidak perlu dicentang).
3. Akan muncul `firebaseConfig`. Salin tiga nilai ini ke file **`firebase-config.js`**:

```js
window.VEINMARA_FIREBASE = {
  apiKey: "AIza....",
  authDomain: "veinmara-xxxx.firebaseapp.com",
  projectId: "veinmara-xxxx",
};
```

4. Commit & push `firebase-config.js`.

> apiKey Firebase **memang boleh publik** — keamanan dijaga oleh aturan di langkah 3, bukan oleh kerahasiaan kunci ini.

## 5. Izinkan domain web

**Authentication → Settings → Authorized domains** → **Add domain** → `sijao.github.io`.

## 6. Mulai memakai Control Panel

1. Aktifkan GitHub Pages (repo → Settings → Pages → Branch `main` / root).
2. Buka `https://sijao.github.io/veinmara/admin.html` → masuk dengan akun admin.
3. Pertama kali, database masih kosong: control panel otomatis memuat isi bawaan. Tekan **Simpan** untuk menerbitkannya.

> Control panel **tidak bisa** dibuka dengan klik dua kali (`file://`) — browser memblokir modul Firebase dari file lokal.
> Untuk mencoba di komputer: jalankan `npx serve` di folder `veinmara`, lalu buka `http://localhost:3000/admin.html`
> (tambahkan juga `localhost` di Authorized domains bila belum ada).

## Yang bisa diedit

| Tab | Isi |
|---|---|
| Acara & Countdown | Tanggal, jam, dan tempat peresmian (hitung mundur di beranda) |
| Halaman | Undangan & Panggung Gembira: tampil/sembunyi di menu, judul, pesan "Coming Soon" |
| Ketua & Wakil | Nama, kelas, asal, dan foto (otomatis dipotong 3:4 & dikecilkan) |
| Momen Penting | Tambah, ubah, urutkan, hapus momen di timeline |

Perubahan tampil di web **langsung** setelah Simpan (cukup refresh halaman).

## Kalau ada masalah

| Pesan | Penyebab |
|---|---|
| "Ditolak: akun ini bukan admin" | UID di aturan Firestore tidak sama dengan UID akun yang login |
| "Email atau kata sandi salah" | Cek akun di Authentication → Users |
| Web tidak berubah setelah Simpan | Refresh paksa (Ctrl+F5); pastikan `firebase-config.js` sudah terisi & ter-push |
