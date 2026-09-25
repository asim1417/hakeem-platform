/** أحدث نسخة متجه، ثم الصف القائم لمن لا نسخة له. لا يستبدل الصف القديم. */
export function latestVectorSource(alias = "src"): string {
  return `(
    SELECT owner_type, owner_id, embedding FROM (
      SELECT owner_type, owner_id, embedding,
             row_number() OVER (PARTITION BY owner_type, owner_id ORDER BY created_at DESC) AS rn
      FROM embedding_version
      WHERE embedding IS NOT NULL
    ) versions WHERE rn = 1
    UNION ALL
    SELECT e.owner_type, e.owner_id, e.embedding
    FROM embeddings e
    WHERE e.embedding IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM embedding_version ev
        WHERE ev.owner_type = e.owner_type AND ev.owner_id = e.owner_id
      )
  ) ${alias}`;
}
