/*
 * Control Panel VEINMARA
 * - Login: satu kata sandi admin (dicek di server, api/auth.php)
 * - Data:  api/content.php (isi web, disimpan di MySQL) + api/foto.php (foto JPEG di uploads/foto)
 * Setiap perubahan butuh sesi login + token CSRF.
 */
(function () {
  "use strict";
  const DEFAULTS = window.VEINMARA;
  const EDITABLE = ["peresmian", "halaman", "pemimpin", "momen"];
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const views = { setup: $("#view-setup"), login: $("#view-login"), editor: $("#view-editor") };
  function showView(name) { Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name)); }

  let toastTimer;
  function toast(msg, isError) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.toggle("is-error", !!isError);
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-on"), 3800);
  }

  /* ---------- API ---------- */
  let csrf = "";
  async function api(path, payload) {
    const opt = { credentials: "same-origin", cache: "no-store", headers: {} };
    if (payload !== undefined) {
      opt.method = "POST";
      opt.headers["Content-Type"] = "application/json";
      opt.headers["X-CSRF"] = csrf;
      opt.body = JSON.stringify(payload);
    }
    let res, data;
    try {
      res = await fetch("api/" + path, opt);
      data = await res.json();
    } catch (e) {
      const err = new Error("Server tidak merespons dengan benar.");
      err.status = res ? res.status : 0;
      throw err;
    }
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || "HTTP " + res.status);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  let state = null;          // isi yang sedang diedit
  let photos = {};           // id -> url foto tersimpan
  let pendingPhotos = {};    // id -> dataURL baru | null (hapus)
  let dirty = false;

  /* ---------- Mulai: cek server & status login ---------- */
  (async function init() {
    if (location.protocol === "file:") {
      $("#setup-msg").innerHTML = "Control panel harus dibuka dari alamat web hosting (mis. <code>https://domainmu/admin.html</code>), bukan dengan klik dua kali.";
      showView("setup");
      return;
    }
    try {
      const s = await api("auth.php");
      csrf = s.csrf;
      s.loggedIn ? enterEditor() : showView("login");
    } catch (e) {
      if (e.status === 503) $("#setup-msg").textContent = e.message;
      showView("setup");
    }
  })();

  /* ---------- Login / keluar ---------- */
  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btn-login");
    btn.disabled = true;
    $("#login-error").textContent = "";
    try {
      const r = await api("auth.php", { action: "login", password: $("#login-pass").value });
      csrf = r.csrf;
      $("#login-pass").value = "";
      enterEditor();
    } catch (err) {
      $("#login-error").textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
  $("#btn-logout").addEventListener("click", async () => {
    if (dirty && !confirm("Ada perubahan yang belum disimpan. Tetap keluar?")) return;
    try { await api("auth.php", { action: "logout" }); } catch (e) { /* tetap keluar */ }
    location.reload();
  });

  function enterEditor() {
    $("#ad-user").hidden = false;
    showView("editor");
    loadAll();
  }
  // Sesi habis / ditolak → kembali ke layar login
  function handleAuthError(err) {
    if (err.status === 401 || err.status === 403) {
      toast(err.message + " Perubahanmu masih ada di layar — masuk lagi lalu Simpan.", true);
      $("#ad-user").hidden = true;
      showView("login");
      return true;
    }
    return false;
  }

  /* ---------- Muat data ---------- */
  async function loadAll() {
    try {
      const res = await api("content.php");
      const base = {};
      EDITABLE.forEach((k) => (base[k] = clone(DEFAULTS[k])));
      if (res.content) {
        EDITABLE.forEach((k) => { if (res.content[k] != null) base[k] = res.content[k]; });
      } else {
        toast("Database masih kosong — memakai isi bawaan. Tekan Simpan untuk menerbitkannya.");
        setDirty(true);
      }
      // jangan timpa suntingan yang belum tersimpan (mis. setelah login ulang)
      if (!state) state = base;
      photos = res.fotos || {};
      renderAll();
    } catch (err) {
      if (!handleAuthError(err)) toast("Gagal memuat data: " + err.message, true);
    }
  }

  /* ---------- Helper ikatan form <-> state ---------- */
  function getPath(path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), state); }
  function setPath(path, val) {
    const keys = path.split(".");
    const last = keys.pop();
    const obj = keys.reduce((o, k) => o[k], state);
    obj[last] = val;
  }
  function bindInputs(scope) {
    $$("[data-bind]", scope).forEach((el) => {
      const v = getPath(el.dataset.bind);
      if (el.type === "checkbox") el.checked = v !== false;
      else el.value = v ?? "";
    });
  }
  document.addEventListener("input", (e) => {
    const el = e.target.closest("[data-bind]");
    if (!el || !state) return;
    setPath(el.dataset.bind, el.type === "checkbox" ? el.checked : el.value);
    if (el.dataset.bind.startsWith("peresmian.")) updateWaktuPreview();
    setDirty(true);
  });

  function setDirty(v) {
    dirty = v;
    $("#savebar").hidden = !v;
    $("#save-status").textContent = "Ada perubahan yang belum disimpan";
  }
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Tab ---------- */
  $(".ad-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    $$("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
  });

  /* ---------- Acara ---------- */
  function fmtWaktu(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return null;
    const tanggal = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
    const jam = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).replace(":", ".") + " WIB";
    return { tanggal, jam };
  }
  function renderAcara() {
    const w = $("#f-waktu");
    w.value = String(state.peresmian.waktu || "").slice(0, 16);
    updateWaktuPreview();
    w.oninput = () => {
      if (!w.value) return;
      const iso = w.value + ":00+07:00";
      const f = fmtWaktu(iso);
      if (!f) return;
      state.peresmian.waktu = iso;
      state.peresmian.tanggal = f.tanggal;
      state.peresmian.jam = f.jam;
      updateWaktuPreview();
      setDirty(true);
    };
  }
  function updateWaktuPreview() {
    const p = state.peresmian;
    $("#f-waktu-preview").textContent = p.tanggal + ", " + p.jam + " · " + (p.tempat || "");
  }

  /* ---------- Halaman ---------- */
  const HALAMAN = [["undangan", "Undangan", "undangan.html"], ["panggung", "Panggung Gembira", "panggung-gembira.html"]];
  function renderHalaman() {
    $("#halaman-list").innerHTML = HALAMAN.map(([key, label, file]) => `
      <div class="ad-card">
        <div class="ad-row">
          <h2>${esc(label)}</h2>
          <span class="ad-badge">Coming Soon</span>
        </div>
        <label class="ad-switch"><input type="checkbox" data-bind="halaman.${key}.tampil"> Tampilkan tautan di menu</label>
        <div class="ad-grid">
          <label>Judul halaman <input type="text" data-bind="halaman.${key}.judul" maxlength="40"></label>
          <label class="ad-span">Pesan <textarea rows="3" data-bind="halaman.${key}.pesan" maxlength="300"></textarea></label>
        </div>
        <a class="ad-link" href="${file}" target="_blank" rel="noopener">Lihat halaman ↗</a>
      </div>`).join("");
    bindInputs($("#halaman-list"));
  }

  /* ---------- Ketua & wakil ---------- */
  const photoId = (p) => String(p.foto || "").replace(/\.\w+$/, "");
  function photoSrc(p) {
    const id = photoId(p);
    if (id in pendingPhotos) return pendingPhotos[id] || "";
    return photos[id] || "";
  }
  function renderPemimpin() {
    $("#pemimpin-list").innerHTML = state.pemimpin.map((u, ui) => `
      <div class="ad-card">
        <h2>${esc(u.unit)}</h2>
        <div class="ad-people">
          ${u.orang.map((p, pi) => {
            const src = photoSrc(p);
            const base = `pemimpin.${ui}.orang.${pi}`;
            return `
            <div class="ad-person">
              <div class="ad-photo">${src ? `<img src="${esc(src)}" alt="">` : `<span>Belum ada foto</span>`}</div>
              <div class="ad-photo-actions">
                <label class="ad-btn ad-btn--ghost ad-btn--sm">Pilih foto<input type="file" accept="image/*" hidden data-photo="${ui}.${pi}"></label>
                ${src ? `<button type="button" class="ad-btn ad-btn--ghost ad-btn--sm ad-btn--danger" data-photo-del="${ui}.${pi}">Hapus</button>` : ""}
              </div>
              <p class="ad-role">${esc(p.jabatan)}</p>
              <label>Nama <input type="text" data-bind="${base}.nama" maxlength="60"></label>
              <div class="ad-grid ad-grid--tight">
                <label>Kelas <input type="text" data-bind="${base}.kelas" maxlength="20"></label>
                <label>Asal <input type="text" data-bind="${base}.asal" maxlength="40"></label>
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>`).join("");
    bindInputs($("#pemimpin-list"));
  }
  $("#pemimpin-list").addEventListener("change", async (e) => {
    const input = e.target.closest("[data-photo]");
    if (!input || !input.files[0]) return;
    const [ui, pi] = input.dataset.photo.split(".").map(Number);
    try {
      pendingPhotos[photoId(state.pemimpin[ui].orang[pi])] = await toPortraitJpeg(input.files[0]);
      setDirty(true);
      renderPemimpin();
    } catch (err) {
      toast("Foto tidak bisa dibaca: " + err.message, true);
    }
  });
  $("#pemimpin-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-photo-del]");
    if (!b) return;
    const [ui, pi] = b.dataset.photoDel.split(".").map(Number);
    pendingPhotos[photoId(state.pemimpin[ui].orang[pi])] = null;
    setDirty(true);
    renderPemimpin();
  });

  // Potong tengah ke rasio 3:4, kecilkan ke 450x600, simpan JPEG
  async function toPortraitJpeg(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error("format gambar tidak didukung"));
        i.src = url;
      });
      const W = 450, H = 600;
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const sw = W / scale, sh = H / scale;
      const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      let q = 0.85, out = c.toDataURL("image/jpeg", q);
      while (out.length > 300000 && q > 0.5) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
      return out;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* ---------- Momen ---------- */
  function renderMomen() {
    const list = state.momen;
    $("#momen-list").innerHTML = list.length ? list.map((m, i) => `
      <div class="ad-card">
        <div class="ad-row">
          <h2>Momen ${i + 1}</h2>
          <div class="ad-row-actions">
            <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm" data-move="${i}:-1" ${i === 0 ? "disabled" : ""} aria-label="Naikkan">↑</button>
            <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm" data-move="${i}:1" ${i === list.length - 1 ? "disabled" : ""} aria-label="Turunkan">↓</button>
            <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm ad-btn--danger" data-remove="${i}">Hapus</button>
          </div>
        </div>
        <div class="ad-grid">
          <label>Tanggal <input type="text" data-bind="momen.${i}.tanggal" placeholder="mis. 8 November 2026" maxlength="40"></label>
          <label>Tempat <input type="text" data-bind="momen.${i}.tempat" maxlength="80"></label>
          <label class="ad-span">Judul <input type="text" data-bind="momen.${i}.judul" maxlength="100"></label>
          <label class="ad-span">Keterangan <textarea rows="3" data-bind="momen.${i}.isi" maxlength="500"></textarea></label>
        </div>
      </div>`).join("") : `<p class="ad-muted">Belum ada momen.</p>`;
    bindInputs($("#momen-list"));
  }
  $("#momen-list").addEventListener("click", (e) => {
    const mv = e.target.closest("[data-move]");
    const rm = e.target.closest("[data-remove]");
    if (mv) {
      const [i, d] = mv.dataset.move.split(":").map(Number);
      const arr = state.momen;
      [arr[i], arr[i + d]] = [arr[i + d], arr[i]];
    } else if (rm) {
      const i = Number(rm.dataset.remove);
      if (!confirm(`Hapus momen "${state.momen[i].judul || i + 1}"?`)) return;
      state.momen.splice(i, 1);
    } else return;
    setDirty(true);
    renderMomen();
  });
  $("#btn-add-momen").addEventListener("click", () => {
    state.momen.push({ tanggal: "", judul: "", tempat: "", isi: "" });
    setDirty(true);
    renderMomen();
    $("#momen-list .ad-card:last-child input")?.focus();
  });

  function renderAll() {
    renderAcara();
    bindInputs($("[data-panel='acara']"));
    renderHalaman();
    renderPemimpin();
    renderMomen();
  }

  /* ---------- Simpan ---------- */
  $("#btn-save").addEventListener("click", async () => {
    if (!state) return;
    const empty = state.momen.findIndex((m) => !String(m.judul || "").trim());
    if (empty >= 0) { toast(`Momen ${empty + 1} belum punya judul.`, true); return; }

    const btn = $("#btn-save");
    btn.disabled = true;
    $("#save-status").textContent = "Menyimpan…";
    try {
      const content = {};
      EDITABLE.forEach((k) => (content[k] = state[k]));
      await api("content.php", { content });
      for (const [id, data] of Object.entries(pendingPhotos)) {
        if (data) {
          const r = await api("foto.php", { id, data });
          photos[id] = r.url;
        } else {
          await api("foto.php", { id, hapus: true });
          delete photos[id];
        }
        delete pendingPhotos[id];
      }
      setDirty(false);
      renderPemimpin();
      toast("Tersimpan. Web sudah memakai isi terbaru.");
    } catch (err) {
      $("#save-status").textContent = "Gagal menyimpan";
      if (!handleAuthError(err)) toast("Gagal menyimpan: " + err.message, true);
    } finally {
      btn.disabled = false;
    }
  });
})();
