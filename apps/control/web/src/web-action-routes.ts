import {
  type AppReconcileRequest,
  type CodeServerUpdateRequest,
  type DatabaseReconcileRequest,
  type Fail2BanApplyRequest,
  type FirewallApplyRequest,
  type EnvironmentParameterMutationRequest,
  type JobDispatchResponse,
  type PackageInstallRequest,
  type PackageInventoryRefreshRequest
} from "@simplehost/control-contracts";

import { noticeLocation, noticeReturnTo } from "./api-client.js";
import { readFormBody, redirect } from "./request.js";
import { requireSessionToken } from "./route-helpers.js";
import type { WebRouteHandler } from "./web-route-context.js";

export const handleActionWebRoutes: WebRouteHandler = async ({
  request,
  response,
  url,
  api,
  config,
  requireSession
}) => {
  if (request.method === "GET" && url.pathname === "/inventory/export") {
    const token = await requireSessionToken({ requireSession });
    const yaml = await api.exportInventory(token);
    response.writeHead(200, {
      "content-type": "text/yaml; charset=utf-8",
      "content-disposition": 'attachment; filename="simplehost-desired-state.yaml"'
    });
    response.end(yaml);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/inventory-import") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const pathValue = form.get("path")?.trim() || config.inventory.importPath;
    if (!pathValue) {
      redirect(
        response,
        noticeLocation("Inventory import requires an explicit YAML path.", "error")
      );
      return true;
    }
    const result = await api.importInventory(token, pathValue);
    redirect(
      response,
      noticeLocation(
        `Imported inventory from ${result.sourcePath}. ${result.appCount} apps and ${result.databaseCount} databases refreshed.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/reconcile-run") {
    const token = await requireSessionToken({ requireSession });
    const result = await api.runReconciliation(token);
    redirect(
      response,
      noticeLocation(
        `Reconciliation generated ${result.generatedJobCount} job(s) and skipped ${result.skippedJobCount}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/operations-history-purge") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = form.get("returnTo") ?? "/";
    const result = await api.purgeOperationalHistory(token);

    redirect(
      response,
      noticeReturnTo(
        returnTo,
        `Purged ${result.deletedJobCount} job(s), ${result.deletedJobResultCount} result(s), ${result.deletedReconciliationRunCount} reconciliation run(s), and ${result.deletedAuditEventCount} audit event(s) older than ${result.retentionDays} day(s).`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/parameters/upsert") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = form.get("returnTo") ?? "/";
    const key = form.get("key")?.trim() ?? "";
    const value = form.get("value") ?? "";
    const keepSensitiveWhenBlank = (form.get("keepSensitiveWhenBlank")?.trim() ?? "") === "on";
    const requestBody: EnvironmentParameterMutationRequest = {
      key,
      description: form.get("description")?.trim() ?? "",
      sensitive: (form.get("sensitive")?.trim() ?? "") === "on"
    };

    if (!(keepSensitiveWhenBlank && value.length === 0)) {
      requestBody.value = value;
    }

    await api.upsertParameter(token, requestBody);

    redirect(
      response,
      noticeReturnTo(returnTo, `Saved parameter ${key}.`, "success")
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/parameters/delete") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = form.get("returnTo") ?? "/";
    const key = form.get("key")?.trim() ?? "";

    await api.deleteParameter(token, key);

    redirect(
      response,
      noticeReturnTo(returnTo, `Deleted parameter ${key}.`, "success")
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/zone-sync") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const zoneName = form.get("zoneName")?.trim() ?? "";
    const result = await api.syncZone(token, zoneName);
    redirect(
      response,
      noticeLocation(`Queued ${result.jobs.length} dns.sync job(s) for ${zoneName}.`, "success")
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/app-reconcile") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const slug = form.get("slug")?.trim() ?? "";
    const requestBody: AppReconcileRequest = {
      includeContainer: true,
      includeDns: true,
      includeProxy: true,
      includeStandbyProxy: true
    };
    const result = await api.reconcileApp(token, slug, requestBody);
    redirect(
      response,
      noticeLocation(`Queued ${result.jobs.length} job(s) for app ${slug}.`, "success")
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/app-render-proxy") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const slug = form.get("slug")?.trim() ?? "";
    const result = await api.renderAppProxy(token, slug);
    redirect(
      response,
      noticeLocation(`Queued ${result.jobs.length} proxy.render job(s) for ${slug}.`, "success")
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/database-reconcile") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const appSlug = form.get("appSlug")?.trim() ?? "";
    const password = form.get("desiredPassword")?.trim();
    const requestBody: DatabaseReconcileRequest = {};

    if (password) {
      requestBody.password = password;
    }

    const result = await api.reconcileDatabase(token, appSlug, requestBody);
    redirect(
      response,
      noticeLocation(
        `Queued ${result.jobs.length} database reconcile job(s) for ${appSlug}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/code-server-update") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const rpmUrl = form.get("rpmUrl")?.trim() ?? "";
    const expectedSha256 = form.get("expectedSha256")?.trim() || undefined;
    const targetScope = form.get("targetScope")?.trim() ?? "";
    const returnTo = form.get("returnTo") ?? "/";
    const requestBody: CodeServerUpdateRequest = {
      rpmUrl,
      expectedSha256
    };

    if (targetScope && targetScope !== "__all__") {
      requestBody.nodeIds = [targetScope];
    }

    const result = await api.updateCodeServer(token, requestBody);

    redirect(
      response,
      noticeReturnTo(
        returnTo,
        `Queued ${result.jobs.length} code-server update job(s).`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/package-inventory-refresh") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = form.get("returnTo") ?? "/";
    const nodeIds = form.getAll("nodeIds").map((value) => value.trim()).filter(Boolean);
    const requestBody: PackageInventoryRefreshRequest = {
      nodeIds: nodeIds.length > 0 ? nodeIds : undefined
    };

    const result = await api.refreshPackageInventory(token, requestBody);

    redirect(
      response,
      noticeReturnTo(
        returnTo,
        `Queued ${result.jobs.length} package inventory refresh job(s).`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/package-install") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = form.get("returnTo") ?? "/";
    const nodeIds = form.getAll("nodeIds").map((value) => value.trim()).filter(Boolean);
    const packageNames = (form.get("packageNames")?.trim() ?? "")
      .split(/[,\s]+/g)
      .map((value) => value.trim())
      .filter(Boolean);
    const rpmUrl = form.get("rpmUrl")?.trim() || undefined;
    const expectedSha256 = form.get("expectedSha256")?.trim() || undefined;
    const allowReinstall = (form.get("allowReinstall")?.trim() ?? "") === "on";
    const requestBody: PackageInstallRequest = {
      nodeIds: nodeIds.length > 0 ? nodeIds : undefined,
      packageNames: packageNames.length > 0 ? packageNames : undefined,
      rpmUrl,
      expectedSha256,
      allowReinstall
    };

    const result = await api.installPackages(token, requestBody);

    redirect(
      response,
      noticeReturnTo(
        returnTo,
        `Queued ${result.jobs.length} package install job(s).`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/firewall-apply") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = form.get("returnTo") ?? "/";
    const nodeIds = form.getAll("nodeIds").map((value) => value.trim()).filter(Boolean);
    const requestBody: FirewallApplyRequest = {
      nodeIds: nodeIds.length > 0 ? nodeIds : undefined,
      installPackage: (form.get("installPackage")?.trim() ?? "") === "on",
      enableService: (form.get("enableService")?.trim() ?? "") === "on",
      applyPublicZone: (form.get("applyPublicZone")?.trim() ?? "") === "on",
      applyWireGuardZone: (form.get("applyWireGuardZone")?.trim() ?? "") === "on",
      reload: (form.get("reload")?.trim() ?? "") === "on"
    };

    const result = await api.applyFirewall(token, requestBody);

    redirect(
      response,
      noticeReturnTo(
        returnTo,
        `Queued ${result.jobs.length} firewall apply job(s).`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/actions/fail2ban-apply") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = form.get("returnTo") ?? "/";
    const nodeIds = form.getAll("nodeIds").map((value) => value.trim()).filter(Boolean);
    const requestBody: Fail2BanApplyRequest = {
      nodeIds: nodeIds.length > 0 ? nodeIds : undefined,
      installPackage: (form.get("installPackage")?.trim() ?? "") === "on",
      applySshdJail: (form.get("applySshdJail")?.trim() ?? "") === "on",
      enableService: (form.get("enableService")?.trim() ?? "") === "on",
      restartService: (form.get("restartService")?.trim() ?? "") === "on"
    };

    const result = await api.applyFail2Ban(token, requestBody);

    redirect(
      response,
      noticeReturnTo(
        returnTo,
        `Queued ${result.jobs.length} Fail2Ban apply job(s).`,
        "success"
      )
    );
    return true;
  }

  return false;
};
