/**
 * مشروع تحليل ١٠٠ حكم قضائي واستخراج أنماط الاستشهاد بالمواد
 *
 * المراحل:
 * 1. استخراج ١٠٠ حكم من judicial_cases
 * 2. استخراج الاستشهادات (regex + AI)
 * 3. تصنيف نوع الاستخدام لكل مادة
 * 4. حفظ النتائج في legal_article_case_links
 * 5. تطبيق الأنماط على كامل قاعدة البيانات
 */

import { writeFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
// نمرّ على طبقة الذكاء المركزية في الخادم بدل استدعاء مزوّد مباشرةً —
// المفتاح يبقى داخل lib/modules/ai (وفق سياسة الأمن qa:security).
import { callCentralProvider } from '@/lib/modules/ai/ai-gateway';

const prisma = new PrismaClient();

// ── Types ──────────────────────────────────────────────────

type RelationType = 'direct' | 'evidentiary' | 'procedural' | 'interpretive' | 'supportive';

interface ExtractedCitation {
  articleNumber:  string;          // "15"
  systemName:     string;          // "نظام المرافعات الشرعية"
  citedText:      string;          // النص المقتبس من الحكم
  relationType:   RelationType;    // نوع الاستخدام
  explanation:    string;          // كيف استُخدمت المادة
  confidence:     number;          // 0 - 1
}

interface CaseAnalysisResult {
  caseId:     string;
  caseNo:     string;
  citations:  ExtractedCitation[];
  topics:     string[];            // المسائل القانونية في الحكم
  courtType:  string;
}

// ── المرحلة ١: استخراج ١٠٠ حكم ──────────────────────────

async function extractSampleCases(limit = 100) {
  console.log(`\n📋 المرحلة ١: استخراج ${limit} حكم...`);

  const cases = await prisma.judicialCase.findMany({
    where: {
      judgmentText: { not: '' },
      // ترجيح الأحكام التجارية والأحكام التي تستشهد بالأنظمة
      OR: [
        { court: { contains: 'تجاري' } },
        { judgmentText: { contains: 'نظام' } },
      ]
    },
    select: {
      id: true,
      caseNo: true,
      decisionNo: true,
      court: true,
      courtOfAppeal: true,
      judgmentTitle: true,
      judgmentText: true,
      appealText: true,
      classification: true,
      decisionDateText: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  console.log(`  ✓ وُجد ${cases.length} حكم`);
  return cases;
}

// ── المرحلة ٢: Regex Extractor ───────────────────────────

function extractCitationsRegex(text: string): Partial<ExtractedCitation>[] {
  const results: Partial<ExtractedCitation>[] = [];

  // أنماط الاستشهاد بالمواد
  const patterns = [
    // م/15 من نظام ... | المادة (15) من ...
    /(?:م\/|المادة\s*[(\[])(\d+)[)\]]?\s*(?:من\s+)?(?:نظام\s+)?([؀-ۿ\s]+?)(?:،|\.|\s*وفق|\s*المادة|$)/g,
    // م/خامس عشر | المادة الخامسة
    /(?:م\/|المادة\s+)([؀-ۿ]+)\s+(?:من\s+)?(?:نظام\s+)?([؀-ۿ\s]+?)(?:،|\.|\n)/g,
    // نظام المرافعات م/40
    /(نظام\s+[؀-ۿ\s]{5,30})\s*(?:،\s*)?م\/(\d+)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const articleNum = match[1]?.replace(/[^\d]/g, '') || '';
      const systemName = (match[2] || match[1] || '').trim();

      if (articleNum && systemName.length > 3) {
        // استخراج السياق (200 حرف حول الاستشهاد)
        const start = Math.max(0, match.index - 100);
        const end   = Math.min(text.length, match.index + match[0].length + 100);

        results.push({
          articleNumber: articleNum,
          systemName: cleanSystemName(systemName),
          citedText: text.slice(start, end).trim(),
          confidence: 0.7,
        });
      }
    }
  }

  return deduplicateCitations(results);
}

function cleanSystemName(raw: string): string {
  // تنظيف اسم النظام
  const map: Record<string, string> = {
    'المرافعات': 'نظام المرافعات الشرعية',
    'المرافعات الشرعية': 'نظام المرافعات الشرعية',
    'الإثبات': 'نظام الإثبات أمام المحاكم',
    'المعاملات المدنية': 'نظام المعاملات المدنية',
    'الشركات': 'نظام الشركات',
    'التنفيذ': 'نظام التنفيذ',
    'المحاكم التجارية': 'نظام المحاكم التجارية',
    'التحكيم': 'نظام التحكيم',
    'العمل': 'نظام العمل',
  };
  const cleaned = raw.replace(/^(نظام\s+)/, '').trim();
  for (const [key, val] of Object.entries(map)) {
    if (cleaned.includes(key)) return val;
  }
  return raw.startsWith('نظام') ? raw : `نظام ${raw}`;
}

// ── المرحلة ٣: AI Extractor (للأحكام المهمة) ────────────

async function extractCitationsWithAI(
  judgmentText: string,
  caseNo: string
): Promise<ExtractedCitation[]> {

  // اقتصر على أول 4000 حرف لتوفير التكاليف
  const excerpt = judgmentText.slice(0, 4000);

  const prompt = `أنت محلل قانوني متخصص. حلّل نص الحكم التالي واستخرج كل الاستشهادات بالمواد النظامية.

نص الحكم (رقم ${caseNo}):
${excerpt}

المطلوب: استخرج كل استشهاد بمادة نظامية، وأعد JSON فقط بهذا الشكل:
{
  "citations": [
    {
      "articleNumber": "15",
      "systemName": "نظام المرافعات الشرعية",
      "citedText": "النص المقتبس من الحكم حول هذه المادة (أقل من 150 حرف)",
      "relationType": "direct|evidentiary|procedural|interpretive|supportive",
      "explanation": "كيف استُخدمت المادة في الحكم (جملة واحدة)",
      "confidence": 0.9
    }
  ],
  "topics": ["الفسخ", "التعويض"],
  "courtType": "تجارية|عامة|استئناف|عمالية"
}

تعريف relationType:
- direct: المادة أساس الحكم مباشرة
- evidentiary: تتعلق بالإثبات
- procedural: تتعلق بالإجراءات
- interpretive: لتفسير نص أو شرط
- supportive: داعمة فقط

أعد JSON نظيفاً بدون markdown.`;

  try {
    // المزوّد والموديل يُحدَّدان مركزياً من إعدادات المنصة (resolveAiConfig).
    const response = await callCentralProvider({ userPrompt: prompt, maxTokens: 1500 });
    if (!response.ok || !response.content) return [];

    const data = JSON.parse(response.content.replace(/```json?|```/g, '').trim());
    return data.citations || [];
  } catch (e) {
    console.warn(`  ⚠ AI extraction failed for ${caseNo}:`, e);
    return [];
  }
}

// ── المرحلة ٤: مطابقة المواد في DB ───────────────────────

async function matchArticlesToDB(
  citations: ExtractedCitation[]
): Promise<Map<string, string>> {
  // key: "articleNumber|systemName" → value: articleId
  const articleMap = new Map<string, string>();

  const articles = await prisma.legalArticle.findMany({
    select: { id: true, articleNumber: true, lawName: true },
  });

  for (const citation of citations) {
    const key = `${citation.articleNumber}|${citation.systemName}`;
    if (articleMap.has(key)) continue;

    // بحث مرن
    const match = articles.find(a => {
      const numMatch = a.articleNumber === parseInt(citation.articleNumber);
      const sysMatch = a.lawName.includes(citation.systemName.replace('نظام ', '')) ||
                       citation.systemName.includes(a.lawName.replace('نظام ', ''));
      return numMatch && sysMatch;
    });

    if (match) articleMap.set(key, match.id);
  }

  return articleMap;
}

// ── المرحلة ٥: حفظ النتائج ───────────────────────────────

async function saveCitationsToLink(
  caseId: string,
  citations: ExtractedCitation[],
  articleMap: Map<string, string>
) {
  let saved = 0;
  for (const citation of citations) {
    const key = `${citation.articleNumber}|${citation.systemName}`;
    const articleId = articleMap.get(key);
    if (!articleId) continue;

    try {
      await prisma.legalArticleCaseLink.upsert({
        where: {
          articleId_caseId_citedText: {
            articleId,
            caseId,
            citedText: citation.citedText.slice(0, 200),
          }
        },
        create: {
          articleId,
          caseId,
          relationType: citation.relationType || 'supportive',
          citedText:    citation.citedText.slice(0, 200),
          explanation:  citation.explanation,
          confidence:   citation.confidence,
          reviewStatus: 'ai_extracted',
        },
        update: {
          relationType: citation.relationType || 'supportive',
          confidence:   Math.max(citation.confidence, 0.7),
        },
      });
      saved++;
    } catch (_) {}
  }
  return saved;
}

// ── المرحلة ٦: تحليل الأنماط ─────────────────────────────

async function analyzePatterns(results: CaseAnalysisResult[]) {
  const stats = {
    totalCitations: 0,
    bySystem: {} as Record<string, number>,
    byRelationType: {} as Record<string, number>,
    topArticles: {} as Record<string, number>,
    byTopic: {} as Record<string, number>,
  };

  for (const r of results) {
    for (const c of r.citations) {
      stats.totalCitations++;
      stats.bySystem[c.systemName] = (stats.bySystem[c.systemName] || 0) + 1;
      stats.byRelationType[c.relationType] = (stats.byRelationType[c.relationType] || 0) + 1;
      const artKey = `${c.systemName} م/${c.articleNumber}`;
      stats.topArticles[artKey] = (stats.topArticles[artKey] || 0) + 1;
    }
    for (const topic of r.topics) {
      stats.byTopic[topic] = (stats.byTopic[topic] || 0) + 1;
    }
  }

  return stats;
}

// ── المرحلة ٧: تطبيق الأنماط على كامل DB ─────────────────

async function applyPatternsToDB(
  topArticles: Record<string, number>,
  batchSize = 50
) {
  console.log('\n🔄 المرحلة ٧: تطبيق الأنماط على كامل قاعدة البيانات...');

  // المواد الأكثر استخداماً تُوسَم بـ "high_usage"
  const highUsage = Object.entries(topArticles)
    .filter(([,count]) => count >= 3)
    .map(([key]) => key);

  console.log(`  مواد عالية الاستخدام: ${highUsage.length}`);

  // تطبيق regex على كل الأحكام المتبقية
  let processed = 0;
  const totalCases = await prisma.judicialCase.count({
    where: { judgmentText: { not: '' } }
  });

  console.log(`  إجمالي الأحكام للمعالجة: ${totalCases}`);

  let cursor: string | undefined;
  while (true) {
    const batch = await prisma.judicialCase.findMany({
      where: { judgmentText: { not: '' } },
      select: { id: true, caseNo: true, judgmentText: true },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (!batch.length) break;
    cursor = batch[batch.length - 1].id;

    for (const c of batch) {
      const citations = extractCitationsRegex(c.judgmentText) as ExtractedCitation[];
      if (citations.length === 0) continue;

      const articleMap = await matchArticlesToDB(citations);
      await saveCitationsToLink(c.id, citations, articleMap);
    }

    processed += batch.length;
    process.stdout.write(`\r  تمت معالجة ${processed}/${totalCases} حكم...`);
  }

  console.log('\n  ✓ اكتمل التطبيق على كامل قاعدة البيانات');
}

// ── MAIN ──────────────────────────────────────────────────

async function main() {
  console.log('🚀 بدء مشروع تحليل الأحكام القضائية');
  console.log('='.repeat(50));

  const results: CaseAnalysisResult[] = [];

  // المرحلة ١: استخراج الأحكام
  const cases = await extractSampleCases(100);

  // المرحلة ٢-٣: معالجة كل حكم
  console.log('\n📊 المرحلة ٢-٣: تحليل الأحكام...');

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    process.stdout.write(`\r  ${i + 1}/${cases.length} — ${c.caseNo || c.id}`);

    // regex أولاً (سريع)
    const regexCitations = extractCitationsRegex(c.judgmentText) as ExtractedCitation[];

    // AI للأحكام المهمة (كل 10 أحكام)
    let aiCitations: ExtractedCitation[] = [];
    if (i % 10 === 0 && c.judgmentText.length > 500) {
      aiCitations = await extractCitationsWithAI(c.judgmentText, c.caseNo || c.id);
    }

    // دمج النتائج
    const allCitations = mergeCitations(regexCitations, aiCitations);

    // مطابقة مع DB
    const articleMap = await matchArticlesToDB(allCitations);
    await saveCitationsToLink(c.id, allCitations, articleMap);

    results.push({
      caseId: c.id,
      caseNo: c.caseNo || c.id,
      citations: allCitations,
      topics: [],
      courtType: c.court || 'غير محدد',
    });
  }

  console.log('\n  ✓ اكتملت المرحلة ٢-٣');

  // المرحلة ٤: تحليل الأنماط
  console.log('\n📈 المرحلة ٤: تحليل الأنماط...');
  const stats = await analyzePatterns(results);

  // طباعة النتائج
  console.log('\n=== نتائج تحليل ١٠٠ حكم ===');
  console.log(`إجمالي الاستشهادات: ${stats.totalCitations}`);
  console.log('\nأكثر الأنظمة استشهاداً:');
  Object.entries(stats.bySystem)
    .sort((a,b) => b[1]-a[1]).slice(0,8)
    .forEach(([k,v]) => console.log(`  ${v.toString().padStart(3)} — ${k}`));
  console.log('\nتوزيع أنواع الاستخدام:');
  Object.entries(stats.byRelationType)
    .sort((a,b) => b[1]-a[1])
    .forEach(([k,v]) => console.log(`  ${v.toString().padStart(3)} — ${k}`));
  console.log('\nأكثر المواد استشهاداً:');
  Object.entries(stats.topArticles)
    .sort((a,b) => b[1]-a[1]).slice(0,15)
    .forEach(([k,v]) => console.log(`  ${v.toString().padStart(3)} — ${k}`));

  // حفظ التقرير
  const report = {
    generatedAt: new Date().toISOString(),
    casesAnalyzed: results.length,
    ...stats,
    topArticlesList: Object.entries(stats.topArticles)
      .sort((a,b)=>b[1]-a[1]).slice(0,30)
  };
  writeFileSync(
    './data/citation_analysis_report.json',
    JSON.stringify(report, null, 2)
  );
  console.log('\n✓ حُفظ التقرير في data/citation_analysis_report.json');

  // المرحلة ٥ (اختيارية): تطبيق على كامل DB
  const args = process.argv.slice(2);
  if (args.includes('--apply-all')) {
    await applyPatternsToDB(stats.topArticles);
  } else {
    console.log('\n💡 لتطبيق الأنماط على كامل DB:');
    console.log('   npm run analyze:judgments -- --apply-all');
  }

  await prisma.$disconnect();
  console.log('\n✅ اكتمل المشروع');
}

// ── Helpers ───────────────────────────────────────────────

function deduplicateCitations(
  citations: Partial<ExtractedCitation>[]
): Partial<ExtractedCitation>[] {
  const seen = new Set<string>();
  return citations.filter(c => {
    const key = `${c.articleNumber}|${c.systemName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeCitations(
  regex: Partial<ExtractedCitation>[],
  ai: ExtractedCitation[]
): ExtractedCitation[] {
  const map = new Map<string, ExtractedCitation>();

  for (const c of regex) {
    const key = `${c.articleNumber}|${c.systemName}`;
    map.set(key, {
      articleNumber: c.articleNumber ?? '',
      systemName:    c.systemName ?? '',
      citedText:     c.citedText ?? '',
      explanation:   c.explanation ?? '',
      relationType:  c.relationType || 'supportive',
      confidence:    0.7,
    });
  }

  // AI يُحدِّث ويُثري
  for (const c of ai) {
    const key = `${c.articleNumber}|${c.systemName}`;
    if (map.has(key)) {
      map.set(key, { ...map.get(key)!, ...c, confidence: Math.max(c.confidence, 0.85) });
    } else {
      map.set(key, c);
    }
  }

  return Array.from(map.values());
}

main().catch(console.error);
