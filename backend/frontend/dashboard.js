// ================= DASHBOARD =================

const $ = (selector) => document.querySelector(selector);

let currentUser = null;


// ================= API HELPER =================

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}


// ================= MESSAGE =================

function showMessage(message, type = "success") {
  const box = $("#dashboardMessage");

  if (!box) return;

  box.textContent = message;
  box.className = `dashboard-message ${type}`;
  box.hidden = false;

  setTimeout(() => {
    box.hidden = true;
  }, 4000);
}


// ================= ESCAPE HTML =================

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ================= AUTH =================

async function loadCurrentUser() {
  try {
    const data = await api("/api/auth/me");

    if (!data.authenticated || !data.user) {
      window.location.href = "login.html";
      return null;
    }

    currentUser = data.user;

    if ($("#userName")) {
      $("#userName").textContent = currentUser.name || "User";
    }

    if ($("#userRole")) {
      $("#userRole").textContent = currentUser.role || "";
    }

    return currentUser;
  } catch (error) {
    console.error("Authentication error:", error);

    window.location.href = "login.html";
    return null;
  }
}


// ================= LOGOUT =================

async function logout() {
  try {
    await api("/api/auth/logout", {
      method: "POST",
    });
  } catch (error) {
    console.error("Logout error:", error);
  }

  window.location.href = "login.html";
}


// ================= LEARNING OUTCOMES =================

// Must match questions.js
const learningOutcomes = [
  "LO1",
  "LO2",
  "LO3",
  "LO4",
  "LO5",
  "LO6",
  "LO7",
];


function fillLearningOutcomes() {
  const selectors = [
    "#questionLO",
    "#questionListLO",
    "#resourceLO",
    "#resourceListLO",
  ];

  selectors.forEach((selector) => {
    const select = $(selector);

    if (!select) return;

    select.innerHTML = "";

    const allOption = document.createElement("option");

    allOption.value = "";
    allOption.textContent = "All Learning Outcomes";

    select.appendChild(allOption);

    learningOutcomes.forEach((lo) => {
      const option = document.createElement("option");

      option.value = lo;
      option.textContent = lo;

      select.appendChild(option);
    });
  });
}


// ================= LOAD STATS =================

async function loadStats() {

  // QUESTIONS
  try {
    const questions = await api(
      "/api/questions?category=quiz"
    );

    if ($("#questionCount")) {
      $("#questionCount").textContent =
        Array.isArray(questions)
          ? questions.length
          : 0;
    }

  } catch (error) {
    console.error("Questions count error:", error);

    if ($("#questionCount")) {
      $("#questionCount").textContent = "0";
    }
  }


  // RESOURCES
  try {
    const resources = await api(
      "/api/resources"
    );

    if ($("#resourceCount")) {
      $("#resourceCount").textContent =
        Array.isArray(resources)
          ? resources.length
          : 0;
    }

  } catch (error) {
    console.error("Resources count error:", error);

    if ($("#resourceCount")) {
      $("#resourceCount").textContent = "0";
    }
  }


  // EVENTS
  try {
    const events = await api(
      "/api/events"
    );

    if ($("#eventCount")) {
      $("#eventCount").textContent =
        Array.isArray(events)
          ? events.length
          : 0;
    }

  } catch (error) {
    console.error("Events count error:", error);

    if ($("#eventCount")) {
      $("#eventCount").textContent = "0";
    }
  }


  // USERS
  if (
    currentUser &&
    (currentUser.role === "admin" ||
      currentUser.role === "academic")
  ) {
    try {
      const users = await api(
        "/api/admin/users"
      );

      if ($("#userCount")) {
        $("#userCount").textContent =
          Array.isArray(users)
            ? users.length
            : 0;
      }

    } catch (error) {
      console.error("Users count error:", error);

      if ($("#userCount")) {
        $("#userCount").textContent = "0";
      }
    }
  }
}


// ================= LOAD QUESTIONS =================

async function loadQuestions() {

  const list = $("#questionsList");

  if (!list) return;

  try {

    const category =
      $("#questionListCategory")?.value ||
      "quiz";

    const lo =
      $("#questionListLO")?.value ||
      "";


    let url =
      `/api/questions?category=${encodeURIComponent(
        category
      )}`;


    if (lo) {
      url +=
        `&lo=${encodeURIComponent(lo)}`;
    }


    const questions = await api(url);


    if (
      !Array.isArray(questions) ||
      questions.length === 0
    ) {
      list.innerHTML = `
        <div class="empty-state">
          No questions found.
        </div>
      `;

      return;
    }


    list.innerHTML = questions
      .map(
        (q) => `
          <div class="item-row">

            <h4>
              ${esc(q.question)}
            </h4>

            ${
              Array.isArray(q.options) &&
              q.options.length
                ? `
                  <p>
                    <strong>Options:</strong>
                    ${q.options
                      .map(
                        (option) =>
                          `<span>${esc(option)}</span>`
                      )
                      .join(" | ")}
                  </p>
                `
                : ""
            }

            <p>
              <strong>LO:</strong>
              ${esc(q.lo)}
            </p>

            ${
              q.answer
                ? `
                  <p>
                    <strong>Answer:</strong>
                    ${esc(q.answer)}
                  </p>
                `
                : ""
            }

            ${
              q.explanation
                ? `
                  <p>
                    ${esc(q.explanation)}
                  </p>
                `
                : ""
            }

            <p>
              <button
                type="button"
                class="delete-btn"
                data-delete-question="${esc(String(q.id))}"
              >
                Delete
              </button>
            </p>

          </div>
        `
      )
      .join("");

  } catch (error) {

    console.error(
      "Questions loading error:",
      error
    );

    list.innerHTML = `
      <div class="empty-state">
        Failed to load questions.
      </div>
    `;
  }
}


// ================= ADD QUESTION =================

async function addQuestion(event) {

  event.preventDefault();


  const question =
    $("#questionText")?.value.trim() ||
    "";


  const optionsText =
    $("#questionOptions")?.value.trim() ||
    "";


  const answer =
    $("#questionAnswer")?.value.trim() ||
    "";


  const explanation =
    $("#questionExplanation")?.value.trim() ||
    "";


  const lo =
    $("#questionLO")?.value ||
    "";


  // QUESTION + ANSWER
  if (!question || !answer) {

    showMessage(
      "Question and answer are required.",
      "error"
    );

    return;
  }


  // LEARNING OUTCOME
  if (!lo) {

    showMessage(
      "Please select a Learning Outcome.",
      "error"
    );

    return;
  }


  // OPTIONS
  const options = optionsText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);


  if (options.length < 2) {

    showMessage(
      "Quiz questions need at least two options.",
      "error"
    );

    return;
  }


  try {

    await api(
      "/api/questions",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          category: "quiz",
          lo: lo,
          question: question,
          options: options,
          answer: answer,
          explanation: explanation,
        }),
      }
    );


    $("#questionForm")?.reset();


    showMessage(
      "Quiz question added successfully."
    );


    await loadQuestions();

    await loadStats();


  } catch (error) {

    console.error(
      "Add question error:",
      error
    );

    showMessage(
      error.message,
      "error"
    );
  }
}


// ================= LOAD RESOURCES =================

async function loadResources() {

  const list =
    $("#resourcesList");

  if (!list) return;


  try {

    const type =
      $("#resourceListType")?.value ||
      "";


    const lo =
      $("#resourceListLO")?.value ||
      "";


    let url =
      "/api/resources";


    const params =
      new URLSearchParams();


    if (type) {
      params.set("type", type);
    }


    if (lo) {
      params.set("lo", lo);
    }


    if (params.toString()) {

      url +=
        `?${params.toString()}`;
    }


    const resources =
      await api(url);


    if (
      !Array.isArray(resources) ||
      resources.length === 0
    ) {

      list.innerHTML = `
        <div class="empty-state">
          No resources found.
        </div>
      `;

      return;
    }


    list.innerHTML = resources
      .map(
        (r) => `
          <div class="item-row">

            <h4>
              ${esc(r.title)}
            </h4>

            <p>
              <strong>LO:</strong>
              ${esc(r.lo || "—")}
              &nbsp; | &nbsp;
              <strong>Type:</strong>
              ${esc(r.type || "—")}
            </p>

            ${
              r.description
                ? `
                  <p>
                    ${esc(r.description)}
                  </p>
                `
                : ""
            }

            ${
              r.download_url
                ? `
                  <p>
                    <a
                      href="${esc(r.download_url)}"
                      target="_blank"
                      rel="noopener"
                    >
                      Open / Download
                    </a>
                  </p>
                `
                : ""
            }

            <p>
              <button
                type="button"
                class="delete-btn"
                data-delete-resource="${esc(String(r.id))}"
              >
                Delete
              </button>
            </p>

          </div>
        `
      )
      .join("");

  } catch (error) {

    console.error(
      "Resources error:",
      error
    );

    list.innerHTML = `
      <div class="empty-state">
        Failed to load resources.
      </div>
    `;
  }
}


// ================= ADD RESOURCE =================

async function addResource(event) {

  event.preventDefault();


  const form =
    $("#resourceForm");

  if (!form) return;


  const type =
    $("#resourceType")?.value ||
    "";


  const lo =
    $("#resourceLO")?.value ||
    "";


  const title =
    $("#resourceTitle")?.value.trim() ||
    "";


  const description =
    $("#resourceDescription")?.value.trim() ||
    "";


  const fileInput =
    $("#resourceFile");


  if (!type || !lo || !title) {

    showMessage(
      "Please fill in all required fields.",
      "error"
    );

    return;
  }


  const formData =
    new FormData();


  formData.append(
    "type",
    type
  );


  formData.append(
    "lo",
    lo
  );


  formData.append(
    "title",
    title
  );


  formData.append(
    "description",
    description
  );


  if (
    fileInput &&
    fileInput.files.length > 0
  ) {

    formData.append(
      "file",
      fileInput.files[0]
    );
  }


  try {

    await api(
      "/api/resources",
      {
        method: "POST",
        body: formData,
      }
    );


    form.reset();


    showMessage(
      "Resource uploaded successfully."
    );


    await loadResources();

    await loadStats();


  } catch (error) {

    console.error(
      "Add resource error:",
      error
    );

    showMessage(
      error.message,
      "error"
    );
  }
}


// ================= LOAD EVENTS =================

async function loadEvents() {

  const list =
    $("#eventsList");

  if (!list) return;


  try {

    const events =
      await api("/api/events");


    if (
      !Array.isArray(events) ||
      events.length === 0
    ) {

      list.innerHTML = `
        <div class="empty-state">
          No events found.
        </div>
      `;

      return;
    }


    list.innerHTML = events
      .map(
        (event) => `
          <div class="item-row">

            <h4>
              ${esc(event.title)}
            </h4>

            <p>
              ${esc(event.description)}
            </p>

            <p>
              <strong>Date:</strong>
              ${formatDate(event.event_date)}
            </p>

            ${
              event.image
                ? `
                  <p>
                    <img
                      src="${esc(event.image)}"
                      alt="${esc(event.title)}"
                      style="
                        max-width:180px;
                        border-radius:10px;
                      "
                    >
                  </p>
                `
                : ""
            }

            ${
              currentUser &&
              currentUser.role === "admin"
                ? `
                  <p>
                    <button
                      type="button"
                      class="delete-btn"
                      data-delete-event="${esc(String(event.id))}"
                    >
                      Delete
                    </button>
                  </p>
                `
                : ""
            }

          </div>
        `
      )
      .join("");

  } catch (error) {

    console.error(
      "Events error:",
      error
    );

    list.innerHTML = `
      <div class="empty-state">
        Failed to load events.
      </div>
    `;
  }
}


// ================= ADD EVENT =================

async function addEvent(event) {

  event.preventDefault();


  const form =
    $("#eventForm");

  if (!form) return;


  const title =
    $("#eventTitle")?.value.trim() ||
    "";


  const description =
    $("#eventDescription")?.value.trim() ||
    "";


  const date =
    $("#eventDate")?.value ||
    "";


  const imageInput =
    $("#eventImage");


  if (
    !title ||
    !description ||
    !date
  ) {

    showMessage(
      "Please fill in all required fields.",
      "error"
    );

    return;
  }


  const formData =
    new FormData();


  formData.append(
    "title",
    title
  );


  formData.append(
    "description",
    description
  );


  formData.append(
    "event_date",
    date
  );


  if (
    imageInput &&
    imageInput.files.length > 0
  ) {

    formData.append(
      "image",
      imageInput.files[0]
    );
  }


  try {

    await api(
      "/api/events",
      {
        method: "POST",
        body: formData,
      }
    );


    form.reset();


    showMessage(
      "Event created successfully."
    );


    await loadEvents();

    await loadStats();


  } catch (error) {

    console.error(
      "Add event error:",
      error
    );

    showMessage(
      error.message,
      "error"
    );
  }
}


// ================= LOAD USERS =================

async function loadUsers() {

  const list =
    $("#usersList");

  if (!list) return;


  if (
    !currentUser ||
    currentUser.role !== "admin"
  ) {

    list.innerHTML = `
      <div class="empty-state">
        Admin access required.
      </div>
    `;

    return;
  }


  try {

    const users =
      await api(
        "/api/admin/users"
      );


    if (
      !Array.isArray(users) ||
      users.length === 0
    ) {

      list.innerHTML = `
        <div class="empty-state">
          No registered users.
        </div>
      `;

      return;
    }


    list.innerHTML = users
      .map(
        (user) => `
          <div class="item-row">

            <h4>
              ${esc(user.name)}
            </h4>

            <p>
              <strong>Email:</strong>
              ${esc(user.email)}
            </p>

            <p>
              <strong>Grade:</strong>
              ${esc(user.grade || "—")}
            </p>

            <p>
              <strong>School:</strong>
              ${esc(user.school || "—")}
            </p>

            <label>

              <strong>Role:</strong>

              <select
                class="user-role-select"
                data-user-id="${esc(user.id)}"
              >

                <option
                  value="student"
                  ${
                    user.role === "student"
                      ? "selected"
                      : ""
                  }
                >
                  Student
                </option>

                <option
                  value="academic"
                  ${
                    user.role === "academic"
                      ? "selected"
                      : ""
                  }
                >
                  Academic
                </option>

                <option
                  value="admin"
                  ${
                    user.role === "admin"
                      ? "selected"
                      : ""
                  }
                >
                  Admin
                </option>

              </select>

            </label>

          </div>
        `
      )
      .join("");


    document
      .querySelectorAll(
        ".user-role-select"
      )
      .forEach((select) => {

        select.addEventListener(
          "change",
          changeUserRole
        );

      });


  } catch (error) {

    console.error(
      "Users error:",
      error
    );

    list.innerHTML = `
      <div class="empty-state">
        Failed to load users.
      </div>
    `;
  }
}


// ================= CHANGE USER ROLE =================

async function changeUserRole(event) {

  const select =
    event.target;


  const userId =
    select.dataset.userId;


  const role =
    select.value;


  if (!userId || !role) return;


  try {

    await api(
      `/api/admin/users/${userId}/role`,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          role: role,
        }),
      }
    );


    showMessage(
      "User role updated successfully."
    );


    await loadUsers();


  } catch (error) {

    console.error(
      "Role update error:",
      error
    );

    showMessage(
      error.message,
      "error"
    );


    await loadUsers();
  }
}


// ================= STUDENT RESULTS =================

async function loadResults() {

  const list =
    $("#resultsList");

  if (!list) return;


  if (
    !currentUser ||
    (currentUser.role !== "admin" &&
      currentUser.role !== "academic")
  ) {

    list.innerHTML = `
      <tr>
        <td colspan="6">
          Admin or academic access required.
        </td>
      </tr>
    `;

    return;
  }


  try {

    const results =
      await api(
        "/api/admin/users/results"
      );


    if (
      !Array.isArray(results) ||
      results.length === 0
    ) {

      list.innerHTML = `
        <tr>
          <td colspan="6">
            No student results yet.
          </td>
        </tr>
      `;

      return;
    }


    list.innerHTML = results
      .map(
        (result) => `
          <tr>

            <td>
              ${esc(
                result.studentName ||
                "—"
              )}
            </td>

            <td>
              ${esc(
                result.email ||
                "—"
              )}
            </td>

            <td>
              ${esc(
                result.quizName ||
                "—"
              )}
            </td>

            <td>
              ${esc(
                result.score ??
                "—"
              )}
              /
              ${esc(
                result.total ??
                "—"
              )}
            </td>

            <td>
              ${esc(
                result.percentage ??
                0
              )}%
            </td>

            <td>
              ${formatDate(
                result.date
              )}
            </td>

          </tr>
        `
      )
      .join("");


  } catch (error) {

    console.error(
      "Results error:",
      error
    );

    list.innerHTML = `
      <tr>
        <td colspan="6">
          Failed to load student results.
        </td>
      </tr>
    `;
  }
}


// ================= DATE =================

function formatDate(date) {

  if (!date) return "—";


  const parsed =
    new Date(date);


  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {

    return esc(date);
  }


  return parsed.toLocaleString();
}


// ================= ACCESS CONTROL =================

function setupAccess() {

  const isAdmin =
    currentUser &&
    currentUser.role === "admin";


  const isAcademic =
    currentUser &&
    currentUser.role === "academic";


  const questionSection =
    $("#questionSection");


  const resourceSection =
    $("#resourceSection");


  const eventSection =
    $("#eventSection");


  const userSection =
    $("#userSection");


  const resultsSection =
    $("#resultsSection");


  // Managing user roles stays admin-only (sensitive action).
  if (userSection) {
    userSection.hidden = !isAdmin;
  }

  // Quiz results are visible to admin AND the academic team,
  // matching the backend permission on /api/admin/users/results.
  if (resultsSection) {
    resultsSection.hidden = !(isAdmin || isAcademic);
  }


  // STUDENT ACCESS
  if (
    currentUser &&
    currentUser.role === "student"
  ) {

    if (questionSection) {
      questionSection.hidden = true;
    }

    if (resourceSection) {
      resourceSection.hidden = true;
    }

    if (eventSection) {
      eventSection.hidden = true;
    }
  }
}


// ================= EVENT LISTENERS =================

function setupEventListeners() {

  $("#logoutBtn")
    ?.addEventListener(
      "click",
      logout
    );


  $("#questionForm")
    ?.addEventListener(
      "submit",
      addQuestion
    );


  $("#resourceForm")
    ?.addEventListener(
      "submit",
      addResource
    );


  $("#eventForm")
    ?.addEventListener(
      "submit",
      addEvent
    );


  $("#refreshQuestions")
    ?.addEventListener(
      "click",
      loadQuestions
    );


  $("#refreshResources")
    ?.addEventListener(
      "click",
      loadResources
    );


  $("#refreshEvents")
    ?.addEventListener(
      "click",
      loadEvents
    );


  $("#refreshUsers")
    ?.addEventListener(
      "click",
      loadUsers
    );


  $("#refreshResults")
    ?.addEventListener(
      "click",
      loadResults
    );


  $("#questionListCategory")
    ?.addEventListener(
      "change",
      loadQuestions
    );


  $("#questionListLO")
    ?.addEventListener(
      "change",
      loadQuestions
    );


  $("#resourceListType")
    ?.addEventListener(
      "change",
      loadResources
    );


  $("#resourceListLO")
    ?.addEventListener(
      "change",
      loadResources
    );


  // Delete buttons (questions, resources, events) are re-rendered every
  // time a list reloads, so listen on the document and match by
  // data-attribute instead of attaching one listener per button.
  document.addEventListener(
    "click",
    handleDeleteClick
  );
}


async function handleDeleteClick(event) {

  const questionId =
    event.target?.dataset?.deleteQuestion;

  const resourceId =
    event.target?.dataset?.deleteResource;

  const eventId =
    event.target?.dataset?.deleteEvent;

  if (questionId) {

    if (!confirm("Delete this question? This cannot be undone.")) return;

    try {
      await api(`/api/questions/${questionId}`, { method: "DELETE" });
      await loadQuestions();
      await loadStats();
    } catch (error) {
      alert(error.message || "Could not delete this question.");
    }

  } else if (resourceId) {

    if (!confirm("Delete this resource? This cannot be undone.")) return;

    try {
      await api(`/api/resources/${resourceId}`, { method: "DELETE" });
      await loadResources();
      await loadStats();
    } catch (error) {
      alert(error.message || "Could not delete this resource.");
    }

  } else if (eventId) {

    if (!confirm("Delete this event? This cannot be undone.")) return;

    try {
      await api(`/api/events/${eventId}`, { method: "DELETE" });
      await loadEvents();
      await loadStats();
    } catch (error) {
      alert(error.message || "Could not delete this event.");
    }
  }
}


// ================= START DASHBOARD =================

async function initDashboard() {

  const user =
    await loadCurrentUser();


  if (!user) return;


  fillLearningOutcomes();

  setupAccess();

  setupEventListeners();


  await loadStats();


  if (
    user.role === "admin" ||
    user.role === "academic"
  ) {

    await loadQuestions();

    await loadResources();

    await loadEvents();
  }


  if (user.role === "admin") {

    await loadUsers();
  }

  if (
    user.role === "admin" ||
    user.role === "academic"
  ) {

    await loadResults();
  }
}


// ================= INITIALIZE =================

document.addEventListener(
  "DOMContentLoaded",
  initDashboard
);
