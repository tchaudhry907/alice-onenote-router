import fs from "fs";
import path from "path";

function walk(dir, base="/api") {
  const abs = path.join(process.cwd(), "pages", "api", dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap(d => {
    if (d.isDirectory()) return walk(path.join(dir, d.name), `${base}/${d.name}`);
    if (!d.name.endsWith(".js")) return [];
    const name = d.name.replace(/\.js$/, "");
    return [`${base}/${dir ? dir + "/" : ""}${name === "index" ? "" : name}`.replace(/\/+$/,"")];
  });
}

export default function handler(req, res) {
  const routes = walk(""); // list files under pages/api
  res.status(200).json({ ok: true, routes });
}
