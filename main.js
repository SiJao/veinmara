(function () {
  "use strict";
  var D = window.VEINMARA;
  var $ = function (s, el) { return (el || document).querySelector(s); };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Garis nadi: salin path ke tiap SVG (agar animasinya jalan di semua browser) ---------- */
  var veinSet = document.getElementById("vein-set");
  document.querySelectorAll("svg.veins").forEach(function (svg) {
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
    if (el.textContent !== v) { el.textContent = v; el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); }
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

  picker.innerHTML = D.elemenLogo.map(function (el, i) {
    return '<li class="reveal" style="--d:' + (i * 0.05) + 's"><button type="button" data-i="' + i + '" aria-pressed="' + (i === 0) + '">' +
      '<img src="' + EMBLEM + esc(el.gambar) + '" alt="" loading="lazy">' +
      '<span>' + esc(el.nama) + "</span></button></li>";
  }).join("");

  function show(i) {
    var el = D.elemenLogo[i];
    stage.classList.remove("is-changing"); void stage.offsetWidth; stage.classList.add("is-changing");
    stageImg.src = EMBLEM + el.gambar;
    stageImg.alt = el.nama;
    stageNum.textContent = String(i + 1).padStart(2, "0") + " / " + D.elemenLogo.length;
    stageName.textContent = el.nama;
    stageText.textContent = el.makna;
    picker.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.i === i)); });
  }
  picker.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    show(+b.dataset.i);
    if (window.innerWidth <= 860) stage.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  show(0);
  stage.classList.remove("is-changing");

  /* ---------- Ketua & wakil ---------- */
  var crown = '<svg class="person__crown" viewBox="0 0 48 32" aria-hidden="true"><path fill="currentColor" d="M4 26 1 7l12 9 11-15 11 15 12-9-3 19zM5 28h38v3H5z"/></svg>';
  function initials(n) {
    var w = n.split(/\s+/).filter(function (x) { return !/^(muhammad|muhamad|m\.)$/i.test(x); });
    return ((w[0] || n)[0] + (w[1] ? w[1][0] : "")).toUpperCase();
  }
  $("#units").innerHTML = D.pemimpin.map(function (u, ui) {
    return '<article class="unit reveal" style="--d:' + (ui % 2) * 0.12 + 's"><h3 class="unit__title">' + esc(u.unit) + "</h3>" +
      '<div class="unit__people">' + u.orang.map(function (p, pi) {
        return '<figure class="person reveal reveal--zoom" style="--d:' + (0.15 + pi * 0.12) + 's">' +
          '<div class="person__frame">' + (pi === 0 ? crown : "") +
          '<span class="person__initials" aria-hidden="true">' + esc(initials(p.nama)) + "</span>" +
          '<img src="assets/web/foto/' + esc(p.foto) + '" alt="Foto ' + esc(p.nama) + '" loading="lazy" onerror="this.remove()">' +
          "</div><figcaption>" +
          '<p class="person__role">' + esc(p.jabatan) + "</p>" +
          '<p class="person__name">' + esc(p.nama) + "</p>" +
          '<p class="person__meta">' + esc(p.kelas) + " · " + esc(p.asal) + "</p>" +
          "</figcaption></figure>";
      }).join("") + "</div></article>";
  }).join("");

  /* ---------- Momen ---------- */
  $("#timeline").innerHTML = D.momen.map(function (m, i) {
    return '<li class="moment reveal reveal--right" style="--d:' + (0.2 + i * 0.15) + 's">' +
      '<p class="moment__date">' + esc(m.tanggal) + "</p>" +
      '<div class="moment__card"><h3>' + esc(m.judul) + "</h3>" +
      '<p class="moment__place">' + esc(m.tempat) + "</p><p>" + esc(m.isi) + "</p></div></li>";
  }).join("");

  /* ---------- Animasi muncul saat di-scroll ---------- */
  [
    [".section__head", ""], [".ayat", "reveal--zoom"], [".lead", ""],
    [".word--vein", "reveal--left"], [".split__plus", "reveal--zoom"], [".word--mara", "reveal--right"],
    [".closing", ""], [".motto-card", "reveal--zoom"], [".stage", "reveal--left"],
    [".timeline__more", ""], [".footer__inner", ""]
  ].forEach(function (r) {
    document.querySelectorAll(r[0]).forEach(function (el) { el.classList.add("reveal"); if (r[1]) el.classList.add(r[1]); });
  });

  var targets = document.querySelectorAll(".reveal, .timeline");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Menu aktif sesuai bagian ---------- */
  var links = Array.prototype.slice.call(menu.querySelectorAll("a"));
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["filosofi", "logo", "pemimpin", "momen"].forEach(function (id) { spy.observe(document.getElementById(id)); });
  }
})();
