const COUNTRY_NAMES: Record<string, string> = {
  AD: "Andorra",
  AE: "United Arab Emirates",
  AF: "Afghanistan",
  AL: "Albania",
  AR: "Argentina",
  AT: "Austria",
  AU: "Australia",
  BD: "Bangladesh",
  BE: "Belgium",
  BG: "Bulgaria",
  BR: "Brazil",
  CA: "Canada",
  CH: "Switzerland",
  CN: "China",
  DE: "Germany",
  DK: "Denmark",
  ES: "Spain",
  FR: "France",
  GB: "United Kingdom",
  GR: "Greece",
  HK: "Hong Kong",
  ID: "Indonesia",
  IE: "Ireland",
  IN: "India",
  IT: "Italy",
  JP: "Japan",
  KR: "South Korea",
  MX: "Mexico",
  MY: "Malaysia",
  NG: "Nigeria",
  NL: "Netherlands",
  NO: "Norway",
  NZ: "New Zealand",
  PH: "Philippines",
  PK: "Pakistan",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  RS: "Serbia",
  SA: "Saudi Arabia",
  SE: "Sweden",
  SG: "Singapore",
  TH: "Thailand",
  TR: "Turkey",
  TW: "Taiwan",
  UA: "Ukraine",
  US: "United States",
  VN: "Vietnam",
  ZA: "South Africa",
};

const REGION_NAMES: Record<string, Record<string, string>> = {
  IN: {
    AN: "Andaman and Nicobar Islands",
    AP: "Andhra Pradesh",
    AR: "Arunachal Pradesh",
    AS: "Assam",
    BR: "Bihar",
    CH: "Chandigarh",
    CT: "Chhattisgarh",
    DN: "Dadra and Nagar Haveli and Daman and Diu",
    DL: "Delhi",
    GA: "Goa",
    GJ: "Gujarat",
    HP: "Himachal Pradesh",
    HR: "Haryana",
    JH: "Jharkhand",
    JK: "Jammu and Kashmir",
    KA: "Karnataka",
    KL: "Kerala",
    LA: "Ladakh",
    LD: "Lakshadweep",
    MH: "Maharashtra",
    ML: "Meghalaya",
    MN: "Manipur",
    MP: "Madhya Pradesh",
    MZ: "Mizoram",
    NL: "Nagaland",
    OR: "Odisha",
    PB: "Punjab",
    PY: "Puducherry",
    RJ: "Rajasthan",
    SK: "Sikkim",
    TG: "Telangana",
    TN: "Tamil Nadu",
    TR: "Tripura",
    UP: "Uttar Pradesh",
    UT: "Uttarakhand",
    WB: "West Bengal",
  },
  US: {
    AL: "Alabama",
    AK: "Alaska",
    AZ: "Arizona",
    AR: "Arkansas",
    CA: "California",
    CO: "Colorado",
    CT: "Connecticut",
    DE: "Delaware",
    FL: "Florida",
    GA: "Georgia",
    HI: "Hawaii",
    ID: "Idaho",
    IL: "Illinois",
    IN: "Indiana",
    IA: "Iowa",
    KS: "Kansas",
    KY: "Kentucky",
    LA: "Louisiana",
    ME: "Maine",
    MD: "Maryland",
    MA: "Massachusetts",
    MI: "Michigan",
    MN: "Minnesota",
    MS: "Mississippi",
    MO: "Missouri",
    MT: "Montana",
    NE: "Nebraska",
    NV: "Nevada",
    NH: "New Hampshire",
    NJ: "New Jersey",
    NM: "New Mexico",
    NY: "New York",
    NC: "North Carolina",
    ND: "North Dakota",
    OH: "Ohio",
    OK: "Oklahoma",
    OR: "Oregon",
    PA: "Pennsylvania",
    RI: "Rhode Island",
    SC: "South Carolina",
    SD: "South Dakota",
    TN: "Tennessee",
    TX: "Texas",
    UT: "Utah",
    VT: "Vermont",
    VA: "Virginia",
    WA: "Washington",
    WV: "West Virginia",
    WI: "Wisconsin",
    WY: "Wyoming",
    DC: "District of Columbia",
  },
};

function cleanGeoValue(value: string | null | undefined): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text || "Unknown";
}

export function normalizeCountryName(value: string | null | undefined): string {
  const code = cleanGeoValue(value);
  if (!code || code === "Unknown" || code === "Localhost") return code === "Localhost" ? "Localhost" : "Unknown";

  const normalizedCode = code.toUpperCase();
  if (COUNTRY_NAMES[normalizedCode]) return COUNTRY_NAMES[normalizedCode];

  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    const displayName = displayNames.of(normalizedCode);
    if (displayName) return displayName;
  } catch {
    // Fallback to a raw code if Intl support is unavailable.
  }

  return code;
}

export function normalizeRegionName(countryValue: string | null | undefined, regionValue: string | null | undefined): string {
  const region = cleanGeoValue(regionValue);
  if (!region || region === "Unknown") return "Unknown";

  const countryCode = cleanGeoValue(countryValue).toUpperCase();
  const regionCode = region.toUpperCase();

  if (REGION_NAMES[countryCode]?.[regionCode]) {
    return REGION_NAMES[countryCode][regionCode];
  }

  if (countryCode === "IN" && regionCode === "BR") return "Bihar";
  if (countryCode === "IN" && regionCode === "GJ") return "Gujarat";

  return region;
}

export function normalizeGeoEntry(countryValue: string | null | undefined, regionValue: string | null | undefined) {
  return {
    country: normalizeCountryName(countryValue),
    region: normalizeRegionName(countryValue, regionValue),
  };
}
