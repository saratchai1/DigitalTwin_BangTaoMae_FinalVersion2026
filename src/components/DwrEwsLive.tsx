import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, CloudRain, ExternalLink, MapPin, Radio, RefreshCw, ShieldAlert } from "lucide-react";
import "./DwrEwsLive.css";

type EwsStatus = 0 | 1 | 2 | 3;

type DwrStation = {
  id: string;
  name: string;
  type: string | null;
  tambon: string;
  amphoe: string;
  province: string;
  basin: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  status: EwsStatus;
  warn: string | null;
  warningType: string | null;
  rain15m: number | null;
  rain12h: number | null;
  rainSince07: number | null;
  temperature: number | null;
  waterLevel: number | null;
  soilMoisture: number | null;
  observedAt: string | null;
};

type DwrResponse = {
  source: string;
  sourceUrl: string;
  radiusKm: number;
  fetchedAt: string;
  rainStation: DwrStation;
  area: {
    status: EwsStatus;
    stationCount: number;
    statusStation: DwrStation;
    warnings: DwrStation[];
  };
};

const STATUS: Record<EwsStatus, { label: string; description: string }> = {
  0: { label: "ปกติ", description: "ยังไม่มีสัญญาณเตือนภัยจาก DWR EWS" },
  1: { label: "เฝ้าระวัง", description: "DWR EWS ตรวจพบระดับที่ต้องเฝ้าระวัง" },
  2: { label: "เตรียมพร้อม", description: "DWR EWS อยู่ในระดับเตรียมพร้อม" },
  3: { label: "วิกฤต", description: "DWR EWS อยู่ในระดับวิกฤต / ต้องติดตามทันที" },
};

function formatRain(value: number | null) {
  return value === null ? "—" : value.toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatDistance(value: number) {
  return value.toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function stationPlace(station: DwrStation) {
  return [station.tambon ? `ต.${station.tambon}` : "", station.amphoe ? `อ.${station.amphoe}` : "", station.province ? `จ.${station.province}` : ""].filter(Boolean).join(" · ");
}

function observedLabel(value: string | null) {
  if (!value) return "ไม่ระบุเวลา";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function useDashboardMount() {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let ownedHost: HTMLElement | null = null;

    const placeHost = () => {
      const title = document.querySelector(".topbar-title h2")?.textContent ?? "";
      if (title.includes("กล้อง")) {
        if (ownedHost?.isConnected) ownedHost.remove();
        ownedHost = null;
        setMount(null);
        return;
      }

      const metricGrid = document.querySelector<HTMLElement>(".page-content > .metric-grid");
      if (!metricGrid) return;
      const existing = metricGrid.parentElement?.querySelector<HTMLElement>(":scope > .dwr-ews-host");
      if (existing) {
        if (mount !== existing) setMount(existing);
        ownedHost = existing;
        return;
      }

      const host = document.createElement("div");
      host.className = "dwr-ews-host";
      host.setAttribute("aria-live", "polite");
      metricGrid.insertAdjacentElement("afterend", host);
      ownedHost = host;
      setMount(host);
    };

    placeHost();
    const observer = new MutationObserver(placeHost);
    observer.observe(document.getElementById("root") ?? document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (ownedHost?.isConnected) ownedHost.remove();
    };
  }, []);

  return mount;
}

export function DwrEwsLive() {
  const mount = useDashboardMount();
  const [data, setData] = useState<DwrResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/.netlify/functions/dwr-ews", { headers: { Accept: "application/json" } });
      const payload = await response.json();
      if (!response.ok || payload?.error) throw new Error(payload?.error || `HTTP ${response.status}`);
      setData(payload);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "เชื่อมต่อ DWR EWS ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const status = useMemo(() => STATUS[data?.area.status ?? 0], [data]);
  if (!mount) return null;

  const content = (
    <section className={`dwr-ews-card dwr-status-${data?.area.status ?? 0}`}>
      <div className="dwr-ews-main">
        <div className="dwr-source-line">
          <span className="dwr-live-mark"><Radio size={13} /> LIVE GOVERNMENT DATA</span>
          <span>กรมทรัพยากรน้ำ · DWR EWS</span>
        </div>
        <div className="dwr-title-row">
          <div>
            <p className="dwr-eyebrow">ฝนตรวจวัดจริง + ระบบเตือนภัยล่วงหน้า</p>
            <h3>{error && !data ? "กำลังรอข้อมูลจาก DWR EWS" : data?.rainStation.name ?? "DWR EWS"}</h3>
          </div>
          <div className={`dwr-status-badge status-${data?.area.status ?? 0}`}>
            {data?.area.status === 0 ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
            <span><small>สถานะพื้นที่</small><strong>{status.label}</strong></span>
          </div>
        </div>

        {data ? (
          <div className="dwr-station-meta">
            <span><MapPin size={13} /> {stationPlace(data.rainStation) || "สถานี DWR EWS"}</span>
            <span>ห่างโครงการ {formatDistance(data.rainStation.distanceKm)} กม.</span>
            <span>ตรวจวัด {observedLabel(data.rainStation.observedAt)}</span>
          </div>
        ) : (
          <div className="dwr-station-meta"><span>{loading ? "กำลังเชื่อมต่อสถานีตรวจวัดจริง…" : error}</span></div>
        )}
      </div>

      <div className="dwr-rain-grid">
        <div className="dwr-rain-cell primary">
          <CloudRain size={18} />
          <span>ฝนล่าสุด</span>
          <strong>{data ? formatRain(data.rainStation.rain15m) : "—"}<small> มม.</small></strong>
          <em>ช่วงตรวจวัด 15 นาที</em>
        </div>
        <div className="dwr-rain-cell">
          <span>สะสม 12 ชม.</span>
          <strong>{data ? formatRain(data.rainStation.rain12h) : "—"}<small> มม.</small></strong>
          <em>ค่าจากสถานีจริง</em>
        </div>
        <div className="dwr-rain-cell">
          <span>ตั้งแต่ 07:00</span>
          <strong>{data ? formatRain(data.rainStation.rainSince07) : "—"}<small> มม.</small></strong>
          <em>ฝนสะสมรายวัน</em>
        </div>
      </div>

      <div className="dwr-alert-side">
        <div className="dwr-alert-heading">
          {data?.area.status === 0 ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <div><span>DWR EWS STATUS</span><strong>{status.label}</strong></div>
        </div>
        <p>{status.description}</p>
        {data && <div className="dwr-area-detail">รัศมี {data.radiusKm} กม. · พบ {data.area.stationCount} สถานี</div>}
        {data?.area.statusStation && data.area.status > 0 && (
          <div className="dwr-warning-station"><strong>{data.area.statusStation.name}</strong><span>{stationPlace(data.area.statusStation)} · {formatDistance(data.area.statusStation.distanceKm)} กม.</span></div>
        )}
        <div className="dwr-actions">
          <button type="button" onClick={() => void load()} disabled={loading} aria-label="อัปเดตข้อมูล DWR EWS"><RefreshCw size={14} className={loading ? "spin" : ""} /> อัปเดต</button>
          <a href="https://ews.dwr.go.th/ews/" target="_blank" rel="noreferrer">DWR EWS <ExternalLink size={13} /></a>
        </div>
        {error && <span className="dwr-error">อัปเดตล่าสุดไม่สำเร็จ: {error}</span>}
      </div>
    </section>
  );

  return createPortal(content, mount);
}
