import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { client } from "../db/drizzle";
import { vocabularyMigration } from "../db/vocabulary-migration";

async function main() {
  await client.begin(async (tx) => {
    await tx`SET LOCAL lock_timeout = '10s'`;
    await tx.unsafe(vocabularyMigration);
  });
  const tables = await client<{ relname: string; relrowsecurity: boolean }[]>`
    SELECT relname, relrowsecurity FROM pg_class
    WHERE oid IN ('public.user_vocabulary'::regclass, 'public.user_vocabulary_links'::regclass)
  `;
  if (tables.length !== 2 || tables.some((table) => !table.relrowsecurity)) {
    throw new Error("Vocabulary tables must have row level security enabled.");
  }
  console.log(
    "Vocabulary tables ready; row level security enabled and public API access revoked.",
  );
}

main()
  .catch(() => {
    console.error(
      "Vocabulary setup failed. Check database connectivity, permissions and schema compatibility.",
    );
    process.exitCode = 1;
  })
  .finally(() => client.end());
