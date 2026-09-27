import type { PermitResponse } from '../types';

/** 서버를 거쳐 식약처 허가정보(효능·용법·주의사항)를 가져온다. */
export async function fetchPermit(seq: string, signal?: AbortSignal): Promise<PermitResponse> {
  const res = await fetch(`/api/permit/${encodeURIComponent(seq)}`, { signal });
  if (!res.ok) throw new Error(`permit failed: ${res.status}`);
  return res.json();
}
