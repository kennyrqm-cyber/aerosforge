const LEGACY_STRICT_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

/**
 * Preserve strict certificate and hostname verification across pg driver upgrades.
 * Neon-generated URLs currently use sslmode=require, whose meaning is changing in pg v9.
 */
export function normalizeDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");
  if (sslMode && LEGACY_STRICT_SSL_MODES.has(sslMode)) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}
