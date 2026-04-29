import { escapeHtml } from "@simplehost/ui";

import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type BackupCopy, type BackupsWorkspaceArgs } from "./dashboard-backups-types.js";

export function renderBackupRunPanel<Copy extends BackupCopy>(
  args: Pick<
    BackupsWorkspaceArgs<Copy>,
    | "copy"
    | "currentBackupFilters"
    | "formatDate"
    | "locale"
    | "renderDetailGrid"
    | "renderPill"
    | "selectedBackupPolicySummary"
    | "selectedBackupViewRun"
  >
): string {
  const {
    copy,
    currentBackupFilters,
    formatDate,
    locale,
    renderDetailGrid,
    renderPill,
    selectedBackupPolicySummary,
    selectedBackupViewRun
  } = args;

  if (!selectedBackupViewRun) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noBackups)}</p></article>`;
  }

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.backupRunTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.backupRunDescription)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedBackupViewRun.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    ${renderDetailGrid([
      { label: copy.backupColPolicy, value: `<span class="mono">${escapeHtml(selectedBackupViewRun.policySlug)}</span>` },
      {
        label: copy.backupColNode,
        value: `<a class="detail-link mono" href="${escapeHtml(
          buildDashboardViewUrl("node-health", undefined, selectedBackupViewRun.nodeId)
        )}">${escapeHtml(selectedBackupViewRun.nodeId)}</a>`
      },
      {
        label: copy.backupColStatus,
        value: renderPill(
          selectedBackupViewRun.status,
          selectedBackupViewRun.status === "succeeded"
            ? "success"
            : selectedBackupViewRun.status === "failed"
              ? "danger"
              : "muted"
        )
      },
      { label: copy.backupColSummary, value: escapeHtml(selectedBackupViewRun.summary) },
      {
        label: copy.backupColStarted,
        value: escapeHtml(formatDate(selectedBackupViewRun.startedAt, locale))
      },
      {
        label: copy.latestCompleted,
        value: escapeHtml(
          selectedBackupViewRun.completedAt
            ? formatDate(selectedBackupViewRun.completedAt, locale)
            : copy.none
        )
      },
      {
        label: copy.filterStatusLabel,
        value: `<a class="detail-link" href="${escapeHtml(
          buildDashboardViewUrl("backups", undefined, undefined, {
            ...currentBackupFilters,
            backupStatus: selectedBackupViewRun.status
          })
        )}">${escapeHtml(selectedBackupViewRun.status)}</a>`
      },
      {
        label: copy.filterNodeLabel,
        value: `<a class="detail-link mono" href="${escapeHtml(
          buildDashboardViewUrl("backups", undefined, undefined, {
            ...currentBackupFilters,
            backupNode: selectedBackupViewRun.nodeId
          })
        )}">${escapeHtml(selectedBackupViewRun.nodeId)}</a>`
      },
      {
        label: copy.filterPolicyLabel,
        value: `<a class="detail-link mono" href="${escapeHtml(
          buildDashboardViewUrl("backups", undefined, undefined, {
            ...currentBackupFilters,
            backupPolicy: selectedBackupViewRun.policySlug
          })
        )}">${escapeHtml(selectedBackupViewRun.policySlug)}</a>`
      },
      {
        label: copy.filterTenantLabel,
        value: selectedBackupPolicySummary
          ? `<a class="detail-link" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, undefined, {
                ...currentBackupFilters,
                backupTenant: selectedBackupPolicySummary.tenantSlug
              })
            )}">${escapeHtml(selectedBackupPolicySummary.tenantSlug)}</a>`
          : escapeHtml(copy.none)
      },
      {
        label: copy.openDesiredState,
        value: `<a class="detail-link" href="${escapeHtml(
          buildDashboardViewUrl("desired-state", "desired-state-backups", selectedBackupViewRun.policySlug)
        )}">${escapeHtml(copy.openDesiredState)}</a>`
      }
    ])}
  </article>`;
}

export function renderSelectedBackupPolicyPanel<Copy extends BackupCopy>(
  args: Pick<
    BackupsWorkspaceArgs<Copy>,
    | "copy"
    | "currentBackupFilters"
    | "renderActionFacts"
    | "renderDetailGrid"
    | "renderPill"
    | "selectedBackupPolicySummary"
  > & {
    selectedBackupPolicyLatestFailedRun:
      | BackupsWorkspaceArgs<Copy>["filteredBackupRuns"][number]
      | undefined;
    selectedBackupPolicyLatestSuccessRun:
      | BackupsWorkspaceArgs<Copy>["filteredBackupRuns"][number]
      | undefined;
    selectedBackupPolicyTargetHealth:
      | BackupsWorkspaceArgs<Copy>["data"]["nodeHealth"][number]
      | undefined;
  }
): string {
  const {
    copy,
    currentBackupFilters,
    renderActionFacts,
    renderDetailGrid,
    renderPill,
    selectedBackupPolicyLatestFailedRun,
    selectedBackupPolicyLatestSuccessRun,
    selectedBackupPolicySummary,
    selectedBackupPolicyTargetHealth
  } = args;

  if (!selectedBackupPolicySummary) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noBackupPolicies)}</p></article>`;
  }

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.backupPolicyContextTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.backupPolicyContextDescription)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl(
          "desired-state",
          "desired-state-backups",
          selectedBackupPolicySummary.policySlug
        )
      )}">${escapeHtml(copy.openDesiredState)}</a>
    </div>
    ${renderDetailGrid([
      { label: copy.backupPolicyColSlug, value: `<span class="mono">${escapeHtml(selectedBackupPolicySummary.policySlug)}</span>` },
      { label: copy.backupPolicyColTenant, value: escapeHtml(selectedBackupPolicySummary.tenantSlug) },
      {
        label: copy.backupPolicyColTargetNode,
        value: `<a class="detail-link mono" href="${escapeHtml(
          buildDashboardViewUrl("node-health", undefined, selectedBackupPolicySummary.targetNodeId)
        )}">${escapeHtml(selectedBackupPolicySummary.targetNodeId)}</a>`
      },
      {
        label: copy.backupPolicyColSchedule,
        value: `<span class="mono">${escapeHtml(selectedBackupPolicySummary.schedule)}</span>`
      },
      {
        label: copy.backupPolicyColRetention,
        value: escapeHtml(String(selectedBackupPolicySummary.retentionDays))
      },
      {
        label: copy.storageLocationLabel,
        value: `<span class="mono">${escapeHtml(selectedBackupPolicySummary.storageLocation)}</span>`
      },
      {
        label: copy.resourceSelectorsLabel,
        value: escapeHtml(
          selectedBackupPolicySummary.resourceSelectors.length > 0
            ? selectedBackupPolicySummary.resourceSelectors.join(", ")
            : copy.none
        )
      },
      {
        label: copy.latestSuccessLabel,
        value: selectedBackupPolicyLatestSuccessRun
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, selectedBackupPolicyLatestSuccessRun.runId)
            )}">${escapeHtml(selectedBackupPolicyLatestSuccessRun.runId)}</a>`
          : renderPill(copy.none, "muted")
      },
      {
        label: copy.latestFailureLabel,
        value: selectedBackupPolicyLatestFailedRun
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, selectedBackupPolicyLatestFailedRun.runId)
            )}">${escapeHtml(selectedBackupPolicyLatestFailedRun.runId)}</a>`
          : renderPill(copy.none, "muted")
      },
      {
        label: copy.nodeHealthTitle,
        value: selectedBackupPolicyTargetHealth?.latestJobStatus
          ? renderPill(
              selectedBackupPolicyTargetHealth.latestJobStatus,
              selectedBackupPolicyTargetHealth.latestJobStatus === "applied"
                ? "success"
                : selectedBackupPolicyTargetHealth.latestJobStatus === "failed"
                  ? "danger"
                  : "muted"
            )
          : renderPill(copy.none, "muted")
      }
    ])}
    ${renderActionFacts([
      {
        label: copy.filterPolicyLabel,
        value: `<a class="detail-link mono" href="${escapeHtml(
          buildDashboardViewUrl("backups", undefined, undefined, {
            ...currentBackupFilters,
            backupPolicy: selectedBackupPolicySummary.policySlug
          })
        )}">${escapeHtml(selectedBackupPolicySummary.policySlug)}</a>`
      },
      {
        label: copy.filterTenantLabel,
        value: `<a class="detail-link" href="${escapeHtml(
          buildDashboardViewUrl("backups", undefined, undefined, {
            ...currentBackupFilters,
            backupTenant: selectedBackupPolicySummary.tenantSlug
          })
        )}">${escapeHtml(selectedBackupPolicySummary.tenantSlug)}</a>`
      },
      {
        label: copy.filterNodeLabel,
        value: `<a class="detail-link mono" href="${escapeHtml(
          buildDashboardViewUrl("backups", undefined, undefined, {
            ...currentBackupFilters,
            backupNode: selectedBackupPolicySummary.targetNodeId
          })
        )}">${escapeHtml(selectedBackupPolicySummary.targetNodeId)}</a>`
      }
    ])}
  </article>`;
}
