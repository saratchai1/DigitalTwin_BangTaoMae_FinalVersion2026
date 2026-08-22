import type { WaterStation } from "./WaterProfile3D";
import type { EnvironmentData, StationStatus } from "./CommandCenterV2Data";

export const WATCH_BUFFER_METERS = 0.1;

export type SourceDisplayState = "live" | "model" | "dummy" | "fallback" | "offline";

/**
 * Presentation status for the command center.
 *
 * Engineering warning/critical thresholds are never changed. The UI adds a
 * yellow pre-warning band when a rising station is within 0.10 m of the formal
 * warning threshold, allowing an operator to see an approaching condition
 * without misreporting that the engineering threshold has already been crossed.
 */
export function operationalStationStatus(station: WaterStation): StationStatus {
  if (station.currentLevel >= station.criticalLevel) return "critical";
  if (station.currentLevel >= station.warningLevel) return "warning";

  const distanceToWarning = station.warningLevel - station.currentLevel;
  if (station.trend === "up" && distanceToWarning >= 0 && distanceToWarning <= WATCH_BUFFER_METERS) {
    return "warning";
  }

  return "normal";
}

export function isPrewarningStation(station: WaterStation) {
  return operationalStationStatus(station) === "warning" && station.currentLevel < station.warningLevel;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasDwrHydrologyMeasurement(environment: EnvironmentData) {
  const hasStationIdentity = Boolean(environment.dwr.stationId && environment.dwr.stationName);
  const hasHydrologyValue = [
    environment.dwr.rain15m,
    environment.dwr.rain12h,
    environment.dwr.rain24h,
    environment.dwr.waterLevel,
  ].some(isFiniteNumber);

  // Temperature alone is not sufficient proof that the DWR hydrology feed was
  // parsed correctly. At least one rain/water measurement must be present.
  return hasStationIdentity && hasHydrologyValue;
}

export function sourceDisplayState(
  environment: EnvironmentData,
  sourceId: string,
  fallbackMode: boolean,
): SourceDisplayState {
  const source = environment.sources.find((entry) => entry.id === sourceId);

  if (source?.type === "model") {
    if (fallbackMode) return "fallback";
    return source.status === "online" ? "model" : "offline";
  }

  if (
    sourceId === "dwr-ews" &&
    (fallbackMode || source?.status !== "online" || !hasDwrHydrologyMeasurement(environment))
  ) {
    return "dummy";
  }

  if (fallbackMode) return "fallback";
  return source?.status === "online" ? "live" : "offline";
}

/**
 * Status of the AQI/PM values currently displayed. This can differ from the PCD
 * source row: Air4Thai may be offline while a clearly-labelled model fallback is
 * still available for situational awareness.
 */
export function airQualityDisplayState(
  environment: EnvironmentData,
  fallbackMode: boolean,
): SourceDisplayState {
  const officialState = sourceDisplayState(environment, "air4thai", fallbackMode);
  if (officialState === "live") return "live";

  const hasAirValue = [environment.air.aqi, environment.air.pm25, environment.air.pm10].some(isFiniteNumber);
  if (!hasAirValue) return "offline";
  if (fallbackMode || environment.air.sourceType === "fallback") return "fallback";
  if (environment.air.sourceType === "model") return "model";
  if (environment.air.sourceType === "dummy") return "dummy";
  return officialState;
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
