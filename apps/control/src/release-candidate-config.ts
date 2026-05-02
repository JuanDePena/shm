import {
  createControlProcessContext,
  type ControlProcessContext
} from "@simplehost/control-shared";

export interface CombinedControlReleaseCandidateConfig {
  readonly kind: "release-like-config";
  readonly service: "control";
  readonly mode: "combined-release-candidate";
  readonly host: string;
  readonly port: number;
  readonly origin: string;
  readonly environment: string;
  readonly version: string;
  readonly inventoryImportPath: string | null;
  readonly sessionTtlSeconds: number;
  readonly databaseUrlConfigured: boolean;
  readonly jobPayloadSecretConfigured: boolean;
  readonly bootstrapEnrollmentTokenConfigured: boolean;
  readonly bootstrapAdminConfigured: boolean;
}

function hasValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function buildOrigin(host: string, port: number): string {
  return `http://${host}:${port}`;
}

export function createCombinedControlReleaseCandidateConfig(args: {
  context?: ControlProcessContext;
  host?: string;
  port?: number;
  origin?: string;
} = {}): CombinedControlReleaseCandidateConfig {
  const context = args.context ?? createControlProcessContext();
  const host = args.host ?? context.config.web.host;
  const port = args.port ?? context.config.web.port;
  const origin = args.origin ?? buildOrigin(host, port);

  return {
    kind: "release-like-config",
    service: "control",
    mode: "combined-release-candidate",
    host,
    port,
    origin,
    environment: context.config.env,
    version: context.config.version,
    inventoryImportPath: context.config.inventory.importPath,
    sessionTtlSeconds: context.config.auth.sessionTtlSeconds,
    databaseUrlConfigured: hasValue(context.config.database.url),
    jobPayloadSecretConfigured: hasValue(context.config.jobs.payloadSecret),
    bootstrapEnrollmentTokenConfigured: hasValue(
      context.config.auth.bootstrapEnrollmentToken
    ),
    bootstrapAdminConfigured:
      hasValue(context.config.auth.bootstrapAdminEmail) &&
      hasValue(context.config.auth.bootstrapAdminPassword) &&
      hasValue(context.config.auth.bootstrapAdminName)
  };
}
