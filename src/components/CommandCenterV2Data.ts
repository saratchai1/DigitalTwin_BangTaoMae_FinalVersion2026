import type { WaterStation } from "./WaterProfile3D";

export type MenuKey = "overview" | "water" | "environment" | "surveillance";
export type StationStatus = "normal" | "warning" | "critical";

export type ForecastDay = {
  date: string;
  weatherCode: number | null;
  maxTemperature: number | null;
  minTemperature: number | null;
  precipitation: number | null;
  rainProbability: number | null;
  maxWind: number | null;
};

export type EnvironmentData = {
  generatedAt: string;
  weather: {
    source: string;
    sourceType: string;
    current: {
      temperature: number | null;
      humidity: number | null;
      precipitation: number | null;
      weatherCode: number | null;
      windSpeed: number | null;
      windDirection: number | null;
    };
    next1hRain: number | null;
    next3hRain: number | null;
    next6hRain: number | null;
    next24hRain: number | null;
    next3hMaxRainProbability: number | null;
    next24hMaxRainProbability: number | null;
    daily: ForecastDay[];
  };
  air: {
    source: string;
    sourceType: string;
    stationName: string;
    distanceKm: number | null;
    pm25: number | null;
    pm10: number | null;
    aqi: number | null;
    updatedAt: string | null;
  };
  dwr: {
    stationId: string;
    stationName: string;
    subdistrict: string;
    district: string;
    province: string;
    rain15m: number | null;
    rain12h: number | null;
    rain24h: number | null;
    waterLevel: number | null;
    temperature: number | null;
    updatedAt: string | null;
    alertLevel: "normal" | "watch" | "warning" | "critical" | "unknown";
    alertLabel: string;
  };
  sources: Array<{
    id: string;
    label: string;
    agency: string;
    type: string;
    status: string;
  }>;
  tmd: {
    warnings: Array<{
      title: string;
      relevant?: boolean;
      fresh?: boolean;
    }>;
  };
};

export const PROJECT = { lat: 8.604726, lon: 98.721682 } as const;

export const STATIONS: WaterStation[] = [
  {
    id: "WL01",
    name: "อ่างเก็บน้ำบางเท่าแม่",
    type: "reservoir",
    currentLevel: 86.47,
    invertLevel: 80.64,
    bankLevel: 88.1,
    warningLevel: 86.9,
    criticalLevel: 87.4,
    trend: "stable",
    note: "ระดับอ่างอยู่ในเกณฑ์ปกติ เหลือระยะเผื่อน้ำล้น 1.63 เมตร",
  },
  {
    id: "WL03",
    name: "คลอง กม.1+270",
    type: "channel",
    currentLevel: 64.74,
    invertLevel: 60.38,
    bankLevel: 65.2,
    warningLevel: 64.2,
    criticalLevel: 64.7,
    trend: "up",
    note: "ระดับสูงกว่าเกณฑ์วิกฤต 0.04 เมตร ควรติดตามการระบายอย่างใกล้ชิด",
  },
  {
    id: "WL06",
    name: "คลอง กม.4+225",
    type: "channel",
    currentLevel: 48.16,
    invertLevel: 44.24,
    bankLevel: 49.5,
    warningLevel: 48.5,
    criticalLevel: 49,
    trend: "up",
    note: "ระดับน้ำมีแนวโน้มสูงขึ้น แต่ยังต่ำกว่าระดับเฝ้าระวัง 0.34 เมตร",
  },
  {
    id: "WL08",
    name: "คลอง กม.7+389",
    type: "channel",
    currentLevel: 31.88,
    invertLevel: 29.16,
    bankLevel: 32.5,
    warningLevel: 31.95,
    criticalLevel: 32.2,
    trend: "up",
    note: "ใกล้ระดับเฝ้าระวัง เหลืออีก 0.07 เมตรก่อนเข้าสู่สถานะเตือน",
  },
  {
    id: "TANK01",
    name: "ถังเก็บน้ำ 3,000 ลบ.ม. A",
    type: "tank",
    currentLevel: 3,
    invertLevel: 0,
    bankLevel: 4.7,
    tankHeight: 4.7,
    warningLevel: 3.45,
    criticalLevel: 3.95,
    trend: "stable",
    note: "ปริมาตรสำรองพร้อมใช้งาน ระดับน้ำคงที่",
  },
  {
    id: "TANK02",
    name: "ถังเก็บน้ำ 3,000 ลบ.ม. B",
    type: "tank",
    currentLevel: 3.39,
    invertLevel: 0,
    bankLevel: 4.9,
    tankHeight: 4.9,
    warningLevel: 3.6,
    criticalLevel: 4.1,
    trend: "stable",
    note: "ระดับปกติ เหลือความจุรองรับน้ำเพิ่ม 1.51 เมตร",
  },
];

const FORECAST_FALLBACK: ForecastDay[] = Array.from({ length: 7 }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() + index);
  return {
    date: date.toISOString().slice(0, 10),
    weatherCode: [2, 61, 63, 3, 80, 2, 61][index],
    maxTemperature: [32, 31, 30, 32, 30, 33, 31][index],
    minTemperature: [25, 25, 24, 25, 24, 25, 25][index],
    precipitation: [4.2, 12.8, 18.6, 3.1, 21.4, 1.6, 8.7][index],
    rainProbability: [52, 68, 72, 41, 79, 32, 61][index],
    maxWind: [13, 16, 18, 12, 19, 10, 14][index],
  };
});

export const FALLBACK_ENVIRONMENT: EnvironmentData = {
  generatedAt: new Date().toISOString(),
  weather: {
    source: "Open-Meteo",
    sourceType: "model",
    current: {
      temperature: 29.6,
      humidity: 78,
      precipitation: 0,
      weatherCode: 2,
      windSpeed: 9.4,
      windDirection: 215,
    },
    next1hRain: 0.6,
    next3hRain: 4.2,
    next6hRain: 7.8,
    next24hRain: 18.6,
    next3hMaxRainProbability: 58,
    next24hMaxRainProbability: 72,
    daily: FORECAST_FALLBACK,
  },
  air: {
    source: "Air4Thai · กรมควบคุมมลพิษ",
    sourceType: "official",
    stationName: "สถานีใกล้พื้นที่โครงการ",
    distanceKm: 32.4,
    pm25: 12.4,
    pm10: 21.8,
    aqi: 42,
    updatedAt: new Date().toISOString(),
  },
  dwr: {
    stationId: "STN2113",
    stationName: "บ้านคลองยา",
    subdistrict: "คลองยา",
    district: "อ่าวลึก",
    province: "กระบี่",
    rain15m: 0,
    rain12h: 7.8,
    rain24h: 18.6,
    waterLevel: 0.74,
    temperature: 27.8,
    updatedAt: new Date().toISOString(),
    alertLevel: "normal",
    alertLabel: "ปกติ",
  },
  sources: [
    { id: "dwr-ews", label: "ฝนและสถานะเตือนภัย", agency: "DWR", type: "official", status: "online" },
    { id: "tmd-warning", label: "ประกาศเตือนภัย", agency: "TMD", type: "official", status: "online" },
    { id: "air4thai", label: "คุณภาพอากาศ", agency: "PCD", type: "official", status: "online" },
    { id: "open-meteo", label: "พยากรณ์รายพิกัด", agency: "MODEL", type: "model", status: "online" },
  ],
  tmd: { warnings: [] },
};

export const PAGE_META: Record<MenuKey, { kicker: string; title: string; description: string }> = {
  overview: {
    kicker: "COMMAND CENTER · KRABI",
    title: "ศูนย์สั่งการ Digital Twin บางเท่าแม่",
    description: "สถานการณ์น้ำ สิ่งแวดล้อม และโครงสร้างพื้นฐานแบบรวมศูนย์",
  },
  water: {
    kicker: "WATER OPERATIONS",
    title: "เครือข่ายน้ำและโครงสร้างสำคัญ",
    description: "ติดตามระดับน้ำ แนวโน้ม และภาพจำลอง 3D ของทุกสถานี",
  },
  environment: {
    kicker: "ENVIRONMENT & HAZARD INTELLIGENCE",
    title: "สภาพอากาศ ฝน คุณภาพอากาศ และการเตือนภัย",
    description: "แยกข้อมูลทางการออกจากแบบจำลองอย่างชัดเจน",
  },
  surveillance: {
    kicker: "SITE SURVEILLANCE",
    title: "เครือข่ายกล้องเฝ้าระวัง",
    description: "ติดตามพื้นที่สำคัญและความพร้อมของกล้อง 16 จุด",
  },
};

export function stationStatus(station: WaterStation): StationStatus {
  if (station.currentLevel >= station.criticalLevel) return "critical";
  if (station.currentLevel >= station.warningLevel) return "warning";
  return "normal";
}

export function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function weatherLabel(code: number | null | undefined) {
  if (code === null || code === undefined) return "กำลังประมวลผล";
  if (code === 0) return "ท้องฟ้าแจ่มใส";
  if ([1, 2].includes(code)) return "มีเมฆบางส่วน";
  if (code === 3) return "เมฆมาก";
  if ([45, 48].includes(code)) return "มีหมอก";
  if ([51, 53, 55, 56, 57].includes(code)) return "ฝนละออง";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "มีฝน";
  if ([95, 96, 99].includes(code)) return "พายุฝนฟ้าคะนอง";
  return "สภาพอากาศแปรปรวน";
}

export function aqiLabel(aqi: number | null | undefined) {
  if (aqi === null || aqi === undefined) return "รอข้อมูล";
  if (aqi <= 50) return "ดี";
  if (aqi <= 100) return "ปานกลาง";
  if (aqi <= 150) return "เริ่มมีผลต่อกลุ่มเสี่ยง";
  if (aqi <= 200) return "มีผลต่อสุขภาพ";
  return "สูงมาก";
}

export function dayLabel(date: string) {
  return new Date(`${date}T12:00:00+07:00`).toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function normalizeEnvironment(raw: Partial<EnvironmentData>): EnvironmentData {
  const weather = raw.weather ?? FALLBACK_ENVIRONMENT.weather;
  const air = raw.air ?? FALLBACK_ENVIRONMENT.air;
  const dwr = raw.dwr ?? FALLBACK_ENVIRONMENT.dwr;
  return {
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    weather: {
      ...FALLBACK_ENVIRONMENT.weather,
      ...weather,
      current: {
        ...FALLBACK_ENVIRONMENT.weather.current,
        ...weather.current,
      },
      daily: weather.daily?.length ? weather.daily : FORECAST_FALLBACK,
    },
    air: { ...FALLBACK_ENVIRONMENT.air, ...air },
    dwr: { ...FALLBACK_ENVIRONMENT.dwr, ...dwr },
    sources: raw.sources?.length ? raw.sources : FALLBACK_ENVIRONMENT.sources,
    tmd: raw.tmd ?? FALLBACK_ENVIRONMENT.tmd,
  };
}
