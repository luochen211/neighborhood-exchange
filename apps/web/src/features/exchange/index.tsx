import { useState } from "react";
import { Link } from "react-router-dom";
import type { Item, Trade } from "@neighborhood/contracts";
import { useApp, useQuery, useAction } from "../../lib/state";
import { Button, Field, QueryState, ErrorText } from "../../components/ui";
import { dateLabel } from "../../components/items";
export function ReservationForm({ item }: { item: Item }) {
  const { api } = useApp();
  const [cursor, setCursor] = useState<string | undefined>();
  const list = useQuery(
    (s) => api.interests(item.id, { cursor }, s),
    [item.id, cursor],
  );
  const action = useAction();
  const [recipient, setRecipient] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [place, setPlace] = useState(""),
    [validation, setValidation] = useState("");
  return (
    <section className="reservation">
      <h2>选择一位邻居</h2>
      <p className="muted">发起预约后，等待领取人确认。请约在社区公共区域。</p>
      <QueryState {...list} />
      {list.data?.data.length === 0 ? (
        <p>还没有邻居表达想要。</p>
      ) : (
        list.data && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const a = Date.parse(start),
                b = Date.parse(end);
              if (
                !recipient ||
                !Number.isFinite(a) ||
                !Number.isFinite(b) ||
                a <= Date.now() ||
                b <= a ||
                b > Date.now() + 7 * 86400000
              ) {
                setValidation("请选择领取人，并填写未来七天内的有效起止时间。");
                return;
              }
              setValidation("");
              void action.run(() =>
                api.reserve(item.id, {
                  recipientId: recipient,
                  meetingStart: new Date(a).toISOString(),
                  meetingEnd: new Date(b).toISOString(),
                  meetingPlace: place.trim(),
                }),
              );
            }}
          >
            <div className="field">
              <label htmlFor="recipient">领取人</label>
              <select
                id="recipient"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              >
                <option value="">选择表达想要的邻居</option>
                {list.data.data.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nickname} · {u.building}
                  </option>
                ))}
              </select>
            </div>
            <div className="pagination">
              {cursor && (
                <Button
                  onClick={() => {
                    setCursor(undefined);
                    setRecipient("");
                  }}
                >
                  第一批邻居
                </Button>
              )}
              {list.data.page.nextCursor && (
                <Button
                  onClick={() => {
                    setCursor(list.data!.page.nextCursor!);
                    setRecipient("");
                  }}
                >
                  更多想要的邻居
                </Button>
              )}
            </div>
            <div className="two-columns">
              <Field
                label="开始时间"
                type="datetime-local"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <Field
                label="结束时间"
                type="datetime-local"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            <Field
              label="公共交接地点"
              required
              maxLength={100}
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="例如：社区活动室门口"
            />
            <Button type="submit" className="primary" disabled={action.busy}>
              {action.busy ? "正在预约…" : "发起预约"}
            </Button>
            <ErrorText error={validation || action.error} />
          </form>
        )
      )}
    </section>
  );
}
export const tradeLabels = {
  PENDING: "等待领取人确认",
  CONFIRMED: "已确认 · 待交接",
  COMPLETED: "交接完成",
  CANCELLED: "预约已取消",
};
export function TradeCard({ trade }: { trade: Trade }) {
  const { api, user } = useApp();
  const item = useQuery((s) => api.item(trade.itemId, s), [trade.itemId]);
  const action = useAction();
  const [confirming, setConfirming] = useState(false);
  return (
    <article className="trade-card">
      <div className="section-heading">
        <span className="tag">{tradeLabels[trade.status]}</span>
        <Link to={`/items/${trade.itemId}`}>查看物品 →</Link>
      </div>
      <h2>{item.data?.data.title ?? "交接物品"}</h2>
      <p>
        {user?.id === trade.owner.id
          ? `交给 ${trade.recipient.nickname}`
          : `向 ${trade.owner.nickname} 领取`}
      </p>
      <p className="trade-time">
        {dateLabel(trade.meetingStart)} — {dateLabel(trade.meetingEnd)}
      </p>
      <dl className="facts">
        <dt>公共地点</dt>
        <dd>{trade.meetingPlace}</dd>
        <dt>发布者</dt>
        <dd>
          {trade.owner.nickname} · {trade.owner.building}
        </dd>
        <dt>领取者</dt>
        <dd>
          {trade.recipient.nickname} · {trade.recipient.building}
        </dd>
      </dl>
      <div className="actions">
        {trade.status === "PENDING" && user?.id === trade.recipient.id && (
          <Button
            className="primary"
            disabled={action.busy}
            onClick={() => void action.run(() => api.confirm(trade.id))}
          >
            确认预约
          </Button>
        )}
        {trade.status === "CONFIRMED" &&
          user?.id === trade.owner.id &&
          !confirming && (
            <Button className="primary" onClick={() => setConfirming(true)}>
              确认已送出
            </Button>
          )}
        {["PENDING", "CONFIRMED"].includes(trade.status) && (
          <Button
            disabled={action.busy}
            onClick={() => void action.run(() => api.cancel(trade.id))}
          >
            {trade.status === "PENDING" && user?.id === trade.recipient.id
              ? "拒绝预约"
              : "取消预约"}
          </Button>
        )}
      </div>
      {confirming && trade.status === "CONFIRMED" && (
        <div className="confirmation" role="group" aria-label="确认完成交接">
          <p>物品已经当面交给邻居了吗？确认后将归档，无法再次交易。</p>
          <Button
            className="primary"
            disabled={action.busy}
            onClick={() =>
              void action.run(
                () => api.complete(trade.id),
                () => setConfirming(false),
              )
            }
          >
            已交接，确认归档
          </Button>
          <Button disabled={action.busy} onClick={() => setConfirming(false)}>
            暂不确认
          </Button>
        </div>
      )}
      {trade.completedAt && (
        <p className="muted">完成于 {dateLabel(trade.completedAt)}</p>
      )}
      <ErrorText error={action.error} />
    </article>
  );
}
