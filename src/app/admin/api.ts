/** Apeluri către rutele API ale adminului, autentificate cu tokenul Firebase */
import type { Auth } from "firebase/auth";

export async function callApi<T>(
  auth: Auth,
  path: string,
  body: unknown
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sesiune expirată — reconectează-te.");
  const token = await user.getIdToken();

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Eroare server (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Hash scurt și stabil pentru linkuri — folosit ca ID de document în inbox */
export function hashLink(link: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < link.length; i++) {
    const c = link.charCodeAt(i);
    h1 = (h1 * 33) ^ c;
    h2 = (h2 * 31) ^ c;
  }
  return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)).slice(0, 16);
}
