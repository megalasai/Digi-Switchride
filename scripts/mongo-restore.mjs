import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { MongoClient, ObjectId } from "mongodb";

dns.setDefaultResultOrder("ipv4first");
if ((process.env.MONGODB_URI || "").includes("ondigitalocean.com")) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/switchride";
const dbName = process.env.MONGODB_DB || "switchride";
const src = path.resolve(process.argv[2] || "");

if (!src || !fs.existsSync(path.join(src, "json"))) {
  console.error("Usage: node scripts/mongo-restore.mjs backups/mongodb/<stamp>");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 25000,
    ...(uri.includes("ondigitalocean.com") ? {} : { family: 4 }),
  });
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
    const revived = docs.map((doc) => reviveValue(doc));
    await db.collection(name).deleteMany({});
    await db.collection(name).insertMany(revived);
    console.log(`${name}: restored ${docs.length}`);
  }
  await client.close();
  console.log("Restore complete");
}

function reviveValue(value, key) {
  if (Array.isArray(value)) return value.map((item) => reviveValue(item, key));
  if (value && typeof value === "object") {
    if (typeof value.$oid === "string") return new ObjectId(value.$oid);
    if (typeof value.$date === "string") return new Date(value.$date);
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = reviveValue(v, k);
    return out;
  }
  if (typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value)) {
    if (key === "_id" || key === "tenantId" || (typeof key === "string" && key.endsWith("Id"))) {
      try {
        return new ObjectId(value);
      } catch {
        return value;
      }
    }
  }
  if (
    typeof value === "string" &&
    typeof key === "string" &&
    (key.endsWith("At") || key === "expiresAt") &&
    !Number.isNaN(Date.parse(value))
  ) {
    return new Date(value);
  }
  return value;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
