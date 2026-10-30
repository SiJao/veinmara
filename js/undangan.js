/*
 * Undangan: hanya untuk akun Google sekolah yang ada di daftar undangan.
 * 1. Tanya server (api/undangan): sudah masuk? Client ID Google?
 * 2. Belum → tampilkan tombol "Masuk dengan Google" (Google Identity Services)
 * 3. Token dari Google dikirim ke server; server memeriksa tanda tangan, domain, dan daftar undangan.
 */
(function () {
  "use strict";
  var $ = window.VeinmaraFX.$;
  var GSI = "https://accounts.google.com/gsi/client";
  var csrf = "", cfg = null;
  var wait = $("#inv-wait"), login = $("#inv-login"), card = $("#inv-card"), err = $("#inv-error");

  function api(payload) {
    var opt = { credentials: "same-origin", cache: "no-store", headers: {} };
    if (payload) {
      opt.method = "POST";
      opt.headers["Content-Type"] = "application/json";
      opt.headers["X-CSRF"] = csrf;
      opt.body = JSON.stringify(payload);
    }
    return fetch("api/undangan", opt).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: "Server tidak merespons dengan benar (HTTP " + r.status + ")." }; })
        .then(function (d) { if (!r.ok || d.ok === false) throw new Error(d.error || "HTTP " + r.status); return d; });
    });
  }

  // dipakai kalau template belum pernah disimpan dari Control Panel
  var TEMPLATE_CADANGAN = "<p>Kepada Yth.<br><strong>{nama}</strong><br>{keterangan}</p>" +
    "<p>Dengan hormat, kami mengundang Anda untuk menghadiri Peresmian Angkatan VEINMARA Generation pada {tanggal}, pukul {jam}, bertempat di {tempat}.</p>";

  function showCard(t) {
    wait.hidden = true; login.hidden = true; card.hidden = false;
    $("#inv-email").textContent = t.email;
    $("#inv-isi").innerHTML = "";
    window.VeinmaraContent.load().then(function (D) {
      var p = D.peresmian || {};
      var u = (D.halaman && D.halaman.undangan) || {};
      $("#inv-isi").innerHTML = window.VeinmaraRich.template(u.template || TEMPLATE_CADANGAN, {
        nama: t.nama, keterangan: t.keterangan, tanggal: p.tanggal, jam: p.jam, tempat: p.tempat
      });
    });
  }
  function showLogin(pesan) {
    wait.hidden = true; card.hidden = true; login.hidden = false;
    err.textContent = pesan || "";
  }
  function showError(pesan) {
    wait.hidden = true; card.hidden = true; login.hidden = false;
    $("#inv-gsi").hidden = true;
    err.textContent = pesan;
  }

  function loadGsi() {
    return new Promise(function (res, rej) {
      if (window.google && google.accounts) return res();
      var s = document.createElement("script");
      s.src = GSI; s.async = true;
      s.onload = res;
      s.onerror = function () { rej(new Error("Layanan login Google tidak bisa dimuat. Periksa koneksi.")); };
      document.head.appendChild(s);
    });
  }

  function onCredential(r) {
    err.textContent = "Memeriksa undangan…";
    api({ action: "masuk", credential: r.credential }).then(function (d) {
      err.textContent = "";
      showCard(d.tamu);
    }, function (e) {
      err.textContent = e.message;
    });
  }

  function renderButton() {
    $("#inv-gsi").hidden = false;
    loadGsi().then(function () {
      google.accounts.id.initialize({
        client_id: cfg.clientId,
        callback: onCredential,
        hd: cfg.domain,            // langsung arahkan ke akun sekolah (tetap dicek ulang di server)
        ux_mode: "popup",
        auto_select: false,
        context: "signin"
      });
      google.accounts.id.renderButton($("#inv-gsi"), {
        theme: "filled_black", size: "large", shape: "pill", text: "signin_with", locale: "id", width: 260
      });
    }, function (e) { showError(e.message); });
  }

  $("#inv-keluar").addEventListener("click", function () {
    api({ action: "keluar" }).catch(function () {}).then(function () {
      if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
      showLogin();
      renderButton();
    });
  });

  if (location.protocol === "file:") {
    showError("Undangan harus dibuka dari alamat web hosting, bukan dengan klik dua kali.");
    return;
  }
  api().then(function (d) {
    cfg = d;
    csrf = d.csrf;
    $("#inv-domain").textContent = "@" + d.domain;
    if (d.tamu) return showCard(d.tamu);
    if (!d.clientId) return showError("Login undangan belum diatur oleh admin.");
    showLogin();
    renderButton();
  }, function (e) {
    showError("Undangan tidak bisa dimuat: " + e.message);
  });
})();
