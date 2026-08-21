const PROJECT = { latitude: 8.604726, longitude: 98.721682 };
const PRIMARY_STATION = "STN2113";
const AREA_RADIUS_KM = 50;
const MAX_OBSERVATION_AGE_HOURS = 48;

const URLS = {
  stationJson: "https://ews.dwr.go.th/ews/web-service/stn",
  rainDaily: "https://ews.dwr.go.th/ews/rain_daily.php",
  public: "https://ews.dwr.go.th/ews/",
  // Relay is transport only. The underlying source remains the public DWR EWS page.
  rainDailyRelay: "https://r.jina.ai/http://ews.dwr.go.th/ews/rain_daily.php",
};

function toNumber(value) {
  if (value === null || value === undefined || value === "" || /^(?:N\/?A|-{1,3})$/i.test(String(value).trim())) return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStation(station) {
  const latitude = toNumber(station.latitude ?? station.lat);
  const longitude = toNumber(station.longitude ?? station.lon ?? station.lng);
  const parsedStatus = Number.parseInt(station.status ?? "0", 10);
  const status = Number.isFinite(parsedStatus) ? Math.max(0, Math.min(3, parsedStatus)) : 0;

  return {
    id: station.stn ?? station.id ?? station.station_id ?? "",
    name: station.name ?? station.village ?? station.station_name ?? "สถานี DWR EWS",
    tambon: station.tambon ?? station.subdistrict ?? "",
    amphoe: station.amphoe ?? station.district ?? "",
    province: station.province ?? "",
    basin: station.main_basin ?? "",
    latitude,
    longitude,
    distanceKm: latitude !== null && longitude !== null
      ? distanceKm(PROJECT.latitude, PROJECT.longitude, latitude, longitude)
      : null,
    status,
    warn: station.warn ?? null,
    warningType: station.warning_type ?? null,
    rain15m: toNumber(station.rain),
    rain12h: toNumber(station.rain12h),
    rainSince07: toNumber(station.rain07h ?? station.rain24h),
    temperature: toNumber(station.temp),
    waterLevel: toNumber(station.wl),
    soilMoisture: toNumber(station.soil),
    observedAt: station.date ?? station.datetime ?? station.updated_at ?? null,
  };
}

function hasMeasurement(station) {
  return station.rain15m !== null || station.rain12h !== null || station.rainSince07 !== null || station.waterLevel !== null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchStationJson() {
  const response = await fetchWithTimeout(URLS.stationJson, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BangTaoMae-DigitalTwin/2.1)",
      Accept: "application/json,text/plain,*/*",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Referer: URLS.public,
    },
    body: new URLSearchParams({ action: "LoadStation" }),
  }, 12000);

  if (!response.ok) throw new Error(`station endpoint HTTP ${response.status}`);
  const text = await response.text();
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("station endpoint returned non-JSON content");
  }

  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.station) ? raw.station : [];
  const stations = list.map(normalizeStation).filter((station) => station.id);
  if (!stations.length) throw new Error("station endpoint returned no stations");

  const primary = stations.find((station) => station.id === PRIMARY_STATION);
  const geocoded = stations.filter((station) => station.distanceKm !== null).sort((a, b) => a.distanceKm - b.distanceKm);
  const selected = primary ?? geocoded.find(hasMeasurement) ?? stations.find(hasMeasurement) ?? geocoded[0] ?? stations[0];
  const areaStations = geocoded.filter((station) => station.distanceKm <= AREA_RADIUS_KM);
  const areaPool = areaStations.length ? areaStations : selected ? [selected] : [];
  const areaStatus = areaPool.reduce((max, station) => Math.max(max, station.status || 0), 0);
  const areaStatusStation = areaPool
    .filter((station) => station.status === areaStatus)
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))[0] ?? selected;
  const provinceStations = stations.filter((station) => /กระบี่/.test(station.province));

  return {
    mode: "station-json",
    transport: "direct",
    rainStation: selected,
    area: {
      status: areaStatus,
      stationCount: areaStations.length,
      statusStation: areaStatusStation,
      warnings: areaStations.filter((station) => station.status > 0).sort((a, b) => b.status - a.status || (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999)).slice(0, 8),
    },
    provinceActiveStations: provinceStations.filter((station) => station.status > 0).length,
  };
}

function parseRainDailyRowFromHtml(html) {
  const rowMatch = [...String(html).matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .find((row) => row.includes(PRIMARY_STATION));
  if (!rowMatch) throw new Error(`${PRIMARY_STATION} not found in DWR rain_daily HTML`);

  const cells = [...rowMatch.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => stripHtml(match[1]));
  const idIndex = cells.findIndex((cell) => cell === PRIMARY_STATION);
  if (idIndex < 0) throw new Error(`${PRIMARY_STATION} row could not be parsed`);
  const data = idIndex > 0 ? cells.slice(idIndex - 1) : cells;
  return stationFromColumns(data);
}

function stationFromColumns(data) {
  return {
    id: data[1] || PRIMARY_STATION,
    name: String(data[2] || "บ้านคลองยา").replace(/\*+$/g, ""),
    tambon: data[3] || "คลองยา",
    amphoe: data[4] || "อ่าวลึก",
    province: data[5] || "กระบี่",
    latitude: null,
    longitude: null,
    distanceKm: null,
    status: null,
    warn: null,
    warningType: null,
    rain15m: toNumber(data[8]),
    rain12h: toNumber(data[9]),
    rainSince07: toNumber(data[10]),
    temperature: toNumber(data[11]),
    waterLevel: toNumber(data[12]),
    soilMoisture: toNumber(data[13]),
    observedAt: null,
  };
}

const THAI_MONTHS = {
  มกราคม: 0, กุมภาพันธ์: 1, มีนาคม: 2, เมษายน: 3, พฤษภาคม: 4, มิถุนายน: 5,
  กรกฎาคม: 6, สิงหาคม: 7, กันยายน: 8, ตุลาคม: 9, พฤศจิกายน: 10, ธันวาคม: 11,
};

function parseObservedDate(text) {
  const thai = String(text).match(/(?:วันที่\s*)?(\d{1,2})\s+(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)(?:\s+พ\.?ศ\.?\s*)?\s*(\d{4})/i);
  if (thai) {
    let year = Number(thai[3]);
    if (year > 2400) year -= 543;
    const date = new Date(Date.UTC(year, THAI_MONTHS[thai[2]], Number(thai[1]), 0, 0, 0));
    if (!Number.isNaN(date.getTime())) return date;
  }

  const iso = String(text).match(/(?:วันที่\s*)?(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    let year = Number(iso[1]);
    if (year > 2400) year -= 543;
    const date = new Date(Date.UTC(year, Number(iso[2]) - 1, Number(iso[3]), 0, 0, 0));
    if (!Number.isNaN(date.getTime())) return date;
  }

  const dmy = String(text).match(/(?:วันที่\s*)?(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year > 2400) year -= 543;
    const date = new Date(Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1]), 0, 0, 0));
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function validateFreshObservation(text) {
  const observedDate = parseObservedDate(text);
  if (!observedDate) return { observedDate: null, ageHours: null, fresh: true };
  // DWR's daily page is a 07:00-cycle product. Allow 48h to survive source-side update delays.
  const ageHours = (Date.now() - observedDate.getTime()) / 3_600_000;
  return { observedDate: observedDate.toISOString(), ageHours: Math.round(ageHours * 10) / 10, fresh: ageHours <= MAX_OBSERVATION_AGE_HOURS };
}

function parseRainDailyRowFromMarkdown(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const line = lines.find((candidate) => candidate.includes(PRIMARY_STATION));
  if (!line) throw new Error(`${PRIMARY_STATION} not found in relayed DWR page`);

  const parts = line
    .split("|")
    .map((value) => value.replace(/^\s*[-:]+\s*|\s*[-:]+\s*$/g, "").trim())
    .filter(Boolean);
  const idIndex = parts.findIndex((value) => value === PRIMARY_STATION);
  if (idIndex < 0) throw new Error(`${PRIMARY_STATION} relayed row could not be parsed`);
  const start = idIndex > 0 ? idIndex - 1 : idIndex;
  const data = parts.slice(start, start + 14);
  if (data.length < 11) throw new Error(`${PRIMARY_STATION} relayed row has insufficient columns`);
  return stationFromColumns(data);
}

async function fetchRainDailyDirect() {
  const response = await fetchWithTimeout(URLS.rainDaily, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BangTaoMae-DigitalTwin/2.1)",
      Accept: "text/html,*/*",
      Referer: URLS.public,
    },
  }, 18000);
  if (!response.ok) throw new Error(`rain_daily.php HTTP ${response.status}`);
  const html = await response.text();
  const station = parseRainDailyRowFromHtml(html);
  const freshness = validateFreshObservation(stripHtml(html));
  if (!freshness.fresh) throw new Error(`DWR direct page is stale (${freshness.ageHours}h)`);
  station.observedAt = freshness.observedDate;
  return {
    mode: "rain-daily-fallback",
    transport: "direct",
    freshness,
    rainStation: station,
    area: { status: null, stationCount: null, statusStation: station, warnings: [] },
    provinceActiveStations: null,
  };
}

async function fetchRainDailyRelay() {
  const response = await fetchWithTimeout(`${URLS.rainDailyRelay}?_btm=${Date.now()}`, {
    headers: {
      "User-Agent": "BangTaoMae-DigitalTwin/2.1",
      Accept: "text/plain,text/markdown,*/*",
      "X-No-Cache": "true",
      "X-Return-Format": "markdown",
    },
  }, 20000);
  if (!response.ok) throw new Error(`DWR relay HTTP ${response.status}`);
  const markdown = await response.text();
  const station = parseRainDailyRowFromMarkdown(markdown);
  const freshness = validateFreshObservation(markdown);
  if (!freshness.fresh) throw new Error(`relayed DWR page is stale (${freshness.ageHours}h)`);
  station.observedAt = freshness.observedDate;
  return {
    mode: "reader-relay",
    transport: "relay",
    relay: "Jina Reader",
    freshness,
    rainStation: station,
    area: { status: null, stationCount: null, statusStation: station, warnings: [] },
    provinceActiveStations: null,
  };
}

exports.handler = async function handler() {
  const fetchedAt = new Date().toISOString();
  const attempts = [];

  const strategies = [
    ["station-json", fetchStationJson],
    ["rain-daily-direct", fetchRainDailyDirect],
    ["rain-daily-relay", fetchRainDailyRelay],
  ];

  for (const [name, strategy] of strategies) {
    try {
      const data = await strategy();
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          source: "DWR EWS · กรมทรัพยากรน้ำ",
          sourceUrl: URLS.public,
          measurementUrl: URLS.rainDaily,
          project: PROJECT,
          radiusKm: AREA_RADIUS_KM,
          fetchedAt,
          attempts,
          ...data,
        }),
      };
    } catch (error) {
      attempts.push({ strategy: name, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    statusCode: 502,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      source: "DWR EWS · กรมทรัพยากรน้ำ",
      sourceUrl: URLS.public,
      fetchedAt,
      error: "Unable to retrieve a fresh DWR EWS observation without authenticated DWR Web Service credentials",
      attempts,
    }),
  };
};