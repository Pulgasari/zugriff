// zugriff :: middleware.js (vercel routing middleware, runs at the edge)
//
// the gestalt of an app (palette, density, geometry) goes into the html before
// it leaves the edge, from the cookie .shared/js/app.js writes for the app's
// path. boot.js sets the same from localStorage before the first paint, so this
// decides nothing on its own: it only moves the first paint earlier, and where
// no server sits in between (capacitor, a file) everything works as before.
//
// no imports, web apis only. anything unexpected passes the page on untouched.

const COOKIE   = 'zugriff-gestalt';
const TOKENS   = ['density', 'geometry', 'palette'];
const LAUNCHER = new Set(['apps', 'tools']);

// a preset name or a css color, nothing that could leave the attribute or the declaration
const SAFE = /^[\w#%.,()\s-]{1,64}$/;

function cookieOf (header, name) {
  for (const part of String(header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      try   { return decodeURIComponent(rest.join('=')); }
      catch { return null; }
    }
  }
  return null;
}

// token -> value, only the known tokens with safe values
function gestaltOf (request) {
  const raw = cookieOf(request.headers.get('cookie'), COOKIE);
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const found  = TOKENS
    .map(token => [token, params.get(token)?.trim()])
    .filter(([, value]) => value && SAFE.test(value));

  return found.length ? Object.fromEntries(found) : null;
}

export default async function middleware (request) {
  const slug = new URL(request.url).pathname.split('/')[1];
  if (!slug || LAUNCHER.has(slug)) return;

  const gestalt = gestaltOf(request);
  if (!gestalt) return;   // nothing known, the page goes out as it is

  const response = await fetch(request);
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('text/html')) return response;

  const entries = Object.entries(gestalt);
  const data    = entries.map(([token, value]) => `data-${token}="${value}"`).join(' ');
  const style   = entries.map(([token, value]) => `--${token}: ${value}`).join('; ');
  const html    = (await response.text()).replace(/<html\b/i, `<html data-app="${slug}" ${data} style="${style}"`);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'private, no-cache');   // the page now depends on the cookie
  headers.set('vary', 'cookie');

  return new Response(html, { headers, status: response.status, statusText: response.statusText });
}

// the app pages only: /<slug>/, not the launcher, files or the shared folders
export const config = {
  matcher: ['/:slug([a-z0-9-]+)/'],
};
