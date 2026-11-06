// Shared by the browser, workbook exports and server writes. Never strip punctuation blindly.
(() => {
  function list(value, indicatorName = "") {
    const values = [];
    function collect(input) {
      if (input == null || input === "") return;
      if (Array.isArray(input)) {
        for (const item of input) {
          if (typeof item !== "string") throw new Error("别名/同义词数组只能包含文本，不能包含对象、数字或嵌套数组");
          collect(item);
        }
        return;
      }
      if (typeof input !== "string") throw new Error("别名/同义词必须为文本或文本数组");
      const text = input.trim();
      if (!text) return;
      if (text.startsWith("[")) {
        let parsed;
        try { parsed = JSON.parse(text); } catch {
          throw new Error("别名/同义词疑似损坏的JSON数组；请改为逗号或换行分隔的完整别名，不要直接删除引号或括号");
        }
        if (!Array.isArray(parsed)) throw new Error("别名/同义词JSON必须为文本数组");
        collect(parsed);
      } else {
        if (/^\]|^["“”].*["“”]\s*\]$|^【\s*["“”]/s.test(text)) throw new Error("别名/同义词含疑似残留的数组引号或括号，请核对完整别名后再保存");
        values.push(...text.split(/[\r\n,，、;；]+/));
      }
    }
    collect(value);
    const seen = new Set([String(indicatorName || "").trim().toLowerCase()]);
    const result = [];
    for (const raw of values) {
      const alias = raw.trim();
      if (!alias || seen.has(alias.toLowerCase())) continue;
      if (/^\]|^["“”].*["“”]\s*\]$|^【\s*["“”]/s.test(alias)) throw new Error("别名/同义词含疑似残留的数组引号或括号，请核对完整别名后再保存");
      if (alias.length > 50) throw new Error(`单个别名/同义词不能超过50个字符：${alias.slice(0, 20)}…`);
      seen.add(alias.toLowerCase());
      result.push(alias);
    }
    if (result.length > 20) throw new Error("单个指标最多维护20个别名/同义词");
    return result;
  }
  const normalize = (value, name = "") => list(value, name).join("\n");
  function normalizeRecord(record) {
    record.synonyms = normalize(record.synonyms, record.selectedName || record.name || record.dsName);
    return record;
  }
  function inspect(value, name = "") {
    try {
      const normalized = normalize(value, name);
      return { kind: normalized === (value ?? "") ? "compliant" : "normalizable", normalized };
    } catch (error) { return { kind: "pending", reason: error.message }; }
  }
  globalThis.IndicatorSynonymRules = Object.freeze({ list, normalize, normalizeRecord, inspect });
})();
