/*
 * Worker VEINMARA (Cloudflare): API + database D1 + kunci web.
 *   /api/auth, content, foto, entri, gambar, undangan, tamu
 *   /uploads/...jpg → gambar dari database D1 (tabel vm_gambar)
 * Halaman yang bisa dikunci & js/data.js juga lewat sini (lihat "Kunci web");
 * alamat lain dilayani langsung sebagai file statis (assets).
 *
 * - Login admin & tamu undangan memakai akun Google (admin: ADMIN_EMAIL di wrangler.jsonc).
 * - Sesi disimpan di cookie bertanda tangan (HMAC); kuncinya dibuat otomatis di database.
 * - Banyak baris diproses dengan json_each dalam satu query (batas query D1 per permintaan).
 */

const MAX_CONTENT_BYTES = 200000;   // batas ukuran JSON isi web
const MAX_PHOTO_BYTES = 400000;     // batas ukuran satu foto (JPEG)
const MAX_BODY = MAX_PHOTO_BYTES * 2;
const SESSION_IDLE = 7200;          // login admin berakhir setelah 2 jam tidak aktif
const TAMU_TTL = 86400;             // login tamu undangan berlaku 1 hari
const EDITABLE_KEYS = ["peresmian", "halaman", "pemimpin", "momen"];
const MODE_KUNCI = ["otomatis", "kunci", "buka"];   // kunci web (lihat statusKunci)
const JENIS_ENTRI = ["artikel", "album"];
const MAX_ARTIKEL_BYTES = 150000;
const MAX_FOTO_ALBUM = 300;
const MAX_TAMU = 3000;
const MAX_RUNDOWN = 40;             // baris rundown acara (khusus tamu undangan)
const MAX_KIRIM = 10;               // email undangan per permintaan (batas subrequest Worker)
const KODE_TTL = 7 * 86400e3;       // link email berlaku sampai 7 hari setelah acara
const GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GMAIL_SEND = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_SCOPE = "openid email https://www.googleapis.com/auth/gmail.send";
const GOOGLE_ISS = ["accounts.google.com", "https://accounts.google.com"];
const CERTS_TTL = 21600;            // simpan kunci Google 6 jam
const COOKIE = "VMSESS";

/* ---------- Respons & kesalahan ---------- */
class Gagal extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}
function fail(code, msg) { throw new Gagal(code, msg); }

function json(data, code = 200) {
  return new Response(JSON.stringify(data), {
    status: code,
    headers: { "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" },
  });
}

const enc = new TextEncoder();
const bytesOf = (s) => enc.encode(s).length;
const now = () => Math.floor(Date.now() / 1000);
const iso = () => new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
const isObj = (v) => v !== null && typeof v === "object";
const panjang = (s) => [...s].length;   // jumlah huruf (bukan byte), seperti mb_strlen

function randomHex(n) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function sama(a, b) {   // bandingkan string dengan waktu tetap
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function b64bytes(s) {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function b64urlBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return b64bytes(s);
}
const b64urlText = (s) => new TextDecoder().decode(b64urlBytes(s));
const toB64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
// base64 untuk teks panjang (email): dipotong per blok supaya tidak melewati batas argumen fungsi
function b64Text(s) {
  const b = enc.encode(s);
  let bin = "";
  for (let i = 0; i < b.length; i += 8192) bin += String.fromCharCode(...b.subarray(i, i + 8192));
  return btoa(bin);
}

/* ---------- Database ---------- */
const SKEMA = [
  `CREATE TABLE IF NOT EXISTS vm_konten (
    kunci VARCHAR(40) NOT NULL PRIMARY KEY,
    isi MEDIUMTEXT NOT NULL,
    diubah VARCHAR(30) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS vm_entri (
    jenis VARCHAR(10) NOT NULL,
    id VARCHAR(80) NOT NULL,
    tanggal VARCHAR(10) NOT NULL,
    terbit INTEGER NOT NULL,
    isi MEDIUMTEXT NOT NULL,
    diubah VARCHAR(30) NOT NULL,
    PRIMARY KEY (jenis, id)
  )`,
  `CREATE TABLE IF NOT EXISTS vm_undangan (
    email VARCHAR(190) NOT NULL PRIMARY KEY,
    nama VARCHAR(120) NOT NULL,
    keterangan VARCHAR(120) NOT NULL DEFAULT '',
    dibuka VARCHAR(30) NOT NULL DEFAULT '',
    diubah VARCHAR(30) NOT NULL
  )`,
  // Gambar (pengganti folder uploads/): path = "foto/<id>" atau "<jenis>/<id>/<nama>", diubah = detik
  `CREATE TABLE IF NOT EXISTS vm_gambar (
    path VARCHAR(140) NOT NULL PRIMARY KEY,
    data BLOB NOT NULL,
    diubah INTEGER NOT NULL
  )`,
];
let skemaSiap = null;
async function db(env) {
  if (!env.DB) fail(503, "Database belum dihubungkan (binding DB di wrangler.jsonc).");
  // tabel dibuat otomatis sekali per instance Worker
  if (!skemaSiap) skemaSiap = env.DB.batch(SKEMA.map((s) => env.DB.prepare(s))).then(() => tambahKolom(env.DB)).catch((e) => { skemaSiap = null; throw e; });
  await skemaSiap;
  return env.DB;
}
// Kolom yang ditambahkan setelah tabel dibuat: kode (link email) & dikirim (waktu email terkirim)
async function tambahKolom(D) {
  const { results } = await D.prepare("PRAGMA table_info(vm_undangan)").all();
  const ada = new Set(results.map((r) => r.name));
  const ubah = [];
  if (!ada.has("kode")) ubah.push("ALTER TABLE vm_undangan ADD COLUMN kode VARCHAR(40) NOT NULL DEFAULT ''");
  if (!ada.has("dikirim")) ubah.push("ALTER TABLE vm_undangan ADD COLUMN dikirim VARCHAR(30) NOT NULL DEFAULT ''");
  ubah.push("CREATE INDEX IF NOT EXISTS vm_undangan_kode ON vm_undangan (kode)");
  await D.batch(ubah.map((s) => D.prepare(s)));
}
const q = (D, sql, ...args) => D.prepare(sql).bind(...args);

/* ---------- Sesi (cookie bertanda tangan) ---------- */
let kunciSesi = null;
async function sessionKey(env) {
  if (kunciSesi) return kunciSesi;
  let secret = env.SESSION_SECRET;
  if (!secret) {
    // dibuat sekali lalu disimpan di database (tidak pernah dikirim ke browser)
    const D = await db(env);
    await q(D, "INSERT OR IGNORE INTO vm_konten (kunci, isi, diubah) VALUES ('session_secret', ?, ?)", randomHex(32), iso()).run();
    secret = (await q(D, "SELECT isi FROM vm_konten WHERE kunci = 'session_secret'").first()).isi;
  }
  kunciSesi = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return kunciSesi;
}
async function tandaTangan(env, data) {
  return toB64url(new Uint8Array(await crypto.subtle.sign("HMAC", await sessionKey(env), enc.encode(data))));
}
function bacaCookie(req, name) {
  const m = (req.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return m ? m[1] : null;
}

// Satu objek per permintaan: req, env, sesi, cookie yang perlu dikirim balik
class Ctx {
  constructor(req, env) {
    this.req = req;
    this.env = env;
    this.url = new URL(req.url);
    this.sess = null;
    this.ubahSesi = false;
  }
  async session(buat = true) {
    if (this.sess) return this.sess;
    const raw = bacaCookie(this.req, COOKIE);
    let s = null;
    if (raw && raw.includes(".")) {
      const [p, sig] = raw.split(".");
      if (sama(sig, await tandaTangan(this.env, p))) {
        try { s = JSON.parse(b64urlText(p)); } catch (e) { s = null; }
      }
    }
    if (!isObj(s)) { if (!buat) return {}; s = {}; this.ubahSesi = true; }
    const t = now();
    if (s.a && t - (s.s || 0) > SESSION_IDLE) { delete s.a; this.ubahSesi = true; }
    if (s.a) { s.s = t; this.ubahSesi = true; }
    if (s.t && t > (s.tx || 0)) { delete s.t; delete s.tx; this.ubahSesi = true; }
    if (!s.c) { s.c = randomHex(32); this.ubahSesi = true; }
    this.sess = s;
    return s;
  }
  async cookieHeader() {
    if (!this.ubahSesi || !this.sess) return null;
    const p = toB64url(enc.encode(JSON.stringify(this.sess)));
    const secure = this.url.protocol === "https:" ? "; Secure" : "";
    return `${COOKIE}=${p}.${await tandaTangan(this.env, p)}; Path=/; HttpOnly; SameSite=Strict${secure}`;
  }
  async isAdmin() { return !!(await this.session()).a; }
  // Halaman publik: cek admin tanpa membuat sesi bagi pengunjung biasa
  async isAdminQuiet() { return bacaCookie(this.req, COOKIE) ? !!(await this.session(false)).a : false; }
  async cekCsrf() {
    const s = await this.session();
    if (!sama(this.req.headers.get("X-CSRF") || "", s.c)) fail(403, "Token keamanan tidak cocok. Muat ulang halaman.");
  }
  async requireAdmin() {
    if (!(await this.isAdmin())) fail(401, "Silakan masuk dulu.");
    await this.cekCsrf();
  }
  async body() {
    const raw = await this.req.text();
    if (raw.length > MAX_BODY) fail(413, "Data terlalu besar.");
    let data;
    try { data = JSON.parse(raw || "[]"); } catch (e) { fail(400, "Data tidak valid."); }
    if (!isObj(data)) fail(400, "Data tidak valid.");
    return data;
  }
  method(...allowed) {
    if (!allowed.includes(this.req.method)) fail(405, "Metode tidak diizinkan.");
    return this.req.method;
  }
  get(name) { return this.url.searchParams.get(name); }
}

/* ---------- Kunci web ----------
 * Selama terkunci, pengunjung (bukan admin) hanya mendapat halaman hitung mundur (terkunci.html):
 * halaman isi, data.js, artikel/album, dan gambar unggahan tidak dikirim sama sekali.
 * Undangan & Control Panel tetap terbuka.
 */
const RE_HALAMAN_KUNCI = /^\/(index|artikel|dokumentasi|panggung-gembira)?(\.html|\/)?$/;
let kontenCache = null;   // isi tersimpan, disimpan sebentar (15 detik) per instance Worker
async function kontenTersimpan(env) {
  if (kontenCache && Date.now() - kontenCache.t < 15000) return kontenCache.c;
  const row = await q(await db(env), "SELECT isi FROM vm_konten WHERE kunci = 'content'").first();
  let c = null;
  try { c = row ? JSON.parse(row.isi) : null; } catch (e) { c = null; }
  kontenCache = { t: Date.now(), c };
  return c;
}
function statusKunci(c) {
  if (!isObj(c)) return true;   // belum pernah disimpan dari Control Panel → tetap terkunci (aman)
  const mode = isObj(c.kunci) && MODE_KUNCI.includes(c.kunci.mode) ? c.kunci.mode : "otomatis";
  if (mode !== "otomatis") return mode === "kunci";
  const t = Date.parse(isObj(c.peresmian) ? c.peresmian.waktu : "");
  return !(t <= Date.now());
}
async function webTerkunci(ctx) {
  if (await ctx.isAdminQuiet()) return false;
  return statusKunci(await kontenTersimpan(ctx.env));
}
// Rundown hanya untuk admin & tamu undangan yang sudah masuk (api/undangan) — tidak ikut isi publik
function kontenPublik(c) {
  if (!isObj(c)) return c;
  const { rundown, ...umum } = c;
  return umum;
}
const rundownTamu = async (env) => {
  const c = await kontenTersimpan(env);
  return isObj(c) && Array.isArray(c.rundown) ? c.rundown : [];
};
// Bagian isi yang boleh dilihat saat terkunci (tanpa filosofi, pemimpin, momen)
function kontenTerkunci(c) {
  return isObj(c) ? { peresmian: c.peresmian, kunci: c.kunci, halaman: c.halaman } : null;
}

async function halamanKunci(ctx) {
  const r = await ctx.env.ASSETS.fetch(new Request(new URL("/terkunci", ctx.url)));
  return new Response(r.body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
// js/data.js versi terkunci: hanya acara & teks halaman (dipakai halaman undangan)
async function dataTerkunci(ctx) {
  const c = kontenTerkunci(await kontenTersimpan(ctx.env)) || {};
  const D = { peresmian: c.peresmian || null, kunci: c.kunci || { mode: "otomatis" }, halaman: c.halaman || {}, elemenLogo: [], pemimpin: [], momen: [] };
  return new Response("window.VEINMARA = " + JSON.stringify(D).replace(/</g, "\\u003c") + ";\n", {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/* ---------- Gambar (JPEG di tabel vm_gambar) ---------- */
// Lebar & tinggi dari header JPEG (null = bukan JPEG yang wajar)
function ukuranJpeg(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) { i += 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return null;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + len;
  }
  return null;
}

// Terima data URL JPEG, cek benar-benar foto, simpan di database
async function saveJpeg(env, path, data) {
  const prefix = "data:image/jpeg;base64,";
  if (typeof data !== "string" || !data.startsWith(prefix)) fail(400, "Foto harus JPEG.");
  const b64 = data.slice(prefix.length);
  let bin = null;
  if (/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) { try { bin = b64bytes(b64); } catch (e) { bin = null; } }
  if (!bin || bin.length > MAX_PHOTO_BYTES) fail(413, "Foto terlalu besar atau rusak.");
  const u = ukuranJpeg(bin);
  if (!u || !u.w || !u.h || u.w > 2000 || u.h > 2000) fail(400, "File bukan foto JPEG yang valid.");
  const t = now();
  await q(await db(env), "REPLACE INTO vm_gambar (path, data, diubah) VALUES (?, ?, ?)", path, bin.buffer, t).run();
  return t;
}

const RE_UPLOAD = /^\/uploads\/(foto\/[a-z0-9-]{1,60}|(?:artikel|album)\/[a-z0-9-]{1,80}\/[a-f0-9]{16}(?:-t)?)\.jpg$/;
async function serveUpload(ctx) {
  const m = ctx.url.pathname.match(RE_UPLOAD);
  if (!m || (ctx.req.method !== "GET" && ctx.req.method !== "HEAD") || await webTerkunci(ctx)) return new Response("Tidak ditemukan.", { status: 404 });
  const row = await q(await db(ctx.env), "SELECT data FROM vm_gambar WHERE path = ?", m[1]).first();
  if (!row) return new Response("Tidak ditemukan.", { status: 404 });
  // nama file artikel/album acak & tidak pernah berubah; foto ketua/wakil memakai ?v=<waktu>
  const tetap = !m[1].startsWith("foto/") || ctx.url.searchParams.has("v");
  return new Response(ctx.req.method === "HEAD" ? null : new Uint8Array(row.data), {
    headers: {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": tetap ? "public, max-age=31536000, immutable" : "public, max-age=300",
    },
  });
}

/* ---------- Artikel & album ---------- */
const validJenis = (j) => JENIS_ENTRI.includes(j);
const validEntriId = (id) => typeof id === "string" && id.length <= 80 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);
const validGambar = (n) => typeof n === "string" && /^[a-f0-9]{16}(-t)?$/.test(n);
const validPhotoId = (id) => typeof id === "string" && /^[a-z0-9-]{1,60}$/.test(id);
const entriUrl = (jenis, id, nama) => `uploads/${jenis}/${id}/${nama}.jpg`;

async function getEntri(env, jenis, id) {
  const row = await q(await db(env), "SELECT isi, terbit, diubah FROM vm_entri WHERE jenis = ? AND id = ?", jenis, id).first();
  if (!row) return null;
  let e;
  try { e = JSON.parse(row.isi); } catch (x) { e = {}; }
  if (!isObj(e)) e = {};
  return { ...e, id, terbit: !!row.terbit, diubah: row.diubah };
}

async function putEntri(env, jenis, e) {
  const { id, terbit, diubah, ...isi } = e;
  const s = JSON.stringify(isi);
  if (bytesOf(s) > MAX_ARTIKEL_BYTES + 50000) fail(413, "Isi terlalu besar.");
  const t = iso();
  await q(await db(env), "REPLACE INTO vm_entri (jenis, id, tanggal, terbit, isi, diubah) VALUES (?, ?, ?, ?, ?, ?)",
    jenis, id, e.tanggal, terbit ? 1 : 0, s, t).run();
  return t;
}

// Semua gambar satu entri = path di antara "<jenis>/<id>/" dan "<jenis>/<id>0" ("0" = huruf sesudah "/").
// Sengaja tidak memakai LIKE: D1 menolak pola LIKE lebih dari 50 karakter (id album bisa panjang).
const DI_ENTRI = "path >= ? AND path < ?";
const batasEntri = (jenis, id) => [`${jenis}/${id}/`, `${jenis}/${id}0`];

// Nama gambar (tanpa .jpg) yang tersimpan untuk satu entri
async function gambarEntri(env, jenis, id) {
  const { results } = await q(await db(env), `SELECT path FROM vm_gambar WHERE ${DI_ENTRI}`, ...batasEntri(jenis, id)).all();
  return new Set(results.map((r) => r.path.slice(jenis.length + id.length + 2)));
}
// Hapus gambar entri yang tidak dipakai lagi — satu query (json_each = daftar yang dipertahankan)
async function pruneGambar(env, jenis, id, dipakai) {
  const keep = JSON.stringify(dipakai.map((n) => `${jenis}/${id}/${n}`));
  await q(await db(env), `DELETE FROM vm_gambar WHERE ${DI_ENTRI} AND path NOT IN (SELECT value FROM json_each(?))`, ...batasEntri(jenis, id), keep).run();
}

function slugify(s, cadangan) {
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/^-+|-+$/g, "");
  return s !== "" ? s : cadangan;
}

function tampil(jenis, e, lengkap) {
  const id = e.id;
  const out = { id, judul: e.judul ?? "", tanggal: e.tanggal ?? "", terbit: e.terbit, diubah: e.diubah ?? null };
  if (jenis === "artikel") {
    out.ringkasan = e.ringkasan ?? "";
    out.sampulNama = e.sampul ?? "";
    out.sampul = e.sampul ? entriUrl("artikel", id, e.sampul) : "";
    if (lengkap) out.isi = e.isi ?? "";
  } else {
    const foto = Array.isArray(e.foto) ? e.foto : [];
    out.keterangan = e.keterangan ?? "";
    out.jumlah = foto.length;
    out.sampul = foto.length ? entriUrl("album", id, foto[0].n + "-t") : "";
    if (lengkap) {
      out.foto = foto.map((f) => ({ n: f.n, k: f.k ?? "", src: entriUrl("album", id, f.n), thumb: entriUrl("album", id, f.n + "-t") }));
    }
  }
  return out;
}

function teks(v, max, label) {
  if (v === null || v === undefined) return "";
  if (typeof v !== "string") fail(400, `${label} tidak valid.`);
  v = v.trim();
  if (panjang(v) > max) fail(400, `${label} terlalu panjang (maks ${max} karakter).`);
  return v;
}
const hariIni = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);  // WIB

// Lapisan pengaman tambahan: hanya tag yang diizinkan — browser juga membersihkan isi (js/rich.js)
const TAG_BOLEH = new Set(["p", "br", "strong", "b", "em", "i", "u", "h2", "h3", "ul", "ol", "li", "blockquote", "a", "img"]);
function bersihkanHtml(isi) {
  isi = isi.replace(/<!--[\s\S]*?(-->|$)/g, "").replace(/<[^>]*>?/g, (m) => {
    const t = /^<\/?([a-z][a-z0-9]*)\b/i.exec(m);
    return t && m.endsWith(">") && TAG_BOLEH.has(t[1].toLowerCase()) ? m : "";
  });
  isi = isi.replace(/\s(on\w+|style|class|id)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  return isi.replace(/(href|src)\s*=\s*(["']?)\s*(javascript|data|vbscript):[^"'\s>]*\2/gi, "");
}

/* ---------- Login Google ---------- */
const certsUrl = (env) => env.GOOGLE_CERTS_URL || GOOGLE_CERTS;

async function httpGet(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return r.ok ? await r.text() : null;
  } catch (e) { return null; }
}

// Kunci publik Google (kid → [n, e]); segar = paksa ambil ulang. Disimpan sementara di vm_konten.
async function googleKeys(env, segar = false) {
  const D = await db(env);
  const row = await q(D, "SELECT isi, diubah FROM vm_konten WHERE kunci = 'google_certs'").first();
  // ambil ulang paksa paling sering 5 menit sekali
  if (row && now() - parseInt(row.diubah, 10) < (segar ? 300 : CERTS_TTL)) return JSON.parse(row.isi) || {};
  const raw = await httpGet(certsUrl(env));
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
  if (!isObj(data) || !Array.isArray(data.keys) || !data.keys.length) {
    console.error("[veinmara] kunci Google tidak bisa diambil dari " + certsUrl(env));
    fail(502, "Server tidak bisa menghubungi Google untuk memeriksa login. Coba lagi nanti.");
  }
  const keys = {};
  for (const k of data.keys) if (k.kty === "RSA" && k.kid && k.n && k.e) keys[k.kid] = [k.n, k.e];
  await q(D, "REPLACE INTO vm_konten (kunci, isi, diubah) VALUES ('google_certs', ?, ?)", JSON.stringify(keys), String(now())).run();
  return keys;
}

/*
 * Periksa ID token dari tombol Masuk dengan Google. Berhasil → klaim (email, name, ...).
 * Wajib: tanda tangan RS256 sah, dari Google, untuk Client ID kita, belum kedaluwarsa,
 * email terverifikasi, dan akun milik domain sekolah (klaim "hd").
 */
async function verifyGoogleToken(env, jwt, clientId, domain) {
  const bad = () => fail(401, "Login Google tidak sah. Coba masuk lagi.");
  if (typeof jwt !== "string" || jwt.length > 4096 || jwt.split(".").length !== 3) bad();
  const [h64, p64, s64] = jwt.split(".");
  let head, claims, sig;
  try { head = JSON.parse(b64urlText(h64)); claims = JSON.parse(b64urlText(p64)); sig = b64urlBytes(s64); } catch (e) { bad(); }
  if (!isObj(head) || !isObj(claims) || head.alg !== "RS256" || !head.kid || typeof head.kid !== "string") bad();

  let keys = await googleKeys(env);
  if (!keys[head.kid]) keys = await googleKeys(env, true);   // Google baru saja mengganti kunci
  if (!keys[head.kid]) bad();
  const [n, e] = keys[head.kid];
  let valid = false;
  try {
    const key = await crypto.subtle.importKey("jwk", { kty: "RSA", n, e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, enc.encode(h64 + "." + p64));
  } catch (x) { valid = false; }
  if (!valid) bad();

  const t = now();
  if (!GOOGLE_ISS.includes(claims.iss) || claims.aud !== clientId) bad();
  if ((claims.exp || 0) < t - 60 || (claims.iat || 0) > t + 300) fail(401, "Login Google sudah kedaluwarsa. Coba masuk lagi.");
  const email = String(claims.email || "").toLowerCase();
  if (!claims.email_verified || claims.hd !== domain || !email.endsWith("@" + domain)) {
    fail(403, `Gunakan akun @${domain} untuk membuka undangan ini.`);
  }
  return { ...claims, email };
}

const domainUndangan = (env) => String(env.UNDANGAN_DOMAIN || "daarululuumlido.com").toLowerCase();
const adminEmails = (env) => String(env.ADMIN_EMAIL || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const adminDomain = (env) => (adminEmails(env)[0] || "").split("@")[1] || domainUndangan(env);

/* ---------- Email undangan (dikirim lewat Gmail akun sekolah) ----------
 * Admin menghubungkan satu akun Gmail sekali (OAuth, izin "kirim email" saja); refresh token
 * disimpan di vm_konten 'gmail' dan tidak pernah dikirim ke browser.
 * Tiap tamu mendapat kode acak: undangan.html?id=<kode> membuka undangannya tanpa login
 * sampai 7 hari setelah acara. Tanpa kode (mis. dari QR Code) tetap wajib login Google.
 */
const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const validKode = (k) => typeof k === "string" && /^[a-f0-9]{32}$/.test(k);
const googleUrl = (env, nama, asli) => env["GOOGLE_" + nama + "_URL"] || asli;   // dapat diganti saat pengujian

// Template bawaan (dipakai kalau belum diubah di Control Panel → Halaman)
const EMAIL_BAWAAN = {
  subjek: "Undangan Peresmian Angkatan VEINMARA Generation untuk {nama}",
  isi: "<p>Assalamu'alaikum warahmatullahi wabarakatuh,</p>" +
    "<p>Kepada Yth.<br><strong>{nama}</strong><br>{keterangan}</p>" +
    "<p>Dengan penuh rasa syukur, kami mengundang Anda untuk hadir dan menjadi saksi " +
    "<strong>Peresmian Angkatan VEINMARA Generation</strong> — <em>A Renewal Catalyst</em>.</p>" +
    "<p>Kehadiran Anda adalah kehormatan dan doa terbaik bagi perjalanan kami.</p>",
};

function templateEmail(c) {
  const e = isObj(c) && isObj(c.halaman) && isObj(c.halaman.undangan) && isObj(c.halaman.undangan.email) ? c.halaman.undangan.email : {};
  return {
    subjek: typeof e.subjek === "string" && e.subjek.trim() ? e.subjek : EMAIL_BAWAAN.subjek,
    isi: typeof e.isi === "string" && e.isi.trim() ? e.isi : EMAIL_BAWAAN.isi,
  };
}
// Sampai kapan link email masih bisa dipakai (ms); tanpa waktu acara → tidak kedaluwarsa
function kodeBatas(c) {
  const t = Date.parse(isObj(c) && isObj(c.peresmian) ? c.peresmian.waktu : "");
  return isNaN(t) ? Infinity : t + KODE_TTL;
}

const ISIAN_EMAIL = /\{(nama|keterangan|tanggal|jam|tempat)\}/g;
function isiEmailHtml(tpl, data) {
  let h = bersihkanHtml(String(tpl).slice(0, 20000)).replace(/<img\b[^>]*>/gi, "");
  h = h.replace(ISIAN_EMAIL, (m, k) => escHtml(data[k]));
  // isian kosong (mis. tanpa keterangan) jangan meninggalkan baris kosong
  h = h.replace(/(<br\s*\/?>\s*)+<\/p>/gi, "</p>").replace(/<p>\s*<\/p>/gi, "");
  return h
    .replace(/<p>/gi, '<p style="margin:0 0 16px;">')
    .replace(/<strong>/gi, '<strong style="color:#ecd3a0;">')
    .replace(/<h2>/gi, '<h2 style="margin:0 0 12px;font:600 20px Georgia,serif;color:#ecd3a0;">')
    .replace(/<h3>/gi, '<h3 style="margin:0 0 10px;font:600 17px Georgia,serif;color:#ecd3a0;">')
    .replace(/<a /gi, '<a style="color:#74e0b3;" ');
}
function htmlKeTeks(h) {
  return h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|h2|h3|li|blockquote)>/gi, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n").trim();
}

// Satu email lengkap: { subjek, html, teks }
function buatEmail(origin, c, tamu, link) {
  const tpl = templateEmail(c);
  const p = isObj(c) && isObj(c.peresmian) ? c.peresmian : {};
  const data = { nama: tamu.nama, keterangan: tamu.keterangan, tanggal: p.tanggal, jam: p.jam, tempat: p.tempat };
  const subjek = String(tpl.subjek).replace(ISIAN_EMAIL, (m, k) => String(data[k] ?? "")).replace(/[\r\n]+/g, " ").trim().slice(0, 150);
  const isi = isiEmailHtml(tpl.isi, data);
  const logo = origin + "/assets/web/logo-veinmara.png";
  const baris = (label, nilai) => nilai ? `<tr>
    <td style="padding:8px 0;width:84px;font:600 11px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#c69856;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;font:16px Arial,sans-serif;color:#f4e9d6;">${escHtml(nilai)}</td></tr>` : "";
  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><title>${escHtml(subjek)}</title></head>
<body style="margin:0;padding:0;background:#1c0509;">
<div style="display:none;max-height:0;overflow:hidden;">Undangan pribadi untuk ${escHtml(tamu.nama)} · ${escHtml(p.tanggal || "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1c0509" style="background:#1c0509;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#2a070c;border:1px solid #6b4a24;border-radius:20px;" bgcolor="#2a070c">
    <tr><td align="center" style="padding:36px 28px 8px;">
      <img src="${logo}" width="104" height="104" alt="Logo VEINMARA Generation" style="display:block;width:104px;height:104px;border:0;">
      <p style="margin:18px 0 0;font:600 12px Arial,sans-serif;letter-spacing:5px;text-transform:uppercase;color:#c69856;">Undangan Peresmian</p>
      <p style="margin:8px 0 0;font:600 34px/1.1 Georgia,'Times New Roman',serif;letter-spacing:6px;text-transform:uppercase;color:#ecd3a0;">Veinmara</p>
      <p style="margin:6px 0 0;font:italic 16px Georgia,serif;color:#d3b080;">A Renewal Catalyst</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px auto 0;"><tr>
        <td width="56" style="width:56px;vertical-align:middle;"><div style="height:1px;line-height:1px;font-size:1px;background:#c69856;">&nbsp;</div></td>
        <td style="padding:0 10px;font:12px/1 Arial,sans-serif;color:#c69856;vertical-align:middle;">&#9670;</td>
        <td width="56" style="width:56px;vertical-align:middle;"><div style="height:1px;line-height:1px;font-size:1px;background:#c69856;">&nbsp;</div></td></tr></table>
    </td></tr>
    <tr><td style="padding:24px 36px 4px;font:16px/1.7 Arial,sans-serif;color:#f4e9d6;">${isi}</td></tr>
    <tr><td style="padding:4px 36px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#3a0b13;border:1px solid #6b4a24;border-radius:14px;" bgcolor="#3a0b13">
        <tr><td style="padding:12px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${baris("Hari", p.tanggal)}${baris("Pukul", p.jam)}${baris("Tempat", p.tempat)}
        </table></td></tr></table>
    </td></tr>
    <tr><td align="center" style="padding:28px 36px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="#c69856" style="border-radius:999px;background:#c69856;">
          <a href="${escHtml(link)}" target="_blank" style="display:inline-block;padding:15px 36px;font:700 14px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#1c0509;text-decoration:none;border-radius:999px;">Buka Undangan</a>
        </td></tr></table>
      <p style="margin:16px 0 0;font:13px/1.6 Arial,sans-serif;color:#b89f86;">Tombol ini khusus untuk <strong style="color:#ecd3a0;">${escHtml(tamu.nama)}</strong>. Mohon tidak meneruskan email ini.</p>
    </td></tr>
    <tr><td style="padding:20px 36px 0;font:12px/1.6 Arial,sans-serif;color:#8f7a66;">Tombol tidak berfungsi? Salin alamat ini ke browser:<br>
      <a href="${escHtml(link)}" style="color:#74e0b3;word-break:break-all;">${escHtml(link)}</a></td></tr>
    <tr><td align="center" style="padding:28px 36px 32px;">
      <p style="margin:0 0 8px;font:22px/1.8 'Traditional Arabic',serif;color:#ecd3a0;" dir="rtl" lang="ar">فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا</p>
      <p style="margin:0;font:12px/1.6 Arial,sans-serif;color:#8f7a66;">VEINMARA Generation · Pesantren Modern Daarul ‘Uluum Lido<br>Email ini dikirim oleh panitia kepada tamu undangan yang terdaftar.</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  const teks = htmlKeTeks(isi) + "\n\n" +
    [p.tanggal && "Hari   : " + p.tanggal, p.jam && "Pukul  : " + p.jam, p.tempat && "Tempat : " + p.tempat].filter(Boolean).join("\n") +
    "\n\nBuka undangan Anda:\n" + link + "\n\nLink ini khusus untuk " + tamu.nama + ". Mohon tidak meneruskan email ini.\n\nVEINMARA Generation · Pesantren Modern Daarul 'Uluum Lido";
  return { subjek, html, teks };
}

// Akun pengirim tersimpan: { refresh, email, t } atau null
async function gmailTersimpan(env) {
  const row = await q(await db(env), "SELECT isi FROM vm_konten WHERE kunci = 'gmail'").first();
  try { const g = row ? JSON.parse(row.isi) : null; return isObj(g) && g.refresh ? g : null; } catch (e) { return null; }
}
async function tokenGoogle(env, params) {
  let r, d = null;
  try {
    r = await fetch(googleUrl(env, "TOKEN", GOOGLE_TOKEN), {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: String(env.GOOGLE_CLIENT_ID || ""), client_secret: String(env.GOOGLE_CLIENT_SECRET || ""), ...params }),
    });
    d = await r.json();
  } catch (e) { fail(502, "Server tidak bisa menghubungi Google. Coba lagi nanti."); }
  if (!r.ok || !d.access_token) {
    if (d && d.error === "invalid_grant") fail(409, "Izin Gmail sudah dicabut atau kedaluwarsa. Hubungkan ulang Gmail di tab Undangan.");
    fail(502, "Google menolak permintaan token" + (d && d.error ? ` (${d.error})` : "") + ".");
  }
  return d;
}
let aksesGmail = null;   // { token, exp, refresh } per instance Worker
async function tokenGmail(env, g) {
  if (aksesGmail && aksesGmail.refresh === g.refresh && aksesGmail.exp > Date.now() + 60000) return aksesGmail.token;
  const d = await tokenGoogle(env, { grant_type: "refresh_token", refresh_token: g.refresh });
  aksesGmail = { token: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000, refresh: g.refresh };
  return d.access_token;
}
async function kirimGmail(env, g, ke, mail) {
  const batas = "vm" + randomHex(12);
  const mime = [
    `From: "VEINMARA Generation" <${g.email}>`,
    `To: <${ke}>`,
    `Subject: =?UTF-8?B?${b64Text(mail.subjek)}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${batas}"`,
    "",
    `--${batas}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64Text(mail.teks).replace(/.{76}/g, "$&\r\n"),
    `--${batas}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64Text(mail.html).replace(/.{76}/g, "$&\r\n"),
    `--${batas}--`, "",
  ].join("\r\n");
  const raw = b64Text(mime).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  let r;
  try {
    r = await fetch(googleUrl(env, "GMAIL", GMAIL_SEND), {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { Authorization: "Bearer " + (await tokenGmail(env, g)), "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
  } catch (e) { if (e instanceof Gagal) throw e; fail(502, "Gmail tidak bisa dihubungi."); }
  if (!r.ok) {
    let pesan = "";
    try { pesan = (await r.json()).error.message; } catch (e) { pesan = ""; }
    if (r.status === 401 || r.status === 403) aksesGmail = null;
    fail(502, `Gmail menolak (HTTP ${r.status})${pesan ? ": " + pesan : ""}`);
  }
}

/* ================= Endpoint ================= */

// GET → status login + token CSRF + pengaturan tombol Google
// POST {action:"login", credential} / {action:"logout"} (butuh X-CSRF)
async function apiAuth(ctx) {
  const m = ctx.method("GET", "POST");
  const s = await ctx.session();
  const clientId = String(ctx.env.GOOGLE_CLIENT_ID || "");
  if (m === "GET") {
    return json({ ok: true, loggedIn: !!s.a, csrf: s.c, mode: "google", clientId, domain: adminDomain(ctx.env) });
  }
  await ctx.cekCsrf();
  const inp = await ctx.body();
  if (inp.action === "logout") {
    if (!s.a) fail(401, "Silakan masuk dulu.");
    ctx.sess = { c: randomHex(32) };
    ctx.ubahSesi = true;
    return json({ ok: true });
  }
  if (inp.action !== "login") fail(400, "Aksi tidak dikenal.");
  if (!clientId) fail(503, "Login Google belum diatur (GOOGLE_CLIENT_ID di wrangler.jsonc).");
  const claims = await verifyGoogleToken(ctx.env, inp.credential, clientId, adminDomain(ctx.env));
  if (!adminEmails(ctx.env).includes(claims.email)) fail(403, `Akun ${claims.email} bukan admin.`);
  ctx.sess = { c: randomHex(32), a: claims.email, s: now() };
  ctx.ubahSesi = true;
  return json({ ok: true, loggedIn: true, csrf: ctx.sess.c });
}

// GET → isi web + daftar foto (publik); POST {content} → simpan (admin)
async function apiContent(ctx) {
  const m = ctx.method("GET", "POST");
  const D = await db(ctx.env);
  if (m === "GET") {
    const row = await q(D, "SELECT isi, diubah FROM vm_konten WHERE kunci = 'content'").first();
    const content = row ? JSON.parse(row.isi) : null;
    const admin = await ctx.isAdminQuiet();
    // status dari salinan yang sama dengan penjaga halaman (supaya halaman kunci tidak memuat ulang beruntun)
    const terkunci = statusKunci(await kontenTersimpan(ctx.env));
    const dasar = { ok: true, updatedAt: row ? row.diubah : null, terkunci, admin, sekarang: Date.now() };
    if (terkunci && !admin) return json({ ...dasar, content: kontenTerkunci(content), fotos: {} });
    const { results } = await q(D, "SELECT path, diubah FROM vm_gambar WHERE path LIKE 'foto/%'").all();
    const fotos = {};
    for (const r of results) {
      const id = r.path.slice(5);
      if (validPhotoId(id)) fotos[id] = `uploads/foto/${id}.jpg?v=${r.diubah}`;
    }
    return json({ ...dasar, content: admin ? content : kontenPublik(content), fotos });
  }

  await ctx.requireAdmin();
  const content = (await ctx.body()).content;
  if (!isObj(content)) fail(400, "Isi tidak valid.");
  // Hanya bagian yang memang boleh diedit yang disimpan
  const clean = {};
  for (const k of EDITABLE_KEYS) {
    if (!(k in content)) fail(400, `Bagian '${k}' tidak ada.`);
    clean[k] = content[k];
  }
  if (!["pemimpin", "momen", "halaman", "peresmian"].every((k) => isObj(clean[k]))) fail(400, "Struktur isi tidak valid.");
  if (isNaN(Date.parse(String(clean.peresmian.waktu ?? "")))) fail(400, "Waktu peresmian tidak valid.");
  // kunci boleh tidak ada (Control Panel versi lama) → otomatis
  const mode = isObj(content.kunci) ? content.kunci.mode : "otomatis";
  if (!MODE_KUNCI.includes(mode)) fail(400, "Pilihan kunci web tidak valid.");
  clean.kunci = { mode };
  // rundown boleh tidak ada (Control Panel versi lama) → kosong
  const rundown = content.rundown ?? [];
  if (!Array.isArray(rundown) || rundown.length > MAX_RUNDOWN) fail(400, `Rundown maksimal ${MAX_RUNDOWN} baris.`);
  clean.rundown = rundown.map((r, i) => {
    r = isObj(r) ? r : {};
    const baris = { jam: teks(r.jam, 20, `Jam rundown ${i + 1}`), acara: teks(r.acara, 120, `Acara rundown ${i + 1}`), ket: teks(r.ket, 200, `Keterangan rundown ${i + 1}`) };
    if (baris.acara === "") fail(400, `Rundown baris ${i + 1} belum punya nama acara.`);
    return baris;
  });
  const s = JSON.stringify(clean);
  if (bytesOf(s) > MAX_CONTENT_BYTES) fail(413, "Isi terlalu besar.");
  const t = iso();
  await q(D, "REPLACE INTO vm_konten (kunci, isi, diubah) VALUES ('content', ?, ?)", s, t).run();
  kontenCache = null;
  return json({ ok: true, updatedAt: t });
}

// POST {id, data} → simpan foto ketua/wakil; {id, hapus:true} → hapus (admin)
async function apiFoto(ctx) {
  ctx.method("POST");
  await ctx.requireAdmin();
  const inp = await ctx.body();
  if (!validPhotoId(inp.id)) fail(400, "ID foto tidak valid.");
  if (inp.hapus) {
    await q(await db(ctx.env), "DELETE FROM vm_gambar WHERE path = ?", "foto/" + inp.id).run();
    return json({ ok: true });
  }
  const t = await saveJpeg(ctx.env, "foto/" + inp.id, inp.data ?? "");
  return json({ ok: true, url: `uploads/foto/${inp.id}.jpg?v=${t}` });
}

// POST {jenis, id, nama, data} → gambar artikel/album (admin)
async function apiGambar(ctx) {
  ctx.method("POST");
  await ctx.requireAdmin();
  const { jenis, id, nama, data } = await ctx.body();
  if (!validJenis(jenis) || !validEntriId(id) || !validGambar(nama)) fail(400, "Data gambar tidak valid.");
  if (!(await getEntri(ctx.env, jenis, id))) fail(404, "Entri tidak ditemukan. Muat ulang halaman.");
  await saveJpeg(ctx.env, `${jenis}/${id}/${nama}`, data ?? "");
  return json({ ok: true, url: entriUrl(jenis, id, nama) });
}

// Artikel & album
async function apiEntri(ctx) {
  const m = ctx.method("GET", "POST");
  const env = ctx.env;
  if (m === "GET") {
    const jenis = ctx.get("jenis");
    if (!validJenis(jenis)) fail(400, "Jenis tidak dikenal.");
    const admin = await ctx.isAdminQuiet();
    const terkunci = !admin && await webTerkunci(ctx);
    if (ctx.url.searchParams.has("id")) {
      if (terkunci) fail(404, "Tidak ditemukan.");
      const id = ctx.get("id");
      const e = validEntriId(id) ? await getEntri(env, jenis, id) : null;
      if (!e || (!e.terbit && !admin)) fail(404, "Tidak ditemukan.");
      return json({ ok: true, entri: tampil(jenis, e, true) });
    }
    const semua = !!ctx.get("semua") && ctx.get("semua") !== "0";
    if (semua && !admin) fail(401, "Silakan masuk dulu.");
    if (terkunci) return json({ ok: true, daftar: [] });
    const lim = ctx.get("limit");
    const limit = Math.max(1, Math.min(100, lim === null ? 100 : parseInt(lim, 10) || 0));
    const { results } = await q(await db(env),
      "SELECT id, isi, terbit, diubah FROM vm_entri WHERE jenis = ?" + (semua ? "" : " AND terbit = 1") +
      " ORDER BY tanggal DESC, diubah DESC LIMIT ?", jenis, limit).all();
    const daftar = results.map((row) => {
      let e;
      try { e = JSON.parse(row.isi); } catch (x) { e = {}; }
      return tampil(jenis, { ...(isObj(e) ? e : {}), id: row.id, terbit: !!row.terbit, diubah: row.diubah }, false);
    });
    return json({ ok: true, daftar });
  }

  /* ---------- Perubahan (khusus admin) ---------- */
  await ctx.requireAdmin();
  let inp = await ctx.body();
  const jenis = inp.jenis;
  if (!validJenis(jenis)) fail(400, "Jenis tidak dikenal.");
  const action = inp.action;

  if (action === "buat") {
    const judul = teks(inp.judul ?? "", 160, "Judul");
    if (judul === "") fail(400, "Judul wajib diisi.");
    // id dari judul; kalau sudah dipakai, beri akhiran -2, -3, ...
    const dasar = slugify(judul, jenis);
    let id = dasar;
    for (let i = 2; await getEntri(env, jenis, id); i++) id = i < 100 ? `${dasar}-${i}` : `${dasar}-${randomHex(3)}`;
    const e = jenis === "artikel"
      ? { id, judul, ringkasan: "", isi: "", sampul: "", tanggal: hariIni(), terbit: false }
      : { id, judul, keterangan: "", foto: [], tanggal: hariIni(), terbit: false };
    await putEntri(env, jenis, e);
    return json({ ok: true, entri: tampil(jenis, await getEntri(env, jenis, id), true) });
  }

  const id = action === "hapus" ? inp.id : (isObj(inp.entri) ? inp.entri.id : undefined);
  if (!validEntriId(id) || !(await getEntri(env, jenis, id))) fail(404, "Entri tidak ditemukan. Muat ulang halaman.");

  if (action === "hapus") {
    const D = await db(env);
    await D.batch([
      q(D, "DELETE FROM vm_entri WHERE jenis = ? AND id = ?", jenis, id),
      q(D, `DELETE FROM vm_gambar WHERE ${DI_ENTRI}`, ...batasEntri(jenis, id)),
    ]);
    return json({ ok: true });
  }

  if (action !== "simpan") fail(400, "Aksi tidak dikenal.");
  inp = inp.entri;
  if (!isObj(inp)) fail(400, "Data tidak valid.");

  const judul = teks(inp.judul ?? "", 160, "Judul");
  if (judul === "") fail(400, "Judul wajib diisi.");
  const tanggal = inp.tanggal ?? "";
  if (typeof tanggal !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || isNaN(Date.parse(tanggal))) fail(400, "Tanggal tidak valid.");
  const e = { id, judul, tanggal, terbit: !!inp.terbit };
  const ada = await gambarEntri(env, jenis, id);
  let dipakai;

  if (jenis === "artikel") {
    e.ringkasan = teks(inp.ringkasan ?? "", 400, "Ringkasan");
    let isi = inp.isi ?? "";
    if (typeof isi !== "string" || bytesOf(isi) > MAX_ARTIKEL_BYTES) fail(413, "Isi artikel terlalu panjang.");
    isi = bersihkanHtml(isi);
    e.isi = isi;

    const sampul = inp.sampul ?? "";
    if (sampul !== "" && (!validGambar(sampul) || !ada.has(sampul))) fail(400, "Thumbnail tidak ditemukan. Unggah ulang.");
    e.sampul = sampul;

    dipakai = [...isi.matchAll(new RegExp(`uploads/artikel/${id}/([a-f0-9]{16})\\.jpg`, "g"))].map((x) => x[1]);
    if (sampul !== "") dipakai.push(sampul);
  } else {
    e.keterangan = teks(inp.keterangan ?? "", 1000, "Keterangan");
    const foto = inp.foto ?? [];
    if (!Array.isArray(foto) || foto.length > MAX_FOTO_ALBUM) fail(400, `Maksimal ${MAX_FOTO_ALBUM} foto per album.`);
    e.foto = [];
    dipakai = [];
    for (const f of foto) {
      const n = isObj(f) ? f.n : "";
      if (!validGambar(n) || n.endsWith("-t") || dipakai.includes(n)) continue;
      if (!ada.has(n)) continue;   // file hilang → lewati
      e.foto.push({ n, k: teks(f.k ?? "", 200, "Keterangan foto") });
      dipakai.push(n, n + "-t");
    }
  }

  await putEntri(env, jenis, e);
  await pruneGambar(env, jenis, id, dipakai);
  return json({ ok: true, entri: tampil(jenis, await getEntri(env, jenis, id), true) });
}

// Undangan (tamu)
async function apiUndangan(ctx) {
  const m = ctx.method("GET", "POST");
  const env = ctx.env;
  const s = await ctx.session();
  const clientId = String(env.GOOGLE_CLIENT_ID || "");
  const domain = domainUndangan(env);
  const D = await db(env);
  const cari = (email) => q(D, "SELECT email, nama, keterangan, dibuka FROM vm_undangan WHERE email = ?", email).first();
  const dataTamu = (t) => ({ email: t.email, nama: t.nama, keterangan: t.keterangan });

  if (m === "GET" && ctx.get("id") !== null) {
    // Dari tombol di email: kode acak membuka undangan tanpa login (tanpa membuat sesi)
    const kode = String(ctx.get("id")).toLowerCase();
    const tamu = validKode(kode) ? await q(D, "SELECT email, nama, keterangan, dibuka FROM vm_undangan WHERE kode = ?", kode).first() : null;
    if (!tamu) return json({ ok: true, clientId, domain, csrf: s.c, tamu: null, kode: "tidak-sah", rundown: [] });
    if (kodeBatas(await kontenTersimpan(env)) < Date.now()) return json({ ok: true, clientId, domain, csrf: s.c, tamu: null, kode: "kedaluwarsa", rundown: [] });
    if (tamu.dibuka === "") await q(D, "UPDATE vm_undangan SET dibuka = ? WHERE email = ?", iso(), tamu.email).run();
    return json({ ok: true, clientId, domain, csrf: s.c, tamu: dataTamu(tamu), kode: "ok", rundown: await rundownTamu(env) });
  }

  if (m === "GET") {
    let tamu = null;
    if (s.t) {
      tamu = await cari(s.t);
      if (!tamu) { delete s.t; delete s.tx; ctx.ubahSesi = true; }   // sudah dihapus dari daftar
    }
    return json({ ok: true, clientId, domain, csrf: s.c, tamu: tamu ? dataTamu(tamu) : null, rundown: tamu ? await rundownTamu(env) : [] });
  }

  await ctx.cekCsrf();
  const inp = await ctx.body();
  if (inp.action === "keluar") {
    delete s.t; delete s.tx;
    ctx.ubahSesi = true;
    return json({ ok: true });
  }
  if (inp.action !== "masuk") fail(400, "Aksi tidak dikenal.");
  if (!clientId) fail(503, "Login undangan belum diatur oleh admin.");

  const claims = await verifyGoogleToken(env, inp.credential, clientId, domain);
  const tamu = await cari(claims.email);
  if (!tamu) fail(403, `Email ${claims.email} tidak ada dalam daftar undangan.`);
  // catat kapan undangan pertama kali dibuka
  if (tamu.dibuka === "") await q(D, "UPDATE vm_undangan SET dibuka = ? WHERE email = ?", iso(), tamu.email).run();
  // token CSRF tetap (undangan.js memakainya lagi untuk "keluar")
  ctx.sess = { ...s, t: tamu.email, tx: now() + TAMU_TTL };
  ctx.ubahSesi = true;
  return json({ ok: true, tamu: dataTamu(tamu), rundown: await rundownTamu(env) });
}

/*
 * Akun Gmail pengirim (admin).
 *   GET              → status { terhubung, email, siap }
 *   GET ?mulai=1     → arahkan ke halaman izin Google
 *   GET ?code&state  → kembali dari Google (cookie SameSite=Strict tidak ikut, jadi yang
 *                      memastikan permintaan ini dari admin adalah state bertanda tangan)
 *   POST {action:"putus"} → lupakan akun pengirim
 */
async function apiGmail(ctx) {
  const m = ctx.method("GET", "POST");
  const env = ctx.env;
  const redirectUri = ctx.url.origin + "/api/gmail";
  const kembali = (pesan) => Response.redirect(ctx.url.origin + "/admin.html?gmail=" + encodeURIComponent(pesan), 302);

  if (m === "POST") {
    await ctx.requireAdmin();
    if ((await ctx.body()).action !== "putus") fail(400, "Aksi tidak dikenal.");
    await q(await db(env), "DELETE FROM vm_konten WHERE kunci = 'gmail'").run();
    aksesGmail = null;
    return json({ ok: true });
  }

  if (ctx.get("state") !== null) {
    const [exp, sig] = String(ctx.get("state")).split(".");
    if (!sig || !sama(sig, await tandaTangan(env, "gmail|" + exp)) || +exp < now()) return kembali("Permintaan kedaluwarsa. Coba hubungkan lagi.");
    if (ctx.get("error") || !ctx.get("code")) return kembali("Izin Gmail dibatalkan.");
    let d;
    try { d = await tokenGoogle(env, { grant_type: "authorization_code", code: ctx.get("code"), redirect_uri: redirectUri }); }
    catch (e) { return kembali(e instanceof Gagal ? e.message : "Gagal menghubungkan Gmail."); }
    // id_token langsung dari Google lewat HTTPS → cukup dibaca isinya
    let email = "";
    try { email = String(JSON.parse(b64urlText(String(d.id_token).split(".")[1])).email || "").toLowerCase(); } catch (e) { email = ""; }
    if (!email.endsWith("@" + domainUndangan(env))) return kembali(`Gunakan akun @${domainUndangan(env)} sebagai pengirim.`);
    if (!d.refresh_token) return kembali("Google tidak memberi izin jangka panjang. Cabut akses aplikasi di akun Google, lalu hubungkan lagi.");
    if (!String(d.scope || "").includes("gmail.send")) return kembali("Izin kirim email tidak dicentang. Hubungkan lagi dan centang izinnya.");
    await q(await db(env), "REPLACE INTO vm_konten (kunci, isi, diubah) VALUES ('gmail', ?, ?)",
      JSON.stringify({ refresh: d.refresh_token, email, t: iso() }), iso()).run();
    aksesGmail = null;
    return kembali("ok");
  }

  if (!(await ctx.isAdmin())) fail(401, "Silakan masuk dulu.");
  const siap = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  if (ctx.get("mulai")) {
    if (!siap) return kembali("GOOGLE_CLIENT_SECRET belum diisi di Cloudflare.");
    const exp = String(now() + 600);
    const u = new URL(googleUrl(env, "AUTH", GOOGLE_AUTH));
    u.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", scope: GMAIL_SCOPE,
      access_type: "offline", prompt: "consent select_account", hd: domainUndangan(env), state: exp + "." + await tandaTangan(env, "gmail|" + exp),
    });
    return Response.redirect(u.toString(), 302);
  }
  const g = await gmailTersimpan(env);
  return json({ ok: true, siap, terhubung: !!g, email: g ? g.email : "", sejak: g ? g.t : "", redirectUri });
}

// Daftar undangan (admin)
async function apiTamu(ctx) {
  const m = ctx.method("GET", "POST");
  const env = ctx.env;
  const domain = domainUndangan(env);
  const clientId = String(env.GOOGLE_CLIENT_ID || "");
  const D = await db(env);

  if (m === "GET") {
    if (!(await ctx.isAdmin())) fail(401, "Silakan masuk dulu.");
    if (ctx.get("cek")) {
      const raw = await httpGet(certsUrl(env));
      let koneksi = false;
      try { koneksi = !!raw && Array.isArray(JSON.parse(raw).keys) && JSON.parse(raw).keys.length > 0; } catch (e) { koneksi = false; }
      return json({ ok: true, cek: { koneksi, clientId: !!clientId } });
    }
    const { results } = await q(D, "SELECT email, nama, keterangan, dibuka, kode, dikirim FROM vm_undangan ORDER BY nama").all();
    const batas = kodeBatas(await kontenTersimpan(env));
    return json({ ok: true, domain, clientId, daftar: results, kodeSampai: batas === Infinity ? null : new Date(batas).toISOString() });
  }

  await ctx.requireAdmin();
  const inp = await ctx.body();
  const daftarEmail = (maks) => {
    if (!Array.isArray(inp.emails) || !inp.emails.length || inp.emails.length > maks) fail(400, `Pilih 1–${maks} tamu.`);
    return [...new Set(inp.emails.filter((e) => typeof e === "string").map((e) => e.trim().toLowerCase()))];
  };
  const contohTamu = { nama: "Jao Hong Khai", keterangan: "Kelas 6 TMI Putra" };

  // Pratinjau email dengan template yang sedang diedit (belum disimpan)
  if (inp.action === "pratinjau") {
    const c = await kontenTersimpan(env);
    const tpl = isObj(inp.email) ? inp.email : {};
    const cc = { ...(isObj(c) ? c : {}), halaman: { undangan: { email: { subjek: teks(tpl.subjek, 200, "Subjek"), isi: String(tpl.isi ?? "") } } } };
    if (isObj(inp.peresmian)) cc.peresmian = inp.peresmian;
    const mail = buatEmail(ctx.url.origin, cc, contohTamu, ctx.url.origin + "/undangan.html?id=" + "0".repeat(32));
    return json({ ok: true, subjek: mail.subjek, html: mail.html });
  }

  // Email uji ke admin yang sedang masuk
  if (inp.action === "uji") {
    const g = await gmailTersimpan(env);
    if (!g) fail(409, "Gmail pengirim belum dihubungkan.");
    const s = await ctx.session();
    const mail = buatEmail(ctx.url.origin, await kontenTersimpan(env), contohTamu, ctx.url.origin + "/undangan.html");
    await kirimGmail(env, g, s.a, { ...mail, subjek: "[UJI] " + mail.subjek });
    return json({ ok: true, ke: s.a });
  }

  // Kirim email undangan (tiap tamu mendapat kode kalau belum punya)
  if (inp.action === "kirim") {
    const emails = daftarEmail(MAX_KIRIM);
    const g = await gmailTersimpan(env);
    if (!g) fail(409, "Gmail pengirim belum dihubungkan.");
    const c = await kontenTersimpan(env);
    if (kodeBatas(c) < Date.now()) fail(409, "Acara sudah lewat lebih dari 7 hari — link email tidak berlaku lagi.");
    const { results } = await q(D, "SELECT email, nama, keterangan, kode FROM vm_undangan WHERE email IN (SELECT value FROM json_each(?))", JSON.stringify(emails)).all();
    const hasil = [];
    const ubah = [];
    for (const t of results) {
      const kode = validKode(t.kode) ? t.kode : randomHex(16);
      if (kode !== t.kode) ubah.push(q(D, "UPDATE vm_undangan SET kode = ? WHERE email = ?", kode, t.email));
      try {
        await kirimGmail(env, g, t.email, buatEmail(ctx.url.origin, c, t, `${ctx.url.origin}/undangan.html?id=${kode}`));
        const w = iso();
        ubah.push(q(D, "UPDATE vm_undangan SET dikirim = ? WHERE email = ?", w, t.email));
        hasil.push({ email: t.email, ok: true, dikirim: w, kode });
      } catch (e) {
        if (!(e instanceof Gagal)) throw e;
        hasil.push({ email: t.email, ok: false, error: e.message, kode });
        if (e.code === 409) break;   // izin Gmail dicabut → sisanya pasti gagal juga
      }
    }
    for (const e of emails) if (!results.some((t) => t.email === e)) hasil.push({ email: e, ok: false, error: "Tidak ada di daftar undangan." });
    if (ubah.length) await D.batch(ubah);
    return json({ ok: true, hasil });
  }

  // Ganti kode: link lama di email tidak bisa dipakai lagi
  if (inp.action === "kodebaru") {
    const emails = daftarEmail(1);
    const kode = randomHex(16);
    const r = await q(D, "UPDATE vm_undangan SET kode = ?, dikirim = '' WHERE email = ?", kode, emails[0]).run();
    if (!r.meta.changes) fail(404, "Tamu tidak ditemukan.");
    return json({ ok: true, kode });
  }

  if (inp.action === "hapus") {
    if (!Array.isArray(inp.emails)) fail(400, "Data tidak valid.");
    const emails = inp.emails.filter((e) => typeof e === "string").map((e) => e.trim().toLowerCase());
    await q(D, "DELETE FROM vm_undangan WHERE email IN (SELECT value FROM json_each(?))", JSON.stringify(emails)).run();
    return json({ ok: true });
  }

  if (inp.action !== "simpan") fail(400, "Aksi tidak dikenal.");
  const daftar = inp.daftar;
  if (!Array.isArray(daftar) || daftar.length > MAX_TAMU) fail(400, `Daftar tidak valid (maks ${MAX_TAMU} baris sekali simpan).`);

  const { results } = await q(D, "SELECT email, dibuka, kode, dikirim FROM vm_undangan").all();
  const lama = new Map(results.map((r) => [r.email, r]));
  let total = lama.size;
  const t = iso();
  const ditolak = [];
  const baris = new Map();   // email → baris yang akan disimpan
  daftar.forEach((x, i) => {
    x = isObj(x) ? x : {};
    const email = String(x.email ?? "").trim().toLowerCase();
    const nama = String(x.nama ?? "").trim();
    const ket = String(x.keterangan ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190 || !email.endsWith("@" + domain)) {
      ditolak.push((email !== "" ? email : `Baris ${i + 1}`) + `: email harus @${domain}`);
      return;
    }
    if (nama === "" || panjang(nama) > 120 || panjang(ket) > 120) { ditolak.push(`${email}: nama kosong atau terlalu panjang (maks 120 huruf)`); return; }
    if (!lama.has(email) && !baris.has(email) && ++total > MAX_TAMU) { ditolak.push(`${email}: daftar sudah penuh (${MAX_TAMU})`); return; }
    // status dibuka, kode link, dan waktu kirim tetap dipertahankan saat data diubah
    const l = lama.get(email) || {};
    baris.set(email, { email, nama, keterangan: ket, dibuka: l.dibuka || "", kode: l.kode || "", dikirim: l.dikirim || "" });
  });
  // semua baris disimpan dengan satu query
  await q(D, `REPLACE INTO vm_undangan (email, nama, keterangan, dibuka, kode, dikirim, diubah)
    SELECT json_extract(value, '$.email'), json_extract(value, '$.nama'), json_extract(value, '$.keterangan'),
           json_extract(value, '$.dibuka'), json_extract(value, '$.kode'), json_extract(value, '$.dikirim'), ? FROM json_each(?)`, t, JSON.stringify([...baris.values()])).run();
  return json({ ok: true, disimpan: daftar.length - ditolak.length, ditolak });
}

const API = {
  auth: apiAuth,
  content: apiContent,
  foto: apiFoto,
  gambar: apiGambar,
  entri: apiEntri,
  undangan: apiUndangan,
  tamu: apiTamu,
  gmail: apiGmail,
};

export default {
  async fetch(req, env) {
    const ctx = new Ctx(req, env);
    const path = ctx.url.pathname;
    let res;
    try {
      if (path.startsWith("/uploads/")) return await serveUpload(ctx);
      if (!path.startsWith("/api/")) {
        if (RE_HALAMAN_KUNCI.test(path) && await webTerkunci(ctx)) return await halamanKunci(ctx);
        if (path === "/js/data.js" && await webTerkunci(ctx)) return await dataTerkunci(ctx);
        return env.ASSETS.fetch(req);
      }
      const nama = path.slice(5);
      const handler = Object.hasOwn(API, nama) ? API[nama] : null;
      res = handler ? await handler(ctx) : json({ ok: false, error: "Tidak ditemukan." }, 404);
    } catch (e) {
      if (e instanceof Gagal) res = json({ ok: false, error: e.message }, e.code);
      else {
        console.error("[veinmara]", e && e.stack || e);
        res = json({ ok: false, error: "Terjadi kesalahan di server." }, 500);
      }
    }
    try {
      const c = await ctx.cookieHeader();
      if (c) res.headers.append("Set-Cookie", c);
    } catch (e) { /* kunci sesi gagal dibuat: kirim respons apa adanya */ }
    return res;
  },
};
