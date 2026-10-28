<?php
/*
 * Pustaka bersama API VEINMARA (PHP 7.4+, PDO MySQL).
 * File ini tidak boleh dibuka langsung (dijaga juga oleh api/.htaccess).
 */
if (!defined('VEINMARA_API')) { http_response_code(403); exit; }

const MAX_CONTENT_BYTES = 200000;   // batas ukuran JSON isi web
const MAX_PHOTO_BYTES = 400000;     // batas ukuran satu foto (JPEG)
const LOGIN_MAX_FAIL = 5;           // salah kata sandi maks 5x ...
const LOGIN_WINDOW = 900;           // ... dalam 15 menit per alamat IP
const SESSION_IDLE = 7200;          // login berakhir setelah 2 jam tidak aktif
const EDITABLE_KEYS = ['peresmian', 'halaman', 'pemimpin', 'momen'];

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

/* ---------- Konfigurasi ----------
 * Dicari berurutan:
 * 1. veinmara-config.php di folder-folder DI ATAS web (mis. folder home cPanel, di luar
 *    public_html — DISARANKAN, tidak bisa diakses dari web). Berlaku juga bila web
 *    ditaruh di subfolder seperti public_html/veinmara.
 * 2. api/config.php (cadangan; tetap dilindungi api/.htaccess)
 */
function config(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $candidates = [getenv('VEINMARA_CONFIG') ?: ''];
    for ($up = 2; $up <= 4; $up++) $candidates[] = dirname(__DIR__, $up) . '/veinmara-config.php';
    $candidates[] = __DIR__ . '/config.php';
    foreach ($candidates as $f) {
        // @: hosting dengan open_basedir bisa mengeluarkan warning untuk folder di luar home,
        // dan warning itu akan merusak keluaran JSON
        if ($f !== '' && @is_file($f)) { $cfg = require $f; return $cfg; }
    }
    fail(503, 'Konfigurasi server belum dibuat (lihat PANDUAN-CPANEL.md).');
}

/* ---------- Respons ---------- */
function respond(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(int $code, string $msg): void { respond(['ok' => false, 'error' => $msg], $code); }

function body(): array {
    $raw = file_get_contents('php://input', false, null, 0, MAX_PHOTO_BYTES * 2);
    $data = json_decode($raw ?: '[]', true);
    if (!is_array($data)) fail(400, 'Data tidak valid.');
    return $data;
}

function method(string ...$allowed): string {
    $m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($m, $allowed, true)) fail(405, 'Metode tidak diizinkan.');
    return $m;
}

/* ---------- Database ---------- */
function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = config();
    try {
        $pdo = new PDO($c['db_dsn'], $c['db_user'] ?? null, $c['db_pass'] ?? null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        error_log('[veinmara] koneksi DB gagal: ' . $e->getMessage());
        fail(503, 'Database tidak bisa dihubungi.');
    }
    // Tabel dibuat otomatis saat pertama dipakai (SQL ini cocok untuk MySQL/MariaDB & SQLite)
    $pdo->exec('CREATE TABLE IF NOT EXISTS vm_konten (
        kunci VARCHAR(40) NOT NULL PRIMARY KEY,
        isi MEDIUMTEXT NOT NULL,
        diubah VARCHAR(30) NOT NULL
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS vm_login_gagal (
        ip VARCHAR(64) NOT NULL,
        waktu INTEGER NOT NULL
    )');
    return $pdo;
}

/* ---------- Sesi & keamanan ---------- */
function start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('VMSESS');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();
    if (!empty($_SESSION['admin']) && time() - ($_SESSION['seen'] ?? 0) > SESSION_IDLE) {
        $_SESSION = [];
    }
    if (!empty($_SESSION['admin'])) $_SESSION['seen'] = time();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

function is_admin(): bool { start_session(); return !empty($_SESSION['admin']); }

// Untuk semua perubahan: wajib login + token CSRF (header X-CSRF)
function require_admin(): void {
    if (!is_admin()) fail(401, 'Silakan masuk dulu.');
    $sent = $_SERVER['HTTP_X_CSRF'] ?? '';
    if (!is_string($sent) || !hash_equals($_SESSION['csrf'], $sent)) fail(403, 'Token keamanan tidak cocok. Muat ulang halaman.');
}

function client_ip(): string { return substr($_SERVER['REMOTE_ADDR'] ?? '0', 0, 64); }

function check_password(string $input): bool {
    $c = config();
    if (!empty($c['admin_password_hash'])) return password_verify($input, $c['admin_password_hash']);
    if (isset($c['admin_password']) && $c['admin_password'] !== '') return hash_equals((string)$c['admin_password'], $input);
    return false;
}

/* ---------- Foto ---------- */
function photo_dir(): string { return dirname(__DIR__) . '/uploads/foto'; }
function valid_photo_id($id): bool { return is_string($id) && preg_match('/^[a-z0-9-]{1,60}$/', $id) === 1; }
