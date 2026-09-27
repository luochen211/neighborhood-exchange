import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Item, ImageKey } from "@neighborhood/contracts";
import { itemImages } from "../lib/images";
export const modes = { FREE: "免费送", FLEXIBLE: "随便给", FIXED: "标价" };
export const statuses = {
  AVAILABLE: "可领取",
  RESERVED: "已预约",
  GIVEN: "已送出",
};
export function price(item: Item) {
  return item.tradeMode === "FIXED"
    ? `¥ ${(item.priceCents / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`
    : modes[item.tradeMode];
}
export function freshness(createdAt: string, serverNow: string, elapsed = 0) {
  const hours =
    (Date.parse(serverNow) + elapsed - Date.parse(createdAt)) / 3600000;
  return hours < 24
    ? "刚上架"
    : hours < 72
      ? "新上架"
      : `已上架 ${Math.floor(hours / 24)} 天`;
}
export function Freshness({ item }: { item: Item }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 60000);
    return () => clearInterval(t);
  }, [item.serverNow]);
  return <>{freshness(item.createdAt, item.serverNow, elapsed)}</>;
}
export function ItemArt({ kind }: { kind: ImageKey }) {
  const asset = itemImages[kind];
  return <div className={`item-art ${kind}`}>
    <img src={asset.src} alt={`${asset.label} · ${asset.caption}`} loading="lazy" width="800" height="800" />
    <span className="art-caption">{asset.caption}</span>
  </div>;
}
export function ItemCard({ item }: { item: Item }) {
  return (
    <Link className="item-card" to={`/items/${item.id}`}>
      <div className="art-wrap">
        <ItemArt kind={item.imageKey} />
        <span className={`badge ${item.status.toLowerCase()}`}>
          {statuses[item.status]}
        </span>
      </div>
      <div className="card-top">
        <strong className="price">{price(item)}</strong>
        <span className="muted">
          <Freshness key={item.serverNow} item={item} />
        </span>
      </div>
      <h2>{item.title}</h2>
      <div className="card-meta">
        <span>
          {item.pickupBuilding} · {item.owner.nickname}
        </span>
        <span>{item.interestCount} 人想要</span>
      </div>
    </Link>
  );
}
export function ItemGrid({ items }: { items: Item[] }) {
  return (
    <div className="item-grid">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
export const dateLabel = (date: string) =>
  new Date(date).toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
