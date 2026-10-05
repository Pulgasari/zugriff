import { NextResponse } from 'next/server';

// Vercel Edge Middleware for zero-FOUC state injection with structured logging
export async function middleware(request) {
  const startTime = performance.now();
  const url = new URL(request.url);

  // 1. Filter: Only process HTML page requests
  const accept = request.headers.get('accept') || '';
  if (!accept.includes('text/html')) {
    return NextResponse.next();
  }

  // 2. Read cookies directly from HTTP request headers
  const themeCookie = request.cookies.get('theme')?.value;
  const compactCookie = request.cookies.get('compact')?.value;

  const theme = themeCookie || '#111827';
  const compact = compactCookie || 'false';

  // Log incoming request details
  console.log(`[Edge Middleware] Incoming HTML Request: ${url.pathname}${url.search}`);
  console.log(`[Edge Middleware] Extracted Cookies -> theme: "${themeCookie ?? 'NONE (fallback applied)'}", compact: "${compactCookie ?? 'NONE (fallback applied)'}"`);

  // 3. Fetch original static HTML from origin / storage
  const response = await fetch(request);
  
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    console.log(`[Edge Middleware] Bypassing modification (content-type: ${contentType})`);
    return response;
  }

  let html = await response.text();

  // 4. Inject attributes into root <html> tag in-flight
  const rootAttributes = `style="--theme: ${theme};" data-compact="${compact}"`;
  const htmlInjected = html.replace('<html', `<html ${rootAttributes}`);

  const wasInjected = html !== htmlInjected;
  const duration = (performance.now() - startTime).toFixed(2);

  // Log injection outcome and execution time
  if (wasInjected) {
    console.log(`[Edge Middleware] Successfully injected state into <html> in ${duration}ms`);
  } else {
    console.warn(`[Edge Middleware] Failed to inject state: <html...> tag not found (${duration}ms)`);
  }

  // 5. Construct response headers
  const newHeaders = new Headers(response.headers);
  newHeaders.set('content-type', 'text/html; charset=utf-8');
  
  // Expose execution timing to browser DevTools (Network Tab -> Timing)
  newHeaders.set('Server-Timing', `edge-fouc;desc="Edge State Injection";dur=${duration}`);
  newHeaders.set('X-Edge-FOUC-Injected', wasInjected ? 'true' : 'false');

  return new Response(htmlInjected, {
    status: response.status,
    headers: newHeaders,
  });
}

// Matcher configuration to bypass static assets
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)',
  ],
};
