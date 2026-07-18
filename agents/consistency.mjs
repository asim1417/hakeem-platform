#!/usr/bin/env node
// فحص اتّساق كل وكيل: الأدوار الفرعية لا تضيف خارج المجمع، وملفّات المهارات موجودة،
// وأدوات المحرّك المصرَّحة في مقدّمة SKILL.md تطابق engineTools في المانيفست.
// بلا تبعيات خارجية. يُشغَّل من الجذر: `node agents/consistency.mjs`.
import { readFileSync, existsSync } from "node:fs";

const AGENTS = ["commercial-litigator", "insolvency-practitioner", "judge-aide"];

function check(name) {
  const dir = `agents/${name}`;
  const m = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8"));
  const skillIds = new Set(m.skills.map((s) => s.skillId));
  const tplIds = new Set(m.outputTemplates.map((t) => t.templateId));
  let p = 0;

  for (const sr of m.subRoles || []) {
    for (const s of sr.skills) if (!skillIds.has(s)) { console.log(`${dir}: subRole ${sr.subRoleId} → مهارة مفقودة «${s}»`); p++; }
    for (const t of sr.outputTemplates || []) if (!tplIds.has(t)) { console.log(`${dir}: subRole ${sr.subRoleId} → قالب مفقود «${t}»`); p++; }
  }

  for (const s of m.skills) {
    const fp = `${dir}/${s.path}`;
    if (!existsSync(fp)) { console.log(`${dir}: ملف مهارة مفقود ${fp}`); p++; continue; }
    const fm = (readFileSync(fp, "utf8").match(/engine_tools:\s*\[([^\]]*)\]/) || [])[1] || "";
    const decl = fm.split(",").map((x) => x.trim()).filter(Boolean).sort();
    const man = [...s.engineTools].sort();
    if (JSON.stringify(decl) !== JSON.stringify(man)) {
      console.log(`${dir}: تعارض أدوات ${s.skillId}\n   SKILL: [${decl}]\n   MANIFEST: [${man}]`);
      p++;
    }
  }

  console.log(`${p === 0 ? "CONSISTENT" : "PROBLEMS " + p} :: ${dir} (${(m.subRoles || []).length} أدوار، ${m.skills.length} مهارات)`);
  return p;
}

let problems = 0;
for (const a of AGENTS) problems += check(a);
process.exit(problems ? 1 : 0);
