# 数据库 ER 图

状态：SRS v1.0 的逻辑设计，实际迁移须与此同步。字段约束与时间/金额单位详见 [SRS](SRS.md)。单社区名称通过配置提供，本次不建社区管理表。

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : has
    USERS ||--o{ ITEMS : publishes
    USERS ||--o{ INTERESTS : expresses
    USERS ||--o{ COMMENTS : writes
    USERS ||--o{ TRADES : receives
    USERS o|--o{ TRADES : cancels
    ITEMS ||--o{ INTERESTS : attracts
    ITEMS ||--o{ COMMENTS : contains
    ITEMS ||--o{ TRADES : records

    USERS {
        text id PK
        text nickname
        text building
        integer created_at
    }
    SESSIONS {
        text id PK
        text token_hash UK
        text user_id FK
        integer expires_at
        integer created_at
    }
    ITEMS {
        text id PK
        text owner_id FK
        text title
        text description
        text trade_mode
        integer price_cents
        text image_key
        text pickup_building
        text status
        integer created_at
        integer updated_at
        integer given_at
    }
    INTERESTS {
        text id PK
        text item_id FK
        text user_id FK
        boolean active
        integer created_at
        integer updated_at
    }
    COMMENTS {
        text id PK
        text item_id FK
        text author_id FK
        text body
        integer created_at
    }
    TRADES {
        text id PK
        text item_id FK
        text recipient_id FK
        text status
        integer meeting_start
        integer meeting_end
        text meeting_place
        integer created_at
        integer confirmed_at
        integer completed_at
        integer cancelled_at
        text cancelled_by FK
    }
```

- `interests(item_id,user_id)` 联合唯一；撤回通过 active=false 保留记录。
- trades 的卖方由 items.owner_id 得出，避免重复存储与不一致。
- trades 对 item_id 建立 `WHERE status IN ('PENDING','CONFIRMED','COMPLETED')` 唯一部分索引；取消记录不占用唯一名额。
- 图中的物品与交易一对多包含取消历史；不代表允许并行有效交易。
- GIVEN 与 COMPLETED 的同步、角色权限及跨表业务前提由同一个数据库事务保证。
