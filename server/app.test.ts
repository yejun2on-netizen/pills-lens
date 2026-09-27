// @vitest-environment node
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { PermitInfo } from '../src/types';
import { createApp } from './app';
import { makeCache } from './cache';

const permit = { seq: '201706199', name: '코메키나캡슐' } as PermitInfo;
async function serve(loadPermit: (seq: string) => Promise<PermitInfo | null>) {
  const server: Server = await new Promise((resolve) => {
    const s = createApp({ loadPermit }).listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { get: (path: string) => fetch(base + path), close: () => server.close() };
}

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
