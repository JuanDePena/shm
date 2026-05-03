import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { renderActionFacts } from "./panel-renderers.js";
import { type WebCopy } from "./web-copy.js";

type ControlPlaneOperator = DashboardData["users"][number];

function selectOperator(
  operators: ControlPlaneOperator[],
  focus: string | undefined
): ControlPlaneOperator | undefined {
  return (
    operators.find(
      (operator) => operator.userId === focus || operator.email === focus
    ) ?? operators[0]
  );
}

function roleTone(role: string): "default" | "success" | "danger" | "muted" {
  return role === "platform_admin" ? "danger" : role === "platform_operator" ? "success" : "muted";
}

function roleLabel(role: string, copy: WebCopy): string {
  switch (role) {
    case "platform_admin":
      return copy.operatorRolePlatformAdmin;
    case "platform_operator":
      return copy.operatorRolePlatformOperator;
    default:
      return role;
  }
}

function renderGlobalRoles(
  operator: ControlPlaneOperator,
  copy: WebCopy,
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string
): string {
  if (operator.globalRoles.length === 0) {
    return renderPill(copy.operatorNoGlobalRoles, "muted");
  }

  return operator.globalRoles
    .map((role) => renderPill(roleLabel(role, copy), roleTone(role)))
    .join(" ");
}

function renderTenantMemberships(operator: ControlPlaneOperator, copy: WebCopy): string {
  if (operator.tenantMemberships.length === 0) {
    return escapeHtml(copy.operatorNoTenantMemberships);
  }

  return escapeHtml(
    operator.tenantMemberships
      .map((membership) => `${membership.tenantSlug}:${membership.role}`)
      .join(", ")
  );
}

function statusTone(status: string): "default" | "success" | "danger" | "muted" {
  return status === "active" ? "success" : "danger";
}

function buildOperatorRows(args: {
  copy: WebCopy;
  operators: ControlPlaneOperator[];
  selectedOperator: ControlPlaneOperator | undefined;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, operators, selectedOperator, renderFocusLink, renderPill } = args;

  return operators.map((operator) => {
    const selected = operator.userId === selectedOperator?.userId;

    return {
      selectionKey: operator.userId,
      selected,
      cells: [
        renderFocusLink(
          operator.email,
          buildDashboardViewUrl("operators", undefined, operator.userId),
          selected,
          copy.selectedStateLabel
        ),
        escapeHtml(operator.displayName),
        renderPill(operator.status, statusTone(operator.status)),
        renderGlobalRoles(operator, copy, renderPill),
        renderTenantMemberships(operator, copy)
      ],
      searchText: [
        operator.email,
        operator.displayName,
        operator.status,
        operator.globalRoles.join(" "),
        operator.tenantMemberships
          .map((membership) => `${membership.tenantSlug} ${membership.role}`)
          .join(" ")
      ].join(" ")
    };
  });
}

function renderSelectedOperatorPanel(args: {
  copy: WebCopy;
  selectedOperator: ControlPlaneOperator | undefined;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, selectedOperator, renderPill } = args;

  if (!selectedOperator) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noOperators)}</p></article>`;
  }

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.operatorsSelectedTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.operatorsSelectedDescription)}</p>
      </div>
      ${renderPill(selectedOperator.status, statusTone(selectedOperator.status))}
    </div>
    ${renderActionFacts(
      [
        {
          label: copy.operatorEmailLabel,
          value: `<span class="mono">${escapeHtml(selectedOperator.email)}</span>`
        },
        {
          label: copy.operatorDisplayNameLabel,
          value: escapeHtml(selectedOperator.displayName)
        },
        {
          label: copy.operatorStatusLabel,
          value: renderPill(selectedOperator.status, statusTone(selectedOperator.status))
        },
        {
          label: copy.globalRoles,
          value: renderGlobalRoles(selectedOperator, copy, renderPill)
        },
        {
          label: copy.tenantMemberships,
          value: renderTenantMemberships(selectedOperator, copy)
        },
        {
          label: "User ID",
          value: `<span class="mono">${escapeHtml(selectedOperator.userId)}</span>`
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
  </article>`;
}

function renderCreateOperatorPanel(copy: WebCopy, currentPath: string): string {
  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.operatorCreateTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.operatorCreateDescription)}</p>
      </div>
    </div>
    <form method="post" action="/actions/operators/create" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(currentPath)}" />
      <div class="form-grid">
        <label>
          <span>${escapeHtml(copy.operatorEmailLabel)}</span>
          <input name="email" type="email" required autocomplete="username" spellcheck="false" class="mono" />
        </label>
        <label>
          <span>${escapeHtml(copy.operatorDisplayNameLabel)}</span>
          <input name="displayName" required autocomplete="name" />
        </label>
        <label>
          <span>${escapeHtml(copy.operatorPasswordLabel)}</span>
          <input name="password" type="password" required autocomplete="new-password" />
        </label>
        <label>
          <span>${escapeHtml(copy.operatorGlobalRoleLabel)}</span>
          <select name="globalRole">
            <option value="platform_operator" selected>${escapeHtml(copy.operatorRolePlatformOperator)}</option>
            <option value="platform_admin">${escapeHtml(copy.operatorRolePlatformAdmin)}</option>
          </select>
        </label>
      </div>
      <div class="toolbar">
        <button type="submit">${escapeHtml(copy.operatorCreateAction)}</button>
      </div>
    </form>
  </article>`;
}

function renderOperatorCreationPanel(args: {
  copy: WebCopy;
  currentPath: string;
  currentUserIsAdmin: boolean;
}): string {
  const { copy, currentPath, currentUserIsAdmin } = args;

  if (currentUserIsAdmin) {
    return renderCreateOperatorPanel(copy, currentPath);
  }

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.operatorAdminRequiredTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.operatorAdminRequiredDescription)}</p>
      </div>
    </div>
  </article>`;
}

export function renderOperatorsWorkspace(args: {
  copy: WebCopy;
  data: DashboardData;
  currentPath: string;
  focus?: string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
  renderSignalStrip: (
    items: Array<{
      label: string;
      value: string;
      tone?: "default" | "success" | "danger" | "muted";
    }>
  ) => string;
}): string {
  const {
    copy,
    data,
    currentPath,
    focus,
    renderFocusLink,
    renderPill,
    renderSignalStrip
  } = args;
  const operators = data.users;
  const currentUserIsAdmin = data.currentUser.globalRoles.includes("platform_admin");
  const selectedOperator = selectOperator(operators, focus);
  const activeCount = operators.filter((operator) => operator.status === "active").length;
  const adminCount = operators.filter((operator) =>
    operator.globalRoles.includes("platform_admin")
  ).length;
  const operatorCount = operators.filter((operator) =>
    operator.globalRoles.includes("platform_operator")
  ).length;
  const rows = buildOperatorRows({
    copy,
    operators,
    selectedOperator,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-operators-table",
    heading: copy.operatorsInventoryTitle,
    description: copy.operatorsInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.operatorEmailLabel, className: "mono table-col-operator-email" },
      { label: copy.operatorDisplayNameLabel, className: "table-col-operator-name" },
      { label: copy.operatorStatusLabel, className: "table-col-operator-status" },
      { label: copy.globalRoles, className: "table-col-operator-roles" },
      { label: copy.tenantMemberships, className: "table-col-operator-tenants" }
    ],
    rows,
    emptyMessage: copy.noOperators,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-operators" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.navOperators, value: String(operators.length), tone: operators.length > 0 ? "success" : "muted" },
      { label: copy.activeOperators, value: String(activeCount), tone: activeCount > 0 ? "success" : "danger" },
      { label: copy.adminOperators, value: String(adminCount), tone: adminCount > 0 ? "danger" : "muted" },
      { label: copy.operatorRolePlatformOperator, value: String(operatorCount), tone: operatorCount > 0 ? "success" : "muted" }
    ])}
    ${table}
    <div class="grid-two-desktop">
      ${renderSelectedOperatorPanel({
        copy,
        selectedOperator,
        renderPill
      })}
      ${renderOperatorCreationPanel({
        copy,
        currentPath,
        currentUserIsAdmin
      })}
    </div>
  </section>`;
}
