import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/switchride";
const dbName = process.env.MONGODB_DB || "switchride";
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.resolve(process.argv[2] || `backups/mongodb/${stamp}`);

async function main() {
  const client = new MongoClient(uri, { family: 4, serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(dbName);
  const collections = await db.listCollections().toArray();
  fs.mkdirSync(path.join(outDir, "json"), { recursive: true });

  const manifest = { database: dbName, uriHost: uri.replace(/\/\/.*@/, "//"), createdAt: new Date().toISOString(), collections: [] };

  for (const col of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = col.name;
    if (name.startsWith("system.")) continue;
    const docs = await db.collection(name).find({}).toArray();
    const indexes = await db.collection(name).indexes();
    const file = path.join(outDir, "json", `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(docs, null, 2));
    manifest.collections.push({ name, count: docs.length, indexes, file: `json/${name}.json` });
    console.log(`${name}: ${docs.length} documents`);
  }

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${outDir}`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
