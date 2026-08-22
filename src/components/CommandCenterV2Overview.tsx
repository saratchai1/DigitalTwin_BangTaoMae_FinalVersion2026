import { useMemo } from "react";
import { AlertTriangle, ChevronRight, CloudRain, CloudSun, Layers3, Waves, Wind } from "lucide-react";
import { STATIONS, aqiLabel, formatNumber, stationStatus, weatherLabel, type EnvironmentData } from "./CommandCenterV2Data";
import { OperationalMap, PanelHeading, RainPanel, StationTable, StatusTag } from "./CommandCenterV2Shared";

export function OverviewPage({
  environment,
  fallbackMode,
  onOpenWater,
}: {
  environment: EnvironmentData;
  fallbackMode: boolean;
  onOpenWater: () => void;
}) {
  const summary = useMemo(() => {
    const critical = STATIONS.filter((station) => stationStatus(station) === "critical").length;
    const warning = STATIONS.filter((station) => stationStatus(station) === "warning").length;
    const normal = STATIONS.length - critical - warning;
    const readiness = Math.max(0, 100 - critical * 6 - warning * 2 - (fallbackMode ? 4 : 0));
    return { critical, warning, normal, readiness };
  }, [fallbackMode]);

  const officialOnline = environment.sources.filter((source) => source.type === "official" && source.status === "online").length;
  const trustScore = Math.min(100, 76 + officialOnline * 6 + (fallbackMode ? 0 : 2));
  const wl01 = STATIONS[0];
  const wl03 = STATIONS[1];
  const tmdWarning = environment.tmd.warnings.find((warning) => warning.relevant && warning.fresh);

  return (
    <>
      <article className="cc2-mission">
        <section className="cc2-readiness">
          <div className="cc2-state-kicker"><i /> OPERATIONAL READINESS</div>
          <div className="cc2-state-main">
            <div className="cc2-score">{summary.readiness}<span>%</span></div>
            <div className="cc2-state-copy">
              <strong>ระบบโดยรวมพร้อมใช้งาน</strong>
              <span>มี {summary.critical} จุดที่ต้องดำเนินการทันที<br />และ {summary.warning} จุดอยู่ในช่วงเฝ้าระวัง</span>
            </div>
          </div>
          <div className="cc2-state-meta">
            <StatusTag tone="critical">{summary.critical} CRITICAL</StatusTag>
            <StatusTag tone="watch">{summary.warning} WATCH</StatusTag>
            <StatusTag tone="online">22 ONLINE</StatusTag>
          </div>
        </section>

        <section className="cc2-vitals">
          <div className="cc2-vital">
            <div className="cc2-vital-head"><span>ระดับอ่าง WL01</span><Waves size={14} /></div>
            <div className="cc2-vital-value">{wl01.currentLevel.toFixed(2)}<small>ม.รทก.</small></div>
            <div className="cc2-vital-foot good">Freeboard {(wl01.bankLevel - wl01.currentLevel).toFixed(2)} ม. · ปกติ</div>
          </div>
          <div className="cc2-vital">
            <div className="cc2-vital-head"><span>WL03 · กม.1+270</span><AlertTriangle size={14} /></div>
            <div className="cc2-vital-value">{wl03.currentLevel.toFixed(2)}<small>ม.</small></div>
            <div className="cc2-vital-foot bad">สูงกว่า Critical {(wl03.currentLevel - wl03.criticalLevel).toFixed(2)} ม.</div>
          </div>
          <div className="cc2-vital">
            <div className="cc2-vital-head"><span>ฝนสะสม 24 ชม.</span><CloudRain size={14} /></div>
            <div className="cc2-vital-value">{formatNumber(environment.weather.next24hRain)}<small>มม.</small></div>
            <div className="cc2-vital-foot watch">โอกาสฝนสูงสุด {formatNumber(environment.weather.next24hMaxRainProbability, 0)}%</div>
          </div>
          <div className="cc2-vital">
            <div className="cc2-vital-head"><span>คุณภาพอากาศ</span><Wind size={14} /></div>
            <div className="cc2-vital-value">{formatNumber(environment.air.aqi, 0)}<small>AQI</small></div>
            <div className="cc2-vital-foot good">PM2.5 {formatNumber(environment.air.pm25)} µg/m³ · {aqiLabel(environment.air.aqi)}</div>
          </div>
        </section>

        <section className="cc2-weather">
          <div className="cc2-weather-top">
            <div>
              <div className="cc2-weather-temp">{formatNumber(environment.weather.current.temperature)}<sup>°C</sup></div>
              <p>{weatherLabel(environment.weather.current.weatherCode)}</p>
            </div>
            <div className="cc2-weather-icon"><CloudSun size={22} /></div>
          </div>
          <div className="cc2-weather-grid">
            <div><span>ความชื้น</span><strong>{formatNumber(environment.weather.current.humidity, 0)}%</strong></div>
            <div><span>ลม</span><strong>{formatNumber(environment.weather.current.windSpeed)} กม./ชม.</strong></div>
            <div><span>ฝน 3 ชม.</span><strong>{formatNumber(environment.weather.next3hRain)} มม.</strong></div>
            <div><span>สถานะ TMD</span><strong className={tmdWarning ? "danger" : "good"}>{tmdWarning ? "มีประกาศ" : "ปกติ"}</strong></div>
          </div>
        </section>
      </article>

      <section className="cc2-ops-grid">
        <article className="cc2-panel">
          <PanelHeading
            kicker="OPERATIONAL TWIN"
            title="โครงข่ายน้ำและจุดตรวจวัด"
            action={
              <div className="cc2-head-buttons">
                <button className="active">ภาพรวม</button>
                <button onClick={onOpenWater}>ระดับน้ำ</button>
                <button><Layers3 size={13} /> ชั้นข้อมูล</button>
              </div>
            }
          />
          <OperationalMap onOpenWater={onOpenWater} />
        </article>

        <aside className="cc2-panel cc2-command-panel">
          <PanelHeading
            kicker="PRIORITY QUEUE"
            title="สิ่งที่ต้องดำเนินการ"
            action={<StatusTag tone="critical">1 ACTION</StatusTag>}
          />
          <div className="cc2-command-body">
            <section className="cc2-alert-block">
              <div className="cc2-alert-top">
                <div className="cc2-alert-icon"><AlertTriangle size={18} /></div>
                <div className="cc2-alert-copy">
                  <strong>WL03 สูงกว่าเกณฑ์วิกฤต</strong>
                  <span>ระดับปัจจุบัน 64.74 ม. สูงกว่า Critical 0.04 ม. แนวโน้มยังเพิ่มขึ้นเล็กน้อย</span>
                </div>
                <span className="cc2-severity">CRITICAL</span>
              </div>
              <div className="cc2-alert-actions">
                <button>เปิดแผนตอบสนอง</button>
                <button onClick={onOpenWater}>ดูสถานี</button>
              </div>
            </section>

            <section className="cc2-queue">
              <div className="cc2-queue-title"><strong>เหตุการณ์ล่าสุด</strong><span>3 รายการ</span></div>
              <div className="cc2-queue-item">
                <i />
                <div><strong>WL08 ใกล้ระดับเฝ้าระวัง</strong><span>เหลือระยะ 0.07 ม. ก่อนถึง Warning</span></div>
                <time>LIVE</time>
              </div>
              <div className="cc2-queue-item">
                <i className="good" />
                <div><strong>ข้อมูล DWR รับครบตามรอบ</strong><span>{environment.dwr.stationId} · {environment.dwr.stationName}</span></div>
                <time>{environment.dwr.updatedAt ? "ล่าสุด" : "รอข้อมูล"}</time>
              </div>
              <div className="cc2-queue-item">
                <i className="good" />
                <div><strong>กล้องและเซนเซอร์ออนไลน์ครบ</strong><span>24 sensors · 16 cameras</span></div>
                <time>LIVE</time>
              </div>
            </section>

            <section className="cc2-decision">
              <div className="cc2-decision-head"><strong>คำแนะนำระบบ</strong><span>ASSISTED DECISION</span></div>
              <p>ตรวจสอบการระบายที่ WL03 และติดตาม WL08 ต่อเนื่องทุก 15 นาที ขณะนี้ยังไม่มีประกาศภัยทางการที่ตรงพื้นที่</p>
              <button onClick={onOpenWater}>เปิด Operational Playbook <ChevronRight size={14} /></button>
            </section>
          </div>
        </aside>
      </section>

      <section className="cc2-intelligence-grid">
        <RainPanel environment={environment} />

        <article className="cc2-panel cc2-health-panel">
          <PanelHeading kicker="NETWORK HEALTH" title="ความพร้อมระบบ" />
          <div className="cc2-health-ring">
            <div><strong>{summary.readiness}%</strong><span>OPERATIONAL</span></div>
          </div>
          <div className="cc2-health-list">
            <div className="cc2-health-row"><span>เซนเซอร์</span><strong>24 / 24</strong><div className="cc2-health-bar"><i style={{ width: "100%" }} /></div></div>
            <div className="cc2-health-row"><span>กล้อง CCTV</span><strong>16 / 16</strong><div className="cc2-health-bar"><i style={{ width: "100%" }} /></div></div>
            <div className="cc2-health-row"><span>Latency เฉลี่ย</span><strong>1.8 วินาที</strong><div className="cc2-health-bar"><i style={{ width: "88%" }} /></div></div>
          </div>
        </article>

        <article className="cc2-panel cc2-trust-panel">
          <PanelHeading kicker="DATA TRUST" title="ความน่าเชื่อถือข้อมูล" />
          <div className="cc2-trust-score"><strong>{trustScore}</strong><span>/ 100 · HIGH</span></div>
          <div className="cc2-trust-list">
            {[
              { id: "dwr-ews", label: "DWR OFFICIAL", type: "official" },
              { id: "tmd-warning", label: "TMD OFFICIAL", type: "official" },
              { id: "air4thai", label: "PCD OFFICIAL", type: "official" },
              { id: "open-meteo", label: "MODEL", type: "model" },
            ].map((source) => {
              const current = environment.sources.find((item) => item.id === source.id);
              return (
                <div className="cc2-trust-row" key={source.id}>
                  <i className={source.type === "model" ? "model" : current?.status === "online" ? "" : "offline"} />
                  <strong>{source.label}</strong>
                  <span>{current?.status === "online" ? "LIVE" : "FALLBACK"}</span>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <StationTable />
    </>
  );
}
