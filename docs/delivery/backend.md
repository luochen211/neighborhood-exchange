# 完整后端交付（Issue #4）

本后端实现共享契约的全部 23 个操作，包含真实 SQLite、身份会话、发布/检索、留言/意向、预约状态机、我的列表、看板、LLM 适配与健康检查。全部接口经共享 endpoint 输入和输出 schema 校验。Refs #4。

## 独立运行

在仓库根使用 Node 24 / npm 11：

```sh
npm ci
npm run build -w @neighborhood/contracts
cp apps/api/.env.example .env
npm run db:migrate -w @neighborhood/api
npm run db:seed -w @neighborhood/api
npm run dev -w @neighborhood/api
```

`db:seed` 要求 `.env` 或环境设置 `DEMO_MODE=true`；关闭时明确拒绝种子命令。`.env` 示例不含模型凭据，默认绑定 127.0.0.1。`DATABASE_URL` 为 SQLite 文件路径，**相对路径始终从仓库根解析**，不依赖调用者当前目录。缺省为根目录 `data/neighborhood.db`。测试专用可设置 `:memory:`。

启动会执行版本化迁移（当前 `PRAGMA user_version=2`），不会自动 seed 或重置数据库。重复 seed 使用固定虚构 ID，仅插入缺失记录，不覆盖既有业务行。禁止对用户库执行测试重置。所有会话 token 仅在 HttpOnly Cookie 中返回，数据库只存 SHA-256 哈希，24 小时有效；切换身份撤销旧 token，登出幂等，DEMO_MODE=false 时旧演示会话失效。

只构建/运行后端，无需构建前端：

```sh
npm run build -w @neighborhood/contracts
npm run build -w @neighborhood/api
npm start -w @neighborhood/api
curl -f http://127.0.0.1:3000/api/v1/health
curl -f http://127.0.0.1:3000/api/v1/demo/users
```

前端 dist 不存在时启动明确记录“running API only”，页面返回 JSON 404；API 正常可用。存在前端 dist 时支持 SPA 深链接，API/静态资源 404 不回退为 HTML。生产同源 APP_ORIGIN 使用实际 HTTP(S) origin；本地 Vite 开发则设 `http://127.0.0.1:5173`。写请求带 Origin 时必须精确匹配；无 Origin 的本地 CLI 可用。Cookie 为 neighborhood_session，Path=/、HttpOnly、SameSite=Lax，HTTPS origin 自动 Secure。

根目录也可直接运行 `npm run db:migrate` 与 `npm run db:seed`；它们调用相同的 workspace 命令，无新增依赖。

## 验收命令与证据

```sh
npm run test -w @neighborhood/api
npm run check
node apps/api/scripts/http-acceptance.mjs
```

HTTP 脚本要求先构建 contracts/api，自动创建临时持久化数据库、随机本地端口与虚构数据，结束关闭和删除临时库；不读取或重置用户数据库。脚本使用真实 fetch、Cookie 和共享响应 schema，完成双身份发布 → 留言/想要 → 预约 → 确认 → 完成 → 归档，并测量读取性能。

2026-09-27 本地结果：

| 验收 | 结果 |
| --- | --- |
| `npm run check` | lint、全部 workspace typecheck、79 项测试、全部 workspace build 通过 |
| 后端测试 | 29 项通过；临时 SQLite 文件与独立会话 |
| HTTP 双身份闭环 | 通过，真实监听端口与 Cookie |
| 性能 | 1,000 条物品，5 并发客户端，100 个读取样本，预热后 p95 14.37ms，目标 <=500ms |
| 性能环境 | macOS arm64、Apple M4、Node v24.11.1；本机结果不代表远端容量 |
| 持久化 | 关闭数据库/应用后重新打开，物品、已完成交易和有效 session 可读取 |
| 远端 CI | PR 的 CI 结果为最终依据，由执行者跟进终态后交协调者审查 |
| 远端部署 | 未配置部署工作流；GitHub deployments 查询为 0，无线上 URL 可验收 |
| 真实 LLM | 后续已由 #11 完成累计 5 次真实请求与浏览器采用/发布，见下文及 acceptance.md；stub 不等于真实成功 |

实际发现并修复：SQL LIKE 转义字符的 JavaScript 转义错误；模型超时测试需等待上游 stub 启动后再推进假时钟；HTTP 性能脚本初版 SQL 占位符数量错误。上述修复后均重跑通过，没有将失败项记为通过。真实浏览器联调已由 #11 完成，当前全栈结果见 acceptance.md；此处保留后端独立验收时的测试与性能样本。

## 业务与安全覆盖

- 六张业务表，SQLite 外键、WAL、1.5 秒 busy timeout、版本迁移；价格/状态 CHECK、唯一有效交易部分索引（包括 COMPLETED，排除 CANCELLED）。ORM schema 负责类型映射，版本 SQL 是数据库约束真源。
- 创建/取消/确认/完成、意向修改及留言写入在同步事务中重新读取状态；写事务使用 BEGIN IMMEDIATE，物品/交易条件更新保证状态前提。人为注入数据库触发器故障验证整笔事务回滚，不留孤立预约或半完成物品。
- 重复确认/取消/完成先验权限，返回原交易，不重写时间；旧已取消请求不会改变后续新预约。已预约不接受意向变更但可留言，归档禁止业务写入。
- 私有交易内容仅双方读取，物主名单仅物主；公开物品不含交接地点。客户端不能指定物主/留言作者；未知字段拒绝。业务每用户每分钟 60 次写入，JSON 最大 32KB；数据库忙明确 503 DATABASE_BUSY。
- 标题/描述搜索与状态/方式 AND 组合；中文子串、拉丁大小写、字面 `%`/`_` 支持。游标基于创建时间/ID，并绑定查询范围或身份，留言升序、其余列表倒序。价格支持 0/null/整数分边界；预约未来七天窗口使用事务内服务器时钟。
- 看板在单个读事务快照计算：北京时间半开月区间、当前未送出、有效唯一用户意向、最快耗时按毫秒比较后向下取秒，并列规则与空态均有回归。

## LLM 安全配置与协议

服务端环境 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL` 三项全部具备才启用。适配器采用 OpenAI-compatible **Chat Completions** 协议：向 `<base>/chat/completions` POST，Bearer key，model/messages/response_format=json_object/max_tokens；base 通常包括 `/v1`，应按实际服务商填写。不会从浏览器接收 URL/key/model，不跟随重定向，不自动重试。

系统提示保留用户事实，输入作为 user 消息中的 JSON 数据，不授予工具或写库能力。返回 choices[0].message.content 的 JSON 经共享严格 schema 验证；disclaimer 服务端固定写入。响应体最多 64KiB；整体超时 15 秒并 AbortController 取消；单用户每分钟 5 次、IP 每分钟 10 次。日志只含 requestId、耗时、供应商状态与分类，不记 key、提示词、描述或上游正文。

无配置 503 AI_NOT_CONFIGURED，上游/额度失败 503 AI_UNAVAILABLE，无效结构 502 AI_INVALID_RESPONSE，超时 504 AI_TIMEOUT，限流 429。错误不写物品，不伪造成功，手动发布保持可用。

真实验收需协调者/#11 在服务端通过安全环境配置实际凭据，记录 provider/model、时间、输入/输出摘要与耗时（不记录 key）。本次只验证明确标注的 stub 成功、错误结构、上游失败、超时与限流；不请求用户在聊天粘贴密钥。

## DeepSeek 接入（2026-09-27）

继续使用现有 Chat Completions adapter，无新增 SDK 或 provider 架构。依据 [官方首次调用说明](https://api-docs.deepseek.com/zh-cn/)，配置 `LLM_BASE_URL=https://api.deepseek.com`、`LLM_MODEL=deepseek-flash`；API key 只在后端根目录 `.env` 本地填写。当前官方推荐此模型名，未沿用旧教程的 `deepseek-chat`。

按 [JSON Output 文档](https://api-docs.deepseek.com/guides/json_mode/)，提示词包含 JSON 字样和格式样例；样例明确禁止套用到用户物品。按 [Chat Completions 参数文档](https://api-docs.deepseek.com/api/create-chat-completion/)，官方 DeepSeek HTTPS origin 的请求显式发送 `thinking: {type: "disabled"}`，避免默认思考消耗短文案的 1,600 token 预算和 15 秒时限；其他兼容服务不收到该专有参数。显式非流式响应，保留严格业务 schema、大小上限、取消、限流、无重试和手动发布路径；非 stop 的完成状态以及空 content 明确失败，不使用 reasoning_content 代替文案。

### 唯一联调配置与真实验收

本次多个任务统一使用协调工作区的 `/Users/luochen/Documents/Codex/2026-09-27/neighborhood-dag-coordinator/work/neighborhood-exchange/.env`。已确认文件权限 600、受 gitignore 保护；只补充原先为空的非秘密 base/model，不覆盖其他项，不创建第二份需要填密钥的文件。用户仅在该文件 `LLM_API_KEY=` 后本地填写，勿发聊天。生产/start/dev 从 apps/api 工作目录以 Node `--env-file-if-exists=../../.env` 加载根配置；填好后重启后端。已有 shell 同名环境变量优先于 env-file，启动时应避免遗留的旧配置。

独立 clone 内执行以下命令（命令行只有配置文件路径，无密钥）：

```sh
npm run build -w @neighborhood/contracts
npm run build -w @neighborhood/api
node apps/api/scripts/llm-acceptance.mjs /Users/luochen/Documents/Codex/2026-09-27/neighborhood-dag-coordinator/work/neighborhood-exchange/.env
```

脚本只从指定文件解析配置，不回退到其他项目或环境中的凭据；限制官方 DeepSeek URL 和 `deepseek-flash`。密钥为空时返回 blocked、零请求和退出码 2。配置齐备后启用真实本地 HTTP、独立内存库和虚构身份，通过实际发布辅助端点最多发两次模型请求（标价电磁炉、免费木椅），首个失败即停止。输出仅含 provider/model、时间、固定输入摘要、响应结构/长度/方式/金额摘要、耗时与安全错误类别，不打印 key、Cookie、提示词、推理、上游正文或生成文案；不访问用户数据库，不保存物品。

回归覆盖官方 base 与 `/v1/` URL、非官方相似域名不附加专有参数、截断/过滤/工具调用完成状态、空 content 与推理不泄露。真实成功证据以此脚本的实际运行结果及 #11 验收记录为准；stub 和无密钥 blocked 均不算真实调用通过。

### 真实 DeepSeek 验收结果（2026-09-27）

用户在唯一共享 `.env` 配置后，使用上述脚本完成恰好两次真实请求，无重试。PR #19 已合并为 `cd39df8`，对应 main CI `36289262329` 成功。此证据证明真实服务接通和响应契约校验通过，不替代前端采用/手动发布的 #11 浏览器验收。

| UTC 时间 | 模型 | 虚构输入摘要 | HTTP / 耗时 | 脱敏输出摘要 | 持久化物品 |
| --- | --- | --- | --- | --- | --- |
| 2026-09-27T02:44:57.150Z | DeepSeek / deepseek-flash | 搬家转让电磁炉，使用两年、功能正常、有划痕，品牌型号待补充 | 200 / 1359ms | schema 通过；标题 7 字、描述 42 字；FIXED，范围 1–9,999,900 分；缺项 5 个 | 0 |
| 2026-09-27T02:44:58.510Z | DeepSeek / deepseek-flash | 免费送木椅，有划痕、公共活动室自取 | 200 / 805ms | schema 通过；标题 5 字、描述 26 字；FREE，范围 0–0 分；缺项 5 个 | 0 |

**质量限制：**电磁炉区间覆盖整个合法金额范围（0.01–99,999 元），虽然通过结构校验，但没有实用的定价参考价值。本次只能确认真实 API、文案/价格字段结构和免费方式通过，不能宣称定价质量通过；需后续改善提示词对信息不足时的处理，再用少量真实样本验证。未保存完整生成文案，因此本表也不构成逐句事实保真评审。没有进行额外付费重试。

### 定价质量修复与限额复核

针对上一轮实际失败，提示词删除金额合法上下界的数字，区分校验边界与估价依据：信息不足时使用 FLEXIBLE/null 并列出影响估价的缺项；具备购入价、使用时长和状况信息时给出有依据、有限的参考区间。此前提示词的上下界表述是可疑诱导因素，无法仅凭两次输出证明模型内部因果。服务端另拒绝 `FIXED {min:1,max:9999900}` 这一已观察到的无效建议，明确 502 并保留手动发布，不把它替换成硬编码价格。共享 schema、前端和合法金额范围不变。

回归验证：全范围报价被拒且没有物品写入，之后手动发布仍成功；正常有限 FIXED 区间与信息不足 FLEXIBLE/null 均保留。`npm run check` 通过，包含 101 项测试、lint、类型检查和全部构建。

用户追加授权后，仅再运行一次 `llm-acceptance.mjs <同一绝对配置路径> --pricing`，最多两次请求。脚本对该组虚构样例分别要求：稀疏信息返回 FLEXIBLE/null 和待补充项；较充分信息返回正整数 FIXED 区间，上限不超过给定购入价 399 元，max/min <= 4。这些仅是本样例的实用性检查，不是通用估价规则或市场价认证。

| UTC 时间 | 输入摘要 | HTTP / 耗时 | 结果 |
| --- | --- | --- | --- |
| 2026-09-27T02:46:33.912Z | 原电磁炉稀疏信息不变 | 200 / 918ms | FLEXIBLE/null，缺项 3 个，信息不足处理通过；标题 7 字/描述 25 字，schema 通过，0 物品写入 |
| 2026-09-27T02:46:34.830Z | 虚构美的 C21-WT2118，购入价 399 元、使用两年、功能正常、面板轻微划痕、原装电源线、无锅具 | 200 / 1183ms | FIXED 8,000–15,000 分（80–150 元），样例定价检查通过；标题 7 字/描述 68 字，schema 通过，0 物品写入 |

两轮累计真实请求 4 次，无自动重试、无额外调用、无用户数据库修改。模型仍有随机性；该区间基于虚构描述且未经行情检索。逐句事实核验、用户采用结果与最终发布仍属于 #11 浏览器联调，不由此脚本冒充完成。
