import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { User } from "@neighborhood/contracts";
import { configuredApi, errorMessage, ApiClientError, type Api } from "./api";
const Context = createContext<{
  api: Api;
  user: User | null;
  revision: number;
  refresh: () => void;
  identity: (user: User | null) => void;
  choose: () => void;
  choosing: boolean;
  close: () => void;
} | null>(null);
export function AppProvider({
  children,
  providedApi,
}: {
  children: ReactNode;
  providedApi?: Api;
}) {
  const [api, setApi] = useState<Api | undefined>(providedApi),
    [user, setUser] = useState<User | null>(null),
    [revision, setRevision] = useState(0),
    [choosing, setChoosing] = useState(false);
  useEffect(() => {
    if (!providedApi) void configuredApi().then(setApi);
  }, [providedApi]);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    if (!api) return;
    const controller = new AbortController();
    void api
      .me(controller.signal)
      .then((r) => setUser(r.data))
      .catch(() => {});
    return () => controller.abort();
  }, [api]);
  useEffect(() => {
    const focus = () => refresh();
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [refresh]);
  if (!api) return <p role="status">正在连接社区…</p>;
  return (
    <Context.Provider
      value={{
        api,
        user,
        revision,
        refresh,
        identity: (u) => {
          sessionStorage.removeItem("listing-draft");
          setUser(u);
          refresh();
        },
        choose: () => setChoosing(true),
        choosing,
        close: () => setChoosing(false),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const context = useContext(Context);
  if (!context) throw new Error("AppProvider missing");
  return context;
}
export function useQuery<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  keys: unknown[] = [],
) {
  const { revision } = useApp();
  const ref = useRef(loader);
  useEffect(() => {
    ref.current = loader;
  }, [loader]);
  const [state, setState] = useState<{
      key: string;
      params: string;
      data?: T;
      error?: string;
    }>({ key: "", params: "" }),
    [retry, setRetry] = useState(0);
  const params = JSON.stringify(keys);
  const key = JSON.stringify([revision, retry, params]);
  useEffect(() => {
    const controller = new AbortController();
    void ref
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, params, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, params, error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [key, params]);
  return {
    ...(state.params === params ? state : {}),
    loading: state.key !== key && !(state.params === params && state.data),
    retry: () => setRetry((n) => n + 1),
  };
}
export function useAction() {
  const { refresh, choose } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  return {
    busy,
    error,
    clear: () => setError(""),
    run: async (action: () => Promise<unknown>, success?: () => void) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError("");
      try {
        await action();
        refresh();
        success?.();
      } catch (e) {
        if (e instanceof ApiClientError && e.status === 401) choose();
        setError(errorMessage(e));
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
  };
}
