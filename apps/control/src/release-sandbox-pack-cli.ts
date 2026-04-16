import { formatCombinedControlStartupManifest } from "./startup-manifest.js";
import { packCombinedControlReleaseSandbox } from "./release-sandbox-pack.js";

const packed = await packCombinedControlReleaseSandbox();

console.log("Combined control release-sandbox bundle");
console.log(`Sandbox root: ${packed.layout.sandboxRoot}`);
console.log(`Entrypoint: ${packed.bundle.entrypoint}`);
console.log(`Env file: ${packed.bundle.envFile}`);
console.log("");
console.log(formatCombinedControlStartupManifest(packed.startupManifest));
