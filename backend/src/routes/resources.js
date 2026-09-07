const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { readDB, writeDB, nextId } = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

const VALID_TYPES = ["explanation", "connection", "video", "test_bank"];
const VALID_LOS = ["LO1", "LO2", "LO3", "LO4", "LO5", "LO6", "LO7", "LO8"];

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
      error: "Invalid resource type. Use explanation, connection, video, or test_bank.",
    });
  }
  if (lo && !VALID_LOS.includes(lo)) {
    return res.status(400).json({ error: "Invalid learning outcome." });
  }

  const db = readDB();
  let list = type ? db.resources.filter((r) => r.type === type) : db.resources;
  if (lo) list = list.filter((r) => r.lo === lo);

  res.json(
    list.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      lo: r.lo,
      type: r.type,
      mime_type: r.mimeType || null,
      download_url: r.filename
        ? `/uploads/${folderFor(r.type)}/${r.filename}`
        : null,
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

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: "Invalid resource type. Use explanation, connection, video, or test_bank.",
      });
    }
    if (!VALID_LOS.includes(lo)) {
      return res.status(400).json({ error: "Invalid learning outcome." });
    }
    if (!title) {
      return res.status(400).json({ error: "Title is required." });
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

    const db = readDB();
    const resource = {
      id: nextId(db, "resources"),
      type,
      lo,
      title: String(title).trim(),
      description: description ? String(description).trim() : "",
      filename: req.file ? req.file.filename : null,
      mimeType: req.file ? req.file.mimetype : null,
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
