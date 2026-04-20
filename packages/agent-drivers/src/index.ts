import { execFile, execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readlink,
  rename,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import mysql from "mysql2/promise";
import { Pool } from "pg";

import {
  isPackageInstallPayload,
  isPackageInventoryCollectPayload,
  isContainerReconcilePayload,
  isCodeServerUpdatePayload,
  isDnsSyncPayload,
  isMailSyncPayload,
  isMariadbReconcilePayload,
  isPostgresReconcilePayload,
  isProxyRenderPayload,
  isSupportedJobKind,
  type ContainerReconcilePayload,
  type CodeServerServiceSnapshot,
  type CodeServerUpdatePayload,
  type DnsSyncPayload,
  type InstalledPackageSummary,
  type MailSyncPayload,
  type MariadbReconcilePayload,
  type PackageInstallPayload,
  type PackageInventoryCollectPayload,
  type PostgresReconcilePayload,
  type ProxyRenderPayload,
  type AgentJobEnvelope,
  type AgentJobKind,
  type AgentJobResult
} from "@simplehost/agent-contracts";
import {
  renderEnvironmentFile,
  renderApacheVhost,
  renderDnsZoneFile,
  renderDovecotMailConf,
  renderDovecotPasswd,
  renderMailFirewalldService,
  renderMailDesiredState,
  renderPostfixMainCf,
  renderPostfixMasterCf,
  renderPostfixVirtualAliases,
  renderPostfixVirtualDomains,
  renderPostfixVirtualMailboxes,
  renderQuadletContainerUnit,
  renderRoundcubeConfig,
  renderRspamdDkimSigningConf,
  renderRspamdRedisConf,
  renderRspamdSelectorsMap
} from "@simplehost/agent-renderers";

const execFileAsync = promisify(execFile);

export interface DriverExecutionContext {
  nodeId: string;
  hostname: string;
  stateDir: string;
  services: {
    containers: {
      quadletDir: string;
      envDir: string;
      stagingDir: string;
    };
    httpd: {
      sitesDir: string;
      stagingDir: string;
    };
    pdns: {
      apiUrl: string | null;
      apiKey: string | null;
      serverId: string;
      stagingDir: string;
    };
    postgresql: {
      adminUrl: string | null;
    };
    mariadb: {
      adminUrl: string | null;
    };
    codeServer: {
      serviceName: string;
      configPath: string;
      settingsPath: string;
      stagingDir: string;
    };
    packages: {
      stagingDir: string;
    };
    mail: {
      stagingDir: string;
      statePath: string;
      configRoot: string;
      vmailRoot: string;
      vmailUser: string;
      vmailGroup: string;
      dkimRoot: string;
      roundcubeRoot: string;
      roundcubeSharedRoot: string;
      roundcubeUser: string;
      roundcubeGroup: string;
      roundcubeConfigPath: string;
      roundcubeDatabasePath: string;
      roundcubePackageRoot: string;
      roundcubeDefaultHttpdConfPath: string;
      firewallServiceName: string;
      firewallServicePath: string;
      postfixServiceName: string;
      dovecotServiceName: string;
      rspamdServiceName: string;
      redisServiceName: string;
      postfixPackageTargets: string[];
      dovecotPackageTargets: string[];
      rspamdPackageTargets: string[];
      redisPackageTargets: string[];
      roundcubePackageTargets: string[];
    };
  };
}

function createCompletedResult(
  job: AgentJobEnvelope,
  context: DriverExecutionContext,
  status: AgentJobResult["status"],
  summary: string,
  details?: Record<string, unknown>
): AgentJobResult {
  return {
    jobId: job.id,
    kind: job.kind,
    nodeId: context.nodeId,
    status,
    summary,
    details,
    completedAt: new Date().toISOString()
  };
}

function createFailedResult(
  job: AgentJobEnvelope,
  context: DriverExecutionContext,
  summary: string,
  details?: Record<string, unknown>
): AgentJobResult {
  return createCompletedResult(job, context, "failed", summary, details);
}

function assertSafeIdentifier(value: string, label: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value)) {
    throw new Error(`${label} ${value} is not a safe SQL identifier.`);
  }
}

function assertSafeDnsLabel(value: string, label: string): void {
  if (value === "@") {
    return;
  }

  if (!/^[A-Za-z0-9_*]([A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?$/.test(value)) {
    throw new Error(`${label} ${value} is not a safe DNS label.`);
  }
}

function normalizeServiceUnitName(value: string): {
  baseName: string;
  unitName: string;
  quadletFileName: string;
} {
  const baseName = value.endsWith(".service") ? value.slice(0, -".service".length) : value;
  assertSafeServiceName(baseName, "Container service");

  return {
    baseName,
    unitName: `${baseName}.service`,
    quadletFileName: `${baseName}.container`
  };
}

function assertSafeServiceName(value: string, label: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/.test(value)) {
    throw new Error(`${label} ${value} is not a safe systemd name.`);
  }
}

function assertSafeContainerName(value: string, label: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/.test(value)) {
    throw new Error(`${label} ${value} is not a safe container name.`);
  }
}

function assertSafeEnvironmentKey(value: string): void {
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(value)) {
    throw new Error(`Environment key ${value} is not safe.`);
  }
}

function assertSafeSystemdFileName(value: string, suffix: string): void {
  if (!value.endsWith(suffix) || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(value)) {
    throw new Error(`File name ${value} is not a safe ${suffix} path.`);
  }
}

function assertSingleLineValue(value: string, label: string): void {
  if (/[\r\n]/.test(value)) {
    throw new Error(`${label} must be a single line.`);
  }
}

function assertAbsolutePathValue(value: string, label: string): void {
  if (!path.isAbsolute(value)) {
    throw new Error(`${label} must be an absolute path.`);
  }

  const normalized = path.posix.normalize(value);

  if (normalized !== value) {
    throw new Error(`${label} must not contain path traversal segments.`);
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function runOptionalCommand(
  command: string,
  args: string[]
): Promise<
  | { ran: false }
  | {
      ran: true;
      stdout: string;
      stderr: string;
    }
> {
  try {
    const result = await execFileAsync(command, args, {
      encoding: "utf8"
    });

    return {
      ran: true,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return { ran: false };
    }

    throw error;
  }
}

async function runCommandAllowFailure(
  command: string,
  args: string[]
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
}> {
  try {
    const result = await execFileAsync(command, args, {
      encoding: "utf8"
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      "stderr" in error
    ) {
      const candidate = error as {
        stdout?: string;
        stderr?: string;
        code?: number | string;
      };

      return {
        stdout: candidate.stdout ?? "",
        stderr: candidate.stderr ?? "",
        exitCode: typeof candidate.code === "number" ? candidate.code : null
      };
    }

    throw error;
  }
}

async function validateApacheConfiguration(): Promise<{
  command: string | null;
  skipped: boolean;
}> {
  for (const command of ["apachectl", "httpd"]) {
    const result = await runOptionalCommand(command, ["-t"]);

    if (!result.ran) {
      continue;
    }

    return {
      command,
      skipped: false
    };
  }

  return {
    command: null,
    skipped: true
  };
}

async function reloadApacheService(): Promise<{
  command: string | null;
  skipped: boolean;
}> {
  const candidates = [
    ["systemctl", ["reload", "httpd.service"]],
    ["apachectl", ["-k", "graceful"]],
    ["httpd", ["-k", "graceful"]]
  ] as const;

  for (const [command, args] of candidates) {
    const result = await runOptionalCommand(command, [...args]);

    if (!result.ran) {
      continue;
    }

    return {
      command: `${command} ${args.join(" ")}`,
      skipped: false
    };
  }

  return {
    command: null,
    skipped: true
  };
}

async function writeFileAtomic(targetPath: string, content: string): Promise<void> {
  const tempPath = `${targetPath}.tmp`;

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, targetPath);
}

async function writeRenderedFile(
  directoryPath: string,
  fileName: string,
  content: string
): Promise<string> {
  const targetPath = path.join(directoryPath, fileName);
  await writeFileAtomic(targetPath, content);
  return targetPath;
}

async function readOptionalTextFile(targetPath: string): Promise<string | undefined> {
  try {
    return await readFile(targetPath, "utf8");
  } catch {
    return undefined;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function upsertManagedTextBlock(
  existingContent: string,
  startMarker: string,
  endMarker: string,
  blockContent: string
): string {
  const managedBlock = `${startMarker}\n${blockContent.trimEnd()}\n${endMarker}`;
  const existingTrimmed = existingContent.trimEnd();
  const blockPattern = new RegExp(
    `${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`,
    "m"
  );

  if (blockPattern.test(existingContent)) {
    return `${existingContent.replace(blockPattern, managedBlock).trimEnd()}\n`;
  }

  if (existingTrimmed.length === 0) {
    return `${managedBlock}\n`;
  }

  return `${existingTrimmed}\n\n${managedBlock}\n`;
}

async function ensureManagedTextBlock(
  targetPath: string,
  startMarker: string,
  endMarker: string,
  blockContent: string
): Promise<void> {
  const existingContent = (await readOptionalTextFile(targetPath)) ?? "";
  const updatedContent = upsertManagedTextBlock(
    existingContent,
    startMarker,
    endMarker,
    blockContent
  );
  await writeFileAtomic(targetPath, updatedContent);
}

async function systemdUnitExists(serviceName: string): Promise<boolean> {
  const loadState = await runOptionalCommand("systemctl", [
    "show",
    serviceName,
    "--property=LoadState",
    "--value"
  ]);

  return loadState.ran && loadState.stdout.trim() !== "not-found";
}

async function rpmPackageInstalled(packageName: string): Promise<boolean> {
  const result = await runCommandAllowFailure("rpm", ["-q", packageName]);
  return result.exitCode === 0;
}

async function commandSucceeded(command: string, args: string[]): Promise<boolean> {
  const result = await runCommandAllowFailure(command, args);
  return result.exitCode === 0;
}

async function ensureSystemGroup(groupName: string): Promise<boolean> {
  if (await commandSucceeded("getent", ["group", groupName])) {
    return false;
  }

  await execFileAsync("groupadd", ["--system", groupName], {
    encoding: "utf8"
  });
  return true;
}

async function ensureSystemUser(
  userName: string,
  groupName: string,
  homePath: string
): Promise<boolean> {
  if (await commandSucceeded("getent", ["passwd", userName])) {
    return false;
  }

  await execFileAsync(
    "useradd",
    [
      "--system",
      "--home-dir",
      homePath,
      "--shell",
      "/sbin/nologin",
      "--gid",
      groupName,
      userName
    ],
    { encoding: "utf8" }
  );
  return true;
}

async function ensureOwnedPath(
  targetPath: string,
  userName: string,
  groupName: string
): Promise<void> {
  await execFileAsync("chown", ["-R", `${userName}:${groupName}`, targetPath], {
    encoding: "utf8"
  });
}

async function ensurePackageTargetsInstalled(
  targets: string[],
  serviceName?: string
): Promise<{
  configuredTargets: string[];
  installTriggered: boolean;
  installed: boolean;
}> {
  const configuredTargets = targets.filter((target) => target.trim().length > 0);

  if (serviceName && (await systemdUnitExists(serviceName))) {
    return {
      configuredTargets,
      installTriggered: false,
      installed: true
    };
  }

  if (configuredTargets.length === 0) {
    return {
      configuredTargets,
      installTriggered: false,
      installed: serviceName ? await systemdUnitExists(serviceName) : false
    };
  }

  const namedTargets = configuredTargets.filter(
    (target) => !target.includes("/") && !/^[a-z]+:\/\//i.test(target)
  );
  const allNamedTargetsInstalled =
    namedTargets.length > 0 &&
    (await Promise.all(namedTargets.map((target) => rpmPackageInstalled(target)))).every(Boolean);

  if (
    allNamedTargetsInstalled &&
    configuredTargets.length === namedTargets.length &&
    (!serviceName || (await systemdUnitExists(serviceName)))
  ) {
    return {
      configuredTargets,
      installTriggered: false,
      installed: true
    };
  }

  await execFileAsync("dnf", ["install", "-y", ...configuredTargets], {
    encoding: "utf8"
  });

  return {
    configuredTargets,
    installTriggered: true,
    installed: serviceName ? await systemdUnitExists(serviceName) : true
  };
}

async function ensureServiceEnabledAndRestarted(
  serviceName: string
): Promise<{ enabled: boolean; active: boolean }> {
  if (!(await systemdUnitExists(serviceName))) {
    return {
      enabled: false,
      active: false
    };
  }

  await execFileAsync("systemctl", ["enable", serviceName], {
    encoding: "utf8"
  });
  await execFileAsync("systemctl", ["restart", serviceName], {
    encoding: "utf8"
  });

  const enabled = await runCommandAllowFailure("systemctl", [
    "is-enabled",
    serviceName
  ]);
  const active = await runCommandAllowFailure("systemctl", [
    "is-active",
    serviceName
  ]);

  return {
    enabled: enabled.exitCode === 0,
    active: active.exitCode === 0
  };
}

function createRoundcubeDesKey(): string {
  return randomBytes(24).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 24);
}

async function ensureRoundcubeDesKey(targetPath: string): Promise<string> {
  const existing = (await readOptionalTextFile(targetPath))?.trim();

  if (existing && existing.length >= 24) {
    return existing;
  }

  const generated = createRoundcubeDesKey();
  await writeFileAtomic(targetPath, `${generated}\n`);
  await chmod(targetPath, 0o640);
  return generated;
}

async function ensureSymlinkPath(targetPath: string, symlinkTarget: string): Promise<void> {
  try {
    const current = await lstat(targetPath);

    if (current.isSymbolicLink()) {
      const currentTarget = await readlink(targetPath).catch(() => undefined);
      if (currentTarget === symlinkTarget) {
        return;
      }
      await rm(targetPath, { force: true });
    } else {
      await rm(targetPath, { recursive: true, force: true });
    }
  } catch {
    // Fresh path.
  }

  await symlink(symlinkTarget, targetPath);
}

async function ensureMailFirewallPolicy(context: DriverExecutionContext): Promise<{
  serviceName: string;
  configured: boolean;
  skippedReason?: string;
}> {
  const firewallCmd = await runOptionalCommand("firewall-cmd", ["--state"]);

  if (!firewallCmd.ran) {
    return {
      serviceName: context.services.mail.firewallServiceName,
      configured: false,
      skippedReason: "firewall-cmd not available"
    };
  }

  if (firewallCmd.stdout.trim() !== "running") {
    return {
      serviceName: context.services.mail.firewallServiceName,
      configured: false,
      skippedReason: "firewalld not running"
    };
  }

  await writeFileAtomic(
    context.services.mail.firewallServicePath,
    renderMailFirewalldService(context.services.mail.firewallServiceName)
  );
  await execFileAsync(
    "firewall-cmd",
    ["--permanent", "--add-service", context.services.mail.firewallServiceName],
    { encoding: "utf8" }
  );
  await execFileAsync("firewall-cmd", ["--reload"], {
    encoding: "utf8"
  });

  return {
    serviceName: context.services.mail.firewallServiceName,
    configured: true
  };
}

async function applyPostfixMainCfConfiguration(content: string): Promise<void> {
  const settings = content
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  for (const setting of settings) {
    await execFileAsync("postconf", ["-e", setting], {
      encoding: "utf8"
    });
  }
}

async function applyPostfixMasterCfConfiguration(content: string): Promise<void> {
  const startMarker = "# --- BEGIN SimpleHostMan managed postfix services ---";
  const endMarker = "# --- END SimpleHostMan managed postfix services ---";

  await ensureManagedTextBlock("/etc/postfix/master.cf", startMarker, endMarker, content);
}

async function ensureDovecotLiveConfiguration(sourcePath: string): Promise<void> {
  await ensureSymlinkPath("/etc/dovecot/conf.d/90-simplehost-mail.conf", sourcePath);
}

function deriveMailHomePath(
  vmailRoot: string,
  domainName: string,
  localPart: string
): string {
  return path.join(vmailRoot, domainName, localPart);
}

function deriveMaildirPath(
  vmailRoot: string,
  domainName: string,
  localPart: string
): string {
  return path.join(deriveMailHomePath(vmailRoot, domainName, localPart), "Maildir");
}

async function ensureMaildirScaffold(maildirPath: string): Promise<void> {
  await mkdir(path.join(maildirPath, "cur"), { recursive: true });
  await mkdir(path.join(maildirPath, "new"), { recursive: true });
  await mkdir(path.join(maildirPath, "tmp"), { recursive: true });
}

function deriveMailboxPasswordSalt(address: string): string {
  return createHash("sha256").update(address).digest("hex").slice(0, 16);
}

function generateSha512CryptHash(address: string, password: string): string {
  try {
    const result = execFileSync(
      "openssl",
      ["passwd", "-6", "-salt", deriveMailboxPasswordSalt(address), "-stdin"],
      {
        input: `${password}\n`,
        encoding: "utf8"
      }
    );

    return result.trim();
  } catch (error) {
    throw new Error(
      `Unable to hash password for ${address}: ${
        error instanceof Error ? error.message : "openssl passwd failed."
      }`
    );
  }
}

function extractPemBody(pem: string): string {
  return pem
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.startsWith("-----BEGIN ") &&
        !line.startsWith("-----END ")
    )
    .join("");
}

interface DkimMaterial {
  privateKeyPath: string;
  publicKeyPath?: string;
  dnsTxtPath?: string;
  dnsTxtValue?: string;
  available: boolean;
  generated: boolean;
}

async function ensureDkimMaterial(
  domainName: string,
  selector: string,
  dkimRoot: string
): Promise<DkimMaterial> {
  const domainRoot = path.join(dkimRoot, domainName);
  const privateKeyPath = path.join(domainRoot, `${selector}.key`);
  const publicKeyPath = path.join(domainRoot, `${selector}.pub.pem`);
  const dnsTxtPath = path.join(domainRoot, `${selector}.dns.txt`);
  let generated = false;

  await mkdir(domainRoot, { recursive: true });

  if (!(await pathExists(privateKeyPath))) {
    try {
      execFileSync("openssl", ["genrsa", "-out", privateKeyPath, "2048"], {
        encoding: "utf8"
      });
      generated = true;
    } catch {
      return {
        privateKeyPath,
        available: false,
        generated: false
      };
    }
  }

  try {
    const publicPem = execFileSync(
      "openssl",
      ["rsa", "-in", privateKeyPath, "-pubout"],
      { encoding: "utf8" }
    );
    const publicKeyBody = extractPemBody(publicPem);
    const dnsTxtValue = `v=DKIM1; k=rsa; p=${publicKeyBody}`;

    await writeFileAtomic(publicKeyPath, publicPem);
    await writeFileAtomic(dnsTxtPath, dnsTxtValue);

    return {
      privateKeyPath,
      publicKeyPath,
      dnsTxtPath,
      dnsTxtValue,
      available: true,
      generated
    };
  } catch {
    return {
      privateKeyPath,
      available: false,
      generated
    };
  }
}

async function initializeSqliteDatabase(
  databasePath: string,
  schemaPath: string
): Promise<boolean> {
  if (await pathExists(databasePath)) {
    return false;
  }

  const schema = await readFile(schemaPath, "utf8");
  await mkdir(path.dirname(databasePath), { recursive: true });
  execFileSync("sqlite3", [databasePath], {
    encoding: "utf8",
    input: schema
  });
  await chmod(databasePath, 0o660);
  return true;
}

async function disableRoundcubeDefaultHttpdConf(defaultConfPath: string): Promise<string | undefined> {
  if (!(await pathExists(defaultConfPath))) {
    return undefined;
  }

  const disabledPath = `${defaultConfPath}.simplehost-disabled`;

  if (!(await pathExists(disabledPath))) {
    await rename(defaultConfPath, disabledPath);
  }

  return disabledPath;
}

async function ensureRoundcubeDeployment(
  context: DriverExecutionContext,
  payload: MailSyncPayload
): Promise<{
  packageTargets: string[];
  packageRoot: string;
  configPath: string;
  databasePath: string;
  deploymentMode: "packaged" | "placeholder" | "absent";
  sharedRoot: string;
  disabledHttpdConfPath?: string;
}> {
  const packageResult = await ensurePackageTargetsInstalled(
    context.services.mail.roundcubePackageTargets
  );
  const packageRoot = context.services.mail.roundcubePackageRoot;
  const configPath = context.services.mail.roundcubeConfigPath;
  const databasePath = context.services.mail.roundcubeDatabasePath;
  const sharedRoot = context.services.mail.roundcubeSharedRoot;
  const schemaPath = path.join(packageRoot, "SQL", "sqlite.initial.sql");
  const tempDir = path.join(sharedRoot, "temp");
  const logDir = path.join(sharedRoot, "logs");
  const desKeyPath = path.join(sharedRoot, "roundcube.des.key");

  if (!(await pathExists(packageRoot)) || !(await pathExists(schemaPath))) {
    return {
      packageTargets: packageResult.configuredTargets,
      packageRoot,
      configPath,
      databasePath,
      deploymentMode: "absent",
      sharedRoot
    };
  }

  await mkdir(sharedRoot, { recursive: true });
  await mkdir(tempDir, { recursive: true });
  await mkdir(logDir, { recursive: true });

  const desKey = await ensureRoundcubeDesKey(desKeyPath);
  await initializeSqliteDatabase(databasePath, schemaPath);
  await writeFileAtomic(
    configPath,
    renderRoundcubeConfig({
      databasePath,
      tempDir,
      logDir,
      productName: "SimpleHostMan Webmail",
      desKey
    })
  );

  for (const domain of payload.domains) {
    const roundcubeDomainRoot = path.join(
      context.services.mail.roundcubeRoot,
      domain.tenantSlug,
      domain.domainName
    );
    const webmailDocumentRoot = path.join(roundcubeDomainRoot, "public");
    await mkdir(roundcubeDomainRoot, { recursive: true });
    await ensureSymlinkPath(webmailDocumentRoot, packageRoot);
  }

  return {
    packageTargets: packageResult.configuredTargets,
    packageRoot,
    configPath,
    databasePath,
    deploymentMode: "packaged",
    sharedRoot,
    disabledHttpdConfPath: await disableRoundcubeDefaultHttpdConf(
      context.services.mail.roundcubeDefaultHttpdConfPath
    )
  };
}

function extractCodeServerVersion(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/\b\d+\.\d+\.\d+\b/);
  return match?.[0];
}

async function inspectCodeServerService(
  context: DriverExecutionContext
): Promise<CodeServerServiceSnapshot> {
  const checkedAt = new Date().toISOString();
  const serviceName = context.services.codeServer.serviceName;
  const enabledState = await runOptionalCommand("systemctl", ["is-enabled", serviceName]);
  const activeState = await runOptionalCommand("systemctl", ["is-active", serviceName]);
  const rpmVersionOutput = await runOptionalCommand("rpm", [
    "-q",
    "code-server",
    "--qf",
    "%{VERSION}-%{RELEASE}\n"
  ]);
  const versionOutput = await runOptionalCommand("code-server", ["--version"]);
  const configContent = await readOptionalTextFile(context.services.codeServer.configPath);
  const settingsContent = await readOptionalTextFile(context.services.codeServer.settingsPath);

  return {
    serviceName,
    enabled: enabledState.ran && enabledState.stdout.trim() !== "disabled",
    active: activeState.ran && activeState.stdout.trim() === "active",
    version:
      extractCodeServerVersion(rpmVersionOutput.ran ? rpmVersionOutput.stdout.trim() : undefined) ??
      extractCodeServerVersion(versionOutput.ran ? versionOutput.stdout.trim() : undefined),
    bindAddress: /^bind-addr:\s*(.+)$/m.exec(configContent ?? "")?.[1]?.trim(),
    authMode: /^auth:\s*(.+)$/m.exec(configContent ?? "")?.[1]?.trim(),
    settingsProfileHash: settingsContent
      ? createHash("sha256").update(settingsContent).digest("hex").slice(0, 12)
      : undefined,
    checkedAt
  };
}

function assertSafeRpmUrl(value: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid RPM URL: ${value}`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsupported RPM URL protocol: ${parsed.protocol}`);
  }

  return parsed;
}

function quotePostgresIdentifier(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function quotePostgresLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function absoluteDnsName(zoneName: string, recordName: string): string {
  const normalizedZone = zoneName.replace(/\.$/, "");

  if (recordName === "@") {
    return `${normalizedZone}.`;
  }

  return `${recordName.replace(/\.$/, "")}.${normalizedZone}.`;
}

interface PowerDnsZoneSnapshot {
  id: string;
  rrsets?: Array<Record<string, unknown>>;
}

function normalizePowerDnsRecordContent(value: string, type: string): string {
  const trimmed = value.trim();

  if (type === "NS" || type === "CNAME") {
    return trimmed.replace(/\.$/, "").toLowerCase();
  }

  if (type === "MX") {
    const parts = trimmed.split(/\s+/, 2);

    if (parts.length === 2) {
      return `${parts[0]} ${parts[1]!.replace(/\.$/, "").toLowerCase()}`;
    }
  }

  return trimmed;
}

async function verifyPowerDnsZone(
  payload: DnsSyncPayload,
  context: DriverExecutionContext
): Promise<{ rrsetCount: number; validatedRecordCount: number }> {
  const zoneState = await readPowerDnsZone(payload, context);

  if (!zoneState.exists || !zoneState.zone) {
    throw new Error(`PowerDNS zone ${payload.zoneName} could not be read back after PATCH.`);
  }

  const actualGroups = new Map<string, Set<string>>();

  for (const rrset of zoneState.zone.rrsets ?? []) {
    const nameValue = typeof rrset.name === "string" ? rrset.name : "";
    const typeValue = typeof rrset.type === "string" ? rrset.type : "";
    const recordsValue = Array.isArray(rrset.records) ? rrset.records : [];
    const groupKey = `${nameValue.replace(/\.$/, "").toLowerCase()}:${typeValue}`;
    const contents = actualGroups.get(groupKey) ?? new Set<string>();

    for (const record of recordsValue) {
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        continue;
      }

      const contentValue = (record as Record<string, unknown>).content;

      if (typeof contentValue === "string") {
        contents.add(normalizePowerDnsRecordContent(contentValue, typeValue));
      }
    }

    actualGroups.set(groupKey, contents);
  }

  const expectedGroups = new Map<string, Set<string>>();

  for (const record of payload.records) {
    const absoluteName = absoluteDnsName(payload.zoneName, record.name);
    const key = `${absoluteName.replace(/\.$/, "").toLowerCase()}:${record.type}`;
    const contents = expectedGroups.get(key) ?? new Set<string>();
    contents.add(normalizePowerDnsRecordContent(record.value, record.type));
    expectedGroups.set(key, contents);
  }

  const nsKey = `${payload.zoneName.replace(/\.$/, "").toLowerCase()}:NS`;
  const nsContents = expectedGroups.get(nsKey) ?? new Set<string>();

  for (const nameserver of payload.nameservers) {
    nsContents.add(normalizePowerDnsRecordContent(nameserver, "NS"));
  }

  expectedGroups.set(nsKey, nsContents);

  for (const [groupKey, expectedContents] of expectedGroups) {
    const actualContents = actualGroups.get(groupKey);

    if (!actualContents) {
      throw new Error(`PowerDNS verification failed: missing rrset ${groupKey}.`);
    }

    for (const content of expectedContents) {
      if (!actualContents.has(content)) {
        throw new Error(
          `PowerDNS verification failed: ${groupKey} is missing content ${content}.`
        );
      }
    }
  }

  return {
    rrsetCount: (zoneState.zone.rrsets ?? []).length,
    validatedRecordCount: payload.records.length + payload.nameservers.length
  };
}

async function readPowerDnsZone(
  payload: DnsSyncPayload,
  context: DriverExecutionContext
): Promise<{ exists: boolean; zone?: PowerDnsZoneSnapshot }> {
  const { apiUrl, apiKey, serverId } = context.services.pdns;

  if (!apiUrl || !apiKey) {
    throw new Error("SIMPLEHOST_PDNS_API_URL and SIMPLEHOST_PDNS_API_KEY are required.");
  }

  const zoneId = `${payload.zoneName.replace(/\.$/, "")}.`;
  const zoneEndpoint = new URL(
    `/api/v1/servers/${encodeURIComponent(serverId)}/zones/${encodeURIComponent(zoneId)}`,
    apiUrl
  );
  const response = await fetch(zoneEndpoint, {
    headers: {
      "x-api-key": apiKey
    }
  });

  if (response.status === 404) {
    return {
      exists: false
    };
  }

  if (!response.ok) {
    throw new Error(
      `PowerDNS zone lookup failed (${response.status}): ${await response.text()}`
    );
  }

  return {
    exists: true,
    zone: (await response.json()) as PowerDnsZoneSnapshot
  };
}

async function ensurePowerDnsZone(
  payload: DnsSyncPayload,
  context: DriverExecutionContext
): Promise<{ created: boolean }> {
  const { apiUrl, apiKey, serverId } = context.services.pdns;

  if (!apiUrl || !apiKey) {
    throw new Error("SIMPLEHOST_PDNS_API_URL and SIMPLEHOST_PDNS_API_KEY are required.");
  }

  const zoneId = `${payload.zoneName.replace(/\.$/, "")}.`;
  const createEndpoint = new URL(
    `/api/v1/servers/${encodeURIComponent(serverId)}/zones`,
    apiUrl
  );
  const zoneState = await readPowerDnsZone(payload, context);

  if (!zoneState.exists) {
    const createResponse = await fetch(createEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        name: zoneId,
        kind: "Native",
        nameservers: payload.nameservers.map((nameserver) => `${nameserver}.`)
      })
    });

    if (!createResponse.ok) {
      throw new Error(
        `PowerDNS zone creation failed (${createResponse.status}): ${await createResponse.text()}`
      );
    }

    return {
      created: true
    };
  }

  return {
    created: false
  };
}

async function upsertPowerDnsRecords(
  payload: DnsSyncPayload,
  context: DriverExecutionContext
): Promise<{ createdZone: boolean }> {
  const { apiUrl, apiKey, serverId } = context.services.pdns;

  if (!apiUrl || !apiKey) {
    throw new Error("SIMPLEHOST_PDNS_API_URL and SIMPLEHOST_PDNS_API_KEY are required.");
  }

  const zoneState = await ensurePowerDnsZone(payload, context);

  const zoneId = `${payload.zoneName.replace(/\.$/, "")}.`;
  const zoneEndpoint = new URL(
    `/api/v1/servers/${encodeURIComponent(serverId)}/zones/${encodeURIComponent(zoneId)}`,
    apiUrl
  );
  const recordGroups = new Map<
    string,
    {
      name: string;
      type: string;
      ttl: number;
      records: Array<{ content: string; disabled: boolean }>;
    }
  >();

  for (const record of payload.records) {
    const name = absoluteDnsName(payload.zoneName, record.name);
    const groupKey = `${name}:${record.type}:${record.ttl}`;
    const group = recordGroups.get(groupKey) ?? {
      name,
      type: record.type,
      ttl: record.ttl,
      records: []
    };

    group.records.push({
      content: record.value,
      disabled: false
    });
    recordGroups.set(groupKey, group);
  }

  recordGroups.set(`ns:${zoneId}`, {
    name: zoneId,
    type: "NS",
    ttl: 300,
    records: payload.nameservers.map((nameserver) => ({
      content: `${nameserver}.`,
      disabled: false
    }))
  });

  const patchResponse = await fetch(zoneEndpoint, {
    method: "PATCH",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      rrsets: [...recordGroups.values()].map((group) => ({
        name: group.name,
        type: group.type,
        ttl: group.ttl,
        changetype: "REPLACE",
        records: group.records
      }))
    })
  });

  if (!patchResponse.ok) {
    throw new Error(
      `PowerDNS zone update failed (${patchResponse.status}): ${await patchResponse.text()}`
    );
  }

  return {
    createdZone: zoneState.created
  };
}

function validateDnsPayload(payload: DnsSyncPayload): void {
  if (!/^[A-Za-z0-9.-]+$/.test(payload.zoneName.replace(/\.$/, ""))) {
    throw new Error(`Zone name ${payload.zoneName} is invalid.`);
  }

  if (payload.nameservers.length < 2) {
    throw new Error(`Zone ${payload.zoneName} must declare at least two nameservers.`);
  }

  for (const nameserver of payload.nameservers) {
    if (!/^[A-Za-z0-9.-]+$/.test(nameserver.replace(/\.$/, ""))) {
      throw new Error(`Nameserver ${nameserver} is invalid.`);
    }
  }

  for (const record of payload.records) {
    assertSafeDnsLabel(record.name, `Record name for ${payload.zoneName}`);

    if (record.ttl <= 0) {
      throw new Error(`Record TTL for ${payload.zoneName} must be positive.`);
    }
  }
}

function validateContainerPayload(payload: ContainerReconcilePayload): void {
  normalizeServiceUnitName(payload.serviceName);
  assertSafeContainerName(payload.containerName, "Container");
  assertSingleLineValue(payload.image, "Container image");

  if (!/^[A-Za-z0-9./:@_-]+$/.test(payload.image)) {
    throw new Error(`Container image ${payload.image} is not safe.`);
  }

  if (payload.description) {
    assertSingleLineValue(payload.description, "Container description");
  }

  if (payload.exec) {
    assertSingleLineValue(payload.exec, "Container exec");
  }

  if (payload.network) {
    assertSingleLineValue(payload.network, "Container network");

    if (!/^[A-Za-z0-9_.:-]+$/.test(payload.network)) {
      throw new Error(`Container network ${payload.network} is not safe.`);
    }
  }

  if (payload.network === "host" && (payload.publishPorts?.length ?? 0) > 0) {
    throw new Error("Host-networked containers must not also declare PublishPort.");
  }

  for (const publishPort of payload.publishPorts ?? []) {
    assertSingleLineValue(publishPort, "Container publish port");

    if (!/^[A-Za-z0-9.:/_-]+$/.test(publishPort)) {
      throw new Error(`Container publish port ${publishPort} is not safe.`);
    }
  }

  for (const volume of payload.volumes ?? []) {
    assertSingleLineValue(volume, "Container volume");

    const [sourcePath, targetPath] = volume.split(":");

    if (!sourcePath || !targetPath) {
      throw new Error(`Container volume ${volume} must include source and target paths.`);
    }

    assertAbsolutePathValue(sourcePath, `Volume source for ${volume}`);
    assertAbsolutePathValue(targetPath, `Volume target for ${volume}`);
  }

  for (const directoryPath of payload.hostDirectories ?? []) {
    assertAbsolutePathValue(directoryPath, `Host directory ${directoryPath}`);
  }

  if (payload.envFileName && !payload.environment) {
    throw new Error("Container envFileName requires environment values.");
  }

  if (payload.envFileName) {
    assertSafeSystemdFileName(payload.envFileName, ".env");
  }

  for (const [key, value] of Object.entries(payload.environment ?? {})) {
    assertSafeEnvironmentKey(key);
    assertSingleLineValue(value, `Environment value for ${key}`);
  }

  if (payload.restartSec !== undefined) {
    if (!Number.isFinite(payload.restartSec) || payload.restartSec < 0) {
      throw new Error("Container restartSec must be a non-negative number.");
    }
  }

  if (payload.wantedBy) {
    assertSingleLineValue(payload.wantedBy, "Container wantedBy target");

    if (!/^[A-Za-z0-9_.@-]+$/.test(payload.wantedBy)) {
      throw new Error(`Container wantedBy target ${payload.wantedBy} is not safe.`);
    }
  }
}

function validateMailPayload(payload: MailSyncPayload): void {
  const seenDomains = new Set<string>();

  for (const domain of payload.domains) {
    assertSingleLineValue(domain.domainName, "Mail domain");
    assertSingleLineValue(domain.tenantSlug, "Mail tenant");
    assertSingleLineValue(domain.zoneName, "Mail zone");
    assertSingleLineValue(domain.mailHost, "Mail host");
    assertSingleLineValue(domain.webmailHostname, "Mail webmail hostname");
    assertSingleLineValue(domain.dkimSelector, "Mail DKIM selector");

    if (seenDomains.has(`${domain.domainName}:${domain.deliveryRole}`)) {
      throw new Error(
        `Duplicate mail domain payload entry for ${domain.domainName} (${domain.deliveryRole}).`
      );
    }

    seenDomains.add(`${domain.domainName}:${domain.deliveryRole}`);

    for (const mailbox of domain.mailboxes) {
      assertSingleLineValue(mailbox.address, `Mailbox address for ${domain.domainName}`);
      assertSingleLineValue(mailbox.localPart, `Mailbox local part for ${domain.domainName}`);

      if (mailbox.desiredPassword !== undefined) {
        assertSingleLineValue(
          mailbox.desiredPassword,
          `Desired password for ${mailbox.address}`
        );
      }
    }

    for (const alias of domain.aliases) {
      assertSingleLineValue(alias.address, `Alias address for ${domain.domainName}`);
      assertSingleLineValue(alias.localPart, `Alias local part for ${domain.domainName}`);

      if (alias.destinations.length === 0) {
        throw new Error(`Mail alias ${alias.address} must include at least one destination.`);
      }

      for (const destination of alias.destinations) {
        assertSingleLineValue(destination, `Alias destination for ${alias.address}`);
      }
    }
  }
}

async function executeMailSyncJob(
  job: AgentJobEnvelope,
  context: DriverExecutionContext,
  payload: MailSyncPayload
): Promise<AgentJobResult> {
  try {
    validateMailPayload(payload);

    const configuredMailboxCount = payload.domains.reduce(
      (count, domain) =>
        count +
        domain.mailboxes.filter(
          (mailbox) =>
            typeof mailbox.desiredPassword === "string" &&
            mailbox.desiredPassword.trim().length > 0
        ).length,
      0
    );

    await mkdir(context.services.mail.stagingDir, { recursive: true });
    await mkdir(context.services.mail.configRoot, { recursive: true });
    await mkdir(context.services.mail.vmailRoot, { recursive: true });
    await mkdir(context.services.mail.dkimRoot, { recursive: true });
    await mkdir(context.services.mail.roundcubeRoot, { recursive: true });
    const postfixConfigDir = path.join(context.services.mail.configRoot, "postfix");
    const dovecotConfigDir = path.join(context.services.mail.configRoot, "dovecot");
    const rspamdConfigDir = path.join(context.services.mail.configRoot, "rspamd");
    const rspamdLocalDir = path.join(rspamdConfigDir, "local.d");
    const dovecotConfDir = path.join(dovecotConfigDir, "conf.d");
    const postmasterAddress =
      payload.domains[0]?.mailboxes[0]?.address ??
      payload.domains[0]?.aliases[0]?.destinations[0] ??
      `postmaster@${payload.domains[0]?.domainName ?? "localhost"}`;
    const dovecotPasswdEntries: Array<{
      address: string;
      passwordHash: string;
      homePath: string;
      maildirPath: string;
      quotaBytes?: number;
    }> = [];
    const dkimMaterials: Array<
      DkimMaterial & { domainName: string; selector: string; webmailHostname: string }
    > = [];
    let missingMailboxCredentialCount = 0;
    const systemGroupCreated = await ensureSystemGroup(context.services.mail.vmailGroup);
    const systemUserCreated = await ensureSystemUser(
      context.services.mail.vmailUser,
      context.services.mail.vmailGroup,
      context.services.mail.vmailRoot
    );
    const postfixPackages = await ensurePackageTargetsInstalled(
      context.services.mail.postfixPackageTargets,
      context.services.mail.postfixServiceName
    );
    const dovecotPackages = await ensurePackageTargetsInstalled(
      context.services.mail.dovecotPackageTargets,
      context.services.mail.dovecotServiceName
    );
    const rspamdPackages = await ensurePackageTargetsInstalled(
      context.services.mail.rspamdPackageTargets,
      context.services.mail.rspamdServiceName
    );
    const redisPackages = await ensurePackageTargetsInstalled(
      context.services.mail.redisPackageTargets,
      context.services.mail.redisServiceName
    );
    const roundcubeDeployment = await ensureRoundcubeDeployment(context, payload);
    const firewallPolicy = await ensureMailFirewallPolicy(context);

    if (!postfixPackages.installed) {
      throw new Error(
        `Mail runtime could not verify ${context.services.mail.postfixServiceName} after package install.`
      );
    }

    if (!dovecotPackages.installed) {
      throw new Error(
        `Mail runtime could not verify ${context.services.mail.dovecotServiceName} after package install.`
      );
    }

    if (!redisPackages.installed) {
      throw new Error(
        `Mail runtime could not verify ${context.services.mail.redisServiceName} after package install.`
      );
    }

    if (roundcubeDeployment.deploymentMode !== "packaged") {
      throw new Error(
        `Roundcube deployment is incomplete. Package root ${roundcubeDeployment.packageRoot} is unavailable.`
      );
    }

    for (const domain of payload.domains) {
      await mkdir(path.join(context.services.mail.vmailRoot, domain.domainName), {
        recursive: true
      });
      const dkimMaterial = await ensureDkimMaterial(
        domain.domainName,
        domain.dkimSelector,
        context.services.mail.dkimRoot
      );
      dkimMaterials.push({
        ...dkimMaterial,
        domainName: domain.domainName,
        selector: domain.dkimSelector,
        webmailHostname: domain.webmailHostname
      });

      for (const mailbox of domain.mailboxes) {
        const homePath = deriveMailHomePath(
          context.services.mail.vmailRoot,
          domain.domainName,
          mailbox.localPart
        );
        const maildirPath = deriveMaildirPath(
          context.services.mail.vmailRoot,
          domain.domainName,
          mailbox.localPart
        );

        await mkdir(homePath, { recursive: true });
        await ensureMaildirScaffold(maildirPath);

        if (!mailbox.desiredPassword) {
          missingMailboxCredentialCount += 1;
        }

        dovecotPasswdEntries.push({
          address: mailbox.address,
          passwordHash: mailbox.desiredPassword
            ? generateSha512CryptHash(mailbox.address, mailbox.desiredPassword)
            : "!",
          homePath,
          maildirPath,
          quotaBytes: mailbox.quotaBytes
        });
      }
    }

    await mkdir(postfixConfigDir, { recursive: true });
    await mkdir(dovecotConfigDir, { recursive: true });
    await mkdir(dovecotConfDir, { recursive: true });
    await mkdir(rspamdConfigDir, { recursive: true });
    await mkdir(rspamdLocalDir, { recursive: true });

    const stagedStatePath = await writeRenderedFile(
      context.services.mail.stagingDir,
      "desired-state.json",
      renderMailDesiredState(payload)
    );
    const stagedPostfixDomainsPath = await writeRenderedFile(
      context.services.mail.stagingDir,
      "postfix-vmail_domains",
      renderPostfixVirtualDomains(payload)
    );
    const stagedPostfixMailboxesPath = await writeRenderedFile(
      context.services.mail.stagingDir,
      "postfix-vmail_mailboxes",
      renderPostfixVirtualMailboxes(payload, context.services.mail.vmailRoot)
    );
    const stagedPostfixAliasesPath = await writeRenderedFile(
      context.services.mail.stagingDir,
      "postfix-vmail_aliases",
      renderPostfixVirtualAliases(payload)
    );
    const stagedPostfixMainCfPath = await writeRenderedFile(
      context.services.mail.stagingDir,
      "postfix-main.cf.generated",
      renderPostfixMainCf(context.services.mail.configRoot, postmasterAddress)
    );
    const stagedPostfixMasterCfPath = await writeRenderedFile(
      context.services.mail.stagingDir,
      "postfix-master.cf.generated",
      renderPostfixMasterCf()
    );
    const stagedDovecotPasswdPath = await writeRenderedFile(
      context.services.mail.stagingDir,
      "dovecot-passwd",
      renderDovecotPasswd(dovecotPasswdEntries)
    );
    const stagedDovecotConfPath = await writeRenderedFile(
      context.services.mail.stagingDir,
      "dovecot-90-simplehost-mail.conf",
      renderDovecotMailConf(context.services.mail.configRoot, postmasterAddress)
    );
    const stagedRspamdSelectorsPath = await writeRenderedFile(
      context.services.mail.stagingDir,
      "rspamd-dkim_selectors.map",
      renderRspamdSelectorsMap(payload)
    );
    const stagedRspamdRedisPath = await writeRenderedFile(
      context.services.mail.stagingDir,
      "rspamd-redis.conf",
      renderRspamdRedisConf()
    );
    const stagedRspamdDkimPath = await writeRenderedFile(
      context.services.mail.stagingDir,
      "rspamd-dkim_signing.conf",
      renderRspamdDkimSigningConf(
        context.services.mail.configRoot,
        context.services.mail.dkimRoot,
        dkimMaterials.some((material) => material.available)
      )
    );

    const renderedDesiredState = renderMailDesiredState(payload);
    await writeFileAtomic(context.services.mail.statePath, renderedDesiredState);
    const deployedPostfixDomainsPath = path.join(postfixConfigDir, "vmail_domains");
    const deployedPostfixMailboxesPath = path.join(postfixConfigDir, "vmail_mailboxes");
    const deployedPostfixAliasesPath = path.join(postfixConfigDir, "vmail_aliases");
    const deployedPostfixMainCfPath = path.join(postfixConfigDir, "main.cf.generated");
    const deployedPostfixMasterCfPath = path.join(postfixConfigDir, "master.cf.generated");
    const deployedDovecotPasswdPath = path.join(dovecotConfigDir, "passwd");
    const deployedDovecotConfPath = path.join(dovecotConfDir, "90-simplehost-mail.conf");
    const deployedRspamdSelectorsPath = path.join(rspamdConfigDir, "dkim_selectors.map");
    const deployedRspamdRedisPath = path.join(rspamdLocalDir, "redis.conf");
    const deployedRspamdDkimPath = path.join(rspamdLocalDir, "dkim_signing.conf");

    await writeFileAtomic(
      deployedPostfixDomainsPath,
      renderPostfixVirtualDomains(payload)
    );
    await writeFileAtomic(
      deployedPostfixMailboxesPath,
      renderPostfixVirtualMailboxes(payload, context.services.mail.vmailRoot)
    );
    await writeFileAtomic(
      deployedPostfixAliasesPath,
      renderPostfixVirtualAliases(payload)
    );
    await writeFileAtomic(
      deployedPostfixMainCfPath,
      renderPostfixMainCf(context.services.mail.configRoot, postmasterAddress)
    );
    await writeFileAtomic(deployedPostfixMasterCfPath, renderPostfixMasterCf());
    await writeFileAtomic(
      deployedDovecotPasswdPath,
      renderDovecotPasswd(dovecotPasswdEntries)
    );
    await writeFileAtomic(
      deployedDovecotConfPath,
      renderDovecotMailConf(context.services.mail.configRoot, postmasterAddress)
    );
    await writeFileAtomic(
      deployedRspamdSelectorsPath,
      renderRspamdSelectorsMap(payload)
    );
    await writeFileAtomic(deployedRspamdRedisPath, renderRspamdRedisConf());
    await writeFileAtomic(
      deployedRspamdDkimPath,
      renderRspamdDkimSigningConf(
        context.services.mail.configRoot,
        context.services.mail.dkimRoot,
        dkimMaterials.some((material) => material.available)
      )
    );

    await ensureOwnedPath(
      context.services.mail.vmailRoot,
      context.services.mail.vmailUser,
      context.services.mail.vmailGroup
    );

    if (
      (await commandSucceeded("getent", ["passwd", context.services.mail.roundcubeUser])) &&
      (await commandSucceeded("getent", ["group", context.services.mail.roundcubeGroup]))
    ) {
      await ensureOwnedPath(
        context.services.mail.roundcubeSharedRoot,
        context.services.mail.roundcubeUser,
        context.services.mail.roundcubeGroup
      );
    }

    await applyPostfixMainCfConfiguration(
      renderPostfixMainCf(context.services.mail.configRoot, postmasterAddress)
    );
    await applyPostfixMasterCfConfiguration(renderPostfixMasterCf());
    await ensureDovecotLiveConfiguration(deployedDovecotConfPath);
    await execFileAsync("postfix", ["check"], {
      encoding: "utf8"
    });
    await execFileAsync("doveconf", ["-n"], {
      encoding: "utf8"
    });

    const postfixService = await ensureServiceEnabledAndRestarted(
      context.services.mail.postfixServiceName
    );
    const dovecotService = await ensureServiceEnabledAndRestarted(
      context.services.mail.dovecotServiceName
    );
    const rspamdService = await ensureServiceEnabledAndRestarted(
      context.services.mail.rspamdServiceName
    );
    const redisService = await ensureServiceEnabledAndRestarted(
      context.services.mail.redisServiceName
    );

    const resetRequiredMailboxCount = missingMailboxCredentialCount;
    const summary =
      resetRequiredMailboxCount > 0
        ? `Applied mail runtime for ${payload.domains.length} domain(s); ${resetRequiredMailboxCount} mailbox credential(s) remain reset-required.`
        : `Applied mail runtime for ${payload.domains.length} domain(s).`;

    return createCompletedResult(
      job,
      context,
      "applied",
      summary,
      {
        stagedStatePath,
        deployedStatePath: context.services.mail.statePath,
        configRoot: context.services.mail.configRoot,
        vmailRoot: context.services.mail.vmailRoot,
        dkimRoot: context.services.mail.dkimRoot,
        roundcubeRoot: context.services.mail.roundcubeRoot,
        systemUsers: {
          vmailUser: context.services.mail.vmailUser,
          vmailGroup: context.services.mail.vmailGroup,
          groupCreated: systemGroupCreated,
          userCreated: systemUserCreated
        },
        packageTargets: {
          postfix: postfixPackages,
          dovecot: dovecotPackages,
          rspamd: rspamdPackages,
          redis: redisPackages,
          roundcube: {
            configuredTargets: roundcubeDeployment.packageTargets,
            packageRoot: roundcubeDeployment.packageRoot,
            configPath: roundcubeDeployment.configPath,
            databasePath: roundcubeDeployment.databasePath,
            deploymentMode: roundcubeDeployment.deploymentMode,
            sharedRoot: roundcubeDeployment.sharedRoot,
            disabledHttpdConfPath: roundcubeDeployment.disabledHttpdConfPath
          }
        },
        firewall: firewallPolicy,
        postfixMapPaths: {
          stagedDomains: stagedPostfixDomainsPath,
          stagedMailboxes: stagedPostfixMailboxesPath,
          stagedAliases: stagedPostfixAliasesPath,
          stagedMasterCf: stagedPostfixMasterCfPath,
          deployedDomains: deployedPostfixDomainsPath,
          deployedMailboxes: deployedPostfixMailboxesPath,
          deployedAliases: deployedPostfixAliasesPath,
          stagedMainCf: stagedPostfixMainCfPath,
          deployedMainCf: deployedPostfixMainCfPath,
          deployedMasterCf: deployedPostfixMasterCfPath
        },
        dovecotPaths: {
          stagedPasswd: stagedDovecotPasswdPath,
          deployedPasswd: deployedDovecotPasswdPath,
          stagedConf: stagedDovecotConfPath,
          deployedConf: deployedDovecotConfPath
        },
        rspamdPaths: {
          stagedSelectors: stagedRspamdSelectorsPath,
          deployedSelectors: deployedRspamdSelectorsPath,
          stagedRedis: stagedRspamdRedisPath,
          deployedRedis: deployedRspamdRedisPath,
          stagedDkim: stagedRspamdDkimPath,
          deployedDkim: deployedRspamdDkimPath
        },
        postfixServiceName: context.services.mail.postfixServiceName,
        dovecotServiceName: context.services.mail.dovecotServiceName,
        rspamdServiceName: context.services.mail.rspamdServiceName,
        redisServiceName: context.services.mail.redisServiceName,
        serviceState: {
          postfix: postfixService,
          dovecot: dovecotService,
          rspamd: rspamdService,
          redis: redisService
        },
        configuredMailboxCount,
        resetRequiredMailboxCount,
        domains: payload.domains.map((domain) => ({
          domainName: domain.domainName,
          deliveryRole: domain.deliveryRole,
          mailboxCount: domain.mailboxes.length,
          aliasCount: domain.aliases.length,
          webmailHostname: domain.webmailHostname,
          webmailDocumentRoot: path.join(
            context.services.mail.roundcubeRoot,
            domain.tenantSlug,
            domain.domainName,
            "public"
          ),
          dkimPrivateKeyPath:
            dkimMaterials.find((material) => material.domainName === domain.domainName)?.privateKeyPath,
          dkimDnsTxtPath:
            dkimMaterials.find((material) => material.domainName === domain.domainName)?.dnsTxtPath,
          dkimAvailable:
            dkimMaterials.find((material) => material.domainName === domain.domainName)?.available ?? false
        })),
        mailboxes: dovecotPasswdEntries.map((entry) => ({
          address: entry.address,
          homePath: entry.homePath,
          maildirPath: entry.maildirPath,
          quotaBytes: entry.quotaBytes,
          credentialState: entry.passwordHash === "!" ? "reset_required" : "configured"
        }))
      }
    );
  } catch (error) {
    return createFailedResult(
      job,
      context,
      error instanceof Error ? error.message : "mail.sync failed unexpectedly."
    );
  }
}

async function executeContainerReconcileJob(
  job: AgentJobEnvelope,
  context: DriverExecutionContext,
  payload: ContainerReconcilePayload
): Promise<AgentJobResult> {
  try {
    validateContainerPayload(payload);

    const serviceName = normalizeServiceUnitName(payload.serviceName);
    const serviceFileName = serviceName.quadletFileName;
    const serviceUnitName = serviceName.unitName;
    const envFileName = payload.environment
      ? payload.envFileName ?? `${serviceName.baseName}.env`
      : undefined;
    const stagedUnitPath = await writeRenderedFile(
      context.services.containers.stagingDir,
      serviceFileName,
      renderQuadletContainerUnit(
        payload,
        envFileName
          ? path.join(context.services.containers.envDir, envFileName)
          : undefined
      )
    );
    const stagedEnvPath = envFileName
      ? await writeRenderedFile(
          context.services.containers.stagingDir,
          envFileName,
          renderEnvironmentFile(payload.environment)
        )
      : undefined;
    const deployedUnitPath = path.join(
      context.services.containers.quadletDir,
      serviceFileName
    );
    const deployedEnvPath = envFileName
      ? path.join(context.services.containers.envDir, envFileName)
      : undefined;
    const backupUnitPath = `${deployedUnitPath}.bak`;
    const backupEnvPath = deployedEnvPath ? `${deployedEnvPath}.bak` : undefined;
    const hadExistingUnitFile = await pathExists(deployedUnitPath);
    const hadExistingEnvFile = deployedEnvPath ? await pathExists(deployedEnvPath) : false;

    for (const directoryPath of payload.hostDirectories ?? []) {
      await mkdir(directoryPath, { recursive: true });
    }

    if (hadExistingUnitFile) {
      await copyFile(deployedUnitPath, backupUnitPath);
    }

    if (deployedEnvPath && hadExistingEnvFile && backupEnvPath) {
      await copyFile(deployedEnvPath, backupEnvPath);
    }

    try {
      await writeFileAtomic(
        deployedUnitPath,
        renderQuadletContainerUnit(
          payload,
          envFileName
            ? path.join(context.services.containers.envDir, envFileName)
            : undefined
        )
      );

      if (deployedEnvPath && payload.environment) {
        await writeFileAtomic(
          deployedEnvPath,
          renderEnvironmentFile(payload.environment)
        );
      }

      await execFileAsync("systemctl", ["daemon-reload"], {
        encoding: "utf8"
      });

      if (payload.start !== false) {
        await execFileAsync("systemctl", ["restart", serviceUnitName], {
          encoding: "utf8"
        });
      }

      const enabledState = await runCommandAllowFailure("systemctl", [
        "is-enabled",
        serviceUnitName
      ]);
      const activeState = await runCommandAllowFailure("systemctl", [
        "is-active",
        serviceUnitName
      ]);

      if (payload.start !== false && activeState.stdout.trim() !== "active") {
        throw new Error(
          `Container service ${serviceUnitName} is ${activeState.stdout.trim() || "inactive"}.`
        );
      }

      if (hadExistingUnitFile) {
        await rm(backupUnitPath, { force: true });
      }

      if (backupEnvPath && hadExistingEnvFile) {
        await rm(backupEnvPath, { force: true });
      }

      return createCompletedResult(
        job,
        context,
        "applied",
        `Reconciled container service ${serviceUnitName}.`,
        {
          serviceName: payload.serviceName,
          containerName: payload.containerName,
          image: payload.image,
          stagedUnitPath,
          stagedEnvPath,
          deployedUnitPath,
          deployedEnvPath,
          hostDirectories: payload.hostDirectories ?? [],
          enabledState: enabledState.stdout.trim() || enabledState.stderr.trim(),
          activeState: activeState.stdout.trim() || activeState.stderr.trim()
        }
      );
    } catch (error) {
      const rollback: Record<string, unknown> = {
        hadExistingUnitFile,
        hadExistingEnvFile,
        rolledBack: false
      };

      try {
        if (!hadExistingUnitFile) {
          await runCommandAllowFailure("systemctl", ["disable", "--now", serviceUnitName]);
        }

        if (hadExistingUnitFile) {
          await rename(backupUnitPath, deployedUnitPath);
        } else {
          await rm(deployedUnitPath, { force: true });
        }

        if (deployedEnvPath) {
          if (hadExistingEnvFile && backupEnvPath) {
            await rename(backupEnvPath, deployedEnvPath);
          } else {
            await rm(deployedEnvPath, { force: true });
          }
        }

        await execFileAsync("systemctl", ["daemon-reload"], {
          encoding: "utf8"
        });

        if (hadExistingUnitFile) {
          const restartRollback = await runCommandAllowFailure("systemctl", [
            "restart",
            serviceUnitName
          ]);
          rollback.previousServiceRestarted = restartRollback.exitCode === 0;
          rollback.previousServiceRestartOutput =
            restartRollback.stderr.trim() || restartRollback.stdout.trim();
        }

        rollback.rolledBack = true;
      } catch (rollbackError) {
        rollback.rollbackError =
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      }

      return createFailedResult(
        job,
        context,
        error instanceof Error ? error.message : String(error),
        {
          serviceName: payload.serviceName,
          containerName: payload.containerName,
          image: payload.image,
          stagedUnitPath,
          stagedEnvPath,
          deployedUnitPath,
          deployedEnvPath,
          rollback
        }
      );
    }
  } catch (error) {
    return createFailedResult(
      job,
      context,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function executeProxyRenderJob(
  job: AgentJobEnvelope,
  context: DriverExecutionContext,
  payload: ProxyRenderPayload
): Promise<AgentJobResult> {
  try {
    const fileName = `${payload.vhostName}.conf`;
    const rendered = renderApacheVhost(payload);
    const stagedPath = await writeRenderedFile(
      context.services.httpd.stagingDir,
      fileName,
      rendered
    );
    const deployedPath = path.join(context.services.httpd.sitesDir, fileName);
    const backupPath = `${deployedPath}.bak`;
    const hadExistingFile = await pathExists(deployedPath);

    if (hadExistingFile) {
      await copyFile(deployedPath, backupPath);
    }

    try {
      await writeFileAtomic(deployedPath, rendered);
      const validation = await validateApacheConfiguration();
      const reload = await reloadApacheService();

      if (hadExistingFile) {
        await rm(backupPath, { force: true });
      }

      return createCompletedResult(
        job,
        context,
        "applied",
        `Installed Apache vhost ${payload.serverName}.`,
        {
          stagedPath,
          deployedPath,
          serverName: payload.serverName,
          aliases: payload.serverAliases ?? [],
          validation,
          reload
        }
      );
    } catch (error) {
      const rollback: Record<string, unknown> = {
        rolledBack: false
      };

      if (hadExistingFile) {
        await rename(backupPath, deployedPath);
      } else {
        await rm(deployedPath, { force: true });
      }

      rollback.rolledBack = true;

      try {
        rollback.validation = await validateApacheConfiguration();
        rollback.reload = await reloadApacheService();
      } catch (rollbackError) {
        rollback.rollbackError =
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      }

      return createFailedResult(
        job,
        context,
        error instanceof Error ? error.message : String(error),
        {
          stagedPath,
          deployedPath,
          rollback
        }
      );
    }
  } catch (error) {
    return createFailedResult(
      job,
      context,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function executeDnsSyncJob(
  job: AgentJobEnvelope,
  context: DriverExecutionContext,
  payload: DnsSyncPayload
): Promise<AgentJobResult> {
  try {
    validateDnsPayload(payload);
    const zoneFileName = `${payload.zoneName.replace(/[^a-zA-Z0-9.-]/g, "_")}.zone`;
    const stagedPath = await writeRenderedFile(
      context.services.pdns.stagingDir,
      zoneFileName,
      renderDnsZoneFile(payload)
    );
    const { createdZone } = await upsertPowerDnsRecords(payload, context);
    const verification = await verifyPowerDnsZone(payload, context);

    return createCompletedResult(
      job,
      context,
      "applied",
      `Synchronized PowerDNS zone ${payload.zoneName}.`,
      {
        stagedPath,
        recordCount: payload.records.length,
        serial: payload.serial,
        nameservers: payload.nameservers,
        validation: verification,
        rollback: {
          strategy: "pdns-api-atomic-patch",
          createdZone
        }
      }
    );
  } catch (error) {
    return createFailedResult(
      job,
      context,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function executePostgresReconcileJob(
  job: AgentJobEnvelope,
  context: DriverExecutionContext,
  payload: PostgresReconcilePayload
): Promise<AgentJobResult> {
  if (!context.services.postgresql.adminUrl) {
    return createCompletedResult(
      job,
      context,
      "failed",
      "SIMPLEHOST_POSTGRES_ADMIN_URL is not configured."
    );
  }

  const pool = new Pool({
    connectionString: context.services.postgresql.adminUrl,
    application_name: "simplehost-agent-postgres-driver"
  });

  try {
    assertSafeIdentifier(payload.roleName, "PostgreSQL role");
    assertSafeIdentifier(payload.databaseName, "PostgreSQL database");

    let createdRole = false;
    let createdDatabase = false;

    try {
    const roleExists = await pool.query<{ exists: number }>(
      `SELECT 1 AS exists
       FROM pg_roles
       WHERE rolname = $1`,
      [payload.roleName]
    );

    if (roleExists.rows.length === 0) {
      await pool.query(
        `CREATE ROLE ${quotePostgresIdentifier(
          payload.roleName
        )} LOGIN PASSWORD ${quotePostgresLiteral(payload.password)}`
      );
      createdRole = true;
    } else {
      await pool.query(
        `ALTER ROLE ${quotePostgresIdentifier(
          payload.roleName
        )} LOGIN PASSWORD ${quotePostgresLiteral(payload.password)}`
      );
    }

    const databaseExists = await pool.query<{ exists: number }>(
      `SELECT 1 AS exists
       FROM pg_database
       WHERE datname = $1`,
      [payload.databaseName]
    );

    if (databaseExists.rows.length === 0) {
      await pool.query(`CREATE DATABASE ${quotePostgresIdentifier(payload.databaseName)}`);
      createdDatabase = true;
    }

    await pool.query(
      `REVOKE ALL ON DATABASE ${quotePostgresIdentifier(
        payload.databaseName
      )} FROM PUBLIC`
    );
    await pool.query(
      `GRANT ALL PRIVILEGES ON DATABASE ${quotePostgresIdentifier(
        payload.databaseName
      )} TO ${quotePostgresIdentifier(payload.roleName)}`
    );

    const targetDatabaseUrl = new URL(context.services.postgresql.adminUrl);
    targetDatabaseUrl.pathname = `/${payload.databaseName}`;

    const targetDatabasePool = new Pool({
      connectionString: targetDatabaseUrl.toString(),
      application_name: "simplehost-agent-postgres-driver-schema"
    });

    try {
      const publicSchemaState = await targetDatabasePool.query<{
        owner: string;
        role_has_usage: boolean;
        role_has_create: boolean;
      }>(
        `SELECT
           pg_catalog.pg_get_userbyid(n.nspowner) AS owner,
           has_schema_privilege($1, n.oid, 'USAGE') AS role_has_usage,
           has_schema_privilege($1, n.oid, 'CREATE') AS role_has_create
         FROM pg_namespace n
         WHERE n.nspname = 'public'`,
        [payload.roleName]
      );

      const publicSchema = publicSchemaState.rows[0];

      if (!publicSchema) {
        throw new Error(`Schema public does not exist in ${payload.databaseName}.`);
      }

      if (
        publicSchema.owner !== payload.roleName &&
        (!publicSchema.role_has_usage || !publicSchema.role_has_create)
      ) {
        await targetDatabasePool.query(`REVOKE ALL ON SCHEMA public FROM PUBLIC`);
        await targetDatabasePool.query(
          `GRANT USAGE, CREATE ON SCHEMA public TO ${quotePostgresIdentifier(
            payload.roleName
          )}`
        );
      }
    } finally {
      await targetDatabasePool.end();
    }

      targetDatabaseUrl.username = payload.roleName;
      targetDatabaseUrl.password = payload.password;

      const validationPool = new Pool({
        connectionString: targetDatabaseUrl.toString(),
        application_name: "simplehost-agent-postgres-driver-validation"
      });

      try {
        await validationPool.query("SELECT current_database(), current_user");
      } finally {
        await validationPool.end();
      }

      return createCompletedResult(
        job,
        context,
        "applied",
        `Reconciled PostgreSQL database ${payload.databaseName}.`,
        {
          appSlug: payload.appSlug,
          databaseName: payload.databaseName,
          roleName: payload.roleName,
          validation: {
            loginVerified: true
          }
        }
      );
    } catch (error) {
      const rollback: Record<string, unknown> = {
        createdRole,
        createdDatabase,
        rolledBack: false
      };

      try {
        if (createdDatabase) {
          await pool.query(
            `SELECT pg_terminate_backend(pid)
             FROM pg_stat_activity
             WHERE datname = $1
               AND pid <> pg_backend_pid()`,
            [payload.databaseName]
          );
          await pool.query(`DROP DATABASE ${quotePostgresIdentifier(payload.databaseName)}`);
        }

        if (createdRole) {
          await pool.query(`DROP ROLE ${quotePostgresIdentifier(payload.roleName)}`);
        }

        rollback.rolledBack = true;
      } catch (rollbackError) {
        rollback.rollbackError =
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      }

      return createFailedResult(
        job,
        context,
        error instanceof Error ? error.message : String(error),
        {
          appSlug: payload.appSlug,
          databaseName: payload.databaseName,
          roleName: payload.roleName,
          rollback
        }
      );
    }
  } finally {
    await pool.end();
  }
}

async function executeMariadbReconcileJob(
  job: AgentJobEnvelope,
  context: DriverExecutionContext,
  payload: MariadbReconcilePayload
): Promise<AgentJobResult> {
  if (!context.services.mariadb.adminUrl) {
    return createCompletedResult(
      job,
      context,
      "failed",
      "SIMPLEHOST_MARIADB_ADMIN_URL is not configured."
    );
  }

  const connection = await mysql.createConnection(context.services.mariadb.adminUrl);

  try {
    assertSafeIdentifier(payload.userName, "MariaDB user");
    assertSafeIdentifier(payload.databaseName, "MariaDB database");

    const databaseIdentifier = connection.escapeId(payload.databaseName);
    const userLiteral = connection.escape(payload.userName);
    const passwordLiteral = connection.escape(payload.password);
    let createdDatabase = false;
    let createdUser = false;

    try {
      const [databaseRows] = (await connection.query(
        `SELECT 1 AS existing
         FROM INFORMATION_SCHEMA.SCHEMATA
         WHERE SCHEMA_NAME = ?`,
        [payload.databaseName]
      )) as unknown as [Array<{ existing: number }>, unknown];
      const [userRows] = (await connection.query(
        `SELECT 1 AS existing
         FROM mysql.user
         WHERE user = ?
           AND host = '%'`,
        [payload.userName]
      )) as unknown as [Array<{ existing: number }>, unknown];

      createdDatabase = databaseRows.length === 0;
      createdUser = userRows.length === 0;

      await connection.query(
        `CREATE DATABASE IF NOT EXISTS ${databaseIdentifier}
           CHARACTER SET utf8mb4
           COLLATE utf8mb4_unicode_ci`
      );
      await connection.query(
        `CREATE USER IF NOT EXISTS ${userLiteral}@'%'
           IDENTIFIED BY ${passwordLiteral}`
      );
      await connection.query(
        `ALTER USER ${userLiteral}@'%'
           IDENTIFIED BY ${passwordLiteral}`
      );
      await connection.query(
        `GRANT ALL PRIVILEGES ON ${databaseIdentifier}.* TO ${userLiteral}@'%'`
      );
      await connection.query("FLUSH PRIVILEGES");

      const validationUrl = new URL(context.services.mariadb.adminUrl);
      validationUrl.username = payload.userName;
      validationUrl.password = payload.password;
      validationUrl.pathname = `/${payload.databaseName}`;
      const validationConnection = await mysql.createConnection(validationUrl.toString());

      try {
        await validationConnection.query("SELECT current_user(), database()");
      } finally {
        await validationConnection.end();
      }

      return createCompletedResult(
        job,
        context,
        "applied",
        `Reconciled MariaDB database ${payload.databaseName}.`,
        {
          appSlug: payload.appSlug,
          databaseName: payload.databaseName,
          userName: payload.userName,
          validation: {
            loginVerified: true
          }
        }
      );
    } catch (error) {
      const rollback: Record<string, unknown> = {
        createdDatabase,
        createdUser,
        rolledBack: false
      };

      try {
        if (createdDatabase) {
          await connection.query(`DROP DATABASE IF EXISTS ${databaseIdentifier}`);
        }

        if (createdUser) {
          await connection.query(`DROP USER IF EXISTS ${userLiteral}@'%'`);
          await connection.query("FLUSH PRIVILEGES");
        }

        rollback.rolledBack = true;
      } catch (rollbackError) {
        rollback.rollbackError =
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      }

      return createFailedResult(
        job,
        context,
        error instanceof Error ? error.message : String(error),
        {
          appSlug: payload.appSlug,
          databaseName: payload.databaseName,
          userName: payload.userName,
          rollback
        }
      );
    }
  } finally {
    await connection.end();
  }
}

async function executeCodeServerUpdateJob(
  job: AgentJobEnvelope,
  context: DriverExecutionContext,
  payload: CodeServerUpdatePayload
): Promise<AgentJobResult> {
  const rpmUrl = assertSafeRpmUrl(payload.rpmUrl).toString();
  const fileName =
    path.basename(new URL(rpmUrl).pathname) || `code-server-${Date.now()}.rpm`;
  const stagingPath = path.join(context.services.codeServer.stagingDir, fileName);
  const before = await inspectCodeServerService(context);

  try {
    await mkdir(context.services.codeServer.stagingDir, { recursive: true });
    await execFileAsync("curl", ["-L", "--fail", "-o", stagingPath, rpmUrl], {
      encoding: "utf8"
    });

    const shaOutput = await execFileAsync("sha256sum", [stagingPath], {
      encoding: "utf8"
    });
    const sha256 = shaOutput.stdout.trim().split(/\s+/)[0] ?? "";

    if (payload.expectedSha256 && sha256 !== payload.expectedSha256) {
      throw new Error(
        `Downloaded RPM digest ${sha256} does not match expected ${payload.expectedSha256}.`
      );
    }

    await execFileAsync("dnf", ["install", "-y", stagingPath], {
      encoding: "utf8"
    });
    await execFileAsync("systemctl", ["enable", context.services.codeServer.serviceName], {
      encoding: "utf8"
    });
    await execFileAsync("systemctl", ["restart", context.services.codeServer.serviceName], {
      encoding: "utf8"
    });

    const after = await inspectCodeServerService(context);

    return createCompletedResult(
      job,
      context,
      "applied",
      `Updated code-server on ${context.nodeId} to ${after.version ?? "unknown"}.`,
      {
        rpmUrl,
        sha256,
        artifactPath: stagingPath,
        before,
        after
      }
    );
  } catch (error) {
    return createFailedResult(
      job,
      context,
      error instanceof Error ? error.message : String(error),
      {
        rpmUrl,
        artifactPath: stagingPath,
        before
      }
    );
  }
}

function normalizePackageEpoch(value: string): string | undefined {
  if (!value || value === "(none)" || value === "0") {
    return undefined;
  }

  return value;
}

function buildPackageNevra(pkg: {
  packageName: string;
  epoch?: string;
  version: string;
  release: string;
  arch: string;
}): string {
  const versionPart = pkg.epoch
    ? `${pkg.epoch}:${pkg.version}-${pkg.release}`
    : `${pkg.version}-${pkg.release}`;
  return `${pkg.packageName}-${versionPart}.${pkg.arch}`;
}

async function collectInstalledPackages(): Promise<InstalledPackageSummary[]> {
  const result = await execFileAsync(
    "rpm",
    [
      "-qa",
      "--qf",
      "%{NAME}\t%{EPOCHNUM}\t%{VERSION}\t%{RELEASE}\t%{ARCH}\t%{INSTALLTIME}\n"
    ],
    { encoding: "utf8" }
  );
  const packages: InstalledPackageSummary[] = [];

  for (const line of result.stdout.split(/\r?\n/g).map((value) => value.trim()).filter(Boolean)) {
    const [packageName, rawEpoch, version, release, arch, rawInstallTime] = line.split("\t");

    if (!packageName || !version || !release || !arch) {
      continue;
    }

    const epoch = normalizePackageEpoch(rawEpoch ?? "");
    const installTime = Number.parseInt(rawInstallTime ?? "", 10);

    packages.push({
      packageName,
      epoch,
      version,
      release,
      arch,
      nevra: buildPackageNevra({
        packageName,
        epoch,
        version,
        release,
        arch
      }),
      installedAt:
        Number.isInteger(installTime) && installTime > 0
          ? new Date(installTime * 1000).toISOString()
          : undefined
    });
  }

  packages.sort((left, right) =>
    `${left.packageName}:${left.arch}:${left.version}:${left.release}`.localeCompare(
      `${right.packageName}:${right.arch}:${right.version}:${right.release}`
    )
  );

  return packages;
}

async function executePackageInventoryCollectJob(
  job: AgentJobEnvelope,
  context: DriverExecutionContext,
  _payload: PackageInventoryCollectPayload
): Promise<AgentJobResult> {
  try {
    const packages = await collectInstalledPackages();
    return createCompletedResult(
      job,
      context,
      "applied",
      `Collected ${packages.length} installed package(s) on ${context.nodeId}.`,
      {
        packageCount: packages.length,
        packages
      }
    );
  } catch (error) {
    return createFailedResult(
      job,
      context,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function executePackageInstallJob(
  job: AgentJobEnvelope,
  context: DriverExecutionContext,
  payload: PackageInstallPayload
): Promise<AgentJobResult> {
  const packageNames = (payload.packageNames ?? []).map((value) => value.trim()).filter(Boolean);
  const rpmUrl = payload.rpmUrl?.trim();
  let downloadedArtifactPath: string | undefined;
  let sha256: string | undefined;

  try {
    if (rpmUrl) {
      const fileName =
        path.basename(new URL(rpmUrl).pathname) || `package-${Date.now()}.rpm`;
      downloadedArtifactPath = path.join(context.services.packages.stagingDir, fileName);
      await mkdir(context.services.packages.stagingDir, { recursive: true });
      await execFileAsync("curl", ["-L", "--fail", "-o", downloadedArtifactPath, rpmUrl], {
        encoding: "utf8"
      });

      const shaOutput = await execFileAsync("sha256sum", [downloadedArtifactPath], {
        encoding: "utf8"
      });
      sha256 = shaOutput.stdout.trim().split(/\s+/)[0] ?? "";

      if (payload.expectedSha256 && sha256 !== payload.expectedSha256) {
        throw new Error(
          `Downloaded RPM digest ${sha256} does not match expected ${payload.expectedSha256}.`
        );
      }

      await execFileAsync("dnf", ["install", "-y", downloadedArtifactPath], {
        encoding: "utf8"
      });
    } else if (packageNames.length > 0) {
      await execFileAsync(
        "dnf",
        [payload.allowReinstall ? "reinstall" : "install", "-y", ...packageNames],
        {
          encoding: "utf8"
        }
      );
    } else {
      throw new Error("package.install payload must define packageNames or rpmUrl.");
    }

    const packages = await collectInstalledPackages();

    return createCompletedResult(
      job,
      context,
      "applied",
      rpmUrl
        ? `Installed package from URL on ${context.nodeId}.`
        : `Installed ${packageNames.join(", ")} on ${context.nodeId}.`,
      {
        packageNames: packageNames.length > 0 ? packageNames : undefined,
        rpmUrl,
        sha256,
        artifactPath: downloadedArtifactPath,
        packages
      }
    );
  } catch (error) {
    return createFailedResult(
      job,
      context,
      error instanceof Error ? error.message : String(error),
      {
        packageNames: packageNames.length > 0 ? packageNames : undefined,
        rpmUrl,
        artifactPath: downloadedArtifactPath
      }
    );
  }
}

export async function executeAllowlistedJob(
  job: AgentJobEnvelope,
  context: DriverExecutionContext
): Promise<AgentJobResult> {
  if (!isSupportedJobKind(job.kind)) {
    return createCompletedResult(
      job,
      context,
      "failed",
      `Unsupported job kind: ${job.kind}`
    );
  }

  if (job.kind === "proxy.render") {
    if (!isProxyRenderPayload(job.payload)) {
      return createCompletedResult(
        job,
        context,
        "failed",
        "proxy.render payload is invalid."
      );
    }

    return executeProxyRenderJob(job, context, job.payload);
  }

  if (job.kind === "dns.sync") {
    if (!isDnsSyncPayload(job.payload)) {
      return createCompletedResult(
        job,
        context,
        "failed",
        "dns.sync payload is invalid."
      );
    }

    return executeDnsSyncJob(job, context, job.payload);
  }

  if (job.kind === "container.reconcile") {
    if (!isContainerReconcilePayload(job.payload)) {
      return createCompletedResult(
        job,
        context,
        "failed",
        "container.reconcile payload is invalid."
      );
    }

    return executeContainerReconcileJob(job, context, job.payload);
  }

  if (job.kind === "postgres.reconcile") {
    if (!isPostgresReconcilePayload(job.payload)) {
      return createCompletedResult(
        job,
        context,
        "failed",
        "postgres.reconcile payload is invalid."
      );
    }

    return executePostgresReconcileJob(job, context, job.payload);
  }

  if (job.kind === "mariadb.reconcile") {
    if (!isMariadbReconcilePayload(job.payload)) {
      return createCompletedResult(
        job,
        context,
        "failed",
        "mariadb.reconcile payload is invalid."
      );
    }

    return executeMariadbReconcileJob(job, context, job.payload);
  }

  if (job.kind === "code-server.update") {
    if (!isCodeServerUpdatePayload(job.payload)) {
      return createCompletedResult(
        job,
        context,
        "failed",
        "code-server.update payload is invalid."
      );
    }

    return executeCodeServerUpdateJob(job, context, job.payload);
  }

  if (job.kind === "package.inventory.collect") {
    if (!isPackageInventoryCollectPayload(job.payload)) {
      return createCompletedResult(
        job,
        context,
        "failed",
        "package.inventory.collect payload is invalid."
      );
    }

    return executePackageInventoryCollectJob(job, context, job.payload);
  }

  if (job.kind === "package.install") {
    if (!isPackageInstallPayload(job.payload)) {
      return createCompletedResult(
        job,
        context,
        "failed",
        "package.install payload is invalid."
      );
    }

    return executePackageInstallJob(job, context, job.payload);
  }

  if (job.kind === "mail.sync") {
    if (!isMailSyncPayload(job.payload)) {
      return createCompletedResult(
        job,
        context,
        "failed",
        "mail.sync payload is invalid."
      );
    }

    return executeMailSyncJob(job, context, job.payload);
  }

  return createCompletedResult(
    job,
    context,
    "skipped",
    `No real driver is implemented yet for ${job.kind}.`,
    {
      payloadKeys: Object.keys(job.payload)
    }
  );
}

export function createDemoJob(
  nodeId: string,
  kind: AgentJobKind = "proxy.render"
): AgentJobEnvelope {
  const createdAt = new Date().toISOString();

  if (kind === "proxy.render") {
    return {
      id: `job-${Date.now()}`,
      desiredStateVersion: `rev-${Date.now()}`,
      kind,
      nodeId,
      createdAt,
      payload: {
        vhostName: `${nodeId}-bootstrap`,
        serverName: `${nodeId}.bootstrap.simplehost.test`,
        serverAliases: [`www.${nodeId}.bootstrap.simplehost.test`],
        documentRoot: `/srv/www/${nodeId}/current/public`,
        tls: true
      } satisfies ProxyRenderPayload
    };
  }

  if (kind === "dns.sync") {
    return {
      id: `job-${Date.now()}`,
      desiredStateVersion: `rev-${Date.now()}`,
      kind,
      nodeId,
      createdAt,
      payload: {
        zoneName: `${nodeId}.bootstrap.simplehost.test`,
        serial: Math.floor(Date.now() / 1000),
        nameservers: [
          `ns1.${nodeId}.bootstrap.simplehost.test`,
          `ns2.${nodeId}.bootstrap.simplehost.test`
        ],
        records: [
          {
            name: "@",
            type: "A",
            value: "127.0.0.1",
            ttl: 300
          }
        ]
      } satisfies DnsSyncPayload
    };
  }

  if (kind === "container.reconcile") {
    return {
      id: `job-${Date.now()}`,
      desiredStateVersion: `rev-${Date.now()}`,
      kind,
      nodeId,
      createdAt,
      payload: {
        serviceName: `${nodeId}-bootstrap-web`,
        containerName: `${nodeId}-bootstrap-web`,
        image: "docker.io/library/nginx:1.27-alpine",
        description: `Bootstrap container for ${nodeId}`,
        publishPorts: ["127.0.0.1:18080:80"],
        hostDirectories: [`/srv/containers/bootstrap/${nodeId}`],
        volumes: [`/srv/containers/bootstrap/${nodeId}:/usr/share/nginx/html:Z`],
        enable: true,
        start: true
      } satisfies ContainerReconcilePayload
    };
  }

  if (kind === "postgres.reconcile") {
    return {
      id: `job-${Date.now()}`,
      desiredStateVersion: `rev-${Date.now()}`,
      kind,
      nodeId,
      createdAt,
      payload: {
        appSlug: `${nodeId}-bootstrap`,
        databaseName: `app_${nodeId.replace(/[^a-z0-9]/gi, "_")}`,
        roleName: `app_${nodeId.replace(/[^a-z0-9]/gi, "_")}`,
        password: "change-me"
      } satisfies PostgresReconcilePayload
    };
  }

  if (kind === "mariadb.reconcile") {
    return {
      id: `job-${Date.now()}`,
      desiredStateVersion: `rev-${Date.now()}`,
      kind,
      nodeId,
      createdAt,
      payload: {
        appSlug: `${nodeId}-bootstrap`,
        databaseName: `app_${nodeId.replace(/[^a-z0-9]/gi, "_")}`,
        userName: `app_${nodeId.replace(/[^a-z0-9]/gi, "_")}`,
        password: "change-me"
      } satisfies MariadbReconcilePayload
    };
  }

  return {
    id: `job-${Date.now()}`,
    desiredStateVersion: `rev-${Date.now()}`,
    kind,
    nodeId,
    createdAt,
    payload: {
      requestedBy: "bootstrap",
      dryRun: true
    }
  };
}
