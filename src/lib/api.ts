import type { PermitResponse, PhotoGuess } from '../types';

/** 서버를 거쳐 식약처 허가정보(효능·용법·주의사항)를 가져온다. */
export async function fetchPermit(seq: string, signal?: AbortSignal): Promise<PermitResponse> {
  const res = await fetch(`/api/permit/${encodeURIComponent(seq)}`, { signal });
  if (!res.ok) throw new Error(`permit failed: ${res.status}`);
  return res.json();
}

/** 알약 사진을 서버로 보내 글자·모양·제형을 읽는다. */
export async function analyzePhoto(image: Blob): Promise<PhotoGuess> {
  const res = await fetch('/api/photo', {
    method: 'POST',
    headers: { 'Content-Type': image.type || 'image/jpeg' },
    body: image,
  });
  if (!res.ok) throw new Error(`photo failed: ${res.status}`);
  return res.json();
}
