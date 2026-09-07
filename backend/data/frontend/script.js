// =========================
// Biology Club API client
// =========================

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : {
            "Content-Type": "application/json"
          }),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

// =========================
// MESSAGES
// =========================

function showMessage(element, text, isError = false) {
  if (!element) return;
  element.textContent = text;
  element.style.color = isError ? "#9b2c2c" : "#0a463a";
}

// =========================
// SIGN UP
// =========================

const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.getElementById("signupMessage");
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
      showMessage(message, "Passwords do not match.", true);
      return;
    }

    try {
      await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: document.getElementById("name").value.trim(),
          email: document.getElementById("email").value.trim(),
          password,
          grade: document.getElementById("grade").value,
          school: document.getElementById("school").value.trim()
        })
      });

      showMessage(message, "Account created. Redirecting...");

      setTimeout(() => {
        window.location.href = "home.html";
      }, 500);
    } catch (error) {
      showMessage(message, error.message, true);
    }
  });
}

// =========================
// LOGIN
// =========================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.getElementById("loginMessage");

    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("loginEmail").value.trim(),
          password: document.getElementById("loginPassword").value
        })
      });

      showMessage(message, "Login successful. Redirecting...");

      setTimeout(() => {
        window.location.href = "home.html";
      }, 400);
    } catch (error) {
      showMessage(message, error.message, true);
    }
  });
}

// =========================
// PROFILE
// =========================

async function loadProfile() {
  const letter = document.getElementById("profileLetter");
  const menu = document.getElementById("profileMenu");

  if (!letter || !menu) return;

  try {
    const data = await api("/api/auth/me");

    if (!data.authenticated) {
      letter.textContent = "↪";

      const logout = menu.querySelector(".logout-btn");

      if (logout) {
        logout.textContent = "Login";
        logout.onclick = () => {
          window.location.href = "login.html";
        };
      }

      return;
    }

    const user = data.user;

    letter.textContent = (user.name || "U").charAt(0).toUpperCase();

    const h3 = menu.querySelector("h3");
    const ps = menu.querySelectorAll("p");

    if (h3) h3.textContent = user.name;
    if (ps[0]) ps[0].textContent = user.email;
    if (ps[1]) ps[1].textContent = `Grade: ${user.grade}`;
    if (ps[2]) ps[2].textContent = `School: ${user.school}`;

    if (["admin", "academic"].includes(user.role) && !menu.querySelector(".dashboard-link")) {
      const dashboard = document.createElement("a");
      dashboard.className = "dashboard-link";
      dashboard.href = "dashboard.html";
      dashboard.textContent = "Academic Dashboard";
      dashboard.style.display = "block";
      dashboard.style.margin = "12px 0";
      dashboard.style.color = "#0a463a";
      dashboard.style.fontWeight = "700";
      menu.insertBefore(dashboard, menu.querySelector(".logout-btn"));
    }

    const logout = menu.querySelector(".logout-btn");

    if (logout) {
      logout.onclick = async () => {
        await api("/api/auth/logout", { method: "POST" });
        window.location.href = "login.html";
      };
    }
  } catch (error) {
    console.error(error);
  }
}

loadProfile();

const profileLetter = document.getElementById("profileLetter");
const profileMenu = document.getElementById("profileMenu");

if (profileLetter && profileMenu) {
  profileLetter.addEventListener("click", () => {
    profileMenu.classList.toggle("show");
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".profile")) {
      profileMenu.classList.remove("show");
    }
  });
}

// =========================
// EVENTS
// =========================

async function loadEvents() {
  const grid = document.querySelector(".events-grid");

  if (!grid) return;

  try {
    const events = await api("/api/events");

    if (!events.length) {
      grid.innerHTML = `
        <div class="content-card">
          <h3>No events yet</h3>
          <p>New Biology events will appear here.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = events
      .map(
        (event) => `
        <article class="event-card">
          ${
            event.image
              ? `<img src="${escapeAttr(event.image)}" alt="" class="event-image">`
              : ""
          }
          <div class="event-content">
            <p class="event-date">${escapeHtml(event.event_date)}</p>
            <h3>${escapeHtml(event.title)}</h3>
            <p>${escapeHtml(event.description)}</p>
          </div>
        </article>
      `
      )
      .join("");
  } catch (error) {
    console.error(error);
  }
}

loadEvents();

// =========================
// LO CARDS
// =========================

function connectLOCards() {
  const path = window.location.pathname.toLowerCase();

  let type = null;

  if (path.includes("quizzes")) {
    type = "quiz";
  } else if (path.includes("test-bank")) {
    type = "test_bank";
  } else if (path.includes("explanation")) {
    type = "explanation";
  } else if (path.includes("connection")) {
    type = "connection";
  } else if (path.includes("videos")) {
    type = "video";
  }

  if (!type) return;

  document.querySelectorAll(".lo-card").forEach((card, index) => {
    const lo = `LO${index + 1}`;

    card.href = `lo.html?type=${encodeURIComponent(type)}&lo=${encodeURIComponent(lo)}`;
  });
}

connectLOCards();

// =========================
// LO CONTENT PAGE
// =========================

async function loadLOPage() {
  const container = document.getElementById("loContent");

  if (!container) return;

  const params = new URLSearchParams(window.location.search);

  const type = params.get("type") || "quiz";
  const lo = params.get("lo") || "LO1";

  const title = document.getElementById("loTitle");

  if (title) {
    title.textContent = `${lo} — ${type.replace("_", " ").toUpperCase()}`;
  }

  try {
    // =========================
    // RESOURCES + VIDEOS
    // =========================

    if (type === "explanation" || type === "connection" || type === "test_bank" || type === "video") {
      const resources = await api(
        `/api/resources?type=${encodeURIComponent(type)}&lo=${encodeURIComponent(lo)}`
      );

      if (type === "video") {
        renderVideos(container, resources);
      } else {
        renderResources(container, resources);
      }

      return;
    }

    // =========================
    // QUESTIONS
    // =========================

    const questions = await api(
      `/api/questions?category=${encodeURIComponent(type)}&lo=${encodeURIComponent(lo)}`
    );

    if (!questions.length) {
      container.innerHTML = `
        <div class="content-card">
          <h3>No content yet</h3>
          <p>
            Your Biology team can add
            ${escapeHtml(type.replace("_", " "))}
            content for
            ${escapeHtml(lo)}
            from the backend.
          </p>
        </div>
      `;
      return;
    }

    // =========================
    // QUIZ
    // =========================

    container.innerHTML = `
      <form id="quizForm">
        ${questions
          .map(
            (q, i) => `
          <article class="content-card">
            <span class="card-number">QUESTION ${i + 1}</span>
            <h3>${escapeHtml(q.question)}</h3>
            ${q.options
              .map(
                (option) => `
              <label style="display:block;margin:12px 0;">
                <input type="radio" name="q_${q.id}" value="${escapeAttr(option)}" required>
                ${escapeHtml(option)}
              </label>
            `
              )
              .join("")}
          </article>
        `
          )
          .join("")}

        <button class="main-btn" type="submit">Submit Quiz</button>
        <p id="quizResult"></p>
      </form>
    `;

    document.getElementById("quizForm").addEventListener("submit", async (event) => {
      event.preventDefault();

      const answers = {};

      questions.forEach((q) => {
        const selected = document.querySelector(`input[name="q_${q.id}"]:checked`);

        if (selected) {
          answers[q.id] = selected.value;
        }
      });

      try {
        const result = await api("/api/quiz/submit", {
          method: "POST",
          body: JSON.stringify({ lo, answers })
        });

        showMessage(
          document.getElementById("quizResult"),
          `Your score: ${result.score}/${result.total} (${result.percentage}%)`
        );
      } catch (error) {
        showMessage(document.getElementById("quizResult"), error.message, true);
      }
    });
  } catch (error) {
    container.innerHTML = `
      <div class="content-card">
        <h3>Error</h3>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

// =========================
// NORMAL RESOURCES
// =========================

function renderResources(container, resources) {
  if (!resources.length) {
    container.innerHTML = `
      <div class="content-card">
        <h3>No resources yet</h3>
        <p>Your Biology team can upload materials for this Learning Outcome.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = resources
    .map(
      (resource) => `
      <article class="content-card">
        <span class="card-number">${escapeHtml(resource.lo || "")}</span>
        <h3>${escapeHtml(resource.title)}</h3>
        <p>${escapeHtml(resource.description || "")}</p>
        ${
          resource.download_url
            ? `<a class="open-btn" href="${escapeAttr(resource.download_url)}">Open / Download</a>`
            : ""
        }
      </article>
    `
    )
    .join("");
}

// =========================
// VIDEO RESOURCES
// =========================

function renderVideos(container, resources) {
  if (!resources.length) {
    container.innerHTML = `
      <div class="content-card">
        <h3>No videos yet</h3>
        <p>Your Biology team can upload videos for this Learning Outcome.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = resources
    .map(
      (resource, index) => `
      <article class="content-card video-card">
        ${
          resource.download_url
            ? `
              <video class="video-player" controls preload="metadata">
                <source
                  src="${escapeAttr(
                    resource.download_url + (resource.download_url.includes("?") ? "&inline=1" : "?inline=1")
                  )}"
                  type="${escapeAttr(resource.mime_type || "video/mp4")}"
                >
                Your browser does not support video playback.
              </video>
            `
            : ""
        }
        <div class="video-info">
          <p class="video-meta">${escapeHtml(resource.lo || "")} · VIDEO ${index + 1}</p>
          <h3>${escapeHtml(resource.title)}</h3>
          <p>${escapeHtml(resource.description || "")}</p>
          ${
            resource.download_url
              ? `
                <a
                  class="open-btn"
                  href="${escapeAttr(
                    resource.download_url + (resource.download_url.includes("?") ? "&inline=1" : "?inline=1")
                  )}"
                  target="_blank"
                  rel="noopener"
                >
                  Open Video
                </a>
              `
              : ""
          }
        </div>
      </article>
    `
    )
    .join("");
}

// =========================
// SECURITY HELPERS
// =========================

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

loadLOPage();
