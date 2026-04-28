import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const HOST = process.env.COMPANY_SYSTEM_HOST || "127.0.0.1";
const PORT = Number(process.env.COMPANY_SYSTEM_PORT || 4100);
const SERVER_DIRECTORY = path.join(process.cwd(), "server");
const DB_DIRECTORY = path.join(SERVER_DIRECTORY, "db");
const DB_PATH = path.join(DB_DIRECTORY, "company-system.json");
const DB_SEED_PATH = path.join(DB_DIRECTORY, "company-system.seed.json");

const EMPTY_DB_SHAPE = {
  teams: [],
  employees: [],
  "leave-entitlements": [],
  "role-profiles": [],
  "time-off-requests": [],
  updatedAt: new Date().toISOString(),
};

async function ensureDbFile() {
  try {
    await readFile(DB_PATH, "utf8");
    return;
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error)) {
      throw error;
    }

    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await mkdir(DB_DIRECTORY, { recursive: true });

  try {
    await copyFile(DB_SEED_PATH, DB_PATH);
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error)) {
      throw error;
    }

    if (error.code !== "ENOENT") {
      throw error;
    }

    await writeFile(DB_PATH, JSON.stringify(EMPTY_DB_SHAPE, null, 2), "utf8");
  }
}

async function main() {
  await ensureDbFile();

  const args = [
    "--host",
    HOST,
    "--port",
    String(PORT),
    DB_PATH,
  ];

  const child = spawn("json-server", args, {
    stdio: "inherit",
    env: process.env,
  });

  child.once("error", (error) => {
    console.error(
      "[company-system-server] failed to start json-server. Ensure dependency is installed.",
    );
    console.error(error);
    process.exit(1);
  });

  child.once("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  const stopChild = () => {
    child.kill("SIGTERM");
  };

  process.once("SIGINT", stopChild);
  process.once("SIGTERM", stopChild);

  console.log(`[company-system-server] starting json-server at http://${HOST}:${PORT}`);
  console.log(`[company-system-server] database file ${DB_PATH}`);
}

main().catch((error) => {
  console.error("[company-system-server] startup failed");
  console.error(error);
  process.exit(1);
});
