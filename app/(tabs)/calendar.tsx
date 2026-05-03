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

// ─── Constants ───────────────────────────────────────────────────────────────

const SPORT_COLORS: Record<Sport, string> = {
  nfl:    '#1D3D7B',
  nba:    '#C35B10',
  mlb:    '#0D5A2A',
  nhl:    '#5A1A6B',
  soccer: '#2A5A1A',
  nascar: '#FFD700',
  f1:     '#E8002D',
  tennis: '#4A90D9',
  golf:   '#3A7D44',
  ncaafb: '#8B2FC9',
  ncaamb: '#C9A22F',
  mma:    '#C0392B',
  wnba:   '#FF6B35',
  boxing: '#2C3E50',
};

// Duration (in hours) that each game block occupies on the timeline.
// TODO: vary by sport in a future version.
const SPORT_DURATION_HOURS: Record<Sport, number> = {
  nfl:    2, nba:    2, mlb:    2, nhl:    2, soccer: 2,
  nascar: 2, f1:     2, tennis: 2, golf:   2, ncaafb: 2,
  ncaamb: 2, mma:    2, wnba:   2, boxing: 2,
};

const DAY_LABELS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_HEIGHT = 80;   // px per hour
const TOTAL_HOURS = 24;
const TIME_COL_W  = 52;   // width of the time-label gutter
const EVENT_COL_W = 160;  // width of each collision column

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse "7:30 PM ET" → fractional hour (19.5). Returns null if unparseable. */
function parseTimeToHour(timeStr?: string): number | null {
  if (!timeStr) return null;
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h + min / 60;
}

interface PositionedEvent {
  event: SportEvent;
  startHour: number;
  durationHours: number;
  column: number;
  totalColumns: number;
}

/**
 * Given a list of events for a day, compute their column positions so that
 * overlapping events sit side-by-side (Outlook-style).
 */
function layoutEvents(events: SportEvent[]): {
  positioned: PositionedEvent[];
  ungrouped: SportEvent[];
} {
  const timed: { event: SportEvent; start: number; end: number }[] = [];
  const ungrouped: SportEvent[] = [];

  for (const e of events) {
    const start = parseTimeToHour(e.time);
    if (start === null) { ungrouped.push(e); continue; }
    const dur = SPORT_DURATION_HOURS[e.sport] ?? 2;
    timed.push({ event: e, start, end: start + dur });
  }

  // Sort by start time
  timed.sort((a, b) => a.start - b.start);

  // Greedy column assignment
  const columns: number[] = []; // columns[i] = end time of last event in column i
  const assigned: (PositionedEvent & { end: number })[] = [];

  for (const item of timed) {
    let col = columns.findIndex((endTime) => endTime <= item.start);
    if (col === -1) col = columns.length;
    columns[col] = item.end;
    assigned.push({
      event: item.event,
      startHour: item.start,
      durationHours: SPORT_DURATION_HOURS[item.event.sport] ?? 2,
      column: col,
      totalColumns: 0, // filled in below
      end: item.end,
    });
  }

  // Second pass: for each event, totalColumns = max columns used by any
  // overlapping group it belongs to.
  for (let i = 0; i < assigned.length; i++) {
    let maxCol = assigned[i].column;
    for (let j = 0; j < assigned.length; j++) {
      if (i === j) continue;
      const overlap =
        assigned[i].startHour < assigned[j].end &&
        assigned[i].end > assigned[j].startHour;
      if (overlap) maxCol = Math.max(maxCol, assigned[j].column);
    }
    assigned[i].totalColumns = maxCol + 1;
  }

  return { positioned: assigned, ungrouped };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function HourLabels() {
  return (
    <View style={{ width: TIME_COL_W }}>
      {Array.from({ length: TOTAL_HOURS }).map((_, h) => (
        <View key={h} style={{ height: HOUR_HEIGHT, justifyContent: 'flex-start', paddingTop: 4 }}>
          <Text style={styles.hourLabel}>
            {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function HourGrid({ width }: { width: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { width }]} pointerEvents="none">
      {Array.from({ length: TOTAL_HOURS }).map((_, h) => (
        <View
          key={h}
          style={{
            position: 'absolute',
            top: h * HOUR_HEIGHT,
            left: 0,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: '#eee',
          }}
        />
      ))}
    </View>
  );
}

function EventBlock({ pe, totalWidth }: { pe: PositionedEvent; totalWidth: number }) {
  const top    = pe.startHour * HOUR_HEIGHT;
  const height = Math.max(pe.durationHours * HOUR_HEIGHT - 4, 28);
  const colW   = totalWidth / pe.totalColumns;
  const left   = pe.column * colW + 2;
  const width  = colW - 4;
  const color  = SPORT_COLORS[pe.event.sport];

  return (
    <View
      style={[
        styles.eventBlock,
        { top, height, left, width, backgroundColor: color },
      ]}
    >
      <Text style={styles.eventBlockName} numberOfLines={2}>{pe.event.name}</Text>
      {pe.event.time ? (
        <Text style={styles.eventBlockTime}>{pe.event.time}</Text>
      ) : null}
      {pe.event.channel ? (
        <Text style={styles.eventBlockChannel} numberOfLines={1}>{pe.event.channel}</Text>
      ) : null}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const scrollRef    = useRef<ScrollView>(null);
  const [current, setCurrent]           = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEvent, setNewEvent]         = useState({
    name: '', sport: 'nba' as Sport, time: '', note: '',
  });

  const { eventsByDate, isLoading } = useGames(current.getFullYear(), current.getMonth());
  const addCustomEvent = useAppStore((s) => s.addCustomEvent);

  const year           = current.getFullYear();
  const month          = current.getMonth();
  const daysInMonth    = getDaysInMonth(current);
  const firstDayOfWeek = getDay(startOfMonth(current));
  const today          = format(new Date(), 'yyyy-MM-dd');

  const handleDatePress = (dateStr: string, isSelected: boolean) => {
    setSelectedDate(isSelected ? null : dateStr);
    if (!isSelected) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

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

  // Layout for selected day
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];
  const { positioned, ungrouped } = layoutEvents(selectedEvents);
  const totalCols     = Math.max(1, ...positioned.map((p) => p.totalColumns));
  const timelineWidth = EVENT_COL_W * totalCols;
  const timelineHeight = TOTAL_HOURS * HOUR_HEIGHT;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>

        {/* ── Month header ── */}
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

        {/* ── Month grid ── */}
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
            const day     = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const events  = eventsByDate[dateStr] ?? [];
            const isToday    = dateStr === today;
            const isSelected = dateStr === selectedDate;

            return (
              <TouchableOpacity
                key={day}
                style={[styles.cell, isSelected && styles.cellSelected]}
                onPress={() => handleDatePress(dateStr, isSelected)}
              >
                <View style={[styles.dayNum, isToday && styles.dayNumToday]}>
                  <Text style={[styles.dayNumText, isToday && { color: '#fff' }]}>{day}</Text>
                </View>
                {events.slice(0, 2).map((e) => (
                  <View key={e.id} style={[styles.pill, { backgroundColor: SPORT_COLORS[e.sport] }]}>
                    <Text style={styles.pillText} numberOfLines={1}>{e.name}</Text>
                  </View>
                ))}
                {events.length > 2 && (
                  <Text style={styles.moreText}>+{events.length - 2} more</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Daily detail (Outlook-style) ── */}
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

            {selectedEvents.length === 0 ? (
              <Text style={styles.noEvents}>No games scheduled</Text>
            ) : (
              <>
                {/* Events with no parseable time */}
                {ungrouped.length > 0 && (
                  <View style={styles.ungroupedSection}>
                    <Text style={styles.ungroupedLabel}>Time TBD</Text>
                    {ungrouped.map((e) => (
                      <View key={e.id} style={styles.eventRow}>
                        <View style={[styles.eventDot, { backgroundColor: SPORT_COLORS[e.sport] }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.eventName}>{e.name}</Text>
                          {e.channel && (
                            <Text style={styles.eventMeta}>{e.channel}</Text>
                          )}
                        </View>
                        <Text style={styles.sportTag}>{e.sport.toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Outlook-style timeline */}
                {positioned.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.timelineOuter}
                  >
                    <View style={{ flexDirection: 'row' }}>
                      <HourLabels />
                      <View style={{ width: timelineWidth, height: timelineHeight }}>
                        <HourGrid width={timelineWidth} />
                        {positioned.map((pe) => (
                          <EventBlock
                            key={pe.event.id}
                            pe={pe}
                            totalWidth={timelineWidth}
                          />
                        ))}
                      </View>
                    </View>
                  </ScrollView>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Add event modal ── */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add game</Text>
            <TextInput
              style={styles.input}
              placeholder="Game name"
              value={newEvent.name}
              onChangeText={(v) => setNewEvent((s) => ({ ...s, name: v }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Time (e.g. 7:30 PM ET)"
              value={newEvent.time}
              onChangeText={(v) => setNewEvent((s) => ({ ...s, time: v }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Channel / venue (optional)"
              value={newEvent.note}
              onChangeText={(v) => setNewEvent((s) => ({ ...s, note: v }))}
            />
            <View style={styles.sportPicker}>
              {(['nfl', 'nba', 'mlb', 'nhl', 'soccer'] as Sport[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sportChip, newEvent.sport === s && { backgroundColor: SPORT_COLORS[s] }]}
                  onPress={() => setNewEvent((st) => ({ ...st, sport: s }))}
                >
                  <Text style={[styles.sportChipText, newEvent.sport === s && { color: '#fff' }]}>
                    {s.toUpperCase()}
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 40 },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  navBtn:      { fontSize: 28, color: '#378ADD', paddingHorizontal: 8 },
  monthTitle:  { fontSize: 20, fontWeight: '600' },
  loadingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  loadingText: { fontSize: 13, color: '#999' },

  // Month grid
  dayLabels:    { flexDirection: 'row', paddingHorizontal: 4 },
  dayLabel:     { flex: 1, textAlign: 'center', fontSize: 11, color: '#999', fontWeight: '500', paddingVertical: 6 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  cell:         { width: '14.28%', minHeight: 80, padding: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee' },
  cellSelected: { backgroundColor: '#f0f7ff' },
  dayNum:       { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  dayNumToday:  { backgroundColor: '#378ADD', borderRadius: 12 },
  dayNumText:   { fontSize: 13, fontWeight: '500', color: '#222' },
  pill:         { borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, marginBottom: 2 },
  pillText:     { fontSize: 9, color: '#fff' },
  moreText:     { fontSize: 9, color: '#999' },

  // Day detail panel
  dayDetail:       { margin: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee', overflow: 'hidden' },
  dayDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  dayDetailTitle:  { fontSize: 16, fontWeight: '600' },
  addEventBtn:     { backgroundColor: '#378ADD', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addEventBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  noEvents:        { color: '#bbb', fontSize: 14, textAlign: 'center', paddingVertical: 24 },

  // Ungrouped (no time) events
  ungroupedSection: { paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  ungroupedLabel:   { fontSize: 11, color: '#aaa', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  eventRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f0f0f0' },
  eventDot:         { width: 10, height: 10, borderRadius: 5 },
  eventName:        { fontSize: 14, fontWeight: '500', color: '#111' },
  eventMeta:        { fontSize: 12, color: '#888', marginTop: 2 },
  sportTag:         { fontSize: 10, color: '#bbb', fontWeight: '600' },

  // Outlook timeline
  timelineOuter: { marginTop: 8 },
  hourLabel:     { fontSize: 10, color: '#aaa', fontWeight: '500', textAlign: 'right', paddingRight: 8, width: TIME_COL_W },

  // Event blocks
  eventBlock:        { position: 'absolute', borderRadius: 6, padding: 6, overflow: 'hidden' },
  eventBlockName:    { fontSize: 11, color: '#fff', fontWeight: '600', lineHeight: 14 },
  eventBlockTime:    { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  eventBlockChannel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal:         { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle:    { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  input:         { borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 10 },
  sportPicker:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  sportChip:     { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  sportChipText: { fontSize: 12, fontWeight: '600', color: '#555' },
  modalFooter:   { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn:     { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, color: '#555' },
  saveBtn:       { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#378ADD', alignItems: 'center' },
  saveBtnText:   { fontSize: 15, color: '#fff', fontWeight: '600' },
});
