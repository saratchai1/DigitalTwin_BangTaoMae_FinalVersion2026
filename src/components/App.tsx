import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  Camera,
  CheckCircle2,
  ChevronRight,
  CloudRain,
  Droplets,
  Gauge,
  LayoutDashboard,
  Leaf,
  Map,
  Menu,
  Moon,
  Navigation,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Sun,
  Thermometer,
  Waves,
  Wind,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WaterProfile3D, type WaterStation } from "./WaterProfile3D";
import { CommandCenterIntelligence } from "./CommandCenterIntelligence";

export interface AppProps {
  iTwinId: string;
  iModelId: string;
  changesetId?: string;
}

type MenuKey = "overview" | "water" | "environment" | "surveillance";

const PROJECT_COORDINATES = { lat: 8.604726, lon: 98.721682 } as const;

const initialStations: WaterStation[] = [
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
    note: "ระดับอ่างยังอยู่ในเกณฑ์ปกติ เหลือระยะเผื่อน้ำล้น 1.63 เมตร",
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

const flowSeed = Array.from({ length: 36 }, (_, index) => {
  const date = new Date(Date.now() - (35 - index) * 10 * 60_000);
  return {
    time: date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    fm01: 408 + Math.sin(index / 4) * 9 + Math.random() * 4,
    fm02: 376 + Math.cos(index / 5) * 7 + Math.random() * 3,
  };
});

const environmentHistory = [
  { time: "00:00", rain: 0, aqi: 44, temperature: 26.8 },
  { time: "04:00", rain: 1.2, aqi: 41, temperature: 25.7 },
  { time: "08:00", rain: 0.4, aqi: 45, temperature: 28.2 },
  { time: "12:00", rain: 0, aqi: 50, temperature: 32.4 },
  { time: "16:00", rain: 2.8, aqi: 47, temperature: 30.1 },
  { time: "20:00", rain: 0.8, aqi: 43, temperature: 27.9 },
  { time: "ขณะนี้", rain: 0, aqi: 42, temperature: 29.6 },
];

const menuItems: Array<{ key: MenuKey; label: string; shortLabel: string; icon: typeof Map }> = [
  { key: "overview", label: "ภาพรวมศูนย์สั่งการ", shortLabel: "ภาพรวม", icon: LayoutDashboard },
  { key: "water", label: "บริหารจัดการน้ำ", shortLabel: "ระดับน้ำ", icon: Droplets },
  { key: "environment", label: "สิ่งแวดล้อม", shortLabel: "สิ่งแวดล้อม", icon: Leaf },
  { key: "surveillance", label: "กล้องเฝ้าระวัง", shortLabel: "กล้อง", icon: Camera },
];

const pageMeta: Record<MenuKey, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "COMMAND CENTER", title: "ภาพรวมระบบ Digital Twin", description: "ติดตามสถานการณ์น้ำ สิ่งแวดล้อม และความพร้อมของโครงสร้างพื้นฐานในจอเดียว" },
  water: { eyebrow: "WATER INTELLIGENCE", title: "สถานการณ์น้ำบางเท่าแม่", description: "ระดับน้ำแบบ 3D ตามจุดตรวจวัด พร้อมเกณฑ์เฝ้าระวังและแนวโน้มล่าสุด" },
  environment: { eyebrow: "ENVIRONMENT MONITORING", title: "สภาพแวดล้อมและอากาศ", description: "ข้อมูลอุตุนิยมวิทยา คุณภาพอากาศ และปริมาณฝนในพื้นที่โครงการ" },
  surveillance: { eyebrow: "SITE SURVEILLANCE", title: "กล้องเฝ้าระวัง 16 จุด", description: "ตรวจสอบความพร้อมของพื้นที่และภาพจากจุดสำคัญตลอดแนวคลอง" },
};

function getStationStatus(station: WaterStation) {
  if (station.currentLevel >= station.criticalLevel) return "critical";
  if (station.currentLevel >= station.warningLevel) return "warning";
  return "normal";
}

function formatNumber(value: number | null, digits = 1) {
  return value === null ? "—" : value.toLocaleString("th-TH", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function ChartTooltip({ active, payload, label, unit = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p>{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-6 text-xs">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <strong>{Number(entry.value).toFixed(1)} {unit}</strong>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, unit, hint, icon: Icon, tone = "cyan" }: any) {
  return (
    <article className="metric-card group">
      <div className={`metric-icon metric-icon-${tone}`}><Icon size={18} /></div>
      <div className="min-w-0">
        <p className="metric-label">{label}</p>
        <div className="mt-1 flex items-baseline gap-1.5"><strong className="metric-value">{value}</strong>{unit && <span className="metric-unit">{unit}</span>}</div>
        <p className="metric-hint">{hint}</p>
      </div>
    </article>
  );
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div><p className="section-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action}</div>;
}

export function App(_props: AppProps) {
  const [activeMenu, setActiveMenu] = useState<MenuKey>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const [now, setNow] = useState(new Date());
  const [simulation, setSimulation] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [flowData, setFlowData] = useState(flowSeed);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [weather, setWeather] = useState({ temperature: 29.6, humidity: 78, wind: 9.4, windDirection: 215, rain: 0, rainChance: 35, aqi: 42, pm25: 12.4, condition: "มีเมฆบางส่วน", updatedAt: new Date() });

  useEffect(() => { document.documentElement.dataset.theme = isLight ? "light" : "dark"; }, [isLight]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow((current) => new Date(current.getTime() + (simulationRunning ? 12 * 60_000 : 1_000))), 1_000);
    return () => window.clearInterval(timer);
  }, [simulationRunning]);

  useEffect(() => {
    if (!simulationRunning) return;
    const timer = window.setInterval(() => {
      setFlowData((current) => [...current.slice(1), { time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }), fm01: 410 + Math.random() * 22 - 8, fm02: 378 + Math.random() * 18 - 7 }]);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [simulationRunning]);

  const refreshWeather = useCallback(async () => {
    if (simulation) return;
    setIsRefreshing(true);
    try {
      const [weatherResponse, airResponse] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${PROJECT_COORDINATES.lat}&longitude=${PROJECT_COORDINATES.lon}&current=temperature_2m,relative_humidity_2m,rain,wind_speed_10m,wind_direction_10m,cloud_cover&hourly=precipitation_probability&timezone=Asia%2FBangkok`),
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${PROJECT_COORDINATES.lat}&longitude=${PROJECT_COORDINATES.lon}&current=us_aqi,pm2_5&timezone=Asia%2FBangkok`),
      ]);
      const currentWeather = weatherResponse.ok ? await weatherResponse.json() : null;
      const air = airResponse.ok ? await airResponse.json() : null;
      const cloudCover = currentWeather?.current?.cloud_cover ?? 40;
      setWeather((current) => ({
        ...current,
        temperature: currentWeather?.current?.temperature_2m ?? current.temperature,
        humidity: currentWeather?.current?.relative_humidity_2m ?? current.humidity,
        wind: currentWeather?.current?.wind_speed_10m ?? current.wind,
        windDirection: currentWeather?.current?.wind_direction_10m ?? current.windDirection,
        rain: currentWeather?.current?.rain ?? current.rain,
        rainChance: currentWeather?.hourly?.precipitation_probability?.[new Date().getHours()] ?? current.rainChance,
        aqi: air?.current?.us_aqi ?? current.aqi,
        pm25: air?.current?.pm2_5 ?? current.pm25,
        condition: (currentWeather?.current?.rain ?? 0) > 0 ? "มีฝนในพื้นที่" : cloudCover > 60 ? "เมฆมาก" : "มีเมฆบางส่วน",
        updatedAt: new Date(),
      }));
    } catch {
      // Keep the last known values when the public weather endpoint is unavailable.
    } finally { window.setTimeout(() => setIsRefreshing(false), 450); }
  }, [simulation]);

  useEffect(() => {
    void refreshWeather();
    const timer = window.setInterval(() => void refreshWeather(), 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [refreshWeather]);

  const stationSummary = useMemo(() => {
    const critical = initialStations.filter((station) => getStationStatus(station) === "critical").length;
    const warning = initialStations.filter((station) => getStationStatus(station) === "warning").length;
    return { critical, warning, normal: initialStations.length - critical - warning };
  }, []);
  const latestFlow = flowData[flowData.length - 1];
  const page = pageMeta[activeMenu];
  const toggleSimulation = () => { setSimulation(true); setSimulationRunning((current) => !current); };
  const resetSimulation = () => { setSimulation(false); setSimulationRunning(false); setNow(new Date()); setFlowData(flowSeed); };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark"><Waves size={24} /></div>
          <div><p className="brand-eyebrow">BANG TAO MAE</p><h1>Digital Twin</h1></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileMenuOpen(false)} aria-label="ปิดเมนู"><X size={20} /></button>
        </div>
        <div className="system-pill"><span className="live-dot" /> ระบบออนไลน์ <strong>24/24</strong></div>
        <nav className="primary-nav" aria-label="เมนูหลัก">
          <p className="nav-label">ศูนย์ควบคุม</p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return <button key={item.key} className={`nav-item ${activeMenu === item.key ? "active" : ""}`} onClick={() => { setActiveMenu(item.key); setMobileMenuOpen(false); }}><span className="nav-icon"><Icon size={19} /></span><span>{item.label}</span><ChevronRight className="nav-chevron" size={16} /></button>;
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="network-card">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Radio size={15} /> เครือข่ายเซนเซอร์</div><span className="status-badge normal">ปกติ</span></div>
          <div className="network-row"><span>จุดตรวจวัด</span><strong>24 / 24</strong></div>
          <div className="network-row"><span>กล้อง CCTV</span><strong>16 / 16</strong></div>
          <div className="network-bar"><span style={{ width: "100%" }} /></div>
        </div>
        <div className="sidebar-actions">
          <button className="sidebar-action" onClick={() => setIsLight((current) => !current)}>{isLight ? <Moon size={17} /> : <Sun size={17} />} {isLight ? "โหมดกลางคืน" : "โหมดสว่าง"}</button>
          <div className="simulation-controls">
            <button className={`sidebar-action flex-1 ${simulationRunning ? "is-running" : ""}`} onClick={toggleSimulation}>{simulationRunning ? <Pause size={16} /> : <Play size={16} />} {simulationRunning ? "หยุดจำลอง" : "จำลองเหตุการณ์"}</button>
            <button className="icon-button" onClick={resetSimulation} aria-label="กลับสู่ข้อมูลปัจจุบัน"><RotateCcw size={17} /></button>
          </div>
        </div>
      </aside>
      {mobileMenuOpen && <button className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} aria-label="ปิดเมนู" />}

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <button className="icon-button menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="เปิดเมนู"><Menu size={20} /></button>
            <div><p>{page.eyebrow}</p><h2>{page.title}</h2><span>{page.description}</span></div>
          </div>
          <div className="topbar-actions">
            {simulation && <span className="simulation-badge"><Activity size={14} /> SIMULATION 720×</span>}
            <button className="sync-button" onClick={refreshWeather} disabled={isRefreshing || simulation}><RefreshCw size={15} className={isRefreshing ? "spin" : ""} /><span>อัปเดตล่าสุด {weather.updatedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span></button>
            <div className="clock-card"><strong>{now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong><span>{now.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</span></div>
          </div>
        </header>

        <div className="page-scroll">
          {activeMenu === "water" && (
            <div className="page-content">
              <section className="metric-grid metric-grid-five">
                <MetricCard label="สถานีทั้งหมด" value="6" unit="จุด" hint="ออนไลน์ครบทุกสถานี" icon={Radio} tone="cyan" />
                <MetricCard label="จุดวิกฤต" value={stationSummary.critical} unit="จุด" hint="WL03 สูงกว่าเกณฑ์ 4 ซม." icon={AlertTriangle} tone="red" />
                <MetricCard label="น้ำไหลเข้ารวม" value={formatNumber(latestFlow.fm01 + latestFlow.fm02, 0)} unit="ม³/ชม." hint="เพิ่มขึ้น 2.8% จากชั่วโมงก่อน" icon={ArrowDownRight} tone="blue" />
                <MetricCard label="ระยะเผื่ออ่าง" value="1.63" unit="ม." hint="WL01 อยู่ในเกณฑ์ปกติ" icon={Gauge} tone="green" />
                <MetricCard label="คุณภาพน้ำ" value="7.4" unit="pH" hint="DO 7.3 mg/L · ปกติ" icon={CheckCircle2} tone="green" />
              </section>

              <section className="water-hero-grid">
                <article className="panel chart-panel">
                  <SectionHeading eyebrow="FLOW MONITORING · 6 HOURS" title="อัตราการไหลล่าสุด" action={<span className="live-chip"><span className="live-dot" /> LIVE</span>} />
                  <div className="flow-summary"><div><span>FM01 · ฝั่งซ้าย</span><strong>{formatNumber(latestFlow.fm01)} <small>ม³/ชม.</small></strong></div><div><span>FM02 · ฝั่งขวา</span><strong>{formatNumber(latestFlow.fm02)} <small>ม³/ชม.</small></strong></div></div>
                  <div className="chart-large">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={flowData} margin={{ top: 10, right: 4, left: -28, bottom: 0 }}>
                        <defs><linearGradient id="fm01Fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d5f4" stopOpacity={0.28} /><stop offset="100%" stopColor="#34d5f4" stopOpacity={0} /></linearGradient><linearGradient id="fm02Fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b7cf6" stopOpacity={0.2} /><stop offset="100%" stopColor="#8b7cf6" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid stroke="var(--grid-line)" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="time" tick={{ fill: "var(--text-dim)", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={48} />
                        <YAxis tick={{ fill: "var(--text-dim)", fontSize: 10 }} tickLine={false} axisLine={false} domain={[340, 450]} />
                        <Tooltip content={<ChartTooltip unit="ม³/ชม." />} />
                        <Area name="FM01" type="monotone" dataKey="fm01" stroke="#34d5f4" strokeWidth={2.5} fill="url(#fm01Fill)" />
                        <Area name="FM02" type="monotone" dataKey="fm02" stroke="#8b7cf6" strokeWidth={2.5} fill="url(#fm02Fill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </article>
                <article className="panel quality-panel">
                  <SectionHeading eyebrow="WATER QUALITY" title="คุณภาพน้ำอ่างเก็บน้ำ" />
                  <div className="quality-list">
                    <div className="quality-item"><div className="quality-ring quality-ring-blue">7.3</div><div><strong>Dissolved Oxygen</strong><span>ออกซิเจนละลายน้ำ</span></div><span className="quality-status">เหมาะสม</span></div>
                    <div className="quality-item"><div className="quality-ring quality-ring-amber">16.4</div><div><strong>Turbidity</strong><span>ความขุ่น · NTU</span></div><span className="quality-status">น้ำใส</span></div>
                    <div className="quality-item"><div className="quality-ring quality-ring-green">7.4</div><div><strong>pH Level</strong><span>ความเป็นกรด–ด่าง</span></div><span className="quality-status">เป็นกลาง</span></div>
                  </div>
                  <div className="quality-footer"><CheckCircle2 size={16} /> คุณภาพน้ำผ่านเกณฑ์ทั้ง 3 ตัวชี้วัด</div>
                </article>
              </section>

              <section>
                <SectionHeading eyebrow="3D STATION PROFILES · BANTAOMAE-3D" title="ระดับน้ำรายสถานี" action={<div className="legend-row"><span><i className="legend-dot normal" />ปกติ</span><span><i className="legend-dot warning" />เฝ้าระวัง</span><span><i className="legend-dot critical" />วิกฤต</span></div>} />
                <div className="station-grid">{initialStations.map((station, index) => <WaterProfile3D key={station.id} station={station} featured={index === 0} />)}</div>
              </section>
            </div>
          )}

          {activeMenu === "overview" && (
            <div className="page-content">
              <section className="metric-grid">
                <MetricCard label="ระดับอ่าง WL01" value="86.47" unit="ม.รทก." hint="ปกติ · เหลือ 1.63 ม." icon={Waves} tone="cyan" />
                <MetricCard label="จุดต้องติดตาม" value={stationSummary.critical + stationSummary.warning} unit="จุด" hint={`${stationSummary.critical} วิกฤต · ${stationSummary.warning} เฝ้าระวัง`} icon={AlertTriangle} tone="red" />
                <MetricCard label="อุณหภูมิ" value={formatNumber(weather.temperature)} unit="°C" hint={`${weather.condition} · ณ จุดโครงการ`} icon={Thermometer} tone="amber" />
                <MetricCard label="คุณภาพอากาศ" value={formatNumber(weather.aqi, 0)} unit="AQI" hint={`PM2.5 ${formatNumber(weather.pm25)} µg/m³`} icon={Wind} tone="green" />
              </section>

              <CommandCenterIntelligence
                waterCriticalCount={stationSummary.critical}
                waterWarningCount={stationSummary.warning}
                onGoToWater={() => setActiveMenu("water")}
              />

              <section className="overview-grid">
                <article className="panel map-panel">
                  <SectionHeading eyebrow="OPERATIONAL MAP" title="แนวคลองและจุดตรวจวัด" action={<span className="live-chip"><span className="live-dot" /> เชื่อมต่อแล้ว</span>} />
                  <div className="schematic-map"><div className="map-glow" /><div className="canal-line" />
                    {[
                      { id: "WL01", label: "อ่างเก็บน้ำ", left: "13%", top: "28%", status: "normal" },
                      { id: "WL03", label: "กม.1+270", left: "35%", top: "46%", status: "critical" },
                      { id: "WL06", label: "กม.4+225", left: "59%", top: "55%", status: "normal" },
                      { id: "WL08", label: "กม.7+389", left: "83%", top: "72%", status: "normal" },
                    ].map((point) => <button key={point.id} className={`map-station ${point.status}`} style={{ left: point.left, top: point.top }} onClick={() => setActiveMenu("water")}><i /><strong>{point.id}</strong><span>{point.label}</span></button>)}
                    <div className="map-coordinate"><Navigation size={13} /> {PROJECT_COORDINATES.lat.toFixed(6)}°N, {PROJECT_COORDINATES.lon.toFixed(6)}°E · จุดอ้างอิงโครงการ</div>
                  </div>
                </article>
                <article className="panel alerts-panel">
                  <SectionHeading eyebrow="PRIORITY FEED" title="เหตุการณ์ที่ต้องติดตาม" />
                  <div className="alert-list">
                    <div className="alert-item critical"><AlertTriangle size={18} /><div><strong>WL03 ระดับน้ำวิกฤต</strong><span>สูงกว่าเกณฑ์ 0.04 เมตร · เป็นเกณฑ์เฝ้าระวังของโครงการ</span></div><time>LIVE</time></div>
                    <div className="alert-item warning"><CloudRain size={18} /><div><strong>โอกาสเกิดฝน {formatNumber(weather.rainChance, 0)}%</strong><span>พยากรณ์ ณ พิกัด 8.604726, 98.721682</span></div><time>{weather.updatedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</time></div>
                    <div className="alert-item normal"><CheckCircle2 size={18} /><div><strong>เซนเซอร์ออนไลน์ครบ</strong><span>24 จุดรายงานข้อมูลตามรอบ</span></div><time>LIVE</time></div>
                  </div>
                  <button className="panel-link" onClick={() => setActiveMenu("water")}>ดูรายละเอียดสถานการณ์น้ำ <ChevronRight size={15} /></button>
                </article>
              </section>
              <section className="panel station-table-panel">
                <SectionHeading eyebrow="LIVE NETWORK" title="สถานะสถานีทั้งหมด" />
                <div className="station-table">{initialStations.map((station) => { const status = getStationStatus(station); const freeboard = (station.bankLevel - station.currentLevel).toFixed(2); return <div key={station.id} className="station-row"><span className={`station-status-line ${status}`} /><strong>{station.id}</strong><span>{station.name}</span><span>{station.currentLevel.toFixed(2)} ม.</span><span>Freeboard {freeboard} ม.</span><span className={`status-badge ${status}`}>{status === "critical" ? "วิกฤต" : status === "warning" ? "เฝ้าระวัง" : "ปกติ"}</span></div>; })}</div>
              </section>
            </div>
          )}

          {activeMenu === "environment" && (
            <div className="page-content">
              <section className="metric-grid metric-grid-five">
                <MetricCard label="อุณหภูมิ" value={formatNumber(weather.temperature)} unit="°C" hint={weather.condition} icon={Thermometer} tone="amber" />
                <MetricCard label="ความชื้น" value={formatNumber(weather.humidity, 0)} unit="%" hint="อยู่ในช่วงปกติ" icon={Droplets} tone="blue" />
                <MetricCard label="ความเร็วลม" value={formatNumber(weather.wind)} unit="กม./ชม." hint={`ทิศ ${weather.windDirection}°`} icon={Navigation} tone="cyan" />
                <MetricCard label="ฝน 1 ชั่วโมง" value={formatNumber(weather.rain)} unit="มม." hint={`โอกาสฝน ${weather.rainChance}%`} icon={CloudRain} tone="blue" />
                <MetricCard label="คุณภาพอากาศ" value={formatNumber(weather.aqi, 0)} unit="AQI" hint="อากาศดี" icon={Wind} tone="green" />
              </section>
              <section className="environment-grid">
                <article className="panel environment-chart-panel">
                  <SectionHeading eyebrow="24-HOUR TREND" title="แนวโน้มสภาพอากาศ" />
                  <div className="chart-extra-large"><ResponsiveContainer width="100%" height="100%"><LineChart data={environmentHistory} margin={{ top: 16, right: 14, left: -16, bottom: 0 }}><CartesianGrid stroke="var(--grid-line)" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="time" tick={{ fill: "var(--text-dim)", fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: "var(--text-dim)", fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltip />} /><Line name="อุณหภูมิ °C" dataKey="temperature" type="monotone" stroke="#f3b85b" strokeWidth={2.5} dot={false} /><Line name="AQI" dataKey="aqi" type="monotone" stroke="#34d5f4" strokeWidth={2.5} dot={false} /><Line name="ปริมาณฝน มม." dataKey="rain" type="monotone" stroke="#8b7cf6" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div>
                  <div className="chart-legend"><span><i style={{ background: "#f3b85b" }} />อุณหภูมิ</span><span><i style={{ background: "#34d5f4" }} />AQI</span><span><i style={{ background: "#8b7cf6" }} />ฝน</span></div>
                </article>
                <article className="panel aqi-panel"><SectionHeading eyebrow="AIR QUALITY" title="คุณภาพอากาศขณะนี้" /><div className="aqi-gauge"><div><strong>{formatNumber(weather.aqi, 0)}</strong><span>US AQI</span></div></div><div className="aqi-label"><CheckCircle2 size={16} /> คุณภาพอากาศดี</div><div className="aqi-stats"><div><span>PM2.5</span><strong>{formatNumber(weather.pm25)} <small>µg/m³</small></strong></div><div><span>PM10</span><strong>21.8 <small>µg/m³</small></strong></div></div></article>
              </section>
            </div>
          )}

          {activeMenu === "surveillance" && (
            <div className="page-content">
              <section className="metric-grid">
                <MetricCard label="กล้องทั้งหมด" value="16" unit="ตัว" hint="ออนไลน์ครบทุกจุด" icon={Camera} tone="cyan" />
                <MetricCard label="กำลังบันทึก" value="16" unit="ตัว" hint="เก็บย้อนหลัง 30 วัน" icon={Radio} tone="red" />
                <MetricCard label="เหตุการณ์วันนี้" value="2" unit="รายการ" hint="ตรวจสอบแล้ว 1 รายการ" icon={AlertTriangle} tone="amber" />
                <MetricCard label="ความพร้อมระบบ" value="100" unit="%" hint="สัญญาณปกติ" icon={CheckCircle2} tone="green" />
              </section>
              <SectionHeading eyebrow="LIVE CAMERA NETWORK" title="ภาพจากกล้องเฝ้าระวัง" action={<span className="live-chip"><span className="record-dot" /> RECORDING</span>} />
              <section className="camera-grid">{Array.from({ length: 16 }, (_, index) => { const cameraNumber = index + 1; return <article key={cameraNumber} className="camera-card"><div className="camera-feed"><div className="camera-noise" /><Camera size={28} /><span>LIVE FEED</span><div className="camera-overlay"><span><i /> LIVE</span><strong>CAM-{String(cameraNumber).padStart(2, "0")}</strong></div><time>{now.toLocaleTimeString("th-TH", { hour12: false })}</time></div><div className="camera-meta"><div><strong>{cameraNumber <= 4 ? `จุดตรวจน้ำ WL0${cameraNumber}` : `แนวคลอง จุดที่ ${cameraNumber}`}</strong><span>สัญญาณชัดเจน · 1080p</span></div><CheckCircle2 size={17} /></div></article>; })}</section>
            </div>
          )}
        </div>
        <nav className="mobile-bottom-nav" aria-label="เมนูมือถือ">{menuItems.map((item) => { const Icon = item.icon; return <button key={item.key} className={activeMenu === item.key ? "active" : ""} onClick={() => setActiveMenu(item.key)}><Icon size={20} /><span>{item.shortLabel}</span></button>; })}</nav>
      </main>
    </div>
  );
}
