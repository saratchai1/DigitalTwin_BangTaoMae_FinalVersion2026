import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CloudRain,
  CloudSun,
  Waves,
  Wind,
  X,
} from "lucide-react";
import {
  FALLBACK_ENVIRONMENT,
  STATIONS,
  aqiLabel,
  formatNumber,
  weatherLabel,
  type EnvironmentData,
} from "./CommandCenterV2Data";
import {
  airQualityDisplayState,
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
  const [playbookOpen, setPlaybookOpen] = useState(false);

  useEffect(() => {
    if (!playbookOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlaybookOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [playbookOpen]);

  const summary = useMemo(() => {
    const critical = STATIONS.filter((station) => operationalStationStatus(station) === "critical").length;
    const warning = STATIONS.filter((station) => operationalStationStatus(station) === "warning").length;
    const normal = STATIONS.length - critical - warning;
    return { critical, warning, normal };
  }, []);

  const situationTone = summary.critical > 0 ? "critical" : summary.warning > 0 ? "watch" : "online";
  const situationLabel = summary.critical > 0 ? "วิกฤต" : summary.warning > 0 ? "เฝ้าระวัง" : "ปกติ";
  const situationTitle = summary.critical > 0
    ? "ต้องตรวจสอบและดำเนินการ"
    : summary.warning > 0
      ? "ติดตามอย่างใกล้ชิด"
      : "ไม่พบสถานีผิดปกติ";
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
  const airState = airQualityDisplayState(environment, fallbackMode);
  const weatherState = stateFor("open-meteo");

  const wl01 = STATIONS[0];
  const wl03 = STATIONS[1];
  const tmdWarning = environment.tmd.warnings.find((warning) => warning.relevant && warning.fresh);
  const tmdStatusText = tmdState === "live"
    ? tmdWarning ? "มีประกาศ" : "ไม่พบประกาศ"
    : sourceStateLabel(tmdState);
  const tmdStatusClass = tmdWarning
    ? "danger"
    : tmdState === "live"
      ? "good"
      : tmdState === "offline"
        ? "offline"
        : "watch";

  const airFootClass = airState === "live"
    ? (environment.air.aqi ?? 0) > 150
      ? "bad"
      : (environment.air.aqi ?? 0) > 50
        ? "watch"
        : "good"
    : airState === "offline"
      ? "bad"
      : "watch";

  const rain24 = environment.weather.next24hRain ?? 0;
  const rainProbability = environment.weather.next24hMaxRainProbability ?? 0;
  const rainFootClass = weatherState === "offline"
    ? "bad"
    : weatherState === "fallback"
      ? "watch"
      : rain24 >= 70
        ? "bad"
        : rain24 >= 30 || rainProbability >= 70
          ? "watch"
          : "good";

  const decisionText = tmdWarning
    ? `ตรวจสอบ WL03, ติดตาม WL08 ทุก 15 นาที และตรวจประกาศ TMD: ${tmdWarning.title}`
    : tmdState === "live"
      ? "ตรวจสอบ WL03 และติดตาม WL08 ทุก 15 นาที ขณะนี้ยังไม่พบประกาศ TMD ที่ตรงพื้นที่"
      : "ตรวจสอบ WL03 และ WL08 พร้อมยืนยันสถานการณ์จากช่องทาง TMD สำรอง เพราะต้นทางยังยืนยันสถานะไม่ได้";

  const openWaterFromPlaybook = () => {
    setPlaybookOpen(false);
    onOpenWater();
  };

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
            <StatusTag tone="online">40 ENDPOINTS CONFIGURED</StatusTag>
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
            <div className={`cc2-vital-foot ${rainFootClass}`}>{sourceStateLabel(weatherState)} · โอกาสสูงสุด {formatNumber(rainProbability, 0)}%</div>
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

      <section className="cc2-status-key" aria-label="คำอธิบายสีสถานะ">
        <div className="normal"><i /> <strong>เขียว · ปกติ</strong><span>ไม่มีเงื่อนไขที่ต้องติดตาม</span></div>
        <div className="watch"><i /> <strong>เหลือง · เฝ้าระวัง</strong><span>ถึงหรืออยู่ภายใน 0.10 ม. จาก Warning</span></div>
        <div className="critical"><i /> <strong>แดง · วิกฤต</strong><span>ถึงหรือสูงกว่า Critical</span></div>
        <div className="snapshot"><strong>PROJECT STATIONS</strong><span>DEMO SNAPSHOT</span></div>
      </section>

      <section className="cc2-ops-grid">
        <article className="cc2-panel">
          <PanelHeading
            kicker="OPERATIONAL TWIN"
            title="โครงข่ายน้ำและจุดตรวจวัด"
            action={<button className="cc2-primary-action" onClick={onOpenWater}>เปิดเครือข่ายน้ำ <ChevronRight size={14} /></button>}
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
                <button onClick={() => setPlaybookOpen(true)}>เปิดแผนตอบสนอง</button>
                <button onClick={onOpenWater}>ดูสถานี</button>
              </div>
            </section>

            <section className="cc2-queue">
              <div className="cc2-queue-title"><strong>เหตุการณ์ล่าสุด</strong><span>3 รายการ</span></div>
              <div className="cc2-queue-item watch">
                <i className="watch" />
                <div><strong>WL08 อยู่ในแถบเฝ้าระวัง</strong><span>เหลือ 0.07 ม. ก่อนถึง Warning และมีแนวโน้มเพิ่มขึ้น</span></div>
                <time>SNAPSHOT</time>
              </div>
              <div className={`cc2-queue-item ${dwrLive ? "online" : "dummy"}`}>
                <i className={dwrLive ? "good" : "watch"} />
                <div><strong>{dwrLive ? "ข้อมูล DWR รับได้จากต้นทาง" : "DWR ใช้ค่า DUMMY ชั่วคราว"}</strong><span>{dwr.stationId} · {dwr.stationName}</span></div>
                <time>{dwrLive ? "LIVE" : "DUMMY"}</time>
              </div>
              <div className="cc2-queue-item configured">
                <i className="configured" />
                <div><strong>กำหนดปลายทางอุปกรณ์ครบ</strong><span>24 sensor endpoints · 16 camera slots</span></div>
                <time>CONFIG</time>
              </div>
            </section>

            <section className="cc2-decision">
              <div className="cc2-decision-head"><strong>คำแนะนำระบบ</strong><span>ASSISTED DECISION</span></div>
              <p>{decisionText}</p>
              <button onClick={() => setPlaybookOpen(true)}>เปิด Operational Playbook <ChevronRight size={14} /></button>
            </section>
          </div>
        </aside>
      </section>

      <section className="cc2-intelligence-grid">
        <RainPanel environment={environment} />

        <article className="cc2-panel cc2-health-panel">
          <PanelHeading kicker="SYSTEM CONFIGURATION" title="ความพร้อมของจุดเชื่อมต่อ" />
          <div className="cc2-health-ring configured">
            <div><strong>100%</strong><span>40 / 40 CONFIGURED</span></div>
          </div>
          <div className="cc2-health-list">
            <div className="cc2-health-row"><span>Sensor endpoints</span><strong>24 / 24</strong><div className="cc2-health-bar"><i style={{ width: "100%" }} /></div></div>
            <div className="cc2-health-row"><span>Camera slots</span><strong>16 / 16</strong><div className="cc2-health-bar"><i style={{ width: "100%" }} /></div></div>
            <div className="cc2-health-row"><span>Live telemetry</span><strong>รอเชื่อมต่อ</strong><div className="cc2-health-bar watch"><i style={{ width: "18%" }} /></div></div>
          </div>
        </article>

        <article className="cc2-panel cc2-trust-panel">
          <PanelHeading kicker="SOURCE COVERAGE" title="ความครบถ้วนของข้อมูล" />
          <div className="cc2-trust-score"><strong>{coverageScore}</strong><span>/ 100 · {activeSourceCount}/4 ACTIVE</span></div>
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

      {playbookOpen && (
        <div className="cc2-dialog-backdrop" onMouseDown={() => setPlaybookOpen(false)}>
          <section
            className="cc2-playbook-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc2-playbook-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>OPERATIONAL PLAYBOOK · WL03</p>
                <h2 id="cc2-playbook-title">ขั้นตอนตรวจสอบเมื่อระดับน้ำเกิน Critical</h2>
              </div>
              <button onClick={() => setPlaybookOpen(false)} aria-label="ปิดแผนตอบสนอง"><X size={18} /></button>
            </header>
            <div className="cc2-playbook-warning">
              <AlertTriangle size={18} />
              <span>ข้อมูลสถานีโครงการในหน้านี้เป็น Demo Snapshot ต้องยืนยันค่าจาก sensor/CCTV จริงก่อนสั่งการภาคสนาม</span>
            </div>
            <ol className="cc2-playbook-steps">
              <li><CheckCircle2 size={17} /><div><strong>ยืนยันค่าตรวจวัด</strong><span>ตรวจ sensor ซ้ำและเทียบภาพ CCTV ที่ WL03 เพื่อคัดกรองค่าผิดปกติ</span></div></li>
              <li><CheckCircle2 size={17} /><div><strong>ตรวจแนวโน้มต้นน้ำ–ปลายน้ำ</strong><span>เปรียบเทียบ WL01, WL06 และ WL08 เพื่อระบุตำแหน่งคอขวดหรือการระบายที่ผิดปกติ</span></div></li>
              <li><CheckCircle2 size={17} /><div><strong>ตรวจบริบทฝนและประกาศทางการ</strong><span>ใช้ TMD/DWR ที่เป็น LIVE เท่านั้น; MODEL และ DUMMY ใช้ประกอบการคัดกรอง ไม่ใช่คำสั่งราชการ</span></div></li>
              <li><CheckCircle2 size={17} /><div><strong>ดำเนินการตามอำนาจอนุมัติ</strong><span>การเปิด–ปิดหรือปรับการระบายต้องผ่านผู้รับผิดชอบที่ได้รับมอบหมายและบันทึกเหตุผลทุกครั้ง</span></div></li>
              <li><CheckCircle2 size={17} /><div><strong>ติดตามและบันทึกผล</strong><span>ติดตามทุก 15 นาทีจนต่ำกว่า Warning และเก็บเวลา ผู้ดำเนินการ และค่าก่อน–หลัง</span></div></li>
            </ol>
            <footer>
              <button className="secondary" onClick={() => setPlaybookOpen(false)}>ปิด</button>
              <button className="primary" onClick={openWaterFromPlaybook}>ไปหน้าเครือข่ายน้ำ <ChevronRight size={14} /></button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
