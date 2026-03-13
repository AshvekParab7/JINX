/**
 * BottomTabBar — animated, blurred glass tab bar
 * Drop into any screen that should display the tab navigation.
 *
 * Usage:
 *   import BottomTabBar from '../src/components/BottomTabBar';
 *   // ... inside your screen JSX, at the very bottom (outside ScrollView):
 *   <BottomTabBar active="dashboard" />
 *
 * active values: "dashboard" | "mental-health" | "HealthDetectionScreen" | "FallDetectionScreen"
 */

import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = [
    {
        key: 'dashboard',
        label: 'Home',
        route: '/dashboard',
        icon: 'home',
        iconActive: 'home',
        accentColor: '#ff6b9d',
    },
    {
        key: 'mental-health',
        label: 'Mind',
        route: '/mental-health',
        icon: 'heart-outline',
        iconActive: 'heart',
        accentColor: '#c77dff',
    },
    {
        key: 'HealthDetectionScreen',
        label: 'Scan',
        route: '/HealthDetectionScreen',
        icon: 'scan-outline',
        iconActive: 'scan',
        accentColor: '#38bdf8',
    },
    {
        key: 'FallDetectionScreen',
        label: 'Safety',
        route: '/FallDetectionScreen',
        icon: 'walk-outline',
        iconActive: 'walk',
        accentColor: '#ff9f43',
    },
];

// ── Single Tab Item ───────────────────────────────────────────────────────────
function TabItem({ tab, isActive, onPress }) {
    // Scale animation for the icon when active
    const scale = useRef(new Animated.Value(isActive ? 1.1 : 1)).current;
    // Vertical "float" anim for active indicator dot
    const dotOp = useRef(new Animated.Value(isActive ? 1 : 0)).current;
    // Y‑shift for active icon
    const translateY = useRef(new Animated.Value(isActive ? -3 : 0)).current;
    // Active pill background opacity
    const pillOp = useRef(new Animated.Value(isActive ? 1 : 0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scale, {
                toValue: isActive ? 1.18 : 1,
                friction: 6,
                tension: 120,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: isActive ? -4 : 0,
                duration: 250,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(dotOp, {
                toValue: isActive ? 1 : 0,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(pillOp, {
                toValue: isActive ? 1 : 0,
                duration: 220,
                useNativeDriver: true,
            }),
        ]).start();
    }, [isActive]);

    return (
        <Pressable
            style={styles.tabItem}
            onPress={onPress}
            android_ripple={null}
        >
            {/* Active pill glow */}
            <Animated.View
                style={[
                    styles.activePill,
                    { backgroundColor: `${tab.accentColor}18`, opacity: pillOp },
                ]}
            />

            {/* Icon + Label */}
            <Animated.View
                style={{ alignItems: 'center', transform: [{ scale }, { translateY }] }}
            >
                <Ionicons
                    name={isActive ? tab.iconActive : tab.icon}
                    size={21}
                    color={isActive ? tab.accentColor : 'rgba(255,220,235,0.45)'}
                />
                <Text
                    style={[
                        styles.tabLabel,
                        { color: isActive ? tab.accentColor : 'rgba(255,220,235,0.45)' },
                        isActive && styles.tabLabelActive,
                    ]}
                >
                    {tab.label}
                </Text>
            </Animated.View>

            {/* Dot indicator */}
            <Animated.View
                style={[
                    styles.activeDot,
                    { backgroundColor: tab.accentColor, opacity: dotOp },
                ]}
            />
        </Pressable>
    );
}

// ── Main Tab Bar ──────────────────────────────────────────────────────────────
export default function BottomTabBar({ active }) {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Entrance slide-up animation
    const slideY = useRef(new Animated.Value(100)).current;
    const barOp = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(slideY, {
                toValue: 0,
                friction: 8,
                tension: 80,
                useNativeDriver: true,
            }),
            Animated.timing(barOp, {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    paddingBottom: Math.max(insets.bottom, 6),
                    transform: [{ translateY: slideY }],
                    opacity: barOp,
                },
            ]}
        >
            {/* Glass blur backdrop */}
            <View style={styles.glassLayer} />

            {/* Top accent line */}
            <View style={styles.topBorder} />

            {/* Tabs */}
            <View style={styles.tabRow}>
                {TABS.map((tab) => (
                    <TabItem
                        key={tab.key}
                        tab={tab}
                        isActive={active === tab.key}
                        onPress={() => {
                            if (active !== tab.key) {
                                router.push(tab.route);
                            }
                        }}
                    />
                ))}
            </View>
        </Animated.View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
    },
    glassLayer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(14, 9, 36, 0.88)',
        // On Android there's no blur, so we use a solid semi-opaque fill.
        // On iOS, wrap in BlurView from expo-blur if you want native blur.
    },
    topBorder: {
        height: 1,
        backgroundColor: 'rgba(255, 100, 160, 0.18)',
        marginHorizontal: 0,
    },
    tabRow: {
        flexDirection: 'row',
        paddingTop: 6,
        paddingHorizontal: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        position: 'relative',
        minHeight: 44,
    },
    activePill: {
        position: 'absolute',
        top: 0,
        left: 6,
        right: 6,
        bottom: 8,
        borderRadius: 14,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '700',
        marginTop: 4,
        letterSpacing: 0.3,
    },
    tabLabelActive: {
        fontWeight: '900',
    },
    activeDot: {
        position: 'absolute',
        bottom: 2,
        width: 5,
        height: 5,
        borderRadius: 3,
    },
});
