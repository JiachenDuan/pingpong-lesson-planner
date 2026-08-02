const storageKey = "pingpongLessonPlanner.v1";

const seedState = {
  children: [{ id: "child-kyson", name: "Kyson" }],
  coaches: [
    { id: "coach-tian", name: "田教练", rate: 130, rateMode: "hour", defaultMinutes: 60, color: "#176b87" },
    { id: "coach-eric", name: "Eric教练", rate: 90, rateMode: "hour", defaultMinutes: 60, color: "#3f7d58" },
  ],
  lessons: [],
  settings: {
    monthlyBudget: 2000,
    targetLessons: 8,
  },
};

let state = loadState();
let selectedMonth = new Date().toISOString().slice(0, 7);
let filters = { childId: "all", coachId: "all" };

const $ = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
const dateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", { month: "short", day: "numeric", weekday: "short" });

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
  if ([800, 1000].includes(Number(next.settings?.monthlyBudget)) && Number(next.settings?.targetLessons) === 8) {
    changed = true;
    next.settings.monthlyBudget = 2000;
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

function coachUnitCost(coach) {
  return coach.rateMode === "session" ? Number(coach.rate) : (Number(coach.rate) * Number(coach.defaultMinutes)) / 60;
}

function monthLessons() {
  return state.lessons
    .filter((lesson) => lesson.date.startsWith(selectedMonth))
    .filter((lesson) => filters.childId === "all" || lesson.childId === filters.childId)
    .filter((lesson) => filters.coachId === "all" || lesson.coachId === filters.coachId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderSelects() {
  const childOptions = state.children.map((child) => `<option value="${child.id}">${escapeHtml(child.name)}</option>`).join("");
  const coachOptions = state.coaches.map((coach) => `<option value="${coach.id}">${escapeHtml(coach.name)}</option>`).join("");

  $("lessonChild").innerHTML = childOptions;
  $("lessonCoach").innerHTML = coachOptions;
  $("childFilter").innerHTML = `<option value="all">所有孩子</option>${childOptions}`;
  $("coachFilter").innerHTML = `<option value="all">所有教练</option>${coachOptions}`;
  $("childFilter").value = filters.childId;
  $("coachFilter").value = filters.coachId;

  const selectedCoach = state.coaches.find((coach) => coach.id === $("lessonCoach").value) || state.coaches[0];
  if (selectedCoach && !$("lessonMinutes").value) $("lessonMinutes").value = selectedCoach.defaultMinutes;
}

function renderSummary() {
  const lessons = monthLessons();
  const totalMinutes = lessons.reduce((sum, lesson) => sum + Number(lesson.minutes), 0);
  const totalSpend = lessons.reduce((sum, lesson) => sum + lessonCost(lesson), 0);
  const left = Number(state.settings.monthlyBudget) - totalSpend;

  $("monthLessonCount").textContent = lessons.length;
  $("monthHours").textContent = `${(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)}h`;
  $("monthSpend").textContent = money(totalSpend);
  $("budgetLeft").textContent = money(left);
  $("budgetLeft").className = left < 0 ? "over" : "under";
}

function renderChildren() {
  $("childrenList").innerHTML = state.children.length
    ? state.children
        .map(
          (child) => `
            <div class="row">
              <strong>${escapeHtml(child.name)}</strong>
              <button class="delete-button" data-delete-child="${child.id}" title="删除">×</button>
            </div>
          `,
        )
        .join("")
    : emptyHtml();
}

function renderCoaches() {
  $("coachesList").innerHTML = state.coaches.length
    ? state.coaches
        .map(
          (coach) => `
            <div class="coach-row">
              <span class="swatch" style="background:${coach.color}"></span>
              <strong>${escapeHtml(coach.name)}</strong>
              <span>${money(coach.rate)} / ${coach.rateMode === "hour" ? "小时" : "节"}</span>
              <span>${coach.defaultMinutes} 分钟</span>
              <span class="money">${money(coachUnitCost(coach))} / 默认课</span>
              <button class="delete-button" data-delete-coach="${coach.id}" title="删除">×</button>
            </div>
          `,
        )
        .join("")
    : emptyHtml();
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

function renderPlanner() {
  $("monthlyBudget").value = state.settings.monthlyBudget;
  $("targetLessons").value = state.settings.targetLessons;

  const budget = Number(state.settings.monthlyBudget);
  const target = Number(state.settings.targetLessons);
  const coaches = [...state.coaches].sort((a, b) => coachUnitCost(a) - coachUnitCost(b));
  const lessons = monthLessons();
  const spent = lessons.reduce((sum, lesson) => sum + lessonCost(lesson), 0);
  const remaining = Math.max(0, budget - spent);

  if (!coaches.length) {
    $("planOutput").innerHTML = emptyHtml();
    return;
  }

  const cheapest = coaches[0];
  const cheapestCount = Math.floor(budget / coachUnitCost(cheapest));
  const extraCount = Math.floor(remaining / coachUnitCost(cheapest));
  const balanced = buildBalancedPlan(coaches, target, budget);
  const premium = buildPremiumPlan(coaches, target, budget);
  const premiumCoach = [...coaches].sort((a, b) => coachUnitCost(b) - coachUnitCost(a))[0];

  $("planOutput").innerHTML = `
    <div class="plan-card">
      <strong>本月还能加 ${extraCount} 节最低成本课</strong>
      <span class="muted">按 ${escapeHtml(cheapest.name)} 的默认 ${cheapest.defaultMinutes} 分钟课计算。</span>
      <div class="plan-line"><span>整月最低成本上限</span><b>${cheapestCount} 节</b></div>
    </div>
    ${planCard("均衡安排", balanced)}
    ${planCard(`${premiumCoach.name}优先`, premium)}
  `;
}

function buildBalancedPlan(coaches, target, budget) {
  const counts = Object.fromEntries(coaches.map((coach) => [coach.id, 0]));
  let spend = 0;
  for (let index = 0; index < target; index += 1) {
    const coach = coaches[index % coaches.length];
    const cost = coachUnitCost(coach);
    if (spend + cost > budget) break;
    counts[coach.id] += 1;
    spend += cost;
  }
  return { counts, spend };
}

function buildPremiumPlan(coaches, target, budget) {
  const byPriceHigh = [...coaches].sort((a, b) => coachUnitCost(b) - coachUnitCost(a));
  const counts = Object.fromEntries(coaches.map((coach) => [coach.id, 0]));
  let spend = 0;
  const premiumTarget = Math.ceil(target * 0.7);
  for (const coach of byPriceHigh) {
    while (counts[coach.id] < premiumTarget && Object.values(counts).reduce((sum, count) => sum + count, 0) < target) {
      const cost = coachUnitCost(coach);
      if (spend + cost > budget) break;
      counts[coach.id] += 1;
      spend += cost;
    }
  }
  for (const coach of [...coaches].sort((a, b) => coachUnitCost(a) - coachUnitCost(b))) {
    while (Object.values(counts).reduce((sum, count) => sum + count, 0) < target) {
      const cost = coachUnitCost(coach);
      if (spend + cost > budget) break;
      counts[coach.id] += 1;
      spend += cost;
    }
  }
  return { counts, spend };
}

function planCard(title, plan) {
  const total = Object.values(plan.counts).reduce((sum, count) => sum + count, 0);
  const lines = state.coaches
    .filter((coach) => plan.counts[coach.id] > 0)
    .map((coach) => `<div class="plan-line"><span>${escapeHtml(coach.name)}</span><b>${plan.counts[coach.id]} 节</b></div>`)
    .join("");
  return `
    <div class="plan-card">
      <strong>${escapeHtml(title)}: ${total} 节，${money(plan.spend)}</strong>
      ${lines || '<span class="muted">预算不足以安排课程。</span>'}
    </div>
  `;
}

function render() {
  $("monthPicker").value = selectedMonth;
  renderSelects();
  renderSummary();
  renderChildren();
  renderCoaches();
  renderLessons();
  renderPlanner();
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
  if (type === "child") state.children = state.children.filter((item) => item.id !== id);
  if (type === "coach") state.coaches = state.coaches.filter((item) => item.id !== id);
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
  $("childForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.children.push({ id: crypto.randomUUID(), name: $("childName").value.trim() });
    $("childName").value = "";
    saveState();
    render();
  });
  $("coachForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.coaches.push({
      id: crypto.randomUUID(),
      name: $("coachName").value.trim(),
      rate: Number($("coachRate").value),
      rateMode: $("coachRateMode").value,
      defaultMinutes: Number($("coachMinutes").value),
      color: $("coachColor").value,
    });
    event.target.reset();
    $("coachColor").value = "#176b87";
    saveState();
    render();
  });
  $("saveBudgetBtn").addEventListener("click", () => {
    state.settings.monthlyBudget = Number($("monthlyBudget").value);
    state.settings.targetLessons = Number($("targetLessons").value);
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
    state = imported;
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
    const childId = event.target.dataset.deleteChild;
    const coachId = event.target.dataset.deleteCoach;
    if (lessonId) deleteBy("lesson", lessonId);
    if (childId) deleteBy("child", childId);
    if (coachId) deleteBy("coach", coachId);
  });
}

bindEvents();
render();
