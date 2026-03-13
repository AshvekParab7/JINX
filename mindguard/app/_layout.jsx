import React, { useEffect } from "react";
import { AppState } from "react-native";
import { Stack } from "expo-router";
import GlobalFallAlert from "../src/components/GlobalFallAlert";

import {
  ensurePersistentMonitoring,
  flushPendingFallEvents,
  hydrateFallMonitor,
} from "../src/components/services/fallMonitor";

export default function RootLayout() {
  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      await hydrateFallMonitor();
      if (!mounted) {
        return;
      }
      await ensurePersistentMonitoring();
      await flushPendingFallEvents();
    };

    void bootstrap();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void hydrateFallMonitor();
        void ensurePersistentMonitoring();
        void flushPendingFallEvents();
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return (
    <>
    <GlobalFallAlert />
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="accounts" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="alerts" />
      <Stack.Screen name="accessibility" />
      <Stack.Screen name="mental-health" />
      <Stack.Screen name="HealthDetectionScreen" />
      <Stack.Screen name="FallDetectionScreen" />
      <Stack.Screen name="HealthReportScreen" />
    </Stack>
    </>
  );
}
