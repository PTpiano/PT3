import { copyFile, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "web", "dist", "index.html");
const publicDir = path.join(root, "public");
const destination = path.join(publicDir, "index.html");
const fontsSource = path.join(root, "web", "dist", "fonts");
const fontsDestination = path.join(publicDir, "fonts");

await mkdir(publicDir, { recursive: true });
await copyFile(source, destination);

// Font statici della SPA: serviti da /fonts (public/ di Next).
await cp(fontsSource, fontsDestination, { recursive: true, force: true });

console.log("SPA copiata in public/index.html");
console.log("Font copiati in public/fonts");
