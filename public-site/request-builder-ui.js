import { buildIndicatorRequests, parameterDefinitions, resolveParameters, beijingDate } from './request-builder.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const clone = value => structuredClone(value);
let sequence = 0;
export function newParameterGroup(indicator, overrides = {}) {
  return { indicator:clone(indicator), overrides:clone(overrides), instanceId:`request-instance-${++sequence}` };
}
export function duplicateParameterGroup(group, values) { return newParameterGroup(group.indicator, values || group.overrides); }
export function openRequestBuilder(getCurrent) {
  document.querySelector('#requestBuilderDialog')?.remove();
  const initial = getCurrent();
  const fingerprint = JSON.stringify(initial);
  let groups = initial.indicators.map(i => newParameterGroup(i));
  let result, selectedRequest = 0, fresh = false, timer;
  const dialog = document.createElement('dialog'); dialog.id = 'requestBuilderDialog'; dialog.className = 'request-builder-dialog';
  dialog.setAttribute('aria-labelledby', 'requestBuilderTitle');
  dialog.innerHTML = `<header><div><h2 id="requestBuilderTitle">生成指标请求体</h2><p>仅构建 JSON，不调用数据接口</p></div><button type="button" class="icon-btn" data-rb-close aria-label="关闭请求体窗口">×</button></header>
    <div class="rb-source"></div><div class="rb-layout"><section class="rb-editor" aria-label="指标参数配置"><fieldset class="rb-mode"><legend>生成方式</legend><label><input type="radio" name="rb-mode" value="merge" checked>合并生成（默认）</label><label><input type="radio" name="rb-mode" value="separate">分别生成</label><p>相同 API 自动合并，不同 API 自动分为不同请求体</p></fieldset><div class="rb-groups"></div><p class="rb-hint">参数只影响本次请求体，不改变公开快照。默认值保留原值和类型。</p></section><section class="rb-preview" aria-label="请求体预览"><div class="rb-preview-heading"><h3>请求体预览</h3><span class="rb-status" role="status"></span></div><div class="rb-tabs" role="tablist" aria-label="生成的请求"></div><div class="rb-errors" role="alert"></div><pre tabindex="0" aria-label="格式化 JSON"></pre></section></div>
    <footer><span class="rb-feedback" role="status"></span><button type="button" class="btn secondary" data-rb-generate>重新生成</button><button type="button" class="btn primary" data-rb-copy disabled>复制请求体</button></footer>`;
  document.body.append(dialog);
  const $ = s => dialog.querySelector(s);
  const context = () => ({ baseDate:beijingDate(), source:initial.source, dictionaries:initial.dictionaries || {} });
  $('.rb-source').textContent = `${initial.source} · 已选 ${initial.indicators.length} 项 · 参数定义来自所选公开版本`;
  function unchanged() { return JSON.stringify(getCurrent()) === fingerprint; }
  function invalidate(message = '参数已改变，请重新生成') {
    fresh = false; $('[data-rb-copy]').disabled = true; $('.rb-status').textContent = '待重新生成';
    $('.rb-feedback').textContent = message;
    $('pre').textContent = '配置已改变，旧结果已失效。请重新生成。';
    $('.rb-tabs').replaceChildren(); $('.rb-errors').replaceChildren();
  }
  function effective(group) {
    try { return resolveParameters(group.indicator, group.overrides, { ...context(), baseDate:result?.generationMeta.baseDate || beijingDate() }); }
    catch { return { params:group.overrides, sources:{} }; }
  }
  function renderGroups() {
    const counts = new Map();
    $('.rb-groups').innerHTML = groups.map(group => {
      const key = group.indicator.key, number = (counts.get(key) || 0) + 1; counts.set(key, number);
      let definitions = [], problem = '';
      try { definitions = parameterDefinitions(group.indicator); } catch(e) { problem = e.message; }
      const resolved = effective(group);
      return `<article class="rb-group" data-instance="${escape(group.instanceId)}"><div class="rb-group-heading"><div><strong>${escape(group.indicator.name)}</strong><small>接口编码 ${escape((group.indicator.dsIds || []).join('、') || '未配置')} · 参数组 ${number}</small></div><button type="button" class="rb-delete" ${groups.filter(g => g.indicator.key === key).length === 1 ? 'disabled' : ''} aria-label="删除${escape(group.indicator.name)}参数组${number}">删除本组</button></div>
        ${problem ? `<p class="rb-error">${escape(problem)}</p>` : !definitions.length ? '<p class="rb-hint">已确认无入参</p>' : `<div class="rb-param-labels"><span>指标参数</span><span>本次请求的值</span></div>${definitions.map((p, index) => {
          const value = Object.hasOwn(resolved.params, p.mnemonic) ? resolved.params[p.mnemonic] : p.default_value;
          const dictionary = p.dictionary_mode === 'REFERENCE' ? initial.dictionaries?.[p.dictionary_reference] : p.dictionary_values;
          const isDictionary = dictionary && typeof dictionary === 'object' && !Array.isArray(dictionary) && Object.keys(dictionary).length;
          const type = value === null ? 'null' : typeof value === 'object' ? 'json' : typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
          const stringValue = type === 'json' ? JSON.stringify(value) : value == null ? '' : String(value);
          let control;
          if (isDictionary) {
            const known = Object.hasOwn(dictionary, String(value));
            control = `<select data-param-index="${index}" data-value-type="${['number','boolean'].includes(type) ? type : 'string'}" aria-label="${escape(p.mnemonic)}">${known ? '' : `<option value="${escape(stringValue)}">${escape(stringValue || '请选择')}</option>`}${Object.entries(dictionary).map(([code, label]) => `<option value="${escape(code)}" ${String(value) === code ? 'selected' : ''}>${escape(label)} (${escape(code)})</option>`).join('')}</select>`;
          } else control = `<div class="rb-value"><input data-param-index="${index}" value="${escape(stringValue)}" aria-label="${escape(p.mnemonic)}" autocomplete="off" spellcheck="false"><select data-type-index="${index}" aria-label="${escape(p.mnemonic)}值类型">${[['string','字符串'],['number','数字'],['boolean','布尔值'],['null','null'],['json','JSON']].map(([v, label]) => `<option value="${v}" ${type === v ? 'selected' : ''}>${label}</option>`).join('')}</select></div>`;
          return `<div class="rb-param"><label>${escape(p.parameter_name || p.mnemonic)}<small>${escape(p.mnemonic)}</small></label><div>${control}<small class="rb-value-source">${escape(resolved.sources[p.mnemonic] || p.default_value_type || '待解析')}</small></div></div>`;
        }).join('')}`}
        <button type="button" class="rb-add">＋ 添加一组参数</button></article>`;
    }).join('');
    dialog.querySelectorAll('[data-instance]').forEach(article => {
      const group = groups.find(g => g.instanceId === article.dataset.instance);
      article.querySelector('.rb-add').onclick = () => {
        if (!unchanged()) { invalidate('指标定义已变化，请关闭窗口后重新打开'); return; }
        const errors = collect();
        if (errors.length) { result = {requests:[], errors}; fresh = false; preview(); return; }
        const index = groups.indexOf(group); groups.splice(index + 1, 0, duplicateParameterGroup(group, effective(group).params));
        invalidate('已添加独立参数组，可修改后重新生成'); renderGroups();
      };
      article.querySelector('.rb-delete').onclick = () => { const errors = collect(); if(errors.length) { result={requests:[],errors}; fresh=false; preview(); return; } groups = groups.filter(g => g !== group); invalidate(); renderGroups(); };
      article.querySelectorAll('[data-param-index], [data-type-index]').forEach(input => {
        input.addEventListener('input', () => { invalidate(); article.querySelector('.rb-value-source')?.removeAttribute('title'); });
        input.addEventListener('change', () => invalidate());
      });
    });
  }
  function collect() {
    const errors = [];
    dialog.querySelectorAll('[data-instance]').forEach(article => {
      const group = groups.find(g => g.instanceId === article.dataset.instance);
      let definitions; try { definitions = parameterDefinitions(group.indicator); } catch { return; }
      article.querySelectorAll('[data-param-index]').forEach(input => {
        const p = definitions[Number(input.dataset.paramIndex)];
        const previous = effective(group).params[p.mnemonic];
        const original = previous && typeof previous === 'object' ? JSON.stringify(previous) : previous == null ? '' : String(previous);
        const previousType = previous === null ? 'null' : typeof previous === 'object' ? 'json' : typeof previous === 'number' ? 'number' : typeof previous === 'boolean' ? 'boolean' : 'string';
        const type = input.dataset.valueType || article.querySelector(`[data-type-index="${input.dataset.paramIndex}"]`).value;
        if (input.value === original && type === previousType) return;
        try {
          let value = input.value;
          if (type === 'number') { if (!value.trim() || !Number.isFinite(Number(value))) throw Error('请输入有效数字'); value = Number(value); }
          if (type === 'boolean') { if (!['true','false'].includes(value)) throw Error('布尔值只能为 true 或 false'); value = value === 'true'; }
          if (type === 'null') value = null;
          if (type === 'json') value = JSON.parse(value);
          Object.defineProperty(group.overrides, p.mnemonic, { value, enumerable:true, configurable:true, writable:true });
        } catch(e) { errors.push({ indicator:group.indicator.name, parameter:p.mnemonic, message:e.message }); }
      });
    });
    return errors;
  }
  function preview() {
    const requests = result?.requests || [];
    $('.rb-tabs').innerHTML = requests.map((request, i) => `<button type="button" role="tab" aria-selected="${i === selectedRequest}" class="${i === selectedRequest ? 'active' : ''}" data-request="${i}">请求 ${i + 1} · ${request.body.IndicatorExps?.length || request.instanceIds.length} 组</button>`).join('');
    $('.rb-tabs').querySelectorAll('button').forEach(button => button.onclick = () => { selectedRequest = Number(button.dataset.request); preview(); });
    $('.rb-errors').innerHTML = (result?.errors || []).map(error => `<p>${escape([error.indicator, error.parameter, error.message].filter(Boolean).join(' · '))}</p>`).join('');
    $('pre').textContent = requests[selectedRequest] ? JSON.stringify(requests[selectedRequest].body, null, 2) : '尚无可复制的请求体，请先处理上述问题。';
    $('.rb-status').textContent = result.errors.length ? `${result.errors.length} 项问题` : `${requests.length} 个请求 · ${groups.length} 组参数`;
    $('[data-rb-copy]').disabled = !fresh || !requests[selectedRequest];
  }
  function generate() {
    if (!unchanged()) { invalidate('当前指标定义已变化，请关闭窗口后重新打开'); return; }
    const errors = collect();
    result = errors.length ? { requests:[], errors, generationMeta:{baseDate:beijingDate()} } : buildIndicatorRequests(groups.map(g => ({...g.indicator, instanceId:g.instanceId, overrides:g.overrides})), { mode:$('[name="rb-mode"]:checked').value, sorts:[], filters:[] }, context());
    selectedRequest = 0; fresh = true; renderGroups(); preview();
    $('.rb-feedback').textContent = `基准日 ${result.generationMeta.baseDate}（北京时间）${result.errors.length ? ' · 失败请求未生成' : ' · 已生成，可复制当前请求'}`;
  }
  $('[data-rb-generate]').onclick = generate;
  dialog.querySelectorAll('[name="rb-mode"]').forEach(input => input.onchange = () => invalidate());
  $('[data-rb-copy]').onclick = async () => {
    if (!unchanged()) { invalidate('指标定义已变化，请关闭窗口后重新打开'); return; }
    if (!fresh || !result.requests[selectedRequest]) return;
    try { await navigator.clipboard.writeText(JSON.stringify(result.requests[selectedRequest].body, null, 2)); $('.rb-feedback').textContent = '已复制当前请求体'; }
    catch { $('.rb-feedback').textContent = '浏览器未允许复制，请选中右侧 JSON 手动复制'; }
  };
  $('[data-rb-close]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { clearInterval(timer); dialog.remove(); }, {once:true});
  dialog.showModal(); renderGroups(); generate();
  timer = setInterval(() => { if (fresh && !unchanged()) invalidate('指标定义已变化，请关闭窗口后重新打开'); }, 1500);
}
