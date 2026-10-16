const IQAIR_URL = "https://www.iqair.com/th/air-quality/thailand/krabi/krabi/krabi-international-school";

const DEMO = {
  mode: "demo",
  stationName: "Krabi International School",
  aqi: 61,
  pm25: 27.6,
  temperature: 28,
  windSpeed: 13,
  humidity: 79,
  updatedText: null,
  url: IQAIR_URL,
  source: "IQAir public page · DEMO fallback",
};

function decodeEntities(value = "") {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value = "") {
  return decodeEntities(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function finiteMatch(text, pattern) {
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseIqairPage(html) {
  const text = stripHtml(html);
  const anchors = [
    "คุณภาพอากาศใกล้ Krabi International School",
    "Air quality near Krabi International School",
    "Krabi International School",
  ];
  const positions = anchors.map((anchor) => text.indexOf(anchor)).filter((index) => index >= 0);
  const start = positions.length ? Math.min(...positions) : 0;
  const scoped = text.slice(start, start + 6000);

  const aqi = finiteMatch(scoped, /(\d{1,3})\s*US AQI(?:\+)?/i);
  const pm25 = finiteMatch(scoped, /PM2\.5\s*(\d+(?:\.\d+)?)\s*(?:µg\/m³|μg\/m³|ug\/m3)/i);
  const temperature = finiteMatch(scoped, /(\d+(?:\.\d+)?)\s*°/i);
  const windSpeed = finiteMatch(scoped, /(\d+(?:\.\d+)?)\s*km\/h/i);

  let humidity = null;
  const percentMatches = [...scoped.matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
  if (percentMatches.length) humidity = percentMatches[percentMatches.length - 1];

  const timeMatch = scoped.match(/(?:•|\s)(\d{1,2}:\d{2})\s*,?\s*(?:ส\.?ค\.?|Aug)[^\d]{0,6}(\d{1,2})/i);
  const updatedText = timeMatch ? `${timeMatch[1]} · ${timeMatch[2]} Aug` : null;

  if (aqi === null || pm25 === null) throw new Error("IQAir values not found in public page");

  return {
    mode: "live",
    stationName: "Krabi International School",
    aqi,
    pm25,
    temperature,
    windSpeed,
    humidity,
    updatedText,
    url: IQAIR_URL,
    source: "IQAir public page",
  };
}

export const handler = async () => {
  let payload = DEMO;
  let cache = "public, max-age=180, s-maxage=600, stale-while-revalidate=600";

  try {
    const response = await fetch(IQAIR_URL, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "th-TH,th;q=0.9,en;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; BangTaoMae-DigitalTwin/1.0; public-page-reader)",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`IQAir ${response.status}`);
    payload = parseIqairPage(await response.text());
  } catch {
    payload = DEMO;
    cache = "public, max-age=60, s-maxage=180";
  }

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache,
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(payload),
  };
};
