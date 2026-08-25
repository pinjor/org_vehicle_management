import { createClient, type RedisClientType } from "redis";

const REDIS_URL = process.env.REDIS_URL;
const CACHE_KEYS = {
  lookups: "fleetops:lookups",
  departments: "fleetops:departments",
  locations: "fleetops:locations",
} as const;

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType | null> | null = null;

async function connectRedis(): Promise<RedisClientType | null> {
  if (!REDIS_URL) return null;
  if (client?.isOpen) return client;

  if (!connectPromise) {
    connectPromise = (async () => {
      try {
        const next = createClient({ url: REDIS_URL });
        next.on("error", (err) => console.error("[redis]", err.message));
        await next.connect();
        client = next as RedisClientType;
        return client;
      } catch (err) {
        console.error("[redis] connect failed:", err instanceof Error ? err.message : err);
        client = null;
        return null;
      } finally {
        connectPromise = null;
      }
    })();
  }

  return connectPromise;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await connectRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number) {
  const redis = await connectRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    console.error("[redis] set failed:", err instanceof Error ? err.message : err);
  }
}

export async function cacheDel(...keys: string[]) {
  const redis = await connectRedis();
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(keys);
  } catch (err) {
    console.error("[redis] del failed:", err instanceof Error ? err.message : err);
  }
}

export async function withCache<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const fresh = await loader();
  void cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

export { CACHE_KEYS };
