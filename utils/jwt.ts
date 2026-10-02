/** Срок действия JWT (exp, мс) без проверки подписи; null — токен не разобран или без exp */
export function jwtExpiresAt(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    const exp = Number(payload?.exp);
    return Number.isFinite(exp) && exp > 0 ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Токен истёк (с запасом skewMs на расхождение часов и время запроса) */
export function isJwtExpired(token: string | null | undefined, now = Date.now(), skewMs = 5_000): boolean {
  const expiresAt = jwtExpiresAt(token);
  return expiresAt !== null && expiresAt - skewMs <= now;
}
