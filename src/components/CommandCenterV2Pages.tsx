import { Activity, AlertTriangle, Camera, CheckCircle2, CloudRain, CloudSun, Droplets, Gauge, Radio, ShieldCheck, Video, Waves, Wind } from "lucide-react";
import { WaterProfile3D } from "./WaterProfile3D";
import { STATIONS, aqiLabel, dayLabel, formatNumber, stationStatus, weatherLabel, type EnvironmentData } from "./CommandCenterV2Data";
import { PanelHeading, RainPanel, StatusTag } from "./CommandCenterV2Shared";

export function WaterPage() {
  const critical = STATIONS.filter((station) => stationStatus(station) === "critical").length;
  const warning = STATIONS.filter((station) => stationStatus(station) === "warning").length;
  return (
    <>
      <section className="cc2-kpi-grid">
        <div className="cc2-kpi"><span><Radio size={16} />สถานีทั้งหมด</span><strong>6<small>จุด</small></strong><p>ออนไลน์ครบทุกสถานี</p></div>
        <div className="cc2-kpi critical"><span><AlertTriangle size={16} />จุดวิกฤต</span><strong>{critical}<small>จุด</small></strong><p>WL03 สูงกว่าเกณฑ์ 0.04 ม.</p></div>
        <div className="cc2-kpi watch"><span><Gauge size={16} />จุดเฝ้าระวัง</span><strong>{warning}<small>จุด</small></strong><p>WL08 เหลือ 0.07 ม.</p></div>
        <div className="cc2-kpi"><span><Droplets size={16} />ระยะเผื่ออ่าง</span><strong>1.63<small>ม.</small></strong><p>WL01 อยู่ในเกณฑ์ปกติ</p></div>
      </section>

      <section className="cc2-water-intro cc2-panel">
        <div>
          <p>3D WATER OPERATIONS</p>
          <h2>แบบจำลองระดับน้ำรายสถานี</h2>
          <span>หมุน ซูม และตรวจสอบระดับปัจจุบันเทียบกับ Warning / Critical ได้โดยตรง</span>
        </div>
        <div className="cc2-water-legend">
          <span><i />ปกติ</span>
          <span><i className="watch" />เฝ้าระวัง</span>
          <span><i className="critical" />วิกฤต</span>
        </div>
      </section>

      <div className="station-grid cc2-water-stations">
        {STATIONS.map((station, index) => (
          <WaterProfile3D key={station.id} station={station} featured={index === 0} />
        ))}
      </div>
    </>
  );
}

export function EnvironmentPage({ environment, fallbackMode }: { environment: EnvironmentData; fallbackMode: boolean }) {
  const dwrTone = ["warning", "critical"].includes(environment.dwr.alertLevel) ? "critical" : environment.dwr.alertLevel === "watch" ? "watch" : "online";
  return (
    <>
      <section className="cc2-env-hero">
        <article className="cc2-panel cc2-env-current">
          <PanelHeading
            kicker="CURRENT CONDITIONS"
            title="สภาพอากาศ ณ จุดโครงการ"
            action={<StatusTag tone={fallbackMode ? "watch" : "online"}>{fallbackMode ? "MODEL FALLBACK" : "PUBLIC DATA LIVE"}</StatusTag>}
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
            <div className="cc2-env-risk-row critical"><AlertTriangle size={18} /><div><span>ระดับน้ำโครงการ</span><strong>WL03 · วิกฤต</strong><p>เกณฑ์ภายในโครงการ ไม่ใช่ประกาศภัยราชการ</p></div></div>
            <div className={`cc2-env-risk-row ${dwrTone}`}><Waves size={18} /><div><span>DWR EWS</span><strong>{environment.dwr.alertLabel}</strong><p>{environment.dwr.stationId} · {environment.dwr.stationName}</p></div></div>
            <div className="cc2-env-risk-row online"><Wind size={18} /><div><span>คุณภาพอากาศ</span><strong>{aqiLabel(environment.air.aqi)} · AQI {formatNumber(environment.air.aqi, 0)}</strong><p>PM2.5 {formatNumber(environment.air.pm25)} µg/m³</p></div></div>
          </div>
        </article>
      </section>

      <section className="cc2-env-main-grid">
        <RainPanel environment={environment} />
        <article className="cc2-panel cc2-official-panel">
          <PanelHeading kicker="SOURCE STATUS" title="แหล่งข้อมูลที่เชื่อมต่อ" />
          <div className="cc2-official-list">
            {environment.sources.map((source) => (
              <div className="cc2-official-row" key={source.id}>
                <i className={`${source.status === "online" ? "online" : "offline"} ${source.type === "model" ? "model" : ""}`} />
                <div><strong>{source.agency}</strong><span>{source.label}</span></div>
                <em>{source.status === "online" ? "LIVE" : "UNAVAILABLE"}</em>
              </div>
            ))}
          </div>
          <div className="cc2-provenance-note"><ShieldCheck size={16} /><span>ข้อมูล `OFFICIAL` มาจากหน่วยงานรัฐโดยตรง ส่วน `MODEL` ใช้เพื่อการคาดการณ์รายพิกัดและไม่ใช่ประกาศภัยราชการ</span></div>
        </article>
      </section>

      <section className="cc2-dwr-panel cc2-panel">
        <PanelHeading
          kicker="DWR MEASURED DATA"
          title={`สถานี ${environment.dwr.stationId} · ${environment.dwr.stationName}`}
          action={<StatusTag tone={dwrTone}>{environment.dwr.alertLabel}</StatusTag>}
        />
        <div className="cc2-dwr-grid">
          <div><span>ฝน 15 นาที</span><strong>{formatNumber(environment.dwr.rain15m)}<small>มม.</small></strong></div>
          <div><span>ฝน 12 ชั่วโมง</span><strong>{formatNumber(environment.dwr.rain12h)}<small>มม.</small></strong></div>
          <div><span>ฝน 24 ชั่วโมง</span><strong>{formatNumber(environment.dwr.rain24h)}<small>มม.</small></strong></div>
          <div><span>ระดับน้ำ</span><strong>{formatNumber(environment.dwr.waterLevel)}<small>ม.</small></strong></div>
          <div><span>อุณหภูมิ</span><strong>{formatNumber(environment.dwr.temperature)}<small>°C</small></strong></div>
          <div><span>พื้นที่</span><strong className="location">{environment.dwr.district}<small>จ.{environment.dwr.province}</small></strong></div>
        </div>
      </section>

      <section className="cc2-panel cc2-forecast-panel">
        <PanelHeading kicker="7-DAY OUTLOOK" title="พยากรณ์รายวัน ณ พิกัดโครงการ" action={<StatusTag>MODEL</StatusTag>} />
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
        <div className="cc2-kpi"><span><Camera size={16} />กล้องทั้งหมด</span><strong>16<small>ตัว</small></strong><p>ออนไลน์ครบทุกจุด</p></div>
        <div className="cc2-kpi"><span><Video size={16} />กำลังบันทึก</span><strong>16<small>ตัว</small></strong><p>เก็บย้อนหลัง 30 วัน</p></div>
        <div className="cc2-kpi watch"><span><AlertTriangle size={16} />เหตุการณ์วันนี้</span><strong>2<small>รายการ</small></strong><p>ตรวจสอบแล้ว 1 รายการ</p></div>
        <div className="cc2-kpi"><span><CheckCircle2 size={16} />ความพร้อมระบบ</span><strong>100<small>%</small></strong><p>สัญญาณและพื้นที่จัดเก็บปกติ</p></div>
      </section>

      <section className="cc2-camera-heading">
        <div><p>LIVE CAMERA NETWORK</p><h2>ภาพจากกล้องเฝ้าระวัง</h2></div>
        <StatusTag tone="critical">● RECORDING</StatusTag>
      </section>

      <section className="cc2-camera-grid">
        {Array.from({ length: 16 }, (_, index) => {
          const number = index + 1;
          return (
            <article className="cc2-camera-card" key={number}>
              <div className="cc2-camera-feed">
                <div className="cc2-camera-gridline" />
                <Camera size={30} />
                <span>LIVE FEED</span>
                <div className="cc2-camera-overlay"><b>● LIVE</b><strong>CAM-{String(number).padStart(2, "0")}</strong></div>
                <time>{now.toLocaleTimeString("th-TH", { hour12: false })}</time>
              </div>
              <div className="cc2-camera-meta">
                <div><strong>{number <= 4 ? `จุดตรวจน้ำ WL0${number}` : `แนวคลอง จุดที่ ${number}`}</strong><span>1080p · signal stable</span></div>
                <CheckCircle2 size={17} />
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
