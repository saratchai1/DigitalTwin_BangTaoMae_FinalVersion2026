import { Agent, request } from "node:https";
import { rootCertificates } from "node:tls";
import { dohIntermediate } from "../lib/doh-certificate.mjs";

export const CAMERA = Object.freeze({ id: "PER-14-007", highway: "4", controlSection: "1101", kilometer: "956+105" });
const ORIGIN = "https://streaming2.highwaytraffic.go.th";
const BASE = "/PER-14/PER_14_007.stream/";
export const MASTER = `${ORIGIN}${BASE}playlist.m3u8`;
const PROXY = "/.netlify/functions/doh-hls-proxy";
// Supply the missing, independently verified intermediate; TLS verification stays enabled.
const agent = new Agent({ ca: [...rootCertificates, dohIntermediate], keepAlive: true, maxSockets: 8 });
const headers = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,OPTIONS", "access-control-allow-headers": "Range,Content-Type", "access-control-expose-headers": "Content-Range,Accept-Ranges", "cache-control": "no-store", "x-content-type-options": "nosniff" };

export function allowedUrl(value) {
  try {
    const u = new URL(value);
    return u.origin === ORIGIN && !u.username && !u.password && !u.hash && u.pathname.startsWith(BASE) && /^[a-zA-Z0-9_.-]+\.(m3u8|ts|m4s|mp4|key)$/.test(u.pathname.slice(BASE.length));
  } catch { return false; }
}

export function rewritePlaylist(text, upstream) {
  if (!text.trimStart().startsWith("#EXTM3U")) throw new Error("INVALID_PLAYLIST");
  const rewrite = value => {
    const absolute = new URL(value, upstream).href;
    if (!allowedUrl(absolute)) throw new Error("INVALID_PLAYLIST_TARGET");
    return `${PROXY}?url=${encodeURIComponent(absolute)}`;
  };
  return text.split(/\r?\n/).map(line => {
    if (!line.trim()) return line;
    if (line.startsWith("#")) return line.replace(/URI="([^"]+)"/g, (_, value) => `URI="${rewrite(value)}"`);
    return rewrite(line.trim());
  }).join("\n");
}

export function fetchDoh(url, range, redirects = 0) {
  if (!allowedUrl(url)) return Promise.reject(new Error("INVALID_TARGET"));
  return new Promise((resolve, reject) => {
    const req = request(url, { agent, method: "GET", headers: { accept: "*/*", ...(range ? { range } : {}) } }, response => {
      const status = response.statusCode || 502;
      if ([301,302,303,307,308].includes(status)) {
        response.resume();
        let next;
        try { next = new URL(response.headers.location || "", url).href; } catch { reject(new Error("INVALID_REDIRECT")); return; }
        if (redirects >= 2 || !allowedUrl(next)) { reject(new Error("INVALID_REDIRECT")); return; }
        resolve(fetchDoh(next, range, redirects + 1));
        return;
      }
      const chunks = []; let size = 0;
      response.on("data", chunk => {
        size += chunk.length;
        if (size > 3 * 1024 * 1024) { req.destroy(new Error("RESPONSE_TOO_LARGE")); return; }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolve({ status, headers: response.headers, body: Buffer.concat(chunks), url }));
    });
    const deadline = setTimeout(() => req.destroy(new Error("UPSTREAM_TIMEOUT")), 10_000);
    req.on("close", () => clearTimeout(deadline));
    req.on("error", reject);
    req.end();
  });
}

export const handler = async event => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers, body: "Method not allowed" };
  const query = event.queryStringParameters || {};
  // Restrict overrides to this camera. Stale /Phase14/ values cannot select a dead source.
  const configured = process.env.DOH_CCTV_HLS_URL;
  const target = query.url || (configured && allowedUrl(configured) ? configured : MASTER);
  const fail = (statusCode, code) => ({ statusCode, headers: { ...headers, "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ camera: CAMERA, available: false, code, message: "ไม่สามารถรับภาพจากกรมทางหลวงได้ในขณะนี้" }) });
  if (!allowedUrl(target)) return fail(400, "INVALID_TARGET");
  const range = event.headers?.range || event.headers?.Range;
  if (range && !/^bytes=\d*-\d*$/.test(range)) return fail(400, "INVALID_RANGE");
  try {
    const result = await fetchDoh(target, range);
    if (![200,206].includes(result.status)) return fail(503, `UPSTREAM_${result.status}`);
    if (new URL(target).pathname.endsWith(".m3u8")) {
      const rewritten = rewritePlaylist(result.body.toString("utf8"), result.url);
      if (query.probe === "1") return { statusCode: 200, headers: { ...headers, "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ camera: CAMERA, available: true, selectedUrl: result.url, checkedAt: new Date().toISOString(), tlsVerified: true, note: "Playlist reachable; LIVE is shown only after video playback starts." }) };
      return { statusCode: 200, headers: { ...headers, "content-type": "application/vnd.apple.mpegurl; charset=utf-8" }, body: rewritten };
    }
    const mediaHeaders = { ...headers, "content-type": result.headers["content-type"] || "video/mp2t", "cache-control": "public, max-age=10, s-maxage=10" };
    for (const name of ["content-range", "accept-ranges"]) if (result.headers[name]) mediaHeaders[name] = result.headers[name];
    return { statusCode: result.status, headers: mediaHeaders, body: result.body.toString("base64"), isBase64Encoded: true };
  } catch (error) {
    const code = error?.code || error?.message || "UPSTREAM_UNAVAILABLE";
    console.warn("DOH PER-14-007", code);
    return fail(502, code);
  }
};
