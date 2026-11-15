import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetches a URL a user typed in (calendar links) without letting it reach private addresses.
 * https only, no IP literals, every redirect hop re-checked, and the body capped.
 */

function privateIp(ip: string): boolean {
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v = ip.toLowerCase();
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

async function checkUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "https:") throw new Error("https only");
  if (u.username || u.password) throw new Error("no credentials in links");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("blocked host");
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new Error("blocked host");
  return u;
}

export async function safeFetchText(
  raw: string,
  opts: { maxBytes?: number; timeoutMs?: number; revalidate?: number } = {},
): Promise<{ ok: boolean; text: string }> {
  const maxBytes = opts.maxBytes ?? 2_000_000;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 8000);
  let url = await checkUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      ...(opts.revalidate ? { next: { revalidate: opts.revalidate } } : { cache: "no-store" as const }),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, text: "" };
      url = await checkUrl(new URL(loc, url).toString());
      continue;
    }
    if (!res.ok || !res.body) return { ok: false, text: "" };
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("too large");
      }
      chunks.push(value);
    }
    return { ok: true, text: Buffer.concat(chunks).toString("utf8") };
  }
  throw new Error("too many redirects");
}
