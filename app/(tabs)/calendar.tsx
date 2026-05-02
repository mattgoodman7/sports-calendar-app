import { addMonths, format, getDay, getDaysInMonth, startOfMonth, subMonths } from 'date-fns';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_HEIGHT = 56;
const START_HOUR = 8;
const END_HOUR = 24;

function parseTimeToHour(time?: string): number {
  if (!time) return 12;
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 12;
  let hour = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const isPM = match[3].toUpperCase() === 'PM';
  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;
  return hour + minutes / 60;
}

function TimelineView({ events }: { events: SportEvent[] }) {
  const scrollRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState(300);
  const totalHours = END_HOUR - START_HOUR;
  const timelineHeight = totalHours * HOUR_HEIGHT;
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => START_HOUR + i);

  const firstEventHour = events.length > 0
    ? Math.min(...events.map(e => parseTimeToHour(e.time)))
    : 12;
  const scrollTo = Math.max((firstEventHour - START_HOUR - 1) * HOUR_HEIGHT, 0);

  const EVENT_DURATION = 2;
  const positioned = (() => {
    const cols: { event: SportEvent; col: number; totalCols: number }[] = [];
    const columns: number[] = [];

    for (const event of [...events].sort((a, b) =>
      parseTimeToHour(a.time) - parseTimeToHour(b.time)
    )) {
      const startHour = parseTimeToHour(event.time);
      const endHour = startHour + EVENT_DURATION;
      let col = columns.findIndex((colEnd) => colEnd <= startHour);
      if (col === -1) col = columns.length;
      columns[col] = endHour;
      cols.push({ event, col, totalCols: 0 });
    }

    const totalCols = columns.length;
    return cols.map((item) => ({ ...item, totalCols }));
  })();

  const LEFT_OFFSET = 48;
  const RIGHT_MARGIN = 4;

  return (
    <ScrollView
      ref={scrollRef}
      style={{ maxHeight: 420 }}
      showsVerticalScrollIndicator={false}
      onLayout={() => scrollRef.current?.scrollTo({ y: scrollTo, animated: false })}
    >
      <View
        style={{ height: timelineHeight, position: 'relative' }}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {hours.map((hour) => (
          <View
            key={hour}
            style={{
              position: 'absolute',
              top: (hour - START_HOUR) * HOUR_HEIGHT,
              left: 0,
              right: 0,
              flexDirection: 'row',
              alignItems: 'flex-start',
            }}
          >
            <Text style={tlStyles.hourLabel}>
              {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
            </Text>
            <View style={tlStyles.hourLine} />
          </View>
        ))}

        {positioned.map(({ event: e, col, totalCols }) => {
          const startHour = parseTimeToHour(e.time);
          const clampedHour = Math.min(Math.max(startHour, START_HOUR), END_HOUR - 1);
          const top = (clampedHour - START_HOUR) * HOUR_HEIGHT;
          const color = SPORT_COLORS[e.sport] ?? '#888';
          const availableWidth = containerWidth - LEFT_OFFSET - RIGHT_MARGIN;
          const colWidth = (availableWidth - (totalCols - 1) * 2) / totalCols;
          const colLeft = LEFT_OFFSET + col * (colWidth + 2);

          return (
            <View
              key={e.id}
              style={[tlStyles.eventBlock, {
                top,
                left: colLeft,
                width: colWidth,
                backgroundColor: color + '18',
                borderLeftColor: color,
              }]}
            >
              <Text style={[tlStyles.eventSport, { color }]}>{SPORT_LABELS[e.sport]}</Text>
              <Text style={tlStyles.eventName} numberOfLines={2}>{e.name}</Text>
              {(e.time || e.channel) && (
                <Text style={tlStyles.eventMeta} numberOfLines={1}>
                  {[e.time, e.channel].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export default function CalendarScreen() {
  const [current, setCurrent] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: '', sport: 'nba' as Sport, time: '', note: '' });

  const { eventsByDate, isLoading } = useGames(current.getFullYear(), current.getMonth());
  const addCustomEvent = useAppStore((s) => s.addCustomEvent);

  const year = current.getFullYear();
  const month = current.getMonth();
  const daysInMonth = getDaysInMonth(current);
  const firstDayOfWeek = getDay(startOfMonth(current));
  const today = format(new Date(), 'yyyy-MM-dd');

  const handleAddEvent = () => {
    if (!newEvent.name.trim() || !selectedDate) return;
    addCustomEvent({
      id: `custom-${Date.now()}`,
      name: newEvent.name.trim(),
      sport: newEvent.sport,
      date: selectedDate,
      time: newEvent.time,
      channel: newEvent.note,
      isCustom: true,
    });
    setShowAddModal(false);
    setNewEvent({ name: '', sport: 'nba', time: '', note: '' });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView scrollEnabled={!selectedDate}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrent(subMonths(current, 1))}>
            <Text style={styles.navBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{format(current, 'MMMM yyyy')}</Text>
          <TouchableOpacity onPress={() => setCurrent(addMonths(current, 1))}>
            <Text style={styles.navBtn}>›</Text>
          </TouchableOpacity>
        </View>

        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#378ADD" />
            <Text style={styles.loadingText}>Loading games...</Text>
          </View>
        )}

        <View style={styles.dayLabels}>
          {DAY_LABELS.map((d) => (
            <Text key={d} style={styles.dayLabel}>{d}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.cell} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const events = eventsByDate[dateStr] ?? [];
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;

            return (
              <TouchableOpacity
                key={day}
                style={[styles.cell, isSelected && styles.cellSelected]}
                onPress={() => setSelectedDate(isSelected ? null : dateStr)}
              >
                <View style={[styles.dayNum, isToday && styles.dayNumToday]}>
                  <Text style={[styles.dayNumText, isToday && { color: '#fff' }]}>{day}</Text>
                </View>
                {events.slice(0, 2).map((e) => (
                  <View key={e.id} style={[styles.pill, { backgroundColor: SPORT_COLORS[e.sport] }]}>
                    <Text style={styles.pillText} numberOfLines={1}>{e.name}</Text>
                  </View>
                ))}
                {events.length > 2 && <Text style={styles.moreText}>+{events.length - 2}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {selectedDate && (
        <View style={styles.dayDetail}>
          <View style={styles.dayDetailHeader}>
            <Text style={styles.dayDetailTitle}>
              {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d')}
            </Text>
            <TouchableOpacity style={styles.addEventBtn} onPress={() => setShowAddModal(true)}>
              <Text style={styles.addEventBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {(eventsByDate[selectedDate] ?? []).length === 0 ? (
            <Text style={styles.noEvents}>No games scheduled</Text>
          ) : (
            <TimelineView events={eventsByDate[selectedDate] ?? []} />
          )}
        </View>
      )}

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add game</Text>
            <TextInput style={styles.input} placeholder="Game name" value={newEvent.name} onChangeText={(v) => setNewEvent((s) => ({ ...s, name: v }))} />
            <TextInput style={styles.input} placeholder="Time (e.g. 7:30 PM ET)" value={newEvent.time} onChangeText={(v) => setNewEvent((s) => ({ ...s, time: v }))} />
            <TextInput style={styles.input} placeholder="Channel / venue (optional)" value={newEvent.note} onChangeText={(v) => setNewEvent((s) => ({ ...s, note: v }))} />
            <View style={styles.sportPicker}>
              {(Object.keys(SPORT_COLORS) as Sport[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sportChip, newEvent.sport === s && { backgroundColor: SPORT_COLORS[s] }]}
                  onPress={() => setNewEvent((st) => ({ ...st, sport: s }))}
                >
                  <Text style={[styles.sportChipText, newEvent.sport === s && { color: '#fff' }]}>
                    {SPORT_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddEvent} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const tlStyles = StyleSheet.create({
  hourLabel: { width: 36, fontSize: 10, color: '#bbb', fontWeight: '500', textAlign: 'right', marginTop: -6 },
  hourLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#eee', marginLeft: 8 },
  eventBlock: {
    position: 'absolute',
    minHeight: 48,
    borderLeftWidth: 3,
    borderRadius: 6,
    padding: 8,
  },
  eventSport: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  eventName: { fontSize: 13, fontWeight: '500', color: '#111' },
  eventMeta: { fontSize: 11, color: '#777', marginTop: 2 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  navBtn: { fontSize: 28, color: '#378ADD', paddingHorizontal: 8 },
  monthTitle: { fontSize: 20, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  loadingText: { fontSize: 13, color: '#999' },
  dayLabels: { flexDirection: 'row', paddingHorizontal: 4 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: '#999', fontWeight: '500', paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  cell: { width: '14.28%', minHeight: 80, padding: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee' },
  cellSelected: { backgroundColor: '#f0f7ff' },
  dayNum: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  dayNumToday: { backgroundColor: '#378ADD', borderRadius: 12 },
  dayNumText: { fontSize: 13, fontWeight: '500', color: '#222' },
  pill: { borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, marginBottom: 2 },
  pillText: { fontSize: 9, color: '#fff' },
  moreText: { fontSize: 9, color: '#999' },
  dayDetail: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee', padding: 16 },
  dayDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dayDetailTitle: { fontSize: 16, fontWeight: '600' },
  addEventBtn: { backgroundColor: '#378ADD', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addEventBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  noEvents: { color: '#bbb', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 10 },
  sportPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  sportChip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  sportChipText: { fontSize: 12, fontWeight: '600', color: '#555' },
  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, color: '#555' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#378ADD', alignItems: 'center' },
  saveBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});