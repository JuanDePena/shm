import type {
  ShmJobClaimRequest,
  ShmJobClaimResponse,
  ShmJobReportRequest,
  ShmNodeRegistrationRequest,
  ShmNodeRegistrationResponse
} from "@simplehost/manager-contracts";

async function readJsonResponse<T>(response: Response): Promise<T> {
  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Control plane request failed (${response.status}): ${bodyText || response.statusText}`
    );
  }

  if (bodyText.length === 0) {
    return {} as T;
  }

  return JSON.parse(bodyText) as T;
}

async function postJson<TRequest, TResponse>(
  baseUrl: string,
  pathname: string,
  payload: TRequest,
  authToken?: string
): Promise<TResponse> {
  const response = await fetch(new URL(pathname, baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {})
    },
    body: JSON.stringify(payload)
  });

  return readJsonResponse<TResponse>(response);
}

export function registerNode(
  baseUrl: string,
  payload: ShmNodeRegistrationRequest,
  authToken?: string
): Promise<ShmNodeRegistrationResponse> {
  return postJson(baseUrl, "/v1/nodes/register", payload, authToken);
}

export function claimJobs(
  baseUrl: string,
  payload: ShmJobClaimRequest,
  authToken?: string
): Promise<ShmJobClaimResponse> {
  return postJson(baseUrl, "/v1/jobs/claim", payload, authToken);
}

export function reportJob(
  baseUrl: string,
  payload: ShmJobReportRequest,
  authToken?: string
): Promise<{ accepted: true }> {
  return postJson(baseUrl, "/v1/jobs/report", payload, authToken);
}
