import { useMemo } from "react";
import { AlertTriangle, ChevronRight, CloudRain, CloudSun, Layers3, Waves, Wind } from "lucide-react";
import { FALLBACK_ENVIRONMENT, STATIONS, aqiLabel, formatNumber, weatherLabel, type EnvironmentData } from "./CommandCenterV2Data";
import {
  isDwrLive,
  operationalStationStatus,
  sourceDisplayState,
  sourceStateLabel,
  type SourceDisplayState,
} from "./CommandCenterV2Policy";
import { OperationalMap, PanelHeading, RainPanel, StationTable, StatusTag } from "./CommandCenterV2Shared";

const SOURCE_SUMMARY = [
  { id: "dwr-ews", label: "DWR OFFICIAL" },
  { id: "tmd-warning", label: "TMD OFFICIAL" },
  { id: "air4thai", label: "PCD OFFICIAL" },
  { id: "open-meteo", label: "POINT MODEL" },
] as const;

function sourceToneClass(state: SourceDisplayState) {
  return state;
}

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
    const critical = STATIONS.filter((station) => operationalStationStatus(station) === "critical").length;
    const warning = STATIONS.filter((station) => operationalStationStatus(station) === "warning").length;
    const normal = STATIONS.length - critical - warning;
    return { critical, warning, normal };
  }, []);

  const situationTone = summary.critical > 0 ? "critical" : summary.warning > 0 ? "watch" : "online";
  const situationLabel = summary.critical > 0 ? "วิกฤต" : summary.warning > 0 ? "เฝ้าระวัง" : "ปกติ";
  const situationTitle = summary.critical > 0
    ? "ต้องดำเนินการทันที"
    : summary.warning > 0
      ? "ติดตามอย่างใกล้ชิด"
      : "ไม่มีเหตุการณ์ผิดปกติ";
  const situationDetail = summary.critical > 0
    ? `WL03 สูงกว่าเกณฑ์ Critical 0.04 ม. และมี ${summary.warning} จุดอยู่ในแถบเฝ้าระวัง`
    : summary.warning > 0
      ? `มี ${summary.warning} จุดเข้าใกล้หรือถึงเกณฑ์เฝ้าระวัง`
      : "สถานีทั้งหมดอยู่ในช่วงปกติ";

  const sourceStates = SOURCE_SUMMARY.map((source) => ({
    ...source,
    state: sourceDisplayState(environment, source.id, fallbackMode),
  }));
  const stateFor = (id: string) => sourceStates.find((source) => source.id === id)?.state ?? "offline";
  const activeSourceCount = sourceStates.filter((source) => source.state === "live" || source.state === "model").length;
  const coverageScore = Math.round((activeSourceCount / SOURCE_SUMMARY.length) * 100);
  const dwrLive = isDwrLive(environment, fallbackMode);
  const dwr = dwrLive ? environment.dwr : FALLBACK_ENVIRONMENT.dwr;
  const tmdState = stateFor("tmd-warning");
  const airState = stateFor("air4thai");
  const weatherState = stateFor("open-meteo");

  const wl01 = STATIONS[0];
  const wl03 = STATIONS[1];
  const tmdWarning = environment.tmd.warnings.find((warning) => warning.relevant && warning.fresh);
  const tmdStatusText = tmdState === "live"
    ? tmdWarning ? "มีประกาศ" : "ไม่พบประกาศ"
    : sourceStateLabel(tmdState);
  const tmdStatusClass = tmdWarning ? "danger" : tmdState === "live" ? "good" : tmdState === "offline" ? "offline" : "watch";
  const airFootClass = airState === "live"
    ? (environment.air.aqi ?? 0) > 150 ? "bad" : (environment.air.aqi ?? 0) > 50 ? "watch" : "good"
    : airState === "offline" ? "bad" : "watch";
  const decisionText = tmdWarning
    ? `ตรวจสอบการระบายที่ WL03 และติดตาม WL08 ทุก 15 นาที พร้อมตรวจประกาศ TMD: ${tmdWarning.title}`
    : tmdState === "live"
      ? "ตรวจสอบการระบายที่ WL03 และติดตาม WL08 ต่อเนื่องทุก 15 นาที ขณะนี้ยังไม่พบประกาศ TMD ที่ตรงพื้นที่"
      : "ตรวจสอบการระบายที่ WL03 และติดตาม WL08 ทุก 15 นาที พร้อมตรวจ TMD จากช่องทางสำรอง เนื่องจากต้นทางยังยืนยันสถานะไม่ได้";

  return (
    <>
      <article className={`cc2-mission ${situationTone}`}>
        <section className="cc2-readiness">
          <div className={`cc2-state-kicker ${situationTone}`}><i /> SITUATION STATUS</div>
          <div className="cc2-state-main cc2-state-main-alert">
            <div className={`cc2-state-word ${situationTone}`}>{situationLabel}</div>
            <div className="cc2-state-copy">
              <strong>{situationTitle}</strong>
              <span>{situationDetail}</span>
            </div>
          </div>
          <div className="cc2-state-meta">
            <StatusTag tone="critical">{summary.critical} CRITICAL</StatusTag>
            <StatusTag tone="watch">{summary.warning} WATCH</StatusTag>
            <StatusTag tone="online">40 DEVICES ONLINE</StatusTag>
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
            <div className="cc2-vital-foot watch">{sourceStateLabel(weatherState)} · โอกาสสูงสุด {formatNumber(environment.weather.next24hMaxRainProbability, 0)}%</div>
          </div>
          <div className="cc2-vital">
            <div className="cc2-vital-head"><span>คุณภาพอากาศ</span><Wind size={14} /></div>
            <div className="cc2-vital-value">{formatNumber(environment.air.aqi, 0)}<small>AQI</small></div>
            <div className={`cc2-vital-foot ${airFootClass}`}>{sourceStateLabel(airState)} · PM2.5 {formatNumber(environment.air.pm25)} µg/m³ · {aqiLabel(environment.air.aqi)}</div>
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
            <div><span>สถานะ TMD</span><strong className={tmdStatusClass}>{tmdStatusText}</strong></div>
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
              <div className="cc2-queue-item watch">
                <i className="watch" />
                <div><strong>WL08 อยู่ในแถบเฝ้าระวัง</strong><span>เหลือระยะ 0.07 ม. ก่อนถึง Warning และมีแนวโน้มเพิ่มขึ้น</span></div>
                <time>LIVE</time>
              </div>
              <div className={`cc2-queue-item ${dwrLive ? "online" : "dummy"}`}>
                <i className={dwrLive ? "good" : "watch"} />
                <div><strong>{dwrLive ? "ข้อมูล DWR รับครบตามรอบ" : "DWR ใช้ค่า DUMMY ชั่วคราว"}</strong><span>{dwr.stationId} · {dwr.stationName}</span></div>
                <time>{dwrLive ? "LIVE" : "DUMMY"}</time>
              </div>
              <div className="cc2-queue-item online">
                <i className="good" />
                <div><strong>กล้องและเซนเซอร์ออนไลน์ครบ</strong><span>24 sensors · 16 cameras</span></div>
                <time>LIVE</time>
              </div>
            </section>

            <section className="cc2-decision">
              <div className="cc2-decision-head"><strong>คำแนะนำระบบ</strong><span>ASSISTED DECISION</span></div>
              <p>{decisionText}</p>
              <button onClick={onOpenWater}>เปิด Operational Playbook <ChevronRight size={14} /></button>
            </section>
          </div>
        </aside>
      </section>

      <section className="cc2-intelligence-grid">
        <RainPanel environment={environment} />

        <article className="cc2-panel cc2-health-panel">
          <PanelHeading kicker="SYSTEM AVAILABILITY" title="ความพร้อมของอุปกรณ์" />
          <div className="cc2-health-ring">
            <div><strong>100%</strong><span>40 / 40 ONLINE</span></div>
          </div>
          <div className="cc2-health-list">
            <div className="cc2-health-row"><span>เซนเซอร์</span><strong>24 / 24</strong><div className="cc2-health-bar"><i style={{ width: "100%" }} /></div></div>
            <div className="cc2-health-row"><span>กล้อง CCTV</span><strong>16 / 16</strong><div className="cc2-health-bar"><i style={{ width: "100%" }} /></div></div>
            <div className="cc2-health-row"><span>Latency เฉลี่ย</span><strong>1.8 วินาที</strong><div className="cc2-health-bar"><i style={{ width: "88%" }} /></div></div>
          </div>
        </article>

        <article className="cc2-panel cc2-trust-panel">
          <PanelHeading kicker="SOURCE COVERAGE" title="ความครบถ้วนของข้อมูล" />
          <div className="cc2-trust-score"><strong>{coverageScore}</strong><span>/ 100 · {activeSourceCount}/4 SOURCES</span></div>
          <div className="cc2-trust-list">
            {sourceStates.map((source) => (
              <div className={`cc2-trust-row ${sourceToneClass(source.state)}`} key={source.id}>
                <i className={sourceToneClass(source.state)} />
                <strong>{source.label}</strong>
                <span>{sourceStateLabel(source.state)}</span>
              </div>
            ))}
          </div>
          {!dwrLive && <p className="cc2-source-explainer">DWR แสดงค่าทดสอบชั่วคราวและไม่ถูกนับเป็นแหล่งข้อมูลสด</p>}
        </article>
      </section>

      <StationTable />
    </>
  );
}
