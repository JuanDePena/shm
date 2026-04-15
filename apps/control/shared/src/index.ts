import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export * from "./runtime.js";
export * from "./http.js";
export * from "./auth.js";
export * from "./dashboard-bootstrap.js";

export function isMainModule(
  importMetaUrl: string,
  argv1: string | undefined = process.argv[1]
): boolean {
  if (argv1 === undefined) {
    return false;
  }

  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(importMetaUrl));
  } catch {
    return fileURLToPath(importMetaUrl) === argv1;
  }
}

export function registerGracefulShutdown(
  shutdown: () => Promise<void> | void,
  options: {
    signals?: readonly NodeJS.Signals[];
    onBeforeExit?: () => void;
    onShutdownError?: (error: unknown) => void;
  } = {}
): void {
  const signals = options.signals ?? (["SIGINT", "SIGTERM"] as const);
  let shuttingDown = false;

  for (const signal of signals) {
    process.on(signal, () => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      void Promise.resolve()
        .then(() => shutdown())
        .catch((error: unknown) => {
          options.onShutdownError?.(error);
          process.exitCode = 1;
        })
        .finally(() => {
          options.onBeforeExit?.();
          process.exit();
        });
    });
  }
}
