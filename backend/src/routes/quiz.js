const express = require("express");
const { readDB, writeDB } = require("../db");

const router = express.Router();

// =========================
// POST /api/quiz/submit
// =========================
router.post("/submit", (req, res) => {
  const { lo, answers, quizName } = req.body || {};

  // =========================
  // Validate request
  // =========================
  if (!lo || typeof answers !== "object" || answers === null) {
    return res.status(400).json({
      error: "Missing quiz answers.",
    });
  }

  // =========================
  // Require login
  // =========================
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: "Please login before submitting the quiz.",
    });
  }

  const db = readDB();

  // =========================
  // Find logged-in student
  // =========================
  const student = db.users.find(
    (u) => u.id === Number(req.session.userId)
  );

  if (!student) {
    return res.status(401).json({
      error: "User session is invalid. Please login again.",
    });
  }

  // =========================
  // Make sure results exists
  // =========================
  if (!Array.isArray(db.results)) {
    db.results = [];
  }

  // =========================
  // Find quiz questions
  // =========================
  const questions = db.questions.filter(
    (q) => q.category === "quiz" && q.lo === lo
  );

  if (!questions.length) {
    return res.status(404).json({
      error: "No quiz found for this learning outcome.",
    });
  }

  // =========================
  // Calculate score
  // =========================
  let score = 0;

  questions.forEach((q) => {
    const submitted = answers[q.id];

    if (
      submitted !== undefined &&
      String(submitted) === String(q.answer)
    ) {
      score++;
    }
  });

  const total = questions.length;
  const percentage = Math.round((score / total) * 100);

  // =========================
  // Keep only the FIRST attempt per student per quiz (LO).
  // The student can still retake the quiz and see their new score,
  // but the result shown to admin/academic stays the first one —
  // retaking never overwrites it.
  // =========================
  const existingIndex = db.results.findIndex(
    (r) => r.userId === student.id && r.lo === lo
  );

  if (existingIndex === -1) {
    const resultId =
      db.results.length > 0
        ? Math.max(...db.results.map((r) => Number(r.id) || 0)) + 1
        : 1;

    db.results.push({
      id: resultId,

      userId: student.id,

      studentName: student.name,

      email: student.email,

      quizName:
        String(quizName || "").trim() ||
        `Quiz - ${lo}`,

      lo,

      score,

      total,

      percentage,

      date: new Date().toISOString(),
    });

    // =========================
    // WRITE TO the database (only needed when a new result was added)
    // =========================
    writeDB(db);
  }

  // =========================
  // Return result
  // =========================
  res.json({
    score,
    total,
    percentage,
  });
});

module.exports = router;
