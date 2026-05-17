import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

const assetsDirName = "images"
const dbFileName = "framebook.db"
const schemaVersion = 2

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

function resolveDataDir(env = process.env) {
  return path.resolve(
    env.FRAMEBOOK_DATA_DIR || path.join(os.homedir(), ".framebook")
  )
}

function resolveDatabasePath(dataDir = resolveDataDir()) {
  return path.join(path.resolve(dataDir), dbFileName)
}

function resolveLegacyExportDir(env = process.env) {
  return path.resolve(
    env.FRAMEBOOK_LEGACY_EXPORT_DIR ||
      path.join(os.homedir(), "Downloads", "Framebook", "legacy-export")
  )
}

export function createFramebookStore({
  dataDir = resolveDataDir(),
  dbPath,
  legacyExportDir = resolveLegacyExportDir(),
} = {}) {
  const rootDir = path.resolve(dataDir)
  const assetsDir = path.join(rootDir, assetsDirName)
  const databasePath = path.resolve(dbPath || resolveDatabasePath(rootDir))
  const legacyExportRoot = path.resolve(legacyExportDir)
  let readyPromise
  let db

  async function ensureReady() {
    readyPromise ??= initializeStore()
    await readyPromise
  }

  async function initializeStore() {
    mkdirSync(path.dirname(databasePath), { recursive: true })
    db = new DatabaseSync(databasePath)
    db.exec(schema)
    await resetLegacyDataIfNeeded({
      db,
      rootDir,
      assetsDir,
      exportRoot: legacyExportRoot,
    })
    await fs.mkdir(assetsDir, { recursive: true })
    db.exec(`PRAGMA user_version = ${schemaVersion}`)
    db.exec("PRAGMA optimize")
  }

  function requireDb() {
    if (!db) {
      throw new Error("Framebook store is not initialized")
    }

    return db
  }

  return {
    rootDir,
    assetsDir,
    dbPath: databasePath,
    legacyExportDir: legacyExportRoot,
    ensureReady,
    createId: randomUUID,
    getTopicAssetDir(topicId) {
      return path.join(assetsDir, safeSegment(topicId))
    },
    async listTopics() {
      await ensureReady()
      return listPayloads(requireDb(), "topics", "updated_at DESC")
    },
    async writeTopics(topics) {
      await ensureReady()
      replacePayloads(requireDb(), "topics", topics, (topic) => ({
        id: topic.id,
        updated_at: topic.updatedAt,
      }))
    },
    async listImages() {
      await ensureReady()
      return listPayloads(requireDb(), "images", "created_at DESC")
    },
    async writeImages(images) {
      await ensureReady()
      replacePayloads(requireDb(), "images", images, (image) => ({
        id: image.id,
        topic_id: image.topicId,
        created_at: image.createdAt,
      }))
    },
    async listJobs() {
      await ensureReady()
      return listPayloads(requireDb(), "generation_jobs", "updated_at DESC")
    },
    async writeJobs(jobs) {
      await ensureReady()
      replacePayloads(requireDb(), "generation_jobs", jobs, (job) => ({
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
  db.exec("BEGIN")
  try {
    db.prepare(`DELETE FROM ${tableName}`).run()
    for (const record of records) {
      insertPayload(db, tableName, record, mapColumns(record))
    }
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

function insertPayload(db, tableName, record, columns) {
  if (tableName === "topics") {
    db.prepare(
      `INSERT INTO topics (id, payload, updated_at)
       VALUES (?, ?, ?)`
    ).run(columns.id, JSON.stringify(record), columns.updated_at)
    return
  }

  if (tableName === "images") {
    db.prepare(
      `INSERT INTO images (id, topic_id, payload, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(
      columns.id,
      columns.topic_id,
      JSON.stringify(record),
      columns.created_at
    )
    return
  }

  db.prepare(
    `INSERT INTO generation_jobs (id, payload, updated_at)
     VALUES (?, ?, ?)`
  ).run(columns.id, JSON.stringify(record), columns.updated_at)
}

function safeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, "_")
}

async function resetLegacyDataIfNeeded({ db, rootDir, assetsDir, exportRoot }) {
  const version = Number(db.prepare("PRAGMA user_version").get().user_version)

  if (version >= schemaVersion) {
    return
  }

  const legacyRows =
    rowCount(db, "topics") +
    rowCount(db, "images") +
    rowCount(db, "generation_jobs")
  const hasAssets = await directoryHasEntries(assetsDir)

  if (legacyRows > 0 || hasAssets) {
    await exportLegacyGeneratedImages({
      images: listPayloads(db, "images", "created_at DESC"),
      assetsDir,
      exportRoot,
    })
    await resetTables(db)
    await removeAssetsDir({ rootDir, assetsDir })
  }
}

function rowCount(db, tableName) {
  return Number(
    db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count
  )
}

async function directoryHasEntries(dirPath) {
  try {
    const entries = await fs.readdir(dirPath)
    return entries.length > 0
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false
    }

    throw error
  }
}

async function exportLegacyGeneratedImages({ images, assetsDir, exportRoot }) {
  if (images.length === 0) {
    return
  }

  const exportDir = path.join(exportRoot, timestampSegment())
  let copiedCount = 0

  for (const image of images) {
    const sourcePath = safeJoin(assetsDir, image.topicId, image.fileName)
    if (!(await fileExists(sourcePath))) {
      continue
    }

    const targetDir = path.join(
      exportDir,
      safeSegment(image.topicSnapshot?.name || image.topicId || "topic")
    )
    const extension = path.extname(image.fileName) || ".png"
    const targetPath = path.join(
      targetDir,
      `${safeSegment(image.title || image.id || "image")}-${safeSegment(
        image.id || randomUUID()
      )}${extension}`
    )

    await fs.mkdir(targetDir, { recursive: true })
    await fs.copyFile(sourcePath, targetPath)
    copiedCount += 1
  }

  if (copiedCount === 0) {
    return
  }
}

async function resetTables(db) {
  db.exec("BEGIN")
  try {
    db.prepare("DELETE FROM generation_jobs").run()
    db.prepare("DELETE FROM images").run()
    db.prepare("DELETE FROM topics").run()
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

async function removeAssetsDir({ rootDir, assetsDir }) {
  const resolvedRoot = path.resolve(rootDir)
  const resolvedAssets = path.resolve(assetsDir)

  if (resolvedAssets !== path.join(resolvedRoot, assetsDirName)) {
    throw new Error("Refusing to remove an unexpected Framebook assets path")
  }

  await fs.rm(resolvedAssets, { recursive: true, force: true })
}

function safeJoin(rootDir, ...segments) {
  const resolvedRoot = path.resolve(rootDir)
  const targetPath = path.resolve(
    resolvedRoot,
    ...segments.filter(Boolean).map((segment) => String(segment))
  )

  if (!targetPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Refusing to read outside Framebook assets")
  }

  return targetPath
}

async function fileExists(filePath) {
  try {
    const details = await fs.stat(filePath)
    return details.isFile()
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false
    }

    throw error
  }
}

function timestampSegment() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}
