import { type DashboardData } from "./api-client.js";
import { type MailSectionModel } from "./mail-section-types.js";

export function buildMailSectionModel(
  data: DashboardData,
  focus: string | undefined
): MailSectionModel {
  const tenantOptions = data.desiredState.spec.tenants.map((tenant) => ({
    value: tenant.slug,
    label: `${tenant.slug} · ${tenant.displayName}`
  }));
  const nodeOptions = data.desiredState.spec.nodes.map((node) => ({
    value: node.nodeId,
    label: `${node.nodeId} · ${node.hostname}`
  }));
  const zoneOptions = data.desiredState.spec.zones.map((zone) => ({
    value: zone.zoneName,
    label: zone.zoneName
  }));
  const mailDomainOptions = data.mail.domains.map((domain) => ({
    value: domain.domainName,
    label: `${domain.domainName} · ${domain.mailHost}`
  }));
  const mailboxOptions = data.mail.mailboxes.map((mailbox) => ({
    value: mailbox.address,
    label: mailbox.address
  }));

  const selectedMailbox = data.mail.mailboxes.find((mailbox) => mailbox.address === focus);
  const selectedAlias = data.mail.aliases.find((alias) => alias.address === focus);
  const selectedDomain =
    data.mail.domains.find((domain) => domain.domainName === focus) ??
    (selectedMailbox
      ? data.mail.domains.find((domain) => domain.domainName === selectedMailbox.domainName)
      : undefined) ??
    (selectedAlias
      ? data.mail.domains.find((domain) => domain.domainName === selectedAlias.domainName)
      : undefined) ??
    data.mail.domains[0];
  const selectedQuota = data.mail.quotas.find((quota) => quota.mailboxAddress === focus);
  const expectedMailNodeIds = new Set<string>();

  for (const domain of data.mail.domains) {
    expectedMailNodeIds.add(domain.primaryNodeId);

    if (domain.standbyNodeId) {
      expectedMailNodeIds.add(domain.standbyNodeId);
    }
  }

  const mailRuntimeNodes = data.nodeHealth
    .filter((node) => expectedMailNodeIds.has(node.nodeId) || Boolean(node.mail))
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  const reportedMailRuntimeCount = mailRuntimeNodes.filter((node) => node.mail).length;
  const healthyMailRuntimeCount = mailRuntimeNodes.filter((node) => {
    const snapshot = node.mail;
    return Boolean(
      snapshot &&
        snapshot.postfixActive &&
        snapshot.dovecotActive &&
        snapshot.rspamdActive &&
        snapshot.redisActive
    );
  }).length;

  const selectedDomainDefaults = selectedDomain ?? {
    domainName: "",
    tenantSlug: tenantOptions[0]?.value ?? "",
    zoneName: zoneOptions[0]?.value ?? "",
    primaryNodeId: nodeOptions[0]?.value ?? "",
    standbyNodeId: "",
    mailHost: "",
    dkimSelector: "mail",
    mailboxCount: 0,
    aliasCount: 0
  };
  const selectedMailboxDefaults = selectedMailbox ?? {
    address: "",
    domainName: mailDomainOptions[0]?.value ?? "",
    localPart: "",
    primaryNodeId: nodeOptions[0]?.value ?? "",
    standbyNodeId: "",
    hasCredential: false,
    quotaBytes: undefined
  };
  const selectedAliasDefaults = selectedAlias ?? {
    address: "",
    domainName: mailDomainOptions[0]?.value ?? "",
    localPart: "",
    destinations: []
  };
  const selectedQuotaDefaults = selectedQuota ?? {
    mailboxAddress: mailboxOptions[0]?.value ?? "",
    storageBytes: 1073741824,
    domainName: ""
  };

  return {
    tenantOptions,
    nodeOptions,
    zoneOptions,
    mailDomainOptions,
    mailboxOptions,
    selectedDomain,
    selectedMailbox,
    selectedAlias,
    selectedQuota,
    mailRuntimeNodes,
    reportedMailRuntimeCount,
    healthyMailRuntimeCount,
    selectedDomainDefaults,
    selectedMailboxDefaults,
    selectedAliasDefaults,
    selectedQuotaDefaults
  };
}
