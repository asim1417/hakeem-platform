import { rerankArticles } from "../lib/modules/agents/thinking/rerank";
import type { LegalCoreResult } from "../lib/modules/legal-core/legal-retrieval";
const mk = (id:string, rel:number, cit:number, status:string): LegalCoreResult =>
  ({ articleId:id, relevanceScore:rel, citationCount:cit, status } as unknown as LegalCoreResult);
let ok=0, fail=0; const t=(c:boolean,m:string)=>{console.log(`${c?"✓":"✗"} ${m}`);c?ok++:fail++;};

// حالة سارية عالية السلطة تتصدّر منسوخة بنفس الصلة تقريبًا
const r1 = rerankArticles([mk("repealed",0.9,0,"منسوخة"), mk("active",0.85,50,"سارية")]);
t(r1[0].articleId==="active", `الساري عالي السلطة يتصدّر المنسوخ: ${r1[0].articleId}`);
// الصلة تبقى مؤثّرة: صلة أعلى بفارق كبير تتصدّر رغم تساوي الحالة
const r2 = rerankArticles([mk("low",0.2,0,"سارية"), mk("high",1.0,0,"سارية")]);
t(r2[0].articleId==="high", "الصلة الأعلى تتصدّر عند تساوي الحالة");
console.log(`\nنتيجة: ${ok} نجح، ${fail} فشل`); if(fail) process.exit(1);
