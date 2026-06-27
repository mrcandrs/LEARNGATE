import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ParentDashboardCarousel } from "@/components/parent/ParentDashboardCarousel";
import { ParentHeroAffirmationCard } from "@/components/parent/ParentHeroAffirmationCard";
import { ParentInsightsSummaryCard, type ParentChildInsight } from "@/components/parent/ParentInsightsSummaryCard";
import { ParentLiveMonitoringCard } from "@/components/parent/ParentLiveMonitoringCard";
import { ParentManageToast } from "@/components/parent/ParentManageToast";
import { useAuth } from "@/store/AuthContext";
import { useAppColors } from "@/theme/useAppColors";
import { radii, shadows } from "@/theme/theme";
import { ParentStat } from "@/types/app";
import { supabase } from "@/services/supabase";
import {
  buildParentDashboardAnalytics,
  type ChildRow,
  type ParentDashboardAnalytics,
  type TaskRow,
} from "@/services/parentDashboardAnalytics";
import { displayAppUsageLabel, iconForPackage } from "@/constants/blockedAppPackages";
import { formatAppError } from "@/utils/errors";
import { filterReportableUsageRows } from "@/utils/appUsagePackages";
import { hasMyPushToken, registerAndSavePushToken } from "@/services/pushNotifications";
import {
  fetchStoredParentInsights,
  generateParentInsight,
  storedInsightToCard,
  type StoredParentInsight,
} from "@/services/parentInsights";
import type { ParentTabParamList } from "@/types/navigation";

type OverviewToast = {
  message: string;
  variant: "success" | "error";
};

type ActivityItem = {
  id: string;
  type: string;
  points: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const ACTIVITY_ICONS: Record<string, IconName> = {
  task_completed: "check-circle-outline",
  task_assigned: "clipboard-plus-outline",
  chore_approved: "thumb-up-outline",
  stars_earned: "star-outline",
  game_milestone: "gamepad-variant-outline",
};

function formatActivityTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 86_400_000) {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type AppUsageItem = {
  id: string;
  child_id: string;
  package_name: string;
  app_label: string | null;
  event_at: string;
  duration_seconds: number | null;
};

function formatUsageRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 45_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUsedDuration(seconds: number | null): string | null {
  if (!seconds || seconds < 60) return null;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `used ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `used ${hours} hr ${rem} min` : `used ${hours} hr`;
}

function formatAppUsageDetail(eventAt: string, durationSeconds: number | null): string {
  const opened = `Opened ${formatUsageRelativeTime(eventAt)}`;
  const used = formatUsedDuration(durationSeconds);
  return used ? `${opened} · ${used}` : opened;
}

type ManagedChild = { id: string; name: string; avatar_url: string | null };

export function ParentOverviewScreen() {
  const { isSupabaseConfigured } = useAuth();
  const route = useRoute<RouteProp<ParentTabParamList, "Overview">>();
  const navigation = useNavigation<BottomTabNavigationProp<ParentTabParamList>>();
  const c = useAppColors();
  const [stats, setStats] = useState<ParentStat[]>([]);
  const [analytics, setAnalytics] = useState<ParentDashboardAnalytics | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [appUsage, setAppUsage] = useState<AppUsageItem[]>([]);
  const [managedChildren, setManagedChildren] = useState<ManagedChild[]>([]);
  const [storedInsights, setStoredInsights] = useState<Record<string, StoredParentInsight>>({});
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [monitorMenuVisible, setMonitorMenuVisible] = useState(false);
  const [insightExpanded, setInsightExpanded] = useState(false);
  const [insightGenerating, setInsightGenerating] = useState(false);
  const insightBusyRef = useRef(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [usageRefreshing, setUsageRefreshing] = useState(false);
  const [usageLastRefreshedAt, setUsageLastRefreshedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<OverviewToast | null>(null);
  const [pushTokenReady, setPushTokenReady] = useState<boolean | null>(null);
  const [pushRegistering, setPushRegistering] = useState(false);

  const showError = useCallback((message: string) => {
    setToast({ message, variant: "error" });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setToast({ message, variant: "success" });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void hasMyPushToken().then((ok) => {
        if (active) setPushTokenReady(ok);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      const key = route.params?.navKey;
      if (!key) {
        return;
      }
      if (route.params?.childId) {
        setSelectedChildId(route.params.childId);
      }
      if (route.params?.expandInsights) {
        setInsightExpanded(true);
      }
      navigation.setParams({
        childId: undefined,
        expandInsights: undefined,
        navKey: undefined,
      });
    }, [navigation, route.params?.childId, route.params?.expandInsights, route.params?.navKey])
  );

  const loadAppUsageForChild = useCallback(
    async (childId: string) => {
      if (!isSupabaseConfigured || !supabase) {
        setAppUsage([]);
        return;
      }

      const { data, error } = await supabase
        .from("child_app_usage_events")
        .select("id, child_id, package_name, app_label, event_at, duration_seconds")
        .eq("child_id", childId)
        .eq("event_type", "foreground")
        .order("event_at", { ascending: false })
        .limit(30);

      if (error) {
        console.warn("[LearnGate] app usage load failed:", error.message);
        return;
      }

      setAppUsage(filterReportableUsageRows((data as AppUsageItem[]) ?? []));
      setUsageLastRefreshedAt(new Date());
    },
    [isSupabaseConfigured]
  );

  const refreshAppUsage = useCallback(async () => {
    if (!selectedChildId) return;
    setUsageRefreshing(true);
    try {
      await loadAppUsageForChild(selectedChildId);
      showSuccess("Recent activity refreshed.");
    } finally {
      setUsageRefreshing(false);
    }
  }, [selectedChildId, loadAppUsageForChild, showSuccess]);

  const loadDashboard = useCallback(async (fromPull = false) => {
    if (!isSupabaseConfigured || !supabase) {
      setStats([
        { label: "Children Managed", value: "0" },
        { label: "Active Now", value: "0" },
        { label: "Pending Reviews", value: "0" },
        { label: "Completed This Week", value: "0" },
      ]);
      setAnalytics(null);
      setActivity([]);
      setAppUsage([]);
      setManagedChildren([]);
      setStoredInsights({});
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    if (fromPull) setRefreshing(true);
    else setIsLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      showError(formatAppError(userError ?? new Error("Not signed in.")));
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: children, error: childrenError } = await supabase
      .from("children")
      .select(
        "id, name, stars, daily_limit_minutes, difficulty_level, is_online, last_seen_at, child_user_id, avatar_url"
      )
      .eq("parent_id", user.id);

    if (childrenError || !children) {
      showError(formatAppError(childrenError ?? new Error("Failed to load children.")));
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    const childRows = children as ChildRow[];
    const childIds = childRows.map((c) => c.id);
    let taskRows: TaskRow[] = [];
    let recentActivity: ActivityItem[] = [];
    let pendingReviewsByChild: Record<string, number> = {};
    let activityPointsThisWeek = 0;
    const appTimeSecondsByChild: Record<string, number> = {};

    if (childIds.length > 0) {
      const weekStartIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [tasksRes, logsRes, subsRes, pointsRes, usageRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("child_id, title, category, status, created_at, completed_at")
          .in("child_id", childIds)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("activity_logs")
          .select("id, type, points, metadata, created_at")
          .in("child_id", childIds)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase.from("task_submissions").select("child_id").eq("status", "submitted"),
        supabase
          .from("activity_logs")
          .select("points")
          .in("child_id", childIds)
          .gte("created_at", weekStartIso),
        supabase
          .from("child_app_usage_events")
          .select("child_id, duration_seconds")
          .in("child_id", childIds)
          .eq("event_type", "foreground")
          .gte("event_at", weekStartIso),
      ]);

      if (tasksRes.error) {
        showError(formatAppError(tasksRes.error));
        setIsLoading(false);
        setRefreshing(false);
        return;
      }
      if (logsRes.error) {
        showError(formatAppError(logsRes.error));
        setIsLoading(false);
        setRefreshing(false);
        return;
      }

      taskRows = (tasksRes.data as TaskRow[]) ?? [];
      recentActivity = (logsRes.data as ActivityItem[]) ?? [];

      for (const row of subsRes.data ?? []) {
        const cid = (row as { child_id: string }).child_id;
        pendingReviewsByChild[cid] = (pendingReviewsByChild[cid] ?? 0) + 1;
      }

      activityPointsThisWeek = (pointsRes.data ?? []).reduce(
        (sum, row) => sum + ((row as { points: number }).points ?? 0),
        0
      );

      for (const row of usageRes.data ?? []) {
        const cid = (row as { child_id: string }).child_id;
        const secs = (row as { duration_seconds: number | null }).duration_seconds ?? 0;
        appTimeSecondsByChild[cid] = (appTimeSecondsByChild[cid] ?? 0) + secs;
      }
    }

    const managed = childRows.map((c) => ({
      id: c.id,
      name: c.name ?? "Child",
      avatar_url: c.avatar_url ?? null,
    }));

    const built = buildParentDashboardAnalytics({
      children: childRows,
      tasks: taskRows,
      pendingReviewsByChild,
      activityPointsThisWeek,
      appTimeSecondsByChild,
    });

    const stored = await fetchStoredParentInsights(childIds);

    setAnalytics(built);
    setStats([
      { label: "Children Managed", value: String(childRows.length) },
      {
        label: "Active Now",
        value: childRows.length ? `${built.onlineCount}/${childRows.length}` : "0",
      },
      { label: "Pending Reviews", value: String(built.pendingReviewsTotal) },
      { label: "Completed This Week", value: String(built.week.totalCompleted) },
    ]);
    setActivity(recentActivity);
    setManagedChildren(managed);
    setStoredInsights(Object.fromEntries(stored.map((row) => [row.child_id, row])));
    setSelectedChildId((prev) =>
      prev && managed.some((c) => c.id === prev) ? prev : managed[0]?.id ?? null
    );
    const usageChildId =
      selectedChildId && managed.some((c) => c.id === selectedChildId)
        ? selectedChildId
        : managed[0]?.id ?? null;
    if (usageChildId) {
      await loadAppUsageForChild(usageChildId);
    } else {
      setAppUsage([]);
    }
    setIsLoading(false);
    setRefreshing(false);
  }, [isSupabaseConfigured, loadAppUsageForChild, selectedChildId, showError]);

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    void loadDashboard(true);
  }, [loadDashboard]);

  const generateInsightForChild = useCallback(
    async (childId: string) => {
      if (insightBusyRef.current) {
        return;
      }
      insightBusyRef.current = true;
      setInsightGenerating(true);
      try {
        const result = await generateParentInsight(childId, { force: true });
        if (result.ok) {
          setStoredInsights((prev) => ({ ...prev, [childId]: result.insight }));
        } else {
          showError(result.message);
        }
      } finally {
        insightBusyRef.current = false;
        setInsightGenerating(false);
      }
    },
    [showError]
  );

  const selectedInsight = useMemo((): ParentChildInsight | null => {
    const childId = selectedChildId ?? managedChildren[0]?.id;
    if (!childId) {
      return null;
    }
    const stored = storedInsights[childId];
    const childName = managedChildren.find((c) => c.id === childId)?.name ?? "Child";
    if (!stored) {
      return null;
    }
    return storedInsightToCard(stored, childName);
  }, [managedChildren, selectedChildId, storedInsights]);

  const selectedInsightGeneratedAt = useMemo(() => {
    const childId = selectedChildId ?? managedChildren[0]?.id;
    if (!childId) {
      return undefined;
    }
    return storedInsights[childId]?.generated_at;
  }, [managedChildren, selectedChildId, storedInsights]);

  const onToggleInsight = useCallback(() => {
    setInsightExpanded((expanded) => {
      const next = !expanded;
      if (next) {
        const childId = selectedChildId ?? managedChildren[0]?.id;
        if (childId) {
          void generateInsightForChild(childId);
        }
      }
      return next;
    });
  }, [generateInsightForChild, managedChildren, selectedChildId]);

  const selectedMonitor = useMemo(() => {
    const childId = selectedChildId ?? analytics?.monitors[0]?.childId;
    return analytics?.monitors.find((m) => m.childId === childId) ?? analytics?.monitors[0] ?? null;
  }, [analytics, selectedChildId]);

  const visibleAppUsage = useMemo(
    () => (activityExpanded ? appUsage : appUsage.slice(0, 5)),
    [activityExpanded, appUsage]
  );

  const visibleActivity = useMemo(
    () => (activityExpanded ? activity : activity.slice(0, 5)),
    [activityExpanded, activity]
  );

  const hasMoreActivity = appUsage.length > 5 || activity.length > 5;

  const onSelectChild = useCallback(
    (childId: string) => {
      setSelectedChildId(childId);
      void loadAppUsageForChild(childId);
    },
    [loadAppUsageForChild]
  );

  return (
    <ScreenContainer scroll onRefresh={onRefresh} refreshing={refreshing}>
      <ParentHeroAffirmationCard />

      {pushTokenReady === false ? (
        <Card style={[styles.pushBanner, { borderColor: c.warning }]}>
          <Card.Content>
            <Text variant="titleSmall">Alerts not enabled on this device</Text>
            <Text variant="bodySmall" style={[styles.pushBannerHint, { color: c.subtext }]}>
              Parent notifications (task completed, submissions) need a push token saved for your account. Use a
              separate phone/emulator from the child account.
            </Text>
            <Button
              mode="contained"
              loading={pushRegistering}
              disabled={pushRegistering}
              style={styles.pushBannerBtn}
              onPress={async () => {
                setPushRegistering(true);
                try {
                  const result = await registerAndSavePushToken();
                  setPushTokenReady(result.ok);
                  if (result.ok) {
                    showSuccess("Alerts enabled on this device.");
                  } else {
                    showError(result.message);
                  }
                } finally {
                  setPushRegistering(false);
                }
              }}
            >
              Enable alerts on this device
            </Button>
          </Card.Content>
        </Card>
      ) : null}

      {analytics ? <ParentDashboardCarousel stats={stats} analytics={analytics} /> : null}

      {selectedMonitor && managedChildren.length > 0 ? (
        <ParentLiveMonitoringCard
          monitor={selectedMonitor}
          childOptions={managedChildren}
          selectedChildId={selectedChildId ?? selectedMonitor.childId}
          menuVisible={monitorMenuVisible}
          onOpenMenu={() => setMonitorMenuVisible(true)}
          onDismissMenu={() => setMonitorMenuVisible(false)}
          onSelectChild={onSelectChild}
        />
      ) : null}

      {analytics && managedChildren.length > 0 ? (
        <ParentInsightsSummaryCard
          week={analytics.week}
          insight={selectedInsight}
          generatedAt={selectedInsightGeneratedAt}
          expanded={insightExpanded}
          loading={insightGenerating}
          onTogglePlan={onToggleInsight}
        />
      ) : null}

      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={[styles.sectionTitle, { color: c.primaryDark }]}>Recent Activity</Text>
          <Pressable
            onPress={() => void refreshAppUsage()}
            disabled={usageRefreshing || !selectedChildId}
            accessibilityRole="button"
            accessibilityLabel="Refresh recent activity"
          >
            <Text
              style={[
                styles.refreshLink,
                { color: c.primary },
                (usageRefreshing || !selectedChildId) && styles.refreshDisabled,
              ]}
            >
              {usageRefreshing ? "Refreshing…" : "Refresh"}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.recentCard, { borderColor: c.border, backgroundColor: c.card }]}>
          {managedChildren.length === 0 ? (
            <Text style={styles.emptyText}>Add a child profile to see activity here.</Text>
          ) : (
            <>
              {usageLastRefreshedAt ? (
                <Text variant="labelSmall" style={[styles.usageMeta, { color: c.subtext }]}>
                  Last refreshed {formatUsageRelativeTime(usageLastRefreshedAt.toISOString())}. Child phone uploads
                  about every 30 seconds.
                </Text>
              ) : null}

              {visibleAppUsage.length === 0 && visibleActivity.length === 0 && !usageRefreshing ? (
                <Text style={[styles.emptyText, { color: c.subtext }]}>
                  No recent activity yet for{" "}
                  {managedChildren.find((c) => c.id === selectedChildId)?.name ?? "this child"}. On their phone: Child
                  Settings → App activity reporting → turn Usage access on, then tap Refresh.
                </Text>
              ) : null}

              {visibleAppUsage.map((item) => (
                <View key={item.id} style={[styles.activityRow, { borderBottomColor: c.border }]}>
                  <View style={[styles.appUsageIconWrap, { backgroundColor: c.surfaceTint }]}>
                    <MaterialCommunityIcons
                      name={iconForPackage(item.package_name)}
                      size={24}
                      color={c.primaryDark}
                    />
                  </View>
                  <View style={styles.activityText}>
                    <Text style={[styles.activityMain, { color: c.text }]} numberOfLines={1}>
                      {displayAppUsageLabel(item.app_label, item.package_name)} opened
                    </Text>
                    <Text style={[styles.activityTime, { color: c.subtext }]}>
                      {formatAppUsageDetail(item.event_at, item.duration_seconds)}
                    </Text>
                  </View>
                </View>
              ))}

              {visibleActivity.map((item) => (
                <View key={item.id} style={[styles.activityRow, { borderBottomColor: c.border }]}>
                  <View style={[styles.appUsageIconWrap, { backgroundColor: c.surfaceTint }]}>
                    <MaterialCommunityIcons
                      name={ACTIVITY_ICONS[item.type] ?? "history"}
                      size={24}
                      color={c.primaryDark}
                    />
                  </View>
                  <View style={styles.activityText}>
                    <Text style={[styles.activityMain, { color: c.text }]}>{item.type.replace(/_/g, " ")}</Text>
                    <Text style={[styles.activityTime, { color: c.subtext }]}>
                      {formatActivityTime(item.created_at)}
                    </Text>
                  </View>
                  {item.points > 0 ? (
                    <Text style={[styles.pointsBadge, { color: c.warning }]}>+{item.points}</Text>
                  ) : null}
                </View>
              ))}

              {hasMoreActivity ? (
                <Pressable
                  onPress={() => setActivityExpanded((v) => !v)}
                  style={[styles.viewMoreBtn, { backgroundColor: c.surfaceTint }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.viewMoreText, { color: c.primaryDark }]}>
                    {activityExpanded ? "Show fewer activities" : "View more activities"}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>

      <ParentManageToast
        visible={toast != null}
        message={toast?.message ?? ""}
        variant={toast?.variant ?? "success"}
        onHide={() => setToast(null)}
        durationMs={toast?.variant === "error" ? 4500 : 3200}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  recentSection: {
    marginTop: 16,
    gap: 10,
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  refreshLink: {
    fontWeight: "700",
    fontSize: 14,
  },
  refreshDisabled: {
    opacity: 0.5,
  },
  recentCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    ...shadows.card,
  },
  usageMeta: {
    lineHeight: 18,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  appUsageIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activityText: {
    flex: 1,
  },
  activityMain: {
    fontWeight: "700",
    fontSize: 14,
  },
  activityTime: {
    marginTop: 2,
    fontSize: 12,
  },
  pointsBadge: {
    fontWeight: "800",
    fontSize: 15,
  },
  viewMoreBtn: {
    marginTop: 4,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: "center",
  },
  viewMoreText: {
    fontWeight: "700",
  },
  emptyText: {
    lineHeight: 20,
  },
  pushBanner: {
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: "#FFFBEB",
  },
  pushBannerHint: {
    marginVertical: 8,
  },
  pushBannerBtn: {
    marginTop: 4,
  },
});
