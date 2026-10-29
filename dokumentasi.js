/* Halaman dokumentasi: daftar album, atau galeri satu album kalau ada ?id=... */
(function () {
  "use strict";
  var FX = window.VeinmaraFX, C = window.VeinmaraContent;
  var A = FX.A, MOTION = FX.MOTION, $ = FX.$, $$ = FX.$$, esc = FX.esc;
  var body = $("#page-body");
  var id = new URLSearchParams(location.search).get("id");

  FX.initNav();
  FX.initVeins();
  C.load().then(FX.applyPageLinks);

  function pesan(teks) {
    body.innerHTML = '<p class="page-empty">' + teks + '</p><p class="page-back"><a class="btn" href="' +
      (id ? "dokumentasi.html" : "index.html") + '">← ' + (id ? "Semua album" : "Kembali ke Beranda") + "</a></p>";
  }

  if (!id) {
    C.list("album").then(function (list) {
      if (!list.length) return pesan("Belum ada dokumentasi. Foto kegiatan akan tampil di sini.");
      body.innerHTML = '<div class="albums">' + list.map(FX.cardAlbum).join("") + "</div>";
      FX.revealOnScroll($$(".reveal", body));
    });
    FX.introPage();
    return;
  }

  C.get("album", id).then(function (a) {
    if (!a) {
      $("#page-title").textContent = "Tidak ditemukan";
      FX.introPage();
      return pesan("Album ini tidak ada atau belum diterbitkan.");
    }
    document.title = a.judul + " · Dokumentasi VEINMARA";
    $("#page-eyebrow").textContent = C.tanggal(a.tanggal) + " · " + a.foto.length + " foto";
    $("#page-title").textContent = a.judul;
    $("#page-title").classList.add("page-title--long");
    $("#page-sub").textContent = a.keterangan || "";
    body.innerHTML = (a.foto.length
      ? '<div class="gallery">' + a.foto.map(function (f, i) {
          return '<button type="button" class="gallery__item reveal" data-from="zoom" data-d="' + (i % 4) * 0.05 + '" data-i="' + i + '" aria-label="Buka foto ' + (i + 1) + '">' +
            '<img src="' + esc(f.thumb) + '" alt="' + esc(f.k) + '" loading="lazy" decoding="async"></button>';
        }).join("") + "</div>"
      : '<p class="page-empty">Album ini belum berisi foto.</p>') +
      '<p class="page-back"><a class="btn" href="dokumentasi.html">← Semua album</a></p>';
    FX.introPage();
    FX.revealOnScroll($$(".reveal", body));
    if (a.foto.length) lightbox(a.foto);
  }, function () {
    FX.introPage();
    pesan("Album tidak bisa dimuat. Periksa koneksi lalu muat ulang halaman.");
  });

  /* ---------- Foto layar penuh: panah/geser untuk pindah, Esc untuk tutup ---------- */
  function lightbox(foto) {
    var lb = document.createElement("div");
    lb.className = "lightbox";
    lb.hidden = true;
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Foto");
    lb.innerHTML =
      '<button type="button" class="lightbox__btn lightbox__close" aria-label="Tutup">✕</button>' +
      '<button type="button" class="lightbox__btn lightbox__prev" aria-label="Foto sebelumnya">‹</button>' +
      '<figure class="lightbox__fig"><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="lightbox__btn lightbox__next" aria-label="Foto berikutnya">›</button>' +
      '<p class="lightbox__count"></p>';
    document.body.appendChild(lb);
    var img = $("img", lb), cap = $("figcaption", lb), count = $(".lightbox__count", lb);
    var cur = 0, opener = null;

    function show(i, dir) {
      cur = (i + foto.length) % foto.length;
      var f = foto[cur];
      img.src = f.src;
      img.alt = f.k || "Foto " + (cur + 1);
      cap.textContent = f.k || "";
      count.textContent = (cur + 1) + " / " + foto.length;
      new Image().src = foto[(cur + 1) % foto.length].src; // siapkan foto berikutnya
      if (MOTION && dir) A.waapi.animate(img, { opacity: [0, 1], transform: ["translateX(" + dir * 30 + "px)", "translateX(0px)"], duration: 380, ease: "outQuart" });
    }
    function open(i, from) {
      opener = from;
      lb.hidden = false;
      document.documentElement.classList.add("no-scroll");
      show(i, 0);
      if (MOTION) A.waapi.animate(lb, { opacity: [0, 1], duration: 250, ease: "outQuad" });
      $(".lightbox__close", lb).focus();
    }
    function close() {
      lb.hidden = true;
      img.removeAttribute("src");
      document.documentElement.classList.remove("no-scroll");
      if (opener) opener.focus();
    }

    body.addEventListener("click", function (e) {
      var b = e.target.closest(".gallery__item");
      if (b) open(+b.dataset.i, b);
    });
    var swiped = false;
    lb.addEventListener("click", function (e) {
      if (swiped) { swiped = false; return; } // klik sisa dari gerakan geser
      if (e.target.closest(".lightbox__close") || e.target === lb) close();
      else if (e.target.closest(".lightbox__prev")) show(cur - 1, -1);
      else if (e.target.closest(".lightbox__next")) show(cur + 1, 1);
    });
    document.addEventListener("keydown", function (e) {
      if (lb.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") show(cur - 1, -1);
      else if (e.key === "ArrowRight") show(cur + 1, 1);
      else if (e.key === "Tab") { // fokus tetap di dalam layar foto
        var f = $$("button", lb), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // geser di HP
    var x0 = null;
    lb.addEventListener("pointerdown", function (e) { x0 = e.clientX; });
    lb.addEventListener("pointerup", function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) {
        swiped = true;
        setTimeout(function () { swiped = false; }, 350);
        show(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      }
    });
  }
})();
