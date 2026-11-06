import {openRequestBuilder} from './request-builder-ui.js';
import {maintenanceForSelection} from './model.js';
import { filterRows, pageRows, validateSnapshot } from './model.js';
const $ = (s) => document.querySelector(s);
const selectedKeys=new Set();
const state = { snapshot: null, domains: [], page: 1, size: 20, request: 0, detail: null, group: 'time' };
const names = { time: '时间型入参', enum: '枚举型入参', custom: '自定义入参', output: '出参项' };
function textCell(row, value, cls = '') { const cell = document.createElement('td'); cell.textContent = value || '—'; cell.className = cls; row.append(cell); return cell; }
function options(select, values, label) { const previous = select.value; select.replaceChildren(new Option(label, ''), ...values.map(v => new Option(v, v))); select.value = values.includes(previous) ? previous : ''; }
function categories() {
  const rows = state.snapshot?.libraryRows || [], unique = (a) => [...new Set(a.filter(Boolean))].sort((a,b) => a.localeCompare(b, 'zh-CN'));
  options($('#l1'), unique(rows.map(r => r.l1)), '全部一级分类');
  options($('#l2'), unique(rows.filter(r => !$('#l1').value || r.l1 === $('#l1').value).map(r => r.l2)), '全部二级分类');
}
function render() {
  const all = filterRows(state.snapshot?.libraryRows || [], { query: $('#search').value, l1: $('#l1').value, l2: $('#l2').value, status: $('#status').value });
  const page = pageRows(all, state.page, state.size); state.page = page.page;
  $('#rows').replaceChildren();
  for (const item of page.rows) {
    const row = document.createElement('tr');row.classList.toggle('selected-row',selectedKeys.has(item.key));const cellCheck=textCell(row,'','check-cell'),check=document.createElement('input');check.type='checkbox';check.checked=selectedKeys.has(item.key);check.setAttribute('aria-label','选择'+item.name);check.onchange=()=>{check.checked?selectedKeys.add(item.key):selectedKeys.delete(item.key);render();};cellCheck.replaceChildren(check); textCell(row, item.key, 'code'); textCell(row, item.dsInterfaceId, 'code'); textCell(row, item.name, 'indicator-name'); textCell(row, [item.l1, item.l2].filter(Boolean).join(' / ')); textCell(row, item.type); textCell(row, item.frequency);
    const cell = textCell(row, ''); cell.replaceChildren(); const badge = document.createElement('span'); badge.className = `badge ${item.status === '有效' ? 'active' : 'inactive'}`; badge.textContent = item.status || '—'; cell.append(badge);
    const action = textCell(row, ''); action.replaceChildren(); const button = document.createElement('button'); button.className = 'text-button'; button.textContent = '查看明细'; button.setAttribute('aria-label', `查看${item.name}明细`); button.onclick = () => openDetail(item); action.append(button); $('#rows').append(row);
  }
  const n=page.rows.filter(r=>selectedKeys.has(r.key)).length;$('#selectPage').checked=page.rows.length>0&&n===page.rows.length;$('#selectPage').indeterminate=n>0&&n<page.rows.length;$('#selectPage').onchange=e=>{page.rows.forEach(r=>e.target.checked?selectedKeys.add(r.key):selectedKeys.delete(r.key));render();};updateActions();
  $('#resultCount').textContent = `共 ${all.length.toLocaleString('zh-CN')} 条${all.length ? `，当前 ${page.start + 1}–${page.start + page.rows.length} 条` : ''}`;
  $('#pageLabel').textContent = `${page.page} / ${page.pages}`; $('#prev').disabled = page.page <= 1; $('#next').disabled = page.page >= page.pages;
  $('#message').textContent = state.snapshot && !all.length ? '没有找到符合条件的指标，请调整搜索或筛选。' : '';
}
function date(value) { return value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—'; }
async function loadDomain() {
  const request = ++state.request, domain = state.domains.find(d => d.domainId === $('#domainSelect').value);
  selectedKeys.clear(); state.snapshot = null; state.page = 1; $('#search').value = ''; $('#l1').value = ''; $('#l2').value = ''; $('#status').value = ''; categories(); render();
  $('#domainName').textContent = domain.domainName; $('#version').textContent = domain.archiveId; $('#counts').textContent = ''; $('#publishedAt').textContent = ''; $('#message').textContent = '正在加载公开快照…';
  try {
    const response = await fetch(`./snapshots/${encodeURIComponent(domain.domainId)}.json`); if (!response.ok) throw new Error('公开快照读取失败');
    const snapshot = await response.json(); validateSnapshot(snapshot, domain);
    if (request !== state.request) return;
    state.snapshot = snapshot; categories(); render();
    const p = snapshot.publication; $('#counts').textContent = `${p.totalCount.toLocaleString('zh-CN')} 个指标 · 有效 ${p.effectiveCount} · 已废弃 ${p.deprecatedCount}`; $('#publishedAt').textContent = `公开时间 ${date(p.publishedAt)}`;
  } catch { if (request === state.request) $('#message').textContent = '公开快照加载失败。请刷新后重试；不会改用工作版或其他存档。'; }
}
function openDetail(item) {
  state.detail = item; state.group = 'time'; $('#detailName').textContent = item.name; $('#detailCode').textContent = item.key;
  const entries = [['指标编码', item.key], ['DS接口ID（ds_interface_id）', item.dsInterfaceId], ['所属API名称（api_name）', item.apiName], ['指标分类', [item.l1, item.l2].filter(Boolean).join(' / ')], ['指标类型', item.type], ['单位描述', item.unit], ['指标频率', item.frequency], ['是否支持实时', item.isRealtime], ['指标状态', item.status]];
  $('#detailSummary').replaceChildren();
  for (const [label, value] of entries) { const div = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value === '' || value == null ? '—' : String(value); div.append(dt, dd); $('#detailSummary').append(div); }
  $('#detailSynonyms').textContent = Array.isArray(item.synonyms) ? item.synonyms.join('，') : item.synonyms || '—'; $('#detailDescription').textContent = item.description || '—'; renderParams(); $('#detailDialog').showModal();
}
function renderParams() {
  for (const tab of document.querySelectorAll('[data-param]')) { const selected = tab.dataset.param === state.group; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; }
  const p = state.detail?.params?.[state.group] || []; $('#detailJson').textContent = p.length ? JSON.stringify(p, null, 2) : `无${names[state.group]}`; $('#detailJson').setAttribute('aria-labelledby', `tab-${state.group}`);
}
$('#closeDetail').onclick = () => $('#detailDialog').close();
document.querySelectorAll('[data-param]').forEach((tab, index, tabs) => {
  tab.onclick = () => { state.group = tab.dataset.param; renderParams(); };
  tab.onkeydown = (event) => { const move = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0; if (!move) return; event.preventDefault(); const next = tabs[(index + move + tabs.length) % tabs.length]; next.click(); next.focus(); };
});
$('#search').oninput = () => { state.page = 1; render(); };
for (const id of ['l1', 'l2', 'status']) $(`#${id}`).onchange = () => { state.page = 1; if (id === 'l1') { $('#l2').value = ''; categories(); } render(); };
$('#reset').onclick = () => { $('#search').value = ''; $('#l1').value = ''; $('#l2').value = ''; $('#status').value = ''; state.page = 1; categories(); render(); };
$('#prev').onclick = () => { state.page--; render(); }; $('#next').onclick = () => { state.page++; render(); }; $('#pageSize').onchange = () => { state.size = Number($('#pageSize').value); state.page = 1; render(); };
$('#domainSelect').onchange = loadDomain;
try {
  const response = await fetch('./snapshots/manifest.json'); if (!response.ok) throw new Error('manifest');
  const manifest = await response.json(); state.domains = manifest.domains;
  if (!Array.isArray(state.domains) || !state.domains.length) throw new Error('no publications');
  $('#domainSelect').replaceChildren(...state.domains.map(d => new Option(d.domainName, d.domainId))); $('#domainSelect').disabled = false; await loadDomain();
} catch { $('#message').textContent = '当前没有可读取的公开版本，请稍后重试。'; }

function updateActions(){const total=state.snapshot?.libraryRows.length||0,n=selectedKeys.size;$('#selectionSummary').textContent=n?'已选择 '+n+' 项（跨页保留）':'未选择指标';$('#clearSelected').hidden=!n;$('#generateRequests').disabled=!n;$('#exportMaintenance').disabled=!total||!state.snapshot?.maintenance;$('#exportMaintenance').textContent=n?'导出所选参数维护表（'+n+'）':'导出全部参数维护表（'+total+'）';$('#exportScope').textContent=n?'仅导出所选指标的冻结来源；临时请求参数不影响导出':'导出当前范式全部公开指标的冻结来源，搜索筛选不改变范围';}
function openRequests(keys){const snapshot=state.snapshot;if(!snapshot||!keys.length)return;const current=()=>({source:'公开版本 '+snapshot.publication.archiveId,domainId:snapshot.publication.domainId,indicators:snapshot.libraryRows.filter(r=>keys.includes(r.key)).map(r=>({...r,domainId:snapshot.publication.domainId,dsIds:String(r.dsInterfaceId||'').split(/[、,;\n]/).map(s=>s.trim()).filter(Boolean)}))});openRequestBuilder(current);}
$('#generateRequests').onclick=()=>openRequests([...selectedKeys]);$('#clearSelected').onclick=()=>{selectedKeys.clear();render();};$('#detailGenerate').onclick=()=>{const key=state.detail.key;$('#detailDialog').close();openRequests([key]);};
$('#exportMaintenance').onclick=()=>{try{const data=maintenanceForSelection(state.snapshot,[...selectedKeys]);const bytes=window.IndicatorExport.createUnifiedIndicatorWorkbookBytes(data),blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=state.snapshot.publication.archiveId+'_'+(selectedKeys.size?'所选':'全部')+'_统一参数维护表.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);$('#message').textContent='已导出 '+data.indicators.length+' 个来源指标、'+data.parameters.length+' 项参数；数据来自所选公开存档。';}catch(e){$('#message').textContent='导出失败：'+e.message;}};
