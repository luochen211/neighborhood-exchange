# 最终交付索引

本地全栈应用已实现并完成真实 HTTP 验收。当前报告 20 页，内含 7 张真实运行截图及 10 张独立 Chen E-R 图；实际成片约 5 分钟，带原创 BGM、中文合成讲解和字幕，采用 1080p 宽屏与章节动效。材料 PR #23 已合并为 `604a60a`，对应 main CI `36290725973` 成功；协调者独立审阅完成，#12 与 Epic #1 已验收关闭。

| 材料 | 文件 |
| --- | --- |
| 项目设计与实现说明书 | [Word](邻里闲置_项目设计说明书.docx) · [PDF](邻里闲置_项目设计说明书.pdf) |
| 实际操作与讲解成片 | [MP4](邻里闲置_演示视频.mp4) · [SRT 字幕](邻里闲置_演示字幕.srt) |
| 配乐与混音 | [独立 BGM](邻里闲置_背景音乐.mp3) · [声音制作](music.md) |
| 视频时间轴与核验 | [制作说明](video.md) · [逐段讲解稿](video-transcript.md) |
| 原始真实截图与来源 | [manifest](screenshots/manifest.json) · [桌面首页](screenshots/home-desktop.png) · [手机首页](screenshots/home-mobile.png) |
| 10 张独立图（各 SVG + PNG） | [ER 图集与映射](../engineering/ERD.md) · [实际迁移核对](erd-verification.md) |
| 全栈验收与真实模型边界 | [acceptance.md](acceptance.md) · [backend.md](backend.md) |
| 本地安装与启动 | [根 README](../../README.md) |

## 来源与边界

截图与录屏来自真实生产构建、HTTP API 和 SQLite。录屏使用端口 3130 的隔离数据库、虚构身份和物品；未对 3000 用户持久环境进行写操作。图中的预置物品照片为 AI 生成演示素材，应用已有明确标注。

`ai-preview.png` / `ai-published.png` 复用协调者此前在真实 3000 环境完成的第 5 次模型调用和发布截图。该次返回 FLEXIBLE/null，采用文案后手动发布；成片明确标为既有证据回看，不伪装为本次点击生成。本次材料制作没有新增模型调用。累计真实调用 5 次，早期全范围无效报价的失败与修复保留在验收记录。

录屏演示软件确认流程，不代表物理交接被摄录。旁白使用本机中文合成语音，交付的是实际 MP4 文件，讲解稿仅为配套。无远端部署；CI、真实模型、文档与成片分别核验。

## 重新生成材料

日常应用运行见根 README。以下流程只面向材料重录，须使用新的**隔离数据库**，不能指向现有用户数据库。Python 需 `python-docx` / Pillow / NumPy；需安装 `rsvg-convert`、Playwright Chromium、LibreOffice、Poppler、FFmpeg/ffprobe。视频脚本使用 macOS `say` 的婷婷中文语音与系统黑体，不调用在线语音服务。

```sh
npm ci
npm run build
npx playwright install chromium
# 为此次录制创建全新临时目录；保留到视频合成和核验完成。
DELIVERY_WORK=$(mktemp -d /tmp/neighborhood-delivery.XXXXXX)
export DELIVERY_WORK
export DEMO_MODE=true
export DATABASE_URL="$DELIVERY_WORK/capture.db"
export PORT=3130
export APP_ORIGIN=http://127.0.0.1:3130
export LLM_API_KEY= LLM_BASE_URL= LLM_MODEL=
# 直接启动已构建入口，不加载根 .env 的真实服务凭据。
node apps/api/dist/db/cli.js migrate
node apps/api/dist/db/cli.js seed
node apps/api/dist/server.js
```

另一个终端在同一仓库设置同一 `DELIVERY_WORK` 路径后执行：

```sh
DELIVERY_ISOLATED=true node scripts/capture_report.cjs
# 如默认 python3 不含 Pillow，设置 DELIVERY_PYTHON 为可用 Python 的绝对路径。
node scripts/render_delivery_video.cjs
python3 scripts/build_report.py
soffice -env:UserInstallation=file:///tmp/neighborhood-final-render --headless \
  --convert-to pdf --outdir docs/delivery docs/delivery/邻里闲置_项目设计说明书.docx
```

录制脚本只允许 3130 且需显式 `DELIVERY_ISOLATED=true`，阻止 AI 路由；它记录双身份操作与每段原视频，输出当前截图 manifest。两个既有真实 AI 截图已在仓库，重录不会覆盖或再次请求。成片包含 9 段真实操作和 3 段明确标注的说明，每段 25 秒；制作入口会自动加入宽屏动效、原创配乐和旁白侧链混音；原视频、旁白中间文件和备份留在工作目录，不提交过时正文或数据库。

图纸与 v2 迁移已经核对，无实体或字段变化，因此沿用经过验收的 10 对 SVG/PNG。需要重新导出时执行 `python3 scripts/render_erd.py`，再核验图内标签、完整结构、中文与主键下划线。

中文 PDF 需宋体/苹方或相应替代字体。当前机器通过 `FONTCONFIG_FILE=/tmp/neighborhood-fonts.conf` 转换；其他环境应自行配置有效字体，不假设该临时文件存在。视频字幕图层由 Pillow 读取系统黑体，说明页由 Chromium 使用本地苹方。

## 本轮实际验证

- `npm run check`：lint、typecheck、102 项测试和全部 build 通过。
- `npm run test:e2e`：4 项真实 HTTP 用例通过，含隔离 SQLite、双身份交易与进程重启。
- 录制流程完成发布、留言、想要、预约、拒绝、重约、确认、归档；本月成交只增加 1，无浏览器脚本错误、无横向溢出。
- 执行真实迁移验证 v2 / 6 表 / 9 外键；全部属性和主键对应，细节见核对记录。
- Word 内嵌 17 张图；PDF 20 页全部目视检查，图注同页、无溢出；全部原型截图已直接替换。
- MP4 时长、视频/音轨、完整解码和全部章节抽帧通过，详见视频说明。

本轮 Word 修改前副本保存在任务工作目录 `work/final-backup`；学校参考文档未修改。
