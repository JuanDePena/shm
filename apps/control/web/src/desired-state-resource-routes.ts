import type { IncomingMessage, ServerResponse } from "node:http";

import {
  type PanelWebApi,
  noticeLocation
} from "./api-client.js";
import {
  parseAppForm,
  parseBackupPolicyForm,
  parseDatabaseForm,
  parseNodeForm,
  parseTenantForm,
  parseZoneForm,
  removeByKey,
  upsertByKey
} from "./desired-state.js";
import { readFormBody, redirect } from "./request.js";
import { requireSessionToken } from "./route-helpers.js";

export async function handleDesiredStateResourceRoute(
  api: PanelWebApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL
): Promise<boolean> {
  if (request.method === "POST" && url.pathname === "/resources/tenants/upsert") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const next = parseTenantForm(form);
    await api.mutateDesiredState(token, `web.tenant.upsert:${next.slug}`, (spec) => ({
      ...spec,
      tenants: upsertByKey(spec.tenants, next, (item) => item.slug, form.get("originalSlug") ?? undefined)
    }));
    redirect(response, noticeLocation(`Saved tenant ${next.slug}.`, "success"));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/tenants/delete") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const slug = form.get("originalSlug")?.trim() ?? form.get("slug")?.trim() ?? "";
    await api.mutateDesiredState(token, `web.tenant.delete:${slug}`, (spec) => ({
      ...spec,
      tenants: removeByKey(spec.tenants, slug, (item) => item.slug)
    }));
    redirect(response, noticeLocation(`Deleted tenant ${slug}.`, "success"));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/nodes/upsert") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const next = parseNodeForm(form);
    await api.mutateDesiredState(token, `web.node.upsert:${next.nodeId}`, (spec) => ({
      ...spec,
      nodes: upsertByKey(
        spec.nodes,
        next,
        (item) => item.nodeId,
        form.get("originalNodeId") ?? undefined
      )
    }));
    redirect(response, noticeLocation(`Saved node ${next.nodeId}.`, "success"));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/nodes/delete") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const nodeId = form.get("originalNodeId")?.trim() ?? form.get("nodeId")?.trim() ?? "";
    await api.mutateDesiredState(token, `web.node.delete:${nodeId}`, (spec) => ({
      ...spec,
      nodes: removeByKey(spec.nodes, nodeId, (item) => item.nodeId)
    }));
    redirect(response, noticeLocation(`Deleted node ${nodeId}.`, "success"));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/zones/upsert") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const next = parseZoneForm(form);
    await api.mutateDesiredState(token, `web.zone.upsert:${next.zoneName}`, (spec) => ({
      ...spec,
      zones: upsertByKey(
        spec.zones,
        next,
        (item) => item.zoneName,
        form.get("originalZoneName") ?? undefined
      )
    }));
    redirect(response, noticeLocation(`Saved zone ${next.zoneName}.`, "success"));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/zones/delete") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const zoneName =
      form.get("originalZoneName")?.trim() ?? form.get("zoneName")?.trim() ?? "";
    await api.mutateDesiredState(token, `web.zone.delete:${zoneName}`, (spec) => ({
      ...spec,
      zones: removeByKey(spec.zones, zoneName, (item) => item.zoneName)
    }));
    redirect(response, noticeLocation(`Deleted zone ${zoneName}.`, "success"));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/apps/upsert") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const next = parseAppForm(form);
    await api.mutateDesiredState(token, `web.app.upsert:${next.slug}`, (spec) => ({
      ...spec,
      apps: upsertByKey(spec.apps, next, (item) => item.slug, form.get("originalSlug") ?? undefined)
    }));
    redirect(response, noticeLocation(`Saved app ${next.slug}.`, "success"));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/apps/delete") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const slug = form.get("originalSlug")?.trim() ?? form.get("slug")?.trim() ?? "";
    await api.mutateDesiredState(token, `web.app.delete:${slug}`, (spec) => ({
      ...spec,
      apps: removeByKey(spec.apps, slug, (item) => item.slug)
    }));
    redirect(response, noticeLocation(`Deleted app ${slug}.`, "success"));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/databases/upsert") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const next = parseDatabaseForm(form);
    await api.mutateDesiredState(token, `web.database.upsert:${next.appSlug}`, (spec) => ({
      ...spec,
      databases: upsertByKey(
        spec.databases,
        next,
        (item) => item.appSlug,
        form.get("originalAppSlug") ?? undefined
      )
    }));
    redirect(response, noticeLocation(`Saved database ${next.appSlug}.`, "success"));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/databases/delete") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const appSlug =
      form.get("originalAppSlug")?.trim() ?? form.get("appSlug")?.trim() ?? "";
    await api.mutateDesiredState(token, `web.database.delete:${appSlug}`, (spec) => ({
      ...spec,
      databases: removeByKey(spec.databases, appSlug, (item) => item.appSlug)
    }));
    redirect(response, noticeLocation(`Deleted database ${appSlug}.`, "success"));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/backups/upsert") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const next = parseBackupPolicyForm(form);
    await api.mutateDesiredState(token, `web.backup-policy.upsert:${next.policySlug}`, (spec) => ({
      ...spec,
      backupPolicies: upsertByKey(
        spec.backupPolicies,
        next,
        (item) => item.policySlug,
        form.get("originalPolicySlug") ?? undefined
      )
    }));
    redirect(response, noticeLocation(`Saved backup policy ${next.policySlug}.`, "success"));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/backups/delete") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const policySlug =
      form.get("originalPolicySlug")?.trim() ?? form.get("policySlug")?.trim() ?? "";
    await api.mutateDesiredState(token, `web.backup-policy.delete:${policySlug}`, (spec) => ({
      ...spec,
      backupPolicies: removeByKey(spec.backupPolicies, policySlug, (item) => item.policySlug)
    }));
    redirect(response, noticeLocation(`Deleted backup policy ${policySlug}.`, "success"));
    return true;
  }

  return false;
}
