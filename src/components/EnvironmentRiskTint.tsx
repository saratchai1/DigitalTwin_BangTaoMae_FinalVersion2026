import { useEffect } from "react";
import "./EnvironmentRiskTint.css";

type RiskStatus = "normal" | "warning" | "critical";

type MetricRule = {
  label: string;
  classify: (value: number) => RiskStatus;
};

const RULES: MetricRule[] = [
  {
    label: "อุณหภูมิ",
    classify: (value) => value >= 38 || value < 12 ? "critical" : value >= 35 || value < 18 ? "warning" : "normal",
  },
  {
    label: "ความชื้น",
    classify: (value) => value > 92 || value < 20 ? "critical" : value > 85 || value < 30 ? "warning" : "normal",
  },
  {
    label: "ความเร็วลม",
    classify: (value) => value >= 50 ? "critical" : value >= 30 ? "warning" : "normal",
  },
  {
    label: "ฝน 1 ชั่วโมง",
    classify: (value) => value >= 35 ? "critical" : value >= 10 ? "warning" : "normal",
  },
  {
    label: "คุณภาพอากาศ",
    classify: (value) => value > 100 ? "critical" : value > 50 ? "warning" : "normal",
  },
];

const STATUS_LABEL: Record<RiskStatus, string> = {
  normal: "ปกติ",
  warning: "เฝ้าระวัง",
  critical: "วิกฤต",
};

function parseNumber(text: string | null | undefined) {
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function clearStatus(element: Element) {
  element.classList.remove("env-risk-normal", "env-risk-warning", "env-risk-critical");
  if (element instanceof HTMLElement) {
    element.removeAttribute("data-env-status");
    element.removeAttribute("data-env-status-label");
  }
}

function applyStatus(element: HTMLElement, status: RiskStatus) {
  clearStatus(element);
  element.classList.add(`env-risk-${status}`);
  element.dataset.envStatus = status;
  element.dataset.envStatusLabel = STATUS_LABEL[status];
}

function classifyPm25(value: number): RiskStatus {
  if (value > 35) return "critical";
  if (value > 15) return "warning";
  return "normal";
}

export function EnvironmentRiskTint() {
  useEffect(() => {
    let scheduled = 0;

    const paint = () => {
      scheduled = 0;
      const title = document.querySelector(".topbar-title h2")?.textContent ?? "";
      const onEnvironmentPage = title.includes("สภาพแวดล้อม") || title.includes("อากาศ");

      document.querySelectorAll<HTMLElement>(".metric-card").forEach(clearStatus);
      document.querySelectorAll<HTMLElement>(".aqi-panel").forEach(clearStatus);

      if (!onEnvironmentPage) return;

      const cards = Array.from(document.querySelectorAll<HTMLElement>(".page-content > .metric-grid .metric-card"));
      for (const card of cards) {
        const label = card.querySelector(".metric-label")?.textContent?.trim() ?? "";
        const value = parseNumber(card.querySelector(".metric-value")?.textContent);
        const rule = RULES.find((candidate) => label.includes(candidate.label));
        if (!rule || value === null) continue;
        applyStatus(card, rule.classify(value));
      }

      const aqiPanel = document.querySelector<HTMLElement>(".aqi-panel");
      if (aqiPanel) {
        const aqi = parseNumber(aqiPanel.querySelector(".aqi-gauge strong")?.textContent);
        const pm25 = parseNumber(aqiPanel.querySelector(".aqi-stats > div:first-child strong")?.textContent);
        const aqiStatus = aqi === null ? "normal" : RULES[RULES.length - 1].classify(aqi);
        const pmStatus = pm25 === null ? "normal" : classifyPm25(pm25);
        const rank: Record<RiskStatus, number> = { normal: 0, warning: 1, critical: 2 };
        applyStatus(aqiPanel, rank[pmStatus] > rank[aqiStatus] ? pmStatus : aqiStatus);
      }
    };

    const schedulePaint = () => {
      if (scheduled) return;
      scheduled = window.requestAnimationFrame(paint);
    };

    schedulePaint();
    const observer = new MutationObserver(schedulePaint);
    observer.observe(document.getElementById("root") ?? document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (scheduled) window.cancelAnimationFrame(scheduled);
    };
  }, []);

  return null;
}
