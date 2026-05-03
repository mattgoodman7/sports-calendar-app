import axios from 'axios';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Sport, Team } from '../lib/store';

const ESPN_PATHS: Partial<Record<Sport, string>> = {
  nfl:    'football/nfl',
  nba:    'basketball/nba',
  mlb:    'baseball/mlb',
  nhl:    'hockey/nhl',
  soccer: 'soccer/usa.1',
  wnba:   'basketball/wnba',
  ncaafb: 'football/college-football',
  ncaamb: 'basketball/mens-college-basketball',
};

interface Props {
  sport: Sport;
  selectedTeams?: Team[];
  onSelect: (teams: Team[]) => void;
}

export default function TeamPicker({ sport, selectedTeams = [], onSelect }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [filtered, setFiltered] = useState<Team[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded && teams.length === 0) fetchTeams();
  }, [expanded]);

  const fetchTeams = async () => {
    const path = ESPN_PATHS[sport];
    if (!path) {
      setError('Team selection not available for this sport yet.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/${path}/teams?limit=200`
      );
      const raw = response.data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
      const teamList: Team[] = raw
        .map((entry: any) => ({
          id: String(entry.team.id),
          name: entry.team.displayName,
          sport,
        }))
        .filter((t: Team) => t.name)
        .sort((a: Team, b: Team) => a.name.localeCompare(b.name));
      setTeams(teamList);
      setFiltered(teamList);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      setError('Failed to load teams. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    setFiltered(teams.filter((t) => t.name.toLowerCase().includes(text.toLowerCase())));
  };

  const handleToggleTeam = (team: Team) => {
    const exists = selectedTeams.find((t) => t.id === team.id);
    const updated = exists
      ? selectedTeams.filter((t) => t.id !== team.id)
      : [...selectedTeams, team];
    onSelect(updated);
  };

  return (
    <View style={styles.container}>
      {/* Selected team bubbles */}
      {selectedTeams.length > 0 && (
        <View style={styles.bubbleRow}>
          {selectedTeams.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.bubble}
              onPress={() => handleToggleTeam(t)}
            >
              <Text style={styles.bubbleText}>{t.name} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Expand/collapse toggle */}
      <TouchableOpacity
        style={styles.toggleBtn}
        onPress={() => setExpanded((v) => !v)}
      >
        <Text style={styles.toggleBtnText}>
          {expanded ? 'Hide team search ' : 'Search teams '}
        </Text>
        <Text style={styles.toggleBtnArrow}>
          {expanded ? '↑' : '↓'}
        </Text>
      </TouchableOpacity>

      {/* Inline search + list */}
      {expanded && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.search}
            placeholder="Search teams..."
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color="#378ADD" />
              <Text style={styles.loadingText}>Loading teams...</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {filtered.map((item) => {
                const isSelected = !!selectedTeams.find((t) => t.id === item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.teamRow, isSelected && styles.teamRowSelected]}
                    onPress={() => handleToggleTeam(item)}
                  >
                    <Text style={[styles.teamName, isSelected && { color: '#fff' }]}>
                      {item.name}
                    </Text>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { marginTop: 8, marginBottom: 4 },
  bubbleRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  bubble:          { backgroundColor: '#378ADD', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  bubbleText:      { color: '#fff', fontSize: 12, fontWeight: '500' },
  toggleBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#378ADD', borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  toggleBtnText:   { fontSize: 13, color: '#378ADD', fontWeight: '500' },
  toggleBtnArrow: { fontSize: 20, color: '#378ADD', fontWeight: '700' },
  searchContainer: { marginTop: 10, borderWidth: 1.5, borderColor: '#378ADD', borderRadius: 10, overflow: 'hidden' },
  search: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, margin: 8, padding: 12, fontSize: 15, backgroundColor: '#fff' },
  center:          { alignItems: 'center', paddingVertical: 20 },
  loadingText:     { marginTop: 8, color: '#999', fontSize: 13 },
  errorText:       { color: '#e24b4a', fontSize: 14, textAlign: 'center' },
  list:            { maxHeight: 250, backgroundColor: '#fff' },
  teamRow:         { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamRowSelected: { backgroundColor: '#378ADD' },
  teamName:        { fontSize: 15, color: '#111' },
  checkmark:       { color: '#fff', fontWeight: '700' },
});
