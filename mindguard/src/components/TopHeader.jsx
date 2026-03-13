import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function TopHeader({ title }) {
    return (
        <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 20, paddingTop: 50, backgroundColor: '#e0f7fa', alignItems: 'center' },
    title: { fontSize: 20, fontWeight: 'bold' }
});