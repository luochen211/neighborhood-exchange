import fs from "node:fs";
import { chromium, expect } from "@playwright/test";
const output =
  process.env.SCREENSHOT_DIR ||
  new URL("../../../work/frontend-screenshots", import.meta.url).pathname;
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.WEB_URL || "http://127.0.0.1:5173");
  await expect(page.locator(".mode-banner")).toContainText("Mock 演示");
  const shot = async (name) => {
    for (const [width, height, suffix] of [
      [1440, 900, "desktop"],
      [390, 844, "mobile"],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => globalThis.scrollTo(0, 0));
      await page.screenshot({
        animations: "disabled",
        path: `${output}/frontend-${name}-${suffix}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <=
            globalThis.innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  };
  const identity = async (name) => {
    await page.locator(".identity").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp(name) })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator(".identity")).toContainText(name);
  };
  await page.getByRole("heading", { name: "闲置电磁炉" }).waitFor();
  await shot("home");
  await identity("邻居小林");
  await page.getByRole("navigation").getByText("发布", { exact: true }).click();
  await page.getByLabel("物品名称", { exact: true }).fill("浏览器验收 · 木椅");
  await page
    .getByLabel("物品描述", { exact: true })
    .fill("结构稳固，椅面有划痕，社区门厅自提。");
  await page.getByLabel("自提楼栋", { exact: true }).fill("1栋");
  await page.getByRole("button", { name: "生成建议", exact: true }).click();
  await page.getByRole("button", { name: "采用文案", exact: true }).click();
  await page
    .getByRole("button", { name: "采用建议方式/价格", exact: true })
    .click();
  await shot("publish");
  await page.getByRole("button", { name: "确认发布", exact: true }).click();
  await page.getByRole("heading", { name: "浏览器验收 · 木椅" }).waitFor();
  await page.waitForURL(/\/items\//);
  const itemUrl = page.url();
  await identity("邻居小周");
  await page.getByRole("button", { name: "我想要", exact: true }).click();
  await page.getByRole("button", { name: "撤回意向", exact: true }).waitFor();
  await page
    .getByLabel("留言内容")
    .fill("<script>globalThis.injected=true</script> 周末方便吗？");
  await page.getByRole("button", { name: "发送留言" }).click();
  await page
    .getByText("<script>globalThis.injected=true</script> 周末方便吗？", {
      exact: true,
    })
    .waitFor();
  expect(await page.evaluate(() => globalThis.injected)).toBeUndefined();
  await identity("邻居小林");
  await page.getByLabel("领取人").selectOption({ label: "邻居小周 · 2栋" });
  const local = (date) => {
    const d = new Date(date);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  await page.getByLabel("开始时间").fill(local(Date.now() + 3600000));
  await page.getByLabel("结束时间").fill(local(Date.now() + 7200000));
  await page.getByLabel("公共交接地点").fill("社区公共活动室门口");
  await shot("detail");
  await page.getByRole("button", { name: "发起预约", exact: true }).click();
  await page.getByText("等待领取人确认", { exact: true }).waitFor();
  await identity("邻居小周");
  await page.getByRole("button", { name: "确认预约", exact: true }).click();
  await page.getByText("已确认 · 待交接", { exact: true }).waitFor();
  await identity("邻居小林");
  await page.getByRole("navigation").getByText("我的", { exact: true }).click();
  await page.getByRole("button", { name: "交接事项", exact: true }).click();
  await page.getByRole("button", { name: "确认已送出", exact: true }).click();
  await shot("handoff");
  await page
    .getByRole("button", { name: "已交接，确认归档", exact: true })
    .click();
  await page.getByText("交接完成", { exact: true }).first().waitFor();
  await page.getByRole("navigation").getByText("历史", { exact: true }).click();
  await page.getByRole("heading", { name: "浏览器验收 · 木椅" }).click();
  await page.getByText(/所有操作已关闭/).waitFor();
  await expect(page.getByLabel("留言内容")).toHaveCount(0);
  await shot("archive");
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      result: "passed",
      errors,
      itemUrl,
      checks: [
        "publish",
        "AI explicit adoption",
        "identity switch",
        "interest",
        "plain text comments",
        "reserve",
        "confirm",
        "complete",
        "archive read only",
        "390/1440 overflow",
      ],
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
