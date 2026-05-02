import { escapeHtml, renderTabs, type TabItem } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import {
  type DesiredStateTabId,
  buildDashboardViewUrl
} from "./dashboard-routing.js";
import {
  type DesiredStateActionFactsRenderer,
  type DesiredStateDetailGridRenderer,
  type DesiredStateSelectOption,
  type DesiredStateSelectOptionsRenderer
} from "./desired-state-shared.js";
import { type WebLocale } from "./request.js";

export interface DesiredStateCreateCopy {
  actionsDownloadYaml: string;
  backupPolicies: string;
  bootstrapInventoryDescription: string;
  bootstrapInventoryTitle: string;
  dailyOperationsSourceNote: string;
  desiredStateEditorsDescription: string;
  latestExport: string;
  latestImport: string;
  latestImportCounts: string;
  navCreate: string;
  never: string;
  records: string;
  tabApps: string;
  tabBackupPolicies: string;
  tabCreate: string;
  tabDatabases: string;
  tabNodes: string;
  tabTenants: string;
  tabZones: string;
}

export function buildDesiredStateCreateTab<Copy extends DesiredStateCreateCopy>(args: {
  copy: Copy;
  data: DashboardData;
  locale: WebLocale;
  defaultTabId: DesiredStateTabId;
  tenantOptions: DesiredStateSelectOption[];
  nodeOptions: DesiredStateSelectOption[];
  zoneOptions: DesiredStateSelectOption[];
  appOptions: DesiredStateSelectOption[];
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  interpolateCopy: (
    template: string,
    variables: Record<string, string | number>
  ) => string;
  renderActionFacts: DesiredStateActionFactsRenderer;
  renderDetailGrid: DesiredStateDetailGridRenderer;
  renderSelectOptions: DesiredStateSelectOptionsRenderer;
}): {
  createTab: TabItem;
  createFormPanels: Map<string, string>;
} {
  const {
    copy,
    data,
    locale,
    tenantOptions,
    nodeOptions,
    zoneOptions,
    appOptions,
    formatDate,
    interpolateCopy,
    renderActionFacts,
    renderDetailGrid,
    renderSelectOptions
  } = args;

  const createTabs: TabItem[] = [
    {
      id: "create-tenant-form",
      label: copy.tabTenants,
      panelHtml: `<article class="panel detail-shell">
        <h3>Create tenant</h3>
        <form method="post" action="/resources/tenants/upsert" class="stack">
          <div class="form-grid">
            <label>Slug
              <input name="slug" required spellcheck="false" />
            </label>
            <label>Display name
              <input name="displayName" required />
            </label>
          </div>
          <button type="submit">Create tenant</button>
        </form>
      </article>`
    },
    {
      id: "create-node-form",
      label: copy.tabNodes,
      panelHtml: `<article class="panel detail-shell">
        <h3>Create node</h3>
        <form method="post" action="/resources/nodes/upsert" class="stack">
          <div class="form-grid">
            <label>Node ID
              <input name="nodeId" required spellcheck="false" />
            </label>
            <label>Hostname
              <input name="hostname" required spellcheck="false" />
            </label>
            <label>Public IPv4
              <input name="publicIpv4" required spellcheck="false" />
            </label>
            <label>WireGuard address
              <input name="wireguardAddress" required spellcheck="false" />
            </label>
          </div>
          <button type="submit">Create node</button>
        </form>
      </article>`
    },
    {
      id: "create-zone-form",
      label: copy.tabZones,
      panelHtml: `<article class="panel detail-shell">
        <h3>Create zone</h3>
        <form method="post" action="/resources/zones/upsert" class="stack">
          <div class="form-grid">
            <label>Zone name
              <input name="zoneName" required spellcheck="false" />
            </label>
            <label>Tenant slug
              <select name="tenantSlug" required>
                ${renderSelectOptions(tenantOptions, undefined)}
              </select>
            </label>
            <label>Primary node
              <select name="primaryNodeId" required>
                ${renderSelectOptions(nodeOptions, undefined)}
              </select>
            </label>
          </div>
          <label>Records
            <textarea name="records" spellcheck="false" class="mono" placeholder="@ A 203.0.113.10 300"></textarea>
          </label>
          <button type="submit">Create zone</button>
        </form>
      </article>`
    },
    {
      id: "create-app-form",
      label: copy.tabApps,
      panelHtml: `<article class="panel detail-shell">
        <h3>Create app</h3>
        <form method="post" action="/resources/apps/upsert" class="stack">
          <div class="form-grid">
            <label>Slug
              <input name="slug" required spellcheck="false" />
            </label>
            <label>Tenant slug
              <select name="tenantSlug" required>
                ${renderSelectOptions(tenantOptions, undefined)}
              </select>
            </label>
            <label>Zone name
              <select name="zoneName" required>
                ${renderSelectOptions(zoneOptions, undefined)}
              </select>
            </label>
            <label>Primary node
              <select name="primaryNodeId" required>
                ${renderSelectOptions(nodeOptions, undefined)}
              </select>
            </label>
            <label>Standby node
              <select name="standbyNodeId">
                ${renderSelectOptions(nodeOptions, undefined, {
                  allowBlank: true,
                  blankLabel: "none"
                })}
              </select>
            </label>
            <label>Canonical domain
              <input name="canonicalDomain" required spellcheck="false" />
            </label>
            <label>Aliases
              <input name="aliases" />
            </label>
            <label>Backend port
              <input type="number" name="backendPort" min="1" max="65535" required />
            </label>
            <label>Runtime image
              <input name="runtimeImage" required />
            </label>
            <label>Storage root
              <input name="storageRoot" required />
            </label>
            <label>Mode
              <select name="mode">
                <option value="active-passive" selected>active-passive</option>
                <option value="active-active">active-active</option>
              </select>
            </label>
          </div>
          <button type="submit">Create app</button>
        </form>
      </article>`
    },
    {
      id: "create-database-form",
      label: copy.tabDatabases,
      panelHtml: `<article class="panel detail-shell">
        <h3>Create database</h3>
        <form method="post" action="/resources/databases/upsert" class="stack">
          <div class="form-grid">
            <label>App slug
              <select name="appSlug" required>
                ${renderSelectOptions(appOptions, undefined)}
              </select>
            </label>
            <label>Engine
              <select name="engine">
                <option value="postgresql">postgresql</option>
                <option value="mariadb">mariadb</option>
              </select>
            </label>
            <label>Database name
              <input name="databaseName" required spellcheck="false" />
            </label>
            <label>Database user
              <input name="databaseUser" required spellcheck="false" />
            </label>
            <label>Primary node
              <select name="primaryNodeId" required>
                ${renderSelectOptions(nodeOptions, undefined)}
              </select>
            </label>
            <label>Standby node
              <select name="standbyNodeId">
                ${renderSelectOptions(nodeOptions, undefined, {
                  allowBlank: true,
                  blankLabel: "none"
                })}
              </select>
            </label>
            <label>Pending migration target
              <input name="pendingMigrationTo" />
            </label>
            <label>Completed migration source
              <select name="migrationCompletedFrom">
                <option value="" selected>none</option>
                <option value="postgresql">postgresql</option>
                <option value="mariadb">mariadb</option>
              </select>
            </label>
            <label>Migration completed at
              <input name="migrationCompletedAt" placeholder="2026-04-12T10:30:00Z" spellcheck="false" />
            </label>
            <label>Desired password
              <input type="password" name="desiredPassword" />
            </label>
          </div>
          <button type="submit">Create database</button>
        </form>
      </article>`
    },
    {
      id: "create-backup-form",
      label: copy.tabBackupPolicies,
      panelHtml: `<article class="panel detail-shell">
        <h3>Create backup policy</h3>
        <form method="post" action="/resources/backups/upsert" class="stack">
          <div class="form-grid">
            <label>Policy slug
              <input name="policySlug" required />
            </label>
            <label>Tenant slug
              <select name="tenantSlug" required>
                ${renderSelectOptions(tenantOptions, undefined)}
              </select>
            </label>
            <label>Target node
              <select name="targetNodeId" required>
                ${renderSelectOptions(nodeOptions, undefined)}
              </select>
            </label>
            <label>Schedule
              <input name="schedule" placeholder="0 */6 * * *" required />
            </label>
            <label>Retention days
              <input type="number" name="retentionDays" min="1" required />
            </label>
            <label>Storage location
              <input name="storageLocation" required />
            </label>
            <label>Resource selectors
              <input name="resourceSelectors" />
            </label>
          </div>
          <button type="submit">Create backup policy</button>
        </form>
      </article>`
    }
  ];

  const desiredStateLatestImportSummary = data.inventory.latestImport
    ? `${formatDate(data.inventory.latestImport.importedAt, locale)} · ${data.inventory.latestImport.sourcePath}`
    : copy.never;
  const desiredStateLatestExportSummary = data.inventory.latestExport
    ? formatDate(data.inventory.latestExport.exportedAt, locale)
    : copy.never;

  const createPanelHtml = `<div class="stack">
      <article class="panel panel-muted detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(copy.navCreate)}</h3>
            <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
          </div>
        </div>
        ${renderDetailGrid([
          {
            label: copy.records,
            value: escapeHtml(
              interpolateCopy(copy.latestImportCounts, {
                nodes: data.desiredState.spec.nodes.length,
                zones: data.desiredState.spec.zones.length,
                apps: data.desiredState.spec.apps.length,
                databases: data.desiredState.spec.databases.length
              })
            )
          },
          {
            label: copy.backupPolicies,
            value: escapeHtml(String(data.desiredState.spec.backupPolicies.length))
          }
        ])}
      </article>
      <p class="section-note muted">${escapeHtml(copy.dailyOperationsSourceNote)}</p>
      ${renderTabs({
        id: "desired-state-create-tabs",
        tabs: createTabs,
        defaultTabId: "create-tenant-form"
      })}
      <details class="panel panel-muted detail-shell">
        <summary>${escapeHtml(copy.bootstrapInventoryTitle)}</summary>
        <p class="muted section-description">${escapeHtml(copy.bootstrapInventoryDescription)}</p>
        ${renderActionFacts([
          { label: copy.latestImport, value: escapeHtml(desiredStateLatestImportSummary) },
          { label: copy.latestExport, value: escapeHtml(desiredStateLatestExportSummary) },
          {
            label: copy.records,
            value: escapeHtml(
              interpolateCopy(copy.latestImportCounts, {
                nodes: data.desiredState.summary.nodeCount,
                zones: data.desiredState.summary.zoneCount,
                apps: data.desiredState.summary.appCount,
                databases: data.desiredState.summary.databaseCount
              })
            )
          }
        ])}
        <div class="toolbar">
          <a class="button-link secondary" href="/inventory/export">${escapeHtml(
            copy.actionsDownloadYaml
          )}</a>
        </div>
      </details>
    </div>`;

  return {
    createTab: {
      id: "desired-state-create",
      label: copy.tabCreate,
      badge: "+",
      href: buildDashboardViewUrl("desired-state", "desired-state-create"),
      panelHtml: createPanelHtml
    },
    createFormPanels: new Map(createTabs.map((tab) => [tab.id, tab.panelHtml] as const))
  };
}
