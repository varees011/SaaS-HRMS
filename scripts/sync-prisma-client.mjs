import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const workspaceRoot = process.cwd();
const clientPackageDir = path.dirname(require.resolve("@prisma/client/package.json"));
const source = path.resolve(clientPackageDir, "..", "..", ".prisma", "client");
const target = path.resolve(workspaceRoot, "node_modules", ".prisma", "client");
const allowedRoot = path.resolve(workspaceRoot, "node_modules", ".prisma");

if (!existsSync(source)) {
  throw new Error(`Generated Prisma Client was not found at ${source}`);
}

if (!target.startsWith(`${allowedRoot}${path.sep}`)) {
  throw new Error(`Refusing to sync Prisma Client outside ${allowedRoot}`);
}

mkdirSync(allowedRoot, { recursive: true });
rmSync(target, { recursive: true, force: true });
cpSync(source, target, {
  recursive: true,
  filter: (filePath) => !path.basename(filePath).includes(".tmp")
});

console.log(`Synced Prisma Client to ${target}`);
