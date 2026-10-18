/**
 * HKM-029 — pg ليس من تبعيات المشروع (القفل)، والأدوات جُرّبت عليه محليًا (8.23.1).
 * في مسار GitHub Actions يُثبَّت مؤقتًا في مجلد مستقل خارج المستودع، بلا سكربتات تثبيت ولا مساس بـ
 * package.json أو القفل، ثم يُربط pg وpg-connection-string في node_modules بروابط رمزية.
 * تتبع Node الرابط إلى مساره الحقيقي، فتُحل تبعيات pg من مجلده.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

export const PG_VERSION = "8.23.1";
const NAMES = ["pg", "pg-connection-string"];

function resolvable(root) {
  const req = createRequire(path.join(root, "package.json"));
  return NAMES.every((n) => {
    try {
      req.resolve(n);
      return true;
    } catch {
      return false;
    }
  });
}

/** يعيد "present" إن كان pg قابلًا للحل من root، وإلا يثبّته ويربطه ويعيد "installed". */
export function ensurePg(root = process.cwd(), prefix = path.join(tmpdir(), "hkm029-pg")) {
  if (resolvable(root)) return "present";
  mkdirSync(prefix, { recursive: true });
  execFileSync("npm", ["install", "--prefix", prefix, "--no-package-lock", "--ignore-scripts", "--no-audit", "--no-fund", `pg@${PG_VERSION}`], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  mkdirSync(path.join(root, "node_modules"), { recursive: true });
  for (const n of NAMES) {
    const target = path.join(prefix, "node_modules", n);
    const link = path.join(root, "node_modules", n);
    if (!existsSync(target)) throw new Error(`لم يُثبَّت ${n}`);
    if (!existsSync(link)) symlinkSync(target, link, "dir");
  }
  if (!resolvable(root)) throw new Error("pg غير قابل للحل بعد التثبيت");
  return "installed";
}
