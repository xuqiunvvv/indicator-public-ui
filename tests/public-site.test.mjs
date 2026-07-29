import assert from "node:assert/strict";
import test from "node:test";

test("public API exposes only GET snapshot requests", async () => {
  const moduleUrl = new URL("../worker/public-api.js", import.meta.url);
  moduleUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { handlePublicApi } = await import(moduleUrl.href);
  const denied = await handlePublicApi(new Request("http://localhost/api/snapshot?domainId=fund", {
    method: "POST",
  }), {});
  assert.equal(denied.status, 405);

  const missingConfig = await handlePublicApi(
    new Request("http://localhost/api/snapshot?domainId=fund"),
    {},
  );
  assert.equal(missingConfig.status, 503);
});

test("public interface contains only library, dashboard, and export navigation", async () => {
  const fs = await import("node:fs/promises");
  const html = await fs.readFile(new URL("../site/index.html", import.meta.url), "utf8");
  assert.match(html, /选X指标库/);
  assert.match(html, /层级指标看板/);
  assert.match(html, /导出中心/);
  assert.doesNotMatch(html, /DS候选指标池/);
  assert.doesNotMatch(html, /新增选X指标/);
  assert.doesNotMatch(html, /上架任务/);
  assert.doesNotMatch(html, /删除指标/);
});
