/*
 * Pemuat isi web.
 * Isi bawaan ada di data.js. Kalau admin sudah menyimpan sesuatu lewat Control Panel,
 * isi dari api/content menimpa bawaan itu.
 * Kalau API lambat/tidak ada (mis. dibuka dengan klik dua kali), web tetap tampil
 * memakai isi bawaan.
 * Artikel & dokumentasi hanya ada di server (api/entri) — tanpa server, daftarnya kosong.
 */
(function () {
  "use strict";
  var TIMEOUT = 3500;
  var EDITABLE = ["peresmian", "kunci", "halaman", "pemimpin", "momen"];

  // Hanya path foto dari folder uploads yang diterima
  function safePhoto(s) {
    return typeof s === "string" && /^uploads\/foto\/[a-z0-9-]+\.jpg(\?v=\d+)?$/.test(s) ? s : "";
  }
  function safeImg(s) {
    return typeof s === "string" && /^uploads\/(artikel|album)\/[a-z0-9-]+\/[a-f0-9]{16}(-t)?\.jpg$/.test(s) ? s : "";
  }

  function getJson(url) {
    if (location.protocol === "file:") return Promise.reject(new Error("dibuka tanpa server"));
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT);
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, cache: "no-store", credentials: "same-origin" })
      .then(function (r) {
        clearTimeout(t);
        if (!r.ok) { var e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
        return r.json();
      }, function (e) { clearTimeout(t); throw e; });
  }

  // Dimuat sekali per halaman (beberapa skrip boleh memanggil load())
  var loading = null;
  function load() {
    return loading || (loading = loadSekali());
  }
  function loadSekali() {
    var D = window.VEINMARA;
    return getJson("api/content")
      .then(function (res) {
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
        if (location.protocol !== "file:") console.warn("[veinmara] isi online tidak termuat, pakai bawaan:", e.message);
        return D;
      });
  }

  function cleanEntri(e) {
    e.sampul = safeImg(e.sampul);
    if (e.foto) e.foto = e.foto.filter(function (f) { return safeImg(f.src) && safeImg(f.thumb); });
    return e;
  }

  // Daftar artikel/album yang sudah terbit. Gagal → [] (bagian terkait disembunyikan)
  function list(jenis, limit) {
    return getJson("api/entri?jenis=" + jenis + (limit ? "&limit=" + limit : ""))
      .then(function (res) { return (res.daftar || []).map(cleanEntri); })
      .catch(function () { return []; });
  }
  // Satu artikel/album. Tidak ada → null; server tidak terjangkau → ditolak (pesan error)
  function get(jenis, id) {
    return getJson("api/entri?jenis=" + jenis + "&id=" + encodeURIComponent(id))
      .then(function (res) { return cleanEntri(res.entri); })
      .catch(function (e) { if (e.status === 404) return null; throw e; });
  }

  // "2026-11-08" → "8 November 2026"
  function tanggal(iso) {
    var d = new Date(String(iso) + "T12:00:00+07:00");
    return isNaN(d) ? "" : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  }

  window.VeinmaraContent = { load: load, list: list, get: get, tanggal: tanggal, EDITABLE: EDITABLE };
})();
