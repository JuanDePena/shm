import {
  createControlProcessContext,
  type ControlProcessContext
} from "@simplehost/control-shared";

import {
  createControlCombinedSurface,
  type ControlCombinedSurface
} from "./combined-surface.js";

export interface ControlCandidateRuntimeSurface<
  TMode extends "combined-candidate" | "split-candidate"
> {
  readonly mode: TMode;
  readonly context: ControlProcessContext;
  readonly requestHandler: ControlCombinedSurface["requestHandler"];
  close(): Promise<void>;
}

export interface CombinedControlRuntimeSurface
  extends ControlCandidateRuntimeSurface<"combined-candidate"> {
  readonly surface: ControlCombinedSurface;
}

export async function createCombinedControlRuntimeSurface(
  context: ControlProcessContext = createControlProcessContext()
): Promise<CombinedControlRuntimeSurface> {
  const surface = await createControlCombinedSurface(context);

  return {
    mode: "combined-candidate",
    context,
    surface,
    requestHandler: surface.requestHandler,
    close: surface.close
  };
}
