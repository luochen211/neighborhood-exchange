# 受控演示站部署

目标：Railway 单实例容器，Fastify 同源提供生产 Web 与 API，SQLite 位于 `/data/neighborhood.db` 的持久卷。部署过程不使用本地业务数据库，仅初始化虚构种子。

## 配置

- `Dockerfile`：Node 24 / Debian，多阶段构建；不会将 `.env`、数据库、原始高清图片或交付视频打包。
- `railway.toml`：单副本，健康探针 `/api/v1/health`，失败重启最多 5 次。
- Volume：挂载 `/data`，必须在首次部署前挂载；不能扩容为多实例。
- `HOST=0.0.0.0`、`PORT=3000`、`DATABASE_URL=/data/neighborhood.db`、`DEMO_MODE=true`。
- `APP_ORIGIN`：实际 HTTPS 域名，无末尾斜杠。
- `DEMO_ACCESS_USER` / `DEMO_ACCESS_PASSWORD`：HTTP Basic 演示访问门禁；两项必须一起设置。仅健康探针无需密码；页面、静态文件和业务 API 均受保护。
- `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY`：平台服务端变量，禁止提交、打印或写入镜像。既有 AI 限流为每用户每分钟 5 次、每 IP 每分钟 10 次；网关下 IP 限流可能更严格，不能当作每日账单上限。

启动脚本只在数据库文件不存在时迁移并添加演示种子；已有文件只由服务进行版本迁移，不重置或重新播种。备份应通过 SQLite backup API 生成一致副本，不能仅复制活跃 WAL 主文件。卷不等于备份。

## 发布与验证

在用户已有 Railway 工作区新建独立项目和服务，不改其他服务，不升级订阅或购买资源。先确认工作区资源/用量限制，然后创建持久卷、域名、访问凭据和模型变量。

```sh
railway up --service web
```

发布后必须记录部署终态、HTTPS 首页与图片、无凭据拒绝、双身份交易、真实 AI 调用、重启后物品和会话保留。线上测试只用带验收标识的虚构数据。CI 仍负责 lint、类型检查、单元测试、构建和隔离数据库浏览器测试；Railway CLI 发布与 GitHub CI 是独立状态。

当前阶段：部署配置已准备，线上地址和验收证据待实际发布补入，不能据此宣称已上线。
