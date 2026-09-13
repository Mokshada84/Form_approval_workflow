// scripts/buildIndex.ts
//
// PHASE 4c. `npm run build:index` — the ingestion pipeline.
//
// This is the half of RAG that runs OFFLINE, and it's the half that gets left
// out of explanations. Nothing here happens while a user waits:
//
//     read document -> chunk -> embed -> write to the vector store
//
// Run once, and again whenever the policy changes. Everything the server does
// at request time reads what this produced.
//
// It is a separate script rather than something the server does at boot for a
// reason worth internalising: embedding 34 clauses takes seconds, embedding a
// real corpus takes hours, and neither belongs in the path of a process that
// is supposed to answer HTTP requests. Indexing is a build step.

import { POLICY_CLAUSES, POLICY_MARKDOWN, POLICY_PATH } from '../server/policyCorpus.ts'
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, embed, embedOne } from '../server/embed.ts'
import { INDEX_PATH, sourceHash } from '../server/policyIndex.ts'
import { createSchema, openIndex, searchByVector, toBlob, writeMeta } from '../server/vectorStore.ts'

async function main() {
  console.log(`\nBuilding the policy vector index`)
  console.log(`  source : ${POLICY_PATH}`)
  console.log(`  index  : ${INDEX_PATH}`)
  console.log(`  model  : ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS} dims)\n`)

  // ---- 1. CHUNK ---------------------------------------------------------
  // Already done by parsePolicy() — the same chunking the keyword search uses.
  // Using one chunker for both is not an accident: if the vector index and the
  // keyword index disagreed about what a chunk is, fusing their results would
  // be meaningless.
  console.log(`1. chunked into ${POLICY_CLAUSES.length} clauses`)

  // ---- 2. EMBED ---------------------------------------------------------
  // The title is prepended to the body. "Client entertainment" is a dense,
  // human-written summary of what the clause is about, and including it pulls
  // the vector toward the clause's topic rather than its wording. Whatever you
  // choose here must be repeated exactly at query time or the two vectors live
  // in different spaces.
  const passages = POLICY_CLAUSES.map((clause) => `${clause.title}. ${clause.text}`)

  const started = Date.now()
  console.log(`2. embedding ${passages.length} passages…`)
  // Batched in one call: the model amortises setup across a batch, and 34 is
  // small enough to fit comfortably. A real corpus would be chunked into
  // batches of a few hundred.
  const vectors = await embed(passages)
  console.log(`   done in ${((Date.now() - started) / 1000).toFixed(1)}s`)

  // ---- 3. STORE ---------------------------------------------------------
  const db = openIndex(INDEX_PATH)

  // One transaction rather than 34. It is faster, and more importantly it is
  // atomic: a crash halfway leaves the old index intact instead of a half-built
  // one that looks fine and silently can't find a third of the policy.
  //
  // The schema rebuild goes INSIDE it for that reason. SQLite rolls back DDL
  // like anything else — the dropped tables and the vec0 virtual table come
  // back — and dropping outside the transaction would destroy the old index
  // before a single new row was written, which is the case the sentence above
  // is claiming to protect against.
  db.exec('begin')
  try {
    createSchema(db)

    // Prepared after the schema exists, and reused across all 34 rows: the
    // statement is parsed once and only the values change.
    const insertClause = db.prepare(
      'insert into clauses(rowid_, clause_id, title, text) values (?, ?, ?, ?)',
    )
    const insertVector = db.prepare('insert into clause_vectors(rowid, embedding) values (?, ?)')

    POLICY_CLAUSES.forEach((clause, i) => {
      const rowid = i + 1
      insertClause.run(rowid, clause.id, clause.title, clause.text)
      // BigInt, not Number: sqlite-vec's virtual table rejects a float-typed
      // primary key, and every JS number arrives as a float.
      insertVector.run(BigInt(rowid), toBlob(vectors[i]))
    })

    writeMeta(db, 'model', EMBEDDING_MODEL)
    writeMeta(db, 'dimensions', String(EMBEDDING_DIMENSIONS))
    // The staleness guard. Without it, editing the policy leaves an index that
    // keeps answering confidently from the previous version.
    writeMeta(db, 'sourceHash', sourceHash(POLICY_MARKDOWN))
    writeMeta(db, 'builtAt', new Date().toISOString())
    db.exec('commit')
  } catch (error) {
    db.exec('rollback')
    throw error
  }

  const count = db.prepare('select count(*) as n from clauses').get() as { n: number }
  console.log(`3. stored ${count.n} clauses + ${count.n} vectors`)

  // ---- 4. PROVE IT WORKS -------------------------------------------------
  // A smoke query using a word that appears NOWHERE in the corpus. If this
  // returns §5.1 Laptops, the index is doing the one thing keyword search
  // cannot.
  const probe = await embedOne('I need a new computer for my work')
  const hits = searchByVector(db, probe, 3)

  console.log(`\n4. smoke test — "I need a new computer" (the word "computer" is not in the policy):`)
  for (const hit of hits) {
    const row = db.prepare('select title from clauses where clause_id = ?').get(hit.clauseId) as
      | { title: string }
      | undefined
    console.log(`   ${hit.distance.toFixed(4)}  ${hit.clauseId}  ${row?.title ?? ''}`)
  }

  db.close()
  console.log(`\nIndex written. Re-run this after editing ${POLICY_PATH}.\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
