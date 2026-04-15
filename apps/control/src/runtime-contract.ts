import {
  createControlProcessContext,
  type ControlProcessContext
} from "@simplehost/control-shared";

import {
  createCombinedControlRuntimeSurface,
  type CombinedControlRuntimeSurface
} from "./runtime-surface.js";

export interface CombinedControlRuntimeContract {
  readonly mode: "combined-candidate";
  readonly context: ControlProcessContext;
  readonly requestHandler: CombinedControlRuntimeSurface["requestHandler"];
  readonly surface: CombinedControlRuntimeSurface["surface"];
  close(): Promise<void>;
}

export async function createCombinedControlRuntimeContract(
  context: ControlProcessContext = createControlProcessContext()
): Promise<CombinedControlRuntimeContract> {
  const runtimeSurface = await createCombinedControlRuntimeSurface(context);

  return {
    mode: runtimeSurface.mode,
    context: runtimeSurface.context,
    requestHandler: runtimeSurface.requestHandler,
    surface: runtimeSurface.surface,
    close: runtimeSurface.close
  };
}
