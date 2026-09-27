/** Record actual HTTP workflows against an explicitly isolated delivery database.
 * Start the isolated server as documented in docs/delivery/README.md.
 * No model requests are made. Existing real AI evidence is imported separately.
 */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=process.env.DELIVERY_URL || 'http://127.0.0.1:3130';
if (new URL(base).port!=='3130' || process.env.DELIVERY_ISOLATED!=='true') throw Error('Use explicitly isolated port 3130 with DELIVERY_ISOLATED=true');
const out=path.resolve(__dirname,'../docs/delivery/screenshots');
const raw=path.resolve(process.env.DELIVERY_WORK || path.join(__dirname,'../../final-video'));
const pages=[], scenes=[], errors=[], states={};
const localTime=ms=>{const d=new Date(ms);return new Date(ms-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
let browser,itemUrl,baseline;
async function ready(p){await p.waitForLoadState('networkidle');await p.locator('.mode-banner').waitFor();assert(!((await p.locator('.mode-banner').innerText()).includes('Mock')));}
async function screenshot(p,slug,title,description,fullPage=false){
 await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(200);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.screenshot({path:path.join(out,`${slug}.png`),fullPage,animations:'disabled'});
 pages.push({route:new URL(p.url()).pathname,file:`${slug}.png`,title,description,viewport:'1280 × 720',source:'3130 隔离 SQLite / 真实 HTTP 浏览器',capturedAt:new Date().toISOString()});
}
async function login(p,name){await p.locator('.identity').click();await p.getByRole('dialog').getByRole('button',{name:new RegExp(name)}).click();await p.getByRole('dialog').waitFor({state:'hidden'});}
async function scene(n,title,role,route,lines,fn){
 const ctx=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:raw,size:{width:1280,height:720}},storageState:states[role]});
 const p=await ctx.newPage(); p.on('pageerror',e=>errors.push(e.message));
 // Abort accidental AI requests rather than risk invoking a provider during delivery.
 await p.route('**/api/v1/ai/**',r=>{throw Error('Model calls are forbidden in delivery capture: '+r.request().url())});
 const start=Date.now();await p.goto(base+route);await ready(p);
 await fn(p,ctx);await p.waitForTimeout(Math.max(0,24500-(Date.now()-start)));
 states[role]=await ctx.storageState();const video=p.video();await ctx.close();
 const file=path.join(raw,`${String(n).padStart(2,'0')}.webm`);await video.saveAs(file);
 scenes.push({number:n,title,source:'真实HTTP录屏 · 隔离演示数据 · 127.0.0.1:3130',video:file,lines});
 fs.writeFileSync(path.join(raw,'scenes.json'),JSON.stringify(scenes,null,2));
 console.log(`Recorded ${n}: ${title}`);
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});fs.mkdirSync(raw,{recursive:true});
 browser=await chromium.launch({headless:true});
 await scene(1,'让闲置及时被邻居看见','owner','/',[
 '邻里闲置，帮助同一社区的邻居发现物品、预约交接。',
 '这里是真实网页、接口和数据库；画面使用隔离演示数据。',
 '支持搜索和交易方式筛选；图片是生成的演示图片。'],async(p,ctx)=>{
 baseline=(await (await ctx.request.get(base+'/api/v1/dashboard')).json()).data;
 await screenshot(p,'home-desktop','社区首页与数据库看板','真实 HTTP 读取物品和统计；当前在售包含可领取与已预约。');
 await p.waitForTimeout(6000);await p.getByRole('button',{name:'免费送',exact:true}).click();await p.waitForTimeout(4000);
 await p.getByRole('button',{name:'全部',exact:true}).click();await login(p,'林小禾');
 });
 await scene(2,'发布者填写事实并手动发布','owner','/publish',[
 '发布者林小禾填写木椅的真实情况、交易方式和楼栋。',
 '本次选择免费送，使用预置图片，不发起新的模型请求。',
 '点击确认发布后，后端写入数据库，进入物品详情。'],async p=>{
 await p.getByLabel('物品名称',{exact:true}).fill('邻里演示 · 实木餐椅');
 await p.getByLabel('物品描述',{exact:true}).fill('虚构演示物品：搬家转让实木餐椅，椅面有轻微划痕，结构稳固。免费送，社区公共活动室自取。');
 await p.getByLabel('自提楼栋',{exact:true}).fill('1 号楼');
 await screenshot(p,'publish-desktop','物品发布','真实发布表单；演示本次手动发布，未调用模型。');
 await p.waitForTimeout(6000);await p.getByRole('button',{name:'确认发布',exact:true}).click();await p.waitForURL(/\/items\//);itemUrl=new URL(p.url()).pathname;
 await screenshot(p,'detail-desktop','物品详情','物品已真实保存；图片、描述、发布者与物品状态来自 HTTP API。');
 });
 await scene(3,'领取者表达意向并公开留言','recipient',itemUrl,[
 '另一个独立浏览器会话，使用周同学的演示身份。',
 '领取者点击我想要，意向名单由后端保存。',
 '公开留言询问交接事项，让其他邻居也能看到答复。'],async p=>{
 await login(p,'周同学');await p.waitForTimeout(3500);await p.getByRole('button',{name:'我想要',exact:true}).click();
 await p.getByRole('button',{name:'撤回意向',exact:true}).waitFor();await p.waitForTimeout(3000);
 await p.getByLabel('留言内容').fill('周末可以到公共活动室领取，谢谢！');await p.getByRole('button',{name:'发送留言',exact:true}).click();
 await p.getByText('留言已发送。',{exact:true}).waitFor();
 });
 const reserve=async p=>{
 await p.getByLabel('领取人',{exact:true}).selectOption({label:'周同学 · 3 号楼'});
 await p.getByLabel('开始时间').fill(localTime(Date.now()+3600000));await p.getByLabel('结束时间').fill(localTime(Date.now()+7200000));
 await p.getByLabel('公共交接地点').fill('社区公共活动室门口');await p.waitForTimeout(4000);
 await p.getByRole('button',{name:'发起预约',exact:true}).click();await p.getByText('等待领取人确认',{exact:true}).waitFor();
 };
 await scene(4,'发布者选择领取人并预约','owner',itemUrl,[
 '发布者从意向名单选择周同学，填写未来七天内的时间。',
 '交接地点选择公共区域；具体预约信息仅交易双方可见。',
 '预约成功后，物品变为已预约，等待领取者确认。'],async p=>{
 await p.locator('.reservation').scrollIntoViewIfNeeded();await reserve(p);
 await p.locator('.trade-card').scrollIntoViewIfNeeded();await screenshot(p,'reservation-desktop','预约与双方交接信息','发布者选择意向用户和公共地点；真实预约状态为待确认。',true);
 await p.locator('.trade-card').scrollIntoViewIfNeeded();
 });
 await scene(5,'拒绝预约后恢复可领取','recipient',itemUrl,[
 '如果时间不合适，领取者可以拒绝预约。',
 '后端保留取消历史，同时把物品恢复为可领取。',
 '原有意向仍可用；取消记录不会被当作一次成交。'],async p=>{
 await p.locator('.trade-card').scrollIntoViewIfNeeded();await p.waitForTimeout(6000);
 await p.getByRole('button',{name:'拒绝预约',exact:true}).click();await p.getByRole('button',{name:'撤回意向',exact:true}).waitFor();
 await p.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));
 });
 await scene(6,'重新预约并保留取消历史','owner',itemUrl,[
 '发布者可以重新选择同一位邻居，建立新的预约。',
 '每件物品最多一笔未取消交易，由数据库唯一索引保护。',
 '旧取消请求的重试不会破坏新预约，已通过回归测试。'],async p=>{
 await p.locator('.reservation').scrollIntoViewIfNeeded();await reserve(p);
 await p.locator('.trade-card').filter({hasText:'等待领取人确认'}).scrollIntoViewIfNeeded();
 });
 await scene(7,'领取者确认预约','recipient',itemUrl,[
 '周同学核对交接时间和地点，确认新的预约。',
 '交易状态变为已确认、待交接，物品仍是已预约。',
 '真正的物品交付在线下完成；网页负责记录双方确认。'],async p=>{
 await p.locator('.trade-card').filter({hasText:'等待领取人确认'}).scrollIntoViewIfNeeded();await p.waitForTimeout(6000);
 await p.getByRole('button',{name:'确认预约',exact:true}).click();await p.getByText('已确认 · 待交接',{exact:true}).waitFor();
 });
 await scene(8,'发布者二次确认并归档','owner',itemUrl,[
 '演示确认流程：发布者点击确认已送出。',
 '二次确认后，交易与物品状态在同一事务内更新。',
 '物品归档后保留信息和留言，关闭新的交易与留言操作。'],async p=>{
 await p.locator('.trade-card').filter({hasText:'已确认 · 待交接'}).scrollIntoViewIfNeeded();await p.waitForTimeout(3000);
 await p.getByRole('button',{name:'确认已送出',exact:true}).click();await p.waitForTimeout(5000);
 await p.getByRole('button',{name:'已交接，确认归档',exact:true}).click();await p.getByText(/所有操作已关闭/).waitFor();
 await screenshot(p,'archive-desktop','已送出归档','本次演示交易已完成并归档；历史详情与留言保留，写操作关闭。',true);
 });
 await scene(9,'统计更新与手机适配','owner','/',[
 '完成交易后，本月成交增加一次，不重复计数。',
 '页面兼容手机浏览器，物品、状态和操作保持清楚。',
 '本次录制的完整交易使用真实接口，没有操作用户数据库。'],async(p,ctx)=>{
 const after=(await (await ctx.request.get(base+'/api/v1/dashboard')).json()).data;assert.equal(after.completedThisMonth,baseline.completedThisMonth+1);
 await p.waitForTimeout(7000);await p.setViewportSize({width:390,height:720});await ready(p);
 await p.screenshot({path:path.join(out,'home-mobile.png'),fullPage:true});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.waitForTimeout(5000);await p.goto(base+itemUrl);await ready(p);await p.screenshot({path:path.join(out,'archive-mobile.png'),fullPage:true});
 });
 assert.deepEqual(errors,[]);
 pages.push({route:'/publish',file:'ai-preview.png',title:'真实 AI 建议预览（既有验收截图）',description:'协调者在真实 3000 环境进行第 5 次 DeepSeek 调用：FLEXIBLE/null。核验文案事实后采用并手动发布；本次材料录制没有新增调用，也不声称本次获得数值报价。',viewport:'1440 × 1000，全页截图',source:'3000 真实全栈；协调者已完成的第 5 次模型调用，复用原始截图'},
 {route:'/items/:id',file:'ai-published.png',title:'采用 AI 文案后真实发布（既有验收截图）',description:'已采用文案与建议交易方式并手动确认发布；详情加载完成后采集。对应上一幅既有真实调用，不是视频录制期间新调用。',viewport:'1440 × 1000，全页截图',source:'3000 真实全栈；协调者已完成的发布操作，复用原始截图'});
 const manifest={kind:'real-http',capturedAt:new Date().toISOString(),base,isolatedDatabase:true,modelCallsDuringCapture:0,pages,verification:{consoleErrors:errors,desktop:'1280x720',mobile:'390x720',overflow:false,completedDelta:1,workflow:['publish','interest','comment','reserve','reject','reserve again','confirm','complete','archive']}};
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await browser.close();console.log('PASS: real HTTP delivery capture, no model calls, complete transaction and cancellation');
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1});
