import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  type ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useAppColors } from "@/theme/useAppColors";

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PADDING_ROWS = Math.floor(VISIBLE_ROWS / 2);
const WHEEL_PADDING = ITEM_HEIGHT * PADDING_ROWS;

type Props = {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  suffix?: string;
  width?: number;
};

function indexFromOffset(y: number, itemCount: number) {
  return Math.max(0, Math.min(itemCount - 1, Math.round(y / ITEM_HEIGHT)));
}

export function WheelPickerColumn({ items, selectedIndex, onSelect, suffix, width = 72 }: Props) {
  const c = useAppColors();
  const listRef = useRef<FlatList<string>>(null);
  const selectedRef = useRef(selectedIndex);
  const draggingRef = useRef(false);
  const settlingRef = useRef(false);
  const lastSettleMs = useRef(0);

  selectedRef.current = selectedIndex;

  const snapOffsets = useMemo(() => items.map((_, i) => i * ITEM_HEIGHT), [items.length]);

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      const clamped = indexFromOffset(index * ITEM_HEIGHT, items.length);
      listRef.current?.scrollToOffset({ offset: clamped * ITEM_HEIGHT, animated });
    },
    [items.length]
  );

  /** External value changes (modal opened) — do not fight an in-progress drag. */
  useEffect(() => {
    if (draggingRef.current || settlingRef.current) {
      return;
    }
    const frame = requestAnimationFrame(() => scrollToIndex(selectedIndex, false));
    return () => cancelAnimationFrame(frame);
  }, [selectedIndex, scrollToIndex]);

  const settleAtOffset = useCallback(
    (y: number) => {
      const now = Date.now();
      if (now - lastSettleMs.current < 80) {
        return;
      }
      lastSettleMs.current = now;

      const index = indexFromOffset(y, items.length);
      settlingRef.current = true;
      scrollToIndex(index, true);
      if (index !== selectedRef.current) {
        onSelect(index);
      }
      requestAnimationFrame(() => {
        settlingRef.current = false;
        draggingRef.current = false;
      });
    },
    [items.length, onSelect, scrollToIndex]
  );

  const onScrollBeginDrag = useCallback(() => {
    draggingRef.current = true;
    settlingRef.current = false;
  }, []);

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const velocityY = event.nativeEvent.velocity?.y ?? 0;
      if (Math.abs(velocityY) < 0.05) {
        settleAtOffset(event.nativeEvent.contentOffset.y);
      }
    },
    [settleAtOffset]
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      settleAtOffset(event.nativeEvent.contentOffset.y);
    },
    [settleAtOffset]
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<string>) => {
      const selected = index === selectedIndex;
      return (
        <View style={styles.item}>
          <Text
            style={[
              styles.itemText,
              { color: c.text, opacity: selected ? 1 : 0.45 },
              selected && styles.itemTextSelected,
            ]}
          >
            {item}
            {suffix ?? ""}
          </Text>
        </View>
      );
    },
    [selectedIndex, suffix, c.text]
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<string> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT,
      offset: WHEEL_PADDING + ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  return (
    <View style={[styles.column, { width }]}>
      <View
        style={[styles.highlight, { backgroundColor: c.surfaceTint, borderColor: c.border }]}
        pointerEvents="none"
      />
      <FlatList
        ref={listRef}
        style={styles.list}
        data={items}
        keyExtractor={(item, index) => `${index}-${item}`}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        extraData={selectedIndex}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        overScrollMode="never"
        bounces={false}
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        decelerationRate={Platform.OS === "ios" ? 0.992 : "fast"}
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onLayout={() => {
          if (!draggingRef.current) {
            scrollToIndex(selectedRef.current, false);
          }
        }}
        contentContainerStyle={styles.listContent}
        initialNumToRender={Math.min(items.length, 24)}
        maxToRenderPerBatch={16}
        windowSize={7}
      />
    </View>
  );
}

export const WHEEL_ITEM_HEIGHT = ITEM_HEIGHT;
export const WHEEL_VISIBLE_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;

const styles = StyleSheet.create({
  column: {
    height: WHEEL_VISIBLE_HEIGHT,
    overflow: "hidden",
  },
  list: {
    flex: 1,
    zIndex: 2,
  },
  listContent: {
    paddingVertical: WHEEL_PADDING,
  },
  highlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: WHEEL_PADDING,
    height: ITEM_HEIGHT,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    fontSize: 20,
    fontWeight: "500",
    lineHeight: 24,
  },
  itemTextSelected: {
    fontWeight: "800",
  },
});
