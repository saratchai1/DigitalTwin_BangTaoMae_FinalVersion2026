type DwrStation = {
  id?: string;
  name?: string;
  tambon?: string;
  amphoe?: string;
  province?: string;
  status?: number | null;
  rain15m?: number | null;
  rain12h?: number | null;
  rainSince07?: number | null;
  temperature?: number | null;
  waterLevel?: number | null;
  soilMoisture?: number | null;
  observedAt?: string | null;
};

type DwrLiveResponse = {
  source?: string;
  sourceUrl?: string;
  measurementUrl?: string;
  fetchedAt?: string;
  mode?: "station-json" | "rain-daily-fallback" | "reader-relay";
  transport?: "direct" | "relay";
  relay?: string;
  freshness?: { observedDate?: string | null; ageHours?: number | null; fresh?: boolean };
  rainStation?: DwrStation | null;
  area?: {
    status?: number | null;
    stationCount?: number | null;
    statusStation?: DwrStation | null;
    warnings?: DwrStation[];
  };
  provinceActiveStations?: number | null;
};

const nativeFetch = globalThis.fetch.bind(globalThis);

function isEnvironmentIntelligenceRequest(input: RequestInfo | URL) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    const url = new URL(raw, globalThis.location?.href || "https://localhost/");
    return url.pathname === "/.netlify/functions/environment-intelligence";
  } catch {
    return raw.includes("/.netlify/functions/environment-intelligence");
  }
}

function statusMeta(status: number | null | undefined) {
  if (status === 3) return { level: "critical", label: "วิกฤต / อพยพ" };
  if (status === 2) return { level: "warning", label: "เตือนภัย / เตรียมพร้อม" };
  if (status === 1) return { level: "watch", label: "เฝ้าระวัง" };
  if (status === 0) return { level: "normal", label: "ปกติ" };
  return { level: "unknown", label: "ข้อมูลฝนพร้อม · รอสถานะ EWS" };
}

function mergeDwr(env: any, live: DwrLiveResponse) {
  const station = live.rainStation;
  if (!station?.id) return env;

  const status = live.area?.status ?? station.status ?? null;
  const meta = statusMeta(status);
  const relayNote = live.transport === "relay"
    ? " อ่านจากหน้า DWR ทางการผ่าน text relay เนื่องจากต้นทาง timeout จาก Netlify; ตรวจ freshness ก่อนแสดง"
    : "";
  const dwr = {
    name: "EWS น้ำหลาก-ดินถล่ม · กรมทรัพยากรน้ำ",
    url: live.sourceUrl || "https://ews.dwr.go.th/ews/",
    source: live.source || "DWR EWS · กรมทรัพยากรน้ำ",
    sourceType: "official",
    stationId: station.id,
    stationName: station.name || "สถานี DWR EWS",
    subdistrict: station.tambon || "",
    district: station.amphoe || "",
    province: station.province || "",
    selection: station.id === "STN2113" ? "primary-locality" : "nearest-locality-fallback",
    rain15m: station.rain15m ?? null,
    rain12h: station.rain12h ?? null,
    rain24h: station.rainSince07 ?? null,
    temperature: station.temperature ?? null,
    waterLevel: station.waterLevel ?? null,
    soilMoisture: station.soilMoisture ?? null,
    updatedAt: station.observedAt || live.fetchedAt || null,
    alertLevel: meta.level,
    alertLabel: meta.label,
    provinceActiveStations: live.provinceActiveStations ?? null,
    provinceHasActiveAlert: (live.provinceActiveStations ?? 0) > 0,
    note:
      live.mode === "station-json"
        ? "DWR EWS live station feed; ใช้ STN2113 บ้านคลองยาเป็นสถานีหลักของพื้นที่"
        : live.mode === "reader-relay"
          ? `DWR EWS rain_daily public page; ค่าฝนเป็นข้อมูลตรวจวัดทางการ.${relayNote}`
          : "DWR EWS rain_daily fallback; ค่าฝนเป็นข้อมูลตรวจวัดทางการ แต่สถานะเตือนภัยอาจยังไม่พร้อม",
  };

  const sources = Array.isArray(env?.sources) ? [...env.sources] : [];
  const sourceIndex = sources.findIndex((source) => source?.id === "dwr-ews");
  const source = {
    id: "dwr-ews",
    label: live.transport === "relay" ? "ฝนตรวจวัด DWR (verified relay)" : "ฝนตรวจวัดและสถานะเตือนภัย",
    agency: "กรมทรัพยากรน้ำ (DWR EWS)",
    type: "official",
    status: "online",
    url: live.measurementUrl || live.sourceUrl || "https://ews.dwr.go.th/ews/",
  };
  if (sourceIndex >= 0) sources[sourceIndex] = { ...sources[sourceIndex], ...source };
  else sources.push(source);

  return { ...env, dwr, sources };
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await nativeFetch(input, init);
  if (!isEnvironmentIntelligenceRequest(input) || !response.ok) return response;

  try {
    const dwrResponse = await nativeFetch("/.netlify/functions/dwr-ews", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!dwrResponse.ok) return response;

    const [env, live] = await Promise.all([
      response.clone().json(),
      dwrResponse.json() as Promise<DwrLiveResponse>,
    ]);
    const merged = mergeDwr(env, live);
    const headers = new Headers(response.headers);
    headers.set("content-type", "application/json; charset=utf-8");
    headers.set("x-bangtaomae-dwr-bridge", live.transport === "relay" ? "verified-relay" : "live");
    return new Response(JSON.stringify(merged), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}) as typeof globalThis.fetch;
