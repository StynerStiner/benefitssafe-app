// MCC (Merchant Category Code) spending controls for virtual cards
// Prevents use at certain merchant categories that would violate SSI/SSDI rules

// Blocked MCC codes - merchants where SSI/SSDI rules prohibit spending
// These are commonly used in BenefitsSafe to prevent ineligible purchases
export const BLOCKED_MCC_CODES = {
  // Gambling & Betting
  "7995": "Gambling establishments",
  "7996": "Amusement parks, carnivals, gambling establishments",
  "7999": "Gambling",

  // Alcohol & Tobacco
  "5921": "Package stores - beer, wine, liquor",
  "5912": "Drugstores and pharmacies - may include alcohol",
  "2100": "Tobacco stores",

  // Adult Entertainment
  "6211": "Securities brokers / dealers",
  "7278": "Adult entertainment",
  "7441": "Bowling alleys",

  // Weapons
  "5941": "Sporting goods stores",
  "5942": "Book stores",
  "5943": "Stationery stores",
  "5945": "Toy and game shops",
  "5946": "Camera and photographic supply stores",

  // Potentially problematic categories
  "7012": "Lodging - hotels, motels, resorts",
  "7011": "Lodging - hotels, motels, resorts",
  "5411": "Grocery stores",
  "5331": "Used merchandise stores",
  "5411": "Supermarkets",
};

// Allowed categories for restricted cards (whitelist model)
// More secure than blacklist - explicitly allows known-good categories
export const ALLOWED_CATEGORIES_BY_BENEFIT_PROGRAM: Record<string, string[]> = {
  SSI: [
    "5411", // Grocery stores
    "5422", // Meat markets
    "5441", // Candy stores
    "5451", // Dairy products stores
    "5462", // Bakeries
    "5499", // Miscellaneous food stores
    "5812", // Eating places, restaurants
    "5814", // Fast food restaurants
    "5999", // Miscellaneous and specialty retail stores
    "5912", // Drug stores and pharmacies
    "8011", // Doctors
    "8021", // Dentists
    "8031", // Osteopaths
    "8041", // Chiropractors
    "8211", // Elementary and secondary schools
    "8220", // Colleges, universities, professional schools
    "4111", // Local and suburban transit and commuter transportation
    "4121", // Taxicabs and limousines
    "4131", // Bus lines
    "4789", // Transportation services (ambulance, etc)
    "5261", // Fuel dealers (gasoline)
    "5541", // Gas stations with convenience stores
    "5542", // Gas stations with grocery stores
    "5983", // Fuel dealers - non-automotive
    "7210", // Laundries - coin operated
    "7215", // Laundry services (cleaning and laundry)
    "7296", // Clothing rental
    "7511", // Car rental agencies
    "7512", // Truck rental agencies
    "7513", // Motor home (RV) rental agencies
    "7519", // Motor home and recreational vehicle rental agencies
    "8022", // Dental laboratories
    "8062", // Hospitals
    "8071", // Medical and dental laboratories
    "8099", // All other professional services
    "8111", // Legal services
    "8211", // Elementary and secondary schools
    "8220", // Colleges and universities
    "8241", // Vocational and trade schools
    "8244", // Business and secretarial schools
    "8249", // Vocational schools and trade schools
    "8651", // Political organizations
    "8661", // Religious organizations
    "8699", // Membership organizations
    "8734", // Testing laboratories
    "8911", // Accounting and bookkeeping services
    "8931", // Architectural and engineering services
  ],
  MEDI_CAL: [
    "5411", // Grocery
    "5812", // Restaurants
    "5912", // Pharmacies
    "8011", // Doctors
    "8021", // Dentists
    "8062", // Hospitals
    "8211", // Schools
    "4111", // Transit
  ],
  CALFRESH: [
    "5411", // Grocery
    "5422", // Meat markets
    "5461", // Bakeries
    "5499", // Food stores
  ],
};

export interface MCCValidation {
  allowed: boolean;
  reason?: string;
  blockedCategory?: string;
}

/**
 * Check if a merchant category code (MCC) is allowed based on benefit programs
 */
export function validateMCC(
  mcc: string | undefined,
  benefitPrograms: string[] = [],
): MCCValidation {
  if (!mcc) {
    // Unknown MCC - default to blocked for safety
    return {
      allowed: false,
      reason: "Merchant category unknown - request manual approval",
    };
  }

  // Check if MCC is in global blocked list
  if (BLOCKED_MCC_CODES[mcc as keyof typeof BLOCKED_MCC_CODES]) {
    return {
      allowed: false,
      blockedCategory: BLOCKED_MCC_CODES[mcc as keyof typeof BLOCKED_MCC_CODES],
      reason: `Merchant category blocked: ${BLOCKED_MCC_CODES[mcc as keyof typeof BLOCKED_MCC_CODES]}`,
    };
  }

  // If beneficiary has benefit programs, check against whitelist
  if (benefitPrograms.length > 0) {
    const allowedMCCs = new Set<string>();
    for (const program of benefitPrograms) {
      const programAllowed = ALLOWED_CATEGORIES_BY_BENEFIT_PROGRAM[program] || [];
      programAllowed.forEach((code) => allowedMCCs.add(code));
    }

    // If we have a whitelist and MCC is not in it, deny
    if (allowedMCCs.size > 0 && !allowedMCCs.has(mcc)) {
      return {
        allowed: false,
        reason: `Merchant category not allowed for your benefit programs`,
      };
    }
  }

  return {
    allowed: true,
  };
}

/**
 * Get human-readable MCC description
 */
export function getMCCDescription(mcc: string): string {
  return BLOCKED_MCC_CODES[mcc as keyof typeof BLOCKED_MCC_CODES] || `Merchant category ${mcc}`;
}
