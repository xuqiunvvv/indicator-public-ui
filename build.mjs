import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".");
const dist = path.resolve("dist");
if (!dist.startsWith(root)) throw new Error("Unexpected output path");

const files = {};
for (const [route, source, type] of [
  ["/", "site/index.html", "text/html; charset=utf-8"],
  ["/index.html", "site/index.html", "text/html; charset=utf-8"],
  ["/styles.css", "site/styles.css", "text/css; charset=utf-8"],
  ["/app.js", "site/app.js", "text/javascript; charset=utf-8"],
  ["/export-utils.js", "site/export-utils.js", "text/javascript; charset=utf-8"],
]) {
  files[route] = { body: await fs.readFile(source, "utf8"), type };
}

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(path.join(dist, "server"), { recursive: true });
await fs.mkdir(path.join(dist, ".openai"), { recursive: true });

const worker = `import { handlePublicApi } from "./public-api.js";
const files=${JSON.stringify(files)};
export default { async fetch(request, env) {
  const url=new URL(request.url);
  if(url.pathname.startsWith("/api/")) return handlePublicApi(request,env);
  const file=files[url.pathname]||files["/"];
  return new Response(file.body,{headers:{"content-type":file.type,"cache-control":"public, max-age=300","x-content-type-options":"nosniff","content-security-policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'"}});
} };
`;
await fs.writeFile(path.join(dist, "server", "index.js"), worker, "utf8");
await fs.copyFile(path.join("worker", "public-api.js"), path.join(dist, "server", "public-api.js"));
await fs.copyFile(path.join(".openai", "hosting.json"), path.join(dist, ".openai", "hosting.json"));
console.log("Built public indicator website");
