import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function CustomButton({ title, onPress, color = '#007BFF' }) {
    return (
        <TouchableOpacity style={[styles.button, { backgroundColor: color }]} onPress={onPress}>
            <Text style={styles.buttonText}>{title}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: { padding: 15, borderRadius: 8, alignItems: 'center', marginVertical: 10, width: '100%' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});