# Biology Hub — Backend

A small Express backend for the Biology Hub club website. It matches every
call already made by `frontend/script.js`, so the frontend needs **zero
changes** — just point this server at your `frontend/` folder and go.

## Folder layout expected

```
biology-hub/
  backend/    <- this project
  frontend/   <- home.html, videos.html, style.css, script.js, images/...
```

If you keep the frontend somewhere else, set `FRONTEND_DIR` in `.env`.

## Setup

```bash
cd backend
cp .env.example .env     # then edit .env — set SESSION_SECRET and ADMIN_EMAILS
npm install
npm start
```

Open `http://localhost:3000` — it serves `home.html` by default.

No external database server (and no native package to compile) needed:
content is stored in a local SQLite file, `backend/data/db.sqlite`, using
Node's own **built-in** `node:sqlite` module (Node 22.5+). You'll see one
harmless line on startup — `ExperimentalWarning: SQLite is an experimental
feature` — that's expected, not an error. Uploaded images and videos are
saved under `backend/uploads/`.

**Requires Node.js 22.5 or newer.** Check with `node -v`. (We deliberately
avoided the popular `better-sqlite3` package here — it needs a C++
compiler on whatever machine runs `npm install`, which fails out of the
box on plain Windows. `node:sqlite` ships inside Node itself, so
`npm install` never has to compile anything for the database.)

**Upgrading from an older copy of this project?** If you already had a
`backend/data/db.json` file with real data in it, just drop it into
`backend/data/` and start the server once — it's imported into
`db.sqlite` automatically on first boot, and the old `db.json` is left
untouched on disk as a backup.

**Deploying for real students to use:** SQLite is a real, transactional
database (not just a JSON blob) — but its file still lives on local disk.
Most **free** hosting tiers wipe local disk on every redeploy/restart, which
would silently reset everyone's accounts and results. For a live school
site, use a host with a **persistent disk/volume** mounted over
`backend/data/` and `backend/uploads/` (e.g. Render's paid tier with a
persistent disk), and back up `backend/data/db.sqlite` regularly (it's a
single file — just copy it somewhere safe on a schedule).

### Becoming an admin

Whoever signs up with an email listed in `ADMIN_EMAILS` (comma-separated, in
`.env`) automatically gets the `admin` role. Admins can then promote other
members to `academic` (can add resources/videos/questions) via the API
below — no need to edit the JSON file by hand.

## Roles

| Role       | Can do |
|------------|--------|
| `student`  | Sign up, log in, view events/resources/videos, take quizzes |
| `academic` | Everything a student can, **plus** add/delete resources, videos, and questions |
| `admin`    | Everything, **plus** create/delete events and change anyone's role |

## API reference

All endpoints are prefixed with `/api`. Requests/responses are JSON unless
noted otherwise (file uploads use `multipart/form-data`). Auth is
cookie/session based — the browser handles this automatically since
`script.js` uses `credentials: "same-origin"`.

### Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | `name, email, password, grade, school` | Auto logs in |
| POST | `/api/auth/login` | `email, password` | |
| GET  | `/api/auth/me` | — | `{ authenticated, user }` |
| POST | `/api/auth/logout` | — | |

### Events (public read, admin write)

| Method | Path | Body |
|---|---|---|
| GET | `/api/events` | — |
| POST | `/api/events` | form-data: `title, description, event_date, image` (file, optional) |
| DELETE | `/api/events/:id` | — |

### Resources — explanation / connection / video (public read, academic+ write)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/resources?type=explanation\|connection\|video\|test_bank&lo=LO1..LO7` | `type` and `lo` both optional — omit `type` to list every resource |
| POST | `/api/resources` | form-data: `type, lo, title, description, file` (the actual video/PDF) |
| DELETE | `/api/resources/:id` | |

### Questions — quiz / test_bank (public read, academic+ write)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/questions?category=quiz\|test_bank&lo=LO1..LO7` | Quiz responses never include the answer |
| POST | `/api/questions` | json: `category, lo, question, options[] (quiz only), answer, explanation` |
| DELETE | `/api/questions/:id` | |

### Quiz grading

| Method | Path | Body |
|---|---|---|
| POST | `/api/quiz/submit` | `{ lo, answers: { [questionId]: selectedOption } }` → `{ score, total, percentage }` |

### Admin — user roles & quiz results

| Method | Path | Body | Who |
|---|---|---|---|
| GET | `/api/admin/users` | — | admin, academic |
| GET | `/api/admin/users/results` | — → list of quiz results | admin, academic |
| PATCH | `/api/admin/users/:id/role` | `{ role: "student" \| "academic" \| "admin" }` | admin only |

## Adding content (for the Academic Team)

Once someone is an `academic` or `admin`, they can add content with any
HTTP client (Postman, Insomnia, or `curl`) while logged in through the
browser — or with a cookie-aware `curl` session:

```bash
# 1. Log in and keep the session cookie
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"academic@example.com","password":"yourpassword"}'

# 2. Upload an LO1 video
curl -b cookies.txt -X POST http://localhost:3000/api/resources \
  -F "type=video" -F "lo=LO1" -F "title=Cell Structure" \
  -F "description=Intro to cell organelles" \
  -F "file=@/path/to/video.mp4"

# 3. Add a quiz question for LO1
curl -b cookies.txt -X POST http://localhost:3000/api/questions \
  -H "Content-Type: application/json" \
  -d '{"category":"quiz","lo":"LO1","question":"What is the powerhouse of the cell?","options":["Nucleus","Mitochondria","Ribosome","Golgi"],"answer":"Mitochondria"}'
```

A simple internal admin page could be built later on top of these same
endpoints — the API is already everything it needs.

## Notes on the storage choice

Content lives in `backend/data/db.json` instead of a database engine like
SQLite/Postgres. This keeps setup to `npm install && npm start` with zero
native dependencies (no compiler/build tools required on anyone's laptop) —
appropriate for a club site with modest traffic. If the site grows a lot,
swap `src/db.js` for a real database; every route only talks to that one
file, so it's a contained change.

## Security notes

- Passwords are hashed with bcrypt, never stored in plain text.
- Sessions are httpOnly cookies; set `NODE_ENV=production` behind HTTPS so
  cookies are marked `secure`.
- Change `SESSION_SECRET` in `.env` before deploying — don't use the example
  value.
- Login/signup are rate-limited (30 attempts / 15 minutes per IP) to slow
  down brute-force attempts.
- Quiz answers are never sent to the browser — grading happens entirely on
  the server in `/api/quiz/submit`.
