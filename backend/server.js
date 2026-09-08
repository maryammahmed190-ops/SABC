require("dotenv").config();

const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const authRoutes = require("./src/routes/auth");
const eventsRoutes = require("./src/routes/events");
const resourcesRoutes = require("./src/routes/resources");
const questionsRoutes = require("./src/routes/questions");
const quizRoutes = require("./src/routes/quiz");
const quizSettingsRoutes = require("./src/routes/quizSettings");
const certificatesRoutes = require("./src/routes/certificates");
const usersRoutes = require("./src/routes/users");
const { seedDefaultAccounts } = require("./src/seed");

const app = express();
const PORT = process.env.PORT || 3000;

// The frontend/ folder is expected to live next to backend/, i.e.:
//   biology-hub/
//     backend/   <- this server
//     frontend/  <- your home.html, videos.html, style.css, script.js, images/...
// Override with FRONTEND_DIR in .env if you keep it somewhere else.
const FRONTEND_DIR = process.env.FRONTEND_DIR
  ? path.resolve(process.env.FRONTEND_DIR)
  : path.join(__dirname, "..", "frontend");

// Make sure upload/data folders exist even on a fresh clone.
["events", "resources", "videos", "certificates"].forEach((dir) => {
  fs.mkdirSync(path.join(__dirname, "uploads", dir), { recursive: true });
});
fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });

// Make sure the admin & academic accounts exist on every start (see
// src/seed.js for why this is needed on hosts like Railway).
seedDefaultAccounts();

app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-secret-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// Slow down brute-force attempts on login/signup.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many attempts, please try again later." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);

// =========================
// API routes
// =========================
app.use("/api/auth", authRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/resources", resourcesRoutes);
app.use("/api/questions", questionsRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/quiz-settings", quizSettingsRoutes);
app.use("/api/certificates", certificatesRoutes);
app.use("/api/admin/users", usersRoutes);

// Uploaded files (event images, resource files, videos)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// The frontend itself (home.html, videos.html, style.css, script.js, images/...)
app.use(express.static(FRONTEND_DIR, { index: "home.html" }));

// Unknown API routes -> JSON 404 instead of falling through to the frontend
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Central error handler (also catches multer file-size/type errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Something went wrong on the server.",
  });
});

app.listen(PORT, () => {
  console.log(`Biology Hub server running at http://localhost:${PORT}`);
  console.log(`Serving frontend from: ${FRONTEND_DIR}`);
});
