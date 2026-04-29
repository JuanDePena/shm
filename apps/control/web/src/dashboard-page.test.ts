import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardData } from "./api-client.js";
import { renderDashboardPage } from "./dashboard-page.js";
import type { DashboardView } from "./dashboard-routing.js";
import { createMailReleaseBaselineData } from "./mail-release-baseline.js";
import type { OverviewMetricsSnapshot } from "./overview-metrics.js";

function createDashboardData(): DashboardData {
  const data = createMailReleaseBaselineData();
  data.currentUser = {
    userId: "user-1",
    email: "ops@example.com",
    displayName: "Ops",
    status: "active",
    globalRoles: ["platform_admin"],
    tenantMemberships: []
  };
  return data;
}

function createOverviewMetricsSnapshot(): OverviewMetricsSnapshot {
  return {
    generatedAt: "2026-04-29T00:00:00.000Z",
    sourceCode: {
      lineCount: 0,
      sizeBytes: 0,
      fileCount: 0,
      directoryCount: 0
    },
    system: {
      hostname: "control.example.net",
      cpuCores: 2,
      cpuLoadPercent: 0,
      memoryTotalBytes: 0,
      memoryFreeBytes: 0,
      storageTotalBytes: 0,
      storageAvailableBytes: 0,
      apiService: "active",
      uiService: "active",
      version: "test",
      currentIpv4: "127.0.0.1"
    }
  };
}

function renderView(data: DashboardData, view: DashboardView, focus?: string): string {
  return renderDashboardPage({
    currentPath: focus
      ? `/?view=${encodeURIComponent(view)}&focus=${encodeURIComponent(focus)}`
      : `/?view=${encodeURIComponent(view)}`,
    data,
    defaultImportPath: "/etc/simplehost/inventory.yaml",
    desiredStateTab: "desired-state-create",
    focus,
    locale: "en",
    overviewMetrics: createOverviewMetricsSnapshot(),
    version: "test",
    view
  });
}

function detailRegion(html: string, marker: string): string {
  const markerIndex = html.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing detail marker ${marker}`);
  return html.slice(markerIndex);
}

test("renderDashboardPage renders only the active workspace body", () => {
  const data = createDashboardData();
  data.nodeHealth[0] = {
    ...data.nodeHealth[0]!,
    logs: {
      checkedAt: "2026-04-29T00:00:00.000Z",
      entries: [
        {
          occurredAt: "2026-04-29T00:00:00.000Z",
          unit: "inactive.service",
          priority: 6,
          priorityLabel: "info",
          get message(): string {
            throw new Error("inactive logs workspace rendered");
          }
        }
      ]
    }
  } satisfies DashboardData["nodeHealth"][number];

  const html = renderDashboardPage({
    currentPath: "/?view=overview",
    data,
    defaultImportPath: "/etc/simplehost/inventory.yaml",
    desiredStateTab: "desired-state-create",
    locale: "en",
    overviewMetrics: createOverviewMetricsSnapshot(),
    version: "test",
    view: "overview"
  });

  assert.match(html, /id="section-overview"/);
  assert.doesNotMatch(html, /id="section-logs"/);
});

test("runtime workspaces select one row and render only that row detail", () => {
  const cases: Array<{
    name: string;
    view: DashboardView;
    focus: string;
    marker: string;
    selectedText: string;
    otherText: string;
    arrange: (data: DashboardData) => void;
  }> = [
    {
      name: "updates",
      view: "updates",
      focus: "mail-a:httpd:x86_64",
      marker: "Selected update",
      selectedText: "httpd",
      otherText: "dovecot",
      arrange: (data) => {
        data.nodeHealth[0] = {
          ...data.nodeHealth[0]!,
          packageUpdates: {
            checkedAt: "2026-04-29T00:00:00.000Z",
            updates: [
              {
                packageName: "httpd",
                arch: "x86_64",
                currentVersion: "2.4.57",
                currentRelease: "1.el10",
                availableVersion: "2.4.58",
                availableRelease: "1.el10",
                repository: "appstream",
                advisoryType: "security",
                advisoryId: "ELSA-2026:0001"
              },
              {
                packageName: "dovecot",
                arch: "x86_64",
                currentVersion: "2.3.21",
                currentRelease: "1.el10",
                availableVersion: "2.3.22",
                availableRelease: "1.el10",
                repository: "appstream"
              }
            ]
          }
        };
      }
    },
    {
      name: "reboots",
      view: "reboots",
      focus: "mail-a",
      marker: "Selected node reboot state",
      selectedText: "6.12.0-selected.el10.x86_64",
      otherText: "6.12.0-other.el10.x86_64",
      arrange: (data) => {
        data.nodeHealth[0] = {
          ...data.nodeHealth[0]!,
          rebootState: {
            kernelRelease: "6.12.0-selected.el10.x86_64",
            latestKernelRelease: "6.12.0-selected.el10.x86_64",
            bootId: "boot-selected",
            bootedAt: "2026-04-29T00:00:00.000Z",
            uptimeSeconds: 3600,
            needsReboot: false,
            checkedAt: "2026-04-29T00:00:00.000Z"
          }
        };
        data.nodeHealth[1] = {
          ...data.nodeHealth[0]!,
          nodeId: "mail-b",
          hostname: "mail-b.example.com",
          rebootState: {
            kernelRelease: "6.12.0-other.el10.x86_64",
            latestKernelRelease: "6.12.0-newer.el10.x86_64",
            bootId: "boot-other",
            bootedAt: "2026-04-29T00:00:00.000Z",
            uptimeSeconds: 7200,
            needsReboot: true,
            checkedAt: "2026-04-29T00:00:00.000Z"
          }
        };
      }
    },
    {
      name: "config",
      view: "config",
      focus: "mail-a:sshd",
      marker: "Selected config check",
      selectedText: "sshd -t",
      otherText: "httpd -t",
      arrange: (data) => {
        data.nodeHealth[0] = {
          ...data.nodeHealth[0]!,
          configValidation: {
            checkedAt: "2026-04-29T00:00:00.000Z",
            checks: [
              {
                checkId: "sshd",
                label: "OpenSSH daemon",
                command: "sshd -t",
                status: "passed",
                summary: "Configuration check passed.",
                checkedAt: "2026-04-29T00:00:00.000Z"
              },
              {
                checkId: "httpd",
                label: "Apache HTTP Server",
                command: "httpd -t",
                status: "failed",
                summary: "Syntax error",
                checkedAt: "2026-04-29T00:00:00.000Z"
              }
            ]
          }
        };
      }
    },
    {
      name: "time",
      view: "time",
      focus: "mail-a",
      marker: "Selected node time",
      selectedText: "America/Santo_Domingo",
      otherText: "UTC",
      arrange: (data) => {
        data.nodeHealth[0] = {
          ...data.nodeHealth[0]!,
          timeSync: {
            timezone: "America/Santo_Domingo",
            ntpEnabled: true,
            synchronized: true,
            localRtc: false,
            serviceName: "chronyd.service",
            serviceActive: true,
            trackingSummary: "Reference ID: selected",
            sources: [
              {
                marker: "^*",
                name: "192.0.2.10",
                stratum: 2,
                reach: 377,
                lastRx: "12",
                lastSample: "+1ms"
              }
            ],
            checkedAt: "2026-04-29T00:00:00.000Z"
          }
        };
        data.nodeHealth[1] = {
          ...data.nodeHealth[0]!,
          nodeId: "mail-b",
          hostname: "mail-b.example.com",
          timeSync: {
            timezone: "UTC",
            ntpEnabled: true,
            synchronized: false,
            localRtc: false,
            serviceName: "chronyd.service",
            serviceActive: false,
            sources: [],
            checkedAt: "2026-04-29T00:00:00.000Z"
          }
        };
      }
    },
    {
      name: "services",
      view: "services",
      focus: "mail-a:httpd.service",
      marker: "Selected node services",
      selectedText: "httpd.service",
      otherText: "dovecot.service",
      arrange: (data) => {
        data.nodeHealth[0] = {
          ...data.nodeHealth[0]!,
          services: {
            checkedAt: "2026-04-29T00:00:00.000Z",
            units: [
              {
                serviceName: "httpd.service",
                description: "Selected service",
                activeState: "active",
                subState: "running",
                unitFileState: "enabled",
                checkedAt: "2026-04-29T00:00:00.000Z"
              },
              {
                serviceName: "dovecot.service",
                description: "Other service",
                activeState: "active",
                subState: "running",
                unitFileState: "enabled",
                checkedAt: "2026-04-29T00:00:00.000Z"
              }
            ]
          }
        };
      }
    },
    {
      name: "logs",
      view: "logs",
      focus: "mail-a:2026-04-29T01:00:00.000Z:selected.service:selected log message",
      marker: "Selected node logs",
      selectedText: "selected log message",
      otherText: "other log message",
      arrange: (data) => {
        data.nodeHealth[0] = {
          ...data.nodeHealth[0]!,
          logs: {
            checkedAt: "2026-04-29T00:00:00.000Z",
            entries: [
              {
                occurredAt: "2026-04-29T01:00:00.000Z",
                unit: "selected.service",
                priority: 6,
                priorityLabel: "info",
                message: "selected log message"
              },
              {
                occurredAt: "2026-04-29T02:00:00.000Z",
                unit: "other.service",
                priority: 6,
                priorityLabel: "info",
                message: "other log message"
              }
            ]
          }
        };
      }
    },
    {
      name: "certificates",
      view: "certificates",
      focus: "mail-a:selected-cert",
      marker: "Selected node certificates",
      selectedText: "mail.example.com",
      otherText: "other.example.com",
      arrange: (data) => {
        data.nodeHealth[0] = {
          ...data.nodeHealth[0]!,
          tls: {
            checkedAt: "2026-04-29T00:00:00.000Z",
            certificates: [
              {
                name: "selected-cert",
                path: "/etc/letsencrypt/live/mail.example.com/fullchain.pem",
                issuer: "Test CA",
                notAfter: "2026-06-01T00:00:00.000Z",
                dnsNames: ["mail.example.com"],
                checkedAt: "2026-04-29T00:00:00.000Z"
              },
              {
                name: "other-cert",
                path: "/etc/letsencrypt/live/other.example.com/fullchain.pem",
                issuer: "Test CA",
                notAfter: "2026-06-01T00:00:00.000Z",
                dnsNames: ["other.example.com"],
                checkedAt: "2026-04-29T00:00:00.000Z"
              }
            ]
          }
        };
      }
    },
    {
      name: "storage",
      view: "storage",
      focus: "mail-a:/srv",
      marker: "Selected node storage",
      selectedText: "/srv",
      otherText: "/var",
      arrange: (data) => {
        data.nodeHealth[0] = {
          ...data.nodeHealth[0]!,
          storage: {
            checkedAt: "2026-04-29T00:00:00.000Z",
            filesystems: [
              {
                filesystem: "/dev/vda1",
                mountpoint: "/srv",
                type: "xfs",
                totalBytes: 100,
                usedBytes: 40,
                availableBytes: 60,
                usedPercent: 40
              },
              {
                filesystem: "/dev/vda2",
                mountpoint: "/var",
                type: "xfs",
                totalBytes: 100,
                usedBytes: 20,
                availableBytes: 80,
                usedPercent: 20
              }
            ],
            paths: []
          }
        };
      }
    },
    {
      name: "network",
      view: "network",
      focus: "mail-a:tcp:0.0.0.0:8080:selected-listener",
      marker: "Selected node network",
      selectedText: "8080",
      otherText: "9090",
      arrange: (data) => {
        data.nodeHealth[0] = {
          ...data.nodeHealth[0]!,
          network: {
            checkedAt: "2026-04-29T00:00:00.000Z",
            interfaces: [],
            routes: [],
            listeners: [
              {
                protocol: "tcp",
                localAddress: "0.0.0.0",
                port: 8080,
                state: "LISTEN",
                process: "selected-listener"
              },
              {
                protocol: "tcp",
                localAddress: "0.0.0.0",
                port: 9090,
                state: "LISTEN",
                process: "other-listener"
              }
            ]
          }
        };
      }
    },
    {
      name: "processes",
      view: "processes",
      focus: "mail-a:101:selected-process",
      marker: "Selected node processes",
      selectedText: "selected-process",
      otherText: "other-process",
      arrange: (data) => {
        data.nodeHealth[0] = {
          ...data.nodeHealth[0]!,
          processes: {
            checkedAt: "2026-04-29T00:00:00.000Z",
            loadAverage1m: 0.1,
            processes: [
              {
                pid: 101,
                user: "root",
                command: "selected-process",
                cpuPercent: 1,
                memoryPercent: 1
              },
              {
                pid: 202,
                user: "root",
                command: "other-process",
                cpuPercent: 1,
                memoryPercent: 1
              }
            ]
          }
        };
      }
    },
    {
      name: "containers",
      view: "containers",
      focus: "mail-a:container-selected",
      marker: "Selected node containers",
      selectedText: "selected-container",
      otherText: "other-container",
      arrange: (data) => {
        data.nodeHealth[0] = {
          ...data.nodeHealth[0]!,
          containers: {
            checkedAt: "2026-04-29T00:00:00.000Z",
            containers: [
              {
                id: "container-selected",
                name: "selected-container",
                image: "example:selected",
                state: "running",
                status: "Up",
                ports: [],
                networks: []
              },
              {
                id: "container-other",
                name: "other-container",
                image: "example:other",
                state: "running",
                status: "Up",
                ports: [],
                networks: []
              }
            ]
          }
        };
      }
    },
    {
      name: "timers",
      view: "timers",
      focus: "mail-a:selected.timer",
      marker: "Selected node timers",
      selectedText: "selected.timer",
      otherText: "other.timer",
      arrange: (data) => {
        data.nodeHealth[0] = {
          ...data.nodeHealth[0]!,
          timers: {
            checkedAt: "2026-04-29T00:00:00.000Z",
            timers: [
              {
                timerName: "selected.timer",
                activates: "selected.service",
                left: "1h"
              },
              {
                timerName: "other.timer",
                activates: "other.service",
                left: "2h"
              }
            ]
          }
        };
      }
    }
  ];

  for (const scenario of cases) {
    const data = createDashboardData();
    scenario.arrange(data);

    const html = renderView(data, scenario.view, scenario.focus);
    const detail = detailRegion(html, scenario.marker);

    assert.match(html, />Selected</, `${scenario.name} selected row badge`);
    assert.match(detail, new RegExp(scenario.selectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(
      detail,
      new RegExp(scenario.otherText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `${scenario.name} detail should only include the focused row`
    );
  }
});

test("runtime text-heavy tables use compact desktop columns", () => {
  assert.match(renderView(createDashboardData(), "logs"), /table-col-runtime-text-compact/);
  assert.match(renderView(createDashboardData(), "network"), /table-col-runtime-text-compact/);
  assert.match(renderView(createDashboardData(), "processes"), /table-col-runtime-text-compact/);
});

test("storage workspace shows selected node tracked path usage beside storage detail", () => {
  const data = createDashboardData();
  data.nodeHealth[0] = {
    ...data.nodeHealth[0]!,
    storage: {
      checkedAt: "2026-04-29T00:00:00.000Z",
      filesystems: [
        {
          filesystem: "/dev/vda1",
          mountpoint: "/srv",
          type: "xfs",
          totalBytes: 100,
          usedBytes: 40,
          availableBytes: 60,
          usedPercent: 40
        }
      ],
      paths: [
        {
          path: "/root",
          usedBytes: 10,
          mountpoint: "/",
          checkedAt: "2026-04-29T00:00:00.000Z"
        },
        {
          path: "/home",
          usedBytes: 20,
          mountpoint: "/",
          checkedAt: "2026-04-29T00:00:00.000Z"
        },
        {
          path: "/etc",
          usedBytes: 30,
          mountpoint: "/",
          checkedAt: "2026-04-29T00:00:00.000Z"
        },
        {
          path: "/opt",
          usedBytes: 40,
          mountpoint: "/",
          checkedAt: "2026-04-29T00:00:00.000Z"
        },
        {
          path: "/srv",
          usedBytes: 50,
          mountpoint: "/srv",
          checkedAt: "2026-04-29T00:00:00.000Z"
        },
        {
          path: "/var",
          usedBytes: 60,
          mountpoint: "/",
          checkedAt: "2026-04-29T00:00:00.000Z"
        },
        {
          path: "/custom",
          usedBytes: 70,
          mountpoint: "/",
          checkedAt: "2026-04-29T00:00:00.000Z"
        }
      ]
    }
  };

  const html = renderView(data, "storage", "mail-a:/srv");
  const detail = detailRegion(html, "Selected node storage");

  assert.match(detail, /Tracked paths/);
  for (const path of ["/root", "/home", "/etc", "/opt", "/srv", "/var", "/custom"]) {
    assert.match(detail, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
