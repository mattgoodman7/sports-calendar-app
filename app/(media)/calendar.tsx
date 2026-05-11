import { useQueries, useQuery } from '@tanstack/react-query';
import { addMonths, format, getDay, getDaysInMonth, parseISO, startOfMonth, subMonths } from 'date-fns';
import { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { posterUrl, fetchSeasonDetail } from '../../lib/tmdb';
import { TrackedMovie, TrackedShow, useMediaStore } from '../../lib/mediaStore';

const PURPLE    = '#A78BFA';
const DARK      = '#0a0a0a';
const CARD      = '#141414';
const BORDER    = '#222';
const SCREEN_W  = Dimensions.get('window').width;
const SCREEN_H  = Dimensions.get('window').height;
const DAY_LABELS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GRID_RESERVE = 180;
const MAX_WEEKS    = 6;
const CELL_HEIGHT  = Math.floor((SCREEN_H - GRID_RESERVE) / MAX_WEEKS);

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'theater' | 'streaming' | 'episode';

interface CalendarEvent {
  id: string;
  date: string;
  type: EventType;
  title: string;
  subtitle: string;
  posterPath: string | null;
  mediaId: number;
  mediaType: 'movie' | 'tv';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eventColor(type: EventType): string {
  if (type === 'theater')   return '#EF4444';
  if (type === 'streaming') return '#A78BFA';
  return '#34D399';
}

function eventIcon(type: EventType): string {
  if (type === 'theater')   return '🎭';
  if (type === 'streaming') return '📺';
  return '📡';
}

// ─── Build calendar events ────────────────────────────────────────────────────

function buildCalendarEvents(
  movies: TrackedMovie[],
  shows: TrackedShow[],
  allEpisodesByShow: Record<number, { date: string; season: number; episode: number; name: string }[]>,
): Record<string, CalendarEvent[]> {
  const events: Record<string, CalendarEvent[]> = {};

  const addEvent = (event: CalendarEvent) => {
    if (!event.date) return;
    if (!events[event.date]) events[event.date] = [];
    events[event.date].push(event);
  };

  // Movies
  for (const movie of movies) {
    if (movie.releaseDate) {
      addEvent({
        id: `movie-theater-${movie.id}`,
        date: movie.releaseDate,
        type: 'theater',
        title: movie.title,
        subtitle: 'In Theaters',
        posterPath: movie.posterPath,
        mediaId: movie.id,
        mediaType: 'movie',
      });
    }
    if (movie.streamingDate) {
      addEvent({
        id: `movie-streaming-${movie.id}`,
        date: movie.streamingDate,
        type: 'streaming',
        title: movie.title,
        subtitle: 'Now Streaming',
        posterPath: movie.posterPath,
        mediaId: movie.id,
        mediaType: 'movie',
      });
    }
  }

  // TV — all episodes
  for (const show of shows) {
    const episodes = allEpisodesByShow[show.id] ?? [];
    for (const ep of episodes) {
      addEvent({
        id: `show-ep-${show.id}-s${ep.season}e${ep.episode}`,
        date: ep.date,
        type: 'episode',
        title: show.name,
        subtitle: `S${ep.season}E${ep.episode}${ep.name ? ' · ' + ep.name : ''}`,
        posterPath: show.posterPath,
        mediaId: show.id,
        mediaType: 'tv',
      });
    }
  }

  return events;
}

// ─── Month Picker Modal ───────────────────────────────────────────────────────

function MonthPickerModal({
  visible, current, onSelect, onClose,
}: {
  visible: boolean; current: Date; onSelect: (date: Date) => void; onClose: () => void;
}) {
  const today = new Date();
  const [pickerYear, setPickerYear] = useState(current.getFullYear());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.pickerContainer}>
          <View style={styles.pickerYearRow}>
            <TouchableOpacity onPress={() => setPickerYear(y => y - 1)} style={styles.pickerYearBtn}>
              <Text style={styles.pickerArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.pickerYearText}>{pickerYear}</Text>
            <TouchableOpacity onPress={() => setPickerYear(y => y + 1)} style={styles.pickerYearBtn}>
              <Text style={styles.pickerArrow}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.pickerGrid}>
            {MONTH_NAMES.map((name, idx) => {
              const isSelected = idx === current.getMonth() && pickerYear === current.getFullYear();
              const isToday_   = idx === today.getMonth() && pickerYear === today.getFullYear();
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.pickerCell, isSelected && styles.pickerCellSelected, !isSelected && isToday_ && styles.pickerCellToday]}
                  onPress={() => { onSelect(new Date(pickerYear, idx, 1)); onClose(); }}
                >
                  <Text style={[styles.pickerCellText, isSelected && styles.pickerCellTextSelected, !isSelected && isToday_ && styles.pickerCellTextToday]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.pickerCancelBtn}>
            <Text style={styles.pickerCancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Day Detail ───────────────────────────────────────────────────────────────

function DayDetail({ date, events }: { date: string; events: CalendarEvent[] }) {
  return (
    <View style={styles.dayDetail}>
      <Text style={styles.dayDetailTitle}>
        {format(parseISO(date), 'EEEE, MMMM d')}
      </Text>
      {events.length === 0 ? (
        <Text style={styles.noEvents}>Nothing scheduled</Text>
      ) : (
        events.map(event => (
          <View key={event.id} style={styles.eventRow}>
            {event.posterPath ? (
              <Image source={{ uri: posterUrl(event.posterPath, 'w185') ?? '' }} style={styles.eventPoster} />
            ) : (
              <View style={[styles.eventPoster, styles.noPoster]}>
                <Text style={{ fontSize: 20 }}>{event.mediaType === 'movie' ? '🎬' : '📺'}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <View style={styles.eventTypeRow}>
                <Text style={styles.eventTypeIcon}>{eventIcon(event.type)}</Text>
                <Text style={[styles.eventTypeLabel, { color: eventColor(event.type) }]}>
                  {event.subtitle}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MediaCalendarScreen() {
  const [current, setCurrent]                 = useState(new Date());
  const [selectedDate, setSelectedDate]       = useState<string | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const { trackedMovies, trackedShows } = useMediaStore();
  const movies = Object.values(trackedMovies);
  const shows  = Object.values(trackedShows);

  // Fetch all seasons for all tracked shows
  const seasonQueries = useQueries({
    queries: shows.flatMap(show =>
      Array.from({ length: show.totalSeasons }, (_, i) => i + 1).map(seasonNum => ({
        queryKey: ['season', show.id, seasonNum],
        queryFn: () => fetchSeasonDetail(show.id, seasonNum),
        staleTime: 1000 * 60 * 60, // 1 hour
      }))
    ),
  });

  const isLoadingSeasons = seasonQueries.some(q => q.isLoading);

  // Build a map of showId → all episodes with air dates
  const allEpisodesByShow: Record<number, { date: string; season: number; episode: number; name: string }[]> = {};
  let queryIdx = 0;
  for (const show of shows) {
    allEpisodesByShow[show.id] = [];
    for (let s = 1; s <= show.totalSeasons; s++) {
      const result = seasonQueries[queryIdx++];
      if (result?.data?.episodes) {
        for (const ep of result.data.episodes) {
          if (ep.airDate) {
            allEpisodesByShow[show.id].push({
              date: ep.airDate,
              season: ep.seasonNumber,
              episode: ep.episodeNumber,
              name: ep.name,
            });
          }
        }
      }
    }
  }

  const year           = current.getFullYear();
  const month          = current.getMonth();
  const daysInMonth    = getDaysInMonth(current);
  const firstDayOfWeek = getDay(startOfMonth(current));
  const today          = format(new Date(), 'yyyy-MM-dd');

  const allEvents    = buildCalendarEvents(movies, shows, allEpisodesByShow);
  const eventsByDate = Object.fromEntries(
    Object.entries(allEvents).filter(([date]) => {
      const d = parseISO(date);
      return d.getFullYear() === year && d.getMonth() === month;
    })
  );

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── Month header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setCurrent(subMonths(current, 1)); setSelectedDate(null); }}>
            <Text style={styles.navBtn}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMonthPicker(true)} style={styles.monthTitleBtn}>
            <Text style={styles.monthTitle}>{format(current, 'MMMM yyyy')}</Text>
            <Text style={styles.monthCaret}>▾</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setCurrent(addMonths(current, 1)); setSelectedDate(null); }}>
            <Text style={styles.navBtn}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Loading indicator ── */}
        {isLoadingSeasons && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={PURPLE} size="small" />
            <Text style={styles.loadingText}>Loading episode data...</Text>
          </View>
        )}

        {/* ── Legend ── */}
        <View style={styles.legend}>
          {(['theater', 'streaming', 'episode'] as EventType[]).map(type => (
            <View key={type} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: eventColor(type) }]} />
              <Text style={styles.legendLabel}>
                {type === 'theater' ? '🎭 In Theaters' : type === 'streaming' ? '🎬 Streaming Release' : '📺 New Episode'}              </Text>
            </View>
          ))}
        </View>

        {/* ── Day labels ── */}
        <View style={styles.dayLabels}>
          {DAY_LABELS.map(d => (
            <Text key={d} style={styles.dayLabel}>{d}</Text>
          ))}
        </View>

        {/* ── Grid ── */}
        <View style={styles.grid}>
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <View key={`empty-${i}`} style={[styles.cell, { height: CELL_HEIGHT }]} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day      = i + 1;
            const dateStr  = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const events   = eventsByDate[dateStr] ?? [];
            const isToday_ = dateStr === today;
            const isSelected = dateStr === selectedDate;

            return (
              <TouchableOpacity
                key={day}
                style={[styles.cell, { height: CELL_HEIGHT }, isSelected && styles.cellSelected]}
                onPress={() => setSelectedDate(isSelected ? null : dateStr)}
              >
                <View style={[styles.dayNum, isToday_ && styles.dayNumToday]}>
                  <Text style={[styles.dayNumText, isToday_ && { color: '#fff' }]}>{day}</Text>
                </View>
                {events.slice(0, 3).map(event => (
                  <View key={event.id} style={[styles.pill, { backgroundColor: eventColor(event.type) }]}>
                    <Text style={styles.pillText} numberOfLines={1}>{event.title}</Text>
                  </View>
                ))}
                {events.length > 3 && (
                  <Text style={styles.moreText}>+{events.length - 3}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Day detail ── */}
        {selectedDate && (
          <DayDetail date={selectedDate} events={eventsByDate[selectedDate] ?? []} />
        )}

        {/* ── Empty state ── */}
        {movies.length === 0 && shows.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyTitle}>Nothing to show yet</Text>
            <Text style={styles.emptySubtitle}>Add movies and TV shows in your Library to see their release dates here</Text>
          </View>
        )}

      </ScrollView>

      <MonthPickerModal
        visible={showMonthPicker}
        current={current}
        onSelect={(date) => { setCurrent(date); setSelectedDate(null); }}
        onClose={() => setShowMonthPicker(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: DARK },
  scrollContent: { paddingBottom: 40 },

  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  navBtn:        { fontSize: 28, color: PURPLE, paddingHorizontal: 8 },
  monthTitleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthTitle:    { fontSize: 20, fontWeight: '600', color: '#fff' },
  monthCaret:    { fontSize: 13, color: PURPLE, marginTop: 2 },

  loadingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 },
  loadingText: { fontSize: 13, color: '#666' },

  legend:      { flexDirection: 'row', paddingHorizontal: 6, gap: 0, marginBottom: 8 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: '#666' },

  dayLabels: { flexDirection: 'row', paddingHorizontal: 4 },
  dayLabel:  { flex: 1, textAlign: 'center', fontSize: 11, color: '#555', fontWeight: '500', paddingVertical: 4 },

  grid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  cell:         { width: '14.28%', padding: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1a1a1a' },
  cellSelected: { backgroundColor: '#1a1a2e' },
  dayNum:       { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  dayNumToday:  { backgroundColor: '#378ADD', borderRadius: 11 },
  dayNumText:   { fontSize: 12, fontWeight: '500', color: '#888' },
  pill:         { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginBottom: 2 },
  pillText:     { fontSize: 8, color: '#fff' },
  moreText:     { fontSize: 8, color: '#555' },

  dayDetail:      { margin: 16, backgroundColor: CARD, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER },
  dayDetailTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  noEvents:       { color: '#555', fontSize: 14, textAlign: 'center', paddingVertical: 8 },

  eventRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  eventPoster:    { width: 40, height: 60, borderRadius: 6, backgroundColor: '#1a1a1a' },
  noPoster:       { alignItems: 'center', justifyContent: 'center' },
  eventTitle:     { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 4 },
  eventTypeRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventTypeIcon:  { fontSize: 12 },
  eventTypeLabel: { fontSize: 12, fontWeight: '600' },

  emptyState:    { alignItems: 'center', paddingTop: 48, paddingHorizontal: 40 },
  emptyEmoji:    { fontSize: 48, marginBottom: 16 },
  emptyTitle:    { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20 },

  pickerBackdrop:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  pickerContainer:         { backgroundColor: '#1a1a1a', borderRadius: 20, padding: 24, width: SCREEN_W - 64, borderWidth: 1, borderColor: BORDER },
  pickerYearRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  pickerYearBtn:           { padding: 8 },
  pickerArrow:             { fontSize: 28, color: PURPLE, lineHeight: 32 },
  pickerYearText:          { fontSize: 22, fontWeight: '700', color: '#fff' },
  pickerGrid:              { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  pickerCell:              { width: '22%', paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#222' },
  pickerCellSelected:      { backgroundColor: PURPLE },
  pickerCellToday:         { backgroundColor: '#1a1a2e', borderWidth: 1.5, borderColor: PURPLE },
  pickerCellText:          { fontSize: 14, fontWeight: '500', color: '#888' },
  pickerCellTextSelected:  { color: '#fff', fontWeight: '700' },
  pickerCellTextToday:     { color: PURPLE, fontWeight: '600' },
  pickerCancelBtn:         { marginTop: 20, alignItems: 'center', paddingVertical: 10 },
  pickerCancelText:        { fontSize: 15, color: '#555' },
});
