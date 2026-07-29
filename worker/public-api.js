const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": status === 200 ? "public, max-age=30" : "no-store",
  },
});

export async function handlePublicApi(request, env = {}) {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== "/api/snapshot") {
    return jsonResponse({ error: "公开站仅支持只读查询" }, 405);
  }
  const domainId = url.searchParams.get("domainId") || "";
  if (!["ashare", "fund"].includes(domainId)) {
    return jsonResponse({ error: "当前指标域不支持公开查询" }, 400);
  }
  if (!env.MANAGEMENT_API_BASE || !env.MANAGEMENT_SITE_BYPASS_TOKEN) {
    return jsonResponse({ error: "公开数据源尚未完成配置" }, 503);
  }
  const target = new URL("/api/public-snapshot", env.MANAGEMENT_API_BASE);
  target.searchParams.set("domainId", domainId);
  const response = await fetch(target, {
    headers: {
      "OAI-Sites-Authorization": `Bearer ${env.MANAGEMENT_SITE_BYPASS_TOKEN}`,
      "accept": "application/json",
    },
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": response.ok ? "public, max-age=30" : "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
