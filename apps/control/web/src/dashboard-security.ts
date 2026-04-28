import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { renderActionFacts } from "./panel-renderers.js";
import { type WebLocale } from "./request.js";
import { type WebCopy } from "./web-copy.js";

function formatList(values: string[], emptyLabel: string): string {
  return values.length > 0 ? values.join(", ") : emptyLabel;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function renderCountPill(
  count: number,
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string
): string {
  return renderPill(String(count), count > 0 ? "success" : "muted");
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
    const uniqueZones = uniqueSorted(zones.map((zone) => zone.zone));
    const uniquePorts = uniqueSorted(ports);
    const uniqueServices = uniqueSorted(services);

    return {
      selectionKey: node.nodeId,
      cells: [
        `<span class="mono">${escapeHtml(node.nodeId)}</span>`,
        escapeHtml(node.hostname),
        firewall
          ? renderStatusPill(renderPill, firewall.active, firewall.enabled)
          : renderPill(copy.notReportedLabel, "muted"),
        escapeHtml(firewall?.defaultZone ?? copy.none),
        renderCountPill(uniqueZones.length, renderPill),
        renderCountPill(uniquePorts.length, renderPill),
        renderCountPill(uniqueServices.length, renderPill),
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
    const bannedIps = uniqueSorted(jails.flatMap((jail) => jail.bannedIps));

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
        renderPill(String(bannedIps.length), bannedIps.length > 0 ? "danger" : "muted"),
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

function renderFirewallDetailPanel(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, data, locale, formatDate, renderPill } = args;
  const nodeDetails =
    data.nodeHealth.length === 0
      ? `<p class="empty">${escapeHtml(copy.noNodes)}</p>`
      : data.nodeHealth
          .map((node) => {
            const firewall = node.firewall;

            if (!firewall) {
              return `<div class="section-note stack">
                <div class="section-head">
                  <div>
                    <p><strong>${escapeHtml(node.nodeId)}</strong></p>
                    <p class="muted">${escapeHtml(node.hostname)}</p>
                  </div>
                  ${renderPill(copy.notReportedLabel, "muted")}
                </div>
              </div>`;
            }

            const zones = firewall.zones ?? [];
            const zoneNames = uniqueSorted(zones.map((zone) => zone.zone));
            const ports = uniqueSorted(
              zones.flatMap((zone) =>
                zone.ports.map((port) => `${port.port}/${port.protocol}`)
              )
            );
            const services = uniqueSorted(
              zones.flatMap((zone) =>
                zone.services.map((service) => `${zone.zone}:${service}`)
              )
            );

            return `<div class="section-note stack">
              <div class="section-head">
                <div>
                  <p><strong>${escapeHtml(node.nodeId)}</strong></p>
                  <p class="muted">${escapeHtml(node.hostname)}</p>
                </div>
                ${renderStatusPill(renderPill, firewall.active, firewall.enabled)}
              </div>
              ${renderActionFacts(
                [
                  {
                    label: copy.defaultZoneLabel,
                    value: escapeHtml(firewall.defaultZone ?? copy.none)
                  },
                  {
                    label: copy.activeZonesLabel,
                    value: `<span class="mono">${escapeHtml(formatList(zoneNames, copy.none))}</span>`
                  },
                  {
                    label: copy.openPortsLabel,
                    value: `<span class="mono">${escapeHtml(formatList(ports, copy.none))}</span>`
                  },
                  {
                    label: copy.zoneServicesLabel,
                    value: `<span class="mono">${escapeHtml(formatList(services, copy.none))}</span>`
                  },
                  {
                    label: copy.generatedAt,
                    value: escapeHtml(formatDate(firewall.checkedAt, locale))
                  }
                ],
                { className: "action-card-facts-wide-labels" }
              )}
            </div>`;
          })
          .join("");

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.firewallDetailTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.firewallDetailDescription)}</p>
      </div>
    </div>
    <div class="stack">${nodeDetails}</div>
  </article>`;
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
  const detailPanel = renderFirewallDetailPanel({
    copy,
    data,
    locale,
    formatDate,
    renderPill
  });

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
    <div class="grid-two-desktop">
      ${detailPanel}
      ${actionsPanel}
    </div>
  </section>`;
}

function renderFail2BanDetailPanel(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, data, locale, formatDate, renderPill } = args;
  const nodeDetails =
    data.nodeHealth.length === 0
      ? `<p class="empty">${escapeHtml(copy.noNodes)}</p>`
      : data.nodeHealth
          .map((node) => {
            const fail2ban = node.fail2ban;

            if (!fail2ban) {
              return `<div class="section-note stack">
                <div class="section-head">
                  <div>
                    <p><strong>${escapeHtml(node.nodeId)}</strong></p>
                    <p class="muted">${escapeHtml(node.hostname)}</p>
                  </div>
                  ${renderPill(copy.notReportedLabel, "muted")}
                </div>
              </div>`;
            }

            const jails = fail2ban.jails ?? [];
            const jailNames = uniqueSorted(jails.map((jail) => jail.jail));
            const bannedIps = uniqueSorted(jails.flatMap((jail) => jail.bannedIps));
            const currentFailed = jails.reduce(
              (total, jail) => total + (jail.currentFailed ?? 0),
              0
            );
            const currentBanned = jails.reduce(
              (total, jail) => total + (jail.currentBanned ?? 0),
              0
            );
            const totalBanned = jails.reduce(
              (total, jail) => total + (jail.totalBanned ?? 0),
              0
            );

            return `<div class="section-note stack">
              <div class="section-head">
                <div>
                  <p><strong>${escapeHtml(node.nodeId)}</strong></p>
                  <p class="muted">${escapeHtml(node.hostname)}</p>
                </div>
                ${renderStatusPill(renderPill, fail2ban.active, fail2ban.enabled)}
              </div>
              ${renderActionFacts(
                [
                  {
                    label: copy.jailCountLabel,
                    value: `<span class="mono">${escapeHtml(formatList(jailNames, copy.none))}</span>`
                  },
                  {
                    label: copy.currentFailedLabel,
                    value: `<span class="mono">${escapeHtml(String(currentFailed))}</span>`
                  },
                  {
                    label: copy.currentBannedLabel,
                    value: `<span class="mono">${escapeHtml(String(currentBanned))}</span>`
                  },
                  {
                    label: copy.totalBannedLabel,
                    value: `<span class="mono">${escapeHtml(String(totalBanned))}</span>`
                  },
                  {
                    label: copy.bannedIpsLabel,
                    value: `<span class="mono">${escapeHtml(formatList(bannedIps, copy.none))}</span>`
                  },
                  {
                    label: copy.generatedAt,
                    value: escapeHtml(formatDate(fail2ban.checkedAt, locale))
                  }
                ],
                { className: "action-card-facts-wide-labels" }
              )}
            </div>`;
          })
          .join("");

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.fail2banDetailTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.fail2banDetailDescription)}</p>
      </div>
    </div>
    <div class="stack">${nodeDetails}</div>
  </article>`;
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
  const detailPanel = renderFail2BanDetailPanel({
    copy,
    data,
    locale,
    formatDate,
    renderPill
  });

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
    <div class="grid-two-desktop">
      ${detailPanel}
      ${actionsPanel}
    </div>
  </section>`;
}
