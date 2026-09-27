const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../docs/delivery/screenshots');
const base=process.env.PROTOTYPE_URL || 'http://127.0.0.1:8765';
const pages=[
 {route:'home',title:'社区首页',description:'卡片突出物品、新鲜度、价格和所在楼栋。搜索和交易方式筛选支持组合使用；顶部统计与底部热门信息为原型示例。'},
 {route:'detail',title:'物品详情与公开留言',description:'物品详情集中展示描述、发布者、自提方式和当前状态。用户可表达或撤回想要，公开留言可减少重复私聊。页面交互仅模拟前端状态。'},
 {route:'publish',title:'物品发布与 AI 辅助',description:'左侧填写事实信息，右侧展示固定 AI 建议示例。文案与参考价格分别采用，用户仍可修改；本页没有发出真实模型请求，也不保存业务数据。'},
 {route:'handoff',title:'预约交接与完成',description:'发布者查看领取人、时间、公共交接地点和确认进度。页面可演示取消、完成二次确认和状态反馈；这些操作未写入后端。'}
];
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const p of pages){await page.goto(`${base}/#${p.route}`,{waitUntil:'networkidle'});await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,p.route+'-desktop.png'),fullPage:true});p.file=p.route+'-desktop.png';p.viewport='1440 × 960';}
 await page.goto(base+'/#home');await page.getByRole('button',{name:'免费送',exact:true}).click();assert.equal(await page.locator('#cards > a').count(),1);
 await page.getByRole('button',{name:'全部',exact:true}).click();await page.getByRole('textbox',{name:'搜索闲置'}).fill('不存在');assert.match(await page.locator('#cards').innerText(),/没有找到/);
 await page.goto(base+'/#detail');await page.getByRole('button',{name:'我想要',exact:true}).click();await page.getByRole('button',{name:'撤回意向',exact:true}).waitFor();
 await page.goto(base+'/#publish');await page.getByRole('button',{name:'采用文案',exact:true}).click();assert.match(await page.locator('#description').inputValue(),/表面有轻微划痕/);await page.getByRole('button',{name:'采用参考价格',exact:true}).click();assert.equal(await page.locator('#price').inputValue(),'30');
 await page.goto(base+'/#handoff');await page.getByRole('button',{name:'取消预约',exact:true}).click();assert.match(await page.locator('h1').innerText(),/取消/);await page.getByRole('button',{name:'重置原型示例'}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'确认已送出',exact:true}).click();assert.match(await page.locator('h1').innerText(),/新的主人/);
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 for(const p of pages){await mobile.goto(`${base}/#${p.route}`,{waitUntil:'networkidle'});await mobile.waitForTimeout(250);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${p.route} mobile overflow`);await mobile.screenshot({path:path.join(out,p.route+'-mobile.png'),fullPage:true});}
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({kind:'prototype',source:'docs/prototype',capturedAt:new Date().toISOString(),pages,verification:{desktop:'1440x960',mobile:'390x844',overflow:false,consoleErrors:errors,interactions:['filter','empty search','want toggle','adopt sample description','adopt sample price','cancel','complete confirmation']}},null,2)+'\n');
 await browser.close();console.log('PASS: 8 browser screenshots, desktop/mobile layout, prototype interactions, no page errors');
})().catch(e=>{console.error(e);process.exit(1)});
