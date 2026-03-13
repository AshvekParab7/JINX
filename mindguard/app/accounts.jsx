import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { listStoredAccounts, selectStoredAccount } from '../src/components/services/api';
import { COLORS, SHADOWS } from '../src/theme';

export default function AccountsScreen() {
    const router = useRouter();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pendingId, setPendingId] = useState(null);

    useEffect(() => {
        let mounted = true;

        const loadAccounts = async () => {
            const storedAccounts = await listStoredAccounts();
            if (mounted) {
                setAccounts(storedAccounts);
                setLoading(false);
            }
        };

        void loadAccounts();

        return () => {
            mounted = false;
        };
    }, []);

    const handleSelectAccount = async (accountId) => {
        setPendingId(accountId);
        const result = await selectStoredAccount(accountId);
        setPendingId(null);
        if (!result?.error) {
            router.replace('/dashboard');
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <View style={[styles.blob, styles.blobTop]} />
                <View style={[styles.blob, styles.blobBottom]} />

                <Text style={styles.kicker}>CHOOSE ACCOUNT</Text>
                <Text style={styles.title}>Continue with your account</Text>
                <Text style={styles.subtitle}>
                    Pick a saved account before the dashboard, or add another account without logging in from scratch again.
                </Text>

                {loading ? (
                    <ActivityIndicator color={COLORS.textPrimary} style={styles.loader} />
                ) : accounts.length ? (
                    <View style={styles.list}>
                        {accounts.map((account) => (
                            <Pressable
                                key={account.id}
                                style={styles.accountCard}
                                onPress={() => handleSelectAccount(account.id)}
                                disabled={pendingId === account.id}
                            >
                                <View style={styles.accountAvatar}>
                                    <Text style={styles.accountAvatarText}>{(account.user?.name || account.user?.email || 'A').charAt(0).toUpperCase()}</Text>
                                </View>
                                <View style={styles.accountInfo}>
                                    <Text style={styles.accountName}>{account.user?.name || 'Saved account'}</Text>
                                    <Text style={styles.accountEmail}>{account.user?.email}</Text>
                                </View>
                                {pendingId === account.id ? (
                                    <ActivityIndicator color={COLORS.textPrimary} />
                                ) : (
                                    <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                                )}
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyText}>No saved accounts found on this device yet.</Text>
                    </View>
                )}

                <Pressable style={styles.primaryButton} onPress={() => router.push('/login')}>
                    <Text style={styles.primaryButtonText}>Add or sign in another account</Text>
                </Pressable>

                <Pressable style={styles.secondaryButton} onPress={() => router.push('/signup')}>
                    <Text style={styles.secondaryButtonText}>Create new account</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.midnightViolet },
    container: { flexGrow: 1, padding: 24, paddingTop: 40, paddingBottom: 48, backgroundColor: COLORS.midnightViolet, overflow: 'hidden' },
    kicker: { color: '#ffb7c9', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
    title: { color: COLORS.textPrimary, fontSize: 30, fontWeight: '900', lineHeight: 36 },
    subtitle: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 24 },
    loader: { marginTop: 32 },
    list: { gap: 14, marginBottom: 24 },
    accountCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.glass, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.glass },
    accountAvatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.rubyRedSoft },
    accountAvatarText: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900' },
    accountInfo: { flex: 1 },
    accountName: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800' },
    accountEmail: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4 },
    emptyCard: { backgroundColor: COLORS.glass, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
    emptyText: { color: COLORS.textSecondary, lineHeight: 21 },
    primaryButton: { marginTop: 6, backgroundColor: COLORS.rubyRed, borderRadius: 20, paddingVertical: 17, alignItems: 'center', ...SHADOWS.button },
    primaryButtonText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
    secondaryButton: { marginTop: 12, borderRadius: 20, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(255,255,255,0.04)' },
    secondaryButtonText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '700' },
    blob: { position: 'absolute', borderRadius: 999 },
    blobTop: { width: 280, height: 280, top: -110, right: -60, backgroundColor: COLORS.rubyGlow },
    blobBottom: { width: 240, height: 240, bottom: 80, left: -110, backgroundColor: 'rgba(110, 56, 176, 0.14)' },
});