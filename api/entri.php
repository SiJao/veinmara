<?php
/*
 * Artikel & album dokumentasi.
 * GET  api/entri.php?jenis=artikel|album[&limit=3]     → daftar yang sudah terbit (publik)
 * GET  api/entri.php?jenis=...&id=<id>                 → satu entri lengkap (draf hanya untuk admin)
 * GET  api/entri.php?jenis=...&semua=1                 → semua termasuk draf (khusus admin)
 * POST api/entri.php {jenis, action:"buat", judul}     → buat draf baru
 * POST api/entri.php {jenis, action:"simpan", entri}   → simpan perubahan
 * POST api/entri.php {jenis, action:"hapus", id}       → hapus entri + gambarnya
 * Semua POST khusus admin (butuh X-CSRF).
 */
define('VEINMARA_API', 1);
require __DIR__ . '/_lib.php';

$m = method('GET', 'POST');

// Bentuk data yang dikirim ke browser (URL gambar sudah jadi)
function tampil(string $jenis, array $e, bool $lengkap): array {
    $id = $e['id'];
    $out = ['id' => $id, 'judul' => $e['judul'] ?? '', 'tanggal' => $e['tanggal'] ?? '', 'terbit' => $e['terbit'], 'diubah' => $e['diubah'] ?? null];
    if ($jenis === 'artikel') {
        $out['ringkasan'] = $e['ringkasan'] ?? '';
        $out['sampulNama'] = $e['sampul'] ?? '';
        $out['sampul'] = !empty($e['sampul']) ? entri_url('artikel', $id, $e['sampul']) : '';
        if ($lengkap) $out['isi'] = $e['isi'] ?? '';
    } else {
        $foto = $e['foto'] ?? [];
        $out['keterangan'] = $e['keterangan'] ?? '';
        $out['jumlah'] = count($foto);
        $out['sampul'] = $foto ? entri_url('album', $id, $foto[0]['n'] . '-t') : '';
        if ($lengkap) {
            $out['foto'] = array_map(function ($f) use ($id) {
                return ['n' => $f['n'], 'k' => $f['k'] ?? '', 'src' => entri_url('album', $id, $f['n']), 'thumb' => entri_url('album', $id, $f['n'] . '-t')];
            }, $foto);
        }
    }
    return $out;
}

function teks($v, int $max, string $label): string {
    if ($v === null) return '';
    if (!is_string($v)) fail(400, "$label tidak valid.");
    $v = trim($v);
    $len = function_exists('mb_strlen') ? mb_strlen($v, 'UTF-8') : strlen($v);
    if ($len > $max) fail(400, "$label terlalu panjang (maks $max karakter).");
    return $v;
}

function hari_ini(): string { return (new DateTime('now', new DateTimeZone('Asia/Jakarta')))->format('Y-m-d'); }

$jenis = $m === 'GET' ? ($_GET['jenis'] ?? '') : null;

if ($m === 'GET') {
    if (!valid_jenis($jenis)) fail(400, 'Jenis tidak dikenal.');
    $admin = is_admin_quiet();

    if (isset($_GET['id'])) {
        $id = $_GET['id'];
        $e = valid_entri_id($id) ? get_entri($jenis, $id) : null;
        if (!$e || (!$e['terbit'] && !$admin)) fail(404, 'Tidak ditemukan.');
        respond(['ok' => true, 'entri' => tampil($jenis, $e, true)]);
    }

    $semua = !empty($_GET['semua']);
    if ($semua && !$admin) fail(401, 'Silakan masuk dulu.');
    $limit = max(1, min(100, (int)($_GET['limit'] ?? 100)));
    $sql = 'SELECT id, isi, terbit, diubah FROM vm_entri WHERE jenis = ?' . ($semua ? '' : ' AND terbit = 1')
         . ' ORDER BY tanggal DESC, diubah DESC LIMIT ' . $limit;
    $q = db()->prepare($sql);
    $q->execute([$jenis]);
    $list = [];
    foreach ($q->fetchAll() as $row) {
        $e = json_decode($row['isi'], true) ?: [];
        $e['id'] = $row['id'];
        $e['terbit'] = (bool)$row['terbit'];
        $e['diubah'] = $row['diubah'];
        $list[] = tampil($jenis, $e, false);
    }
    respond(['ok' => true, 'daftar' => $list]);
}

/* ---------- Perubahan (khusus admin) ---------- */
require_admin();
$in = body();
$jenis = $in['jenis'] ?? '';
if (!valid_jenis($jenis)) fail(400, 'Jenis tidak dikenal.');
$action = $in['action'] ?? '';

if ($action === 'buat') {
    $judul = teks($in['judul'] ?? '', 160, 'Judul');
    if ($judul === '') fail(400, 'Judul wajib diisi.');
    // id dari judul; kalau sudah dipakai, beri akhiran -2, -3, ...
    $dasar = slugify($judul, $jenis);
    $id = $dasar;
    for ($i = 2; get_entri($jenis, $id); $i++) {
        $id = $i < 100 ? "$dasar-$i" : $dasar . '-' . bin2hex(random_bytes(3));
    }
    $e = $jenis === 'artikel'
        ? ['id' => $id, 'judul' => $judul, 'ringkasan' => '', 'isi' => '', 'sampul' => '', 'tanggal' => hari_ini(), 'terbit' => false]
        : ['id' => $id, 'judul' => $judul, 'keterangan' => '', 'foto' => [], 'tanggal' => hari_ini(), 'terbit' => false];
    put_entri($jenis, $e);
    respond(['ok' => true, 'entri' => tampil($jenis, get_entri($jenis, $id), true)]);
}

$id = $action === 'hapus' ? ($in['id'] ?? '') : ($in['entri']['id'] ?? '');
if (!valid_entri_id($id) || !($lama = get_entri($jenis, $id))) fail(404, 'Entri tidak ditemukan. Muat ulang halaman.');

if ($action === 'hapus') {
    db()->prepare('DELETE FROM vm_entri WHERE jenis = ? AND id = ?')->execute([$jenis, $id]);
    hapus_folder_entri($jenis, $id);
    respond(['ok' => true]);
}

if ($action !== 'simpan') fail(400, 'Aksi tidak dikenal.');
$in = $in['entri'];
if (!is_array($in)) fail(400, 'Data tidak valid.');

$judul = teks($in['judul'] ?? '', 160, 'Judul');
if ($judul === '') fail(400, 'Judul wajib diisi.');
$tanggal = $in['tanggal'] ?? '';
if (!is_string($tanggal) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal) || !strtotime($tanggal)) fail(400, 'Tanggal tidak valid.');
$e = ['id' => $id, 'judul' => $judul, 'tanggal' => $tanggal, 'terbit' => !empty($in['terbit'])];

if ($jenis === 'artikel') {
    $e['ringkasan'] = teks($in['ringkasan'] ?? '', 400, 'Ringkasan');
    $isi = $in['isi'] ?? '';
    if (!is_string($isi) || strlen($isi) > MAX_ARTIKEL_BYTES) fail(413, 'Isi artikel terlalu panjang.');
    // Lapisan pengaman tambahan — browser juga membersihkan isi sebelum ditampilkan (rich.js)
    $isi = strip_tags($isi, '<p><br><strong><b><em><i><u><h2><h3><ul><ol><li><blockquote><a><img>');
    $isi = preg_replace('/\s(on\w+|style|class|id)\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $isi);
    $isi = preg_replace('/(href|src)\s*=\s*(["\']?)\s*(javascript|data|vbscript):[^"\'\s>]*\2/i', '', $isi);
    $e['isi'] = $isi;

    $sampul = $in['sampul'] ?? '';
    if ($sampul !== '' && (!valid_gambar($sampul) || !ada_gambar($jenis, $id, $sampul))) fail(400, 'Thumbnail tidak ditemukan. Unggah ulang.');
    $e['sampul'] = $sampul;

    preg_match_all('#uploads/artikel/' . preg_quote($id, '#') . '/([a-f0-9]{16})\.jpg#', $isi, $mm);
    $dipakai = $mm[1];
    if ($sampul !== '') $dipakai[] = $sampul;
} else {
    $e['keterangan'] = teks($in['keterangan'] ?? '', 1000, 'Keterangan');
    $foto = $in['foto'] ?? [];
    if (!is_array($foto) || count($foto) > MAX_FOTO_ALBUM) fail(400, 'Maksimal ' . MAX_FOTO_ALBUM . ' foto per album.');
    $e['foto'] = [];
    $dipakai = [];
    foreach ($foto as $f) {
        $n = is_array($f) ? ($f['n'] ?? '') : '';
        if (!valid_gambar($n) || substr($n, -2) === '-t' || in_array($n, $dipakai, true)) continue;
        if (!ada_gambar($jenis, $id, $n)) continue; // file hilang → lewati
        $e['foto'][] = ['n' => $n, 'k' => teks($f['k'] ?? '', 200, 'Keterangan foto')];
        $dipakai[] = $n;
        $dipakai[] = "$n-t";
    }
}

put_entri($jenis, $e);
prune_gambar($jenis, $id, $dipakai);
respond(['ok' => true, 'entri' => tampil($jenis, get_entri($jenis, $id), true)]);
