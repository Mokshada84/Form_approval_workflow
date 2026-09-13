// server/vectorStore.ts
//
// PHASE 4c. The vector database.
//
// SQLite with the `sqlite-vec` extension. Two deliberate choices:
//
//   - Node's BUILT-IN `node:sqlite`, so there is no native module to compile
//     and nothing to go wrong on a different machine.
//   - A real DATABASE FILE (policy/policy-index.db) rather than an array in
//     memory. You can open it with any sqlite client and look at the schema,
//     the rows and the index. A vector store that you cannot inspect teaches
//     you nothing.
//
// THE SCHEMA, and why it is two tables:
//
//   clauses          ordinary rows — id, title, text
//   clause_vectors   a vec0 virtual table holding only float[384] + a rowid
//
// A single table would hide the join, and the join IS the mental model: the
// vector index answers "which rowids are nearest", and everything a human
// wants to read lives somewhere else. That is true of Pinecone and pgvector
// too; only the syntax changes.

import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import * as sqliteVec from 'sqlite-vec'
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from './embed.ts'

export type VectorHit = {
  clauseId: string
  /** L2 distance — SMALLER is more similar. */
  distance: number
}

/**
 * Open the index, loading the vector extension.
 *
 * `allowExtension` must be passed to the constructor AND `enableLoadExtension`
 * called before loading — two separate gates, because loading arbitrary native
 * code into your database process is exactly as dangerous as it sounds.
 */
export function openIndex(path: string): DatabaseSync {
  const db = new DatabaseSync(path, { allowExtension: true, open: true, readOnly: false })
  db.enableLoadExtension(true)
  sqliteVec.load(db)
  db.enableLoadExtension(false)
  return db
}

export function createSchema(db: DatabaseSync): void {
  db.exec(`
    drop table if exists clauses;
    drop table if exists clause_vectors;
    drop table if exists index_meta;

    create table clauses (
      rowid_ integer primary key,
      clause_id text not null unique,
      title text not null,
      text text not null
    );

    -- The vector index. float[N] is fixed at creation: change the embedding
    -- model and this table has to be rebuilt, not migrated.
    create virtual table clause_vectors using vec0(
      embedding float[${EMBEDDING_DIMENSIONS}]
    );

    -- What this index was built from and with. Without it a stale index is
    -- invisible: the search keeps working and quietly answers from the old
    -- version of the document.
    create table index_meta (
      key text primary key,
      value text not null
    );
  `)
}

/** sqlite-vec takes a vector as its raw little-endian bytes. */
export function toBlob(vector: Float32Array): Uint8Array {
  return new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength)
}

/**
 * Nearest neighbours to a query vector.
 *
 * The `match` operator is the KNN search; sqlite-vec requires an explicit `k`.
 * The join brings back the human-readable clause — the vector table itself
 * knows nothing but rowids and floats.
 */
export function searchByVector(db: DatabaseSync, query: Float32Array, k: number): VectorHit[] {
  const rows = db
    .prepare(
      `select c.clause_id as clauseId, v.distance as distance
         from clause_vectors v
         join clauses c on c.rowid_ = v.rowid
        where v.embedding match ? and k = ?
        order by v.distance`,
    )
    .all(toBlob(query), k) as unknown as VectorHit[]

  return rows
}

export function readMeta(db: DatabaseSync, key: string): string | null {
  const row = db.prepare('select value from index_meta where key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function writeMeta(db: DatabaseSync, key: string, value: string): void {
  db.prepare('insert or replace into index_meta(key, value) values (?, ?)').run(key, value)
}

export type IndexStatus =
  | { ok: true; db: DatabaseSync }
  | { ok: false; reason: string }

/**
 * Open the index and refuse it if it does not match the current document.
 *
 * THE STALENESS PROBLEM, which is the thing a vector DB adds that an in-memory
 * array does not have. The index is a COPY of the document, made at build
 * time. Edit `policy/expense-policy.md` and the index does not notice — every
 * search keeps working and keeps answering from the old text, which is worse
 * than an error because nothing looks wrong.
 *
 * So the build stamps a hash of the source, and this compares it. Any real
 * system needs the equivalent: a content hash, a version column, or a
 * pipeline that reindexes on write.
 */
export function openVerifiedIndex(path: string, sourceHash: string): IndexStatus {
  if (!existsSync(path)) {
    return { ok: false, reason: `no index at ${path} — run \`npm run build:index\`` }
  }

  // A file that exists is not a file that opens. An interrupted build leaves a
  // zero-byte or half-written database, and sqlite says so by THROWING — "file
  // is not a database", or "no such table: index_meta" one line later. The
  // caller opens this at module scope, so an escaping error takes the whole
  // server down over an optional index. A bad index has to read as "no index".
  let db: DatabaseSync
  try {
    db = openIndex(path)
  } catch (error) {
    return { ok: false, reason: `could not open ${path} (${String(error)}) — rebuild it` }
  }

  const refuse = (reason: string): IndexStatus => {
    db.close()
    return { ok: false, reason }
  }

  try {
    const storedModel = readMeta(db, 'model')
    if (storedModel !== EMBEDDING_MODEL) {
      return refuse(
        `index was built with ${storedModel}, server expects ${EMBEDDING_MODEL} — rebuild it`,
      )
    }

    const storedHash = readMeta(db, 'sourceHash')
    if (storedHash !== sourceHash) {
      return refuse(
        'the policy document has changed since the index was built — run `npm run build:index`',
      )
    }
  } catch (error) {
    return refuse(`index at ${path} is unreadable (${String(error)}) — rebuild it`)
  }

  return { ok: true, db }
}
