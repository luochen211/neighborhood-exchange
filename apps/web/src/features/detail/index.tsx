import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Item } from "@neighborhood/contracts";
import { useApp, useQuery, useAction } from "../../lib/state";
import { Button, QueryState, ErrorText } from "../../components/ui";
import {
  ItemArt,
  price,
  statuses,
  Freshness,
  dateLabel,
} from "../../components/items";
import { ReservationForm, TradeCard } from "../exchange";
function Comments({ item }: { item: Item }) {
  const { api, user, choose } = useApp();
  const [cursor, setCursor] = useState<string | undefined>(),
    [body, setBody] = useState(""),
    [sent, setSent] = useState(false);
  const query = useQuery(
    (s) => api.comments(item.id, { cursor }, s),
    [item.id, cursor],
  );
  const action = useAction();
  return (
    <section className="comments">
      <h2>邻居留言</h2>
      <QueryState {...query} />
      {query.data?.data.map((c) => (
        <article className="comment" key={c.id}>
          <div>
            <strong>
              {c.author.nickname}
              {c.author.id === item.owner.id ? " · 发布者" : ""}
            </strong>
            <time>{dateLabel(c.createdAt)}</time>
          </div>
          <p>{c.body}</p>
        </article>
      ))}
      {query.data?.data.length === 0 && <p className="muted">还没有留言。</p>}
      <div className="pagination">
        {cursor && (
          <Button onClick={() => setCursor(undefined)}>最早留言</Button>
        )}
        {query.data?.page.nextCursor && (
          <Button onClick={() => setCursor(query.data!.page.nextCursor!)}>
            更多留言
          </Button>
        )}
      </div>
      {item.status !== "GIVEN" &&
        (user ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(
                () => api.comment(item.id, body.trim()),
                () => {
                  setBody("");
                  setSent(true);
                },
              );
            }}
          >
            <label htmlFor="comment-body">留言内容</label>
            <textarea
              id="comment-body"
              required
              maxLength={500}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setSent(false);
              }}
              placeholder="想了解什么，问问邻居…"
            />
            <Button type="submit" disabled={action.busy || !body.trim()}>
              {action.busy ? "发送中…" : "发送留言"}
            </Button>
            {sent && <p role="status">留言已发送。</p>}
            <ErrorText error={action.error} />
          </form>
        ) : (
          <Button onClick={choose}>选择身份后留言</Button>
        ))}
    </section>
  );
}
function ItemTrades({ id }: { id: string }) {
  const { api } = useApp();
  const query = useQuery((s) => api.tradesForItem(id, s), [id]);
  return (
    <>
      <QueryState {...query} />
      {query.data?.map((t) => (
        <TradeCard key={t.id} trade={t} />
      ))}
    </>
  );
}
function Detail({ item }: { item: Item }) {
  const { api, user, choose } = useApp();
  const action = useAction();
  const owner = user?.id === item.owner.id;
  return (
    <>
      <Link className="back" to={item.status === "GIVEN" ? "/archive" : "/"}>
        ← 返回{item.status === "GIVEN" ? "历史记录" : "邻里集市"}
      </Link>
      <div className="detail-layout">
        <section>
          <ItemArt kind={item.imageKey} />
          <Comments key={`${item.id}-${user?.id}`} item={item} />
        </section>
        <section className="detail-info">
          <span className="tag">
            {statuses[item.status]} ·{" "}
            <Freshness key={item.serverNow} item={item} />
          </span>
          <h1>{item.title}</h1>
          <p className="detail-price">{price(item)}</p>
          <p className="description">{item.description}</p>
          <div className="owner">
            <span className="avatar">{item.owner.nickname.slice(-1)}</span>
            <div>
              {item.owner.nickname}
              <small>{item.owner.building} · 发布者</small>
            </div>
          </div>
          <dl className="facts">
            <dt>自提楼栋</dt>
            <dd>{item.pickupBuilding}</dd>
            <dt>发布时间</dt>
            <dd>{dateLabel(item.createdAt)}</dd>
            <dt>想要人数</dt>
            <dd>{item.interestCount} 位邻居</dd>
            {item.givenAt && (
              <>
                <dt>完成时间</dt>
                <dd>{dateLabel(item.givenAt)}</dd>
              </>
            )}
          </dl>
          {item.status === "GIVEN" ? (
            <div className="archive-note">
              这件好物已找到新主人。描述和留言留在这里，所有操作已关闭。
            </div>
          ) : (
            <>
              {!owner && item.status === "AVAILABLE" && (
                <Button
                  className="primary wide"
                  disabled={action.busy}
                  onClick={() =>
                    user
                      ? void action.run(() =>
                          item.viewerHasInterest
                            ? api.withdraw(item.id)
                            : api.want(item.id),
                        )
                      : choose()
                  }
                >
                  {action.busy
                    ? "正在更新…"
                    : item.viewerHasInterest
                      ? "撤回意向"
                      : "我想要"}
                </Button>
              )}
              {item.status === "RESERVED" && (
                <p className="muted">物品已预约，暂不接受新的意向。</p>
              )}
              <ErrorText error={action.error} />
              {owner && item.status === "AVAILABLE" && (
                <ReservationForm item={item} />
              )}
              <p className="muted small">
                想要后，由发布者选择领取人并发起预约。
              </p>
            </>
          )}
          {user && item.status === "RESERVED" && <ItemTrades id={item.id} />}
        </section>
      </div>
    </>
  );
}
export function DetailPage() {
  const { id = "" } = useParams();
  const { api, user } = useApp();
  const result = useQuery((s) => api.item(id, s), [id, user?.id]);
  return (
    <>
      <QueryState {...result} />
      {result.data && <Detail key={id} item={result.data.data} />}
    </>
  );
}
