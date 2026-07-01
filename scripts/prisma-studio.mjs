import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const prismaPackagePath = require.resolve("prisma/package.json");
const prismaPackageDir = path.dirname(prismaPackagePath);
const prismaNodeModulesDir = path.dirname(prismaPackageDir);
const enginesDir = path.join(prismaNodeModulesDir, "@prisma", "engines");

const env = { ...process.env };
const queryEngineLibrary = findEngine(/^query_engine.*\.(dll\.node|so\.node|dylib\.node)$/);
const schemaEngine = findEngine(/^schema-engine.*(\.exe)?$/);

if (queryEngineLibrary) {
  env.PRISMA_QUERY_ENGINE_LIBRARY = queryEngineLibrary;
}
if (schemaEngine) {
  env.PRISMA_SCHEMA_ENGINE_BINARY = schemaEngine;
}

const prismaCli = path.join(prismaPackageDir, "build", "index.js");
const forwardedArgs =
  process.argv[2] === "--" ? process.argv.slice(3) : process.argv.slice(2);
const args = [
  prismaCli,
  "studio",
  "--schema",
  path.join(process.cwd(), "prisma", "schema.prisma"),
  ...forwardedArgs
];

const child = spawn(process.execPath, args, {
  cwd: process.cwd(),
  env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

function findEngine(pattern) {
  if (!existsSync(enginesDir)) return undefined;
  const fileName = readdirSync(enginesDir).find((entry) => pattern.test(entry));
  return fileName ? path.join(enginesDir, fileName) : undefined;
}
