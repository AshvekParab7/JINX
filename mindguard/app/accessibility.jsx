import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AccessibilityScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Text style={styles.title}>Accessibility</Text>
                <View style={styles.buttonContainer}>
                    <Button title="Sign Language to Text" onPress={() => { }} />
                </View>
                <View style={styles.buttonContainer}>
                    <Button title="Speech to Text" onPress={() => { }} />
                </View>
                <Button title="Back to Dashboard" onPress={() => router.replace('/dashboard')} color="gray" />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 24, backgroundColor: '#fff' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
    buttonContainer: { width: '100%', marginBottom: 15 }
});