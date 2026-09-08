const express = require("express");
const { readDB, writeDB } = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

const VALID_LOS = ["LO1", "LO2", "LO3", "LO4", "LO5", "LO6", "LO7", "LO8"];

// =========================
// GET /api/quiz-settings  (admin or academic team)
// Full list, used by the dashboard to prefill the settings form and
// show the publish status for every Learning Outcome.
// =========================
router.get("/", requireRole("admin", "academic"), (req, res) => {
  const db = readDB();
  res.json(db.quizSettings || []);
});

// =========================
// GET /api/quiz-settings/:lo  (public)
// Used by the LO page. While a quiz is NOT published, students must not
// see the description or the Start Now button at all — so only the
// "published" flag is returned in that case.
// =========================
router.get("/:lo", (req, res) => {
  const { lo } = req.params;

  if (!VALID_LOS.includes(lo)) {
    return res.status(400).json({ error: "Invalid learning outcome." });
  }

  const db = readDB();
  const settings = (db.quizSettings || []).find((s) => s.lo === lo);

  if (!settings || !settings.published) {
    return res.json({ lo, published: false });
  }

  res.json({
    lo,
    published: true,
    description: settings.description || "",
    duration: settings.duration || null,
  });
});

// =========================
// PUT /api/quiz-settings/:lo  (admin or academic team)
// json: { description?, duration?, published? }
// Upserts the settings for a Learning Outcome. Only the fields provided
// are changed — existing values are kept otherwise.
// =========================
router.put("/:lo", requireRole("admin", "academic"), (req, res) => {
  const { lo } = req.params;

  if (!VALID_LOS.includes(lo)) {
    return res.status(400).json({ error: "Invalid learning outcome." });
  }

  const { description, duration, published } = req.body || {};

  if (duration !== undefined && duration !== null && duration !== "") {
    const num = Number(duration);
    if (!Number.isFinite(num) || num <= 0) {
      return res
        .status(400)
        .json({ error: "Duration must be a positive number of minutes." });
    }
  }

  const db = readDB();
  if (!Array.isArray(db.quizSettings)) db.quizSettings = [];

  const existing = db.quizSettings.find((s) => s.lo === lo);

  const updated = {
    lo,
    description:
      description !== undefined ? String(description).trim() : (existing && existing.description) || "",
    duration:
      duration !== undefined && duration !== null && duration !== ""
        ? Number(duration)
        : (existing && existing.duration) || null,
    published:
      published !== undefined ? Boolean(published) : (existing && existing.published) || false,
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    Object.assign(existing, updated);
  } else {
    db.quizSettings.push(updated);
  }

  writeDB(db);

  res.json({ message: "Quiz settings saved.", settings: updated });
});

module.exports = router;
