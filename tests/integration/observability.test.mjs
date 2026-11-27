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
