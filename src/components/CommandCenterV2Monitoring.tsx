import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Droplets,
  ExternalLink,
  Gauge,
  Radio,
  Waves,
  Wind,
} from "lucide-react";
import { PanelHeading, StatusTag } from "./CommandCenterV2Shared";
import "./CommandCenterV2.monitoring.css";

type IqairPublicData = {
  mode: "live" | "demo";
  stationName: string;
  aqi: number;
  pm25: number;
  temperature: number | null;
  windSpeed: number | null;
  humidity: number | null;
  updatedText: string | null;
  url: string;
  source: string;
};

const IQAIR_URL = "https://www.iqair.com/th/air-quality/thailand/krabi/krabi/krabi-international-school";

const IQAIR_DEMO: IqairPublicData = {
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

const WATER_QUALITY = [
  {
    id: "do",
    label: "DISSOLVED OXYGEN (DO)",
    thai: "ออกซิเจนละลายน้ำ",
    value: 7.34,
    unit: "mg/L",
    status: "Optimal",
    icon: Waves,
    series: [7.30, 7.33, 7.32, 7.35, 7.34, 7.36, 7.33, 7.35, 7.34, 7.36, 7.35, 7.33, 7.34, 7.35, 7.34, 7.34],
  },
  {
    id: "turbidity",
    label: "TURBIDITY",
    thai: "ความขุ่น",
    value: 16.19,
    unit: "NTU",
    status: "Clear",
    icon: Droplets,
    series: [15.8, 16.0, 15.9, 16.2, 16.0, 16.4, 16.1, 16.0, 16.2, 16.1, 16.3, 16.0, 16.2, 16.1, 16.2, 16.19],
  },
  {
    id: "ph",
    label: "PH LEVEL",
    thai: "ค่าความเป็นกรด-ด่าง",
    value: 7.5,
    unit: "",
    status: "Neutral",
    icon: Gauge,
    series: [7.48, 7.49, 7.50, 7.49, 7.50, 7.50, 7.51, 7.50, 7.50, 7.49, 7.50, 7.50, 7.51, 7.50, 7.50, 7.50],
  },
] as const;

const FLOW_METERS = [
  {
    id: "FM01",
    label: "FLOW METER (LEFT) (FM01)",
    thai: "จ่ายน้ำฝั่งซ้ายให้ชุมชน",
    value: 414.66,
    series: [414.1, 414.5, 414.4, 414.8, 414.6, 414.5, 414.9, 414.7, 414.6, 414.5, 414.8, 414.7, 414.66],
  },
  {
    id: "FM02",
    label: "FLOW METER (RIGHT) (FM02)",
    thai: "จ่ายน้ำฝั่งขวาให้ชุมชน",
    value: 381.61,
    series: [381.4, 381.7, 381.6, 381.5, 381.8, 381.6, 381.7, 381.5, 381.6, 381.7, 381.5, 381.7, 381.61],
  },
] as const;

const PROJECT_AIR_METRICS = [
  { label: "AQI", value: "27" },
  { label: "PM2.5 (µg/m³)", value: "16" },
  { label: "PM10 (µg/m³)", value: "24" },
  { label: "CO (µg/m³)", value: "0.48" },
  { label: "NO2 (µg/m³)", value: "0.011" },
  { label: "O3 (µg/m³)", value: "0.036" },
  { label: "SO2 (µg/m³)", value: "0.002" },
  { label: "Temp (°C)", value: "32" },
  { label: "Battery", value: "96%" },
] as const;

const AIR_HISTORY = [
  24, 24, 24, 25, 25, 27, 28, 25, 27, 24, 24, 25, 28, 29, 25, 25, 24, 25, 24, 24, 24, 23, 24, 28,
  29, 28, 25, 25, 27, 29, 27, 27, 24, 27, 25, 28, 25, 24, 23, 24, 25, 25, 25, 25, 25, 24, 24, 25,
  27, 29, 29, 29, 27, 27, 25, 28, 27, 28, 28, 29, 28, 27,
];

const WIND_SAMPLES = [
  { hour: 0.4, speed: 2.2, direction: 255 },
  { hour: 0.8, speed: 1.9, direction: 262 },
  { hour: 1.4, speed: 1.5, direction: 278 },
  { hour: 1.9, speed: 0.9, direction: 285 },
  { hour: 2.3, speed: 2.3, direction: 260 },
  { hour: 3.1, speed: 1.8, direction: 248 },
  { hour: 3.8, speed: 1.1, direction: 240 },
  { hour: 4.1, speed: 3.0, direction: 85 },
  { hour: 4.5, speed: 2.8, direction: 90 },
  { hour: 5.0, speed: 1.2, direction: 100 },
  { hour: 6.2, speed: 1.1, direction: 110 },
  { hour: 7.0, speed: 2.1, direction: 275 },
  { hour: 7.8, speed: 2.5, direction: 280 },
  { hour: 8.7, speed: 2.3, direction: 295 },
  { hour: 9.8, speed: 3.1, direction: 72 },
  { hour: 10.4, speed: 3.8, direction: 78 },
  { hour: 11.2, speed: 1.6, direction: 205 },
  { hour: 12.0, speed: 4.6, direction: 94 },
  { hour: 12.8, speed: 4.2, direction: 105 },
  { hour: 13.5, speed: 4.0, direction: 96 },
  { hour: 14.2, speed: 3.6, direction: 88 },
  { hour: 15.0, speed: 3.3, direction: 78 },
  { hour: 15.7, speed: 4.7, direction: 92 },
  { hour: 16.5, speed: 3.7, direction: 90 },
  { hour: 17.1, speed: 4.2, direction: 83 },
  { hour: 18.0, speed: 2.0, direction: 282 },
  { hour: 18.8, speed: 2.3, direction: 275 },
  { hour: 19.4, speed: 2.6, direction: 268 },
  { hour: 20.2, speed: 3.1, direction: 86 },
  { hour: 20.8, speed: 2.5, direction: 278 },
  { hour: 21.3, speed: 1.9, direction: 290 },
];

const WIND_ROSE = [
  { label: "N", frequency: 10, speed: 2.2 },
  { label: "NNE", frequency: 8.5, speed: 2.0 },
  { label: "NE", frequency: 7.8, speed: 2.2 },
  { label: "ENE", frequency: 5.2, speed: 1.4 },
  { label: "E", frequency: 9.2, speed: 4.1 },
  { label: "ESE", frequency: 1.8, speed: 3.6 },
  { label: "SE", frequency: 0.8, speed: 2.0 },
  { label: "SSE", frequency: 0.4, speed: 1.1 },
  { label: "S", frequency: 0.4, speed: 1.0 },
  { label: "SSW", frequency: 0.6, speed: 1.0 },
  { label: "SW", frequency: 0.9, speed: 1.2 },
  { label: "WSW", frequency: 1.1, speed: 1.1 },
  { label: "W", frequency: 1.5, speed: 1.3 },
  { label: "WNW", frequency: 2.2, speed: 1.5 },
  { label: "NW", frequency: 3.1, speed: 2.0 },
  { label: "NNW", frequency: 4.8, speed: 2.4 },
];

function SparkArea({ values, stroke = "#43d9ec", fill = "rgba(67,217,236,.16)" }: { values: readonly number[]; stroke?: string; fill?: string }) {
  const width = 100;
  const height = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.001);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = 5 + ((max - value) / range) * 12;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const area = `0,${height} ${points.join(" ")} ${width},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={area} fill={fill} />
      <polyline points={points.join(" ")} fill="none" stroke={stroke} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function WaterQualityPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`cc2-monitor-panel cc2-water-quality ${compact ? "compact" : ""}`}>
      <header className="cc2-monitor-heading">
        <div className="cc2-monitor-heading-icon"><Droplets size={18} /></div>
        <div>
          <p>WATER QUALITY MONITORING</p>
          <h2>คุณภาพน้ำอ่างเก็บน้ำบางเท่าแม่</h2>
          <span>ค่าทดสอบปกติสำหรับ sensor ที่วางแผนติดตั้งในอ่างเก็บน้ำ</span>
        </div>
        <span className="cc2-monitor-demo">DEMO · PLANNED IOT</span>
      </header>
      <div className="cc2-water-quality-grid">
        {WATER_QUALITY.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="cc2-water-quality-card" key={metric.id}>
              <div className="cc2-wq-top">
                <span className="cc2-wq-icon"><Icon size={16} /></span>
                <div><strong>{metric.label}</strong><small>{metric.thai} · {metric.status}</small></div>
                <b>{metric.value.toFixed(2)} <em>{metric.unit}</em></b>
              </div>
              <div className="cc2-wq-chart"><SparkArea values={metric.series} /></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function FlowMeterPanel() {
  return (
    <section className="cc2-flow-section">
      <header>
        <div><p>COMMUNITY WATER DISTRIBUTION</p><h2>Flow Meter · การแบ่งน้ำให้ชาวบ้าน</h2></div>
        <span>DEMO · PLANNED IOT</span>
      </header>
      <div className="cc2-flow-grid">
        {FLOW_METERS.map((meter) => (
          <article className="cc2-flow-card" key={meter.id}>
            <div className="cc2-flow-top">
              <span className="cc2-flow-dot" />
              <div><strong>{meter.label}</strong><small>{meter.thai}</small></div>
              <b>{meter.value.toFixed(2)} <em>m³/hr</em></b>
            </div>
            <div className="cc2-flow-chart"><SparkArea values={meter.series} stroke="#c9bd28" fill="rgba(201,189,40,.16)" /></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function IqairPublicPanel() {
  const [data, setData] = useState<IqairPublicData>(IQAIR_DEMO);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/.netlify/functions/iqair-public", { headers: { accept: "application/json" } });
        if (!response.ok) throw new Error(`iqair-public ${response.status}`);
        const payload = (await response.json()) as IqairPublicData;
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setData(IQAIR_DEMO);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const live = data.mode === "live";
  const tone = data.aqi <= 50 ? "good" : data.aqi <= 100 ? "moderate" : "poor";

  return (
    <article className={`cc2-air-public ${tone}`}>
      <div className="cc2-air-public-head">
        <div><p>PUBLIC AIR QUALITY</p><h3>Krabi International School</h3><span>ข้อมูลภายนอกพื้นที่ · IQAir public page</span></div>
        <span className={live ? "live" : "demo"}>{loading ? "LOADING" : live ? "PUBLIC WEB" : "DEMO FALLBACK"}</span>
      </div>
      <div className="cc2-air-public-main">
        <div className="cc2-air-aqi"><small>US AQI⁺</small><strong>{data.aqi}</strong><span>{data.aqi <= 50 ? "ดี" : data.aqi <= 100 ? "ปานกลาง" : "ควรเฝ้าระวัง"}</span></div>
        <div className="cc2-air-public-metrics">
          <div><span>PM2.5</span><strong>{data.pm25}</strong><small>µg/m³</small></div>
          <div><span>อุณหภูมิ</span><strong>{data.temperature ?? "—"}</strong><small>°C</small></div>
          <div><span>ลม</span><strong>{data.windSpeed ?? "—"}</strong><small>km/h</small></div>
          <div><span>ความชื้น</span><strong>{data.humidity ?? "—"}</strong><small>%</small></div>
        </div>
      </div>
      <footer>
        <span>{live ? `ดึงจากหน้า public${data.updatedText ? ` · ${data.updatedText}` : ""}` : "ดึง public page ไม่สำเร็จ · ใช้ DEMO ชั่วคราว"}</span>
        <a href={data.url} target="_blank" rel="noreferrer">เปิด IQAir <ExternalLink size={13} /></a>
      </footer>
    </article>
  );
}

function ProjectAirHistory() {
  const maximum = Math.max(...AIR_HISTORY, 30);
  return (
    <div className="cc2-air-history">
      <div className="cc2-air-history-head"><strong>ดัชนีคุณภาพอากาศภายในโครงการ</strong><span>วันนี้ · DEMO IOT</span></div>
      <div className="cc2-air-history-chart">
        {AIR_HISTORY.map((value, index) => (
          <div className="cc2-air-bar" key={`${index}-${value}`}>
            <b>{index % 4 === 0 ? value : ""}</b>
            <i style={{ height: `${Math.max(18, (value / maximum) * 100)}%` }} />
            <span>{index % 8 === 0 ? `${String(Math.floor(index / 3)).padStart(2, "0")}:00` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AirQualityIntelligencePanel() {
  return (
    <section className="cc2-air-intelligence">
      <header className="cc2-monitor-heading cc2-air-heading">
        <div className="cc2-monitor-heading-icon purple"><Radio size={18} /></div>
        <div><p>AIR QUALITY INTELLIGENCE</p><h2>คุณภาพอากาศภายในและภายนอกโครงการ</h2><span>แยก public data ภายนอกออกจาก IoT ภายในโครงการอย่างชัดเจน</span></div>
      </header>
      <div className="cc2-air-split">
        <IqairPublicPanel />
        <article className="cc2-project-air">
          <div className="cc2-project-air-head">
            <div><p>PROJECT IOT · DEMO</p><h3>สถานีตรวจวัดคุณภาพอากาศภายในโครงการ</h3><span>ตำแหน่ง: บ่อน้ำประปา · วางแผนติดตั้ง IoT จริง</span></div>
            <StatusTag tone="watch">DEMO IOT</StatusTag>
          </div>
          <div className="cc2-project-air-grid">
            {PROJECT_AIR_METRICS.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}
          </div>
          <ProjectAirHistory />
        </article>
      </div>
    </section>
  );
}

function windColor(speed: number) {
  if (speed >= 3.4) return "#ff352f";
  if (speed >= 1.6) return "#5f79d8";
  return "#8dcc7b";
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function WindRose() {
  const cx = 150;
  const cy = 150;
  const maxRadius = 104;
  return (
    <svg viewBox="0 0 300 300" className="cc2-windrose-svg" role="img" aria-label="Wind rose demo">
      {[2, 4, 6, 8, 10].map((value) => <circle key={value} cx={cx} cy={cy} r={(value / 10) * maxRadius} fill="none" stroke="currentColor" opacity=".14" />)}
      {WIND_ROSE.map((item, index) => {
        const centerAngle = index * 22.5;
        const half = 7.5;
        const radius = (item.frequency / 10) * maxRadius;
        const p1 = polarPoint(cx, cy, radius, centerAngle - half);
        const p2 = polarPoint(cx, cy, radius, centerAngle + half);
        const label = polarPoint(cx, cy, maxRadius + 19, centerAngle);
        return (
          <g key={item.label}>
            <path d={`M ${cx} ${cy} L ${p1.x} ${p1.y} A ${radius} ${radius} 0 0 1 ${p2.x} ${p2.y} Z`} fill={windColor(item.speed)} opacity=".92" />
            <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central">{item.label}</text>
          </g>
        );
      })}
      <text x="150" y="153" textAnchor="middle" className="center">0%</text>
    </svg>
  );
}

export function WindIntelligencePanel() {
  const maxSpeed = 5;
  const chartWidth = 820;
  const chartHeight = 250;
  const left = 42;
  const right = 14;
  const top = 18;
  const bottom = 34;
  const innerWidth = chartWidth - left - right;
  const innerHeight = chartHeight - top - bottom;

  return (
    <section className="cc2-wind-intelligence">
      <header className="cc2-monitor-heading">
        <div className="cc2-monitor-heading-icon purple"><Wind size={18} /></div>
        <div><p>WIND INTELLIGENCE · PROJECT IOT</p><h2>ทิศทางลมและ Wind Rose</h2><span>ข้อมูล DUMMY ตามรูปแบบสถานี IoT ที่วางแผนติดตั้งในพื้นที่โครงการ</span></div>
        <span className="cc2-monitor-demo">DEMO · PLANNED IOT</span>
      </header>
      <div className="cc2-wind-grid">
        <article className="cc2-wind-direction-card">
          <div className="cc2-subhead"><strong>ข้อมูลสภาพอากาศย้อนหลัง · Wind Direction</strong><span>00:00–23:59</span></div>
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="cc2-wind-direction-svg" role="img" aria-label="กราฟความเร็วและทิศทางลมรายชั่วโมง">
            {[1, 2, 3, 4, 5].map((speed) => {
              const y = top + innerHeight - (speed / maxSpeed) * innerHeight;
              return <g key={speed}><line x1={left} x2={chartWidth - right} y1={y} y2={y} /><text x={left - 10} y={y + 4} textAnchor="end">{speed}</text></g>;
            })}
            {WIND_SAMPLES.map((sample, index) => {
              const x = left + (sample.hour / 23) * innerWidth;
              const y = top + innerHeight - (sample.speed / maxSpeed) * innerHeight;
              return (
                <g key={`${sample.hour}-${index}`} transform={`translate(${x} ${y}) rotate(${sample.direction})`}>
                  <path d="M -5 4 L 7 0 L -5 -4 Z" fill={windColor(sample.speed)} />
                </g>
              );
            })}
            {[1, 4, 7, 10, 13, 16, 19, 22].map((hour) => {
              const x = left + (hour / 23) * innerWidth;
              return <text key={hour} x={x} y={chartHeight - 10} textAnchor="middle">{String(hour).padStart(2, "0")}:00</text>;
            })}
            <text x="12" y="125" transform="rotate(-90 12 125)" textAnchor="middle" className="axis-title">Wind Speed (m/s)</text>
          </svg>
        </article>
        <article className="cc2-windrose-card">
          <div className="cc2-subhead"><strong>อัตราส่วนความเร็วลมตามทิศทาง</strong><span>WIND ROSE</span></div>
          <WindRose />
          <div className="cc2-wind-legend">
            <span><i className="low" />0–1.5 m/s</span><span><i className="mid" />1.6–3.3 m/s</span><span><i className="high" />≥3.4 m/s</span>
          </div>
        </article>
      </div>
    </section>
  );
}
