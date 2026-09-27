import express from 'express';
import type { PermitInfo, PermitResponse } from '../src/types';
import { makeCache } from './cache';

export interface AppDeps {
  /** 품목일련번호 → 허가정보 (없으면 null) */
  loadPermit: (seq: string) => Promise<PermitInfo | null>;
}

const DAY = 24 * 60 * 60 * 1000;

export function createApp({ loadPermit }: AppDeps) {
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

  return app;
}
