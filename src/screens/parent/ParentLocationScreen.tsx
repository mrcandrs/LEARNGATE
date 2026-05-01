import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { ActivityIndicator, Card, Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/store/AuthContext";
import { supabase } from "@/services/supabase";
import { formatAppError } from "@/utils/errors";
import { colors, radii, shadows } from "@/theme/theme";

type ChildOption = {
  id: string;
  name: string;
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
  child: ChildOption;
  location: LocationRow | null;
};
type ChildPresenceRow = {
  id: string;
  name: string;
  is_online: boolean;
  last_seen_at: string | null;
};

export function ParentLocationScreen() {
  const { isSupabaseConfigured } = useAuth();
  const mapRef = useRef<MapView | null>(null);
  const markerAnimationRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [parentId, setParentId] = useState<string | null>(null);
  const [latestByChild, setLatestByChild] = useState<Record<string, LocationRow>>({});
  const [displayedByChild, setDisplayedByChild] = useState<Record<string, { lat: number; lng: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedChildId, setFocusedChildId] = useState<string | null>(null);

  const loadChildren = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setChildren([]);
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setError(formatAppError(userError ?? new Error("Not signed in.")));
      setLoading(false);
      return;
    }
    setParentId(user.id);

    const { data, error: cError } = await supabase
      .from("children")
      .select("id, name, is_online, last_seen_at")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: true });
    if (cError) {
      setError(formatAppError(cError));
      setLoading(false);
      return;
    }
    const list = ((data as ChildPresenceRow[]) ?? []).map((c) => ({
      id: c.id,
      name: c.name || "Child",
      is_online: Boolean(c.is_online),
      last_seen_at: c.last_seen_at ?? null,
    }));
    setChildren(list);
    setLoading(false);
  }, [isSupabaseConfigured]);

  const loadLatestLocations = useCallback(async () => {
    if (!children.length || !supabase) {
      setLatestByChild({});
      return;
    }
    const childIds = children.map((c) => c.id);

    const { data, error: lError } = await supabase
      .from("child_locations")
      .select("child_id, lat, lng, accuracy_m, speed_mps, captured_at")
      .in("child_id", childIds)
      .order("captured_at", { ascending: false })
      .limit(500);
    if (lError) {
      setError(formatAppError(lError));
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
  }, [children]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChildren();
    await loadLatestLocations();
    setRefreshing(false);
  }, [loadChildren, loadLatestLocations]);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    void loadLatestLocations();
  }, [loadLatestLocations]);

  useEffect(() => {
    if (!children.length || !supabase) {
      return;
    }
    const client = supabase;
    const childIds = new Set(children.map((c) => c.id));
    const channel = client
      .channel("parent-location-all")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "child_locations",
        },
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
        {
          event: "UPDATE",
          schema: "public",
          table: "child_locations",
        },
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
  }, [children]);

  useEffect(() => {
    if (!parentId || !supabase) {
      return;
    }
    const client = supabase;
    const channel = client
      .channel("parent-children-presence")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "children",
          filter: `parent_id=eq.${parentId}`,
        },
        (payload) => {
          const row = payload.new as ChildPresenceRow;
          setChildren((prev) =>
            prev.map((child) =>
              child.id === row.id
                ? {
                    ...child,
                    name: row.name || child.name,
                    is_online: Boolean(row.is_online),
                    last_seen_at: row.last_seen_at ?? null,
                  }
                : child
            )
          );
        }
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [parentId]);

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
        const nextLat = start.lat + (target.lat - start.lat) * t;
        const nextLng = start.lng + (target.lng - start.lng) * t;

        setDisplayedByChild((prev) => ({
          ...prev,
          [childId]: { lat: nextLat, lng: nextLng },
        }));

        if (step >= steps) {
          clearInterval(timer);
          delete markerAnimationRef.current[childId];
        }
      }, 80);

      markerAnimationRef.current[childId] = timer;
    });
  }, [latestByChild]);

  const childStates: ChildLocationState[] = useMemo(
    () =>
      children.map((child) => ({
        child,
        location: latestByChild[child.id] ?? null,
      })),
    [children, latestByChild]
  );

  const childMarkers = useMemo(
    () => childStates.filter((entry) => Boolean(entry.location)),
    [childStates]
  );

  const initialRegion = useMemo<Region>(() => {
    if (childMarkers.length === 0) {
      return {
        latitude: 9.85,
        longitude: 124.14,
        latitudeDelta: 0.35,
        longitudeDelta: 0.35,
      };
    }
    const lats = childMarkers.map((entry) => entry.location!.lat);
    const lngs = childMarkers.map((entry) => entry.location!.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.8),
      longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.8),
    };
  }, [childMarkers]);

  const pinColorForChild = useCallback((childId: string) => {
    const palette = ["#7C3AED", "#DB2777", "#2563EB", "#059669", "#EA580C", "#DC2626", "#0891B2"];
    const hash = childId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return palette[hash % palette.length];
  }, []);

  const zoomToChild = useCallback((entry: ChildLocationState) => {
    if (!entry.location || !mapRef.current) {
      return;
    }
    const markerPoint = displayedByChild[entry.child.id] ?? { lat: entry.location.lat, lng: entry.location.lng };
    setFocusedChildId(entry.child.id);
    mapRef.current.animateToRegion(
      {
        latitude: markerPoint.lat,
        longitude: markerPoint.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      450
    );
  }, [displayedByChild]);

  const isChildOnline = useCallback((entry: ChildLocationState) => {
    return Boolean(entry.child.is_online);
  }, []);

  return (
    <ScreenContainer scroll contentPadding={0} onRefresh={handleRefresh} refreshing={refreshing}>
      <View style={styles.root}>
        <MapView ref={mapRef} style={styles.fullMap} initialRegion={initialRegion}>
          {childMarkers.map((entry) => (
            <Marker
              key={entry.child.id}
              coordinate={{
                latitude: (displayedByChild[entry.child.id] ?? { lat: entry.location!.lat, lng: entry.location!.lng }).lat,
                longitude: (displayedByChild[entry.child.id] ?? { lat: entry.location!.lat, lng: entry.location!.lng }).lng,
              }}
              pinColor={pinColorForChild(entry.child.id)}
              title={entry.child.name}
              description={`Updated ${new Date(entry.location!.captured_at).toLocaleTimeString()}`}
            />
          ))}
        </MapView>

        <View style={styles.topOverlay}>
          <Card style={styles.overlayCard}>
            <Card.Content style={styles.overlayContent}>
              <Text variant="titleMedium">Child Safety Map</Text>
              <Text style={styles.meta}>Live pins for all children on one map.</Text>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.bottomOverlay}>
          <Card style={styles.overlayCard}>
            <Card.Content style={styles.overlayContent}>
              {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {childMarkers.length === 0 ? (
                <Text style={styles.emptyText}>
                  No location points yet. Ask each child to allow location permission once and open the app.
                </Text>
              ) : null}
              <View style={styles.statusList}>
                {childStates.map((entry) => (
                  <Pressable
                    key={entry.child.id}
                    style={[styles.statusRow, focusedChildId === entry.child.id ? styles.statusRowFocused : null]}
                    onPress={() => zoomToChild(entry)}
                  >
                    <View style={styles.nameRow}>
                      <View
                        style={[
                          styles.presenceDot,
                          { backgroundColor: isChildOnline(entry) ? "#16A34A" : "#9CA3AF" },
                        ]}
                      />
                      <Text style={styles.statusName}>{entry.child.name}</Text>
                      <View style={[styles.pinDot, { backgroundColor: pinColorForChild(entry.child.id) }]} />
                    </View>
                    {entry.location ? (
                      <Text style={styles.meta}>
                        {isChildOnline(entry) ? "Online" : "Offline"} - Last location{" "}
                        {new Date(entry.location.captured_at).toLocaleTimeString()}
                      </Text>
                    ) : (
                      <Text style={styles.pending}>Offline - Waiting for permission/location</Text>
                    )}
                    {entry.child.last_seen_at ? (
                      <Text style={styles.meta}>
                        Session seen {new Date(entry.child.last_seen_at).toLocaleTimeString()}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </Card.Content>
          </Card>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 720,
    backgroundColor: colors.background,
  },
  fullMap: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  topOverlay: {
    position: "absolute",
    top: 16,
    left: 12,
    right: 12,
  },
  bottomOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
  },
  overlayCard: {
    borderRadius: radii.md,
    ...shadows.card,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  overlayContent: {
    gap: 8,
  },
  meta: {
    color: colors.subtext,
  },
  statusList: {
    gap: 6,
    maxHeight: 180,
  },
  statusRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: radii.sm,
    padding: 10,
    gap: 2,
  },
  statusRowFocused: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  statusName: {
    color: colors.text,
    fontWeight: "700",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  pending: {
    color: colors.subtext,
  },
  emptyText: {
    color: colors.subtext,
    lineHeight: 20,
  },
  errorText: {
    color: "#B91C1C",
  },
});

