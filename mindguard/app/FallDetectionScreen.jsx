import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomTabBar from '../src/components/BottomTabBar';

export default function FallDetectionScreen() {
    const router = useRouter();
    const [alertActive, setAlertActive] = useState(false);
    const [smsStatus, setSmsStatus] = useState(null);
    const [lastFallTime, setLastFallTime] = useState(null);

    // 🚨 UPDATE THIS TO YOUR LAPTOP'S IP ADDRESS
    const DJANGO_API_URL = 'http://192.168.137.1:8000/api/fall-detect/incidents/';

    // =========================================================
    // THE MAGIC HACKATHON TRICK: Check Django every 2 seconds
    // =========================================================
    useEffect(() => {
        const checkDjangoForFalls = async () => {
            if (alertActive) return; // Don't check if we are already ringing
            
            try {
                const response = await fetch(DJANGO_API_URL);
                if (response.ok) {
                    const data = await response.json();
                    
                    // If Django says there's a critical fall, AND it's a new one we haven't seen yet
                    if (data.alert === true && data.timestamp !== lastFallTime) {
                        setLastFallTime(data.timestamp); // Remember this fall so we don't ring twice for it
                        triggerLocalAlarm();
                    }
                }
            } catch (error) {
                // Silently fail if network is slow, it will try again in 2 seconds
            }
        };

        const intervalId = setInterval(checkDjangoForFalls, 2000); // 2000ms = 2 seconds
        return () => clearInterval(intervalId);
    }, [alertActive, lastFallTime]);

    // =========================================================

    const triggerLocalAlarm = () => {
        setAlertActive(true);
        // Vibrate pattern: wait 0, vibrate 500, wait 500, vibrate 500. True = loop infinitely!
        Vibration.vibrate([0, 500, 500, 500], true); 
    };

    const triggerManualSOS = async () => {
        setAlertActive(true);
        setSmsStatus('sending');
        Vibration.vibrate([0, 500, 500, 500], true); 

        try {
            const response = await fetch(DJANGO_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activity: "Manual SOS Button Pressed",
                    auto_alert_triggered: true,
                    severity: 'Critical',
                    source: 'mobile_app_sos'
                }),
            });
            if (response.ok) setSmsStatus('success');
            else setSmsStatus('error');
        } catch (error) {
            setSmsStatus('network_error');
        }
    };

    const resetAlert = () => {
        setAlertActive(false);
        setSmsStatus(null);
        Vibration.cancel(); // Stop the ringing!
    };

    return (
        <SafeAreaView style={[styles.container, alertActive ? styles.containerAlert : null]} edges={['top']}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={32} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.header}>
                <Text style={styles.headerTitle}>MindGuard</Text>
                <Text style={styles.subHeader}>Patient Companion App</Text>
            </View>

            <View style={[styles.card, alertActive ? styles.cardAlert : styles.cardNormal]}>
                <Text style={styles.statusText}>
                    {alertActive ? "🚨 FALL DETECTED / EMERGENCY 🚨" : "✅ ESP32 Wearable Connected\nMonitoring Live Data..."}
                </Text>

                {alertActive && smsStatus && (
                    <View style={styles.smsBox}>
                        {smsStatus === 'sending' && <Text style={styles.smsText}>📡 Alerting Emergency Contacts...</Text>}
                        {smsStatus === 'success' && <Text style={styles.smsTextSuccess}>✅ Family Notified via SMS!</Text>}
                    </View>
                )}
            </View>

            {!alertActive ? (
                <TouchableOpacity style={styles.btnSOS} onPress={triggerManualSOS}>
                    <Text style={styles.btnSOSText}>🚨 TAP FOR EMERGENCY SOS 🚨</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity style={styles.btnReset} onPress={resetAlert}>
                    <Text style={styles.btnText}>Dismiss Alarm & I am Safe</Text>
                </TouchableOpacity>
            )}
            <BottomTabBar active="FallDetectionScreen" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212', padding: 20, paddingBottom: 110, justifyContent: 'center' },
    containerAlert: { backgroundColor: '#4a0017' },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        padding: 10,
    },
    header: { marginBottom: 40 },
    headerTitle: { fontSize: 36, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center', marginBottom: 5 },
    subHeader: { fontSize: 16, color: '#A0A0A0', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
    card: { borderRadius: 15, padding: 30, marginBottom: 40, elevation: 10 },
    cardNormal: { backgroundColor: '#1E1E2C', borderWidth: 1, borderColor: '#8A2BE2' },
    cardAlert: { backgroundColor: '#9e0031', borderWidth: 2, borderColor: '#ff4d4d' },
    statusText: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center', lineHeight: 28 },
    smsBox: { marginTop: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 15, borderRadius: 8 },
    smsText: { color: '#FFA500', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
    smsTextSuccess: { color: '#00FF00', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
    btnSOS: { backgroundColor: '#D32F2F', padding: 25, borderRadius: 15, alignItems: 'center', elevation: 5 },
    btnSOSText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
    btnReset: { backgroundColor: '#121212', borderWidth: 2, borderColor: '#FFFFFF', padding: 20, borderRadius: 30, alignItems: 'center' },
    btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' }
});