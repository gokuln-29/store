/** Indian states and union territories with ISO 3166-2:IN codes (without the "IN-" prefix). */
export const INDIAN_STATES = [
  { code: "AN", name: "Andaman and Nicobar Islands" },
  { code: "AP", name: "Andhra Pradesh" },
  { code: "AR", name: "Arunachal Pradesh" },
  { code: "AS", name: "Assam" },
  { code: "BR", name: "Bihar" },
  { code: "CH", name: "Chandigarh" },
  { code: "CT", name: "Chhattisgarh" },
  { code: "DH", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "DL", name: "Delhi" },
  { code: "GA", name: "Goa" },
  { code: "GJ", name: "Gujarat" },
  { code: "HR", name: "Haryana" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "JK", name: "Jammu and Kashmir" },
  { code: "JH", name: "Jharkhand" },
  { code: "KA", name: "Karnataka" },
  { code: "KL", name: "Kerala" },
  { code: "LA", name: "Ladakh" },
  { code: "LD", name: "Lakshadweep" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "MH", name: "Maharashtra" },
  { code: "MN", name: "Manipur" },
  { code: "ML", name: "Meghalaya" },
  { code: "MZ", name: "Mizoram" },
  { code: "NL", name: "Nagaland" },
  { code: "OR", name: "Odisha" },
  { code: "PY", name: "Puducherry" },
  { code: "PB", name: "Punjab" },
  { code: "RJ", name: "Rajasthan" },
  { code: "SK", name: "Sikkim" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "TG", name: "Telangana" },
  { code: "TR", name: "Tripura" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "UT", name: "Uttarakhand" },
  { code: "WB", name: "West Bengal" },
] as const;

export type IndianStateCode = (typeof INDIAN_STATES)[number]["code"];

export const INDIAN_STATE_CODES = INDIAN_STATES.map((s) => s.code) as [
  IndianStateCode,
  ...IndianStateCode[],
];

export function stateNameFromCode(code: string): string | undefined {
  return INDIAN_STATES.find((s) => s.code === code)?.name;
}

/** GST state codes (first two digits of a GSTIN), used for "Place of supply" on invoices. */
export const GST_STATE_CODES: Record<IndianStateCode, string> = {
  JK: "01",
  HP: "02",
  PB: "03",
  CH: "04",
  UT: "05",
  HR: "06",
  DL: "07",
  RJ: "08",
  UP: "09",
  BR: "10",
  SK: "11",
  AR: "12",
  NL: "13",
  MN: "14",
  MZ: "15",
  TR: "16",
  ML: "17",
  AS: "18",
  WB: "19",
  JH: "20",
  OR: "21",
  CT: "22",
  MP: "23",
  GJ: "24",
  DH: "26",
  MH: "27",
  KA: "29",
  GA: "30",
  LD: "31",
  KL: "32",
  TN: "33",
  PY: "34",
  AN: "35",
  TG: "36",
  AP: "37",
  LA: "38",
};

/** "Karnataka (29)" — state name with its GST code. */
export function gstStateLabel(code: string | null | undefined): string {
  if (!code) return "";
  const name = stateNameFromCode(code) ?? code;
  const gst = GST_STATE_CODES[code as IndianStateCode];
  return gst ? `${name} (${gst})` : name;
}
