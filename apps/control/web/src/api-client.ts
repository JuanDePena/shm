import { createPanelRuntimeConfig, type PanelRuntimeConfig } from "@simplehost/panel-config";
import {
  type AuditEventSummary,
  type AuthLoginRequest,
  type AuthLoginResponse,
  type AuthenticatedUserSummary,
  type BackupsOverview,
  type DesiredStateApplyRequest,
  type DesiredStateExportResponse,
  type DesiredStateSpec,
  type InventoryStateSnapshot,
  type JobHistoryEntry,
  type MailOverview,
  type NodeHealthSnapshot,
  type OperationsOverview,
  type PackageInventorySnapshot,
  type ResourceDriftSummary,
  type RustDeskOverview,
  type RustDeskPublicConnectionInfo
} from "@simplehost/panel-contracts";
import { type PanelNotice } from "@simplehost/panel-ui";

import { sanitizeReturnTo } from "./request.js";

export interface DashboardData {
  currentUser: AuthenticatedUserSummary;
  overview: OperationsOverview;
  inventory: InventoryStateSnapshot;
  desiredState: DesiredStateExportResponse;
  drift: ResourceDriftSummary[];
  nodeHealth: NodeHealthSnapshot[];
  jobHistory: JobHistoryEntry[];
  auditEvents: AuditEventSummary[];
  backups: BackupsOverview;
  rustdesk: RustDeskOverview;
  mail: MailOverview;
  packages: PackageInventorySnapshot;
}

export type DashboardBootstrap = DashboardData;

export class WebApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "WebApiError";
  }
}

export interface PanelWebApi {
  request<T>(
    pathname: string,
    options?: {
      method?: string;
      token?: string | null;
      body?: unknown;
      responseType?: "json" | "text";
    }
  ): Promise<T>;
  login(credentials: AuthLoginRequest): Promise<AuthLoginResponse>;
  logout(token: string): Promise<void>;
  getCurrentUser(token: string): Promise<AuthenticatedUserSummary>;
  loadDashboardBootstrap(token: string): Promise<DashboardBootstrap>;
  loadDashboardData(token: string): Promise<DashboardData>;
  loadRustDeskPublicConnection(): Promise<RustDeskPublicConnectionInfo>;
  loadDesiredStateSpec(token: string): Promise<DesiredStateSpec>;
  applyDesiredStateSpec(token: string, spec: DesiredStateSpec, reason: string): Promise<void>;
  mutateDesiredState(
    token: string,
    reason: string,
    action: (spec: DesiredStateSpec) => DesiredStateSpec
  ): Promise<void>;
}

export interface PanelWebApiRequestOptions {
  method?: string;
  token?: string | null;
  body?: unknown;
  responseType?: "json" | "text";
}

export type PanelWebApiRequest = <T>(
  pathname: string,
  options?: PanelWebApiRequestOptions
) => Promise<T>;

function createApiBaseUrl(config: Pick<PanelRuntimeConfig, "api">): string {
  return `http://${config.api.host}:${config.api.port}`;
}

async function requestWithBaseUrl<T>(
  baseUrl: string,
  pathname: string,
  options: PanelWebApiRequestOptions = {}
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

export function createPanelWebApiFromRequest(request: PanelWebApiRequest): PanelWebApi {
  return {
    request,
    login(credentials: AuthLoginRequest): Promise<AuthLoginResponse> {
      return request<AuthLoginResponse>("/v1/auth/login", {
        method: "POST",
        body: credentials
      });
    },
    async logout(token: string): Promise<void> {
      await request("/v1/auth/logout", {
        method: "POST",
        token
      });
    },
    getCurrentUser(token: string): Promise<AuthenticatedUserSummary> {
      return request<AuthenticatedUserSummary>("/v1/auth/me", { token });
    },
    async loadDashboardBootstrap(token: string): Promise<DashboardBootstrap> {
      const [
        currentUser,
        overview,
        inventory,
        desiredState,
        drift,
        nodeHealth,
        jobHistory,
        auditEvents,
        backups,
        rustdesk,
        mail,
        packages
      ] = await Promise.all([
        this.getCurrentUser(token),
        request<OperationsOverview>("/v1/operations/overview", { token }),
        request<InventoryStateSnapshot>("/v1/inventory/summary", { token }),
        request<DesiredStateExportResponse>("/v1/resources/spec", { token }),
        request<ResourceDriftSummary[]>("/v1/resources/drift", { token }),
        request<NodeHealthSnapshot[]>("/v1/nodes/health", { token }),
        request<JobHistoryEntry[]>("/v1/jobs/history?limit=30", { token }),
        request<AuditEventSummary[]>("/v1/audit/events?limit=30", { token }),
        request<BackupsOverview>("/v1/backups/summary", { token }),
        request<RustDeskOverview>("/v1/platform/rustdesk", { token }),
        request<MailOverview>("/v1/mail/overview", { token }),
        request<PackageInventorySnapshot>("/v1/packages/summary", { token })
      ]);

      return {
        currentUser,
        overview,
        inventory,
        desiredState,
        drift,
        nodeHealth,
        jobHistory,
        auditEvents,
        backups,
        rustdesk,
        mail,
        packages
      };
    },
    async loadDashboardData(token: string): Promise<DashboardData> {
      return this.loadDashboardBootstrap(token);
    },
    loadRustDeskPublicConnection(): Promise<RustDeskPublicConnectionInfo> {
      return request<RustDeskPublicConnectionInfo>("/v1/public/rustdesk");
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
      const spec = await this.loadDesiredStateSpec(token);
      await this.applyDesiredStateSpec(token, action(spec), reason);
    }
  };
}

export function createHttpPanelWebApi(
  config: Pick<PanelRuntimeConfig, "api"> = createPanelRuntimeConfig()
): PanelWebApi {
  const baseUrl = createApiBaseUrl(config);
  return createPanelWebApiFromRequest((pathname, options = {}) =>
    requestWithBaseUrl(baseUrl, pathname, options)
  );
}

export const defaultPanelWebApi = createHttpPanelWebApi();

export function apiRequest<T>(
  pathname: string,
  options: PanelWebApiRequestOptions = {}
): Promise<T> {
  return defaultPanelWebApi.request(pathname, options);
}

export function loadDashboardData(token: string): Promise<DashboardData> {
  return defaultPanelWebApi.loadDashboardData(token);
}

export function loadDashboardBootstrap(token: string): Promise<DashboardBootstrap> {
  return defaultPanelWebApi.loadDashboardBootstrap(token);
}

export function loadRustDeskPublicConnection(): Promise<RustDeskPublicConnectionInfo> {
  return defaultPanelWebApi.loadRustDeskPublicConnection();
}

export function loadDesiredStateSpec(token: string): Promise<DesiredStateSpec> {
  return defaultPanelWebApi.loadDesiredStateSpec(token);
}

export function applyDesiredStateSpec(
  token: string,
  spec: DesiredStateSpec,
  reason: string
): Promise<void> {
  return defaultPanelWebApi.applyDesiredStateSpec(token, spec, reason);
}

export function mutateDesiredState(
  token: string,
  reason: string,
  action: (spec: DesiredStateSpec) => DesiredStateSpec
): Promise<void> {
  return defaultPanelWebApi.mutateDesiredState(token, reason, action);
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
