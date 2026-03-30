// EIN (Employer Identification Number) verification utility
// Uses ProPublica Nonprofit Explorer API (free, no API key required)
// https://projects.propublica.org/nonprofits/api/

export interface EINVerificationResult {
  verified: boolean;
  organizationName?: string;
  status?: string;
  city?: string;
  state?: string;
}

interface ProPublicaOrg {
  ein: number;
  name: string;
  city: string;
  state: string;
  ntee_code: string;
  subsection_code: number;
  ruling_date: string;
  tax_period: number;
  asset_amount: number;
  income_amount: number;
  revenue_amount: number;
  have_filings: boolean;
  score: number;
}

interface ProPublicaSearchResponse {
  total_results: number;
  organizations: ProPublicaOrg[];
}

/**
 * Strips dashes and whitespace from an EIN string, returning raw 9 digits.
 */
function normalizeEIN(ein: string): string {
  return ein.replace(/[-\s]/g, "");
}

/**
 * Verifies an EIN against the ProPublica Nonprofit Explorer API.
 *
 * Accepts EINs in both "XX-XXXXXXX" and "XXXXXXXXX" formats.
 * Returns organization details if found in the IRS exempt organizations database.
 */
export async function verifyEIN(ein: string): Promise<EINVerificationResult> {
  const cleanEIN = normalizeEIN(ein);

  // Validate format: must be exactly 9 digits
  if (!/^\d{9}$/.test(cleanEIN)) {
    return { verified: false, status: "invalid_format" };
  }

  try {
    const response = await fetch(
      `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${cleanEIN}`,
      {
        headers: {
          "User-Agent": "BenefitsSafe/1.0",
        },
        // 10 second timeout for external API calls
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      console.error(
        `ProPublica API returned status ${response.status} for EIN ${cleanEIN}`
      );
      return { verified: false, status: "api_error" };
    }

    const data: ProPublicaSearchResponse = await response.json();

    if (!data.organizations || data.organizations.length === 0) {
      return { verified: false, status: "not_found" };
    }

    // Find the exact EIN match from results (search may return partial matches)
    const einNumber = parseInt(cleanEIN, 10);
    const match = data.organizations.find((org) => org.ein === einNumber);

    if (!match) {
      return { verified: false, status: "not_found" };
    }

    return {
      verified: true,
      organizationName: match.name,
      status: "verified",
      city: match.city,
      state: match.state,
    };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      console.error(`EIN verification timed out for ${cleanEIN}`);
      return { verified: false, status: "timeout" };
    }

    console.error("EIN verification error:", error);
    return { verified: false, status: "api_error" };
  }
}
