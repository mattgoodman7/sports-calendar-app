import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { SportEvent } from './store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('games', {
      name: 'Game Reminders',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleGameNotification(event: SportEvent, minutesBefore: number): Promise<string | null> {
  if (!event.time) return null;
  const gameDate = new Date(`${event.date}T${event.time}`);
  const triggerDate = new Date(gameDate.getTime() - minutesBefore * 60 * 1000);
  if (triggerDate <= new Date()) return null;
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: `Game starting soon 🏟️`,
      body: `${event.name} starts in ${minutesBefore} minutes`,
      data: { eventId: event.id },
    },
    trigger: { date: triggerDate },
  });
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}