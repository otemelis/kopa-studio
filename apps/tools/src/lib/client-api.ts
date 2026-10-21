export type ApiPayload = Record<string, unknown>;

export async function readApiPayload(response: Response): Promise<ApiPayload> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed as ApiPayload : {};
  } catch {
    return { error: response.ok ? "The server returned an unreadable response." : `Request failed with status ${response.status}.` };
  }
}

export function apiError(payload: ApiPayload, fallback: string) {
  return typeof payload.error === "string" ? payload.error : fallback;
}
