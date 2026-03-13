//Updated
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { fetchFallIncidents, getStoredUser, logoutUser } from '../src/components/services/api';
import { COLORS, SHADOWS } from '../src/theme';
import BottomTabBar from '../src/components/BottomTabBar';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Static mock wellness data (augment with real data when backend is ready) ───────────────────
const WEEKLY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKLY_STRESS = [0.62, 0.48, 0.71, 0.55, 0.38, 0.82, 0.44]; // 0-1 scale
const WEEKLY_MOOD = [0.55, 0.70, 0.45, 0.60, 0.78, 0.40, 0.65]; // 0-1 scale

const MODULE_CARDS = [
    {
        label: 'Mental Health',
        sub: 'AI Chat + Voice Companion',
        route: '/mental-health',
        icon: 'heart',
        accentColor: '#ff6b9d',
        accentBg: 'rgba(255, 107, 157, 0.14)',
    },
    {
        label: 'Health Scanner',
        sub: 'Skin & Retina AI Triage',
        route: '/HealthDetectionScreen',
        icon: 'scan-circle',
        accentColor: '#c77dff',
        accentBg: 'rgba(199, 125, 255, 0.14)',
    },
    {
        label: 'Fall Detection',
        sub: 'ESP32 Wearable Monitor',
        route: '/FallDetectionScreen',
        icon: 'walk',
        accentColor: '#ff9f43',
        accentBg: 'rgba(255, 159, 67, 0.14)',
    },
];

const STRESS_LEVELS = [
    { label: 'Low', color: '#4ade80', range: [0, 0.33] },
    { label: 'Moderate', color: '#fbbf24', range: [0.33, 0.6] },
    { label: 'High', color: '#fb923c', range: [0.6, 0.8] },
    { label: 'Crisis', color: '#fb7185', range: [0.8, 1] },
];

function getStressMeta(score) {
    return STRESS_LEVELS.find(s => score >= s.range[0] && score < s.range[1]) || STRESS_LEVELS[3];
}

// ─── Animated Bar Chart ──────────────────────────────────────────────────────────────────────────
function BarChart({ data, labels, color, height = 100 }) {
    const anims = useRef(data.map(() => new Animated.Value(0))).current;

    useEffect(() => {
        const animations = anims.map((anim, i) =>
            Animated.timing(anim, {
                toValue: data[i],
                duration: 800 + i * 80,
                delay: i * 60,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            })
        );
        Animated.stagger(50, animations).start();
    }, []);

    return (
        <View style={chartStyles.wrapper}>
            <View style={[chartStyles.barRow, { height }]}>
                {data.map((value, i) => {
                    const barH = anims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                    });
                    return (
                        <View key={i} style={chartStyles.barCol}>
                            <View style={chartStyles.barBg}>
                                <Animated.View
                                    style={[
                                        chartStyles.bar,
                                        {
                                            height: barH,
                                            backgroundColor: color,
                                            shadowColor: color,
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={chartStyles.barLabel}>{labels[i]}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const chartStyles = StyleSheet.create({
    wrapper: { marginTop: 8 },
    barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 8 },
    barCol: { flex: 1, alignItems: 'center' },
    barBg: {
        flex: 1,
        width: '100%',
        justifyContent: 'flex-end',
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
    },
    bar: {
        width: '100%',
        borderRadius: 6,
        shadowOpacity: 0.55,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 4,
    },
    barLabel: { fontSize: 9, color: COLORS.textMuted, marginTop: 6, fontWeight: '700' },
});

// ─── Pulse Dot ──────────────────────────────────────────────────────────────────────────────────
function PulseDot({ color }) {
    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.8, duration: 900, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <View style={{ position: 'relative', width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
                style={{
                    position: 'absolute',
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: color,
                    opacity: 0.3,
                    transform: [{ scale: pulse }],
                }}
            />
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        </View>
    );
}

// ─── Stress Gauge ────────────────────────────────────────────────────────────────────────────────
function StressGauge({ score }) {
    const anim = useRef(new Animated.Value(0)).current;
    const meta = getStressMeta(score);

    useEffect(() => {
        Animated.timing(anim, {
            toValue: score,
            duration: 1200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [score]);

    const barW = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

    return (
        <View style={gaugeStyles.wrap}>
            <View style={gaugeStyles.row}>
                <Text style={gaugeStyles.label}>Stress Index</Text>
                <View style={[gaugeStyles.badge, { backgroundColor: `${meta.color}22` }]}>
                    <Text style={[gaugeStyles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
            </View>
            <View style={gaugeStyles.track}>
                <Animated.View
                    style={[
                        gaugeStyles.fill,
                        { width: barW, backgroundColor: meta.color, shadowColor: meta.color },
                    ]}
                />
                {/* Segment markers */}
                {[0.33, 0.6, 0.8].map((p, i) => (
                    <View
                        key={i}
                        style={[gaugeStyles.marker, { left: `${p * 100}%` }]}
                    />
                ))}
            </View>
            <View style={gaugeStyles.scaleRow}>
                {STRESS_LEVELS.map((level) => (
                    <Text key={level.label} style={[gaugeStyles.scaleLabel, { color: level.color }]}>
                        {level.label}
                    </Text>
                ))}
            </View>
        </View>
    );
}

const gaugeStyles = StyleSheet.create({
    wrap: { marginVertical: 4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
    badgeText: { fontSize: 11, fontWeight: '800' },
    track: {
        height: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 99,
        overflow: 'hidden',
        position: 'relative',
    },
    fill: {
        height: '100%',
        borderRadius: 99,
        shadowOpacity: 0.8,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 4,
    },
    marker: {
        position: 'absolute',
        top: 0,
        width: 2,
        height: '100%',
        backgroundColor: 'rgba(20,15,45,0.6)',
    },
    scaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    scaleLabel: { fontSize: 9, fontWeight: '700' },
});

// ─── Stat Card ───────────────────────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, sub }) {
    const scale = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    }, []);
    return (
        <Animated.View style={[statStyles.card, { transform: [{ scale }] }]}>
            <View style={[statStyles.icon, { backgroundColor: `${color}1a` }]}>
                <Ionicons name={icon} size={18} color={color} />
            </View>
            <Text style={[statStyles.value, { color }]}>{value}</Text>
            <Text style={statStyles.label}>{label}</Text>
            {sub ? <Text style={statStyles.sub}>{sub}</Text> : null}
        </Animated.View>
    );
}

const statStyles = StyleSheet.create({
    card: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        gap: 6,
    },
    icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    value: { fontSize: 22, fontWeight: '900' },
    label: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', textAlign: 'center', letterSpacing: 0.4 },
    sub: { color: COLORS.textSecondary, fontSize: 9, textAlign: 'center' },
});

// ─── Module Card ─────────────────────────────────────────────────────────────────────────────────
function ModuleCard({ card, isConnected, onPress }) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePress = () => {
        Animated.sequence([
            Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
        ]).start();
        onPress();
    };

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable style={moduleStyles.card} onPress={handlePress}>
                <View style={[moduleStyles.iconBox, { backgroundColor: card.accentBg }]}>
                    <Ionicons name={card.icon} size={26} color={card.accentColor} />
                </View>
                <View style={moduleStyles.info}>
                    <Text style={moduleStyles.name}>{card.label}</Text>
                    <Text style={moduleStyles.sub}>{card.sub}</Text>
                </View>
                <View style={moduleStyles.right}>
                    <PulseDot color={isConnected ? card.accentColor : COLORS.textMuted} />
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} style={{ marginTop: 6 }} />
                </View>
            </Pressable>
        </Animated.View>
    );
}

const moduleStyles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.glass,
        borderRadius: 22,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 14,
        ...SHADOWS.glass,
    },
    iconBox: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    info: { flex: 1 },
    name: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
    sub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
    right: { alignItems: 'center', gap: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
    const router = useRouter();
    const [stats, setStats] = useState({ connected: false, loading: true, recentFalls: [] });
    const [user, setUser] = useState(null);

    // We derive a synthetic stress score from the latest fall data for demo purposes
    // In production this should come from the mental health / voice analysis backend.
    const latestStress = stats.recentFalls.length > 0
        ? Math.min(1, stats.recentFalls.length * 0.28)
        : 0.38;

    const todayMood = 0.65; // Placeholder – replace with real session_risk from API

    // Entrance animation
    const headerY = useRef(new Animated.Value(-30)).current;
    const headerOp = useRef(new Animated.Value(0)).current;
    const contentOp = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(headerY, { toValue: 0, duration: 600, useNativeDriver: true }),
            Animated.timing(headerOp, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(contentOp, { toValue: 1, duration: 900, delay: 200, useNativeDriver: true }),
        ]).start();
    }, []);

    const handleLogout = async () => {
        await logoutUser();
        router.replace('/accounts');
    };

    useEffect(() => {
        let mounted = true;

        async function fetchStatus() {
            try {
                const [incidents, storedUser] = await Promise.all([
                    fetchFallIncidents(),
                    getStoredUser(),
                ]);
                if (storedUser && mounted) setUser(storedUser);
                if (!incidents?.error && Array.isArray(incidents)) {
                    if (mounted) setStats({ connected: true, loading: false, recentFalls: incidents.slice(0, 5) });
                } else {
                    if (mounted) setStats({ connected: false, loading: false, recentFalls: [] });
                }
            } catch {
                if (mounted) setStats({ connected: false, loading: false, recentFalls: [] });
            }
        }

        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => { mounted = false; clearInterval(interval); };
    }, []);

    const stressMeta = getStressMeta(latestStress);
    const todayMoodMeta = getStressMeta(1 - todayMood); // invert for mood (higher = better)

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

                {/* ── Ambient blobs ── */}
                <View style={[styles.blob, styles.blobTopRight]} />
                <View style={[styles.blob, styles.blobMidLeft]} />
                <View style={[styles.blob, styles.blobBottomRight]} />

                {/* ── HEADER ── */}
                <Animated.View style={[styles.header, { opacity: headerOp, transform: [{ translateY: headerY }] }]}>
                    <View>
                        <Text style={styles.eyebrow}>MINDGUARD</Text>
                        <Text style={styles.title}>
                            Welcome back{user?.name ? ',' : ''}
                        </Text>
                        {user?.name ? (
                            <Text style={styles.titleName}>{user.name} 👋</Text>
                        ) : null}
                    </View>
                    <View style={styles.headerRight}>
                        {/* Live backend badge */}
                        <View style={[
                            styles.statusBadge,
                            { backgroundColor: stats.connected ? 'rgba(86,243,154,0.12)' : 'rgba(255,107,136,0.12)' },
                        ]}>
                            <PulseDot color={stats.connected ? COLORS.success : COLORS.danger} />
                            <Text style={[styles.statusText, { color: stats.connected ? COLORS.success : COLORS.danger }]}>
                                {stats.loading ? '...' : stats.connected ? 'Live' : 'Offline'}
                            </Text>
                        </View>
                        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
                            <Ionicons name="log-out-outline" size={22} color="#ffb3c6" />
                        </Pressable>
                    </View>
                </Animated.View>

                <Animated.View style={{ opacity: contentOp }}>

                    {/* ── QUICK STATS ROW ── */}
                    <Text style={styles.sectionTitle}>TODAY'S SNAPSHOT</Text>
                    <View style={styles.statsRow}>
                        <StatCard
                            icon="pulse"
                            label="STRESS"
                            value={`${Math.round(latestStress * 100)}%`}
                            color={stressMeta.color}
                            sub={stressMeta.label}
                        />
                        <StatCard
                            icon="happy"
                            label="MOOD"
                            value={`${Math.round(todayMood * 100)}%`}
                            color="#c77dff"
                            sub="Positive"
                        />
                        <StatCard
                            icon="warning"
                            label="FALLS"
                            value={stats.loading ? '—' : String(stats.recentFalls.length)}
                            color={stats.recentFalls.length > 0 ? COLORS.danger : COLORS.success}
                            sub="Today"
                        />
                        <StatCard
                            icon="wifi"
                            label="STATUS"
                            value={stats.loading ? '—' : stats.connected ? 'ON' : 'OFF'}
                            color={stats.connected ? COLORS.success : COLORS.danger}
                            sub="Backend"
                        />
                    </View>

                    {/* ── STRESS GAUGE ── */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="analytics" size={18} color="#ffb3c6" />
                            <Text style={styles.cardTitle}>STRESS LEVEL MONITOR</Text>
                        </View>
                        <StressGauge score={latestStress} />
                        <Text style={styles.stressNote}>
                            Based on recent fall incident count and voice session data. Updates every 5s.
                        </Text>
                    </View>

                    {/* ── WEEKLY CHARTS ── */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="bar-chart" size={18} color="#c77dff" />
                            <Text style={styles.cardTitle}>WEEKLY WELLNESS TRENDS</Text>
                        </View>
                        <View style={styles.chartTabs}>
                            <View style={styles.chartLegendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#ff6b9d' }]} />
                                <Text style={styles.legendLabel}>Stress Score</Text>
                            </View>
                            <View style={styles.chartLegendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#c77dff' }]} />
                                <Text style={styles.legendLabel}>Mood Score</Text>
                            </View>
                        </View>
                        <Text style={styles.chartSubLabel}>Stress (7-day)</Text>
                        <BarChart data={WEEKLY_STRESS} labels={WEEKLY_LABELS} color="#ff6b9d" height={90} />
                        <View style={styles.chartDivider} />
                        <Text style={[styles.chartSubLabel, { marginTop: 12 }]}>Mood (7-day)</Text>
                        <BarChart data={WEEKLY_MOOD} labels={WEEKLY_LABELS} color="#c77dff" height={70} />
                    </View>

                    {/* ── MODULE CARDS ── */}
                    <Text style={styles.sectionTitle}>CARE MODULES</Text>
                    <View style={styles.moduleList}>
                        {MODULE_CARDS.map((card) => (
                            <ModuleCard
                                key={card.route}
                                card={card}
                                isConnected={stats.connected}
                                onPress={() => router.push(card.route)}
                            />
                        ))}
                    </View>

                    {/* ── LIVE BACKEND STATUS DETAIL ── */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="server" size={18} color={stats.connected ? COLORS.success : COLORS.danger} />
                            <Text style={styles.cardTitle}>LIVE BACKEND STATUS</Text>
                        </View>
                        <View style={styles.backendGrid}>
                            {[
                                { label: 'Fall Detection API', ok: stats.connected },
                                { label: 'Mental Health AI', ok: stats.connected },
                                { label: 'Skin Scanner Model', ok: stats.connected },
                                { label: 'Voice Analysis', ok: stats.connected },
                                { label: 'SMS Alerts', ok: stats.connected },
                                { label: 'Session Storage', ok: stats.connected },
                            ].map((svc) => (
                                <View key={svc.label} style={styles.backendRow}>
                                    <PulseDot color={svc.ok ? COLORS.success : COLORS.danger} />
                                    <Text style={styles.backendLabel}>{svc.label}</Text>
                                    <Text style={[styles.backendStatus, { color: svc.ok ? COLORS.success : COLORS.danger }]}>
                                        {svc.ok ? 'Online' : 'Offline'}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* ── RECENT EMERGENCY ALERTS ── */}
                    <Text style={styles.sectionTitle}>RECENT ALERTS</Text>
                    <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
                        {stats.loading ? (
                            <ActivityIndicator color={COLORS.textPrimary} style={{ padding: 24 }} />
                        ) : !stats.connected ? (
                            <View style={styles.emptyBox}>
                                <Ionicons name="cloud-offline-outline" size={36} color={COLORS.textMuted} />
                                <Text style={styles.emptyText}>Cannot reach backend to load alerts.</Text>
                            </View>
                        ) : stats.recentFalls.length === 0 ? (
                            <View style={styles.emptyBox}>
                                <Ionicons name="shield-checkmark-outline" size={36} color={COLORS.success} />
                                <Text style={[styles.emptyText, { color: COLORS.success }]}>
                                    No falls detected today.{'\n'}All clear! 🎉
                                </Text>
                            </View>
                        ) : (
                            stats.recentFalls.map((event, index) => {
                                const isCrit = event.severity === 'Critical';
                                return (
                                    <View
                                        key={event.id}
                                        style={[
                                            styles.alertItem,
                                            index === stats.recentFalls.length - 1 && styles.alertItemLast,
                                        ]}
                                    >
                                        <View style={[styles.alertIconArea, isCrit && styles.alertIconAreaCrit]}>
                                            <Ionicons
                                                name={isCrit ? 'warning' : 'alert-circle'}
                                                size={20}
                                                color={isCrit ? COLORS.danger : COLORS.warning}
                                            />
                                        </View>
                                        <View style={styles.alertInfo}>
                                            <Text style={styles.alertActivity}>{event.activity}</Text>
                                            <Text style={styles.alertMeta}>
                                                Source: {event.source} · Conf: {event.confidence}%
                                            </Text>
                                        </View>
                                        <View style={styles.alertRight}>
                                            <View style={[
                                                styles.severityBadge,
                                                { backgroundColor: isCrit ? 'rgba(255,107,136,0.18)' : 'rgba(255,180,87,0.15)' },
                                            ]}>
                                                <Text style={[styles.severityText, { color: isCrit ? COLORS.danger : COLORS.warning }]}>
                                                    {event.severity}
                                                </Text>
                                            </View>
                                            <Text style={styles.alertTime}>
                                                {new Date(event.timestamp).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>

                    {/* ── FOOTER ── */}
                    <View style={styles.footer}>
                        <Ionicons name="shield-checkmark" size={16} color="rgba(255,179,198,0.5)" />
                        <Text style={styles.footerText}>MINDGUARD · Continuous care in one place</Text>
                    </View>
                </Animated.View>
            </ScrollView>
            <BottomTabBar active="dashboard" />
        </SafeAreaView>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.midnightViolet },
    container: { paddingHorizontal: 18, paddingBottom: 110, backgroundColor: COLORS.midnightViolet },

    // Blobs
    blob: { position: 'absolute', borderRadius: 999 },
    blobTopRight: {
        width: 300, height: 300, top: -100, right: -80,
        backgroundColor: 'rgba(193,18,79,0.22)',
    },
    blobMidLeft: {
        width: 220, height: 220, top: 400, left: -100,
        backgroundColor: 'rgba(110,56,176,0.16)',
    },
    blobBottomRight: {
        width: 260, height: 260, bottom: 100, right: -80,
        backgroundColor: 'rgba(193,18,79,0.12)',
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingTop: 16,
        marginBottom: 24,
    },
    eyebrow: { color: '#ffb3c6', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
    title: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '900', lineHeight: 30 },
    titleName: { color: '#ffdde9', fontSize: 20, fontWeight: '800', marginTop: 2 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    statusText: { fontSize: 11, fontWeight: '800' },
    logoutBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,179,198,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Section titles
    sectionTitle: {
        color: '#ffb3c6',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.6,
        marginBottom: 14,
        marginTop: 8,
    },

    // Stats row
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },

    // Generic card
    card: {
        backgroundColor: COLORS.glass,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 18,
        ...SHADOWS.glass,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    cardTitle: { color: '#ffdde9', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
    stressNote: { color: COLORS.textMuted, fontSize: 11, marginTop: 10, lineHeight: 16 },

    // Chart
    chartTabs: { flexDirection: 'row', gap: 16, marginBottom: 12 },
    chartLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
    chartSubLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 4 },
    chartDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 4 },

    // Module list
    moduleList: { gap: 12, marginBottom: 20 },

    // Backend status
    backendGrid: { gap: 8 },
    backendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    backendLabel: { color: COLORS.textSecondary, fontSize: 13, flex: 1 },
    backendStatus: { fontSize: 12, fontWeight: '800' },

    // Alert list
    emptyBox: { alignItems: 'center', paddingVertical: 28, gap: 10 },
    emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
    alertItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.07)',
    },
    alertItemLast: { borderBottomWidth: 0 },
    alertIconArea: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,180,87,0.14)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    alertIconAreaCrit: { backgroundColor: 'rgba(255,107,136,0.18)' },
    alertInfo: { flex: 1 },
    alertActivity: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },
    alertMeta: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
    alertRight: { alignItems: 'flex-end', gap: 4 },
    severityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
    severityText: { fontSize: 10, fontWeight: '900' },
    alertTime: { color: '#ffb3c6', fontSize: 10, fontWeight: '700' },

    // Footer
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 12,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    footerText: { color: 'rgba(255,179,198,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
});