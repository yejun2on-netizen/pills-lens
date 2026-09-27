// @vitest-environment node
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { PermitInfo, PhotoGuess } from '../src/types';
import { createApp, type AppDeps } from './app';
import { makeCache } from './cache';

const permit = { seq: '201706199', name: '코메키나캡슐' } as PermitInfo;
const guess: PhotoGuess = { text: 'MQTDW', shape: '장방형', colors: ['주황', '노랑'], form: '경질캡슐', line: '없음' };

async function serve(loadPermit: AppDeps['loadPermit'], analyzePhoto: AppDeps['analyzePhoto'] = async () => guess) {
  const server: Server = await new Promise((resolve) => {
    const s = createApp({ loadPermit, analyzePhoto }).listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    get: (path: string) => fetch(base + path),
    post: (path: string, body: BodyInit, type: string) => fetch(base + path, { method: 'POST', body, headers: { 'Content-Type': type } }),
    close: () => server.close(),
  };
}

describe('POST /api/photo', () => {
  it('사진 바이트와 형식을 판독기에 넘기고 결과를 돌려준다', async () => {
    const analyze = vi.fn(async () => guess);
    const api = await serve(async () => null, analyze);
    const res = await api.post('/api/photo', new Uint8Array([1, 2, 3]), 'image/png');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(guess);
    expect(analyze).toHaveBeenCalledWith(Buffer.from([1, 2, 3]), 'image/png');
    api.close();
  });

  it('이미지가 아니거나 비어 있으면 400', async () => {
    const analyze = vi.fn(async () => guess);
    const api = await serve(async () => null, analyze);
    expect((await api.post('/api/photo', 'hello', 'text/plain')).status).toBe(400);
    expect((await api.post('/api/photo', new Uint8Array(), 'image/jpeg')).status).toBe(400);
    expect(analyze).not.toHaveBeenCalled();
    api.close();
  });

  it('판독이 실패하면 502, 오류 내용은 싣지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = await serve(async () => null, async () => { throw new Error('secret detail'); });
    const res = await api.post('/api/photo', new Uint8Array([1]), 'image/jpeg');
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('secret detail');
    api.close();
  });
});

describe('GET /api/permit/:seq', () => {
  it('허가정보가 있으면 found: true', async () => {
    const api = await serve(async () => permit);
    const res = await api.get('/api/permit/201706199');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ found: true, permit });
    api.close();
  });

  it('없으면 found: false', async () => {
    const api = await serve(async () => null);
    expect(await (await api.get('/api/permit/200808877')).json()).toEqual({ found: false });
    api.close();
  });

  it('품목일련번호 형식이 아니면 400, 외부 API는 부르지 않는다', async () => {
    const load = vi.fn(async () => permit);
    const api = await serve(load);
    expect((await api.get('/api/permit/abc')).status).toBe(400);
    expect((await api.get('/api/permit/12345')).status).toBe(400);
    expect(load).not.toHaveBeenCalled();
    api.close();
  });

  it('같은 약은 캐시해서 외부 API를 한 번만 부른다', async () => {
    const load = vi.fn(async () => permit);
    const api = await serve(load);
    await api.get('/api/permit/201706199');
    await api.get('/api/permit/201706199');
    expect(load).toHaveBeenCalledTimes(1);
    api.close();
  });

  it('외부 API가 실패하면 502, 오류 내용은 응답에 싣지 않는다', async () => {
    const api = await serve(async () => { throw new Error('secret detail'); });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await api.get('/api/permit/201706199');
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('secret detail');
    api.close();
  });
});

describe('makeCache', () => {
  it('만료되면 다시 불러오고, 실패는 저장하지 않는다', async () => {
    let t = 0;
    const cache = makeCache<number>(1000, () => t);
    const load = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(1);
    await expect(cache.getOrLoad('k', load)).rejects.toThrow('x');
    expect(await cache.getOrLoad('k', load)).toBe(1);
    expect(await cache.getOrLoad('k', load)).toBe(1);
    expect(load).toHaveBeenCalledTimes(2);
    t = 1001;
    await cache.getOrLoad('k', load);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('동시에 같은 키를 요청하면 한 번만 불러온다', async () => {
    const cache = makeCache<number>(1000);
    const load = vi.fn(async () => 7);
    expect(await Promise.all([cache.getOrLoad('k', load), cache.getOrLoad('k', load)])).toEqual([7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
