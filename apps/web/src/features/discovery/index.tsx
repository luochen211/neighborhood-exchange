import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { TradeMode } from "@neighborhood/contracts";
import { useApp, useQuery } from "../../lib/state";
import { Button, QueryState, StatusMessage } from "../../components/ui";
import { ItemGrid, modes } from "../../components/items";
import { Dashboard } from "../dashboard";
export function BrowsePage({ archive = false }: { archive?: boolean }) {
  const { api } = useApp();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const rawMode = params.get("mode");
  const mode = rawMode && rawMode in modes ? (rawMode as TradeMode) : undefined;
  const [cursor, setCursor] = useState<string | undefined>();
  const result = useQuery(
    (s) =>
      api.items(
        {
          q,
          tradeMode: mode,
          scope: archive ? "archive" : "active",
          cursor,
          limit: 12,
        },
        s,
      ),
    [q, mode, archive, cursor],
  );
  const update = (query: string, filter?: TradeMode) => {
    setCursor(undefined);
    setParams({
      ...(query ? { q: query } : {}),
      ...(filter ? { mode: filter } : {}),
    });
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">青禾里 · 演示社区</p>
          <h1>{archive ? "好物的新去处" : "看看附近，有什么好东西"}</h1>
          <p className="muted">
            {archive
              ? "留住每次流转的故事。已送出物品仅供浏览。"
              : "就在隔壁楼，让闲置继续被需要。"}
          </p>
        </div>
        <Link className="button primary" to="/publish">
          ＋ 发布闲置
        </Link>
      </div>
      {!archive && <Dashboard />}
      <section aria-label="搜索和筛选" className="search-tools">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update(
              String(new FormData(e.currentTarget).get("q") ?? "").trim(),
              mode,
            );
          }}
        >
          <label className="sr-only" htmlFor="search">
            搜索闲置
          </label>
          <input
            id="search"
            name="q"
            key={q}
            defaultValue={q}
            maxLength={100}
            placeholder="搜索物品，比如书籍、台灯、电磁炉"
          />
          <Button type="submit">搜索</Button>
        </form>
        <div className="filters">
          {[["", "全部"], ...Object.entries(modes)].map(([value, label]) => (
            <Button
              key={value}
              aria-pressed={(mode ?? "") === value}
              onClick={() =>
                update(q, value ? (value as TradeMode) : undefined)
              }
            >
              {label}
            </Button>
          ))}
        </div>
      </section>
      <div className="section-heading">
        <h2>{archive ? "已送出的物品" : "邻居正在分享"}</h2>
        <span className="muted">按发布时间排序</span>
      </div>
      <QueryState {...result} />
      {result.data &&
        (result.data.data.length ? (
          <ItemGrid items={result.data.data} />
        ) : (
          <StatusMessage title="暂时没有符合条件的物品">
            试试其他关键词或交易方式。
          </StatusMessage>
        ))}
      <div className="pagination">
        {cursor && (
          <Button onClick={() => setCursor(undefined)}>回到第一页</Button>
        )}
        {result.data?.page.nextCursor && (
          <Button onClick={() => setCursor(result.data!.page.nextCursor!)}>
            下一页
          </Button>
        )}
      </div>
    </>
  );
}
export function DiscoveryPage() {
  return <BrowsePage />;
}
