import { type DashboardData } from "./api-client.js";
import { type WebLocale } from "./request.js";
import { type PillTone, type SelectOption } from "./web-types.js";

export interface MailSectionCopy {
  none: string;
  navNodes: string;
  dataFilterPlaceholder: string;
  rowsPerPage: string;
  showing: string;
  of: string;
  records: string;
  selectedStateLabel: string;
}

export interface MailSectionRenderers {
  renderPill: (value: string, tone?: PillTone) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderDetailGrid: (
    entries: Array<{ label: string; value: string; className?: string }>,
    options?: { className?: string }
  ) => string;
  renderActionForm: (
    action: string,
    hiddenFields: Record<string, string>,
    label: string,
    options?: { confirmMessage?: string }
  ) => string;
  renderSignalStrip: (
    entries: Array<{ label: string; value: string; tone?: PillTone }>
  ) => string;
  renderSelectOptions: (
    options: SelectOption[],
    selectedValue: string | undefined,
    optionsConfig?: {
      allowBlank?: boolean;
      blankLabel?: string;
    }
  ) => string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
}

export interface LocalizedMailCopy {
  title: string;
  description: string;
  domainsTitle: string;
  mailboxesTitle: string;
  aliasesTitle: string;
  quotasTitle: string;
  formsTitle: string;
  formsDescription: string;
  modalEditorDescription: string;
  modalDeleteDescription: string;
  selectedDomainTitle: string;
  selectedMailboxTitle: string;
  selectedAliasTitle: string;
  selectedQuotaTitle: string;
  createLabel: string;
  editLabel: string;
  deleteLabel: string;
  actionsLabel: string;
  openEditorLabel: string;
  deleteSelectedLabel: string;
  selectedRecordLabel: string;
  noSelectionLabel: string;
  closeLabel: string;
  domainNameLabel: string;
  mailHostLabel: string;
  webmailHostnameLabel: string;
  dkimSelectorLabel: string;
  quotaBytesLabel: string;
  hasCredentialLabel: string;
  destinationsLabel: string;
  mailboxCountLabel: string;
  aliasCountLabel: string;
  runtimeTitle: string;
  runtimeDescription: string;
  runtimeNodesLabel: string;
  runtimeHealthyLabel: string;
  postfixLabel: string;
  dovecotLabel: string;
  rspamdLabel: string;
  redisLabel: string;
  managedDomainsLabel: string;
  checkedAtLabel: string;
  primaryRoleLabel: string;
  secondaryRoleLabel: string;
  primaryNodeLabel: string;
  standbyNodeLabel: string;
  saveDomainLabel: string;
  deleteDomainLabel: string;
  saveMailboxLabel: string;
  deleteMailboxLabel: string;
  saveAliasLabel: string;
  deleteAliasLabel: string;
  saveQuotaLabel: string;
  deleteQuotaLabel: string;
  desiredPasswordLabel: string;
  localPartLabel: string;
  addressLabel: string;
  tenantSlugLabel: string;
  zoneNameLabel: string;
  domainCountLabel: string;
  mailboxTotalLabel: string;
  aliasTotalLabel: string;
  quotaTotalLabel: string;
  credentialPresent: string;
  credentialMissing: string;
  runtimeReported: string;
  runtimeUnreported: string;
  serviceActive: string;
  serviceInactive: string;
  serviceDisabled: string;
  noMailDomains: string;
  noMailboxes: string;
  noAliases: string;
  noQuotas: string;
  noRuntimeNodes: string;
}

export interface MailSectionModel {
  tenantOptions: SelectOption[];
  nodeOptions: SelectOption[];
  zoneOptions: SelectOption[];
  mailDomainOptions: SelectOption[];
  mailboxOptions: SelectOption[];
  selectedDomain: DashboardData["mail"]["domains"][number] | undefined;
  selectedMailbox: DashboardData["mail"]["mailboxes"][number] | undefined;
  selectedAlias: DashboardData["mail"]["aliases"][number] | undefined;
  selectedQuota: DashboardData["mail"]["quotas"][number] | undefined;
  mailRuntimeNodes: DashboardData["nodeHealth"];
  reportedMailRuntimeCount: number;
  healthyMailRuntimeCount: number;
  selectedDomainDefaults: {
    domainName: string;
    tenantSlug: string;
    zoneName: string;
    primaryNodeId: string;
    standbyNodeId?: string;
    mailHost: string;
    dkimSelector: string;
    mailboxCount: number;
    aliasCount: number;
  };
  selectedMailboxDefaults: {
    address: string;
    domainName: string;
    localPart: string;
    primaryNodeId: string;
    standbyNodeId?: string;
    hasCredential: boolean;
    quotaBytes?: number;
  };
  selectedAliasDefaults: {
    address: string;
    domainName: string;
    localPart: string;
    destinations: string[];
  };
  selectedQuotaDefaults: {
    mailboxAddress: string;
    storageBytes: number;
    domainName: string;
  };
}
