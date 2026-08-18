import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  loadParentSelectedChildId,
  resolveParentSelectedChildId,
  saveParentSelectedChildId,
} from "@/services/parentSelectedChild";

type ParentSelectedChildContextValue = {
  selectedChildId: string | null;
  ready: boolean;
  selectChild: (childId: string) => void;
  clearSelectedChild: () => void;
  /** Validates the current selection against available children and persists the resolved choice. */
  syncWithAvailableChildren: (availableIds: string[]) => string | null;
};

const ParentSelectedChildContext = createContext<ParentSelectedChildContextValue | undefined>(undefined);

export function ParentSelectedChildProvider({ children }: PropsWithChildren) {
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const persistedRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const pendingAvailableRef = useRef<string[] | null>(null);

  const applySync = useCallback((availableIds: string[]): string | null => {
    let nextId: string | null = null;
    setSelectedChildId((current) => {
      nextId = resolveParentSelectedChildId(availableIds, current, persistedRef.current);
      if (nextId !== persistedRef.current) {
        persistedRef.current = nextId;
        void saveParentSelectedChildId(nextId);
      }
      return nextId;
    });
    return nextId;
  }, []);

  useEffect(() => {
    let active = true;
    void loadParentSelectedChildId().then((storedId) => {
      if (!active) {
        return;
      }
      persistedRef.current = storedId;
      if (storedId) {
        setSelectedChildId(storedId);
      }
      readyRef.current = true;
      setReady(true);
      if (pendingAvailableRef.current) {
        applySync(pendingAvailableRef.current);
        pendingAvailableRef.current = null;
      }
    });
    return () => {
      active = false;
    };
  }, [applySync]);

  const syncWithAvailableChildren = useCallback(
    (availableIds: string[]): string | null => {
      if (!readyRef.current) {
        pendingAvailableRef.current = availableIds;
        return null;
      }
      return applySync(availableIds);
    },
    [applySync],
  );

  const selectChild = useCallback((childId: string) => {
    persistedRef.current = childId;
    setSelectedChildId(childId);
    void saveParentSelectedChildId(childId);
  }, []);

  const clearSelectedChild = useCallback(() => {
    persistedRef.current = null;
    setSelectedChildId(null);
    void saveParentSelectedChildId(null);
  }, []);

  const value = useMemo<ParentSelectedChildContextValue>(
    () => ({
      selectedChildId,
      ready,
      selectChild,
      clearSelectedChild,
      syncWithAvailableChildren,
    }),
    [selectedChildId, ready, selectChild, clearSelectedChild, syncWithAvailableChildren],
  );

  return <ParentSelectedChildContext.Provider value={value}>{children}</ParentSelectedChildContext.Provider>;
}

export function useParentSelectedChild() {
  const ctx = useContext(ParentSelectedChildContext);
  if (!ctx) {
    throw new Error("useParentSelectedChild must be used within ParentSelectedChildProvider.");
  }
  return ctx;
}
