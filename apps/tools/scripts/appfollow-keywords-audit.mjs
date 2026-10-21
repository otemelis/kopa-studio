const token = process.env.APPFOLLOW_API_TOKEN;
if (!token) throw new Error("APPFOLLOW_API_TOKEN is not configured.");

const date = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const url = new URL("https://api.appfollow.io/api/v2/aso/keywords");
url.search = new URLSearchParams({ ext_id: "6785764991", country: "jp", device: "iphone", date, page: "1" }).toString();
const response = await fetch(url, { headers: { Accept: "application/json", "X-AppFollow-API-Token": token } });
const body = await response.json().catch(() => null);
const records = Array.isArray(body?.data) ? body.data : Array.isArray(body?.keywords) ? body.keywords : Array.isArray(body) ? body : [];
const headers = Object.fromEntries([...response.headers].filter(([key]) => /credit|quota|limit|rate/i.test(key)));
console.log(JSON.stringify({ status: response.status, request: `${url.origin}${url.pathname}?${url.searchParams}`, responseKeys: body && typeof body === "object" ? Object.keys(body) : [], pagination: body && typeof body === "object" ? { page: body.page ?? null, total: body.total ?? null, next: body.next ?? null, prev: body.prev ?? null, meta: body.meta ?? null } : null, recordCount: records.length, keywordFields: records[0] && typeof records[0] === "object" ? Object.keys(records[0]) : [], quotaHeaders: headers, error: response.ok ? null : body }, null, 2));
