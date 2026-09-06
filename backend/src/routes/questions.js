const express = require("express");
const { readDB, writeDB, nextId } = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

const VALID_CATEGORIES = ["quiz", "test_bank"];
const VALID_LOS = ["LO1", "LO2", "LO3", "LO4", "LO5", "LO6", "LO7"];

// =========================
// GET /api/questions?category=&lo=
// =========================
router.get("/", (req, res) => {
  const { category, lo } = req.query;

  if (!VALID_CATEGORIES.includes(category)) {
    return res
      .status(400)
      .json({ error: "Invalid category. Use quiz or test_bank." });
  }
  if (lo && !VALID_LOS.includes(lo)) {
    return res.status(400).json({ error: "Invalid learning outcome." });
  }

  const db = readDB();
  let list = db.questions.filter((q) => q.category === category);
  if (lo) list = list.filter((q) => q.lo === lo);

  if (category === "quiz") {
    // Students taking the quiz must never see the correct answer —
    // grading happens server-side in /api/quiz/submit. But admin/academic
    // managing the question bank DO need to see it, otherwise they have
    // no way to review or correct what they already added.
    let requesterRole = null;
    if (req.session && req.session.userId) {
      const db2 = readDB();
      const requester = db2.users.find((u) => u.id === req.session.userId);
      if (requester) requesterRole = requester.role;
    }

    const canSeeAnswers =
      requesterRole === "admin" || requesterRole === "academic";

    if (canSeeAnswers) {
      return res.json(
        list.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options || [],
          answer: q.answer,
          explanation: q.explanation || "",
          lo: q.lo,
        }))
      );
    }

    return res.json(
      list.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options || [],
      }))
    );
  }

  // test_bank: answers are meant to be visible for self-study.
  res.json(
    list.map((q) => ({
      id: q.id,
      question: q.question,
      answer: q.answer,
      explanation: q.explanation || "",
    }))
  );
});

// =========================
// POST /api/questions  (admin or academic team)
// json: { category, lo, question, options?, answer, explanation? }
// options is required (array, 2+ items) when category === "quiz"
// =========================
router.post("/", requireRole("admin", "academic"), (req, res) => {
  const { category, lo, question, options, answer, explanation } =
    req.body || {};

  if (!VALID_CATEGORIES.includes(category)) {
    return res
      .status(400)
      .json({ error: "Invalid category. Use quiz or test_bank." });
  }
  if (!VALID_LOS.includes(lo)) {
    return res.status(400).json({ error: "Invalid learning outcome." });
  }
  if (!question || !answer) {
    return res.status(400).json({ error: "Question and answer are required." });
  }
  if (category === "quiz" && (!Array.isArray(options) || options.length < 2)) {
    return res
      .status(400)
      .json({ error: "Quiz questions need at least two options." });
  }

  const db = readDB();
  const q = {
    id: nextId(db, "questions"),
    category,
    lo,
    question: String(question).trim(),
    options: category === "quiz" ? options.map(String) : undefined,
    answer: String(answer).trim(),
    explanation: explanation ? String(explanation).trim() : "",
    createdAt: new Date().toISOString(),
  };

  db.questions.push(q);
  writeDB(db);

  res.status(201).json({ message: "Question added.", id: q.id });
});

// =========================
// DELETE /api/questions/:id  (admin or academic team)
// =========================
router.delete("/:id", requireRole("admin", "academic"), (req, res) => {
  const db = readDB();
  const idx = db.questions.findIndex((q) => q.id === Number(req.params.id));

  if (idx === -1) {
    return res.status(404).json({ error: "Question not found." });
  }

  db.questions.splice(idx, 1);
  writeDB(db);
  res.json({ message: "Question deleted." });
});

module.exports = router;
