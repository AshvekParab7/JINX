import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { registerUser } from '../src/components/services/api';
import { COLORS, SHADOWS } from '../src/theme';

export default function SignupScreen() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [sms, setSms] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSignup = async () => {
        if (!name.trim() || !email.trim() || !password) {
            setError('Name, email, and password are required.');
            return;
        }

        setSubmitting(true);
        setError('');
        const result = await registerUser(name.trim(), email.trim(), password, sms.trim(), whatsapp.trim());
        setSubmitting(false);

        if (result?.token) {
            router.replace('/dashboard');
            return;
        }

        setError(result?.error || 'Unable to create account right now.');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                    <View style={[styles.blob, styles.blobPrimary]} />
                    <View style={[styles.blob, styles.blobSecondary]} />

                    <View style={styles.hero}>
                        <Text style={styles.kicker}>JOIN NOW</Text>
                        <Text style={styles.brand}>MindGuard</Text>
                        <Text style={styles.subtitle}>Your AI Health Companion</Text>
                    </View>

                    <View style={styles.card}>
                        {!!error && <Text style={styles.errorText}>{error}</Text>}

                        <Text style={styles.label}>Full Name *</Text>
                        <TextInput style={styles.input} placeholder="Rehan" placeholderTextColor={COLORS.textMuted} value={name} onChangeText={setName} />

                        <Text style={styles.label}>Email Address *</Text>
                        <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />

                        <Text style={styles.label}>Password *</Text>
                        <TextInput style={styles.input} placeholder="Create password" placeholderTextColor={COLORS.textMuted} secureTextEntry value={password} onChangeText={setPassword} />

                        <Text style={styles.sectionTitle}>Emergency Contacts (Optional)</Text>

                        <Text style={styles.label}>SMS Alert Number</Text>
                        <TextInput style={styles.input} placeholder="9890702314" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" value={sms} onChangeText={setSms} />

                        <Text style={styles.label}>WhatsApp Alert Number</Text>
                        <TextInput style={styles.input} placeholder="9890702314" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" value={whatsapp} onChangeText={setWhatsapp} />

                        <Pressable style={styles.primaryButton} onPress={handleSignup} disabled={submitting}>
                            {submitting ? <ActivityIndicator color={COLORS.textPrimary} /> : <Text style={styles.primaryButtonText}>Create Account</Text>}
                        </Pressable>

                        <Pressable onPress={() => router.push('/login')} style={styles.secondaryAction}>
                            <Text style={styles.secondaryText}>Already registered? Login</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.midnightViolet },
    flex: { flex: 1 },
    container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 32, backgroundColor: COLORS.midnightViolet, overflow: 'hidden' },
    hero: { marginBottom: 28, alignItems: 'center' },
    kicker: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '800', letterSpacing: 6, marginBottom: 14 },
    brand: { color: COLORS.textPrimary, fontSize: 48, fontWeight: '900' },
    subtitle: { color: COLORS.textSecondary, fontSize: 16, marginTop: 8 },
    card: { backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.border, borderRadius: 30, padding: 24, ...SHADOWS.glass },
    errorText: { color: COLORS.danger, fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
    sectionTitle: { color: '#ffb7c9', fontSize: 15, fontWeight: '800', textAlign: 'center', marginVertical: 18, letterSpacing: 1 },
    label: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 10, marginTop: 6, fontWeight: '600' },
    input: { backgroundColor: COLORS.inputBackground, borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 18, color: COLORS.textPrimary, fontSize: 18, paddingHorizontal: 18, paddingVertical: 18, marginBottom: 10 },
    primaryButton: { marginTop: 24, backgroundColor: COLORS.rubyRed, borderRadius: 20, paddingVertical: 18, alignItems: 'center', ...SHADOWS.button },
    primaryButtonText: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800' },
    secondaryAction: { marginTop: 20, alignItems: 'center' },
    secondaryText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
    blob: { position: 'absolute', borderRadius: 999 },
    blobPrimary: { width: 340, height: 340, top: -70, right: -80, backgroundColor: COLORS.rubyGlow },
    blobSecondary: { width: 280, height: 280, bottom: -120, left: -90, backgroundColor: 'rgba(140, 88, 255, 0.14)' },
});