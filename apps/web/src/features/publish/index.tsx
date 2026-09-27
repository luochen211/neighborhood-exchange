import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createItemSchema,
  IMAGE_KEYS,
  type AiSuggestion,
  type ImageKey,
  type TradeMode,
} from "@neighborhood/contracts";
import { useApp, useAction } from "../../lib/state";
import { errorMessage } from "../../lib/api";
import { Button, Field, ErrorText } from "../../components/ui";
import { itemImages } from "../../lib/images";
import { ItemArt, modes } from "../../components/items";
import { LoginPrompt } from "../auth";
const initial = {
  title: "",
  description: "",
  tradeMode: "FREE" as TradeMode,
  price: "",
  pickupBuilding: "",
  imageKey: "chair" as ImageKey,
};
function PublishForm() {
  const { api, user } = useApp();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<typeof initial>(() => {
    try {
      return {
        ...initial,
        ...JSON.parse(sessionStorage.getItem("listing-draft") ?? "{}"),
      };
    } catch {
      return initial;
    }
  });
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [suggestion, setSuggestion] = useState<AiSuggestion>(),
    [aiError, setAiError] = useState(""),
    [aiBusy, setAiBusy] = useState(false);
  const aiController = useRef<AbortController | null>(null);
  const action = useAction();
  useEffect(() => {
    sessionStorage.setItem("listing-draft", JSON.stringify(draft));
  }, [draft]);
  useEffect(() => () => aiController.current?.abort(), []);
  const update = (key: keyof typeof initial, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const assist = async () => {
    if (aiBusy) return;
    if (!draft.title.trim() || !draft.description.trim()) {
      setAiError("请先填写物品名称和描述。");
      return;
    }
    const controller = new AbortController();
    aiController.current = controller;
    setAiBusy(true);
    setAiError("");
    try {
      const response = await api.assist(
        { title: draft.title, description: draft.description },
        controller.signal,
      );
      setSuggestion(response.data);
    } catch (error) {
      setAiError(errorMessage(error));
    } finally {
      setAiBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">让闲置继续被需要</p>
          <h1>分享一件好物</h1>
          <p className="muted">说明真实情况，交接会更顺利。</p>
        </div>
      </div>
      <div className="publish-layout">
        <form
          className="publish-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const cents =
              draft.tradeMode === "FREE"
                ? 0
                : draft.tradeMode === "FLEXIBLE"
                  ? null
                  : Math.round(Number(draft.price) * 100);
            const parsed = createItemSchema.safeParse({
              title: draft.title,
              description: draft.description,
              tradeMode: draft.tradeMode,
              priceCents: cents,
              pickupBuilding: draft.pickupBuilding,
              imageKey: draft.imageKey,
            });
            const next: Record<string, string> = {};
            if (
              draft.tradeMode === "FIXED" &&
              !/^\d+(\.\d{1,2})?$/.test(draft.price)
            )
              next.priceCents = "价格必须大于 0，最多两位小数。";
            if (!parsed.success)
              for (const issue of parsed.error.issues)
                next[String(issue.path[0])] =
                  "请填写有效内容，并符合字段长度或价格要求。";
            setErrors(next);
            if (!parsed.success || Object.keys(next).length) return;
            void action.run(async () => {
              const response = await api.publish(parsed.data);
              sessionStorage.removeItem("listing-draft");
              navigate(`/items/${response.data.id}`);
            });
          }}
        >
          <Field
            label="物品名称"
            required
            maxLength={60}
            value={draft.title}
            error={errors.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="例如：陪我读书的暖光台灯"
          />
          <div className="field">
            <label htmlFor="description">物品描述</label>
            <textarea
              id="description"
              required
              maxLength={2000}
              value={draft.description}
              aria-invalid={!!errors.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="成色、使用情况、需要说明的小问题…"
            />
            {errors.description && <ErrorText error={errors.description} />}
          </div>
          <div className="two-columns">
            <div className="field">
              <label htmlFor="trade-mode">交易方式</label>
              <select
                id="trade-mode"
                value={draft.tradeMode}
                onChange={(e) => update("tradeMode", e.target.value)}
              >
                {Object.entries(modes).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {draft.tradeMode === "FIXED" && (
              <Field
                label="期望价格（元）"
                type="number"
                min="0.01"
                max="99999"
                step="0.01"
                value={draft.price}
                error={errors.priceCents}
                onChange={(e) => update("price", e.target.value)}
              />
            )}
          </div>
          <Field
            label="自提楼栋"
            required
            maxLength={30}
            placeholder={user?.building}
            value={draft.pickupBuilding}
            error={errors.pickupBuilding}
            onChange={(e) => update("pickupBuilding", e.target.value)}
          />
          <fieldset>
            <legend>选择预置图片</legend>
            <div className="image-options">
              {IMAGE_KEYS.map((key) => (
                <label key={key}>
                  <input
                    type="radio"
                    name="image"
                    value={key}
                    checked={draft.imageKey === key}
                    onChange={() => update("imageKey", key)}
                  />
                  <ItemArt kind={key} />
                  <span>{itemImages[key].label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="muted small">
            图片为 AI 生成演示图片，请在描述中说明实物情况。交易在线下完成。
          </p>
          <Button className="primary" type="submit" disabled={action.busy}>
            {action.busy ? "正在发布…" : "确认发布"}
          </Button>
          <ErrorText error={action.error} />
        </form>
        <aside className="ai-panel">
          <p className="eyebrow">一点帮忙，更多可能</p>
          <h2>AI 帮我整理</h2>
          <p className="muted">
            只根据你提供的事实整理文案，建议由你决定是否采用。
          </p>
          <Button disabled={aiBusy} onClick={() => void assist()}>
            {aiBusy ? "正在整理…" : "生成建议"}
          </Button>
          {aiBusy && (
            <Button onClick={() => aiController.current?.abort()}>
              取消生成
            </Button>
          )}
          <ErrorText error={aiError} />
          {suggestion && (
            <div className="suggestion">
              <h3>{suggestion.title}</h3>
              <p className="description">{suggestion.description}</p>
              <Button
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    title: suggestion.title,
                    description: suggestion.description,
                  }))
                }
              >
                采用文案
              </Button>
              <hr />
              <p>建议方式：{modes[suggestion.suggestedTradeMode]}</p>
              {suggestion.suggestedPriceRangeCents && (
                <p className="range">
                  ¥ {suggestion.suggestedPriceRangeCents.min / 100} —{" "}
                  {suggestion.suggestedPriceRangeCents.max / 100}
                </p>
              )}
              <p>{suggestion.rationale}</p>
              <Button
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    tradeMode: suggestion.suggestedTradeMode,
                    price:
                      suggestion.suggestedTradeMode === "FIXED"
                        ? String(suggestion.suggestedPriceRangeCents.min / 100)
                        : "",
                  }))
                }
              >
                采用建议方式/价格
              </Button>
              <p className="small muted">{suggestion.disclaimer}</p>
              {suggestion.missingInfo.length > 0 && (
                <>
                  <h3>还可以补充</h3>
                  <ul>
                    {suggestion.missingInfo.map((info) => (
                      <li key={info}>{info}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
export function PublishPage() {
  const { user } = useApp();
  return user ? <PublishForm key={user.id} /> : <LoginPrompt />;
}
