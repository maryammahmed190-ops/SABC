const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { readDB, writeDB, nextId } = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "uploads", "events"),
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname || ""));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Event image must be an image file."));
    }
    cb(null, true);
  },
});

// =========================
// GET /api/events
// =========================
router.get("/", (req, res) => {
  const db = readDB();

  const events = [...db.events].sort(
    (a, b) => new Date(a.eventDate) - new Date(b.eventDate)
  );

  res.json(
    events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      event_date: e.eventDate,
      image: e.image ? `/uploads/events/${e.image}` : null,
    }))
  );
});

// =========================
// POST /api/events  (admin only — Academic/IT team)
// form-data: title, description, event_date, image (file, optional)
// =========================
router.post("/", requireRole("admin"), (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const { title, description, event_date } = req.body || {};

    if (!title || !description || !event_date) {
      return res
        .status(400)
        .json({ error: "Title, description, and event date are required." });
    }

    const db = readDB();
    const event = {
      id: nextId(db, "events"),
      title: String(title).trim(),
      description: String(description).trim(),
      eventDate: event_date,
      image: req.file ? req.file.filename : null,
      createdAt: new Date().toISOString(),
    };

    db.events.push(event);
    writeDB(db);

    res.status(201).json({ message: "Event created.", id: event.id });
  });
});

// =========================
// DELETE /api/events/:id  (admin only)
// =========================
router.delete("/:id", requireRole("admin"), (req, res) => {
  const db = readDB();
  const idx = db.events.findIndex((e) => e.id === Number(req.params.id));

  if (idx === -1) {
    return res.status(404).json({ error: "Event not found." });
  }

  db.events.splice(idx, 1);
  writeDB(db);
  res.json({ message: "Event deleted." });
});

module.exports = router;
