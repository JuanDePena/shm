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
