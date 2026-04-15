import {
  createControlTestHarness,
  startCombinedControlTestRuntime,
  startSplitControlTestRuntime
} from "./test-harness.js";

export interface RuntimeParityResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly bodyText: string;
}

export interface RuntimeParityPair {
  readonly split: RuntimeParityResponse;
  readonly combined: RuntimeParityResponse;
}

async function readResponse(response: Response): Promise<RuntimeParityResponse> {
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    bodyText: await response.text()
  };
}

export async function createControlRuntimeParityHarness(args: {
  webPort?: number;
} = {}) {
  const harness = await createControlTestHarness({
    webPort: args.webPort
  });
  const splitRuntime = await startSplitControlTestRuntime(harness, {
    host: "127.0.0.1",
    port: 0
  });
  const combinedRuntime = await startCombinedControlTestRuntime(harness, {
    host: "127.0.0.1",
    port: 0
  });

  const request = async (
    origin: string,
    pathname: string,
    init?: RequestInit
  ): Promise<RuntimeParityResponse> => readResponse(await fetch(new URL(pathname, origin), init));

  return {
    harness,
    splitRuntime,
    combinedRuntime,
    requestSplit: (pathname: string, init?: RequestInit) =>
      request(splitRuntime.origin, pathname, init),
    requestCombined: (pathname: string, init?: RequestInit) =>
      request(combinedRuntime.origin, pathname, init),
    requestBoth: async (pathname: string, init?: RequestInit): Promise<RuntimeParityPair> => ({
      split: await request(splitRuntime.origin, pathname, init),
      combined: await request(combinedRuntime.origin, pathname, init)
    }),
    close: async () => {
      await Promise.all([
        splitRuntime.close(),
        combinedRuntime.close()
      ]);
    }
  };
}
