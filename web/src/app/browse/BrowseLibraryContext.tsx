"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { getBrowseUserLibrary, toggleBrowseMatureContent } from "./browseLibraryAction";

type LibraryState = {
  isLoggedIn: boolean;
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  showMatureContent: boolean;
  is18Plus: boolean;
  loaded: boolean;
  toggleMatureContent: (enable: boolean) => void;
};

const BrowseLibraryContext = createContext<LibraryState>({
  isLoggedIn: false,
  watchedIds: new Set(),
  watchlistIds: new Set(),
  showMatureContent: false,
  is18Plus: false,
  loaded: false,
  toggleMatureContent: () => undefined,
});

export function BrowseLibraryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<LibraryState, "toggleMatureContent">>({
    isLoggedIn: false,
    watchedIds: new Set(),
    watchlistIds: new Set(),
    showMatureContent: false,
    is18Plus: false,
    loaded: false,
  });
  const [, startTransition] = useTransition();

  useEffect(() => {
    getBrowseUserLibrary()
      .then(({ isLoggedIn, watchedIds, watchlistIds, showMatureContent, is18Plus }) => {
        setState({
          isLoggedIn,
          watchedIds: new Set(watchedIds),
          watchlistIds: new Set(watchlistIds),
          showMatureContent,
          is18Plus,
          loaded: true,
        });
      })
      .catch(() => {
        setState((s) => ({ ...s, loaded: true }));
      });
  }, []);

  function toggleMatureContent(enable: boolean) {
    setState((s) => ({ ...s, showMatureContent: enable }));
    startTransition(() => {
      toggleBrowseMatureContent(enable);
    });
  }

  return (
    <BrowseLibraryContext.Provider value={{ ...state, toggleMatureContent }}>
      {children}
    </BrowseLibraryContext.Provider>
  );
}

export function useBrowseLibrary(): LibraryState {
  return useContext(BrowseLibraryContext);
}
