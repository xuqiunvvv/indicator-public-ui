// One rule registry shared by the browser, exports and Worker. No domain-specific defaults.
(() => {
  const capabilities = ["系统推荐", "可筛选且可计算", "仅筛选", "仅计算", "不可筛选不可计算"];
  const nulls = ["IS_NULL", "IS_NOT_NULL"];
  const comparable = ["EQ", "NE", "GT", "GE", "LT", "LE"];
  const textual = ["LIKE", "NOT_LIKE", "START_WITH", "NOT_START_WITH", "END_WITH", "NOT_END_WITH"];
  function typeOf(value) {
    const type = String(value || "").toUpperCase();
    if (/PERCENT|百分/.test(type)) return "百分数";
    if (/DATE|TIME|日期/.test(type)) return "日期型";
    if (/ENUM|枚举/.test(type)) return "枚举型";
    if (/STRING|TEXT|文本/.test(type)) return "文本型";
    return "数值型";
  }
  const canCompute = (type) => ["数值型", "百分数"].includes(typeOf(type));
  function operators(type, filterable = true) {
    if (!filterable) return [];
    type = typeOf(type);
    return [...nulls, ...(type === "文本型" ? textual : type === "枚举型" ? ["EQ", "NE"] : comparable)];
  }
  function fromLabel(label, type, existing = null, { update = false } = {}) {
    label = String(label || "").trim();
    if (!label && update && existing) return flags(existing, type);
    if (label === "可筛选") {
      // Legacy label did not encode computation. Never interpret it as computation=false.
      return { filterable: true, computable: update && typeof existing?.computable === "boolean" ? existing.computable : canCompute(type) };
    }
    if (!label || label === "系统推荐") return { filterable: true, computable: canCompute(type) };
    const values = { "可筛选且可计算": [true, true], "仅筛选": [true, false], "仅计算": [false, true], "不可筛选不可计算": [false, false] }[label];
    if (!values) throw new Error("出参能力不在标准选项中");
    if (values[1] && !canCompute(type)) throw new Error(`${typeOf(type)}不支持加减乘除，请选择“仅筛选”或“不可筛选不可计算”`);
    return { filterable: values[0], computable: values[1] };
  }
  function flags(option = {}, type) {
    return { filterable: option.filterable ?? true, computable: option.computable ?? canCompute(type || option.param_type) };
  }
  function label(option = {}, type) {
    const f = flags(option, type);
    return f.filterable ? (f.computable ? "可筛选且可计算" : "仅筛选") : (f.computable ? "仅计算" : "不可筛选不可计算");
  }
  function normalizeOption(option, type) {
    const normalizedType = typeOf(type || option.param_type);
    const f = flags(option, normalizedType);
    return { ...option, param_type: normalizedType, ...f, support_operators: operators(normalizedType, f.filterable) };
  }
  function validate(option, type) {
    if (typeof option?.filterable !== "boolean" || typeof option?.computable !== "boolean") return "出参筛选与计算能力必须为布尔值";
    if (option.computable && !canCompute(type || option.param_type)) return `${typeOf(type || option.param_type)}不支持加减乘除，请明确调整出参能力`;
    const expected = operators(type || option.param_type, option.filterable);
    if (!Array.isArray(option.support_operators) || JSON.stringify(option.support_operators) !== JSON.stringify(expected)) return "筛选操作符与指标类型、出参能力不一致";
    return "";
  }
  function normalizeRecord(record) {
    if (!record || typeof record !== "object") return record;
    if (record.sourceType === "CUSTOM" || (record.sourceKey && !record.rawKey && ["CUSTOM", "DS_CANDIDATE"].includes(record.sourceType))) {
      delete record.selectedName; delete record.selectedType; delete record.selected;
    }
    const output = Array.isArray(record.outputOptions) && record.outputOptions.length ? record.outputOptions : Array.isArray(record.params?.output) ? record.params.output : [];
    if (!output.length) return record;
    record.outputOptions = output.map((option) => normalizeOption({ ...option,
      param_name: nameOf(record) || option.param_name || "",
      param_description: Object.hasOwn(record, "description") ? record.description : option.param_description,
    }, record.selectedType || record.type || option.param_type));
    if (record.params) record.params.output = record.outputOptions;
    record.filterOperators = [...record.outputOptions[0].support_operators];
    return record;
  }
  function validateRecord(record) {
    const output = record.outputOptions?.length ? record.outputOptions : record.params?.output || [];
    return output.map((option) => validate(option, record.selectedType || record.type || option.param_type)).find(Boolean) || "";
  }
  function nameOf(record) {
    const isDs = record.sourceType === "DS_CANDIDATE" || (!record.sourceType && record.rawKey && record.selected);
    return String((isDs ? record.selectedName || record.name || record.dsName : record.name || record.selectedName || record.dsName) || "");
  }
  // Complete source projection. Empty values are data, not requests to resurrect a stale copy.
  function projectSource(source, sourceType, existing = {}, today = new Date().toISOString().slice(0, 10)) {
    const ds = sourceType === "DS_CANDIDATE";
    const copy = (value) => JSON.parse(JSON.stringify(value));
    const included = source.status === (ds ? "已复用" : "已纳入");
    const code = existing.key || (ds ? source.libraryKey : source.key);
    if (!code || (!included && !existing.key)) return null;
    const params = Object.fromEntries(["time", "enum", "custom"].map(group => [group, copy(source.params?.[group] || [])]));
    const outputOptions = copy(source.outputOptions?.length ? source.outputOptions : source.params?.output || []);
    const outputSource = source.outputSource ?? source.params?.outputSource ?? source.output ?? "";
    const inputOptions = [...params.time, ...params.enum, ...params.custom];
    const result = { ...existing, key: code, sourceKey: ds ? source.rawKey || source.key : source.sourceKey || source.key,
      sourceType, source: ds ? "DS候选集复用" : "选X新增",
      name: ds ? source.selectedName || source.name || source.dsName : source.name,
      l1: ds ? source.selected?.l1 || "" : source.l1, l2: ds ? source.selected?.l2 || "" : source.l2,
      type: ds ? source.selectedType || source.type : source.type,
      unit: source.unit ?? "", frequency: source.frequency, isRealtime: source.isRealtime,
      description: source.description ?? "", synonyms: source.synonyms ?? "",
      dsIds: [...new Set(source.dsIds?.length ? source.dsIds : ds && source.id ? [source.id] : [])],
      apiCode: source.apiCode || "DATABROWSER", apiName: source.apiName || "DataBrowser", apiUri: source.apiUri ?? "",
      params: { ...params, output: outputOptions, outputSource }, inputOptions, outputOptions, outputSource, output: outputSource,
      parameterCount: inputOptions.length, status: included ? "有效" : "已废弃",
      includedAt: existing.includedAt || source.includedAt || today,
      deprecatedAt: included ? "" : existing.deprecatedAt || today,
      parameterAudit: existing.parameterAudit || { status: "无需比对", issues: [] },
    };
    delete result.selectedName; delete result.selectedType; delete result.selected;
    return normalizeRecord(result);
  }
  globalThis.IndicatorOutputRules = Object.freeze({ version: "20261026-v2", capabilities, typeOf, canCompute, operators, flags, label, fromLabel, normalizeOption, normalizeRecord, validate, validateRecord, nameOf, projectSource });
})();
