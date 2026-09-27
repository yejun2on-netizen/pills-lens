import express from 'express';
import type { PermitInfo, PermitResponse, PhotoGuess } from '../src/types';
import { makeCache } from './cache';

export interface AppDeps {
  /** 품목일련번호 → 허가정보 (없으면 null) */
  loadPermit: (seq: string) => Promise<PermitInfo | null>;
  /** 알약 사진 → 판독 결과 */
  analyzePhoto: (image: Buffer, mime: string) => Promise<PhotoGuess>;
}

const DAY = 24 * 60 * 60 * 1000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function createApp({ loadPermit, analyzePhoto }: AppDeps) {
  const app = express();
  // 개발계정 트래픽이 하루 10,000건이라, 같은 약은 하루 동안 다시 부르지 않는다.
  const cache = makeCache<PermitInfo | null>(DAY);

  app.get('/api/permit/:seq', async (req, res) => {
    const { seq } = req.params;
    if (!/^\d{9}$/.test(seq)) return res.status(400).json({ error: 'invalid_seq' });
    try {
      const permit = await cache.getOrLoad(seq, () => loadPermit(seq));
      const body: PermitResponse = permit ? { found: true, permit } : { found: false };
      res.json(body);
    } catch (e) {
      console.error(`[permit ${seq}]`, e instanceof Error ? e.message : e);
      res.status(502).json({ error: 'permit_failed' });
    }
  });

  // 사진은 판독에만 쓰고 저장하지 않는다. 브라우저에서 줄여 보내므로 8MB면 넉넉하다.
  app.post('/api/photo', express.raw({ type: IMAGE_TYPES, limit: '8mb' }), async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'no_image' });
    try {
      res.json(await analyzePhoto(req.body, req.get('content-type') ?? 'image/jpeg'));
    } catch (e) {
      console.error('[photo]', e instanceof Error ? e.message : e);
      res.status(502).json({ error: 'photo_failed' });
    }
  });

  return app;
}
