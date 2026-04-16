import { formatCombinedControlReleaseSandboxBundle } from "./release-sandbox-bundle.js";
import { packCombinedControlReleaseSandbox } from "./release-sandbox-pack.js";
import { formatCombinedControlStartupManifest } from "./startup-manifest.js";

const packed = await packCombinedControlReleaseSandbox();

console.log("Combined control release-sandbox bundle");
console.log(`Sandbox root: ${packed.layout.sandboxRoot}`);
console.log(`Releases root: ${packed.layout.releasesRoot}`);
console.log(`Release version root: ${packed.layout.releaseVersionRoot}`);
console.log(`Current: ${packed.layout.currentRoot}`);
console.log(`Shared root: ${packed.layout.sharedRoot}`);
console.log(`Release entrypoint: ${packed.bundle.paths.releaseEntrypoint}`);
console.log(`Current entrypoint: ${packed.bundle.paths.currentEntrypoint}`);
console.log(`Env file: ${packed.bundle.paths.envFile}`);
console.log("");
console.log(formatCombinedControlStartupManifest(packed.startupManifest));
console.log("");
console.log(formatCombinedControlReleaseSandboxBundle(packed.bundle));
