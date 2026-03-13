import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import {
  hasStoredAccounts,
  isAuthenticated,
} from "../src/components/services/api";
import { COLORS } from "../src/theme";

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const accountsExist = await hasStoredAccounts();
      const loggedIn = await isAuthenticated();
      if (!mounted) {
        return;
      }

      setTimeout(() => {
        if (accountsExist) {
          router.replace("/accounts" as never);
          return;
        }

        router.replace(loggedIn ? "/dashboard" : "/login");
      }, 1200);
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />
      <Text style={styles.kicker}>JOIN NOW</Text>
      <Text style={styles.logo}>MindGuard</Text>
      <Text style={styles.tagline}>Your AI Health Companion</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.midnightViolet,
    overflow: "hidden",
  },
  kicker: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 6,
    marginBottom: 12,
  },
  logo: { fontSize: 44, fontWeight: "900", color: COLORS.textPrimary },
  tagline: { fontSize: 18, color: COLORS.textSecondary, marginTop: 10 },
  blob: {
    position: "absolute",
    borderRadius: 999,
  },
  blobTop: {
    width: 340,
    height: 340,
    top: -120,
    right: -40,
    backgroundColor: COLORS.rubyGlow,
  },
  blobBottom: {
    width: 280,
    height: 280,
    bottom: -110,
    left: -80,
    backgroundColor: "rgba(96, 63, 177, 0.18)",
  },
});
