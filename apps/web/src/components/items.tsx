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
  if (asset.src)
    return (
      <div className={`item-art ${kind}`}>
        <img src={asset.src} alt={`${asset.label} · ${asset.caption}`} />
        <span className="art-caption">{asset.caption}</span>
      </div>
    );
  return (
    <div className={`item-art ${kind}`}>
      <svg
        viewBox="0 0 400 300"
        role="img"
        aria-label={`${asset.label} · ${asset.caption}`}
      >
        <ellipse cx="200" cy="261" rx="108" ry="12" fill="#26382c12" />
        {kind === "lamp" ? (
          <>
            <path d="M200 139v113" stroke="#7c8067" strokeWidth="8" />
            <ellipse cx="200" cy="251" rx="53" ry="10" fill="#929579" />
            <path d="M150 61h100l38 100H112z" fill="#faf3de" />
            <ellipse cx="200" cy="161" rx="88" ry="9" fill="#d4c89f" />
          </>
        ) : kind === "books" ? (
          <>
            <rect
              x="96"
              y="204"
              width="213"
              height="45"
              rx="4"
              fill="#688d83"
            />
            <rect
              x="113"
              y="162"
              width="180"
              height="41"
              rx="3"
              fill="#bc9574"
            />
            <rect
              x="94"
              y="118"
              width="202"
              height="43"
              rx="3"
              fill="#4e6971"
            />
            <rect
              x="127"
              y="77"
              width="146"
              height="40"
              rx="3"
              fill="#d4b99b"
            />
            <path
              d="M139 87h122v19H139zM107 129h177v20H107zM125 173h158v19H125zM109 216h188v22H109z"
              fill="#f5eee2"
            />
          </>
        ) : kind === "chair" ? (
          <>
            <path d="M131 80q65-32 133 0v99H131z" fill="#b39068" />
            <path d="M118 178h159v24H118z" fill="#c8a77e" />
            <path
              d="M131 200l-12 59m146-59 12 59M145 83v89m36-94v94m38-94v94m32-87v87"
              stroke="#99784f"
              strokeWidth="10"
            />
          </>
        ) : (
          <>
            <rect
              x="75"
              y="80"
              width="250"
              height="175"
              rx="17"
              fill="#34413c"
            />
            <rect
              x="85"
              y="90"
              width="230"
              height="151"
              rx="11"
              fill="#4b5951"
            />
            <ellipse
              cx="200"
              cy="153"
              rx="67"
              ry="45"
              fill="none"
              stroke="#9caa97"
              strokeWidth="2"
            />
            <ellipse
              cx="200"
              cy="153"
              rx="51"
              ry="34"
              fill="none"
              stroke="#9caa97"
            />
            <rect
              x="181"
              y="216"
              width="38"
              height="12"
              rx="3"
              fill="#cfb184"
            />
            <path d="M116 221h30m109 0h30" stroke="#aeb5a4" strokeWidth="3" />
          </>
        )}
      </svg>
      <span className="art-caption">预置示意图</span>
    </div>
  );
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
