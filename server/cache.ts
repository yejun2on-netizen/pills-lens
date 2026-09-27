export interface Cache<T> {
  getOrLoad(key: string, loader: () => Promise<T>): Promise<T>;
}

/**
 * 만료 시간이 있는 in-memory 캐시.
 * - 같은 키를 동시에 요청하면 외부 API는 한 번만 부른다.
 * - 실패(reject)는 저장하지 않아 다음 요청에서 다시 시도한다.
 */
export function makeCache<T>(ttlMs: number, now: () => number = Date.now): Cache<T> {
  const store = new Map<string, { value: T; expires: number }>();
  const inflight = new Map<string, Promise<T>>();
  return {
    async getOrLoad(key, loader) {
      const hit = store.get(key);
      if (hit && hit.expires > now()) return hit.value;
      const pending = inflight.get(key);
      if (pending) return pending;
      const p = loader()
        .then((value) => {
          store.set(key, { value, expires: now() + ttlMs });
          return value;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
      return p;
    },
  };
}
