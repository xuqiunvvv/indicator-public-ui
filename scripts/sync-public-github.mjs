import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import {DOMAIN_IDS,publicPointer,prepareRelease,encode,hash} from './public-sync-core.mjs';

export const REPOSITORY='xuqiunvvv/indicator-public-ui';
export const BRANCH='main';
export const DIRECTORY='public-site';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const ORIGIN='https://fund-indicator-governance.xuqiunvvv.chatgpt.site';

export function managementClient(token, transport=fetch) {
  assert.ok(token,'管理系统认证未提供');
  return async route=>{
    const response=await transport(new URL(route,ORIGIN),{method:'GET',headers:{'OAI-Sites-Authorization':`Bearer ${token}`,accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(60000)});
    if (!response.ok) throw new Error(`管理系统读取失败 HTTP ${response.status}，未更新GitHub`);
    assert.ok(response.headers.get('content-type')?.includes('application/json'),'管理系统未返回JSON，停止同步');
    return response.json();
  };
}
export async function readPointers(get) {
  const result=[];
  for(const id of DOMAIN_IDS) {
    const body=await get(`/api/publications?domainId=${id}`);
    assert.ok(Object.hasOwn(body,'publication'),'公开指针响应不完整');
    if(body.publication!==null) result.push(publicPointer(body.publication));
  }
  return result;
}
export async function collectRelease(get) {
  const before=await readPointers(get),bundles=[];
  for(const pointer of before) {
    const archive=await get(`/api/archives/${encodeURIComponent(pointer.archiveId)}`);
    assert.ok(archive.archive?.id===pointer.archiveId && archive.libraryRows?.length>0,'指定存档缺完整指标库，禁止补齐');
    const snapshot=await get(`/api/public-snapshot?domainId=${pointer.domainId}`);
    bundles.push({pointer,archive,snapshot});
  }
  const release=prepareRelease(bundles);
  assert.equal(encode(await readPointers(get)),encode(before),'读取过程中公开版本发生变化，停止同步');
  return {release,pointers:before};
}
export async function makeFiles(release,root=ROOT) {
  const files={};
  const source=await fs.access(path.join(root,DIRECTORY,'app.js')).then(()=>DIRECTORY,()=> 'site');
  for(const name of ['index.html','styles.css','app.js','model.js']) {
    let body=await fs.readFile(path.join(root,source,name),'utf8');
    if(name==='index.html') body=body.replace('href="/styles.css"','href="./styles.css"').replace('src="/app.js"','src="./app.js"');
    if(name==='app.js') body=body.replaceAll('fetch(`/snapshots/','fetch(`./snapshots/').replace("fetch('/snapshots/manifest.json')","fetch('./snapshots/manifest.json')").replace(", ['纳入时间', item.includedAt], ['废弃时间', item.deprecatedAt]",'');
    files[`${DIRECTORY}/${name}`]=body;
  }
  files[`${DIRECTORY}/snapshots/manifest.json`]=encode(release.manifest);
  for(const [id,snapshot] of Object.entries(release.snapshots)) files[`${DIRECTORY}/snapshots/${id}.json`]=encode(snapshot);
  // Content hashes cover both frontend source and snapshots; no run timestamp creates needless commits.
  const entries=Object.entries(files).sort(([a],[b])=>a.localeCompare(b));
  files[`${DIRECTORY}/release.json`]=encode({schemaVersion:release.manifest.schemaVersion,projectionRulesVersion:release.manifest.projectionRulesVersion,sha256:hash(entries),files:Object.fromEntries(entries.map(([name,body])=>[name,hash(body)])),domains:release.manifest.domains.map(({domainId,archiveId,count,sha256})=>({domainId,archiveId,count,sha256}))});
  for(const body of Object.values(files)) assert.ok(!/github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]+|Bearer\s+[A-Za-z0-9_.-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(body),'内容含疑似认证凭据，停止同步');
  return files;
}
export async function verifyFrontend(files) {
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'selectx-sync-check-'));
  try {
    for(const file of ['app.js','model.js']) {
      const target=path.join(temp,file.replace('.js','.mjs'));
      await fs.writeFile(target,files[`${DIRECTORY}/${file}`]);
      const result=spawnSync(process.execPath,['--check',target],{encoding:'utf8'});
      assert.equal(result.status,0,`网页脚本语法检查失败：${file}`);
    }
    const html=files[`${DIRECTORY}/index.html`],app=files[`${DIRECTORY}/app.js`];
    assert.ok(!/type="file"|导出中心|data-view=/.test(html),'静态站包含非只读功能');
    assert.ok(!/https?:|\/api\/|innerHTML/.test(app),'网页依赖管理接口或不安全渲染');
  } finally {await fs.rm(temp,{recursive:true,force:true});}
}
export function githubClient(token,transport=fetch) {
  assert.ok(token,'GitHub认证未提供');
  return async (route,method='GET',body)=>{
    const response=await transport(`https://api.github.com/repos/${REPOSITORY}/${route}`,{method,headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json','content-type':'application/json','x-github-api-version':'2022-11-28'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(60000)});
    if(!response.ok) throw new Error(`GitHub操作失败 HTTP ${response.status}，停止同步`);
    return response.json();
  };
}
export async function publishFiles(files,api,verifyPointers) {
  const ref=await api(`git/ref/heads/${BRANCH}`),head=ref.object.sha;
  const commit=await api(`git/commits/${head}`);
  const tree=await api(`git/trees/${commit.tree.sha}?recursive=1`);
  assert.equal(tree.truncated,false,'GitHub目录清单不完整');
  const existing=tree.tree.filter(e=>e.type==='blob'&&e.path.startsWith(`${DIRECTORY}/`));
  const gitHash=body=>{const bytes=Buffer.from(body);return (awaitHashObject(bytes));};
  const desired=Object.entries(files).map(([name,body])=>({name,body,sha:gitHash(body)}));
  if(existing.length===desired.length && desired.every(e=>existing.some(x=>x.path===e.name&&x.sha===e.sha))) {
    await verifyPointers();return {changed:false,commit:head};
  }
  await verifyPointers();
  const elements=[];
  for(const e of desired) {
    if(!existing.some(x=>x.path===e.name&&x.sha===e.sha)) {
      const blob=await api('git/blobs','POST',{content:e.body,encoding:'utf-8'});
      assert.equal(blob.sha,e.sha,'GitHub内容哈希不一致');
    }
    elements.push({path:e.name,mode:'100644',type:'blob',sha:e.sha});
  }
  for(const e of existing) if(!Object.hasOwn(files,e.path)) elements.push({path:e.path,mode:'100644',type:'blob',sha:null});
  const nextTree=await api('git/trees','POST',{base_tree:commit.tree.sha,tree:elements});
  await verifyPointers();
  assert.equal((await api(`git/ref/heads/${BRANCH}`)).object.sha,head,'GitHub分支并发更新，停止同步');
  const next=await api('git/commits','POST',{message:'Sync validated public indicator website',tree:nextTree.sha,parents:[head]});
  await verifyPointers();
  await api(`git/refs/heads/${BRANCH}`,'PATCH',{sha:next.sha,force:false});
  const updated=await api(`git/ref/heads/${BRANCH}`);
  assert.equal(updated.object.sha,next.sha,'提交后分支验证失败');
  return {changed:true,commit:next.sha};
}
import {createHash} from 'node:crypto';
function awaitHashObject(bytes) {return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');}

async function main() {
  // Settings (including ephemeral credentials) are read from stdin, never command arguments or files.
  let input='';for await(const part of process.stdin) input+=part;
  const settings=input.trim()?JSON.parse(input):{};
  const get=managementClient(settings.managementToken||process.env.MANAGEMENT_SITE_TOKEN);
  const {release,pointers}=await collectRelease(get);
  const files=await makeFiles(release);await verifyFrontend(files);
  const verifyPointers=async()=>assert.equal(encode(await readPointers(get)),encode(pointers),'提交前公开指针变化，停止同步');
  if(settings.commit!==true) {console.log(JSON.stringify({validated:true,committed:false,domains:release.manifest.domains}));return;}
  const result=await publishFiles(files,githubClient(settings.githubToken||process.env.GITHUB_TOKEN),verifyPointers);
  console.log(JSON.stringify({...result,repository:REPOSITORY,directory:DIRECTORY,domains:release.manifest.domains}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{console.error(error.message.replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]'));process.exitCode=1;});
