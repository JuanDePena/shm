import { escapeHtml } from "@simplehost/ui";

import { createBackupScopePanelItems } from "./dashboard-panels.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import {
  renderAppEditorPanel,
  renderProxyEditorPanel
} from "./desired-state-app-proxy-editor.js";
import {
  renderAppDetailPanel,
  renderProxyDetailPanel
} from "./desired-state-app-proxy-detail.js";
import {
  type DesiredStateAppProxyCopy,
  type RenderAppProxyDesiredStatePanelsArgs
} from "./desired-state-app-proxy-types.js";

export { type DesiredStateAppProxyCopy } from "./desired-state-app-proxy-types.js";

function renderProxyWorkspacePanel(args: RenderAppProxyDesiredStatePanelsArgs): string {
  const {
    copy,
    locale,
    selectedApp,
    selectedAppDatabases,
    selectedAppBackupPolicies,
    selectedAppBackupRuns,
    selectedAppJobs,
    selectedAppAuditEvents,
    selectedAppLatestSuccess,
    selectedAppLatestFailure,
    selectedAppProxyDrifts,
    selectedAppPrimaryNodeHealth,
    nodeOptions,
    renderers,
    tenantOptions,
    zoneOptions
  } = args;

  if (!selectedApp) {
    return "";
  }

  const primaryProxyResourceKey = `app:${selectedApp.slug}:proxy:${selectedApp.primaryNodeId}`;
  const proxyJobs = selectedAppJobs.filter((job) => job.resourceKey === primaryProxyResourceKey);
  const proxyJobFocus = proxyJobs[0] ?? selectedAppLatestSuccess ?? selectedAppJobs[0];
  const proxyJobsHref = buildDashboardViewUrl(
    "jobs",
    undefined,
    proxyJobFocus?.jobId,
    { jobResource: primaryProxyResourceKey }
  );
  const proxyAuditHref = buildDashboardViewUrl(
    "audit",
    undefined,
    selectedAppAuditEvents[0]?.eventId,
    { auditEntity: selectedApp.slug }
  );
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
  const proxyVhostHref = `/proxy-vhost?slug=${encodeURIComponent(selectedApp.slug)}`;
  const proxyVhostPreviewHref = `${proxyVhostHref}&format=json`;
  const proxyVhostModalId = `proxy-vhost-modal-${selectedApp.slug}`;
  const modePill = renderers.renderPill(
    selectedApp.mode,
    selectedApp.mode === "active-active" ? "success" : "muted"
  );
  const nodeHealthStatus = selectedAppPrimaryNodeHealth?.latestJobStatus;
  const nodeHealthPill = nodeHealthStatus
    ? renderers.renderPill(
        nodeHealthStatus,
        nodeHealthStatus === "applied"
          ? "success"
          : nodeHealthStatus === "failed"
            ? "danger"
            : "muted"
      )
    : renderers.renderPill(copy.none, "muted");
  const fullReconcileConfirmMessage = `Run full reconcile for app ${selectedApp.slug}? This will queue ${
    selectedApp.standbyNodeId ? 3 : 2
  } job(s) across ${selectedApp.standbyNodeId ? "primary and standby nodes" : "the primary node"} plus DNS.`;

  return `<article class="panel detail-shell proxy-workspace-panel">
    <div class="section-head">
      <div>
        <div class="section-title-row">
          <h3>${escapeHtml(copy.selectedResourceTitle)}</h3>
          <span class="section-badge section-badge-lime">${escapeHtml(
            selectedApp.canonicalDomain
          )}</span>
        </div>
        <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
      </div>
    </div>
    <div class="proxy-workspace-columns">
      <div class="proxy-workspace-column stack">
        <article class="panel panel-nested detail-shell">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(copy.proxyPropertiesTitle)}</h3>
              <p class="muted section-description">${escapeHtml(copy.proxyPropertiesDescription)}</p>
            </div>
          </div>
          ${renderers.renderDetailGrid(
            [
              {
                label: copy.appColSlug,
                value: `<span class="mono">${escapeHtml(selectedApp.slug)}</span>`
              },
              { label: copy.appColTenant, value: escapeHtml(selectedApp.tenantSlug) },
              { label: copy.zoneColZone, value: escapeHtml(selectedApp.zoneName) },
              { label: copy.appColDomain, value: escapeHtml(selectedApp.canonicalDomain) },
              {
                label: copy.aliasesLabel,
                value: escapeHtml(
                  selectedApp.aliases.length > 0 ? selectedApp.aliases.join(", ") : copy.none
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
                label: copy.proxyDatabaseTitle,
                value:
                  selectedAppDatabases.length > 0
                    ? selectedAppDatabases
                        .map(
                          (database) => `<a class="detail-link mono" href="${escapeHtml(
                            buildDashboardViewUrl("databases", undefined, database.appSlug)
                          )}">${escapeHtml(database.databaseName)}</a>`
                        )
                        .join(", ")
                    : renderers.renderPill(copy.none, "muted"),
                className: "detail-item-span-two-auto"
              },
              {
                label: copy.modeHealthLabel,
                value: `${modePill} ${nodeHealthPill}`
              },
              {
                label: copy.runtimeImageLabel,
                value: `<span class="mono">${escapeHtml(selectedApp.runtimeImage)}</span>`,
                className: "detail-item-span-full"
              },
              {
                label: copy.storageRootLabel,
                value: `<span class="mono">${escapeHtml(selectedApp.storageRoot)}</span>`,
                className: "detail-item-span-full"
              }
            ],
            { className: "detail-grid-compact" }
          )}
        </article>
        <article class="panel panel-nested detail-shell">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(copy.proxyActionsTitle)}</h3>
              <p class="muted section-description">${escapeHtml(copy.proxyActionsDescription)}</p>
            </div>
          </div>
          <div class="toolbar proxy-actions-toolbar">
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
            ${renderers.renderActionForm(
              "/actions/app-reconcile",
              { slug: selectedApp.slug },
              copy.actionFullReconcile,
              {
                confirmMessage: fullReconcileConfirmMessage
              }
            )}
            <a class="button-link secondary" href="${escapeHtml(proxyJobsHref)}">${escapeHtml(
              copy.openJobHistory
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(proxyAuditHref)}">${escapeHtml(
              copy.openAuditHistory
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(proxyDriftHref)}">${escapeHtml(
              copy.openDriftView
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(proxyBackupsHref)}">${escapeHtml(
              copy.openBackupsView
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(
              buildDashboardViewUrl("node-health", undefined, selectedApp.primaryNodeId)
            )}">${escapeHtml(copy.openNodeHealth)}</a>
            <button
              type="button"
              class="button-link secondary"
              data-proxy-vhost-trigger
              data-preview-url="${escapeHtml(proxyVhostPreviewHref)}"
              data-modal-id="${escapeHtml(proxyVhostModalId)}"
            >${escapeHtml(copy.viewApacheVhost)}</button>
          </div>
        </article>
        ${renderers.renderRelatedPanel(
          copy.backupsTitle,
          copy.backupCoverageDescription,
          proxyBackupItems,
          copy.noRelatedRecords
        )}
      </div>
      <div class="proxy-workspace-column stack">
        <article class="panel panel-nested detail-shell">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(copy.desiredStateEditorsTitle)}</h3>
              <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
            </div>
          </div>
          <form method="post" action="/resources/apps/upsert" class="stack">
            <input type="hidden" name="originalSlug" value="${escapeHtml(selectedApp.slug)}" />
            <div class="grid grid-two">
              <div class="form-grid">
                <label>Slug
                  <input name="slug" value="${escapeHtml(selectedApp.slug)}" required spellcheck="false" />
                </label>
                <label>Tenant slug
                  <select name="tenantSlug" required>
                    ${renderers.renderSelectOptions(tenantOptions, selectedApp.tenantSlug)}
                  </select>
                </label>
                <label>Zone name
                  <select name="zoneName" required>
                    ${renderers.renderSelectOptions(zoneOptions, selectedApp.zoneName)}
                  </select>
                </label>
                <label>Primary node
                  <select name="primaryNodeId" required>
                    ${renderers.renderSelectOptions(nodeOptions, selectedApp.primaryNodeId)}
                  </select>
                </label>
                <label>Standby node
                  <select name="standbyNodeId">
                    ${renderers.renderSelectOptions(nodeOptions, selectedApp.standbyNodeId, {
                      allowBlank: true,
                      blankLabel: "none"
                    })}
                  </select>
                </label>
                <label>Mode
                  <select name="mode">
                    <option value="active-passive"${selectedApp.mode === "active-passive" ? " selected" : ""}>active-passive</option>
                    <option value="active-active"${selectedApp.mode === "active-active" ? " selected" : ""}>active-active</option>
                  </select>
                </label>
              </div>
              <div class="form-grid">
                <label>Canonical domain
                  <input name="canonicalDomain" value="${escapeHtml(selectedApp.canonicalDomain)}" required spellcheck="false" />
                </label>
                <label>Aliases
                  <input name="aliases" value="${escapeHtml(selectedApp.aliases.join(", "))}" />
                </label>
                <label>Backend port
                  <input name="backendPort" type="number" min="1" max="65535" value="${escapeHtml(String(selectedApp.backendPort))}" required />
                </label>
                <label>Runtime image
                  <input name="runtimeImage" value="${escapeHtml(selectedApp.runtimeImage)}" required />
                </label>
                <label>Storage root
                  <input name="storageRoot" value="${escapeHtml(selectedApp.storageRoot)}" required />
                </label>
              </div>
            </div>
            <div class="toolbar">
              <button type="submit">Save app</button>
            </div>
          </form>
        </article>
      </div>
    </div>
    <div class="proxy-vhost-modal" id="${escapeHtml(proxyVhostModalId)}" data-proxy-vhost-modal hidden>
      <div class="proxy-vhost-modal-backdrop" data-proxy-vhost-close></div>
      <div
        class="proxy-vhost-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="${escapeHtml(proxyVhostModalId)}-title"
      >
        <article class="panel proxy-vhost-modal-panel stack">
          <div class="proxy-vhost-modal-header">
            <div class="stack">
              <div class="section-title-row">
                <h3 id="${escapeHtml(proxyVhostModalId)}-title" data-proxy-vhost-title>${escapeHtml(
                  copy.viewApacheVhost
                )}</h3>
                <span class="section-badge section-badge-lime" data-proxy-vhost-domain hidden></span>
              </div>
              <p class="muted section-description" data-proxy-vhost-description></p>
            </div>
            <button type="button" class="secondary proxy-vhost-modal-close" data-proxy-vhost-close></button>
          </div>
          <div class="proxy-vhost-preview-grid">
            <article class="panel panel-muted proxy-vhost-preview-panel stack">
              <div class="section-head">
                <div>
                  <h3 data-proxy-vhost-http-label>HTTP</h3>
                </div>
              </div>
              <div class="code-block code-block-light code-block-numbered" data-proxy-vhost-http></div>
            </article>
            <article class="panel panel-muted proxy-vhost-preview-panel stack">
              <div class="section-head">
                <div>
                  <h3 data-proxy-vhost-https-label>HTTPS / SSL</h3>
                </div>
              </div>
              <div class="code-block code-block-light code-block-numbered" data-proxy-vhost-https></div>
            </article>
          </div>
        </article>
      </div>
    </div>
  </article>`;
}

function renderAppWorkspacePanel(args: RenderAppProxyDesiredStatePanelsArgs): string {
  const {
    copy,
    locale,
    selectedApp,
    selectedAppDatabases,
    selectedAppBackupPolicies,
    selectedAppBackupRuns,
    selectedAppJobs,
    selectedAppAuditEvents,
    selectedAppLatestSuccess,
    selectedAppLatestFailure,
    selectedAppProxyDrifts,
    selectedAppPrimaryNodeHealth,
    nodeOptions,
    renderers,
    tenantOptions,
    zoneOptions
  } = args;

  if (!selectedApp) {
    return "";
  }

  const primaryProxyResourceKey = `app:${selectedApp.slug}:proxy:${selectedApp.primaryNodeId}`;
  const appJobsHref = buildDashboardViewUrl(
    "jobs",
    undefined,
    selectedAppJobs[0]?.jobId ?? selectedAppLatestSuccess?.jobId,
    { jobResource: primaryProxyResourceKey }
  );
  const appAuditHref = buildDashboardViewUrl(
    "audit",
    undefined,
    selectedAppAuditEvents[0]?.eventId,
    { auditEntity: selectedApp.slug }
  );
  const appDriftHref = buildDashboardViewUrl(
    "resource-drift",
    undefined,
    primaryProxyResourceKey
  );
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
  const proxyVhostHref = `/proxy-vhost?slug=${encodeURIComponent(selectedApp.slug)}`;
  const proxyVhostPreviewHref = `${proxyVhostHref}&format=json`;
  const proxyVhostModalId = `app-vhost-modal-${selectedApp.slug}`;
  const modePill = renderers.renderPill(
    selectedApp.mode,
    selectedApp.mode === "active-active" ? "success" : "muted"
  );
  const nodeHealthStatus = selectedAppPrimaryNodeHealth?.latestJobStatus;
  const nodeHealthPill = nodeHealthStatus
    ? renderers.renderPill(
        nodeHealthStatus,
        nodeHealthStatus === "applied"
          ? "success"
          : nodeHealthStatus === "failed"
            ? "danger"
            : "muted"
      )
    : renderers.renderPill(copy.none, "muted");
  const fullReconcileConfirmMessage = `Run full reconcile for app ${selectedApp.slug}? This will queue ${
    selectedApp.standbyNodeId ? 3 : 2
  } job(s) across ${selectedApp.standbyNodeId ? "primary and standby nodes" : "the primary node"} plus DNS.`;

  return `<article class="panel detail-shell resource-workspace-panel">
    <div class="section-head">
      <div>
        <div class="section-title-row">
          <h3>${escapeHtml(copy.selectedResourceTitle)}</h3>
          <span class="section-badge section-badge-lime">${escapeHtml(selectedApp.slug)}</span>
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
                label: copy.appColSlug,
                value: `<span class="mono">${escapeHtml(selectedApp.slug)}</span>`
              },
              { label: copy.appColTenant, value: escapeHtml(selectedApp.tenantSlug) },
              { label: copy.zoneColZone, value: escapeHtml(selectedApp.zoneName) },
              { label: copy.appColDomain, value: escapeHtml(selectedApp.canonicalDomain) },
              {
                label: copy.aliasesLabel,
                value: escapeHtml(
                  selectedApp.aliases.length > 0 ? selectedApp.aliases.join(", ") : copy.none
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
                label: copy.proxyDatabaseTitle,
                value:
                  selectedAppDatabases.length > 0
                    ? selectedAppDatabases
                        .map(
                          (database) => `<a class="detail-link mono" href="${escapeHtml(
                            buildDashboardViewUrl("databases", undefined, database.appSlug)
                          )}">${escapeHtml(database.databaseName)}</a>`
                        )
                        .join(", ")
                    : renderers.renderPill(copy.none, "muted"),
                className: "detail-item-span-two-auto"
              },
              {
                label: copy.modeHealthLabel,
                value: `${modePill} ${nodeHealthPill}`
              },
              {
                label: copy.runtimeImageLabel,
                value: `<span class="mono">${escapeHtml(selectedApp.runtimeImage)}</span>`,
                className: "detail-item-span-full"
              },
              {
                label: copy.storageRootLabel,
                value: `<span class="mono">${escapeHtml(selectedApp.storageRoot)}</span>`,
                className: "detail-item-span-full"
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
              "/actions/app-render-proxy",
              { slug: selectedApp.slug },
              copy.actionDispatchProxyRender,
              {
                confirmMessage: `Dispatch proxy.render for app ${selectedApp.slug}? This will queue ${
                  selectedApp.standbyNodeId ? 2 : 1
                } proxy.render job(s).`
              }
            )}
            ${renderers.renderActionForm(
              "/actions/app-reconcile",
              { slug: selectedApp.slug },
              copy.actionFullReconcile,
              {
                confirmMessage: fullReconcileConfirmMessage
              }
            )}
            <a class="button-link secondary" href="${escapeHtml(appJobsHref)}">${escapeHtml(
              copy.openJobHistory
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(appAuditHref)}">${escapeHtml(
              copy.openAuditHistory
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(appDriftHref)}">${escapeHtml(
              copy.openDriftView
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(appBackupsHref)}">${escapeHtml(
              copy.openBackupsView
            )}</a>
            <a class="button-link secondary" href="${escapeHtml(
              buildDashboardViewUrl("node-health", undefined, selectedApp.primaryNodeId)
            )}">${escapeHtml(copy.openNodeHealth)}</a>
            <button
              type="button"
              class="button-link secondary"
              data-proxy-vhost-trigger
              data-preview-url="${escapeHtml(proxyVhostPreviewHref)}"
              data-modal-id="${escapeHtml(proxyVhostModalId)}"
            >${escapeHtml(copy.viewApacheVhost)}</button>
          </div>
        </article>
        ${renderers.renderRelatedPanel(
          copy.backupsTitle,
          copy.backupCoverageDescription,
          appBackupItems,
          copy.noRelatedRecords
        )}
      </div>
      <div class="resource-workspace-column stack">
        <article class="panel panel-nested detail-shell">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(copy.desiredStateEditorsTitle)}</h3>
              <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
            </div>
          </div>
          <form method="post" action="/resources/apps/upsert" class="stack">
            <input type="hidden" name="originalSlug" value="${escapeHtml(selectedApp.slug)}" />
            <div class="form-grid">
              <label>Slug
                <input name="slug" value="${escapeHtml(selectedApp.slug)}" required spellcheck="false" />
              </label>
              <label>Tenant slug
                <select name="tenantSlug" required>
                  ${renderers.renderSelectOptions(tenantOptions, selectedApp.tenantSlug)}
                </select>
              </label>
              <label>Zone name
                <select name="zoneName" required>
                  ${renderers.renderSelectOptions(zoneOptions, selectedApp.zoneName)}
                </select>
              </label>
              <label>Primary node
                <select name="primaryNodeId" required>
                  ${renderers.renderSelectOptions(nodeOptions, selectedApp.primaryNodeId)}
                </select>
              </label>
              <label>Standby node
                <select name="standbyNodeId">
                  ${renderers.renderSelectOptions(nodeOptions, selectedApp.standbyNodeId, {
                    allowBlank: true,
                    blankLabel: "none"
                  })}
                </select>
              </label>
              <label>Canonical domain
                <input name="canonicalDomain" value="${escapeHtml(selectedApp.canonicalDomain)}" required spellcheck="false" />
              </label>
              <label>Aliases
                <input name="aliases" value="${escapeHtml(selectedApp.aliases.join(", "))}" />
              </label>
              <label>Backend port
                <input name="backendPort" type="number" min="1" max="65535" value="${escapeHtml(String(selectedApp.backendPort))}" required />
              </label>
              <label>Runtime image
                <input name="runtimeImage" value="${escapeHtml(selectedApp.runtimeImage)}" required />
              </label>
              <label>Storage root
                <input name="storageRoot" value="${escapeHtml(selectedApp.storageRoot)}" required />
              </label>
              <label>Mode
                <select name="mode">
                  <option value="active-passive"${selectedApp.mode === "active-passive" ? " selected" : ""}>active-passive</option>
                  <option value="active-active"${selectedApp.mode === "active-active" ? " selected" : ""}>active-active</option>
                </select>
              </label>
            </div>
            <div class="toolbar">
              <button type="submit">Save app</button>
            </div>
          </form>
        </article>
      </div>
    </div>
    <div class="proxy-vhost-modal" id="${escapeHtml(proxyVhostModalId)}" hidden>
      <div class="proxy-vhost-modal-backdrop" data-proxy-vhost-close></div>
      <div class="panel detail-shell proxy-vhost-modal-dialog proxy-vhost-modal-panel" role="dialog" aria-modal="true" aria-labelledby="${escapeHtml(proxyVhostModalId)}-title">
        <div class="proxy-vhost-modal-header">
          <div>
            <div class="section-title-row">
              <h3 id="${escapeHtml(proxyVhostModalId)}-title">${escapeHtml(copy.viewApacheVhost)}</h3>
              <span class="section-badge section-badge-lime">${escapeHtml(selectedApp.slug)}</span>
            </div>
            <p class="muted section-description">${escapeHtml(copy.proxyWorkspaceDescription)}</p>
          </div>
          <button type="button" class="proxy-vhost-modal-close secondary" data-proxy-vhost-close>Close</button>
        </div>
        <div class="proxy-vhost-preview-grid">
          <article class="panel panel-nested detail-shell proxy-vhost-preview-panel">
            <div class="section-head">
              <div>
                <h3 data-proxy-vhost-http-label>HTTP</h3>
              </div>
            </div>
            <div class="code-block code-block-light code-block-numbered" data-proxy-vhost-http></div>
          </article>
          <article class="panel panel-nested detail-shell proxy-vhost-preview-panel">
            <div class="section-head">
              <div>
                <h3 data-proxy-vhost-https-label>HTTPS / SSL</h3>
              </div>
            </div>
            <div class="code-block code-block-light code-block-numbered" data-proxy-vhost-https></div>
          </article>
        </div>
      </div>
    </div>
  </article>`;
}

export function renderAppProxyDesiredStatePanels(
  args: RenderAppProxyDesiredStatePanelsArgs
): {
  proxyDetailPanel: string;
  proxyEditorPanel: string;
  proxyWorkspacePanel: string;
  appDetailPanel: string;
  appEditorPanel: string;
  appWorkspacePanel: string;
} {
  if (!args.selectedApp) {
    return {
      proxyDetailPanel: "",
      proxyEditorPanel: "",
      proxyWorkspacePanel: "",
      appDetailPanel: "",
      appEditorPanel: "",
      appWorkspacePanel: ""
    };
  }

  const proxyDetailPanel = renderProxyDetailPanel(args);
  const proxyEditorPanel = renderProxyEditorPanel(args);
  const proxyWorkspacePanel = renderProxyWorkspacePanel(args);
  const appDetailPanel = renderAppDetailPanel(args);
  const appEditorPanel = renderAppEditorPanel(args);
  const appWorkspacePanel = renderAppWorkspacePanel(args);

  return {
    proxyDetailPanel,
    proxyEditorPanel,
    proxyWorkspacePanel,
    appDetailPanel,
    appEditorPanel,
    appWorkspacePanel
  };
}
