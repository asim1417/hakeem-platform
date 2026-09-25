import { createHash } from "node:crypto";

export const EMBEDDING_MODEL_NAME = "text-embedding-3-small";
export const EMBEDDING_DIMS_REQUIRED = 1536;

/** البصمة = sha256(النص + سطر + اسم النموذج). المتجهات القديمة لا تُعاد كتابتها. */
export function embeddingFingerprint(text: string, model = EMBEDDING_MODEL_NAME): string {
  return createHash("sha256").update(`${text}\n${model}`, "utf8").digest("hex");
}
