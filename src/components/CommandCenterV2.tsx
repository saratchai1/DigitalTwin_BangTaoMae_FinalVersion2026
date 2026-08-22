import { useCallback, useEffect, useState } from "react";
import { Camera, ChevronRight, Leaf, LayoutDashboard, Menu, Moon, RefreshCw, Sun, Waves, X } from "lucide-react";
import { FALLBACK_ENVIRONMENT, PAGE_META, normalizeEnvironment, type EnvironmentData, type MenuKey } from "./CommandCenterV2Data";
import { sourceDisplayState, sourceStateLabel } from "./CommandCenterV2Policy";
import { OverviewPage } from "./CommandCenterV2Overview";
import { EnvironmentPage, SurveillancePage, WaterPage } from "./CommandCenterV2Pages";
import "./CommandCenterV2.core.css";
import "./CommandCenterV2.overview.css";
import "./CommandCenterV2.pages.css";
import "./CommandCenterV2.responsive.css";
import "./CommandCenterV2.status.css";
import "./CommandCenterV2.final.css";
import "./CommandCenterV2.review.css";

export interface CommandCenterV2Props {
  iTwinId: string;
  iModelId: string;
  changesetId?: string;
}

const MENU_ITEMS: Array<{
  key: MenuKey;
  label: string;
  caption: string;
  shortLabel: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "overview", label: "ภาพรวมศูนย์สั่งการ", caption: "Situation awareness", shortLabel: "ภาพรวม", icon: LayoutDashboard },
  { key: "water", label: "เครือข่ายน้ำ", caption: "Reservoir & canal", shortLabel: "น้ำ", icon: Waves },
  { key: "environment", label: "สิ่งแวดล้อม", caption: "Weather & hazards", shortLabel: "สิ่งแวดล้อม", icon: Leaf },
  { key: "surveillance", label: "กล้องเฝ้าระวัง", caption: "16 demo slots", shortLabel: "กล้อง", icon: Camera },
];

const SOURCE_ITEMS = [
  { id: "dwr-ews", label: "DWR · น้ำและฝน" },
  { id: "tmd-warning", label: "TMD · ประกาศเตือน" },
  { id: "air4thai", label: "PCD · คุณภาพอากาศ" },
  { id: "open-meteo", label: "Point forecast" },
] as const;

export function CommandCenterV2(_props: CommandCenterV2Props) {
  const [activeMenu, setActiveMenu] = useState<MenuKey>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const [now, setNow] = useState(new Date());
  const [environment, setEnvironment] = useState<EnvironmentData>(FALLBACK_ENVIRONMENT);
  const [fallbackMode, setFallbackMode] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = isLight ? "light" : "dark";
  }, [isLight]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshEnvironment = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/.netlify/functions/environment-intelligence-v2", {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`environment-intelligence-v2 ${response.status}`);
      const payload = (await response.json()) as Partial<EnvironmentData>;
      setEnvironment(normalizeEnvironment(payload));
      setFallbackMode(false);
    } catch {
      setEnvironment(normalizeEnvironment(FALLBACK_ENVIRONMENT));
      setFallbackMode(true);
    } finally {
      window.setTimeout(() => setRefreshing(false), 350);
    }
  }, []);

  useEffect(() => {
    void refreshEnvironment();
    const timer = window.setInterval(() => void refreshEnvironment(), 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [refreshEnvironment]);

  const page = PAGE_META[activeMenu];
  const sourceStates = SOURCE_ITEMS.map((source) => ({
    ...source,
    state: sourceDisplayState(environment, source.id, fallbackMode),
  }));
  const hasSourceIssue = sourceStates.some((source) => ["dummy", "fallback", "offline"].includes(source.state));
  const syncText = fallbackMode
    ? "ใช้ fixture ในเครื่อง · ไม่มีข้อมูลสด"
    : hasSourceIssue
      ? "ข้อมูลสดบางส่วน · ตรวจ Source Status"
      : `ข้อมูลล่าสุด ${new Date(environment.generatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;

  const navigate = (key: MenuKey) => {
    setActiveMenu(key);
    setMobileMenuOpen(false);
    window.requestAnimationFrame(() => {
      document.querySelector(".cc2-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  return (
    <div className="cc2-app">
      <aside className={`cc2-rail ${mobileMenuOpen ? "open" : ""}`}>
        <div className="cc2-brand">
          <div className="cc2-brand-mark"><Waves size={24} /></div>
          <div><p>BANG TAO MAE</p><h2>Command Center</h2></div>
          <button type="button" className="cc2-close" onClick={() => setMobileMenuOpen(false)} aria-label="ปิดเมนู"><X size={19} /></button>
        </div>

        <div className="cc2-online-pill configured"><i /> ปลายทางระบบกำหนดครบ <strong>40 / 40</strong></div>

        <nav className="cc2-nav" aria-label="เมนูหลัก">
          <p>MISSION CONTROL</p>
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button type="button" key={item.key} className={activeMenu === item.key ? "active" : ""} onClick={() => navigate(item.key)}>
                <span className="cc2-nav-icon"><Icon size={18} /></span>
                <span className="cc2-nav-copy"><strong>{item.label}</strong><small>{item.caption}</small></span>
                <ChevronRight size={14} className="cc2-nav-chevron" />
              </button>
            );
          })}
        </nav>

        <div className="cc2-rail-spacer" />

        <section className="cc2-source-card" aria-label="สถานะแหล่งข้อมูล">
          <div className="cc2-source-title"><strong>Source status</strong><span>4 SOURCES</span></div>
          {sourceStates.map((source) => (
            <div className={`cc2-source-row ${source.state}`} key={source.id}>
              <i className={source.state} />
              <span>{source.label}</span>
              <em>{sourceStateLabel(source.state)}</em>
            </div>
          ))}
        </section>

        <div className="cc2-monitoring-note">
          <i />
          <div><strong>MONITORING MODE</strong><span>Read-only dashboard · ไม่มีคำสั่งอุปกรณ์จริง</span></div>
        </div>
      </aside>

      {mobileMenuOpen && <button type="button" className="cc2-backdrop" onClick={() => setMobileMenuOpen(false)} aria-label="ปิดเมนู" />}

      <main className="cc2-workspace">
        <header className="cc2-topbar">
          <div className="cc2-topbar-title">
            <button type="button" className="cc2-icon-button cc2-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="เปิดเมนู"><Menu size={19} /></button>
            <div><p>{page.kicker}</p><h1>{page.title}</h1><span>{page.description}</span></div>
          </div>
          <div className="cc2-topbar-actions">
            <div className={`cc2-sync-chip ${fallbackMode || hasSourceIssue ? "fallback" : ""}`} aria-live="polite"><i /> {syncText}</div>
            <button type="button" className="cc2-icon-button" onClick={() => void refreshEnvironment()} disabled={refreshing} aria-label="อัปเดตข้อมูล"><RefreshCw size={16} className={refreshing ? "spin" : ""} /></button>
            <button type="button" className="cc2-icon-button cc2-theme-button" onClick={() => setIsLight((current) => !current)} aria-label={isLight ? "เปลี่ยนเป็นโหมดมืด" : "เปลี่ยนเป็นโหมดสว่าง"}>{isLight ? <Moon size={16} /> : <Sun size={16} />}</button>
            <div className="cc2-clock"><strong>{now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong><span>{now.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</span></div>
          </div>
        </header>

        <div className="cc2-scroll">
          <div className="cc2-page">
            {activeMenu === "overview" && <OverviewPage environment={environment} fallbackMode={fallbackMode} onOpenWater={() => navigate("water")} />}
            {activeMenu === "water" && <WaterPage />}
            {activeMenu === "environment" && <EnvironmentPage environment={environment} fallbackMode={fallbackMode} />}
            {activeMenu === "surveillance" && <SurveillancePage now={now} />}
          </div>
        </div>

        <nav className="cc2-bottom-nav" aria-label="เมนูมือถือ">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button type="button" key={item.key} className={activeMenu === item.key ? "active" : ""} onClick={() => navigate(item.key)}>
                <Icon size={19} />
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
