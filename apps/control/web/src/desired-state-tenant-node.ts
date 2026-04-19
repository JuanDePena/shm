import { escapeHtml } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import {
  type DesiredStateDetailGridRenderer,
  type DesiredStatePillRenderer,
  type DesiredStateRelatedPanelItem,
  type DesiredStateRelatedPanelRenderer
} from "./desired-state-shared.js";
import { type WebLocale } from "./request.js";

type Tenant = DashboardData["desiredState"]["spec"]["tenants"][number];
type Node = DashboardData["desiredState"]["spec"]["nodes"][number];
type App = DashboardData["desiredState"]["spec"]["apps"][number];
type Zone = DashboardData["desiredState"]["spec"]["zones"][number];
type BackupPolicy = DashboardData["desiredState"]["spec"]["backupPolicies"][number];
type Job = DashboardData["jobHistory"][number];
type AuditEvent = DashboardData["auditEvents"][number];
type NodeHealth = DashboardData["nodeHealth"][number];
type DriftEntry = DashboardData["drift"][number];

export interface DesiredStateTenantNodeCopy {
  selectedResourceTitle: string;
  selectedResourceDescription: string;
  propertiesStatusTitle: string;
  propertiesStatusDescription: string;
  resourceActionsTitle: string;
  resourceActionsDescription: string;
  tenantColSlug: string;
  tenantColDisplayName: string;
  navApps: string;
  navZones: string;
  navBackupPolicies: string;
  latestSuccessLabel: string;
  latestFailureLabel: string;
  none: string;
  effectiveStateTitle: string;
  effectiveStateDescription: string;
  relatedJobsTitle: string;
  auditTrailTitle: string;
  noRelatedRecords: string;
  plannedChangesTitle: string;
  plannedChangesDescription: string;
  failureFocusTitle: string;
  failureFocusDescription: string;
  relatedResourcesTitle: string;
  relatedResourcesDescription: string;
  openJobHistory: string;
  openAuditHistory: string;
  openBackupsView: string;
  desiredStateEditorsTitle: string;
  desiredStateEditorsDescription: string;
  detailActionsTitle: string;
  impactPreviewTitle: string;
  dangerZoneTitle: string;
  nodeColNode: string;
  nodeColHostname: string;
  nodeSpecColPublicIpv4: string;
  nodeSpecColWireguard: string;
  nodeHealthTitle: string;
  relatedDriftTitle: string;
  nodeDiagnosticsDescription: string;
  nodeColVersion: string;
  nodeColLatestStatus: string;
  openNodeHealth: string;
}

interface DesiredStateTenantNodeRenderers {
  renderPill: DesiredStatePillRenderer;
  renderDetailGrid: DesiredStateDetailGridRenderer;
  renderRelatedPanel: DesiredStateRelatedPanelRenderer<DesiredStateRelatedPanelItem>;
  renderResourceActivityStack: (jobs: Job[], audits: AuditEvent[]) => string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
}

function renderTenantWorkspacePanel(args: {
  copy: DesiredStateTenantNodeCopy;
  selectedTenant: Tenant | undefined;
  selectedTenantApps: App[];
  selectedTenantZones: Zone[];
  selectedTenantBackupPolicies: BackupPolicy[];
  selectedTenantJobs: Job[];
  selectedTenantAuditEvents: AuditEvent[];
  selectedTenantLatestSuccess: Job | undefined;
  selectedTenantLatestFailure: Job | undefined;
  tenantCounts: {
    apps: number;
    zones: number;
    backupPolicies: number;
  };
  renderers: DesiredStateTenantNodeRenderers;
}): string {
  const {
    copy,
    selectedTenant,
    selectedTenantApps,
    selectedTenantZones,
    selectedTenantBackupPolicies,
    selectedTenantJobs,
    selectedTenantAuditEvents,
    selectedTenantLatestSuccess,
    selectedTenantLatestFailure,
    tenantCounts,
    renderers
  } = args;

  if (!selectedTenant) {
    return "";
  }

  const tenantJobsHref = buildDashboardViewUrl(
    "jobs",
    undefined,
    selectedTenantJobs[0]?.jobId
  );
  const tenantAuditHref = buildDashboardViewUrl(
    "audit",
    undefined,
    selectedTenantAuditEvents[0]?.eventId,
    { auditEntity: selectedTenant.slug }
  );
  const tenantBackupsHref = buildDashboardViewUrl(
    "backups",
    undefined,
    undefined,
    { backupTenant: selectedTenant.slug }
  );
  return `<article class="panel detail-shell resource-workspace-panel">
    <div class="section-head">
      <div>
        <div class="section-title-row">
          <h3>${escapeHtml(copy.selectedResourceTitle)}</h3>
          <span class="section-badge section-badge-lime">${escapeHtml(selectedTenant.slug)}</span>
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
              {
                label: copy.tenantColSlug,
                value: `<span class="mono">${escapeHtml(selectedTenant.slug)}</span>`
              },
              { label: copy.tenantColDisplayName, value: escapeHtml(selectedTenant.displayName) },
              {
                label: copy.navApps,
                value: renderers.renderPill(
                  String(tenantCounts.apps),
                  tenantCounts.apps > 0 ? "success" : "muted"
                )
              },
              {
                label: copy.navZones,
                value: renderers.renderPill(
                  String(tenantCounts.zones),
                  tenantCounts.zones > 0 ? "success" : "muted"
                )
              },
              {
                label: copy.navBackupPolicies,
                value: renderers.renderPill(
                  String(tenantCounts.backupPolicies),
                  tenantCounts.backupPolicies > 0 ? "success" : "muted"
                )
              },
              {
                label: copy.latestSuccessLabel,
                value: selectedTenantLatestSuccess
                  ? `<a class="detail-link mono" href="${escapeHtml(
                      buildDashboardViewUrl("jobs", undefined, selectedTenantLatestSuccess.jobId)
                    )}">${escapeHtml(selectedTenantLatestSuccess.jobId)}</a>`
                  : renderers.renderPill(copy.none, "muted")
              },
              {
                label: copy.latestFailureLabel,
                value: selectedTenantLatestFailure
                  ? `<a class="detail-link mono" href="${escapeHtml(
                      buildDashboardViewUrl("jobs", undefined, selectedTenantLatestFailure.jobId)
                    )}">${escapeHtml(selectedTenantLatestFailure.jobId)}</a>`
                  : renderers.renderPill(copy.none, "muted"),
                className: "detail-item-span-two-auto"
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
            <a class="button-link secondary" href="${escapeHtml(tenantJobsHref)}">${escapeHtml(
              copy.openJobHistory
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(tenantAuditHref)}">${escapeHtml(
              copy.openAuditHistory
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(tenantBackupsHref)}">${escapeHtml(
              copy.openBackupsView
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
          <form method="post" action="/resources/tenants/upsert" class="stack">
            <input type="hidden" name="originalSlug" value="${escapeHtml(selectedTenant.slug)}" />
            <div class="form-grid">
              <label>Slug
                <input name="slug" value="${escapeHtml(selectedTenant.slug)}" required spellcheck="false" />
              </label>
              <label>Display name
                <input name="displayName" value="${escapeHtml(selectedTenant.displayName)}" required />
              </label>
            </div>
            <div class="toolbar">
              <button type="submit">Save tenant</button>
            </div>
          </form>
        </article>
      </div>
    </div>
  </article>`;
}

function renderNodeWorkspacePanel(args: {
  copy: DesiredStateTenantNodeCopy;
  selectedNode: Node | undefined;
  selectedNodePrimaryApps: App[];
  selectedNodePrimaryZones: Zone[];
  selectedNodeBackupPolicies: BackupPolicy[];
  selectedNodeDesiredJobs: Job[];
  selectedNodeDesiredAuditEvents: AuditEvent[];
  selectedNodeLatestSuccess: Job | undefined;
  selectedNodeLatestFailure: Job | undefined;
  selectedNodeHealthSnapshot: NodeHealth | undefined;
  nodeCounts: {
    apps: number;
    zones: number;
    backupPolicies: number;
  };
  renderers: DesiredStateTenantNodeRenderers;
}): string {
  const {
    copy,
    selectedNode,
    selectedNodePrimaryApps,
    selectedNodePrimaryZones,
    selectedNodeBackupPolicies,
    selectedNodeDesiredJobs,
    selectedNodeDesiredAuditEvents,
    selectedNodeLatestSuccess,
    selectedNodeLatestFailure,
    selectedNodeHealthSnapshot,
    nodeCounts,
    renderers
  } = args;

  if (!selectedNode) {
    return "";
  }

  const nodeJobsHref = buildDashboardViewUrl(
    "jobs",
    undefined,
    selectedNodeDesiredJobs[0]?.jobId,
    { jobNode: selectedNode.nodeId }
  );
  const nodeAuditHref = buildDashboardViewUrl(
    "audit",
    undefined,
    selectedNodeDesiredAuditEvents[0]?.eventId,
    { auditEntity: selectedNode.nodeId }
  );
  const nodeHealthHref = buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId);
  return `<article class="panel detail-shell resource-workspace-panel">
    <div class="section-head">
      <div>
        <div class="section-title-row">
          <h3>${escapeHtml(copy.selectedResourceTitle)}</h3>
          <span class="section-badge section-badge-lime">${escapeHtml(selectedNode.nodeId)}</span>
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
              {
                label: copy.nodeColNode,
                value: `<span class="mono">${escapeHtml(selectedNode.nodeId)}</span>`
              },
              { label: copy.nodeColHostname, value: escapeHtml(selectedNode.hostname) },
              {
                label: copy.nodeSpecColPublicIpv4,
                value: `<span class="mono">${escapeHtml(selectedNode.publicIpv4)}</span>`
              },
              {
                label: copy.nodeSpecColWireguard,
                value: `<span class="mono">${escapeHtml(selectedNode.wireguardAddress)}</span>`
              },
              {
                label: copy.navApps,
                value: renderers.renderPill(
                  String(nodeCounts.apps),
                  nodeCounts.apps > 0 ? "success" : "muted"
                )
              },
              {
                label: copy.navZones,
                value: renderers.renderPill(
                  String(nodeCounts.zones),
                  nodeCounts.zones > 0 ? "success" : "muted"
                )
              },
              {
                label: copy.navBackupPolicies,
                value: renderers.renderPill(
                  String(nodeCounts.backupPolicies),
                  nodeCounts.backupPolicies > 0 ? "success" : "muted"
                )
              },
              {
                label: copy.nodeColVersion,
                value: selectedNodeHealthSnapshot?.currentVersion
                  ? renderers.renderPill(selectedNodeHealthSnapshot.currentVersion, "muted")
                  : renderers.renderPill(copy.none, "muted")
              },
              {
                label: copy.nodeColLatestStatus,
                value: selectedNodeHealthSnapshot?.latestJobStatus
                  ? renderers.renderPill(
                      selectedNodeHealthSnapshot.latestJobStatus,
                      selectedNodeHealthSnapshot.latestJobStatus === "applied"
                        ? "success"
                        : selectedNodeHealthSnapshot.latestJobStatus === "failed"
                          ? "danger"
                          : "muted"
                    )
                  : renderers.renderPill(copy.none, "muted")
              },
              {
                label: copy.latestSuccessLabel,
                value: selectedNodeLatestSuccess
                  ? `<a class="detail-link mono" href="${escapeHtml(
                      buildDashboardViewUrl("jobs", undefined, selectedNodeLatestSuccess.jobId)
                    )}">${escapeHtml(selectedNodeLatestSuccess.jobId)}</a>`
                  : renderers.renderPill(copy.none, "muted")
              },
              {
                label: copy.latestFailureLabel,
                value: selectedNodeLatestFailure
                  ? `<a class="detail-link mono" href="${escapeHtml(
                      buildDashboardViewUrl("jobs", undefined, selectedNodeLatestFailure.jobId)
                    )}">${escapeHtml(selectedNodeLatestFailure.jobId)}</a>`
                  : renderers.renderPill(copy.none, "muted"),
                className: "detail-item-span-two-auto"
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
            <a class="button-link secondary" href="${escapeHtml(nodeHealthHref)}">${escapeHtml(
              copy.openNodeHealth
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(nodeJobsHref)}">${escapeHtml(
              copy.openJobHistory
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(nodeAuditHref)}">${escapeHtml(
              copy.openAuditHistory
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
          <form method="post" action="/resources/nodes/upsert" class="stack">
            <input type="hidden" name="originalNodeId" value="${escapeHtml(selectedNode.nodeId)}" />
            <div class="form-grid">
              <label>Node ID
                <input name="nodeId" value="${escapeHtml(selectedNode.nodeId)}" required spellcheck="false" />
              </label>
              <label>Hostname
                <input name="hostname" value="${escapeHtml(selectedNode.hostname)}" required spellcheck="false" />
              </label>
              <label>Public IPv4
                <input name="publicIpv4" value="${escapeHtml(selectedNode.publicIpv4)}" required spellcheck="false" />
              </label>
              <label>WireGuard address
                <input name="wireguardAddress" value="${escapeHtml(selectedNode.wireguardAddress)}" required spellcheck="false" />
              </label>
            </div>
            <div class="toolbar">
              <button type="submit">Save node</button>
            </div>
          </form>
        </article>
      </div>
    </div>
  </article>`;
}

export function renderTenantDesiredStatePanels(args: {
  copy: DesiredStateTenantNodeCopy;
  locale: WebLocale;
  selectedTenant: Tenant | undefined;
  selectedTenantApps: App[];
  selectedTenantZones: Zone[];
  selectedTenantBackupPolicies: BackupPolicy[];
  selectedTenantJobs: Job[];
  selectedTenantAuditEvents: AuditEvent[];
  selectedTenantLatestSuccess: Job | undefined;
  selectedTenantLatestFailure: Job | undefined;
  selectedTenantActionPreviewItems: DesiredStateRelatedPanelItem[];
  tenantCounts: {
    apps: number;
    zones: number;
    backupPolicies: number;
  };
  renderers: DesiredStateTenantNodeRenderers;
}): { detailPanel: string; editorPanel: string; workspacePanel: string } {
  const {
    copy,
    locale,
    selectedTenant,
    selectedTenantApps,
    selectedTenantZones,
    selectedTenantBackupPolicies,
    selectedTenantJobs,
    selectedTenantAuditEvents,
    selectedTenantLatestSuccess,
    selectedTenantLatestFailure,
    selectedTenantActionPreviewItems,
    tenantCounts,
    renderers
  } = args;

  if (!selectedTenant) {
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
      <h3>${escapeHtml(selectedTenant.displayName)}</h3>
      <p class="muted">${escapeHtml(selectedTenant.slug)}</p>
    </div>
    ${renderers.renderDetailGrid([
      {
        label: copy.tenantColSlug,
        value: `<span class="mono">${escapeHtml(selectedTenant.slug)}</span>`
      },
      { label: copy.tenantColDisplayName, value: escapeHtml(selectedTenant.displayName) },
      {
        label: copy.navApps,
        value: renderers.renderPill(
          String(tenantCounts.apps),
          tenantCounts.apps > 0 ? "success" : "muted"
        )
      },
      {
        label: copy.navZones,
        value: renderers.renderPill(
          String(tenantCounts.zones),
          tenantCounts.zones > 0 ? "success" : "muted"
        )
      },
      {
        label: copy.navBackupPolicies,
        value: renderers.renderPill(
          String(tenantCounts.backupPolicies),
          tenantCounts.backupPolicies > 0 ? "success" : "muted"
        )
      },
      {
        label: copy.latestSuccessLabel,
        value: selectedTenantLatestSuccess
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("job-history", undefined, selectedTenantLatestSuccess.jobId)
            )}">${escapeHtml(selectedTenantLatestSuccess.jobId)}</a>`
          : renderers.renderPill(copy.none, "muted")
      },
      {
        label: copy.latestFailureLabel,
        value: selectedTenantLatestFailure
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("job-history", undefined, selectedTenantLatestFailure.jobId)
            )}">${escapeHtml(selectedTenantLatestFailure.jobId)}</a>`
          : renderers.renderPill(copy.none, "muted")
      }
    ])}
    ${renderers.renderRelatedPanel(
      copy.effectiveStateTitle,
      copy.effectiveStateDescription,
      [
        {
          title: escapeHtml(copy.relatedJobsTitle),
          meta: escapeHtml(`${selectedTenantJobs.length} job(s)`),
          summary: escapeHtml(
            selectedTenantJobs[0]?.summary ?? selectedTenantJobs[0]?.dispatchReason ?? copy.none
          ),
          tone: selectedTenantJobs.some((job) => job.status === "failed")
            ? "danger"
            : selectedTenantJobs.some((job) => job.status === "applied")
              ? "success"
              : "default"
        },
        {
          title: escapeHtml(copy.auditTrailTitle),
          meta: escapeHtml(`${selectedTenantAuditEvents.length} event(s)`),
          summary: escapeHtml(selectedTenantAuditEvents[0]?.eventType ?? copy.none),
          tone: "default"
        }
      ],
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.plannedChangesTitle,
      copy.plannedChangesDescription,
      selectedTenantActionPreviewItems,
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.failureFocusTitle,
      copy.failureFocusDescription,
      selectedTenantJobs
        .filter((job) => job.status === "failed")
        .slice(0, 4)
        .map((job) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("job-history", undefined, job.jobId)
          )}">${escapeHtml(job.kind)}</a>`,
          meta: escapeHtml(
            [job.jobId, renderers.formatDate(job.createdAt, locale)].join(" · ")
          ),
          summary: escapeHtml(job.summary ?? job.dispatchReason ?? copy.none),
          tone: "danger" as const
        })),
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.relatedResourcesTitle,
      copy.relatedResourcesDescription,
      [
        ...selectedTenantApps.slice(0, 4).map((app) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("desired-state", "desired-state-apps", app.slug)
          )}">${escapeHtml(app.slug)}</a>`,
          meta: escapeHtml(app.canonicalDomain),
          summary: escapeHtml(app.primaryNodeId),
          tone: "default" as const
        })),
        ...selectedTenantZones.slice(0, 3).map((zone) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("desired-state", "desired-state-zones", zone.zoneName)
          )}">${escapeHtml(zone.zoneName)}</a>`,
          meta: escapeHtml(zone.primaryNodeId),
          summary: escapeHtml(zone.tenantSlug),
          tone: "default" as const
        })),
        ...selectedTenantBackupPolicies.slice(0, 3).map((policy) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl(
              "desired-state",
              "desired-state-backups",
              policy.policySlug
            )
          )}">${escapeHtml(policy.policySlug)}</a>`,
          meta: escapeHtml(policy.targetNodeId),
          summary: escapeHtml(policy.schedule),
          tone: "default" as const
        }))
      ],
      copy.noRelatedRecords
    )}
    <div class="toolbar">
      ${
        selectedTenantJobs[0]
          ? `<a class="button-link secondary" href="${escapeHtml(
              buildDashboardViewUrl("job-history", undefined, selectedTenantJobs[0].jobId)
            )}">${escapeHtml(copy.openJobHistory)}</a>`
          : ""
      }
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("desired-state", "desired-state-backups")
      )}">${escapeHtml(copy.openBackupsView)}</a>
    </div>
    ${renderers.renderResourceActivityStack(selectedTenantJobs, selectedTenantAuditEvents)}
  </article>`;

  const editorPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.desiredStateEditorsTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
      </div>
    </div>
    <div class="grid grid-two">
      <form method="post" action="/resources/tenants/upsert" class="panel panel-nested detail-shell">
        <input type="hidden" name="originalSlug" value="${escapeHtml(selectedTenant.slug)}" />
        <div>
          <h3>${escapeHtml(copy.detailActionsTitle)}</h3>
          <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
        </div>
        <div class="form-grid">
          <label>Slug
            <input name="slug" value="${escapeHtml(selectedTenant.slug)}" required spellcheck="false" />
          </label>
          <label>Display name
            <input name="displayName" value="${escapeHtml(selectedTenant.displayName)}" required />
          </label>
        </div>
        <div class="toolbar">
          <button type="submit">Save tenant</button>
        </div>
      </form>
      <article class="panel panel-nested detail-shell">
        <div>
          <h3>${escapeHtml(copy.impactPreviewTitle)}</h3>
          <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
        </div>
        ${renderers.renderDetailGrid([
          { label: copy.navApps, value: escapeHtml(String(tenantCounts.apps)) },
          { label: copy.navZones, value: escapeHtml(String(tenantCounts.zones)) },
          {
            label: copy.navBackupPolicies,
            value: escapeHtml(String(tenantCounts.backupPolicies))
          },
          {
            label: copy.relatedJobsTitle,
            value: escapeHtml(String(selectedTenantJobs.length))
          },
          {
            label: copy.auditTrailTitle,
            value: escapeHtml(String(selectedTenantAuditEvents.length))
          }
        ])}
        ${renderers.renderRelatedPanel(
          copy.plannedChangesTitle,
          copy.plannedChangesDescription,
          selectedTenantActionPreviewItems,
          copy.noRelatedRecords
        )}
        <div class="toolbar">
          <a class="button-link secondary" href="${escapeHtml(
            buildDashboardViewUrl("desired-state", "desired-state-apps")
          )}">${escapeHtml(copy.navApps)}</a>
          <a class="button-link secondary" href="${escapeHtml(
            buildDashboardViewUrl("desired-state", "desired-state-zones")
          )}">${escapeHtml(copy.navZones)}</a>
        </div>
      </article>
    </div>
    <article class="panel panel-nested detail-shell danger-shell">
      <div>
        <h3>${escapeHtml(copy.dangerZoneTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
      </div>
      ${renderers.renderDetailGrid([
        { label: copy.navApps, value: escapeHtml(String(tenantCounts.apps)) },
        { label: copy.navZones, value: escapeHtml(String(tenantCounts.zones)) },
        {
          label: copy.navBackupPolicies,
          value: escapeHtml(String(tenantCounts.backupPolicies))
        }
      ])}
      <form method="post" action="/resources/tenants/delete" class="toolbar">
        <input type="hidden" name="slug" value="${escapeHtml(selectedTenant.slug)}" />
        <button class="danger" type="submit" data-confirm="${escapeHtml(
          `Delete tenant ${selectedTenant.slug}? Related apps, zones and backup policies will be removed from desired state.`
        )}">Delete tenant</button>
      </form>
    </article>
  </article>`;

  const workspacePanel = renderTenantWorkspacePanel({
    copy,
    selectedTenant,
    selectedTenantApps,
    selectedTenantZones,
    selectedTenantBackupPolicies,
    selectedTenantJobs,
    selectedTenantAuditEvents,
    selectedTenantLatestSuccess,
    selectedTenantLatestFailure,
    tenantCounts,
    renderers
  });

  return {
    detailPanel,
    editorPanel,
    workspacePanel
  };
}

export function renderNodeDesiredStatePanels(args: {
  copy: DesiredStateTenantNodeCopy;
  locale: WebLocale;
  selectedNode: Node | undefined;
  selectedNodePrimaryApps: App[];
  selectedNodePrimaryZones: Zone[];
  selectedNodeBackupPolicies: BackupPolicy[];
  selectedNodeDesiredJobs: Job[];
  selectedNodeDesiredAuditEvents: AuditEvent[];
  selectedNodeDesiredDrift: DriftEntry[];
  selectedNodeLatestSuccess: Job | undefined;
  selectedNodeLatestFailure: Job | undefined;
  selectedNodeActionPreviewItems: DesiredStateRelatedPanelItem[];
  selectedNodeHealthSnapshot: NodeHealth | undefined;
  nodeCounts: {
    apps: number;
    zones: number;
    backupPolicies: number;
  };
  renderers: DesiredStateTenantNodeRenderers;
}): { detailPanel: string; editorPanel: string; workspacePanel: string } {
  const {
    copy,
    locale,
    selectedNode,
    selectedNodePrimaryApps,
    selectedNodePrimaryZones,
    selectedNodeBackupPolicies,
    selectedNodeDesiredJobs,
    selectedNodeDesiredAuditEvents,
    selectedNodeDesiredDrift,
    selectedNodeLatestSuccess,
    selectedNodeLatestFailure,
    selectedNodeActionPreviewItems,
    selectedNodeHealthSnapshot,
    nodeCounts,
    renderers
  } = args;

  if (!selectedNode) {
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
      <h3>${escapeHtml(selectedNode.hostname)}</h3>
      <p class="muted">${escapeHtml(selectedNode.nodeId)}</p>
    </div>
    ${renderers.renderDetailGrid([
      {
        label: copy.nodeColNode,
        value: `<span class="mono">${escapeHtml(selectedNode.nodeId)}</span>`
      },
      { label: copy.nodeColHostname, value: escapeHtml(selectedNode.hostname) },
      {
        label: copy.nodeSpecColPublicIpv4,
        value: `<span class="mono">${escapeHtml(selectedNode.publicIpv4)}</span>`
      },
      {
        label: copy.nodeSpecColWireguard,
        value: `<span class="mono">${escapeHtml(selectedNode.wireguardAddress)}</span>`
      },
      {
        label: copy.navApps,
        value: renderers.renderPill(
          String(nodeCounts.apps),
          nodeCounts.apps > 0 ? "success" : "muted"
        )
      },
      {
        label: copy.navZones,
        value: renderers.renderPill(
          String(nodeCounts.zones),
          nodeCounts.zones > 0 ? "success" : "muted"
        )
      },
      {
        label: copy.navBackupPolicies,
        value: renderers.renderPill(
          String(nodeCounts.backupPolicies),
          nodeCounts.backupPolicies > 0 ? "success" : "muted"
        )
      },
      {
        label: copy.latestSuccessLabel,
        value: selectedNodeLatestSuccess
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("job-history", undefined, selectedNodeLatestSuccess.jobId)
            )}">${escapeHtml(selectedNodeLatestSuccess.jobId)}</a>`
          : renderers.renderPill(copy.none, "muted")
      },
      {
        label: copy.latestFailureLabel,
        value: selectedNodeLatestFailure
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("job-history", undefined, selectedNodeLatestFailure.jobId)
            )}">${escapeHtml(selectedNodeLatestFailure.jobId)}</a>`
          : renderers.renderPill(copy.none, "muted")
      }
    ])}
    ${renderers.renderRelatedPanel(
      copy.effectiveStateTitle,
      copy.effectiveStateDescription,
      [
        {
          title: escapeHtml(copy.nodeHealthTitle),
          meta: escapeHtml(selectedNodeHealthSnapshot?.currentVersion ?? copy.none),
          summary: escapeHtml(
            selectedNodeHealthSnapshot?.latestJobSummary ??
              renderers.formatDate(selectedNodeHealthSnapshot?.lastSeenAt, locale)
          ),
          tone: selectedNodeHealthSnapshot?.latestJobStatus === "failed"
            ? "danger"
            : selectedNodeHealthSnapshot?.latestJobStatus === "applied"
              ? "success"
              : "default"
        },
        {
          title: escapeHtml(copy.relatedDriftTitle),
          meta: escapeHtml(`${selectedNodeDesiredDrift.length} drift item(s)`),
          summary: escapeHtml(selectedNodeDesiredDrift[0]?.latestSummary ?? copy.none),
          tone: selectedNodeDesiredDrift.some((entry) => entry.driftStatus !== "in_sync")
            ? "danger"
            : "default"
        }
      ],
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.plannedChangesTitle,
      copy.plannedChangesDescription,
      selectedNodeActionPreviewItems,
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.failureFocusTitle,
      copy.failureFocusDescription,
      selectedNodeDesiredJobs
        .filter((job) => job.status === "failed")
        .slice(0, 4)
        .map((job) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("job-history", undefined, job.jobId)
          )}">${escapeHtml(job.kind)}</a>`,
          meta: escapeHtml(
            [job.jobId, renderers.formatDate(job.createdAt, locale)].join(" · ")
          ),
          summary: escapeHtml(job.summary ?? job.dispatchReason ?? copy.none),
          tone: "danger" as const
        })),
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.relatedResourcesTitle,
      copy.relatedResourcesDescription,
      [
        ...selectedNodePrimaryApps.slice(0, 4).map((app) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("desired-state", "desired-state-apps", app.slug)
          )}">${escapeHtml(app.slug)}</a>`,
          meta: escapeHtml(app.canonicalDomain),
          summary: escapeHtml(app.mode),
          tone: "default" as const
        })),
        ...selectedNodePrimaryZones.slice(0, 4).map((zone) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("desired-state", "desired-state-zones", zone.zoneName)
          )}">${escapeHtml(zone.zoneName)}</a>`,
          meta: escapeHtml(zone.tenantSlug),
          summary: escapeHtml(zone.primaryNodeId),
          tone: "default" as const
        })),
        ...selectedNodeBackupPolicies.slice(0, 3).map((policy) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl(
              "desired-state",
              "desired-state-backups",
              policy.policySlug
            )
          )}">${escapeHtml(policy.policySlug)}</a>`,
          meta: escapeHtml(policy.schedule),
          summary: escapeHtml(policy.storageLocation),
          tone: "default" as const
        }))
      ],
      copy.noRelatedRecords
    )}
    <div class="toolbar">
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.nodeHealthTitle)}</a>
      ${
        selectedNodeDesiredJobs[0]
          ? `<a class="button-link secondary" href="${escapeHtml(
              buildDashboardViewUrl("job-history", undefined, selectedNodeDesiredJobs[0].jobId)
            )}">${escapeHtml(copy.openJobHistory)}</a>`
          : ""
      }
    </div>
    ${renderers.renderResourceActivityStack(
      selectedNodeDesiredJobs,
      selectedNodeDesiredAuditEvents
    )}
  </article>`;

  const editorPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.desiredStateEditorsTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
      </div>
    </div>
    <div class="grid grid-two">
      <form method="post" action="/resources/nodes/upsert" class="panel panel-nested detail-shell">
        <input type="hidden" name="originalNodeId" value="${escapeHtml(selectedNode.nodeId)}" />
        <div>
          <h3>${escapeHtml(copy.detailActionsTitle)}</h3>
          <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
        </div>
        <div class="form-grid">
          <label>Node ID
            <input name="nodeId" value="${escapeHtml(selectedNode.nodeId)}" required spellcheck="false" />
          </label>
          <label>Hostname
            <input name="hostname" value="${escapeHtml(selectedNode.hostname)}" required spellcheck="false" />
          </label>
          <label>Public IPv4
            <input name="publicIpv4" value="${escapeHtml(selectedNode.publicIpv4)}" required spellcheck="false" />
          </label>
          <label>WireGuard address
            <input name="wireguardAddress" value="${escapeHtml(selectedNode.wireguardAddress)}" required spellcheck="false" />
          </label>
        </div>
        <div class="toolbar">
          <button type="submit">Save node</button>
        </div>
      </form>
      <article class="panel panel-nested detail-shell">
        <div>
          <h3>${escapeHtml(copy.impactPreviewTitle)}</h3>
          <p class="muted section-description">${escapeHtml(copy.nodeDiagnosticsDescription)}</p>
        </div>
        ${renderers.renderDetailGrid([
          { label: copy.navApps, value: escapeHtml(String(nodeCounts.apps)) },
          { label: copy.navZones, value: escapeHtml(String(nodeCounts.zones)) },
          {
            label: copy.navBackupPolicies,
            value: escapeHtml(String(nodeCounts.backupPolicies))
          },
          {
            label: copy.nodeColVersion,
            value: selectedNodeHealthSnapshot?.currentVersion
              ? renderers.renderPill(selectedNodeHealthSnapshot.currentVersion, "muted")
              : renderers.renderPill(copy.none, "muted")
          },
          {
            label: copy.nodeColLatestStatus,
            value: selectedNodeHealthSnapshot?.latestJobStatus
              ? renderers.renderPill(
                  selectedNodeHealthSnapshot.latestJobStatus,
                  selectedNodeHealthSnapshot.latestJobStatus === "applied"
                    ? "success"
                    : selectedNodeHealthSnapshot.latestJobStatus === "failed"
                      ? "danger"
                      : "muted"
                )
              : renderers.renderPill(copy.none, "muted")
          },
          {
            label: copy.nodeHealthTitle,
            value: `<a class="detail-link" href="${escapeHtml(
              buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
            )}">${escapeHtml(copy.openNodeHealth)}</a>`
          }
        ])}
        ${renderers.renderRelatedPanel(
          copy.plannedChangesTitle,
          copy.plannedChangesDescription,
          selectedNodeActionPreviewItems,
          copy.noRelatedRecords
        )}
      </article>
    </div>
    <article class="panel panel-nested detail-shell danger-shell">
      <div>
        <h3>${escapeHtml(copy.dangerZoneTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
      </div>
      ${renderers.renderDetailGrid([
        { label: copy.navApps, value: escapeHtml(String(nodeCounts.apps)) },
        { label: copy.navZones, value: escapeHtml(String(nodeCounts.zones)) },
        {
          label: copy.navBackupPolicies,
          value: escapeHtml(String(nodeCounts.backupPolicies))
        }
      ])}
      <form method="post" action="/resources/nodes/delete" class="toolbar">
        <input type="hidden" name="nodeId" value="${escapeHtml(selectedNode.nodeId)}" />
        <button class="danger" type="submit" data-confirm="${escapeHtml(
          `Delete node ${selectedNode.nodeId}? Review apps, zones and backup policies that still target this node before continuing.`
        )}">Delete node</button>
      </form>
    </article>
  </article>`;

  const workspacePanel = renderNodeWorkspacePanel({
    copy,
    selectedNode,
    selectedNodePrimaryApps,
    selectedNodePrimaryZones,
    selectedNodeBackupPolicies,
    selectedNodeDesiredJobs,
    selectedNodeDesiredAuditEvents,
    selectedNodeLatestSuccess,
    selectedNodeLatestFailure,
    selectedNodeHealthSnapshot,
    nodeCounts,
    renderers
  });

  return {
    detailPanel,
    editorPanel,
    workspacePanel
  };
}
