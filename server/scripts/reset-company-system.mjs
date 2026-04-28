import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SERVER_DIRECTORY = path.join(process.cwd(), "server");
const DB_DIRECTORY = path.join(SERVER_DIRECTORY, "db");
const DB_PATH = path.join(DB_DIRECTORY, "company-system.json");
const DB_SEED_PATH = path.join(DB_DIRECTORY, "company-system.seed.json");

await mkdir(DB_DIRECTORY, { recursive: true });
await copyFile(DB_SEED_PATH, DB_PATH);

console.log(`[company-system-server] reset ${DB_PATH}`);
