import { router } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { requestNotificationPermission } from '../lib/notifications';
import { Sport, useAppStore } from '../lib/store';

const SPORTS: { key: Sport; label: string; emoji: string; color: string }[] = [
  { key: 'nfl', label: 'NFL', emoji: '🏈', color: '#1D3D7B' },
  { key: 'nba', label: 'NBA', emoji: '🏀', color: '#C35B10' },
  { key: 'mlb', label: 'MLB', emoji: '⚾', color: '#0D5A2A' },
  { key: 'nhl', label: 'NHL', emoji: '🏒', color: '#5A1A6B' },
  { key: 'soccer', label: 'Soccer / MLS', emoji: '⚽', color: '#2A5A1A' },
  { key: 'wnba', label: 'WNBA', emoji: '🏀', color: '#C35B10' },
  { key: 'ncaafb', label: 'College Football', emoji: '🏈', color: '#8B4513' },
  { key: 'ncaamb', label: 'College Basketball', emoji: '🏀', color: '#8B0000' },
  { key: 'golf', label: 'Golf', emoji: '⛳', color: '#2D5A1B' },
  { key: 'tennis', label: 'Tennis', emoji: '🎾', color: '#8B6914' },
  { key: 'f1', label: 'Formula 1', emoji: '🏎️', color: '#C00000' },
  { key: 'nascar', label: 'NASCAR', emoji: '🏁', color: '#FFD700' },
  { key: 'mma', label: 'MMA', emoji: '🥊', color: '#8B0000' },
  { key: 'boxing', label: 'Boxing', emoji: '🥊', color: '#4A0000' },
];

export default function Onboarding() {
  const { preferences, toggleSport, setPreferences, completeOnboarding } = useAppStore();

  const handleFinish = async () => {
    if (preferences.notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) setPreferences({ notificationsEnabled: false });
    }
    completeOnboarding();
    router.replace('/(tabs)/calendar');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your Sports Calendar</Text>
      <Text style={styles.subtitle}>
        Pick the sports you want to follow and we'll auto-fill your calendar with upcoming games.
      </Text>

      <Text style={styles.sectionLabel}>Choose your sports</Text>
      <View style={styles.sportsGrid}>
        {SPORTS.map((sport) => {
          const selected = preferences.sports.includes(sport.key);
          return (
            <TouchableOpacity
              key={sport.label}
              style={[styles.sportCard, selected && { backgroundColor: sport.color, borderColor: sport.color }]}
              onPress={() => toggleSport(sport.key)}
            >
              <Text style={styles.sportEmoji}>{sport.emoji}</Text>
              <Text style={[styles.sportLabel, selected && { color: '#fff' }]}>{sport.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Notifications</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Game reminders</Text>
        <Switch
          value={preferences.notificationsEnabled}
          onValueChange={(v) => setPreferences({ notificationsEnabled: v })}
        />
      </View>
      {preferences.notificationsEnabled && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Remind me</Text>
          <View style={styles.minuteOptions}>
            {[15, 30, 60].map((mins) => (
              <TouchableOpacity
                key={mins}
                style={[styles.minuteChip, preferences.notifyMinutesBefore === mins && styles.minuteChipSelected]}
                onPress={() => setPreferences({ notifyMinutesBefore: mins })}
              >
                <Text style={[styles.minuteChipLabel, preferences.notifyMinutesBefore === mins && { color: '#fff' }]}>
                  {mins}m before
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, preferences.sports.length === 0 && styles.buttonDisabled]}
        onPress={handleFinish}
        disabled={preferences.sports.length === 0}
      >
        <Text style={styles.buttonLabel}>Let's go →</Text>
      </TouchableOpacity>
      {preferences.sports.length === 0 && (
        <Text style={styles.hint}>Pick at least one sport to continue</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 72, paddingBottom: 48 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#666', lineHeight: 24, marginBottom: 32 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 8 },
  sportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  sportCard: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sportEmoji: { fontSize: 20 },
  sportLabel: { fontSize: 15, fontWeight: '500', color: '#222' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  rowLabel: { fontSize: 16, color: '#222' },
  minuteOptions: { flexDirection: 'row', gap: 8 },
  minuteChip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  minuteChipSelected: { backgroundColor: '#378ADD', borderColor: '#378ADD' },
  minuteChipLabel: { fontSize: 13, color: '#555' },
  button: { backgroundColor: '#378ADD', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 40 },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonLabel: { color: '#fff', fontSize: 17, fontWeight: '600' },
  hint: { textAlign: 'center', color: '#aaa', marginTop: 12, fontSize: 14 },
});