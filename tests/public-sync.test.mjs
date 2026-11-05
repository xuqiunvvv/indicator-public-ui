import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareRelease,projectIndexSnapshot,hash,encode} from '../scripts/public-sync-core.mjs';
import {collectRelease,makeFiles,verifyFrontend,publishFiles,managementClient,DIRECTORY} from '../scripts/sync-public-github.mjs';
const fixture=()=>{
  const pointer={domainId:'bond',domainName:'选债券',archiveId:'V20261105-BOND-002',publishedAt:'2026-11-05T05:49:50.773Z',policy:{showDeprecated:true,showParameters:true,showDsInterfaceId:false,showApiUri:false,allowExport:true}};
  const row={biz_type:'债券',level1_category:'债券',level2_category:'基本',indicator_code:'BOND1',indicator_name:'索引名称',indicator_type:'数值型',indicator_synonyms:'["别名"]',indicator_desc:'索引介绍',indicator_unit:'元',indicator_freq:'静态',is_realtime:0,filter_operators:'["EQ"]',api_name:'DataBrowser',api_uri:'PRIVATE-URI',ds_interface_id:'',input_options:'[{"parameter_type":"TIME","parameter_name":"日期"}]',output_options:'[{"param_name":"结果","support_operators":["EQ"]}]',is_active:1};
  const snapshot={publication:{...pointer,totalCount:1,effectiveCount:1,deprecatedCount:0,publishedBy:'PRIVATE-PERSON'},libraryRows:[{key:'BOND1',name:'旧名称',params:{output:[{support_operators:['IN']}]}}],indexRows:[row]};
  return {pointer,snapshot,archive:{archive:{id:pointer.archiveId,domainId:'bond',totalCount:1},libraryRows:[{key:'BOND1',status:'有效',dsIds:['DS-1'],apiName:'DataBrowser'}]}};
};
test('index alone determines shared display fields and parameters; internal columns excluded',()=>{
  const f=fixture(),r=projectIndexSnapshot(f.snapshot,f.pointer,f.archive),row=r.libraryRows[0];
  assert.equal(row.name,'索引名称');assert.equal(row.dsInterfaceId,'DS-1');assert.equal(row.apiName,'DataBrowser');assert.deepEqual(row.params.output[0].support_operators,['EQ']);
  for(const value of ['PRIVATE-URI','PRIVATE-ID','PRIVATE-PERSON','INTERNAL','旧名称'])assert.ok(!encode(r).includes(value));
  assert.deepEqual(row.params.time,[{parameter_type:'TIME',parameter_name:'日期'}]);
});
test('reject missing fields, invalid param JSON, duplicate IDs, wrong counts and archive substitution',()=>{
  for(const mutate of [f=>delete f.snapshot.indexRows[0].indicator_desc,f=>f.snapshot.indexRows[0].input_options='{',f=>f.snapshot.indexRows.push(f.snapshot.indexRows[0]),f=>f.snapshot.publication.totalCount=2,f=>f.archive.libraryRows=[],f=>f.archive.archive.id='OTHER',f=>f.snapshot.indexRows[0].indicator_code='OTHER',f=>f.snapshot.indexRows[0].is_active='1',f=>f.snapshot.indexRows[0].output_options='[{"support_operators":["IN"]}]',f=>f.snapshot.indexRows[0].input_options='[{"parameter_type":"OTHER"}]',f=>f.snapshot.indexRows[0].output_options='[{"token":"secret"}]']){
    const f=fixture();mutate(f);assert.throws(()=>projectIndexSnapshot(f.snapshot,f.pointer,f.archive));
  }
});
test('public policy hides parameters and rejects policy drift',()=>{
  let f=fixture();f.pointer.policy.showParameters=false;assert.deepEqual(projectIndexSnapshot(f.snapshot,f.pointer,f.archive).libraryRows[0].params,{time:[],enum:[],custom:[],output:[]});
  f=fixture();f.snapshot.publication={...f.snapshot.publication,policy:{...f.pointer.policy,showParameters:false}};assert.throws(()=>projectIndexSnapshot(f.snapshot,f.pointer,f.archive));
});
test('owner-authorized DS column uses only selected frozen archive and rejects mismatches',()=>{
 const f=fixture();f.archive.libraryRows[0].dsIds=['2119','2085'];
 assert.equal(projectIndexSnapshot(f.snapshot,f.pointer,f.archive).libraryRows[0].dsInterfaceId,'2119,2085');
 f.snapshot.indexRows[0].ds_interface_id='OTHER';assert.throws(()=>projectIndexSnapshot(f.snapshot,f.pointer,f.archive),/DS接口ID/);
 f.snapshot.indexRows[0].ds_interface_id='';delete f.archive.libraryRows[0].dsIds;assert.throws(()=>projectIndexSnapshot(f.snapshot,f.pointer,f.archive),/DS接口ID/);
});
test('API name must match index and frozen archive; API URI stays excluded',()=>{
 const f=fixture();f.snapshot.indexRows[0].api_name='TopList';f.archive.libraryRows[0].apiName='TopList';
 const result=projectIndexSnapshot(f.snapshot,f.pointer,f.archive);assert.equal(result.libraryRows[0].apiName,'TopList');assert.ok(!encode(result).includes('PRIVATE-URI'));
 f.snapshot.indexRows[0].api_name='Other';assert.throws(()=>projectIndexSnapshot(f.snapshot,f.pointer,f.archive),/API名称/);
});
test('stable hash ignores object key order; schema and rule versions enter release',()=>{
  assert.equal(hash({a:1,b:2}),hash({b:2,a:1}));const r=prepareRelease([fixture()]);assert.ok(r.manifest.schemaVersion&&r.manifest.projectionRulesVersion);assert.throws(()=>prepareRelease([]));
});
test('unpublished domains are never sent to bootstrap snapshot endpoint',async()=>{
  const f=fixture(),calls=[];const get=async route=>{calls.push(route);if(route.startsWith('/api/publications'))return {publication:route.endsWith('=bond')?f.pointer:null};if(route.startsWith('/api/archives'))return f.archive;return f.snapshot;};
  const result=await collectRelease(get);assert.equal(result.release.manifest.domains.length,1);assert.ok(!calls.some(r=>r.includes('public-snapshot')&&r.includes('hkshare')));
});
test('changed publication during collection stops entire run',async()=>{
  const f=fixture();let count=0;await assert.rejects(collectRelease(async route=>{if(route.startsWith('/api/publications')){if(!route.endsWith('=bond'))return {publication:null};count++;return {publication:count>1?{...f.pointer,archiveId:'NEW'}:f.pointer};}return route.startsWith('/api/archives')?f.archive:f.snapshot;}),/变化/);
});
test('403 and redirected/non-JSON responses fail closed without logging response body',async()=>{
  await assert.rejects(managementClient('test',async()=>new Response('private error',{status:403}))('/api/publications'),/403/);
  await assert.rejects(managementClient('test',async()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}}))('/api/publications'),/JSON/);
});
test('generated subdirectory site uses relative resource paths and validates frontend syntax',async()=>{
  const files=await makeFiles(prepareRelease([fixture()]));await verifyFrontend(files);
  assert.ok(files[`${DIRECTORY}/index.html`].includes('href="./styles.css"'));assert.ok(files[`${DIRECTORY}/app.js`].includes("fetch('./snapshots/manifest.json')"));
  assert.ok(!files[`${DIRECTORY}/app.js`].includes('item.includedAt'));
  assert.deepEqual(Object.keys(files).sort(),['app.js','index.html','model.js','release.json','snapshots/bond.json','snapshots/manifest.json','styles.css'].map(p=>`${DIRECTORY}/${p}`).sort());
});
const blobHash=body=>createHash('sha1').update(`blob ${Buffer.byteLength(body)}\0`).update(body).digest('hex');
function githubFixture(files,{same=false,concurrent=false,blobFails=false}={}){
  const calls=[];let refCount=0,head='HEAD';const api=async(route,method='GET',body)=>{
    calls.push({route,method,body});
    if(route==='git/ref/heads/main'){refCount++;return {object:{sha:concurrent&&refCount>1?'OTHER':head}};}
    if(route==='git/commits/HEAD')return {tree:{sha:'TREE'}};
    if(route.startsWith('git/trees/TREE'))return {truncated:false,tree:same?Object.entries(files).map(([path,body])=>({type:'blob',path,sha:blobHash(body)})):[{type:'blob',path:'README.md',sha:'KEEP'},{type:'blob',path:'public-site/snapshots/old.json',sha:'REMOVE'}]};
    if(route==='git/blobs'){if(blobFails)throw Error('blob failed');return {sha:blobHash(body.content)};}
    if(route==='git/trees')return {sha:'NEW-TREE'};
    if(route==='git/commits')return {sha:'NEW-COMMIT'};
    if(route==='git/refs/heads/main'){assert.equal(body.force,false);head=body.sha;return {object:{sha:head}};}
    throw Error('Unexpected route');
  };return {calls,api};
}
test('unchanged content performs zero GitHub writes',async()=>{
  const files={'public-site/index.html':'hello'},g=githubFixture(files,{same:true});const r=await publishFiles(files,g.api,async()=>{});assert.equal(r.changed,false);assert.ok(g.calls.every(c=>c.method==='GET'));
});
test('one commit publishes full validated tree, keeps unrelated paths and removes stale snapshot',async()=>{
  const files={'public-site/index.html':'hello'},g=githubFixture(files);const r=await publishFiles(files,g.api,async()=>{});assert.equal(r.commit,'NEW-COMMIT');
  const t=g.calls.find(c=>c.route==='git/trees'&&c.method==='POST').body;assert.equal(t.base_tree,'TREE');assert.ok(!t.tree.some(e=>e.path==='README.md'));assert.equal(t.tree.find(e=>e.path.endsWith('old.json')).sha,null);
  assert.equal(g.calls.filter(c=>c.route==='git/commits'&&c.method==='POST').length,1);
});
test('failed upload, pointer drift, or concurrent branch update never advances branch',async()=>{
  for(const mode of ['blob','pointer','concurrent']){
    const files={'public-site/index.html':'hello'},g=githubFixture(files,{blobFails:mode==='blob',concurrent:mode==='concurrent'});
    await assert.rejects(publishFiles(files,g.api,async()=>{if(mode==='pointer')throw Error('pointer drift');}));
    assert.ok(!g.calls.some(c=>c.route==='git/refs/heads/main'&&c.method==='PATCH'));
  }
});
