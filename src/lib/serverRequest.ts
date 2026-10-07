export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function validateRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    throw new ApiError(403, "허용되지 않은 요청입니다.");
  }
}

export function readCoordinate(params: URLSearchParams, key: string, limit: number) {
  const value = params.get(key);
  if (!value?.trim() || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > limit) {
    throw new ApiError(400, "올바른 출발지·도착지 또는 지도 중심 좌표가 필요합니다.");
  }
  return Number(value);
}

export function requestScope(request: Request) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (request.signal.aborted) abort();
  request.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20000);
  return {
    signal: controller.signal,
    dispose: () => { clearTimeout(timer); request.signal.removeEventListener("abort", abort); }
  };
}

export async function fetchApiJson<T>(url: URL, options: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 8000);
  try {
    const response = await fetch(url, { ...options, cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new ApiError(502, "외부 서비스에서 정보를 불러오지 못했습니다. API 권한과 사용량을 확인해주세요.");
    return await response.json() as T;
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError(504, "조회 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.");
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "외부 서비스 응답을 처리하지 못했습니다.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export function publicError(error: unknown) {
  return error instanceof ApiError ? error : new ApiError(502, "정보 조회에 실패했습니다. 네트워크와 API 설정을 확인해주세요.");
}
