import type { ShmJobResult, ShmNodeSnapshot } from "@simplehost/manager-contracts";

export function renderNodeSnapshot(snapshot: ShmNodeSnapshot): string {
  return [
    `Node: ${snapshot.nodeId}`,
    `Host: ${snapshot.hostname}`,
    `Status: ${snapshot.status}`,
    `State dir: ${snapshot.stateDir}`,
    `Report buffer: ${snapshot.reportBufferDir}`,
    `Generated at: ${snapshot.generatedAt}`
  ].join("\n");
}

export function renderJobResult(result: ShmJobResult): string {
  return [
    `Job: ${result.jobId}`,
    `Kind: ${result.kind}`,
    `Node: ${result.nodeId}`,
    `Status: ${result.status}`,
    `Summary: ${result.summary}`,
    `Completed at: ${result.completedAt}`
  ].join("\n");
}
