import { escapeHtml } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import {
  type DesiredStateActionFactsRenderer,
  type DesiredStateActionFormRenderer,
  type DesiredStateComparisonDeltaItemsRenderer,
  type DesiredStateComparisonRow,
  type DesiredStateComparisonTableRenderer,
  type DesiredStateDetailGridRenderer,
  type DesiredStatePillRenderer,
  type DesiredStateRelatedPanelItem,
  type DesiredStateRelatedPanelRenderer,
  type DesiredStateSelectOption,
  type DesiredStateSelectOptionsRenderer
} from "./desired-state-shared.js";

type App = DashboardData["desiredState"]["spec"]["apps"][number];
type BackupPolicy = DashboardData["desiredState"]["spec"]["backupPolicies"][number];
type Database = DashboardData["desiredState"]["spec"]["databases"][number];
type Job = DashboardData["jobHistory"][number];
type AuditEvent = DashboardData["auditEvents"][number];
type NodeHealth = DashboardData["nodeHealth"][number];
type DriftEntry = DashboardData["drift"][number];

export interface DesiredStateDatabaseCopy {
  selectedResourceTitle: string;
  selectedResourceDescription: string;
  propertiesStatusTitle: string;
  propertiesStatusDescription: string;
  resourceActionsTitle: string;
  resourceActionsDescription: string;
  databaseColApp: string;
  databaseColEngine: string;
  databaseColUser: string;
  nodeHealthTitle: string;
  databaseColMigration: string;
  migrationPendingLabel: string;
  migrationCompletedLabel: string;
  migrationCompletedAtLabel: string;
  latestSuccessLabel: string;
  databaseAccessTitle: string;
  databaseColNodes: string;
  appColDomain: string;
  databaseColDatabase: string;
  detailActionsTitle: string;
  dispatchRecommended: string;
  yesLabel: string;
  noLabel: string;
  linkedResource: string;
  actionDispatchDatabaseReconcile: string;
  openDriftView: string;
  openJobHistory: string;
  openAuditHistory: string;
  desiredAppliedTitle: string;
  desiredAppliedDescription: string;
  fieldDeltaTitle: string;
  fieldDeltaDescription: string;
  noFieldDeltas: string;
  effectiveStateTitle: string;
  effectiveStateDescription: string;
  relatedDriftTitle: string;
  relatedJobsTitle: string;
  noRelatedRecords: string;
  plannedChangesTitle: string;
  plannedChangesDescription: string;
  queuedWorkTitle: string;
  queuedWorkDescription: string;
  relatedResourcesTitle: string;
  relatedResourcesDescription: string;
  desiredStateEditorsTitle: string;
  desiredStateEditorsDescription: string;
  previewTitle: string;
  targetedNodesLabel: string;
  affectedResourcesLabel: string;
  latestFailureLabel: string;
  dangerZoneTitle: string;
  none: string;
}

interface DesiredStateDatabaseRenderers {
  renderActionFacts: DesiredStateActionFactsRenderer;
  renderActionForm: DesiredStateActionFormRenderer;
  renderComparisonTable: DesiredStateComparisonTableRenderer<DesiredStateComparisonRow>;
  createComparisonDeltaItems: DesiredStateComparisonDeltaItemsRenderer<DesiredStateComparisonRow>;
  renderDetailGrid: DesiredStateDetailGridRenderer;
  renderPill: DesiredStatePillRenderer;
  renderRelatedPanel: DesiredStateRelatedPanelRenderer<DesiredStateRelatedPanelItem>;
  renderResourceActivityStack: (jobs: Job[], audits: AuditEvent[]) => string;
  renderSelectOptions: DesiredStateSelectOptionsRenderer;
}

function renderDatabaseMigrationPill(
  copy: DesiredStateDatabaseCopy,
  renderers: Pick<DesiredStateDatabaseRenderers, "renderPill">,
  database: Database
): string {
  if (database.pendingMigrationTo) {
    return renderers.renderPill(
      `${copy.migrationPendingLabel}: ${database.engine} -> ${database.pendingMigrationTo}`,
      "danger"
    );
  }

  if (database.migrationCompletedFrom) {
    return renderers.renderPill(
      `${copy.migrationCompletedLabel}: ${database.migrationCompletedFrom} -> ${database.engine}`,
      "success"
    );
  }

  return renderers.renderPill(copy.none, "muted");
}

function renderDatabaseWorkspacePanel(args: {
  copy: DesiredStateDatabaseCopy;
  selectedDatabase: Database | undefined;
  selectedDatabaseApp: App | undefined;
  selectedDatabaseJobs: Job[];
  selectedDatabaseAuditEvents: AuditEvent[];
  selectedDatabasePrimaryNodeHealth: NodeHealth | undefined;
  selectedDatabaseLatestSuccess: Job | undefined;
  selectedDatabaseDrift: DriftEntry | undefined;
  appOptions: DesiredStateSelectOption[];
  nodeOptions: DesiredStateSelectOption[];
  renderers: DesiredStateDatabaseRenderers;
}): string {
  const {
    copy,
    selectedDatabase,
    selectedDatabaseApp,
    selectedDatabaseJobs,
    selectedDatabaseAuditEvents,
    selectedDatabasePrimaryNodeHealth,
    selectedDatabaseLatestSuccess,
    selectedDatabaseDrift,
    appOptions,
    nodeOptions,
    renderers
  } = args;

  if (!selectedDatabase) {
    return "";
  }

  const databaseResourceKey = `database:${selectedDatabase.appSlug}`;
  const databaseJobsHref = buildDashboardViewUrl(
    "jobs",
    undefined,
    selectedDatabaseJobs[0]?.jobId ?? selectedDatabaseLatestSuccess?.jobId,
    { jobResource: databaseResourceKey }
  );
  const databaseAuditHref = buildDashboardViewUrl(
    "audit",
    undefined,
    selectedDatabaseAuditEvents[0]?.eventId,
    { auditEntity: selectedDatabase.appSlug }
  );
  const databaseDriftHref = buildDashboardViewUrl(
    "resource-drift",
    undefined,
    databaseResourceKey
  );

  return `<article class="panel detail-shell resource-workspace-panel">
    <div class="section-head">
      <div>
        <div class="section-title-row">
          <h3>${escapeHtml(copy.selectedResourceTitle)}</h3>
          <span class="section-badge section-badge-lime">${escapeHtml(
            selectedDatabase.databaseName
          )}</span>
        </div>
        <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
      </div>
    </div>
    <div class="resource-workspace-columns">
      <div class="resource-workspace-column stack">
        <article class="panel panel-nested detail-shell">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(copy.propertiesStatusTitle)}</h3>
              <p class="muted section-description">${escapeHtml(copy.propertiesStatusDescription)}</p>
            </div>
          </div>
          ${renderers.renderDetailGrid(
            [
              { label: copy.databaseColApp, value: escapeHtml(selectedDatabase.appSlug) },
              { label: copy.databaseColEngine, value: escapeHtml(selectedDatabase.engine) },
              {
                label: copy.databaseColDatabase,
                value: `<span class="mono">${escapeHtml(selectedDatabase.databaseName)}</span>`
              },
              {
                label: copy.databaseColUser,
                value: `<span class="mono">${escapeHtml(selectedDatabase.databaseUser)}</span>`
              },
              {
                label: copy.databaseColNodes,
                value: `<span class="mono">${escapeHtml(
                  selectedDatabase.standbyNodeId
                    ? `${selectedDatabase.primaryNodeId} -> ${selectedDatabase.standbyNodeId}`
                    : selectedDatabase.primaryNodeId
                )}</span>`
              },
              {
                label: copy.nodeHealthTitle,
                value: selectedDatabasePrimaryNodeHealth?.latestJobStatus
                  ? renderers.renderPill(
                      selectedDatabasePrimaryNodeHealth.latestJobStatus,
                      selectedDatabasePrimaryNodeHealth.latestJobStatus === "applied"
                        ? "success"
                        : selectedDatabasePrimaryNodeHealth.latestJobStatus === "failed"
                          ? "danger"
                          : "muted"
                    )
                  : renderers.renderPill(copy.none, "muted")
              },
              {
                label: copy.databaseColMigration,
                value: renderDatabaseMigrationPill(copy, renderers, selectedDatabase)
              },
              {
                label: copy.migrationCompletedAtLabel,
                value: selectedDatabase.migrationCompletedAt
                  ? `<span class="mono">${escapeHtml(selectedDatabase.migrationCompletedAt)}</span>`
                  : renderers.renderPill(copy.none, "muted")
              },
              {
                label: copy.appColDomain,
                value: escapeHtml(selectedDatabaseApp?.canonicalDomain ?? copy.none)
              },
              {
                label: copy.latestSuccessLabel,
                value: selectedDatabaseLatestSuccess
                  ? `<a class="detail-link mono" href="${escapeHtml(
                      buildDashboardViewUrl(
                        "jobs",
                        undefined,
                        selectedDatabaseLatestSuccess.jobId
                      )
                    )}">${escapeHtml(selectedDatabaseLatestSuccess.jobId)}</a>`
                  : renderers.renderPill(copy.none, "muted"),
                className: "detail-item-span-two"
              }
            ],
            { className: "detail-grid-compact" }
          )}
        </article>
        <article class="panel panel-nested detail-shell">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(copy.resourceActionsTitle)}</h3>
              <p class="muted section-description">${escapeHtml(copy.resourceActionsDescription)}</p>
            </div>
          </div>
          <div class="toolbar resource-actions-toolbar">
            ${renderers.renderActionForm(
              "/actions/database-reconcile",
              { appSlug: selectedDatabase.appSlug },
              copy.actionDispatchDatabaseReconcile,
              {
                confirmMessage: `Dispatch database reconcile for ${selectedDatabase.appSlug}? This will queue 1 ${selectedDatabase.engine} reconcile job on ${selectedDatabase.primaryNodeId}.`
              }
            )}
            <a class="button-link secondary" href="${escapeHtml(databaseJobsHref)}">${escapeHtml(
              copy.openJobHistory
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(databaseAuditHref)}">${escapeHtml(
              copy.openAuditHistory
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(databaseDriftHref)}">${escapeHtml(
              copy.openDriftView
            )}</a>
          </div>
        </article>
      </div>
      <div class="resource-workspace-column stack">
        <article class="panel panel-nested detail-shell">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(copy.desiredStateEditorsTitle)}</h3>
              <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
            </div>
          </div>
          <form method="post" action="/resources/databases/upsert" class="stack">
            <input type="hidden" name="originalAppSlug" value="${escapeHtml(selectedDatabase.appSlug)}" />
            <div class="form-grid">
              <label>App slug
                <select name="appSlug" required>
                  ${renderers.renderSelectOptions(appOptions, selectedDatabase.appSlug)}
                </select>
              </label>
              <label>Engine
                <select name="engine">
                  <option value="postgresql"${selectedDatabase.engine === "postgresql" ? " selected" : ""}>postgresql</option>
                  <option value="mariadb"${selectedDatabase.engine === "mariadb" ? " selected" : ""}>mariadb</option>
                </select>
              </label>
              <label>Database name
                <input name="databaseName" value="${escapeHtml(selectedDatabase.databaseName)}" required spellcheck="false" />
              </label>
              <label>Database user
                <input name="databaseUser" value="${escapeHtml(selectedDatabase.databaseUser)}" required spellcheck="false" />
              </label>
              <label>Primary node
                <select name="primaryNodeId" required>
                  ${renderers.renderSelectOptions(nodeOptions, selectedDatabase.primaryNodeId)}
                </select>
              </label>
              <label>Standby node
                <select name="standbyNodeId">
                  ${renderers.renderSelectOptions(nodeOptions, selectedDatabase.standbyNodeId, {
                    allowBlank: true,
                    blankLabel: "none"
                  })}
                </select>
              </label>
              <label>Pending migration target
                <input name="pendingMigrationTo" value="${escapeHtml(selectedDatabase.pendingMigrationTo ?? "")}" />
              </label>
              <label>Completed migration source
                <select name="migrationCompletedFrom">
                  <option value="">none</option>
                  <option value="postgresql"${selectedDatabase.migrationCompletedFrom === "postgresql" ? " selected" : ""}>postgresql</option>
                  <option value="mariadb"${selectedDatabase.migrationCompletedFrom === "mariadb" ? " selected" : ""}>mariadb</option>
                </select>
              </label>
              <label>Migration completed at
                <input name="migrationCompletedAt" value="${escapeHtml(selectedDatabase.migrationCompletedAt ?? "")}" placeholder="2026-04-12T10:30:00Z" spellcheck="false" />
              </label>
              <label>Desired password
                <input type="password" name="desiredPassword" placeholder="leave blank to keep stored secret" />
              </label>
            </div>
            <div class="toolbar">
              <button type="submit">Save database</button>
            </div>
          </form>
        </article>
      </div>
    </div>
  </article>`;
}

export function renderDatabaseDesiredStatePanels(args: {
  copy: DesiredStateDatabaseCopy;
  selectedDatabase: Database | undefined;
  selectedDatabaseApp: App | undefined;
  selectedDatabaseBackupPolicies: BackupPolicy[];
  selectedDatabaseJobs: Job[];
  selectedDatabaseAuditEvents: AuditEvent[];
  selectedDatabasePrimaryNodeHealth: NodeHealth | undefined;
  selectedDatabaseLatestSuccess: Job | undefined;
  selectedDatabaseLatestFailure: Job | undefined;
  selectedDatabaseDrift: DriftEntry | undefined;
  selectedDatabaseActionPreviewItems: DesiredStateRelatedPanelItem[];
  selectedDatabasePlanItems: DesiredStateRelatedPanelItem[];
  databaseComparisonRows: DesiredStateComparisonRow[];
  appOptions: DesiredStateSelectOption[];
  nodeOptions: DesiredStateSelectOption[];
  renderers: DesiredStateDatabaseRenderers;
}): { detailPanel: string; editorPanel: string; workspacePanel: string } {
  const {
    copy,
    selectedDatabase,
    selectedDatabaseApp,
    selectedDatabaseBackupPolicies,
    selectedDatabaseJobs,
    selectedDatabaseAuditEvents,
    selectedDatabasePrimaryNodeHealth,
    selectedDatabaseLatestSuccess,
    selectedDatabaseLatestFailure,
    selectedDatabaseDrift,
    selectedDatabaseActionPreviewItems,
    selectedDatabasePlanItems,
    databaseComparisonRows,
    appOptions,
    nodeOptions,
    renderers
  } = args;

  if (!selectedDatabase) {
    return {
      detailPanel: "",
      editorPanel: "",
      workspacePanel: ""
    };
  }

  const databaseResourceKey = `database:${selectedDatabase.appSlug}`;

  const detailPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.selectedResourceTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
      </div>
    </div>
    <div>
      <h3>${escapeHtml(selectedDatabase.databaseName)}</h3>
      <p class="muted">${escapeHtml(selectedDatabase.appSlug)}</p>
    </div>
    ${renderers.renderDetailGrid([
      { label: copy.databaseColApp, value: escapeHtml(selectedDatabase.appSlug) },
      { label: copy.databaseColEngine, value: escapeHtml(selectedDatabase.engine) },
      {
        label: copy.databaseColUser,
        value: `<span class="mono">${escapeHtml(selectedDatabase.databaseUser)}</span>`
      },
      {
        label: copy.nodeHealthTitle,
        value: selectedDatabasePrimaryNodeHealth?.latestJobStatus
          ? renderers.renderPill(
              selectedDatabasePrimaryNodeHealth.latestJobStatus,
              selectedDatabasePrimaryNodeHealth.latestJobStatus === "applied"
                ? "success"
                : selectedDatabasePrimaryNodeHealth.latestJobStatus === "failed"
                  ? "danger"
                  : "muted"
            )
          : renderers.renderPill(copy.none, "muted")
      },
      {
        label: copy.databaseColMigration,
        value: renderDatabaseMigrationPill(copy, renderers, selectedDatabase)
      },
      {
        label: copy.migrationCompletedAtLabel,
        value: selectedDatabase.migrationCompletedAt
          ? `<span class="mono">${escapeHtml(selectedDatabase.migrationCompletedAt)}</span>`
          : renderers.renderPill(copy.none, "muted")
      },
      {
        label: copy.latestSuccessLabel,
        value: selectedDatabaseLatestSuccess
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("job-history", undefined, selectedDatabaseLatestSuccess.jobId)
            )}">${escapeHtml(selectedDatabaseLatestSuccess.jobId)}</a>`
          : renderers.renderPill(copy.none, "muted")
      }
    ])}
    <div class="grid grid-two">
      <article class="panel">
        <h3>${escapeHtml(copy.databaseAccessTitle)}</h3>
        ${renderers.renderDetailGrid([
          {
            label: copy.databaseColNodes,
            value: `<span class="mono">${escapeHtml(
              selectedDatabase.standbyNodeId
                ? `${selectedDatabase.primaryNodeId} -> ${selectedDatabase.standbyNodeId}`
                : selectedDatabase.primaryNodeId
            )}</span>`
          },
          {
            label: copy.appColDomain,
            value: escapeHtml(selectedDatabaseApp?.canonicalDomain ?? copy.none)
          },
          {
            label: copy.databaseColDatabase,
            value: `<span class="mono">${escapeHtml(selectedDatabase.databaseName)}</span>`
          },
          {
            label: copy.databaseColUser,
            value: `<span class="mono">${escapeHtml(selectedDatabase.databaseUser)}</span>`
          }
        ])}
      </article>
      <article class="panel">
        <h3>${escapeHtml(copy.detailActionsTitle)}</h3>
        ${renderers.renderDetailGrid([
          { label: copy.databaseColEngine, value: escapeHtml(selectedDatabase.engine) },
          {
            label: copy.databaseColDatabase,
            value: `<span class="mono">${escapeHtml(selectedDatabase.databaseName)}</span>`
          },
          {
            label: copy.dispatchRecommended,
            value: selectedDatabaseDrift
              ? renderers.renderPill(
                  selectedDatabaseDrift.dispatchRecommended ? copy.yesLabel : copy.noLabel,
                  selectedDatabaseDrift.dispatchRecommended ? "danger" : "success"
                )
              : renderers.renderPill(copy.none, "muted")
          },
          {
            label: copy.linkedResource,
            value: `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("resource-drift", undefined, databaseResourceKey)
            )}">${escapeHtml(databaseResourceKey)}</a>`
          }
        ])}
        <div class="toolbar">
          ${renderers.renderActionForm(
            "/actions/database-reconcile",
            { appSlug: selectedDatabase.appSlug },
            copy.actionDispatchDatabaseReconcile,
            {
              confirmMessage: `Dispatch database reconcile for ${selectedDatabase.appSlug}? This will queue 1 ${selectedDatabase.engine} reconcile job on ${selectedDatabase.primaryNodeId}.`
            }
          )}
        </div>
        <div class="toolbar">
          <a class="button-link secondary" href="${escapeHtml(
            buildDashboardViewUrl("resource-drift", undefined, databaseResourceKey)
          )}">${escapeHtml(copy.openDriftView)}</a>
          ${
            selectedDatabaseJobs[0]
              ? `<a class="button-link secondary" href="${escapeHtml(
                  buildDashboardViewUrl("job-history", undefined, selectedDatabaseJobs[0].jobId)
                )}">${escapeHtml(copy.openJobHistory)}</a>`
              : ""
          }
        </div>
      </article>
    </div>
    ${renderers.renderComparisonTable(
      copy.desiredAppliedTitle,
      copy.desiredAppliedDescription,
      databaseComparisonRows
    )}
    ${renderers.renderRelatedPanel(
      copy.fieldDeltaTitle,
      copy.fieldDeltaDescription,
      renderers.createComparisonDeltaItems(databaseComparisonRows),
      copy.noFieldDeltas
    )}
    ${renderers.renderRelatedPanel(
      copy.effectiveStateTitle,
      copy.effectiveStateDescription,
      [
        {
          title: escapeHtml(copy.nodeHealthTitle),
          meta: escapeHtml(selectedDatabasePrimaryNodeHealth?.currentVersion ?? copy.none),
          summary: escapeHtml(
            selectedDatabasePrimaryNodeHealth?.latestJobSummary ??
              selectedDatabaseLatestSuccess?.summary ??
              copy.none
          ),
          tone: selectedDatabasePrimaryNodeHealth?.latestJobStatus === "failed"
            ? "danger"
            : selectedDatabasePrimaryNodeHealth?.latestJobStatus === "applied"
              ? "success"
              : "default"
        },
        {
          title: escapeHtml(copy.relatedDriftTitle),
          meta: escapeHtml(selectedDatabaseDrift?.driftStatus ?? copy.none),
          summary: escapeHtml(
            selectedDatabaseDrift?.latestSummary ??
              `${selectedDatabase.engine} on ${selectedDatabase.primaryNodeId} for ${selectedDatabase.databaseUser}.`
          ),
          tone:
            selectedDatabaseDrift?.driftStatus === "out_of_sync" ||
            selectedDatabaseDrift?.driftStatus === "missing_secret"
              ? "danger"
              : selectedDatabaseDrift?.driftStatus === "in_sync"
                ? "success"
                : "default"
        },
        {
          title: escapeHtml(copy.relatedJobsTitle),
          meta: escapeHtml(`${selectedDatabaseJobs.length} job(s)`),
          summary: escapeHtml(
            selectedDatabaseLatestFailure?.summary ??
              selectedDatabaseLatestSuccess?.summary ??
              copy.none
          ),
          tone: selectedDatabaseJobs.some((job) => job.status === "failed")
            ? "danger"
            : selectedDatabaseJobs.some((job) => job.status === "applied")
              ? "success"
              : "default"
        }
      ],
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.plannedChangesTitle,
      copy.plannedChangesDescription,
      selectedDatabaseActionPreviewItems,
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.queuedWorkTitle,
      copy.queuedWorkDescription,
      selectedDatabasePlanItems,
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.relatedResourcesTitle,
      copy.relatedResourcesDescription,
      [
        {
          title: selectedDatabaseApp
            ? `<a class="detail-link" href="${escapeHtml(
                buildDashboardViewUrl("desired-state", "desired-state-apps", selectedDatabaseApp.slug)
              )}">${escapeHtml(selectedDatabaseApp.slug)}</a>`
            : escapeHtml(selectedDatabase.appSlug),
          meta: escapeHtml(selectedDatabaseApp?.canonicalDomain ?? copy.none),
          summary: escapeHtml(selectedDatabaseApp?.zoneName ?? copy.none),
          tone: "default" as const
        },
        {
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("node-health", undefined, selectedDatabase.primaryNodeId)
          )}">${escapeHtml(selectedDatabase.primaryNodeId)}</a>`,
          meta: escapeHtml(selectedDatabase.engine),
          summary: escapeHtml(selectedDatabase.databaseUser),
          tone: "default" as const
        },
        ...selectedDatabaseBackupPolicies.slice(0, 3).map((policy) => ({
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
    ${renderers.renderResourceActivityStack(selectedDatabaseJobs, selectedDatabaseAuditEvents)}
  </article>`;

  const editorPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.desiredStateEditorsTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
      </div>
    </div>
    <form method="post" action="/resources/databases/upsert" class="stack">
      <input type="hidden" name="originalAppSlug" value="${escapeHtml(selectedDatabase.appSlug)}" />
      <div class="grid grid-two">
        <article class="panel panel-nested detail-shell">
          <div>
            <h3>${escapeHtml(copy.detailActionsTitle)}</h3>
            <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
          </div>
          <div class="form-grid">
            <label>App slug
              <select name="appSlug" required>
                ${renderers.renderSelectOptions(appOptions, selectedDatabase.appSlug)}
              </select>
            </label>
            <label>Engine
              <select name="engine">
                <option value="postgresql"${selectedDatabase.engine === "postgresql" ? " selected" : ""}>postgresql</option>
                <option value="mariadb"${selectedDatabase.engine === "mariadb" ? " selected" : ""}>mariadb</option>
              </select>
            </label>
            <label>Database name
              <input name="databaseName" value="${escapeHtml(selectedDatabase.databaseName)}" required spellcheck="false" />
            </label>
            <label>Database user
              <input name="databaseUser" value="${escapeHtml(selectedDatabase.databaseUser)}" required spellcheck="false" />
            </label>
            <label>Primary node
              <select name="primaryNodeId" required>
                ${renderers.renderSelectOptions(nodeOptions, selectedDatabase.primaryNodeId)}
              </select>
            </label>
            <label>Standby node
              <select name="standbyNodeId">
                ${renderers.renderSelectOptions(nodeOptions, selectedDatabase.standbyNodeId, {
                  allowBlank: true,
                  blankLabel: "none"
                })}
              </select>
            </label>
            <label>Pending migration target
              <input name="pendingMigrationTo" value="${escapeHtml(selectedDatabase.pendingMigrationTo ?? "")}" />
            </label>
            <label>Completed migration source
              <select name="migrationCompletedFrom">
                <option value="">none</option>
                <option value="postgresql"${selectedDatabase.migrationCompletedFrom === "postgresql" ? " selected" : ""}>postgresql</option>
                <option value="mariadb"${selectedDatabase.migrationCompletedFrom === "mariadb" ? " selected" : ""}>mariadb</option>
              </select>
            </label>
            <label>Migration completed at
              <input name="migrationCompletedAt" value="${escapeHtml(selectedDatabase.migrationCompletedAt ?? "")}" placeholder="2026-04-12T10:30:00Z" spellcheck="false" />
            </label>
            <label>Desired password
              <input type="password" name="desiredPassword" placeholder="leave blank to keep stored secret" />
            </label>
          </div>
          <div class="toolbar">
            <button type="submit">Save database</button>
            <button class="secondary" type="submit" formaction="/actions/database-reconcile" data-confirm="${escapeHtml(
              `Dispatch database reconcile for ${selectedDatabase.appSlug}? This will queue 1 ${selectedDatabase.engine} reconcile job on ${selectedDatabase.primaryNodeId}.`
            )}">Dispatch database reconcile</button>
          </div>
        </article>
        <article class="panel panel-nested detail-shell">
          <div>
            <h3>${escapeHtml(copy.previewTitle)}</h3>
            <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
          </div>
          ${renderers.renderActionFacts([
            {
              label: copy.targetedNodesLabel,
              value: `<span class="mono">${escapeHtml(
                selectedDatabase.standbyNodeId
                  ? `${selectedDatabase.primaryNodeId} -> ${selectedDatabase.standbyNodeId}`
                  : selectedDatabase.primaryNodeId
              )}</span>`
            },
            {
              label: copy.affectedResourcesLabel,
              value: escapeHtml(
                `${selectedDatabase.engine} · ${selectedDatabase.databaseName} · ${selectedDatabaseApp?.canonicalDomain ?? selectedDatabase.appSlug}`
              )
            },
            {
              label: copy.latestFailureLabel,
              value: selectedDatabaseLatestFailure
                ? `<a class="detail-link mono" href="${escapeHtml(
                    buildDashboardViewUrl("job-history", undefined, selectedDatabaseLatestFailure.jobId)
                  )}">${escapeHtml(selectedDatabaseLatestFailure.jobId)}</a>`
                : escapeHtml(copy.none)
            },
            {
              label: copy.linkedResource,
              value: `<a class="detail-link mono" href="${escapeHtml(
                buildDashboardViewUrl("resource-drift", undefined, databaseResourceKey)
              )}">${escapeHtml(databaseResourceKey)}</a>`
            },
            {
              label: copy.dispatchRecommended,
              value: selectedDatabaseDrift
                ? renderers.renderPill(
                    selectedDatabaseDrift.dispatchRecommended ? copy.yesLabel : copy.noLabel,
                    selectedDatabaseDrift.dispatchRecommended ? "danger" : "success"
                  )
                : renderers.renderPill(copy.none, "muted")
            }
          ])}
          ${renderers.renderComparisonTable(
            copy.desiredAppliedTitle,
            copy.desiredAppliedDescription,
            databaseComparisonRows
          )}
          ${renderers.renderRelatedPanel(
            copy.queuedWorkTitle,
            copy.queuedWorkDescription,
            selectedDatabasePlanItems,
            copy.noRelatedRecords
          )}
          ${renderers.renderRelatedPanel(
            copy.fieldDeltaTitle,
            copy.fieldDeltaDescription,
            renderers.createComparisonDeltaItems(databaseComparisonRows),
            copy.noFieldDeltas
          )}
          ${renderers.renderRelatedPanel(
            copy.plannedChangesTitle,
            copy.plannedChangesDescription,
            selectedDatabaseActionPreviewItems,
            copy.noRelatedRecords
          )}
          ${renderers.renderRelatedPanel(
            copy.relatedResourcesTitle,
            copy.relatedResourcesDescription,
            [
              {
                title: selectedDatabaseApp
                  ? `<a class="detail-link" href="${escapeHtml(
                      buildDashboardViewUrl("desired-state", "desired-state-apps", selectedDatabaseApp.slug)
                    )}">${escapeHtml(selectedDatabaseApp.slug)}</a>`
                  : escapeHtml(selectedDatabase.appSlug),
                meta: escapeHtml(selectedDatabaseApp?.canonicalDomain ?? copy.none),
                summary: escapeHtml(selectedDatabaseApp?.zoneName ?? copy.none),
                tone: "default" as const
              }
            ],
            copy.noRelatedRecords
          )}
        </article>
      </div>
    </form>
    <article class="panel panel-nested detail-shell danger-shell">
      <div>
        <h3>${escapeHtml(copy.dangerZoneTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
      </div>
      ${renderers.renderActionFacts([
        {
          label: copy.affectedResourcesLabel,
          value: escapeHtml(
            `${selectedDatabase.engine} · ${selectedDatabase.databaseName} · ${selectedDatabaseApp?.canonicalDomain ?? selectedDatabase.appSlug}`
          )
        },
        {
          label: copy.targetedNodesLabel,
          value: `<span class="mono">${escapeHtml(
            selectedDatabase.standbyNodeId
              ? `${selectedDatabase.primaryNodeId} -> ${selectedDatabase.standbyNodeId}`
              : selectedDatabase.primaryNodeId
          )}</span>`
        },
        {
          label: copy.databaseColApp,
          value: escapeHtml(selectedDatabase.appSlug)
        }
      ])}
      <form method="post" action="/resources/databases/delete" class="toolbar">
        <input type="hidden" name="appSlug" value="${escapeHtml(selectedDatabase.appSlug)}" />
        <button class="danger" type="submit" data-confirm="${escapeHtml(
          `Delete database ${selectedDatabase.databaseName} from desired state? Future ${selectedDatabase.engine} reconciliation for ${selectedDatabase.appSlug} will stop on ${selectedDatabase.primaryNodeId}.`
        )}">Delete database</button>
      </form>
    </article>
  </article>`;

  const workspacePanel = renderDatabaseWorkspacePanel({
    copy,
    selectedDatabase,
    selectedDatabaseApp,
    selectedDatabaseJobs,
    selectedDatabaseAuditEvents,
    selectedDatabasePrimaryNodeHealth,
    selectedDatabaseLatestSuccess,
    selectedDatabaseDrift,
    appOptions,
    nodeOptions,
    renderers
  });

  return {
    detailPanel,
    editorPanel,
    workspacePanel
  };
}
