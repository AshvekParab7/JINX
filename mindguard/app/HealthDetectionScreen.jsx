import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    Pressable,
    Animated,
    Easing,
    ScrollView,
    StatusBar,
    Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { uploadHealthImage } from '../src/components/services/api';
import { COLORS, SHADOWS } from '../src/theme';
import BottomTabBar from '../src/components/BottomTabBar';

const { width: SCREEN_W } = Dimensions.get('window');
const IMAGE_SIZE = SCREEN_W - 64;

// ── Scan type pills ──────────────────────────────────────────────────────────
const SCAN_MODES = [
    { key: 'skin', label: 'Skin', icon: 'body-outline' },
    { key: 'retina', label: 'Retina', icon: 'eye-outline' },
    { key: 'wound', label: 'Wound', icon: 'bandage-outline' },
];

// ── Confidence ring (pure Animated.View segments) ───────────────────────────
function ConfidenceRing({ pct = 0 }) {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(anim, {
            toValue: pct,
            duration: 1200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [pct]);

    const color = pct >= 80 ? '#4ade80' : pct >= 50 ? '#fbbf24' : '#fb7185';

    return (
        <View style={ringStyles.wrap}>
            {/* Track */}
            <View style={[ringStyles.ring, { borderColor: 'rgba(255,255,255,0.08)' }]} />
            {/* Filled arc — simulated with a colored thicker border on top+right */}
            <Animated.View
                style={[
                    ringStyles.ring,
                    ringStyles.fill,
                    {
                        borderColor: color,
                        borderTopColor: anim.interpolate({ inputRange: [0, 50, 100], outputRange: ['transparent', color, color] }),
                        borderRightColor: anim.interpolate({ inputRange: [0, 25, 100], outputRange: ['transparent', color, color] }),
                        shadowColor: color,
                    },
                ]}
            />
            <View style={ringStyles.center}>
                <Text style={[ringStyles.pctText, { color }]}>{pct}%</Text>
                <Text style={ringStyles.pctLabel}>confidence</Text>
            </View>
        </View>
    );
}

const ringStyles = StyleSheet.create({
    wrap: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
    ring: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 8,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    fill: {
        borderBottomColor: 'transparent',
        borderLeftColor: 'transparent',
        shadowOpacity: 0.5,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
        elevation: 5,
    },
    center: { alignItems: 'center' },
    pctText: { fontSize: 22, fontWeight: '900' },
    pctLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,236,243,0.55)', marginTop: 2 },
});

// ── Animated scan line overlay ───────────────────────────────────────────────
function ScanOverlay({ active }) {
    const y = useRef(new Animated.Value(0)).current;
    const op = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (active) {
            op.setValue(1);
            Animated.loop(
                Animated.sequence([
                    Animated.timing(y, { toValue: IMAGE_SIZE - 4, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                    Animated.timing(y, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                ])
            ).start();
        } else {
            Animated.timing(op, { toValue: 0, duration: 300, useNativeDriver: true }).start();
            y.setValue(0);
        }
    }, [active]);

    if (!active) return null;

    return (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: op }]}>
            {/* Corner brackets */}
            <View style={[scanS.corner, scanS.tl]} /><View style={[scanS.corner, scanS.tr]} />
            <View style={[scanS.corner, scanS.bl]} /><View style={[scanS.corner, scanS.br]} />
            {/* Moving line */}
            <Animated.View style={[scanS.line, { transform: [{ translateY: y }] }]} />
            {/* Tint overlay */}
            <View style={scanS.tint} />
        </Animated.View>
    );
}

const ACCENT = '#38bdf8'; // sky blue for scanner
const scanS = StyleSheet.create({
    corner: { position: 'absolute', width: 26, height: 26, borderColor: ACCENT, borderWidth: 3 },
    tl: { top: 12, left: 12, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 6 },
    tr: { top: 12, right: 12, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 6 },
    bl: { bottom: 12, left: 12, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 6 },
    br: { bottom: 12, right: 12, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 6 },
    line: {
        position: 'absolute', left: 0, right: 0, height: 2,
        backgroundColor: ACCENT,
        shadowColor: ACCENT, shadowOpacity: 0.9, shadowRadius: 10, elevation: 6,
    },
    tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(56,189,248,0.06)' },
});

// ── Info row for result card ─────────────────────────────────────────────────
function InfoRow({ icon, label, value, accent }) {
    return (
        <View style={infoS.row}>
            <View style={[infoS.iconBox, { backgroundColor: `${accent}18` }]}>
                <Ionicons name={icon} size={16} color={accent} />
            </View>
            <View style={infoS.text}>
                <Text style={infoS.label}>{label}</Text>
                <Text style={infoS.value}>{value}</Text>
            </View>
        </View>
    );
}
const infoS = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
    iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    text: { flex: 1 },
    label: { color: 'rgba(255,236,243,0.5)', fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginBottom: 3 },
    value: { color: '#fff7fb', fontSize: 14, fontWeight: '600', lineHeight: 20 },
});

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function HealthDetectionScreen() {
    const router = useRouter();
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [scanMode, setScanMode] = useState('skin');

    // Animations
    const fadeAnim  = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;
    const headerOp  = useRef(new Animated.Value(0)).current;
    const headerY   = useRef(new Animated.Value(-20)).current;

    // Entrance
    useEffect(() => {
        Animated.parallel([
            Animated.timing(headerOp, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(headerY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
    }, []);

    // Result entrance
    useEffect(() => {
        if (result) {
            Animated.parallel([
                Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start();
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(40);
        }
    }, [result]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission Required', 'Gallery access is needed.'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
        });
        if (!res.canceled) { setImage(res.assets[0].uri); setResult(null); }
    };

    const openCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission Required', 'Camera access is needed.'); return; }
        const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 });
        if (!res.canceled) { setImage(res.assets[0].uri); setResult(null); }
    };

    const runAnalysis = async () => {
        if (!image) return;
        setLoading(true);
        setResult(null);
        try {
            const response = await uploadHealthImage(image);
            if (response?.error) throw new Error(response.error);
            setTimeout(() => { setResult(response); setLoading(false); }, 1200);
        } catch (error) {
            Alert.alert('Scan Failed', error.message || 'Health scanner is unreachable.');
            setLoading(false);
        }
    };

    const resetScan = () => { setImage(null); setResult(null); };

    const confidencePct = result
        ? Number(String(result.confidence ?? '0').replace('%', '')) || Math.round((result.confidence_score || 0) * 100)
        : 0;

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* ── Ambient blobs ── */}
                <View style={[styles.blob, styles.blobTR]} />
                <View style={[styles.blob, styles.blobBL]} />

                {/* ── HEADER ── */}
                <Animated.View style={[styles.header, { opacity: headerOp, transform: [{ translateY: headerY }] }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                        <Ionicons name="arrow-back" size={20} color="#ffb7c9" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerEyebrow}>AI DIAGNOSTICS</Text>
                        <Text style={styles.headerTitle}>Health Scanner</Text>
                    </View>
                    <TouchableOpacity onPress={resetScan} style={styles.iconBtn}>
                        <Ionicons name="refresh" size={20} color="#ffb7c9" />
                    </TouchableOpacity>
                </Animated.View>

                {/* ── SCAN MODE SELECTOR ── */}
                <View style={styles.modePillRow}>
                    {SCAN_MODES.map((m) => {
                        const active = scanMode === m.key;
                        return (
                            <Pressable
                                key={m.key}
                                style={[styles.modePill, active && styles.modePillActive]}
                                onPress={() => setScanMode(m.key)}
                            >
                                <Ionicons name={m.icon} size={14} color={active ? '#140f2d' : 'rgba(255,220,235,0.55)'} />
                                <Text style={[styles.modePillText, active && styles.modePillTextActive]}>
                                    {m.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* ── IMAGE UPLOAD ZONE ── */}
                <View style={styles.imageCard}>
                    {image ? (
                        <View style={styles.imageWrap}>
                            <Image source={{ uri: image }} style={styles.image} />
                            <ScanOverlay active={loading} />

                            {/* Overlay controls when not loading */}
                            {!loading && !result && (
                                <View style={styles.imageOverlayActions}>
                                    <TouchableOpacity style={styles.overlayBtn} onPress={pickImage}>
                                        <Ionicons name="images" size={16} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.overlayBtn} onPress={openCamera}>
                                        <Ionicons name="camera" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {loading && (
                                <View style={styles.analysisOverlay}>
                                    <ActivityIndicator size="large" color={ACCENT} />
                                    <Text style={styles.analysisLabel}>Analysing…</Text>
                                </View>
                            )}
                        </View>
                    ) : (
                        /* Empty state */
                        <TouchableOpacity style={styles.emptyZone} onPress={pickImage} activeOpacity={0.7}>
                            <View style={styles.emptyIconRing}>
                                <Ionicons name="scan-circle-outline" size={52} color={ACCENT} />
                            </View>
                            <Text style={styles.emptyTitle}>Upload a photo to begin</Text>
                            <Text style={styles.emptyHint}>Skin · Retina · Wound</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── ACTION BUTTONS ── */}
                {!result && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.actionBtn} onPress={openCamera}>
                            <View style={styles.actionBtnIcon}>
                                <Ionicons name="camera-outline" size={22} color={ACCENT} />
                            </View>
                            <Text style={styles.actionBtnLabel}>Camera</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionBtn} onPress={pickImage}>
                            <View style={styles.actionBtnIcon}>
                                <Ionicons name="images-outline" size={22} color="#c77dff" />
                            </View>
                            <Text style={styles.actionBtnLabel}>Gallery</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtnPrimary, (!image || loading) && styles.btnDisabled]}
                            onPress={runAnalysis}
                            disabled={!image || loading}
                        >
                            {loading
                                ? <ActivityIndicator size="small" color="#140f2d" />
                                : <>
                                    <Ionicons name="analytics-outline" size={20} color="#140f2d" />
                                    <Text style={styles.actionBtnPrimaryLabel}>Analyse</Text>
                                  </>
                            }
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── RESULTS CARD ── */}
                {result && (
                    <Animated.View
                        style={[styles.resultCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
                    >
                        {/* Header */}
                        <View style={styles.resultHeader}>
                            <View>
                                <Text style={styles.resultEyebrow}>ANALYSIS REPORT</Text>
                                <Text style={styles.resultCondition}>{result.condition || 'Healthy'}</Text>
                                <View style={styles.resultMetaRow}>
                                    <View style={styles.metaPill}>
                                        <Text style={styles.metaPillText}>
                                            {(result.scan_type || scanMode).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={[styles.metaPill, { borderColor: 'rgba(56,189,248,0.4)' }]}>
                                        <Text style={[styles.metaPillText, { color: ACCENT }]}>
                                            {result.analysis_source === 'backend_model' ? 'AI MODEL' : 'SCREENING'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <ConfidenceRing pct={confidencePct} />
                        </View>

                        <View style={styles.divider} />

                        {/* Info rows */}
                        <InfoRow
                            icon="eye-outline"
                            label="DETECTED PATTERN"
                            value={result.detected_pattern || 'No distinct visual pattern was highlighted.'}
                            accent="#c77dff"
                        />
                        <InfoRow
                            icon="arrow-forward-circle-outline"
                            label="RECOMMENDED NEXT STEP"
                            value={result.advice || 'No immediate action required. Monitor for changes.'}
                            accent="#38bdf8"
                        />
                        {!!result.summary && (
                            <InfoRow
                                icon="document-text-outline"
                                label="SUMMARY"
                                value={result.summary}
                                accent="#ff9f43"
                            />
                        )}
                        {!!result.limitations && (
                            <Text style={styles.limitText}>{result.limitations}</Text>
                        )}

                        <View style={styles.divider} />

                        {/* New scan */}
                        <TouchableOpacity style={styles.newScanBtn} onPress={resetScan}>
                            <Ionicons name="refresh-circle-outline" size={20} color="#ffb7c9" />
                            <Text style={styles.newScanText}>Start New Scan</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* ── TIPS (shown when no image) ── */}
                {!image && !result && (
                    <View style={styles.tipsCard}>
                        <Text style={styles.tipsTitle}>FOR BEST RESULTS</Text>
                        {[
                            { icon: 'sunny-outline', tip: 'Use bright, natural lighting' },
                            { icon: 'expand-outline', tip: 'Keep the area in focus and centred' },
                            { icon: 'close-circle-outline', tip: 'Avoid flash glare or shadows' },
                        ].map((t) => (
                            <View key={t.tip} style={styles.tipRow}>
                                <Ionicons name={t.icon} size={16} color="#ffb3c6" />
                                <Text style={styles.tipText}>{t.tip}</Text>
                            </View>
                        ))}
                    </View>
                )}

            </ScrollView>
            <BottomTabBar active="HealthDetectionScreen" />
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.midnightViolet },
    scroll: { paddingHorizontal: 20, paddingBottom: 120 },

    // Blobs
    blob: { position: 'absolute', borderRadius: 999 },
    blobTR: { width: 260, height: 260, top: -100, right: -80, backgroundColor: 'rgba(56,189,248,0.12)' },
    blobBL: { width: 220, height: 220, bottom: 200, left: -90, backgroundColor: 'rgba(110,56,176,0.14)' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 18,
        marginBottom: 24,
    },
    headerCenter: { alignItems: 'center', flex: 1 },
    headerEyebrow: { color: ACCENT, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
    headerTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '900' },
    iconBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: COLORS.glass, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: COLORS.border,
    },

    // Scan mode pills
    modePillRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    modePill: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 10, borderRadius: 14,
        backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.border,
    },
    modePillActive: { backgroundColor: ACCENT, borderColor: ACCENT },
    modePillText: { fontSize: 13, fontWeight: '800', color: 'rgba(255,220,235,0.65)' },
    modePillTextActive: { color: '#140f2d' },

    // Image card
    imageCard: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        alignSelf: 'center',
        borderRadius: 26,
        overflow: 'hidden',
        backgroundColor: 'rgba(8,5,22,0.7)',
        borderWidth: 1.5,
        borderColor: COLORS.border,
        marginBottom: 20,
        ...SHADOWS.glass,
    },
    imageWrap: { width: '100%', height: '100%' },
    image: { width: '100%', height: '100%', resizeMode: 'cover' },
    imageOverlayActions: {
        position: 'absolute', bottom: 14, right: 14,
        flexDirection: 'row', gap: 10,
    },
    overlayBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    analysisOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10,6,28,0.65)',
        alignItems: 'center', justifyContent: 'center', gap: 12,
    },
    analysisLabel: { color: ACCENT, fontWeight: '800', fontSize: 15 },

    // Empty state
    emptyZone: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    emptyIconRing: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: 'rgba(56,189,248,0.1)', alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: 'rgba(56,189,248,0.25)',
    },
    emptyTitle: { color: COLORS.textPrimary, fontWeight: '800', fontSize: 16 },
    emptyHint: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },

    // Action row
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: 24, alignItems: 'stretch' },
    actionBtn: {
        flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14,
        backgroundColor: COLORS.glass, borderRadius: 18,
        borderWidth: 1, borderColor: COLORS.border,
    },
    actionBtnIcon: { },
    actionBtnLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
    actionBtnPrimary: {
        flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14, borderRadius: 18,
        backgroundColor: ACCENT, ...SHADOWS.button,
    },
    actionBtnPrimaryLabel: { color: '#140f2d', fontWeight: '900', fontSize: 15 },
    btnDisabled: { opacity: 0.35 },

    // Result card
    resultCard: {
        backgroundColor: COLORS.glassStrong,
        borderRadius: 26, padding: 22,
        borderWidth: 1, borderColor: 'rgba(56,189,248,0.18)',
        ...SHADOWS.glass,
        marginBottom: 10,
    },
    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
    resultEyebrow: { color: ACCENT, fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginBottom: 6 },
    resultCondition: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '900', marginBottom: 10 },
    resultMetaRow: { flexDirection: 'row', gap: 8 },
    metaPill: {
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
        backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: COLORS.border,
    },
    metaPillText: { color: '#ffcad6', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 18 },

    limitText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 12 },

    newScanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    newScanText: { color: '#ffb7c9', fontWeight: '800', fontSize: 15 },

    // Tips
    tipsCard: {
        backgroundColor: COLORS.glass, borderRadius: 20, padding: 18,
        borderWidth: 1, borderColor: COLORS.border, gap: 12, marginBottom: 10,
    },
    tipsTitle: { color: '#ffb3c6', fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginBottom: 4 },
    tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    tipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 },
});