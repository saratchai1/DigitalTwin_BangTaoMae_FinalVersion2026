const PROJECT = {
  lat: 8.604726,
  lon: 98.721682,
  label: "โครงการบางเท่าแม่",
};

const DWR_PRIMARY_STATION = "STN2113";

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
  dwrRainDaily: "https://ews.dwr.go.th/ews/rain_daily.php",
  dwrServiceList: "https://ews.dwr.go.th/ews/service_list.php",
  dwrKrabi: `https://ews.dwr.go.th/ews/index.php?province=${encodeURIComponent("กระบี่")}`,
};

function numberOrNull(value) {
  if (value === null || value === undefined || value === "" || /^(?:n\/?a|-{1,3})$/i.test(String(value).trim())) return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
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
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
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
    headers: { "user-agent": "BangTaoMae-DigitalTwin/1.1", accept: "application/json,text/plain,*/*" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "BangTaoMae-DigitalTwin/1.1", accept: "text/html,application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(10000),
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
    next1hRain: sum(hourly.precipitation, index, 1),
    next3hRain: sum(hourly.precipitation, index, 3),
    next6hRain: sum(hourly.precipitation, index, 6),
    next24hRain: sum(hourly.precipitation, index, 24),
    next3hMaxRainProbability: max(hourly.precipitation_probability, index, 3),
    next24hMaxRainProbability: max(hourly.precipitation_probability, index, 24),
    daily: dailyForecast,
  };
}

function parseHtmlRows(html = "") {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) =>
      [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripHtml(cell[1])),
    )
    .filter((row) => row.length > 1);
}

function stationScore(station) {
  let score = 0;
  if (station.stationId === DWR_PRIMARY_STATION) score += 1000;
  if (/อ่าวลึก/.test(station.district)) score += 200;
  if (/คลองยา/.test(station.subdistrict)) score += 150;
  if (/กระบี่/.test(station.province)) score += 100;
  if (station.stationId === "STN1757") score += 60;
  return score;
}

function parseDwrRainDaily(html = "") {
  const rows = parseHtmlRows(html);
  const stations = rows
    .filter((row) => row.some((cell) => /^STN\d+$/i.test(cell)))
    .map((row) => {
      const idIndex = row.findIndex((cell) => /^STN\d+$/i.test(cell));
      const cells = idIndex > 0 ? row.slice(idIndex - 1) : row;
      return {
        stationId: cells[1] || "",
        name: cells[2] || "",
        subdistrict: cells[3] || "",
        district: cells[4] || "",
        province: cells[5] || "",
        office: cells[6] || "",
        hydroSection: cells[7] || "",
        rain15m: numberOrNull(cells[8]),
        rain12h: numberOrNull(cells[9]),
        rain24h: numberOrNull(cells[10]),
        temperature: numberOrNull(cells[11]),
        waterLevel: numberOrNull(cells[12]),
        soilMoisture: numberOrNull(cells[13]),
      };
    })
    .filter((station) => /กระบี่/.test(station.province));

  const selected = stations.sort((a, b) => stationScore(b) - stationScore(a))[0] || null;
  if (!selected) return null;

  const pageText = stripHtml(html);
  const updateMatch = pageText.match(/ข้อมูล\s*ณ\.?\s*เวลา\s*([^\n]+?)(?:นาฬิกา|Excel|CSV|XML|$)/i);

  return {
    ...selected,
    source: "DWR EWS · กรมทรัพยากรน้ำ",
    sourceType: "official",
    selection: selected.stationId === DWR_PRIMARY_STATION ? "primary-locality" : "nearest-locality-fallback",
    updatedText: updateMatch?.[1]?.trim() || null,
  };
}

function parseDwrServiceRow(html = "", stationId = DWR_PRIMARY_STATION) {
  const rows = parseHtmlRows(html);
  const row = rows.find((cells) => cells.some((cell) => cell.includes(stationId)));
  if (!row) return null;

  const joined = row.join(" | ");
  const warningCell = row.find((cell) => /(เฝ้าระวัง|เตรียมพร้อม|เตือนภัย|วิกฤต|วิกฤติ|อพยพ)/.test(cell)) || "";
  let alertLevel = "normal";
  let alertLabel = "ปกติ";
  if (/(วิกฤต|วิกฤติ|อพยพ)/.test(warningCell)) {
    alertLevel = "critical";
    alertLabel = warningCell;
  } else if (/(เตรียมพร้อม|เตือนภัย)/.test(warningCell)) {
    alertLevel = "warning";
    alertLabel = warningCell;
  } else if (/เฝ้าระวัง/.test(warningCell)) {
    alertLevel = "watch";
    alertLabel = warningCell;
  }

  const timestamp = row.find((cell) => /\d{4}\/\d{2}\/\d{2}\s+\d{1,2}:\d{2}/.test(cell)) || null;
  return { alertLevel, alertLabel, timestamp, rawSummary: joined };
}

function parseDwrProvinceStatus(html = "") {
  const text = stripHtml(html);
  const totalMatch = text.match(/สถานการณ์เตือนภัย\s*([\d,]+)\s*สถานี/i);
  const total = totalMatch ? numberOrNull(totalMatch[1]) : null;
  return {
    activeStations: total,
    hasActiveAlert: total !== null ? total > 0 : false,
  };
}

function buildDwr(rainDailyHtml, serviceHtml, provinceHtml) {
  const station = parseDwrRainDaily(rainDailyHtml || "");
  const service = station ? parseDwrServiceRow(serviceHtml || "", station.stationId) : null;
  const province = parseDwrProvinceStatus(provinceHtml || "");
  if (!station && !service) return null;

  return {
    name: "EWS น้ำหลาก-ดินถล่ม · กรมทรัพยากรน้ำ",
    url: URLS.dwrEws,
    source: "DWR EWS · กรมทรัพยากรน้ำ",
    sourceType: "official",
    stationId: station?.stationId || DWR_PRIMARY_STATION,
    stationName: station?.name || "บ้านคลองยา",
    subdistrict: station?.subdistrict || "คลองยา",
    district: station?.district || "อ่าวลึก",
    province: station?.province || "กระบี่",
    selection: station?.selection || "primary-locality",
    rain15m: station?.rain15m ?? null,
    rain12h: station?.rain12h ?? null,
    rain24h: station?.rain24h ?? null,
    temperature: station?.temperature ?? null,
    waterLevel: station?.waterLevel ?? null,
    soilMoisture: station?.soilMoisture ?? null,
    updatedAt: service?.timestamp || station?.updatedText || null,
    alertLevel: service?.alertLevel || "normal",
    alertLabel: service?.alertLabel || "ปกติ",
    provinceActiveStations: province.activeStations,
    provinceHasActiveAlert: province.hasActiveAlert,
    note: "สถานีอ้างอิงพื้นที่อ่าวลึก/คลองยา; ฝน 12 ชม. และฝนรายวันเป็นค่าตรวจวัด DWR EWS",
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
  const [
    weatherResult,
    modelAirResult,
    air4ThaiResult,
    tmdRegionResult,
    tmdWarningResult,
    tmdKrabiResult,
    dwrRainDailyResult,
    dwrServiceResult,
    dwrKrabiResult,
  ] = await Promise.allSettled([
    fetchJson(URLS.openMeteo),
    fetchJson(URLS.openMeteoAir),
    fetchJson(URLS.air4Thai),
    fetchText(URLS.tmdRegion),
    fetchText(URLS.tmdWarning),
    fetchText(URLS.tmdKrabi),
    fetchText(URLS.dwrRainDaily),
    fetchText(URLS.dwrServiceList),
    fetchText(URLS.dwrKrabi),
  ]);

  const weather = weatherResult.status === "fulfilled" ? extractWeather(weatherResult.value) : null;

  const officialAir = air4ThaiResult.status === "fulfilled" ? extractAir4Thai(air4ThaiResult.value) : null;
  const fallbackAir = modelAirResult.status === "fulfilled" ? extractOpenMeteoAir(modelAirResult.value) : null;
  const air = officialAir?.pm25 !== null ? officialAir : fallbackAir;

  const tmdForecastItems = tmdRegionResult.status === "fulfilled" ? parseRss(tmdRegionResult.value) : [];
  const tmdWarningItems = tmdWarningResult.status === "fulfilled" ? parseRss(tmdWarningResult.value) : [];
  const tmdKrabiItems = tmdKrabiResult.status === "fulfilled" ? parseRss(tmdKrabiResult.value) : [];

  const dwr = buildDwr(
    dwrRainDailyResult.status === "fulfilled" ? dwrRainDailyResult.value : "",
    dwrServiceResult.status === "fulfilled" ? dwrServiceResult.value : "",
    dwrKrabiResult.status === "fulfilled" ? dwrKrabiResult.value : "",
  );

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
    dwr: dwr || {
      name: "EWS น้ำหลาก-ดินถล่ม · กรมทรัพยากรน้ำ",
      url: URLS.dwrEws,
      source: "DWR EWS · กรมทรัพยากรน้ำ",
      sourceType: "official",
      stationId: DWR_PRIMARY_STATION,
      stationName: "บ้านคลองยา",
      subdistrict: "คลองยา",
      district: "อ่าวลึก",
      province: "กระบี่",
      selection: "primary-locality",
      rain15m: null,
      rain12h: null,
      rain24h: null,
      temperature: null,
      waterLevel: null,
      soilMoisture: null,
      updatedAt: null,
      alertLevel: "unknown",
      alertLabel: "รอข้อมูล",
      provinceActiveStations: null,
      provinceHasActiveAlert: false,
      note: "DWR EWS ต้นทางไม่ตอบสนองในรอบนี้; ไม่ใช้ค่าจำลองแทนข้อมูลตรวจวัดทางการ",
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
        id: "dwr-ews",
        label: "ฝน 15 นาที / 12 / 24 ชม. และสถานะเตือนภัย",
        agency: "กรมทรัพยากรน้ำ (DWR EWS)",
        type: "official",
        status: dwr ? "online" : "unavailable",
        url: URLS.dwrRainDaily,
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
        label: "พยากรณ์รายพิกัด 1/3/6/24 ชม. และ 7 วัน",
        agency: "Open-Meteo",
        type: "model",
        status: resultStatus(weatherResult),
        url: URLS.openMeteo,
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
