import { Tabs } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function MediaLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#0a0a0a' },
        headerTintColor: '#fff',
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.backBtn}>
            <Text style={styles.backText}>← Home</Text>
          </TouchableOpacity>
        ),
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#222',
          paddingBottom: insets.bottom,
          height: 60 + insets.bottom,
        },
        tabBarActiveTintColor: '#A78BFA',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarLabel: 'Library',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🎬</Text>,
          headerTitle: 'My Library',
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarLabel: 'Calendar',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📅</Text>,
          headerTitle: 'Release Calendar',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  backBtn:  { paddingLeft: 16, paddingVertical: 8 },
  backText: { color: '#A78BFA', fontSize: 15, fontWeight: '500' },
});
