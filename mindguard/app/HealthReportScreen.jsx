import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HealthReportScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Text style={styles.title}>Health Report</Text>
                <View style={styles.chartArea}>
                    <Text>Stress Trends Chart</Text>
                </View>
                <View style={styles.chartArea}>
                    <Text>Activity Levels Chart</Text>
                </View>
                <Button title="Back" onPress={() => router.back()} color="gray" />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
    container: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 24, backgroundColor: '#fff' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    chartArea: { width: '100%', height: 150, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderRadius: 10 }
});