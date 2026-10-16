import { useEffect, useRef, useState } from "react";
import { Camera, ExternalLink, Radio, RefreshCw } from "lucide-react";
import "./HighwayLiveCCTV.css";

type PlayerStatus = "loading" | "live" | "buffering" | "paused" | "ready" | "unavailable";
type HlsInstance = { loadSource: (url: string) => void; attachMedia: (video: HTMLVideoElement) => void; on: (event: string, handler: (...args: unknown[]) => void) => void; startLoad: () => void; recoverMediaError: () => void; destroy: () => void };
type HlsConstructor = { new (config?: Record<string, unknown>): HlsInstance; isSupported: () => boolean; Events: { MANIFEST_PARSED: string; ERROR: string }; ErrorTypes: { NETWORK_ERROR: string; MEDIA_ERROR: string } };
declare global { interface Window { Hls?: HlsConstructor; __cc2HlsLoader?: Promise<HlsConstructor>; } }

export const HIGHWAY_CCTV_CONFIG = {
  cameraId: "PER-14-007", highway: "4", controlSection: "1101",
  locationName: "เขาคราม–ตลาดเก่า", routeLabel: "ทล.4 เขาคราม–ตลาดเก่า", kilometer: "กม.956+105",
  sourceLabel: "กรมทางหลวง · Department of Highways",
  sourcePage: "https://highwaytraffic.go.th/DOHWeb/Home.aspx",
  stableMaster: "https://streaming2.highwaytraffic.go.th/PER-14/PER_14_007.stream/playlist.m3u8",
  proxyEntry: "/.netlify/functions/doh-hls-proxy",
} as const;
const HLS_JS_CDN = "https://cdn.jsdelivr.net/npm/hls.js@1.7.1/dist/hls.min.js";

function loadHlsJs(): Promise<HlsConstructor> {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (window.__cc2HlsLoader) return window.__cc2HlsLoader;
  const promise = new Promise<HlsConstructor>((resolve, reject) => {
    document.querySelector('script[data-cc2-hls="true"]')?.remove();
    const script = document.createElement("script");
    const timer = window.setTimeout(() => { script.remove(); reject(new Error("HLS_LOADER_TIMEOUT")); }, 10_000);
    script.src = HLS_JS_CDN; script.async = true; script.dataset.cc2Hls = "true";
    script.onload = () => { clearTimeout(timer); window.Hls ? resolve(window.Hls) : reject(new Error("HLS_UNAVAILABLE")); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error("HLS_LOADER_FAILED")); };
    document.head.appendChild(script);
  });
  window.__cc2HlsLoader = promise;
  void promise.catch(() => { if (window.__cc2HlsLoader === promise) window.__cc2HlsLoader = undefined; });
  return promise;
}

const STATUS_LABEL: Record<PlayerStatus, string> = { loading: "CONNECTING", live: "LIVE CCTV", buffering: "กำลังรอภาพ", paused: "หยุดภาพชั่วคราว", ready: "กดเพื่อดูภาพ", unavailable: "รับภาพไม่ได้" };

export function HighwayLiveCCTV({ compact = false }: { compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false; let failed = false; let hls: HlsInstance | null = null;
    let networkRecoveries = 0; let mediaRecoveries = 0;
    let lastTime = -1; let lastProgress = Date.now(); let hasPlayed = false; let awaitingGesture = false;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); if (!disposed && !failed) fn(); }, ms); timers.add(id); };
    const update = (next: PlayerStatus) => { if (!disposed && !failed) setStatus(next); };
    const unavailable = () => {
      if (disposed || failed) return;
      failed = true; setStatus("unavailable"); hls?.destroy(); hls = null;
      video.pause(); video.removeAttribute("src"); video.load();
    };
    const play = async () => {
      try { await video.play(); }
      catch (error) { if (!disposed && !failed && (error as DOMException).name === "NotAllowedError") { awaitingGesture = true; update("ready"); } }
    };
    const onPlaying = () => { hasPlayed = true; awaitingGesture = false; lastProgress = Date.now(); if (video.videoWidth > 0) update("live"); };
    const onWaiting = () => { if (hasPlayed && !video.paused) update("buffering"); };
    const onPause = () => { if (hasPlayed) update("paused"); };
    const onEnded = () => unavailable();
    const onTime = () => { if (video.currentTime !== lastTime && video.videoWidth > 0) { lastTime = video.currentTime; lastProgress = Date.now(); hasPlayed = true; if (!video.paused && video.readyState >= 2) update("live"); } };
    video.addEventListener("playing", onPlaying); video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onWaiting); video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded); video.addEventListener("timeupdate", onTime);
    setStatus("loading");
    const watchdog = window.setInterval(() => {
      if (disposed || failed || awaitingGesture || document.hidden || (hasPlayed && video.paused)) return;
      const silent = Date.now() - lastProgress;
      if (silent > (hasPlayed ? 20_000 : 30_000)) unavailable();
      else if (hasPlayed && silent > 5_000) update("buffering");
    }, 2_000);
    const boot = async () => {
      // Same-origin TLS-validating proxy first. Do not cycle through expired session chunklists.
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.addEventListener("error", unavailable);
        video.src = HIGHWAY_CCTV_CONFIG.proxyEntry; video.load(); void play(); return;
      }
      try {
        const Hls = await loadHlsJs();
        if (disposed || failed) return;
        if (!Hls.isSupported()) { unavailable(); return; }
        hls = new Hls({ enableWorker: true, lowLatencyMode: false, liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 8, maxBufferLength: 18, manifestLoadingTimeOut: 12_000, fragLoadingTimeOut: 12_000 });
        hls.on(Hls.Events.MANIFEST_PARSED, () => { if (!disposed && !failed) void play(); });
        hls.on(Hls.Events.ERROR, (...args: unknown[]) => {
          const data = args[1] as { fatal?: boolean; type?: string } | undefined;
          if (!data?.fatal || disposed || failed) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveries++ < 2) { update("buffering"); later(() => hls?.startLoad(), 900); return; }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries++ < 1) { hls?.recoverMediaError(); return; }
          unavailable();
        });
        hls.loadSource(HIGHWAY_CCTV_CONFIG.proxyEntry); hls.attachMedia(video);
      } catch { unavailable(); }
    };
    void boot();
    return () => {
      disposed = true; clearInterval(watchdog); timers.forEach(clearTimeout); hls?.destroy();
      video.removeEventListener("playing", onPlaying); video.removeEventListener("waiting", onWaiting); video.removeEventListener("stalled", onWaiting);
      video.removeEventListener("pause", onPause); video.removeEventListener("ended", onEnded); video.removeEventListener("timeupdate", onTime); video.removeEventListener("error", unavailable);
      video.pause(); video.removeAttribute("src"); video.load();
    };
  }, [retryKey]);

  return (
    <section className={`cc2-highway-cctv ${compact ? "compact" : ""}`}>
      <header className="cc2-highway-cctv-head">
        <div className="cc2-highway-cctv-title"><span className="cc2-highway-cctv-icon"><Camera size={19} /></span><div>
          <p>EXTERNAL LIVE CCTV · กรมทางหลวง</p><h2>CCTV กรมทางหลวง — {HIGHWAY_CCTV_CONFIG.cameraId}</h2>
          <span>ทล.{HIGHWAY_CCTV_CONFIG.highway} · ตอนควบคุม {HIGHWAY_CCTV_CONFIG.controlSection} · {HIGHWAY_CCTV_CONFIG.kilometer}</span>
        </div></div>
        <div className={`cc2-highway-live-badge ${status}`} role="status" aria-live="polite"><i />{STATUS_LABEL[status]}</div>
      </header>
      <div className="cc2-highway-video-wrap">
        <video ref={videoRef} muted playsInline autoPlay controls preload="metadata" aria-label={`ภาพกล้อง ${HIGHWAY_CCTV_CONFIG.cameraId} ${HIGHWAY_CCTV_CONFIG.kilometer}`} />
        {(status === "loading" || status === "buffering") && <div className="cc2-highway-video-state loading"><Radio size={23} /><strong>{status === "loading" ? "กำลังเชื่อมต่อภาพจากกรมทางหลวง" : "กำลังรอภาพจากต้นทาง"}</strong><span>PER-14-007 · ทล.4 · กม.956+105</span></div>}
        {status === "ready" && <button className="cc2-video-play" type="button" onClick={() => void videoRef.current?.play()}>กดเพื่อดูภาพสด</button>}
        {status === "unavailable" && <div className="cc2-highway-video-state unavailable"><Camera size={25} /><strong>ยังรับภาพจากกรมทางหลวงไม่ได้</strong><span>ไม่มีการใช้ภาพจำลองแทนภาพสด</span><button type="button" onClick={() => setRetryKey(value => value + 1)}><RefreshCw size={14} />ลองเชื่อมต่อใหม่</button></div>}
        <div className="cc2-highway-video-overlay"><span>{HIGHWAY_CCTV_CONFIG.cameraId}</span><strong>ทล.4 · ตอนควบคุม 1101 · กม.956+105</strong></div>
      </div>
      <footer className="cc2-highway-cctv-meta">
        <div><span>หมายเลขจุดสำรวจ</span><strong>{HIGHWAY_CCTV_CONFIG.cameraId}</strong></div>
        <div><span>ทางหลวง / ตอนควบคุม</span><strong>{HIGHWAY_CCTV_CONFIG.highway} / {HIGHWAY_CCTV_CONFIG.controlSection}</strong></div>
        <div><span>กม.จุดสำรวจ</span><strong>{HIGHWAY_CCTV_CONFIG.kilometer}</strong></div>
        <a href={HIGHWAY_CCTV_CONFIG.sourcePage} target="_blank" rel="noreferrer">แหล่งข้อมูล: กรมทางหลวง <ExternalLink size={13} /></a>
      </footer>
    </section>
  );
}
