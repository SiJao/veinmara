/*
 * Konfigurasi Firebase (diisi sekali — lihat PANDUAN-FIREBASE.md).
 * Nilai ini memang PUBLIK menurut desain Firebase; keamanan dijaga oleh
 * aturan Firestore (firestore.rules), bukan oleh kerahasiaan apiKey.
 *
 * Selama apiKey / projectId masih kosong, web memakai isi bawaan dari data.js
 * dan control panel menampilkan petunjuk penyiapan.
 */
window.VEINMARA_FIREBASE = {
  apiKey: "",
  authDomain: "",
  projectId: "",
};
