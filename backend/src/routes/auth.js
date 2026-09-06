const express = require("express");
const bcrypt = require("bcryptjs");
const { readDB, writeDB, nextId } = require("../db");

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_GRADES = ["Grade 9", "Grade 10", "Grade 11", "Grade 12"];

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function publicUser(user) {
  return {
    name: user.name,
    email: user.email,
    grade: user.grade,
    school: user.school,
    role: user.role,
  };
}

// =========================
// POST /api/auth/signup
// =========================
router.post("/signup", (req, res) => {
  const { name, email, password, grade, school } = req.body || {};

  if (!name || !email || !password || !grade || !school) {
    return res.status(400).json({ error: "Please fill in all fields." });
  }
  if (!EMAIL_REGEX.test(String(email))) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (String(password).length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters." });
  }
  if (!VALID_GRADES.includes(grade)) {
    return res.status(400).json({ error: "Please select a valid grade." });
  }

  const db = readDB();
  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = db.users.find((u) => u.email === normalizedEmail);
  if (existing) {
    return res
      .status(409)
      .json({ error: "An account with this email already exists." });
  }

  const passwordHash = bcrypt.hashSync(String(password), 10);
  const role = ADMIN_EMAILS.includes(normalizedEmail) ? "admin" : "student";

  const user = {
    id: nextId(db, "users"),
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    grade,
    school: String(school).trim(),
    role,
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);
  writeDB(db);

  req.session.userId = user.id;
  res.status(201).json({ message: "Account created successfully." });
});

// =========================
// POST /api/auth/login
// =========================
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Please enter your email and password." });
  }

  const db = readDB();
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.users.find((u) => u.email === normalizedEmail);

  if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  req.session.userId = user.id;
  res.json({ message: "Login successful." });
});

// =========================
// GET /api/auth/me
// =========================
router.get("/me", (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ authenticated: false });
  }

  const db = readDB();
  const user = db.users.find((u) => u.id === req.session.userId);

  if (!user) {
    return res.json({ authenticated: false });
  }

  res.json({ authenticated: true, user: publicUser(user) });
});

// =========================
// POST /api/auth/logout
// =========================
router.post("/logout", (req, res) => {
  if (!req.session) {
    return res.json({ message: "Logged out." });
  }
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out." });
  });
});

module.exports = router;
