const DOH_ORIGIN = "https://streaming2.highwaytraffic.go.th";
const CAMERA_BASE_PATH = "/Phase14/PER_14_007.stream/";
const DEFAULT_MASTER = `${DOH_ORIGIN}${CAMERA_BASE_PATH}playlist.m3u8`;
const FALLBACK_PLAYLISTS = [
  `${DOH_ORIGIN}${CAMERA_BASE_PATH}chunklist_w2015986280.m3u8`,
  `${DOH_ORIGIN}${CAMERA_BASE_PATH}chunklist_w1474254560.m3u8`,
  `${DOH_ORIGIN}${CAMERA_BASE_PATH}chunklist_w1698665729.m3u8`,
  `${DOH_ORIGIN}${CAMERA_BASE_PATH}chunklist_w438386858.m3u8`,
];

const entryCandidates = () => [
  process.env.DOH_CCTV_HLS_URL,
  DEFAULT_MASTER,
  ...FALLBACK_PLAYLISTS,
].filter(Boolean);

function allowedUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === DOH_ORIGIN && url.pathname.startsWith(CAMERA_BASE_PATH);
  } catch {
    return false;
  }
}

function proxyUrl(value) {
  return `/.netlify/functions/doh-hls-proxy?url=${encodeURIComponent(value)}`;
}

function rewriteUriAttributes(line, upstreamUrl) {
  return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
    const absolute = new URL(uri, upstreamUrl).toString();
    return allowedUrl(absolute) ? `URI="${proxyUrl(absolute)}"` : `URI="${uri}"`;
  });
}

function rewritePlaylist(text, upstreamUrl) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) return rewriteUriAttributes(line, upstreamUrl);
      const absolute = new URL(trimmed, upstreamUrl).toString();
      return allowedUrl(absolute) ? proxyUrl(absolute) : line;
    })
    .join("\n");
}

async function fetchDoh(url, range) {
  return fetch(url, {
    redirect: "follow",
    headers: {
      accept: "*/*",
      referer: "https://www.highwaytraffic.go.th/",
      "user-agent": "Mozilla/5.0 (compatible; BangTaoMae-DigitalTwin/1.0; HLS-proxy)",
      ...(range ? { range } : {}),
    },
    signal: AbortSignal.timeout(12_000),
  });
}

async function resolveEntry() {
  const attempts = [];
  for (const candidate of entryCandidates()) {
    if (!allowedUrl(candidate)) continue;
    try {
      const response = await fetchDoh(candidate);
      const contentType = response.headers.get("content-type") || "";
      const text = response.ok ? await response.text() : "";
      const valid = response.ok && text.includes("#EXTM3U");
      attempts.push({ url: candidate, status: response.status, contentType, valid });
      if (valid) return { url: candidate, response, text, attempts };
    } catch (error) {
      attempts.push({ url: candidate, status: 0, contentType: "", valid: false, error: error instanceof Error ? error.message : "fetch failed" });
    }
  }
  return { url: null, response: null, text: null, attempts };
}

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "Range,Content-Type",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: { ...corsHeaders, "content-type": "text/plain; charset=utf-8" }, body: "Method not allowed" };
  }

  if (event.queryStringParameters?.probe === "1") {
    const result = await resolveEntry();
    return {
      statusCode: result.url ? 200 : 503,
      headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      body: JSON.stringify({
        camera: "PER-14-007",
        selectedUrl: result.url,
        stableMaster: DEFAULT_MASTER,
        stableMasterSelected: result.url === DEFAULT_MASTER,
        attempts: result.attempts,
      }),
    };
  }

  let target = event.queryStringParameters?.url || "";
  let prefetched = null;
  let prefetchedText = null;

  if (!target) {
    const entry = await resolveEntry();
    if (!entry.url || !entry.response) {
      return {
        statusCode: 503,
        headers: { ...corsHeaders, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        body: "CCTV temporarily unavailable",
      };
    }
    target = entry.url;
    prefetched = entry.response;
    prefetchedText = entry.text;
  }

  if (!allowedUrl(target)) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      body: "Invalid HLS target",
    };
  }

  try {
    const response = prefetched || await fetchDoh(target, event.headers?.range);
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { ...corsHeaders, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        body: "CCTV temporarily unavailable",
      };
    }

    const contentType = response.headers.get("content-type") || "";
    const isPlaylist = target.toLowerCase().includes(".m3u8") || contentType.includes("mpegurl");

    if (isPlaylist) {
      const text = prefetchedText ?? await response.text();
      if (!text.includes("#EXTM3U")) throw new Error("Invalid HLS playlist");
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
          "cache-control": "no-store, max-age=0",
        },
        body: rewritePlaylist(text, response.url || target),
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const headers = {
      ...corsHeaders,
      "content-type": contentType || (target.toLowerCase().endsWith(".ts") ? "video/mp2t" : "application/octet-stream"),
      "cache-control": "public, max-age=10, s-maxage=10",
    };
    const contentRange = response.headers.get("content-range");
    const acceptRanges = response.headers.get("accept-ranges");
    if (contentRange) headers["content-range"] = contentRange;
    if (acceptRanges) headers["accept-ranges"] = acceptRanges;

    return {
      statusCode: response.status,
      headers,
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch {
    return {
      statusCode: 502,
      headers: { ...corsHeaders, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      body: "CCTV temporarily unavailable",
    };
  }
};
