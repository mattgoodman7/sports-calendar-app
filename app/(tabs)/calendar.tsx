import { addMonths, format, getDay, getDaysInMonth, startOfMonth, subMonths } from 'date-fns';
import { useState } from 'react';
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
import { Sport, useAppStore } from '../../lib/store';

const SPORT_COLORS: Record<Sport, string> = {
  nfl:    '#1D3D7B', // navy blue
  nba:    '#C35B10', // orange
  mlb:    '#0D5A2A', // green
  nhl:    '#5A1A6B', // purple
  soccer: '#2A5A1A', // dark green
  wnba:   '#E4603A', // coral orange
  ncaafb: '#8B2000', // maroon
  ncaamb: '#005EB8', // bright blue
  golf:   '#2D6A2D', // fairway green
  tennis: '#C8A800', // clay yellow
  f1:     '#E10600', // ferrari red
  nascar: '#FFB700', // checkered gold
  mma:    '#B22222', // fight red
  boxing: '#8B0000', // dark red
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
      <ScrollView>
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
              (eventsByDate[selectedDate] ?? []).map((e) => (
                <View key={e.id} style={styles.eventRow}>
                  <View style={[styles.eventDot, { backgroundColor: SPORT_COLORS[e.sport] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventName}>{e.name}</Text>
                    {(e.time || e.channel) && (
                      <Text style={styles.eventMeta}>{[e.time, e.channel].filter(Boolean).join(' · ')}</Text>
                    )}
                  </View>
                  <Text style={styles.sportTag}>{e.sport.toUpperCase()}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add game</Text>
            <TextInput style={styles.input} placeholder="Game name" value={newEvent.name} onChangeText={(v) => setNewEvent((s) => ({ ...s, name: v }))} />
            <TextInput style={styles.input} placeholder="Time (e.g. 7:30 PM ET)" value={newEvent.time} onChangeText={(v) => setNewEvent((s) => ({ ...s, time: v }))} />
            <TextInput style={styles.input} placeholder="Channel / venue (optional)" value={newEvent.note} onChangeText={(v) => setNewEvent((s) => ({ ...s, note: v }))} />
            <View style={styles.sportPicker}>
              {(['nfl', 'nba', 'mlb', 'nhl', 'soccer'] as Sport[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sportChip, newEvent.sport === s && { backgroundColor: SPORT_COLORS[s] }]}
                  onPress={() => setNewEvent((st) => ({ ...st, sport: s }))}
                >
                  <Text style={[styles.sportChipText, newEvent.sport === s && { color: '#fff' }]}>{s.toUpperCase()}</Text>
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
  dayDetail: { margin: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee', padding: 16 },
  dayDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dayDetailTitle: { fontSize: 16, fontWeight: '600' },
  addEventBtn: { backgroundColor: '#378ADD', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addEventBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  noEvents: { color: '#bbb', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f0f0f0' },
  eventDot: { width: 10, height: 10, borderRadius: 5 },
  eventName: { fontSize: 14, fontWeight: '500', color: '#111' },
  eventMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  sportTag: { fontSize: 10, color: '#bbb', fontWeight: '600' },
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