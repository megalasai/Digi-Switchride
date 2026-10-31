"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "adminSidebarHidden";

const SidebarUiContext = createContext<{
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
  toggle: () => void;
}>({
  hidden: false,
  setHidden: () => undefined,
  toggle: () => undefined,
});

export function SidebarUiProvider({ children }: { children: ReactNode }) {
  const [hidden, setHiddenState] = useState(false);

  useEffect(() => {
    setHiddenState(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const setHidden = (value: boolean) => {
    setHiddenState(value);
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  };

  return (
    <SidebarUiContext.Provider value={{ hidden, setHidden, toggle: () => setHidden(!hidden) }}>
      {children}
    </SidebarUiContext.Provider>
  );
}

export function useSidebarUi() {
  return useContext(SidebarUiContext);
}
