# 完整 Web 前端交付

对应 Issue #9。前端覆盖身份、发现、搜索筛选、详情、留言、发布、AI 建议采用、我的发布/意向/预约、交接、归档与社区看板。旧 #9/#10 拆分占位和插槽已移除；网页内部路由与交互由 apps/web 完整接线。

## 独立预览

要求 Node 24、npm 11。仓库根目录执行：

```sh
npm ci
npm run build -w @neighborhood/contracts
VITE_API_MODE=mock npm run dev -w @neighborhood/web
```

访问 http://127.0.0.1:5173。顶部明确显示 Mock 模式；选“邻居小林”发布，切换“邻居小周”想要，再切回发布者预约、领取者确认、发布者完成。所有演示数据来自遵循共享契约的有状态内存 handlers，页面刷新即重置，各标签页独立。AI Mock 仅返回输入原文与明确标注的示例建议，不能当真实模型结果。

## HTTP 接入与边界

```sh
# 后端由其拥有者启动；默认代理 127.0.0.1:3000
npm run dev -w @neighborhood/web
# PORT=3001 可调整代理目标端口；HOST 默认 127.0.0.1
npm run build -w @neighborhood/web
```

开发 HTTP 模式需要后端配置 `DEMO_MODE=true` 和 `APP_ORIGIN=http://127.0.0.1:5173`，否则演示身份或写请求会被后端正常拒绝。后端启动命令见 [后端交付说明](backend.md)。

`src/lib/api.ts` 是唯一业务 API adapter。所有页面只调用类型化业务方法，HTTP 与 Mock 均使用 `@neighborhood/contracts` client 验证请求和响应。默认 base URL `/api/v1`；`VITE_API_BASE_URL` 可调整同源前缀，部署使用同源反向代理。Cookie 凭据由共享 client 的 `same-origin` 策略处理，不读取 session token，不支持跨源凭据绕行。

请求统一有 18 秒客户端超时；AI 服务端契约仍为最多 15 秒。读取在路由/参数变化时取消，AI 生成可主动取消；写操作禁用重复提交，不自动重发。HTTP 状态/协议错误和 requestId 有可见反馈，不静默回退 Mock。发布/交易等成功后刷新相关读取；页面重新聚焦刷新数据，保留当前未提交输入。身份切换清除旧身份页面和发布草稿。

Mock 只在 `import.meta.env.DEV && VITE_API_MODE === 'mock'` 时动态载入。生产构建使用 HTTP，产物检查确认不包含有状态 Mock/fixtures 业务代码。服务失败时显示错误和重试，不展示示例成功。

## 图片与视觉

`src/lib/images.ts` 集中管理 `imageKey -> {label, src?, caption}`；当前使用契约四种 key 的本地 SVG 预置示意图。后续经协调批准的本地 AI 素材在这一处接入并标注“AI 演示素材”，不自行扩展共享枚举。无远程字体或图片运行依赖。

界面以物品为主，使用绿色与米白色、清晰的交易状态和公共交接信息。390px 手机使用底部导航，1440px 桌面使用顶部导航；按钮至少 44px 高，身份选择采用原生 modal dialog；键盘焦点可见，支持 reduced-motion。

## 验收证据

2026-09-27，本地 Node 24.11.1 / Chromium：

- `npm run check`：lint、全部 workspace 类型检查、89 项单元测试（同步已验收后端 main 后）与构建通过。前端回归覆盖完整状态闭环、重复意向与完成、越权、取消后重建、字面通配字符搜索/分页、归档只读、AI/发布失败保留草稿、身份切换清草稿、失败重试及新鲜度精确边界。
- 浏览器实际操作：发布 → 主动采用 AI 示例 → 切身份 → 想要 → 留言 → 预约 → 确认 → 完成 → 归档；没有 pageerror。脚本文字按纯文本显示，不执行。
- 首页、发布、详情、交接、归档在 390×844 与 1440×900 全部无横向溢出，截图已人工检查。
- 生产预览的 HTTP 503 注入检查：确实发起 `/api/v1` 请求，显示服务错误，无 Mock 标识或示例物品回退。这是前端传输故障验证，不是真实后端验收。

浏览器复现（先启动上述 Mock 预览，在仓库根运行）：

```sh
node apps/web/tests/browser-smoke.mjs
# 可用 WEB_URL、SCREENSHOT_DIR 调整地址和输出目录
```

脚本使用已锁定的 Playwright 依赖；若机器尚无浏览器，先执行 `npx playwright install chromium`。默认截图写入根目录 work/frontend-screenshots，不作为业务数据。

| 页面 | 桌面 | 手机 |
| --- | --- | --- |
| 发现 | [截图](../../apps/web/tests/screenshots/frontend-home-desktop.png) | [截图](../../apps/web/tests/screenshots/frontend-home-mobile.png) |
| 发布与 AI | [截图](../../apps/web/tests/screenshots/frontend-publish-desktop.png) | [截图](../../apps/web/tests/screenshots/frontend-publish-mobile.png) |
| 详情与预约 | [截图](../../apps/web/tests/screenshots/frontend-detail-desktop.png) | [截图](../../apps/web/tests/screenshots/frontend-detail-mobile.png) |
| 交接确认 | [截图](../../apps/web/tests/screenshots/frontend-handoff-desktop.png) | [截图](../../apps/web/tests/screenshots/frontend-handoff-mobile.png) |
| 归档只读 | [截图](../../apps/web/tests/screenshots/frontend-archive-desktop.png) | [截图](../../apps/web/tests/screenshots/frontend-archive-mobile.png) |
| HTTP 失败 | — | [截图](../../apps/web/tests/screenshots/frontend-http-error-mobile.png) |

## 验收限制

前端 Mock 与 HTTP 适配验收不证明真实数据库、真实双浏览器会话、真实模型或线上部署成功；这些由 #11 联调验收。当前仓库配置了 push/PR CI，未配置部署。新的 AI 商品素材尚由协调者处理，不阻塞当前契约四类图片验收。
