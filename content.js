/*
 * Pemuat isi web.
 * Isi bawaan ada di data.js. Kalau web berjalan di hosting (cPanel) dan admin sudah
 * menyimpan sesuatu lewat Control Panel, isi dari api/content.php menimpa bawaan itu.
 * Kalau API lambat/tidak ada (mis. dibuka dengan klik dua kali), web tetap tampil
 * memakai isi bawaan.
 */
(function () {
  "use strict";
  var TIMEOUT = 3500;
  var EDITABLE = ["peresmian", "halaman", "pemimpin", "momen"];

  // Hanya path foto dari folder uploads yang diterima
  function safePhoto(s) {
    return typeof s === "string" && /^uploads\/foto\/[a-z0-9-]+\.jpg(\?v=\d+)?$/.test(s) ? s : "";
  }

  function load() {
    var D = window.VEINMARA;
    if (location.protocol === "file:") return Promise.resolve(D);

    var ctrl = "AbortController" in window ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT);

    return fetch("api/content.php", { signal: ctrl ? ctrl.signal : undefined, cache: "no-store", credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (res) {
        clearTimeout(t);
        if (res.content) EDITABLE.forEach(function (k) { if (res.content[k] != null) D[k] = res.content[k]; });
        var fotos = res.fotos || {};
        (D.pemimpin || []).forEach(function (u) {
          (u.orang || []).forEach(function (p) {
            var id = String(p.foto || "").replace(/\.\w+$/, "");
            var url = safePhoto(fotos[id]);
            if (url) p.fotoData = url;
          });
        });
        return D;
      })
      .catch(function (e) {
        clearTimeout(t);
        console.warn("[veinmara] isi online tidak termuat, pakai bawaan:", e.message);
        return D;
      });
  }

  window.VeinmaraContent = { load: load, EDITABLE: EDITABLE };
})();
