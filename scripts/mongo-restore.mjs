import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/switchride";
const dbName = process.env.MONGODB_DB || "switchride";
const src = path.resolve(process.argv[2] || "");

if (!src || !fs.existsSync(path.join(src, "json"))) {
  console.error("Usage: node scripts/mongo-restore.mjs backups/mongodb/<stamp>");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri, { family: 4, serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(dbName);
  const files = fs.readdirSync(path.join(src, "json")).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const name = file.replace(/\.json$/, "");
    const docs = JSON.parse(fs.readFileSync(path.join(src, "json", file), "utf8"));
    if (!Array.isArray(docs) || !docs.length) {
      console.log(`${name}: empty, skipped insert`);
      continue;
    }
    await db.collection(name).deleteMany({});
    await db.collection(name).insertMany(docs);
    console.log(`${name}: restored ${docs.length}`);
  }
  await client.close();
  console.log("Restore complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
