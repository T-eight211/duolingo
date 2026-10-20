import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const optionsPath = path.join(rootDir, "src/lib/arabic-grammar/grammar-options.json");
const generatedPath = path.join(rootDir, "src/lib/arabic-grammar/grammar-options.generated.ts");

const raw = fs.readFileSync(optionsPath, "utf-8");
const parsed = JSON.parse(raw);

const code = `/** AUTO-GENERATED from grammar-options.json. Run: node scripts/generate-options.mjs */
export const grammarOptions = ${JSON.stringify(parsed, null, 2)} as const;

export const grammarVocabulary = grammarOptions.arabic_grammar;
`;

fs.writeFileSync(generatedPath, code, "utf-8");
console.log(`Generated ${generatedPath} successfully.`);

// Also sync src/schemas/ if it exists during migration
const legacyPath = path.join(rootDir, "src/schemas/grammar-options.generated.ts");
if (fs.existsSync(path.dirname(legacyPath))) {
  fs.writeFileSync(legacyPath, code, "utf-8");
}
