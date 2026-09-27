import { createContext, useContext } from "react";
import type { User } from "@neighborhood/contracts";
import type { Api } from "./api";
export const AppContext = createContext<{
  api: Api;
  user: User | null;
  revision: number;
  refresh: () => void;
  identity: (user: User | null) => void;
  choose: () => void;
  choosing: boolean;
  close: () => void;
} | null>(null);
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("AppProvider missing");
  return context;
}
