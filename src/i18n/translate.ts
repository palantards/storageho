export type Vars = Record<string, string | number>;
export function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    const record = cur as Record<string, unknown>;
    if (!(p in record)) return undefined;
    cur = record[p];
  }
  return cur;
}

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? `{${k}}` : String(v);
  });
}

export function t(messages: unknown, key: string, vars?: Vars): string {
  const value = getByPath(messages, key);
  if (typeof value === "string") return interpolate(value, vars);
  return key;
}

export function m<T = unknown>(messages: unknown, key: string): T | undefined {
  return getByPath(messages, key) as T | undefined;
}

