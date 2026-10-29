/* Halaman artikel: daftar semua artikel, atau satu artikel kalau ada ?id=... */
(function () {
  "use strict";
  var FX = window.VeinmaraFX, C = window.VeinmaraContent;
  var $ = FX.$, $$ = FX.$$, esc = FX.esc;
  var body = $("#page-body");
  var id = new URLSearchParams(location.search).get("id");

  FX.initNav();
  FX.initVeins();
  C.load().then(FX.applyPageLinks);

  function pesan(teks) {
    body.innerHTML = '<p class="page-empty">' + teks + '</p><p class="page-back"><a class="btn" href="' +
      (id ? "artikel.html" : "index.html") + '">← ' + (id ? "Semua artikel" : "Kembali ke Beranda") + "</a></p>";
  }

  if (!id) {
    C.list("artikel").then(function (list) {
      if (!list.length) return pesan("Belum ada artikel. Nantikan kabar dari VEINMARA Generation.");
      body.innerHTML = '<div class="posts">' + list.map(FX.cardArtikel).join("") + "</div>";
      FX.revealOnScroll($$(".reveal", body));
    });
    FX.introPage();
    return;
  }

  C.get("artikel", id).then(function (a) {
    if (!a) {
      $("#page-title").textContent = "Tidak ditemukan";
      FX.introPage();
      return pesan("Artikel ini tidak ada atau belum diterbitkan.");
    }
    document.title = a.judul + " · VEINMARA Generation";
    $("#page-eyebrow").textContent = C.tanggal(a.tanggal);
    $("#page-title").textContent = a.judul;
    $("#page-title").classList.add("page-title--long");
    $("#page-sub").textContent = a.ringkasan || "";
    body.innerHTML =
      '<article class="read">' +
      (a.sampul ? '<img class="read__cover reveal" src="' + esc(a.sampul) + '" alt="" decoding="async">' : "") +
      '<div class="prose reveal">' + window.VeinmaraRich.clean(a.isi, a.id) + "</div>" +
      '<p class="page-back"><a class="btn" href="artikel.html">← Semua artikel</a></p></article>';
    FX.introPage();
    FX.revealOnScroll($$(".reveal", body));
  }, function () {
    FX.introPage();
    pesan("Artikel tidak bisa dimuat. Periksa koneksi lalu muat ulang halaman.");
  });
})();
