(() => {
  const outputRules = globalThis.IndicatorOutputRules;
  const canonicalRecord = (item) => {
    const copy = outputRules.normalizeRecord(JSON.parse(JSON.stringify(item)));
    try { return globalThis.IndicatorSynonymRules.normalizeRecord(copy); }
    catch (error) { throw new Error(`指标 ${item.rawKey || item.sourceKey || item.key || ""}（${item.selectedName || item.name || item.dsName || "未命名"}）：${error.message}`); }
  };
  const canonicalMaintenanceRecord = (item) => {
    const copy = outputRules.normalizeRecord(JSON.parse(JSON.stringify(item)));
    const inspection = globalThis.IndicatorSynonymRules.inspect(copy.synonyms, copy.selectedName || copy.name || copy.dsName);
    // Maintenance exports must remain usable for correcting damaged historical values.
    copy.synonyms = inspection.kind === "pending"
      ? (typeof copy.synonyms === "string" ? copy.synonyms : JSON.stringify(copy.synonyms ?? ""))
      : inspection.normalized;
    return copy;
  };
  const standardColumns = [
    "指标分类①", "指标分类②", "指标名称", "别名/同义词", "指标状态", "单位描述", "指标频率", "是否支持实时", "指标类型", "指标介绍",
    "时间型入参", "枚举型入参", "自定义入参", "出参筛选枚举值", "对应DS接口ID",
  ];
  const parameterColumns = [
    "指标分类①", "指标分类②", "指标编码", "指标名称", "指标状态", "指标频率", "是否支持实时", "对应DS接口ID",
    "参数类型", "参数序号", "参数名称", "参数助记符", "参数描述", "参数值格式", "参数默认值",
    "参数默认值描述", "参数字典值", "标准参数JSON",
  ];
  const indicatorIndexColumns = [
    "biz_type", "level1_category", "level2_category", "indicator_code", "indicator_name", "indicator_type",
    "indicator_synonyms", "indicator_desc", "indicator_unit", "indicator_freq", "is_realtime", "filter_operators",
    "api_name", "api_uri", "ds_interface_id", "input_options", "output_options", "is_active",
  ];
  const bizTypeValues = ["A股", "基金", "板块", "债券", "港股", "美股", "指数", "行业", "概念", "基金经理", "工商"];
  const customImportColumns = [
    "导入记录ID", "指标分类①", "指标分类②", "指标名称", "别名/同义词", "单位描述", "指标频率", "指标类型", "指标介绍",
    "所属API", "对应DS接口ID", "维护状态", "出参能力", "出参枚举方式", "出参枚举值列表", "出参字典引用",
  ];
  const customParameterImportColumns = [
    "导入记录ID", "指标名称", "参数序号", "参数名称", "参数助记符", "参数描述", "参数类型",
    "参数值格式", "默认参数类型", "参数默认值", "参数默认值描述", "字典方式", "参数字典值", "参数字典引用",
  ];
  const unifiedIndicatorColumns = [
    "操作类型", "导入记录ID", "指标唯一键", "原DS接口ID", "DS接口ID", "指标分类①", "指标分类②", "指标名称", "别名/同义词", "单位描述", "指标频率", "是否支持实时", "指标类型", "指标介绍", "所属API", "维护状态", "出参能力", "出参枚举方式", "出参枚举值列表", "出参字典引用",
  ];
  const unifiedParameterColumns = [
    "操作类型", "导入记录ID", "指标唯一键", "指标名称", "参数序号", "参数名称", "参数助记符", "参数描述", "参数类型", "参数值格式", "默认参数类型", "参数默认值", "参数默认值描述", "字典方式", "参数字典值", "参数字典引用",
  ];
  const unifiedOptionLists = {
    "操作类型": ["新增", "更新"],
    "指标频率": ["静态", "交易日", "截止日", "区间", "季频", "半年频", "年频"],
    "是否支持实时": ["是", "否"],
    "指标类型": ["数值型", "文本型", "百分数", "日期型", "枚举型"],
    "维护状态": ["草稿", "待处理", "待开发", "待确认", "已复用", "已纳入", "剔除"],
    "出参能力": [...outputRules.capabilities],
    "枚举方式": ["NONE", "INLINE", "REFERENCE"],
    "参数类型": ["日期", "开始日期", "结束时间", "枚举", "文本", "无参数"],
    "参数值格式": ["YYYY-MM-DD", "YYYY", "INTEGER"],
    "默认参数类型": ["MRQ", "GetQuarter(0)", "PrevTradingDay(0)", "NewestTradingDay(0)", "RealtimeTradingDay()", "PRE_ONE_YEAR", "GetYear(-1)", "GetYear(0)", "GetDay(0)"],
    "所属API": ["DataBrowser"],
  };
  const unifiedGuideColumns = ["工作表", "字段", "必填性", "填写规范"];
  const unifiedGuideRows = [
    { "工作表": "V5 使用规则", "字段": "新增指标导入", "必填性": "场景规则", "填写规范": "操作类型=新增；新增选X模块自动写入指标来源“新增指标池”，DS候选池模块自动写入“DS候选集”。" },
    { "工作表": "V5 使用规则", "字段": "导出参数维护", "必填性": "场景规则", "填写规范": "操作类型、DS接口ID留空；维护状态为系统当前实际状态，其余字段为系统最新值。" },
    { "工作表": "V5 使用规则", "字段": "导入参数维护", "必填性": "场景规则", "填写规范": "操作类型=更新；指标唯一键、原DS接口ID用于定位及核验。DS接口ID留空表示不更新，填写时直接填写更新后的完整结果。" },
    { "工作表": "V5 使用规则", "字段": "参数覆盖", "必填性": "场景规则", "填写规范": "某指标在参数明细中出现任一行时，以该指标全部导入行完整覆盖原入参；未出现参数明细行时保留原入参。" },
    { "工作表": "V5 使用规则", "字段": "批量校验", "必填性": "系统校验", "填写规范": "确认前全文件校验，任一行校验失败不写入业务数据；确认后分批提交，进度弹窗列出已保存、失败和未处理项，失败不代表已保存项回滚。" },
    { "工作表": "指标清单", "字段": "导入记录ID", "必填性": "新增/更新必填", "填写规范": "同一指标在两张数据表中使用相同且在本文件内唯一的ID。" },
    { "工作表": "指标清单", "字段": "指标唯一键 / 原DS接口ID", "必填性": "按场景", "填写规范": "更新时指标唯一键必填；系统当前有DS接口ID时，原DS接口ID必须一致；当前无ID允许原DS接口ID留空。新ID填DS接口ID列。" },
    { "工作表": "指标清单", "字段": "出参配置", "必填性": "条件必填", "填写规范": "枚举方式为INLINE时填写枚举值列表；为REFERENCE时填写字典引用；两者不可同时填写。" },
    { "工作表": "指标参数明细", "字段": "参数序号", "必填性": "有参数时必填", "填写规范": "同一指标从1开始连续递增；无参数时不填写任何参数明细行。" },
    { "工作表": "指标参数明细", "字段": "字典方式", "必填性": "有参数时必填", "填写规范": "TIME、CUSTOM使用NONE；ENUM按取值来源选择INLINE、REFERENCE或NONE。" },
    { "工作表": "下拉参考", "字段": "操作类型", "必填性": "一字段一行", "填写规范": unifiedOptionLists["操作类型"].join("、") },
    { "工作表": "下拉参考", "字段": "指标频率", "必填性": "一字段一行", "填写规范": unifiedOptionLists["指标频率"].join("、") },
    { "工作表": "下拉参考", "字段": "指标类型", "必填性": "一字段一行", "填写规范": unifiedOptionLists["指标类型"].join("、") },
    { "工作表": "下拉参考", "字段": "维护状态", "必填性": "一字段一行", "填写规范": unifiedOptionLists["维护状态"].join("、") },
    { "工作表": "下拉参考", "字段": "出参能力", "必填性": "一字段一行", "填写规范": unifiedOptionLists["出参能力"].join("、") },
    { "工作表": "下拉参考", "字段": "出参枚举方式 / 字典方式", "必填性": "一字段一行", "填写规范": unifiedOptionLists["枚举方式"].join("、") },
    { "工作表": "下拉参考", "字段": "参数类型", "必填性": "一字段一行", "填写规范": unifiedOptionLists["参数类型"].join("、") },
    { "工作表": "下拉参考", "字段": "参数值格式", "必填性": "一字段一行", "填写规范": unifiedOptionLists["参数值格式"].join("、") },
    { "工作表": "下拉参考", "字段": "默认参数类型", "必填性": "一字段一行", "填写规范": unifiedOptionLists["默认参数类型"].join("、") },
    { "工作表": "下拉参考", "字段": "所属API", "必填性": "一字段一行", "填写规范": unifiedOptionLists["所属API"].join("、") },
  ];
  const unifiedGuideRowsV6 = [
    ["通用", "导入记录ID", "必填", "同一指标在两个工作表中必须使用完全相同的ID；建议格式 ASHR-ADD-000001。本次导入文件内必须唯一。"],
    ["通用", "操作类型", "按场景填写", "新增指标导入填写“新增”；导入参数维护填写“更新”；导出参数维护必须留空。"],
    ["通用", "指标唯一键 / 原DS接口ID", "按场景填写", "新增时两张数据表的指标唯一键、指标清单的原DS接口ID均留空。更新时指标唯一键必填；当前有DS接口ID则原DS接口ID必须一致，当前无ID则原DS接口ID允许留空；新ID填写在DS接口ID列。"],
    ["指标清单", "DS接口ID", "选填", "新增时可填写；更新时留空表示不更新，需更新时直接填写更新后的完整DS接口ID结果；多个ID可用逗号、顿号或换行分隔。导出时必须留空。"],
    ["指标清单", "指标分类① / 指标分类②", "新增必填 / 更新可填", "填写选X目录，不填写DS目录。一级、二级分类和指标名称共同参与重复指标校验。"],
    ["指标清单", "指标名称", "新增必填 / 更新可填", "填写面向选X使用的标准名称；同一二级目录下不得与现有指标或本次导入的其他指标重名。"],
    ["指标清单", "别名/同义词", "选填 / 更新可填", "换行、逗号、顿号或分号分隔，兼容合法JSON文本数组；去空、忽略大小写去重并剔除指标名称。单项≤50字、每指标≤20项。更新：留空保持，[]清空，非空完整替换。导出：正常项一项一行，无别名留空；异常保留原文并另附待核对清单，核对后才能回导。只有索引表使用JSON数组。"],
    ["指标清单", "单位描述", "选填", "新增：填写元、万元、亿元、%、次、股等，无单位留空。更新：留空保留原单位；填写[]清空；填写具体内容则替换。"],
    ["指标清单", "指标频率", "新增必填 / 下拉", "只能选择静态、交易日、截止日、区间、季频、半年频、年频；“实时”不再作为频率填写。"],
    ["指标清单", "是否支持实时", "新增必填 / 下拉", "填写“是”或“否”。新增时必填；更新时留空表示不更新；导出参数维护时导出系统当前值。仅指标索引表以1、0导出。"],
    ["指标清单", "指标类型", "新增必填 / 下拉", "只能选择数值型、文本型、百分数、日期型、枚举型；筛选操作符由系统按指标类型自动生成。"],
    ["指标清单", "指标介绍", "新增必填 / 更新可填", "简要说明业务含义、统计口径和适用场景，不填写参数或枚举明细。"],
    ["指标清单", "所属API", "选填 / 下拉", "默认DataBrowser；使用其他API前，须先在管理系统的API配置中启用。"],
    ["指标清单", "维护状态", "选填 / 下拉", "新增默认待处理，批量新增不允许直接填写“已纳入”；导出时必须保留系统实际状态，例如已复用或已纳入。"],
    ["指标清单", "出参能力", "选填 / 下拉", "系统推荐：数值型、百分数默认可筛选且可计算，其他类型默认仅筛选。明确值：可筛选且可计算、仅筛选、仅计算、不可筛选不可计算。计算仅指加减乘除，仅数值型、百分数支持。更新留空保持原能力；导出填写实际能力，不填写系统推荐。旧值可筛选在更新时保留原计算能力。"],
    ["指标清单", "筛选操作符", "系统生成", "禁止筛选时support_operators和索引filter_operators均为[]，仍保留枚举展示值。数值型、百分数、日期型：EQ/NE/GT/GE/LT/LE及空值判断；枚举型：EQ/NE及空值判断；文本型：文本判断及空值判断，不支持EQ/NE。全部移除IN，多值任选使用多个EQ加OR；AND/OR不写入操作符列表。"],
    ["指标清单", "出参枚举方式", "选填 / 下拉", "NONE表示无枚举；INLINE表示直接维护枚举值列表；REFERENCE表示引用外部参数字典。"],
    ["指标清单", "出参枚举值列表", "条件必填", "仅INLINE填写，例如主板、创业板、科创板；与出参字典引用只能填写一个。"],
    ["指标清单", "出参字典引用", "条件必填", "仅REFERENCE填写参数字典名称或编码；与出参枚举值列表只能填写一个。"],
    ["指标参数明细", "无参数指标", "无需记录", "新增且无入参时不填写明细。更新时某指标无明细行=保留原全部参数；有任一行=以该指标本次全部明细完整替换，未列出的原参数删除。禁止空白占位行，不以零行清空原参数。"],
    ["指标参数明细", "参数序号", "必填", "同一指标从1开始顺序递增，用于控制标准JSON中的参数顺序。"],
    ["指标参数明细", "参数名称 / 助记符 / 描述", "必填", "参数名称和助记符不得为空；同一指标、同一参数类型下助记符不得重复；描述简要说明业务含义。"],
    ["指标参数明细", "参数类型", "必填 / 下拉", "日期、开始日期、结束时间映射为TIME；枚举映射为ENUM；文本映射为CUSTOM。"],
    ["指标参数明细", "参数值格式", "条件必填 / 下拉", "时间参数选择YYYY-MM-DD或YYYY；自定义整数选择INTEGER；枚举参数及普通文本参数留空。"],
    ["指标参数明细", "默认参数类型", "时间参数必填 / 下拉", "只能选择“上架任务 → 时间默认参数规则”中已启用且已保存的规则；下载时下拉值会按该规则库生成。"],
    ["指标参数明细", "参数默认值", "按规则填写", "必须与所选规则的“默认参数”完全一致；规则默认参数为空时本字段留空。枚举参数填写枚举代码。"],
    ["指标参数明细", "参数默认值描述", "按规则填写", "必须与所选规则的“默认参数描述”完全一致；请勿按历史模板或自行改写。"],
    ["指标参数明细", "字典方式", "必填 / 下拉", "TIME和CUSTOM固定选择NONE；ENUM按取值来源选择INLINE、REFERENCE或NONE。"],
    ["指标参数明细", "参数字典值", "条件必填", "仅INLINE填写，每项使用“代码-枚举值”，建议一项一行；默认值必须命中字典代码。"],
    ["指标参数明细", "参数字典引用", "条件必填", "仅REFERENCE填写，例如金融机构-FINANCIAL_INSTITUTION；与参数字典值只能填写一个。"],
    ["校验规则", "整批导入", "系统校验", "只更新导入文件内的指标。任一行校验失败则整批不写入；修改错误后重新导入。"],
    ["使用规则", "新增指标导入", "场景规则", "操作类型=新增；填写新增所需字段。指标来源由所在模块自动写入：新增选X模块为“新增指标池”，DS候选池模块为“DS候选集”。"],
    ["使用规则", "导出参数维护", "场景规则", "导出行的操作类型、DS接口ID必须留空；维护状态导出系统当前实际状态（例如“已复用”或“已纳入”），其余字段为系统最新值。"],
    ["使用规则", "导入参数维护", "场景规则", "操作类型=更新；指标唯一键、原DS接口ID用于定位及核验。DS接口ID为空=不更新；如需更新，直接填写更新后的完整DS接口ID结果。"],
    ["使用规则", "可更新字段", "场景规则", "指标清单：DS接口ID、分类①/②、名称、别名/同义词、单位、频率、类型、介绍、API、维护状态及全部出参字段；参数明细：名称至字典引用的全部字段。"],
    ["使用规则", "参数覆盖", "场景规则", "某指标存在任一参数明细行时，按导入行完整覆盖其参数；未出现参数明细行时保持原参数不变。"],
    ["使用规则", "批量校验", "系统校验", "确认前全文件预检，校验失败不写入业务数据。确认后分批保存，弹窗展示真实进度；中断后已保存项保留，查询任务结果后继续未完成项。原DS接口ID必须与现值一致，双方均空允许通过。"],
    ...Object.entries(unifiedOptionLists).map(([field, values]) => ["下拉值参考", field, "可选值", values.join("、")]),
  ].map((row) => ({ "工作表": row[0], "字段": row[1], "必填性": row[2], "填写规范": row[3] }));
  const standardizedCandidateColumns = [
    "原始唯一键", "序号", "DS一级目录", "DS二级目录", "DS三级目录", "选X分类①", "选X分类②",
    "指标名称", "指标类型", "指标频率", "指标同义词", "指标介绍", "指标单位", "筛选操作符",
    "所属API", "API路径", "DS接口ID", "入参选项", "出参选项", "处理状态",
  ];
  const outputMaintenanceColumns = [
    "原始唯一键", "序号", "DS接口ID", "指标名称", "出参项序号", "出参名称", "出参类型", "出参描述",
    "是否可筛选", "是否可计算", "枚举方式", "枚举值列表", "字典引用",
  ];
  const inputMaintenanceColumns = [
    "指标来源", "指标唯一键", "序号", "DS接口ID", "指标名称", "参数序号", "参数名称", "参数助记符",
    "参数描述", "参数类型", "参数值格式", "默认参数类型", "参数默认值", "参数默认值描述", "字典方式",
    "参数字典值", "参数字典引用",
  ];
  const genericOutputMaintenanceColumns = [
    "指标来源", "指标唯一键", "序号", "DS接口ID", "指标名称", "出参项序号", "出参名称", "出参类型",
    "出参描述", "是否可筛选", "是否可计算", "枚举方式", "枚举值列表", "字典引用",
  ];
  const customImportOptionLists = {
    "指标频率": ["静态", "实时", "交易日", "截止日", "区间", "季频", "半年频", "年频"],
    "指标类型": ["数值型", "文本型", "百分数", "日期型", "枚举型"],
    "维护状态": ["草稿", "待处理", "待开发", "待确认", "剔除"],
    "出参能力": [...outputRules.capabilities],
    "枚举方式": ["NONE", "INLINE", "REFERENCE"],
    "参数类型": ["日期", "开始日期", "结束时间", "枚举", "文本"],
    "参数值格式": ["YYYY-MM-DD", "YYYY", "INTEGER"],
    "默认参数类型": ["MRQ", "GetQuarter(0)", "PrevTradingDay(0)", "NewestTradingDay(0)", "RealtimeTradingDay()", "PRE_ONE_YEAR", "GetYear(-1)", "GetYear(0)", "GetDay(0)"],
    "所属API": ["DataBrowser"],
  };
  const customImportInstructionColumns = [
    "工作表", "字段", "必填性", "填写规范", "", "指标频率", "指标类型", "维护状态", "出参能力",
    "枚举方式", "参数类型", "参数值格式", "默认参数类型", "所属API",
  ];
  const customImportInstructions = [
    ["通用", "导入记录ID", "必填", "同一指标在两个工作表中必须使用完全相同的ID；建议格式 ASHR-ADD-000001。ID在本次导入文件内必须唯一。"],
    ["新增指标清单", "指标分类①/②", "必填", "填写选X目录，不填写DS目录。一级、二级分类和指标名称共同用于重复指标校验。"],
    ["新增指标清单", "指标名称", "必填", "填写面向选X使用的标准名称；同一二级目录下不得与现有指标或本次导入的其他指标重名。"],
    ["新增指标清单", "别名/同义词", "选填", "支持换行、逗号、顿号或分号分隔；系统自动去空、去重并剔除与指标名称相同的内容。单个别名不超过50个字符，单个指标最多20个别名。"],
    ["新增指标清单", "单位描述", "选填", "填写元、万元、亿元、%、次、股等；无单位时留空。"],
    ["新增指标清单", "指标频率", "必填/下拉", "只能选择静态、实时、交易日、截止日、区间、季频、半年频、年频。"],
    ["新增指标清单", "指标类型", "必填/下拉", "只能选择数值型、文本型、百分数、日期型、枚举型；筛选操作符由系统按指标类型自动生成。"],
    ["新增指标清单", "指标介绍", "必填", "简要说明指标业务含义、统计口径和适用场景，不填写参数枚举明细。"],
    ["新增指标清单", "所属API", "选填/下拉", "默认DataBrowser；如需使用其他API，必须先在管理系统的API配置中启用。"],
    ["新增指标清单", "对应DS接口ID", "选填", "已有接口时填写DS接口ID；多个ID使用逗号、顿号或换行分隔。待开发指标可暂时留空。"],
    ["新增指标清单", "维护状态", "选填/下拉", "默认待处理。批量导入不会直接纳入指标库，因此不允许填写“已纳入”。"],
    ["新增指标清单", "出参能力", "选填/下拉", "系统推荐、可筛选且可计算、仅筛选、仅计算、不可筛选不可计算。计算仅指加减乘除，仅数值型、百分数支持。仅展示指标选择不可筛选不可计算，仍可保留展示枚举。"],
    ["新增指标清单", "出参枚举方式", "选填/下拉", "NONE表示无枚举；INLINE表示直接维护枚举值列表；REFERENCE表示引用外部参数字典。"],
    ["新增指标清单", "出参枚举值列表", "条件必填", "仅INLINE填写，例如：主板，创业板，科创板。系统自动转换为字符串列表。与出参字典引用只能填写一个。"],
    ["新增指标清单", "出参字典引用", "条件必填", "仅REFERENCE填写参数字典名称或编码。与出参枚举值列表只能填写一个。"],
    ["指标参数明细", "无参数指标", "无需记录", "指标没有入参时，本页不维护该指标的任何记录；系统自动生成 input_options: []，禁止增加空白参数占位行。"],
    ["指标参数明细", "参数序号", "必填", "同一指标从1开始顺序递增，用于控制标准JSON中的参数顺序。"],
    ["指标参数明细", "参数名称/助记符/描述", "必填", "参数名称和助记符不得为空；同一指标、同一参数类型下助记符不得重复。描述应简短说明参数业务含义。"],
    ["指标参数明细", "参数类型", "必填/下拉", "日期、开始日期、结束时间映射为TIME；枚举映射为ENUM；文本映射为CUSTOM。"],
    ["指标参数明细", "参数值格式", "条件必填/下拉", "时间参数选择YYYY-MM-DD或YYYY；自定义整数选择INTEGER；枚举参数及普通文本参数留空。"],
    ["指标参数明细", "默认参数类型", "时间参数必填/下拉", "按统一时间规则选择。只有MRQ、NewestTradingDay(0)、RealtimeTradingDay()存在可直接传入的标准值。"],
    ["指标参数明细", "参数默认值", "按规则填写", "MRQ填0001-01-01；NewestTradingDay(0)与RealtimeTradingDay()原样填写；其余动态时间类型留空。枚举参数填写枚举代码。"],
    ["指标参数明细", "参数默认值描述", "建议填写", "使用简短中文说明默认值含义，例如“默认取最新完整行情交易日”“前复权”。"],
    ["指标参数明细", "字典方式", "必填/下拉", "TIME和CUSTOM固定选择NONE；ENUM根据取值来源选择INLINE、REFERENCE或NONE。"],
    ["指标参数明细", "参数字典值", "条件必填", "仅INLINE填写，每项使用“代码-枚举值”，建议一项一行，例如：0-日、1-周、2-月。默认值必须命中字典代码。"],
    ["指标参数明细", "参数字典引用", "条件必填", "仅REFERENCE填写，例如：金融机构-FINANCIAL_INSTITUTION。与参数字典值只能填写一个。"],
    ["校验规则", "整批导入", "系统校验", "只更新导入文件内的指标。任一行校验失败时整批不写入；修改错误后重新导入。"],
  ];

  function buildCustomImportInstructionRows() {
    const optionNames = Object.keys(customImportOptionLists);
    const rowCount = Math.max(customImportInstructions.length, ...optionNames.map((name) => customImportOptionLists[name].length));
    return Array.from({ length: rowCount }, (_, index) => {
      const instruction = customImportInstructions[index] || [];
      const row = {
        "工作表": instruction[0] || "",
        "字段": instruction[1] || "",
        "必填性": instruction[2] || "",
        "填写规范": instruction[3] || "",
        "": "",
      };
      optionNames.forEach((name) => { row[name] = customImportOptionLists[name][index] || ""; });
      return row;
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const xmlEscape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
  const parseArray = (value) => {
    if (Array.isArray(value)) return value;
    try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  };
  const parameterJson = (value) => JSON.stringify(parseArray(value), null, 2);
  const dictionaryJson = (value) => value && typeof value === "object" && !Array.isArray(value) ? JSON.stringify(value, null, 2) : "";
  const synonymList = (value, indicatorName = "") => globalThis.IndicatorSynonymRules.list(value, indicatorName);
  const normalizeBizType = (value) => {
    const text = String(value || "").trim().replace(/^选/, "");
    return bizTypeValues.includes(text) ? text : "";
  };
  const realtimeText = (item = {}) => {
    const value = item.isRealtime ?? item.is_realtime;
    if ([true, 1, "1", "是", "true"].includes(value)) return "是";
    if ([false, 0, "0", "否", "false"].includes(value)) return "否";
    return item.frequency === "实时" ? "是" : "否";
  };

  function buildStandardRows(library) {
    return (library || []).map(canonicalRecord).map((item) => ({
      "指标分类①": item.l1 || "",
      "指标分类②": item.l2 || "",
      "指标名称": item.name || "",
      "别名/同义词": item.synonyms || "",
      "指标状态": item.status || "",
      "单位描述": item.unit || "",
      "指标频率": item.frequency === "实时" || item.frequency === "不适用" ? "交易日" : item.frequency || "静态",
      "是否支持实时": realtimeText(item),
      "指标类型": item.type || "",
      "指标介绍": item.description || "",
      "时间型入参": parameterJson(item.params?.time),
      "枚举型入参": parameterJson(item.params?.enum),
      "自定义入参": parameterJson(item.params?.custom),
      "出参筛选枚举值": parameterJson(item.params?.output),
      "对应DS接口ID": (item.dsIds || []).join("\n"),
    }));
  }

  function parameterRowsForIndicator(item) {
    const context = {
      "指标分类①": item.l1 || "",
      "指标分类②": item.l2 || "",
      "指标编码": item.key || "",
      "指标名称": item.name || "",
      "指标状态": item.status || "",
      "指标频率": item.frequency === "实时" || item.frequency === "不适用" ? "交易日" : item.frequency || "静态",
      "是否支持实时": realtimeText(item),
      "对应DS接口ID": Array.isArray(item.dsIds) ? item.dsIds.join("\n") : item.dsIds || "",
    };
    const groups = [
      ["时间型", parseArray(item.params?.time)],
      ["枚举型", parseArray(item.params?.enum)],
      ["自定义", parseArray(item.params?.custom)],
    ];
    let sequence = 0;
    const rows = groups.flatMap(([type, parameters]) => parameters.map((parameter) => {
      sequence += 1;
      return {
        ...context,
        "参数类型": type,
        "参数序号": sequence,
        "参数名称": parameter.parameter_name || "",
        "参数助记符": parameter.mnemonic || "",
        "参数描述": parameter.parameter_description || "",
        "参数值格式": parameter.value_type || parameter.value_format || "",
        "参数默认值": parameter.default_value ?? "",
        "参数默认值描述": parameter.default_value_description || "",
        "参数字典值": dictionaryJson(parameter.dictionary_values),
        "标准参数JSON": JSON.stringify(parameter, null, 2),
      };
    }));
    return rows.length ? rows : [{
      ...context,
      "参数类型": "无参数", "参数序号": 0, "参数名称": "", "参数助记符": "", "参数描述": "",
      "参数值格式": "", "参数默认值": "", "参数默认值描述": "", "参数字典值": "", "标准参数JSON": "[]",
    }];
  }

  function buildParameterDetailRows(library) {
    return (library || []).flatMap(parameterRowsForIndicator);
  }

  function validateFrozenLibrary(library) {
    const keys=new Set();
    for(const item of library){
      const missing=[];
      for(const key of ['key','name','type','apiName'])if(!item[key])missing.push(key);
      if(!Array.isArray(item.dsIds))missing.push('dsIds');
      for(const key of ['time','enum','custom','output'])if(!Array.isArray(item.params?.[key]))missing.push('params.'+key);
      if(missing.length)throw new Error('存档指标 '+(item.key||item.name||'未命名')+' 缺少冻结字段：'+missing.join('、'));
      if(keys.has(item.key))throw new Error('存档指标编码重复：'+item.key);keys.add(item.key);
    }
  }
  function buildIndicatorIndexRows(library, bizType) {
    return (library || []).map(canonicalRecord).map((item) => {
      const inputOptions = [
        ...parseArray(item.params?.time),
        ...parseArray(item.params?.enum),
        ...parseArray(item.params?.custom),
      ];
      const outputOptions = parseArray(item.params?.output || item.outputOptions).map((option) => ({
        ...option,
        support_operators: parseArray(option.support_operators).filter((operator) => operator !== "BETWEEN"),
      }));
      const operators = outputOptions[0]?.support_operators || [];
      return {
        biz_type: normalizeBizType(bizType),
        level1_category: item.l1 || "",
        level2_category: item.l2 || "未分类",
        indicator_code: item.key || "",
        indicator_name: item.name || "",
        indicator_type: item.type || "",
        indicator_synonyms: JSON.stringify(synonymList(item.synonyms, item.name)),
        indicator_desc: item.description || "",
        indicator_unit: ["", "-"].includes(String(item.unit || "").trim()) ? "" : item.unit,
        indicator_freq: item.frequency === "实时" || item.frequency === "不适用" ? "交易日" : item.frequency || "静态",
        is_realtime: realtimeText(item) === "是" ? 1 : 0,
        filter_operators: JSON.stringify(operators),
        api_name: item.apiName || "DataBrowser",
        api_uri: item.apiUri || "",
        ds_interface_id: (item.dsIds || []).join(","),
        input_options: JSON.stringify(inputOptions, null, 2),
        output_options: JSON.stringify(outputOptions, null, 2),
        is_active: ["已废弃", "剔除"].includes(item.status) ? 0 : 1,
      };
    });
  }

  function buildStandardizedCandidateRows(candidates) {
    return (candidates || []).map(canonicalRecord).map((item) => ({
      "原始唯一键": item.rawKey || "",
      "序号": item.sourceSequence || "",
      "DS一级目录": item.ds?.l1 || "",
      "DS二级目录": item.ds?.l2 || "",
      "DS三级目录": item.ds?.l3 || "",
      "选X分类①": item.selected?.l1 || item.ds?.l1 || "",
      "选X分类②": item.selected?.l2 || item.ds?.l2 || "",
      "指标名称": item.selectedName || item.name || item.dsName || "",
      "指标类型": item.selectedType || item.type || "",
      "指标频率": item.frequency || "静态",
      "指标同义词": item.synonyms || "",
      "指标介绍": item.description || "",
      "指标单位": item.unit || "",
      "筛选操作符": JSON.stringify((item.filterOperators || []).filter((operator) => operator !== "BETWEEN")),
      "所属API": item.apiName || "DataBrowser",
      "API路径": item.apiUri || "",
      "DS接口ID": item.id || "",
      "入参选项": JSON.stringify(item.inputOptions || [
        ...(item.params?.time || []), ...(item.params?.enum || []), ...(item.params?.custom || []),
      ], null, 2),
      "出参选项": JSON.stringify((item.outputOptions || []).map((option) => ({
        ...option,
        support_operators: parseArray(option.support_operators).filter((operator) => operator !== "BETWEEN"),
      })), null, 2),
      "处理状态": item.status || "",
    }));
  }

  function buildOutputMaintenanceRows(candidates) {
    return (candidates || []).flatMap((item) => {
      const options = parseArray(item.outputOptions || item.params?.output);
      const normalized = options.length ? options : [{
        param_name: item.selectedName || item.name || item.dsName || "",
        param_type: item.selectedType || item.type || "",
        param_description: item.description || "",
        filterable: true,
        computable: ["数值型", "百分数"].includes(item.selectedType || item.type),
        value_mode: "NONE",
        values: null,
        dictionary_reference: null,
        support_operators: item.filterOperators || [],
      }];
      return normalized.map((option, index) => ({
        "原始唯一键": item.rawKey || "",
        "序号": item.sourceSequence || "",
        "DS接口ID": item.id || "",
        "指标名称": item.selectedName || item.name || item.dsName || "",
        "出参项序号": index + 1,
        "出参名称": option.param_name || "",
        "出参类型": option.param_type || item.selectedType || item.type || "",
        "出参描述": option.param_description || "",
        "是否可筛选": option.filterable === false ? 0 : 1,
        "是否可计算": option.computable ? 1 : 0,
        "枚举方式": option.value_mode || "NONE",
        "枚举值列表": Array.isArray(option.values) ? option.values.join("\n") : "",
        "字典引用": option.dictionary_reference || "",
      }));
    });
  }

  const maintenanceMeta = (item, source) => ({
    "指标来源": source,
    "指标唯一键": item.rawKey || item.sourceKey || item.key || "",
    "序号": item.sourceSequence || item.sourceIndexCode || "",
    "DS接口ID": item.id || (Array.isArray(item.dsIds) ? item.dsIds.join("\n") : item.dsIds || ""),
    "指标名称": item.selectedName || item.name || item.dsName || "",
  });

  function buildInputMaintenanceRows(records, source) {
    return (records || []).flatMap((item) => {
      const groups = [
        ["time", "日期"], ["enum", "枚举"], ["custom", "文本"],
      ];
      let sequence = 0;
      const rows = groups.flatMap(([group, type]) => parseArray(item.params?.[group]).map((parameter) => {
        sequence += 1;
        return {
          ...maintenanceMeta(item, source),
          "参数序号": sequence,
          "参数名称": parameter.parameter_name || "",
          "参数助记符": parameter.mnemonic || "",
          "参数描述": parameter.parameter_description || "",
          "参数类型": type,
          "参数值格式": parameter.value_type || parameter.value_format || "",
          "默认参数类型": parameter.default_value_type || "",
          "参数默认值": parameter.default_value ?? "",
          "参数默认值描述": parameter.default_value_description || "",
          "字典方式": parameter.dictionary_mode || "NONE",
          "参数字典值": parameter.dictionary_mode === "INLINE"
            ? Object.entries(parameter.dictionary_values || {}).map(([code, label]) => `${code}-${label}`).join("\n")
            : "",
          "参数字典引用": parameter.dictionary_mode === "REFERENCE" ? parameter.dictionary_reference || "" : "",
        };
      }));
      return rows.length ? rows : [{
        ...maintenanceMeta(item, source),
        "参数序号": 0, "参数名称": "", "参数助记符": "", "参数描述": "", "参数类型": "无参数",
        "参数值格式": "", "默认参数类型": "", "参数默认值": "", "参数默认值描述": "", "字典方式": "NONE",
        "参数字典值": "", "参数字典引用": "",
      }];
    });
  }

  function buildGenericOutputMaintenanceRows(records, source) {
    return (records || []).flatMap((item) => {
      const options = parseArray(item.outputOptions || item.params?.output);
      const normalized = options.length ? options : [{
        param_name: item.selectedName || item.name || item.dsName || "",
        param_type: item.selectedType || item.type || "",
        param_description: item.description || "",
        filterable: true,
        computable: ["数值型", "百分数"].includes(item.selectedType || item.type),
        value_mode: "NONE", values: null, dictionary_reference: null,
      }];
      return normalized.map((option, index) => ({
        ...maintenanceMeta(item, source),
        "出参项序号": index + 1,
        "出参名称": option.param_name || "",
        "出参类型": option.param_type || item.selectedType || item.type || "",
        "出参描述": option.param_description || "",
        "是否可筛选": option.filterable === false ? 0 : 1,
        "是否可计算": option.computable ? 1 : 0,
        "枚举方式": option.value_mode || "NONE",
        "枚举值列表": Array.isArray(option.values) ? option.values.join("\n") : "",
        "字典引用": option.dictionary_reference || "",
      }));
    });
  }

  const unifiedRecordKey = (item) => String(item.rawKey || item.sourceKey || item.key || "");
  const unifiedDsIds = (item) => Array.isArray(item.dsIds) && item.dsIds.length ? item.dsIds.join("\n") : item.id || item.dsIds || "";
  const unifiedOutputCapability = (option, type) => outputRules.label(option, type);
  const unifiedImportId = (item, prefix) => `${prefix}-${unifiedRecordKey(item).replace(/[^A-Za-z0-9]/g, "-") || "NEW"}`;

  function buildUnifiedIndicatorRows(records, { operation = "", prefix = "EXP" } = {}) {
    return (records || []).map(canonicalMaintenanceRecord).map((item) => {
      const option = parseArray(item.outputOptions || item.params?.output)[0] || {};
      return {
        "操作类型": operation,
        "导入记录ID": unifiedImportId(item, prefix),
        "指标唯一键": unifiedRecordKey(item),
        "原DS接口ID": unifiedDsIds(item),
        "DS接口ID": "",
        "指标分类①": item.selected?.l1 || item.l1 || item.ds?.l1 || "",
        "指标分类②": item.selected?.l2 || item.l2 || item.ds?.l2 || "",
        "指标名称": item.selectedName || item.name || item.dsName || "",
        "别名/同义词": item.synonyms || "",
        "单位描述": item.unit || "",
        "指标频率": item.frequency === "实时" ? "交易日" : item.frequency || "",
        "是否支持实时": realtimeText(item),
        "指标类型": item.selectedType || item.type || "",
        "指标介绍": item.description || "",
        "所属API": item.apiName || "DataBrowser",
        "维护状态": item.status || "",
        "出参能力": unifiedOutputCapability(option, item.selectedType || item.type),
        "出参枚举方式": option.value_mode || "NONE",
        "出参枚举值列表": Array.isArray(option.values) ? option.values.join("\n") : "",
        "出参字典引用": option.dictionary_reference || "",
      };
    });
  }

  function buildSynonymReviewRows(records, source, rowOffset = 0) {
    return (records || []).flatMap((item, index) => {
      const name = item.selectedName || item.name || item.dsName || "";
      const inspection = globalThis.IndicatorSynonymRules.inspect(item.synonyms, name);
      return inspection.kind !== "pending" ? [] : [{
        "来源": source, "指标唯一键": unifiedRecordKey(item), "指标名称": name, "维护状态": item.status || "",
        "维护表行号": index + 4 + rowOffset,
        "别名原文": typeof item.synonyms === "string" ? item.synonyms : JSON.stringify(item.synonyms ?? ""),
        "待核对原因": inspection.reason,
        "处理建议": "核对完整别名后，在参数维护表中改为一项一行；如确认应无别名，填写[]明确清空。此清单仅供核对，不直接用于导入。",
      }];
    });
  }

  function buildUnifiedParameterRows(records, { operation = "", prefix = "EXP" } = {}) {
    return (records || []).flatMap((item) => {
      const groups = [["time", "日期"], ["enum", "枚举"], ["custom", "文本"]];
      let sequence = 0;
      return groups.flatMap(([group, type]) => parseArray(item.params?.[group]).map((parameter) => ({
        "操作类型": operation,
        "导入记录ID": unifiedImportId(item, prefix),
        "指标唯一键": unifiedRecordKey(item),
        "指标名称": item.selectedName || item.name || item.dsName || "",
        "参数序号": ++sequence,
        "参数名称": parameter.parameter_name || "",
        "参数助记符": parameter.mnemonic || "",
        "参数描述": parameter.parameter_description || "",
        "参数类型": type,
        "参数值格式": parameter.value_type || parameter.value_format || "",
        "默认参数类型": parameter.default_value_type || "",
        "参数默认值": parameter.default_value ?? "",
        "参数默认值描述": parameter.default_value_description || "",
        "字典方式": parameter.dictionary_mode || "NONE",
        "参数字典值": parameter.dictionary_mode === "INLINE" ? Object.entries(parameter.dictionary_values || {}).map(([code, label]) => `${code}-${label}`).join("\n") : "",
        "参数字典引用": parameter.dictionary_mode === "REFERENCE" ? parameter.dictionary_reference || "" : "",
      })));
    });
  }

  function buildParameterDetailRowsFromStandardRows(rows) {
    return buildParameterDetailRows((rows || []).map((row) => ({
      key: row["指标编码"] || "",
      l1: row["指标分类①"], l2: row["指标分类②"], name: row["指标名称"], status: row["指标状态"],
      frequency: row["指标频率"], dsIds: String(row["对应DS接口ID"] || "").split(/\r?\n/).filter(Boolean),
      params: { time: parseArray(row["时间型入参"]), enum: parseArray(row["枚举型入参"]), custom: parseArray(row["自定义入参"]) },
    })));
  }

  const uint16 = (value) => { const bytes = new Uint8Array(2); new DataView(bytes.buffer).setUint16(0, value, true); return bytes; };
  const uint32 = (value) => { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value >>> 0, true); return bytes; };
  const concatBytes = (parts) => {
    const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    parts.forEach((part) => { result.set(part, offset); offset += part.length; });
    return result;
  };
  const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    bytes.forEach((byte) => { crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); });
    return (crc ^ 0xffffffff) >>> 0;
  };
  const dosTimestamp = (date = new Date()) => ({
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  });

  function createStoredZip(files) {
    const localParts = [];
    const centralParts = [];
    const stamp = dosTimestamp();
    let offset = 0;
    Object.entries(files).forEach(([name, content]) => {
      const nameBytes = encoder.encode(name);
      const data = typeof content === "string" ? encoder.encode(content) : content;
      const checksum = crc32(data);
      const local = concatBytes([
        uint32(0x04034b50), uint16(20), uint16(0x0800), uint16(0), uint16(stamp.time), uint16(stamp.date),
        uint32(checksum), uint32(data.length), uint32(data.length), uint16(nameBytes.length), uint16(0), nameBytes, data,
      ]);
      const central = concatBytes([
        uint32(0x02014b50), uint16(20), uint16(20), uint16(0x0800), uint16(0), uint16(stamp.time), uint16(stamp.date),
        uint32(checksum), uint32(data.length), uint32(data.length), uint16(nameBytes.length), uint16(0), uint16(0),
        uint16(0), uint16(0), uint32(0), uint32(offset), nameBytes,
      ]);
      localParts.push(local);
      centralParts.push(central);
      offset += local.length;
    });
    const central = concatBytes(centralParts);
    const end = concatBytes([
      uint32(0x06054b50), uint16(0), uint16(0), uint16(localParts.length), uint16(localParts.length),
      uint32(central.length), uint32(offset), uint16(0),
    ]);
    return concatBytes([...localParts, central, end]);
  }

  const columnName = (index) => {
    let result = "";
    for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
    return result;
  };
  const cellXml = (reference, value, style) => `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;

  function worksheetXml(rows, columns, widths, validations = [], options = {}) {
    const headerRow = options.headerRow || 1;
    const titleRows = headerRow > 1 ? Array.from({ length: headerRow - 1 }, (_, index) => index === 0
      ? Object.fromEntries(columns.map((column, columnIndex) => [column, columnIndex === 0 ? options.title || "" : ""]))
      : Object.fromEntries(columns.map((column) => [column, ""]))) : [];
    const allRows = [...titleRows, Object.fromEntries(columns.map((column) => [column, column])), ...rows];
    const sheetRows = allRows.map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const isHeader = rowNumber === headerRow;
      const isTitle = rowNumber === 1 && headerRow > 1;
      const cells = columns.map((column, columnIndex) => cellXml(`${columnName(columnIndex)}${rowNumber}`, row[column], isHeader || isTitle ? 1 : 2)).join("");
      return `<row r="${rowNumber}"${isHeader || isTitle ? ' ht="28" customHeight="1"' : ""}>${cells}</row>`;
    }).join("");
    const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
    const lastColumn = columnName(columns.length - 1);
    const lastRow = Math.max(headerRow, rows.length + headerRow);
    const validationXml = validations.length ? `<dataValidations count="${validations.length}">${validations.map((validation) => {
      const values = (validation.values || []).join(",");
      return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="选项不符合规范" error="请从下拉列表中选择标准值" sqref="${xmlEscape(validation.range)}"><formula1>&quot;${xmlEscape(values)}&quot;</formula1></dataValidation>`;
    }).join("")}</dataValidations>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A${headerRow}:${lastColumn}${lastRow}"/>${validationXml}</worksheet>`;
  }

  function createWorkbookBytes(rows, columns, widths, sheetName) {
    const files = {
      "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Microsoft YaHei"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Microsoft YaHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF176B5B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD7DEDA"/></left><right style="thin"><color rgb="FFD7DEDA"/></right><top style="thin"><color rgb="FFD7DEDA"/></top><bottom style="thin"><color rgb="FFD7DEDA"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
      "xl/worksheets/sheet1.xml": worksheetXml(rows, columns, widths),
    };
    return createStoredZip(files);
  }

  function createMultiSheetWorkbookBytes(sheets) {
    const overrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
    const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
    const worksheetRelations = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
    const styleRelationId = sheets.length + 1;
    const files = {
      "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${worksheetRelations}<Relationship Id="rId${styleRelationId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Microsoft YaHei"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Microsoft YaHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF176B5B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD7DEDA"/></left><right style="thin"><color rgb="FFD7DEDA"/></right><top style="thin"><color rgb="FFD7DEDA"/></top><bottom style="thin"><color rgb="FFD7DEDA"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    };
    sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = worksheetXml(sheet.rows, sheet.columns, sheet.widths, sheet.validations, sheet.options); });
    return createStoredZip(files);
  }

  const createStandardWorkbookBytes = (rows) => createWorkbookBytes(rows, standardColumns, [18, 18, 28, 34, 12, 14, 12, 14, 12, 42, 42, 42, 42, 28, 22], "汇总指标清单");
  const createParameterWorkbookBytes = (rows) => createWorkbookBytes(rows, parameterColumns, [18, 18, 18, 28, 12, 12, 14, 22, 12, 10, 18, 18, 34, 16, 24, 28, 42, 48], "指标参数明细");
  const createIndicatorIndexWorkbookBytes = (rows) => createWorkbookBytes(rows, indicatorIndexColumns, [14, 18, 18, 20, 28, 14, 34, 42, 14, 14, 12, 36, 18, 18, 24, 54, 54, 12], "选X指标索引表");
  const createCustomImportWorkbookBytes = () => createMultiSheetWorkbookBytes([
    { name: "新增指标清单", rows: [], columns: customImportColumns, widths: [18, 18, 18, 28, 34, 14, 14, 14, 38, 18, 22, 14, 18, 18, 34, 28], validations: [
      { range: "G2:G1000", values: customImportOptionLists["指标频率"] },
      { range: "H2:H1000", values: customImportOptionLists["指标类型"] },
      { range: "J2:J1000", values: customImportOptionLists["所属API"] },
      { range: "L2:L1000", values: customImportOptionLists["维护状态"] },
      { range: "M2:M1000", values: customImportOptionLists["出参能力"] },
      { range: "N2:N1000", values: customImportOptionLists["枚举方式"] },
    ] },
    { name: "指标参数明细", rows: [], columns: customParameterImportColumns, widths: [18, 28, 10, 22, 20, 36, 16, 16, 20, 20, 30, 16, 38, 28], validations: [
      { range: "G2:G5000", values: customImportOptionLists["参数类型"] },
      { range: "H2:H5000", values: customImportOptionLists["参数值格式"] },
      { range: "I2:I5000", values: customImportOptionLists["默认参数类型"] },
      { range: "L2:L5000", values: customImportOptionLists["枚举方式"] },
    ] },
    { name: "填写说明与下拉选项", rows: buildCustomImportInstructionRows(), columns: customImportInstructionColumns, widths: [18, 24, 15, 88, 3, 14, 14, 14, 22, 14, 16, 18, 22, 16] },
  ]);
  const createUnifiedIndicatorWorkbookBytes = ({ indicators = [], parameters = [], timeDefaultRuleOptions = null } = {}) => {
    const options = { ...unifiedOptionLists, "默认参数类型": timeDefaultRuleOptions?.length ? timeDefaultRuleOptions : unifiedOptionLists["默认参数类型"] };
    return createMultiSheetWorkbookBytes([
    { name: "指标清单", rows: indicators, columns: unifiedIndicatorColumns, widths: [12, 19, 18, 16, 16, 18, 18, 30, 34, 14, 14, 18, 14, 42, 18, 14, 20, 18, 34, 28], options: { title: "指标清单", headerRow: 3 }, validations: [
      { range: "A4:A1000", values: options["操作类型"] },
      { range: "K4:K1000", values: unifiedOptionLists["指标频率"] },
      { range: "L4:L1000", values: unifiedOptionLists["是否支持实时"] },
      { range: "M4:M1000", values: unifiedOptionLists["指标类型"] },
      { range: "O4:O1000", values: unifiedOptionLists["所属API"] },
      { range: "P4:P1000", values: unifiedOptionLists["维护状态"] },
      { range: "Q4:Q1000", values: unifiedOptionLists["出参能力"] },
      { range: "R4:R1000", values: unifiedOptionLists["枚举方式"] },
    ] },
    { name: "指标参数明细", rows: parameters, columns: unifiedParameterColumns, widths: [12, 19, 18, 30, 10, 20, 18, 38, 14, 16, 20, 20, 30, 16, 38, 30], options: { title: "指标参数明细", headerRow: 3 }, validations: [
      { range: "A4:A5000", values: unifiedOptionLists["操作类型"] },
      { range: "I4:I5000", values: unifiedOptionLists["参数类型"] },
      { range: "J4:J5000", values: unifiedOptionLists["参数值格式"] },
      { range: "K4:K5000", values: options["默认参数类型"] },
      { range: "N4:N5000", values: unifiedOptionLists["枚举方式"] },
    ] },
    { name: "填写说明与下拉选项", rows: unifiedGuideRowsV6, columns: unifiedGuideColumns, widths: [20, 26, 18, 110] },
    ]);
  };
  const createStandardizedCandidateWorkbookBytes = (rows) => createWorkbookBytes(rows, standardizedCandidateColumns, [24, 10, 18, 18, 18, 18, 18, 28, 12, 12, 34, 42, 14, 38, 16, 20, 18, 54, 54, 14], "标准化DS候选指标池");
  const createSynonymReviewWorkbookBytes = (rows) => createWorkbookBytes(rows, ["来源", "指标唯一键", "指标名称", "维护状态", "维护表行号", "别名原文", "待核对原因", "处理建议"], [18, 28, 32, 14, 16, 50, 65, 65], "别名待核对清单");
  const createOutputMaintenanceWorkbookBytes = (rows) => createMultiSheetWorkbookBytes([
    { name: "出参批量维护", rows, columns: outputMaintenanceColumns, widths: [24, 10, 18, 28, 12, 24, 14, 42, 14, 14, 14, 36, 30] },
    { name: "填写说明", rows: [
      { "说明项": "回写定位", "填写规则": "原始唯一键由系统生成且不可修改；系统按原始唯一键和出参项序号精确回写。" },
      { "说明项": "枚举方式", "填写规则": "NONE表示无枚举；INLINE填写枚举值列表；REFERENCE填写字典引用。枚举值列表与字典引用只能填写一个。" },
      { "说明项": "布尔字段", "填写规则": "是否可筛选、是否可计算仅填写1或0。" },
      { "说明项": "筛选操作符", "填写规则": "无需填写。系统根据出参类型自动生成标准筛选操作符。" },
      { "说明项": "批量回写", "填写规则": "导入前执行全量校验；任一行失败则整批不写入。已纳入指标会同步更新选X指标库。" },
    ], columns: ["说明项", "填写规则"], widths: [22, 100] },
  ]);
  const createParameterMaintenanceWorkbookBytes = ({ inputs = [], outputs = [] }) => createMultiSheetWorkbookBytes([
    { name: "入参批量维护", rows: inputs, columns: inputMaintenanceColumns, widths: [16, 28, 10, 20, 28, 10, 22, 20, 36, 14, 16, 20, 20, 30, 16, 38, 30] },
    { name: "出参批量维护", rows: outputs, columns: genericOutputMaintenanceColumns, widths: [16, 28, 10, 20, 28, 10, 24, 14, 42, 14, 14, 14, 36, 30] },
    { name: "填写说明", rows: [
      { "说明项": "局部覆盖", "填写规则": "只更新导入文件中出现的指标唯一键；未出现在文件中的指标完整保留。" },
      { "说明项": "入参覆盖", "填写规则": "某指标出现在入参页时，系统用该指标的全部入参行替换原入参；填写一行“无参数”可清空该指标入参。" },
      { "说明项": "出参覆盖", "填写规则": "某指标出现在出参页时，系统用该指标的全部出参行替换原出参；筛选操作符根据出参类型自动生成。" },
      { "说明项": "独立更新", "填写规则": "指标只出现在入参页时不修改出参，只出现在出参页时不修改入参。" },
      { "说明项": "唯一键", "填写规则": "指标来源和指标唯一键由系统生成，不可修改；导入时必须与当前指标域和指标池匹配。" },
      { "说明项": "字典方式", "填写规则": "NONE表示无字典；INLINE按“代码-枚举值”逐行填写；REFERENCE填写字典引用。" },
      { "说明项": "全量校验", "填写规则": "写入前先校验整份文件；任一行失败则本次全部不写入，已纳入指标会同步更新选X指标库。" },
    ], columns: ["说明项", "填写规则"], widths: [22, 110] },
  ]);

  async function unzipWorkbook(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let endOffset = bytes.length - 22;
    while (endOffset >= 0 && view.getUint32(endOffset, true) !== 0x06054b50) endOffset -= 1;
    if (endOffset < 0) throw new Error("不是有效的Excel文件");
    const entryCount = view.getUint16(endOffset + 10, true);
    let offset = view.getUint32(endOffset + 16, true);
    const entries = {};
    for (let index = 0; index < entryCount; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("Excel目录结构不完整");
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
      let content;
      if (method === 0) content = compressed;
      else if (method === 8 && typeof DecompressionStream !== "undefined") {
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        content = new Uint8Array(await new Response(stream).arrayBuffer());
      } else throw new Error("当前浏览器无法解压该Excel，请使用系统模板重新保存后导入");
      entries[name] = content;
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  const xmlText = (entry) => entry ? decoder.decode(entry) : "";
  const cellColumnIndex = (reference) => {
    const letters = String(reference || "A1").match(/^[A-Z]+/i)?.[0]?.toUpperCase() || "A";
    return [...letters].reduce((result, letter) => result * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  };
  const xmlElements = (node, tagName) => [...new Set([
    ...node.getElementsByTagName(tagName),
    ...(node.getElementsByTagNameNS ? node.getElementsByTagNameNS("*", tagName) : []),
  ])];
  const nodeText = (node, tagName) => xmlElements(node, tagName).map((item) => item.textContent || "").join("");

  function worksheetRows(entries, sheetName = "") {
    const parser = new DOMParser();
    const sharedXml = xmlText(entries["xl/sharedStrings.xml"]);
    const sharedStrings = sharedXml ? xmlElements(parser.parseFromString(sharedXml, "application/xml"), "si").map((node) => nodeText(node, "t")) : [];
    let sheetPath = "xl/worksheets/sheet1.xml";
    if (sheetName) {
      const workbook = parser.parseFromString(xmlText(entries["xl/workbook.xml"]), "application/xml");
      const targetSheet = xmlElements(workbook, "sheet").find((sheet) => sheet.getAttribute("name") === sheetName);
      if (!targetSheet) throw new Error(`Excel缺少“${sheetName}”工作表`);
      const relationId = targetSheet.getAttribute("r:id");
      const relations = parser.parseFromString(xmlText(entries["xl/_rels/workbook.xml.rels"]), "application/xml");
      const relation = xmlElements(relations, "Relationship").find((item) => item.getAttribute("Id") === relationId);
      if (!relation) throw new Error(`无法读取“${sheetName}”工作表`);
      const target = String(relation.getAttribute("Target") || "").replace(/^\/+/, "");
      sheetPath = target.startsWith("xl/") ? target : `xl/${target}`;
    }
    const sheetXml = xmlText(entries[sheetPath]);
    if (!sheetXml) throw new Error(`Excel缺少“${sheetName || "第一个"}”工作表内容`);
    const sheet = parser.parseFromString(sheetXml, "application/xml");
    const physicalRows = xmlElements(sheet, "row");
    const matrix = physicalRows.map((row) => {
      const values = [];
      xmlElements(row, "c").forEach((cell) => {
        const index = cellColumnIndex(cell.getAttribute("r"));
        const type = cell.getAttribute("t");
        const raw = type === "inlineStr" ? nodeText(cell, "t") : nodeText(cell, "v");
        values[index] = type === "s" ? sharedStrings[Number(raw)] || "" : raw;
      });
      return values.map((value) => String(value ?? "").trim());
    });
    const headerIndex = matrix.findIndex((row) => row.includes("操作类型") || row.includes("导入记录ID")) >= 0
      ? matrix.findIndex((row) => row.includes("操作类型") || row.includes("导入记录ID"))
      : 0;
    const headers = matrix[headerIndex] || [];
    return matrix.slice(headerIndex + 1).map((row, index) => ({ row, excelRow: Number(physicalRows[headerIndex + index + 1].getAttribute('r')) || headerIndex + index + 2 }))
      .filter(({ row }) => row.some(Boolean)).map(({ row, excelRow }) => ({ ...Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])), _excelRow: excelRow }));
  }

  async function readFirstWorksheetRows(file) {
    return worksheetRows(await unzipWorkbook(await file.arrayBuffer()));
  }

  async function readCustomImportWorkbook(file) {
    const entries = await unzipWorkbook(await file.arrayBuffer());
    return {
      indicators: worksheetRows(entries, "新增指标清单"),
      parameters: worksheetRows(entries, "指标参数明细"),
    };
  }

  async function readOutputMaintenanceWorkbook(file) {
    return worksheetRows(await unzipWorkbook(await file.arrayBuffer()), "出参批量维护");
  }

  async function readUnifiedIndicatorWorkbook(file) {
    const entries = await unzipWorkbook(await file.arrayBuffer());
    return {
      indicators: worksheetRows(entries, "指标清单"),
      parameters: worksheetRows(entries, "指标参数明细"),
    };
  }

  async function readParameterMaintenanceWorkbook(file) {
    const entries = await unzipWorkbook(await file.arrayBuffer());
    return {
      inputs: worksheetRows(entries, "入参批量维护"),
      outputs: worksheetRows(entries, "出参批量维护"),
    };
  }

  (typeof window === "undefined" ? globalThis : window).IndicatorExport = {
    createWorkbookBytes,
    columns: standardColumns,
    standardColumns,
    parameterColumns,
    indicatorIndexColumns,
    bizTypeValues,
    customImportColumns,
    customParameterImportColumns,
    unifiedIndicatorColumns,
    unifiedParameterColumns,
    unifiedOptionLists,
    standardizedCandidateColumns,
    outputMaintenanceColumns,
    inputMaintenanceColumns,
    genericOutputMaintenanceColumns,
    buildStandardRows,
    buildParameterDetailRows,
    validateFrozenLibrary,
    buildIndicatorIndexRows,
    buildParameterDetailRowsFromStandardRows,
    buildStandardizedCandidateRows,
    buildOutputMaintenanceRows,
    buildInputMaintenanceRows,
    buildGenericOutputMaintenanceRows,
    buildUnifiedIndicatorRows,
    buildUnifiedParameterRows,
    buildSynonymReviewRows,
    createSynonymReviewWorkbookBytes,
    createStandardWorkbookBytes,
    createParameterWorkbookBytes,
    createIndicatorIndexWorkbookBytes,
    createCustomImportWorkbookBytes,
    createUnifiedIndicatorWorkbookBytes,
    createStandardizedCandidateWorkbookBytes,
    createOutputMaintenanceWorkbookBytes,
    createParameterMaintenanceWorkbookBytes,
    readFirstWorksheetRows,
    readCustomImportWorkbook,
    readUnifiedIndicatorWorkbook,
    readOutputMaintenanceWorkbook,
    readParameterMaintenanceWorkbook,
  };
})();
