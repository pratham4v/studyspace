(() => {
  "use strict";

  const STORAGE_KEY = "studyspace-tracker-v1";
  const THEME_KEY = "studyspace-theme-v2";
  const DEFAULT_DAILY_GOAL = 6;
  const CHECKLIST_ITEMS = [
    ["question-practice", "Question practice"],
    ["target-theory", "Today's target theory"],
    ["mock", "Mock"],
    ["review-mistakes", "Review mock mistakes"]
  ];

  const $ = (selector) => document.querySelector(selector);
  const dateKey = (date = new Date()) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };
  const readData = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && Array.isArray(stored.sessions) && Array.isArray(stored.mocks) && stored.checklist) {
        return {
          ...stored,
          dailyGoal: Number.isFinite(Number(stored.dailyGoal)) && Number(stored.dailyGoal) >= 0.5 ? Number(stored.dailyGoal) : DEFAULT_DAILY_GOAL
        };
      }
    } catch (_) { /* Start with a clean tracker if storage is unavailable or malformed. */ }
    return { sessions: [], mocks: [], checklist: {}, dailyGoal: DEFAULT_DAILY_GOAL };
  };
  let data = readData();
  let darkMode = true;
  try {
    darkMode = localStorage.getItem(THEME_KEY) !== "light";
  } catch (_) { /* Keep dark mode as the default when storage is unavailable. */ }
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (_) {
      alert("Your browser couldn't save this update. Check that local storage is enabled.");
      return false;
    }
  };
  const formatDate = (key, options = { month: "short", day: "numeric" }) =>
    new Date(`${key}T12:00:00`).toLocaleDateString(undefined, options);
  const sessionsFor = (key) => data.sessions.filter((item) => item.date === key);
  const hoursFor = (key) => sessionsFor(key).reduce((total, item) => total + Number(item.hours), 0);
  const tidyHours = (hours) => Number(hours.toFixed(2)).toString();
  const durationLabel = (minutes) => {
    const wholeMinutes = Math.max(0, Math.round(minutes));
    const hours = Math.floor(wholeMinutes / 60);
    const remainder = wholeMinutes % 60;
    if (!hours) return `${remainder} mins`;
    return remainder ? `${hours} hr ${remainder} mins` : `${hours} hr`;
  };
  const formatTime = (value) => {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) return "—";
    const [hour, minute] = value.split(":").map(Number);
    return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[char]);

  function renderHeader() {
    const today = dateKey();
    $("#today-label").textContent = new Date().toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric", year: "numeric"
    });
    const studyDays = new Set(data.sessions.map((item) => item.date));
    let streak = 0;
    const cursor = new Date();
    while (studyDays.has(dateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    $("#streak-count").textContent = `${streak} day${streak === 1 ? "" : "s"} streak`;
  }

  function applyTheme() {
    document.body.classList.toggle("dark-mode", darkMode);
    $("#theme-toggle").setAttribute("aria-pressed", String(darkMode));
    $("#theme-icon").textContent = darkMode ? "☀" : "☾";
    $("#theme-label").textContent = darkMode ? "Light mode" : "Dark mode";
  }

  function renderStats() {
    const today = dateKey();
    const hours = hoursFor(today);
    const progress = Math.min(1, hours / data.dailyGoal);
    $("#today-hours").textContent = tidyHours(hours);
    $("#today-sessions").textContent = sessionsFor(today).length;
    const todaySessions = sessionsFor(today).slice().sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    $("#today-work").innerHTML = todaySessions.length ? todaySessions.map((item) => {
      const topic = escapeHtml(item.topic || item.subject || "Study session");
      const minutes = item.durationMinutes || Math.round(Number(item.hours) * 60);
      return `<div class="today-work-item"><strong>${topic}</strong><span>Started at ${item.startTime ? formatTime(item.startTime) : "—"} · ${durationLabel(minutes)}</span></div>`;
    }).join("") : '<p class="today-work-empty">Nothing logged yet today.</p>';
    $("#goal-percent").textContent = `${Math.round(progress * 100)}%`;
    $("#goal-ring-progress").style.strokeDashoffset = `${String(2 * Math.PI * 36 * (1 - progress))}`;
    $("#goal-ring").setAttribute("aria-label", `${Math.round(progress * 100)} percent of ${tidyHours(data.dailyGoal)} hour daily study goal complete`);
    $("#daily-goal-input").value = tidyHours(data.dailyGoal);
  }

  function renderChart() {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - 6 + index);
      const key = dateKey(date);
      return { key, date, hours: hoursFor(key) };
    });
    const total = days.reduce((sum, day) => sum + day.hours, 0);
    $("#week-hours").textContent = `${tidyHours(total)}h`;
    $("#week-days").textContent = `${days.filter((day) => day.hours > 0).length} days studied this week`;
    $("#weekly-chart").innerHTML = days.map(({ key, date, hours }) => {
      const pct = Math.min(100, hours / data.dailyGoal * 100);
      const label = date.toLocaleDateString(undefined, { weekday: "short" });
      const classes = `chart-bar${key === dateKey() ? " today" : ""}${hours > data.dailyGoal ? " over-goal" : ""}`;
      return `<div class="chart-day" title="${formatDate(key, { weekday: "long", month: "long", day: "numeric" })}: ${tidyHours(hours)} hours">
        <div class="bar-area"><span class="bar-value">${hours ? tidyHours(hours) : ""}</span><div class="${classes}" style="height:${Math.max(hours ? 4 : 0, pct)}%"></div></div>
        <span class="day-label${key === dateKey() ? " today" : ""}">${label}</span>
      </div>`;
    }).join("");
    document.querySelector(".chart-foot b").textContent = `${tidyHours(data.dailyGoal)} hours`;
  }

  function renderChecklist() {
    const today = dateKey();
    const checked = data.checklist[today] || {};
    const customTasks = Array.isArray(checked._customTasks) ? checked._customTasks : [];
    const allItems = [...CHECKLIST_ITEMS, ...customTasks.map((task) => [task.id, task.text])];
    const doneCount = allItems.filter(([id]) => checked[id]).length;
    $("#check-count").textContent = `${doneCount}/${allItems.length}`;
    $("#checklist-message").textContent = doneCount === allItems.length
      ? "Amazing work — you showed up for yourself today!"
      : doneCount ? "Nice work. Keep that momentum going!" : "You've got a fresh start. Make it count!";
    $("#checklist").innerHTML = allItems.map(([id, label]) => `
      <label class="check-item${checked[id] ? " done" : ""}">
        <input type="checkbox" data-goal="${escapeHtml(id)}" ${checked[id] ? "checked" : ""}>
        <span>${escapeHtml(label)}</span>
      </label>`).join("");
  }

  function render() {
    renderHeader();
    renderStats();
    renderChart();
    renderChecklist();
  }

  $("#study-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const topic = $("#study-topic").value.trim();
    const startTime = $("#start-time").value;
    const minutes = Number($("#duration-minutes").value);
    if (!topic || !startTime || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return;
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const endClock = new Date(2000, 0, 1, startHour, startMinute + minutes);
    const endTime = `${String(endClock.getHours()).padStart(2, "0")}:${String(endClock.getMinutes()).padStart(2, "0")}`;
    data.sessions.push({
      topic, subject: topic, hours: minutes / 60, durationMinutes: minutes,
      startTime, endTime, date: dateKey(), createdAt: new Date().toISOString()
    });
    if (save()) {
      $("#study-topic").value = "";
      $("#study-feedback").textContent = "Session saved. Nice work!";
      render();
      $("#study-topic").focus();
      setTimeout(() => { $("#study-feedback").textContent = ""; }, 2500);
    }
  });

  $("#save-goal").addEventListener("click", () => {
    const goal = Number($("#daily-goal-input").value);
    if (!Number.isFinite(goal) || goal < 0.5 || goal > 24) {
      $("#daily-goal-input").setCustomValidity("Choose a goal from 0.5 to 24 hours.");
      $("#daily-goal-input").reportValidity();
      return;
    }
    $("#daily-goal-input").setCustomValidity("");
    data.dailyGoal = goal;
    if (save()) render();
  });

  $("#daily-goal-input").addEventListener("input", (event) => event.target.setCustomValidity(""));

  $("#theme-toggle").addEventListener("click", () => {
    darkMode = !darkMode;
    try { localStorage.setItem(THEME_KEY, darkMode ? "dark" : "light"); } catch (_) { /* Theme remains active until reload. */ }
    applyTheme();
  });

  const resetDialog = $("#reset-dialog");
  $("#reset-open").addEventListener("click", () => resetDialog.showModal());
  $("#reset-no").addEventListener("click", () => resetDialog.close());
  $("#reset-yes").addEventListener("click", () => {
    data = { sessions: [], mocks: [], checklist: {}, dailyGoal: DEFAULT_DAILY_GOAL };
    darkMode = true;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(THEME_KEY);
    } catch (_) { /* Clear the active view even if browser storage is unavailable. */ }
    resetDialog.close();
    applyTheme();
    setDefaultSessionTimes();
    render();
  });

  $("#checklist").addEventListener("change", (event) => {
    const id = event.target.dataset.goal;
    if (!id) return;
    const today = dateKey();
    data.checklist[today] ||= {};
    data.checklist[today][id] = event.target.checked;
    if (save()) renderChecklist();
  });

  $("#add-task-toggle").addEventListener("click", () => {
    const form = $("#custom-task-form");
    form.hidden = !form.hidden;
    if (!form.hidden) $("#custom-task-input").focus();
  });

  $("#custom-task-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = $("#custom-task-input").value.trim();
    if (!text) return;
    const today = dateKey();
    data.checklist[today] ||= {};
    data.checklist[today]._customTasks ||= [];
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    data.checklist[today]._customTasks.push({ id, text });
    data.checklist[today][id] = false;
    if (save()) {
      $("#custom-task-input").value = "";
      $("#custom-task-form").hidden = true;
      renderChecklist();
    }
  });

  function setDefaultSessionTimes() {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);
    $("#start-time").value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    $("#duration-minutes").value = 60;
  }

  applyTheme();
  setDefaultSessionTimes();
  render();
})();
