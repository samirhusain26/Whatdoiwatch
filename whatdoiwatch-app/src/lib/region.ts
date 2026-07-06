// TMDB-supported watch-provider region codes (ISO 3166-1 alpha-2).
// Source: https://api.themoviedb.org/3/watch/providers/regions (snapshot of
// the commonly supported set). Used to validate the client-supplied `region`
// query param on the title-detail route before it's forwarded to TMDB.

const SUPPORTED_REGIONS = new Set([
  "AD", "AE", "AG", "AL", "AO", "AR", "AT", "AU", "AZ", "BA", "BB", "BE",
  "BF", "BG", "BH", "BI", "BJ", "BM", "BN", "BO", "BR", "BS", "BW", "BY",
  "BZ", "CA", "CD", "CG", "CH", "CI", "CL", "CM", "CN", "CO", "CR", "CU",
  "CV", "CY", "CZ", "DE", "DJ", "DK", "DO", "DZ", "EC", "EE", "EG", "ES",
  "FI", "FJ", "FR", "GA", "GB", "GF", "GG", "GH", "GI", "GM", "GQ", "GR",
  "GT", "GU", "GW", "GY", "HK", "HN", "HR", "HT", "HU", "ID", "IE", "IL",
  "IN", "IQ", "IS", "IT", "JM", "JO", "JP", "KE", "KH", "KR", "KW", "KZ",
  "LB", "LC", "LI", "LK", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME",
  "MG", "MK", "ML", "MT", "MU", "MW", "MX", "MY", "MZ", "NE", "NG", "NI",
  "NL", "NO", "NP", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL",
  "PS", "PT", "PY", "QA", "RO", "RS", "RU", "RW", "SA", "SC", "SE", "SG",
  "SI", "SK", "SM", "SN", "SR", "SV", "TC", "TD", "TG", "TH", "TN", "TR",
  "TT", "TV", "TW", "TZ", "UA", "UG", "US", "UY", "VE", "VI", "VN", "YE",
  "ZA", "ZM", "ZW",
]);

const DEFAULT_REGION = "US";

/**
 * Validates a candidate region code (e.g. from a client's `region` query
 * param) against TMDB's supported watch-provider regions, falling back to
 * DEFAULT_REGION when missing, malformed, or unsupported.
 */
export function resolveRegion(candidate: string | null | undefined): string {
  if (!candidate) return DEFAULT_REGION;
  const normalized = candidate.trim().toUpperCase();
  if (SUPPORTED_REGIONS.has(normalized)) return normalized;
  return DEFAULT_REGION;
}
