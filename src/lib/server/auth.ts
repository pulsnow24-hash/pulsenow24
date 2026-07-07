/**
 * Verifică tokenul Firebase Auth trimis de admin în antetul Authorization.
 * Folosește endpointul REST accounts:lookup — nu necesită firebase-admin.
 */

function firebaseApiKey(): string | undefined {
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  }
  if (process.env.FIREBASE_WEBAPP_CONFIG) {
    return (JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG) as { apiKey?: string })
      .apiKey;
  }
  return undefined;
}

export async function isAuthorized(request: Request): Promise<boolean> {
  const header = request.headers.get("authorization") ?? "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  const apiKey = firebaseApiKey();
  if (!idToken || !apiKey) return false;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { users?: unknown[] };
    return Array.isArray(data.users) && data.users.length > 0;
  } catch {
    return false;
  }
}
