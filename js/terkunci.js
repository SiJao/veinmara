/*
 * Halaman kunci: hanya hitung mundur menuju peresmian.
 * Waktu dihitung memakai jam server (bukan jam HP pengunjung). Saat hitung mundur habis
 * (mode "otomatis") atau admin membuka kunci, halaman dimuat ulang → web lengkap tampil.
 */
(function () {
  "use strict";
  var FX = window.VeinmaraFX;
  var A = FX.A, MOTION = FX.MOTION, $ = FX.$, $$ = FX.$$;
  var CEK_ULANG = 120000;   // tanya server tiap 2 menit: sudah dibuka admin?

  FX.initVeins();
  var cd = $("#countdown");
  var els = { d: $("#cd-d"), h: $("#cd-h"), m: $("#cd-m"), s: $("#cd-s") };
  var target = NaN, mode = "otomatis", selisih = 0, timer = null, reloadTimer = null;

  function ambil() {
    return fetch("api/content", { cache: "no-store", credentials: "same-origin" }).then(function (r) { return r.json(); });
  }

  // Server sudah tidak mengunci → tampilkan web lengkap
  function terbuka(res) {
    return !!res && res.terkunci === false;
  }
  // Halaman ini tampil di alamat aslinya (mis. /artikel) → cukup muat ulang.
  // Kalau dibuka langsung sebagai /terkunci → ke beranda.
  function bukaWeb() {
    if (/terkunci(\.html)?$/.test(location.pathname)) location.replace("index.html");
    else setTimeout(function () { location.reload(); }, 1500);   // jeda: hindari muat ulang beruntun
  }

  function set(el, v) {
    v = String(v).padStart(2, "0");
    if (el.textContent === v) return;
    el.textContent = v;
    if (MOTION) A.animate(el, { y: ["-45%", "0%"], opacity: [0.15, 1], duration: 520, ease: "outExpo" });
  }
  function tick() {
    var left = target - (Date.now() + selisih);
    if (!(left > 0)) {
      cd.hidden = true;
      $("#cd-done").hidden = false;
      clearInterval(timer);
      // waktunya tiba: cek ke server lalu muat ulang (diulang sampai server membuka kunci)
      if (mode === "otomatis" && !reloadTimer) {
        $("#cd-done").textContent = "Membuka…";
        reloadTimer = setInterval(function () { ambil().then(function (r) { if (terbuka(r)) bukaWeb(); }, function () {}); }, 4000);
      }
      return;
    }
    cd.hidden = false;
    set(els.d, Math.floor(left / 864e5));
    set(els.h, Math.floor(left / 36e5) % 24);
    set(els.m, Math.floor(left / 6e4) % 60);
    set(els.s, Math.floor(left / 1e3) % 60);
  }

  function intro() {
    if (!MOTION) return;
    A.createTimeline({ defaults: { ease: "outExpo" }, delay: 120 })
      .add(".hero__logo", { opacity: [0, 1], scale: [0.82, 1], y: [40, 0], duration: 1500 })
      .add(".hero .eyebrow", { opacity: [0, 1], y: [-12, 0], duration: 1000 }, 300)
      .add([".hero__name", ".hero__gen", ".hero__motto"], { opacity: [0, 1], y: [16, 0], duration: 1000, delay: A.stagger(140) }, 600)
      .add([cd, "#cd-when"], { opacity: [0, 1], y: [20, 0], duration: 1000, delay: A.stagger(120) }, 1100)
      .add($$(".countdown__grid > div"), { scale: [0.8, 1], duration: 900, delay: A.stagger(80), ease: A.spring({ bounce: 0.45, duration: 800 }) }, 1100)
      .then(function () {
        A.waapi.animate(".hero__logo img", { transform: ["translateY(0px)", "translateY(-12px)"], duration: 3600, ease: "inOutSine", loop: true, alternate: true });
      });
  }

  ambil().then(function (res) {
    if (terbuka(res)) return bukaWeb();
    var c = res.content || {};
    var p = c.peresmian || {};
    mode = (c.kunci && c.kunci.mode) || "otomatis";
    if (res.sekarang) selisih = res.sekarang - Date.now();
    target = new Date(p.waktu).getTime();
    if (p.tanggal) $("#cd-when").textContent = p.tanggal + " · " + p.jam + (p.tempat ? " · " + p.tempat : "");
    if (isNaN(target)) $("#cd-done").hidden = false;
    else { tick(); timer = setInterval(tick, 1000); }
    intro();
    // admin bisa membuka kunci kapan saja → cek berkala
    setInterval(function () { ambil().then(function (r) { if (terbuka(r)) bukaWeb(); }, function () {}); }, CEK_ULANG);
  }, function () {
    $("#cd-done").hidden = false;
    intro();
  });
})();
