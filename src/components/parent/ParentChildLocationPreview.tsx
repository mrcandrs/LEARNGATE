import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/store/AuthContext";
import { supabase } from "@/services/supabase";
import { formatAppError } from "@/utils/errors";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";
import { reverseGeocode } from "@/services/geoapify";

export type ParentLocationChild = {
  id: string;
  name: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen_at: string | null;
};

type LocationRow = {
  child_id: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  captured_at: string;
};

type ChildLocationState = {
  child: ParentLocationChild;
  location: LocationRow | null;
};

type ParentChildLocationPreviewProps = {
  children: ParentLocationChild[];
  selectedChildId: string | null;
};

const DEFAULT_REGION: Region = {
  latitude: 9.85,
  longitude: 124.14,
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};

export function ParentChildLocationPreview({ children, selectedChildId }: ParentChildLocationPreviewProps) {
  const c = useAppColors();
  const { isSupabaseConfigured } = useAuth();
  const mapRef = useRef<MapView | null>(null);
  const markerAnimationRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const silenceRef = useRef<Record<string, boolean>>({});
  const loadedChildIdsKeyRef = useRef<string | null>(null);
  const [latestByChild, setLatestByChild] = useState<Record<string, LocationRow>>({});
  const [displayedByChild, setDisplayedByChild] = useState<Record<string, { lat: number; lng: number }>>({});
  const [placeByChild, setPlaceByChild] = useState<Record<string, { capturedAt: string; place: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const childIdsKey = useMemo(() => children.map((c) => c.id).join(","), [children]);

  const loadLatestLocations = useCallback(async () => {
    if (!childIdsKey || !isSupabaseConfigured || !supabase) {
      setLatestByChild({});
      setLoading(false);
      return;
    }
    setError(null);
    const childIds = childIdsKey.split(",").filter(Boolean);
    const { data, error: lError } = await supabase
      .from("child_locations")
      .select("child_id, lat, lng, accuracy_m, speed_mps, captured_at")
      .in("child_id", childIds)
      .order("captured_at", { ascending: false })
      .limit(500);
    if (lError) {
      setError(formatAppError(lError));
      setLoading(false);
      return;
    }
    const rows = (data as LocationRow[]) ?? [];
    const map: Record<string, LocationRow> = {};
    for (const row of rows) {
      if (!map[row.child_id]) {
        map[row.child_id] = row;
      }
    }
    setLatestByChild(map);
    setLoading(false);
  }, [childIdsKey, isSupabaseConfigured]);

  useEffect(() => {
    const isNewChildSet = loadedChildIdsKeyRef.current !== childIdsKey;
    if (isNewChildSet) {
      loadedChildIdsKeyRef.current = childIdsKey;
      setLoading(true);
    }
    void loadLatestLocations();
  }, [loadLatestLocations, childIdsKey]);

  useEffect(() => {
    if (!snackbar) {
      return;
    }
    const timer = setTimeout(() => setSnackbar(null), 4500);
    return () => clearTimeout(timer);
  }, [snackbar]);

  useEffect(() => {
    if (!children.length) {
      silenceRef.current = {};
      return;
    }
    const thresholdMs = 3 * 60_000;
    const tick = () => {
      const now = Date.now();
      for (const c of children) {
        const lastSeen = c.last_seen_at ? new Date(c.last_seen_at).getTime() : 0;
        const silent = !lastSeen || now - lastSeen > thresholdMs;
        const prev = silenceRef.current[c.id] ?? false;
        silenceRef.current[c.id] = silent;
        if (silent && !prev) {
          setSnackbar(`No heartbeat from ${c.name} (3+ minutes).`);
        }
      }
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [children]);

  useEffect(() => {
    if (!children.length || !supabase) {
      return;
    }
    const client = supabase;
    const childIds = new Set(children.map((c) => c.id));
    const channel = client
      .channel("parent-location-children-tab")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "child_locations" },
        (payload) => {
          const row = payload.new as LocationRow;
          if (!childIds.has(row.child_id)) {
            return;
          }
          setLatestByChild((prev) => {
            const old = prev[row.child_id];
            if (!old || new Date(row.captured_at).getTime() >= new Date(old.captured_at).getTime()) {
              return { ...prev, [row.child_id]: row };
            }
            return prev;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "child_locations" },
        (payload) => {
          const row = payload.new as LocationRow;
          if (!childIds.has(row.child_id)) {
            return;
          }
          setLatestByChild((prev) => {
            const old = prev[row.child_id];
            if (!old || new Date(row.captured_at).getTime() >= new Date(old.captured_at).getTime()) {
              return { ...prev, [row.child_id]: row };
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [childIdsKey]);

  useEffect(() => {
    if (!children.length) {
      return;
    }
    const interval = setInterval(() => {
      void loadLatestLocations();
    }, 1000);
    return () => clearInterval(interval);
  }, [children.length, loadLatestLocations]);

  useEffect(() => {
    return () => {
      Object.values(markerAnimationRef.current).forEach((timer) => clearInterval(timer));
      markerAnimationRef.current = {};
    };
  }, []);

  useEffect(() => {
    Object.entries(latestByChild).forEach(([childId, location]) => {
      const target = { lat: location.lat, lng: location.lng };
      let start = target;

      setDisplayedByChild((prev) => {
        const existing = prev[childId];
        if (!existing) {
          return { ...prev, [childId]: target };
        }
        start = existing;
        return prev;
      });

      if (start.lat === target.lat && start.lng === target.lng) {
        return;
      }

      const prevTimer = markerAnimationRef.current[childId];
      if (prevTimer) {
        clearInterval(prevTimer);
      }

      let step = 0;
      const steps = 10;
      const timer = setInterval(() => {
        step += 1;
        const t = step / steps;
        setDisplayedByChild((prev) => ({
          ...prev,
          [childId]: {
            lat: start.lat + (target.lat - start.lat) * t,
            lng: start.lng + (target.lng - start.lng) * t,
          },
        }));
        if (step >= steps) {
          clearInterval(timer);
          delete markerAnimationRef.current[childId];
        }
      }, 80);
      markerAnimationRef.current[childId] = timer;
    });
  }, [latestByChild]);

  useEffect(() => {
    let active = true;
    async function resolvePlaces() {
      await Promise.all(
        Object.entries(latestByChild).map(async ([childId, loc]) => {
          const existing = placeByChild[childId];
          if (existing?.capturedAt === loc.captured_at) {
            return;
          }
          const resolved = await reverseGeocode(loc.lat, loc.lng);
          if (!active) {
            return;
          }
          setPlaceByChild((prev) => ({
            ...prev,
            [childId]: {
              capturedAt: loc.captured_at,
              place: resolved ?? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`,
            },
          }));
        })
      );
    }
    void resolvePlaces();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestByChild]);

  const childStates: ChildLocationState[] = useMemo(
    () =>
      children.map((child) => ({
        child,
        location: latestByChild[child.id] ?? null,
      })),
    [children, latestByChild]
  );

  const selectedState = useMemo(() => {
    if (!selectedChildId) {
      return null;
    }
    return childStates.find((entry) => entry.child.id === selectedChildId) ?? null;
  }, [childStates, selectedChildId]);

  const selectedMarker = useMemo(() => {
    if (!selectedState?.location) {
      return null;
    }
    return selectedState;
  }, [selectedState]);

  const initialRegion = useMemo<Region>(() => {
    if (!selectedMarker?.location) {
      return DEFAULT_REGION;
    }
    return {
      latitude: selectedMarker.location.lat,
      longitude: selectedMarker.location.lng,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
  }, [selectedMarker]);

  const pinColorForChild = useCallback((childId: string) => {
    const palette = ["#7C3AED", "#DB2777", "#2563EB", "#059669", "#EA580C", "#DC2626", "#0891B2"];
    const hash = childId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return palette[hash % palette.length];
  }, []);

  useEffect(() => {
    if (!selectedChildId) {
      return;
    }
    if (!selectedMarker?.location || !mapRef.current) {
      return;
    }
    const markerPoint = displayedByChild[selectedChildId] ?? {
      lat: selectedMarker.location.lat,
      lng: selectedMarker.location.lng,
    };
    mapRef.current.animateToRegion(
      {
        latitude: markerPoint.lat,
        longitude: markerPoint.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      450
    );
    // Only re-center when the parent changes the selected child.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChildId]);

  const selectedName = selectedState?.child.name;

  return (
    <View style={styles.wrap}>
      <View style={[styles.mapShell, { borderColor: c.border, backgroundColor: c.surfaceTint }]}>
        <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion}>
          {selectedMarker ? (
            <Marker
              coordinate={{
                latitude: (displayedByChild[selectedMarker.child.id] ?? {
                  lat: selectedMarker.location!.lat,
                  lng: selectedMarker.location!.lng,
                }).lat,
                longitude: (displayedByChild[selectedMarker.child.id] ?? {
                  lat: selectedMarker.location!.lat,
                  lng: selectedMarker.location!.lng,
                }).lng,
              }}
              title={selectedMarker.child.name}
              description={`Updated ${new Date(selectedMarker.location!.captured_at).toLocaleTimeString()}`}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={[styles.markerWrap, styles.markerSelected]}>
                {selectedMarker.child.avatar_url ? (
                  <Image
                    source={{ uri: selectedMarker.child.avatar_url }}
                    style={[styles.markerAvatar, { borderColor: pinColorForChild(selectedMarker.child.id) }]}
                  />
                ) : (
                  <View style={[styles.markerAvatarFallback, { borderColor: pinColorForChild(selectedMarker.child.id) }]}>
                    <Text style={styles.markerLetter}>{selectedMarker.child.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                <View style={[styles.markerStem, { backgroundColor: pinColorForChild(selectedMarker.child.id) }]} />
              </View>
            </Marker>
          ) : null}
        </MapView>
        {selectedName ? (
          <View style={[styles.mapBadge, { backgroundColor: c.primaryDark }]}>
            <MaterialCommunityIcons name="map-marker" size={14} color="#FFFFFF" />
            <Text style={styles.mapBadgeText}>{selectedName} selected</Text>
          </View>
        ) : null}
        {loading ? (
          <View style={styles.mapLoadingOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color={c.primary} />
          </View>
        ) : null}
      </View>

      <View style={styles.hintArea}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!selectedChildId ? (
          <Text style={[styles.emptyText, { color: c.subtext }]}>
            Select a child above to see their live location status.
          </Text>
        ) : null}
        {selectedChildId && !selectedMarker && !loading ? (
          <Text style={[styles.emptyText, { color: c.subtext }]}>
            No location for {selectedName ?? "this child"} yet. Ask them to allow location permission and open LearnGate once.
          </Text>
        ) : null}
      </View>

      {selectedState ? (
        <View style={styles.statusList}>
          <View
            style={[
              styles.statusRow,
              {
                backgroundColor: c.locationStatusBg,
                borderColor: c.locationStatusBorder,
              },
            ]}
          >
            <View style={styles.nameRow}>
              {selectedState.child.avatar_url ? (
                <Image source={{ uri: selectedState.child.avatar_url }} style={styles.childAvatar} />
              ) : (
                <View style={styles.childAvatarFallback}>
                  <Text style={styles.childAvatarLetter}>{selectedState.child.name.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View
                style={[styles.presenceDot, { backgroundColor: selectedState.child.is_online ? "#16A34A" : "#9CA3AF" }]}
              />
              <Text style={[styles.statusName, { color: c.text }]}>{selectedState.child.name}</Text>
              <View style={[styles.pinDot, { backgroundColor: pinColorForChild(selectedState.child.id) }]} />
            </View>
            {selectedState.location ? (
              <Text style={[styles.meta, { color: c.subtext }]}>
                {selectedState.child.is_online ? "Online" : "Offline"} ·{" "}
                {(placeByChild[selectedState.child.id]?.place ?? "Resolving location…").split(",").slice(0, 2).join(",")}
              </Text>
            ) : (
              <Text style={[styles.pending, { color: c.subtext }]}>
                Waiting for permission or first location update
              </Text>
            )}
            {selectedState.child.last_seen_at ? (
              <Text style={[styles.meta, { color: c.subtext }]}>
                Last seen {new Date(selectedState.child.last_seen_at).toLocaleString()}
              </Text>
            ) : null}
            {selectedState.location ? (
              <Text style={[styles.meta, { color: c.subtext }]}>
                Updated {new Date(selectedState.location.captured_at).toLocaleString()}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {snackbar ? (
        <View style={styles.heartbeatBanner}>
          <Text variant="bodySmall" style={styles.heartbeatBannerText}>
            {snackbar}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  hintArea: {
    minHeight: 44,
    justifyContent: "center",
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.55)",
  },
  heartbeatBanner: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  heartbeatBannerText: {
    color: "#92400E",
    fontWeight: "600",
  },
  mapShell: {
    height: 280,
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  mapBadge: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  mapBadgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  errorText: {
    color: "#B91C1C",
  },
  emptyText: {
    lineHeight: 20,
  },
  statusList: {
    gap: 6,
  },
  statusRow: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: 10,
    gap: 2,
  },
  statusName: {
    fontWeight: "700",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  childAvatar: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
  },
  childAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  childAvatarLetter: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  presenceDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginLeft: "auto",
  },
  meta: {
    fontSize: 12,
  },
  pending: {
    fontSize: 12,
  },
  markerWrap: {
    alignItems: "center",
  },
  markerSelected: {
    transform: [{ scale: 1.08 }],
  },
  markerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    backgroundColor: "#FFFFFF",
  },
  markerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  markerLetter: {
    fontWeight: "800",
    fontSize: 12,
  },
  markerStem: {
    width: 10,
    height: 12,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    marginTop: -2,
  },
});
