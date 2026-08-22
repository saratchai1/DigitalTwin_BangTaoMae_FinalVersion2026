import { useMemo, type ReactNode } from "react";
import { LocateFixed, ZoomIn, ZoomOut } from "lucide-react";
import { PROJECT, STATIONS, formatNumber, type EnvironmentData } from "./CommandCenterV2Data";
import { operationalStationStatus } from "./CommandCenterV2Policy";

export function StatusTag({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "critical" | "watch" | "online";
  children: ReactNode;
}) {
  return <span className={`cc2-tag ${tone}`}>{children}</span>;
}

export function PanelHeading({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="cc2-panel-head">
      <div className="cc2-panel-title">
        <p>{kicker}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function OperationalMap({ onOpenWater }: { onOpenWater: () => void }) {
  return (
    <div className="cc2-map">
      <div className="cc2-map-meta">
        <span className="cc2-map-chip"><b>●</b> LIVE NETWORK</span>
        <span className="cc2-map-chip">24 sensors · 16 cameras</span>
      </div>
      <svg className="cc2-map-svg" viewBox="0 0 900 430" role="img" aria-label="แผนผังโครงข่ายน้ำบางเท่าแม่">
        <defs>
          <linearGradient id="cc2ReservoirWater" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3ed3e7" stopOpacity=".82" />
            <stop offset="1" stopColor="#1a7186" stopOpacity=".72" />
          </linearGradient>
          <linearGradient id="cc2CanalWater" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#44d3e5" stopOpacity=".9" />
            <stop offset="1" stopColor="#2c7ea1" stopOpacity=".55" />
          </linearGradient>
          <filter id="cc2Glow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d="M70 130C88 74 185 46 259 78c55 23 66 85 24 128-48 50-152 52-202 5-25-24-28-52-11-81Z" fill="#0c252e" stroke="#27525d" strokeWidth="2" />
        <path d="M87 139c22-42 94-64 153-40 42 18 49 62 17 93-40 39-122 39-160 4-18-17-22-37-10-57Z" fill="url(#cc2ReservoirWater)" opacity=".86" filter="url(#cc2Glow)" />
        <path d="M271 157C353 169 374 207 441 213c74 7 109-42 179-29 75 14 90 72 188 70" fill="none" stroke="#153843" strokeWidth="25" strokeLinecap="round" />
        <path d="M271 157C353 169 374 207 441 213c74 7 109-42 179-29 75 14 90 72 188 70" fill="none" stroke="url(#cc2CanalWater)" strokeWidth="12" strokeLinecap="round" filter="url(#cc2Glow)" />
        <path className="cc2-flow-dash" d="M271 157C353 169 374 207 441 213c74 7 109-42 179-29 75 14 90 72 188 70" fill="none" stroke="#a6f4ff" strokeOpacity=".42" strokeWidth="2" strokeLinecap="round" />
        <path d="M526 199c-22 46-14 90 24 129" fill="none" stroke="#153843" strokeWidth="18" strokeLinecap="round" />
        <path d="M526 199c-22 46-14 90 24 129" fill="none" stroke="#348fa5" strokeWidth="8" strokeLinecap="round" />

        <g className="cc2-map-node" transform="translate(173 134)" onClick={onOpenWater}>
          <circle className="cc2-map-pulse" r="16" fill="#20e68a" opacity=".35" />
          <circle r="9" fill="#07151a" stroke="#20e68a" strokeWidth="4" />
          <text x="-24" y="-19" className="cc2-station-label">WL01</text>
          <text x="-42" y="33" className="cc2-station-sub">อ่างเก็บน้ำ · ปกติ</text>
        </g>
        <g className="cc2-map-node" transform="translate(358 188)" onClick={onOpenWater}>
          <circle className="cc2-map-pulse" r="19" fill="#ff3f5f" opacity=".52" />
          <circle r="10" fill="#07151a" stroke="#ff3f5f" strokeWidth="5" />
          <text x="-19" y="-20" className="cc2-station-label">WL03</text>
          <text x="-34" y="33" className="cc2-station-sub critical">กม.1+270 · วิกฤต</text>
        </g>
        <g className="cc2-map-node" transform="translate(525 199)" onClick={onOpenWater}>
          <circle r="9" fill="#07151a" stroke="#20e68a" strokeWidth="4" />
          <text x="-19" y="-20" className="cc2-station-label">WL06</text>
          <text x="-33" y="33" className="cc2-station-sub">กม.4+225 · ปกติ</text>
        </g>
        <g className="cc2-map-node" transform="translate(708 229)" onClick={onOpenWater}>
          <circle className="cc2-map-pulse" r="18" fill="#ffc145" opacity=".44" />
          <circle r="10" fill="#07151a" stroke="#ffc145" strokeWidth="5" />
          <text x="-19" y="-20" className="cc2-station-label">WL08</text>
          <text x="-42" y="33" className="cc2-station-sub watch">กม.7+389 · เฝ้าระวัง</text>
        </g>
        <g transform="translate(550 328)">
          <rect x="-28" y="-18" width="56" height="36" rx="8" fill="#0d2730" stroke="#4b8794" />
          <path d="M-21 6h42" stroke="#48d7e9" strokeWidth="7" opacity=".7" />
          <text x="-25" y="-28" className="cc2-station-label">TANK 01</text>
          <text x="-31" y="34" className="cc2-station-sub">63.8% · พร้อมใช้</text>
        </g>
        <g transform="translate(653 344)">
          <rect x="-28" y="-18" width="56" height="36" rx="8" fill="#0d2730" stroke="#4b8794" />
          <path d="M-21 4h42" stroke="#48d7e9" strokeWidth="10" opacity=".7" />
          <text x="-25" y="-28" className="cc2-station-label">TANK 02</text>
          <text x="-31" y="34" className="cc2-station-sub">69.2% · พร้อมใช้</text>
        </g>
      </svg>
      <div className="cc2-map-tools">
        <button aria-label="ซูมเข้า"><ZoomIn size={15} /></button>
        <button aria-label="ซูมออก"><ZoomOut size={15} /></button>
        <button aria-label="จัดตำแหน่ง"><LocateFixed size={15} /></button>
      </div>
      <div className="cc2-map-coordinate">{PROJECT.lat.toFixed(6)}°N, {PROJECT.lon.toFixed(6)}°E · จุดอ้างอิงโครงการ</div>
      <div className="cc2-map-legend">
        <span><i />ปกติ</span>
        <span><i className="watch" />เฝ้าระวัง</span>
        <span><i className="critical" />วิกฤต</span>
      </div>
    </div>
  );
}

export function RainPanel({ environment }: { environment: EnvironmentData }) {
  const bars = useMemo(() => {
    const profile = [0, 0.2, 0.6, 1.1, 2.8, 4.2, 3.4, 2.1, 1.3, 0.8, 0.4, 0.1];
    const profileSum = profile.reduce((sum, value) => sum + value, 0);
    const target = environment.weather.next24hRain ?? profileSum;
    const scale = target > 0 ? target / profileSum : 0;
    const values = profile.map((value) => Math.round(value * scale * 10) / 10);
    const maximum = Math.max(...values, 1);
    const labels = ["08", "10", "12", "14", "16", "18", "20", "22", "00", "02", "04", "06"];
    return values.map((value, index) => ({
      value,
      height: Math.max(3, (value / maximum) * 70),
      label: labels[index],
    }));
  }, [environment.weather.next24hRain]);

  return (
    <article className="cc2-panel cc2-rain-panel">
      <PanelHeading
        kicker="24-HOUR RAIN INTELLIGENCE"
        title="แนวโน้มฝน ณ พิกัดโครงการ"
        action={<StatusTag>MODEL · POINT FORECAST</StatusTag>}
      />
      <div className="cc2-rain-chart">
        <div className="cc2-rain-threshold"><span>เฝ้าระวัง</span></div>
        <div className="cc2-rain-bars">
          {bars.map((bar) => (
            <div className="cc2-rain-column" key={bar.label}>
              <b>{bar.value.toFixed(1)}</b>
              <i style={{ height: `${bar.height}%` }} />
              <span>{bar.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="cc2-rain-summary">
        <div><span>3 ชั่วโมงข้างหน้า</span><strong>{formatNumber(environment.weather.next3hRain)} มม.</strong></div>
        <div><span>24 ชั่วโมง</span><strong>{formatNumber(environment.weather.next24hRain)} มม.</strong></div>
        <div><span>โอกาสสูงสุด</span><strong>{formatNumber(environment.weather.next24hMaxRainProbability, 0)}%</strong></div>
      </div>
    </article>
  );
}

export function StationTable() {
  return (
    <section className="cc2-panel cc2-station-panel">
      <PanelHeading
        kicker="LIVE STATION NETWORK"
        title="สถานะจุดตรวจวัดทั้งหมด"
        action={
          <div className="cc2-head-buttons">
            <button>ดาวน์โหลดรายงาน</button>
            <button className="active">ดูทั้งหมด</button>
          </div>
        }
      />
      <div className="cc2-station-table">
        <div className="cc2-station-row header">
          <span />
          <span>สถานี</span>
          <span>ตำแหน่ง</span>
          <span>ระดับปัจจุบัน</span>
          <span>Freeboard</span>
          <span>แนวโน้ม</span>
          <span>สถานะ</span>
        </div>
        {STATIONS.map((station) => {
          const status = operationalStationStatus(station);
          const freeboard = station.bankLevel - station.currentLevel;
          const statusLabel = status === "critical"
            ? "วิกฤต"
            : status === "warning"
              ? station.currentLevel >= station.warningLevel ? "เฝ้าระวัง" : "ใกล้เฝ้าระวัง"
              : "ปกติ";
          return (
            <div className="cc2-station-row" key={station.id}>
              <i className={status} />
              <strong>{station.id}</strong>
              <span>{station.name}</span>
              <span>{station.currentLevel.toFixed(2)} ม.</span>
              <span>{freeboard.toFixed(2)} ม.</span>
              <span className={station.trend === "up" ? "trend-up" : "trend-flat"}>
                {station.trend === "up" ? "↑ เพิ่มขึ้น" : station.trend === "down" ? "↓ ลดลง" : "คงที่"}
              </span>
              <span className={`cc2-status-badge ${status}`}>{statusLabel}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
