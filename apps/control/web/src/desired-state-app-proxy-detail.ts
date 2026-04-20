import { escapeHtml } from "@simplehost/ui";

import { createBackupScopePanelItems } from "./dashboard-panels.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type RenderAppProxyDesiredStatePanelsArgs } from "./desired-state-app-proxy-types.js";

export function renderProxyDetailPanel(args: RenderAppProxyDesiredStatePanelsArgs): string {
  const {
    copy,
    locale,
    selectedApp,
    selectedAppBackupPolicies,
    selectedAppBackupRuns,
    selectedAppDatabases,
    selectedAppLatestFailure,
    selectedAppLatestSuccess,
    selectedAppProxyDrifts,
    renderers
  } = args;

  if (!selectedApp) {
    return "";
  }

  const primaryProxyResourceKey = `app:${selectedApp.slug}:proxy:${selectedApp.primaryNodeId}`;
  const proxyDriftHref = buildDashboardViewUrl(
    "resource-drift",
    undefined,
    primaryProxyResourceKey
  );
  const proxyBackupsHref = buildDashboardViewUrl("backups", undefined, undefined, {
    backupTenant: selectedApp.tenantSlug
  });
  const proxyBackupItems = createBackupScopePanelItems({
    backupsHref: proxyBackupsHref,
    backupsLabel: copy.openBackupsView,
    emptySummary: copy.none,
    formatDate: renderers.formatDate,
    latestFailureLabel: copy.latestFailureLabel,
    latestSuccessLabel: copy.latestSuccessLabel,
    locale,
    policyCount: selectedAppBackupPolicies.length,
    runs: selectedAppBackupRuns
  });

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.selectedResourceTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
      </div>
    </div>
    <div>
      <h3>${escapeHtml(selectedApp.canonicalDomain)}</h3>
      <p class="muted">${escapeHtml(selectedApp.slug)}</p>
    </div>
    ${renderers.renderDetailGrid([
      {
        label: copy.appColSlug,
        value: `<span class="mono">${escapeHtml(selectedApp.slug)}</span>`
      },
      { label: copy.appColTenant, value: escapeHtml(selectedApp.tenantSlug) },
      { label: copy.zoneColZone, value: escapeHtml(selectedApp.zoneName) },
      {
        label: copy.backendPortLabel,
        value: `<span class="mono">${escapeHtml(String(selectedApp.backendPort))}</span>`
      },
      {
        label: copy.aliasesLabel,
        value: escapeHtml(selectedApp.aliases.length > 0 ? selectedApp.aliases.join(", ") : copy.none)
      },
      {
        label: copy.appColNodes,
        value: `<span class="mono">${escapeHtml(
          selectedApp.standbyNodeId
            ? `${selectedApp.primaryNodeId} -> ${selectedApp.standbyNodeId}`
            : selectedApp.primaryNodeId
        )}</span>`
      }
    ])}
    <div class="grid grid-two">
      <article class="panel">
        <h3>${escapeHtml(copy.appRuntimeTitle)}</h3>
        ${renderers.renderDetailGrid([
          { label: copy.appColDomain, value: escapeHtml(selectedApp.canonicalDomain) },
          {
            label: copy.aliasesLabel,
            value: escapeHtml(selectedApp.aliases.length > 0 ? selectedApp.aliases.join(", ") : copy.none)
          },
          {
            label: copy.appColMode,
            value: renderers.renderPill(
              selectedApp.mode,
              selectedApp.mode === "active-active" ? "success" : "muted"
            )
          },
          {
            label: copy.runtimeImageLabel,
            value: `<span class="mono">${escapeHtml(selectedApp.runtimeImage)}</span>`
          }
        ])}
      </article>
      <article class="panel">
        <h3>${escapeHtml(copy.detailActionsTitle)}</h3>
        ${renderers.renderDetailGrid([
          {
            label: copy.dispatchRecommended,
            value:
              selectedAppProxyDrifts.length > 0
                ? renderers.renderPill(
                    selectedAppProxyDrifts.some((entry) => entry.dispatchRecommended)
                      ? copy.yesLabel
                      : copy.noLabel,
                    selectedAppProxyDrifts.some((entry) => entry.dispatchRecommended)
                      ? "danger"
                      : "success"
                  )
                : renderers.renderPill(copy.none, "muted")
          },
          {
            label: copy.latestSuccessLabel,
            value: selectedAppLatestSuccess
              ? `<a class="detail-link mono" href="${escapeHtml(
                  buildDashboardViewUrl("job-history", undefined, selectedAppLatestSuccess.jobId)
                )}">${escapeHtml(selectedAppLatestSuccess.jobId)}</a>`
              : renderers.renderPill(copy.none, "muted")
          },
          {
            label: copy.latestFailureLabel,
            value: selectedAppLatestFailure
              ? `<a class="detail-link mono" href="${escapeHtml(
                  buildDashboardViewUrl("job-history", undefined, selectedAppLatestFailure.jobId)
                )}">${escapeHtml(selectedAppLatestFailure.jobId)}</a>`
              : renderers.renderPill(copy.none, "muted")
          },
          {
            label: copy.linkedResource,
            value: `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("resource-drift", undefined, primaryProxyResourceKey)
            )}">${escapeHtml(primaryProxyResourceKey)}</a>`
          }
        ])}
        <div class="toolbar">
          ${renderers.renderActionForm(
            "/actions/app-render-proxy",
            { slug: selectedApp.slug },
            copy.actionDispatchProxyRender,
            {
              confirmMessage: `Dispatch proxy.render for app ${selectedApp.slug}? This will queue ${
                selectedApp.standbyNodeId ? 2 : 1
              } proxy.render job(s).`
            }
          )}
        </div>
        <div class="toolbar">
          <a class="button-link secondary" href="${escapeHtml(proxyDriftHref)}">${escapeHtml(
            copy.openDriftView
          )}</a>
          <a class="button-link secondary" href="${escapeHtml(proxyBackupsHref)}">${escapeHtml(
            copy.openBackupsView
          )}</a>
          <a class="button-link secondary" href="${escapeHtml(
            buildDashboardViewUrl("node-health", undefined, selectedApp.primaryNodeId)
          )}">${escapeHtml(copy.openNodeHealth)}</a>
        </div>
      </article>
    </div>
    ${renderers.renderRelatedPanel(
      copy.backupsTitle,
      copy.backupCoverageDescription,
      proxyBackupItems,
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.relatedResourcesTitle,
      copy.relatedResourcesDescription,
      [
        ...selectedAppDatabases.map((database) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("databases", undefined, database.appSlug)
          )}">${escapeHtml(database.databaseName)}</a>`,
          meta: escapeHtml(database.engine),
          summary: escapeHtml(database.databaseUser),
          tone: "default" as const
        })),
        ...selectedAppBackupPolicies.slice(0, 3).map((policy) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("backup-policies", undefined, policy.policySlug)
          )}">${escapeHtml(policy.policySlug)}</a>`,
          meta: escapeHtml(policy.targetNodeId),
          summary: escapeHtml(policy.schedule),
          tone: "default" as const
        }))
      ],
      copy.noRelatedRecords
    )}
  </article>`;
}

export function renderAppDetailPanel(args: RenderAppProxyDesiredStatePanelsArgs): string {
  const {
    copy,
    locale,
    selectedApp,
    selectedAppActionPreviewItems,
    selectedAppAuditEvents,
    selectedAppBackupPolicies,
    selectedAppBackupRuns,
    selectedAppDatabases,
    selectedAppJobs,
    selectedAppLatestFailure,
    selectedAppLatestSuccess,
    selectedAppPlanItems,
    selectedAppPrimaryNodeHealth,
    selectedAppProxyDrifts,
    appComparisonRows,
    renderers
  } = args;

  if (!selectedApp) {
    return "";
  }

  const primaryProxyResourceKey = `app:${selectedApp.slug}:proxy:${selectedApp.primaryNodeId}`;
  const appBackupsHref = buildDashboardViewUrl("backups", undefined, undefined, {
    backupTenant: selectedApp.tenantSlug
  });
  const appBackupItems = createBackupScopePanelItems({
    backupsHref: appBackupsHref,
    backupsLabel: copy.openBackupsView,
    emptySummary: copy.none,
    formatDate: renderers.formatDate,
    latestFailureLabel: copy.latestFailureLabel,
    latestSuccessLabel: copy.latestSuccessLabel,
    locale,
    policyCount: selectedAppBackupPolicies.length,
    runs: selectedAppBackupRuns
  });
  const appLatestBackupSummary =
    selectedAppBackupRuns.find((run) => run.status === "failed")?.summary ??
    selectedAppBackupRuns.find((run) => run.status === "succeeded")?.summary ??
    copy.none;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.selectedResourceTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
      </div>
    </div>
    <div>
      <h3>${escapeHtml(selectedApp.slug)}</h3>
      <p class="muted">${escapeHtml(selectedApp.canonicalDomain)}</p>
    </div>
    ${renderers.renderDetailGrid([
      { label: copy.appColTenant, value: escapeHtml(selectedApp.tenantSlug) },
      {
        label: copy.appColMode,
        value: renderers.renderPill(
          selectedApp.mode,
          selectedApp.mode === "active-active" ? "success" : "muted"
        )
      },
      {
        label: copy.backendPortLabel,
        value: `<span class="mono">${escapeHtml(String(selectedApp.backendPort))}</span>`
      },
      {
        label: copy.appColNodes,
        value: `<span class="mono">${escapeHtml(
          selectedApp.standbyNodeId
            ? `${selectedApp.primaryNodeId} -> ${selectedApp.standbyNodeId}`
            : selectedApp.primaryNodeId
        )}</span>`
      },
      {
        label: copy.nodeHealthTitle,
        value: selectedAppPrimaryNodeHealth?.latestJobStatus
          ? renderers.renderPill(
              selectedAppPrimaryNodeHealth.latestJobStatus,
              selectedAppPrimaryNodeHealth.latestJobStatus === "applied"
                ? "success"
                : selectedAppPrimaryNodeHealth.latestJobStatus === "failed"
                  ? "danger"
                  : "muted"
            )
          : renderers.renderPill(copy.none, "muted")
      },
      {
        label: copy.latestSuccessLabel,
        value: selectedAppLatestSuccess
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("job-history", undefined, selectedAppLatestSuccess.jobId)
            )}">${escapeHtml(selectedAppLatestSuccess.jobId)}</a>`
          : renderers.renderPill(copy.none, "muted")
      }
    ])}
    <div class="grid grid-two">
      <article class="panel">
        <h3>${escapeHtml(copy.appRuntimeTitle)}</h3>
        ${renderers.renderDetailGrid([
          {
            label: copy.runtimeImageLabel,
            value: `<span class="mono">${escapeHtml(selectedApp.runtimeImage)}</span>`
          },
          {
            label: copy.storageRootLabel,
            value: `<span class="mono">${escapeHtml(selectedApp.storageRoot)}</span>`
          },
          {
            label: copy.aliasesLabel,
            value: escapeHtml(selectedApp.aliases.length > 0 ? selectedApp.aliases.join(", ") : copy.none)
          },
          { label: copy.appColDomain, value: escapeHtml(selectedApp.canonicalDomain) }
        ])}
      </article>
      <article class="panel">
        <h3>${escapeHtml(copy.detailActionsTitle)}</h3>
        ${renderers.renderDetailGrid([
          { label: copy.zoneColZone, value: escapeHtml(selectedApp.zoneName) },
          {
            label: copy.zoneColPrimaryNode,
            value: `<span class="mono">${escapeHtml(selectedApp.primaryNodeId)}</span>`
          },
          {
            label: copy.dispatchRecommended,
            value:
              selectedAppProxyDrifts.length > 0
                ? renderers.renderPill(
                    selectedAppProxyDrifts.some((entry) => entry.dispatchRecommended)
                      ? copy.yesLabel
                      : copy.noLabel,
                    selectedAppProxyDrifts.some((entry) => entry.dispatchRecommended)
                      ? "danger"
                      : "success"
                  )
                : renderers.renderPill(copy.none, "muted")
          },
          {
            label: copy.linkedResource,
            value: `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("resource-drift", undefined, primaryProxyResourceKey)
            )}">${escapeHtml(primaryProxyResourceKey)}</a>`
          }
        ])}
        <div class="toolbar">
          ${renderers.renderActionForm(
            "/actions/app-reconcile",
            { slug: selectedApp.slug },
            copy.actionFullReconcile,
            {
              confirmMessage: `Run full reconcile for app ${selectedApp.slug}? This will queue ${
                selectedApp.standbyNodeId ? 3 : 2
              } job(s): ${selectedApp.standbyNodeId ? "2 proxy.render + 1 dns.sync" : "1 proxy.render + 1 dns.sync"}.`
            }
          )}
          ${renderers.renderActionForm(
            "/actions/app-render-proxy",
            { slug: selectedApp.slug },
            copy.actionDispatchProxyRender,
            {
              confirmMessage: `Dispatch proxy.render for app ${selectedApp.slug}? This will queue ${
                selectedApp.standbyNodeId ? 2 : 1
              } proxy.render job(s).`
            }
          )}
        </div>
        <div class="toolbar">
          <a class="button-link secondary" href="${escapeHtml(
            buildDashboardViewUrl("resource-drift", undefined, primaryProxyResourceKey)
          )}">${escapeHtml(copy.openDriftView)}</a>
          <a class="button-link secondary" href="${escapeHtml(appBackupsHref)}">${escapeHtml(
            copy.openBackupsView
          )}</a>
          <a class="button-link secondary" href="${escapeHtml(
            buildDashboardViewUrl("node-health", undefined, selectedApp.primaryNodeId)
          )}">${escapeHtml(copy.openNodeHealth)}</a>
          ${
            selectedAppJobs[0]
              ? `<a class="button-link secondary" href="${escapeHtml(
                  buildDashboardViewUrl("job-history", undefined, selectedAppJobs[0].jobId)
                )}">${escapeHtml(copy.openJobHistory)}</a>`
              : ""
          }
        </div>
      </article>
    </div>
    ${renderers.renderComparisonTable(
      copy.desiredAppliedTitle,
      copy.desiredAppliedDescription,
      appComparisonRows
    )}
    ${renderers.renderRelatedPanel(
      copy.fieldDeltaTitle,
      copy.fieldDeltaDescription,
      renderers.createComparisonDeltaItems(appComparisonRows),
      copy.noFieldDeltas
    )}
    ${renderers.renderRelatedPanel(
      copy.effectiveStateTitle,
      copy.effectiveStateDescription,
      [
        {
          title: escapeHtml(copy.nodeHealthTitle),
          meta: escapeHtml(selectedAppPrimaryNodeHealth?.currentVersion ?? copy.none),
          summary: escapeHtml(
            selectedAppPrimaryNodeHealth?.latestJobSummary ??
              selectedAppLatestSuccess?.summary ??
              copy.none
          ),
          tone: selectedAppPrimaryNodeHealth?.latestJobStatus === "failed"
            ? "danger"
            : selectedAppPrimaryNodeHealth?.latestJobStatus === "applied"
              ? "success"
              : "default"
        },
        {
          title: escapeHtml(copy.relatedDriftTitle),
          meta: escapeHtml(`${selectedAppProxyDrifts.length} drift item(s)`),
          summary: escapeHtml(
            selectedAppProxyDrifts[0]?.latestSummary ??
              `${selectedAppDatabases.length} database(s) and ${selectedApp.aliases.length} alias(es) currently depend on this app.`
          ),
          tone: selectedAppProxyDrifts.some(
            (entry) =>
              entry.driftStatus === "out_of_sync" || entry.driftStatus === "missing_secret"
          )
            ? "danger"
            : selectedAppProxyDrifts.some((entry) => entry.driftStatus === "in_sync")
              ? "success"
              : "default"
        },
        {
          title: escapeHtml(copy.relatedJobsTitle),
          meta: escapeHtml(`${selectedAppJobs.length} job(s)`),
          summary: escapeHtml(
            selectedAppLatestFailure?.summary ?? selectedAppLatestSuccess?.summary ?? copy.none
          ),
          tone: selectedAppJobs.some((job) => job.status === "failed")
            ? "danger"
            : selectedAppJobs.some((job) => job.status === "applied")
              ? "success"
              : "default"
        },
        {
          title: escapeHtml(copy.backupsTitle),
          meta: escapeHtml(
            `${selectedAppBackupRuns.length} run(s) · ${selectedAppBackupPolicies.length} polic(ies)`
          ),
          summary: escapeHtml(appLatestBackupSummary),
          tone: selectedAppBackupRuns.some((run) => run.status === "failed")
            ? "danger"
            : selectedAppBackupRuns.some((run) => run.status === "succeeded")
              ? "success"
              : "default"
        }
      ],
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.plannedChangesTitle,
      copy.plannedChangesDescription,
      selectedAppActionPreviewItems,
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.queuedWorkTitle,
      copy.queuedWorkDescription,
      selectedAppPlanItems,
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.backupsTitle,
      copy.backupCoverageDescription,
      appBackupItems,
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.relatedResourcesTitle,
      copy.relatedResourcesDescription,
      [
        ...selectedAppDatabases.map((database) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("desired-state", "desired-state-databases", database.appSlug)
          )}">${escapeHtml(database.databaseName)}</a>`,
          meta: escapeHtml(database.engine),
          summary: escapeHtml(database.databaseUser),
          tone: "default" as const
        })),
        ...selectedAppBackupPolicies.slice(0, 3).map((policy) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("desired-state", "desired-state-backups", policy.policySlug)
          )}">${escapeHtml(policy.policySlug)}</a>`,
          meta: escapeHtml(policy.targetNodeId),
          summary: escapeHtml(policy.schedule),
          tone: "default" as const
        }))
      ],
      copy.noRelatedRecords
    )}
    ${renderers.renderResourceActivityStack(selectedAppJobs, selectedAppAuditEvents)}
  </article>`;
}
