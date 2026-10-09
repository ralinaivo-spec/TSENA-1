// Petits compléments pour les anciens téléphones (iOS 12, Android 8 avec un vieux Chrome) : chargé en premier.
const g = globalThis as any;
if (!Object.fromEntries) (Object as any).fromEntries = (it: Iterable<[PropertyKey, unknown]>) => { const o: any = {}; for (const [k, v] of it) o[k] = v; return o; };
if (!g.queueMicrotask) g.queueMicrotask = (cb: () => void) => Promise.resolve().then(cb);
if (!(Array.prototype as any).flat) (Array.prototype as any).flat = function (this: unknown[], d = 1): unknown[] { return d > 0 ? this.reduce<unknown[]>((a, x) => a.concat(Array.isArray(x) ? (x as any).flat(d - 1) : x), []) : this.slice(); };
if (!(Array.prototype as any).flatMap) (Array.prototype as any).flatMap = function (this: unknown[], f: (x: unknown, i: number, a: unknown[]) => unknown) { return (this.map(f) as any).flat(1); };
if (!(String.prototype as any).replaceAll) (String.prototype as any).replaceAll = function (this: string, a: string, b: string) { return this.split(a).join(b); };
if (!g.globalThis) g.globalThis = g;
export {};
