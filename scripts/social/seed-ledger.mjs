import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Stories already sent before the ledger was stored on the data branch. */
export const SEEDED_POSTS = {
  "SECTORS|rotation|2026-11-16": ["discord"],
};

export async function seedLedger(ledgerPath, seeds = SEEDED_POSTS) {
  const resolved = path.resolve(ledgerPath);
  let ledger = { posted: {} };
  try {
    ledger = JSON.parse(await readFile(resolved, "utf8"));
    ledger.posted ??= {};
  } catch {
    ledger = { posted: {} };
  }
  let changed = false;
  for (const [id, networks] of Object.entries(seeds)) {
    const have = new Set(ledger.posted[id] ?? []);
    for (const network of networks) {
      if (!have.has(network)) {
        have.add(network);
        changed = true;
      }
    }
    ledger.posted[id] = [...have];
  }
  if (!changed) return { changed: false, ledger };
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(ledger, null, 2)}\n`);
  return { changed: true, ledger };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ledgerPath = process.env.SOCIAL_LEDGER ?? path.join(process.cwd(), "data", "social-posted.json");
  const { changed } = await seedLedger(ledgerPath);
  console.log(changed ? `social ledger: seeded ${ledgerPath}` : "social ledger: seed already present");
}
