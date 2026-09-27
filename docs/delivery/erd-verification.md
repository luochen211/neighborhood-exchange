# ER 图与实际迁移核对

2026-09-27，在独立内存 SQLite 执行 `apps/api/src/db/migrations/001.ts` 与 `002.ts`，结果 `PRAGMA user_version=2`。6 张实体表、9 个外键与 10 张 Chen 图一致；没有修改用户数据库。

## 全字段映射

| 实体 / 表 | 椭圆属性 → 实际字段 | 联系表示的外键 |
| --- | --- | --- |
| 用户 / users | 用户编号 → id；昵称 → nickname；楼栋 → building；创建时间 → created_at | 无 |
| 登录会话 / sessions | 会话编号 → id；令牌哈希 → token_hash；到期时间 → expires_at；创建时间 → created_at | user_id → users.id |
| 物品 / items | 物品编号 → id；名称 → title；描述 → description；交易方式 → trade_mode；价格 → price_cents；图片标识 → image_key；自提楼栋 → pickup_building；物品状态 → status；发布时间 → created_at；更新时间 → updated_at；送出时间 → given_at | owner_id → users.id |
| 意向记录 / interests | 意向编号 → id；是否有效 → active；创建时间 → created_at；更新时间 → updated_at | user_id → users.id；item_id → items.id |
| 留言 / comments | 留言编号 → id；留言内容 → body；创建时间 → created_at | author_id → users.id；item_id → items.id |
| 交易记录 / trades | 交易编号 → id；交易状态 → status；交接开始时间 → meeting_start；交接结束时间 → meeting_end；交接地点 → meeting_place；创建时间 → created_at；确认时间 → confirmed_at；完成时间 → completed_at；取消时间 → cancelled_at | cancelled_by → users.id；recipient_id → users.id；item_id → items.id |

## 逻辑约束与概念图边界

- 6 个 id 均为主键；属性图中的编号下划线与实际主键一致。
- 9 个外键对应全局图的拥有、发布、表达、收到、撰写、包含、领取、记录、取消；局部图是同一关系集的拆分。
- `trades.cancelled_by` 可空：取消人是可选联系；数据库的状态 CHECK 在 CANCELLED 时要求取消时间和取消人非空。取消人限双方由服务端校验。
- `UNIQUE(item_id,user_id)` 保证一位用户对一件物品一条意向；active 控制撤回与重新激活。
- `trades_one_live` 的唯一部分索引覆盖 PENDING / CONFIRMED / COMPLETED，排除 CANCELLED。因此图中的 1:n 包含取消历史，不能同时成交给多人。
- 金额与 FREE / FLEXIBLE / FIXED 的匹配、GIVEN 送出时间、预约起止和交易时间状态由 SQL CHECK 约束。跨表身份、物品和交易状态同步由事务与权限逻辑保护。
- v2 扩展 image_key 白名单为 30 项，保留字段、外键、索引和已有行；没有增加新实体或联系。
- 图内仅实体、属性、关系、连线、名称、主键下划线和 1/n 基数。标题、图号、图例和业务说明只出现在文档正文/图注。

所有椭圆属性与联系外键的并集覆盖对应表全部字段；无多余或遗漏字段。PNG/SVG 保持已验收的 10 张独立图，Word/PDF 再次逐页检查。
