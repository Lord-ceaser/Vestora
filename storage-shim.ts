/**
 * The prototype was originally built for Claude's artifact sandbox, which
 * exposes a `window.storage` async key-value API (get/set/delete/list).
 * That API doesn't exist in a normal browser, so this shim reproduces the
 * same interface on top of real localStorage. Nothing else in the app
 * needed to change.
 *
 * Note: this stores data per-browser, not in a shared database. Two people
 * on two different devices will NOT see each other's accounts. Swap this
 * shim out for real API calls to your backend once you add one.
 */

type StorageResult<T> = { key: string; value: string; shared: boolean } | T;

function keyFor(key: string, shared?: boolean) {
  return `${shared ? "shared" : "personal"}:${key}`;
}

export function installStorageShim() {
  if (typeof window === "undefined") return;
  if ((window as any).storage) return;

  (window as any).storage = {
    async get(key: string, shared = false) {
      const raw = localStorage.getItem(keyFor(key, shared));
      if (raw === null) {
        throw new Error(`Key not found: ${key}`);
      }
      return { key, value: raw, shared };
    },

    async set(key: string, value: string, shared = false) {
      localStorage.setItem(keyFor(key, shared), value);
      return { key, value, shared };
    },

    async delete(key: string, shared = false) {
      localStorage.removeItem(keyFor(key, shared));
      return { key, deleted: true, shared };
    },

    async list(prefix = "", shared = false) {
      const scopePrefix = `${shared ? "shared" : "personal"}:${prefix}`;
      const keys = Object.keys(localStorage)
        .filter((k) => k.startsWith(scopePrefix))
        .map((k) => k.slice(shared ? "shared:".length : "personal:".length));
      return { keys, prefix, shared };
    },
  };
}
