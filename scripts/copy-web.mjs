import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "web", "dist", "index.html");
const publicDir = path.join(root, "public");
const destination = path.join(publicDir, "index.html");

await mkdir(publicDir, { recursive: true });
await copyFile(source, destination);

console.log("SPA copiata in public/index.html");
