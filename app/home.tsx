import { router } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <View style={styles.titleBlock}>
          <Text style={styles.appName}>Slate</Text>
          <Text style={styles.subtitle}>Your personal calendar</Text>
        </View>

        <View style={styles.cards}>

          {/* Sports */}
          <TouchableOpacity
            style={[styles.card, styles.cardSports]}
            onPress={() => router.push('/(tabs)/calendar')}
            activeOpacity={0.85}
          >
            <Text style={styles.cardEmoji}>🏆</Text>
            <Text style={styles.cardTitle}>Sports</Text>
            <Text style={styles.cardDesc}>Games, drafts & schedules for all your teams</Text>
            <View style={styles.cardArrow}>
              <Text style={styles.cardArrowText}>→</Text>
            </View>
          </TouchableOpacity>

          {/* Movies & TV */}
          <TouchableOpacity
            style={[styles.card, styles.cardMedia]}
            onPress={() => router.push('/(media)/library')}
            activeOpacity={0.85}
          >
            <Text style={styles.cardEmoji}>🎬</Text>
            <Text style={styles.cardTitle}>Movies & TV</Text>
            <Text style={styles.cardDesc}>Track shows, movies and where to watch them</Text>
            <View style={styles.cardArrow}>
              <Text style={styles.cardArrowText}>→</Text>
            </View>
          </TouchableOpacity>

        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },

  titleBlock: { alignItems: 'center', marginBottom: 48 },
  appName:    { fontSize: 48, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  subtitle:   { fontSize: 16, color: '#888', marginTop: 6 },

  cards: { gap: 16 },

  card: {
    borderRadius: 20,
    padding: 28,
    paddingBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  cardSports: { backgroundColor: '#1A3A6B' },
  cardMedia:  { backgroundColor: '#3D1A6B' },

  cardEmoji: { fontSize: 36, marginBottom: 12 },
  cardTitle: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 6 },
  cardDesc:  { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 20, maxWidth: 260 },

  cardArrow:     { position: 'absolute', bottom: 24, right: 24 },
  cardArrowText: { fontSize: 22, color: 'rgba(255,255,255,0.5)' },
});
