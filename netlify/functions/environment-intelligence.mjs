const PROJECT = {
  lat: 8.604726,
  lon: 98.721682,
  label: "โครงการบางเท่าแม่",
};

const URLS = {
  openMeteo:
    `https://api.open-meteo.com/v1/forecast?latitude=${PROJECT.lat}&longitude=${PROJECT.lon}` +
    "&current=temperature_2m,relative_humidity_2m,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m" +
    "&hourly=precipitation_probability,precipitation,rain,showers,temperature_2m,relative_humidity_2m,wind_speed_10m" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max" +
    "&timezone=Asia%2FBangkok&forecast_days=7",
  openMeteoAir:
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${PROJECT.lat}&longitude=${PROJECT.lon}` +
    "&current=us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone&timezone=Asia%2FBangkok",
  air4Thai: "https://air4thai.pcd.go.th/services/getNewAQI_JSON.php",
  tmdRegion: "https://www.tmd.go.th/api/xml/region-daily-forecast?regionid=6",
  tmdWarning: "https://www.tmd.go.th/api/xml/warning-news",
  tmdKrabi: "https://www.tmd.go.th/api/xml/weather-report?stationnumber=48563",
  dwrEws: "https://ews.dwr.go.th/ews/index.php?language=th",
};

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function sum(values, start, count) {
  return round(
    (values || [])
      .slice(start, start + count)
      .reduce((total, value) => total + (Number(value) || 0), 0),
    1,
  );
}

function max(values, start, count) {
  const numbers = (values || [])
    .slice(start, start + count)
    .map(Number)
    .filter(Number.isFinite);
  return numbers.length ? Math.max(...numbers) : null;
}

function decodeEntities(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value = "") {
  return decodeEntities(value)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlTag(block, tagName) {
  const match = block.match(
    new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"),
  );
  return stripHtml(match?.[1] || "");
}

function parseRss(xml = "") {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => {
    const block = match[0];
    return {
      title: xmlTag(block, "title"),
      summary: xmlTag(block, "description"),
      link: xmlTag(block, "link"),
      publishedAt: xmlTag(block, "pubDate") || xmlTag(block, "date"),
    };
  });
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "BangTaoMae-DigitalTwin/1.0" },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "BangTaoMae-DigitalTwin/1.0" },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function extractAir4Thai(payload) {
  const stations = Array.isArray(payload?.stations)
    ? payload.stations
    : Array.isArray(payload)
      ? payload
      : [];

  const candidates = stations
    .map((station) => {
      const lat = numberOrNull(station.lat ?? station.latitude);
      const lon = numberOrNull(station.long ?? station.lon ?? station.longitude);
      if (lat === null || lon === null) return null;
      return {
        station,
        distanceKm: haversineKm(PROJECT.lat, PROJECT.lon, lat, lon),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (!candidates.length) return null;
  const nearest = candidates[0];
  const station = nearest.station;
  const last = station.LastUpdate || station.lastUpdate || {};
  const pm25 = numberOrNull(last?.PM25?.value ?? last?.pm25?.value ?? last?.PM25);
  const pm10 = numberOrNull(last?.PM10?.value ?? last?.pm10?.value ?? last?.PM10);
  const aqi = numberOrNull(
    last?.AQI?.aqi ??
      last?.AQI?.value ??
      last?.PM25?.aqi ??
      station.AQI ??
      station.aqi,
  );

  return {
    source: "Air4Thai · กรมควบคุมมลพิษ",
    sourceType: "official",
    stationId: station.stationID || station.stationId || station.id || null,
    stationName:
      station.nameTH || station.name || station.areaTH || station.area || "สถานี Air4Thai ใกล้โครงการ",
    distanceKm: round(nearest.distanceKm, 1),
    pm25,
    pm10,
    aqi,
    updatedAt: last.date && last.time ? `${last.date} ${last.time}` : last.datetime || null,
  };
}

function extractOpenMeteoAir(payload) {
  const current = payload?.current || {};
  return {
    source: "Open-Meteo Air Quality",
    sourceType: "model",
    stationId: null,
    stationName: "แบบจำลอง ณ พิกัดโครงการ",
    distanceKm: 0,
    pm25: numberOrNull(current.pm2_5),
    pm10: numberOrNull(current.pm10),
    aqi: numberOrNull(current.us_aqi),
    updatedAt: current.time || null,
  };
}

function extractWeather(payload) {
  const current = payload?.current || {};
  const hourly = payload?.hourly || {};
  const daily = payload?.daily || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const currentTime = current.time || new Date().toISOString();
  let index = times.findIndex((time) => time >= currentTime);
  if (index < 0) index = 0;

  const dailyForecast = (daily.time || []).map((date, dayIndex) => ({
    date,
    weatherCode: numberOrNull(daily.weather_code?.[dayIndex]),
    maxTemperature: numberOrNull(daily.temperature_2m_max?.[dayIndex]),
    minTemperature: numberOrNull(daily.temperature_2m_min?.[dayIndex]),
    precipitation: numberOrNull(daily.precipitation_sum?.[dayIndex]),
    rain: numberOrNull(daily.rain_sum?.[dayIndex]),
    rainProbability: numberOrNull(daily.precipitation_probability_max?.[dayIndex]),
    maxWind: numberOrNull(daily.wind_speed_10m_max?.[dayIndex]),
  }));

  return {
    source: "Open-Meteo",
    sourceType: "model",
    current: {
      time: current.time || null,
      temperature: numberOrNull(current.temperature_2m),
      humidity: numberOrNull(current.relative_humidity_2m),
      precipitation: numberOrNull(current.precipitation),
      rain: numberOrNull(current.rain),
      showers: numberOrNull(current.showers),
      weatherCode: numberOrNull(current.weather_code),
      cloudCover: numberOrNull(current.cloud_cover),
      windSpeed: numberOrNull(current.wind_speed_10m),
      windDirection: numberOrNull(current.wind_direction_10m),
    },
    next3hRain: sum(hourly.precipitation, index, 3),
    next6hRain: sum(hourly.precipitation, index, 6),
    next24hRain: sum(hourly.precipitation, index, 24),
    next3hMaxRainProbability: max(hourly.precipitation_probability, index, 3),
    next24hMaxRainProbability: max(hourly.precipitation_probability, index, 24),
    daily: dailyForecast,
  };
}

function parsePublishedDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function decorateTmdWarnings(items) {
  const now = Date.now();
  const relevantTerms = /(กระบี่|ภาคใต้|ฝั่งตะวันตก|อันดามัน|พังงา|ภูเก็ต|ระนอง|ตรัง|สตูล)/i;
  return items.slice(0, 8).map((item) => {
    const published = parsePublishedDate(item.publishedAt);
    const ageHours = published ? (now - published.getTime()) / 3_600_000 : null;
    const combined = `${item.title} ${item.summary}`;
    return {
      ...item,
      relevant: relevantTerms.test(combined),
      fresh: ageHours !== null ? ageHours >= -2 && ageHours <= 72 : false,
      ageHours: ageHours === null ? null : round(ageHours, 1),
    };
  });
}

function resultStatus(result) {
  return result.status === "fulfilled" ? "online" : "unavailable";
}

export const handler = async () => {
  const [weatherResult, modelAirResult, air4ThaiResult, tmdRegionResult, tmdWarningResult, tmdKrabiResult] =
    await Promise.allSettled([
      fetchJson(URLS.openMeteo),
      fetchJson(URLS.openMeteoAir),
      fetchJson(URLS.air4Thai),
      fetchText(URLS.tmdRegion),
      fetchText(URLS.tmdWarning),
      fetchText(URLS.tmdKrabi),
    ]);

  const weather =
    weatherResult.status === "fulfilled" ? extractWeather(weatherResult.value) : null;

  const officialAir =
    air4ThaiResult.status === "fulfilled" ? extractAir4Thai(air4ThaiResult.value) : null;
  const fallbackAir =
    modelAirResult.status === "fulfilled" ? extractOpenMeteoAir(modelAirResult.value) : null;
  const air = officialAir?.pm25 !== null ? officialAir : fallbackAir;

  const tmdForecastItems =
    tmdRegionResult.status === "fulfilled" ? parseRss(tmdRegionResult.value) : [];
  const tmdWarningItems =
    tmdWarningResult.status === "fulfilled" ? parseRss(tmdWarningResult.value) : [];
  const tmdKrabiItems =
    tmdKrabiResult.status === "fulfilled" ? parseRss(tmdKrabiResult.value) : [];

  const payload = {
    location: PROJECT,
    generatedAt: new Date().toISOString(),
    weather,
    air,
    tmd: {
      regionalForecast: tmdForecastItems[0] || null,
      krabiObservation: tmdKrabiItems[0] || null,
      warnings: decorateTmdWarnings(tmdWarningItems),
    },
    dwr: {
      name: "EWS น้ำหลาก-ดินถล่ม · กรมทรัพยากรน้ำ",
      url: URLS.dwrEws,
      note: "ใช้เป็นแหล่งตรวจสอบประกาศ/สถานี EWS เพิ่มเติม; หน้าเว็บต้นทางอาจไม่เปิด API แบบไม่ต้องยืนยันตัวตน",
    },
    sources: [
      {
        id: "tmd-forecast",
        label: "พยากรณ์ภาคใต้ฝั่งตะวันตก",
        agency: "กรมอุตุนิยมวิทยา (TMD)",
        type: "official",
        status: resultStatus(tmdRegionResult),
        url: URLS.tmdRegion,
      },
      {
        id: "tmd-warning",
        label: "ประกาศเตือนภัย",
        agency: "กรมอุตุนิยมวิทยา (TMD)",
        type: "official",
        status: resultStatus(tmdWarningResult),
        url: URLS.tmdWarning,
      },
      {
        id: "tmd-krabi",
        label: "รายงานอากาศสถานีกระบี่",
        agency: "กรมอุตุนิยมวิทยา (TMD)",
        type: "official",
        status: resultStatus(tmdKrabiResult),
        url: URLS.tmdKrabi,
      },
      {
        id: "air4thai",
        label: "PM2.5 / AQI สถานีใกล้สุด",
        agency: "กรมควบคุมมลพิษ (Air4Thai)",
        type: "official",
        status: officialAir ? "online" : "unavailable",
        url: URLS.air4Thai,
      },
      {
        id: "open-meteo",
        label: "พยากรณ์รายพิกัด 7 วัน",
        agency: "Open-Meteo",
        type: "model",
        status: resultStatus(weatherResult),
        url: URLS.openMeteo,
      },
      {
        id: "dwr-ews",
        label: "EWS น้ำหลาก-ดินถล่ม",
        agency: "กรมทรัพยากรน้ำ (DWR)",
        type: "official-link",
        status: "link",
        url: URLS.dwrEws,
      },
    ],
  };

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=120, s-maxage=300, stale-while-revalidate=300",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(payload),
  };
};
