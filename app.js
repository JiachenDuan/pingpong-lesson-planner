const storageKey = "pingpongLessonPlanner.v1";

const seedState = {
  children: [{ id: "child-kyson", name: "Kyson" }],
  coaches: [
    { id: "coach-tian", name: "田教练", rate: 130, rateMode: "hour", defaultMinutes: 60, color: "#176b87" },
    { id: "coach-eric", name: "Eric教练", rate: 90, rateMode: "hour", defaultMinutes: 60, color: "#3f7d58" },
  ],
  lessons: [],
  settings: {
    lastSettlementDate: "",
    nextSettlementDate: endOfMonth(new Date().toISOString().slice(0, 7)),
  },
};

let state = loadState();
let selectedMonth = new Date().toISOString().slice(0, 7);
let filters = { childId: "all", coachId: "all" };

const $ = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
const dateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", { month: "short", day: "numeric", weekday: "short" });
const shortDateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.children && saved?.coaches && saved?.lessons) {
      const migrated = migrateStarterData(saved);
      if (migrated.changed) localStorage.setItem(storageKey, JSON.stringify(migrated.state));
      return migrated.state;
    }
  } catch {
    localStorage.removeItem(storageKey);
  }
  return seedState;
}

function migrateStarterData(saved) {
  const next = structuredClone(saved);
  let changed = false;

  if (!next.settings) {
    changed = true;
    next.settings = structuredClone(seedState.settings);
  }
  if (!("lastSettlementDate" in next.settings)) {
    changed = true;
    next.settings.lastSettlementDate = "";
  }
  if (!next.settings.nextSettlementDate) {
    changed = true;
    next.settings.nextSettlementDate = endOfMonth(new Date().toISOString().slice(0, 7));
  }
  if ("monthlyBudget" in next.settings || "targetLessons" in next.settings) {
    changed = true;
    delete next.settings.monthlyBudget;
    delete next.settings.targetLessons;
  }

  next.children = next.children.map((child) => {
    if (child.name !== "孩子") return child;
    changed = true;
    return { ...child, name: "Kyson" };
  });

  next.coaches = next.coaches.map((coach) => {
    if (coach.name === "主教练") {
      changed = true;
      return { ...coach, name: "田教练", rate: 130, rateMode: "hour", defaultMinutes: 60, color: "#176b87" };
    }
    if (coach.name === "陪练") {
      changed = true;
      return { ...coach, name: "Eric教练", rate: 90, rateMode: "hour", defaultMinutes: 60, color: "#3f7d58" };
    }
    return coach;
  });

  if (!next.children.length) {
    changed = true;
    next.children.push(...seedState.children);
  }
  if (!next.coaches.length) {
    changed = true;
    next.coaches.push(...seedState.coaches);
  }
  return { state: next, changed };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function lessonCost(lesson) {
  const coach = state.coaches.find((item) => item.id === lesson.coachId);
  if (!coach) return 0;
  return coach.rateMode === "session" ? Number(coach.rate) : (Number(coach.rate) * Number(lesson.minutes)) / 60;
}

function monthLessons() {
  return state.lessons
    .filter((lesson) => lesson.date.startsWith(selectedMonth))
    .filter((lesson) => filters.childId === "all" || lesson.childId === filters.childId)
    .filter((lesson) => filters.coachId === "all" || lesson.coachId === filters.coachId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function settlementLessons() {
  const lastDate = state.settings.lastSettlementDate;
  const nextDate = state.settings.nextSettlementDate || endOfMonth(selectedMonth);
  return state.lessons
    .filter((lesson) => (!lastDate || lesson.date > lastDate) && lesson.date <= nextDate)
    .filter((lesson) => filters.childId === "all" || lesson.childId === filters.childId)
    .filter((lesson) => filters.coachId === "all" || lesson.coachId === filters.coachId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderSelects() {
  const childOptions = state.children.map((child) => `<option value="${child.id}">${escapeHtml(child.name)}</option>`).join("");
  const coachOptions = state.coaches.map((coach) => `<option value="${coach.id}">${escapeHtml(coach.name)}</option>`).join("");
  const hasMultipleChildren = state.children.length > 1;

  $("lessonChild").innerHTML = childOptions;
  $("lessonCoach").innerHTML = coachOptions;
  $("childFilter").innerHTML = `<option value="all">所有孩子</option>${childOptions}`;
  $("coachFilter").innerHTML = `<option value="all">所有教练</option>${coachOptions}`;
  $("lessonChildField").classList.toggle("is-hidden", !hasMultipleChildren);
  $("childFilter").classList.toggle("is-hidden", !hasMultipleChildren);
  $("childFilter").value = filters.childId;
  $("coachFilter").value = filters.coachId;

  const selectedCoach = state.coaches.find((coach) => coach.id === $("lessonCoach").value) || state.coaches[0];
  if (selectedCoach && !$("lessonMinutes").value) $("lessonMinutes").value = selectedCoach.defaultMinutes;
}

function renderSummary() {
  const lessons = monthLessons();
  const totalMinutes = lessons.reduce((sum, lesson) => sum + Number(lesson.minutes), 0);
  const totalSpend = lessons.reduce((sum, lesson) => sum + lessonCost(lesson), 0);

  $("monthLessonCount").textContent = lessons.length;
  $("monthHours").textContent = `${(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)}h`;
  $("monthSpend").textContent = money(totalSpend);
}

function renderSettlement() {
  if (!$("lastSettlementDate")) return;

  if (!state.settings.nextSettlementDate) {
    state.settings.nextSettlementDate = endOfMonth(selectedMonth);
  }

  const lessons = settlementLessons();
  const totalMinutes = lessons.reduce((sum, lesson) => sum + Number(lesson.minutes), 0);
  const totalSpend = lessons.reduce((sum, lesson) => sum + lessonCost(lesson), 0);
  const lastDate = state.settings.lastSettlementDate;
  const nextDate = state.settings.nextSettlementDate;

  $("lastSettlementDate").value = lastDate;
  $("nextSettlementDate").value = nextDate;
  $("settlementRange").textContent = lastDate ? `${shortDateLabel(lastDate)} 后 - ${shortDateLabel(nextDate)}` : `首次结算 - ${shortDateLabel(nextDate)}`;
  $("settlementLessonCount").textContent = lessons.length;
  $("settlementHours").textContent = `${(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)}h`;
  $("settlementSpend").textContent = money(totalSpend);
}

function renderLessons() {
  const lessons = monthLessons();
  $("lessonList").innerHTML = lessons.length
    ? lessons
        .map((lesson) => {
          const child = state.children.find((item) => item.id === lesson.childId);
          const coach = state.coaches.find((item) => item.id === lesson.coachId);
          return `
            <div class="lesson-row">
              <span class="tag">${dateLabel(lesson.date)}</span>
              <div class="lesson-main">
                <strong>${escapeHtml(child?.name || "已删除孩子")}</strong>
                <span class="muted">${escapeHtml(lesson.note || "无备注")}</span>
              </div>
              <span>${escapeHtml(coach?.name || "已删除教练")}</span>
              <span>${lesson.minutes} 分钟</span>
              <span class="money">${money(lessonCost(lesson))}</span>
              <button class="delete-button" data-delete-lesson="${lesson.id}" title="删除">×</button>
            </div>
          `;
        })
        .join("")
    : emptyHtml();
}

function render() {
  $("monthPicker").value = selectedMonth;
  renderSelects();
  renderSummary();
  renderSettlement();
  renderLessons();
}

function addLesson(event) {
  event.preventDefault();
  state.lessons.push({
    id: crypto.randomUUID(),
    date: $("lessonDate").value,
    childId: $("lessonChild").value,
    coachId: $("lessonCoach").value,
    minutes: Number($("lessonMinutes").value),
    note: $("lessonNote").value.trim(),
  });
  $("lessonNote").value = "";
  saveState();
  render();
}

function deleteBy(type, id) {
  if (type === "lesson") state.lessons = state.lessons.filter((item) => item.id !== id);
  saveState();
  render();
}

function exportJson() {
  download(`pingpong-lessons-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json");
}

function exportCsv() {
  const rows = [["date", "child", "coach", "minutes", "cost", "note"]];
  monthLessons().forEach((lesson) => {
    rows.push([
      lesson.date,
      state.children.find((child) => child.id === lesson.childId)?.name || "",
      state.coaches.find((coach) => coach.id === lesson.coachId)?.name || "",
      lesson.minutes,
      lessonCost(lesson).toFixed(2),
      lesson.note || "",
    ]);
  });
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  download(`pingpong-lessons-${selectedMonth}.csv`, csv, "text/csv");
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function emptyHtml() {
  return $("emptyTemplate").innerHTML;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function shiftMonth(delta) {
  const [year, month] = selectedMonth.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  selectedMonth = date.toISOString().slice(0, 7);
  render();
}

function endOfMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).toISOString().slice(0, 10);
}

function bindEvents() {
  $("lessonDate").value = new Date().toISOString().slice(0, 10);
  $("monthPicker").addEventListener("change", (event) => {
    selectedMonth = event.target.value;
    render();
  });
  $("prevMonthBtn").addEventListener("click", () => shiftMonth(-1));
  $("nextMonthBtn").addEventListener("click", () => shiftMonth(1));
  $("lessonForm").addEventListener("submit", addLesson);
  $("lessonCoach").addEventListener("change", () => {
    const coach = state.coaches.find((item) => item.id === $("lessonCoach").value);
    if (coach) $("lessonMinutes").value = coach.defaultMinutes;
  });
  $("saveSettlementBtn").addEventListener("click", () => {
    const lastDate = $("lastSettlementDate").value;
    const nextDate = $("nextSettlementDate").value;
    if (lastDate && nextDate && lastDate >= nextDate) return alert("下次结算日必须晚于上次结算日。");
    state.settings.lastSettlementDate = lastDate;
    state.settings.nextSettlementDate = nextDate || endOfMonth(selectedMonth);
    saveState();
    render();
  });
  $("markSettledBtn").addEventListener("click", () => {
    const nextDate = state.settings.nextSettlementDate || endOfMonth(selectedMonth);
    state.settings.lastSettlementDate = nextDate;
    state.settings.nextSettlementDate = endOfMonth(nextDate.slice(0, 7));
    if (state.settings.nextSettlementDate <= nextDate) {
      const [year, month] = nextDate.slice(0, 7).split("-").map(Number);
      state.settings.nextSettlementDate = endOfMonth(new Date(year, month, 1).toISOString().slice(0, 7));
    }
    saveState();
    render();
  });
  $("childFilter").addEventListener("change", (event) => {
    filters.childId = event.target.value;
    render();
  });
  $("coachFilter").addEventListener("change", (event) => {
    filters.coachId = event.target.value;
    render();
  });
  $("exportJsonBtn").addEventListener("click", exportJson);
  $("csvBtn").addEventListener("click", exportCsv);
  $("importJsonInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const imported = JSON.parse(await file.text());
    if (!imported.children || !imported.coaches || !imported.lessons) return alert("这个 JSON 不是有效备份。");
    state = migrateStarterData(imported).state;
    saveState();
    render();
  });
  $("resetBtn").addEventListener("click", () => {
    if (!confirm("确定清空这台设备上的所有课程数据？")) return;
    localStorage.removeItem(storageKey);
    state = structuredClone(seedState);
    saveState();
    render();
  });
  document.body.addEventListener("click", (event) => {
    const lessonId = event.target.dataset.deleteLesson;
    if (lessonId) deleteBy("lesson", lessonId);
  });
}

bindEvents();
render();
