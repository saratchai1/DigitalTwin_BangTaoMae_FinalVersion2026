import { useEffect } from "react";
import "./WaterRisk.css";

type RiskStatus = "normal" | "warning" | "critical";
type RiskDirection = "flood" | "drought" | "normal";

function parseNumber(text: string | null | undefined) {
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function makeGuideRow(kind: "flood" | "drought", position: number, warning: number, critical: number) {
  const row = document.createElement("div");
  row.className = `water-risk-guide-row ${kind}`;
  row.innerHTML = `
    <span>${kind === "flood" ? "น้ำท่วม" : "น้ำแล้ง"}</span>
    <div class="risk-track" style="--risk-position:${position.toFixed(1)}%" title="ตำแหน่งระดับน้ำปัจจุบัน"></div>
    <strong title="เฝ้าระวัง / วิกฤต">${warning.toFixed(2)} / ${critical.toFixed(2)}</strong>
  `;
  return row;
}

function paintWaterCards() {
  const title = document.querySelector(".topbar-title h2")?.textContent ?? "";
  if (!title.includes("สถานการณ์น้ำ") && !title.includes("บริหารจัดการน้ำ")) return;

  const cards = Array.from(document.querySelectorAll<HTMLElement>(".water-station-card"));
  for (const card of cards) {
    const rows = Array.from(card.querySelectorAll<HTMLElement>(".scale-row"));
    if (rows.length < 5) continue;

    const values = rows.map((row) => parseNumber(row.querySelector("strong")?.textContent));
    const top = values[0];
    const highCritical = values[1];
    const highWarning = values[2];
    const current = values[3];
    const bottom = values[values.length - 1];
    if ([top, highCritical, highWarning, current, bottom].some((value) => value === null)) continue;

    const topValue = top as number;
    const highCriticalValue = highCritical as number;
    const highWarningValue = highWarning as number;
    const currentValue = current as number;
    const bottomValue = bottom as number;
    const span = Math.max(0.001, topValue - bottomValue);

    // Until project-specific drought setpoints are supplied, use conservative
    // operational bands at 35% (watch) and 20% (critical) of usable depth.
    const lowWarning = bottomValue + span * 0.35;
    const lowCritical = bottomValue + span * 0.20;
    const position = Math.max(0, Math.min(100, ((currentValue - bottomValue) / span) * 100));

    let status: RiskStatus = "normal";
    let direction: RiskDirection = "normal";
    if (currentValue >= highCriticalValue) {
      status = "critical";
      direction = "flood";
    } else if (currentValue <= lowCritical) {
      status = "critical";
      direction = "drought";
    } else if (currentValue >= highWarningValue) {
      status = "warning";
      direction = "flood";
    } else if (currentValue <= lowWarning) {
      status = "warning";
      direction = "drought";
    }

    card.classList.remove("water-risk-normal", "water-risk-warning", "water-risk-critical");
    card.classList.add(`water-risk-${status}`);
    card.dataset.waterRisk = status;
    card.dataset.waterDirection = direction;

    const badge = card.querySelector<HTMLElement>(".status-badge");
    if (badge) {
      badge.classList.remove("normal", "warning", "critical");
      badge.classList.add(status);
      badge.textContent = status === "critical"
        ? `วิกฤต${direction === "flood" ? " · น้ำท่วม" : direction === "drought" ? " · น้ำแล้ง" : ""}`
        : status === "warning"
          ? `เฝ้าระวัง${direction === "flood" ? " · น้ำท่วม" : direction === "drought" ? " · น้ำแล้ง" : ""}`
          : "ปกติ";
    }

    const scale = card.querySelector<HTMLElement>(".level-scale");
    if (!scale) continue;
    scale.querySelector(".water-risk-guide")?.remove();

    const guide = document.createElement("div");
    guide.className = "water-risk-guide";
    guide.setAttribute("aria-label", "เกณฑ์ความเสี่ยงน้ำท่วมและน้ำแล้ง");
    guide.appendChild(makeGuideRow("flood", position, highWarningValue, highCriticalValue));
    guide.appendChild(makeGuideRow("drought", position, lowWarning, lowCritical));

    const heading = scale.querySelector(":scope > p");
    if (heading) heading.insertAdjacentElement("afterend", guide);
    else scale.prepend(guide);

    rows.forEach((row) => row.classList.remove("risk-divider-high", "risk-divider-low"));
    rows[1]?.classList.add("risk-divider-high");

    let lowRow = scale.querySelector<HTMLElement>(".scale-row.generated-drought-warning");
    if (!lowRow) {
      lowRow = document.createElement("div");
      lowRow.className = "scale-row generated-drought-warning risk-divider-low";
      const bottomRow = rows[rows.length - 1];
      bottomRow.insertAdjacentElement("beforebegin", lowRow);
    }
    lowRow.innerHTML = `<span>น้ำแล้ง · เฝ้าระวัง</span><strong class="warning">${lowWarning.toFixed(2)}</strong>`;

    let lowCriticalRow = scale.querySelector<HTMLElement>(".scale-row.generated-drought-critical");
    if (!lowCriticalRow) {
      lowCriticalRow = document.createElement("div");
      lowCriticalRow.className = "scale-row generated-drought-critical";
      const bottomRow = rows[rows.length - 1];
      bottomRow.insertAdjacentElement("beforebegin", lowCriticalRow);
    }
    lowCriticalRow.innerHTML = `<span>น้ำแล้ง · วิกฤต</span><strong class="critical">${lowCritical.toFixed(2)}</strong>`;
  }
}

export function WaterRiskBands() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        paintWaterCards();
      });
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.getElementById("root") ?? document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
