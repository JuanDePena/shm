import { escapeHtml } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { formatZoneRecords } from "./desired-state.js";
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
import { type WebLocale } from "./request.js";

type Zone = DashboardData["desiredState"]["spec"]["zones"][number];
type App = DashboardData["desiredState"]["spec"]["apps"][number];
type BackupPolicy = DashboardData["desiredState"]["spec"]["backupPolicies"][number];
type Job = DashboardData["jobHistory"][number];
type AuditEvent = DashboardData["auditEvents"][number];
type NodeHealth = DashboardData["nodeHealth"][number];
type DriftEntry = DashboardData["drift"][number];

export interface DesiredStateZoneCopy {
  selectedResourceTitle: string;
  selectedResourceDescription: string;
  propertiesStatusTitle: string;
  propertiesStatusDescription: string;
  resourceActionsTitle: string;
  resourceActionsDescription: string;
  zoneColTenant: string;
  zoneColPrimaryNode: string;
  nodeHealthTitle: string;
  zoneColRecordCount: string;
  latestSuccessLabel: string;
  recordPreviewTitle: string;
  actionDispatchDnsSync: string;
  previewTitle: string;
  affectedResourcesLabel: string;
  dispatchRecommended: string;
  yesLabel: string;
  noLabel: string;
  latestFailureLabel: string;
  linkedResource: string;
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
  recordColName: string;
  recordColType: string;
  recordColValue: string;
  recordColTtl: string;
  noZones: string;
  relatedResourcesTitle: string;
  relatedResourcesDescription: string;
  openDriftView: string;
  openJobHistory: string;
  openAuditHistory: string;
  openZoneRecordsModal: string;
  zoneRecordsModalTitle: string;
  zoneRecordsModalDescription: string;
  zoneRecordsModalFormatHint: string;
  saveZoneRecords: string;
  desiredStateEditorsTitle: string;
  desiredStateEditorsDescription: string;
  detailActionsTitle: string;
  targetedNodesLabel: string;
  dangerZoneTitle: string;
  none: string;
}

interface DesiredStateZoneRenderers {
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

function renderZoneWorkspacePanel(args: {
  copy: DesiredStateZoneCopy;
  locale: WebLocale;
  selectedZone: Zone | undefined;
  selectedZoneApps: App[];
  selectedZoneBackupPolicies: BackupPolicy[];
  selectedZoneJobs: Job[];
  selectedZoneAuditEvents: AuditEvent[];
  selectedZonePrimaryNodeHealth: NodeHealth | undefined;
  selectedZoneLatestSuccess: Job | undefined;
  selectedZoneLatestFailure: Job | undefined;
  selectedZoneDrift: DriftEntry | undefined;
  tenantOptions: DesiredStateSelectOption[];
  nodeOptions: DesiredStateSelectOption[];
  renderers: DesiredStateZoneRenderers;
}): string {
  const {
    copy,
    locale,
    selectedZone,
    selectedZoneApps,
    selectedZoneBackupPolicies,
    selectedZoneJobs,
    selectedZoneAuditEvents,
    selectedZonePrimaryNodeHealth,
    selectedZoneLatestSuccess,
    selectedZoneLatestFailure,
    selectedZoneDrift,
    tenantOptions,
    nodeOptions,
    renderers
  } = args;

  if (!selectedZone) {
    return "";
  }

  const zoneResourceKey = `zone:${selectedZone.zoneName}`;
  const zoneJobsHref = buildDashboardViewUrl(
    "jobs",
    undefined,
    selectedZoneJobs[0]?.jobId ?? selectedZoneLatestSuccess?.jobId,
    { jobResource: zoneResourceKey }
  );
  const zoneAuditHref = buildDashboardViewUrl(
    "audit",
    undefined,
    selectedZoneAuditEvents[0]?.eventId,
    { auditEntity: selectedZone.zoneName }
  );
  const zoneDriftHref = buildDashboardViewUrl(
    "resource-drift",
    undefined,
    zoneResourceKey
  );
  const zoneRecordsModalId = `zone-records-modal-${selectedZone.zoneName.replace(/[^a-z0-9_-]+/gi, "-")}`;
  const closeLabel = locale === "es" ? "Cerrar" : "Close";
  const zoneRecordsValue = formatZoneRecords(selectedZone.records);
  return `<article class="panel detail-shell resource-workspace-panel">
    <div class="section-head">
      <div>
        <div class="section-title-row">
          <h3>${escapeHtml(copy.selectedResourceTitle)}</h3>
          <span class="section-badge section-badge-lime">${escapeHtml(selectedZone.zoneName)}</span>
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
              { label: copy.zoneColTenant, value: escapeHtml(selectedZone.tenantSlug) },
              {
                label: copy.zoneColPrimaryNode,
                value: `<span class="mono">${escapeHtml(selectedZone.primaryNodeId)}</span>`
              },
              {
                label: copy.nodeHealthTitle,
                value: selectedZonePrimaryNodeHealth?.latestJobStatus
                  ? renderers.renderPill(
                      selectedZonePrimaryNodeHealth.latestJobStatus,
                      selectedZonePrimaryNodeHealth.latestJobStatus === "applied"
                        ? "success"
                        : selectedZonePrimaryNodeHealth.latestJobStatus === "failed"
                          ? "danger"
                          : "muted"
                    )
                  : renderers.renderPill(copy.none, "muted")
              },
              {
                label: copy.zoneColRecordCount,
                value: renderers.renderPill(
                  String(selectedZone.records.length),
                  selectedZone.records.length > 0 ? "success" : "muted"
                )
              },
              {
                label: copy.latestSuccessLabel,
                value: selectedZoneLatestSuccess
                  ? `<a class="detail-link mono" href="${escapeHtml(
                      buildDashboardViewUrl("jobs", undefined, selectedZoneLatestSuccess.jobId)
                    )}">${escapeHtml(selectedZoneLatestSuccess.jobId)}</a>`
                  : renderers.renderPill(copy.none, "muted"),
                className: "detail-item-span-two-auto"
              },
              {
                label: copy.latestFailureLabel,
                value: selectedZoneLatestFailure
                  ? `<a class="detail-link mono" href="${escapeHtml(
                      buildDashboardViewUrl("jobs", undefined, selectedZoneLatestFailure.jobId)
                    )}">${escapeHtml(selectedZoneLatestFailure.jobId)}</a>`
                  : renderers.renderPill(copy.none, "muted"),
                className: "detail-item-span-two-auto"
              }
            ],
            { className: "detail-grid-compact" }
          )}
          ${
            selectedZone.records.length > 0
              ? `<div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>${escapeHtml(copy.recordColName)}</th>
                        <th>${escapeHtml(copy.recordColType)}</th>
                        <th>${escapeHtml(copy.recordColValue)}</th>
                        <th>${escapeHtml(copy.recordColTtl)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${selectedZone.records
                        .slice(0, 6)
                        .map(
                          (record) => `<tr>
                            <td class="mono">${escapeHtml(record.name)}</td>
                            <td>${escapeHtml(record.type)}</td>
                            <td class="mono">${escapeHtml(record.value)}</td>
                            <td>${escapeHtml(String(record.ttl))}</td>
                          </tr>`
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>`
              : `<p class="empty">${escapeHtml(copy.noZones)}</p>`
          }
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
              "/actions/zone-sync",
              { zoneName: selectedZone.zoneName },
              copy.actionDispatchDnsSync,
              {
                confirmMessage: `Dispatch dns.sync for zone ${selectedZone.zoneName}? This will queue 1 job for ${selectedZone.records.length} desired record(s) on ${selectedZone.primaryNodeId}.`
              }
            )}
            <a class="button-link secondary" href="${escapeHtml(zoneJobsHref)}">${escapeHtml(
              copy.openJobHistory
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(zoneAuditHref)}">${escapeHtml(
              copy.openAuditHistory
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(zoneDriftHref)}">${escapeHtml(
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
          <form method="post" action="/resources/zones/upsert" class="stack">
            <input type="hidden" name="originalZoneName" value="${escapeHtml(selectedZone.zoneName)}" />
            <textarea name="records" hidden aria-hidden="true" tabindex="-1">${escapeHtml(
              zoneRecordsValue
            )}</textarea>
            <div class="form-grid">
              <label>Zone name
                <input name="zoneName" value="${escapeHtml(selectedZone.zoneName)}" required spellcheck="false" />
              </label>
              <label>Tenant slug
                <select name="tenantSlug" required>
                  ${renderers.renderSelectOptions(tenantOptions, selectedZone.tenantSlug)}
                </select>
              </label>
              <label>Primary node
                <select name="primaryNodeId" required>
                  ${renderers.renderSelectOptions(nodeOptions, selectedZone.primaryNodeId)}
                </select>
              </label>
            </div>
            <div class="toolbar">
              <button type="submit">Save zone</button>
              <button
                type="button"
                class="secondary"
                data-zone-records-trigger
                data-modal-id="${escapeHtml(zoneRecordsModalId)}"
              >${escapeHtml(copy.openZoneRecordsModal)}</button>
            </div>
          </form>
        </article>
      </div>
    </div>
    <div class="proxy-vhost-modal zone-records-modal" id="${escapeHtml(zoneRecordsModalId)}" data-zone-records-modal hidden>
      <div class="proxy-vhost-modal-backdrop" data-zone-records-close></div>
      <div
        class="proxy-vhost-modal-dialog zone-records-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="${escapeHtml(zoneRecordsModalId)}-title"
      >
        <article class="panel proxy-vhost-modal-panel stack">
          <div class="proxy-vhost-modal-header">
            <div class="stack">
              <div class="section-title-row">
                <h3 id="${escapeHtml(zoneRecordsModalId)}-title">${escapeHtml(
                  copy.zoneRecordsModalTitle
                )}</h3>
                <span class="section-badge section-badge-lime">${escapeHtml(selectedZone.zoneName)}</span>
              </div>
              <p class="muted section-description">${escapeHtml(copy.zoneRecordsModalDescription)}</p>
            </div>
            <button type="button" class="secondary proxy-vhost-modal-close" data-zone-records-close>${escapeHtml(
              closeLabel
            )}</button>
          </div>
          <form method="post" action="/resources/zones/upsert" class="stack">
            <input type="hidden" name="originalZoneName" value="${escapeHtml(selectedZone.zoneName)}" />
            <input type="hidden" name="zoneName" value="${escapeHtml(selectedZone.zoneName)}" />
            <input type="hidden" name="tenantSlug" value="${escapeHtml(selectedZone.tenantSlug)}" />
            <input type="hidden" name="primaryNodeId" value="${escapeHtml(selectedZone.primaryNodeId)}" />
            <label>
              ${escapeHtml(copy.zoneRecordsModalTitle)}
              <textarea
                name="records"
                spellcheck="false"
                class="mono zone-records-modal-editor"
                data-zone-records-input
              >${escapeHtml(zoneRecordsValue)}</textarea>
            </label>
            <p class="muted section-description">${escapeHtml(copy.zoneRecordsModalFormatHint)}</p>
            <div class="toolbar">
              <button type="submit">${escapeHtml(copy.saveZoneRecords)}</button>
            </div>
          </form>
        </article>
      </div>
    </div>
  </article>`;
}

export function renderZoneDesiredStatePanels(args: {
  copy: DesiredStateZoneCopy;
  locale: WebLocale;
  selectedZone: Zone | undefined;
  selectedZoneApps: App[];
  selectedZoneBackupPolicies: BackupPolicy[];
  selectedZoneJobs: Job[];
  selectedZoneAuditEvents: AuditEvent[];
  selectedZonePrimaryNodeHealth: NodeHealth | undefined;
  selectedZoneLatestSuccess: Job | undefined;
  selectedZoneLatestFailure: Job | undefined;
  selectedZoneDrift: DriftEntry | undefined;
  selectedZoneActionPreviewItems: DesiredStateRelatedPanelItem[];
  selectedZonePlanItems: DesiredStateRelatedPanelItem[];
  zoneComparisonRows: DesiredStateComparisonRow[];
  tenantOptions: DesiredStateSelectOption[];
  nodeOptions: DesiredStateSelectOption[];
  renderers: DesiredStateZoneRenderers;
}): { detailPanel: string; editorPanel: string; workspacePanel: string } {
  const {
    copy,
    locale,
    selectedZone,
    selectedZoneApps,
    selectedZoneBackupPolicies,
    selectedZoneJobs,
    selectedZoneAuditEvents,
    selectedZonePrimaryNodeHealth,
    selectedZoneLatestSuccess,
    selectedZoneLatestFailure,
    selectedZoneDrift,
    selectedZoneActionPreviewItems,
    selectedZonePlanItems,
    zoneComparisonRows,
    tenantOptions,
    nodeOptions,
    renderers
  } = args;

  if (!selectedZone) {
    return {
      detailPanel: "",
      editorPanel: "",
      workspacePanel: ""
    };
  }

  const detailPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.selectedResourceTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
      </div>
    </div>
    <div>
      <h3>${escapeHtml(selectedZone.zoneName)}</h3>
      <p class="muted">${escapeHtml(selectedZone.tenantSlug)}</p>
    </div>
    ${renderers.renderDetailGrid([
      { label: copy.zoneColTenant, value: escapeHtml(selectedZone.tenantSlug) },
      {
        label: copy.zoneColPrimaryNode,
        value: `<span class="mono">${escapeHtml(selectedZone.primaryNodeId)}</span>`
      },
      {
        label: copy.nodeHealthTitle,
        value: selectedZonePrimaryNodeHealth?.latestJobStatus
          ? renderers.renderPill(
              selectedZonePrimaryNodeHealth.latestJobStatus,
              selectedZonePrimaryNodeHealth.latestJobStatus === "applied"
                ? "success"
                : selectedZonePrimaryNodeHealth.latestJobStatus === "failed"
                  ? "danger"
                  : "muted"
            )
          : renderers.renderPill(copy.none, "muted")
      },
      {
        label: copy.zoneColRecordCount,
        value: renderers.renderPill(
          String(selectedZone.records.length),
          selectedZone.records.length > 0 ? "success" : "muted"
        )
      },
      {
        label: copy.latestSuccessLabel,
        value: selectedZoneLatestSuccess
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("job-history", undefined, selectedZoneLatestSuccess.jobId)
            )}">${escapeHtml(selectedZoneLatestSuccess.jobId)}</a>`
          : renderers.renderPill(copy.none, "muted")
      }
    ])}
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.recordPreviewTitle)}</h3>
      </div>
      <div class="toolbar">
        ${renderers.renderActionForm(
          "/actions/zone-sync",
          { zoneName: selectedZone.zoneName },
          copy.actionDispatchDnsSync,
          {
            confirmMessage: `Dispatch dns.sync for zone ${selectedZone.zoneName}? This will queue 1 job for ${selectedZone.records.length} desired record(s) on ${selectedZone.primaryNodeId}.`
          }
        )}
      </div>
    </div>
    <article class="panel panel-nested detail-shell">
      <div>
        <h3>${escapeHtml(copy.previewTitle)}</h3>
      </div>
      ${renderers.renderDetailGrid([
        {
          label: copy.zoneColPrimaryNode,
          value: `<span class="mono">${escapeHtml(selectedZone.primaryNodeId)}</span>`
        },
        {
          label: copy.zoneColRecordCount,
          value: escapeHtml(String(selectedZone.records.length))
        },
        {
          label: copy.affectedResourcesLabel,
          value: escapeHtml(String(selectedZoneApps.length))
        },
        {
          label: copy.dispatchRecommended,
          value: selectedZoneDrift
            ? renderers.renderPill(
                selectedZoneDrift.dispatchRecommended ? copy.yesLabel : copy.noLabel,
                selectedZoneDrift.dispatchRecommended ? "danger" : "success"
              )
            : renderers.renderPill(copy.none, "muted")
        },
        {
          label: copy.latestFailureLabel,
          value: selectedZoneLatestFailure
            ? `<a class="detail-link mono" href="${escapeHtml(
                buildDashboardViewUrl("job-history", undefined, selectedZoneLatestFailure.jobId)
              )}">${escapeHtml(selectedZoneLatestFailure.jobId)}</a>`
            : renderers.renderPill(copy.none, "muted")
        },
        {
          label: copy.linkedResource,
          value: `<a class="detail-link mono" href="${escapeHtml(
            buildDashboardViewUrl("resource-drift", undefined, `zone:${selectedZone.zoneName}`)
          )}">${escapeHtml(`zone:${selectedZone.zoneName}`)}</a>`
        }
      ])}
    </article>
    ${renderers.renderComparisonTable(
      copy.desiredAppliedTitle,
      copy.desiredAppliedDescription,
      zoneComparisonRows
    )}
    ${renderers.renderRelatedPanel(
      copy.fieldDeltaTitle,
      copy.fieldDeltaDescription,
      renderers.createComparisonDeltaItems(zoneComparisonRows),
      copy.noFieldDeltas
    )}
    ${renderers.renderRelatedPanel(
      copy.effectiveStateTitle,
      copy.effectiveStateDescription,
      [
        {
          title: escapeHtml(copy.nodeHealthTitle),
          meta: escapeHtml(selectedZonePrimaryNodeHealth?.currentVersion ?? copy.none),
          summary: escapeHtml(
            selectedZonePrimaryNodeHealth?.latestJobSummary ??
              selectedZoneLatestSuccess?.summary ??
              copy.none
          ),
          tone: selectedZonePrimaryNodeHealth?.latestJobStatus === "failed"
            ? "danger"
            : selectedZonePrimaryNodeHealth?.latestJobStatus === "applied"
              ? "success"
              : "default"
        },
        {
          title: escapeHtml(copy.relatedDriftTitle),
          meta: escapeHtml(selectedZoneDrift?.driftStatus ?? copy.none),
          summary: escapeHtml(
            selectedZoneDrift?.latestSummary ??
              `${selectedZone.records.length} desired record(s) across ${selectedZoneApps.length} linked app(s).`
          ),
          tone:
            selectedZoneDrift?.driftStatus === "out_of_sync" ||
            selectedZoneDrift?.driftStatus === "missing_secret"
              ? "danger"
              : selectedZoneDrift?.driftStatus === "in_sync"
                ? "success"
                : "default"
        },
        {
          title: escapeHtml(copy.relatedJobsTitle),
          meta: escapeHtml(`${selectedZoneJobs.length} job(s)`),
          summary: escapeHtml(
            selectedZoneLatestFailure?.summary ?? selectedZoneLatestSuccess?.summary ?? copy.none
          ),
          tone: selectedZoneJobs.some((job) => job.status === "failed")
            ? "danger"
            : selectedZoneJobs.some((job) => job.status === "applied")
              ? "success"
              : "default"
        }
      ],
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.plannedChangesTitle,
      copy.plannedChangesDescription,
      selectedZoneActionPreviewItems,
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.queuedWorkTitle,
      copy.queuedWorkDescription,
      selectedZonePlanItems,
      copy.noRelatedRecords
    )}
    ${
      selectedZone.records.length > 0
        ? `<div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>${escapeHtml(copy.recordColName)}</th>
                  <th>${escapeHtml(copy.recordColType)}</th>
                  <th>${escapeHtml(copy.recordColValue)}</th>
                  <th>${escapeHtml(copy.recordColTtl)}</th>
                </tr>
              </thead>
              <tbody>
                ${selectedZone.records
                  .map(
                    (record) => `<tr>
                      <td class="mono">${escapeHtml(record.name)}</td>
                      <td>${escapeHtml(record.type)}</td>
                      <td class="mono">${escapeHtml(record.value)}</td>
                      <td>${escapeHtml(String(record.ttl))}</td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>`
        : `<p class="empty">${escapeHtml(copy.noZones)}</p>`
    }
    ${renderers.renderRelatedPanel(
      copy.relatedResourcesTitle,
      copy.relatedResourcesDescription,
      [
        ...selectedZoneApps.map((app) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("desired-state", "desired-state-apps", app.slug)
          )}">${escapeHtml(app.slug)}</a>`,
          meta: escapeHtml(app.canonicalDomain),
          summary: escapeHtml(app.primaryNodeId),
          tone: "default" as const
        })),
        ...selectedZoneBackupPolicies.slice(0, 3).map((policy) => ({
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
    <div class="toolbar">
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("resource-drift", undefined, `zone:${selectedZone.zoneName}`)
      )}">${escapeHtml(copy.openDriftView)}</a>
      ${
        selectedZoneJobs[0]
          ? `<a class="button-link secondary" href="${escapeHtml(
              buildDashboardViewUrl("job-history", undefined, selectedZoneJobs[0].jobId)
            )}">${escapeHtml(copy.openJobHistory)}</a>`
          : ""
      }
    </div>
    ${renderers.renderResourceActivityStack(selectedZoneJobs, selectedZoneAuditEvents)}
  </article>`;

  const editorPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.desiredStateEditorsTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
      </div>
    </div>
    <form method="post" action="/resources/zones/upsert" class="stack">
      <input type="hidden" name="originalZoneName" value="${escapeHtml(selectedZone.zoneName)}" />
      <div class="grid grid-two">
        <article class="panel panel-nested detail-shell">
          <div>
            <h3>${escapeHtml(copy.detailActionsTitle)}</h3>
            <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
          </div>
          <div class="form-grid">
            <label>Zone name
              <input name="zoneName" value="${escapeHtml(selectedZone.zoneName)}" required spellcheck="false" />
            </label>
            <label>Tenant slug
              <select name="tenantSlug" required>
                ${renderers.renderSelectOptions(tenantOptions, selectedZone.tenantSlug)}
              </select>
            </label>
            <label>Primary node
              <select name="primaryNodeId" required>
                ${renderers.renderSelectOptions(nodeOptions, selectedZone.primaryNodeId)}
              </select>
            </label>
          </div>
          <label>Records
            <textarea name="records" spellcheck="false" class="mono">${escapeHtml(
              formatZoneRecords(selectedZone.records)
            )}</textarea>
          </label>
          <div class="toolbar">
            <button type="submit">Save zone</button>
            <button class="secondary" type="submit" formaction="/actions/zone-sync" data-confirm="${escapeHtml(
              `Dispatch dns.sync for zone ${selectedZone.zoneName}? This will queue 1 job for ${selectedZone.records.length} desired record(s) on ${selectedZone.primaryNodeId}.`
            )}">Dispatch dns.sync</button>
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
              value: `<span class="mono">${escapeHtml(selectedZone.primaryNodeId)}</span>`
            },
            {
              label: copy.affectedResourcesLabel,
              value: escapeHtml(
                `${selectedZone.records.length} records · ${selectedZoneApps.length} app(s)`
              )
            },
            {
              label: copy.latestFailureLabel,
              value: selectedZoneLatestFailure
                ? `<a class="detail-link mono" href="${escapeHtml(
                    buildDashboardViewUrl("job-history", undefined, selectedZoneLatestFailure.jobId)
                  )}">${escapeHtml(selectedZoneLatestFailure.jobId)}</a>`
                : escapeHtml(copy.none)
            },
            {
              label: copy.linkedResource,
              value: `<a class="detail-link mono" href="${escapeHtml(
                buildDashboardViewUrl("resource-drift", undefined, `zone:${selectedZone.zoneName}`)
              )}">${escapeHtml(`zone:${selectedZone.zoneName}`)}</a>`
            },
            {
              label: copy.dispatchRecommended,
              value: selectedZoneDrift
                ? renderers.renderPill(
                    selectedZoneDrift.dispatchRecommended ? copy.yesLabel : copy.noLabel,
                    selectedZoneDrift.dispatchRecommended ? "danger" : "success"
                  )
                : renderers.renderPill(copy.none, "muted")
            }
          ])}
          ${renderers.renderComparisonTable(
            copy.desiredAppliedTitle,
            copy.desiredAppliedDescription,
            zoneComparisonRows
          )}
          ${renderers.renderRelatedPanel(
            copy.queuedWorkTitle,
            copy.queuedWorkDescription,
            selectedZonePlanItems,
            copy.noRelatedRecords
          )}
          ${renderers.renderRelatedPanel(
            copy.fieldDeltaTitle,
            copy.fieldDeltaDescription,
            renderers.createComparisonDeltaItems(zoneComparisonRows),
            copy.noFieldDeltas
          )}
          ${renderers.renderRelatedPanel(
            copy.plannedChangesTitle,
            copy.plannedChangesDescription,
            selectedZoneActionPreviewItems,
            copy.noRelatedRecords
          )}
          ${renderers.renderRelatedPanel(
            copy.relatedResourcesTitle,
            copy.relatedResourcesDescription,
            selectedZoneApps.map((app) => ({
              title: `<a class="detail-link" href="${escapeHtml(
                buildDashboardViewUrl("desired-state", "desired-state-apps", app.slug)
              )}">${escapeHtml(app.slug)}</a>`,
              meta: escapeHtml(app.canonicalDomain),
              summary: escapeHtml(app.primaryNodeId),
              tone: "default" as const
            })),
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
          value: escapeHtml(`${selectedZone.records.length} records · ${selectedZoneApps.length} app(s)`)
        },
        {
          label: copy.targetedNodesLabel,
          value: `<span class="mono">${escapeHtml(selectedZone.primaryNodeId)}</span>`
        },
        {
          label: copy.relatedResourcesTitle,
          value: escapeHtml(`${selectedZoneApps.length} app(s)`)
        }
      ])}
      <form method="post" action="/resources/zones/delete" class="toolbar">
        <input type="hidden" name="zoneName" value="${escapeHtml(selectedZone.zoneName)}" />
        <button class="danger" type="submit" data-confirm="${escapeHtml(
          `Delete zone ${selectedZone.zoneName}? ${selectedZone.records.length} desired record(s) will be removed and ${selectedZoneApps.length} linked app(s) may lose DNS context.`
        )}">Delete zone</button>
      </form>
    </article>
  </article>`;

  const workspacePanel = renderZoneWorkspacePanel({
    copy,
    locale,
    selectedZone,
    selectedZoneApps,
    selectedZoneBackupPolicies,
    selectedZoneJobs,
    selectedZoneAuditEvents,
    selectedZonePrimaryNodeHealth,
    selectedZoneLatestSuccess,
    selectedZoneLatestFailure,
    selectedZoneDrift,
    tenantOptions,
    nodeOptions,
    renderers
  });

  return {
    detailPanel,
    editorPanel,
    workspacePanel
  };
}
