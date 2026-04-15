import {
  createControlProcessContext,
  type ControlProcessContext
} from "@simplehost/control-shared";

import { createCombinedControlSurface, type CombinedControlSurface } from "./request-handler.js";

export interface CombinedControlRuntimeContract {
  readonly mode: "combined-candidate";
  readonly context: ControlProcessContext;
  readonly requestHandler: CombinedControlSurface["requestHandler"];
  readonly surface: CombinedControlSurface;
  close(): Promise<void>;
}

export async function createCombinedControlRuntimeContract(
  context: ControlProcessContext = createControlProcessContext()
): Promise<CombinedControlRuntimeContract> {
  const surface = await createCombinedControlSurface(context);

  return {
    mode: "combined-candidate",
    context,
    requestHandler: surface.requestHandler,
    surface,
    close: surface.close
  };
}
