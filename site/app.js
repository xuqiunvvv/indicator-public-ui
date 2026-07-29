const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
})[character]);
const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
const titles = {
  library: ["选X指标库", "查询最近一次公开发布的标准指标"],
  dashboard: ["层级指标看板", "按月或按周查看业务模块覆盖与上架趋势"],
  export: ["导出中心", "下载当前公开版本的标准文档"],
};
const state = {
  domainId: "fund",
  view: "library",
  snapshot: null,
  page: 1,
  pageSize: 20,
  trendMode: "month",
  detail: null,
  paramGroup: "time",
};

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2400);
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

async function loadSnapshot() {
  $("#publishedStatus").textContent = "正在读取公开版本";
  $(".status-dot").classList.remove("ready");
  try {
    const response = await fetch(`/api/snapshot?domainId=${encodeURIComponent(state.domainId)}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "公开版本读取失败");
    state.snapshot = body;
    state.page = 1;
    $("#publishedStatus").textContent = `已发布 ${body.publication.archiveId}`;
    $(".status-dot").classList.add("ready");
  } catch (error) {
    state.snapshot = null;
    $("#publishedStatus").textContent = error.message || "当前指标域尚未发布";
  }
  renderAll();
}

function library() {
  return state.snapshot?.libraryRows || [];
}

function filteredLibrary() {
  const query = $("#librarySearch").value.trim().toLowerCase();
  const l1 = $("#level1Filter").value;
  const l2 = $("#level2Filter").value;
  const type = $("#typeFilter").value;
  const status = $("#statusFilter").value;
  return library().filter((item) => {
    const text = [item.key, item.name, item.description, item.synonyms].join(" ").toLowerCase();
    return (!query || text.includes(query))
      && (!l1 || item.l1 === l1)
      && (!l2 || item.l2 === l2)
      && (!type || item.type === type)
      && (!status || item.status === status);
  });
}

function fillSelect(select, values, placeholder) {
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  select.value = values.includes(current) ? current : "";
}

function updateFilters() {
  fillSelect($("#level1Filter"), unique(library().map((item) => item.l1)), "全部一级分类");
  const l1 = $("#level1Filter").value;
  fillSelect($("#level2Filter"), unique(library().filter((item) => !l1 || item.l1 === l1).map((item) => item.l2)), "全部二级分类");
  fillSelect($("#typeFilter"), unique(library().map((item) => item.type)), "全部指标类型");
}

function renderPagination(total) {
  const pages = Math.max(1, Math.ceil(total / state.pageSize));
  state.page = Math.min(state.page, pages);
  const candidates = [...new Set([1, pages, state.page - 1, state.page, state.page + 1]
    .filter((page) => page >= 1 && page <= pages))].sort((a, b) => a - b);
  $("#pagination").innerHTML = candidates.map((page) => `<button class="${page === state.page ? "active" : ""}" data-page="${page}">${page}</button>`).join("");
  $$("[data-page]").forEach((button) => button.onclick = () => {
    state.page = Number(button.dataset.page);
    renderLibrary();
  });
}

function renderLibrary() {
  const records = filteredLibrary();
  const start = (state.page - 1) * state.pageSize;
  const pageRows = records.slice(start, start + state.pageSize);
  $("#libraryRows").innerHTML = pageRows.length ? pageRows.map((item) => {
    const parameterCount = ["time", "enum", "custom"].reduce((total, group) => total + (item.params?.[group]?.length || 0), 0);
    return `<tr><td>${escapeHtml(item.key)}</td><td><div class="indicator-name">${escapeHtml(item.name)}</div><div class="secondary">${escapeHtml(item.description || "暂无介绍")}</div></td><td>${escapeHtml(item.l1)} / ${escapeHtml(item.l2)}</td><td><span class="tag type">${escapeHtml(item.type)}</span></td><td>${escapeHtml(item.frequency)}</td><td><span class="tag ${item.status === "有效" ? "active" : "deprecated"}">${escapeHtml(item.status)}</span></td><td>${parameterCount}个入参</td><td><button class="row-button" data-detail="${escapeHtml(item.key)}">查看</button></td></tr>`;
  }).join("") : '<tr><td colspan="8"><div class="empty">当前筛选条件下没有公开指标</div></td></tr>';
  $("#resultCount").textContent = `共 ${records.length} 条`;
  renderPagination(records.length);
  $$("[data-detail]").forEach((button) => button.onclick = () => openDetail(button.dataset.detail));
}

function renderMetrics() {
  const records = library();
  const publication = state.snapshot?.publication;
  $("#metricTotal").textContent = records.length;
  $("#metricActive").textContent = records.filter((item) => item.status === "有效").length;
  $("#metricDeprecated").textContent = records.filter((item) => item.status === "已废弃").length;
  $("#metricVersion").textContent = publication?.archiveId || "未发布";
  $("#exportVersion").textContent = publication?.archiveId || "未发布";
  $("#exportPublishedAt").textContent = formatDateTime(publication?.publishedAt);
  $("#exportDomain").textContent = publication?.domainName || "-";
}

function bucketKey(dateText, mode) {
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  if (mode === "month") return dateText.slice(0, 7);
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function coverageData() {
  const records = library();
  return unique(records.map((item) => item.l1)).map((name) => {
    const group = records.filter((item) => item.l1 === name);
    return {
      name,
      total: group.length,
      active: group.filter((item) => item.status === "有效").length,
      deprecated: group.filter((item) => item.status === "已废弃").length,
    };
  }).sort((a, b) => b.total - a.total);
}

function trendData() {
  const counts = new Map();
  library().forEach((item) => {
    const key = bucketKey(item.includedAt, state.trendMode);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts].sort(([left], [right]) => left.localeCompare(right)).slice(-18).map(([label, value]) => ({ label, value }));
}

function renderDashboard() {
  const coverage = coverageData();
  const maxCoverage = Math.max(1, ...coverage.map((item) => item.total));
  $("#coverageBars").innerHTML = coverage.length ? coverage.map((item) => `<div class="bar-row"><span title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span><div class="bar-track"><i style="width:${Math.round(item.total / maxCoverage * 100)}%"></i></div><strong>${item.total}</strong></div>`).join("") : '<div class="empty">暂无公开指标</div>';
  const trend = trendData();
  const maxTrend = Math.max(1, ...trend.map((item) => item.value));
  $("#trendModeLabel").textContent = state.trendMode === "month" ? "按月" : "按周";
  $("#trendChart").innerHTML = trend.length ? trend.map((item) => `<div class="trend-column"><strong>${item.value}</strong><i style="height:${Math.max(2, Math.round(item.value / maxTrend * 170))}px"></i><span>${escapeHtml(item.label)}</span></div>`).join("") : '<div class="empty">暂无上架时间数据</div>';
  $("#coverageHeatmap").innerHTML = coverage.length ? coverage.map((item) => {
    const activeRate = item.total ? item.active / item.total : 0;
    const hue = 24 + Math.round(activeRate * 125);
    return `<div class="heat-cell" style="--heat:hsl(${hue} 48% 42%)"><strong>${escapeHtml(item.name)}</strong><span>有效 ${item.active} · 废弃 ${item.deprecated} · 共 ${item.total}</span></div>`;
  }).join("") : '<div class="empty">暂无覆盖数据</div>';
}

function renderAll() {
  updateFilters();
  renderMetrics();
  renderLibrary();
  renderDashboard();
}

function showView(view) {
  state.view = view;
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
  $("#viewTitle").textContent = titles[view][0];
  $("#viewSubtitle").textContent = titles[view][1];
  $(".sidebar").classList.remove("open");
}

function openDetail(key) {
  state.detail = library().find((item) => item.key === key);
  if (!state.detail) return;
  $("#detailCode").textContent = state.detail.key;
  $("#detailName").textContent = state.detail.name;
  $("#detailSummary").innerHTML = [
    ["一级分类", state.detail.l1], ["二级分类", state.detail.l2], ["指标类型", state.detail.type],
    ["指标频率", state.detail.frequency], ["单位", state.detail.unit || "-"], ["状态", state.detail.status],
  ].map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  $("#detailDescription").textContent = state.detail.description || "暂无指标介绍";
  state.paramGroup = "time";
  $$(".param-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.param === "time"));
  renderDetailJson();
  $("#detailDialog").showModal();
}

function renderDetailJson() {
  if (!state.detail) return;
  const value = state.paramGroup === "output"
    ? state.detail.outputOptions || state.detail.params?.output || []
    : state.detail.params?.[state.paramGroup] || [];
  $("#detailJson").textContent = JSON.stringify(value, null, 2);
}

function downloadBytes(bytes, fileName) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportFile(type) {
  if (!state.snapshot?.publication?.policy?.allowExport) return toast("当前公开版本未开放导出");
  const stamp = state.snapshot.publication.archiveId;
  if (type === "standard") downloadBytes(window.IndicatorExport.createStandardWorkbookBytes(state.snapshot.rows || []), `${state.snapshot.publication.domainName}_汇总指标清单_${stamp}.xlsx`);
  if (type === "parameter") downloadBytes(window.IndicatorExport.createParameterWorkbookBytes(state.snapshot.parameterRows || []), `${state.snapshot.publication.domainName}_指标参数明细_${stamp}.xlsx`);
  if (type === "index") downloadBytes(window.IndicatorExport.createIndicatorIndexWorkbookBytes(state.snapshot.indexRows || []), `${state.snapshot.publication.domainName}_指标索引表_${stamp}.xlsx`);
}

function coverageMarkdown() {
  const publication = state.snapshot?.publication;
  const mode = state.trendMode === "month" ? "月度" : "周度";
  const coverage = coverageData();
  const trends = trendData();
  return [
    `# ${publication?.domainName || "选X"}指标覆盖报告`,
    "",
    `- 公开版本：${publication?.archiveId || "未发布"}`,
    `- 发布时间：${formatDateTime(publication?.publishedAt)}`,
    `- 统计口径：${mode}`,
    `- 指标总量：${library().length}`,
    "",
    "## 业务模块覆盖",
    "",
    "| 一级分类 | 有效指标 | 已废弃指标 | 总量 |",
    "|---|---:|---:|---:|",
    ...coverage.map((item) => `| ${item.name} | ${item.active} | ${item.deprecated} | ${item.total} |`),
    "",
    `## ${mode}上架情况`,
    "",
    "| 周期 | 新增指标 |",
    "|---|---:|",
    ...trends.map((item) => `| ${item.label} | ${item.value} |`),
    "",
  ].join("\n");
}

function exportCoverageMarkdown() {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([coverageMarkdown()], { type: "text/markdown;charset=utf-8" }));
  link.download = `${state.snapshot?.publication?.domainName || "选X"}_指标覆盖报告_${state.trendMode}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
}

$$(".nav-item").forEach((button) => button.onclick = () => showView(button.dataset.view));
$("#mobileMenu").onclick = () => $(".sidebar").classList.toggle("open");
$("#domainSelect").onchange = (event) => { state.domainId = event.target.value; loadSnapshot(); };
$("#librarySearch").oninput = () => { state.page = 1; renderLibrary(); };
$("#level1Filter").onchange = () => { $("#level2Filter").value = ""; state.page = 1; updateFilters(); renderLibrary(); };
$("#level2Filter").onchange = () => { state.page = 1; renderLibrary(); };
$("#typeFilter").onchange = () => { state.page = 1; renderLibrary(); };
$("#statusFilter").onchange = () => { state.page = 1; renderLibrary(); };
$("#pageSize").onchange = (event) => { state.pageSize = Number(event.target.value); state.page = 1; renderLibrary(); };
$$("[data-trend-mode]").forEach((button) => button.onclick = () => {
  state.trendMode = button.dataset.trendMode;
  $$("[data-trend-mode]").forEach((item) => item.classList.toggle("active", item === button));
  renderDashboard();
});
$("#closeDetail").onclick = () => $("#detailDialog").close();
$$("[data-param]").forEach((button) => button.onclick = () => {
  state.paramGroup = button.dataset.param;
  $$("[data-param]").forEach((item) => item.classList.toggle("active", item === button));
  renderDetailJson();
});
$("#exportStandard").onclick = () => exportFile("standard");
$("#exportParameters").onclick = () => exportFile("parameter");
$("#exportIndex").onclick = () => exportFile("index");
$("#exportCoverage").onclick = exportCoverageMarkdown;
$("#exportCoverageMd").onclick = exportCoverageMarkdown;

loadSnapshot();
