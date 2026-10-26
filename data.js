/*
 * DATA WEB VEINMARA
 * Semua isi web diatur dari file ini. Ubah teks di sini, tampilan ikut berubah.
 * Sumber: konten/*.md (Naskah Pengesahan Nama 26, Proposal Peresmian).
 */

window.VEINMARA = {
  peresmian: {
    // Waktu WIB (+07:00) — dipakai untuk hitung mundur di halaman utama
    waktu: "2026-11-08T20:00:00+07:00",
    tanggal: "Minggu, 8 November 2026",
    jam: "20.00 WIB",
    tempat: "Aula Siti Hajar",
  },

  // 11 elemen logo — urutan sesuai Naskah Pengesahan
  elemenLogo: [
    { nama: "Kelopak Bunga", gambar: "kelopak.png",
      makna: "Melambangkan proses tumbuh dan berkembangnya kami dalam membangun masa depan yang matang." },
    { nama: "Tameng", gambar: "tameng.png",
      makna: "Bentuk penegasan keteguhan kami dalam menjunjung nilai-nilai Islam dan menjaga identitas santri di dada setiap individu VEINMARA Generation." },
    { nama: "Enam Sayap", gambar: "sayap.png",
      makna: "Enam sayap merepresentasikan Rukun Iman, bahwa langkah kami senantiasa berlandaskan dengan keimanan." },
    { nama: "Mahkota Berlafaz Allah", gambar: "lafadz.png",
      makna: "Mahkota berlafaz Allah menegaskan bahwa setiap langkah kami berorientasi kepada Allah SWT." },
    { nama: "Siluet Masjid", gambar: "masjid.png",
      makna: "Siluet masjid melambangkan ikon pesantren sebagai tempat kami dibentuk." },
    { nama: "Tiga Buah Permata", gambar: "permata.png",
      makna: "Tiga permata merepresentasikan 30 tahun perjalanan pesantren yang bertepatan dengan lahirnya generasi kami. Kami adalah penoreh sejarah yang membuka wajah baru, pemantik perubahan." },
    { nama: "Cincin Putih", gambar: "cincin.png",
      makna: "Warnanya yang lembut bak mutiara melambangkan kesucian. Bentuknya melingkari logo menyimbolkan ketulusan niat yang utuh di hati kami." },
    { nama: "Bumi", gambar: "bumi.png",
      makna: "Menggambarkan medan pengabdian terakhir kami saat menjadi alumni nanti. Generasi yang menegakkan peradaban, penggagas perubahan." },
    { nama: "Al-Qur'an, Hadits dan Pena", gambar: "pena-buku.png",
      makna: "Al-Qur'an dan Hadits menjadi pedoman utama kehidupan dan perjuangan, sementara pena melambangkan media utama dalam mengamalkan ilmu." },
    { nama: "Pisau Dagger", gambar: "dagger.png",
      makna: "Dua mata pisaunya melambangkan ketahanan dan ketegasan kami dalam menghadapi tantangan serta mengarungi setiap hingar-bingar kehidupan." },
    { nama: "Emblem VEINMARA & A Renewal Catalyst", gambar: "renewal.png",
      makna: "Menghadirkan nama yang lahir sebagai identitas angkatan kami; VEINMARA. Emblem di bawahnya menjadi penegas daripada semboyan angkatan kami." },
  ],

  /*
   * Ketua & Wakil Ketua Angkatan (ejaan sudah dicek ke data santri).
   * FOTO: taruh file di assets/web/foto/ dengan nama sesuai "foto" di bawah
   * (disarankan potret 3:4, ±600x800 px, format .jpg). Kalau file belum ada,
   * web otomatis menampilkan inisial nama.
   */
  pemimpin: [
    { unit: "TMI Putra", orang: [
      { jabatan: "Ketua Angkatan", nama: "Muhammad Manda Rizky", kelas: "6 A MIA", asal: "Jakarta", foto: "tmi-putra-ketua.jpg" },
      { jabatan: "Wakil Ketua Angkatan", nama: "Muhammad Gofar Azis", kelas: "6 G IIS", asal: "Jakarta Timur", foto: "tmi-putra-wakil.jpg" },
    ]},
    { unit: "TMI Putri", orang: [
      { jabatan: "Ketua Angkatan", nama: "Aqela Khalisha", kelas: "6 C MIA", asal: "Jakarta", foto: "tmi-putri-ketua.jpg" },
      { jabatan: "Wakil Ketua Angkatan", nama: "Davinsha Cahaya Ramadhanty", kelas: "6 C MIA", asal: "Depok", foto: "tmi-putri-wakil.jpg" },
    ]},
    { unit: "Tahfizh Putra", orang: [
      { jabatan: "Ketua Angkatan", nama: "Muhammad Ezar Firjatullah", kelas: "6 C MTA", asal: "Bogor", foto: "tahfizh-putra-ketua.jpg" },
      { jabatan: "Wakil Ketua Angkatan", nama: "Rafidz Al Fadhilah", kelas: "6 C MTA", asal: "Bogor", foto: "tahfizh-putra-wakil.jpg" },
    ]},
    { unit: "Tahfizh Putri", orang: [
      { jabatan: "Ketua Angkatan", nama: "Balqis Aqila Wibowo", kelas: "6 A MTA", asal: "Jakarta", foto: "tahfizh-putri-ketua.jpg" },
      { jabatan: "Wakil Ketua Angkatan", nama: "Kholifah Ummy Chairunisa", kelas: "6 B MTA", asal: "Bekasi", foto: "tahfizh-putri-wakil.jpg" },
    ]},
  ],

  // Momen penting — tambahkan momen baru di sini (paling lama di atas)
  momen: [
    {
      tanggal: "8 November 2026",
      judul: "Peresmian Nama Angkatan VEINMARA Generation",
      tempat: "Aula Siti Hajar",
      isi: "Pengesahan nama, logo, dan simbol VEINMARA Generation sebagai identitas resmi angkatan, sekaligus pengenalan filosofinya kepada keluarga besar pesantren.",
    },
  ],
};
