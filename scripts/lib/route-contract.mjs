import { validateHtmlBytes } from './html-document.mjs';

export const ROUTE_ENTRY_PATH = '/index.html';
export const UNKNOWN_ROUTE_PATH = '/__harness50_unknown_route__';
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

export function validateRouteManifest(value) {
  if (!exactKeys(value, ['schema_version', 'mode', 'fallback', 'routes']) || value.schema_version !== 1 ||
    !['hash', 'history'].includes(value.mode) || typeof value.fallback !== 'string' || !ID.test(value.fallback) ||
    !Array.isArray(value.routes) || value.routes.length < 1 || value.routes.length > 50) throw new Error('Invalid routing manifest shape');
  const ids = new Set(), paths = new Set();
  const routes = value.routes.map(route => {
    const path = route?.path;
    if (!exactKeys(route, ['id', 'path']) || typeof route.id !== 'string' || !ID.test(route.id) || typeof path !== 'string' || path.length > 256 ||
      !(path === '/' || /^\/(?:[A-Za-z0-9_-][A-Za-z0-9_.~-]*)(?:\/[A-Za-z0-9_-][A-Za-z0-9_.~-]*)*$/.test(path)) ||
      [ROUTE_ENTRY_PATH, UNKNOWN_ROUTE_PATH].includes(path) || ids.has(route.id) || paths.has(path)) throw new Error('Invalid, unsafe or duplicate routing manifest route');
    ids.add(route.id); paths.add(path);
    return { id: route.id, path };
  });
  if (!ids.has(value.fallback)) throw new Error('Routing manifest fallback must name a declared screen');
  return { schema_version: 1, mode: value.mode, fallback: value.fallback, routes };
}

function parseManifestJson(source) {
  if (Buffer.byteLength(source) > 32 * 1024) throw new Error('Routing manifest exceeds 32 KiB');
  let value;
  try { value = JSON.parse(source); } catch { throw new Error('Routing manifest must be valid JSON'); }
  const stack = [];
  for (const match of source.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\]]/g)) {
    const token = match[0];
    if (token === '{' || token === '[') {
      if (stack.length >= 16) throw new Error('Routing manifest nesting exceeds its limit');
      stack.push(token === '{' ? new Set() : null);
    } else if (token === '}' || token === ']') stack.pop();
    else if (/^\s*:/.test(source.slice(match.index + token.length))) {
      const keys = stack.at(-1), key = JSON.parse(token);
      if (keys?.has(key)) throw new Error('Routing manifest contains duplicate JSON keys');
      keys?.add(key);
    }
  }
  return validateRouteManifest(value);
}

function attributes(tag) {
  const source = tag.replace(/^<[A-Za-z][A-Za-z0-9:-]*/, '').replace(/\/?\s*>$/, '');
  const values = new Map();
  let offset = 0;
  while (offset < source.length) {
    const match = /^\s+([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/.exec(source.slice(offset));
    if (!match) { if (source.slice(offset).trim() === '') break; throw new Error('Ambiguous manifest HTML attributes'); }
    const name = match[1].toLowerCase();
    if (values.has(name)) throw new Error('Duplicate attributes in manifest HTML');
    values.set(name, { value: match[2] ?? match[3] ?? match[4] ?? '', quoted: match[2] !== undefined || match[3] !== undefined });
    offset += match[0].length;
  }
  return values;
}

// This is deliberately a conservative contract, not an HTML5 parser. Require
// the JSON script directly in an explicit ordinary head, without inert/foreign
// wrappers. Commented and raw-text lookalikes are never manifest elements.
export function readRouteManifestBytes(bytes) {
  const html = validateHtmlBytes(bytes);
  let offset = 0, htmlSeen = false, headSeen = false, inHead = false, headClosed = false, manifest;
  while (offset < html.length) {
    const start = html.indexOf('<', offset);
    if (start < 0) break;
    if ((!headSeen || inHead) && html.slice(offset, start).trim()) throw new Error('Unexpected text around routing manifest head');
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      const comment = html.slice(start + 4, end < 0 ? undefined : end);
      if (end < 0 || comment.includes('<!--') || comment.includes('--!>')) throw new Error('Ambiguous comment around routing manifest');
      offset = end + 3; continue;
    }
    const match = /^<\/?[A-Za-z][A-Za-z0-9:-]*(?:[^"'<>]|"[^"]*"|'[^']*')*>/.exec(html.slice(start));
    if (!match) {
      const doctype = /^<!doctype\s+html\s*>/i.exec(html.slice(start));
      if (!htmlSeen && doctype) { offset = start + doctype[0].length; continue; }
      if (!headClosed) throw new Error('Ambiguous markup around routing manifest');
      offset = start + 1; continue;
    }
    const tag = match[0], name = /^<\/?([A-Za-z][A-Za-z0-9:-]*)/.exec(tag)[1].toLowerCase();
    const closing = tag.startsWith('</');
    offset = start + tag.length;
    if (name === 'html' && !closing && !htmlSeen && !headSeen) { htmlSeen = true; continue; }
    if (name === 'head') {
      if (!closing && htmlSeen && !headSeen) { headSeen = true; inHead = true; continue; }
      if (closing && inHead) { inHead = false; headClosed = true; continue; }
      throw new Error('Routing manifest requires one explicit head');
    }
    if (!headSeen || (inHead && (closing || !['base', 'link', 'meta', 'title', 'style', 'script'].includes(name)))) throw new Error('Routing manifest must be a direct head script');
    if (closing) continue;
    const attrs = attributes(tag), id = attrs.get('id');
    if (id?.value.includes('&')) throw new Error('HTML IDs must be literal around the routing manifest');
    const isManifest = id?.value === 'harness50-routes';
    if (isManifest && (!inHead || name !== 'script' || manifest || !id.quoted || attrs.get('type')?.value !== 'application/json' || !attrs.get('type')?.quoted || attrs.has('src'))) throw new Error('Routing manifest must be one inline application/json script directly in head');
    if (['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'plaintext'].includes(name)) {
      const rest = html.slice(offset), end = new RegExp(`</${name}\\s*>`, 'i').exec(rest);
      if (!end) throw new Error('Unclosed raw-text element around routing manifest');
      const source = rest.slice(0, end.index);
      // Reject script escaped states rather than misinterpret a later head.
      if (name === 'script' && /<!--|<script\b/i.test(source)) throw new Error('Ambiguous raw script around routing manifest');
      if (isManifest) manifest = parseManifestJson(source);
      offset += end.index + end[0].length;
    }
  }
  if (!headClosed || !manifest) throw new Error('Missing routing manifest script in explicit head');
  return manifest;
}
