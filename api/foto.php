<?php
/*
 * POST api/foto.php {id, data:"data:image/jpeg;base64,..."}  → simpan foto
 * POST api/foto.php {id, hapus:true}                           → hapus foto
 * Khusus admin (butuh X-CSRF). Foto disimpan sebagai uploads/foto/<id>.jpg
 */
define('VEINMARA_API', 1);
require __DIR__ . '/_lib.php';

method('POST');
require_admin();
$in = body();

$id = $in['id'] ?? '';
if (!valid_photo_id($id)) fail(400, 'ID foto tidak valid.');

$file = photo_dir() . '/' . $id . '.jpg';

if (!empty($in['hapus'])) {
    if (is_file($file)) unlink($file);
    respond(['ok' => true]);
}

save_jpeg($file, $in['data'] ?? '');
respond(['ok' => true, 'url' => 'uploads/foto/' . $id . '.jpg?v=' . filemtime($file)]);
