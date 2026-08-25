<?php
// img.pulgasari.dev — a self-hosted image thumbnail proxy/resizer.
//
// zugriff runs as static files on GitHub Pages, so it can't resize a podcast
// cover that a foreign host serves without CORS. this tiny endpoint does it
// server-side instead: it fetches the original (server-to-server, so no browser
// CORS is involved), downscales it with GD and returns a small webp. the app
// then loads a few KB instead of a multi-MB original, from your own domain.
//
// deploy: point the img.pulgasari.dev subdomain (all-inkl) at this folder; PHP
// with the GD extension (imagewebp) is all it needs. drop this file in as the
// document root's index.php.
//
//   GET /?url=<source-image-url>&w=<width>
//     url  required, the http(s) image to shrink
//     w    optional, target width in px (default 400, clamped 48–1024)
//
// SECURITY: an image proxy is an SSRF / open-relay risk if left wide open. the
// checks below reject non-public targets and (optionally) foreign embedders.
// review REFERER_ALLOW for your own origins before deploying.

declare(strict_types=1);

// ── config ───────────────────────────────────────────────────────────────────
const DEFAULT_W = 400;
const MIN_W     = 48;
const MAX_W     = 1024;
const MAX_BYTES = 20 * 1024 * 1024;      // refuse originals larger than this
const TIMEOUT   = 8;                      // seconds for the upstream fetch
const MAX_REDIR = 3;
const WEBP_Q    = 82;
const CACHE_DIR = __DIR__ . '/cache';     // writable dir for resized results
const CACHE_TTL = 60 * 60 * 24 * 30;      // 30 days

// hosts allowed to embed this endpoint (Referer host). empty = allow any.
// a missing Referer (stripped by referrer-policy) is always allowed, since
// <img> requests often send none.
const REFERER_ALLOW = ['zugriff.dev', 'code.pulgasari.dev', 'pulgasari.github.io', 'localhost', '127.0.0.1'];

// ── helpers ──────────────────────────────────────────────────────────────────
function fail(int $code, string $msg): void {
  http_response_code($code);
  header('Content-Type: text/plain; charset=utf-8');
  header('Access-Control-Allow-Origin: *');
  echo $msg;
  exit;
}

function referer_ok(): bool {
  if (!REFERER_ALLOW) return true;
  $ref = $_SERVER['HTTP_REFERER'] ?? '';
  if ($ref === '') return true;
  $host = parse_url($ref, PHP_URL_HOST) ?: '';
  foreach (REFERER_ALLOW as $ok) {
    if ($host === $ok || str_ends_with($host, '.' . $ok)) return true;
  }
  return false;
}

// true only if every address the host resolves to is a public, routable IP —
// blocks localhost, LAN and cloud-metadata targets (SSRF).
function host_is_public(string $host): bool {
  if (filter_var($host, FILTER_VALIDATE_IP)) {
    $ips = [$host];
  } else {
    $ips  = [];
    $recs = @dns_get_record($host, DNS_A | DNS_AAAA) ?: [];
    foreach ($recs as $r) {
      if (!empty($r['ip']))   $ips[] = $r['ip'];
      if (!empty($r['ipv6'])) $ips[] = $r['ipv6'];
    }
    if (!$ips) { $ip = gethostbyname($host); if ($ip && $ip !== $host) $ips[] = $ip; }
  }
  if (!$ips) return false;
  foreach ($ips as $ip) {
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
      return false;
    }
  }
  return true;
}

function fetch_image(string $url): string {
  $host = parse_url($url, PHP_URL_HOST);
  if (!$host || !host_is_public($host)) fail(403, 'blocked target');

  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER  => true,
    CURLOPT_FOLLOWLOCATION  => true,
    CURLOPT_MAXREDIRS       => MAX_REDIR,
    CURLOPT_CONNECTTIMEOUT  => TIMEOUT,
    CURLOPT_TIMEOUT         => TIMEOUT,
    CURLOPT_PROTOCOLS       => CURLPROTO_HTTP | CURLPROTO_HTTPS,
    CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
    CURLOPT_USERAGENT       => 'zugriff-img/1.0 (+https://code.pulgasari.dev/)',
    CURLOPT_ACCEPT_ENCODING => '',
    CURLOPT_NOPROGRESS      => false,
    CURLOPT_PROGRESSFUNCTION => function ($ch, $dltotal, $dlnow) {
      return ($dlnow > MAX_BYTES || $dltotal > MAX_BYTES) ? 1 : 0;   // non-zero aborts
    },
  ]);
  $body = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $type = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
  $final = (string) curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
  curl_close($ch);

  if ($body === false || $code < 200 || $code >= 300) fail(502, 'upstream failed');
  if (strlen($body) > MAX_BYTES)                       fail(413, 'too large');
  // re-check the host we actually landed on, in case of a redirect
  $fhost = parse_url($final, PHP_URL_HOST);
  if ($fhost && !host_is_public($fhost))               fail(403, 'blocked target');
  if ($type !== '' && !str_starts_with($type, 'image/')) fail(415, 'not an image');

  return $body;
}

function resize_webp(string $data, int $w): string {
  $src = @imagecreatefromstring($data);
  if (!$src) fail(415, 'undecodable image');

  $sw = imagesx($src);
  $sh = imagesy($src);
  $scale = min(1.0, $w / max(1, $sw));          // downscale only
  $dw = max(1, (int) round($sw * $scale));
  $dh = max(1, (int) round($sh * $scale));

  $dst = imagecreatetruecolor($dw, $dh);
  imagealphablending($dst, false);
  imagesavealpha($dst, true);
  imagecopyresampled($dst, $src, 0, 0, 0, 0, $dw, $dh, $sw, $sh);
  imagedestroy($src);

  ob_start();
  if (function_exists('imagewebp')) imagewebp($dst, null, WEBP_Q);
  else                              imagejpeg($dst, null, 85);   // fallback
  $out = ob_get_clean();
  imagedestroy($dst);
  return $out;
}

function serve(string $webp): void {
  header('Content-Type: ' . (function_exists('imagewebp') ? 'image/webp' : 'image/jpeg'));
  header('Content-Length: ' . strlen($webp));
  header('Cache-Control: public, max-age=' . CACHE_TTL . ', immutable');
  header('Access-Control-Allow-Origin: *');
  echo $webp;
  exit;
}

// ── request ──────────────────────────────────────────────────────────────────
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Methods: GET, OPTIONS');
  header('Access-Control-Max-Age: 86400');
  exit;
}

if (!referer_ok()) fail(403, 'forbidden');

$url = $_GET['url'] ?? '';
if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL)) fail(400, 'bad url');
$scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
if ($scheme !== 'http' && $scheme !== 'https') fail(400, 'bad scheme');

$w = (int) ($_GET['w'] ?? DEFAULT_W);
$w = max(MIN_W, min(MAX_W, $w ?: DEFAULT_W));

// ── disk cache ───────────────────────────────────────────────────────────────
$key  = sha1($url . '|' . $w);
$file = CACHE_DIR . '/' . substr($key, 0, 2) . '/' . $key . '.webp';
if (is_file($file) && (time() - filemtime($file)) < CACHE_TTL) {
  serve(file_get_contents($file));
}

// ── generate ─────────────────────────────────────────────────────────────────
$webp = resize_webp(fetch_image($url), $w);

@mkdir(dirname($file), 0775, true);
@file_put_contents($file, $webp, LOCK_EX);

serve($webp);

/*
# img-proxy

A tiny self-hosted image thumbnail proxy/resizer — the one server-side piece
zugriff uses, so the otherwise-static apps can shrink podcast/artwork images
without a third party.

## why

zugriff is static (GitHub Pages). A page there can't resize an image that a
foreign host serves without CORS headers — the browser won't let it read the
bytes. This endpoint sidesteps that: it fetches the original **server-to-server**
(no browser CORS involved), downscales it with PHP-GD and returns a small webp
from your own domain. The app then downloads a few KB instead of a multi-MB
original.

This is **not** served by GitHub Pages — the `.php` there would just be shown as
text. It runs on your own PHP host (all-inkl).

## deploy (all-inkl)

1. In KAS, create the subdomain **`img.pulgasari.dev`** and point its document
   root at a folder (e.g. `/img`).
2. Upload `index.php` into that folder. Make sure a writable `cache/` subfolder
   can be created next to it (the script does `mkdir` itself; if permissions
   block it, create `cache/` by hand and give it write access).
3. Requires **PHP 8** with the **GD** extension (`imagewebp`) and **cURL** —
   both are standard on all-inkl.
4. Test: open
   `https://img.pulgasari.dev/?url=https://…/some-cover.jpg&w=400`
   in the browser; you should get back a small webp.

## use

```
GET https://img.pulgasari.dev/?url=<source-image-url>&w=<width>
```

- `url` — the http(s) image to shrink (required)
- `w`   — target width in px (optional, default 400, clamped 48–1024)

Resized results are cached on disk for 30 days and sent with a long
`Cache-Control`, so repeat requests are cheap. `Access-Control-Allow-Origin: *`
is sent, so the app may also `fetch()` and cache the result for offline use.

## security

An image proxy is an SSRF / open-relay risk if left wide open. `index.php`
already:

- rejects any target that resolves to a private / reserved IP (localhost, LAN,
  cloud metadata),
- restricts to `http`/`https` and re-checks the host after redirects,
- caps the upstream download size and time,
- optionally restricts embedders via a **Referer allowlist** — edit
  `REFERER_ALLOW` at the top of `index.php` to your own origins.

Residual risk worth knowing: a *public* host that redirects to a private one is
only caught after the fact, and Referer can be spoofed by non-browser clients.
For a personal deployment this is fine; if you expose it widely, add an
allowlist of source hosts.
*/
