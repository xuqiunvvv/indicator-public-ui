(() => {
  const standardColumns = [
    "指标分类①", "指标分类②", "指标名称", "指标状态", "单位描述", "指标频率", "指标类型", "指标介绍",
    "时间型入参", "枚举型入参", "自定义入参", "出参筛选枚举值", "对应DS接口ID",
  ];
  const parameterColumns = [
    "指标分类①", "指标分类②", "指标编码", "指标名称", "指标状态", "指标频率", "对应DS接口ID",
    "参数类型", "参数序号", "参数名称", "参数助记符", "参数描述", "参数值格式", "参数默认值",
    "参数默认值描述", "参数字典值", "标准参数JSON",
  ];
  const indicatorIndexColumns = [
    "biz_type", "level1_category", "level2_category", "indicator_code", "indicator_name", "indicator_type",
    "indicator_synonyms", "indicator_desc", "indicator_unit", "indicator_freq", "filter_operators",
    "api_name", "api_uri", "ds_interface_id", "input_options", "output_options", "is_active",
  ];
  const bizTypeValues = ["A股", "基金", "债券", "港股", "美股", "指数", "行业", "概念", "基金经理", "工商"];
  const customImportColumns = [
    "导入记录ID", "指标分类①", "指标分类②", "指标名称", "单位描述", "指标频率", "指标类型", "指标介绍",
    "所属API", "对应DS接口ID", "维护状态", "出参能力", "出参枚举方式", "出参枚举值列表", "出参字典引用",
  ];
  const customParameterImportColumns = [
    "导入记录ID", "指标名称", "参数序号", "参数名称", "参数助记符", "参数描述", "参数类型",
    "参数值格式", "参数默认值", "参数默认值描述", "字典方式", "参数字典值", "参数字典引用",
  ];
  const standardizedCandidateColumns = [
    "原始唯一键", "序号", "DS一级目录", "DS二级目录", "DS三级目录", "选X分类①", "选X分类②",
    "指标名称", "指标类型", "指标频率", "指标同义词", "指标介绍", "指标单位", "筛选操作符",
    "所属API", "API路径", "DS接口ID", "入参选项", "出参选项", "处理状态",
  ];

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const xmlEscape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
  const parseArray = (value) => {
    if (Array.isArray(value)) return value;
    try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  };
  const parameterJson = (value) => JSON.stringify(parseArray(value), null, 2);
  const dictionaryJson = (value) => value && typeof value === "object" && !Array.isArray(value) ? JSON.stringify(value, null, 2) : "";
  const synonymList = (value, indicatorName = "") => {
    let values = [];
    if (Array.isArray(value)) values = value;
    else {
      const text = String(value || "").trim();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          values = Array.isArray(parsed) ? parsed : [text];
        } catch {
          values = text.split(/[\r\n,，;；、]+/);
        }
      }
    }
    return [...new Set(values.map((item) => String(item || "").trim()).filter((item) => item && item !== indicatorName))];
  };
  const normalizeBizType = (value) => {
    const text = String(value || "").trim().replace(/^选/, "");
    return bizTypeValues.includes(text) ? text : "";
  };

  function buildStandardRows(library) {
    return (library || []).map((item) => ({
      "指标分类①": item.l1 || "",
      "指标分类②": item.l2 || "",
      "指标名称": item.name || "",
      "指标状态": item.status || "",
      "单位描述": item.unit || "",
      "指标频率": item.frequency === "不适用" ? "静态" : item.frequency || "静态",
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
      "指标频率": item.frequency === "不适用" ? "静态" : item.frequency || "静态",
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

  function buildIndicatorIndexRows(library, bizType) {
    return (library || []).map((item) => {
      const inputOptions = [
        ...parseArray(item.params?.time),
        ...parseArray(item.params?.enum),
        ...parseArray(item.params?.custom),
      ];
      const outputOptions = parseArray(item.params?.output || item.outputOptions);
      const operators = item.filterOperators?.length
        ? item.filterOperators
        : outputOptions[0]?.support_operators || [];
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
        indicator_freq: item.frequency === "不适用" ? "静态" : item.frequency || "静态",
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
    return (candidates || []).map((item) => ({
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
      "筛选操作符": JSON.stringify(item.filterOperators || []),
      "所属API": item.apiName || "DataBrowser",
      "API路径": item.apiUri || "",
      "DS接口ID": item.id || "",
      "入参选项": JSON.stringify(item.inputOptions || [
        ...(item.params?.time || []), ...(item.params?.enum || []), ...(item.params?.custom || []),
      ], null, 2),
      "出参选项": JSON.stringify(item.outputOptions || [], null, 2),
      "处理状态": item.status || "",
    }));
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

  function worksheetXml(rows, columns, widths) {
    const allRows = [Object.fromEntries(columns.map((column) => [column, column])), ...rows];
    const sheetRows = allRows.map((row, rowIndex) => {
      const cells = columns.map((column, columnIndex) => cellXml(`${columnName(columnIndex)}${rowIndex + 1}`, row[column], rowIndex === 0 ? 1 : 2)).join("");
      return `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="28" customHeight="1"' : ""}>${cells}</row>`;
    }).join("");
    const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
    const lastColumn = columnName(columns.length - 1);
    const lastRow = Math.max(1, rows.length + 1);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${lastColumn}${lastRow}"/></worksheet>`;
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
    sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = worksheetXml(sheet.rows, sheet.columns, sheet.widths); });
    return createStoredZip(files);
  }

  const createStandardWorkbookBytes = (rows) => createWorkbookBytes(rows, standardColumns, [18, 18, 28, 12, 14, 12, 12, 42, 42, 42, 42, 28, 22], "汇总指标清单");
  const createParameterWorkbookBytes = (rows) => createWorkbookBytes(rows, parameterColumns, [18, 18, 18, 28, 12, 12, 22, 12, 10, 18, 18, 34, 16, 24, 28, 42, 48], "指标参数明细");
  const createIndicatorIndexWorkbookBytes = (rows) => createWorkbookBytes(rows, indicatorIndexColumns, [14, 18, 18, 20, 28, 14, 34, 42, 14, 14, 36, 18, 18, 24, 54, 54, 12], "选X指标索引表");
  const createCustomImportWorkbookBytes = () => createMultiSheetWorkbookBytes([
    { name: "新增指标清单", rows: [], columns: customImportColumns, widths: [18, 18, 18, 28, 14, 14, 14, 38, 18, 22, 14, 18, 18, 34, 28] },
    { name: "指标参数明细", rows: [], columns: customParameterImportColumns, widths: [18, 28, 10, 22, 20, 36, 16, 16, 20, 30, 16, 38, 28] },
    { name: "填写说明与下拉选项", rows: [
      { "说明项": "无参数指标", "填写规则": "不需要在“指标参数明细”维护记录；系统自动生成 input_options: []，禁止填写空白参数占位行。" },
      { "说明项": "参数类型映射", "填写规则": "日期、开始日期、结束时间自动转为TIME；枚举转为ENUM；文本转为CUSTOM。" },
      { "说明项": "出参枚举", "填写规则": "INLINE填写A，B，C；REFERENCE仅填写参数字典名称。两种内容只能有一个有效。" },
      { "说明项": "所属API", "填写规则": "默认DataBrowser；其他名称需先在上架任务/API配置中启用。" },
    ], columns: ["说明项", "填写规则"], widths: [24, 90] },
  ]);
  const createStandardizedCandidateWorkbookBytes = (rows) => createWorkbookBytes(rows, standardizedCandidateColumns, [24, 10, 18, 18, 18, 18, 18, 28, 12, 12, 34, 42, 14, 38, 16, 20, 18, 54, 54, 14], "标准化DS候选指标池");

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
    const matrix = xmlElements(sheet, "row").map((row) => {
      const values = [];
      xmlElements(row, "c").forEach((cell) => {
        const index = cellColumnIndex(cell.getAttribute("r"));
        const type = cell.getAttribute("t");
        const raw = type === "inlineStr" ? nodeText(cell, "t") : nodeText(cell, "v");
        values[index] = type === "s" ? sharedStrings[Number(raw)] || "" : raw;
      });
      return values.map((value) => String(value ?? "").trim());
    });
    const headers = matrix.shift() || [];
    return matrix.filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
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

  window.IndicatorExport = {
    columns: standardColumns,
    standardColumns,
    parameterColumns,
    indicatorIndexColumns,
    bizTypeValues,
    customImportColumns,
    customParameterImportColumns,
    standardizedCandidateColumns,
    buildStandardRows,
    buildParameterDetailRows,
    buildIndicatorIndexRows,
    buildParameterDetailRowsFromStandardRows,
    buildStandardizedCandidateRows,
    createStandardWorkbookBytes,
    createParameterWorkbookBytes,
    createIndicatorIndexWorkbookBytes,
    createCustomImportWorkbookBytes,
    createStandardizedCandidateWorkbookBytes,
    readFirstWorksheetRows,
    readCustomImportWorkbook,
  };
})();
