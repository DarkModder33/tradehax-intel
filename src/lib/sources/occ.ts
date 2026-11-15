export interface OccContract {
  symbol: string;
  root: string;
  expiry: string;
  right: "call" | "put";
  strike: number;
}

/** Standard OCC symbol: ROOT + YYMMDD + C/P + strike*1000 in 8 digits. Adjusted roots such as B1SPY do not match. */
const OCC = /^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;

export function parseOcc(symbol: string): OccContract | null {
  const match = symbol.trim().toUpperCase().match(OCC);
  if (!match) return null;
  const [, root, year, month, day, right, strike] = match;
  return {
    symbol: match[0],
    root,
    expiry: `20${year}-${month}-${day}`,
    right: right === "C" ? "call" : "put",
    strike: Number(strike) / 1000,
  };
}

export function isStandardContract(symbol: string, root: string): boolean {
  return new RegExp(`^${root}\\d{6}[CP]\\d{8}$`).test(symbol.trim().toUpperCase());
}
