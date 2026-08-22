import type { WaterStation } from "./WaterProfile3D";
import type { EnvironmentData, StationStatus } from "./CommandCenterV2Data";

export const WATCH_BUFFER_METERS = 0.1;

export type SourceDisplayState = "live" | "model" | "dummy" | "fallback" | "offline";

/**
 * Presentation status for the command center.
 * The engineering warning/critical thresholds remain unchanged. A station enters
 * the yellow WATCH band when it is within 0.10 m of its warning threshold so an
 * operator can see the approaching condition before the threshold is crossed.
 */
export function operationalStationStatus(station: WaterStation): StationStatus {
  if (station.currentLevel >= station.criticalLevel) return "critical";
  if (
    station.currentLevel >= station.warningLevel ||
    station.warningLevel - station.currentLevel <= WATCH_BUFFER_METERS
  ) {
    return "warning";
  }
  return "normal";
}

function hasDwrMeasurement(environment: EnvironmentData) {
  return [
    environment.dwr.rain15m,
    environment.dwr.rain12h,
    environment.dwr.rain24h,
    environment.dwr.waterLevel,
    environment.dwr.temperature,
  ].some((value) => typeof value === "number" && Number.isFinite(value));
}

export function sourceDisplayState(
  environment: EnvironmentData,
  sourceId: string,
  fallbackMode: boolean,
): SourceDisplayState {
  const source = environment.sources.find((entry) => entry.id === sourceId);

  if (source?.type === "model") {
    return fallbackMode || source.status === "online" ? "model" : "offline";
  }
  if (
    sourceId === "dwr-ews" &&
    (fallbackMode || source?.status !== "online" || !hasDwrMeasurement(environment))
  ) {
    return "dummy";
  }
  if (fallbackMode) return "fallback";
  return source?.status === "online" ? "live" : "offline";
}

export function isDwrLive(environment: EnvironmentData, fallbackMode: boolean) {
  return sourceDisplayState(environment, "dwr-ews", fallbackMode) === "live";
}

export function sourceStateLabel(state: SourceDisplayState) {
  if (state === "live") return "LIVE";
  if (state === "model") return "MODEL";
  if (state === "dummy") return "DUMMY";
  if (state === "fallback") return "FALLBACK";
  return "OFFLINE";
}
