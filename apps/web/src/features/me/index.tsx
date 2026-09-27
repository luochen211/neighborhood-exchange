import { useState } from "react";
import { useApp, useQuery } from "../../lib/state";
import { Button, QueryState, StatusMessage } from "../../components/ui";
import { ItemGrid } from "../../components/items";
import { TradeCard } from "../exchange";
import { LoginPrompt } from "../auth";
function MyContent() {
  const { api, user } = useApp();
  const [tab, setTab] = useState<"items" | "interests" | "trades">("items"),
    [cursor, setCursor] = useState<string | undefined>();
  const result = useQuery(
    async (s) => {
      if (tab === "trades")
        return {
          kind: "trades" as const,
          ...(await api.trades({ cursor }, s)),
        };
      if (tab === "interests") {
        const r = await api.myInterests({ cursor }, s);
        return {
          kind: "items" as const,
          ...r,
          data: r.data.map((i) => i.item),
        };
      }
      return { kind: "items" as const, ...(await api.myItems({ cursor }, s)) };
    },
    [tab, cursor, user?.id],
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">我的邻里生活</p>
          <h1>{user?.nickname}，你好</h1>
          <p className="muted">你分享的、想要的，以及和邻居的约定。</p>
        </div>
      </div>
      <div className="filters my-tabs">
        {(
          [
            ["items", "我发布的"],
            ["interests", "我想要的"],
            ["trades", "交接事项"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setCursor(undefined);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <QueryState {...result} />
      {result.data &&
        (result.data.data.length ? (
          result.data.kind === "items" ? (
            <ItemGrid items={result.data.data} />
          ) : (
            <div className="trade-list">
              {result.data.data.map((trade) => (
                <TradeCard key={trade.id} trade={trade} />
              ))}
            </div>
          )
        ) : (
          <StatusMessage title="这里还没有记录">
            去发现页看看，或分享你的第一件闲置。
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
export function MePage() {
  const { user } = useApp();
  return user ? <MyContent key={user.id} /> : <LoginPrompt />;
}
