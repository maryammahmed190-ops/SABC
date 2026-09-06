const { readDB } = require("../db");

// Blocks the request unless the visitor is logged in.
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Please log in to continue." });
  }
  next();
}

// Blocks the request unless the visitor is logged in AND has one of the
// given roles. Use requireRole('admin') or requireRole('admin','academic').
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Please log in to continue." });
    }

    const db = readDB();
    const user = db.users.find((u) => u.id === req.session.userId);

    if (!user || !roles.includes(user.role)) {
      return res
        .status(403)
        .json({ error: "You do not have permission to do this." });
    }

    req.currentUser = user;
    next();
  };
}

module.exports = { requireAuth, requireRole };
