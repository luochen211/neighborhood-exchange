# 邻里闲置

面向同一小区、楼栋或办公室的闲置流转 Web 应用。已实现发布、搜索筛选、意向与留言、预约、取消重约、双方确认、送出归档和社区看板。发布者可请求 AI 整理文案和建议交易方式，主动采用后手动发布。

前端 React + TypeScript + Vite，后端 Node.js 24 + Fastify，数据库 SQLite + Drizzle；通过共享 OpenAPI / Zod 契约访问同源 HTTP API。30 张预置图片为 AI 生成演示素材，页面有明确标注。身份与物品数据为虚构演示数据，演示身份不是生产认证。

## 本地运行

要求 Node.js **24.x**、npm **11.x**。在仓库根目录执行：

```sh
npm ci
npm run build
cp apps/api/.env.example .env
npm run db:migrate
npm run db:seed
npm start
```

如果已有 `.env`，保留现有文件，不要用 `cp` 覆盖。示例配置默认绑定 `127.0.0.1:3000`，设置 `DEMO_MODE=true`，访问 [本地应用](http://127.0.0.1:3000)。`APP_ORIGIN` 必须与浏览器访问的协议、主机和端口完全一致；不要混用 localhost 与 127.0.0.1。

- `DATABASE_URL=./data/neighborhood.db` 是 SQLite 文件路径，相对路径从**仓库根目录**解析。
- 首次启动前迁移并填入种子；迁移当前为 v2，种子采用固定演示 ID，重复运行只补充缺失数据，不重置用户业务记录。
- 全栈生产构建由 Fastify 托管，支持详情页直达；`/api/v1/health` 返回 API / 数据库健康状态。
- 关闭进程后数据仍保留。测试和录制必须使用独立数据库，禁止删除用户数据库来“恢复演示”。

验证启动：

```sh
curl -f http://127.0.0.1:3000/api/v1/health
curl -f http://127.0.0.1:3000/api/v1/dashboard
```

开发热更新使用 `npm run dev`，先把 `.env` 的 `APP_ORIGIN` 设为 `http://127.0.0.1:5173`，浏览器访问 Vite 的 5173 端口；前端代理到本地 API。切回 `npm start` 时恢复 3000 对应 origin。

## AI 配置与边界

仅在本地根 `.env` 填写服务端 `LLM_BASE_URL`、`LLM_API_KEY` 和 `LLM_MODEL`，然后重启服务。示例配置提供 DeepSeek base/model，key 留空；不要把密钥发到聊天、前端或提交仓库。不配置密钥也能完成手动发布与完整交易，AI 请求会明确显示不可用并保留草稿。

累计真实验收 5 次请求（4 次脚本、1 次浏览器）。第 5 次返回“随便给”（FLEXIBLE/null），采用文案后真实发布；不是每次都会输出数值报价。早期全范围无效报价已修复并加入回归。AI 建议不是市场行情估价，用户自行确认；详见 [真实全栈验收](docs/delivery/acceptance.md)。

## 检查与复现

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` 包含 lint、类型检查、102 项单元/集成测试和构建；4 项 E2E 启动独立临时 SQLite 与真实 HTTP 服务，验证多身份交易、取消重约、图片解码和进程重启持久化。E2E 使用本地 3117 / 3119 端口，请保持空闲。CI 不调用付费模型，真实模型结果单独记载。

协调者已在无 `.env`、无依赖、无数据库的独立克隆中复现安装、构建、迁移、种子和启动，首页、健康与图片均返回 200。当前没有远端部署或 CD；本地验收不等于线上容量保证。

## 交付材料

- [最终交付索引与制作复现](docs/delivery/README.md)
- [Word 项目设计与实现说明书](docs/delivery/邻里闲置_项目设计说明书.docx) · [PDF](docs/delivery/邻里闲置_项目设计说明书.pdf)
- [约 5 分钟真实操作与讲解视频](docs/delivery/邻里闲置_演示视频.mp4) · [中文字幕](docs/delivery/邻里闲置_演示字幕.srt)
- [10 张 Chen E-R 图](docs/engineering/ERD.md) · [实际迁移核对](docs/delivery/erd-verification.md)
- [PRD](docs/product/PRD.md) · [SRS](docs/engineering/SRS.md) · [当前 DAG](docs/planning/DAG.md)

本次范围不包含支付、快递、真实注册、即时私聊、多社区和用户图片上传。物品交接在线下完成，软件记录双方确认。最终 Issue / Epic 由协调者审阅材料、合并 PR 并核验 main CI 后关闭。
