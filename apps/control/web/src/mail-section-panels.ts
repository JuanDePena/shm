import { escapeHtml, renderDataTable, type DataTableRow } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import {
  type LocalizedMailCopy,
  type MailSectionCopy,
  type MailSectionModel,
  type MailSectionRenderers
} from "./mail-section-types.js";
import { type WebLocale } from "./request.js";

export function renderMailSectionContent(args: {
  copy: MailSectionCopy;
  data: DashboardData;
  locale: WebLocale;
  mailCopy: LocalizedMailCopy;
  model: MailSectionModel;
  renderers: MailSectionRenderers;
  returnTo: string;
}): string {
  const { copy, data, locale, mailCopy, model, renderers, returnTo } = args;
  const {
    mailDomainOptions,
    healthyMailRuntimeCount,
    mailRuntimeNodes,
    nodeOptions,
    reportedMailRuntimeCount,
    selectedAlias,
    selectedAliasDefaults,
    selectedDomain,
    selectedDomainDefaults,
    selectedMailbox,
    selectedMailboxDefaults,
    tenantOptions,
    zoneOptions
  } = model;

  const formatStorageBytes = (value: number | undefined): string => {
    if (value === undefined || value <= 0) {
      return copy.none;
    }

    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    let normalized = value;
    let unitIndex = 0;

    while (normalized >= 1024 && unitIndex < units.length - 1) {
      normalized /= 1024;
      unitIndex += 1;
    }

    return `${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: normalized >= 10 || unitIndex === 0 ? 0 : 1
    }).format(normalized)} ${units[unitIndex]}`;
  };

  const primaryMailNodeIds = new Set(data.mail.domains.map((domain) => domain.primaryNodeId));
  const standbyMailNodeIds = new Set(
    data.mail.domains
      .map((domain) => domain.standbyNodeId)
      .filter((nodeId): nodeId is string => Boolean(nodeId))
  );

  const renderServiceStatus = (
    snapshot:
      | {
          postfixEnabled?: boolean;
          postfixActive?: boolean;
          dovecotEnabled?: boolean;
          dovecotActive?: boolean;
          rspamdEnabled?: boolean;
          rspamdActive?: boolean;
          redisEnabled?: boolean;
          redisActive?: boolean;
        }
      | undefined,
    serviceName: "postfix" | "dovecot" | "rspamd" | "redis"
  ): string => {
    if (!snapshot) {
      return renderers.renderPill(mailCopy.runtimeUnreported, "muted");
    }

    const enabled =
      serviceName === "postfix"
        ? snapshot.postfixEnabled
        : serviceName === "dovecot"
          ? snapshot.dovecotEnabled
          : serviceName === "rspamd"
            ? snapshot.rspamdEnabled
            : snapshot.redisEnabled;
    const active =
      serviceName === "postfix"
        ? snapshot.postfixActive
        : serviceName === "dovecot"
          ? snapshot.dovecotActive
          : serviceName === "rspamd"
            ? snapshot.rspamdActive
            : snapshot.redisActive;

    if (active) {
      return renderers.renderPill(mailCopy.serviceActive, "success");
    }

    if (enabled) {
      return renderers.renderPill(mailCopy.serviceInactive, "danger");
    }

    return renderers.renderPill(mailCopy.serviceDisabled, "muted");
  };

  const domainRows: DataTableRow[] = data.mail.domains.map((domain) => ({
    selectionKey: domain.domainName,
    selected: selectedDomain?.domainName === domain.domainName,
    cells: [
      renderers.renderFocusLink(
        domain.domainName,
        buildDashboardViewUrl("mail", undefined, domain.domainName),
        selectedDomain?.domainName === domain.domainName,
        copy.selectedStateLabel
      ),
      escapeHtml(domain.tenantSlug),
      escapeHtml(domain.zoneName),
      `<span class="mono">${escapeHtml(domain.mailHost)}</span>`,
      `<span class="mono">${escapeHtml(domain.primaryNodeId)}</span>`,
      renderers.renderPill(
        String(domain.mailboxCount),
        domain.mailboxCount > 0 ? "success" : "muted"
      ),
      renderers.renderPill(
        String(domain.aliasCount),
        domain.aliasCount > 0 ? "success" : "muted"
      ),
      renderRowActionButtons(
        `mail-domain-edit-${toModalIdSegment(domain.domainName)}`,
        `mail-domain-delete-${toModalIdSegment(domain.domainName)}`
      )
    ],
    searchText: [
      domain.domainName,
      domain.tenantSlug,
      domain.zoneName,
      domain.mailHost,
      domain.primaryNodeId,
      domain.standbyNodeId ?? "",
      domain.dkimSelector
    ].join(" ")
  }));

  const mailboxRows: DataTableRow[] = data.mail.mailboxes.map((mailbox) => ({
    selectionKey: mailbox.address,
    selected: selectedMailbox?.address === mailbox.address,
    cells: [
      renderers.renderFocusLink(
        mailbox.address,
        buildDashboardViewUrl("mail", undefined, mailbox.address),
        selectedMailbox?.address === mailbox.address,
        copy.selectedStateLabel
      ),
      `<span class="mono">${escapeHtml(mailbox.primaryNodeId)}</span>`,
      mailbox.hasCredential
        ? renderers.renderPill(mailCopy.credentialPresent, "success")
        : renderers.renderPill(mailCopy.credentialMissing, "danger"),
      mailbox.quotaBytes
        ? `<span class="mono">${escapeHtml(formatStorageBytes(mailbox.quotaBytes))}</span>`
        : escapeHtml(copy.none),
      renderRowActionButtons(
        `mail-mailbox-edit-${toModalIdSegment(mailbox.address)}`,
        `mail-mailbox-delete-${toModalIdSegment(mailbox.address)}`
      )
    ],
    searchText: [
      mailbox.address,
      mailbox.domainName,
      mailbox.localPart,
      mailbox.primaryNodeId,
      mailbox.standbyNodeId ?? "",
      mailbox.hasCredential ? "present" : "missing",
      String(mailbox.quotaBytes ?? "")
    ].join(" ")
  }));

  const aliasRows: DataTableRow[] = data.mail.aliases.map((alias) => ({
    selectionKey: alias.address,
    selected: selectedAlias?.address === alias.address,
    cells: [
      renderers.renderFocusLink(
      alias.address,
      buildDashboardViewUrl("mail", undefined, alias.address),
      selectedAlias?.address === alias.address,
      copy.selectedStateLabel
    ),
      `<span class="mono">${escapeHtml(alias.destinations.join(", "))}</span>`,
      renderRowActionButtons(
        `mail-alias-edit-${toModalIdSegment(alias.address)}`,
        `mail-alias-delete-${toModalIdSegment(alias.address)}`
      )
    ],
    searchText: [alias.address, alias.domainName, alias.localPart, ...alias.destinations].join(" ")
  }));

  const runtimeRows: DataTableRow[] = mailRuntimeNodes.map((node) => ({
    selectionKey: node.nodeId,
    cells: [
      `<div class="mail-node-runtime-cell">
        <div class="mail-node-runtime-head">
          <strong>${escapeHtml(node.hostname)}</strong>
          ${
            primaryMailNodeIds.has(node.nodeId)
              ? renderers.renderPill(mailCopy.primaryRoleLabel, "success")
              : ""
          }
          ${
            standbyMailNodeIds.has(node.nodeId)
              ? renderers.renderPill(mailCopy.secondaryRoleLabel, "muted")
              : ""
          }
        </div>
      </div>`,
      renderServiceStatus(node.mail, "postfix"),
      renderServiceStatus(node.mail, "dovecot"),
      renderServiceStatus(node.mail, "rspamd"),
      renderServiceStatus(node.mail, "redis"),
      node.mail
        ? renderers.renderPill(
            String(node.mail.managedDomains.length),
            node.mail.managedDomains.length > 0 ? "success" : "muted"
          )
        : renderers.renderPill(mailCopy.runtimeUnreported, "muted"),
      node.mail?.checkedAt
        ? escapeHtml(renderers.formatDate(node.mail.checkedAt, locale))
        : escapeHtml(copy.none)
    ],
    searchText: [
      node.nodeId,
      node.hostname,
      ...(node.mail?.managedDomains.map((domain) => domain.domainName) ?? []),
      node.mail?.checkedAt ?? ""
    ].join(" ")
  }));

  const selectedDomainPanel = `<article class="panel detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(mailCopy.selectedDomainTitle)}</h3>
          <p class="muted section-description">${escapeHtml(mailCopy.description)}</p>
        </div>
      </div>
      ${
        selectedDomain
          ? renderers.renderDetailGrid([
              {
                label: mailCopy.domainNameLabel,
                value: `<span class="mono">${escapeHtml(selectedDomain.domainName)}</span>`
              },
              { label: mailCopy.tenantSlugLabel, value: escapeHtml(selectedDomain.tenantSlug) },
              { label: mailCopy.zoneNameLabel, value: escapeHtml(selectedDomain.zoneName) },
              {
                label: mailCopy.mailHostLabel,
                value: `<span class="mono">${escapeHtml(selectedDomain.mailHost)}</span>`
              },
              {
                label: mailCopy.webmailHostnameLabel,
                value: `<span class="mono">${escapeHtml(`webmail.${selectedDomain.domainName}`)}</span>`
              },
              {
                label: mailCopy.dkimSelectorLabel,
                value: `<span class="mono">${escapeHtml(selectedDomain.dkimSelector)}</span>`
              },
              {
                label: mailCopy.mailboxCountLabel,
                value: renderers.renderPill(
                  String(selectedDomain.mailboxCount),
                  selectedDomain.mailboxCount > 0 ? "success" : "muted"
                )
              },
              {
                label: mailCopy.aliasCountLabel,
                value: renderers.renderPill(
                  String(selectedDomain.aliasCount),
                  selectedDomain.aliasCount > 0 ? "success" : "muted"
                )
              }
            ], { className: "detail-grid-three" })
          : `<div class="detail-grid detail-grid-compact">
              <dl class="detail-item detail-item-span-full">
                <dt>${escapeHtml(mailCopy.selectedRecordLabel)}</dt>
                <dd class="muted">${escapeHtml(mailCopy.noSelectionLabel)}</dd>
              </dl>
            </div>`
      }
    </article>`;

  const renderModalShell = (
    modalId: string,
    title: string,
    description: string,
    body: string
  ): string => `<div class="proxy-vhost-modal" id="${escapeHtml(modalId)}" data-overlay-modal hidden>
      <div class="proxy-vhost-modal-backdrop" data-overlay-close></div>
      <div class="proxy-vhost-modal-dialog overlay-form-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="${escapeHtml(modalId)}-title">
        <article class="panel proxy-vhost-modal-panel overlay-form-modal-panel stack">
          <div class="proxy-vhost-modal-header">
            <div class="stack">
              <h3 id="${escapeHtml(modalId)}-title">${escapeHtml(title)}</h3>
              <p class="muted section-description">${escapeHtml(description)}</p>
            </div>
            <button type="button" class="secondary proxy-vhost-modal-close" data-overlay-close>${escapeHtml(
              mailCopy.closeLabel
            )}</button>
          </div>
          ${body}
        </article>
      </div>
    </div>`;

  function toModalIdSegment(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  }

  function renderHeaderCreateButton(modalId: string): string {
    return `<button type="button" class="header-create-action" data-overlay-trigger data-modal-id="${escapeHtml(
      modalId
    )}">${escapeHtml(mailCopy.createLabel)}</button>`;
  }

  function renderRowActionButtons(editModalId: string, deleteModalId: string): string {
    return `<div class="table-row-actions">
      <button type="button" class="secondary" data-overlay-trigger data-modal-id="${escapeHtml(
        editModalId
      )}">${escapeHtml(mailCopy.editLabel)}</button>
      <button type="button" class="danger" data-overlay-trigger data-modal-id="${escapeHtml(
        deleteModalId
      )}">${escapeHtml(mailCopy.deleteLabel)}</button>
    </div>`;
  }

  const createDomainDefaults = {
    domainName: "",
    tenantSlug: tenantOptions[0]?.value ?? selectedDomainDefaults.tenantSlug,
    zoneName: zoneOptions[0]?.value ?? selectedDomainDefaults.zoneName,
    primaryNodeId: nodeOptions[0]?.value ?? selectedDomainDefaults.primaryNodeId,
    standbyNodeId: "",
    mailHost: "",
    dkimSelector: "mail"
  };

  const createMailboxDefaults = {
    address: "",
    domainName: mailDomainOptions[0]?.value ?? selectedMailboxDefaults.domainName,
    localPart: "",
    primaryNodeId: nodeOptions[0]?.value ?? selectedMailboxDefaults.primaryNodeId,
    standbyNodeId: "",
    quotaBytes: undefined as number | undefined
  };

  const createAliasDefaults = {
    address: "",
    domainName: mailDomainOptions[0]?.value ?? selectedAliasDefaults.domainName,
    localPart: "",
    destinations: [] as string[]
  };

  const renderDomainEditorForm = (
    defaults: {
      domainName: string;
      tenantSlug: string;
      zoneName: string;
      primaryNodeId: string;
      standbyNodeId?: string;
      mailHost: string;
      dkimSelector: string;
    },
    autofocus = false
  ): string => `<form method="post" action="/resources/mail/domains/upsert" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
      <div class="form-grid">
        <label>${escapeHtml(mailCopy.domainNameLabel)}
          <input name="domainName" value="${escapeHtml(defaults.domainName)}" required spellcheck="false"${autofocus ? " data-overlay-autofocus" : ""} />
        </label>
        <label>${escapeHtml(mailCopy.tenantSlugLabel)}
          <select name="tenantSlug" required>${renderers.renderSelectOptions(tenantOptions, defaults.tenantSlug)}</select>
        </label>
        <label>${escapeHtml(mailCopy.zoneNameLabel)}
          <select name="zoneName" required>${renderers.renderSelectOptions(zoneOptions, defaults.zoneName)}</select>
        </label>
        <label>${escapeHtml(mailCopy.primaryNodeLabel)}
          <select name="primaryNodeId" required>${renderers.renderSelectOptions(nodeOptions, defaults.primaryNodeId)}</select>
        </label>
        <label>${escapeHtml(mailCopy.standbyNodeLabel)}
          <select name="standbyNodeId">${renderers.renderSelectOptions(nodeOptions, defaults.standbyNodeId || undefined, { allowBlank: true, blankLabel: "none" })}</select>
        </label>
        <label>${escapeHtml(mailCopy.mailHostLabel)}
          <input name="mailHost" value="${escapeHtml(defaults.mailHost)}" required spellcheck="false" />
        </label>
        <label>${escapeHtml(mailCopy.dkimSelectorLabel)}
          <input name="dkimSelector" value="${escapeHtml(defaults.dkimSelector)}" required spellcheck="false" />
        </label>
      </div>
      <div class="toolbar">
        <button type="submit">${escapeHtml(mailCopy.saveDomainLabel)}</button>
      </div>
    </form>`;

  const renderMailboxEditorForm = (
    defaults: {
      address: string;
      domainName: string;
      localPart: string;
      primaryNodeId: string;
      standbyNodeId?: string;
      quotaBytes?: number;
    },
    autofocus = false
  ): string => `<form method="post" action="/resources/mail/mailboxes/upsert" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
      <div class="form-grid">
        <label>${escapeHtml(mailCopy.addressLabel)}
          <input name="address" value="${escapeHtml(defaults.address)}" required spellcheck="false"${autofocus ? " data-overlay-autofocus" : ""} />
        </label>
        <label>${escapeHtml(mailCopy.domainNameLabel)}
          <select name="domainName" required>${renderers.renderSelectOptions(mailDomainOptions, defaults.domainName)}</select>
        </label>
        <label>${escapeHtml(mailCopy.localPartLabel)}
          <input name="localPart" value="${escapeHtml(defaults.localPart)}" required spellcheck="false" />
        </label>
        <label>${escapeHtml(mailCopy.primaryNodeLabel)}
          <select name="primaryNodeId" required>${renderers.renderSelectOptions(nodeOptions, defaults.primaryNodeId)}</select>
        </label>
        <label>${escapeHtml(mailCopy.standbyNodeLabel)}
          <select name="standbyNodeId">${renderers.renderSelectOptions(nodeOptions, defaults.standbyNodeId || undefined, { allowBlank: true, blankLabel: "none" })}</select>
        </label>
        <label>${escapeHtml(mailCopy.desiredPasswordLabel)}
          <input name="desiredPassword" type="password" value="" autocomplete="new-password" />
        </label>
        <label>${escapeHtml(mailCopy.quotaBytesLabel)}
          <input name="storageBytes" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(
            defaults.quotaBytes ? String(defaults.quotaBytes) : ""
          )}" />
        </label>
      </div>
      <div class="toolbar">
        <button type="submit">${escapeHtml(mailCopy.saveMailboxLabel)}</button>
      </div>
    </form>`;

  const renderAliasEditorForm = (
    defaults: {
      address: string;
      domainName: string;
      localPart: string;
      destinations: string[];
    },
    autofocus = false
  ): string => `<form method="post" action="/resources/mail/aliases/upsert" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
      <div class="form-grid">
        <label>${escapeHtml(mailCopy.addressLabel)}
          <input name="address" value="${escapeHtml(defaults.address)}" required spellcheck="false"${autofocus ? " data-overlay-autofocus" : ""} />
        </label>
        <label>${escapeHtml(mailCopy.domainNameLabel)}
          <select name="domainName" required>${renderers.renderSelectOptions(mailDomainOptions, defaults.domainName)}</select>
        </label>
        <label>${escapeHtml(mailCopy.localPartLabel)}
          <input name="localPart" value="${escapeHtml(defaults.localPart)}" required spellcheck="false" />
        </label>
        <label>${escapeHtml(mailCopy.destinationsLabel)}
          <textarea name="destinations" rows="3">${escapeHtml(defaults.destinations.join(", "))}</textarea>
        </label>
      </div>
      <div class="toolbar">
        <button type="submit">${escapeHtml(mailCopy.saveAliasLabel)}</button>
      </div>
    </form>`;

  const domainCreateModalId = "mail-domain-create-modal";
  const mailboxCreateModalId = "mail-mailbox-create-modal";
  const aliasCreateModalId = "mail-alias-create-modal";

  const renderDeleteModal = (
    modalId: string | undefined,
    title: string,
    description: string,
    action: string,
    hiddenFieldName: string,
    hiddenFieldValue: string | undefined,
    submitLabel: string
  ): string => {
    if (!modalId || !hiddenFieldValue) {
      return "";
    }

    return renderModalShell(
      modalId,
      title,
      description,
      `<div class="action-card-context">
        <span class="action-card-context-title">${escapeHtml(mailCopy.selectedRecordLabel)}</span>
        <p class="mono">${escapeHtml(hiddenFieldValue)}</p>
      </div>
      <form method="post" action="${escapeHtml(action)}" class="stack">
        <input type="hidden" name="${escapeHtml(hiddenFieldName)}" value="${escapeHtml(hiddenFieldValue)}" />
        <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
        <div class="toolbar">
          <button class="danger" type="submit">${escapeHtml(submitLabel)}</button>
        </div>
      </form>`
    );
  };
  const domainRowModals = data.mail.domains
    .map((domain) => {
      const editModalId = `mail-domain-edit-${toModalIdSegment(domain.domainName)}`;
      const deleteModalId = `mail-domain-delete-${toModalIdSegment(domain.domainName)}`;

      return [
        renderModalShell(
          editModalId,
          mailCopy.domainsTitle,
          mailCopy.modalEditorDescription,
          renderDomainEditorForm(
            {
              domainName: domain.domainName,
              tenantSlug: domain.tenantSlug,
              zoneName: domain.zoneName,
              primaryNodeId: domain.primaryNodeId,
              standbyNodeId: domain.standbyNodeId ?? "",
              mailHost: domain.mailHost,
              dkimSelector: domain.dkimSelector
            },
            true
          )
        ),
        renderDeleteModal(
          deleteModalId,
          mailCopy.deleteDomainLabel,
          mailCopy.modalDeleteDescription,
          "/resources/mail/domains/delete",
          "domainName",
          domain.domainName,
          mailCopy.deleteDomainLabel
        )
      ].join("");
    })
    .join("");

  const mailboxRowModals = data.mail.mailboxes
    .map((mailbox) => {
      const editModalId = `mail-mailbox-edit-${toModalIdSegment(mailbox.address)}`;
      const deleteModalId = `mail-mailbox-delete-${toModalIdSegment(mailbox.address)}`;

      return [
        renderModalShell(
          editModalId,
          mailCopy.mailboxesTitle,
          mailCopy.modalEditorDescription,
          renderMailboxEditorForm(
            {
              address: mailbox.address,
              domainName: mailbox.domainName,
              localPart: mailbox.localPart,
              primaryNodeId: mailbox.primaryNodeId,
              standbyNodeId: mailbox.standbyNodeId ?? "",
              quotaBytes: mailbox.quotaBytes
            },
            true
          )
        ),
        renderDeleteModal(
          deleteModalId,
          mailCopy.deleteMailboxLabel,
          mailCopy.modalDeleteDescription,
          "/resources/mail/mailboxes/delete",
          "address",
          mailbox.address,
          mailCopy.deleteMailboxLabel
        )
      ].join("");
    })
    .join("");

  const aliasRowModals = data.mail.aliases
    .map((alias) => {
      const editModalId = `mail-alias-edit-${toModalIdSegment(alias.address)}`;
      const deleteModalId = `mail-alias-delete-${toModalIdSegment(alias.address)}`;

      return [
        renderModalShell(
          editModalId,
          mailCopy.aliasesTitle,
          mailCopy.modalEditorDescription,
          renderAliasEditorForm(
            {
              address: alias.address,
              domainName: alias.domainName,
              localPart: alias.localPart,
              destinations: alias.destinations
            },
            true
          )
        ),
        renderDeleteModal(
          deleteModalId,
          mailCopy.deleteAliasLabel,
          mailCopy.modalDeleteDescription,
          "/resources/mail/aliases/delete",
          "address",
          alias.address,
          mailCopy.deleteAliasLabel
        )
      ].join("");
    })
    .join("");

  const mailModals = [
    renderModalShell(
      domainCreateModalId,
      mailCopy.domainsTitle,
      mailCopy.modalEditorDescription,
      renderDomainEditorForm(createDomainDefaults, true)
    ),
    renderModalShell(
      mailboxCreateModalId,
      mailCopy.mailboxesTitle,
      mailCopy.modalEditorDescription,
      renderMailboxEditorForm(createMailboxDefaults, true)
    ),
    renderModalShell(
      aliasCreateModalId,
      mailCopy.aliasesTitle,
      mailCopy.modalEditorDescription,
      renderAliasEditorForm(createAliasDefaults, true)
    ),
    domainRowModals,
    mailboxRowModals,
    aliasRowModals
  ].join("");

  return `<section id="section-mail" class="panel section-panel">
    <div class="section-head">
      <div>
        <h2>${escapeHtml(mailCopy.title)}</h2>
        <p class="muted section-description">${escapeHtml(mailCopy.description)}</p>
      </div>
    </div>
    ${renderers.renderSignalStrip([
      {
        label: mailCopy.domainCountLabel,
        value: String(data.mail.domains.length),
        tone: data.mail.domains.length > 0 ? "success" : "muted"
      },
      {
        label: mailCopy.mailboxTotalLabel,
        value: String(data.mail.mailboxes.length),
        tone: data.mail.mailboxes.length > 0 ? "success" : "muted"
      },
      {
        label: mailCopy.aliasTotalLabel,
        value: String(data.mail.aliases.length),
        tone: data.mail.aliases.length > 0 ? "success" : "muted"
      },
      {
        label: mailCopy.runtimeNodesLabel,
        value: String(reportedMailRuntimeCount),
        tone: reportedMailRuntimeCount > 0 ? "success" : "muted"
      },
      {
        label: mailCopy.runtimeHealthyLabel,
        value: String(healthyMailRuntimeCount),
        tone: healthyMailRuntimeCount > 0 ? "success" : "muted"
      }
    ])}
    ${renderDataTable({
      id: "section-mail-domains",
      heading: mailCopy.domainsTitle,
      description: mailCopy.description,
      headingBadgeClassName: "section-badge-lime",
      headerActionsHtml: renderHeaderCreateButton(domainCreateModalId),
      restoreSelectionHref: true,
      columns: [
        { label: mailCopy.domainNameLabel, className: "mono" },
        { label: mailCopy.tenantSlugLabel },
        { label: mailCopy.zoneNameLabel },
        { label: mailCopy.mailHostLabel },
        { label: mailCopy.primaryNodeLabel },
        { label: mailCopy.mailboxCountLabel },
        { label: mailCopy.aliasCountLabel },
        { label: mailCopy.actionsLabel }
      ],
      rows: domainRows,
      emptyMessage: mailCopy.noMailDomains,
      filterPlaceholder: copy.dataFilterPlaceholder,
      rowsPerPageLabel: copy.rowsPerPage,
      showingLabel: copy.showing,
      ofLabel: copy.of,
      recordsLabel: copy.records,
      defaultPageSize: 10
    })}
    <div class="grid-two-desktop">
      ${selectedDomainPanel}
      ${renderDataTable({
        id: "section-mail-runtime",
        heading: mailCopy.runtimeTitle,
        description: mailCopy.runtimeDescription,
        headingBadgeClassName: "section-badge-lime",
        columns: [
          { label: copy.navNodes, className: "mono" },
          { label: mailCopy.postfixLabel },
          { label: mailCopy.dovecotLabel },
          { label: mailCopy.rspamdLabel },
          { label: mailCopy.redisLabel },
          { label: mailCopy.managedDomainsLabel },
          { label: mailCopy.checkedAtLabel }
        ],
        rows: runtimeRows,
        emptyMessage: mailCopy.noRuntimeNodes,
        filterPlaceholder: copy.dataFilterPlaceholder,
        rowsPerPageLabel: copy.rowsPerPage,
        showingLabel: copy.showing,
        ofLabel: copy.of,
        recordsLabel: copy.records,
        defaultPageSize: 10
      })}
    </div>
    <div class="grid-two-desktop">
      ${renderDataTable({
        id: "section-mail-mailboxes",
        heading: mailCopy.mailboxesTitle,
        description: mailCopy.formsDescription,
        headingBadgeClassName: "section-badge-lime",
        headerActionsHtml: renderHeaderCreateButton(mailboxCreateModalId),
        columns: [
          { label: mailCopy.addressLabel, className: "mono" },
          { label: mailCopy.primaryNodeLabel },
          { label: mailCopy.hasCredentialLabel },
          { label: mailCopy.quotaBytesLabel, className: "mono" },
          { label: mailCopy.actionsLabel }
        ],
        rows: mailboxRows,
        emptyMessage: mailCopy.noMailboxes,
        filterPlaceholder: copy.dataFilterPlaceholder,
        rowsPerPageLabel: copy.rowsPerPage,
        showingLabel: copy.showing,
        ofLabel: copy.of,
        recordsLabel: copy.records,
        defaultPageSize: 10
      })}
      ${renderDataTable({
        id: "section-mail-aliases",
        heading: mailCopy.aliasesTitle,
        description: mailCopy.description,
        headingBadgeClassName: "section-badge-lime",
        headerActionsHtml: renderHeaderCreateButton(aliasCreateModalId),
        columns: [
          { label: mailCopy.addressLabel, className: "mono" },
          { label: mailCopy.destinationsLabel, className: "mono" },
          { label: mailCopy.actionsLabel }
        ],
        rows: aliasRows,
        emptyMessage: mailCopy.noAliases,
        filterPlaceholder: copy.dataFilterPlaceholder,
        rowsPerPageLabel: copy.rowsPerPage,
        showingLabel: copy.showing,
        ofLabel: copy.of,
        recordsLabel: copy.records,
        defaultPageSize: 10
      })}
    </div>
    ${mailModals}
  </section>`;
}
