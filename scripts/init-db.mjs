import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL non impostata.");
  process.exit(1);
}

const schema = readFileSync(path.join(root, "db", "schema.sql"), "utf8");
const client = new Client({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("localhost") ? undefined : { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(schema);
  console.log("Schema applicato al database PostgreSQL.");
} finally {
  await client.end();
}
