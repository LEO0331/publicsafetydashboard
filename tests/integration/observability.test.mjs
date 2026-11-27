import assert from "node:assert/strict";
import test from "node:test";
const { createObservability, observe, securityReport, classifyClient, classifyProbe } = await import("../../.tmp-test/observability.js");
const { readJsonObject } = await import("../../.tmp-test/http.js");
const { readBoundedImportBody, ImportBodyTimeoutError } = await import("../../.tmp-test/announcement-import.js");
const { buildCsv } = await import("../../.tmp-test/csv-export.js");

const base = Date.parse("2026-11-27T00:00:00Z");
const observation = { route: "records", method: "GET", status: 200, ms: 24, rows: 2, client: "browser_like", probe: "none", auth: "not_applicable" };
test("fixed classifiers keep only coarse labels", () => {
  for (const [agent, expected] of [[null,"unknown"],["Mozilla/5.0 Chrome/123","browser_like"],["Googlebot","claimed_bot"],["curl/8","automated_client"],["nuclei","suspected_scanner"],["x".repeat(1025),"unknown"]]) assert.equal(classifyClient(agent),expected);
  for (const [path, expected] of [["/api/.env","environment"],["/api/.git/config","git"],["/api/%252e%252e/config","traversal"],["/api/.aws/credentials","credentials"],["/api/wp-login.php","wordpress"],["/api/config.json","configuration"],["/api/backup.sql","backup"],["/api/phpmyadmin","administration"],["/api/foo","none"],["/api/%xx","none"],["/api/"+"x".repeat(4096),"none"]]) assert.equal(classifyProbe(path),expected);
});
test("bounded UTC windows aggregate latency, auth, volume and rows, and expire", () => {
  let now = base; const emitted = [];
  const store = createObservability({ now: () => now, emit: value => emitted.push(value) });
  assert.equal(store.report().p95UpperMs,null);
  store.record(observation);
  store.record({ ...observation, route: "export", ms: 150, rows: 12 });
  store.record({ ...observation, route: "admin_hide", method: "POST", status: 401, rows: 100, auth: "denied" });
  store.record({ ...observation, route: "unknown_api", status: 404, probe: "git", client: "suspected_scanner" });
  store.record({ ...observation, route: "export", method: "HEAD", rows: 0, ms: 200000 });
  let r = store.report();
  assert.equal(r.requests,5); assert.equal(r.exportResponses,1); assert.equal(r.exportRows,12);
  assert.equal(r.auth.denied,1); assert.equal(r.probes.git,1); assert.equal(r.methods.HEAD,1);
  assert.equal(r.p95UpperMs,null); assert.equal(r.routes.find(x=>x.route==="records").p95UpperMs,50);
  assert.equal(r.routes.find(x=>x.route==="admin_hide").rows,0);
  now += 300000; store.rotate(); assert.equal(emitted.length,1);
  assert.equal(emitted[0].event,"public_safety.api_aggregate.v1");
  store.record({ ...observation, status: 503 }); r=store.report(); assert.equal(r.windowCount,2);
  now += 24*3600000; r=store.report(); assert.equal(r.requests,0); assert.equal(r.oldestWindow,null);
});
test("observation cap and log backpressure never grow an unbounded queue", () => {
  let now=base; const store=createObservability({now:()=>now,emit(){throw Error("private log error");}});
  for(let i=0;i<100001;i++)store.record(observation);
  assert.equal(store.report().requests,100000);assert.equal(store.report().dropped,1);
  now+=300000;store.rotate();assert.equal(store.report().skippedLogs,1);
  assert.ok(!JSON.stringify(store.report()).includes("private log error"));
});
test("wrapper auth, resource serialization, disabled mode and privacy", async () => {
  const oldFlag=process.env.ENABLE_API_OBSERVABILITY,oldToken=process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN="test-only-secret";
  const req=(path="/api/records",token="test-only-secret",method="GET")=>new Request("http://localhost"+path,{method,headers:{"x-admin-token":token,"user-agent":"curl/8 SECRET-UA","cookie":"SECRET-COOKIE","x-forwarded-for":"192.0.2.10"}});
  try {
    delete process.env.ENABLE_API_OBSERVABILITY;
    const plain=observe("records",()=>Response.json({ok:true}));
    assert.equal((await plain(req())).headers.get("x-request-id"),null);
    assert.deepEqual(securityReport(),{enabled:false});
    process.env.ENABLE_API_OBSERVABILITY="true";
    let release; const pending=new Promise(resolve=>{release=resolve;});
    const maintenance=observe("import_crawl",async()=>{await pending;return Response.json({ok:true});},{admin:true,maintenance:true});
    const other=observe("admin_hide",()=>Response.json({ok:true}),{admin:true,maintenance:true});
    assert.equal((await maintenance(req("/api/import/crawl","wrong","POST"))).status,401);
    const active=maintenance(req("/api/import/crawl","test-only-secret","POST"));
    const busy=await other(req("/api/admin/hide","test-only-secret","POST"));
    assert.equal(busy.status,429);assert.equal(busy.headers.get("retry-after"),"10");
    release();assert.equal((await active).status,200);assert.equal((await other(req())).status,200);
    const broken=observe("import_url",()=>{throw Error("SECRET-ERROR");},{admin:true,maintenance:true});
    const bad=await broken(req());assert.equal(bad.status,500);assert.ok(!(await bad.text()).includes("SECRET-ERROR"));
    assert.equal((await other(req())).status,200);
    const records=observe("records",(_req,ctx)=>{ctx.rows(2);return Response.json({name:"SECRET-RECORD"});});
    const response=await records(req("/api/records?location=SECRET-FILTER"));assert.match(response.headers.get("x-request-id"),/^[a-f0-9-]{36}$/);
    const reportRoute=observe("security_report",()=>Response.json(securityReport()),{admin:true,report:true});
    const before=securityReport().requests;assert.equal((await reportRoute(req())).status,200);assert.equal(securityReport().requests,before);
    assert.equal((await reportRoute(req("/api/admin/security","wrong"))).status,401);
    const unknown=observe("unknown_api",()=>new Response(null,{status:404}));
    assert.equal((await unknown(req("/api/.env?secret=SECRET-QUERY"))).status,404);
    const report=securityReport();
    assert.equal(report.probes.environment,1);assert.ok(report.auth.denied>=2);
    assert.ok(report.audit.some(event => event.action === "import_crawl" && event.status === 200));
    assert.ok(report.audit.some(event => event.action === "visibility_change" && event.status === 429));
    assert.ok(report.audit.some(event => event.action === "import_url" && event.status === 500));
    assert.ok(!report.audit.some(event => event.status === 401));
    const serialized=JSON.stringify(report);
    for(const value of ["SECRET","test-only-secret","192.0.2.10","/.env","location="])assert.ok(!serialized.includes(value),value);
  } finally {
    if(oldFlag===undefined)delete process.env.ENABLE_API_OBSERVABILITY;else process.env.ENABLE_API_OBSERVABILITY=oldFlag;
    if(oldToken===undefined)delete process.env.ADMIN_TOKEN;else process.env.ADMIN_TOKEN=oldToken;
  }
});
test("bounded JSON, timeout and CSV guards preserve normal export",async()=>{
  const parse=observe("admin_hide",async req=>Response.json(await readJsonObject(req)));
  const request=body=>new Request("http://localhost",{method:"POST",body});
  assert.deepEqual(await (await parse(request('{"valid":true}'))).json(),{valid:true});
  assert.equal((await parse(request("{bad"))).status,400);
  assert.equal((await parse(request("[]"))).status,400);
  assert.equal((await parse(request("x".repeat(16385)))).status,413);
  const stalled=new Request("http://localhost",{method:"POST",body:new ReadableStream({start(){}}),duplex:"half"});
  await assert.rejects(readBoundedImportBody(stalled,32,10),ImportBodyTimeoutError);
  const row={name:"=formula",violation_date:null,violation_count:2,violation_types_json:'["酒駕"]',location_text:"location",alcohol_mg_per_l:null,source_title:"source",pdf_url:null};
  const csv=buildCsv([row]);assert.ok(csv.startsWith("\uFEFF"));assert.ok(csv.includes("\"'=formula\""));
  assert.equal(buildCsv(Array(10001).fill(row)),null);assert.equal(buildCsv([{...row,name:"x".repeat(1000)}],512),null);
});

test("Phase 2 backup restores only validated completed pre-process windows", () => {
  let now = base;
  const previous = createObservability({ now: () => now });
  for (let i = 0; i < 10; i++) previous.record({ ...observation, route: "export", rows: 2 });
  for (let i = 0; i < 5; i++) previous.record({ ...observation, route: "admin_hide", method: "POST", status: 401, auth: "denied", rows: 0 });
  previous.record({ ...observation, status: 503, rows: 0 });
  assert.equal(previous.backup(), "");
  assert.equal(previous.report().indicators.exportBurst, 1);
  assert.equal(previous.report().indicators.authFailures, 1);
  assert.equal(previous.report().indicators.serverErrors, 1);
  assert.match(previous.csv(), /window_start_utc,origin,metric,count/);
  assert.match(previous.csv(), /counts.exportResponses,10/);
  now += 300000;
  const backup = previous.backup(), raw = JSON.parse(backup);
  assert.equal(raw.requests, 16);
  const restored = createObservability({ now: () => now });
  for (const invalid of ["", "not json", JSON.stringify({...raw, privateName:"SECRET"}), JSON.stringify({...raw,requests:17}), JSON.stringify({...raw, windowEnd:raw.windowStart}), JSON.stringify({...raw, dropped:1e12}), backup+backup, "x".repeat(4*1024*1024+1)]) {
    assert.throws(() => restored.restore(invalid));
    assert.equal(restored.report().requests, 0);
  }
  assert.deepEqual(restored.restore(backup), { accepted: 1, skipped: 0 });
  assert.deepEqual(restored.restore(backup), { accepted: 0, skipped: 1 });
  assert.equal(restored.report().restoredWindows, 1);
  assert.equal(restored.report().requests, 16);
  assert.match(restored.csv(), /,restored,counts.requests,16/);
  restored.record(observation);
  assert.equal(restored.report().requests, 17);
  const future = {...raw, windowStart: new Date(now).toISOString(), windowEnd: new Date(now+300000).toISOString()};
  assert.deepEqual(restored.restore(JSON.stringify(future)), {accepted:0,skipped:1});
  now += 24*3600000;
  assert.equal(restored.report().requests, 0);
  assert.deepEqual(restored.restore(backup), {accepted:0,skipped:1});
});

test("Phase 2 audit is bounded, sanitized and separate from request counts", () => {
  let now = base;
  const events = [], store = createObservability({ now: () => now, emit: event => events.push(event) });
  store.recordAudit("hide_record", 200);
  store.recordAudit("unhide_source", 404);
  store.recordAudit("PRIVATE-ID", 200);
  store.recordAudit("hide_source", 999);
  assert.equal(store.report().requests, 0);
  assert.deepEqual(store.report().audit.map(event => [event.action,event.status]), [["unhide_source",404],["hide_record",200]]);
  assert.equal(events[0].event,"public_safety.admin_operation.v1");
  assert.deepEqual(Object.keys(events[0]).sort(),["action","at","event","status"]);
  for(let i=0;i<100;i++)store.recordAudit("import_url",422);
  assert.equal(store.report().audit.length,100);
  assert.equal(store.report().auditDropped,2);
  assert.equal(store.report().indicators.limitedCoverage,true);
  now += 24*3600000+1;
  assert.equal(store.report().audit.length,0);
});
