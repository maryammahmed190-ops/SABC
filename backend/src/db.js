// =========================
// Biology Club – SQLite datastore
// =========================
//
// This used to be a single hand-written JSON file, which works but has a
// real risk for a live school site: a plain fs.writeFileSync() is not
// atomic, so a crash or a second request landing mid-write can corrupt
// the whole file and lose every student's data at once.
//
// This module keeps the EXACT same public interface the rest of the app
// already uses — readDB(), writeDB(data), nextId(db, collection) — but
// now backs it with a real embedded database: SQLite via Node's own
// BUILT-IN "node:sqlite" module (added in Node 22.5+, no separate native
// package to install/compile — this is why we switched away from
// better-sqlite3, which needs a C++ compiler on the machine that installs
// it and failed to build on Windows in testing). Every route file
// (auth.js, events.js, resources.js, questions.js, quiz.js, users.js)
// needed ZERO changes for this swap.
//
// Requires Node.js 22.5 or newer (Node prints a one-line
// "ExperimentalWarning: SQLite is an experimental feature" on startup —
// that's expected and harmless, not an error).
//
// Note: this still stores its file on local disk (backend/data/db.sqlite),
// same as before — so on a host with an EPHEMERAL filesystem (most free
// hosting tiers), the data can still be wiped on redeploy/restart. For a
// real school site you still need a host with a persistent disk (or a
// hosted Postgres/MySQL instance later, if you outgrow this).

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "db.sqlite");
const OLD_JSON_PATH = path.join(DATA_DIR, "db.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new DatabaseSync(DB_PATH);

// WAL = Write-Ahead Logging. Safer under concurrent access and survives
// a crash mid-write without corrupting the database file.
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    grade TEXT,
    school TEXT,
    role TEXT NOT NULL DEFAULT 'student',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    eventDate TEXT NOT NULL,
    image TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    lo TEXT,
    type TEXT NOT NULL,
    filename TEXT,
    mimeType TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY,
    category TEXT NOT NULL,
    lo TEXT NOT NULL,
    question TEXT NOT NULL,
    options TEXT,
    answer TEXT,
    explanation TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY,
    userId INTEGER NOT NULL,
    studentName TEXT,
    email TEXT,
    quizName TEXT,
    lo TEXT,
    score INTEGER,
    total INTEGER,
    percentage INTEGER,
    date TEXT
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  -- Per-LO quiz settings: the description shown on the LO page and the
  -- exam duration (minutes), both set from the dashboard. "published"
  -- controls whether students can see the description / Start Now
  -- button at all — until an admin/academic publishes it, the quiz
  -- stays hidden on the LO page.
  CREATE TABLE IF NOT EXISTS quiz_settings (
    lo TEXT PRIMARY KEY,
    description TEXT,
    duration INTEGER,
    published INTEGER NOT NULL DEFAULT 0,
    updatedAt TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
  CREATE INDEX IF NOT EXISTS idx_questions_category_lo ON questions(category, lo);
  CREATE INDEX IF NOT EXISTS idx_results_user_lo ON results(userId, lo);
`);

const COLLECTIONS = ["users", "events", "resources", "questions"];

// -------------------------
// One-time migration: if an old db.json exists and SQLite is still
// empty, import it so nobody loses their existing data on upgrade.
// -------------------------
function migrateFromJsonIfNeeded() {
  const userCount = sqlite.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (userCount > 0) return; // already has data, don't touch it
  if (!fs.existsSync(OLD_JSON_PATH)) return;

  let old;
  try {
    old = JSON.parse(fs.readFileSync(OLD_JSON_PATH, "utf-8"));
  } catch {
    return; // unreadable/empty old file, nothing to migrate
  }
  if (!old || typeof old !== "object") return;

  console.log("Found an existing data/db.json — importing it into SQLite...");
  writeDB({
    users: old.users || [],
    events: old.events || [],
    resources: old.resources || [],
    questions: old.questions || [],
    results: old.results || [],
    nextId: {
      users: (old.nextId && old.nextId.users) || 1,
      events: (old.nextId && old.nextId.events) || 1,
      resources: (old.nextId && old.nextId.resources) || 1,
      questions: (old.nextId && old.nextId.questions) || 1,
    },
  });
  console.log("Import complete. The old db.json is left untouched on disk as a backup.");
}

function getCounter(collection) {
  const row = sqlite
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get(`nextId_${collection}`);
  return row ? Number(row.value) : 1;
}

function setCounter(collection, value) {
  sqlite
    .prepare(
      `INSERT INTO meta (key, value) VALUES (@key, @value)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run({ key: `nextId_${collection}`, value: String(value) });
}

// undefined isn't a valid SQLite bind value — normalize to null so any
// optional field (image, filename, mimeType, options, etc.) is safe.
function n(value) {
  return value === undefined ? null : value;
}

function readDB() {
  const users = sqlite.prepare("SELECT * FROM users ORDER BY id").all();
  const events = sqlite.prepare("SELECT * FROM events ORDER BY id").all();
  const resources = sqlite.prepare("SELECT * FROM resources ORDER BY id").all();

  const questions = sqlite
    .prepare("SELECT * FROM questions ORDER BY id")
    .all()
    .map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : undefined,
    }));

  const results = sqlite.prepare("SELECT * FROM results ORDER BY id").all();

  const quizSettings = sqlite
    .prepare("SELECT * FROM quiz_settings ORDER BY lo")
    .all()
    .map((s) => ({ ...s, published: !!s.published }));

  const nextId = {};
  for (const c of COLLECTIONS) nextId[c] = getCounter(c);

  return { users, events, resources, questions, results, quizSettings, nextId };
}

function writeDB(data) {
  sqlite.exec("BEGIN");

  try {
    sqlite.prepare("DELETE FROM users").run();
    sqlite.prepare("DELETE FROM events").run();
    sqlite.prepare("DELETE FROM resources").run();
    sqlite.prepare("DELETE FROM questions").run();
    sqlite.prepare("DELETE FROM results").run();
    sqlite.prepare("DELETE FROM quiz_settings").run();

    const insUser = sqlite.prepare(`
      INSERT INTO users (id, name, email, passwordHash, grade, school, role, createdAt)
      VALUES (@id, @name, @email, @passwordHash, @grade, @school, @role, @createdAt)
    `);
    for (const u of data.users || []) {
      insUser.run({
        id: u.id,
        name: n(u.name),
        email: n(u.email),
        passwordHash: n(u.passwordHash),
        grade: n(u.grade),
        school: n(u.school),
        role: n(u.role) || "student",
        createdAt: n(u.createdAt) || new Date().toISOString(),
      });
    }

    const insEvent = sqlite.prepare(`
      INSERT INTO events (id, title, description, eventDate, image, createdAt)
      VALUES (@id, @title, @description, @eventDate, @image, @createdAt)
    `);
    for (const e of data.events || []) {
      insEvent.run({
        id: e.id,
        title: n(e.title),
        description: n(e.description),
        eventDate: n(e.eventDate),
        image: n(e.image),
        createdAt: n(e.createdAt) || new Date().toISOString(),
      });
    }

    const insResource = sqlite.prepare(`
      INSERT INTO resources (id, title, description, lo, type, filename, mimeType, createdAt)
      VALUES (@id, @title, @description, @lo, @type, @filename, @mimeType, @createdAt)
    `);
    for (const r of data.resources || []) {
      insResource.run({
        id: r.id,
        title: n(r.title),
        description: n(r.description),
        lo: n(r.lo),
        type: n(r.type),
        filename: n(r.filename),
        mimeType: n(r.mimeType),
        createdAt: n(r.createdAt) || new Date().toISOString(),
      });
    }

    const insQuestion = sqlite.prepare(`
      INSERT INTO questions (id, category, lo, question, options, answer, explanation, createdAt)
      VALUES (@id, @category, @lo, @question, @options, @answer, @explanation, @createdAt)
    `);
    for (const q of data.questions || []) {
      insQuestion.run({
        id: q.id,
        category: n(q.category),
        lo: n(q.lo),
        question: n(q.question),
        options: q.options !== undefined ? JSON.stringify(q.options) : null,
        answer: n(q.answer),
        explanation: n(q.explanation),
        createdAt: n(q.createdAt) || new Date().toISOString(),
      });
    }

    const insResult = sqlite.prepare(`
      INSERT INTO results (id, userId, studentName, email, quizName, lo, score, total, percentage, date)
      VALUES (@id, @userId, @studentName, @email, @quizName, @lo, @score, @total, @percentage, @date)
    `);
    for (const r of data.results || []) {
      insResult.run({
        id: r.id,
        userId: r.userId,
        studentName: n(r.studentName),
        email: n(r.email),
        quizName: n(r.quizName),
        lo: n(r.lo),
        score: n(r.score),
        total: n(r.total),
        percentage: n(r.percentage),
        date: n(r.date) || new Date().toISOString(),
      });
    }

    const insQuizSettings = sqlite.prepare(`
      INSERT INTO quiz_settings (lo, description, duration, published, updatedAt)
      VALUES (@lo, @description, @duration, @published, @updatedAt)
    `);
    for (const s of data.quizSettings || []) {
      insQuizSettings.run({
        lo: s.lo,
        description: n(s.description),
        duration: n(s.duration),
        published: s.published ? 1 : 0,
        updatedAt: n(s.updatedAt) || new Date().toISOString(),
      });
    }

    for (const c of COLLECTIONS) {
      setCounter(c, (data.nextId && data.nextId[c]) || 1);
    }

    sqlite.exec("COMMIT");
  } catch (err) {
    sqlite.exec("ROLLBACK");
    throw err;
  }
}

function nextId(db, collection) {
  const id = db.nextId[collection];
  db.nextId[collection] = id + 1;
  return id;
}

migrateFromJsonIfNeeded();

module.exports = { readDB, writeDB, nextId, DB_PATH };
