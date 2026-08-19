import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  CloudSun,
  Droplets,
  ExternalLink,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react";
import "./CommandCenterIntelligence.css";

const PROJECT = { lat: 8.604726, lon: 98.721682 };

type RiskTone = "normal" | "watch" | "warning" | "critical";

type ForecastDay = {
  date: string;
  weatherCode: number | null;
  maxTemperature: number | null;
  minTemperature: number | null;
  precipitation: number | null;
  rainProbability: number | null;
  maxWind: number | null;
};

type IntelligenceData = {
  generatedAt: string;
  location: { lat: number; lon: number; label: string };
  weather: null | {
    source: string;
    sourceType: string;
    current: {
      time: string | null;
      temperature: number | null;
      humidity: number | null;
      precipitation: number | null;
      rain: number | null;
      showers: number | null;
      weatherCode: number | null;
      cloudCover: number | null;
      windSpeed: number | null;
      windDirection: number | null;
    };
    next3hRain: number | null;
    next6hRain: number | null;
    next24hRain: number | null;
    next3hMaxRainProbability: number | null;
    next24hMaxRainProbability: number | null;
    daily: ForecastDay[];
  };
  air: null | {
    source: string;
    sourceType: string;
    stationId: string | null;
    stationName: string;
    distanceKm: number | null;
    pm25: number | null;
    pm10: number | null;
    aqi: number | null;
    updatedAt: string | null;
  };
  tmd: {
    regionalForecast: FeedItem | null;
    krabiObservation: FeedItem | null;
    warnings: Array<FeedItem & { relevant?: boolean; fresh?: boolean; ageHours?: number | null }>;
  };
  dwr: { name: string; url: string; note: string };
  sources: Array<{
    id: string;
    label: string;
    agency: string;
    type: string;
    status: string;
    url: string;
  }>;
};

type FeedItem = {
  title: string;
  summary: string;
  link: string;
  publishedAt: string;
};

interface CommandCenterIntelligenceProps {
  waterCriticalCount: number;
  waterWarningCount: number;
  onGoToWater: () => void;
}

function n(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function weatherLabel(code: number | null | undefined) {
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

function dayLabel(date: string) {
  return new Date(`${date}T12:00:00+07:00`).toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function aqiLabel(aqi: number | null | undefined) {
  if (aqi === null || aqi === undefined) return "รอข้อมูล";
  if (aqi <= 50) return "ดี";
  if (aqi <= 100) return "ปานกลาง";
  if (aqi <= 150) return "เริ่มมีผลต่อกลุ่มเสี่ยง";
  if (aqi <= 200) return "มีผลต่อสุขภาพ";
  return "สูงมาก";
}

async function fetchFallback(): Promise<IntelligenceData> {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${PROJECT.lat}&longitude=${PROJECT.lon}` +
    "&current=temperature_2m,relative_humidity_2m,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m" +
    "&hourly=precipitation_probability,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max" +
    "&timezone=Asia%2FBangkok&forecast_days=7";
  const airUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${PROJECT.lat}&longitude=${PROJECT.lon}` +
    "&current=us_aqi,pm2_5,pm10&timezone=Asia%2FBangkok";

  const [weatherResponse, airResponse] = await Promise.all([fetch(weatherUrl), fetch(airUrl)]);
  if (!weatherResponse.ok) throw new Error("weather fallback unavailable");
  const raw = await weatherResponse.json();
  const airRaw = airResponse.ok ? await airResponse.json() : null;
  const times: string[] = raw.hourly?.time || [];
  let index = times.findIndex((time) => time >= raw.current?.time);
  if (index < 0) index = 0;
  const sliceSum = (count: number) =>
    (raw.hourly?.precipitation || [])
      .slice(index, index + count)
      .reduce((sum: number, value: number) => sum + (Number(value) || 0), 0);
  const sliceMax = (count: number) => {
    const values = (raw.hourly?.precipitation_probability || [])
      .slice(index, index + count)
      .map(Number)
      .filter(Number.isFinite);
    return values.length ? Math.max(...values) : null;
  };

  return {
    generatedAt: new Date().toISOString(),
    location: { ...PROJECT, label: "โครงการบางเท่าแม่" },
    weather: {
      source: "Open-Meteo",
      sourceType: "model",
      current: {
        time: raw.current?.time ?? null,
        temperature: raw.current?.temperature_2m ?? null,
        humidity: raw.current?.relative_humidity_2m ?? null,
        precipitation: raw.current?.precipitation ?? null,
        rain: raw.current?.rain ?? null,
        showers: raw.current?.showers ?? null,
        weatherCode: raw.current?.weather_code ?? null,
        cloudCover: raw.current?.cloud_cover ?? null,
        windSpeed: raw.current?.wind_speed_10m ?? null,
        windDirection: raw.current?.wind_direction_10m ?? null,
      },
      next3hRain: sliceSum(3),
      next6hRain: sliceSum(6),
      next24hRain: sliceSum(24),
      next3hMaxRainProbability: sliceMax(3),
      next24hMaxRainProbability: sliceMax(24),
      daily: (raw.daily?.time || []).map((date: string, i: number) => ({
        date,
        weatherCode: raw.daily?.weather_code?.[i] ?? null,
        maxTemperature: raw.daily?.temperature_2m_max?.[i] ?? null,
        minTemperature: raw.daily?.temperature_2m_min?.[i] ?? null,
        precipitation: raw.daily?.precipitation_sum?.[i] ?? null,
        rainProbability: raw.daily?.precipitation_probability_max?.[i] ?? null,
        maxWind: raw.daily?.wind_speed_10m_max?.[i] ?? null,
      })),
    },
    air: airRaw
      ? {
          source: "Open-Meteo Air Quality",
          sourceType: "model",
          stationId: null,
          stationName: "แบบจำลอง ณ พิกัดโครงการ",
          distanceKm: 0,
          pm25: airRaw.current?.pm2_5 ?? null,
          pm10: airRaw.current?.pm10 ?? null,
          aqi: airRaw.current?.us_aqi ?? null,
          updatedAt: airRaw.current?.time ?? null,
        }
      : null,
    tmd: { regionalForecast: null, krabiObservation: null, warnings: [] },
    dwr: {
      name: "EWS น้ำหลาก-ดินถล่ม · กรมทรัพยากรน้ำ",
      url: "https://ews.dwr.go.th/ews/index.php?language=th",
      note: "เปิดตรวจสอบข้อมูล EWS จากต้นทาง",
    },
    sources: [
      {
        id: "open-meteo",
        label: "พยากรณ์รายพิกัด 7 วัน",
        agency: "Open-Meteo",
        type: "model",
        status: "online",
        url: weatherUrl,
      },
      {
        id: "tmd-warning",
        label: "ประกาศเตือนภัย",
        agency: "กรมอุตุนิยมวิทยา (TMD)",
        type: "official",
        status: "unavailable",
        url: "https://www.tmd.go.th/api/xml/warning-news",
      },
    ],
  };
}

function RiskCard({
  icon: Icon,
  title,
  status,
  detail,
  tone,
  official = false,
  onClick,
}: {
  icon: typeof AlertTriangle;
  title: string;
  status: string;
  detail: string;
  tone: RiskTone;
  official?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className={`eci-risk-icon ${tone}`}><Icon size={20} /></div>
      <div className="eci-risk-copy">
        <div className="eci-risk-title-row">
          <span>{title}</span>
          {official && <small>OFFICIAL</small>}
        </div>
        <strong>{status}</strong>
        <p>{detail}</p>
      </div>
    </>
  );
  return onClick ? (
    <button className={`eci-risk-card ${tone}`} onClick={onClick}>{content}</button>
  ) : (
    <article className={`eci-risk-card ${tone}`}>{content}</article>
  );
}

export function CommandCenterIntelligence({
  waterCriticalCount,
  waterWarningCount,
  onGoToWater,
}: CommandCenterIntelligenceProps) {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/.netlify/functions/environment-intelligence", {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`environment function ${response.status}`);
      setData(await response.json());
      setFallbackMode(false);
    } catch {
      try {
        setData(await fetchFallback());
        setFallbackMode(true);
      } catch {
        setError("ไม่สามารถโหลดข้อมูลสภาพอากาศได้ในขณะนี้");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const activeOfficialWarnings = useMemo(
    () => data?.tmd?.warnings?.filter((item) => item.relevant && item.fresh) ?? [],
    [data],
  );

  const risk = useMemo(() => {
    const rain3 = data?.weather?.next3hRain ?? 0;
    const rain24 = data?.weather?.next24hRain ?? 0;
    const probability = data?.weather?.next24hMaxRainProbability ?? 0;

    let floodTone: RiskTone = "normal";
    let floodStatus = "ปกติ";
    let floodDetail = "ระดับน้ำและฝนยังไม่เข้าเกณฑ์คัดกรองของระบบ";
    if (waterCriticalCount > 0) {
      floodTone = "critical";
      floodStatus = "เฝ้าระวังสูง";
      floodDetail = `${waterCriticalCount} จุดสูงกว่าเกณฑ์วิกฤตของโครงการ · ยังไม่ใช่การยืนยันว่าเกิดน้ำท่วม`;
    } else if (waterWarningCount > 0 || rain24 >= 70) {
      floodTone = "warning";
      floodStatus = "เฝ้าระวัง";
      floodDetail = `สถานีเฝ้าระวัง ${waterWarningCount} จุด · ฝนคาดการณ์ 24 ชม. ${n(rain24)} มม.`;
    } else if (rain24 >= 30 || probability >= 70) {
      floodTone = "watch";
      floodStatus = "จับตา";
      floodDetail = `ฝนคาดการณ์ 24 ชม. ${n(rain24)} มม. · โอกาสสูงสุด ${n(probability, 0)}%`;
    }

    let flashTone: RiskTone = "normal";
    let flashStatus = "ยังไม่พบสัญญาณสูง";
    let flashDetail = `ฝน 3 ชม. ${n(rain3)} มม. · ฝน 24 ชม. ${n(rain24)} มม.`;
    if (activeOfficialWarnings.length) {
      flashTone = "critical";
      flashStatus = "มีประกาศ TMD ที่เกี่ยวข้อง";
      flashDetail = activeOfficialWarnings[0].title || "พบประกาศเตือนภัยที่เกี่ยวข้องกับภาคใต้ฝั่งตะวันตก";
    } else if (rain3 >= 30 || rain24 >= 70) {
      flashTone = "warning";
      flashStatus = "จับตาฝนหนัก";
      flashDetail = `แบบจำลองพบฝนสะสมสูง: 3 ชม. ${n(rain3)} มม. · 24 ชม. ${n(rain24)} มม.`;
    } else if (probability >= 70 && rain24 >= 20) {
      flashTone = "watch";
      flashStatus = "เฝ้าดูแนวโน้ม";
      flashDetail = `โอกาสฝนสูงสุด 24 ชม. ${n(probability, 0)}% · ยังไม่พบประกาศ TMD ที่ตรงพื้นที่`;
    }

    return { floodTone, floodStatus, floodDetail, flashTone, flashStatus, flashDetail };
  }, [data, waterCriticalCount, waterWarningCount, activeOfficialWarnings]);

  const weather = data?.weather;
  const air = data?.air;
  const updatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <section className="eci-shell" aria-label="ข้อมูลอากาศและการเตือนภัยพื้นที่โครงการ">
      <div className="eci-header">
        <div>
          <div className="eci-eyebrow"><ShieldAlert size={15} /> ENVIRONMENT & HAZARD INTELLIGENCE</div>
          <h2>อากาศ ฝน PM2.5 และการเตือนภัยพื้นที่โครงการ</h2>
          <p className="eci-location"><MapPin size={14} /> พิกัดหลัก {PROJECT.lat.toFixed(6)}, {PROJECT.lon.toFixed(6)} · อัปเดต {updatedAt}</p>
        </div>
        <div className="eci-header-actions">
          {fallbackMode && <span className="eci-mode model">MODEL FALLBACK</span>}
          {!fallbackMode && data && <span className="eci-mode official">PUBLIC DATA LIVE</span>}
          <button className="eci-refresh" onClick={() => void refresh()} disabled={loading} aria-label="อัปเดตข้อมูลสิ่งแวดล้อม">
            <RefreshCw size={15} className={loading ? "spin" : ""} /> อัปเดต
          </button>
        </div>
      </div>

      {error ? (
        <div className="eci-error"><AlertTriangle size={18} /> {error}</div>
      ) : (
        <>
          <div className="eci-risk-grid">
            <RiskCard
              icon={Waves}
              title="ความเสี่ยงน้ำท่วม"
              status={risk.floodStatus}
              detail={risk.floodDetail}
              tone={risk.floodTone}
              onClick={onGoToWater}
            />
            <RiskCard
              icon={CloudRain}
              title="น้ำป่าไหลหลาก / ฝนหนัก"
              status={risk.flashStatus}
              detail={risk.flashDetail}
              tone={risk.flashTone}
              official={activeOfficialWarnings.length > 0}
            />
            <RiskCard
              icon={Wind}
              title="PM2.5 / คุณภาพอากาศ"
              status={air?.aqi != null ? `${aqiLabel(air.aqi)} · AQI ${n(air.aqi, 0)}` : "รอข้อมูล AQI"}
              detail={air?.pm25 != null ? `PM2.5 ${n(air.pm25)} µg/m³ · ${air.source}` : "ยังไม่พบค่าฝุ่นจากแหล่งข้อมูลที่เชื่อมต่อ"}
              tone={air?.aqi != null && air.aqi > 150 ? "critical" : air?.aqi != null && air.aqi > 100 ? "warning" : air?.aqi != null && air.aqi > 50 ? "watch" : "normal"}
              official={air?.sourceType === "official"}
            />
          </div>

          <div className="eci-data-grid">
            <article className="eci-weather-card">
              <div className="eci-card-title"><CloudSun size={18} /><div><span>สภาพอากาศ ณ จุดโครงการ</span><small>{weather?.source ?? "กำลังโหลด"} · รายพิกัด</small></div></div>
              <div className="eci-current-weather">
                <div className="eci-temp"><strong>{n(weather?.current.temperature)}</strong><span>°C</span><small>{weatherLabel(weather?.current.weatherCode)}</small></div>
                <div className="eci-mini-stats">
                  <div><Droplets size={15} /><span>ความชื้น</span><strong>{n(weather?.current.humidity, 0)}%</strong></div>
                  <div><Wind size={15} /><span>ลม</span><strong>{n(weather?.current.windSpeed)} กม./ชม.</strong></div>
                  <div><CloudRain size={15} /><span>ฝนขณะนี้</span><strong>{n(weather?.current.precipitation)} มม.</strong></div>
                </div>
              </div>
              <div className="eci-rain-strip">
                <div><span>3 ชั่วโมง</span><strong>{n(weather?.next3hRain)} มม.</strong><small>โอกาสสูงสุด {n(weather?.next3hMaxRainProbability, 0)}%</small></div>
                <div><span>6 ชั่วโมง</span><strong>{n(weather?.next6hRain)} มม.</strong><small>ฝนสะสมคาดการณ์</small></div>
                <div><span>24 ชั่วโมง</span><strong>{n(weather?.next24hRain)} มม.</strong><small>โอกาสสูงสุด {n(weather?.next24hMaxRainProbability, 0)}%</small></div>
              </div>
            </article>

            <article className="eci-official-card">
              <div className="eci-card-title"><ShieldAlert size={18} /><div><span>ข้อมูลทางการที่เกี่ยวข้อง</span><small>TMD · PCD · DWR</small></div></div>
              <div className="eci-official-list">
                <div className="eci-official-item">
                  <span className={`eci-source-dot ${data?.tmd?.regionalForecast ? "online" : "offline"}`} />
                  <div><strong>กรมอุตุนิยมวิทยา · ภาคใต้ฝั่งตะวันตก</strong><p>{data?.tmd?.regionalForecast?.summary || data?.tmd?.regionalForecast?.title || "เชื่อมต่อ RSS ทางการเมื่อรันบน Netlify"}</p></div>
                </div>
                <div className="eci-official-item">
                  <span className={`eci-source-dot ${activeOfficialWarnings.length ? "alert" : data?.tmd?.warnings ? "online" : "offline"}`} />
                  <div><strong>ประกาศเตือนภัย TMD</strong><p>{activeOfficialWarnings.length ? activeOfficialWarnings[0].title : "ยังไม่พบประกาศใหม่ใน feed ที่ตรงพื้นที่/ภูมิภาคภายใน 72 ชั่วโมง"}</p></div>
                </div>
                <div className="eci-official-item">
                  <span className={`eci-source-dot ${air?.sourceType === "official" ? "online" : "offline"}`} />
                  <div><strong>Air4Thai · กรมควบคุมมลพิษ</strong><p>{air?.sourceType === "official" ? `${air.stationName}${air.distanceKm != null ? ` · ห่างประมาณ ${n(air.distanceKm)} กม.` : ""}` : "ใช้แบบจำลองสำรองเมื่อ Air4Thai ไม่ตอบสนอง"}</p></div>
                </div>
                <a className="eci-dwr-link" href={data?.dwr?.url || "https://ews.dwr.go.th/ews/index.php?language=th"} target="_blank" rel="noreferrer">
                  <span><strong>DWR EWS น้ำหลาก–ดินถล่ม</strong><small>เปิดหน้าระบบเตือนภัยล่วงหน้าของกรมทรัพยากรน้ำ</small></span><ExternalLink size={15} />
                </a>
              </div>
            </article>
          </div>

          <article className="eci-forecast-card">
            <div className="eci-forecast-title"><div><Thermometer size={18} /><span>พยากรณ์ 7 วัน ณ พิกัดโครงการ</span></div><small>ค่ารายพิกัดเป็นแบบจำลอง · ใช้ประกอบการตัดสินใจร่วมกับประกาศทางการ</small></div>
            <div className="eci-forecast-scroll">
              {(weather?.daily || []).slice(0, 7).map((day) => (
                <div className="eci-day" key={day.date}>
                  <strong>{dayLabel(day.date)}</strong>
                  <span className="eci-day-condition">{weatherLabel(day.weatherCode)}</span>
                  <div className="eci-day-temp"><b>{n(day.maxTemperature, 0)}°</b><span>{n(day.minTemperature, 0)}°</span></div>
                  <div className="eci-day-rain"><CloudRain size={13} /> {n(day.precipitation)} มม.</div>
                  <small>โอกาส {n(day.rainProbability, 0)}%</small>
                </div>
              ))}
            </div>
          </article>

          <div className="eci-footnote">
            <CheckCircle2 size={15} />
            <span><strong>หลักการแจ้งเตือน:</strong> คำว่า “เฝ้าระวัง/จับตา” เป็นเกณฑ์คัดกรองของ dashboard จากระดับน้ำและแบบจำลองฝน ไม่ใช่ประกาศภัยของราชการ; ป้าย <b>OFFICIAL</b> จะแสดงเฉพาะเมื่อพบข้อมูลจากแหล่งทางการที่เชื่อมต่อ</span>
          </div>
        </>
      )}
    </section>
  );
}
