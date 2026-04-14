import type { IncomingMessage, ServerResponse } from "node:http";

import {
  type PanelWebApi,
  noticeReturnTo
} from "./api-client.js";
import {
  parseMailAliasForm,
  parseMailboxForm,
  parseMailboxQuotaForm,
  parseMailDomainForm
} from "./desired-state.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { readFormBody, redirect } from "./request.js";
import { requireSessionToken } from "./route-helpers.js";

export async function handleMailRoute(
  api: PanelWebApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL
): Promise<boolean> {
  if (request.method === "POST" && url.pathname === "/resources/mail/domains/upsert") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const next = parseMailDomainForm(form);
    await api.request("/v1/mail/domains", {
      method: "POST",
      token,
      body: next
    });
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Saved mail domain ${next.domainName}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/domains/delete") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const domainName = form.get("domainName")?.trim() ?? "";
    await api.request(`/v1/mail/domains/${encodeURIComponent(domainName)}`, {
      method: "DELETE",
      token
    });
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Deleted mail domain ${domainName}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/mailboxes/upsert") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const next = parseMailboxForm(form);
    await api.request("/v1/mail/mailboxes", {
      method: "POST",
      token,
      body: next
    });
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Saved mailbox ${next.address}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/mailboxes/delete") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const address = form.get("address")?.trim() ?? "";
    await api.request(`/v1/mail/mailboxes/${encodeURIComponent(address)}`, {
      method: "DELETE",
      token
    });
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Deleted mailbox ${address}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/aliases/upsert") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const next = parseMailAliasForm(form);
    await api.request("/v1/mail/aliases", {
      method: "POST",
      token,
      body: next
    });
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Saved mail alias ${next.address}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/aliases/delete") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const address = form.get("address")?.trim() ?? "";
    await api.request(`/v1/mail/aliases/${encodeURIComponent(address)}`, {
      method: "DELETE",
      token
    });
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Deleted mail alias ${address}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/quotas/upsert") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const next = parseMailboxQuotaForm(form);
    await api.request("/v1/mail/quotas", {
      method: "POST",
      token,
      body: next
    });
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Saved mailbox quota for ${next.mailboxAddress}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/quotas/delete") {
    const token = await requireSessionToken(request);
    const form = await readFormBody(request);
    const mailboxAddress = form.get("mailboxAddress")?.trim() ?? "";
    await api.request(`/v1/mail/quotas/${encodeURIComponent(mailboxAddress)}`, {
      method: "DELETE",
      token
    });
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Deleted mailbox quota for ${mailboxAddress}.`,
        "success"
      )
    );
    return true;
  }

  return false;
}
