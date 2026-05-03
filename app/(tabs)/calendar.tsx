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

const SPORT_DURATION_HOURS: Record<Sport, number> = {
  nfl:    3, nba:    2, mlb:    3, nhl:    2, soccer: 2,
  nascar: 2, f1:     2, tennis: 2, golf:   2, ncaafb: 3,
  ncaamb: 2, mma:    3, wnba:   2, boxing: 3,
};

// How close two NFL game times must be (in minutes) to be grouped together
const NFL_GROUP_WINDOW_MINUTES = 45;
// Minimum number of games in a time window to trigger grouping
const NFL_GROUP_THRESHOLD = 3;

const DAY_LABELS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_HEIGHT = 80;
const TOTAL_HOURS = 24;
const TIME_COL_W  = 52;
const EVENT_COL_W = 160;

// ─── Types ───────────────────────────────────────────────────────────────────

interface GroupedEvent {
  id: string;
  sport: Sport;
  time: string;
  startHour: number;
  games: SportEvent[];
  isGroup: true;
}

interface SingleEvent {
  event: SportEvent;
  startHour: number;
  isGroup: false;
}

type DisplayEvent = GroupedEvent | SingleEvent;

interface PositionedDisplay {
  display: DisplayEvent;
  startHour: number;
  durationHours: number;
  column: number;
  totalColumns: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/**
 * Group NFL games that start within NFL_GROUP_WINDOW_MINUTES of each other
 * and have 3+ games in that window. Returns a mix of GroupedEvent and
 * individual SportEvent objects ready for layout.
 */
function groupNflGames(events: SportEvent[]): DisplayEvent[] {
  const nflGames = events.filter((e) => e.sport === 'nfl');
  const otherEvents = events.filter((e) => e.sport !== 'nfl');

  // Sort NFL games by start time
  const timedNfl: { event: SportEvent; hour: number }[] = [];
  const untimedNfl: SportEvent[] = [];

  for (const e of nflGames) {
    const hour = parseTimeToHour(e.time);
    if (hour === null) { untimedNfl.push(e); continue; }
    timedNfl.push({ event: e, hour });
  }
  timedNfl.sort((a, b) => a.hour - b.hour);

  // Greedy grouping: scan through sorted games and cluster by window
  const processed = new Set<string>();
  const displayEvents: DisplayEvent[] = [];

  for (let i = 0; i < timedNfl.length; i++) {
    if (processed.has(timedNfl[i].event.id)) continue;

    const windowStart = timedNfl[i].hour;
    const windowEnd = windowStart + NFL_GROUP_WINDOW_MINUTES / 60;

    // Find all games within the window
    const group = timedNfl.filter(
      (g) => !processed.has(g.event.id) && g.hour >= windowStart && g.hour <= windowEnd
    );

    if (group.length >= NFL_GROUP_THRESHOLD) {
      // Mark all as processed
      group.forEach((g) => processed.add(g.event.id));

      // Use earliest time
      const earliestHour = Math.min(...group.map((g) => g.hour));
      const earliestEvent = group.find((g) => g.hour === earliestHour)!;

      displayEvents.push({
        id: `nfl-group-${earliestEvent.event.id}`,
        sport: 'nfl',
        time: earliestEvent.event.time ?? '',
        startHour: earliestHour,
        games: group.map((g) => g.event),
        isGroup: true,
      });
    } else {
      // Not enough for a group — show individually
      processed.add(timedNfl[i].event.id);
      displayEvents.push({
        event: timedNfl[i].event,
        startHour: timedNfl[i].hour,
        isGroup: false,
      });
    }
  }

  // Add untimed NFL games as individual events
  for (const e of untimedNfl) {
    displayEvents.push({ event: e, startHour: 0, isGroup: false });
  }

  // Add non-NFL events as individual events
  for (const e of otherEvents) {
    const hour = parseTimeToHour(e.time);
    displayEvents.push({ event: e, startHour: hour ?? 0, isGroup: false });
  }

  return displayEvents;
}

/**
 * Layout display events into columns for side-by-side rendering.
 */
function layoutDisplayEvents(displays: DisplayEvent[]): {
  positioned: PositionedDisplay[];
  ungrouped: DisplayEvent[];
} {
  const timed: { display: DisplayEvent; start: number; end: number }[] = [];
  const ungrouped: DisplayEvent[] = [];

  for (const d of displays) {
    const start = d.startHour;
    if (start === 0 && !d.isGroup && !d.event.time) {
      ungrouped.push(d);
      continue;
    }
    const sport = d.isGroup ? d.sport : d.event.sport;
    const dur = SPORT_DURATION_HOURS[sport] ?? 2;
    timed.push({ display: d, start, end: start + dur });
  }

  timed.sort((a, b) => a.start - b.start);

  const columns: number[] = [];
  const assigned: (PositionedDisplay & { end: number })[] = [];

  for (const item of timed) {
    let col = columns.findIndex((endTime) => endTime <= item.start);
    if (col === -1) col = columns.length;
    columns[col] = item.end;
    const sport = item.display.isGroup ? item.display.sport : item.display.event.sport;
    assigned.push({
      display: item.display,
      startHour: item.start,
      durationHours: SPORT_DURATION_HOURS[sport] ?? 2,
      column: col,
      totalColumns: 0,
      end: item.end,
    });
  }

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

function DisplayEventBlock({ pd, totalWidth }: { pd: PositionedDisplay; totalWidth: number }) {
  const top    = pd.startHour * HOUR_HEIGHT;
  const height = Math.max(pd.durationHours * HOUR_HEIGHT - 4, 28);
  const colW   = totalWidth / pd.totalColumns;
  const left   = pd.column * colW + 2;
  const width  = colW - 4;
  const sport  = pd.display.isGroup ? pd.display.sport : pd.display.event.sport;
  const color  = SPORT_COLORS[sport];

  if (pd.display.isGroup) {
    const group = pd.display as GroupedEvent;
    return (
      <View style={[styles.eventBlock, { top, height, left, width, backgroundColor: color }]}>
        <Text style={styles.eventBlockTime}>{group.time}</Text>
        <Text style={styles.eventBlockGroupLabel}>NFL Games</Text>
        <View style={styles.groupList}>
          {group.games.map((g) => (
            <Text key={g.id} style={styles.groupItem} numberOfLines={1}>
              · {g.name}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  const e = pd.display.event;
  return (
    <View style={[styles.eventBlock, { top, height, left, width, backgroundColor: color }]}>
      <Text style={styles.eventBlockName} numberOfLines={2}>{e.name}</Text>
      {e.time && <Text style={styles.eventBlockTime}>{e.time}</Text>}
      {e.channel && <Text style={styles.eventBlockChannel} numberOfLines={1}>{e.channel}</Text>}
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

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];
  const displayEvents  = groupNflGames(selectedEvents);
  const { positioned, ungrouped } = layoutDisplayEvents(displayEvents);
  const totalCols      = Math.max(1, ...positioned.map((p) => p.totalColumns));
  const timelineWidth  = EVENT_COL_W * totalCols;
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
                {/* Ungrouped (no time) events */}
                {ungrouped.length > 0 && (
                  <View style={styles.ungroupedSection}>
                    <Text style={styles.ungroupedLabel}>Time TBD</Text>
                    {ungrouped.map((d, idx) => {
                      const e = d.isGroup ? null : d.event;
                      if (!e) return null;
                      return (
                        <View key={e.id} style={styles.eventRow}>
                          <View style={[styles.eventDot, { backgroundColor: SPORT_COLORS[e.sport] }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.eventName}>{e.name}</Text>
                            {e.channel && <Text style={styles.eventMeta}>{e.channel}</Text>}
                          </View>
                          <Text style={styles.sportTag}>{e.sport.toUpperCase()}</Text>
                        </View>
                      );
                    })}
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
                        {positioned.map((pd, idx) => (
                          <DisplayEventBlock
                            key={pd.display.isGroup ? pd.display.id : pd.display.event.id}
                            pd={pd}
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

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  navBtn:      { fontSize: 28, color: '#378ADD', paddingHorizontal: 8 },
  monthTitle:  { fontSize: 20, fontWeight: '600' },
  loadingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  loadingText: { fontSize: 13, color: '#999' },

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

  dayDetail:       { margin: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee', overflow: 'hidden' },
  dayDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  dayDetailTitle:  { fontSize: 16, fontWeight: '600' },
  addEventBtn:     { backgroundColor: '#378ADD', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addEventBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  noEvents:        { color: '#bbb', fontSize: 14, textAlign: 'center', paddingVertical: 24 },

  ungroupedSection: { paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  ungroupedLabel:   { fontSize: 11, color: '#aaa', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  eventRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f0f0f0' },
  eventDot:         { width: 10, height: 10, borderRadius: 5 },
  eventName:        { fontSize: 14, fontWeight: '500', color: '#111' },
  eventMeta:        { fontSize: 12, color: '#888', marginTop: 2 },
  sportTag:         { fontSize: 10, color: '#bbb', fontWeight: '600' },

  timelineOuter: { marginTop: 8 },
  hourLabel:     { fontSize: 10, color: '#aaa', fontWeight: '500', textAlign: 'right', paddingRight: 8, width: TIME_COL_W },

  eventBlock:         { position: 'absolute', borderRadius: 6, padding: 6, overflow: 'hidden' },
  eventBlockName:     { fontSize: 11, color: '#fff', fontWeight: '600', lineHeight: 14 },
  eventBlockTime:     { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  eventBlockChannel:  { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  eventBlockGroupLabel: { fontSize: 11, color: '#fff', fontWeight: '700', marginTop: 2, marginBottom: 3 },
  groupList:          { gap: 2 },
  groupItem:          { fontSize: 9, color: 'rgba(255,255,255,0.9)', lineHeight: 13 },

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
