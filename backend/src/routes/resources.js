const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { readDB, writeDB, nextId } = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

const VALID_TYPES = [
  "explanation",
  "connection",
  "video",
  "test_bank",
  "guide",
  "reference",
  "old_exam",
  "lo",
];
const VALID_LOS = ["LO1", "LO2", "LO3", "LO4", "LO5", "LO6", "LO7", "LO8"];

// Resource types where a link (e.g. Google Drive) is accepted instead of
// an uploaded file. "reference" is the main one — biology textbooks are
// often hundreds of MB, far too large to sit on the app's own disk
// (especially on a free hosting tier with a small/ephemeral disk) — so
// for these a plain link is stored and used as-is as the download URL.
// "lo" (the Learning Outcomes document) works the same way.
const LINKABLE_TYPES = ["reference", "old_exam", "lo"];

// These are NOT tied to a single Learning Outcome — each one is a single
// whole item (a full textbook, a full old exam, one combined guide
// file, one LO overview document), not split per LO like Explanation/
// Connection/Test Bank/Video.
const NO_LO_TYPES = ["guide", "reference", "old_exam", "lo"];

function folderFor(type) {
  return type === "video" ? "videos" : "resources";
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sub = folderFor(req.body.type);
    cb(null, path.join(__dirname, "..", "..", "uploads", sub));
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname || ""));
  },
});

// Videos need a much bigger size limit than PDFs/images.
const upload = multer({
  storage,
  limits: { fileSize: 300 * 1024 * 1024 }, // 300MB
});

// =========================
// GET /api/resources?type=&lo=
// used for: explanation, connection, video, test_bank
// "type" is optional — omit it (or pass nothing) to get every resource,
// e.g. for an admin dashboard count/list of all uploaded resources.
// =========================
router.get("/", (req, res) => {
  const { type, lo } = req.query;

  if (type && !VALID_TYPES.includes(type)) {
    return res.status(400).json({
      error: `Invalid resource type. Use one of: ${VALID_TYPES.join(", ")}.`,
    });
  }
  if (lo && !VALID_LOS.includes(lo)) {
    return res.status(400).json({ error: "Invalid learning outcome." });
  }

  const db = readDB();
  let list = type ? db.resources.filter((r) => r.type === type) : db.resources;
  // "lo" is meaningless for guide/reference/old_exam (they aren't split
  // per LO), so a stray ?lo= on those requests is just ignored rather
  // than filtering everything out.
  if (lo && !(type && NO_LO_TYPES.includes(type))) {
    list = list.filter((r) => r.lo === lo);
  }

  res.json(
    list.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      lo: r.lo,
      type: r.type,
      mime_type: r.mimeType || null,
      // An uploaded file always wins if both exist; otherwise fall back
      // to the external link (used by "reference" / "old_exam" so a huge
      // textbook file never has to live on the server's own disk).
      download_url: r.filename
        ? `/uploads/${folderFor(r.type)}/${r.filename}`
        : r.externalUrl || null,
      external_url: r.externalUrl || null,
    }))
  );
});

// =========================
// POST /api/resources  (admin or academic team)
// form-data: type, lo, title, description, file (optional)
// =========================
router.post("/", requireRole("admin", "academic"), (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const { type, lo, title, description } = req.body || {};
    const externalUrl = req.body && req.body.externalUrl
      ? String(req.body.externalUrl).trim()
      : "";

    if (!VALID_TYPES.includes(type)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: `Invalid resource type. Use one of: ${VALID_TYPES.join(", ")}.`,
      });
    }

    // Guide / Reference / Old Exam are single whole items, not split by
    // Learning Outcome — an LO is never required (and is ignored if sent).
    const requiresLo = !NO_LO_TYPES.includes(type);
    if (requiresLo && !VALID_LOS.includes(lo)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Invalid learning outcome." });
    }

    if (!title) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Title is required." });
    }

    if (externalUrl && !/^https?:\/\//i.test(externalUrl)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "The link must start with http:// or https://." });
    }

    if (type === "test_bank") {
      if (!req.file) {
        return res.status(400).json({ error: "A Test Bank file is required." });
      }
      const ext = path.extname(req.file.originalname || "").toLowerCase();
      const allowed = [".pdf", ".doc", ".docx"];
      if (!allowed.includes(ext)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: "Test Bank files must be PDF, DOC, or DOCX." });
      }
    }

    // "reference" (and "old_exam") may be a link instead of an upload —
    // books are frequently far too large to store on the app's own disk.
    // Every other type still needs either a file or, now, a link.
    if (!req.file && !externalUrl) {
      return res.status(400).json({
        error: LINKABLE_TYPES.includes(type)
          ? "Attach a file or paste a link (e.g. Google Drive)."
          : "A file is required.",
      });
    }
    if (!LINKABLE_TYPES.includes(type) && !req.file && externalUrl) {
      return res.status(400).json({
        error: "A link is only accepted for Reference and Old Exam resources — upload a file for this type instead.",
      });
    }

    const db = readDB();
    const resource = {
      id: nextId(db, "resources"),
      type,
      lo: requiresLo ? lo : null,
      title: String(title).trim(),
      description: description ? String(description).trim() : "",
      filename: req.file ? req.file.filename : null,
      mimeType: req.file ? req.file.mimetype : null,
      externalUrl: req.file ? null : externalUrl || null,
      createdAt: new Date().toISOString(),
    };

    db.resources.push(resource);
    writeDB(db);

    res.status(201).json({ message: "Resource added.", id: resource.id });
  });
});

// =========================
// DELETE /api/resources/:id  (admin or academic team)
// =========================
router.delete("/:id", requireRole("admin", "academic"), (req, res) => {
  const db = readDB();
  const idx = db.resources.findIndex((r) => r.id === Number(req.params.id));

  if (idx === -1) {
    return res.status(404).json({ error: "Resource not found." });
  }

  db.resources.splice(idx, 1);
  writeDB(db);
  res.json({ message: "Resource deleted." });
});

module.exports = router;
