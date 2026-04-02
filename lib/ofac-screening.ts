// OFAC SDN screening using the free Treasury API
// https://sanctionssearch.ofac.treas.gov/

const OFAC_API_URL = "https://search.ofac.treas.gov/OpenSearch/search";

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
  try {
    const fullName = `${firstName} ${lastName}`;

    // Use OFAC's free search API
    const res = await fetch(
      `${OFAC_API_URL}?q=${encodeURIComponent(fullName)}&limit=5`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) {
      // If OFAC API is down, log but don't block (fail open with flag)
      console.error("OFAC API error:", res.status);
      return {
        screened: false,
        matchFound: false,
        matches: [],
        screenedAt: new Date().toISOString(),
      };
    }

    const data = await res.json();
    const results = Array.isArray(data) ? data : (data?.results || []);

    const matches = results
      .filter((r: Record<string, unknown>) => typeof r.score === "number" && (r.score as number) > 80)
      .map((r: Record<string, unknown>) => ({
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
  } catch (error) {
    console.error("OFAC screening error:", error);
    return {
      screened: false,
      matchFound: false,
      matches: [],
      screenedAt: new Date().toISOString(),
    };
  }
}
