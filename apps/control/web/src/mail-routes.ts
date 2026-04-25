import {
  noticeReturnTo
} from "./api-client.js";
import {
  parseMailAliasForm,
  parseMailboxForm,
  parseMailboxQuotaEditorForm,
  parseMailboxQuotaForm,
  parseMailDomainForm,
  parseMailPolicyForm
} from "./desired-state.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { readFormBody, redirect } from "./request.js";
import { requireSessionToken } from "./route-helpers.js";
import type { WebRouteHandler } from "./web-route-context.js";

function mailboxCredentialReturnTo(args: {
  returnTo: string | null;
  message: string;
  revealId?: string;
}): string {
  const location = noticeReturnTo(
    args.returnTo ?? buildDashboardViewUrl("mail"),
    args.message,
    "success"
  );

  if (!args.revealId) {
    return location;
  }

  const url = new URL(location, "http://localhost");
  url.searchParams.set("mailCredentialReveal", args.revealId);
  return `${url.pathname}${url.search}`;
}

function readReturnTo(form: URLSearchParams): string {
  return form.get("returnTo") ?? buildDashboardViewUrl("mail");
}

function mailErrorReturnTo(args: {
  returnTo: string;
  prefix: string;
  error: unknown;
}): string {
  const detail =
    args.error instanceof Error && args.error.message.trim().length > 0
      ? ` ${args.error.message.trim()}`
      : "";

  return noticeReturnTo(args.returnTo, `${args.prefix}${detail}`, "error");
}

export const handleMailRoute: WebRouteHandler = async ({
  api,
  request,
  response,
  url,
  requireSession
}) => {
  if (request.method === "POST" && url.pathname === "/resources/mail/domains/upsert") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = readReturnTo(form);

    try {
      const next = parseMailDomainForm(form);
      await api.upsertMailDomain(token, next);
      redirect(
        response,
        noticeReturnTo(returnTo, `Saved mail domain ${next.domainName}.`, "success")
      );
    } catch (error) {
      redirect(
        response,
        mailErrorReturnTo({
          returnTo,
          prefix: "Couldn't save mail domain.",
          error
        })
      );
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/policy/upsert") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = readReturnTo(form);

    try {
      const next = parseMailPolicyForm(form);
      await api.upsertMailPolicy(token, next);
      redirect(
        response,
        noticeReturnTo(returnTo, "Saved mail anti-spam policy.", "success")
      );
    } catch (error) {
      redirect(
        response,
        mailErrorReturnTo({
          returnTo,
          prefix: "Couldn't save mail anti-spam policy.",
          error
        })
      );
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/domains/delete") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = readReturnTo(form);

    try {
      const domainName = form.get("domainName")?.trim() ?? "";
      await api.deleteMailDomain(token, domainName);
      redirect(
        response,
        noticeReturnTo(returnTo, `Deleted mail domain ${domainName}.`, "success")
      );
    } catch (error) {
      redirect(
        response,
        mailErrorReturnTo({
          returnTo,
          prefix: "Couldn't delete mail domain.",
          error
        })
      );
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/mailboxes/upsert") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = readReturnTo(form);

    try {
      const next = parseMailboxForm(form);
      const quotaRequest = parseMailboxQuotaEditorForm(form, next.address);
      const result = await api.upsertMailbox(token, next);

      if (quotaRequest) {
        await api.upsertMailboxQuota(token, quotaRequest);
      } else {
        await api.deleteMailboxQuota(token, next.address);
      }

      redirect(
        response,
        mailboxCredentialReturnTo({
          returnTo,
          revealId: result.revealId,
          message:
            result.action === "generated"
              ? `Generated mailbox credential for ${next.address}.`
              : result.action === "rotated"
                ? `Rotated mailbox credential for ${next.address}.`
                : `Saved mailbox ${next.address}.`
        })
      );
    } catch (error) {
      redirect(
        response,
        mailErrorReturnTo({
          returnTo,
          prefix: "Couldn't save mailbox.",
          error
        })
      );
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/mailboxes/delete") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = readReturnTo(form);

    try {
      const address = form.get("address")?.trim() ?? "";
      await api.deleteMailbox(token, address);
      redirect(response, noticeReturnTo(returnTo, `Deleted mailbox ${address}.`, "success"));
    } catch (error) {
      redirect(
        response,
        mailErrorReturnTo({
          returnTo,
          prefix: "Couldn't delete mailbox.",
          error
        })
      );
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/mailboxes/reset-credential") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = readReturnTo(form);

    try {
      const mailboxAddress = form.get("mailboxAddress")?.trim() ?? "";
      await api.resetMailboxCredential(token, { mailboxAddress });
      redirect(
        response,
        noticeReturnTo(
          returnTo,
          `Marked mailbox credential as reset-required for ${mailboxAddress}.`,
          "success"
        )
      );
    } catch (error) {
      redirect(
        response,
        mailErrorReturnTo({
          returnTo,
          prefix: "Couldn't reset mailbox credential.",
          error
        })
      );
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/mailboxes/rotate-credential") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = readReturnTo(form);

    try {
      const mailboxAddress = form.get("mailboxAddress")?.trim() ?? "";
      const result = await api.rotateMailboxCredential(token, { mailboxAddress });
      redirect(
        response,
        mailboxCredentialReturnTo({
          returnTo,
          revealId: result.revealId,
          message: `Rotated mailbox credential for ${mailboxAddress}.`
        })
      );
    } catch (error) {
      redirect(
        response,
        mailErrorReturnTo({
          returnTo,
          prefix: "Couldn't rotate mailbox credential.",
          error
        })
      );
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/aliases/upsert") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = readReturnTo(form);

    try {
      const next = parseMailAliasForm(form);
      await api.upsertMailAlias(token, next);
      redirect(
        response,
        noticeReturnTo(returnTo, `Saved mail alias ${next.address}.`, "success")
      );
    } catch (error) {
      redirect(
        response,
        mailErrorReturnTo({
          returnTo,
          prefix: "Couldn't save mail alias.",
          error
        })
      );
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/aliases/delete") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = readReturnTo(form);

    try {
      const address = form.get("address")?.trim() ?? "";
      await api.deleteMailAlias(token, address);
      redirect(response, noticeReturnTo(returnTo, `Deleted mail alias ${address}.`, "success"));
    } catch (error) {
      redirect(
        response,
        mailErrorReturnTo({
          returnTo,
          prefix: "Couldn't delete mail alias.",
          error
        })
      );
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/quotas/upsert") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = readReturnTo(form);

    try {
      const next = parseMailboxQuotaForm(form);
      await api.upsertMailboxQuota(token, next);
      redirect(
        response,
        noticeReturnTo(returnTo, `Saved mailbox quota for ${next.mailboxAddress}.`, "success")
      );
    } catch (error) {
      redirect(
        response,
        mailErrorReturnTo({
          returnTo,
          prefix: "Couldn't save mailbox quota.",
          error
        })
      );
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/quotas/delete") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const returnTo = readReturnTo(form);

    try {
      const mailboxAddress = form.get("mailboxAddress")?.trim() ?? "";
      await api.deleteMailboxQuota(token, mailboxAddress);
      redirect(
        response,
        noticeReturnTo(returnTo, `Deleted mailbox quota for ${mailboxAddress}.`, "success")
      );
    } catch (error) {
      redirect(
        response,
        mailErrorReturnTo({
          returnTo,
          prefix: "Couldn't delete mailbox quota.",
          error
        })
      );
    }

    return true;
  }

  return false;
};
