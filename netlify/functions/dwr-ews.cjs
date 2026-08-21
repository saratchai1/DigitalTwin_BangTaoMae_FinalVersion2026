const PROJECT = { latitude: 8.604726, longitude: 98.721682 };
const PRIMARY_STATION = "STN2113";
const AREA_RADIUS_KM = 50;

const URLS = {
  stationJson: "https://ews.dwr.go.th/ews/web-service/stn",
  rainDaily: "https://ews.dwr.go.th/ews/rain_daily.php",
  public: "https://ews.dwr.go.th/ews/",
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
    type: station.stn_type ?? null,
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

async function fetchStationJson() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(URLS.stationJson, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BangTaoMae-DigitalTwin/2.0)",
        Accept: "application/json,text/plain,*/*",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: new URLSearchParams({ action: "LoadStation" }),
      signal: controller.signal,
    });
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
      rainStation: selected,
      area: {
        status: areaStatus,
        stationCount: areaStations.length,
        statusStation: areaStatusStation,
        warnings: areaStations.filter((station) => station.status > 0).sort((a, b) => b.status - a.status || (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999)).slice(0, 8),
      },
      provinceActiveStations: provinceStations.filter((station) => station.status > 0).length,
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseRainDailyRow(html) {
  const rowMatch = [...String(html).matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .find((row) => row.includes(PRIMARY_STATION));
  if (!rowMatch) throw new Error(`${PRIMARY_STATION} not found in rain_daily.php`);

  const cells = [...rowMatch.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => stripHtml(match[1]));
  const idIndex = cells.findIndex((cell) => cell === PRIMARY_STATION);
  if (idIndex < 0) throw new Error(`${PRIMARY_STATION} row could not be parsed`);
  const data = idIndex > 0 ? cells.slice(idIndex - 1) : cells;

  const station = {
    id: data[1] || PRIMARY_STATION,
    name: data[2] || "บ้านคลองยา",
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

  const pageText = stripHtml(html);
  const observed = pageText.match(/ข้อมูล(?:ปริมาณน้ำฝน[^\d]*)?.*?วันที่\s+(.+?)\s+ข้อมูล\s*ณ\.?\s*เวลา\s*7:00/i);
  station.observedAt = observed?.[1]?.trim() || null;
  return station;
}

async function fetchRainDailyFallback() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(URLS.rainDaily, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BangTaoMae-DigitalTwin/2.0)",
        Accept: "text/html,*/*",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`rain_daily.php HTTP ${response.status}`);
    const html = await response.text();
    const station = parseRainDailyRow(html);
    return {
      mode: "rain-daily-fallback",
      rainStation: station,
      area: { status: null, stationCount: null, statusStation: station, warnings: [] },
      provinceActiveStations: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async function handler() {
  const fetchedAt = new Date().toISOString();
  let primaryError = null;
  try {
    let data;
    try {
      data = await fetchStationJson();
    } catch (error) {
      primaryError = error instanceof Error ? error.message : String(error);
      data = await fetchRainDailyFallback();
    }

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
        project: PROJECT,
        radiusKm: AREA_RADIUS_KM,
        fetchedAt,
        primaryError,
        ...data,
      }),
    };
  } catch (error) {
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
        error: error instanceof Error ? error.message : "Unable to load DWR EWS data",
        primaryError,
      }),
    };
  }
};