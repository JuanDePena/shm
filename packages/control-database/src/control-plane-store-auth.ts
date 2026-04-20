import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import {
  type AuthenticatedUserSummary,
  controlGlobalRoles,
  type ControlGlobalRole,
  type TenantMembershipRole
} from "@simplehost/control-contracts";

import {
  createOpaqueSessionToken,
  createPasswordHash,
  normalizeEmail,
  verifyPasswordHash
} from "./auth.js";
import { insertAuditEvent, withTransaction } from "./control-plane-store-db.js";
import {
  decodeStoredJobPayload,
  hashToken,
  stripSensitivePayloadFields,
  toDispatchedJob
} from "./control-plane-store-helpers.js";
import type {
  ControlPlaneAuthMethods,
  JobRow,
  NodeCredentialRow,
  NodeRow,
  ControlPlaneStoreOptions,
  SessionRow,
  UserCredentialRow,
  UserGlobalRoleRow,
  UserMembershipRow,
  UserRow
} from "./control-plane-store-types.js";
import {
  NodeAuthorizationError,
  UserAuthorizationError
} from "./control-plane-store-types.js";

type ReportedInstalledPackage = {
  packageName: string;
  epoch?: string;
  version: string;
  release: string;
  arch: string;
  nevra: string;
  source?: string;
  installedAt?: string;
};

const reclaimableClaimedJobKinds = [
  "dns.sync",
  "proxy.render",
  "container.reconcile",
  "mail.sync"
] as const;

const reclaimableJobClaimTimeoutMs = 5 * 60 * 1000;

function normalizeReportedInstalledPackage(value: unknown): ReportedInstalledPackage | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.packageName !== "string" ||
    typeof record.version !== "string" ||
    typeof record.release !== "string" ||
    typeof record.arch !== "string" ||
    typeof record.nevra !== "string"
  ) {
    return undefined;
  }

  return {
    packageName: record.packageName,
    epoch: typeof record.epoch === "string" ? record.epoch : undefined,
    version: record.version,
    release: record.release,
    arch: record.arch,
    nevra: record.nevra,
    source: typeof record.source === "string" ? record.source : undefined,
    installedAt: typeof record.installedAt === "string" ? record.installedAt : undefined
  };
}

function compareReportedPackageFreshness(
  left: ReportedInstalledPackage,
  right: ReportedInstalledPackage
): number {
  const leftInstalledAt = left.installedAt ? Date.parse(left.installedAt) : Number.NaN;
  const rightInstalledAt = right.installedAt ? Date.parse(right.installedAt) : Number.NaN;

  if (Number.isFinite(leftInstalledAt) && Number.isFinite(rightInstalledAt)) {
    return leftInstalledAt - rightInstalledAt;
  }

  if (Number.isFinite(leftInstalledAt)) {
    return -1;
  }

  if (Number.isFinite(rightInstalledAt)) {
    return 1;
  }

  return 0;
}

function dedupeReportedInstalledPackages(
  packages: ReportedInstalledPackage[]
): ReportedInstalledPackage[] {
  const deduped = new Map<string, ReportedInstalledPackage>();

  for (const pkg of packages) {
    const key = `${pkg.packageName}\u0000${pkg.arch}`;
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, pkg);
      continue;
    }

    // Package inventory is keyed by node/package/arch in PostgreSQL. Some RPMs
    // such as gpg-pubkey can be reported more than once per node, so keep the
    // freshest observation and discard older duplicates before inserting.
    if (compareReportedPackageFreshness(pkg, existing) >= 0) {
      deduped.set(key, pkg);
    }
  }

  return [...deduped.values()];
}

export function extractReportedInstalledPackages(
  details: Record<string, unknown> | undefined
): ReportedInstalledPackage[] | undefined {
  if (!details || !Array.isArray(details.packages)) {
    return undefined;
  }

  const packages = details.packages
    .map(normalizeReportedInstalledPackage)
    .filter((entry): entry is ReportedInstalledPackage => Boolean(entry));

  return dedupeReportedInstalledPackages(packages);
}

async function replaceNodeInstalledPackages(
  client: PoolClient,
  nodeId: string,
  collectedAt: string,
  packages: ReportedInstalledPackage[]
): Promise<void> {
  await client.query(`DELETE FROM shp_node_installed_packages WHERE node_id = $1`, [nodeId]);

  for (const pkg of packages) {
    await client.query(
      `INSERT INTO shp_node_installed_packages (
         node_id,
         package_name,
         epoch,
         version,
         release,
         arch,
         nevra,
         source,
         installed_at,
         last_collected_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        nodeId,
        pkg.packageName,
        pkg.epoch ?? null,
        pkg.version,
        pkg.release,
        pkg.arch,
        pkg.nevra,
        pkg.source ?? null,
        pkg.installedAt ?? null,
        collectedAt
      ]
    );
  }
}

export async function getNodeCredential(
  client: PoolClient,
  nodeId: string
): Promise<NodeCredentialRow | null> {
  const result = await client.query<NodeCredentialRow>(
    `SELECT node_id, token_hash
     FROM control_plane_node_credentials
     WHERE node_id = $1`,
    [nodeId]
  );

  return result.rows[0] ?? null;
}

export async function touchNodeCredential(
  client: PoolClient,
  nodeId: string,
  tokenHash: string,
  timestamp: string
): Promise<void> {
  await client.query(
    `UPDATE control_plane_node_credentials
     SET last_used_at = $3
     WHERE node_id = $1
       AND token_hash = $2`,
    [nodeId, tokenHash, timestamp]
  );
}

export async function upsertNodeCredential(
  client: PoolClient,
  nodeId: string,
  rawToken: string,
  timestamp: string
): Promise<void> {
  await client.query(
    `INSERT INTO control_plane_node_credentials (
       node_id,
       token_hash,
       issued_at,
       last_used_at
     )
     VALUES ($1, $2, $3, $3)
     ON CONFLICT (node_id)
     DO UPDATE SET
       token_hash = EXCLUDED.token_hash,
       issued_at = EXCLUDED.issued_at,
       last_used_at = EXCLUDED.last_used_at`,
    [nodeId, hashToken(rawToken), timestamp]
  );
}

export async function authenticateNode(
  client: PoolClient,
  nodeId: string,
  presentedToken: string | null,
  timestamp: string
): Promise<void> {
  if (!presentedToken) {
    throw new NodeAuthorizationError("Missing bearer token.");
  }

  const credential = await getNodeCredential(client, nodeId);

  if (!credential) {
    throw new NodeAuthorizationError(`Node ${nodeId} is not enrolled.`);
  }

  const presentedTokenHash = hashToken(presentedToken);

  if (presentedTokenHash !== credential.token_hash) {
    throw new NodeAuthorizationError(`Bearer token rejected for node ${nodeId}.`);
  }

  await touchNodeCredential(client, nodeId, presentedTokenHash, timestamp);
}

export async function getUserByEmail(
  client: PoolClient,
  email: string
): Promise<UserRow | null> {
  const result = await client.query<UserRow>(
    `SELECT user_id, email, display_name, status
     FROM shp_users
     WHERE email = $1`,
    [normalizeEmail(email)]
  );

  return result.rows[0] ?? null;
}

export async function getUserById(client: PoolClient, userId: string): Promise<UserRow | null> {
  const result = await client.query<UserRow>(
    `SELECT user_id, email, display_name, status
     FROM shp_users
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function getUserCredential(
  client: PoolClient,
  userId: string
): Promise<UserCredentialRow | null> {
  const result = await client.query<UserCredentialRow>(
    `SELECT user_id, password_hash, password_salt, password_params
     FROM shp_user_credentials
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function upsertUserCredential(
  client: PoolClient,
  userId: string,
  password: string
): Promise<void> {
  const hashed = await createPasswordHash(password);

  await client.query(
    `INSERT INTO shp_user_credentials (
       user_id,
       password_hash,
       password_salt,
       password_params,
       updated_at
     )
     VALUES ($1, $2, $3, $4::jsonb, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       password_salt = EXCLUDED.password_salt,
       password_params = EXCLUDED.password_params,
       updated_at = EXCLUDED.updated_at`,
    [userId, hashed.hash, hashed.salt, JSON.stringify(hashed.params)]
  );
}

export async function replaceUserGlobalRoles(
  client: PoolClient,
  userId: string,
  roles: ControlGlobalRole[]
): Promise<void> {
  await client.query(`DELETE FROM shp_user_global_roles WHERE user_id = $1`, [userId]);

  for (const role of roles) {
    await client.query(
      `INSERT INTO shp_user_global_roles (user_id, role)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role) DO NOTHING`,
      [userId, role]
    );
  }
}

export async function replaceUserTenantMemberships(
  client: PoolClient,
  userId: string,
  memberships: Array<{ tenantSlug: string; role: TenantMembershipRole }>
): Promise<void> {
  await client.query(`DELETE FROM shp_memberships WHERE user_id = $1`, [userId]);

  for (const membership of memberships) {
    const tenantResult = await client.query<{ tenant_id: string }>(
      `SELECT tenant_id
       FROM shp_tenants
       WHERE slug = $1`,
      [membership.tenantSlug]
    );
    const tenant = tenantResult.rows[0];

    if (!tenant) {
      throw new Error(`Tenant ${membership.tenantSlug} does not exist.`);
    }

    await client.query(
      `INSERT INTO shp_memberships (tenant_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [tenant.tenant_id, userId, membership.role]
    );
  }
}

export async function getUserGlobalRoles(
  client: PoolClient,
  userId: string
): Promise<ControlGlobalRole[]> {
  const result = await client.query<UserGlobalRoleRow>(
    `SELECT role
     FROM shp_user_global_roles
     WHERE user_id = $1
     ORDER BY role ASC`,
    [userId]
  );

  return result.rows
    .map((row) => row.role)
    .filter((role): role is ControlGlobalRole =>
      controlGlobalRoles.includes(role as ControlGlobalRole)
    );
}

export async function getUserMemberships(
  client: PoolClient,
  userId: string
): Promise<AuthenticatedUserSummary["tenantMemberships"]> {
  const result = await client.query<UserMembershipRow>(
    `SELECT
       memberships.tenant_id,
       tenants.slug AS tenant_slug,
       tenants.display_name AS tenant_display_name,
       memberships.role
     FROM shp_memberships memberships
     INNER JOIN shp_tenants tenants
       ON tenants.tenant_id = memberships.tenant_id
     WHERE memberships.user_id = $1
     ORDER BY tenants.slug ASC, memberships.role ASC`,
    [userId]
  );

  return result.rows.map((row) => ({
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantDisplayName: row.tenant_display_name,
    role: row.role as TenantMembershipRole
  }));
}

export async function buildAuthenticatedUserSummary(
  client: PoolClient,
  userId: string
): Promise<AuthenticatedUserSummary> {
  const user = await getUserById(client, userId);

  if (!user) {
    throw new UserAuthorizationError(`User ${userId} does not exist.`);
  }

  const [globalRoles, tenantMemberships] = await Promise.all([
    getUserGlobalRoles(client, userId),
    getUserMemberships(client, userId)
  ]);

  return {
    userId: user.user_id,
    email: user.email,
    displayName: user.display_name,
    status: user.status,
    globalRoles,
    tenantMemberships
  };
}

export async function createSession(
  client: PoolClient,
  userId: string,
  sessionTtlSeconds: number
): Promise<{ sessionToken: string; expiresAt: string }> {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + sessionTtlSeconds * 1000);
  const sessionToken = createOpaqueSessionToken();

  await client.query(
    `INSERT INTO shp_sessions (
       session_id,
       user_id,
       session_token_hash,
       created_at,
       expires_at,
       last_used_at
     )
     VALUES ($1, $2, $3, $4, $5, $4)`,
    [
      randomUUID(),
      userId,
      hashToken(sessionToken),
      createdAt.toISOString(),
      expiresAt.toISOString()
    ]
  );

  return {
    sessionToken,
    expiresAt: expiresAt.toISOString()
  };
}

export async function authenticateSession(
  client: PoolClient,
  presentedToken: string | null,
  nowIso = new Date().toISOString()
): Promise<AuthenticatedUserSummary> {
  if (!presentedToken) {
    throw new UserAuthorizationError("Missing session token.");
  }

  const result = await client.query<SessionRow>(
    `SELECT session_id, user_id, expires_at, revoked_at
     FROM shp_sessions
     WHERE session_token_hash = $1`,
    [hashToken(presentedToken)]
  );
  const session = result.rows[0];

  if (!session) {
    throw new UserAuthorizationError("Invalid session token.");
  }

  if (session.revoked_at) {
    throw new UserAuthorizationError("Session has been revoked.");
  }

  if (new Date(session.expires_at).getTime() <= new Date(nowIso).getTime()) {
    throw new UserAuthorizationError("Session has expired.");
  }

  await client.query(
    `UPDATE shp_sessions
     SET last_used_at = $2
     WHERE session_id = $1`,
    [session.session_id, nowIso]
  );

  return buildAuthenticatedUserSummary(client, session.user_id);
}

export function ensureGlobalRole(
  user: AuthenticatedUserSummary,
  allowedRoles: ControlGlobalRole[]
): void {
  if (!allowedRoles.some((role) => user.globalRoles.includes(role))) {
    throw new UserAuthorizationError("User does not have the required role.");
  }
}

export async function requireAuthorizedUser(
  client: PoolClient,
  presentedToken: string | null,
  allowedRoles: ControlGlobalRole[]
): Promise<AuthenticatedUserSummary> {
  const user = await authenticateSession(client, presentedToken);
  ensureGlobalRole(user, allowedRoles);
  return user;
}

export async function ensureBootstrapAdmin(
  pool: Pool,
  options: ControlPlaneStoreOptions
): Promise<void> {
  if (!options.bootstrapAdminEmail || !options.bootstrapAdminPassword) {
    return;
  }

  await withTransaction(pool, async (client) => {
    const email = normalizeEmail(options.bootstrapAdminEmail!);
    const existing = await getUserByEmail(client, email);
    const userId = existing?.user_id ?? `user-${randomUUID()}`;

    if (!existing) {
      await client.query(
        `INSERT INTO shp_users (
           user_id,
           email,
           display_name,
           status
         )
         VALUES ($1, $2, $3, 'active')`,
        [userId, email, options.bootstrapAdminName ?? "Bootstrap Admin"]
      );
    } else {
      await client.query(
        `UPDATE shp_users
         SET display_name = $2,
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId, options.bootstrapAdminName ?? existing.display_name]
      );
    }

    await upsertUserCredential(client, userId, options.bootstrapAdminPassword!);
    await replaceUserGlobalRoles(client, userId, ["platform_admin"]);

    await insertAuditEvent(client, {
      actorType: "system",
      actorId: "bootstrap",
      eventType: "user.bootstrap_admin_ensured",
      entityType: "user",
      entityId: userId,
      payload: {
        email
      }
    });
  });
}

interface ControlPlaneAuthContext {
  pool: Pool;
  options: ControlPlaneStoreOptions;
  pollIntervalMs: number;
  jobPayloadKey: Buffer | null;
}

export function createControlPlaneAuthMethods(
  context: ControlPlaneAuthContext
): ControlPlaneAuthMethods {
  const { pool, options, pollIntervalMs, jobPayloadKey } = context;

  return {
    async registerNode(request, presentedToken) {
      const acceptedAt = new Date().toISOString();
      let issuedNodeToken: string | undefined;

      await withTransaction(pool, async (client) => {
        const credential = await getNodeCredential(client, request.nodeId);

        if (credential) {
          await authenticateNode(client, request.nodeId, presentedToken, acceptedAt);
        } else {
          if (!options.bootstrapEnrollmentToken) {
            throw new NodeAuthorizationError(
              "Bootstrap enrollment token is not configured on SimpleHost Control."
            );
          }

          if (presentedToken !== options.bootstrapEnrollmentToken) {
            throw new NodeAuthorizationError(
              `Enrollment token rejected for node ${request.nodeId}.`
            );
          }

          issuedNodeToken = createOpaqueSessionToken();
        }

        await client.query(
          `INSERT INTO control_plane_nodes (
             node_id,
             hostname,
             version,
             supported_job_kinds,
             runtime_snapshot,
             accepted_at,
             last_seen_at
           )
           VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $6)
           ON CONFLICT (node_id)
           DO UPDATE SET
             hostname = EXCLUDED.hostname,
             version = EXCLUDED.version,
             supported_job_kinds = EXCLUDED.supported_job_kinds,
             runtime_snapshot = EXCLUDED.runtime_snapshot,
             last_seen_at = EXCLUDED.last_seen_at`,
          [
            request.nodeId,
            request.hostname,
            request.version,
            JSON.stringify(request.supportedJobKinds),
            JSON.stringify(request.runtimeSnapshot ?? {}),
            acceptedAt
          ]
        );

        if (issuedNodeToken) {
          await upsertNodeCredential(client, request.nodeId, issuedNodeToken, acceptedAt);
        }

        await insertAuditEvent(client, {
          actorType: "node",
          actorId: request.nodeId,
          eventType: "node.upserted",
          entityType: "node",
          entityId: request.nodeId,
          payload: {
            hostname: request.hostname,
            version: request.version,
            supportedJobKinds: request.supportedJobKinds,
            issuedNodeToken: issuedNodeToken !== undefined
          },
          occurredAt: acceptedAt
        });
      });

      return {
        nodeId: request.nodeId,
        acceptedAt,
        pollIntervalMs,
        nodeToken: issuedNodeToken
      };
    },

    async claimJobs(request, presentedToken) {
      const claimedAt = new Date().toISOString();

      const jobs = await withTransaction(pool, async (client) => {
        await authenticateNode(client, request.nodeId, presentedToken, claimedAt);

        await client.query(
          `UPDATE control_plane_nodes
           SET hostname = $2,
               version = $3,
               runtime_snapshot = $4::jsonb,
               last_seen_at = $5
           WHERE node_id = $1`,
          [
            request.nodeId,
            request.hostname,
            request.version,
            JSON.stringify(request.runtimeSnapshot ?? {}),
            claimedAt
          ]
        );

        const staleClaimedBefore = new Date(
          Date.parse(claimedAt) - reclaimableJobClaimTimeoutMs
        ).toISOString();

        const result = await client.query<JobRow>(
          `WITH candidate_jobs AS (
             SELECT id
             FROM control_plane_jobs
             WHERE node_id = $1
               AND completed_at IS NULL
               AND (
                 claimed_at IS NULL
                 OR (
                   kind = ANY($4::text[])
                   AND claimed_at < $5
                 )
               )
             ORDER BY created_at ASC
             LIMIT $2
             FOR UPDATE SKIP LOCKED
           ),
           claimed_jobs AS (
             UPDATE control_plane_jobs jobs
             SET claimed_at = $3
             FROM candidate_jobs candidates
             WHERE jobs.id = candidates.id
             RETURNING
               jobs.id,
               jobs.desired_state_version,
               jobs.kind,
               jobs.node_id,
               jobs.created_at,
               jobs.payload
           )
           SELECT *
           FROM claimed_jobs
           ORDER BY created_at ASC`,
          [
            request.nodeId,
            request.maxJobs,
            claimedAt,
            [...reclaimableClaimedJobKinds],
            staleClaimedBefore
          ]
        );

        await insertAuditEvent(client, {
          actorType: "node",
          actorId: request.nodeId,
          eventType: "jobs.claimed",
          entityType: "node",
          entityId: request.nodeId,
          payload: {
            jobIds: result.rows.map((row) => row.id),
            maxJobs: request.maxJobs,
            hostname: request.hostname,
            version: request.version
          },
          occurredAt: claimedAt
        });

        return result.rows.map((row) =>
          toDispatchedJob(row, jobPayloadKey, { sanitizeSecrets: false })
        );
      });

      return {
        nodeId: request.nodeId,
        claimedAt,
        jobs
      };
    },

    async reportJob(request, presentedToken) {
      const reportedAt = new Date().toISOString();

      await withTransaction(pool, async (client) => {
        await authenticateNode(client, request.nodeId, presentedToken, reportedAt);

        await client.query(
          `UPDATE control_plane_nodes
           SET last_seen_at = $2
           WHERE node_id = $1`,
          [request.nodeId, reportedAt]
        );

        if (
          (request.result.kind === "package.inventory.collect" ||
            request.result.kind === "package.install") &&
          request.result.status === "applied"
        ) {
          const reportedPackages = extractReportedInstalledPackages(request.result.details);

          if (reportedPackages) {
            await replaceNodeInstalledPackages(
              client,
              request.nodeId,
              request.result.completedAt,
              reportedPackages
            );
          }
        }

        if (
          request.result.kind === "code-server.update" &&
          request.result.details &&
          typeof request.result.details === "object" &&
          !Array.isArray(request.result.details) &&
          "after" in request.result.details
        ) {
          const afterSnapshot = (request.result.details as Record<string, unknown>).after;

          if (afterSnapshot && typeof afterSnapshot === "object" && !Array.isArray(afterSnapshot)) {
            await client.query(
              `UPDATE control_plane_nodes
               SET runtime_snapshot = jsonb_set(
                     COALESCE(runtime_snapshot, '{}'::jsonb),
                     '{codeServer}',
                     $2::jsonb,
                     true
                   )
               WHERE node_id = $1`,
              [request.nodeId, JSON.stringify(afterSnapshot)]
            );
          }
        }

        const jobResult = await client.query<JobRow>(
          `SELECT
             id,
             desired_state_version,
             kind,
             node_id,
             created_at,
             payload
           FROM control_plane_jobs
           WHERE id = $1`,
          [request.result.jobId]
        );
        const storedJob = jobResult.rows[0];

        if (!storedJob) {
          throw new Error(`Claimed job ${request.result.jobId} no longer exists.`);
        }

        await client.query(
          `UPDATE control_plane_jobs
           SET completed_at = $2,
               payload = $3::jsonb
           WHERE id = $1`,
          [
            request.result.jobId,
            request.result.completedAt,
            JSON.stringify(
              stripSensitivePayloadFields(
                decodeStoredJobPayload(storedJob.payload, jobPayloadKey)
              )
            )
          ]
        );

        await client.query(
          `INSERT INTO control_plane_job_results (
             job_id,
             kind,
             node_id,
             status,
             summary,
             details,
             completed_at,
             reported_at
           )
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
           ON CONFLICT (job_id)
           DO UPDATE SET
             kind = EXCLUDED.kind,
             node_id = EXCLUDED.node_id,
             status = EXCLUDED.status,
             summary = EXCLUDED.summary,
             details = EXCLUDED.details,
             completed_at = EXCLUDED.completed_at,
             reported_at = EXCLUDED.reported_at`,
          [
            request.result.jobId,
            request.result.kind,
            request.result.nodeId,
            request.result.status,
            request.result.summary,
            JSON.stringify(request.result.details ?? null),
            request.result.completedAt,
            reportedAt
          ]
        );

        await insertAuditEvent(client, {
          actorType: "node",
          actorId: request.nodeId,
          eventType: "job.reported",
          entityType: "job",
          entityId: request.result.jobId,
          payload: {
            kind: request.result.kind,
            status: request.result.status,
            summary: request.result.summary
          },
          occurredAt: reportedAt
        });
      });

      return {
        accepted: true as const
      };
    },

    async loginUser(request) {
      return withTransaction(pool, async (client) => {
        const user = await getUserByEmail(client, request.email);

        if (!user) {
          throw new UserAuthorizationError("Invalid email or password.");
        }

        const credential = await getUserCredential(client, user.user_id);

        if (!credential) {
          throw new UserAuthorizationError("Invalid email or password.");
        }

        const passwordMatches = await verifyPasswordHash(request.password, {
          hash: credential.password_hash,
          salt: credential.password_salt,
          params: credential.password_params
        });

        if (!passwordMatches) {
          throw new UserAuthorizationError("Invalid email or password.");
        }

        const session = await createSession(client, user.user_id, options.sessionTtlSeconds);
        const summary = await buildAuthenticatedUserSummary(client, user.user_id);

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: user.user_id,
          eventType: "auth.login",
          entityType: "user",
          entityId: user.user_id,
          payload: {
            email: user.email
          }
        });

        return {
          sessionToken: session.sessionToken,
          expiresAt: session.expiresAt,
          user: summary
        };
      });
    },

    async getCurrentUser(presentedToken) {
      return withTransaction(pool, (client) => authenticateSession(client, presentedToken));
    },

    async logoutUser(presentedToken) {
      return withTransaction(pool, async (client) => {
        const user = await authenticateSession(client, presentedToken);

        await client.query(
          `UPDATE shp_sessions
           SET revoked_at = NOW()
           WHERE session_token_hash = $1`,
          [hashToken(presentedToken!)]
        );

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: user.userId,
          eventType: "auth.logout",
          entityType: "user",
          entityId: user.userId
        });

        return {
          revoked: true as const
        };
      });
    },

    async createUser(request, presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, ["platform_admin"]);
        const email = normalizeEmail(request.email);
        const existing = await getUserByEmail(client, email);

        if (existing) {
          throw new Error(`User ${email} already exists.`);
        }

        const userId = `user-${randomUUID()}`;
        const globalRoles = request.globalRoles ?? [];
        const tenantMemberships = request.tenantMemberships ?? [];

        await client.query(
          `INSERT INTO shp_users (
             user_id,
             email,
             display_name,
             status
           )
           VALUES ($1, $2, $3, 'active')`,
          [userId, email, request.displayName]
        );

        await upsertUserCredential(client, userId, request.password);
        await replaceUserGlobalRoles(client, userId, globalRoles);
        await replaceUserTenantMemberships(client, userId, tenantMemberships);

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: actor.userId,
          eventType: "user.created",
          entityType: "user",
          entityId: userId,
          payload: {
            email,
            globalRoles,
            tenantMemberships
          }
        });

        return {
          user: await buildAuthenticatedUserSummary(client, userId)
        };
      });
    },

    async listUsers(presentedToken) {
      return withTransaction(pool, async (client) => {
        await requireAuthorizedUser(client, presentedToken, ["platform_admin"]);
        const result = await client.query<{ user_id: string }>(
          `SELECT user_id
           FROM shp_users
           ORDER BY created_at ASC`
        );

        const users: AuthenticatedUserSummary[] = [];

        for (const row of result.rows) {
          users.push(await buildAuthenticatedUserSummary(client, row.user_id));
        }

        return users;
      });
    }
  };
}
