import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type WebLocale } from "./request.js";
import { type WebCopy } from "./web-copy.js";

function formatList(values: string[], emptyLabel: string): string {
  return values.length > 0 ? values.join(", ") : emptyLabel;
}

function renderNodeSelectionFieldset(
  copy: WebCopy,
  nodes: DashboardData["nodeHealth"]
): string {
  if (nodes.length === 0) {
    return `<div class="select-empty">${escapeHtml(copy.noNodes)}</div>`;
  }

  return `<fieldset class="selection-fieldset">
    <legend>${escapeHtml(copy.targetedNodesLabel)}</legend>
    <div class="selection-grid">
      ${nodes
        .map(
          (node) => `<label class="selection-option">
            <input type="checkbox" name="nodeIds" value="${escapeHtml(node.nodeId)}" checked />
            <span class="selection-option-copy">
              <strong>${escapeHtml(node.nodeId)}</strong>
              <small>${escapeHtml(node.hostname)}</small>
            </span>
          </label>`
        )
        .join("")}
    </div>
  </fieldset>`;
}

function renderStatusPill(
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string,
  active?: boolean,
  enabled?: boolean
): string {
  if (active) {
    return renderPill(enabled === false ? "active" : "active/enabled", "success");
  }

  if (enabled) {
    return renderPill("enabled", "danger");
  }

  return renderPill("inactive", "muted");
}

function buildFirewallRows(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, data, locale, formatDate, renderPill } = args;

  return data.nodeHealth.map((node) => {
    const firewall = node.firewall;
    const zones = firewall?.zones ?? [];
    const ports = zones.flatMap((zone) =>
      zone.ports.map((port) => `${port.port}/${port.protocol}`)
    );
    const services = zones.flatMap((zone) =>
      zone.services.map((service) => `${zone.zone}:${service}`)
    );

    return {
      selectionKey: node.nodeId,
      cells: [
        `<span class="mono">${escapeHtml(node.nodeId)}</span>`,
        escapeHtml(node.hostname),
        firewall
          ? renderStatusPill(renderPill, firewall.active, firewall.enabled)
          : renderPill(copy.notReportedLabel, "muted"),
        escapeHtml(firewall?.defaultZone ?? copy.none),
        escapeHtml(formatList(zones.map((zone) => zone.zone), copy.none)),
        `<span class="mono">${escapeHtml(formatList([...new Set(ports)].sort(), copy.none))}</span>`,
        escapeHtml(formatList([...new Set(services)].sort(), copy.none)),
        escapeHtml(formatDate(firewall?.checkedAt, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        firewall?.serviceName ?? "",
        firewall?.defaultZone ?? "",
        zones.map((zone) => zone.zone).join(" "),
        ports.join(" "),
        services.join(" ")
      ].join(" ")
    };
  });
}

function buildFail2BanRows(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, data, locale, formatDate, renderPill } = args;

  return data.nodeHealth.map((node) => {
    const fail2ban = node.fail2ban;
    const jails = fail2ban?.jails ?? [];
    const currentFailed = jails.reduce((total, jail) => total + (jail.currentFailed ?? 0), 0);
    const currentBanned = jails.reduce((total, jail) => total + (jail.currentBanned ?? 0), 0);
    const totalBanned = jails.reduce((total, jail) => total + (jail.totalBanned ?? 0), 0);
    const bannedIps = [...new Set(jails.flatMap((jail) => jail.bannedIps))].sort();

    return {
      selectionKey: node.nodeId,
      cells: [
        `<span class="mono">${escapeHtml(node.nodeId)}</span>`,
        escapeHtml(node.hostname),
        fail2ban
          ? renderStatusPill(renderPill, fail2ban.active, fail2ban.enabled)
          : renderPill(copy.notReportedLabel, "muted"),
        escapeHtml(formatList(jails.map((jail) => jail.jail), copy.none)),
        `<span class="mono">${escapeHtml(String(currentFailed))}</span>`,
        `<span class="mono">${escapeHtml(String(currentBanned))}</span>`,
        `<span class="mono">${escapeHtml(String(totalBanned))}</span>`,
        escapeHtml(formatList(bannedIps, copy.none)),
        escapeHtml(formatDate(fail2ban?.checkedAt, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        fail2ban?.serviceName ?? "",
        fail2ban?.version ?? "",
        jails.map((jail) => jail.jail).join(" "),
        bannedIps.join(" ")
      ].join(" ")
    };
  });
}

export function renderFirewallWorkspace(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  currentPath: string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
  renderSignalStrip: (
    items: Array<{
      label: string;
      value: string;
      tone?: "default" | "success" | "danger" | "muted";
    }>
  ) => string;
}): string {
  const { copy, data, locale, currentPath, formatDate, renderPill, renderSignalStrip } = args;
  const reportedNodes = data.nodeHealth.filter((node) => node.firewall);
  const activeNodes = reportedNodes.filter((node) => node.firewall?.active);
  const openPortCount = new Set(
    reportedNodes.flatMap((node) =>
      (node.firewall?.zones ?? []).flatMap((zone) =>
        zone.ports.map((port) => `${port.port}/${port.protocol}`)
      )
    )
  ).size;
  const rows = buildFirewallRows({ copy, data, locale, formatDate, renderPill });

  const table = renderDataTable({
    id: "section-firewall-table",
    heading: copy.firewallNodesTitle,
    description: copy.firewallNodesDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.serviceStateLabel },
      { label: copy.defaultZoneLabel },
      { label: copy.activeZonesLabel },
      { label: copy.openPortsLabel, className: "mono" },
      { label: copy.zoneServicesLabel },
      { label: copy.generatedAt }
    ],
    rows,
    emptyMessage: copy.noNodes,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  const actionsPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.firewallActionsTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.firewallActionsDescription)}</p>
      </div>
    </div>
    <form method="post" action="/actions/firewall-apply" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(currentPath)}" />
      ${renderNodeSelectionFieldset(copy, data.nodeHealth)}
      <div class="selection-grid">
        <label class="checkbox-inline"><input type="checkbox" name="installPackage" /> <span>${escapeHtml(copy.installPackageLabel)}</span></label>
        <label class="checkbox-inline"><input type="checkbox" name="enableService" checked /> <span>${escapeHtml(copy.enableServiceLabel)}</span></label>
        <label class="checkbox-inline"><input type="checkbox" name="applyPublicZone" checked /> <span>${escapeHtml(copy.applyPublicZoneLabel)}</span></label>
        <label class="checkbox-inline"><input type="checkbox" name="applyWireGuardZone" /> <span>${escapeHtml(copy.applyWireGuardZoneLabel)}</span></label>
        <label class="checkbox-inline"><input type="checkbox" name="reload" checked /> <span>${escapeHtml(copy.reloadFirewallLabel)}</span></label>
      </div>
      <div class="toolbar">
        <button type="submit" data-confirm="${escapeHtml("Queue firewall baseline apply jobs?")}">${escapeHtml(copy.applyFirewallLabel)}</button>
        <a class="button-link secondary" href="${escapeHtml(buildDashboardViewUrl("jobs", undefined, undefined, { jobKind: "firewall.apply" }))}">${escapeHtml(copy.openJobHistory)}</a>
      </div>
    </form>
  </article>`;

  return `<section id="section-firewall" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.serviceStateLabel, value: String(activeNodes.length), tone: activeNodes.length === data.nodeHealth.length ? "success" : "danger" },
      { label: copy.activeZonesLabel, value: String(new Set(reportedNodes.flatMap((node) => (node.firewall?.zones ?? []).map((zone) => zone.zone))).size), tone: "muted" },
      { label: copy.openPortsLabel, value: String(openPortCount), tone: "muted" }
    ])}
    ${table}
    ${actionsPanel}
  </section>`;
}

export function renderFail2BanWorkspace(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  currentPath: string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
  renderSignalStrip: (
    items: Array<{
      label: string;
      value: string;
      tone?: "default" | "success" | "danger" | "muted";
    }>
  ) => string;
}): string {
  const { copy, data, locale, currentPath, formatDate, renderPill, renderSignalStrip } = args;
  const reportedNodes = data.nodeHealth.filter((node) => node.fail2ban);
  const activeNodes = reportedNodes.filter((node) => node.fail2ban?.active);
  const jails = reportedNodes.flatMap((node) => node.fail2ban?.jails ?? []);
  const currentBanned = jails.reduce((total, jail) => total + (jail.currentBanned ?? 0), 0);
  const currentFailed = jails.reduce((total, jail) => total + (jail.currentFailed ?? 0), 0);
  const rows = buildFail2BanRows({ copy, data, locale, formatDate, renderPill });

  const table = renderDataTable({
    id: "section-fail2ban-table",
    heading: copy.fail2banNodesTitle,
    description: copy.fail2banNodesDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.serviceStateLabel },
      { label: copy.jailCountLabel },
      { label: copy.currentFailedLabel, className: "mono" },
      { label: copy.currentBannedLabel, className: "mono" },
      { label: copy.totalBannedLabel, className: "mono" },
      { label: copy.bannedIpsLabel },
      { label: copy.generatedAt }
    ],
    rows,
    emptyMessage: copy.noNodes,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  const actionsPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.fail2banActionsTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.fail2banActionsDescription)}</p>
      </div>
    </div>
    <form method="post" action="/actions/fail2ban-apply" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(currentPath)}" />
      ${renderNodeSelectionFieldset(copy, data.nodeHealth)}
      <div class="selection-grid">
        <label class="checkbox-inline"><input type="checkbox" name="installPackage" /> <span>${escapeHtml(copy.installPackageLabel)}</span></label>
        <label class="checkbox-inline"><input type="checkbox" name="applySshdJail" checked /> <span>${escapeHtml(copy.applySshdJailLabel)}</span></label>
        <label class="checkbox-inline"><input type="checkbox" name="enableService" checked /> <span>${escapeHtml(copy.enableServiceLabel)}</span></label>
        <label class="checkbox-inline"><input type="checkbox" name="restartService" checked /> <span>${escapeHtml(copy.restartServiceLabel)}</span></label>
      </div>
      <div class="toolbar">
        <button type="submit" data-confirm="${escapeHtml("Queue Fail2Ban baseline apply jobs?")}">${escapeHtml(copy.applyFail2BanLabel)}</button>
        <a class="button-link secondary" href="${escapeHtml(buildDashboardViewUrl("jobs", undefined, undefined, { jobKind: "fail2ban.apply" }))}">${escapeHtml(copy.openJobHistory)}</a>
      </div>
    </form>
  </article>`;

  return `<section id="section-fail2ban" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.serviceStateLabel, value: String(activeNodes.length), tone: activeNodes.length === data.nodeHealth.length ? "success" : "danger" },
      { label: copy.jailCountLabel, value: String(jails.length), tone: jails.length > 0 ? "success" : "muted" },
      { label: copy.currentFailedLabel, value: String(currentFailed), tone: currentFailed > 0 ? "danger" : "success" },
      { label: copy.currentBannedLabel, value: String(currentBanned), tone: currentBanned > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${actionsPanel}
  </section>`;
}
