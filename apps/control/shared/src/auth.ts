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
