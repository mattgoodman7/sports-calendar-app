import { addMonths, format, isToday, isTomorrow, parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGames } from '../../hooks/useGames';
import { Sport, SportEvent, useAppStore } from '../../lib/store';

const SPORT_COLORS: Record<Sport, string> = {
  nfl:    '#1D3D7B',
  nba:    '#C35B10',
  mlb:    '#0D5A2A',
  nhl:    '#5A1A6B',
  soccer: '#2A5A1A',
  wnba:   '#E4603A',
  ncaafb: '#8B2000',
  ncaamb: '#005EB8',
  golf:   '#2D6A2D',
  tennis: '#C8A800',
  f1:     '#E10600',
  nascar: '#FFB700',
  mma:    '#B22222',
  boxing: '#8B0000',
};

const SPORT_LABELS: Record<Sport, string> = {
  nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL', soccer: 'Soccer',
  wnba: 'WNBA', ncaafb: 'CFB', ncaamb: 'CBB',
  golf: 'Golf', tennis: 'Tennis', f1: 'F1', nascar: 'NASCAR', mma: 'MMA', boxing: 'Boxing',
};

function dateLabel(dateStr: string): string {
  const d = parseISO(dateStr + 'T00:00:00');
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEEE, MMMM d');
}

export default function ScheduleScreen() {
  const now = new Date();
  const [activeFilter, setActiveFilter] = useState<Sport | 'all'>('all');
  const enabledSports = useAppStore((s) => s.preferences.sports);

  // Load this month and next so there's always plenty of games
  const thisMonth = useGames(now.getFullYear(), now.getMonth());
  const nextMonthDate = addMonths(now, 1);
  const nextMonth = useGames(nextMonthDate.getFullYear(), nextMonthDate.getMonth());

  const isLoading = thisMonth.isLoading || nextMonth.isLoading;
  const allEvents = useMemo(
    () => [...(thisMonth.events ?? []), ...(nextMonth.events ?? [])],
    [thisMonth.events, nextMonth.events]
  );

  const today = format(now, 'yyyy-MM-dd');

  const upcoming = useMemo(() => {
    return allEvents
      .filter((e) => e.date >= today)
      .filter((e) => activeFilter === 'all' || e.sport === activeFilter)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
  }, [allEvents, today, activeFilter]);

  const grouped = useMemo(() => {
    const result: { date: string; events: SportEvent[] }[] = [];
    for (const e of upcoming) {
      const last = result[result.length - 1];
      if (last && last.date === e.date) {
        last.events.push(e);
      } else {
        result.push({ date: e.date, events: [e] });
      }
    }
    return result;
  }, [upcoming]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#378ADD" />
        <Text style={styles.loadingText}>Fetching games...</Text>
      </SafeAreaView>
    );
  }

  if (upcoming.length === 0 && !isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.header}>Schedule</Text>
        <FilterBar active={activeFilter} sports={enabledSports} onSelect={setActiveFilter} />
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🏟️</Text>
          <Text style={styles.emptyTitle}>No upcoming games</Text>
          <Text style={styles.emptySubtitle}>
            {activeFilter !== 'all'
              ? `No ${SPORT_LABELS[activeFilter]} games coming up.`
              : 'Check your preferences or add games manually.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.header}>Schedule</Text>
      <FilterBar active={activeFilter} sports={enabledSports} onSelect={setActiveFilter} />
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.date}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View style={styles.group}>
            <Text style={styles.groupDate}>{dateLabel(item.date)}</Text>
            {item.events.map((e) => (
              <GameCard key={e.id} event={e} />
            ))}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function FilterBar({
  active,
  sports,
  onSelect,
}: {
  active: Sport | 'all';
  sports: Sport[];
  onSelect: (s: Sport | 'all') => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterBar}
      contentContainerStyle={styles.filterBarContent}
    >
      <TouchableOpacity
        style={[styles.chip, active === 'all' && styles.chipActive]}
        onPress={() => onSelect('all')}
      >
        <Text style={[styles.chipText, active === 'all' && styles.chipTextActive]}>All</Text>
      </TouchableOpacity>
      {sports.map((s) => (
        <TouchableOpacity
          key={s}
          style={[styles.chip, active === s && { backgroundColor: SPORT_COLORS[s], borderColor: SPORT_COLORS[s] }]}
          onPress={() => onSelect(s)}
        >
          <Text style={[styles.chipText, active === s && styles.chipTextActive]}>
            {SPORT_LABELS[s]}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function GameCard({ event: e }: { event: SportEvent }) {
  const color = SPORT_COLORS[e.sport];
  return (
    <View style={styles.card}>
      <View style={[styles.sportBar, { backgroundColor: color }]} />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{e.name}</Text>
        <View style={styles.cardMetaRow}>
          {e.time && <Text style={styles.cardMeta}>{e.time}</Text>}
          {e.time && e.channel && <Text style={styles.cardMetaDot}>·</Text>}
          {e.channel && <Text style={styles.cardMeta}>{e.channel}</Text>}
          {e.venue && (e.time || e.channel) && <Text style={styles.cardMetaDot}>·</Text>}
          {e.venue && <Text style={styles.cardMeta} numberOfLines={1}>{e.venue}</Text>}
        </View>
      </View>
      <View style={[styles.sportBadge, { backgroundColor: color + '22' }]}>
        <Text style={[styles.sportBadgeText, { color }]}>{SPORT_LABELS[e.sport]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { fontSize: 24, fontWeight: '700', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  loadingText: { marginTop: 12, color: '#999' },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  filterBar: { flexGrow: 0 },
  filterBarContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 12, fontWeight: '500', color: '#555' },
  chipTextActive: { color: '#fff' },
  group: { paddingHorizontal: 20, marginBottom: 4 },
  groupDate: { fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 20 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee', borderRadius: 12, marginBottom: 8, overflow: 'hidden', backgroundColor: '#fff' },
  sportBar: { width: 4, alignSelf: 'stretch' },
  cardContent: { flex: 1, padding: 12 },
  cardTitle: { fontSize: 15, fontWeight: '500', color: '#111', marginBottom: 3 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  cardMeta: { fontSize: 12, color: '#888' },
  cardMetaDot: { fontSize: 12, color: '#ccc' },
  sportBadge: { marginRight: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  sportBadgeText: { fontSize: 10, fontWeight: '700' },
});