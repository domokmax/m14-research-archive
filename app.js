const state = { reports: [], filtered: [], date: "all", type: "all", query: "", index: 0 };
const $ = (id) => document.getElementById(id);

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function inlineMd(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function markdown(md = "") {
  const lines = md.replace(/\r/g, "").split("\n");
  let html = "", list = false, quote = false;
  const close = () => { if (list) { html += "</ul>"; list = false; } if (quote) { html += "</blockquote>"; quote = false; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line.trim()) { close(); continue; }
    if (/^\|.+\|$/.test(line) && i + 1 < lines.length && /^\|?[\s:|-]+\|$/.test(lines[i + 1])) {
      close();
      const rows = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = (row) => row.replace(/^\||\|$/g, "").split("|").map((v) => v.trim());
      const head = cells(rows[0]);
      html += '<div class="table-wrap"><table><thead><tr>' + head.map(v => `<th>${inlineMd(v)}</th>`).join("") + "</tr></thead><tbody>";
      rows.slice(2).forEach(row => { html += "<tr>" + cells(row).map(v => `<td>${inlineMd(v)}</td>`).join("") + "</tr>"; });
      html += "</tbody></table></div>";
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) { close(); const n = heading[1].length; html += `<h${n}>${inlineMd(heading[2])}</h${n}>`; continue; }
    if (/^---+$/.test(line.trim())) { close(); html += "<hr>"; continue; }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) { if (quote) { html += "</blockquote>"; quote = false; } if (!list) { html += "<ul>"; list = true; } html += `<li>${inlineMd(bullet[1])}</li>`; continue; }
    const q = line.match(/^>\s?(.*)$/);
    if (q) { if (list) { html += "</ul>"; list = false; } if (!quote) { html += "<blockquote>"; quote = true; } html += `<p>${inlineMd(q[1])}</p>`; continue; }
    close();
    html += `<p>${inlineMd(line)}</p>`;
  }
  close();
  return html;
}

function typeLabel(type) {
  return ({ manual: "随笔", proactive_ai: "GPT", auto_ai: "GPT", gpt: "GPT", mavis: "马维斯" })[type] || type || "未分类";
}

function uniqueDates() {
  return [...new Set(state.reports.map(r => r.archiveDate || "未标日期"))].sort().reverse();
}

function renderFilters() {
  const types = ["all", ...new Set(state.reports.map(r => r.recordType || "manual"))];
  $("typeFilters").innerHTML = types.map(t =>
    `<button data-type="${escapeHtml(t)}" class="${state.type === t ? "active" : ""}">${t === "all" ? "全部" : typeLabel(t)}</button>`
  ).join("");
  $("typeFilters").querySelectorAll("button").forEach(btn => btn.onclick = () => { state.type = btn.dataset.type; state.index = 0; applyFilters(); });

  const counts = Object.fromEntries(uniqueDates().map(d => [d, state.reports.filter(r => r.archiveDate === d).length]));
  $("dateList").innerHTML = `<button data-date="all" class="${state.date === "all" ? "active" : ""}"><span>全部日期</span><small>${state.reports.length}</small></button>` +
    uniqueDates().map(d => `<button data-date="${d}" class="${state.date === d ? "active" : ""}"><span>${d}</span><small>${counts[d]}</small></button>`).join("");
  $("dateList").querySelectorAll("button").forEach(btn => btn.onclick = () => { state.date = btn.dataset.date; state.index = 0; applyFilters(); });
}

function applyFilters() {
  const q = state.query.toLowerCase();
  state.filtered = state.reports.filter(r =>
    (state.date === "all" || r.archiveDate === state.date) &&
    (state.type === "all" || r.recordType === state.type) &&
    (!q || [r.title, r.content, ...(r.tags || [])].join(" ").toLowerCase().includes(q))
  );
  state.index = Math.min(state.index, Math.max(0, state.filtered.length - 1));
  $("activeDate").textContent = state.date === "all" ? "全部日期" : state.date;
  renderFilters();
  renderReport();
}

function renderReport() {
  const report = state.filtered[state.index];
  $("position").textContent = report ? `${state.index + 1} / ${state.filtered.length}` : "0 / 0";
  $("prevReport").disabled = state.index <= 0;
  $("nextReport").disabled = state.index >= state.filtered.length - 1;
  if (!report) {
    $("report").innerHTML = '<p class="empty">没有符合当前条件的研报。</p>';
    return;
  }
  const tags = (report.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  $("report").innerHTML = `
    <header class="report-head">
      <h2>${escapeHtml(report.title || "未命名研报")}</h2>
      <div class="meta">
        <span>生成时间 ${escapeHtml(report.createdAt || "未记录")}</span>
        <span>行情日期 ${escapeHtml(report.marketDate || "—")}</span>
        <span>类型 ${escapeHtml(typeLabel(report.recordType))}</span>
      </div>
      <div class="tags">${tags}</div>
    </header>
    <div class="markdown">${markdown(report.content)}</div>`;
  window.scrollTo({ top: document.querySelector(".reading-room").offsetTop - 14, behavior: "smooth" });
}

async function boot() {
  try {
    const payload = await fetch(`reports.json?v=${Date.now()}`, { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    state.reports = payload.reports || [];
    state.filtered = [...state.reports];
    $("updatedAt").textContent = `同步于 ${payload.generatedAt || "未知时间"}`;
    $("reportCount").textContent = `${state.reports.length} 篇研报`;
    applyFilters();
  } catch (error) {
    $("report").innerHTML = `<p class="empty">档案载入失败：${escapeHtml(error.message)}</p>`;
  }
}

$("searchInput").addEventListener("input", (event) => { state.query = event.target.value.trim(); state.index = 0; applyFilters(); });
$("prevReport").onclick = () => { if (state.index > 0) { state.index--; renderReport(); } };
$("nextReport").onclick = () => { if (state.index < state.filtered.length - 1) { state.index++; renderReport(); } };
$("railToggle").onclick = () => $("dateList").closest(".archive-rail").classList.toggle("collapsed");
boot();
