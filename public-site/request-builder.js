// Runtime-neutral request construction. No network, DOM, persistence or evaluation.
export const DOMAIN_RULES = Object.freeze({
  ashare: { sector: '1101001', prefix: 'astock' },
  fund: { sector: '1201001001', prefix: 'fund' },
  bond: { sector: '1301001', prefix: 'bond' },
  index: { sector: '1701002', prefix: 'index' },
  block: { prefix: 'sector' }, hkshare: { prefix: 'hkstock' },
});
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const copy = value => structuredClone(value);
const empty = value => value == null || (typeof value === 'string' && !value.trim());
export function beijingDate(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function dateParts(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error('基准日须为 YYYY-MM-DD');
  const d = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== date) throw Error('日期无效');
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}
const iso = (y, m, d) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const descriptions = [
  [/默认取当前自然日期|默认取当前日期|当前自然日/, 'GetDay(0)'],
  [/前一年同日|上一年同日/, 'PRE_ONE_YEAR'],
  [/上一自然年度|上一年度/, 'GetYear(-1)'],
  [/当前自然年度|当前年度/, 'GetYear(0)'],
  [/上一自然季度末|上季度末/, 'GetQuarter(0)'],
  [/最近.*(?:半年末|半年期末)/, 'GetTwoQuarter(0)'],
  [/最新已披露报告期/, 'MRQ'],
];
function dictionary(parameter, context) {
  let values = parameter.dictionary_values;
  if (parameter.dictionary_mode === 'REFERENCE') values = context.dictionaries?.[parameter.dictionary_reference];
  if (values != null && (typeof values !== 'object' || Array.isArray(values))) throw Error('枚举字典格式无法解析');
  if (parameter.dictionary_mode === 'REFERENCE' && !values) throw Error(`引用字典未加载：${parameter.dictionary_reference || '缺少引用'}`);
  if ((parameter.parameter_type === 'ENUM' || parameter.dictionary_mode === 'INLINE') && (!values || !Object.keys(values).length)) throw Error('枚举字典缺失或为空');
  return values;
}
function resolveRule(p, context) {
  const declared = String(p.default_value_type || '').trim();
  const description = String(p.default_value_description || '').trim();
  const matched = [...new Set(descriptions.filter(([r]) => r.test(description)).map(([, rule]) => rule))];
  if (matched.length > 1 || (declared && matched.length && matched[0] !== declared)) throw Error('默认值类型与描述冲突');
  const rule = declared || matched[0];
  const [y, m, d] = dateParts(context.baseDate);
  switch (rule) {
    case 'GetDay(0)': return [context.baseDate, rule];
    case 'PRE_ONE_YEAR': return [iso(y - 1, m, Math.min(d, new Date(Date.UTC(y - 1, m, 0)).getUTCDate())), rule];
    case 'GetYear(-1)': return [String(y - 1), rule];
    case 'GetYear(0)': return [String(y), rule];
    case 'GetQuarter(0)': { const end = new Date(Date.UTC(y, Math.floor((m - 1) / 3) * 3, 0)); return [end.toISOString().slice(0, 10), rule]; }
    case 'GetTwoQuarter(0)': return [context.baseDate >= iso(y, 12, 31) ? iso(y, 12, 31) : context.baseDate >= iso(y, 6, 30) ? iso(y, 6, 30) : iso(y - 1, 12, 31), rule];
    case 'PrevTradingDay(0)': { const day = new Date(`${context.baseDate}T00:00:00Z`); do { day.setUTCDate(day.getUTCDate() - 1); } while ([0, 6].includes(day.getUTCDay())); return [day.toISOString().slice(0, 10), 'PrevTradingDay(0)（仅排除周末）']; }
    case 'MRQ': return ['0001-01-01', rule];
    case 'NewestTradingDay(0)': case 'RealtimeTradingDay()': return [rule, rule];
    default: {
      const values = dictionary(p, context);
      const matches = values ? Object.entries(values).filter(([, label]) => String(label) === description) : [];
      if (matches.length === 1 && !declared) return [matches[0][0], '默认描述匹配字典'];
      throw Error(`默认值为空且规则无法唯一解析${rule ? `：${rule}` : ''}`);
    }
  }
}
export function parameterDefinitions(indicator) {
  const params = indicator.params;
  if (Array.isArray(params)) return params;
  if (!params || !['time', 'enum', 'custom'].every(k => Array.isArray(params[k]))) throw Error('完整参数定义缺失，不能按无参数处理');
  return [...params.time, ...params.enum, ...params.custom];
}
function jsonValue(value) {
  if (value === undefined || (typeof value === 'number' && !Number.isFinite(value)) || typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') throw Error('值不是有效 JSON 类型');
  if (value && typeof value === 'object') Object.values(value).forEach(jsonValue);
}
export function resolveParameters(indicator, overrides = {}, context = {}) {
  context = { ...context, baseDate: context.baseDate || beijingDate() };
  const definitions = parameterDefinitions(indicator), params = {}, sources = {}, seen = new Set();
  for (const p of definitions) {
    const name = p.mnemonic;
    try {
      if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw Error('缺少或非法参数助记符');
      if (seen.has(name)) throw Error('重复参数助记符');
      seen.add(name);
      let value, source;
      if (own(overrides, name)) { value = copy(overrides[name]); source = '自定义'; }
      else if (!empty(p.default_value)) { value = copy(p.default_value); source = '原始默认值'; }
      else [value, source] = resolveRule(p, context);
      if (value === null && p.nullable !== true && p.allow_null !== true) throw Error('参数未声明允许 null');
      if (typeof value === 'string' && !value.trim() && p.allow_empty !== true) throw Error('参数不允许空值');
      jsonValue(value);
      const values = dictionary(p, context);
      if (values && !own(values, String(value))) throw Error(`值不在枚举字典中：${String(value)}`);
      if (/YYYY-MM-DD/i.test(p.value_type || '') && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) dateParts(value);
      else if (/YYYY-MM-DD/i.test(p.value_type || '') && value !== null && !(typeof value === 'string' && /^(GetDay\(0\)|PRE_ONE_YEAR|GetQuarter\(0\)|GetTwoQuarter\(0\)|PrevTradingDay\(0\)|NewestTradingDay\(0\)|RealtimeTradingDay\(\))$/.test(value))) throw Error('日期格式应为 YYYY-MM-DD 或已确认的函数字符串');
      if (/^(INTEGER|INT|NUMBER|FLOAT|DOUBLE|DECIMAL)$/i.test(p.value_type || '') && value !== null && !(typeof value === 'number' || (typeof value === 'string' && /^[-+]?\d+(?:\.\d+)?$/.test(value)))) throw Error('数值格式无效');
      if (/^(INTEGER|INT)$/i.test(p.value_type || '') && !Number.isInteger(Number(value))) throw Error('应为整数');
      if (p.min_value != null && Number(value) < Number(p.min_value)) throw Error(`小于最小值 ${p.min_value}`);
      if (p.max_value != null && Number(value) > Number(p.max_value)) throw Error(`大于最大值 ${p.max_value}`);
      if (p.pattern && !(new RegExp(p.pattern).test(String(value)))) throw Error('值不符合参数允许格式');
      Object.defineProperty(params, name, { value, enumerable: true, writable: true, configurable: true }); sources[name] = source;
    } catch (e) { throw Object.assign(Error(`${name || '未命名参数'}：${e.message}`), { parameter: name || '' }); }
  }
  for (const key of Object.keys(overrides)) if (!seen.has(key)) throw Object.assign(Error(`${key}：自定义参数未在定义中声明`), { parameter: key });
  if (/^\d{4}-\d{2}-\d{2}$/.test(params.BeginDate) && /^\d{4}-\d{2}-\d{2}$/.test(params.EndDate) && params.BeginDate > params.EndDate) throw Object.assign(Error('BeginDate：开始日期晚于结束日期'), { parameter: 'BeginDate' });
  return { params, sources };
}
function apiName(indicator) {
  const raw = String(indicator.apiName || indicator.apiCode || '').trim();
  if (/^(RAGAPI\.)?DATABROWSER$/i.test(raw)) return 'RAGAPI.DataBrowser';
  if (!raw) throw Error('所属 API 缺失');
  return raw.startsWith('RAGAPI.') ? raw : `RAGAPI.${raw}`;
}
function scopeFields(domainId, scope, context) {
  if (scope === undefined) {
    const sector = DOMAIN_RULES[domainId]?.sector;
    if (!sector) throw Error('当前范式的全市场板块编码尚未确认');
    return { SectorNums: sector };
  }
  if (!scope || typeof scope !== 'object') throw Error('指定范围无效');
  const fields = {};
  if (scope.SectorNums != null && typeof scope.SectorNums !== 'string') throw Error('SectorNums 只支持单个板块编码字符串');
  if (scope.SectorNums?.trim()) fields.SectorNums = scope.SectorNums.trim();
  if (scope.GilCodes !== undefined) {
    if (!Array.isArray(scope.GilCodes) || scope.GilCodes.some(x => typeof x !== 'string' || !x.trim())) throw Error('GilCodes 应为非空标的代码的数组');
    const codes = [...new Set(scope.GilCodes.map(x => x.trim()))];
    const validator = context.gilCodeValidators?.[domainId] || (domainId === 'ashare' ? x => /^\d{6}\.(SZ|SH|BJ)$/.test(x) : null);
    if (codes.length && !validator) throw Error('当前市场标的代码校验规则未配置');
    if (codes.some(x => !validator(x))) throw Error('标的代码格式或市场后缀无效');
    if (codes.length) fields.GilCodes = codes;
  }
  if (!Object.keys(fields).length) throw Error('指定范围为空，不会回退到全市场');
  return fields;
}
// Small expression parser: arithmetic, comparisons, AND, text and null operators.
// It never evaluates a filter. Unconfirmed OR/escaping/wildcards are rejected.
function validateExpression(expression, fields) {
  if (typeof expression !== 'string' || expression.length > 10000) throw Error('筛选表达式无效');
  const tokens = []; let at = 0;
  const regex = /\s*(?:("[^"\\\r\n]*")|([A-Za-z_][A-Za-z0-9_]*)|(\d+(?:\.\d+)?)|(>=|<=|<>|[=><+*/()\-]))/y;
  while (at < expression.length) { if (!expression.slice(at).trim()) break; regex.lastIndex = at; const m = regex.exec(expression); if (!m) throw Error('筛选包含未确认的语法或字符串转义'); tokens.push(m[1] ? { kind:'string', value:m[1] } : m[2] ? { kind:'word', value:m[2] } : m[3] ? { kind:'number', value:m[3] } : { kind:'op', value:m[4] }); at = regex.lastIndex; }
  let pos = 0;
  const peek = v => tokens[pos]?.value === v;
  const take = v => { if (!peek(v)) throw Error(`筛选语法错误：应为 ${v}`); pos++; };
  function atom() {
    const t = tokens[pos++]; if (!t) throw Error('筛选表达式不完整');
    if (t.value === '(') { const type = conjunction(); take(')'); return type; }
    if (t.value === '-' || t.value === '+') { const type = atom(); if (type !== 'number') throw Error('数值运算类型不符'); return type; }
    if (t.kind === 'number') return 'number';
    if (t.kind === 'string') { if (/[%*]/.test(t.value)) throw Error('通配符语法尚未确认'); return 'string'; }
    if (t.kind === 'word' && fields.has(t.value)) return fields.get(t.value);
    throw Error(`筛选字段不存在：${t.value}`);
  }
  function product() { let type = atom(); while (peek('*') || peek('/')) { pos++; const right = atom(); if (type !== 'number' || right !== 'number') throw Error('数值运算只支持数值字段'); type = 'number'; } return type; }
  function sum() { let type = product(); while (peek('+') || peek('-')) { pos++; const right = product(); if (type !== 'number' || right !== 'number') throw Error('数值运算只支持数值字段'); type = 'number'; } return type; }
  function comparison() {
    const left = sum(); const op = tokens[pos++]?.value;
    if (op === 'is') { if (peek('not')) pos++; take('null'); return 'boolean'; }
    let textOp = op; if (op === 'not') textOp = `not ${tokens[pos++]?.value}`;
    if (/^(?:not )?(?:like|start|end)$/.test(textOp)) { if (left !== 'string' || sum() !== 'string') throw Error('文本操作只支持文本字段'); return 'boolean'; }
    if (!['=', '<>', '>', '>=', '<', '<='].includes(op)) { pos--; return left; }
    const right = sum();
    if (left !== right || (['>', '>=', '<', '<='].includes(op) && !['number', 'date'].includes(left))) throw Error('筛选比较类型不符');
    return 'boolean';
  }
  function conjunction() { let type = comparison(); while (peek('and')) { pos++; const right = comparison(); if (type !== 'boolean' || right !== 'boolean') throw Error('and 两侧须为条件'); type = 'boolean'; } return type; }
  if (conjunction() !== 'boolean' || pos !== tokens.length) throw Error('筛选表达式应为完整条件，且不支持 OR');
}
function outputType(indicator) {
  const type = indicator.type || indicator.outputType || '';
  return /数值|INTEGER|NUMBER|FLOAT|DOUBLE|DECIMAL/i.test(type) ? 'number' : /日期|DATE/i.test(type) ? 'date' : /文本|字符|STRING|TEXT/i.test(type) ? 'string' : 'unknown';
}
export function buildIndicatorRequests(indicators, options = {}, context = {}) {
  const generationMeta = { baseDate: context.baseDate || beijingDate(context.now), source: context.source || '当前工作版（版本未确认）', instances: {} };
  context = { ...context, baseDate: generationMeta.baseDate };
  const errors = [], requests = [], groups = new Map(), ids = new Set();
  if (!Array.isArray(indicators) || !indicators.length) return { requests, errors:[{ message:'请选择指标' }], generationMeta };
  try { dateParts(context.baseDate); } catch(e) { return { requests, errors:[{ message:e.message }], generationMeta }; }
  for (let i = 0; i < indicators.length; i++) {
    const item = indicators[i], instanceId = item.instanceId || `instance-${i + 1}`, domainId = item.domainId || options.domainId;
    let api, scope, preparationError;
    try {
      if (ids.has(instanceId)) throw Error('重复的内部实例标识'); ids.add(instanceId);
      api = apiName(item); scope = scopeFields(domainId, own(item, 'scope') ? item.scope : options.scope, context);
    } catch(e) { preparationError = e; }
    const groupKey = options.mode === 'separate' ? `single-${i}` : JSON.stringify([api || item.apiName || item.apiCode, domainId, scope || item.scope || options.scope]);
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push({ item, instanceId, domainId, api, scope, preparationError });
  }
  for (const members of groups.values()) {
    const groupErrors = [], expressions = [], counts = new Map(), aliases = new Map(), seenCodes = new Map();
    const fail = (member, e) => groupErrors.push({ instanceId:member.instanceId, indicator:member.item.name || member.item.key || member.instanceId, parameter:e.parameter || '', message:e.message });
    for (const m of members) {
      try {
        if (m.preparationError) throw m.preparationError;
        if (m.api !== 'RAGAPI.DataBrowser' && !context.protocols?.[m.api]) throw Error(`API 协议尚未配置：${m.api}`);
        const ids = m.item.dsIds;
        if (!Array.isArray(ids) || !ids.length || ids.some(x => empty(x))) throw Error('接口编码 dsIds 缺失');
        const code = m.item.interfaceCode != null ? String(m.item.interfaceCode) : ids.length === 1 ? String(ids[0]) : '';
        if (!code || !ids.map(String).includes(code)) throw Error('关联多个接口编码，缺少明确映射');
        if (!/^[A-Za-z0-9_-]+$/.test(code)) throw Error('接口编码格式不支持生成别名');
        m.code = code; counts.set(code, (counts.get(code) || 0) + 1);
      } catch(e) { fail(m, e); }
    }
    for (const m of members) {
      if (!m.code) continue;
      try {
        const resolved = resolveParameters(m.item, m.item.overrides || {}, context);
        const number = (seenCodes.get(m.code) || 0) + 1; seenCodes.set(m.code, number);
        const alias = `${DOMAIN_RULES[m.domainId]?.prefix || m.domainId}_${m.code}${counts.get(m.code) > 1 ? `_${number}` : ''}`;
        aliases.set(m.instanceId, alias); expressions.push({ Code:m.code, Params:resolved.params, Alias:alias });
        generationMeta.instances[m.instanceId] = { ...resolved, alias };
      } catch(e) { fail(m, e); }
    }
    if (!groupErrors.length) {
      try {
        const fields = new Map([['secucode','string'], ['secuname','string'], ...Object.entries(context.systemFields || {})]);
        members.forEach(m => fields.set(aliases.get(m.instanceId), outputType(m.item)));
        const ref = value => { const field = typeof value === 'object' && value?.instanceId ? aliases.get(value.instanceId) : value; if (!fields.has(field)) throw Error(`字段引用不存在：${String(field)}`); return field; };
        const sorts = (options.sorts || []).map(s => { if (!['asc','desc'].includes(s.Sort)) throw Error('排序方向只支持 asc / desc'); return { Field:ref(s.instanceId ? {instanceId:s.instanceId} : s.Field), Sort:s.Sort }; });
        const filters = (options.filters || []).map(f => {
          let express = f.Express;
          if (f.left) {
            const left = ref(f.left), op = f.operator;
            if (!['=','<>','>','>=','<','<=','like','not like','start','not start','end','not end','is null','is not null'].includes(op)) throw Error('筛选操作符未确认');
            const right = f.right?.instanceId ? ref(f.right) : typeof f.right === 'object' && own(f.right || {}, 'field') ? ref(f.right.field) : JSON.stringify(f.right);
            express = op.startsWith('is ') ? `${left} ${op}` : `${left} ${op} ${right}`;
          } else if (f.FilterType !== 'express') throw Error('仅支持 express 筛选');
          validateExpression(express, fields); return { FilterType:'express', Express:express };
        });
        const first = members[0];
        let body = { ApiName:first.api, WriteType:'json2', Version:'2', Compress:false, ...first.scope, Page:null, Sorts:sorts, IndicatorExps:expressions, Filters:filters };
        if (first.api !== 'RAGAPI.DataBrowser') body = context.protocols[first.api]({ body:copy(body), indicators:members.map(m => copy(m.item)) });
        jsonValue(body);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('API 协议未生成有效请求体');
        requests.push({ body, instanceIds:members.map(m => m.instanceId) });
      } catch(e) { fail(members[0], e); }
    }
    errors.push(...groupErrors);
  }
  return { requests, errors, generationMeta };
}
