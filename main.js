(function () {
  "use strict";
  var D = window.VEINMARA;
  var A = window.anime;
  var root = document.documentElement;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  // Animasi hanya jalan kalau anime.js termuat dan pengguna tidak memilih "kurangi gerakan".
  // Selain itu, kelas .anim dicabut sehingga semua konten langsung tampil apa adanya.
  var MOTION = !!A && root.classList.contains("anim");
  if (!MOTION) root.classList.remove("anim");

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Garis nadi: salin ke tiap SVG (path di dalam <use> tidak bisa dianimasikan) ---------- */
  var veinSet = document.getElementById("vein-set");
  var veinSvgs = $$("svg.veins");
  veinSvgs.forEach(function (svg) {
    var g = veinSet.cloneNode(true);
    g.removeAttribute("id");
    svg.innerHTML = "";
    svg.appendChild(g);
  });

  /* ---------- Navigasi ---------- */
  var nav = $("#nav");
  var toggle = $(".nav__toggle");
  var menu = $("#nav-menu");
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

  /* ---------- Hitung mundur peresmian ---------- */
  var target = new Date(D.peresmian.waktu).getTime();
  var cd = $("#countdown");
  var els = { d: $("#cd-d"), h: $("#cd-h"), m: $("#cd-m"), s: $("#cd-s") };
  $("#cd-when").textContent = D.peresmian.tanggal + ", " + D.peresmian.jam;
  function set(el, v) {
    v = String(v).padStart(2, "0");
    if (el.textContent === v) return;
    el.textContent = v;
    if (MOTION) A.animate(el, { y: ["-45%", "0%"], opacity: [0.15, 1], duration: 520, ease: "outExpo" });
  }
  function tickDown() {
    var left = target - Date.now();
    if (left <= 0) { cd.hidden = true; $("#cd-done").hidden = false; return false; }
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
    var w = n.split(/\s+/).filter(function (x) { return !/^(muhammad|muhamad|m\.)$/i.test(x); });
    return ((w[0] || n)[0] + (w[1] ? w[1][0] : "")).toUpperCase();
  }
  $("#units").innerHTML = D.pemimpin.map(function (u, ui) {
    return '<article class="unit reveal" data-d="' + (ui % 2) * 0.12 + '"><h3 class="unit__title">' + esc(u.unit) + "</h3>" +
      '<div class="unit__people">' + u.orang.map(function (p, pi) {
        return '<figure class="person reveal" data-from="zoom" data-d="' + (0.2 + pi * 0.12) + '">' +
          '<div class="person__frame">' + (pi === 0 ? crown : "") +
          '<span class="person__initials" aria-hidden="true">' + esc(initials(p.nama)) + "</span>" +
          '<img src="assets/web/foto/' + esc(p.foto) + '" alt="Foto ' + esc(p.nama) + '" loading="lazy" decoding="async" onerror="this.remove()">' +
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
      '<p class="moment__place">' + esc(m.tempat) + "</p><p>" + esc(m.isi) + "</p></div></li>";
  }).join("");

  /* ---------- Menu aktif sesuai bagian ---------- */
  var links = $$("a", menu);
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

  // Setelah intro: logo melayang pelan + kilau gelombang di huruf VEINMARA
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

  /* ---------- Garis nadi: tergambar, lalu titik cahaya mengalir ---------- */
  veinSvgs.forEach(function (svg, si) {
    var paths = $$(".vein", svg);
    A.animate(A.svg.createDrawable(paths), {
      draw: ["0 0", "0 1"], duration: 2600, delay: A.stagger(140, { start: 200 + si * 300 }), ease: "inOutQuart"
    });
    // Titik cahaya: div HTML (lapisan GPU sendiri) yang digeser mengikuti path.
    // Titik-titik path dihitung SEKALI ke tabel (bukan tiap frame); dihitung ulang hanya saat resize.
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

  /* ---------- Muncul saat di-scroll ---------- */
  [
    [".section__head", "up"], [".ayat", "zoom"], [".lead", "up"],
    [".word--vein", "left"], [".split__plus", "zoom"], [".word--mara", "right"],
    [".closing", "up"], [".motto-card", "zoom"], [".stage", "left"],
    [".timeline__more", "up"], [".footer__inner", "up"]
  ].forEach(function (r) {
    $$(r[0]).forEach(function (el) { el.classList.add("reveal"); if (!el.dataset.from) el.dataset.from = r[1]; });
  });

  // Jarak gerak dibuat pendek & durasi lebih singkat agar terasa mengalun, bukan meloncat
  var FROM = {
    up: ["translateY(18px)", "translateY(0px)"],
    left: ["translateX(-24px)", "translateX(0px)"],
    right: ["translateX(24px)", "translateX(0px)"],
    zoom: ["scale(0.96)", "scale(1)"]
  };
  // anime.waapi = Web Animations API → transform/opacity dijalankan di thread compositor (GPU),
  // jadi tetap halus walau browser sedang sibuk menggambar halaman saat di-scroll.
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
})();
