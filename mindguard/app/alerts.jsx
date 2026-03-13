import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AlertsScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Text style={styles.title}>Notifications</Text>
                <View style={styles.alertBox}>
                    <Text style={styles.alertText}>No new alerts at this time.</Text>
                </View>
                <Button title="Back" onPress={() => router.back()} color="gray" />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
    container: { flex: 1, paddingHorizontal: 20, paddingVertical: 24, backgroundColor: '#fff' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    alertBox: { padding: 15, backgroundColor: '#f8d7da', borderRadius: 8, marginBottom: 20 },
    alertText: { color: '#721c24' }
});