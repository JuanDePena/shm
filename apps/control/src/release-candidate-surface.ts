import type { ControlProcessContext } from "@simplehost/control-shared";

import {
  createCombinedControlReleaseCandidateConfig,
  type CombinedControlReleaseCandidateConfig
} from "./release-candidate-config.js";
import {
  createCombinedControlStartupManifest,
  type CombinedControlStartupManifest
} from "./startup-manifest.js";
import {
  createControlTestHarness,
  startCombinedControlTestRuntime,
  type ControlTestHarnessOptions
} from "./test-harness.js";

export interface CombinedControlReleaseCandidateRuntime {
  readonly mode: "combined-candidate";
  readonly origin: string;
  readonly manifest: CombinedControlStartupManifest;
  close(): Promise<void>;
}

export interface ControlReleaseCandidateCheckSpec {
  readonly name: string;
  readonly description: string;
}

export interface CombinedControlReleaseCandidateSurface {
  readonly context: ControlProcessContext;
  readonly kind: "source-release-candidate";
  readonly config: CombinedControlReleaseCandidateConfig;
  readonly startupManifest: CombinedControlStartupManifest;
  readonly checks: readonly ControlReleaseCandidateCheckSpec[];
  createStartupManifest(args?: {
    host?: string;
    port?: number;
    origin?: string;
  }): CombinedControlStartupManifest;
  start(args?: {
    host?: string;
    port?: number;
  }): Promise<CombinedControlReleaseCandidateRuntime>;
}

export function createDefaultControlReleaseCandidateChecks(): readonly ControlReleaseCandidateCheckSpec[] {
  return [
    {
      name: "startup-manifest",
      description:
        "The combined runtime exposes a release-like startup manifest with stable metadata."
    },
    {
      name: "healthz",
      description: "GET /healthz returns a healthy control runtime snapshot."
    },
    {
      name: "login",
      description: "POST /auth/login redirects and sets the session cookie."
    },
    {
      name: "authenticated-overview",
      description: "Authenticated dashboard overview renders successfully."
    },
    {
      name: "packages-view",
      description: "Authenticated packages workspace renders successfully."
    },
    {
      name: "package-install",
      description: "Package install action redirects with a success notice."
    },
    {
      name: "app-delete",
      description: "App delete mutation redirects through the desired-state flow."
    },
    {
      name: "mail-domain-upsert",
      description: "Mail domain mutation redirects through the mail workflow."
    },
    {
      name: "proxy-vhost-html",
      description: "Proxy preview HTML renders through the web surface."
    },
    {
      name: "proxy-vhost-json",
      description: "Proxy preview JSON renders for the selected app."
    },
    {
      name: "logout",
      description: "POST /auth/logout clears the session workflow via redirect."
    },
    {
      name: "invalid-session-redirect",
      description: "Protected routes redirect to login when the session is invalid."
    }
  ] as const;
}

export async function createCombinedControlReleaseCandidateSurface(
  options: ControlTestHarnessOptions = {}
): Promise<CombinedControlReleaseCandidateSurface> {
  const harness = await createControlTestHarness(options);
  const config = createCombinedControlReleaseCandidateConfig({
    context: harness.context
  });
  const createStartupManifest = (args: {
    host?: string;
    port?: number;
    origin?: string;
  } = {}) =>
    createCombinedControlStartupManifest(
      createCombinedControlReleaseCandidateConfig({
        context: harness.context,
        host: args.host,
        port: args.port,
        origin: args.origin
      })
    );

  return {
    context: harness.context,
    kind: "source-release-candidate",
    config,
    startupManifest: createStartupManifest(),
    checks: createDefaultControlReleaseCandidateChecks(),
    createStartupManifest,
    start: async (args = {}) => {
      const runtime = await startCombinedControlTestRuntime(harness, args);
      const runtimeUrl = new URL(runtime.origin);
      const resolvedHost = runtimeUrl.hostname;
      const resolvedPort = Number.parseInt(runtimeUrl.port || "80", 10);

      return {
        mode: "combined-candidate",
        origin: runtime.origin,
        manifest: createStartupManifest({
          host: resolvedHost,
          port: resolvedPort,
          origin: runtime.origin
        }),
        close: runtime.close
      };
    }
  };
}
