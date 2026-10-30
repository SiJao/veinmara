/*
 * Efek & utilitas bersama untuk semua halaman VEINMARA.
 * - navigasi (menu HP, latar saat scroll)
 * - garis "nadi" emas + titik cahaya yang mengalir
 * - kilau bintang
 */
(function () {
  "use strict";
  var A = window.anime;
  var root = document.documentElement;

  // Animasi hanya jalan kalau anime.js termuat dan pengguna tidak memilih "kurangi gerakan".
  var MOTION = !!A && root.classList.contains("anim");
  if (!MOTION) root.classList.remove("anim");

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Navigasi ---------- */
  function initNav() {
    var nav = $("#nav"), toggle = $(".nav__toggle"), menu = $("#nav-menu");
    if (!nav) return;
    function onScroll() { nav.classList.toggle("is-scrolled", window.scrollY > 40); }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", open);
      menu.classList.toggle("is-open", open);
    });
    menu.addEventListener("click", function (e) {
      if (e.target.tagName === "A") { toggle.setAttribute("aria-expanded", "false"); menu.classList.remove("is-open"); }
    });
  }

  // Sembunyikan tautan ke halaman yang dimatikan dari control panel
  function applyPageLinks(D) {
    $$("a[data-halaman]").forEach(function (a) {
      var h = D.halaman && D.halaman[a.getAttribute("data-halaman")];
      a.hidden = !!h && h.tampil === false;
    });
  }

  /* ---------- Garis nadi emas ---------- */
  var VEIN_PATHS =
    '<path class="vein" d="M-20 60 C120 40 160 160 300 140 S500 40 640 90" stroke-width="2.2"/>' +
    '<path class="vein" d="M-20 85 C120 65 170 185 305 165 S505 65 640 115" stroke-width="1.4"/>' +
    '<path class="vein" d="M-20 110 C125 90 180 210 310 190 S510 90 640 140" stroke-width="1"/>' +
    '<path class="vein" d="M-20 135 C130 115 190 235 315 215 S515 115 640 165" stroke-width=".7"/>' +
    '<path class="vein vein--emerald" d="M-20 160 C135 140 200 260 320 240 S520 140 640 190" stroke-width=".9"/>';

  function initVeins() {
    var svgs = $$("svg.veins");
    if (!svgs.length) return;
    if (!document.getElementById("gold-line")) {
      var defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      defs.setAttribute("width", "0"); defs.setAttribute("height", "0");
      defs.setAttribute("aria-hidden", "true");
      defs.style.position = "absolute";
      defs.innerHTML = '<defs><linearGradient id="gold-line" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#f6e2b0"/><stop offset=".45" stop-color="#c69856"/><stop offset="1" stop-color="#8a5a22"/>' +
        "</linearGradient></defs>";
      document.body.appendChild(defs);
    }
    svgs.forEach(function (svg) {
      svg.innerHTML = '<g fill="none" stroke="url(#gold-line)" stroke-linecap="round">' + VEIN_PATHS + "</g>";
    });
    if (!MOTION) return;

    svgs.forEach(function (svg, si) {
      var paths = $$(".vein", svg);
      A.animate(A.svg.createDrawable(paths), {
        draw: ["0 0", "0 1"], duration: 2600, delay: A.stagger(140, { start: 200 + si * 300 }), ease: "inOutQuart"
      });
      // Titik cahaya: div HTML (lapisan GPU sendiri) yang digeser mengikuti path.
      // Titik-titik path dihitung SEKALI ke tabel; dihitung ulang hanya saat resize.
      var host = svg.parentElement;
      var anims = [];
      [[paths[0], 7000, ""], [paths[4], 9500, " vein-dot--emerald"]].forEach(function (d, k) {
        var path = d[0], len = path.getTotalLength(), N = 160, table = [];
        function build() {
          var m = path.getScreenCTM(), box = host.getBoundingClientRect();
          table = [];
          if (!m) return;
          for (var j = 0; j <= N; j++) {
            var pt = path.getPointAtLength(len * j / N);
            table.push([m.a * pt.x + m.c * pt.y + m.e - box.left, m.b * pt.x + m.d * pt.y + m.f - box.top]);
          }
        }
        build();
        window.addEventListener("resize", build, { passive: true });

        var dot = document.createElement("i");
        dot.className = "vein-dot" + d[2];
        dot.setAttribute("aria-hidden", "true");
        host.appendChild(dot);
        var state = { p: 0 };
        anims.push(A.animate(state, {
          p: [0, 1], duration: d[1], delay: 2600 + si * 900 + k * 1800,
          ease: "inOutSine", loop: true, loopDelay: 1200,
          onUpdate: function () {
            if (!table.length) return;
            var f = state.p * N, j = Math.min(N - 1, f | 0), t = f - j, a = table[j], b = table[j + 1];
            var x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
            dot.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
            dot.style.opacity = Math.sin(Math.PI * state.p).toFixed(3);
          }
        }));
      });
      // Hemat tenaga: titik berhenti saat bagiannya tidak terlihat di layar
      new IntersectionObserver(function (es) {
        anims.forEach(function (an) { es[0].isIntersecting ? an.resume() : an.pause(); });
      }).observe(host);
    });
  }

  /* ---------- Muncul saat di-scroll ---------- */
  // Jarak gerak pendek & durasi singkat agar terasa mengalun, bukan meloncat
  var FROM = {
    up: ["translateY(18px)", "translateY(0px)"],
    left: ["translateX(-24px)", "translateX(0px)"],
    right: ["translateX(24px)", "translateX(0px)"],
    zoom: ["scale(0.96)", "scale(1)"]
  };
  var revealIO = null;
  function revealOnScroll(els) {
    if (!MOTION) return;
    // anime.waapi = Web Animations API → transform/opacity dijalankan di thread compositor (GPU)
    function reveal(el, order) {
      el.classList.add("is-in"); // nilai akhir dipegang CSS setelah animasi selesai
      A.waapi.animate(el, {
        opacity: [0, 1],
        transform: FROM[el.dataset.from] || FROM.up,
        duration: 750,
        delay: (parseFloat(el.dataset.d) || 0) * 1000 + order * 60,
        ease: "outQuart"
      });
    }
    revealIO = revealIO || new IntersectionObserver(function (entries) {
      // elemen yang masuk layar bersamaan dijalankan bergiliran, bukan sekaligus
      var order = 0;
      entries.forEach(function (e) {
        if (e.isIntersecting) { reveal(e.target, order++); revealIO.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (el) { revealIO.observe(el); });
  }

  // Judul halaman Artikel/Dokumentasi muncul bergiliran
  function introPage() {
    var els = $$(".page-head [data-intro]");
    if (!MOTION) return;
    A.createTimeline({ defaults: { ease: "outExpo" }, delay: 80 })
      .add(els, { opacity: [0, 1], y: [18, 0], duration: 1000, delay: A.stagger(120) });
  }

  /* ---------- Kartu artikel & album (beranda + halaman daftar) ---------- */
  var C = function () { return window.VeinmaraContent; };
  function cardArtikel(a, i) {
    return '<a class="post reveal" data-d="' + (i % 3) * 0.1 + '" href="artikel.html?id=' + encodeURIComponent(a.id) + '">' +
      '<div class="post__img">' + (a.sampul ? '<img src="' + esc(a.sampul) + '" alt="" loading="lazy" decoding="async">' : '<span aria-hidden="true">V</span>') + "</div>" +
      '<div class="post__body"><p class="post__date">' + esc(C().tanggal(a.tanggal)) + "</p>" +
      "<h3>" + esc(a.judul) + "</h3>" + (a.ringkasan ? "<p>" + esc(a.ringkasan) + "</p>" : "") + "</div></a>";
  }
  function cardAlbum(a, i) {
    return '<a class="album reveal" data-from="zoom" data-d="' + (i % 3) * 0.1 + '" href="dokumentasi.html?id=' + encodeURIComponent(a.id) + '">' +
      '<div class="album__img">' + (a.sampul ? '<img src="' + esc(a.sampul) + '" alt="" loading="lazy" decoding="async">' : "") +
      '<span class="album__count">' + a.jumlah + " foto</span></div>" +
      '<p class="post__date">' + esc(C().tanggal(a.tanggal)) + "</p><h3>" + esc(a.judul) + "</h3></a>";
  }

  window.VeinmaraFX = {
    A: A, MOTION: MOTION, $: $, $$: $$, esc: esc,
    initNav: initNav, initVeins: initVeins, applyPageLinks: applyPageLinks,
    revealOnScroll: revealOnScroll, introPage: introPage, cardArtikel: cardArtikel, cardAlbum: cardAlbum
  };
})();
