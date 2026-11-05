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
