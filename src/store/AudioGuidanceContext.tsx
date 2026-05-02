import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AudioGuidanceState = {
  enabled: boolean;
  rate: number;
};

type AudioGuidanceContextValue = AudioGuidanceState & {
  setEnabled: (next: boolean) => void;
  setRate: (next: number) => void;
  speak: (text: string) => void;
  stop: () => void;
};

const STORAGE_KEY = "learngate.audioGuidance.v1";

const AudioGuidanceContext = createContext<AudioGuidanceContextValue | undefined>(undefined);

export function AudioGuidanceProvider({ children }: PropsWithChildren) {
  const [enabled, setEnabled] = useState(true);
  const [rate, setRate] = useState(0.92);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active || !raw) return;
        const parsed = JSON.parse(raw) as Partial<AudioGuidanceState>;
        if (typeof parsed.enabled === "boolean") setEnabled(parsed.enabled);
        if (typeof parsed.rate === "number") setRate(parsed.rate);
      } catch {
        // ignore
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, rate } satisfies AudioGuidanceState));
  }, [enabled, rate]);

  const stop = useCallback(() => {
    try {
      Speech.stop();
    } catch {
      // ignore
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      try {
        Speech.stop();
        Speech.speak(trimmed, { rate });
      } catch {
        // ignore
      }
    },
    [enabled, rate]
  );

  const value = useMemo<AudioGuidanceContextValue>(
    () => ({ enabled, rate, setEnabled, setRate, speak, stop }),
    [enabled, rate, speak, stop]
  );

  return <AudioGuidanceContext.Provider value={value}>{children}</AudioGuidanceContext.Provider>;
}

export function useAudioGuidance() {
  const ctx = useContext(AudioGuidanceContext);
  if (!ctx) {
    throw new Error("useAudioGuidance must be used within AudioGuidanceProvider.");
  }
  return ctx;
}

