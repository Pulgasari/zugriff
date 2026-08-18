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
