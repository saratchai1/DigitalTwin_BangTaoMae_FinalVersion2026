const PROJECT = { latitude: 8.604726, longitude: 98.721682 };
const EWS_URL = "https://ews.dwr.go.th/ews/web-service/stn";
const AREA_RADIUS_KM = 50;

function toNumber(value) {
  if (value === null || value === undefined || value === "" || value === "N/A") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
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

function normalizeStation(station) {
  const latitude = toNumber(station.latitude ?? station.lat);
  const longitude = toNumber(station.longitude ?? station.lon ?? station.lng);
  if (latitude === null || longitude === null) return null;

  const status = Math.max(0, Math.min(3, Number.parseInt(station.status ?? "0", 10) || 0));
  return {
    id: station.stn ?? station.id ?? "",
    name: station.name ?? station.village ?? "สถานี DWR EWS",
    type: station.stn_type ?? null,
    tambon: station.tambon ?? station.subdistrict ?? "",
    amphoe: station.amphoe ?? station.district ?? "",
    province: station.province ?? "",
    basin: station.main_basin ?? "",
    latitude,
    longitude,
    distanceKm: distanceKm(PROJECT.latitude, PROJECT.longitude, latitude, longitude),
    status,
    warn: station.warn ?? null,
    warningType: station.warning_type ?? null,
    rain15m: toNumber(station.rain),
    rain12h: toNumber(station.rain12h),
    rainSince07: toNumber(station.rain07h),
    temperature: toNumber(station.temp),
    waterLevel: toNumber(station.wl),
    soilMoisture: toNumber(station.soil),
    observedAt: station.date ?? null,
  };
}

function hasRain(station) {
  return station.rain15m !== null || station.rain12h !== null || station.rainSince07 !== null;
}

exports.handler = async function handler() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(EWS_URL, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BangTaoMae-DigitalTwin/1.0)",
        Accept: "application/json,text/plain,*/*",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: new URLSearchParams({ action: "LoadStation" }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`DWR EWS returned HTTP ${response.status}`);

    const rawText = await response.text();
    let raw;
    try {
      raw = JSON.parse(rawText);
    } catch {
      throw new Error("DWR EWS returned a non-JSON response");
    }

    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.station) ? raw.station : [];
    const stations = list.map(normalizeStation).filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm);
    if (!stations.length) throw new Error("No geocoded DWR EWS stations were returned");

    const rainStation = stations.find(hasRain) ?? stations[0];
    const areaStations = stations.filter((station) => station.distanceKm <= AREA_RADIUS_KM);
    const statusPool = areaStations.length ? areaStations : stations.slice(0, 1);
    const areaStatus = statusPool.reduce((max, station) => Math.max(max, station.status), 0);
    const areaStatusStation = statusPool.filter((station) => station.status === areaStatus).sort((a, b) => a.distanceKm - b.distanceKm)[0];

    const responseBody = {
      source: "DWR EWS",
      sourceUrl: "https://ews.dwr.go.th/ews/",
      project: PROJECT,
      radiusKm: AREA_RADIUS_KM,
      fetchedAt: new Date().toISOString(),
      rainStation,
      area: {
        status: areaStatus,
        stationCount: areaStations.length,
        statusStation: areaStatusStation,
        warnings: areaStations.filter((station) => station.status > 0).sort((a, b) => b.status - a.status || a.distanceKm - b.distanceKm).slice(0, 8),
      },
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      },
      body: JSON.stringify(responseBody),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      body: JSON.stringify({
        source: "DWR EWS",
        error: error instanceof Error ? error.message : "Unable to load DWR EWS data",
        fetchedAt: new Date().toISOString(),
      }),
    };
  } finally {
    clearTimeout(timeout);
  }
};
