"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getBrowseUserLibrary } from "./browseLibraryAction";

type LibraryState = {
  isLoggedIn: boolean;
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  loaded: boolean;
};

const BrowseLibraryContext = createContext<LibraryState>({
  isLoggedIn: false,
  watchedIds: new Set(),
  watchlistIds: new Set(),
  loaded: false,
});

export function BrowseLibraryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LibraryState>({
    isLoggedIn: false,
    watchedIds: new Set(),
    watchlistIds: new Set(),
    loaded: false,
  });

  useEffect(() => {
    getBrowseUserLibrary()
      .then(({ isLoggedIn, watchedIds, watchlistIds }) => {
        setState({ isLoggedIn, watchedIds: new Set(watchedIds), watchlistIds: new Set(watchlistIds), loaded: true });
      })
      .catch(() => {
        setState((s) => ({ ...s, loaded: true }));
      });
  }, []);

  return (
    <BrowseLibraryContext.Provider value={state}>
      {children}
    </BrowseLibraryContext.Provider>
  );
}

export function useBrowseLibrary(): LibraryState {
  return useContext(BrowseLibraryContext);
}
