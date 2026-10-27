/* Halaman "Coming Soon" (undangan & panggung gembira) — isi diambil dari D.halaman[<body data-halaman>] */
(function () {
  "use strict";
  var FX = window.VeinmaraFX;
  var A = FX.A, MOTION = FX.MOTION, $ = FX.$;
  var key = document.body.getAttribute("data-halaman");

  FX.initNav();
  FX.initVeins();

  window.VeinmaraContent.load().then(function (D) {
    FX.applyPageLinks(D);
    var h = (D.halaman && D.halaman[key]) || {};
    var title = $("#soon-title");
    if (h.judul) {
      title.textContent = h.judul;
      document.title = h.judul + " · VEINMARA Generation";
    }
    $("#soon-msg").textContent = h.pesan || "";

    if (!MOTION) return;

    // per kata + per huruf: kata tetap utuh saat pindah baris (tidak terpotong "GE / MBIRA")
    var chars = A.splitText(title, { words: true, chars: true }).chars;
    A.set(chars, { opacity: 0 });
    A.set(title, { opacity: 1 });

    A.createTimeline({ defaults: { ease: "outExpo" }, delay: 120 })
      .add(".soon__logo", { opacity: [0, 1], scale: [0.8, 1], y: [30, 0], duration: 1400 })
      .add(".soon .eyebrow", { opacity: [0, 1], y: [-10, 0], duration: 900 }, 250)
      .add(chars, { opacity: [0, 1], y: ["70%", "0%"], rotateX: [-80, 0], duration: 1000, delay: A.stagger(55, { from: "center" }) }, 500)
      .add(".soon__script", { opacity: [0, 1], x: [-24, 0], rotate: [-10, -4], duration: 1200 }, 1000)
      .add(".soon__bar", { opacity: [0, 1], scaleX: [0, 1], duration: 900 }, 1250)
      .add(["#soon-msg", ".soon .btn"], { opacity: [0, 1], y: [14, 0], duration: 900, delay: A.stagger(120) }, 1400)
      .then(function () {
        // logo melayang pelan (compositor) + kilatan cahaya berjalan di garis progres
        A.waapi.animate(".soon__logo", { transform: ["translateY(0px)", "translateY(-10px)"], duration: 3400, ease: "inOutSine", loop: true, alternate: true });
        A.waapi.animate(".soon__bar span", { transform: ["translateX(-120%)", "translateX(320%)"], duration: 2400, ease: "inOutSine", loop: true });
      });
  });
})();
