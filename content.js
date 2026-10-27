/*
 * Pemuat isi web.
 * Isi bawaan ada di data.js. Kalau Firebase sudah dikonfigurasi, isi yang diedit
 * dari control panel (Firestore) menimpa bawaan itu.
 *
 * Pengunjung membaca lewat Firestore REST API (cukup fetch, tanpa SDK besar),
 * dengan batas waktu — kalau lambat/gagal, web tetap tampil dengan isi bawaan.
 */
(function () {
  "use strict";
  var CFG = window.VEINMARA_FIREBASE || {};
  var TIMEOUT = 3500;
  var EDITABLE = ["peresmian", "halaman", "pemimpin", "momen"];

  function ready() { return !!(CFG.apiKey && CFG.projectId); }

  function base() {
    return "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(CFG.projectId) +
      "/databases/(default)/documents/";
  }

  function getJSON(url) {
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT);
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, cache: "no-store" })
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  // Hanya foto JPEG/PNG/WebP base64 yang diterima (mencegah isi aneh masuk ke atribut src)
  function safeImage(s) {
    return typeof s === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(s) ? s : "";
  }

  function load() {
    var D = window.VEINMARA;
    if (!ready()) return Promise.resolve(D);
    var key = "?key=" + encodeURIComponent(CFG.apiKey);

    var content = getJSON(base() + "site/content" + key).then(function (doc) {
      var json = doc && doc.fields && doc.fields.json && doc.fields.json.stringValue;
      if (!json) return;
      var remote = JSON.parse(json);
      EDITABLE.forEach(function (k) { if (remote[k] != null) D[k] = remote[k]; });
    }).catch(function (e) { console.warn("[veinmara] isi online tidak termuat, pakai bawaan:", e.message); });

    var photos = getJSON(base() + "foto" + key + "&pageSize=50").then(function (res) {
      var map = {};
      (res.documents || []).forEach(function (doc) {
        var id = doc.name.split("/").pop();
        var data = safeImage(doc.fields && doc.fields.data && doc.fields.data.stringValue);
        if (data) map[id] = data;
      });
      return map;
    }).catch(function () { return {}; });

    return Promise.all([content, photos]).then(function (r) {
      var map = r[1];
      (D.pemimpin || []).forEach(function (u) {
        (u.orang || []).forEach(function (p) {
          var id = String(p.foto || "").replace(/\.\w+$/, "");
          if (map[id]) p.fotoData = map[id];
        });
      });
      return D;
    });
  }

  window.VeinmaraContent = { load: load, ready: ready, EDITABLE: EDITABLE };
})();
