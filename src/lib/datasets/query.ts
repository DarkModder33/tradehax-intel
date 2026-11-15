type Compare = ">" | "<" | ">=" | "<=" | "=" | "!=";

interface Clause {
  field: string;
  op: Compare;
  value: string | number;
}

const OPS: Compare[] = [">=", "<=", "!=", ">", "<", "="];

export function parseQuery(source: string): Clause[] {
  return source
    .split(/\s+AND\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const op = OPS.find((candidate) => part.includes(candidate));
      if (!op) throw new Error(`No comparison in "${part}"`);
      const [field, raw] = part.split(op).map((piece) => piece.trim());
      if (!field || !/^[_a-z][_a-z0-9]*$/i.test(field)) throw new Error(`Bad field in "${part}"`);
      const unquoted = raw?.replace(/^"|"$/g, "");
      if (!unquoted) throw new Error(`Missing value in "${part}"`);
      const value = /^-?\d+(\.\d+)?$/.test(unquoted) ? Number(unquoted) : unquoted;
      return { field, op, value };
    });
}

export function matchQuery(row: Record<string, unknown>, source: string): boolean {
  return parseQuery(source).every((clause) => {
    const left = row[clause.field];
    if (typeof clause.value === "number") {
      const numeric = typeof left === "number" ? left : Number(left);
      if (!Number.isFinite(numeric)) return false;
      if (clause.op === ">") return numeric > clause.value;
      if (clause.op === "<") return numeric < clause.value;
      if (clause.op === ">=") return numeric >= clause.value;
      if (clause.op === "<=") return numeric <= clause.value;
      if (clause.op === "!=") return numeric !== clause.value;
      return numeric === clause.value;
    }
    const text = String(left ?? "");
    if (clause.op === "!=") return text !== clause.value;
    if (clause.op === "=") return text === clause.value;
    return false;
  });
}
