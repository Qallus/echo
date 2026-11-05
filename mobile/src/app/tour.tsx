import { useRef, useState } from "react";
import { router } from "expo-router";
import { ScrollView, Text, View, useWindowDimensions, type ScrollViewInstance } from "react-native";
import { Body, Button, Screen, Title } from "@/components/ui";
import { TOUR } from "@/components/tour-scenes";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

// The feature tour: swipe or tap Next through six cards. Opens after setup,
// from the welcome screen, and from Settings → Feature tour.
export default function Tour() {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollViewInstance>(null);
  const [at, setAt] = useState(0);
  const last = at === TOUR.length - 1;
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const go = (i: number) => { pager.current?.scrollTo({ x: i * width, animated: true }); setAt(i); };

  return (
    <Screen scroll={false} style={{ paddingHorizontal: 0 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.five }}>
        <Text style={{ color: c.textSecondary, fontSize: 13 }}>{at + 1} of {TOUR.length}</Text>
        <Button title="Skip" variant="ghost" onPress={close} />
      </View>
      <ScrollView
        ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ flex: 1 }}
        onMomentumScrollEnd={(e) => setAt(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {TOUR.map(({ title, text, Scene }, i) => (
          <View key={title} style={{ width, paddingHorizontal: Spacing.five, gap: Spacing.four }} accessibilityLabel={`${title}. ${text}`}>
            <View style={{ height: 280, borderWidth: 1, borderColor: c.border, borderRadius: Radius.large, padding: Spacing.four, backgroundColor: c.card }}>
              <Scene key={i === at ? "active" : "idle"} active={i === at} />
            </View>
            <Title>{title}</Title>
            <Body muted>{text}</Body>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }} accessibilityElementsHidden>
        {TOUR.map((t, i) => <View key={t.title} style={{ width: i === at ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === at ? c.primary : c.border }} />)}
      </View>
      <View style={{ paddingHorizontal: Spacing.five }}>
        <Button title={last ? "Done" : "Next"} onPress={() => (last ? close() : go(at + 1))} />
      </View>
    </Screen>
  );
}
