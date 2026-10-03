const REDOC_BUNDLE = 'https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PAGE_STYLE = 'body{margin:0;padding:0}';

/**
 * Served by the API: Redoc loads the spec from `specUrl`. No inline script, so the page only
 * needs the Redoc CDN allowed in the Content-Security-Policy (see `DOCS_CSP`).
 */
export function redocPage(title: string, specUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${PAGE_STYLE}</style>
  </head>
  <body>
    <redoc spec-url="${escapeHtml(specUrl)}"></redoc>
    <script src="${REDOC_BUNDLE}"></script>
  </body>
</html>
`;
}

/** A standalone file: the spec is embedded, so it can be opened (or shared) without the API. */
export function redocStandalonePage(title: string, spec: object): string {
  // "<" is escaped so the JSON can never close the script tag.
  const json = JSON.stringify(spec).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${PAGE_STYLE}</style>
  </head>
  <body>
    <div id="docs"></div>
    <script src="${REDOC_BUNDLE}"></script>
    <script>Redoc.init(${json}, {}, document.getElementById('docs'));</script>
  </body>
</html>
`;
}

/** Content-Security-Policy for the docs page: helmet's default blocks the Redoc CDN. */
export const DOCS_CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdn.redoc.ly blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: https://cdn.redoc.ly",
  "connect-src 'self'",
  'worker-src blob:',
].join('; ');
