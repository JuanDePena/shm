import type {
  DesiredStateMailPolicyInput,
  MailDeliveryFailureSnapshot,
  MailQueueSnapshot,
  MailServiceSnapshot
} from "@simplehost/control-contracts";
import { createDefaultMailPolicy } from "@simplehost/control-contracts";
import { escapeHtml, renderDataTable, type DataTableRow } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { findRelatedAuditEvents, findRelatedJobs } from "./dashboard-panels.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import {
  buildMailObservabilityModel,
  toneForMailObservabilityStatus,
  type MailHaNodeRow
} from "./mail-observability.js";
import {
  type MailCredentialRevealViewModel,
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
  mailCredentialReveal?: MailCredentialRevealViewModel;
  mailCopy: LocalizedMailCopy;
  model: MailSectionModel;
  renderers: MailSectionRenderers;
  returnTo: string;
}): string {
  const { copy, data, locale, mailCredentialReveal, mailCopy, model, renderers, returnTo } = args;
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
  const observability = buildMailObservabilityModel(data);
  const mailPolicy = data.mail.policy ?? createDefaultMailPolicy();

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

  const renderCredentialState = (
    credentialState: DashboardData["mail"]["mailboxes"][number]["credentialState"]
  ): string => {
    if (credentialState === "configured") {
      return renderers.renderPill(mailCopy.credentialConfigured, "success");
    }

    if (credentialState === "reset_required") {
      return renderers.renderPill(mailCopy.credentialResetRequired, "danger");
    }

    return renderers.renderPill(mailCopy.credentialMissing, "muted");
  };

  const formatObservabilityStatus = (
    status: Parameters<typeof toneForMailObservabilityStatus>[0]
  ): string => {
    const label = labelForObservabilityStatus(status);

    return renderers.renderPill(label, toneForMailObservabilityStatus(status));
  };

  const labelForObservabilityStatus = (
    status: Parameters<typeof toneForMailObservabilityStatus>[0]
  ): string =>
    status === "ready"
      ? mailCopy.observabilityReady
      : status === "warning"
        ? mailCopy.observabilityWarning
        : status === "missing"
          ? mailCopy.observabilityMissing
          : mailCopy.observabilityUnreported;

  const renderQueueStatus = (
    queue: MailQueueSnapshot | undefined
  ): string => {
    if (!queue) {
      return renderers.renderPill(mailCopy.runtimeUnreported, "muted");
    }

    return renderers.renderPill(
      String(queue.messageCount),
      queue.deferredCount > 0 ? "danger" : queue.messageCount > 0 ? "default" : "success"
    );
  };

  const renderPolicyDocumentStatus = (
    snapshot: MailServiceSnapshot | undefined
  ): string => {
    if (!snapshot) {
      return renderers.renderPill(mailCopy.runtimeUnreported, "muted");
    }

    const total = snapshot.policyDocumentCount ?? snapshot.managedDomains.length;
    const healthy = snapshot.healthyPolicyDocumentCount ?? 0;

    return renderers.renderPill(
      `${healthy}/${total}`,
      total > 0 && healthy === total ? "success" : healthy > 0 ? "default" : "danger"
    );
  };

  const renderWebmailStatus = (
    snapshot: MailServiceSnapshot | undefined
  ): string => {
    if (!snapshot) {
      return renderers.renderPill(mailCopy.runtimeUnreported, "muted");
    }

    if (snapshot.webmailHealthy) {
      return renderers.renderPill(mailCopy.observabilityReady, "success");
    }

    if (snapshot.roundcubeDeployment === "packaged") {
      return renderers.renderPill(mailCopy.observabilityWarning, "default");
    }

    return renderers.renderPill(mailCopy.observabilityMissing, "danger");
  };

  const renderFailureStatus = (
    failures: MailDeliveryFailureSnapshot[] | undefined
  ): string => {
    if (!failures) {
      return renderers.renderPill(mailCopy.runtimeUnreported, "muted");
    }

    return renderers.renderPill(
      String(failures.length),
      failures.length > 0 ? "danger" : "success"
    );
  };

  const renderFailureFeed = (
    failures: MailDeliveryFailureSnapshot[] | undefined
  ): string => {
    if (!failures || failures.length === 0) {
      return `<p class="empty">${escapeHtml(mailCopy.noRecentFailures)}</p>`;
    }

    return `<div class="feed-list">
      ${failures
        .map(
          (failure) => `<article class="feed-item feed-item-danger">
            <strong>${escapeHtml(failure.status)}</strong>
            <span class="feed-meta">${escapeHtml(
              [
                failure.recipient ?? copy.none,
                failure.queueId ?? "",
                renderers.formatDate(failure.occurredAt, locale)
              ]
                .filter(Boolean)
                .join(" · ")
            )}</span>
            <p>${escapeHtml(failure.reason)}</p>
          </article>`
        )
        .join("")}
    </div>`;
  };

  const renderSenderPolicyList = (entries: string[]): string => {
    if (entries.length === 0) {
      return `<p class="empty">${escapeHtml(mailCopy.noSenderPolicyEntries)}</p>`;
    }

    return `<div class="feed-list">
      ${entries
        .map(
          (entry) => `<article class="feed-item">
            <strong class="mono">${escapeHtml(entry)}</strong>
          </article>`
        )
        .join("")}
    </div>`;
  };

  const formatRateLimit = (policy: DesiredStateMailPolicyInput): string =>
    policy.rateLimit
      ? `${policy.rateLimit.burst} / ${policy.rateLimit.periodSeconds}s`
      : mailCopy.rateLimitDisabledLabel;

  const renderPromotionBlockers = (blockers: string[]): string => {
    if (blockers.length === 0) {
      return `<p class="empty">${escapeHtml(mailCopy.noPromotionBlockers)}</p>`;
    }

    return `<div class="feed-list">
      ${blockers
        .map(
          (blocker) => `<article class="feed-item feed-item-danger">
            <p>${escapeHtml(blocker)}</p>
          </article>`
        )
        .join("")}
    </div>`;
  };

  const renderHaNodePanel = (node: MailHaNodeRow, title: string): string => `<article class="panel detail-shell panel-nested">
      <h4>${escapeHtml(title)}</h4>
      ${renderers.renderSignalStrip([
        {
          label: mailCopy.promotionReadyLabel,
          value: labelForObservabilityStatus(node.promotionReady.status),
          tone: toneForMailObservabilityStatus(node.promotionReady.status)
        },
        {
          label: mailCopy.runtimeConfigLabel,
          value: labelForObservabilityStatus(node.runtimeConfig.status),
          tone: toneForMailObservabilityStatus(node.runtimeConfig.status)
        },
        {
          label: mailCopy.maildirReadinessLabel,
          value: labelForObservabilityStatus(node.mailboxes.status),
          tone: toneForMailObservabilityStatus(node.mailboxes.status)
        }
      ])}
      ${renderers.renderDetailGrid(
        [
          {
            label: copy.navNodes,
            value: `<span class="mono">${escapeHtml(node.nodeId)}</span>`
          },
          {
            label: mailCopy.checkedAtLabel,
            value: node.checkedAt
              ? escapeHtml(renderers.formatDate(node.checkedAt, locale))
              : escapeHtml(copy.none)
          },
          {
            label: mailCopy.runtimeTitle,
            value: formatObservabilityStatus(node.services.status)
          },
          {
            label: mailCopy.runtimeConfigLabel,
            value: formatObservabilityStatus(node.runtimeConfig.status)
          },
          {
            label: mailCopy.maildirReadinessLabel,
            value: formatObservabilityStatus(node.mailboxes.status)
          },
          {
            label: mailCopy.dkimLabel,
            value: formatObservabilityStatus(node.dkim.status)
          },
          {
            label: mailCopy.policyDocsLabel,
            value: formatObservabilityStatus(node.policyDocuments.status)
          },
          {
            label: mailCopy.webmailLabel,
            value: formatObservabilityStatus(node.webmail.status)
          }
        ],
        { className: "detail-grid-two" }
      )}
      <article class="panel detail-shell panel-nested">
        <h5>${escapeHtml(mailCopy.promotionBlockersLabel)}</h5>
        ${renderPromotionBlockers(node.blockers)}
      </article>
    </article>`;

  const deliverabilityRows: DataTableRow[] = observability.deliverabilityRows.map((row) => ({
    selectionKey: row.domainName,
    selected: selectedDomain?.domainName === row.domainName,
    cells: [
      renderers.renderFocusLink(
        row.domainName,
        buildDashboardViewUrl("mail", undefined, row.domainName),
        selectedDomain?.domainName === row.domainName,
        copy.selectedStateLabel
      ),
      formatObservabilityStatus(row.spf.status),
      formatObservabilityStatus(row.dkim.status),
      formatObservabilityStatus(row.dmarc.status),
      formatObservabilityStatus(row.mtaSts.status),
      formatObservabilityStatus(row.tlsRpt.status),
      formatObservabilityStatus(row.runtime.status),
      row.checkedAt ? escapeHtml(renderers.formatDate(row.checkedAt, locale)) : escapeHtml(copy.none)
    ],
    searchText: [
      row.domainName,
      row.zoneName,
      row.primaryNodeId,
      row.spf.status,
      row.dkim.status,
      row.dmarc.status,
      row.mtaSts.status,
      row.tlsRpt.status,
      row.runtime.status
    ].join(" ")
  }));

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
      renderCredentialState(mailbox.credentialState),
      mailbox.quotaBytes
        ? `<span class="mono">${escapeHtml(formatStorageBytes(mailbox.quotaBytes))}</span>`
        : escapeHtml(copy.none),
      renderRowActionButtons(
        `mail-mailbox-edit-${toModalIdSegment(mailbox.address)}`,
        `mail-mailbox-delete-${toModalIdSegment(mailbox.address)}`,
        {
          rotateModalId: `mail-mailbox-rotate-${toModalIdSegment(mailbox.address)}`,
          resetModalId: `mail-mailbox-reset-${toModalIdSegment(mailbox.address)}`
        }
      )
    ],
    searchText: [
      mailbox.address,
      mailbox.domainName,
      mailbox.localPart,
      mailbox.primaryNodeId,
      mailbox.standbyNodeId ?? "",
      mailbox.credentialState,
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
      renderWebmailStatus(node.mail),
      renderPolicyDocumentStatus(node.mail),
      renderQueueStatus(node.mail?.queue),
      renderFailureStatus(node.mail?.recentDeliveryFailures),
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
      node.mail?.queue?.topDeferReasons.join(" ") ?? "",
      ...(node.mail?.recentDeliveryFailures?.map((failure) => failure.reason) ?? []),
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

  const selectedDeliverability = selectedDomain
    ? observability.deliverabilityRows.find((row) => row.domainName === selectedDomain.domainName)
    : undefined;
  const selectedHa = selectedDomain
    ? observability.haRows.find((row) => row.domainName === selectedDomain.domainName)
    : undefined;
  const selectedActivityScope = selectedMailbox?.address ?? selectedAlias?.address ?? selectedDomain?.domainName;
  const selectedRelatedJobs = selectedDomain
    ? findRelatedJobs(
        data.jobHistory,
        {
          resourceKeys: [
            `mail:${selectedDomain.primaryNodeId}`,
            `mail:${selectedDomain.domainName}:webmail:${selectedDomain.primaryNodeId}`,
            `mail:${selectedDomain.domainName}:mta-sts:${selectedDomain.primaryNodeId}`
          ],
          needles: [
            selectedDomain.domainName,
            selectedDomain.mailHost,
            selectedDomain.primaryNodeId,
            selectedMailbox?.address ?? "",
            selectedAlias?.address ?? ""
          ]
        },
        6
      )
    : [];
  const selectedRelatedAudits = selectedActivityScope
    ? findRelatedAuditEvents(
        data.auditEvents,
        [
          selectedActivityScope,
          selectedDomain?.domainName ?? "",
          selectedDomain?.mailHost ?? "",
          selectedDomain?.primaryNodeId ?? ""
        ],
        6
      )
    : [];
  const selectedLatestMailSyncJob = selectedDomain
    ? selectedRelatedJobs.find(
        (job) => job.kind === "mail.sync" && job.nodeId === selectedDomain.primaryNodeId
      )
    : undefined;
  const selectedRuntimeNode = selectedDomain
    ? mailRuntimeNodes.find((node) => node.nodeId === selectedDomain.primaryNodeId)
    : undefined;
  const selectedRuntimeFailures = selectedRuntimeNode?.mail?.recentDeliveryFailures;
  const selectedActivityPanel = `<article class="panel detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(mailCopy.activityTitle)}</h3>
          <p class="muted section-description">${escapeHtml(mailCopy.activityDescription)}</p>
        </div>
      </div>
      ${
        selectedDomain
          ? `${renderers.renderSignalStrip([
              {
                label: mailCopy.selectedRecordLabel,
                value: selectedActivityScope ?? selectedDomain.domainName,
                tone: "default"
              },
              {
                label: mailCopy.relatedJobsTitle,
                value: String(selectedRelatedJobs.length),
                tone: selectedRelatedJobs.length > 0 ? "success" : "muted"
              },
              {
                label: mailCopy.relatedAuditsTitle,
                value: String(selectedRelatedAudits.length),
                tone: selectedRelatedAudits.length > 0 ? "default" : "muted"
              }
            ])}
            ${renderers.renderDetailGrid(
              [
                {
                  label: mailCopy.latestMailSyncLabel,
                  value: selectedLatestMailSyncJob
                    ? `<a class="detail-link" href="${escapeHtml(
                        buildDashboardViewUrl("job-history", undefined, selectedLatestMailSyncJob.jobId)
                      )}">${escapeHtml(selectedLatestMailSyncJob.summary ?? selectedLatestMailSyncJob.jobId)}</a>`
                    : escapeHtml(copy.none)
                },
                {
                  label: mailCopy.openJobHistoryLabel,
                  value: `<a class="detail-link" href="${escapeHtml(
                    buildDashboardViewUrl("job-history", undefined, undefined, {
                      jobNode: selectedDomain.primaryNodeId
                    })
                  )}">${escapeHtml(mailCopy.openJobHistoryLabel)}</a>`
                },
                {
                  label: mailCopy.openAuditHistoryLabel,
                  value: `<a class="detail-link" href="${escapeHtml(
                    buildDashboardViewUrl("audit", undefined, undefined, {
                      auditEntity: selectedActivityScope ?? selectedDomain.domainName
                    })
                  )}">${escapeHtml(mailCopy.openAuditHistoryLabel)}</a>`
                },
                {
                  label: mailCopy.topDeferReasonLabel,
                  value: escapeHtml(selectedDeliverability?.topDeferReason ?? copy.none)
                }
              ],
              { className: "detail-grid-two" }
            )}
            <div class="grid-two-desktop">
              <article class="panel detail-shell panel-nested">
                <h4>${escapeHtml(mailCopy.relatedJobsTitle)}</h4>
                ${
                  selectedRelatedJobs.length === 0
                    ? `<p class="empty">${escapeHtml(copy.none)}</p>`
                    : `<div class="feed-list">
                        ${selectedRelatedJobs
                          .map(
                            (job) => `<article class="feed-item${
                              job.status === "failed"
                                ? " feed-item-danger"
                                : job.status === "applied"
                                  ? " feed-item-success"
                                  : ""
                            }">
                              <strong><a class="detail-link" href="${escapeHtml(
                                buildDashboardViewUrl("job-history", undefined, job.jobId)
                              )}">${escapeHtml(job.kind)}</a></strong>
                              <span class="feed-meta">${escapeHtml(
                                [job.jobId, job.status ?? "queued", renderers.formatDate(job.createdAt, locale)]
                                  .join(" · ")
                              )}</span>
                              <p>${escapeHtml(job.summary ?? job.dispatchReason ?? copy.none)}</p>
                            </article>`
                          )
                          .join("")}
                      </div>`
                }
              </article>
              <article class="panel detail-shell panel-nested">
                <h4>${escapeHtml(mailCopy.relatedAuditsTitle)}</h4>
                ${
                  selectedRelatedAudits.length === 0
                    ? `<p class="empty">${escapeHtml(copy.none)}</p>`
                    : `<div class="feed-list">
                        ${selectedRelatedAudits
                          .map(
                            (event) => `<article class="feed-item">
                              <strong>${escapeHtml(event.eventType)}</strong>
                              <span class="feed-meta">${escapeHtml(
                                [
                                  event.entityType && event.entityId
                                    ? `${event.entityType}:${event.entityId}`
                                    : event.entityType ?? event.entityId ?? copy.none,
                                  renderers.formatDate(event.occurredAt, locale)
                                ].join(" · ")
                              )}</span>
                              <p>${escapeHtml(
                                Object.keys(event.payload).length > 0
                                  ? JSON.stringify(event.payload)
                                  : copy.none
                              )}</p>
                            </article>`
                          )
                          .join("")}
                      </div>`
                }
              </article>
            </div>
            <article class="panel detail-shell panel-nested">
              <h4>${escapeHtml(mailCopy.recentFailuresLabel)}</h4>
              ${renderFailureFeed(selectedRuntimeFailures)}
            </article>`
          : `<p class="empty">${escapeHtml(mailCopy.noSelectionLabel)}</p>`
      }
    </article>`;
  const selectedObservabilityPanel = `<article class="panel detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(mailCopy.deliverabilityTitle)}</h3>
          <p class="muted section-description">${escapeHtml(mailCopy.deliverabilityDescription)}</p>
        </div>
      </div>
      ${
        selectedDeliverability
          ? `${renderers.renderSignalStrip([
              {
                label: mailCopy.spfLabel,
                value: labelForObservabilityStatus(selectedDeliverability.spf.status),
                tone: toneForMailObservabilityStatus(selectedDeliverability.spf.status)
              },
              {
                label: mailCopy.dkimLabel,
                value: labelForObservabilityStatus(selectedDeliverability.dkim.status),
                tone: toneForMailObservabilityStatus(selectedDeliverability.dkim.status)
              },
              {
                label: mailCopy.dmarcLabel,
                value: labelForObservabilityStatus(selectedDeliverability.dmarc.status),
                tone: toneForMailObservabilityStatus(selectedDeliverability.dmarc.status)
              },
              {
                label: mailCopy.mtaStsLabel,
                value: labelForObservabilityStatus(selectedDeliverability.mtaSts.status),
                tone: toneForMailObservabilityStatus(selectedDeliverability.mtaSts.status)
              },
              {
                label: mailCopy.tlsRptLabel,
                value: labelForObservabilityStatus(selectedDeliverability.tlsRpt.status),
                tone: toneForMailObservabilityStatus(selectedDeliverability.tlsRpt.status)
              }
            ])}
            ${renderers.renderDetailGrid(
              [
                {
                  label: mailCopy.runtimeTitle,
                  value: formatObservabilityStatus(selectedDeliverability.runtime.status)
                },
                {
                  label: mailCopy.webmailLabel,
                  value: formatObservabilityStatus(selectedDeliverability.webmail.status)
                },
                {
                  label: mailCopy.queuedMessagesLabel,
                  value: escapeHtml(
                    selectedDeliverability.queueMessageCount !== undefined
                      ? String(selectedDeliverability.queueMessageCount)
                      : copy.none
                  )
                },
                {
                  label: mailCopy.recentFailuresLabel,
                  value: escapeHtml(String(selectedDeliverability.recentFailureCount))
                },
                {
                  label: mailCopy.topDeferReasonLabel,
                  value: escapeHtml(selectedDeliverability.topDeferReason ?? copy.none),
                  className: "detail-item-span-two"
                }
              ],
              { className: "detail-grid-two" }
            )}`
          : `<p class="empty">${escapeHtml(mailCopy.noSelectionLabel)}</p>`
      }
    </article>`;
  const selectedHaPanel = `<article class="panel detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(mailCopy.haTitle)}</h3>
          <p class="muted section-description">${escapeHtml(mailCopy.haDescription)}</p>
        </div>
      </div>
      ${
        selectedHa
          ? `${renderers.renderSignalStrip([
              {
                label: mailCopy.failoverModeLabel,
                value: mailCopy.manualFailoverLabel,
                tone: "default"
              },
              {
                label: mailCopy.dnsCutoverLabel,
                value: selectedHa.mailHost,
                tone: "default"
              },
              {
                label: mailCopy.promotionReadyLabel,
                value: selectedHa.standby
                  ? labelForObservabilityStatus(selectedHa.standby.promotionReady.status)
                  : mailCopy.noStandbyConfiguredLabel,
                tone: selectedHa.standby
                  ? toneForMailObservabilityStatus(selectedHa.standby.promotionReady.status)
                  : "muted"
              }
            ])}
            ${renderers.renderDetailGrid(
              [
                {
                  label: mailCopy.primaryNodeLabel,
                  value: `<span class="mono">${escapeHtml(selectedHa.primary.nodeId)}</span>`
                },
                {
                  label: mailCopy.standbyNodeLabel,
                  value: selectedHa.standby
                    ? `<span class="mono">${escapeHtml(selectedHa.standby.nodeId)}</span>`
                    : escapeHtml(copy.none)
                },
                {
                  label: mailCopy.mailHostLabel,
                  value: `<span class="mono">${escapeHtml(selectedHa.mailHost)}</span>`
                },
                {
                  label: mailCopy.webmailHostnameLabel,
                  value: `<span class="mono">${escapeHtml(selectedHa.webmailHostname)}</span>`
                },
                {
                  label: mailCopy.mxBehaviorLabel,
                  value: escapeHtml(mailCopy.mxStableLabel)
                },
                {
                  label: mailCopy.primaryBehaviorLabel,
                  value: escapeHtml(mailCopy.primaryBehaviorValue)
                },
                {
                  label: mailCopy.standbyBehaviorLabel,
                  value: escapeHtml(
                    selectedHa.standby
                      ? mailCopy.standbyBehaviorValue
                      : mailCopy.noStandbyConfiguredLabel
                  ),
                  className: "detail-item-span-two"
                }
              ],
              { className: "detail-grid-three" }
            )}
            <div class="grid-two-desktop">
              ${renderHaNodePanel(selectedHa.primary, mailCopy.primaryReadinessTitle)}
              ${
                selectedHa.standby
                  ? renderHaNodePanel(selectedHa.standby, mailCopy.standbyPromotionTitle)
                  : `<article class="panel detail-shell panel-nested">
                      <h4>${escapeHtml(mailCopy.standbyPromotionTitle)}</h4>
                      <p class="empty">${escapeHtml(mailCopy.noStandbyConfiguredLabel)}</p>
                    </article>`
              }
            </div>`
          : `<p class="empty">${escapeHtml(mailCopy.noSelectionLabel)}</p>`
      }
    </article>`;
  const antiSpamPolicyPanel = `<article class="panel detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(mailCopy.antiSpamTitle)}</h3>
          <p class="muted section-description">${escapeHtml(mailCopy.antiSpamDescription)}</p>
        </div>
        <button type="button" class="secondary" data-overlay-trigger data-modal-id="mail-policy-edit-modal">${escapeHtml(
          mailCopy.editLabel
        )}</button>
      </div>
      ${renderers.renderSignalStrip([
        {
          label: mailCopy.tagAtLabel,
          value: String(mailPolicy.addHeaderThreshold),
          tone: "default"
        },
        {
          label: mailCopy.rejectAtLabel,
          value: String(mailPolicy.rejectThreshold),
          tone: "danger"
        },
        {
          label: mailCopy.greylistAtLabel,
          value:
            mailPolicy.greylistThreshold !== undefined
              ? String(mailPolicy.greylistThreshold)
              : mailCopy.greylistDisabledLabel,
          tone: mailPolicy.greylistThreshold !== undefined ? "default" : "muted"
        },
        {
          label: mailCopy.rateLimitLabel,
          value: formatRateLimit(mailPolicy),
          tone: mailPolicy.rateLimit ? "success" : "muted"
        }
      ])}
      ${renderers.renderDetailGrid(
        [
          {
            label: mailCopy.acceptBelowLabel,
            value: escapeHtml(String(mailPolicy.addHeaderThreshold))
          },
          {
            label: mailCopy.tagAtLabel,
            value: escapeHtml(String(mailPolicy.addHeaderThreshold))
          },
          {
            label: mailCopy.rejectAtLabel,
            value: escapeHtml(String(mailPolicy.rejectThreshold))
          },
          {
            label: mailCopy.greylistAtLabel,
            value: escapeHtml(
              mailPolicy.greylistThreshold !== undefined
                ? String(mailPolicy.greylistThreshold)
                : mailCopy.greylistDisabledLabel
            )
          },
          {
            label: mailCopy.senderAllowlistLabel,
            value: renderers.renderPill(
              String(mailPolicy.senderAllowlist.length),
              mailPolicy.senderAllowlist.length > 0 ? "success" : "muted"
            )
          },
          {
            label: mailCopy.senderDenylistLabel,
            value: renderers.renderPill(
              String(mailPolicy.senderDenylist.length),
              mailPolicy.senderDenylist.length > 0 ? "danger" : "muted"
            )
          }
        ],
        { className: "detail-grid-three" }
      )}
      <div class="grid-two-desktop">
        <article class="panel detail-shell panel-nested">
          <h4>${escapeHtml(mailCopy.senderAllowlistLabel)}</h4>
          <p class="muted section-description">${escapeHtml(mailCopy.senderPolicyHelp)}</p>
          ${renderSenderPolicyList(mailPolicy.senderAllowlist)}
        </article>
        <article class="panel detail-shell panel-nested">
          <h4>${escapeHtml(mailCopy.senderDenylistLabel)}</h4>
          <p class="muted section-description">${escapeHtml(mailCopy.senderPolicyHelp)}</p>
          ${renderSenderPolicyList(mailPolicy.senderDenylist)}
        </article>
      </div>
    </article>`;

  const credentialRevealPanel = mailCredentialReveal
    ? `<article class="panel detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(mailCopy.credentialRevealTitle)}</h3>
            <p class="muted section-description">${escapeHtml(mailCopy.credentialRevealDescription)}</p>
          </div>
        </div>
        ${renderers.renderSignalStrip([
          {
            label: mailCopy.credentialRevealMailboxLabel,
            value: mailCredentialReveal.reveal.mailboxAddress,
            tone: "default"
          },
          {
            label:
              mailCredentialReveal.reveal.action === "generated"
                ? mailCopy.credentialRevealGeneratedLabel
                : mailCopy.credentialRevealRotatedLabel,
            value: escapeHtml(renderers.formatDate(mailCredentialReveal.reveal.generatedAt, locale)),
            tone: "success"
          },
          {
            label: mailCopy.selectedRecordLabel,
            value: mailCopy.credentialRevealShownOnce,
            tone: "danger"
          }
        ])}
        ${renderers.renderDetailGrid(
          [
            {
              label: mailCopy.credentialRevealValueLabel,
              value: `<span class="mono">${escapeHtml(mailCredentialReveal.reveal.credential)}</span>`,
              className: "detail-item-span-two"
            }
          ],
          { className: "detail-grid-two" }
        )}
      </article>`
    : "";

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

  function renderRowActionButtons(
    editModalId: string,
    deleteModalId: string,
    options?: { rotateModalId?: string; resetModalId?: string }
  ): string {
    return `<div class="table-row-actions">
      <button type="button" class="secondary" data-overlay-trigger data-modal-id="${escapeHtml(
        editModalId
      )}">${escapeHtml(mailCopy.editLabel)}</button>
      ${
        options?.rotateModalId
          ? `<button type="button" class="secondary" data-overlay-trigger data-modal-id="${escapeHtml(
              options.rotateModalId
            )}">${escapeHtml(mailCopy.rotateLabel)}</button>`
          : ""
      }
      ${
        options?.resetModalId
          ? `<button type="button" class="secondary" data-overlay-trigger data-modal-id="${escapeHtml(
              options.resetModalId
            )}">${escapeHtml(mailCopy.resetLabel)}</button>`
          : ""
      }
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
    credentialState: "configured" as const,
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
      credentialState?: DashboardData["mail"]["mailboxes"][number]["credentialState"];
      quotaBytes?: number;
    },
    mode: "create" | "edit",
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
        <label>${escapeHtml(mailCopy.credentialStrategyLabel)}
          <select name="credentialStrategy">${renderers.renderSelectOptions(
            mode === "create"
              ? [
                  {
                    value: "generate",
                    label: mailCopy.credentialStrategyGenerateLabel
                  },
                  {
                    value: "manual",
                    label: mailCopy.credentialStrategyManualLabel
                  },
                  {
                    value: "missing",
                    label: mailCopy.credentialStrategyMissingLabel
                  }
                ]
              : [
                  {
                    value: "keep",
                    label: mailCopy.credentialStrategyKeepLabel
                  },
                  {
                    value: "manual",
                    label: mailCopy.credentialStrategyManualLabel
                  },
                  {
                    value: "missing",
                    label: mailCopy.credentialStrategyMissingLabel
                  }
                ],
            mode === "create"
              ? defaults.credentialState === "missing"
                ? "missing"
                : "generate"
              : defaults.credentialState === "missing" || defaults.credentialState === "reset_required"
                ? "missing"
                : "keep"
          )}</select>
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
      <p class="muted section-description">${escapeHtml(
        mode === "create" ? mailCopy.createMailboxDescription : mailCopy.editMailboxDescription
      )}</p>
      <p class="muted section-description">${escapeHtml(mailCopy.manualPasswordHelp)}</p>
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

  const renderMailPolicyForm = (policy: DesiredStateMailPolicyInput): string => `<form method="post" action="/resources/mail/policy/upsert" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
      <div class="form-grid">
        <label>${escapeHtml(mailCopy.tagAtLabel)}
          <input type="number" step="0.1" min="0.1" name="addHeaderThreshold" value="${escapeHtml(
            String(policy.addHeaderThreshold)
          )}" required />
        </label>
        <label>${escapeHtml(mailCopy.rejectAtLabel)}
          <input type="number" step="0.1" min="0.1" name="rejectThreshold" value="${escapeHtml(
            String(policy.rejectThreshold)
          )}" required />
        </label>
        <label>${escapeHtml(mailCopy.greylistAtLabel)}
          <input type="number" step="0.1" min="0.1" name="greylistThreshold" value="${escapeHtml(
            policy.greylistThreshold !== undefined ? String(policy.greylistThreshold) : ""
          )}" />
        </label>
        <label>${escapeHtml(mailCopy.rateLimitBurstLabel)}
          <input type="number" min="1" name="rateLimitBurst" value="${escapeHtml(
            policy.rateLimit ? String(policy.rateLimit.burst) : ""
          )}" />
        </label>
        <label>${escapeHtml(mailCopy.rateLimitPeriodLabel)}
          <input type="number" min="1" name="rateLimitPeriodSeconds" value="${escapeHtml(
            policy.rateLimit ? String(policy.rateLimit.periodSeconds) : ""
          )}" />
        </label>
        <label>${escapeHtml(mailCopy.senderAllowlistLabel)}
          <textarea name="senderAllowlist" rows="5">${escapeHtml(policy.senderAllowlist.join("\n"))}</textarea>
        </label>
        <label>${escapeHtml(mailCopy.senderDenylistLabel)}
          <textarea name="senderDenylist" rows="5">${escapeHtml(policy.senderDenylist.join("\n"))}</textarea>
        </label>
      </div>
      <p class="muted section-description">${escapeHtml(mailCopy.senderPolicyHelp)}</p>
      <div class="toolbar">
        <button type="submit">${escapeHtml(mailCopy.savePolicyLabel)}</button>
      </div>
    </form>`;

  const domainCreateModalId = "mail-domain-create-modal";
  const mailboxCreateModalId = "mail-mailbox-create-modal";
  const aliasCreateModalId = "mail-alias-create-modal";
  const policyEditModalId = "mail-policy-edit-modal";

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
      const resetModalId = `mail-mailbox-reset-${toModalIdSegment(mailbox.address)}`;
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
              credentialState: mailbox.credentialState,
              quotaBytes: mailbox.quotaBytes
            },
            "edit",
            true
          )
        ),
        renderModalShell(
          `mail-mailbox-rotate-${toModalIdSegment(mailbox.address)}`,
          mailCopy.rotateLabel,
          mailCopy.credentialRevealDescription,
          `<div class="action-card-context">
            <span class="action-card-context-title">${escapeHtml(mailCopy.credentialRevealMailboxLabel)}</span>
            <p class="mono">${escapeHtml(mailbox.address)}</p>
          </div>
          <form method="post" action="/resources/mail/mailboxes/rotate-credential" class="stack">
            <input type="hidden" name="mailboxAddress" value="${escapeHtml(mailbox.address)}" />
            <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
            <div class="toolbar">
              <button class="secondary" type="submit">${escapeHtml(mailCopy.rotateLabel)}</button>
            </div>
          </form>`
        ),
        renderModalShell(
          resetModalId,
          mailCopy.resetMailboxCredentialLabel,
          mailCopy.modalDeleteDescription,
          `<div class="action-card-context">
            <span class="action-card-context-title">${escapeHtml(mailCopy.selectedRecordLabel)}</span>
            <p class="mono">${escapeHtml(mailbox.address)}</p>
          </div>
          <form method="post" action="/resources/mail/mailboxes/reset-credential" class="stack">
            <input type="hidden" name="mailboxAddress" value="${escapeHtml(mailbox.address)}" />
            <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
            <div class="toolbar">
              <button class="secondary" type="submit">${escapeHtml(mailCopy.resetMailboxCredentialLabel)}</button>
            </div>
          </form>`
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
      policyEditModalId,
      mailCopy.antiSpamTitle,
      mailCopy.antiSpamEditDescription,
      renderMailPolicyForm(mailPolicy)
    ),
    renderModalShell(
      domainCreateModalId,
      mailCopy.domainsTitle,
      mailCopy.modalEditorDescription,
      renderDomainEditorForm(createDomainDefaults, true)
    ),
    renderModalShell(
      mailboxCreateModalId,
      mailCopy.mailboxesTitle,
      mailCopy.createMailboxDescription,
      renderMailboxEditorForm(createMailboxDefaults, "create", true)
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
      },
      {
        label: mailCopy.queuedMessagesLabel,
        value: String(observability.totalQueuedMessages),
        tone:
          observability.totalQueuedMessages > 0
            ? "default"
            : reportedMailRuntimeCount > 0
              ? "success"
              : "muted"
      },
      {
        label: mailCopy.recentFailuresLabel,
        value: String(observability.totalRecentFailures),
        tone: observability.totalRecentFailures > 0 ? "danger" : "success"
      }
    ])}
    ${credentialRevealPanel}
    ${antiSpamPolicyPanel}
    ${renderDataTable({
      id: "section-mail-deliverability",
      heading: mailCopy.deliverabilityTitle,
      description: mailCopy.deliverabilityDescription,
      headingBadgeClassName: "section-badge-lime",
      restoreSelectionHref: true,
      columns: [
        { label: mailCopy.domainNameLabel, className: "mono" },
        { label: mailCopy.spfLabel },
        { label: mailCopy.dkimLabel },
        { label: mailCopy.dmarcLabel },
        { label: mailCopy.mtaStsLabel },
        { label: mailCopy.tlsRptLabel },
        { label: mailCopy.runtimeTitle },
        { label: mailCopy.checkedAtLabel }
      ],
      rows: deliverabilityRows,
      emptyMessage: mailCopy.noMailDomains,
      filterPlaceholder: copy.dataFilterPlaceholder,
      rowsPerPageLabel: copy.rowsPerPage,
      showingLabel: copy.showing,
      ofLabel: copy.of,
      recordsLabel: copy.records,
      defaultPageSize: 10
    })}
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
      ${selectedObservabilityPanel}
    </div>
    <div class="grid-two-desktop">
      ${selectedHaPanel}
      ${selectedActivityPanel}
    </div>
    <div class="grid-two-desktop">
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
          { label: mailCopy.webmailLabel },
          { label: mailCopy.policyDocsLabel },
          { label: mailCopy.queuedMessagesLabel },
          { label: mailCopy.recentFailuresLabel },
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
