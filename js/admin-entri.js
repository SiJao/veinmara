/*
 * Control Panel — Artikel & Dokumentasi (album).
 * Tiap artikel/album disimpan sendiri-sendiri lewat api/entri (tombol "Simpan" di editornya).
 * Gambar langsung diunggah ke api/gambar saat dipilih; gambar yang akhirnya tidak dipakai
 * dibersihkan server ketika entri disimpan.
 */
(function () {
  "use strict";
  const { api, toast, esc, $, $$, handleAuthError, dirtyChecks } = window.VMAdmin;
  const Rich = window.VeinmaraRich;

  const LABEL = {
    artikel: { satu: "artikel", semua: "Semua artikel", baru: "Judul artikel baru", lihat: "artikel.html" },
    album: { satu: "album", semua: "Semua album", baru: "Judul album baru (mis. Rihlah ke Bandung)", lihat: "dokumentasi.html" }
  };

  /* ---------- Gambar: kecilkan/potong di browser, kirim sebagai JPEG ---------- */
  const randomName = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
  function loadImage(file) {
    const url = URL.createObjectURL(file);
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("format gambar tidak didukung"));
      i.src = url;
    }).finally(() => setTimeout(() => URL.revokeObjectURL(url), 0));
  }
  // opt.ratio = [w, h] → dipotong tengah ke rasio itu; opt.max = sisi terpanjang
  function toJpeg(img, opt) {
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (opt.ratio) {
      const r = opt.ratio[0] / opt.ratio[1];
      if (sw / sh > r) { sx = (sw - sh * r) / 2; sw = sh * r; } else { sy = (sh - sw / r) / 2; sh = sw / r; }
    }
    let scale = Math.min(1, opt.max / Math.max(sw, sh));
    for (;;) {
      const c = document.createElement("canvas");
      c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      // batas server 400 KB per gambar (≈ 530.000 karakter base64)
      let q = 0.82, out = c.toDataURL("image/jpeg", q);
      while (out.length > 500000 && q > 0.5) { q -= 0.08; out = c.toDataURL("image/jpeg", q); }
      if (out.length <= 500000 || scale < 0.2) return out;
      scale *= 0.8;
    }
  }
  async function upload(jenis, id, nama, data) {
    return (await api("gambar", { jenis, id, nama, data })).url;
  }

  // Tampilkan tanggal "2026-11-08" → "8 Nov 2026"
  const tgl = (iso) => {
    const d = new Date(iso + "T12:00:00+07:00");
    return isNaN(d) ? "" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  /* ================= Satu modul per jenis ================= */
  function modul(jenis) {
    const root = $(`[data-entri="${jenis}"]`);
    const L = LABEL[jenis];
    let daftar = [];
    let cur = null;        // entri yang sedang diedit
    let dirty = false;
    let busy = 0;          // jumlah unggahan yang sedang berjalan
    dirtyChecks.push(() => dirty || busy > 0);

    function setDirty(v) {
      dirty = v;
      const s = $("[data-status]", root);
      if (s) s.textContent = busy ? "Mengunggah gambar…" : v ? "Belum disimpan" : "Tersimpan";
      const b = $("[data-save]", root);
      if (b) b.disabled = !v || busy > 0;
    }
    function fail(err, awalan) {
      if (!handleAuthError(err)) toast(awalan + err.message, true);
    }

    /* ---------- Daftar ---------- */
    async function muatDaftar() {
      try {
        daftar = (await api(`entri?jenis=${jenis}&semua=1`)).daftar;
        if (!cur) renderDaftar();
      } catch (err) { fail(err, "Gagal memuat daftar: "); }
    }
    function renderDaftar() {
      root.innerHTML = `
        <form class="ad-card ad-new" data-new>
          <label>${esc(L.baru)} <input type="text" name="judul" maxlength="160" required></label>
          <button class="ad-btn" type="submit">+ Buat ${L.satu}</button>
        </form>
        ${daftar.length ? daftar.map((e) => `
          <div class="ad-card ad-entry">
            <div class="ad-entry__img">${e.sampul ? `<img src="${esc(e.sampul)}" alt="" loading="lazy">` : ""}</div>
            <div class="ad-entry__info">
              <h2>${esc(e.judul)}</h2>
              <p class="ad-muted">${esc(tgl(e.tanggal))}${jenis === "album" ? " · " + e.jumlah + " foto" : ""}
                <span class="ad-badge ${e.terbit ? "" : "ad-badge--draft"}">${e.terbit ? "Terbit" : "Draf"}</span></p>
            </div>
            <div class="ad-row-actions">
              <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm" data-edit="${esc(e.id)}">Edit</button>
              <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm ad-btn--danger" data-del="${esc(e.id)}">Hapus</button>
            </div>
          </div>`).join("") : `<p class="ad-muted">Belum ada ${L.satu}.</p>`}`;
    }

    root.addEventListener("submit", async (e) => {
      if (!e.target.matches("[data-new]")) return;
      e.preventDefault();
      const btn = $("button", e.target);
      btn.disabled = true;
      try {
        const r = await api("entri", { jenis, action: "buat", judul: e.target.judul.value });
        daftar.unshift(r.entri);
        buka(r.entri);
        toast(`Draf ${L.satu} dibuat. Isi lalu Simpan; centang "Terbitkan" agar tampil di web.`);
      } catch (err) { fail(err, "Gagal membuat: "); btn.disabled = false; }
    });

    root.addEventListener("click", async (e) => {
      const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
      if (ed) {
        try { buka((await api(`entri?jenis=${jenis}&id=${encodeURIComponent(ed.dataset.edit)}`)).entri); }
        catch (err) { fail(err, "Gagal membuka: "); }
      } else if (del) {
        const e2 = daftar.find((x) => x.id === del.dataset.del);
        if (!confirm(`Hapus ${L.satu} "${e2 ? e2.judul : ""}" beserta semua gambarnya? Tidak bisa dibatalkan.`)) return;
        try {
          await api("entri", { jenis, action: "hapus", id: del.dataset.del });
          daftar = daftar.filter((x) => x.id !== del.dataset.del);
          renderDaftar();
          toast(`${L.satu[0].toUpperCase() + L.satu.slice(1)} dihapus.`);
        } catch (err) { fail(err, "Gagal menghapus: "); }
      } else if (e.target.closest("[data-back]")) {
        if (busy) { toast("Tunggu unggahan selesai dulu.", true); return; }
        if (dirty && !confirm("Ada perubahan yang belum disimpan. Tetap kembali?")) return;
        cur = null;
        setDirty(false);
        muatDaftar();
        renderDaftar();
      }
    });

    /* ---------- Editor ---------- */
    function buka(e) {
      cur = e;
      if (jenis === "album") cur.foto = cur.foto || [];
      root.innerHTML = `
        <div class="ad-card">
          <div class="ad-row">
            <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm" data-back>← ${esc(L.semua)}</button>
            <a class="ad-link" data-view href="${L.lihat}?id=${encodeURIComponent(e.id)}" target="_blank" rel="noopener">Lihat di web ↗</a>
          </div>
          <div class="ad-grid">
            <label class="ad-span">Judul <input type="text" data-f="judul" maxlength="160"></label>
            <label>Tanggal <input type="date" data-f="tanggal" required></label>
            <label class="ad-switch ad-switch--end"><input type="checkbox" data-f="terbit"> Terbitkan (tampil di web)</label>
            ${jenis === "artikel"
              ? `<label class="ad-span">Ringkasan <span class="ad-hint">— tampil di kartu daftar artikel</span><textarea rows="2" data-f="ringkasan" maxlength="400"></textarea></label>`
              : `<label class="ad-span">Keterangan album <textarea rows="2" data-f="keterangan" maxlength="1000"></textarea></label>`}
          </div>
        </div>
        ${jenis === "artikel" ? editorArtikel() : editorAlbum()}
        <div class="ad-entry-save">
          <span data-status></span>
          <button type="button" class="ad-btn" data-save disabled>Simpan ${L.satu}</button>
        </div>`;
      $$("[data-f]", root).forEach((el) => {
        const v = cur[el.dataset.f];
        if (el.type === "checkbox") el.checked = !!v; else el.value = v ?? "";
      });
      if (jenis === "artikel") initRich(); else renderFoto();
      setDirty(false);
      window.scrollTo({ top: 0 });
    }

    root.addEventListener("input", (e) => {
      const f = e.target.closest("[data-f]");
      if (f && cur) { cur[f.dataset.f] = f.type === "checkbox" ? f.checked : f.value; setDirty(true); return; }
      const k = e.target.closest("[data-k]");
      if (k && cur) { cur.foto[+k.dataset.k].k = k.value; setDirty(true); }
    });

    root.addEventListener("click", async (e) => {
      if (!e.target.closest("[data-save]") || !cur) return;
      if (!String(cur.judul || "").trim()) { toast("Judul wajib diisi.", true); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cur.tanggal || "")) { toast("Tanggal belum diisi.", true); return; }
      const btn = e.target.closest("[data-save]");
      btn.disabled = true;
      $("[data-status]", root).textContent = "Menyimpan…";
      const kirim = { id: cur.id, judul: cur.judul, tanggal: cur.tanggal, terbit: !!cur.terbit };
      if (jenis === "artikel") {
        Object.assign(kirim, { ringkasan: cur.ringkasan, sampul: cur.sampulNama || "", isi: Rich.clean($("[data-isi]", root).innerHTML, cur.id) });
      } else {
        Object.assign(kirim, { keterangan: cur.keterangan, foto: cur.foto.map((f) => ({ n: f.n, k: f.k })) });
      }
      try {
        const r = await api("entri", { jenis, action: "simpan", entri: kirim });
        const i = daftar.findIndex((x) => x.id === cur.id);
        if (i >= 0) daftar[i] = r.entri;
        cur.terbit = r.entri.terbit;
        setDirty(false);
        toast(r.entri.terbit ? "Tersimpan dan tampil di web." : "Tersimpan sebagai draf (belum tampil di web).");
      } catch (err) {
        setDirty(true);
        $("[data-status]", root).textContent = "Gagal menyimpan";
        fail(err, "Gagal menyimpan: ");
      }
    });

    /* ---------- Artikel: thumbnail + editor teks ---------- */
    function editorArtikel() {
      return `
        <div class="ad-card">
          <h2>Thumbnail</h2>
          <p class="ad-muted">Gambar sampul artikel. Otomatis dipotong 16:9.</p>
          <div class="ad-thumb" data-thumb></div>
          <div class="ad-photo-actions">
            <label class="ad-btn ad-btn--ghost ad-btn--sm">Pilih gambar<input type="file" accept="image/*" hidden data-sampul></label>
            <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm ad-btn--danger" data-sampul-del hidden>Hapus</button>
          </div>
        </div>
        <div class="ad-card">
          <h2>Isi artikel</h2>
          <div class="ad-toolbar" role="toolbar" aria-label="Format teks">
            <button type="button" data-cmd="bold" title="Tebal (Ctrl+B)"><b>B</b></button>
            <button type="button" data-cmd="italic" title="Miring (Ctrl+I)"><i>I</i></button>
            <button type="button" data-cmd="underline" title="Garis bawah (Ctrl+U)"><u>U</u></button>
            <span class="ad-toolbar__sep"></span>
            <button type="button" data-block="h2" title="Subjudul">H2</button>
            <button type="button" data-block="h3" title="Subjudul kecil">H3</button>
            <button type="button" data-block="p" title="Paragraf biasa">¶</button>
            <button type="button" data-block="blockquote" title="Kutipan">❝</button>
            <span class="ad-toolbar__sep"></span>
            <button type="button" data-cmd="insertUnorderedList" title="Daftar berpoin">• Daftar</button>
            <button type="button" data-cmd="insertOrderedList" title="Daftar bernomor">1. Daftar</button>
            <span class="ad-toolbar__sep"></span>
            <button type="button" data-link title="Sisipkan tautan">🔗 Tautan</button>
            <button type="button" data-cmd="unlink" title="Hapus tautan">⛓ Lepas</button>
            <label class="ad-toolbar__file" title="Sisipkan gambar">🖼 Gambar<input type="file" accept="image/*" hidden data-img></label>
            <button type="button" data-cmd="removeFormat" title="Hapus format">⌫ Format</button>
          </div>
          <div class="ad-rich prose" contenteditable="true" data-isi aria-label="Isi artikel"></div>
        </div>`;
    }

    function renderThumb() {
      $("[data-thumb]", root).innerHTML = cur.sampul ? `<img src="${esc(cur.sampul)}" alt="">` : `<span>Belum ada thumbnail</span>`;
      $("[data-sampul-del]", root).hidden = !cur.sampul;
    }

    let savedRange = null;
    function initRich() {
      const ed = $("[data-isi]", root);
      ed.innerHTML = Rich.clean(cur.isi || "", cur.id) || "<p><br></p>";
      renderThumb();
      try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) { /* lama */ }
      ed.addEventListener("input", () => setDirty(true));
      // tempel sebagai teks biasa (format dari Word/WhatsApp/web tidak ikut)
      ed.addEventListener("paste", (e) => {
        e.preventDefault();
        document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
      });
      ed.addEventListener("drop", (e) => e.preventDefault());
    }
    // ingat posisi kursor di editor sebelum memilih gambar/tautan
    if (jenis === "artikel") document.addEventListener("selectionchange", () => {
      const ed = $("[data-isi]", root), s = getSelection();
      if (ed && s.rangeCount && ed.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange();
    });
    // Chrome kadang memindahkan kursor ke awal editor setelah menyisipkan gambar di akhir artikel →
    // taruh kursor tepat setelah gambar (di paragraf baru kalau gambar ada di paling akhir)
    function kursorSetelahGambar(url) {
      const ed = $("[data-isi]", root);
      const img = [...ed.querySelectorAll("img")].find((i) => i.getAttribute("src") === url);
      if (!img) return;
      const r = document.createRange();
      let blok = img;
      while (blok.parentNode !== ed) blok = blok.parentNode;
      if (blok === img || (!img.nextSibling && !blok.nextSibling)) {
        const p = document.createElement("p");
        p.appendChild(document.createElement("br"));
        blok.after(p);
        r.setStart(p, 0);
      } else {
        r.setStartAfter(img);
      }
      r.collapse(true);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
    function restoreRange() {
      const ed = $("[data-isi]", root);
      ed.focus();
      if (savedRange && ed.contains(savedRange.startContainer)) {
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(savedRange);
      }
    }

    root.addEventListener("mousedown", (e) => {
      // tombol toolbar tidak boleh mencuri fokus dari editor
      if (e.target.closest(".ad-toolbar button")) e.preventDefault();
    });
    root.addEventListener("click", (e) => {
      const c = e.target.closest("[data-cmd]"), b = e.target.closest("[data-block]"), l = e.target.closest("[data-link]");
      if (!c && !b && !l) return;
      restoreRange();
      if (c) document.execCommand(c.dataset.cmd, false, null);
      else if (b) document.execCommand("formatBlock", false, "<" + b.dataset.block + ">");
      else {
        const url = prompt("Alamat tautan (diawali https://):", "https://");
        if (!url) return;
        if (!/^(https?:\/\/|mailto:)\S+$/i.test(url.trim())) { toast("Alamat tautan harus diawali https://", true); return; }
        restoreRange();
        document.execCommand("createLink", false, url.trim());
      }
      setDirty(true);
    });

    root.addEventListener("click", (e) => {
      if (!e.target.closest("[data-sampul-del]")) return;
      cur.sampul = ""; cur.sampulNama = "";
      renderThumb();
      setDirty(true);
    });

    root.addEventListener("change", async (e) => {
      const input = e.target;
      if (!input.files || !input.files.length || !cur) return;
      const files = [...input.files];
      input.value = "";
      if (input.matches("[data-sampul]")) {
        await sibuk(async () => {
          const nama = randomName();
          const url = await upload(jenis, cur.id, nama, toJpeg(await loadImage(files[0]), { ratio: [16, 9], max: 1200 }));
          cur.sampul = url; cur.sampulNama = nama;
          renderThumb();
        }, "Thumbnail gagal diunggah: ");
      } else if (input.matches("[data-img]")) {
        await sibuk(async () => {
          const url = await upload(jenis, cur.id, randomName(), toJpeg(await loadImage(files[0]), { max: 1400 }));
          restoreRange();
          document.execCommand("insertImage", false, url);
          kursorSetelahGambar(url);
        }, "Gambar gagal diunggah: ");
      } else if (input.matches("[data-add-foto]")) {
        await tambahFoto(files);
      }
    });

    async function sibuk(fn, awalan) {
      busy++;
      setDirty(dirty);
      try { await fn(); setDirty(true); }
      catch (err) { fail(err, awalan); }
      finally { busy--; setDirty(dirty); }
    }

    /* ---------- Album: unggah banyak foto + keterangan + urutan ---------- */
    function editorAlbum() {
      return `
        <div class="ad-card">
          <div class="ad-row">
            <h2>Foto</h2>
            <label class="ad-btn ad-btn--sm">+ Tambah foto<input type="file" accept="image/*" multiple hidden data-add-foto></label>
          </div>
          <p class="ad-muted">Bisa pilih banyak sekaligus. Foto pertama jadi sampul album.</p>
          <p class="ad-progress" data-progress hidden></p>
          <div class="ad-fotos" data-fotos></div>
        </div>`;
    }
    function renderFoto() {
      const list = cur.foto;
      $("[data-fotos]", root).innerHTML = list.length ? list.map((f, i) => `
        <div class="ad-foto">
          <div class="ad-foto__img"><img src="${esc(f.thumb)}" alt="" loading="lazy">${i === 0 ? `<span class="ad-foto__cover">Sampul</span>` : ""}</div>
          <input type="text" data-k="${i}" value="${esc(f.k)}" maxlength="200" placeholder="Keterangan (opsional)">
          <div class="ad-row-actions">
            <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm" data-fmove="${i}:-1" ${i === 0 ? "disabled" : ""} aria-label="Geser ke depan">←</button>
            <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm" data-fmove="${i}:1" ${i === list.length - 1 ? "disabled" : ""} aria-label="Geser ke belakang">→</button>
            ${i > 0 ? `<button type="button" class="ad-btn ad-btn--ghost ad-btn--sm" data-fcover="${i}" title="Jadikan sampul">★</button>` : ""}
            <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm ad-btn--danger" data-fdel="${i}" aria-label="Hapus foto">✕</button>
          </div>
        </div>`).join("") : `<p class="ad-muted">Belum ada foto.</p>`;
    }
    root.addEventListener("click", (e) => {
      const mv = e.target.closest("[data-fmove]"), cv = e.target.closest("[data-fcover]"), dl = e.target.closest("[data-fdel]");
      if (!mv && !cv && !dl) return;
      const arr = cur.foto;
      if (mv) {
        const [i, d] = mv.dataset.fmove.split(":").map(Number);
        [arr[i], arr[i + d]] = [arr[i + d], arr[i]];
      } else if (cv) {
        arr.unshift(arr.splice(+cv.dataset.fcover, 1)[0]);
      } else {
        arr.splice(+dl.dataset.fdel, 1);
      }
      setDirty(true);
      renderFoto();
    });
    async function tambahFoto(files) {
      const prog = $("[data-progress]", root);
      prog.hidden = false;
      let ok = 0;
      busy++;
      setDirty(dirty);
      try {
        for (let i = 0; i < files.length; i++) {
          prog.textContent = `Mengunggah foto ${i + 1} dari ${files.length}…`;
          try {
            const img = await loadImage(files[i]);
            const n = randomName();
            const src = await upload(jenis, cur.id, n, toJpeg(img, { max: 1600 }));
            const thumb = await upload(jenis, cur.id, n + "-t", toJpeg(img, { max: 520 }));
            cur.foto.push({ n, k: "", src, thumb });
            ok++;
            renderFoto();
          } catch (err) {
            if (handleAuthError(err)) break;
            toast(`${files[i].name}: ${err.message}`, true);
          }
        }
      } finally {
        busy--;
        prog.textContent = `${ok} foto terunggah. Tekan "Simpan album" agar tersimpan.`;
        if (ok) setDirty(true); else setDirty(dirty);
      }
    }

    return { muatDaftar };
  }

  const moduls = ["artikel", "album"].map(modul);
  document.addEventListener("vm:editor", () => moduls.forEach((m) => m.muatDaftar()));
})();
