/*
 * Control Panel — Daftar undangan.
 * Hanya email @domain sekolah. Setiap aksi (simpan/impor/hapus) langsung tersimpan lewat api/tamu.
 */
(function () {
  "use strict";
  const { api, toast, esc, $, handleAuthError } = window.VMAdmin;
  let daftar = [], domain = "", editing = null;

  const fail = (err, awalan) => { if (!handleAuthError(err)) toast(awalan + err.message, true); };
  const waktu = (iso) => iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "";

  // relatif terhadap halaman ini (Cloudflare menyajikan admin.html sebagai /admin)
  const LINK_UNDANGAN = new URL("undangan.html", location.href).href;
  const linkTamu = (kode) => `${LINK_UNDANGAN}?id=${kode}`;
  let gmail = null, kodeSampai = null, mengirim = false;

  async function muat() {
    try {
      const r = await api("tamu");
      daftar = r.daftar;
      domain = r.domain;
      kodeSampai = r.kodeSampai;
      muatGmail();
      $("#tamu-status").innerHTML = r.clientId
        ? `Aktif. Tamu masuk dengan akun <b>@${esc(domain)}</b>. Link undangan: <code>${esc(LINK_UNDANGAN)}</code>`
        : `<b>Belum diatur.</b> Isi <code>GOOGLE_CLIENT_ID</code> di <code>wrangler.jsonc</code> (lihat PANDUAN.md). Daftar tamu tetap bisa disiapkan sekarang.`;
      render();
    } catch (err) { fail(err, "Gagal memuat daftar undangan: "); }
  }

  function render() {
    const q = $("#tamu-cari").value.trim().toLowerCase();
    const list = q ? daftar.filter((t) => (t.nama + " " + t.email + " " + t.keterangan).toLowerCase().includes(q)) : daftar;
    const dibuka = daftar.filter((t) => t.dibuka).length;
    const terkirim = daftar.filter((t) => t.dikirim).length;
    $("#tamu-jumlah").textContent = `· ${daftar.length} tamu, ${terkirim} email terkirim, ${dibuka} sudah membuka`;
    $("#kirim-semua").textContent = `Kirim ke semua yang belum (${daftar.length - terkirim})`;
    $("#kirim-semua").disabled = mengirim || daftar.length === terkirim;
    $("#tamu-tabel").innerHTML = list.length ? `
      <thead><tr><th>Nama</th><th>Email</th><th>Keterangan</th><th>Email undangan</th><th>Dibuka</th><th></th></tr></thead>
      <tbody>${list.map((t) => `
        <tr>
          <td>${esc(t.nama)}</td>
          <td class="ad-mono">${esc(t.email)}</td>
          <td>${esc(t.keterangan)}</td>
          <td class="ad-tamu-mail">${t.dikirim ? `<span class="ad-ok">✓ ${esc(waktu(t.dikirim))}</span>` : `<span class="ad-muted">Belum</span>`}</td>
          <td>${t.dibuka ? `<span class="ad-ok">✓ ${esc(waktu(t.dibuka))}</span>` : `<span class="ad-muted">Belum</span>`}</td>
          <td><div class="ad-row-actions">
            <button type="button" class="ad-btn ad-btn--sm" data-tkirim="${esc(t.email)}" ${gmail && gmail.terhubung && !mengirim ? "" : "disabled"}>${t.dikirim ? "Kirim ulang" : "Kirim"}</button>
            ${t.kode ? `<button type="button" class="ad-btn ad-btn--ghost ad-btn--sm" data-tlink="${esc(t.kode)}" title="Salin link pribadi tamu ini">Salin link</button>
            <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm" data-tkode="${esc(t.email)}" title="Link lama tidak berlaku lagi">Ganti kode</button>` : ""}
            <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm" data-tedit="${esc(t.email)}">Ubah</button>
            <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm ad-btn--danger" data-tdel="${esc(t.email)}">Hapus</button>
          </div></td>
        </tr>`).join("")}</tbody>`
      : `<tbody><tr><td class="ad-muted">${daftar.length ? "Tidak ada yang cocok." : "Belum ada tamu."}</td></tr></tbody>`;
  }

  async function simpan(list) {
    const r = await api("tamu", { action: "simpan", daftar: list });
    await muat();
    return r;
  }

  /* ---------- Tambah / ubah satu tamu ---------- */
  function resetForm() {
    editing = null;
    $("#tamu-form").reset();
    $("#tamu-form").email.readOnly = false;
    $("#tamu-form-judul").textContent = "Tambah tamu";
    $("#tamu-batal").hidden = true;
  }
  $("#tamu-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const t = { email: f.email.value.trim().toLowerCase(), nama: f.nama.value, keterangan: f.keterangan.value };
    if (domain && !t.email.endsWith("@" + domain)) { toast(`Email harus @${domain}.`, true); return; }
    try {
      const r = await simpan([t]);
      if (r.ditolak.length) { toast(r.ditolak[0], true); return; }
      toast(editing ? "Data tamu diperbarui." : "Tamu ditambahkan.");
      resetForm();
    } catch (err) { fail(err, "Gagal menyimpan: "); }
  });
  $("#tamu-batal").addEventListener("click", resetForm);

  $("#tamu-tabel").addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-tedit]"), del = e.target.closest("[data-tdel]");
    const kirimSatu = e.target.closest("[data-tkirim]"), link = e.target.closest("[data-tlink]"), kode = e.target.closest("[data-tkode]");
    if (kirimSatu) {
      const t = daftar.find((x) => x.email === kirimSatu.dataset.tkirim);
      if (t.dikirim && !confirm(`Email undangan sudah dikirim ke ${t.email}. Kirim lagi?`)) return;
      await kirim([t.email]);
    } else if (link) {
      try { await navigator.clipboard.writeText(linkTamu(link.dataset.tlink)); toast("Link pribadi disalin. Jangan dibagikan ke orang lain."); }
      catch (err) { prompt("Salin link ini:", linkTamu(link.dataset.tlink)); }
    } else if (kode) {
      if (!confirm(`Ganti kode ${kode.dataset.tkode}? Tombol di email yang sudah terkirim tidak akan berfungsi lagi — kirim ulang emailnya sesudah ini.`)) return;
      try {
        const r = await api("tamu", { action: "kodebaru", emails: [kode.dataset.tkode] });
        const t = daftar.find((x) => x.email === kode.dataset.tkode);
        t.kode = r.kode; t.dikirim = "";
        render();
        toast("Kode diganti. Link lama sudah tidak berlaku.");
      } catch (err) { fail(err, "Gagal mengganti kode: "); }
    } else if (ed) {
      const t = daftar.find((x) => x.email === ed.dataset.tedit);
      const f = $("#tamu-form");
      editing = t.email;
      f.email.value = t.email; f.email.readOnly = true; // email = kunci; ganti email → hapus & tambah baru
      f.nama.value = t.nama; f.keterangan.value = t.keterangan;
      $("#tamu-form-judul").textContent = "Ubah tamu";
      $("#tamu-batal").hidden = false;
      f.scrollIntoView({ behavior: "smooth", block: "center" });
      f.nama.focus();
    } else if (del) {
      if (!confirm(`Hapus ${del.dataset.tdel} dari daftar undangan?`)) return;
      try {
        await api("tamu", { action: "hapus", emails: [del.dataset.tdel] });
        toast("Tamu dihapus.");
        await muat();
      } catch (err) { fail(err, "Gagal menghapus: "); }
    }
  });
  $("#tamu-cari").addEventListener("input", render);

  /* ---------- Impor CSV / tempel dari spreadsheet ---------- */
  function parse(text) {
    const rows = [];
    text.split(/\r?\n/).forEach((line) => {
      if (!line.trim()) return;
      const sep = line.includes("\t") ? "\t" : line.includes(";") && !line.includes(",") ? ";" : ",";
      // dukung kolom berkutip "Nama, Gelar"
      const cols = [];
      let cur = "", quoted = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
        else if (c === sep && !quoted) { cols.push(cur); cur = ""; }
        else cur += c;
      }
      cols.push(cur);
      const [email = "", nama = "", keterangan = ""] = cols.map((s) => s.trim());
      if (/^e-?mail$/i.test(email)) return; // baris judul
      rows.push({ email: email.toLowerCase(), nama, keterangan });
    });
    return rows;
  }
  $("#tamu-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) $("#tamu-csv").value = await file.text();
  });
  $("#tamu-impor").addEventListener("click", async () => {
    const rows = parse($("#tamu-csv").value);
    const out = $("#tamu-impor-hasil");
    if (!rows.length) { out.textContent = "Belum ada data."; return; }
    const btn = $("#tamu-impor");
    btn.disabled = true;
    out.textContent = `Mengimpor ${rows.length} baris…`;
    try {
      const r = await simpan(rows);
      out.innerHTML = `${r.disimpan} tamu tersimpan.` + (r.ditolak.length ? ` ${r.ditolak.length} baris dilewati:<br>` + r.ditolak.slice(0, 20).map(esc).join("<br>") + (r.ditolak.length > 20 ? "<br>…" : "") : "");
      if (!r.ditolak.length) $("#tamu-csv").value = "";
    } catch (err) {
      out.textContent = "";
      fail(err, "Gagal mengimpor: ");
    } finally { btn.disabled = false; }
  });

  /* ---------- Cek kesiapan login Google ---------- */
  $("#tamu-cek").addEventListener("click", async () => {
    const ul = $("#tamu-cek-hasil");
    ul.hidden = false;
    ul.innerHTML = "<li>Memeriksa…</li>";
    try {
      const c = (await api("tamu?cek=1")).cek;
      const li = (ok, teks) => `<li class="${ok ? "ad-ok" : "ad-bad"}">${ok ? "✓" : "✕"} ${teks}</li>`;
      ul.innerHTML = li(c.clientId, "Client ID Google sudah diisi") + li(c.koneksi, "Server bisa menghubungi Google");
    } catch (err) { ul.hidden = true; fail(err, "Gagal memeriksa: "); }
  });

  /* ---------- Email undangan (Gmail) ---------- */
  async function muatGmail() {
    try {
      gmail = await api("gmail");
      const st = $("#gmail-status"), aksi = $("#gmail-aksi");
      const sampai = kodeSampai ? new Date(kodeSampai).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : null;
      if (!gmail.siap) {
        st.innerHTML = `<b>Belum bisa dipakai.</b> <code>GOOGLE_CLIENT_SECRET</code> belum diisi di Cloudflare (lihat PANDUAN.md).`;
        aksi.innerHTML = "";
      } else if (gmail.terhubung) {
        st.innerHTML = `Dikirim dari <b>${esc(gmail.email)}</b>.` + (sampai ? ` Tombol di email berlaku sampai <b>${esc(sampai)}</b>.` : "");
        aksi.innerHTML = `<a class="ad-btn ad-btn--ghost ad-btn--sm" href="api/gmail?mulai=1">Ganti akun</a>
          <button type="button" class="ad-btn ad-btn--ghost ad-btn--sm ad-btn--danger" id="gmail-putus">Putuskan</button>`;
      } else {
        st.innerHTML = `Belum ada akun pengirim. Hubungkan satu akun <b>@${esc(domain)}</b> — Google akan meminta izin <i>mengirim email atas nama Anda</i> (tidak bisa membaca email).`;
        aksi.innerHTML = `<a class="ad-btn ad-btn--sm" href="api/gmail?mulai=1">Hubungkan Gmail</a>`;
      }
      $("#gmail-kirim").hidden = !gmail.terhubung;
      render();
    } catch (err) { fail(err, "Gagal memuat status Gmail: "); }
  }
  $("#gmail-aksi").addEventListener("click", async (e) => {
    if (!e.target.closest("#gmail-putus")) return;
    if (!confirm("Putuskan akun pengirim? Email undangan tidak bisa dikirim sampai akun dihubungkan lagi.")) return;
    try { await api("gmail", { action: "putus" }); toast("Akun pengirim diputuskan."); muatGmail(); }
    catch (err) { fail(err, "Gagal: "); }
  });

  // Kirim per 10 email (batas server), tampilkan kemajuan
  async function kirim(emails) {
    if (mengirim) return;
    mengirim = true;
    render();
    const prog = $("#kirim-progress");
    prog.hidden = false;
    let ok = 0;
    const gagal = [];
    try {
      for (let i = 0; i < emails.length; i += 10) {
        prog.textContent = `Mengirim ${Math.min(i + 10, emails.length)} dari ${emails.length}…`;
        const r = await api("tamu", { action: "kirim", emails: emails.slice(i, i + 10) });
        r.hasil.forEach((h) => {
          const t = daftar.find((x) => x.email === h.email);
          if (t && h.kode) t.kode = h.kode;
          if (h.ok) { ok++; if (t) t.dikirim = h.dikirim; } else gagal.push(h.email + ": " + h.error);
        });
        render();
        if (gagal.some((g) => /Hubungkan ulang Gmail/.test(g))) break;
      }
    } catch (err) {
      fail(err, "Pengiriman berhenti: ");
    } finally {
      mengirim = false;
      render();
    }
    prog.innerHTML = `${ok} email terkirim.` + (gagal.length ? ` ${gagal.length} gagal:<br>` + gagal.slice(0, 10).map(esc).join("<br>") : "");
    if (ok) toast(`${ok} email undangan terkirim.`);
  }
  $("#kirim-semua").addEventListener("click", () => {
    const belum = daftar.filter((t) => !t.dikirim).map((t) => t.email);
    if (!belum.length) return;
    if (!confirm(`Kirim email undangan ke ${belum.length} tamu yang belum dikirimi?`)) return;
    kirim(belum);
  });
  $("#kirim-uji").addEventListener("click", async () => {
    const b = $("#kirim-uji");
    b.disabled = true;
    try { const r = await api("tamu", { action: "uji" }); toast(`Email uji terkirim ke ${r.ke}. Cek kotak masuk (atau folder Spam).`); }
    catch (err) { fail(err, "Email uji gagal: "); }
    finally { b.disabled = false; }
  });

  // Kembali dari halaman izin Google (api/gmail → admin.html?gmail=...)
  const hasilGmail = new URLSearchParams(location.search).get("gmail");
  if (hasilGmail !== null) {
    history.replaceState(null, "", location.pathname + location.hash);
    document.addEventListener("vm:editor", () => {
      toast(hasilGmail === "ok" ? "Gmail pengirim terhubung." : hasilGmail, hasilGmail !== "ok");
      document.querySelector('[data-tab="tamu"]').click();
    }, { once: true });
  }

  document.addEventListener("vm:editor", muat);
})();
