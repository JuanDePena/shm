import { createControlRuntimeConfig, type ControlRuntimeConfig } from "@simplehost/control-config";
import {
  type AppReconcileRequest,
  type AuditEventSummary,
  type AuthenticatedUserSummary,
  type AuthLoginRequest,
  type AuthLoginResponse,
  type BackupsOverview,
  type CodeServerUpdateRequest,
  type DatabaseReconcileRequest,
  type DesiredStateApplyRequest,
  type DesiredStateExportResponse,
  type DesiredStateSpec,
  type Fail2BanApplyRequest,
  type FirewallApplyRequest,
  type InventoryStateSnapshot,
  type InventoryImportSummary,
  type JobDispatchResponse,
  type JobHistoryEntry,
  type MailboxCredentialMutationResult,
  type MailboxCredentialReveal,
  type MailboxWebmailAutologin,
  type MailOverview,
  type NodeHealthSnapshot,
  type OperationsOverview,
  type PackageInstallRequest,
  type PackageInventoryRefreshRequest,
  type PackageInventorySnapshot,
  type ProxyRenderPayload,
  type ResetMailboxCredentialRequest,
  type RotateMailboxCredentialRequest,
  type UpsertMailPolicyRequest,
  type ResourceDriftSummary,
  type RustDeskPublicConnectionInfo
  ,
  type UpsertMailAliasRequest,
  type UpsertMailDomainRequest,
  type UpsertMailboxQuotaRequest,
  type UpsertMailboxRequest,
  type RustDeskOverview
} from "@simplehost/control-contracts";
import { type PanelNotice } from "@simplehost/ui";
import {
  createControlSessionSurface,
  loadAuthenticatedControlDashboardBootstrap,
  loadControlDashboardBootstrap,
  type ControlAuthSurface,
  type ControlAuthenticatedDashboardBootstrap,
  type ControlResolvedSession,
  type ControlDashboardBootstrap
} from "@simplehost/control-shared";

import { sanitizeReturnTo } from "./request.js";

export type DashboardData = ControlDashboardBootstrap;
export type DashboardBootstrap = ControlDashboardBootstrap;

export class WebApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "WebApiError";
  }
}

export interface ControlWebApi extends ControlAuthSurface {
  login(credentials: AuthLoginRequest): Promise<AuthLoginResponse>;
  logout(token: string | null): Promise<void>;
  getCurrentUser(token: string | null): Promise<AuthenticatedUserSummary>;
  resolveSession(token: string | null): Promise<ControlResolvedSession>;
  loadAuthenticatedDashboard(
    token: string | null
  ): Promise<ControlAuthenticatedDashboardBootstrap>;
  loadDashboardBootstrap(token: string): Promise<DashboardBootstrap>;
  loadDashboardData(token: string): Promise<DashboardData>;
  loadRustDeskPublicConnection(): Promise<RustDeskPublicConnectionInfo>;
  exportInventory(token: string): Promise<string>;
  importInventory(token: string, path: string): Promise<InventoryImportSummary>;
  runReconciliation(token: string): Promise<{ generatedJobCount: number; skippedJobCount: number }>;
  syncZone(token: string, zoneName: string): Promise<JobDispatchResponse>;
  reconcileApp(
    token: string,
    slug: string,
    request: AppReconcileRequest
  ): Promise<JobDispatchResponse>;
  renderAppProxy(token: string, slug: string): Promise<JobDispatchResponse>;
  reconcileDatabase(
    token: string,
    appSlug: string,
    request: DatabaseReconcileRequest
  ): Promise<JobDispatchResponse>;
  updateCodeServer(
    token: string,
    request: CodeServerUpdateRequest
  ): Promise<JobDispatchResponse>;
  refreshPackageInventory(
    token: string,
    request: PackageInventoryRefreshRequest
  ): Promise<JobDispatchResponse>;
  installPackages(
    token: string,
    request: PackageInstallRequest
  ): Promise<JobDispatchResponse>;
  applyFirewall(
    token: string,
    request: FirewallApplyRequest
  ): Promise<JobDispatchResponse>;
  applyFail2Ban(
    token: string,
    request: Fail2BanApplyRequest
  ): Promise<JobDispatchResponse>;
  loadProxyPreview(token: string, slug: string): Promise<ProxyRenderPayload>;
  upsertMailPolicy(token: string, request: UpsertMailPolicyRequest): Promise<void>;
  upsertMailDomain(token: string, request: UpsertMailDomainRequest): Promise<void>;
  deleteMailDomain(token: string, domainName: string): Promise<void>;
  upsertMailbox(
    token: string,
    request: UpsertMailboxRequest
  ): Promise<MailboxCredentialMutationResult>;
  resetMailboxCredential(
    token: string,
    request: ResetMailboxCredentialRequest
  ): Promise<MailboxCredentialMutationResult>;
  rotateMailboxCredential(
    token: string,
    request: RotateMailboxCredentialRequest
  ): Promise<MailboxCredentialMutationResult>;
  getMailboxWebmailAutologin(
    token: string,
    mailboxAddress: string
  ): Promise<MailboxWebmailAutologin>;
  consumeMailboxCredentialReveal(
    token: string,
    revealId: string
  ): Promise<MailboxCredentialReveal | null>;
  deleteMailbox(token: string, address: string): Promise<void>;
  upsertMailAlias(token: string, request: UpsertMailAliasRequest): Promise<void>;
  deleteMailAlias(token: string, address: string): Promise<void>;
  upsertMailboxQuota(token: string, request: UpsertMailboxQuotaRequest): Promise<void>;
  deleteMailboxQuota(token: string, mailboxAddress: string): Promise<void>;
  loadDesiredStateSpec(token: string): Promise<DesiredStateSpec>;
  applyDesiredStateSpec(token: string, spec: DesiredStateSpec, reason: string): Promise<void>;
  mutateDesiredState(
    token: string,
    reason: string,
    action: (spec: DesiredStateSpec) => DesiredStateSpec
  ): Promise<void>;
}

export interface ControlWebApiRequestOptions {
  method?: string;
  token?: string | null;
  body?: unknown;
  responseType?: "json" | "text";
}

export type ControlWebApiRequest = <T>(
  pathname: string,
  options?: ControlWebApiRequestOptions
) => Promise<T>;

function createApiBaseUrl(config: Pick<ControlRuntimeConfig, "api">): string {
  return `http://${config.api.host}:${config.api.port}`;
}

async function requestWithBaseUrl<T>(
  baseUrl: string,
  pathname: string,
  options: ControlWebApiRequestOptions = {}
): Promise<T> {
  const response = await fetch(new URL(pathname, baseUrl), {
    method: options.method ?? "GET",
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body !== undefined
        ? { "content-type": "application/json; charset=utf-8" }
        : {})
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const responseText = await response.text();

  if (!response.ok) {
    let message = responseText || response.statusText;

    try {
      const parsed = JSON.parse(responseText) as Record<string, unknown>;
      message =
        typeof parsed.message === "string"
          ? parsed.message
          : typeof parsed.error === "string"
            ? parsed.error
            : message;
    } catch {
      // Keep plain text.
    }

    throw new WebApiError(response.status, message);
  }

  if ((options.responseType ?? "json") === "text") {
    return responseText as T;
  }

  return (responseText ? JSON.parse(responseText) : null) as T;
}

export function createControlWebApiFromRequest(request: ControlWebApiRequest): ControlWebApi {
  const createDashboardLoaders = () => ({
    getOverview: (token: string) =>
      request<OperationsOverview>("/v1/operations/overview", { token }),
    getInventory: (token: string) =>
      request<InventoryStateSnapshot>("/v1/inventory/summary", { token }),
    getDesiredState: (token: string) =>
      request<DesiredStateExportResponse>("/v1/resources/spec", { token }),
    getDrift: (token: string) =>
      request<ResourceDriftSummary[]>("/v1/resources/drift", { token }),
    getNodeHealth: (token: string) =>
      request<NodeHealthSnapshot[]>("/v1/nodes/health", { token }),
    getJobHistory: (token: string) =>
      request<JobHistoryEntry[]>("/v1/jobs/history?limit=30", { token }),
    getAuditEvents: (token: string) =>
      request<AuditEventSummary[]>("/v1/audit/events?limit=30", { token }),
    getBackups: (token: string) =>
      request<BackupsOverview>("/v1/backups/summary", { token }),
    getRustDesk: (token: string) =>
      request<RustDeskOverview>("/v1/platform/rustdesk", { token }),
    getMail: (token: string) =>
      request<MailOverview>("/v1/mail/overview", { token }),
    getPackages: (token: string) =>
      request<PackageInventorySnapshot>("/v1/packages/summary", { token })
  });

  const api: ControlWebApi = {
    login(credentials: AuthLoginRequest): Promise<AuthLoginResponse> {
      return request<AuthLoginResponse>("/v1/auth/login", {
        method: "POST",
        body: credentials
      });
    },
    async logout(token: string | null): Promise<void> {
      await request("/v1/auth/logout", {
        method: "POST",
        token
      });
    },
    getCurrentUser(token: string | null): Promise<AuthenticatedUserSummary> {
      return request<AuthenticatedUserSummary>("/v1/auth/me", { token });
    },
    resolveSession: async (_token: string | null): Promise<ControlResolvedSession> => {
      throw new Error("resolveSession not initialized");
    },
    loadAuthenticatedDashboard(
      token: string | null
    ): Promise<ControlAuthenticatedDashboardBootstrap> {
      return loadAuthenticatedControlDashboardBootstrap(token, api, createDashboardLoaders());
    },
    async loadDashboardBootstrap(token: string): Promise<DashboardBootstrap> {
      return loadControlDashboardBootstrap(token, {
        getCurrentUser: (nextToken) => api.getCurrentUser(nextToken),
        ...createDashboardLoaders()
      });
    },
    async loadDashboardData(token: string): Promise<DashboardData> {
      return api.loadDashboardBootstrap(token);
    },
    loadRustDeskPublicConnection(): Promise<RustDeskPublicConnectionInfo> {
      return request<RustDeskPublicConnectionInfo>("/v1/public/rustdesk");
    },
    exportInventory(token: string): Promise<string> {
      return request<string>("/v1/inventory/export", {
        token,
        responseType: "text"
      });
    },
    importInventory(token: string, path: string): Promise<InventoryImportSummary> {
      return request<InventoryImportSummary>("/v1/inventory/import", {
        method: "POST",
        token,
        body: { path }
      });
    },
    runReconciliation(
      token: string
    ): Promise<{ generatedJobCount: number; skippedJobCount: number }> {
      return request<{ generatedJobCount: number; skippedJobCount: number }>(
        "/v1/reconcile/run",
        {
          method: "POST",
          token
        }
      );
    },
    syncZone(token: string, zoneName: string): Promise<JobDispatchResponse> {
      return request<JobDispatchResponse>(
        `/v1/zones/${encodeURIComponent(zoneName)}/sync`,
        {
          method: "POST",
          token
        }
      );
    },
    reconcileApp(
      token: string,
      slug: string,
      reconcileRequest: AppReconcileRequest
    ): Promise<JobDispatchResponse> {
      return request<JobDispatchResponse>(
        `/v1/apps/${encodeURIComponent(slug)}/reconcile`,
        {
          method: "POST",
          token,
          body: reconcileRequest
        }
      );
    },
    renderAppProxy(token: string, slug: string): Promise<JobDispatchResponse> {
      return request<JobDispatchResponse>(
        `/v1/apps/${encodeURIComponent(slug)}/render-proxy`,
        {
          method: "POST",
          token
        }
      );
    },
    reconcileDatabase(
      token: string,
      appSlug: string,
      reconcileRequest: DatabaseReconcileRequest
    ): Promise<JobDispatchResponse> {
      return request<JobDispatchResponse>(
        `/v1/databases/${encodeURIComponent(appSlug)}/reconcile`,
        {
          method: "POST",
          token,
          body: reconcileRequest
        }
      );
    },
    updateCodeServer(
      token: string,
      updateRequest: CodeServerUpdateRequest
    ): Promise<JobDispatchResponse> {
      return request<JobDispatchResponse>("/v1/code-server/update", {
        method: "POST",
        token,
        body: updateRequest
      });
    },
    refreshPackageInventory(
      token: string,
      refreshRequest: PackageInventoryRefreshRequest
    ): Promise<JobDispatchResponse> {
      return request<JobDispatchResponse>("/v1/packages/refresh", {
        method: "POST",
        token,
        body: refreshRequest
      });
    },
    installPackages(
      token: string,
      installRequest: PackageInstallRequest
    ): Promise<JobDispatchResponse> {
      return request<JobDispatchResponse>("/v1/packages/install", {
        method: "POST",
        token,
        body: installRequest
      });
    },
    applyFirewall(
      token: string,
      applyRequest: FirewallApplyRequest
    ): Promise<JobDispatchResponse> {
      return request<JobDispatchResponse>("/v1/firewall/apply", {
        method: "POST",
        token,
        body: applyRequest
      });
    },
    applyFail2Ban(
      token: string,
      applyRequest: Fail2BanApplyRequest
    ): Promise<JobDispatchResponse> {
      return request<JobDispatchResponse>("/v1/fail2ban/apply", {
        method: "POST",
        token,
        body: applyRequest
      });
    },
    loadProxyPreview(token: string, slug: string): Promise<ProxyRenderPayload> {
      return request<ProxyRenderPayload>(
        `/v1/apps/${encodeURIComponent(slug)}/proxy-preview`,
        { token }
      );
    },
    async upsertMailDomain(token: string, upsertRequest: UpsertMailDomainRequest): Promise<void> {
      await request("/v1/mail/domains", {
        method: "POST",
        token,
        body: upsertRequest
      });
    },
    async upsertMailPolicy(token: string, upsertRequest: UpsertMailPolicyRequest): Promise<void> {
      await request("/v1/mail/policy", {
        method: "POST",
        token,
        body: upsertRequest
      });
    },
    async deleteMailDomain(token: string, domainName: string): Promise<void> {
      await request(`/v1/mail/domains/${encodeURIComponent(domainName)}`, {
        method: "DELETE",
        token
      });
    },
    async upsertMailbox(
      token: string,
      upsertRequest: UpsertMailboxRequest
    ): Promise<MailboxCredentialMutationResult> {
      return request<MailboxCredentialMutationResult>("/v1/mail/mailboxes", {
        method: "POST",
        token,
        body: upsertRequest
      });
    },
    async resetMailboxCredential(
      token: string,
      resetRequest: ResetMailboxCredentialRequest
    ): Promise<MailboxCredentialMutationResult> {
      return request<MailboxCredentialMutationResult>("/v1/mail/mailboxes/reset-credential", {
        method: "POST",
        token,
        body: resetRequest
      });
    },
    async rotateMailboxCredential(
      token: string,
      rotateRequest: RotateMailboxCredentialRequest
    ): Promise<MailboxCredentialMutationResult> {
      return request<MailboxCredentialMutationResult>("/v1/mail/mailboxes/rotate-credential", {
        method: "POST",
        token,
        body: rotateRequest
      });
    },
    async getMailboxWebmailAutologin(
      token: string,
      mailboxAddress: string
    ): Promise<MailboxWebmailAutologin> {
      return request<MailboxWebmailAutologin>(
        `/v1/mail/mailboxes/webmail-autologin/${encodeURIComponent(mailboxAddress)}`,
        { token }
      );
    },
    async consumeMailboxCredentialReveal(
      token: string,
      revealId: string
    ): Promise<MailboxCredentialReveal | null> {
      return request<MailboxCredentialReveal | null>(
        `/v1/mail/mailboxes/credential-reveals/${encodeURIComponent(revealId)}`,
        { token }
      );
    },
    async deleteMailbox(token: string, address: string): Promise<void> {
      await request(`/v1/mail/mailboxes/${encodeURIComponent(address)}`, {
        method: "DELETE",
        token
      });
    },
    async upsertMailAlias(token: string, upsertRequest: UpsertMailAliasRequest): Promise<void> {
      await request("/v1/mail/aliases", {
        method: "POST",
        token,
        body: upsertRequest
      });
    },
    async deleteMailAlias(token: string, address: string): Promise<void> {
      await request(`/v1/mail/aliases/${encodeURIComponent(address)}`, {
        method: "DELETE",
        token
      });
    },
    async upsertMailboxQuota(
      token: string,
      upsertRequest: UpsertMailboxQuotaRequest
    ): Promise<void> {
      await request("/v1/mail/quotas", {
        method: "POST",
        token,
        body: upsertRequest
      });
    },
    async deleteMailboxQuota(token: string, mailboxAddress: string): Promise<void> {
      await request(`/v1/mail/quotas/${encodeURIComponent(mailboxAddress)}`, {
        method: "DELETE",
        token
      });
    },
    async loadDesiredStateSpec(token: string): Promise<DesiredStateSpec> {
      const exported = await request<DesiredStateExportResponse>("/v1/resources/spec", {
        token
      });
      return exported.spec;
    },
    async applyDesiredStateSpec(
      token: string,
      spec: DesiredStateSpec,
      reason: string
    ): Promise<void> {
      await request<unknown>("/v1/resources/spec", {
        method: "PUT",
        token,
        body: {
          spec,
          reason
        } satisfies DesiredStateApplyRequest
      });
    },
    async mutateDesiredState(
      token: string,
      reason: string,
      action: (spec: DesiredStateSpec) => DesiredStateSpec
    ): Promise<void> {
      const spec = await api.loadDesiredStateSpec(token);
      await api.applyDesiredStateSpec(token, action(spec), reason);
    }
  };

  const sessionSurface = createControlSessionSurface(api);
  api.resolveSession = (token: string | null) => sessionSurface.resolve(token);

  return api;
}

export function createHttpControlWebApi(
  config: Pick<ControlRuntimeConfig, "api"> = createControlRuntimeConfig()
): ControlWebApi {
  const baseUrl = createApiBaseUrl(config);
  return createControlWebApiFromRequest((pathname, options = {}) =>
    requestWithBaseUrl(baseUrl, pathname, options)
  );
}

export const defaultControlWebApi = createHttpControlWebApi();

export function apiRequest<T>(
  pathname: string,
  options: ControlWebApiRequestOptions = {}
): Promise<T> {
  return requestWithBaseUrl(createApiBaseUrl(createControlRuntimeConfig()), pathname, options);
}

export function loadDashboardData(token: string): Promise<DashboardData> {
  return defaultControlWebApi.loadDashboardData(token);
}

export function loadDashboardBootstrap(token: string): Promise<DashboardBootstrap> {
  return defaultControlWebApi.loadDashboardBootstrap(token);
}

export function resolveSession(token: string | null): Promise<ControlResolvedSession> {
  return defaultControlWebApi.resolveSession(token);
}

export function loadAuthenticatedDashboard(
  token: string | null
): Promise<ControlAuthenticatedDashboardBootstrap> {
  return defaultControlWebApi.loadAuthenticatedDashboard(token);
}

export function loadRustDeskPublicConnection(): Promise<RustDeskPublicConnectionInfo> {
  return defaultControlWebApi.loadRustDeskPublicConnection();
}

export function loadDesiredStateSpec(token: string): Promise<DesiredStateSpec> {
  return defaultControlWebApi.loadDesiredStateSpec(token);
}

export function applyDesiredStateSpec(
  token: string,
  spec: DesiredStateSpec,
  reason: string
): Promise<void> {
  return defaultControlWebApi.applyDesiredStateSpec(token, spec, reason);
}

export function mutateDesiredState(
  token: string,
  reason: string,
  action: (spec: DesiredStateSpec) => DesiredStateSpec
): Promise<void> {
  return defaultControlWebApi.mutateDesiredState(token, reason, action);
}

export function getNoticeFromUrl(url: URL): PanelNotice | undefined {
  const message = url.searchParams.get("notice");
  const kind = url.searchParams.get("kind");

  if (!message) {
    return undefined;
  }

  return {
    kind:
      kind === "success" || kind === "error" || kind === "info"
        ? kind
        : "info",
    message
  };
}

export function noticeLocation(
  message: string,
  kind: PanelNotice["kind"] = "success"
): string {
  const url = new URL("http://localhost/");
  url.searchParams.set("notice", message);
  url.searchParams.set("kind", kind);
  return `${url.pathname}${url.search}`;
}

export function noticeReturnTo(
  returnTo: string,
  message: string,
  kind: PanelNotice["kind"] = "success"
): string {
  const url = new URL(sanitizeReturnTo(returnTo), "http://localhost");
  url.searchParams.set("notice", message);
  url.searchParams.set("kind", kind);
  return `${url.pathname}${url.search}`;
}
