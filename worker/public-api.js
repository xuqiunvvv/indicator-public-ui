const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": status === 200 ? "public, max-age=300" : "no-store",
  },
});

async function decodeSnapshot(encoded) {
  const compressed = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

export async function handlePublicApi(request, env = {}, snapshots = {}) {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== "/api/snapshot") {
    return jsonResponse({ error: "公开站仅支持只读查询" }, 405);
  }
  const domainId = url.searchParams.get("domainId") || "";
  if (!["ashare", "fund"].includes(domainId)) {
    return jsonResponse({ error: "当前指标域不支持公开查询" }, 400);
  }
  if (!snapshots[domainId]) {
    return jsonResponse({ error: "公开数据源尚未完成配置" }, 503);
  }
  return new Response(await decodeSnapshot(snapshots[domainId]), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
