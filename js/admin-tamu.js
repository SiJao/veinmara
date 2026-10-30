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

  async function muat() {
    try {
      const r = await api("tamu");
      daftar = r.daftar;
      domain = r.domain;
      $("#tamu-status").innerHTML = r.clientId
        ? `Aktif. Tamu masuk dengan akun <b>@${esc(domain)}</b>. Link undangan: <code>${esc(location.origin + location.pathname.replace(/admin\.html$/, ""))}undangan.html</code>`
        : `<b>Belum diatur.</b> Isi <code>GOOGLE_CLIENT_ID</code> di <code>wrangler.jsonc</code> (lihat PANDUAN.md). Daftar tamu tetap bisa disiapkan sekarang.`;
      render();
    } catch (err) { fail(err, "Gagal memuat daftar undangan: "); }
  }

  function render() {
    const q = $("#tamu-cari").value.trim().toLowerCase();
    const list = q ? daftar.filter((t) => (t.nama + " " + t.email + " " + t.keterangan).toLowerCase().includes(q)) : daftar;
    const dibuka = daftar.filter((t) => t.dibuka).length;
    $("#tamu-jumlah").textContent = `· ${daftar.length} tamu, ${dibuka} sudah membuka`;
    $("#tamu-tabel").innerHTML = list.length ? `
      <thead><tr><th>Nama</th><th>Email</th><th>Keterangan</th><th>Dibuka</th><th></th></tr></thead>
      <tbody>${list.map((t) => `
        <tr>
          <td>${esc(t.nama)}</td>
          <td class="ad-mono">${esc(t.email)}</td>
          <td>${esc(t.keterangan)}</td>
          <td>${t.dibuka ? `<span class="ad-ok">✓ ${esc(waktu(t.dibuka))}</span>` : `<span class="ad-muted">Belum</span>`}</td>
          <td><div class="ad-row-actions">
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
    if (ed) {
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

  document.addEventListener("vm:editor", muat);
})();
