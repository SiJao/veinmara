<?php
/*
 * POST api/gambar.php {jenis, id, nama, data:"data:image/jpeg;base64,..."}
 *   → simpan gambar artikel/album ke uploads/<jenis>/<id>/<nama>.jpg
 * Khusus admin (butuh X-CSRF). Gambar yang tidak dipakai lagi dibersihkan saat entri disimpan.
 */
define('VEINMARA_API', 1);
require __DIR__ . '/_lib.php';

method('POST');
require_admin();
$in = body();

$jenis = $in['jenis'] ?? '';
$id = $in['id'] ?? '';
$nama = $in['nama'] ?? '';
if (!valid_jenis($jenis) || !valid_entri_id($id) || !valid_gambar($nama)) fail(400, 'Data gambar tidak valid.');
if (!get_entri($jenis, $id)) fail(404, 'Entri tidak ditemukan. Muat ulang halaman.');

save_jpeg(entri_dir($jenis, $id) . "/$nama.jpg", $in['data'] ?? '');
respond(['ok' => true, 'url' => entri_url($jenis, $id, $nama)]);
