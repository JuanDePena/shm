import {
  isSupportedJobKind,
  type ShmJobEnvelope,
  type ShmJobKind,
  type ShmJobResult
} from "@simplehost/manager-contracts";

export interface DriverExecutionContext {
  nodeId: string;
  hostname: string;
}

export async function executeAllowlistedJob(
  job: ShmJobEnvelope,
  context: DriverExecutionContext
): Promise<ShmJobResult> {
  if (!isSupportedJobKind(job.kind)) {
    return {
      jobId: job.id,
      kind: "dns.sync",
      nodeId: context.nodeId,
      status: "failed",
      summary: `Unsupported job kind: ${job.kind}`,
      completedAt: new Date().toISOString()
    };
  }

  return {
    jobId: job.id,
    kind: job.kind,
    nodeId: context.nodeId,
    status: "applied",
    summary: `Executed ${job.kind} on ${context.hostname}.`,
    details: {
      payloadKeys: Object.keys(job.payload)
    },
    completedAt: new Date().toISOString()
  };
}

export function createDemoJob(
  nodeId: string,
  kind: ShmJobKind = "proxy.render"
): ShmJobEnvelope {
  return {
    id: `job-${Date.now()}`,
    desiredStateVersion: `rev-${Date.now()}`,
    kind,
    nodeId,
    createdAt: new Date().toISOString(),
    payload: {
      requestedBy: "bootstrap",
      dryRun: true
    }
  };
}
