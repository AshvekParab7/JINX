import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CameraScreen() {
  // const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="camera-outline" size={36} color="#0F172A" />
          </View>

          <Text style={styles.title}>Camera Module</Text>
          <Text style={styles.body}>
            This route was pointing to a missing sign-language camera component, so the app could not bundle.
            The placeholder keeps navigation working until the actual camera experience is added back.
          </Text>

          <Pressable style={styles.button} onPress={() => router.replace('/dashboard')}>
            <Text style={styles.buttonText}>Back to dashboard</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

// const styles = StyleSheet.create({
//   safeArea: {
//     flex: 1,
//     backgroundColor: '#F8FAFC',
//   },
//   container: {
//     flex: 1,
//     paddingHorizontal: 20,
//     paddingVertical: 24,
//     justifyContent: 'center',
//     backgroundColor: '#F8FAFC',
//   },
//   card: {
//     backgroundColor: '#FFFFFF',
//     borderRadius: 24,
//     padding: 24,
//     borderWidth: 1,
//     borderColor: '#E2E8F0',
//   },
//   iconWrap: {
//     width: 68,
//     height: 68,
//     borderRadius: 20,
//     backgroundColor: '#E0F2FE',
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginBottom: 18,
//   },
//   title: {
//     fontSize: 26,
//     fontWeight: '800',
//     color: '#0F172A',
//     marginBottom: 12,
//   },
//   body: {
//     fontSize: 15,
//     lineHeight: 22,
//     color: '#475569',
//     marginBottom: 20,
//   },
//   button: {
//     alignSelf: 'flex-start',
//     backgroundColor: '#0F766E',
//     borderRadius: 14,
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//   },
//   buttonText: {
//     color: '#FFFFFF',
//     fontWeight: '700',
//   },
// });