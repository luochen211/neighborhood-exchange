# 邻里闲置

面向小区、楼栋和办公室内部的轻量闲置流转 Web 应用，优先适配手机浏览器。

## 项目目标

让邻居及时发现闲置物品，了解当前状态，并方便地约定线下交接。

## 计划中的核心流程

发布闲置 → 浏览与搜索 → 表达想要 → 约定交接 → 确认送出并归档。

计划在发布环节接入 LLM API，辅助整理物品描述并提供参考定价建议。

## 开发约束

- 使用 AI Coding 工具辅助完成开发。
- 全栈实现：前端界面、后端 API 与持久化数据库。
- 考试开发时间为 24 小时，本地可运行，远端部署为加分项。
- API 密钥仅保存在服务端环境变量中，不提交到仓库。

## 考试交付物

- 5 分钟视频：产品 Demo 与实现讲解。
- 数据库 ER 图。
- 技术栈简介和本地运行说明。

## 当前状态

已完成 PRD、SRS、数据库逻辑设计与开发 DAG；应用功能尚未实现。

技术方案：React + TypeScript + Vite 前端，Node.js + Fastify API，SQLite + Drizzle 数据库，服务端 LLM 发布辅助。依赖版本在工程初始化任务中锁定。

## 项目文档

- [PRD：产品范围、用户流程与验收](docs/product/PRD.md)
- [SRS：架构、接口、权限、状态与测试](docs/engineering/SRS.md)
- [数据库 ER 图](docs/engineering/ERD.md)
- [开发 DAG 与执行规则](docs/planning/DAG.md)
- [任务清单](docs/planning/tasks.json)
- [GitHub 交付 Epic](https://github.com/luochen211/neighborhood-exchange/issues/1)

功能实现前请先按 DAG 认领 Ready 任务。当前尚无可运行应用、CI 或部署；不能将需求文档中的目标当作已通过验收。
