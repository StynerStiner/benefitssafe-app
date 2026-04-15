// OFAC SDN screening using the free Treasury API
// https://sanctionssearch.ofac.treas.gov/
//
// DDIA Ch8 Distributed Systems audit — fail-CLOSED on network error.
//
// Previously this function caught network errors and returned
// { screened:false, matchFound:false } so callers proceeded to issue
// cards to an un-screened beneficiary. OFAC screening is a regulatory
// requirement (31 CFR Part 501); "the API was down" is not an
// acceptable defense to issuing a card to a sanctioned party.
//
// New contract: on network/HTTP error, throw OFACScreeningError. Every
// caller must treat this as a 503 "screening unavailable, try again"
// — NEVER proceed to card issuance. A transient OFAC outage becomes a
// transient issuance outage, which is the correct trade-off.

const OFAC_API_URL = "https://search.ofac.treas.gov/OpenSearch/search";

export class OFACScreeningError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "OFACScreeningError";
  }
}

interface OFACScreeningResult {
  screened: boolean;
  matchFound: boolean;
  matches: { name: string; score: number; type: string; source: string }[];
  screenedAt: string;
}

export async function screenAgainstOFAC(
  firstName: string,
  lastName: string
): Promise<OFACScreeningResult> {
  const fullName = `${firstName} ${lastName}`;

  let res: Response;
  try {
    res = await fetch(
      `${OFAC_API_URL}?q=${encodeURIComponent(fullName)}&limit=5`,
      { signal: AbortSignal.timeout(10000) }
    );
  } catch (error) {
    console.error("OFAC screening network error:", error);
    throw new OFACScreeningError(
      "OFAC screening service unreachable — card issuance blocked for regulatory reasons",
      error,
    );
  }

  if (!res.ok) {
    console.error("OFAC API non-2xx:", res.status);
    throw new OFACScreeningError(
      `OFAC screening service returned HTTP ${res.status} — card issuance blocked for regulatory reasons`,
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (error) {
    throw new OFACScreeningError("OFAC screening response was not valid JSON", error);
  }

  const results = Array.isArray(data) ? data : ((data as { results?: unknown[] })?.results || []);

  const matches = (results as Record<string, unknown>[])
    .filter((r) => typeof r.score === "number" && (r.score as number) > 80)
    .map((r) => ({
      name: (r.name as string) || (r.sdnName as string) || "Unknown",
      score: (r.score as number) || 0,
      type: (r.sdnType as string) || (r.type as string) || "Unknown",
      source: "OFAC SDN",
    }));

  return {
    screened: true,
    matchFound: matches.length > 0,
    matches,
    screenedAt: new Date().toISOString(),
  };
}
