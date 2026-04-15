import { createPanelRuntimeConfig, type PanelRuntimeConfig } from "@simplehost/panel-config";
import {
  type AuditEventSummary,
  type AuthenticatedUserSummary,
  type AuthLoginRequest,
  type AuthLoginResponse,
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
  type RustDeskPublicConnectionInfo
  ,
  type RustDeskOverview
} from "@simplehost/panel-contracts";
import { type PanelNotice } from "@simplehost/panel-ui";
import {
  loadAuthenticatedControlDashboardBootstrap,
  loadControlDashboardBootstrap,
  type ControlAuthSurface,
  type ControlAuthenticatedDashboardBootstrap,
  type ControlResolvedSession,
  type ControlDashboardBootstrap
} from "@simplehost/control-shared";
import { resolveControlSession } from "@simplehost/control-shared";

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

export interface PanelWebApi extends ControlAuthSurface {
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
  logout(token: string | null): Promise<void>;
  getCurrentUser(token: string | null): Promise<AuthenticatedUserSummary>;
  resolveSession(token: string | null): Promise<ControlResolvedSession>;
  loadAuthenticatedDashboard(
    token: string | null
  ): Promise<ControlAuthenticatedDashboardBootstrap>;
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

  return {
    request,
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
    getCurrentUser(token: string | null) {
      return request("/v1/auth/me", { token });
    },
    resolveSession(token: string | null): Promise<ControlResolvedSession> {
      return resolveControlSession(token, this);
    },
    loadAuthenticatedDashboard(
      token: string | null
    ): Promise<ControlAuthenticatedDashboardBootstrap> {
      return loadAuthenticatedControlDashboardBootstrap(
        token,
        this,
        createDashboardLoaders()
      );
    },
    async loadDashboardBootstrap(token: string): Promise<DashboardBootstrap> {
      return loadControlDashboardBootstrap(token, {
        getCurrentUser: (nextToken) => this.getCurrentUser(nextToken),
        ...createDashboardLoaders()
      });
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

export function resolveSession(token: string | null): Promise<ControlResolvedSession> {
  return defaultPanelWebApi.resolveSession(token);
}

export function loadAuthenticatedDashboard(
  token: string | null
): Promise<ControlAuthenticatedDashboardBootstrap> {
  return defaultPanelWebApi.loadAuthenticatedDashboard(token);
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
