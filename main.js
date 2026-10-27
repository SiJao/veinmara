/* Halaman utama (beranda) */
(function () {
  "use strict";
  var FX = window.VeinmaraFX;
  var A = FX.A, MOTION = FX.MOTION, $ = FX.$, $$ = FX.$$, esc = FX.esc;

  FX.initNav();
  FX.initVeins();

  // Tunggu isi (online dari control panel, atau bawaan data.js), baru tampilkan
  window.VeinmaraContent.load().then(start);

  function start(D) {
    FX.applyPageLinks(D);

    /* ---------- Hitung mundur peresmian ---------- */
    var target = new Date(D.peresmian.waktu).getTime();
    var cd = $("#countdown");
    var els = { d: $("#cd-d"), h: $("#cd-h"), m: $("#cd-m"), s: $("#cd-s") };
    $("#cd-when").textContent = D.peresmian.tanggal + ", " + D.peresmian.jam;
    $("#cd-done").textContent = "Telah diresmikan · " + String(D.peresmian.tanggal).replace(/^[^,]*,\s*/, "");
    function set(el, v) {
      v = String(v).padStart(2, "0");
      if (el.textContent === v) return;
      el.textContent = v;
      if (MOTION) A.animate(el, { y: ["-45%", "0%"], opacity: [0.15, 1], duration: 520, ease: "outExpo" });
    }
    function tickDown() {
      var left = target - Date.now();
      if (!(left > 0)) { cd.hidden = true; $("#cd-done").hidden = false; return false; }
      cd.hidden = false;
      set(els.d, Math.floor(left / 864e5));
      set(els.h, Math.floor(left / 36e5) % 24);
      set(els.m, Math.floor(left / 6e4) % 60);
      set(els.s, Math.floor(left / 1e3) % 60);
      return true;
    }
    if (tickDown()) { var timer = setInterval(function () { if (!tickDown()) clearInterval(timer); }, 1000); }

    /* ---------- Filosofi logo (11 unsur) ---------- */
    var picker = $("#picker");
    var stage = $(".stage");
    var stageImg = $("#stage-img"), stageNum = $("#stage-num"), stageName = $("#stage-name"), stageText = $("#stage-text");
    var EMBLEM = "assets/web/emblem/";
    var current = 0, stageTl = null;

    picker.innerHTML = D.elemenLogo.map(function (el, i) {
      return '<li class="reveal" data-d="' + (i * 0.04) + '"><button type="button" data-i="' + i + '" aria-pressed="' + (i === 0) + '">' +
        '<img src="' + EMBLEM + esc(el.gambar) + '" alt="" loading="lazy" decoding="async">' +
        '<span>' + esc(el.nama) + "</span></button></li>";
    }).join("");

    function fill(i) {
      var el = D.elemenLogo[i];
      stageImg.src = EMBLEM + el.gambar;
      stageImg.alt = el.nama;
      stageNum.textContent = String(i + 1).padStart(2, "0") + " / " + D.elemenLogo.length;
      stageName.textContent = el.nama;
      stageText.textContent = el.makna;
    }
    function show(i) {
      if (i === current) return;
      current = i;
      picker.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.i === i)); });
      if (!MOTION) { fill(i); return; }

      if (stageTl) stageTl.pause();
      var texts = [stageNum, stageName, stageText];
      stageTl = A.createTimeline()
        // keluar: cepat & ringan
        .add(stageImg, { opacity: 0, scale: 0.85, rotate: 6, duration: 220, ease: "inQuad" }, 0)
        .add(texts, { opacity: 0, y: -10, duration: 200, ease: "inQuad" }, 0)
        .call(function () { fill(i); }, 230)
        // masuk: pegas lembut
        .add(stageImg, {
          opacity: [0, 1], scale: [0.72, 1], rotate: [-10, 0],
          ease: A.spring({ bounce: 0.4, duration: 700 })
        }, 240)
        .add(texts, { opacity: [0, 1], y: [16, 0], duration: 700, delay: A.stagger(70), ease: "outExpo" }, 300);
    }
    picker.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      show(+b.dataset.i);
      if (window.innerWidth <= 860) stage.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    fill(0);

    /* ---------- Ketua & wakil ---------- */
    var crown = '<svg class="person__crown" viewBox="0 0 48 32" aria-hidden="true"><path fill="currentColor" d="M4 26 1 7l12 9 11-15 11 15 12-9-3 19zM5 28h38v3H5z"/></svg>';
    function initials(n) {
      var w = String(n).split(/\s+/).filter(function (x) { return x && !/^(muhammad|muhamad|m\.)$/i.test(x); });
      return (((w[0] || n || "?")[0]) + (w[1] ? w[1][0] : "")).toUpperCase();
    }
    $("#units").innerHTML = D.pemimpin.map(function (u, ui) {
      return '<article class="unit reveal" data-d="' + (ui % 2) * 0.12 + '"><h3 class="unit__title">' + esc(u.unit) + "</h3>" +
        '<div class="unit__people">' + u.orang.map(function (p, pi) {
          var src = p.fotoData || ("assets/web/foto/" + p.foto);
          return '<figure class="person reveal" data-from="zoom" data-d="' + (0.2 + pi * 0.12) + '">' +
            '<div class="person__frame">' + (pi === 0 ? crown : "") +
            '<span class="person__initials" aria-hidden="true">' + esc(initials(p.nama)) + "</span>" +
            '<img src="' + esc(src) + '" alt="Foto ' + esc(p.nama) + '" loading="lazy" decoding="async" onerror="this.remove()">' +
            "</div><figcaption>" +
            '<p class="person__role">' + esc(p.jabatan) + "</p>" +
            '<p class="person__name">' + esc(p.nama) + "</p>" +
            '<p class="person__meta">' + esc(p.kelas) + " · " + esc(p.asal) + "</p>" +
            "</figcaption></figure>";
        }).join("") + "</div></article>";
    }).join("");

    /* ---------- Momen ---------- */
    var timelineEl = $("#timeline");
    timelineEl.innerHTML = '<span class="timeline__line" aria-hidden="true"></span>' + D.momen.map(function (m, i) {
      return '<li class="moment reveal" data-from="right" data-d="' + (0.15 + i * 0.15) + '">' +
        '<p class="moment__date">' + esc(m.tanggal) + "</p>" +
        '<div class="moment__card"><h3>' + esc(m.judul) + "</h3>" +
        (m.tempat ? '<p class="moment__place">' + esc(m.tempat) + "</p>" : "") +
        "<p>" + esc(m.isi) + "</p></div></li>";
    }).join("");

    /* ---------- Menu aktif sesuai bagian ---------- */
    var links = $$("#nav-menu a[href^='#']");
    if ("IntersectionObserver" in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id); });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      ["filosofi", "logo", "pemimpin", "momen"].forEach(function (id) { spy.observe(document.getElementById(id)); });
    }

    if (!MOTION) return; // ===== semua di bawah ini khusus animasi anime.js =====

    /* ---------- Intro hero: satu timeline tersinkron ---------- */
    var nameEl = $(".hero__name");
    var chars = A.splitText(nameEl, { words: false, chars: true }).chars;
    A.set(chars, { opacity: 0 });
    A.set(nameEl, { opacity: 1 });

    var heroLogo = $(".hero__logo");
    var intro = A.createTimeline({ defaults: { ease: "outExpo" }, delay: 150 })
      .add(heroLogo, { opacity: [0, 1], scale: [0.82, 1], y: [40, 0], duration: 1600 })
      .add($(".hero .eyebrow"), { opacity: [0, 1], y: [-12, 0], duration: 1000 }, 300)
      .add(chars, {
        opacity: [0, 1], y: ["60%", "0%"], rotateX: [-80, 0],
        duration: 1100, delay: A.stagger(70, { from: "center" })
      }, 650)
      .add($(".hero__gen"), { opacity: [0, 1], x: [-30, 0], rotate: [-12, -4], duration: 1200 }, 1200)
      .add([$(".hero__motto"), $(".hero__motto-id")], { opacity: [0, 1], y: [14, 0], duration: 900, delay: A.stagger(120) }, 1500)
      .add(cd, { opacity: [0, 1], y: [20, 0], duration: 1000 }, 1750)
      .add($$(".countdown__grid > div"), { scale: [0.8, 1], duration: 900, delay: A.stagger(80), ease: A.spring({ bounce: 0.45, duration: 800 }) }, 1750)
      .add($(".hero__scroll"), { opacity: [0, 1], duration: 800 }, 2300);

    // Setelah intro: logo melayang pelan + gelombang di huruf VEINMARA
    intro.then(function () {
      // loop terus-menerus → pakai waapi (compositor), tidak membebani thread utama
      A.waapi.animate($("img", heroLogo), {
        transform: ["translateY(0px)", "translateY(-12px)"],
        duration: 3600, ease: "inOutSine", loop: true, alternate: true
      });
      A.animate(chars, {
        y: [0, -7, 0], scale: [1, 1.04, 1],
        duration: 1000, delay: A.stagger(65), ease: "inOutSine",
        loop: true, loopDelay: 6500
      });
    });

    /* ---------- Muncul saat di-scroll ---------- */
    [
      [".section__head", "up"], [".ayat", "zoom"], [".lead", "up"],
      [".word--vein", "left"], [".split__plus", "zoom"], [".word--mara", "right"],
      [".closing", "up"], [".motto-card", "zoom"], [".stage", "left"],
      [".timeline__more", "up"], [".footer__inner", "up"]
    ].forEach(function (r) {
      $$(r[0]).forEach(function (el) { el.classList.add("reveal"); if (!el.dataset.from) el.dataset.from = r[1]; });
    });

    // Jarak gerak pendek & durasi singkat agar terasa mengalun, bukan meloncat
    var FROM = {
      up: ["translateY(18px)", "translateY(0px)"],
      left: ["translateX(-24px)", "translateX(0px)"],
      right: ["translateX(24px)", "translateX(0px)"],
      zoom: ["scale(0.96)", "scale(1)"]
    };
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

    var io = new IntersectionObserver(function (entries) {
      // elemen yang masuk layar bersamaan dijalankan bergiliran, bukan sekaligus
      var order = 0;
      entries.forEach(function (e) {
        if (e.isIntersecting) { reveal(e.target, order++); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    $$(".reveal").forEach(function (el) { io.observe(el); });

    /* ---------- Garis timeline terisi mengikuti scroll ---------- */
    A.animate($(".timeline__line"), {
      scaleY: [0, 1], ease: "linear",
      autoplay: A.onScroll({ target: timelineEl, enter: "end start", leave: "center end", sync: 0.4 })
    });
  }
})();
