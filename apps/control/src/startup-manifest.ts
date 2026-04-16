import type { CombinedControlReleaseCandidateConfig } from "./release-candidate-config.js";

export interface CombinedControlStartupManifest {
  readonly kind: "combined-release-candidate-manifest";
  readonly service: "control";
  readonly mode: "combined-release-candidate";
  readonly environment: string;
  readonly version: string;
  readonly origin: string;
  readonly listener: {
    readonly host: string;
    readonly port: number;
  };
  readonly inventoryImportPath: string;
  readonly sessionTtlSeconds: number;
  readonly releaseRoot: "/opt/simplehostman/release";
  readonly configSource: "workspace";
  readonly surfaces: readonly string[];
  readonly secrets: {
    readonly databaseUrlConfigured: boolean;
    readonly jobPayloadSecretConfigured: boolean;
    readonly bootstrapEnrollmentTokenConfigured: boolean;
    readonly bootstrapAdminConfigured: boolean;
  };
}

export const combinedControlReleaseCandidateSurfaces = [
  "api",
  "web",
  "health",
  "auth",
  "dashboard-bootstrap",
  "preflight",
  "release-candidate"
] as const;

export function createCombinedControlStartupManifest(
  config: CombinedControlReleaseCandidateConfig
): CombinedControlStartupManifest {
  return {
    kind: "combined-release-candidate-manifest",
    service: "control",
    mode: config.mode,
    environment: config.environment,
    version: config.version,
    origin: config.origin,
    listener: {
      host: config.host,
      port: config.port
    },
    inventoryImportPath: config.inventoryImportPath,
    sessionTtlSeconds: config.sessionTtlSeconds,
    releaseRoot: "/opt/simplehostman/release",
    configSource: "workspace",
    surfaces: combinedControlReleaseCandidateSurfaces,
    secrets: {
      databaseUrlConfigured: config.databaseUrlConfigured,
      jobPayloadSecretConfigured: config.jobPayloadSecretConfigured,
      bootstrapEnrollmentTokenConfigured:
        config.bootstrapEnrollmentTokenConfigured,
      bootstrapAdminConfigured: config.bootstrapAdminConfigured
    }
  };
}

export function formatCombinedControlStartupManifest(
  manifest: CombinedControlStartupManifest
): string {
  return [
    "Combined control startup manifest",
    `Service: ${manifest.service}`,
    `Mode: ${manifest.mode}`,
    `Origin: ${manifest.origin}`,
    `Listener: ${manifest.listener.host}:${manifest.listener.port}`,
    `Environment: ${manifest.environment}`,
    `Version: ${manifest.version}`,
    `Inventory: ${manifest.inventoryImportPath}`,
    `Session TTL: ${manifest.sessionTtlSeconds}s`,
    `Release root: ${manifest.releaseRoot}`,
    `Config source: ${manifest.configSource}`,
    `Surfaces: ${manifest.surfaces.join(", ")}`,
    `Secrets: databaseUrlConfigured=${manifest.secrets.databaseUrlConfigured}, jobPayloadSecretConfigured=${manifest.secrets.jobPayloadSecretConfigured}, bootstrapEnrollmentTokenConfigured=${manifest.secrets.bootstrapEnrollmentTokenConfigured}, bootstrapAdminConfigured=${manifest.secrets.bootstrapAdminConfigured}`
  ].join("\n");
}
