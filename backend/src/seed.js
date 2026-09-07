// =========================
// Seed the admin & academic accounts
// =========================
//
// data/db.sqlite is intentionally gitignored (it's runtime data, not
// source code). That means every fresh deploy (a new Railway build,
// a clone on another machine, etc.) starts with an EMPTY database —
// including the admin and academic accounts that create-admin.js /
// create-academic.js used to set up by being run manually. On a host
// where you can't easily open a shell to run those scripts, those two
// accounts never get created, so "Admin" / "Academic" never show up
// on the dashboard.
//
// This runs automatically every time the server starts and
// (re)creates the two accounts only if they don't already exist yet,
// so the dashboard always has a working admin and academic login —
// no manual step required on Railway or anywhere else.
//
// You can override the email/password from .env so the defaults below
// aren't left running on a public site (recommended).

const bcrypt = require("bcryptjs");
const { readDB, writeDB, nextId } = require("./db");

function seedAccount({ email, password, name, role, grade, school }) {
  const db = readDB();
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = db.users.find((u) => u.email === normalizedEmail);

  // Already there (seeded before, created via signup, or migrated from
  // an older db.json) - leave it exactly as it is.
  if (existing) return;

  const user = {
    id: nextId(db, "users"),
    name,
    email: normalizedEmail,
    passwordHash: bcrypt.hashSync(String(password), 10),
    grade,
    school,
    role,
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);
  writeDB(db);

  console.log(`Seeded ${role} account: ${normalizedEmail}`);
}

function seedDefaultAccounts() {
  seedAccount({
    email: process.env.ADMIN_EMAIL || "admin@gmail.com",
    password: process.env.ADMIN_PASSWORD || "SABC123",
    name: "Biology Hub Admin",
    role: "admin",
    grade: "Grade 11",
    school: "STEM Assiut",
  });

  seedAccount({
    email: process.env.ACADEMIC_EMAIL || "biologyteam@gmail.com",
    password: process.env.ACADEMIC_PASSWORD || "SABC123",
    name: "Biology Team",
    role: "academic",
    grade: "Grade 11",
    school: "STEM Assiut",
  });
}

module.exports = { seedDefaultAccounts };
