import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGames } from '../../hooks/useGames';
import { Sport, SportEvent } from '../../lib/store';

const SPORT_COLORS: Record<Sport, string> = {
  nfl: '#1D3D7B',
  nba: '#C35B10',
  mlb: '#0D5A2A',
  nhl: '#5A1A6B',
  soccer: '#2A5A1A',
};

function dateLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEEE, MMMM d');
}

export default function ScheduleScreen() {
  const now = new Date();
  const { events, isLoading } = useGames(now.getFullYear(), now.getMonth());

  const today = format(now, 'yyyy-MM-dd');
  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const grouped: { date: string; events: SportEvent[] }[] = [];
  for (const e of upcoming) {
    const last = grouped[grouped.length - 1];
    if (last && last.date === e.date) {
      last.events.push(e);
    } else {
      grouped.push({ date: e.date, events: [e] });
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#378ADD" />
        <Text style={styles.loadingText}>Fetching games...</Text>
      </SafeAreaView>
    );
  }

  if (upcoming.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyEmoji}>🏟️</Text>
        <Text style={styles.emptyTitle}>No upcoming games</Text>
        <Text style={styles.emptySubtitle}>Check your preferences or add games manually.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.header}>Upcoming Games</Text>
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.date}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View style={styles.group}>
            <Text style={styles.groupDate}>{dateLabel(item.date)}</Text>
            {item.events.map((e) => (
              <View key={e.id} style={styles.card}>
                <View style={[styles.sportBar, { backgroundColor: SPORT_COLORS[e.sport] }]} />
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{e.name}</Text>
                  {(e.time || e.channel) && (
                    <Text style={styles.cardMeta}>{[e.time, e.channel].filter(Boolean).join(' · ')}</Text>
                  )}
                </View>
                <Text style={styles.cardSport}>{e.sport.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { fontSize: 24, fontWeight: '700', padding: 20, paddingBottom: 8 },
  loadingText: { marginTop: 12, color: '#999' },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  group: { paddingHorizontal: 20, marginBottom: 8 },
  groupDate: { fontSize: 13, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  sportBar: { width: 5, alignSelf: 'stretch' },
  cardContent: { flex: 1, padding: 12 },
  cardTitle: { fontSize: 15, fontWeight: '500', color: '#111' },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 3 },
  cardSport: { fontSize: 10, fontWeight: '700', color: '#ccc', paddingRight: 12 },
});