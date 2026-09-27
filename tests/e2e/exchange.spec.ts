import { test, expect, type Page, type TestInfo } from '@playwright/test';
const base = 'http://127.0.0.1:3117';
const localTime = (ms: number) => { const d = new Date(ms); return new Date(ms-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
async function login(page: Page, name: string) {
  await page.goto('/'); await page.waitForLoadState('networkidle');
  await expect(page.locator('.mode-banner')).not.toContainText('Mock');
  await page.locator('.identity').click();
  await page.getByRole('dialog').getByRole('button', {name:new RegExp(name)}).click();
  await expect(page.locator('.identity')).toContainText(name);
  await expect(page.getByRole('dialog')).not.toBeVisible();
}
async function publish(page: Page, name: string) {
  await page.getByRole('navigation').getByText('发布',{exact:true}).click();
  await page.getByLabel('物品名称',{exact:true}).fill(name);
  await page.getByLabel('物品描述',{exact:true}).fill('虚构验收物品，椅面有划痕，结构稳固。');
  await page.getByLabel('自提楼栋',{exact:true}).fill('1 号楼');
  await page.getByRole('button',{name:'确认发布',exact:true}).click();
  await page.waitForURL(/\/items\//);
  await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  return page.url();
}
async function reserve(page: Page) {
  await page.getByLabel('领取人',{exact:true}).selectOption({label:'周同学 · 3 号楼'});
  await page.getByLabel('开始时间').fill(localTime(Date.now()+3600000));
  await page.getByLabel('结束时间').fill(localTime(Date.now()+7200000));
  await page.getByLabel('公共交接地点').fill('社区公共活动室门口');
  await page.getByRole('button',{name:'发起预约',exact:true}).click();
  await expect(page.getByText('等待领取人确认',{exact:true})).toBeVisible();
}
async function shot(page: Page, info: TestInfo, name: string) {
  for (const [width,height,suffix] of [[1440,900,'desktop'],[390,844,'mobile']] as const) {
    await page.setViewportSize({width,height}); await page.evaluate(()=>window.scrollTo(0,0));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`${name}-${suffix}.png`),fullPage:true,animations:'disabled'});
  }
  await page.setViewportSize({width:1440,height:900});
}
test('real HTTP two-session publication, privacy, handoff, archive and dashboard', async ({browser},info)=>{
  const a=await browser.newContext({baseURL:base,viewport:{width:1440,height:900}});
  const b=await browser.newContext({baseURL:base,viewport:{width:390,height:844}});
  const c=await browser.newContext({baseURL:base});
  try {
    const owner=await a.newPage(), recipient=await b.newPage(), stranger=await c.newPage();
    const errors:string[]=[]; for(const p of [owner,recipient,stranger])p.on('pageerror',e=>errors.push(e.message));
    await login(owner,'林小禾'); await login(recipient,'周同学'); await login(stranger,'陈阿姨');
    const before=(await (await a.request.get('/api/v1/dashboard')).json()).data;
    await shot(owner,info,'home');
    const images = owner.locator('img');
    expect(await images.count()).toBeGreaterThan(0);
    for (const img of await images.all()) { await img.scrollIntoViewIfNeeded(); await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true); }
    const url=await publish(owner,'真实联调 · 木椅'); const id=url.split('/').at(-1)!;
    await recipient.goto(url); await recipient.getByRole('button',{name:'我想要',exact:true}).click();
    await expect(recipient.getByRole('button',{name:'撤回意向',exact:true})).toBeVisible();
    await recipient.getByLabel('留言内容').fill('<script>window.untrusted=1</script> 周末方便吗？');
    await recipient.getByRole('button',{name:'发送留言',exact:true}).click();
    await expect(recipient.getByText('<script>window.untrusted=1</script> 周末方便吗？',{exact:true})).toBeVisible();
    expect(await recipient.evaluate(()=>('untrusted' in window))).toBe(false);
    expect((await c.request.get(`/api/v1/items/${id}/interests`)).status()).toBe(403);
    await owner.reload(); await reserve(owner); await shot(owner,info,'reservation');
    const trades=(await (await a.request.get('/api/v1/me/trades')).json()).data;
    const trade=trades.find((t:{itemId:string})=>t.itemId===id);
    expect((await c.request.get(`/api/v1/trades/${trade.id}`)).status()).toBe(403);
    expect((await c.request.post(`/api/v1/trades/${trade.id}/confirm`)).status()).toBe(403);
    await stranger.goto(url); await expect(stranger.getByText('社区公共活动室门口',{exact:true})).toHaveCount(0);
    await recipient.reload(); await recipient.getByRole('button',{name:'确认预约',exact:true}).click();
    await expect(recipient.getByText('已确认 · 待交接',{exact:true})).toBeVisible();
    await owner.reload(); await owner.getByRole('button',{name:'确认已送出',exact:true}).click();
    await shot(owner,info,'handoff');
    await owner.getByRole('button',{name:'已交接，确认归档',exact:true}).click();
    await expect(owner.getByText(/所有操作已关闭/)).toBeVisible();
    await recipient.reload(); await expect(recipient.getByLabel('留言内容')).toHaveCount(0);
    expect((await b.request.post(`/api/v1/items/${id}/comments`,{data:{body:'归档禁止写入'}})).status()).toBe(409);
    expect((await a.request.post(`/api/v1/trades/${trade.id}/complete`)).status()).toBe(200);
    const after=(await (await a.request.get('/api/v1/dashboard')).json()).data;
    expect(after.completedThisMonth).toBe(before.completedThisMonth+1);
    await shot(owner,info,'archive');
    expect((await (await a.request.get('/api/v1/auth/me')).json()).data.nickname).toBe('林小禾');
    expect((await (await b.request.get('/api/v1/auth/me')).json()).data.nickname).toBe('周同学');
    expect(errors).toEqual([]);
  } finally {await a.close();await b.close();await c.close();}
});
test('real cancellation restores availability; AI unavailable preserves manual draft',async({browser},info)=>{
  const a=await browser.newContext({baseURL:base}),b=await browser.newContext({baseURL:base});
  try {
    const owner=await a.newPage(),recipient=await b.newPage();
    await login(owner,'林小禾');await login(recipient,'周同学');
    await owner.goto('/publish');await owner.getByLabel('物品名称',{exact:true}).fill('AI失败后手工发布');
    await owner.getByLabel('物品描述',{exact:true}).fill('已填写的真实手工草稿');
    await owner.getByRole('button',{name:'生成建议',exact:true}).click();
    await expect(owner.getByText(/AI 尚未配置/)).toBeVisible();
    await expect(owner.getByLabel('物品描述',{exact:true})).toHaveValue('已填写的真实手工草稿');
    await shot(owner,info,'publish');
    await owner.getByLabel('自提楼栋',{exact:true}).fill('1号楼');
    await owner.getByRole('button',{name:'确认发布',exact:true}).click();await owner.waitForURL(/\/items\//);
    const url=owner.url(),id=url.split('/').at(-1)!;
    await recipient.goto(url);await recipient.getByRole('button',{name:'我想要',exact:true}).click();
    await expect(recipient.getByRole('button',{name:'撤回意向',exact:true})).toBeVisible();
    await owner.reload();await reserve(owner);
    const first=(await (await a.request.get('/api/v1/me/trades')).json()).data.find((t:{itemId:string})=>t.itemId===id);
    await recipient.reload();await recipient.getByRole('button',{name:'拒绝预约',exact:true}).click();
    await expect(recipient.getByRole('button',{name:'撤回意向',exact:true})).toBeVisible();
    await owner.reload();await reserve(owner);
    const next=(await (await a.request.get('/api/v1/me/trades')).json()).data.find((t:{itemId:string;status:string})=>t.itemId===id&&t.status==='PENDING');
    expect(next.id).not.toBe(first.id);
    expect((await b.request.post(`/api/v1/trades/${first.id}/cancel`)).status()).toBe(200);
    expect((await (await a.request.get(`/api/v1/items/${id}`)).json()).data.status).toBe('RESERVED');
    expect((await (await b.request.get(`/api/v1/trades/${next.id}`)).json()).data.status).toBe('PENDING');
  }finally{await a.close();await b.close();}
});
test('all 30 catalog photos are served and decode in the real browser', async ({ page }) => {
  const { ITEM_IMAGES } = await import('@neighborhood/contracts');
  await page.goto('/');
  expect(ITEM_IMAGES).toHaveLength(30);
  for (const asset of ITEM_IMAGES) {
    const result = await page.evaluate(async (file) => {
      const response = await fetch(`/demo-items/${file}`);
      if (!response.ok) return { status: response.status, width: 0 };
      const bitmap = await createImageBitmap(await response.blob());
      const width = bitmap.width; bitmap.close();
      return { status: response.status, width };
    }, asset.file);
    expect(result).toEqual({ status: 200, width: 800 });
  }
});
