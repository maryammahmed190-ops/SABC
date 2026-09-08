const express = require("express");
const { readDB, writeDB } = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

const VALID_ROLES = ["student", "academic", "admin"];

// =========================
// GET /api/admin/users
// Admin only
// =========================
router.get("/", requireRole("admin","academic"), (req, res) => {
  const db = readDB();

  res.json(
    db.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      grade: u.grade,
      school: u.school,
    }))
  );
});

// =========================
// GET /api/admin/users/results?lo=
// Admin or Academic team. Filter by lo to see one Learning Outcome's
// quiz results on their own instead of everything mixed together.
// =========================
router.get("/results", requireRole("admin", "academic"), (req, res) => {
  const db = readDB();

  let results = Array.isArray(db.results)
    ? db.results
    : [];

  const { lo } = req.query;

  if (lo) {
    results = results.filter((r) => r.lo === lo);
  }

  res.json(results);
});

// =========================
// DELETE /api/admin/users/results/:id  (admin or academic team)
// Removes one student's quiz result — e.g. after the questions for
// that quiz were deleted and the old result no longer applies.
// =========================
router.delete("/results/:id", requireRole("admin", "academic"), (req, res) => {
  const db = readDB();

  if (!Array.isArray(db.results)) db.results = [];

  const idx = db.results.findIndex((r) => Number(r.id) === Number(req.params.id));

  if (idx === -1) {
    return res.status(404).json({ error: "Result not found." });
  }

  db.results.splice(idx, 1);
  writeDB(db);

  res.json({ message: "Result deleted." });
});

// =========================
// DELETE /api/admin/users/results?lo=LO1  (admin or academic team)
// Removes every stored result for one Learning Outcome in one go.
// =========================
router.delete("/results", requireRole("admin", "academic"), (req, res) => {
  const { lo } = req.query;

  if (!lo) {
    return res.status(400).json({ error: "Provide a lo to clear results for." });
  }

  const db = readDB();

  if (!Array.isArray(db.results)) db.results = [];

  const before = db.results.length;
  db.results = db.results.filter((r) => r.lo !== lo);
  const removed = before - db.results.length;

  writeDB(db);

  res.json({ message: `${removed} result(s) deleted for ${lo}.` });
});

// =========================
// PATCH /api/admin/users/:id/role
// Admin only
// =========================
router.patch("/:id/role", requireRole("admin"), (req, res) => {
  const { role } = req.body || {};

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({
      error: "Role must be student, academic, or admin.",
    });
  }

  const db = readDB();

  const user = db.users.find(
    (u) => u.id === Number(req.params.id)
  );

  if (!user) {
    return res.status(404).json({
      error: "User not found.",
    });
  }

  user.role = role;

  writeDB(db);

  res.json({
    message: `${user.name} is now ${role}.`,
  });
});

module.exports = router;
