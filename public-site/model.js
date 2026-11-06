export function filterRows(rows, { query = '', l1 = '', l2 = '', status = '' } = {}) {
  const search = query.trim().toLocaleLowerCase();
  return rows.filter(r => (!l1 || r.l1 === l1) && (!l2 || r.l2 === l2) && (!status || r.status === status) && (!search || [r.key, r.dsInterfaceId, r.name, r.synonyms, r.description].join(' ').toLocaleLowerCase().includes(search)));
}
export function pageRows(rows, page = 1, size = 20) {
  const pages = Math.max(1, Math.ceil(rows.length / size)), current = Math.max(1, Math.min(page, pages)), start = (current - 1) * size;
  return { page: current, pages, start, rows: rows.slice(start, start + size) };
}
export function validateSnapshot(snapshot, expected) {
  const p = snapshot?.publication, rows = snapshot?.libraryRows;
  if (!p || p.domainId !== expected.domainId || p.archiveId !== expected.archiveId || !Array.isArray(rows) || rows.length !== p.totalCount || rows.length !== expected.count) throw new Error('公开版本或指标数量不一致');
  const keys = new Set(rows.map(r => r.key)); if (keys.size !== rows.length || keys.has(undefined) || keys.has('')) throw new Error('指标编码重复或缺失');
  if (p.policy?.showDeprecated !== true && rows.some(r => r.status === '已废弃')) throw new Error('公开策略不允许展示废弃指标');
  if(snapshot.maintenance)maintenanceForSelection(snapshot,[]);
}
export function maintenanceForSelection(snapshot,selected=[]){
 const m=snapshot?.maintenance,rows=snapshot?.libraryRows||[];
 if(m?.scope!=='LIBRARY_ONLY'||!Array.isArray(m.libraryLinks)||!Array.isArray(m.indicators)||!Array.isArray(m.parameters)||!Array.isArray(m.timeDefaultRuleOptions))throw Error('公开存档缺少完整冻结参数维护表');
 const codes=new Set(rows.map(r=>r.key)),chosen=new Set(selected.length?selected:codes),sources=new Map(m.indicators.map(r=>[r['导入记录ID'],r])),seen=new Set(),ids=new Set();
 if([...chosen].some(k=>!codes.has(k))||sources.size!==m.indicators.length)throw Error('所选指标或来源唯一键不正确');
 for(const link of m.libraryLinks){if(!codes.has(link.indicatorCode)||seen.has(link.indicatorCode)||sources.get(link.importRecordId)?.['指标唯一键']!==link.sourceKey)throw Error('冻结维护表关联错误');seen.add(link.indicatorCode);if(chosen.has(link.indicatorCode))ids.add(link.importRecordId);}
 if(seen.size!==codes.size)throw Error('冻结维护表遗漏库内指标');
 for(const p of m.parameters)if(sources.get(p['导入记录ID'])?.['指标唯一键']!==p['指标唯一键'])throw Error('冻结参数关联错误');
 return structuredClone({indicators:m.indicators.filter(r=>ids.has(r['导入记录ID'])),parameters:m.parameters.filter(r=>ids.has(r['导入记录ID'])),timeDefaultRuleOptions:m.timeDefaultRuleOptions});
}
export function presentationSnapshot(snapshot, expected) {
  validateSnapshot(snapshot, expected);
  if (!expected.policy || Object.keys(expected.policy).some(key => snapshot.publication.policy?.[key] !== expected.policy[key])) throw new Error('公开策略与已核对清单不一致');
  const p = snapshot.publication, policy = p.policy;
  const fields = ['key','name','l1','l2','status','unit','frequency','isRealtime','type','description','synonyms','includedAt','deprecatedAt'];
  return {
    publication: { domainId:p.domainId, domainName:p.domainName, archiveId:p.archiveId, publishedAt:p.publishedAt, policy, totalCount:p.totalCount, effectiveCount:p.effectiveCount, deprecatedCount:p.deprecatedCount },
    libraryRows: snapshot.libraryRows.map(row => ({ ...Object.fromEntries(fields.map(f => [f, row[f] ?? ''])), params: Object.fromEntries(['time','enum','custom','output'].map(group => [group, policy.showParameters ? row.params?.[group] || [] : []])) })),
  };
}
