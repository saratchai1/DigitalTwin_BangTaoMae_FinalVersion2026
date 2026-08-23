import {
  Activity,
  AlertTriangle,
  Camera,
  CloudRain,
  CloudSun,
  Droplets,
  ExternalLink,
  Gauge,
  Radio,
  ShieldCheck,
  Video,
  Waves,
  Wind,
} from "lucide-react";
import { WaterProfile3D } from "./WaterProfile3D";
import {
  FALLBACK_ENVIRONMENT,
  STATIONS,
  aqiLabel,
  dayLabel,
  formatNumber,
  weatherLabel,
  type EnvironmentData,
} from "./CommandCenterV2Data";
import {
  airQualityDisplayState,
  isDwrLive,
  isPrewarningStation,
  operationalStationStatus,
  sourceDisplayState,
  sourceStateLabel,
} from "./CommandCenterV2Policy";
import { PanelHeading, RainPanel, StatusTag } from "./CommandCenterV2Shared";
import {
  AirQualityIntelligencePanel,
  FlowMeterPanel,
  WaterQualityPanel,
  WindIntelligencePanel,
} from "./CommandCenterV2Monitoring";

export function WaterPage() {
  const critical = STATIONS.filter((station) => operationalStationStatus(station) === "critical").length;
  const warning = STATIONS.filter((station) => operationalStationStatus(station) === "warning").length;

  return (
    <>
      <section className="cc2-kpi-grid">
        <div className="cc2-kpi">
          <span><Radio size={16} />สถานีในแบบจำลอง</span>
          <strong>{STATIONS.length}<small>จุด</small></strong>
          <p>DEMO SNAPSHOT · ยังไม่ใช่ telemetry สด</p>
        </div>
        <div className="cc2-kpi critical">
          <span><AlertTriangle size={16} />จุดวิกฤต</span>
          <strong>{critical}<small>จุด</small></strong>
          <p>WL03 สูงกว่าเกณฑ์ 0.04 ม.</p>
        </div>
        <div className="cc2-kpi watch">
          <span><Gauge size={16} />จุดเฝ้าระวัง</span>
          <strong>{warning}<small>จุด</small></strong>
          <p>รวมจุดที่เข้าใกล้เกณฑ์ไม่เกิน 0.10 ม.</p>
        </div>
        <div className="cc2-kpi">
          <span><Droplets size={16} />ระยะเผื่ออ่าง</span>
          <strong>1.63<small>ม.</small></strong>
          <p>WL01 อยู่ในเกณฑ์ปกติ</p>
        </div>
      </section>

      <section className="cc2-water-intro cc2-panel">
        <div>
          <p>3D WATER OPERATIONS</p>
          <h2>แบบจำลองระดับน้ำรายสถานี</h2>
          <span>เขียว = ปกติ · เหลือง = เข้าใกล้/ถึงเกณฑ์เฝ้าระวัง · แดง = ถึงเกณฑ์วิกฤต</span>
        </div>
        <div className="cc2-water-intro-actions">
          <span className="cc2-demo-badge">DEMO SNAPSHOT</span>
          <div className="cc2-water-legend">
            <span><i />ปกติ</span>
            <span><i className="watch" />เฝ้าระวัง</span>
            <span><i className="critical" />วิกฤต</span>
          </div>
        </div>
      </section>

      <FlowMeterPanel />

      <div className="station-grid cc2-water-stations">
        {STATIONS.map((station, index) => {
          const displayStatus = operationalStationStatus(station);
          const prewarning = isPrewarningStation(station);
          return (
            <div
              className={`cc2-water-station-shell ${displayStatus}`}
              key={station.id}
              aria-label={`${station.id} ${prewarning ? "ใกล้ระดับเฝ้าระวัง" : displayStatus}`}
            >
              {prewarning && (
                <span className="cc2-prewarning-badge">
                  ใกล้เฝ้าระวัง · อีก {(station.warningLevel - station.currentLevel).toFixed(2)} ม.
                </span>
              )}
              <WaterProfile3D station={station} featured={index === 0} />
            </div>
          );
        })}
      </div>
    </>
  );
}

export function EnvironmentPage({ environment, fallbackMode }: { environment: EnvironmentData; fallbackMode: boolean }) {
  const dwrLive = isDwrLive(environment, fallbackMode);
  const dwr = dwrLive ? environment.dwr : FALLBACK_ENVIRONMENT.dwr;
  const dwrTone = !dwrLive
    ? "watch"
    : dwr.alertLevel === "critical"
      ? "critical"
      : ["watch", "warning"].includes(dwr.alertLevel)
        ? "watch"
        : "online";
  const dwrStatusLabel = dwrLive ? dwr.alertLabel : "ยังยืนยันสถานะไม่ได้";

  const weatherState = sourceDisplayState(environment, "open-meteo", fallbackMode);
  const airState = airQualityDisplayState(environment, fallbackMode);
  const airTone = airState === "offline"
    ? "critical"
    : airState === "live"
      ? (environment.air.aqi ?? 0) > 150
        ? "critical"
        : (environment.air.aqi ?? 0) > 50
          ? "watch"
          : "online"
      : "watch";

  return (
    <>
      <section className="cc2-env-hero">
        <article className="cc2-panel cc2-env-current">
          <PanelHeading
            kicker="CURRENT CONDITIONS"
            title="สภาพอากาศ ณ จุดโครงการ"
            action={
              <StatusTag tone={weatherState === "offline" ? "critical" : "watch"}>
                {sourceStateLabel(weatherState)} · POINT FORECAST
              </StatusTag>
            }
          />
          <div className="cc2-env-current-body">
            <div className="cc2-env-temperature">
              <CloudSun size={30} />
              <strong>{formatNumber(environment.weather.current.temperature)}<small>°C</small></strong>
              <span>{weatherLabel(environment.weather.current.weatherCode)}</span>
            </div>
            <div className="cc2-env-metrics">
              <div><Droplets size={16} /><span>ความชื้น</span><strong>{formatNumber(environment.weather.current.humidity, 0)}%</strong></div>
              <div><Wind size={16} /><span>ความเร็วลม</span><strong>{formatNumber(environment.weather.current.windSpeed)} กม./ชม.</strong></div>
              <div><CloudRain size={16} /><span>ฝน 3 ชม.</span><strong>{formatNumber(environment.weather.next3hRain)} มม.</strong></div>
              <div><Activity size={16} /><span>โอกาสฝน 24 ชม.</span><strong>{formatNumber(environment.weather.next24hMaxRainProbability, 0)}%</strong></div>
            </div>
          </div>
        </article>

        <article className="cc2-panel cc2-env-risk">
          <PanelHeading kicker="RISK SCREENING" title="สถานะที่ต้องจับตา" />
          <div className="cc2-env-risk-list">
            <div className="cc2-env-risk-row critical">
              <AlertTriangle size={18} />
              <div><span>ระดับน้ำโครงการ</span><strong>WL03 · วิกฤต</strong><p>เกณฑ์ภายในโครงการ ไม่ใช่ประกาศภัยราชการ</p></div>
            </div>
            <div className={`cc2-env-risk-row ${dwrTone}`}>
              <Waves size={18} />
              <div><span>DWR EWS · {dwrLive ? "LIVE" : "DUMMY"}</span><strong>{dwrStatusLabel}</strong><p>{dwr.stationId} · {dwr.stationName}</p></div>
            </div>
            <div className={`cc2-env-risk-row ${airTone}`}>
              <Wind size={18} />
              <div>
                <span>คุณภาพอากาศ · {sourceStateLabel(airState)}</span>
                <strong>{aqiLabel(environment.air.aqi)} · AQI {formatNumber(environment.air.aqi, 0)}</strong>
                <p>PM2.5 {formatNumber(environment.air.pm25)} µg/m³</p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <WaterQualityPanel />

      <AirQualityIntelligencePanel />

      <WindIntelligencePanel />

      <section className="cc2-env-main-grid">
        <RainPanel environment={environment} />
        <article className="cc2-panel cc2-official-panel">
          <PanelHeading kicker="SOURCE STATUS" title="แหล่งข้อมูลที่เชื่อมต่อ" />
          <div className="cc2-official-list">
            {environment.sources.map((source) => {
              const state = sourceDisplayState(environment, source.id, fallbackMode);
              return (
                <div className={`cc2-official-row ${state}`} key={source.id}>
                  <i className={state} />
                  <div><strong>{source.agency}</strong><span>{source.label}</span></div>
                  <em>{sourceStateLabel(state)}</em>
                </div>
              );
            })}
          </div>
          <div className="cc2-provenance-note">
            <ShieldCheck size={16} />
            <span>เขียว `LIVE` คือข้อมูลจากต้นทาง, เหลือง `MODEL / DUMMY / FALLBACK` ไม่ใช่ค่าตรวจวัดทางการ และแดง `OFFLINE` คือแหล่งที่ใช้งานไม่ได้</span>
          </div>
        </article>
      </section>

      <section className={`cc2-dwr-panel cc2-panel ${dwrLive ? "live" : "dummy"}`}>
        <PanelHeading
          kicker={dwrLive ? "DWR MEASURED DATA" : "DWR TEMPORARY DUMMY DATA"}
          title={`สถานี ${dwr.stationId} · ${dwr.stationName}`}
          action={dwrLive ? <StatusTag tone={dwrTone}>{dwrStatusLabel}</StatusTag> : <span className="cc2-dummy-badge">DUMMY VALUE</span>}
        />
        <div className="cc2-dwr-grid">
          <div><span>ฝน 15 นาที</span><strong>{formatNumber(dwr.rain15m)}<small>มม.</small></strong></div>
          <div><span>ฝน 12 ชั่วโมง</span><strong>{formatNumber(dwr.rain12h)}<small>มม.</small></strong></div>
          <div><span>ฝน 24 ชั่วโมง</span><strong>{formatNumber(dwr.rain24h)}<small>มม.</small></strong></div>
          <div><span>ระดับน้ำ</span><strong>{formatNumber(dwr.waterLevel)}<small>ม.</small></strong></div>
          <div><span>อุณหภูมิ</span><strong>{formatNumber(dwr.temperature)}<small>°C</small></strong></div>
          <div><span>พื้นที่</span><strong className="location">{dwr.district}<small>จ.{dwr.province}</small></strong></div>
        </div>
        <div className="cc2-dwr-meta">
          <span>{dwrLive ? `เวลาต้นทาง: ${dwr.updatedAt || "ไม่ระบุ"}` : "ไม่มีเวลาตรวจวัดที่ยืนยันได้ · ใช้ชุดค่าทดสอบคงที่"}</span>
          <a href={dwr.url || "https://ews.dwr.go.th/ews/index.php?language=th"} target="_blank" rel="noreferrer">
            เปิด DWR EWS <ExternalLink size={13} />
          </a>
        </div>
        {!dwrLive && (
          <p className="cc2-dummy-note">
            DWR EWS ต้นทางยังตอบกลับไม่เสถียร ค่าชุดนี้เป็น DUMMY สำหรับทดสอบหน้าจอเท่านั้น ระบบจะสลับเป็น `DWR MEASURED DATA · LIVE` อัตโนมัติเมื่อดึงค่าฝนหรือระดับน้ำจริงสำเร็จ
          </p>
        )}
      </section>

      <section className="cc2-panel cc2-forecast-panel">
        <PanelHeading kicker="7-DAY OUTLOOK" title="พยากรณ์รายวัน ณ พิกัดโครงการ" action={<StatusTag tone="watch">MODEL</StatusTag>} />
        <div className="cc2-forecast-grid">
          {environment.weather.daily.slice(0, 7).map((day) => (
            <div className="cc2-forecast-day" key={day.date}>
              <strong>{dayLabel(day.date)}</strong>
              <CloudRain size={19} />
              <span>{weatherLabel(day.weatherCode)}</span>
              <div><b>{formatNumber(day.maxTemperature, 0)}°</b><small>{formatNumber(day.minTemperature, 0)}°</small></div>
              <p>{formatNumber(day.precipitation)} มม. · {formatNumber(day.rainProbability, 0)}%</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function SurveillancePage({ now }: { now: Date }) {
  return (
    <>
      <section className="cc2-kpi-grid">
        <div className="cc2-kpi"><span><Camera size={16} />จุดกล้องที่กำหนด</span><strong>16<small>จุด</small></strong><p>ตำแหน่งและชื่อกล้องพร้อม</p></div>
        <div className="cc2-kpi"><span><Video size={16} />Demo tiles</span><strong>16<small>ช่อง</small></strong><p>ใช้ทดสอบ layout ก่อนต่อสตรีมจริง</p></div>
        <div className="cc2-kpi watch"><span><AlertTriangle size={16} />เหตุการณ์จำลอง</span><strong>2<small>รายการ</small></strong><p>ข้อมูลตัวอย่างสำหรับตรวจ UX</p></div>
        <div className="cc2-kpi watch"><span><Radio size={16} />Live integration</span><strong>0<small>/16</small></strong><p>รอ URL / credential ของกล้องจริง</p></div>
      </section>

      <section className="cc2-camera-heading">
        <div><p>CAMERA LAYOUT PREVIEW</p><h2>ตำแหน่งภาพจากกล้องเฝ้าระวัง</h2></div>
        <StatusTag tone="watch">DEMO FEEDS</StatusTag>
      </section>

      <section className="cc2-camera-grid">
        {Array.from({ length: 16 }, (_, index) => {
          const number = index + 1;
          return (
            <article className="cc2-camera-card demo" key={number}>
              <div className="cc2-camera-feed">
                <div className="cc2-camera-gridline" />
                <Camera size={30} />
                <span>DEMO PLACEHOLDER</span>
                <div className="cc2-camera-overlay"><b>● DEMO</b><strong>CAM-{String(number).padStart(2, "0")}</strong></div>
                <time>{now.toLocaleTimeString("th-TH", { hour12: false })}</time>
              </div>
              <div className="cc2-camera-meta">
                <div><strong>{number <= 4 ? `จุดตรวจน้ำ WL0${number}` : `แนวคลอง จุดที่ ${number}`}</strong><span>placeholder · target 1080p</span></div>
                <Video size={17} />
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
