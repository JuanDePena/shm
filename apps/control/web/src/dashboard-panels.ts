import { escapeHtml } from "@simplehost/ui";

import {
  type AuditEventSummary,
  type JobHistoryEntry
} from "@simplehost/control-contracts";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl, type DashboardView } from "./dashboard-routing.js";
import { renderActionFacts } from "./panel-renderers.js";
import { type WebLocale } from "./request.js";
import { renderSelectOptions } from "./dashboard-formatters.js";
import { type WorkspaceFilterField } from "./web-types.js";

type BackupRun = DashboardData["backups"]["latestRuns"][number];

type FeedItem = {
  title: string;
  meta?: string;
  summary?: string;
  summaryHtml?: string;
  tone?: "default" | "danger" | "success";
};

type ActiveFiltersCopy = {
  activeFiltersTitle: string;
  activeFiltersDescription: string;
  clearFiltersLabel: string;
};

type FilterWorkspaceCopy = {
  applyFiltersLabel: string;
  clearFiltersLabel: string;
  dataFilterPlaceholder: string;
  filterWorkspaceDescription: string;
  filterWorkspaceTitle: string;
  none: string;
};

type JobFeedCopy = {
  noRelatedRecords: string;
  relatedJobsTitle: string;
};

type AuditPanelCopy = {
  auditTrailDescription: string;
  auditTrailTitle: string;
  noRelatedRecords: string;
};

export function renderCodeBlock(value: unknown): string {
  return `<pre class="code-block">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

export function payloadContainsValue(payload: unknown, needle: string): boolean {
  if (typeof payload === "string") {
    return payload === needle || payload.includes(needle);
  }

  if (typeof payload === "number" || typeof payload === "boolean" || payload === null) {
    return String(payload) === needle;
  }

  if (Array.isArray(payload)) {
    return payload.some((entry) => payloadContainsValue(entry, needle));
  }

  if (payload && typeof payload === "object") {
    return Object.values(payload).some((entry) => payloadContainsValue(entry, needle));
  }

  return false;
}

function renderFeedList(
  items: FeedItem[],
  emptyMessage = "No related records."
): string {
  if (items.length === 0) {
    return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
  }

  return `<div class="feed-list">
    ${items
      .map(
        (item) => `<article class="feed-item${
          item.tone === "danger"
            ? " feed-item-danger"
            : item.tone === "success"
              ? " feed-item-success"
              : ""
        }">
          <strong>${item.title}</strong>
          ${item.meta ? `<span class="feed-meta">${item.meta}</span>` : ""}
          ${item.summaryHtml ? item.summaryHtml : item.summary ? `<p>${item.summary}</p>` : ""}
        </article>`
      )
      .join("")}
  </div>`;
}

export function renderJobFeedPanel<Copy extends JobFeedCopy>(
  copy: Copy,
  locale: WebLocale,
  jobs: JobHistoryEntry[],
  formatDate: (value: string | undefined, locale: WebLocale) => string,
  title = copy.relatedJobsTitle
): string {
  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(title)}</h3>
      </div>
    </div>
    ${renderFeedList(
      jobs.map((job) => ({
        title: `<a class="detail-link" href="${escapeHtml(
          buildDashboardViewUrl("job-history", undefined, job.jobId)
        )}">${escapeHtml(job.kind)}</a>`,
        meta: escapeHtml(
          [job.jobId, job.status ?? "queued", formatDate(job.createdAt, locale)].join(" · ")
        ),
        summary: escapeHtml(job.summary ?? job.dispatchReason ?? "-"),
        tone:
          job.status === "failed"
            ? "danger"
            : job.status === "applied"
              ? "success"
              : "default"
      })),
      copy.noRelatedRecords
    )}
  </article>`;
}

export function renderAuditPanel<Copy extends AuditPanelCopy>(
  copy: Copy,
  locale: WebLocale,
  events: AuditEventSummary[],
  formatDate: (value: string | undefined, locale: WebLocale) => string
): string {
  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.auditTrailTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.auditTrailDescription)}</p>
      </div>
    </div>
    ${renderFeedList(
      events.map((event) => ({
        title: escapeHtml(event.eventType),
        meta: escapeHtml(
          [
            event.entityType && event.entityId
              ? `${event.entityType}:${event.entityId}`
              : event.entityType ?? event.entityId ?? "",
            formatDate(event.occurredAt, locale)
          ]
            .filter(Boolean)
            .join(" · ")
        ),
        summaryHtml:
          Object.keys(event.payload).length > 0 ? renderCodeBlock(event.payload) : undefined
      })),
      copy.noRelatedRecords
    )}
  </article>`;
}

export function findRelatedJobs(
  jobs: JobHistoryEntry[],
  options: {
    resourceKeys?: string[];
    resourcePrefixes?: string[];
    nodeId?: string;
    needles?: string[];
  },
  limit = 6
): JobHistoryEntry[] {
  const resourceKeys = new Set((options.resourceKeys ?? []).filter(Boolean));
  const resourcePrefixes = (options.resourcePrefixes ?? []).filter(Boolean);
  const needles = (options.needles ?? []).filter(Boolean);

  return jobs
    .filter((job) => {
      if (options.nodeId && job.nodeId === options.nodeId) {
        return true;
      }

      if (job.resourceKey && resourceKeys.has(job.resourceKey)) {
        return true;
      }

      if (
        job.resourceKey &&
        resourcePrefixes.some((prefix) => job.resourceKey?.startsWith(prefix))
      ) {
        return true;
      }

      if (
        needles.some(
          (needle) =>
            payloadContainsValue(job.payload, needle) || payloadContainsValue(job.details, needle)
        )
      ) {
        return true;
      }

      return false;
    })
    .slice(0, limit);
}

export function findRelatedAuditEvents(
  events: AuditEventSummary[],
  needles: string[],
  limit = 8
): AuditEventSummary[] {
  const normalizedNeedles = needles.filter(Boolean);

  return events
    .filter(
      (event) =>
        normalizedNeedles.some(
          (needle) =>
            event.entityId === needle ||
            event.actorId === needle ||
            payloadContainsValue(event.payload, needle)
        )
    )
    .slice(0, limit);
}

export function findLatestBackupRunWithStatus(
  runs: BackupRun[],
  status: BackupRun["status"]
): BackupRun | undefined {
  return runs.find((run) => run.status === status);
}

export function createBackupScopePanelItems(args: {
  backupsHref: string;
  backupsLabel: string;
  emptySummary: string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  latestFailureLabel: string;
  latestSuccessLabel: string;
  locale: WebLocale;
  policyCount?: number;
  runs: BackupRun[];
}): FeedItem[] {
  const {
    backupsHref,
    backupsLabel,
    emptySummary,
    formatDate,
    latestFailureLabel,
    latestSuccessLabel,
    locale,
    policyCount,
    runs
  } = args;
  const latestFailure = findLatestBackupRunWithStatus(runs, "failed");
  const latestSuccess = findLatestBackupRunWithStatus(runs, "succeeded");
  const items: FeedItem[] = [];

  if (latestFailure) {
    items.push({
      title: `<a class="detail-link" href="${escapeHtml(
        buildDashboardViewUrl("backups", undefined, latestFailure.runId)
      )}">${escapeHtml(latestFailureLabel)}</a>`,
      meta: escapeHtml([latestFailure.runId, formatDate(latestFailure.startedAt, locale)].join(" · ")),
      summary: escapeHtml(latestFailure.summary),
      tone: "danger"
    });
  }

  if (latestSuccess && latestSuccess.runId !== latestFailure?.runId) {
    items.push({
      title: `<a class="detail-link" href="${escapeHtml(
        buildDashboardViewUrl("backups", undefined, latestSuccess.runId)
      )}">${escapeHtml(latestSuccessLabel)}</a>`,
      meta: escapeHtml([latestSuccess.runId, formatDate(latestSuccess.startedAt, locale)].join(" · ")),
      summary: escapeHtml(latestSuccess.summary),
      tone: "success"
    });
  }

  items.push({
    title: `<a class="detail-link" href="${escapeHtml(backupsHref)}">${escapeHtml(
      backupsLabel
    )}</a>`,
    meta: escapeHtml(
      [
        `${runs.length} run(s)`,
        typeof policyCount === "number" ? `${policyCount} polic(ies)` : ""
      ]
        .filter(Boolean)
        .join(" · ")
    ),
    summary: escapeHtml(latestFailure?.summary ?? latestSuccess?.summary ?? emptySummary),
    tone: latestFailure ? "danger" : latestSuccess ? "success" : "default"
  });

  return items;
}

export function renderRelatedPanel(
  title: string,
  description: string | undefined,
  items: FeedItem[],
  emptyMessage: string
): string {
  return `<article class="panel detail-shell panel-nested">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(title)}</h3>
        ${
          description
            ? `<p class="muted section-description">${escapeHtml(description)}</p>`
            : ""
        }
      </div>
    </div>
    ${renderFeedList(items, emptyMessage)}
  </article>`;
}

export function renderActiveFiltersPanel<Copy extends ActiveFiltersCopy>(
  copy: Copy,
  items: Array<{ label: string; value: string }>,
  clearHref: string
): string {
  if (items.length === 0) {
    return "";
  }

  return `<article class="panel detail-shell panel-nested">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.activeFiltersTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.activeFiltersDescription)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(clearHref)}">${escapeHtml(
        copy.clearFiltersLabel
      )}</a>
    </div>
    ${renderActionFacts(items)}
  </article>`;
}

export function renderWorkspaceFilterForm<Copy extends FilterWorkspaceCopy>(
  copy: Copy,
  props: {
    view: DashboardView;
    clearHref: string;
    fields: WorkspaceFilterField[];
  }
): string {
  return `<article class="panel detail-shell panel-nested filter-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.filterWorkspaceTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.filterWorkspaceDescription)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(props.clearHref)}">${escapeHtml(
        copy.clearFiltersLabel
      )}</a>
    </div>
    <form method="get" action="/" class="stack">
      <input type="hidden" name="view" value="${escapeHtml(props.view)}" />
      <div class="form-grid filter-form-grid">
        ${props.fields
          .map((field) => {
            const fieldType = field.type ?? "select";

            if (fieldType === "search") {
              return `<label>${escapeHtml(field.label)}
                <input
                  type="search"
                  name="${escapeHtml(field.name)}"
                  value="${escapeHtml(field.value ?? "")}"
                  placeholder="${escapeHtml(field.placeholder ?? copy.dataFilterPlaceholder)}"
                />
              </label>`;
            }

            return `<label>${escapeHtml(field.label)}
              <select name="${escapeHtml(field.name)}">
                ${renderSelectOptions(field.options ?? [], field.value, {
                  allowBlank: true,
                  blankLabel: copy.none
                })}
              </select>
            </label>`;
          })
          .join("")}
      </div>
      <div class="toolbar filter-form-actions">
        <button class="secondary" type="submit">${escapeHtml(copy.applyFiltersLabel)}</button>
      </div>
    </form>
  </article>`;
}

export function renderProfileFacts(
  entries: Array<{ label: string; value: string }>
): string {
  return `<dl class="profile-facts">
    ${entries
      .map(
        (entry) => `<dt>${escapeHtml(entry.label)}</dt>
        <dd>${entry.value}</dd>`
      )
      .join("")}
  </dl>`;
}

export function renderUserIconSvg(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"></path>
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0"></path>
  </svg>`;
}

export function renderSignOutIconSvg(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 17l5-5-5-5"></path>
    <path d="M15 12H3"></path>
    <path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6"></path>
  </svg>`;
}
