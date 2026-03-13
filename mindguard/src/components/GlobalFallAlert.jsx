import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';

export default function GlobalFallAlert() {
    const [alertActive, setAlertActive] = useState(false);
    const [lastFallTime, setLastFallTime] = useState(null);

    // 🚨 VERIFY THIS IP ADDRESS! It must be your laptop's current IP.
    const DJANGO_API_URL = 'http://10.55.184.35:8000/api/fall-detect/incidents/';

    useEffect(() => {
        // Just to prove the component is actually loading on the screen
        console.log("🟢 GlobalFallAlert component mounted and running!");

        const checkDjangoForFalls = async () => {
            if (alertActive) return; 
            
            try {
                console.log("📡 Pinging Django..."); // Let's see if it's actually asking
                const response = await fetch(DJANGO_API_URL);
                
                if (response.ok) {
                    const jsonData = await response.json();
                    console.log("📨 Django replied:", jsonData); // Let's see what Django says!
                    
                    // Handle array response (new backend) or object response (old backend/fallback)
                    const data = Array.isArray(jsonData) ? jsonData[0] : jsonData;

                    if (data && data.alert === true && data.timestamp !== lastFallTime) {
                        console.log("🚨 TRIGGERING RED SCREEN NOW!");
                        setLastFallTime(data.timestamp);
                        setAlertActive(true);
                        Vibration.vibrate([0, 500, 500, 500], true); 
                    }
                } else {
                    console.log("❌ Django responded with error status:", response.status);
                }
            } catch (error) {
                console.log("🛑 Network Error (Is the IP wrong?):", error.message);
            }
        };

        const intervalId = setInterval(checkDjangoForFalls, 2000);
        return () => clearInterval(intervalId);
    }, [alertActive, lastFallTime]);

    const dismissAlert = () => {
        setAlertActive(false);
        Vibration.cancel(); 
    };

    return (
        <Modal visible={alertActive} animationType="slide" transparent={false}>
            <View style={styles.containerAlert}>
                <Text style={styles.headerTitle}>🚨 EMERGENCY 🚨</Text>
                <View style={styles.card}>
                    <Text style={styles.statusText}>A CRITICAL FALL WAS DETECTED!</Text>
                    <Text style={styles.subText}>The wearable registered a severe impact.</Text>
                </View>
                <View style={styles.smsBox}>
                    <Text style={styles.smsTextSuccess}>✅ SMS Alert sent to Family!</Text>
                </View>
                <TouchableOpacity style={styles.btnReset} onPress={dismissAlert}>
                    <Text style={styles.btnText}>DISMISS ALARM</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    containerAlert: { flex: 1, backgroundColor: '#9e0031', padding: 20, justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
    headerTitle: { fontSize: 40, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', marginBottom: 30 },
    card: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 30, borderRadius: 15, marginBottom: 30, width: '100%', alignItems: 'center' },
    statusText: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center', marginBottom: 10 },
    subText: { fontSize: 16, color: '#E0E0E0', textAlign: 'center' },
    smsBox: { backgroundColor: '#1E1E2C', padding: 20, borderRadius: 10, marginBottom: 50, borderWidth: 2, borderColor: '#00FF00', width: '100%' },
    smsTextSuccess: { color: '#00FF00', textAlign: 'center', fontWeight: 'bold', fontSize: 18 },
    btnReset: { backgroundColor: '#121212', borderWidth: 2, borderColor: '#FFFFFF', padding: 20, borderRadius: 30, width: '100%', alignItems: 'center' },
    btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});