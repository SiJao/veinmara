<?php
/*
 * Pemeriksa "ID token" dari tombol Masuk dengan Google.
 * Token = JWT bertanda tangan RS256. Kunci publik Google diambil dari GOOGLE_CERTS
 * (disimpan sementara di database), lalu tanda tangan dicek dengan OpenSSL.
 * File ini tidak boleh dibuka langsung (dijaga juga oleh api/.htaccess).
 */
if (!defined('VEINMARA_API')) { http_response_code(403); exit; }

const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISS = ['accounts.google.com', 'https://accounts.google.com'];
const CERTS_TTL = 21600; // simpan kunci Google 6 jam

function b64url_decode(string $s) { return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true); }

// Ambil URL lewat cURL, atau file_get_contents kalau cURL tidak ada
function http_get(string $url): ?string {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_FOLLOWLOCATION => false]);
        $out = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($out !== false && $code === 200) ? $out : null;
    }
    if (ini_get('allow_url_fopen')) {
        $out = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 8]]));
        return $out === false ? null : $out;
    }
    return null;
}

function certs_url(): string { return config()['google_certs_url'] ?? GOOGLE_CERTS; }

// Kunci publik Google (kid → [n, e]); $segar = paksa ambil ulang
function google_keys(bool $segar = false): array {
    $pdo = db();
    $row = $pdo->query("SELECT isi, diubah FROM vm_konten WHERE kunci = 'google_certs'")->fetch();
    // ambil ulang paksa paling sering 5 menit sekali (token dengan kunci asal-asalan tidak bisa membanjiri Google)
    if ($row && time() - (int)$row['diubah'] < ($segar ? 300 : CERTS_TTL)) return json_decode($row['isi'], true) ?: [];
    $raw = http_get(certs_url());
    $data = $raw ? json_decode($raw, true) : null;
    if (!is_array($data) || empty($data['keys'])) {
        error_log('[veinmara] kunci Google tidak bisa diambil dari ' . certs_url());
        fail(502, 'Server tidak bisa menghubungi Google untuk memeriksa login. Coba lagi nanti.');
    }
    $keys = [];
    foreach ($data['keys'] as $k) {
        if (($k['kty'] ?? '') === 'RSA' && isset($k['kid'], $k['n'], $k['e'])) $keys[$k['kid']] = [$k['n'], $k['e']];
    }
    // waktu disimpan sebagai angka di kolom "diubah" (khusus baris ini)
    $pdo->prepare("REPLACE INTO vm_konten (kunci, isi, diubah) VALUES ('google_certs', ?, ?)")->execute([json_encode($keys), (string)time()]);
    return $keys;
}

// Kunci RSA (n, e base64url) → PEM yang dimengerti OpenSSL
function jwk_pem(string $n, string $e): string {
    $int = function (string $b) {
        $b = ltrim($b, "\0");
        if ($b === '' || ord($b[0]) > 0x7f) $b = "\0" . $b;
        return "\x02" . der_len(strlen($b)) . $b;
    };
    $rsa = $int(b64url_decode($n)) . $int(b64url_decode($e));
    $rsa = "\x30" . der_len(strlen($rsa)) . $rsa;
    $algo = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00"; // rsaEncryption + NULL
    $bits = "\x03" . der_len(strlen($rsa) + 1) . "\0" . $rsa;
    $spki = "\x30" . der_len(strlen($algo . $bits)) . $algo . $bits;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
}
function der_len(int $n): string {
    if ($n < 0x80) return chr($n);
    $s = '';
    while ($n > 0) { $s = chr($n & 0xff) . $s; $n >>= 8; }
    return chr(0x80 | strlen($s)) . $s;
}

/*
 * Periksa token. Berhasil → klaim (email, name, ...). Gagal → fail() dengan pesan.
 * Wajib: tanda tangan sah, dari Google, untuk Client ID kita, belum kedaluwarsa,
 * email terverifikasi, dan akun milik domain sekolah (klaim "hd").
 */
function verify_google_token($jwt, string $clientId, string $domain): array {
    if (!function_exists('openssl_verify')) fail(500, 'Ekstensi OpenSSL tidak aktif di hosting ini.');
    $bad = function () { fail(401, 'Login Google tidak sah. Coba masuk lagi.'); };
    if (!is_string($jwt) || strlen($jwt) > 4096 || substr_count($jwt, '.') !== 2) $bad();
    [$h64, $p64, $s64] = explode('.', $jwt);
    $head = json_decode((string)b64url_decode($h64), true);
    $claims = json_decode((string)b64url_decode($p64), true);
    $sig = b64url_decode($s64);
    if (!is_array($head) || !is_array($claims) || $sig === false || ($head['alg'] ?? '') !== 'RS256' || empty($head['kid'])) $bad();

    $keys = google_keys();
    if (!isset($keys[$head['kid']])) $keys = google_keys(true); // Google baru saja mengganti kunci
    if (!isset($keys[$head['kid']])) $bad();
    [$n, $e] = $keys[$head['kid']];
    if (openssl_verify("$h64.$p64", $sig, jwk_pem($n, $e), OPENSSL_ALGO_SHA256) !== 1) $bad();

    $now = time();
    if (!in_array($claims['iss'] ?? '', GOOGLE_ISS, true) || ($claims['aud'] ?? '') !== $clientId) $bad();
    if (($claims['exp'] ?? 0) < $now - 60 || ($claims['iat'] ?? 0) > $now + 300) fail(401, 'Login Google sudah kedaluwarsa. Coba masuk lagi.');
    $email = strtolower((string)($claims['email'] ?? ''));
    if (empty($claims['email_verified']) || ($claims['hd'] ?? '') !== $domain || substr($email, -strlen('@' . $domain)) !== '@' . $domain) {
        fail(403, "Gunakan akun @$domain untuk membuka undangan ini.");
    }
    $claims['email'] = $email;
    return $claims;
}
