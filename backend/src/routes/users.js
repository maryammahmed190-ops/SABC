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
// GET /api/admin/users/results
// Admin or Academic team
// =========================
router.get("/results", requireRole("admin", "academic"), (req, res) => {
  const db = readDB();

  const results = Array.isArray(db.results)
    ? db.results
    : [];

  res.json(results);
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
