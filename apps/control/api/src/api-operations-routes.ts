import type {
  BackupRunRecordRequest,
  CodeServerUpdateRequest,
  Fail2BanApplyRequest,
  FirewallApplyRequest,
  NodeHealthSnapshot,
  PackageInstallRequest,
  PackageInventoryRefreshRequest,
  RustDeskOverview,
  RustDeskPublicConnectionInfo
} from "@simplehost/control-contracts";

import {
  readIntegerSearchParam,
  readJsonBody,
  writeJson
} from "./api-http.js";
import type { ApiRouteContext, ApiRouteHandler } from "./api-route-context.js";

function buildRustDeskOverview(
  nodeHealth: NodeHealthSnapshot[],
  context: Pick<ApiRouteContext, "config">
): RustDeskOverview {
  const nodesById = new Map(nodeHealth.map((node) => [node.nodeId, node] as const));
  const nodes: RustDeskOverview["nodes"] = [];

  const appendConfiguredNode = (
    nodeId: string | null,
    role: RustDeskOverview["nodes"][number]["role"],
    dnsTarget: string | null
  ): void => {
    if (!nodeId) {
      return;
    }

    const snapshot = nodesById.get(nodeId);
    nodes.push({
      nodeId,
      hostname: snapshot?.hostname ?? nodeId,
      role,
      dnsTarget: dnsTarget ?? undefined,
      lastSeenAt: snapshot?.lastSeenAt,
      rustdesk: snapshot?.rustdesk
    });
    nodesById.delete(nodeId);
  };

  appendConfiguredNode(
    context.config.rustdesk.primaryNodeId,
    "primary",
    context.config.rustdesk.primaryDnsTarget
  );
  appendConfiguredNode(
    context.config.rustdesk.secondaryNodeId,
    "secondary",
    context.config.rustdesk.secondaryDnsTarget
  );

  const additionalNodes = [...nodesById.values()]
    .filter((node) => node.rustdesk)
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId))
    .map((node) => ({
      nodeId: node.nodeId,
      hostname: node.hostname,
      lastSeenAt: node.lastSeenAt,
      rustdesk: node.rustdesk
    }));

  const combinedNodes = [...nodes, ...additionalNodes];
  const keyCandidates = combinedNodes
    .map((node) => node.rustdesk?.publicKey)
    .filter((value): value is string => Boolean(value));
  const uniqueKeys = new Set(keyCandidates);

  return {
    generatedAt: new Date().toISOString(),
    publicHostname: context.config.rustdesk.publicHostname ?? undefined,
    txtRecordFqdn: context.config.rustdesk.txtRecordFqdn ?? undefined,
    txtRecordValue:
      context.config.rustdesk.publicHostname && keyCandidates[0]
        ? `host=${context.config.rustdesk.publicHostname};key=${keyCandidates[0]}`
        : undefined,
    publicKey: keyCandidates[0],
    keyConsistency:
      keyCandidates.length < 2
        ? "unknown"
        : uniqueKeys.size === 1
          ? "match"
          : "mismatch",
    nodes: combinedNodes
  };
}

function buildRustDeskPublicConnectionInfo(
  nodeHealth: NodeHealthSnapshot[],
  context: Parameters<typeof buildRustDeskOverview>[1]
): RustDeskPublicConnectionInfo {
  const overview = buildRustDeskOverview(nodeHealth, context);

  return {
    generatedAt: overview.generatedAt,
    publicHostname: overview.publicHostname,
    publicKey: overview.publicKey,
    relayHostname: overview.publicHostname,
    txtRecordFqdn: overview.txtRecordFqdn,
    txtRecordValue: overview.txtRecordValue,
    status:
      overview.publicHostname && overview.publicKey ? "ready" : "incomplete"
  };
}

export const handleOperationsRoutes: ApiRouteHandler = async (context) => {
  const {
    request,
    response,
    url,
    bearerToken,
    controlPlaneStore
  } = context;

  if (request.method === "GET" && url.pathname === "/v1/platform/rustdesk") {
    writeJson(
      response,
      200,
      buildRustDeskOverview(
        await controlPlaneStore.getNodeHealth(bearerToken),
        context
      )
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/public/rustdesk") {
    writeJson(
      response,
      200,
      buildRustDeskPublicConnectionInfo(
        await controlPlaneStore.getRustDeskNodeHealth(),
        context
      )
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/jobs/history") {
    writeJson(
      response,
      200,
      await controlPlaneStore.listJobHistory(
        bearerToken,
        readIntegerSearchParam(url, "limit", 50)
      )
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/audit/events") {
    writeJson(
      response,
      200,
      await controlPlaneStore.listAuditEvents(
        bearerToken,
        readIntegerSearchParam(url, "limit", 50)
      )
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/backups/summary") {
    writeJson(
      response,
      200,
      await controlPlaneStore.getBackupsOverview(bearerToken)
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/packages/summary") {
    writeJson(
      response,
      200,
      await controlPlaneStore.getPackageInventory(bearerToken)
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/backups/runs") {
    writeJson(
      response,
      201,
      await controlPlaneStore.recordBackupRun(
        await readJsonBody<BackupRunRecordRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/packages/refresh") {
    writeJson(
      response,
      200,
      await controlPlaneStore.dispatchPackageInventoryRefresh(
        await readJsonBody<PackageInventoryRefreshRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/packages/install") {
    writeJson(
      response,
      200,
      await controlPlaneStore.dispatchPackageInstall(
        await readJsonBody<PackageInstallRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/firewall/apply") {
    writeJson(
      response,
      200,
      await controlPlaneStore.dispatchFirewallApply(
        await readJsonBody<FirewallApplyRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/fail2ban/apply") {
    writeJson(
      response,
      200,
      await controlPlaneStore.dispatchFail2BanApply(
        await readJsonBody<Fail2BanApplyRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/code-server/update") {
    writeJson(
      response,
      200,
      await controlPlaneStore.dispatchCodeServerUpdate(
        await readJsonBody<CodeServerUpdateRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  return false;
};
