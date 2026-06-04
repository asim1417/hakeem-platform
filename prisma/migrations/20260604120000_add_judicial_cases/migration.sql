-- Add judicial judgments imported from the Ministry of Justice judgments archive.
-- This migration is additive only and does not alter existing legal systems or articles.

CREATE TABLE "judicial_cases" (
  "id" TEXT NOT NULL,
  "sourceId" INTEGER,
  "sourcePageId" INTEGER,
  "decisionNo" TEXT,
  "caseNo" TEXT,
  "courtOfAppeal" TEXT,
  "cityOfAppeal" TEXT,
  "court" TEXT,
  "cityName" TEXT,
  "decisionDateText" TEXT,
  "caseDateText" TEXT,
  "decisionDate" TIMESTAMP(3),
  "caseDate" TIMESTAMP(3),
  "classification" JSONB,
  "judgmentTitle" TEXT,
  "judgmentText" TEXT NOT NULL,
  "appealText" TEXT,
  "sourceLink" TEXT,
  "source" TEXT NOT NULL DEFAULT 'ahkam_moj',
  "reviewStatus" TEXT NOT NULL DEFAULT 'needs_review',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "judicial_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legal_article_case_links" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "relationType" TEXT NOT NULL,
  "citedText" TEXT,
  "excerpt" TEXT,
  "explanation" TEXT,
  "confidence" DOUBLE PRECISION,
  "reviewStatus" TEXT NOT NULL DEFAULT 'needs_review',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "legal_article_case_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "judicial_principles" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "principleText" TEXT NOT NULL,
  "sourceCaseId" TEXT NOT NULL,
  "court" TEXT,
  "topic" TEXT,
  "confidence" DOUBLE PRECISION,
  "reviewStatus" TEXT NOT NULL DEFAULT 'needs_review',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "judicial_principles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "judicial_cases_sourceId_key" ON "judicial_cases"("sourceId");
CREATE INDEX "judicial_cases_caseNo_idx" ON "judicial_cases"("caseNo");
CREATE INDEX "judicial_cases_decisionNo_idx" ON "judicial_cases"("decisionNo");
CREATE INDEX "judicial_cases_court_idx" ON "judicial_cases"("court");
CREATE INDEX "judicial_cases_cityName_idx" ON "judicial_cases"("cityName");
CREATE INDEX "judicial_cases_decisionDate_idx" ON "judicial_cases"("decisionDate");

CREATE UNIQUE INDEX "legal_article_case_links_articleId_caseId_citedText_key" ON "legal_article_case_links"("articleId", "caseId", "citedText");
CREATE INDEX "legal_article_case_links_articleId_idx" ON "legal_article_case_links"("articleId");
CREATE INDEX "legal_article_case_links_caseId_idx" ON "legal_article_case_links"("caseId");
CREATE INDEX "legal_article_case_links_relationType_idx" ON "legal_article_case_links"("relationType");

CREATE INDEX "judicial_principles_sourceCaseId_idx" ON "judicial_principles"("sourceCaseId");

ALTER TABLE "legal_article_case_links"
  ADD CONSTRAINT "legal_article_case_links_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "legal_articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "legal_article_case_links"
  ADD CONSTRAINT "legal_article_case_links_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "judicial_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "judicial_principles"
  ADD CONSTRAINT "judicial_principles_sourceCaseId_fkey"
  FOREIGN KEY ("sourceCaseId") REFERENCES "judicial_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
