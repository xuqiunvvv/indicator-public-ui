import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const SCHEMA_VERSION = 'selectx-public-index-2';
export const RULES_VERSION = 'v105-index-2';
// Explicit static-site display scope requested by the owner; management policy is unchanged.
export const DISPLAY_POLICY = {showDsInterfaceId:true,showApiName:true,showApiUri:false};
export const DOMAIN_IDS = ['ashare', 'fund', 'block', 'bond', 'index', 'hkshare'];
const INPUT_KEYS = new Set('default_value default_value_description default_value_type dictionary_mode dictionary_reference dictionary_values mnemonic parameter_description parameter_name parameter_type value_type'.split(' '));
const OUTPUT_KEYS = new Set('param_name param_type param_description filterable computable value_mode values dictionary_reference support_operators'.split(' '));
const INDEX_FIELDS = 'biz_type level1_category level2_category indicator_code indicator_name indicator_type indicator_synonyms indicator_desc indicator_unit indicator_freq is_realtime filter_operators api_name api_uri ds_interface_id input_options output_options is_active'.split(' ');
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export const encode = value => JSON.stringify(canonical(value)) + '\n';
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : encode(value)).digest('hex');
export function publicPointer(p) {
  assert.ok(p && DOMAIN_IDS.includes(p.domainId) && typeof p.archiveId === 'string' && /^[A-Za-z0-9-]+$/.test(p.archiveId), '公开指针缺失或无效');
  assert.ok(typeof p.domainName === 'string' && p.domainName, '范式名称缺失');
  assert.ok(Number.isFinite(Date.parse(p.publishedAt)), '公开时间缺失');
  for (const key of ['showDeprecated', 'showParameters', 'showDsInterfaceId', 'showApiUri', 'allowExport']) assert.equal(typeof p.policy?.[key], 'boolean', `公开策略字段缺失：${key}`);
  const policy=Object.fromEntries(['showDeprecated','showParameters','showDsInterfaceId','showApiUri','allowExport'].map(key=>[key,p.policy[key]]));
  return {domainId:p.domainId, domainName:p.domainName, archiveId:p.archiveId, publishedAt:p.publishedAt, policy:canonical(policy)};
}
function arrayJSON(value, name) {
  assert.equal(typeof value, 'string', `${name}不是JSON文本`);
  const result = JSON.parse(value); assert.ok(Array.isArray(result), `${name}不是数组`); return result;
}
function text(value, label) { assert.equal(typeof value, 'string', `${label}缺失或类型错误`); return value; }
function params(rows, allowed) {
  for (const p of rows) { assert.ok(p && !Array.isArray(p) && typeof p === 'object', '参数格式错误'); for (const key of Object.keys(p)) assert.ok(allowed.has(key), `参数存在未审核字段：${key}`); }
  return structuredClone(rows);
}
export function projectIndexSnapshot(snapshot, expected, archive) {
  const pointer = publicPointer(expected), p = snapshot.publication;
  assert.deepEqual(publicPointer(p), pointer, '快照与已固定公开指针不一致');
  // Check the selected archive itself BEFORE any public endpoint compatibility hydration.
  assert.equal(archive?.archive?.id, p.archiveId, '原始存档ID不一致');
  assert.equal(archive.archive.domainId, p.domainId, '原始存档范式不一致');
  assert.ok(Array.isArray(archive.libraryRows) && archive.libraryRows.length > 0, '指定存档缺完整指标库，禁止跨存档补齐');
  assert.equal(archive.libraryRows.length, archive.archive.totalCount, '原始存档条数不完整');
  const ownKeys = new Set(archive.libraryRows.map(r=>r.key));
  assert.equal(ownKeys.size, archive.libraryRows.length, '原始存档编码重复');
  const visible = archive.libraryRows.filter(r=>p.policy.showDeprecated || r.status !== '已废弃');
  const visibleKeys = new Set(visible.map(r=>r.key));
  const ownRows = new Map(visible.map(r=>[r.key,r]));
  const index = snapshot.indexRows;
  assert.ok(Array.isArray(index), '索引表缺失');
  assert.equal(index.length, visible.length, '索引与指定存档公开范围条数不符');
  assert.equal(snapshot.libraryRows?.length, index.length, '公开明细与索引条数不符');
  assert.equal(p.totalCount, index.length, '公开总数不符');
  const seen = new Set(), libraryRows = [];
  for (const row of index) {
    for (const field of INDEX_FIELDS) assert.ok(Object.hasOwn(row, field), `索引字段缺失：${field}`);
    const key = text(row.indicator_code, '指标编码');
    assert.ok(key && visibleKeys.has(key) && !seen.has(key), '索引编码重复、缺失或不属于指定存档'); seen.add(key);
    const own = ownRows.get(key);
    assert.ok(Array.isArray(own.dsIds) && own.dsIds.every(id=>typeof id==='string'), '指定存档缺DS接口ID字段');
    // V105 index rule: ds_interface_id = (item.dsIds || []).join(',').
    // Public API redacts this column when showDsInterfaceId=false. Restore ONLY this
    // owner-authorized column from the same immutable archive, never another version.
    const dsInterfaceId = own.dsIds.join(',');
    const indexDs = text(row.ds_interface_id,'DS接口ID');
    if(indexDs || p.policy.showDsInterfaceId) assert.equal(indexDs,dsInterfaceId,'索引DS接口ID与指定存档不一致');
    const apiName = text(row.api_name,'API名称');
    assert.equal(apiName,own.apiName || 'DataBrowser','索引API名称与指定存档不一致');
    assert.ok(row.is_active===0 || row.is_active===1, 'is_active必须为0/1');
    assert.ok(row.is_realtime===0 || row.is_realtime===1, 'is_realtime必须为0/1');
    const synonyms = arrayJSON(row.indicator_synonyms, '别名'); assert.ok(synonyms.every(x=>typeof x==='string'), '别名类型错误');
    const operators = arrayJSON(row.filter_operators, '筛选符'); assert.ok(operators.every(x=>typeof x==='string'), '筛选符类型错误');
    const input = params(arrayJSON(row.input_options, '入参'), INPUT_KEYS);
    const output = params(arrayJSON(row.output_options, '出参'), OUTPUT_KEYS);
    const grouped = {time:[], enum:[], custom:[], output:[]};
    for (const param of input) {
      const group = {TIME:'time', ENUM:'enum', CUSTOM:'custom'}[param.parameter_type];
      assert.ok(group, '未知入参类型'); grouped[group].push(param);
    }
    for (const param of output) {
      assert.ok(Array.isArray(param.support_operators), '出参筛选符缺失');
      assert.ok(param.support_operators.every(op=>operators.includes(op)), '出参筛选符与索引筛选符不一致');
    }
    grouped.output = output;
    if (!p.policy.showParameters) for (const key of Object.keys(grouped)) grouped[key]=[];
    libraryRows.push({key, dsInterfaceId, apiName, name:text(row.indicator_name,'指标名称'), l1:text(row.level1_category,'一级分类'), l2:text(row.level2_category,'二级分类'), type:text(row.indicator_type,'类型'), unit:text(row.indicator_unit,'单位'), frequency:text(row.indicator_freq,'频率'), description:text(row.indicator_desc,'介绍'), synonyms, isRealtime:row.is_realtime?'是':'否', status:row.is_active?'有效':'已废弃', filterOperators:operators, params:grouped});
  }
  const effectiveCount = libraryRows.filter(r=>r.status==='有效').length, deprecatedCount=libraryRows.length-effectiveCount;
  assert.equal(p.effectiveCount,effectiveCount,'有效数不符'); assert.equal(p.deprecatedCount,deprecatedCount,'废弃数不符');
  if (!p.policy.showDeprecated) assert.equal(deprecatedCount,0,'公开策略禁止废弃指标');
  libraryRows.sort((a,b)=>a.key.localeCompare(b.key,'en'));
  return {publication:{...pointer,totalCount:libraryRows.length,effectiveCount,deprecatedCount},displayPolicy:DISPLAY_POLICY,libraryRows};
}
export function prepareRelease(bundles) {
  assert.ok(bundles.length>0,'无公开版本，不自动清空站点');
  const seen=new Set(), snapshots={}, domains=[];
  for (const {pointer,snapshot,archive} of bundles) {
    assert.ok(!seen.has(pointer.domainId),'范式重复');seen.add(pointer.domainId);
    const projected=projectIndexSnapshot(snapshot,pointer,archive);
    snapshots[pointer.domainId]=projected;
    domains.push({domainId:pointer.domainId,domainName:pointer.domainName,archiveId:pointer.archiveId,count:projected.libraryRows.length,policy:projected.publication.policy,sha256:hash(projected)});
  }
  domains.sort((a,b)=>DOMAIN_IDS.indexOf(a.domainId)-DOMAIN_IDS.indexOf(b.domainId));
  return {manifest:{schemaVersion:SCHEMA_VERSION,projectionRulesVersion:RULES_VERSION,displayPolicy:DISPLAY_POLICY,domains},snapshots};
}
