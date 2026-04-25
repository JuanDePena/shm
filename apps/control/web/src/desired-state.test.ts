import assert from "node:assert/strict";
import test from "node:test";

import {
  parseMailboxForm,
  parseMailboxQuotaEditorForm,
  parseMailPolicyForm
} from "./desired-state.js";

test("parseMailPolicyForm parses anti-spam thresholds, sender lists, and rate limits", () => {
  const form = new URLSearchParams({
    rejectThreshold: "14",
    addHeaderThreshold: "5",
    greylistThreshold: "3",
    senderAllowlist: "Ops@Example.com\n@example.net",
    senderDenylist: "Block@Example.com, @spam.test",
    rateLimitBurst: "30",
    rateLimitPeriodSeconds: "60"
  });

  assert.deepEqual(parseMailPolicyForm(form), {
    rejectThreshold: 14,
    addHeaderThreshold: 5,
    greylistThreshold: 3,
    senderAllowlist: ["ops@example.com", "@example.net"],
    senderDenylist: ["block@example.com", "@spam.test"],
    rateLimit: {
      burst: 30,
      periodSeconds: 60
    }
  });
});

test("parseMailPolicyForm rejects greylist thresholds at or above add-header", () => {
  const form = new URLSearchParams({
    rejectThreshold: "12",
    addHeaderThreshold: "5",
    greylistThreshold: "5"
  });

  assert.throws(
    () => parseMailPolicyForm(form),
    /Greylist threshold must be below add-header threshold/i
  );
});

test("parseMailboxForm builds the mailbox address from mailbox name and domain on create", () => {
  const form = new URLSearchParams({
    localPart: "Notificaciones",
    domainName: "adudoc.com",
    primaryNodeId: "primary",
    standbyNodeId: "secondary",
    credentialStrategy: "manual",
    desiredPassword: "MailClave26!"
  });

  assert.deepEqual(parseMailboxForm(form), {
    address: "notificaciones@adudoc.com",
    domainName: "adudoc.com",
    localPart: "notificaciones",
    primaryNodeId: "primary",
    standbyNodeId: "secondary",
    desiredPassword: "MailClave26!",
    credentialState: "configured"
  });
});

test("parseMailboxForm derives mailbox name from the existing address on edit", () => {
  const form = new URLSearchParams({
    address: "WebMaster@adudoc.com",
    domainName: "adudoc.com",
    primaryNodeId: "primary",
    credentialStrategy: "keep",
    desiredPassword: "AdudocWeb27!"
  });

  assert.deepEqual(parseMailboxForm(form), {
    address: "webmaster@adudoc.com",
    domainName: "adudoc.com",
    localPart: "webmaster",
    primaryNodeId: "primary",
    standbyNodeId: undefined,
    desiredPassword: "AdudocWeb27!",
    credentialState: "configured"
  });
});

test("parseMailboxForm rejects addresses that do not match the selected domain", () => {
  const form = new URLSearchParams({
    address: "ops@example.net",
    domainName: "adudoc.com",
    primaryNodeId: "primary"
  });

  assert.throws(
    () => parseMailboxForm(form),
    /Mailbox address must stay under adudoc\.com/i
  );
});

test("parseMailboxQuotaEditorForm converts quota value and unit into bytes", () => {
  const form = new URLSearchParams({
    quotaValue: "1.5",
    quotaUnit: "gb"
  });

  assert.deepEqual(
    parseMailboxQuotaEditorForm(form, "notificaciones@adudoc.com"),
    {
      mailboxAddress: "notificaciones@adudoc.com",
      storageBytes: 1610612736
    }
  );
});

test("parseMailboxQuotaEditorForm returns null for unlimited quota", () => {
  const form = new URLSearchParams({
    quotaValue: "0",
    quotaUnit: "tb"
  });

  assert.equal(parseMailboxQuotaEditorForm(form, "webmaster@adudoc.com"), null);
});
