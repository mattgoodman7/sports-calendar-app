import axios from 'axios';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Sport, Team } from '../lib/store';

const LEAGUE_NAMES: Record<string, string> = {
  nfl: 'NFL',
  nba: 'NBA',
  mlb: 'MLB',
  nhl: 'NHL',
  soccer: 'Major League Soccer',
  wnba: 'WNBA',
  // ncaafb and ncaamb require paid tier
};

interface Props {
  sport: Sport;
  selectedTeams?: Team[];
  onSelect: (teams: Team[]) => void;
}

export default function TeamPicker({ sport, selectedTeams = [], onSelect }: Props) {
  const [visible, setVisible] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [filtered, setFiltered] = useState<Team[]>([]);
  const [selected, setSelected] = useState<Team[]>(selectedTeams);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTeams = async () => {
    const leagueName = LEAGUE_NAMES[sport];
    if (!leagueName) {
      setError('Team selection not available for this sport yet.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(
        `https://www.thesportsdb.com/api/v1/json/3/search_all_teams.php?l=${encodeURIComponent(leagueName)}`
      );
      const raw = response.data?.teams ?? [];
      const teamList: Team[] = raw.map((t: any) => ({
        id: String(t.idTeam),
        name: t.strTeam,
        sport,
      })).filter((t: Team) => t.name);
      teamList.sort((a, b) => a.name.localeCompare(b.name));
      setTeams(teamList);
      setFiltered(teamList);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      setError('Failed to load teams. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setSelected(selectedTeams);
    setVisible(true);
    if (teams.length === 0) fetchTeams();
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    setFiltered(teams.filter((t) => t.name.toLowerCase().includes(text.toLowerCase())));
  };

  const handleToggleTeam = (team: Team) => {
    setSelected((prev) => {
      const exists = prev.find((t) => t.id === team.id);
      return exists ? prev.filter((t) => t.id !== team.id) : [...prev, team];
    });
  };

  const handleDone = () => {
    onSelect(selected);
    setVisible(false);
    setSearch('');
  };

  return (
    <>
      <TouchableOpacity style={styles.pickerBtn} onPress={handleOpen}>
        {selectedTeams.length > 0 ? (
          <View style={styles.bubbleRow}>
            {selectedTeams.map((t) => (
              <View key={t.id} style={styles.bubble}>
                <Text style={styles.bubbleText}>📍 {t.name}</Text>
              </View>
            ))}
            <Text style={styles.editText}>Edit</Text>
          </View>
        ) : (
          <Text style={styles.pickerBtnText}>Select teams →</Text>
        )}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pick your teams</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
                <Text style={styles.doneBtnText}>Done ({selected.length})</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.search}
              placeholder="Search teams..."
              value={search}
              onChangeText={handleSearch}
              autoFocus
            />
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#378ADD" />
                <Text style={styles.loadingText}>Loading teams...</Text>
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                style={styles.list}
                renderItem={({ item }) => {
                  const isSelected = selected.find((t) => t.id === item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.teamRow, isSelected && styles.teamRowSelected]}
                      onPress={() => handleToggleTeam(item)}
                    >
                      <Text style={[styles.teamName, isSelected && { color: '#fff' }]}>
                        {item.name}
                      </Text>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pickerBtn: { marginTop: 8, marginBottom: 4, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#378ADD', borderRadius: 8, alignSelf: 'flex-start' },
  pickerBtnText: { fontSize: 13, color: '#378ADD', fontWeight: '500' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  search: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12 },
  center: { alignItems: 'center', paddingVertical: 32 },
  loadingText: { marginTop: 12, color: '#999' },
  errorText: { color: '#e24b4a', fontSize: 14, textAlign: 'center' },
  list: { maxHeight: 400 },
  teamRow: { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 },
  teamRowSelected: { backgroundColor: '#378ADD' },
  teamName: { fontSize: 15, color: '#111' },
  checkmark: { color: '#fff', fontWeight: '700' },
  cancelBtn: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, color: '#555' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, width: '100%' },
  doneBtn: { backgroundColor: '#378ADD', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  bubbleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  bubble: { backgroundColor: '#378ADD', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  bubbleText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  editText: { fontSize: 12, color: '#378ADD', fontWeight: '500' },
});