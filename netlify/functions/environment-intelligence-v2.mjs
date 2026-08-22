import { handler as baseHandler } from "./environment-intelligence.mjs";

const PROJECT = { lat: 8.604726, lon: 98.721682 };
const AIR_MODEL_URL =
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${PROJECT.lat}&longitude=${PROJECT.lon}` +
  "&current=us_aqi,pm2_5,pm10&timezone=Asia%2FBangkok";

function finiteOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasAirValue(air) {
  return [air?.aqi, air?.pm25, air?.pm10].some((value) => typeof value === "number" && Number.isFinite(value));
}

async function fetchModelAir() {
  const response = await fetch(AIR_MODEL_URL, {
    headers: {
      accept: "application/json",
      "user-agent": "BangTaoMae-DigitalTwin-V2/1.0",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`air model ${response.status}`);
  const payload = await response.json();
  const current = payload?.current || {};
  const air = {
    source: "Open-Meteo Air Quality",
    sourceType: "model",
    stationId: null,
    stationName: "แบบจำลอง ณ พิกัดโครงการ",
    distanceKm: 0,
    pm25: finiteOrNull(current.pm2_5),
    pm10: finiteOrNull(current.pm10),
    aqi: finiteOrNull(current.us_aqi),
    updatedAt: current.time || null,
  };
  return hasAirValue(air) ? air : null;
}

function upsertSource(sources, nextSource) {
  const list = Array.isArray(sources) ? [...sources] : [];
  const index = list.findIndex((source) => source.id === nextSource.id);
  if (index >= 0) list[index] = nextSource;
  else list.push(nextSource);
  return list;
}

export const handler = async (event, context) => {
  const baseResponse = await baseHandler(event, context);
  let payload;

  try {
    payload = JSON.parse(baseResponse.body || "{}");
  } catch {
    return baseResponse;
  }

  let modelStatus = "unavailable";
  if (!hasAirValue(payload.air)) {
    try {
      const modelAir = await fetchModelAir();
      if (modelAir) {
        payload.air = modelAir;
        modelStatus = "online";
      }
    } catch {
      modelStatus = "unavailable";
    }
  } else if (payload.air?.sourceType === "model") {
    modelStatus = "online";
  }

  payload.sources = upsertSource(payload.sources, {
    id: "open-meteo-air",
    label: "AQI / PM2.5 แบบจำลองสำรอง",
    agency: "Open-Meteo Air Quality",
    type: "model",
    status: modelStatus,
    url: AIR_MODEL_URL,
  });

  return {
    ...baseResponse,
    headers: {
      ...(baseResponse.headers || {}),
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  };
};
