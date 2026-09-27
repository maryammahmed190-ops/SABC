// =========================
// Reset ONLY the admin account
// =========================
//
// Run this whenever you want to throw away the current admin login and
// start a fresh one, WITHOUT touching any student, academic, or any
// other account — those are never read or written by this script.
//
// What it does:
//   1. Deletes the user row whose role is "admin" (if one exists).
//   2. Creates a brand new admin account from the email/password below
//      (or from ADMIN_EMAIL / ADMIN_PASSWORD in .env, if set).
//
// Usage:
//   node reset-admin.js
//
// You can also just edit the two lines below before running it, or set
// ADMIN_EMAIL / ADMIN_PASSWORD as environment variables / in .env.

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { readDB, writeDB, nextId } = require("./src/db");

const email = (process.env.ADMIN_EMAIL || "admin@gmail.com").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "SABC123";
const name = "Biology Hub Admin";

const db = readDB();

const removed = db.users.filter((u) => u.role === "admin");
db.users = db.users.filter((u) => u.role !== "admin");

if (removed.length) {
  console.log(
    `Removed ${removed.length} existing admin account(s): ${removed
      .map((u) => u.email)
      .join(", ")}`
  );
} else {
  console.log("No existing admin account found — creating a fresh one.");
}

const user = {
  id: nextId(db, "users"),
  name,
  email,
  passwordHash: bcrypt.hashSync(String(password), 10),
  grade: "Grade 11",
  school: "STEM Assiut",
  role: "admin",
  createdAt: new Date().toISOString(),
};

db.users.push(user);
writeDB(db);

console.log("New admin account created.");
console.log("Email:", email);
console.log("Password:", password);
console.log(
  "Every other account (students, academic team, etc.) was left exactly as it was."
);
