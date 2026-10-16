import { useEffect, useRef, useState } from "react";
import { Camera, ExternalLink, Radio, RefreshCw } from "lucide-react";
import "./HighwayLiveCCTV.css";

type PlayerStatus = "loading" | "live" | "unavailable";
type SourceMode = "direct" | "proxy" | null;

type HlsErrorData = {
  fatal?: boolean;
  type?: string;
};

type HlsInstance = {
  loadSource: (url: string) => void;
  attachMedia: (video: HTMLVideoElement) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  startLoad: () => void;
  recoverMediaError: () => void;
  destroy: () => void;
};

type HlsConstructor = {
  new (config?: Record<string, unknown>): HlsInstance;
  isSupported: () => boolean;
  Events: { MANIFEST_PARSED: string; ERROR: string };
  ErrorTypes: { NETWORK_ERROR: string; MEDIA_ERROR: string };
};

declare global {
  interface Window {
    Hls?: HlsConstructor;
    __cc2HlsLoader?: Promise<HlsConstructor>;
  }
}

export const HIGHWAY_CCTV_CONFIG = {
  cameraId: "PER-14-007",
  locationName: "4 - เขาคราม - ตลาดเก่า",
  routeLabel: "ทล.4 เขาคราม–ตลาดเก่า",
  kilometer: "กม. 956–957",
  sourceLabel: "กรมทางหลวง · Department of Highways",
  sourcePage: "https://www.highwaytraffic.go.th/",
  stableMaster: import.meta.env.VITE_DOH_CCTV_HLS_URL || "https://streaming2.highwaytraffic.go.th/Phase14/PER_14_007.stream/playlist.m3u8",
  fallbackPlaylists: [
    "https://streaming2.highwaytraffic.go.th/Phase14/PER_14_007.stream/chunklist_w2015986280.m3u8",
    "https://streaming2.highwaytraffic.go.th/Phase14/PER_14_007.stream/chunklist_w1474254560.m3u8",
    "https://streaming2.highwaytraffic.go.th/Phase14/PER_14_007.stream/chunklist_w1698665729.m3u8",
    "https://streaming2.highwaytraffic.go.th/Phase14/PER_14_007.stream/chunklist_w438386858.m3u8",
  ],
  proxyEntry: "/.netlify/functions/doh-hls-proxy",
} as const;

const HLS_JS_CDN = "https://cdn.jsdelivr.net/npm/hls.js@1.7.1/dist/hls.min.js";

function loadHlsJs() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (window.__cc2HlsLoader) return window.__cc2HlsLoader;

  window.__cc2HlsLoader = new Promise<HlsConstructor>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-cc2-hls="true"]');
    if (existing) {
      existing.addEventListener("load", () => window.Hls ? resolve(window.Hls) : reject(new Error("hls.js unavailable")), { once: true });
      existing.addEventListener("error", () => reject(new Error("hls.js failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = HLS_JS_CDN;
    script.async = true;
    script.dataset.cc2Hls = "true";
    script.onload = () => window.Hls ? resolve(window.Hls) : reject(new Error("hls.js unavailable"));
    script.onerror = () => reject(new Error("hls.js failed to load"));
    document.head.appendChild(script);
  });

  return window.__cc2HlsLoader;
}

async function probeDirectSource(signal: AbortSignal) {
  const candidates = [HIGHWAY_CCTV_CONFIG.stableMaster, ...HIGHWAY_CCTV_CONFIG.fallbackPlaylists];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { mode: "cors", cache: "no-store", signal });
      if (!response.ok) continue;
      const text = await response.text();
      if (text.includes("#EXTM3U")) return url;
    } catch {
      // CORS, hotlink protection, timeout, or an unavailable playlist: proxy fallback handles it.
    }
  }
  return null;
}

export function HighwayLiveCCTV({ compact = false }: { compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [sourceMode, setSourceMode] = useState<SourceMode>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const controller = new AbortController();
    let hls: HlsInstance | null = null;
    let disposed = false;
    let proxyTried = false;
    let networkRecoveries = 0;
    let mediaRecoveries = 0;

    const clearPlayer = () => {
      hls?.destroy();
      hls = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const markLive = () => {
      if (!disposed) setStatus("live");
    };

    const markUnavailable = () => {
      if (!disposed) setStatus("unavailable");
    };

    const playVideo = async () => {
      try {
        await video.play();
      } catch {
        // Muted autoplay is normally allowed; if a browser still blocks it, the stream remains available via controls.
      }
    };

    const attachNative = (source: string, mode: Exclude<SourceMode, null>, fallbackToProxy: () => void) => {
      setSourceMode(mode);
      video.src = source;
      const onPlaying = () => markLive();
      const onError = () => mode === "direct" ? fallbackToProxy() : markUnavailable();
      video.addEventListener("playing", onPlaying, { once: true });
      video.addEventListener("error", onError, { once: true });
      video.load();
      void playVideo();
      return () => {
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("error", onError);
      };
    };

    let detachNative: (() => void) | null = null;

    const startSource = async (source: string, mode: Exclude<SourceMode, null>) => {
      if (disposed) return;
      setStatus("loading");
      setSourceMode(mode);
      networkRecoveries = 0;
      mediaRecoveries = 0;
      hls?.destroy();
      hls = null;
      detachNative?.();
      detachNative = null;
      video.pause();
      video.removeAttribute("src");
      video.load();

      const fallbackToProxy = () => {
        if (disposed) return;
        if (mode === "direct" && !proxyTried) {
          proxyTried = true;
          void startSource(HIGHWAY_CCTV_CONFIG.proxyEntry, "proxy");
        } else {
          markUnavailable();
        }
      };

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        detachNative = attachNative(source, mode, fallbackToProxy);
        return;
      }

      try {
        const Hls = await loadHlsJs();
        if (disposed) return;
        if (!Hls.isSupported()) {
          markUnavailable();
          return;
        }

        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 8,
          maxBufferLength: 18,
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void playVideo();
        });
        hls.on(Hls.Events.ERROR, (...args: unknown[]) => {
          const data = (args[1] || {}) as HlsErrorData;
          if (!data.fatal || disposed || !hls) return;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveries < 2) {
            networkRecoveries += 1;
            window.setTimeout(() => hls?.startLoad(), 900 * networkRecoveries);
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 1) {
            mediaRecoveries += 1;
            hls.recoverMediaError();
            return;
          }
          fallbackToProxy();
        });

        video.addEventListener("playing", markLive, { once: true });
        hls.loadSource(source);
        hls.attachMedia(video);
      } catch {
        fallbackToProxy();
      }
    };

    const boot = async () => {
      setStatus("loading");
      const timeout = window.setTimeout(() => controller.abort(), 7_500);
      const direct = await probeDirectSource(controller.signal);
      window.clearTimeout(timeout);
      if (disposed) return;
      if (direct) {
        void startSource(direct, "direct");
      } else {
        proxyTried = true;
        void startSource(HIGHWAY_CCTV_CONFIG.proxyEntry, "proxy");
      }
    };

    void boot();

    return () => {
      disposed = true;
      controller.abort();
      detachNative?.();
      video.removeEventListener("playing", markLive);
      clearPlayer();
    };
  }, [retryKey]);

  return (
    <section className={`cc2-highway-cctv ${compact ? "compact" : ""}`}>
      <header className="cc2-highway-cctv-head">
        <div className="cc2-highway-cctv-title">
          <span className="cc2-highway-cctv-icon"><Camera size={19} /></span>
          <div>
            <p>EXTERNAL LIVE CCTV · กรมทางหลวง</p>
            <h2>CCTV กรมทางหลวง — {HIGHWAY_CCTV_CONFIG.cameraId}</h2>
            <span>{HIGHWAY_CCTV_CONFIG.routeLabel} · {HIGHWAY_CCTV_CONFIG.kilometer}</span>
          </div>
        </div>
        <div className={`cc2-highway-live-badge ${status}`}><i />{status === "live" ? "LIVE CCTV" : status === "loading" ? "CONNECTING" : "OFFLINE"}</div>
      </header>

      <div className="cc2-highway-video-wrap">
        <video ref={videoRef} muted playsInline autoPlay controls preload="metadata" aria-label={`Live CCTV ${HIGHWAY_CCTV_CONFIG.cameraId} ${HIGHWAY_CCTV_CONFIG.locationName}`} />
        {status === "loading" && (
          <div className="cc2-highway-video-state loading"><Radio size={23} /><strong>กำลังเชื่อมต่อ HLS Live Stream</strong><span>ตรวจ direct CORS ก่อน แล้วจึงใช้ Netlify proxy เมื่อจำเป็น</span></div>
        )}
        {status === "unavailable" && (
          <div className="cc2-highway-video-state unavailable">
            <Camera size={25} />
            <strong>CCTV temporarily unavailable</strong>
            <span>Dashboard ส่วนอื่นยังทำงานตามปกติ</span>
            <button type="button" onClick={() => setRetryKey((value) => value + 1)}><RefreshCw size={14} />ลองเชื่อมต่อใหม่</button>
          </div>
        )}
        <div className="cc2-highway-video-overlay"><span>{HIGHWAY_CCTV_CONFIG.cameraId}</span><strong>{HIGHWAY_CCTV_CONFIG.routeLabel}</strong></div>
      </div>

      <footer className="cc2-highway-cctv-meta">
        <div><span>จุดติดตั้ง</span><strong>{HIGHWAY_CCTV_CONFIG.locationName}</strong></div>
        <div><span>ตำแหน่ง</span><strong>{HIGHWAY_CCTV_CONFIG.kilometer}</strong></div>
        <div><span>การเชื่อมต่อ</span><strong>{sourceMode === "direct" ? "DIRECT HLS" : sourceMode === "proxy" ? "NETLIFY PROXY" : "กำลังตรวจสอบ"}</strong></div>
        <a href={HIGHWAY_CCTV_CONFIG.sourcePage} target="_blank" rel="noreferrer">แหล่งข้อมูล: กรมทางหลวง <ExternalLink size={13} /></a>
      </footer>
    </section>
  );
}
