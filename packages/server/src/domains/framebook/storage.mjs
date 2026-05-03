import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const assetsDirName = 'images'
const dbFileName = 'framebook.db'

const schema = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_images_topic_created ON images(topic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_updated ON generation_jobs(updated_at DESC);
`

export function resolveDataDir(env = process.env) {
  return path.resolve(env.FRAMEBOOK_DATA_DIR || path.join(os.homedir(), '.framebook'))
}

export function resolveDatabasePath(dataDir = resolveDataDir()) {
  return path.join(path.resolve(dataDir), dbFileName)
}

export function createFramebookStore({ dataDir = resolveDataDir(), dbPath } = {}) {
  const rootDir = path.resolve(dataDir)
  const assetsDir = path.join(rootDir, assetsDirName)
  const databasePath = path.resolve(dbPath || resolveDatabasePath(rootDir))
  let readyPromise
  let db

  async function ensureReady() {
    readyPromise ??= initializeStore()
    await readyPromise
  }

  async function initializeStore() {
    await fs.mkdir(assetsDir, { recursive: true })
    mkdirSync(path.dirname(databasePath), { recursive: true })
    db = new DatabaseSync(databasePath)
    db.exec(schema)
    migrateJsonMetadata({ db, rootDir })
    db.exec('PRAGMA optimize')
  }

  function requireDb() {
    if (!db) {
      throw new Error('Framebook store is not initialized')
    }

    return db
  }

  return {
    rootDir,
    assetsDir,
    dbPath: databasePath,
    ensureReady,
    createId: randomUUID,
    getTopicAssetDir(topicId) {
      return path.join(assetsDir, safeSegment(topicId))
    },
    async listTopics() {
      await ensureReady()
      return listPayloads(requireDb(), 'topics', 'updated_at DESC')
    },
    async writeTopics(topics) {
      await ensureReady()
      replacePayloads(requireDb(), 'topics', topics, (topic) => ({
        id: topic.id,
        updated_at: topic.updatedAt,
      }))
    },
    async listImages() {
      await ensureReady()
      return listPayloads(requireDb(), 'images', 'created_at DESC')
    },
    async writeImages(images) {
      await ensureReady()
      replacePayloads(requireDb(), 'images', images, (image) => ({
        id: image.id,
        topic_id: image.topicId,
        created_at: image.createdAt,
      }))
    },
    async listJobs() {
      await ensureReady()
      return listPayloads(requireDb(), 'generation_jobs', 'updated_at DESC')
    },
    async writeJobs(jobs) {
      await ensureReady()
      replacePayloads(requireDb(), 'generation_jobs', jobs, (job) => ({
        id: job.id,
        updated_at: job.updatedAt,
      }))
    },
    close() {
      try {
        db?.close()
      } finally {
        db = undefined
        readyPromise = undefined
      }
    },
  }
}

function listPayloads(db, tableName, orderBy) {
  return db
    .prepare(`SELECT payload FROM ${tableName} ORDER BY ${orderBy}`)
    .all()
    .map((row) => JSON.parse(row.payload))
}

function replacePayloads(db, tableName, records, mapColumns) {
  db.exec('BEGIN')
  try {
    db.prepare(`DELETE FROM ${tableName}`).run()
    for (const record of records) {
      insertPayload(db, tableName, record, mapColumns(record))
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function insertPayload(db, tableName, record, columns) {
  if (tableName === 'topics') {
    db.prepare(
      `INSERT INTO topics (id, payload, updated_at)
       VALUES (?, ?, ?)`,
    ).run(columns.id, JSON.stringify(record), columns.updated_at)
    return
  }

  if (tableName === 'images') {
    db.prepare(
      `INSERT INTO images (id, topic_id, payload, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run(columns.id, columns.topic_id, JSON.stringify(record), columns.created_at)
    return
  }

  db.prepare(
    `INSERT INTO generation_jobs (id, payload, updated_at)
     VALUES (?, ?, ?)`,
  ).run(columns.id, JSON.stringify(record), columns.updated_at)
}

function migrateJsonMetadata({ db, rootDir }) {
  const metadataDir = path.join(rootDir, 'metadata')
  seedTableFromJson({
    db,
    tableName: 'topics',
    jsonPath: path.join(metadataDir, 'topics.json'),
    mapColumns: (topic) => ({ id: topic.id, updated_at: topic.updatedAt }),
  })
  seedTableFromJson({
    db,
    tableName: 'images',
    jsonPath: path.join(metadataDir, 'images.json'),
    mapColumns: (image) => ({
      id: image.id,
      topic_id: image.topicId,
      created_at: image.createdAt,
    }),
  })
  seedTableFromJson({
    db,
    tableName: 'generation_jobs',
    jsonPath: path.join(metadataDir, 'generation-jobs.json'),
    mapColumns: (job) => ({ id: job.id, updated_at: job.updatedAt }),
  })
}

function seedTableFromJson({ db, tableName, jsonPath, mapColumns }) {
  if (!existsSync(jsonPath)) return

  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get()
  if (row.count > 0) return

  const records = JSON.parse(readFileSync(jsonPath, 'utf8'))
  if (!Array.isArray(records) || records.length === 0) return

  db.exec('BEGIN')
  try {
    for (const record of records) {
      insertPayload(db, tableName, record, mapColumns(record))
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function safeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '_')
}
