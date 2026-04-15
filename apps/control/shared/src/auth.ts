import type {
  AuthLoginRequest,
  AuthLoginResponse,
  AuthenticatedUserSummary
} from "@simplehost/panel-contracts";

export interface ControlAuthSurface {
  login(credentials: AuthLoginRequest): Promise<AuthLoginResponse>;
  logout(token: string | null): Promise<void>;
  getCurrentUser(token: string | null): Promise<AuthenticatedUserSummary>;
}

export interface ControlAnonymousSession {
  state: "anonymous";
  token: null;
  currentUser: null;
}

export interface ControlAuthenticatedSession {
  state: "authenticated";
  token: string;
  currentUser: AuthenticatedUserSummary;
}

export type ControlResolvedSession =
  | ControlAnonymousSession
  | ControlAuthenticatedSession;

export interface ControlSessionSurface {
  resolve(token: string | null): Promise<ControlResolvedSession>;
  require(token: string | null): Promise<ControlAuthenticatedSession>;
  isAuthenticated(token: string | null): Promise<boolean>;
}

export class ControlSessionRequiredError extends Error {
  readonly statusCode = 401;

  constructor(message = "Session required") {
    super(message);
    this.name = "ControlSessionRequiredError";
  }
}

export function readSessionTokenFromCookieHeader(
  cookieHeader: string | string[] | undefined
): string | null {
  if (typeof cookieHeader !== "string" || cookieHeader.length === 0) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");

    if (rawName !== "shp_session") {
      continue;
    }

    return decodeURIComponent(rawValue.join("="));
  }

  return null;
}

export async function resolveControlSession(
  token: string | null,
  auth: Pick<ControlAuthSurface, "getCurrentUser">
): Promise<ControlResolvedSession> {
  if (!token) {
    return {
      state: "anonymous",
      token: null,
      currentUser: null
    };
  }

  return {
    state: "authenticated",
    token,
    currentUser: await auth.getCurrentUser(token)
  };
}

export async function requireControlSession(
  token: string | null,
  auth: Pick<ControlAuthSurface, "getCurrentUser">
): Promise<ControlAuthenticatedSession> {
  const session = await resolveControlSession(token, auth);

  if (session.state === "anonymous") {
    throw new ControlSessionRequiredError();
  }

  return session;
}

export function createControlSessionSurface(
  auth: Pick<ControlAuthSurface, "getCurrentUser">
): ControlSessionSurface {
  return {
    resolve: (token) => resolveControlSession(token, auth),
    require: (token) => requireControlSession(token, auth),
    isAuthenticated: async (token) =>
      (await resolveControlSession(token, auth)).state === "authenticated"
  };
}

export function isUnauthorizedStatusCode(statusCode: number): boolean {
  return statusCode === 401;
}

export function isUnauthorizedError(
  error: unknown
): error is { statusCode: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number" &&
    isUnauthorizedStatusCode((error as { statusCode: number }).statusCode)
  );
}
