import { Link } from "react-router-dom";
import { useApp, useQuery } from "../../lib/state";
import { QueryState } from "../../components/ui";
export function Dashboard() {
  const { api } = useApp();
  const result = useQuery((s) => api.dashboard(s));
  const d = result.data?.data;
  return (
    <section className="dashboard" aria-label="社区看板">
      <QueryState {...result} />
      {d && (
        <>
          <div className="stats">
            <div>
              <strong>{d.publishedThisMonth}</strong>
              <span>本月发布</span>
            </div>
            <div>
              <strong>{d.completedThisMonth}</strong>
              <span>本月成交</span>
            </div>
            <div>
              <strong>{d.activeCount}</strong>
              <span>
                当前在售 <small>含已预约</small>
              </span>
            </div>
            <p>
              {d.month} · 北京时间
              <br />
              <small>每一次流转，都是新的开始</small>
            </p>
          </div>
          <div className="highlights">
            <span>
              最快领走 ·{" "}
              {d.fastestItem ? (
                <Link to={`/items/${d.fastestItem.itemId}`}>
                  {d.fastestItem.title} /{" "}
                  {d.fastestItem.durationSeconds < 60
                    ? `${d.fastestItem.durationSeconds} 秒`
                    : `${Math.floor(d.fastestItem.durationSeconds / 60)} 分钟`}
                </Link>
              ) : (
                "暂无完成记录"
              )}
            </span>
            <span>
              最想要 ·{" "}
              {d.mostWantedItem ? (
                <Link to={`/items/${d.mostWantedItem.itemId}`}>
                  {d.mostWantedItem.title} / {d.mostWantedItem.interestCount} 人
                </Link>
              ) : (
                "等待第一份心意"
              )}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
