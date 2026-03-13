import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Alert,
    Easing,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as Speech from 'expo-speech';

import {
    analyzeVoice,
    createChatSession,
    getChatHistory,
    getChatSessions,
    getCopingResources,
    sendMentalHealthChat,
} from '../src/components/services/api';
import BottomTabBar from '../src/components/BottomTabBar';

const RISK_META = {
    low: { label: 'Low Stress', color: '#4ade80', bg: '#0b2b1c' },
    moderate: { label: 'Moderate', color: '#fbbf24', bg: '#342710' },
    high: { label: 'High Stress', color: '#fb923c', bg: '#3b1d12' },
    crisis: { label: 'Crisis Support', color: '#fb7185', bg: '#3a101f' },
};

const LOCAL_WAVE_THEMES = {
    idle: {
        primary: '#5ee7ff',
        secondary: '#4f8dff',
        glow: 'rgba(88, 226, 255, 0.22)',
        surface: '#0c1730',
        label: 'Listening',
    },
    calm: {
        primary: '#5ee7ff',
        secondary: '#39c8ff',
        glow: 'rgba(88, 226, 255, 0.28)',
        surface: '#0c1730',
        label: 'Calm',
    },
    restless: {
        primary: '#7d8cff',
        secondary: '#50d7ff',
        glow: 'rgba(110, 124, 255, 0.30)',
        surface: '#171d48',
        label: 'Restless',
    },
    tense: {
        primary: '#ff8a5b',
        secondary: '#ff4bac',
        glow: 'rgba(255, 97, 143, 0.34)',
        surface: '#311527',
        label: 'Tense',
    },
    overwhelmed: {
        primary: '#ff6489',
        secondary: '#ff2fe0',
        glow: 'rgba(255, 61, 166, 0.38)',
        surface: '#330f22',
        label: 'Overwhelmed',
    },
};

const INITIAL_MESSAGES = [
    {
        id: 'w0',
        role: 'bot',
        text: "Hi, I'm Jinx. How are you feeling right now? You can also switch to Voice and I can listen there too.",
    },
];

const TABS = ['Chat', 'Voice', 'Resources'];
const WAVE_BAR_COUNT = 36;

function riskKey(score) {
    if (score >= 0.8) return 'crisis';
    if (score >= 0.55) return 'high';
    if (score >= 0.25) return 'moderate';
    return 'low';
}

function createWaveBars(frame, intensity) {
    return Array.from({ length: WAVE_BAR_COUNT }, (_, index) => {
        const orbit = Math.sin(frame * 0.3 + index * 0.58);
        const flutter = Math.cos(frame * 0.16 - index * 0.31);
        const pulse = Math.abs(Math.sin(frame * 0.48 + index * 0.93));
        const spread = 1 - Math.abs(index - WAVE_BAR_COUNT / 2) / (WAVE_BAR_COUNT / 2);
        const base = 0.16 + spread * 0.14 + Math.abs(orbit) * (0.2 + intensity * 0.28) + pulse * 0.2 + flutter * 0.08;
        return Number(Math.max(0.14, Math.min(1, base)).toFixed(3));
    });
}

function resolveVoiceTheme(result, recState) {
    if (result?.visual_theme?.primary && result?.visual_theme?.secondary) {
        return {
            primary: result.visual_theme.primary,
            secondary: result.visual_theme.secondary,
            glow: result.visual_theme.glow,
            surface: result.visual_theme.surface,
            label: result.visual_theme.label || result.mood_label || 'Listening',
        };
    }

    if (recState === 'recording' || recState === 'processing') {
        return LOCAL_WAVE_THEMES.idle;
    }

    if (result?.mood && LOCAL_WAVE_THEMES[result.mood]) {
        return LOCAL_WAVE_THEMES[result.mood];
    }

    return LOCAL_WAVE_THEMES.calm;
}

function TypingBubble({ text }) {
    const [shown, setShown] = useState('');

    useEffect(() => {
        let index = 0;
        setShown('');
        const timer = setInterval(() => {
            setShown(text.slice(0, index + 1));
            index += 1;
            if (index >= text.length) {
                clearInterval(timer);
            }
        }, 22);

        return () => clearInterval(timer);
    }, [text]);

    return <Text style={styles.botText}>{shown}</Text>;
}

const TAB_BAR_H = 60; // height of the fixed bottom tab bar

function ChatTab({
    activeSessionId,
    chats,
    chatsLoading,
    draft,
    isThinking,
    keyboardInset,
    menuOpen,
    messages,
    onNewChat,
    onSelectChat,
    onSend,
    scrollRef,
    setDraft,
    toggleMenu,
}) {
    return (
        <View style={styles.chatTabShell}>
            <View style={styles.chatToolbar}>
                <Pressable style={styles.chatToolbarButton} onPress={toggleMenu}>
                    <Text style={styles.chatToolbarButtonText}>Messages</Text>
                </Pressable>
                <Pressable style={styles.chatToolbarButtonPrimary} onPress={onNewChat}>
                    <Text style={styles.chatToolbarButtonPrimaryText}>+ New</Text>
                </Pressable>
            </View>

            <ScrollView
                horizontal
                style={styles.chatTabsStrip}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chatTabsRow}
            >
                {chats.map((chat) => (
                    <Pressable
                        key={chat.session_id}
                        style={[styles.chatSessionTab, activeSessionId === chat.session_id && styles.chatSessionTabActive]}
                        onPress={() => onSelectChat(chat.session_id)}
                    >
                        <Text style={[styles.chatSessionTabText, activeSessionId === chat.session_id && styles.chatSessionTabTextActive]} numberOfLines={1}>
                            {chat.title}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>

            {menuOpen && (
                <View style={styles.chatMenuPanel}>
                    <Text style={styles.chatMenuTitle}>Old messages</Text>
                    {chatsLoading ? (
                        <ActivityIndicator color="#67e8f9" style={styles.chatMenuLoader} />
                    ) : chats.length ? (
                        chats.map((chat) => (
                            <Pressable
                                key={`menu-${chat.session_id}`}
                                style={styles.chatMenuItem}
                                onPress={() => onSelectChat(chat.session_id)}
                            >
                                <View style={styles.chatMenuItemCopy}>
                                    <Text style={styles.chatMenuItemTitle} numberOfLines={1}>{chat.title}</Text>
                                    <Text style={styles.chatMenuItemPreview} numberOfLines={2}>{chat.preview}</Text>
                                </View>
                                <Text style={styles.chatMenuItemMeta}>{chat.message_count}</Text>
                            </Pressable>
                        ))
                    ) : (
                        <Text style={styles.chatMenuEmpty}>No saved conversations yet.</Text>
                    )}
                </View>
            )}

            <ScrollView
                ref={scrollRef}
                style={styles.chatMessagesScroll}
                contentContainerStyle={styles.chatScroll}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                keyboardDismissMode="on-drag"
            >
                {messages.map((message) => {
                    const isUser = message.role === 'user';
                    const rk = message.riskScore != null ? riskKey(message.riskScore) : null;

                    return (
                        <View
                            key={message.id}
                            style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}
                        >
                            <Text style={[styles.bubbleRole, isUser ? styles.userRole : styles.botRole]}>
                                {isUser ? 'You' : 'Jinx'}
                            </Text>
                            {isUser ? (
                                <Text style={styles.userText}>{message.text}</Text>
                            ) : (
                                <TypingBubble text={message.text} />
                            )}
                            {rk && rk !== 'low' && (
                                <View style={[styles.stressTag, { backgroundColor: RISK_META[rk].bg }]}>
                                    <Text style={[styles.stressTagText, { color: RISK_META[rk].color }]}>
                                        {RISK_META[rk].label}
                                    </Text>
                                </View>
                            )}
                        </View>
                    );
                })}

                {isThinking && (
                    <View style={[styles.bubble, styles.botBubble]}>
                        <Text style={styles.botRole}>Jinx</Text>
                        <ActivityIndicator size="small" color="#67e8f9" style={styles.thinkingLoader} />
                    </View>
                )}
            </ScrollView>

            <View style={styles.inputArea}>
                <TextInput
                    style={styles.input}
                    placeholder="Tell Jinx what's on your mind…"
                    placeholderTextColor="#4a607a"
                    value={draft}
                    onChangeText={setDraft}
                    multiline
                />
                <Pressable
                    style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
                    onPress={onSend}
                    disabled={!draft.trim() || isThinking}
                >
                    <Text style={styles.sendBtnText}>Send</Text>
                </Pressable>
            </View>

            {/* Spacer so last message & input aren't hidden by tab bar */}
            <View style={{ height: TAB_BAR_H + Math.max(keyboardInset, 0) }} />
        </View>
    );
}

const CAT_COLORS = {
    breathing: '#2dd4bf',
    grounding: '#60a5fa',
    activity: '#f97316',
    mindfulness: '#a78bfa',
    cognitive: '#f472b6',
    emergency: '#fb7185',
};

function ResourceCard({ resource }) {
    const [expanded, setExpanded] = useState(false);
    const accent = CAT_COLORS[resource.category] || '#94a3b8';

    return (
        <Pressable style={styles.resourceCard} onPress={() => setExpanded((value) => !value)}>
            <View style={styles.resourceCardHeader}>
                <View style={[styles.catBadge, { backgroundColor: `${accent}22`, borderColor: accent }]}>
                    <Text style={[styles.catBadgeText, { color: accent }]}>{resource.category}</Text>
                </View>
                <Text style={styles.resourceTitle} numberOfLines={expanded ? undefined : 1}>
                    {resource.title}
                </Text>
                <Text style={styles.resourceDuration}>{resource.duration_minutes}m</Text>
            </View>

            <Text style={styles.resourceDesc}>{resource.description}</Text>

            {expanded && resource.steps?.length > 0 && (
                <View style={styles.stepsBox}>
                    {resource.steps.map((step, index) => (
                        <Text key={`${resource.id}-${index}`} style={styles.stepText}>
                            {index + 1}. {step}
                        </Text>
                    ))}
                </View>
            )}

            <Text style={styles.expandHint}>{expanded ? 'Hide steps' : 'Show steps'}</Text>
        </Pressable>
    );
}

function Waveform({ bars, theme, frame, recState }) {
    const pulse = useRef(new Animated.Value(0)).current;
    const spin = useRef(new Animated.Value(0)).current;
    const isListening = recState === 'recording';
    const isProcessing = recState === 'processing';

    useEffect(() => {
        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 1650,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0,
                    duration: 1650,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );
        const spinLoop = Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration: 14000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );

        pulseLoop.start();
        spinLoop.start();

        return () => {
            pulseLoop.stop();
            spinLoop.stop();
        };
    }, [pulse, spin]);

    const outerScale = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.92, isListening ? 1.08 : isProcessing ? 1.02 : 0.98],
    });
    const innerScale = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.98, isListening ? 1.12 : 1.04],
    });
    const orbitRotation = spin.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={styles.waveShell}>
            <Animated.View
                style={[
                    styles.waveBackdropPulse,
                    {
                        backgroundColor: theme.glow,
                        transform: [{ scale: outerScale }],
                        opacity: isListening ? 0.95 : 0.62,
                    },
                ]}
            />

            <Animated.View
                style={[
                    styles.waveBackdropPulseSecondary,
                    {
                        backgroundColor: `${theme.secondary}22`,
                        transform: [{ scale: innerScale }],
                        opacity: isListening ? 0.9 : 0.55,
                    },
                ]}
            />

            <Animated.View style={[styles.waveOrbit, { transform: [{ rotate: orbitRotation }] }]}>
                {bars.map((value, index) => {
                    const angle = (360 / bars.length) * index;
                    const sway = Math.sin(frame * 0.24 + index * 0.55);
                    const tint = sway > 0 ? theme.primary : theme.secondary;
                    const barLength = 18 + value * 44 + (isListening ? 10 : isProcessing ? 5 : 0);
                    const barWidth = sway > 0.35 ? 5 : 4;

                    return (
                        <View key={`ring-${index}`} style={[styles.radialBarSlot, { transform: [{ rotate: `${angle}deg` }] }]}>
                            <View
                                style={[
                                    styles.radialBar,
                                    {
                                        width: barWidth,
                                        height: barLength,
                                        backgroundColor: tint,
                                        shadowColor: tint,
                                        opacity: isListening ? 0.72 + value * 0.28 : 0.54 + value * 0.2,
                                        transform: [{ translateY: sway * (isListening ? -4 : -2) }],
                                    },
                                ]}
                            />
                        </View>
                    );
                })}
            </Animated.View>

            <Animated.View
                style={[
                    styles.waveInnerHalo,
                    {
                        borderColor: `${theme.primary}55`,
                        transform: [{ scale: innerScale }],
                    },
                ]}
            />
        </View>
    );
}

function VoiceTab({ sessionId, onSessionUpdate }) {
    const [recState, setRecState] = useState('idle');
    const [result, setResult] = useState(null);
    const [waveBars, setWaveBars] = useState(() => createWaveBars(0, 0.18));
    const [waveFrame, setWaveFrame] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const frameRef = useRef(0);
    const recStateRef = useRef('idle');
    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

    const theme = useMemo(() => resolveVoiceTheme(result, recState), [result, recState]);

    useEffect(() => {
        recStateRef.current = recState;
    }, [recState]);

    useEffect(() => {
        const timer = setInterval(() => {
            frameRef.current += 1;
            const intensity =
                recState === 'recording'
                    ? 0.95
                    : recState === 'processing'
                        ? 0.72
                        : result
                            ? 0.38 + (result.risk_score ?? 0) * 0.36
                            : 0.2;

            setWaveFrame(frameRef.current);
            setWaveBars(createWaveBars(frameRef.current, intensity));
        }, 110);

        return () => clearInterval(timer);
    }, [recState, result]);

    useEffect(() => {
        return () => {
            if (recStateRef.current === 'recording') {
                recorder.stop().catch(() => null);
            }
            setAudioModeAsync({ allowsRecording: false }).catch(() => null);
            Speech.stop();
        };
    }, [recorder]);

    const speakReply = useCallback((text) => {
        if (!text) {
            return;
        }

        Speech.stop();
        setIsSpeaking(true);
        Speech.speak(text, {
            rate: 0.96,
            pitch: 1.0,
            language: 'en',
            onDone: () => setIsSpeaking(false),
            onStopped: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
        });
    }, []);

    const startRec = useCallback(async () => {
        try {
            Speech.stop();
            setIsSpeaking(false);
            setResult(null);

            const { status } = await AudioModule.requestRecordingPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission required', 'Microphone access is needed for live voice support.');
                return;
            }

            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });

            await recorder.prepareToRecordAsync();
            recorder.record();
            setRecState('recording');
        } catch {
            Alert.alert('Recording unavailable', 'Jinx could not start listening. Please try again.');
        }
    }, [recorder]);

    const stopRec = useCallback(async () => {
        if (!recorder.isRecording && recState !== 'recording') {
            return;
        }

        setRecState('processing');

        try {
            await recorder.stop();
            await setAudioModeAsync({ allowsRecording: false });
            const uri = recorder.uri;

            if (!uri) {
                throw new Error('Recording file was not created.');
            }

            const data = await analyzeVoice(sessionId, uri);
            if (data.error) {
                throw new Error(data.error);
            }

            setResult(data);
            onSessionUpdate(data.session_id, data.session_risk ?? data.risk_score ?? 0);
            setRecState('done');

            if (data.ai_reply) {
                speakReply(data.ai_reply);
            }
        } catch {
            setRecState('idle');
            Alert.alert('Analysis failed', 'Jinx could not process this recording. Please try again.');
        }
    }, [onSessionUpdate, recState, recorder, sessionId, speakReply]);

    const resetVoice = useCallback(() => {
        Speech.stop();
        setIsSpeaking(false);
        setResult(null);
        setRecState('idle');
    }, []);

    const riskMeta = result ? RISK_META[riskKey(result.risk_score ?? 0)] : RISK_META.low;
    const controlLabel =
        recState === 'recording'
            ? 'Stop'
            : recState === 'processing'
                ? 'Thinking'
                : recState === 'done'
                    ? 'Again'
                    : 'Speak';
    const controlIcon =
        recState === 'recording' ? '■' : recState === 'processing' ? '···' : '🎙';
    const statusText =
        recState === 'recording'
            ? 'Listening live. Keep speaking until you are done.'
            : recState === 'processing'
                ? 'Analysing stress, inferring mood, and generating a reply...'
                : result?.ai_reply
                    ? 'Reply ready. Jinx can read it aloud or you can tap Again.'
                    : 'Tap Speak to start a short voice check-in.';

    return (
        <ScrollView contentContainerStyle={styles.voiceScroll} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
            <View style={styles.voiceStage}>
                <View style={[styles.voiceGlowLarge, { backgroundColor: theme.glow }]} />
                <View style={[styles.voiceGlowLeft, { backgroundColor: theme.primary }]} />
                <View style={[styles.voiceGlowRight, { backgroundColor: theme.secondary }]} />

                <Text style={styles.voiceEyebrow}>Live Voice Companion</Text>
                <Text style={styles.voiceHeadline}>
                    A living voice orb that breathes, changes colour, and responds to your tone before answering back.
                </Text>

                <View style={styles.voiceArena}>
                    <Waveform bars={waveBars} theme={theme} frame={waveFrame} recState={recState} />

                    <Pressable
                        style={[
                            styles.voiceCore,
                            {
                                backgroundColor: theme.surface,
                                borderColor: theme.primary,
                                shadowColor: theme.primary,
                            },
                        ]}
                        onPress={
                            recState === 'idle'
                                ? startRec
                                : recState === 'recording'
                                    ? stopRec
                                    : recState === 'done'
                                        ? resetVoice
                                        : undefined
                        }
                        disabled={recState === 'processing'}
                    >
                        <Text style={[styles.voiceCoreIcon, { color: theme.primary }]}>{controlIcon}</Text>
                        <Text style={styles.voiceCoreLabel}>{controlLabel}</Text>
                    </Pressable>
                </View>

                <Text style={styles.voiceStatus}>{statusText}</Text>

                <View style={styles.voiceChipRow}>
                    <View style={[styles.voiceChip, { borderColor: `${theme.primary}66` }]}>
                        <Text style={styles.voiceChipLabel}>Waveform</Text>
                        <Text style={[styles.voiceChipValue, { color: theme.primary }]}>{theme.label}</Text>
                    </View>

                    <View style={[styles.voiceChip, { borderColor: `${riskMeta.color}55` }]}>
                        <Text style={styles.voiceChipLabel}>Stress</Text>
                        <Text style={[styles.voiceChipValue, { color: riskMeta.color }]}>{riskMeta.label}</Text>
                    </View>

                    <View style={styles.voiceChip}>
                        <Text style={styles.voiceChipLabel}>Mode</Text>
                        <Text style={styles.voiceChipValue}>
                            {recState === 'processing' ? 'AI Replying' : recState === 'recording' ? 'Listening' : 'Standby'}
                        </Text>
                    </View>
                </View>
            </View>

            {result ? (
                <>
                    <View style={styles.voiceInsightCard}>
                        <View style={styles.voiceInsightHeader}>
                            <View>
                                <Text style={styles.voiceInsightLabel}>Voice analysis</Text>
                                <Text style={styles.voiceInsightTitle}>{result.mood_label || theme.label}</Text>
                            </View>
                            <View style={[styles.analysisRiskPill, { backgroundColor: riskMeta.bg }]}>
                                <Text style={[styles.analysisRiskPillText, { color: riskMeta.color }]}>
                                    {Math.round((result.risk_score ?? 0) * 100)}%
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.analysisNote}>{result.notes}</Text>

                        <View style={styles.metricsRow}>
                            <View style={styles.metricCard}>
                                <Text style={styles.metricLabel}>Mood</Text>
                                <Text style={styles.metricValue}>{result.mood_label || theme.label}</Text>
                            </View>
                            <View style={styles.metricCard}>
                                <Text style={styles.metricLabel}>Clip Length</Text>
                                <Text style={styles.metricValue}>{Math.round(result.duration_seconds ?? 0)}s</Text>
                            </View>
                            <View style={styles.metricCard}>
                                <Text style={styles.metricLabel}>Session Risk</Text>
                                <Text style={styles.metricValue}>{Math.round((result.session_risk ?? 0) * 100)}%</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.replyCard}>
                        <View style={styles.replyHeader}>
                            <Text style={styles.replyLabel}>Jinx live reply</Text>
                            <Pressable
                                style={styles.replyAction}
                                onPress={() => {
                                    if (isSpeaking) {
                                        Speech.stop();
                                        setIsSpeaking(false);
                                        return;
                                    }
                                    speakReply(result.ai_reply);
                                }}
                            >
                                <Text style={styles.replyActionText}>{isSpeaking ? 'Stop voice' : 'Play voice'}</Text>
                            </Pressable>
                        </View>
                        <Text style={styles.replyText}>{result.ai_reply || 'Jinx is here with you.'}</Text>
                    </View>

                    {result.coping_resources?.length > 0 && (
                        <View style={styles.voiceResourcesSection}>
                            <Text style={styles.sectionTitle}>Suggested grounding</Text>
                            {result.coping_resources.map((resource) => (
                                <ResourceCard key={`voice-${resource.id}`} resource={resource} />
                            ))}
                        </View>
                    )}
                </>
            ) : (
                <View style={styles.voiceGuideCard}>
                    <Text style={styles.sectionTitle}>How this works</Text>
                    <Text style={styles.voiceGuideText}>
                        Speak for 10 to 30 seconds. Jinx analyses vocal stress patterns, estimates mood, updates the waveform color, and generates a supportive reply that can be played aloud.
                    </Text>
                    <Text style={styles.voiceDisclaimer}>
                        This is a supportive wellness feature, not a diagnosis or emergency substitute.
                    </Text>
                </View>
            )}
        </ScrollView>
    );
}

function ResourcesTab() {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getCopingResources()
            .then((data) => setResources(Array.isArray(data) ? data : []))
            .catch(() => setResources([]))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <ActivityIndicator style={styles.resourcesLoader} color="#67e8f9" />;
    }

    if (!resources.length) {
        return (
            <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                    No coping resources were found. Seed the backend with:{'\n\n'}python manage.py seed_coping_resources
                </Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.resourcesScroll} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
            {resources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
            ))}
        </ScrollView>
    );
}

export default function MentalHealthScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState('Voice');
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [draft, setDraft] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [sessionRisk, setSessionRisk] = useState(0);
    const [chatSessions, setChatSessions] = useState([]);
    const [chatSessionsLoading, setChatSessionsLoading] = useState(true);
    const [messagesMenuOpen, setMessagesMenuOpen] = useState(false);
    const scrollRef = useRef(null);

    // Always-current ref so handleSend can read the latest messages
    // without adding 'messages' to its useCallback dependency array.
    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const mapHistoryMessages = useCallback((history) => {
        if (!history?.messages?.length) {
            return INITIAL_MESSAGES;
        }

        return history.messages.map((message) => ({
            id: String(message.id),
            role: message.role,
            text: message.text,
            riskScore: message.role === 'user' ? message.stress_score : undefined,
            createdAt: message.created_at,
        }));
    }, []);

    const loadChatSessions = useCallback(async () => {
        const data = await getChatSessions();
        if (Array.isArray(data)) {
            setChatSessions(data);
            setChatSessionsLoading(false);
            return data;
        }

        setChatSessionsLoading(false);
        return [];
    }, []);

    const loadChatHistory = useCallback(async (nextSessionId) => {
        if (!nextSessionId) {
            setSessionId(null);
            setSessionRisk(0);
            setMessages(INITIAL_MESSAGES);
            return;
        }

        const history = await getChatHistory(nextSessionId);
        if (!history?.error) {
            setSessionId(history.session_id || nextSessionId);
            setSessionRisk(history.overall_risk_score ?? 0);
            setMessages(mapHistoryMessages(history));
            setMessagesMenuOpen(false);
        }
    }, [mapHistoryMessages]);

    const handleNewChat = useCallback(async () => {
        const created = await createChatSession();
        if (created?.session_id) {
            setChatSessions((current) => [created, ...current.filter((chat) => chat.session_id !== created.session_id)]);
            setSessionId(created.session_id);
            setSessionRisk(0);
            setMessages(INITIAL_MESSAGES);
            setMessagesMenuOpen(false);
            return;
        }

        setSessionId(null);
        setSessionRisk(0);
        setMessages(INITIAL_MESSAGES);
    }, []);

    useEffect(() => {
        let mounted = true;

        const bootstrapChats = async () => {
            const sessions = await loadChatSessions();
            if (!mounted) {
                return;
            }

            if (sessions.length) {
                await loadChatHistory(sessions[0].session_id);
            } else {
                setMessages(INITIAL_MESSAGES);
            }
        };

        void bootstrapChats();

        return () => {
            mounted = false;
        };
    }, [loadChatHistory, loadChatSessions]);

    const updateSession = useCallback((sid, risk) => {
        if (sid) {
            setSessionId(sid);
        }
        if (typeof risk === 'number') {
            setSessionRisk(risk);
        }
    }, []);

    const handleSend = useCallback(async () => {
        const trimmed = draft.trim();
        if (!trimmed || isThinking) {
            return;
        }

        let currentSessionId = sessionId;
        if (!currentSessionId) {
            const created = await createChatSession();
            if (created?.session_id) {
                currentSessionId = created.session_id;
                setSessionId(created.session_id);
                setChatSessions((current) => [created, ...current.filter((chat) => chat.session_id !== created.session_id)]);
            }
        }

        const userMessageId = `u-${Date.now()}`;
        setDraft('');
        setMessages((current) => [...current, { id: userMessageId, role: 'user', text: trimmed }]);
        setIsThinking(true);

        try {
            // Snapshot history BEFORE the new user message is appended.
            // We exclude the static welcome placeholder (id 'w0') and keep only
            // real turn pairs so each tab sends its own full context to Gemini.
            const historySnapshot = messagesRef.current
                .filter((m) => m.id !== 'w0' && m.role && m.text)
                .map((m) => ({ role: m.role, text: m.text }));

            const data = await sendMentalHealthChat(trimmed, currentSessionId, historySnapshot);
            if (data?.error || !data?.reply) {
                throw new Error(data?.error || 'No reply returned from AI service.');
            }
            setMessages((current) => {
                const updated = current.map((message) =>
                    message.id === userMessageId
                        ? { ...message, riskScore: data.risk_score, stressLevel: data.stress_level }
                        : message
                );

                return [
                    ...updated,
                    { id: `b-${Date.now()}`, role: 'bot', text: data.reply },
                ];
            });
            updateSession(data.session_id, data.session_risk ?? data.risk_score ?? 0);
            await loadChatSessions();
        } catch (error) {
            setMessages((current) => [
                ...current,
                {
                    id: `b-${Date.now()}`,
                    role: 'bot',
                    text: error?.message
                        ? `Jinx could not get an AI reply: ${error.message}`
                        : 'Jinx could not reach the backend right now. Check your connection and try again.',
                },
            ]);
        } finally {
            setIsThinking(false);
        }
    }, [draft, isThinking, loadChatSessions, sessionId, updateSession]);

    const sessionRiskMeta = RISK_META[riskKey(sessionRisk)];

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            >
                <View style={styles.screenGlowTop} />
                <View style={styles.screenGlowBottom} />

                <View style={styles.header}>
                    <Pressable style={styles.backBtn} onPress={() => router.back()}>
                        <Text style={styles.backBtnText}>←</Text>
                    </Pressable>

                    <Text style={styles.headerTitle}>Companion Space</Text>

                    <View style={[styles.riskPill, { backgroundColor: sessionRiskMeta.bg }]}>
                        <Text style={[styles.riskPillText, { color: sessionRiskMeta.color }]}>
                            {sessionRiskMeta.label}
                        </Text>
                    </View>
                </View>

                <View style={styles.heroRow}>
                    <View style={styles.avatarShell}>
                        <View style={styles.avatarInner}>
                            <Text style={styles.avatarText}>J</Text>
                        </View>
                    </View>

                    <View style={styles.heroInfo}>
                        <Text style={styles.heroName}>Jinx</Text>
                        <View style={styles.onlinePill}>
                            <View style={styles.onlineDot} />
                            <Text style={styles.onlineLabel}>Live AI companion</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.tabBar}>
                    {TABS.map((tab) => (
                        <Pressable
                            key={tab}
                            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{tab}</Text>
                        </Pressable>
                    ))}
                </View>

                <View style={styles.flex}>
                    {activeTab === 'Chat' && (
                        <ChatTab
                            activeSessionId={sessionId}
                            chats={chatSessions}
                            chatsLoading={chatSessionsLoading}
                            messages={messages}
                            draft={draft}
                            setDraft={setDraft}
                            onSend={handleSend}
                            isThinking={isThinking}
                            scrollRef={scrollRef}
                            onNewChat={handleNewChat}
                            onSelectChat={loadChatHistory}
                            menuOpen={messagesMenuOpen}
                            toggleMenu={() => setMessagesMenuOpen((current) => !current)}
                            keyboardInset={Math.max(insets.bottom, 8)}
                        />
                    )}

                    {activeTab === 'Voice' && (
                        <VoiceTab sessionId={sessionId} onSessionUpdate={updateSession} />
                    )}

                    {activeTab === 'Resources' && <ResourcesTab />}
                </View>
            </KeyboardAvoidingView>
            <BottomTabBar active="mental-health" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: '#050b17' },
    screenGlowTop: {
        position: 'absolute',
        top: -120,
        right: -80,
        width: 280,
        height: 280,
        borderRadius: 200,
        backgroundColor: 'rgba(60, 146, 255, 0.16)',
    },
    screenGlowBottom: {
        position: 'absolute',
        left: -90,
        bottom: -120,
        width: 320,
        height: 320,
        borderRadius: 220,
        backgroundColor: 'rgba(255, 62, 174, 0.11)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
    },
    headerTitle: { color: '#f8fbff', fontSize: 17, fontWeight: '700' },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(10, 18, 34, 0.92)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(116, 150, 204, 0.18)',
    },
    backBtnText: { color: '#67e8f9', fontSize: 20, fontWeight: '800' },
    riskPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
    riskPillText: { fontSize: 11, fontWeight: '700' },
    heroRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 10,
        gap: 14,
    },
    avatarShell: {
        width: 60,
        height: 60,
        borderRadius: 30,
        padding: 2,
        backgroundColor: 'rgba(103, 232, 249, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(103, 232, 249, 0.24)',
    },
    avatarInner: {
        flex: 1,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0b1730',
    },
    avatarText: { color: '#67e8f9', fontSize: 24, fontWeight: '900' },
    heroInfo: { flex: 1, gap: 5 },
    heroName: { color: '#f8fbff', fontSize: 20, fontWeight: '900' },
    onlinePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(19, 31, 56, 0.92)',
        borderWidth: 1,
        borderColor: 'rgba(106, 150, 255, 0.18)',
    },
    onlineDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#34d399',
    },
    onlineLabel: {
        color: '#c7d7ff',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    heroCaption: { color: '#89a1bf', fontSize: 13, lineHeight: 19 },
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 10,
        padding: 4,
        backgroundColor: 'rgba(8, 15, 28, 0.9)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(115, 142, 183, 0.12)',
    },
    tabItem: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 12 },
    tabItemActive: { backgroundColor: 'rgba(103, 232, 249, 0.14)', borderWidth: 1, borderColor: 'rgba(103, 232, 249, 0.2)' },
    tabLabel: { color: '#6d84a6', fontWeight: '700', fontSize: 13 },
    tabLabelActive: { color: '#67e8f9', fontWeight: '900' },
    chatTabShell: { flex: 1 },
    chatToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
    chatToolbarButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(14, 25, 47, 0.95)', borderWidth: 1, borderColor: 'rgba(115, 142, 183, 0.14)' },
    chatToolbarButtonText: { color: '#d9e7ff', fontWeight: '700', fontSize: 13 },
    chatToolbarButtonPrimary: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(82, 118, 255, 0.22)', borderWidth: 1, borderColor: 'rgba(103, 137, 255, 0.2)' },
    chatToolbarButtonPrimaryText: { color: '#f8fbff', fontWeight: '800', fontSize: 12 },
    chatTabsStrip: { maxHeight: 34, minHeight: 30 },
    chatTabsRow: { paddingHorizontal: 14, gap: 7, paddingBottom: 2, alignItems: 'center', flexGrow: 0 },
    chatSessionTab: {
        alignSelf: 'flex-start',
        maxWidth: 98,
        height: 26,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        justifyContent: 'center',
        backgroundColor: 'rgba(12, 22, 43, 0.88)',
        borderWidth: 1,
        borderColor: 'rgba(115, 142, 183, 0.12)',
    },
    chatSessionTabActive: { backgroundColor: 'rgba(82, 118, 255, 0.22)', borderColor: 'rgba(103, 137, 255, 0.2)' },
    chatSessionTabText: { color: '#89a1bf', fontWeight: '600', fontSize: 10 },
    chatSessionTabTextActive: { color: '#f8fbff' },
    chatMenuPanel: { marginHorizontal: 16, marginBottom: 12, backgroundColor: 'rgba(7, 14, 28, 0.98)', borderRadius: 22, padding: 14, borderWidth: 1, borderColor: 'rgba(102, 129, 170, 0.16)' },
    chatMenuTitle: { color: '#f8fbff', fontSize: 15, fontWeight: '800', marginBottom: 8 },
    chatMenuLoader: { paddingVertical: 16 },
    chatMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
    chatMenuItemCopy: { flex: 1 },
    chatMenuItemTitle: { color: '#f8fbff', fontSize: 14, fontWeight: '700' },
    chatMenuItemPreview: { color: '#89a1bf', fontSize: 12, lineHeight: 18, marginTop: 4 },
    chatMenuItemMeta: { color: '#67e8f9', fontSize: 12, fontWeight: '700' },
    chatMenuEmpty: { color: '#89a1bf', lineHeight: 20, paddingVertical: 10 },
    chatMessagesScroll: { flex: 1 },
    chatScroll: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
    bubble: {
        maxWidth: '85%',
        paddingHorizontal: 15,
        paddingVertical: 13,
        borderRadius: 22,
        gap: 6,
    },
    botBubble: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(11, 23, 48, 0.92)',
        borderBottomLeftRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(103, 232, 249, 0.14)',
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: 'rgba(47, 82, 198, 0.95)',
        borderBottomRightRadius: 6,
    },
    bubbleRole: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
    botRole: { color: '#67e8f9' },
    userRole: { color: '#d7e4ff' },
    botText: { color: '#f5f9ff', fontSize: 15, lineHeight: 22 },
    userText: { color: '#ffffff', fontSize: 15, lineHeight: 22 },
    stressTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    stressTagText: { fontSize: 10, fontWeight: '800' },
    thinkingLoader: { marginTop: 4 },
    inputArea: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(103, 232, 249, 0.1)',
        backgroundColor: 'rgba(5, 10, 22, 0.98)',
    },
    input: {
        flex: 1,
        minHeight: 44,
        maxHeight: 110,
        paddingHorizontal: 16,
        paddingTop: 11,
        paddingBottom: 11,
        borderRadius: 22,
        backgroundColor: 'rgba(13, 25, 48, 0.96)',
        borderWidth: 1,
        borderColor: 'rgba(103, 232, 249, 0.1)',
        color: '#f8fbff',
        fontSize: 15,
    },
    sendBtn: {
        height: 44,
        paddingHorizontal: 20,
        justifyContent: 'center',
        borderRadius: 22,
        backgroundColor: '#67e8f9',
        shadowColor: '#67e8f9',
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    sendBtnDisabled: { opacity: 0.3 },
    sendBtnText: { color: '#04101d', fontWeight: '900', fontSize: 14 },
    voiceScroll: { paddingHorizontal: 16, paddingBottom: TAB_BAR_H + 16, gap: 16 },
    voiceStage: {
        marginTop: 2,
        borderRadius: 28,
        paddingHorizontal: 18,
        paddingVertical: 22,
        overflow: 'hidden',
        backgroundColor: 'rgba(7, 14, 28, 0.96)',
        borderWidth: 1,
        borderColor: 'rgba(102, 129, 170, 0.16)',
    },
    voiceGlowLarge: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
        top: 38,
        alignSelf: 'center',
    },
    voiceGlowLeft: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        left: -22,
        top: 140,
        opacity: 0.12,
    },
    voiceGlowRight: {
        position: 'absolute',
        width: 170,
        height: 170,
        borderRadius: 85,
        right: -34,
        top: 126,
        opacity: 0.14,
    },
    voiceEyebrow: {
        color: '#c9d6f1',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1.3,
    },
    voiceHeadline: {
        color: '#f8fbff',
        fontSize: 22,
        fontWeight: '900',
        lineHeight: 30,
        marginTop: 8,
    },
    voiceArena: {
        marginTop: 28,
        minHeight: 308,
        justifyContent: 'center',
        alignItems: 'center',
    },
    waveShell: {
        width: 266,
        height: 266,
        alignItems: 'center',
        justifyContent: 'center',
    },
    waveBackdropPulse: {
        position: 'absolute',
        width: 240,
        height: 240,
        borderRadius: 120,
    },
    waveBackdropPulseSecondary: {
        position: 'absolute',
        width: 196,
        height: 196,
        borderRadius: 98,
    },
    waveOrbit: {
        position: 'absolute',
        width: 240,
        height: 240,
        borderRadius: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radialBarSlot: {
        position: 'absolute',
        width: 12,
        height: 240,
        alignItems: 'center',
        paddingTop: 8,
    },
    radialBar: {
        borderRadius: 999,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.75,
        shadowRadius: 10,
        elevation: 7,
    },
    waveInnerHalo: {
        position: 'absolute',
        width: 156,
        height: 156,
        borderRadius: 78,
        borderWidth: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    voiceCore: {
        position: 'absolute',
        alignSelf: 'center',
        width: 138,
        height: 138,
        borderRadius: 69,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.52,
        shadowRadius: 24,
        elevation: 14,
    },
    voiceCoreIcon: { fontSize: 28, fontWeight: '700' },
    voiceCoreLabel: {
        color: '#f8fbff',
        marginTop: 8,
        fontSize: 14,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    voiceStatus: {
        marginTop: 8,
        color: '#b4c3dd',
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 22,
    },
    voiceChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 16,
    },
    voiceChip: {
        minWidth: '31%',
        flexGrow: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 16,
        backgroundColor: 'rgba(10, 19, 36, 0.88)',
        borderWidth: 1,
        borderColor: 'rgba(118, 138, 174, 0.14)',
    },
    voiceChipLabel: {
        color: '#7389a8',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    voiceChipValue: { color: '#f8fbff', fontSize: 14, fontWeight: '800', marginTop: 4 },
    voiceInsightCard: {
        borderRadius: 24,
        padding: 18,
        backgroundColor: 'rgba(8, 15, 28, 0.96)',
        borderWidth: 1,
        borderColor: 'rgba(111, 131, 166, 0.14)',
        gap: 14,
    },
    voiceInsightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
    },
    voiceInsightLabel: {
        color: '#67e8f9',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    voiceInsightTitle: { color: '#f8fbff', fontSize: 22, fontWeight: '900', marginTop: 5 },
    analysisRiskPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
    analysisRiskPillText: { fontWeight: '900', fontSize: 13 },
    analysisNote: { color: '#a9bad5', fontSize: 14, lineHeight: 22 },
    metricsRow: { flexDirection: 'row', gap: 10 },
    metricCard: {
        flex: 1,
        padding: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(12, 24, 43, 0.94)',
        borderWidth: 1,
        borderColor: 'rgba(96, 116, 148, 0.12)',
    },
    metricLabel: {
        color: '#7389a8',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    metricValue: { color: '#f8fbff', fontSize: 16, fontWeight: '800', marginTop: 6 },
    replyCard: {
        borderRadius: 24,
        padding: 18,
        backgroundColor: 'rgba(12, 22, 43, 0.96)',
        borderWidth: 1,
        borderColor: 'rgba(92, 120, 163, 0.14)',
        gap: 12,
    },
    replyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    replyLabel: { color: '#f8fbff', fontSize: 16, fontWeight: '900' },
    replyAction: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(103, 232, 249, 0.12)',
    },
    replyActionText: { color: '#67e8f9', fontSize: 12, fontWeight: '800' },
    replyText: { color: '#dce7f7', fontSize: 15, lineHeight: 24 },
    voiceResourcesSection: { gap: 12 },
    sectionTitle: { color: '#f8fbff', fontSize: 18, fontWeight: '900' },
    voiceGuideCard: {
        borderRadius: 24,
        padding: 18,
        backgroundColor: 'rgba(8, 15, 28, 0.96)',
        borderWidth: 1,
        borderColor: 'rgba(111, 131, 166, 0.14)',
        gap: 10,
    },
    voiceGuideText: { color: '#b5c6df', fontSize: 14, lineHeight: 22 },
    voiceDisclaimer: { color: '#7d90ad', fontSize: 12, lineHeight: 18 },
    resourcesLoader: { marginTop: 44 },
    resourcesScroll: { paddingHorizontal: 16, paddingBottom: TAB_BAR_H + 16, gap: 12 },
    resourceCard: {
        backgroundColor: 'rgba(8, 15, 28, 0.96)',
        borderRadius: 18,
        padding: 14,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(114, 134, 170, 0.12)',
    },
    resourceCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    catBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    catBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    resourceTitle: { color: '#f8fbff', fontSize: 15, fontWeight: '800', flex: 1 },
    resourceDuration: { color: '#7c91af', fontSize: 12, fontWeight: '700' },
    resourceDesc: { color: '#a8bbd5', fontSize: 13, lineHeight: 20 },
    stepsBox: {
        backgroundColor: 'rgba(13, 25, 46, 0.92)',
        borderRadius: 14,
        padding: 12,
        gap: 6,
    },
    stepText: { color: '#d7e3f6', fontSize: 13, lineHeight: 20 },
    expandHint: { color: '#67e8f9', fontSize: 12, fontWeight: '700' },
    emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    emptyText: {
        color: '#7f92ae',
        textAlign: 'center',
        lineHeight: 22,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
});
