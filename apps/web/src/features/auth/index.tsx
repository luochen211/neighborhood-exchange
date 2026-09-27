import { useEffect, useRef } from "react";
import { useApp, useQuery, useAction } from "../../lib/state";
import { Button, ErrorText, QueryState } from "../../components/ui";
export function IdentitySwitcher() {
  const { user, choose } = useApp();
  return (
    <Button className="identity" onClick={choose}>
      <span className="avatar">{user?.nickname.slice(-1) ?? "邻"}</span>
      <span>
        {user?.nickname ?? "选择演示身份"}
        <small>{user?.building ?? "以访客身份浏览"}</small>
      </span>
      <span>⌄</span>
    </Button>
  );
}
export function IdentityDialog() {
  const { api, user, identity, choosing, close } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useQuery((signal) => api.users(signal));
  const action = useAction();
  useEffect(() => {
    if (choosing) dialog.current?.showModal();
    else dialog.current?.close();
  }, [choosing]);
  return (
    <dialog ref={dialog} onCancel={close}>
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">演示社区</p>
          <h2>今天，你是哪位邻居？</h2>
        </div>
        <Button aria-label="关闭身份选择" onClick={close}>
          ×
        </Button>
      </div>
      <p className="muted">切换身份会清空当前发布草稿，业务记录仍保留。</p>
      <QueryState {...list} />
      <div className="identity-list">
        {list.data?.data.map((u) => (
          <Button
            key={u.id}
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                const result = await api.login(u.id);
                identity(result.data);
                close();
              })
            }
          >
            <span className="avatar">{u.nickname.slice(-1)}</span>
            <span>
              {u.nickname}
              <small>{u.building}</small>
            </span>
            {user?.id === u.id && <span>当前身份</span>}
          </Button>
        ))}
      </div>
      {user && (
        <Button
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              await api.logout();
              identity(null);
              close();
            })
          }
        >
          退出身份
        </Button>
      )}
      <ErrorText error={action.error} />
    </dialog>
  );
}
export function LoginPrompt() {
  const { choose } = useApp();
  return (
    <section className="empty">
      <h1>先认识一下，再交换闲置</h1>
      <p>选择预置演示身份，即可发布、留言和约定交接。</p>
      <Button className="primary" onClick={choose}>
        选择演示身份
      </Button>
    </section>
  );
}
