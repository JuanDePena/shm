import { escapeHtml } from "@simplehost/ui";

import {
  type DnsRecordPayload,
  type OperationsOverview
} from "@simplehost/control-contracts";

import type { OverviewMetricsSnapshot } from "./overview-metrics.js";
import { type WebLocale } from "./request.js";
import { type SelectOption, type PillTone } from "./web-types.js";

type StatsCopy = {
  managedNodes: string;
  pendingJobs: string;
  failedJobs: string;
  resourcesWithDrift: string;
  backupPolicies: string;
  generatedAt: string;
};

type OverviewMetricsCopy = {
  metricsControlService: string;
  metricsCpuCores: string;
  metricsCpuLoad: string;
  metricsCurrentIpv4: string;
  metricsDirectories: string;
  metricsFiles: string;
  metricsHostname: string;
  metricsLines: string;
  metricsMemoryFree: string;
  metricsMemoryTotal: string;
  metricsSourceCodeTitle: string;
  metricsSourceSize: string;
  metricsStorageAvailable: string;
  metricsStorageTotal: string;
  metricsSystemTitle: string;
  metricsUpdatedAt: string;
  metricsVersion: string;
};

export function formatDate(value: string | undefined, locale: WebLocale): string {
  if (!value) {
    return "-";
  }

  if (value.toLowerCase() === "n/a") {
    return "-";
  }

  const parsed = Date.parse(value);
  const parsedWithoutWeekday = Number.isFinite(parsed)
    ? parsed
    : Date.parse(value.replace(/^[A-Za-z]{3}\s+/, ""));

  if (!Number.isFinite(parsedWithoutWeekday)) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(new Date(parsedWithoutWeekday));
}

export function formatList(values: string[], emptyValue = "-"): string {
  return values.length > 0 ? values.join(", ") : emptyValue;
}

export function formatBytes(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = value;
  let unitIndex = 0;

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  const maximumFractionDigits = unitIndex === 0 ? 0 : 2;

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: unitIndex === 0 ? 0 : maximumFractionDigits
  }).format(amount)} ${units[unitIndex]}`;
}

export function getInitials(value: string): string {
  const initials = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "SH";
}

export function interpolateCopy(
  template: string,
  values: Record<string, string | number>
): string {
  let next = template;

  for (const [key, value] of Object.entries(values)) {
    next = next.replaceAll(`{${key}}`, String(value));
  }

  return next;
}

export function renderSelectOptions(
  options: SelectOption[],
  selectedValue: string | undefined,
  optionsConfig: {
    allowBlank?: boolean;
    blankLabel?: string;
  } = {}
): string {
  const rendered: string[] = [];
  const seen = new Set<string>();

  if (optionsConfig.allowBlank) {
    const blankValue = selectedValue ?? "";
    rendered.push(
      `<option value=""${blankValue.length === 0 ? " selected" : ""}>${escapeHtml(
        optionsConfig.blankLabel ?? "-"
      )}</option>`
    );
  }

  for (const option of options) {
    if (seen.has(option.value)) {
      continue;
    }

    seen.add(option.value);
    rendered.push(
      `<option value="${escapeHtml(option.value)}"${
        option.value === selectedValue ? " selected" : ""
      }>${escapeHtml(option.label)}</option>`
    );
  }

  if (selectedValue && !seen.has(selectedValue)) {
    rendered.push(
      `<option value="${escapeHtml(selectedValue)}" selected>${escapeHtml(selectedValue)}</option>`
    );
  }

  return rendered.join("");
}

export function renderPill(
  value: string,
  tone: PillTone = "default"
): string {
  const className =
    tone === "success"
      ? "pill pill-success"
      : tone === "danger"
        ? "pill pill-danger"
        : tone === "muted"
          ? "pill pill-muted"
          : "pill";
  return `<span class="${className}">${escapeHtml(value)}</span>`;
}

export function renderStats<Copy extends StatsCopy>(
  overview: OperationsOverview,
  copy: Copy,
  locale: WebLocale
): string {
  return `<div class="stats">
    <article class="stat"><strong>${overview.nodeCount}</strong><span>${escapeHtml(copy.managedNodes)}</span></article>
    <article class="stat"><strong>${overview.pendingJobCount}</strong><span>${escapeHtml(copy.pendingJobs)}</span></article>
    <article class="stat"><strong>${overview.failedJobCount}</strong><span>${escapeHtml(copy.failedJobs)}</span></article>
    <article class="stat"><strong>${overview.driftedResourceCount}</strong><span>${escapeHtml(copy.resourcesWithDrift)}</span></article>
    <article class="stat"><strong>${overview.backupPolicyCount}</strong><span>${escapeHtml(copy.backupPolicies)}</span></article>
  </div>
  <p class="muted">${escapeHtml(copy.generatedAt)} ${escapeHtml(
    formatDate(overview.generatedAt, locale)
  )}</p>`;
}

export function renderOverviewMetrics<Copy extends OverviewMetricsCopy>(
  overviewMetrics: OverviewMetricsSnapshot,
  copy: Copy,
  locale: WebLocale
): string {
  const numberFormatter = new Intl.NumberFormat(locale === "es" ? "es-DO" : "en-GB");
  const percentFormatter = new Intl.NumberFormat(locale === "es" ? "es-DO" : "en-GB", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  });
  const metric = (label: string, value: string, className = ""): string => `<div class="overview-metric${className ? ` ${className}` : ""}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>`;

  return `<aside class="overview-metrics-column" aria-label="${escapeHtml(copy.metricsSystemTitle)}">
    <article class="overview-metric-panel">
      <h3>${escapeHtml(copy.metricsSourceCodeTitle)}</h3>
      <div class="overview-metric-grid">
        ${metric(copy.metricsLines, numberFormatter.format(overviewMetrics.sourceCode.lineCount))}
        ${metric(copy.metricsSourceSize, formatBytes(overviewMetrics.sourceCode.sizeBytes))}
        ${metric(copy.metricsFiles, numberFormatter.format(overviewMetrics.sourceCode.fileCount))}
        ${metric(copy.metricsDirectories, numberFormatter.format(overviewMetrics.sourceCode.directoryCount))}
        ${metric(copy.metricsHostname, overviewMetrics.system.hostname)}
        ${metric(copy.metricsUpdatedAt, formatDate(overviewMetrics.generatedAt, locale))}
        ${metric(copy.metricsVersion, overviewMetrics.system.version, "overview-metric-wide")}
      </div>
    </article>
    <article class="overview-metric-panel">
      <h3>${escapeHtml(copy.metricsSystemTitle)}</h3>
      <div class="overview-metric-grid">
        ${metric(copy.metricsCpuCores, numberFormatter.format(overviewMetrics.system.cpuCores))}
        ${metric(copy.metricsCpuLoad, `${percentFormatter.format(overviewMetrics.system.cpuLoadPercent)}%`)}
        ${metric(copy.metricsMemoryTotal, formatBytes(overviewMetrics.system.memoryTotalBytes))}
        ${metric(copy.metricsMemoryFree, formatBytes(overviewMetrics.system.memoryFreeBytes))}
        ${metric(copy.metricsStorageTotal, formatBytes(overviewMetrics.system.storageTotalBytes))}
        ${metric(copy.metricsStorageAvailable, formatBytes(overviewMetrics.system.storageAvailableBytes))}
        ${metric(copy.metricsControlService, overviewMetrics.system.controlService)}
        ${metric(copy.metricsCurrentIpv4, overviewMetrics.system.currentIpv4 ?? "-")}
      </div>
    </article>
  </aside>`;
}

export function readStringPayloadValue(
  payload: Record<string, unknown> | undefined,
  key: string
): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readBooleanPayloadValue(
  payload: Record<string, unknown> | undefined,
  key: string
): boolean | null {
  const value = payload?.[key];
  return typeof value === "boolean" ? value : null;
}

export function readStringArrayPayloadValue(
  payload: Record<string, unknown> | undefined,
  key: string
): string[] {
  const value = payload?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export function readObjectArrayPayloadValue(
  payload: Record<string, unknown> | undefined,
  key: string
): Array<Record<string, unknown>> {
  const value = payload?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry)
  );
}

export function formatDnsRecordPreview(
  record: DnsRecordPayload | Record<string, unknown> | undefined
): string {
  if (!record) {
    return "";
  }

  const name = "name" in record && typeof record.name === "string" ? record.name : "";
  const type = "type" in record && typeof record.type === "string" ? record.type : "";
  const value = "value" in record && typeof record.value === "string" ? record.value : "";

  return [name, type, value].filter(Boolean).join(" ");
}
