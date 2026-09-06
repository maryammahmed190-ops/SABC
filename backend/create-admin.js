const bcrypt = require("bcryptjs");
const { readDB, writeDB, nextId } = require("./src/db");

const db = readDB();

const email = "admin@gmail.com";
const password = "SABC123";
const name = "Biology Hub Admin";

const existing = db.users.find((u) => u.email === email);

if (existing) {
  console.log("This account already exists.");
  console.log("Role:", existing.role);
  process.exit(0);
}

const user = {
  id: nextId(db, "users"),
  name,
  email,
  passwordHash: bcrypt.hashSync(password, 10),
  grade: "Grade 11",
  school: "STEM Assiut",
  role: "admin",
  createdAt: new Date().toISOString(),
};

db.users.push(user);

writeDB(db);

console.log("Admin account created successfully.");
console.log("Email:", email);
console.log("Password:", password);