import "server-only";
import { readFileSync, readdirSync } from "fs";
import path from "path";

export type PolicyChunk = {
  id: string;
  title: string;
  body: string;
};

const POLICY_DIR = path.join(process.cwd(), "server/db/policy");

function parseMarkdownFile(filePath: string): PolicyChunk {
  const raw = readFileSync(filePath, "utf-8");

  // Expect format:
  // ---
  // id: some-id
  // title: Some Title
  // ---
  //
  // Body text...
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`[policy-chunks] Invalid frontmatter in: ${filePath}`);
  }

  const frontmatter = match[1];
  const body = match[2].trim();

  const idMatch = frontmatter.match(/^id:\s*(.+)$/m);
  const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);

  if (!idMatch || !titleMatch) {
    throw new Error(`[policy-chunks] Missing id or title in: ${filePath}`);
  }

  return {
    id: idMatch[1].trim(),
    title: titleMatch[1].trim(),
    body,
  };
}

function loadPolicyChunks(): PolicyChunk[] {
  const files = readdirSync(POLICY_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort(); // alphabetical → deterministic order for hashing

  return files.map((f) => parseMarkdownFile(path.join(POLICY_DIR, f)));
}

// Loaded once per process. In dev, Next.js hot-reload re-imports the module,
// so edits to .md files are picked up without restarting the server.
export const POLICY_CHUNKS: PolicyChunk[] = loadPolicyChunks();
