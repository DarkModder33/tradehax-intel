import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { adsTxtLine } from "../../src/lib/monetization/slots.ts";

const file = path.join(process.cwd(), "public", "ads.txt");
const line = adsTxtLine(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);
if (!line) {
  await unlink(file).catch(() => {});
  console.log("ads.txt: omitted");
} else {
  await writeFile(file, line);
  console.log("ads.txt: written");
}
