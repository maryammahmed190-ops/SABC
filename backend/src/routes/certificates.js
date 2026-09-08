const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { readDB, writeDB, nextId } = require("../db");
const { requireRole, requireAuth } = require("../middleware/auth");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "..", "uploads", "certificates"));
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname || ""));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB is plenty for a certificate image/PDF
});

function toPublic(cert, users) {
  const student = users.find((u) => u.id === cert.userId);

  return {
    id: cert.id,
    userId: cert.userId,
    studentName: student ? student.name : null,
    email: student ? student.email : null,
    title: cert.title || "",
    mimeType: cert.mimeType,
    download_url: cert.filename ? `/uploads/certificates/${cert.filename}` : null,
    createdAt: cert.createdAt,
  };
}

// =========================
// GET /api/certificates  (admin or academic team)
// Full list, for the dashboard's certificate manager.
// =========================
router.get("/", requireRole("admin", "academic"), (req, res) => {
  const db = readDB();
  res.json((db.certificates || []).map((c) => toPublic(c, db.users)));
});

// =========================
// GET /api/certificates/me  (any logged-in user)
// Only the certificate(s) belonging to the current student — this is
// what decides whether the "My Certificate" entry shows up for them.
// =========================
router.get("/me", requireAuth, (req, res) => {
  const db = readDB();
  const mine = (db.certificates || []).filter(
    (c) => c.userId === Number(req.session.userId)
  );
  res.json(mine.map((c) => toPublic(c, db.users)));
});

// =========================
// POST /api/certificates  (admin or academic team)
// form-data: userId, title (optional), file (required)
// =========================
router.post("/", requireRole("admin", "academic"), (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const { userId, title } = req.body || {};

    if (!userId || !Number.isFinite(Number(userId))) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Please choose a student." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "A certificate file is required." });
    }

    const db = readDB();
    const student = db.users.find((u) => u.id === Number(userId));

    if (!student) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: "Student not found." });
    }

    const certificate = {
      id: nextId(db, "certificates"),
      userId: student.id,
      title: title ? String(title).trim() : "",
      filename: req.file.filename,
      mimeType: req.file.mimetype,
      createdAt: new Date().toISOString(),
    };

    db.certificates.push(certificate);
    writeDB(db);

    res.status(201).json({
      message: `Certificate uploaded for ${student.name}.`,
      id: certificate.id,
    });
  });
});

// =========================
// DELETE /api/certificates/:id  (admin or academic team)
// =========================
router.delete("/:id", requireRole("admin", "academic"), (req, res) => {
  const db = readDB();
  const idx = db.certificates.findIndex((c) => c.id === Number(req.params.id));

  if (idx === -1) {
    return res.status(404).json({ error: "Certificate not found." });
  }

  const [removed] = db.certificates.splice(idx, 1);
  writeDB(db);

  if (removed && removed.filename) {
    fs.unlink(
      path.join(__dirname, "..", "..", "uploads", "certificates", removed.filename),
      () => {}
    );
  }

  res.json({ message: "Certificate deleted." });
});

module.exports = router;
