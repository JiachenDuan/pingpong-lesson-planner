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
    nextSettlementDate: endOfMonth(localMonthKey()),
  },
};

let state = loadState();
let selectedMonth = localMonthKey();
let selectedModalDate = "";
let editingLessonId = "";

const $ = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
const monthTitle = (month) => new Date(`${month}-01T12:00:00`).toLocaleDateString("zh-CN", { year: "numeric", month: "long" });
const shortDateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
const fullDateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });

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
    next.settings.nextSettlementDate = endOfMonth(localMonthKey());
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
    .sort((a, b) => a.date.localeCompare(b.date));
}

function settlementLessons() {
  const lastDate = state.settings.lastSettlementDate;
  const nextDate = state.settings.nextSettlementDate || endOfMonth(selectedMonth);
  return state.lessons
    .filter((lesson) => (!lastDate || lesson.date > lastDate) && lesson.date <= nextDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function renderSelects() {
  const childOptions = state.children.map((child) => `<option value="${child.id}">${escapeHtml(child.name)}</option>`).join("");
  const coachOptions = state.coaches.map((coach) => `<option value="${coach.id}">${escapeHtml(coach.name)}</option>`).join("");
  const hasMultipleChildren = state.children.length > 1;

  $("lessonChild").innerHTML = childOptions;
  $("lessonCoach").innerHTML = coachOptions;
  $("lessonChildField").classList.toggle("is-hidden", !hasMultipleChildren);

  const selectedCoach = state.coaches.find((coach) => coach.id === $("lessonCoach").value) || state.coaches[0];
  if (selectedCoach && !$("lessonMinutes").value) $("lessonMinutes").value = selectedCoach.defaultMinutes;
}

function renderSummary() {
  const lessons = monthLessons();
  const totalMinutes = lessons.reduce((sum, lesson) => sum + Number(lesson.minutes), 0);

  $("monthLessonCount").textContent = `${lessons.length} 节`;
  $("monthHours").textContent = formatHours(totalMinutes);
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

function renderCalendar() {
  const lessons = monthLessons();
  const settlement = settlementLessons();
  const monthSpend = lessons.reduce((sum, lesson) => sum + lessonCost(lesson), 0);
  const settlementSpend = settlement.reduce((sum, lesson) => sum + lessonCost(lesson), 0);
  const settlementMinutes = settlement.reduce((sum, lesson) => sum + Number(lesson.minutes), 0);
  const lessonsByDate = lessons.reduce((map, lesson) => {
    if (!map.has(lesson.date)) map.set(lesson.date, []);
    map.get(lesson.date).push(lesson);
    return map;
  }, new Map());
  const [year, month] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const leadingBlanks = (firstWeekday + 6) % 7;
  const today = localDateKey();
  const cells = [];

  $("calendarTitleMonth").textContent = monthTitle(selectedMonth);
  $("calendarMonthSpend").textContent = money(monthSpend);
  $("calendarSettlementSpend").textContent = money(settlementSpend);
  $("calendarSettlementCount").textContent = `${settlement.length} 节`;
  $("calendarSettlementHours").textContent = formatHours(settlementMinutes);

  for (let index = 0; index < leadingBlanks; index += 1) {
    cells.push('<div class="calendar-day calendar-day-empty"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    const dayLessons = lessonsByDate.get(date) || [];
    const daySpend = dayLessons.reduce((sum, lesson) => sum + lessonCost(lesson), 0);
    const lessonItems = dayLessons
      .map((lesson) => {
        const coach = state.coaches.find((item) => item.id === lesson.coachId);
        return `
          <div class="calendar-lesson">
            <span>${escapeHtml(coach?.name || "已删除教练")} · ${lesson.minutes}m</span>
          </div>
        `;
      })
      .join("");

    cells.push(`
      <div class="calendar-day ${date === today ? "is-today" : ""} ${dayLessons.length ? "has-lessons" : ""}" data-open-date="${date}" role="button" tabindex="0">
        <div class="calendar-day-top">
          <span>${day}</span>
          ${daySpend ? `<strong>${money(daySpend)}</strong>` : ""}
        </div>
        ${lessonItems ? `<div class="calendar-lessons">${lessonItems}</div>` : ""}
      </div>
    `);
  }

  $("calendarGrid").innerHTML = cells.join("");
}

function renderDayModal() {
  if (!selectedModalDate) return;

  const lessons = state.lessons
    .filter((lesson) => lesson.date === selectedModalDate)
    .sort((a, b) => a.coachId.localeCompare(b.coachId));
  const totalMinutes = lessons.reduce((sum, lesson) => sum + Number(lesson.minutes), 0);
  const totalSpend = lessons.reduce((sum, lesson) => sum + lessonCost(lesson), 0);

  $("dayModalTitle").textContent = fullDateLabel(selectedModalDate);
  $("dayModalSummary").textContent = `${lessons.length} 节课 · ${(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)}h · ${money(totalSpend)}`;
  $("dayModalLessons").innerHTML = lessons.length
    ? lessons.map((lesson) => (editingLessonId === lesson.id ? editLessonHtml(lesson) : lessonDetailHtml(lesson))).join("")
    : '<div class="modal-empty">这天还没有课程。</div>';
}

function lessonDetailHtml(lesson) {
  const coach = state.coaches.find((item) => item.id === lesson.coachId);
  return `
    <div class="modal-lesson">
      <div>
        <strong>${escapeHtml(coach?.name || "已删除教练")}</strong>
        <span>${lesson.minutes} 分钟 · ${money(lessonCost(lesson))}</span>
        ${lesson.note ? `<p>${escapeHtml(lesson.note)}</p>` : ""}
      </div>
      <div class="modal-lesson-actions">
        <button class="secondary-button" data-edit-lesson="${lesson.id}" type="button">编辑</button>
        <button class="secondary-button danger-text" data-modal-delete-lesson="${lesson.id}" type="button">删除</button>
      </div>
    </div>
  `;
}

function editLessonHtml(lesson) {
  const coachOptions = state.coaches
    .map((coach) => `<option value="${coach.id}" ${coach.id === lesson.coachId ? "selected" : ""}>${escapeHtml(coach.name)}</option>`)
    .join("");
  return `
    <form class="modal-edit-form" data-edit-form="${lesson.id}">
      <label>
        教练
        <select name="coachId" required>${coachOptions}</select>
      </label>
      <label>
        分钟
        <input name="minutes" type="number" min="15" step="5" value="${lesson.minutes}" required />
      </label>
      <label>
        备注
        <input name="note" type="text" value="${escapeHtml(lesson.note || "")}" />
      </label>
      <div class="modal-edit-actions">
        <button class="primary-button" type="submit">保存</button>
        <button class="secondary-button" data-cancel-edit type="button">取消</button>
      </div>
    </form>
  `;
}

function openDayModal(date) {
  selectedModalDate = date;
  editingLessonId = "";
  renderDayModal();
  $("dayModal").classList.remove("is-hidden");
}

function closeDayModal() {
  selectedModalDate = "";
  editingLessonId = "";
  $("dayModal").classList.add("is-hidden");
}

function render() {
  $("monthPicker").value = selectedMonth;
  renderSelects();
  renderSummary();
  renderSettlement();
  renderCalendar();
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
  renderDayModal();
}

function exportJson() {
  download(`pingpong-lessons-${localDateKey()}.json`, JSON.stringify(state, null, 2), "application/json");
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function formatHours(minutes) {
  return `${(minutes / 60).toFixed(minutes % 60 ? 1 : 0)}h`;
}

function shiftMonth(delta) {
  const [year, month] = selectedMonth.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  selectedMonth = localMonthKey(date);
  render();
}

function endOfMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year}-${pad2(monthNumber)}-${pad2(new Date(year, monthNumber, 0).getDate())}`;
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function localMonthKey(date = new Date()) {
  return localDateKey(date).slice(0, 7);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function bindEvents() {
  $("lessonDate").value = localDateKey();
  $("monthPicker").addEventListener("change", (event) => {
    selectedMonth = event.target.value;
    render();
  });
  $("prevMonthBtn").addEventListener("click", () => shiftMonth(-1));
  $("nextMonthBtn").addEventListener("click", () => shiftMonth(1));
  $("calendarGrid").addEventListener("keydown", (event) => {
    const dayButton = event.target.closest("[data-open-date]");
    if (!dayButton || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    openDayModal(dayButton.dataset.openDate);
  });
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
      state.settings.nextSettlementDate = endOfMonth(localMonthKey(new Date(year, month, 1)));
    }
    saveState();
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
  $("closeDayModalBtn").addEventListener("click", closeDayModal);
  $("dayModal").addEventListener("click", (event) => {
    if (event.target.id === "dayModal") closeDayModal();
  });
  $("dayModalLessons").addEventListener("submit", (event) => {
    const form = event.target.closest("[data-edit-form]");
    if (!form) return;
    event.preventDefault();
    const lesson = state.lessons.find((item) => item.id === form.dataset.editForm);
    if (!lesson) return;
    lesson.coachId = form.elements.coachId.value;
    lesson.minutes = Number(form.elements.minutes.value);
    lesson.note = form.elements.note.value.trim();
    editingLessonId = "";
    saveState();
    render();
    renderDayModal();
  });
  document.body.addEventListener("click", (event) => {
    const dayButton = event.target.closest("[data-open-date]");
    if (dayButton) openDayModal(dayButton.dataset.openDate);

    const editButton = event.target.closest("[data-edit-lesson]");
    if (editButton) {
      editingLessonId = editButton.dataset.editLesson;
      renderDayModal();
    }

    const cancelEditButton = event.target.closest("[data-cancel-edit]");
    if (cancelEditButton) {
      editingLessonId = "";
      renderDayModal();
    }

    const deleteButton = event.target.closest("[data-modal-delete-lesson]");
    if (deleteButton && confirm("确定删除这节课？")) deleteBy("lesson", deleteButton.dataset.modalDeleteLesson);
  });
}

bindEvents();
render();
