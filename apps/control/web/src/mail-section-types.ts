import type { MailboxCredentialReveal } from "@simplehost/control-contracts";

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
  rotateLabel: string;
  resetLabel: string;
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
  sizeLabel: string;
  quotaBytesLabel: string;
  hasCredentialLabel: string;
  destinationsLabel: string;
  mailboxCountLabel: string;
  aliasCountLabel: string;
  runtimeTitle: string;
  runtimeDescription: string;
  deliverabilityTitle: string;
  deliverabilityDescription: string;
  validationTitle: string;
  validationDescription: string;
  backupTitle: string;
  backupDescription: string;
  haTitle: string;
  haDescription: string;
  antiSpamTitle: string;
  antiSpamDescription: string;
  antiSpamEditDescription: string;
  activityTitle: string;
  activityDescription: string;
  runtimeNodesLabel: string;
  runtimeHealthyLabel: string;
  backupPolicyCountLabel: string;
  latestBackupLabel: string;
  latestBackupFailureLabel: string;
  expectedPathsLabel: string;
  coveredPathsLabel: string;
  restoreMailboxLabel: string;
  restoreDomainLabel: string;
  restoreStackLabel: string;
  warningCountLabel: string;
  dispatchWarningsLabel: string;
  queuedMessagesLabel: string;
  recentFailuresLabel: string;
  postfixLabel: string;
  dovecotLabel: string;
  rspamdLabel: string;
  redisLabel: string;
  webmailLabel: string;
  policyDocsLabel: string;
  spfLabel: string;
  dkimLabel: string;
  dmarcLabel: string;
  mtaStsLabel: string;
  tlsRptLabel: string;
  managedDomainsLabel: string;
  checkedAtLabel: string;
  failoverModeLabel: string;
  manualFailoverLabel: string;
  dnsCutoverLabel: string;
  mxBehaviorLabel: string;
  mxStableLabel: string;
  primaryBehaviorLabel: string;
  primaryBehaviorValue: string;
  standbyBehaviorLabel: string;
  standbyBehaviorValue: string;
  primaryReadinessTitle: string;
  standbyPromotionTitle: string;
  runtimeConfigLabel: string;
  maildirReadinessLabel: string;
  promotionReadyLabel: string;
  promotionBlockersLabel: string;
  noPromotionBlockers: string;
  noStandbyConfiguredLabel: string;
  latestMailSyncLabel: string;
  topDeferReasonLabel: string;
  relatedJobsTitle: string;
  relatedAuditsTitle: string;
  openJobHistoryLabel: string;
  openAuditHistoryLabel: string;
  noRecentFailures: string;
  acceptBelowLabel: string;
  tagAtLabel: string;
  rejectAtLabel: string;
  greylistAtLabel: string;
  greylistDisabledLabel: string;
  senderAllowlistLabel: string;
  senderDenylistLabel: string;
  senderPolicyHelp: string;
  noSenderPolicyEntries: string;
  rateLimitLabel: string;
  rateLimitBurstLabel: string;
  rateLimitPeriodLabel: string;
  rateLimitDisabledLabel: string;
  primaryRoleLabel: string;
  secondaryRoleLabel: string;
  primaryNodeLabel: string;
  standbyNodeLabel: string;
  saveDomainLabel: string;
  deleteDomainLabel: string;
  saveMailboxLabel: string;
  resetMailboxCredentialLabel: string;
  deleteMailboxLabel: string;
  saveAliasLabel: string;
  deleteAliasLabel: string;
  saveQuotaLabel: string;
  deleteQuotaLabel: string;
  savePolicyLabel: string;
  desiredPasswordCreateLabel: string;
  desiredPasswordUpdateLabel: string;
  credentialStrategyLabel: string;
  credentialStrategyGenerateLabel: string;
  credentialStrategyManualLabel: string;
  credentialStrategyMissingLabel: string;
  credentialStrategyKeepLabel: string;
  createMailboxDescription: string;
  editMailboxDescription: string;
  createMailboxPasswordHelp: string;
  editMailboxPasswordHelp: string;
  quotaHelp: string;
  quotaValueLabel: string;
  quotaUnitLabel: string;
  mailboxAddressHelp: string;
  mailboxNameLabel: string;
  localPartLabel: string;
  addressLabel: string;
  tenantSlugLabel: string;
  zoneNameLabel: string;
  domainCountLabel: string;
  mailboxTotalLabel: string;
  aliasTotalLabel: string;
  quotaTotalLabel: string;
  credentialConfigured: string;
  credentialMissing: string;
  credentialResetRequired: string;
  credentialRevealTitle: string;
  credentialRevealDescription: string;
  credentialRevealValueLabel: string;
  credentialRevealShownOnce: string;
  credentialRevealMailboxLabel: string;
  credentialRevealGeneratedLabel: string;
  credentialRevealRotatedLabel: string;
  runtimeReported: string;
  runtimeUnreported: string;
  serviceActive: string;
  serviceInactive: string;
  serviceDisabled: string;
  onLabel: string;
  offLabel: string;
  observabilityReady: string;
  observabilityWarning: string;
  observabilityMissing: string;
  observabilityUnreported: string;
  validationAffectsDispatchLabel: string;
  validationAdvisoryLabel: string;
  openBackupsViewLabel: string;
  noExpectedBackupPaths: string;
  noMailDomains: string;
  noMailboxes: string;
  noAliases: string;
  noQuotas: string;
  noValidationWarnings: string;
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
    credentialState: DashboardData["mail"]["mailboxes"][number]["credentialState"];
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

export interface MailCredentialRevealViewModel {
  historyReplaceUrl?: string;
  reveal: MailboxCredentialReveal;
}
