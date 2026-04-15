import {
  createControlProcessContext,
  type ControlProcessContext
} from "@simplehost/control-shared";

import { createControlCombinedSurface, type ControlCombinedSurface } from "./combined-surface.js";

export interface CombinedControlRuntimeContract {
  readonly mode: "combined-candidate";
  readonly context: ControlProcessContext;
  readonly requestHandler: ControlCombinedSurface["requestHandler"];
  readonly surface: ControlCombinedSurface;
  close(): Promise<void>;
}

export async function createCombinedControlRuntimeContract(
  context: ControlProcessContext = createControlProcessContext()
): Promise<CombinedControlRuntimeContract> {
  const surface = await createControlCombinedSurface(context);

  return {
    mode: "combined-candidate",
    context,
    requestHandler: surface.requestHandler,
    surface,
    close: surface.close
  };
}
