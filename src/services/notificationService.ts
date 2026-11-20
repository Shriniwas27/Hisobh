import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { BillReminder } from '../types';
import { updateReminderNotificationId, getReminders } from '../db/queries';

const isExpoGo =
  Constants?.appOwnership === 'expo' ||
  (ExecutionEnvironment && Constants?.executionEnvironment === ExecutionEnvironment.StoreClient);

// Configure how notifications appear when the app is foregrounded
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch {
  // Ignored in unsupported environments
}

/**
 * Request notification permissions and configure Android channel
 */
export async function initNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    if (Platform.OS === 'android' && !isExpoGo) {
      try {
        await Notifications.setNotificationChannelAsync('bill-reminders', {
          name: 'Bill Due Reminders',
          description: 'Monthly alerts for upcoming and due bills like milk, rent, electricity, etc.',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB',
        });
      } catch {
        // Notification channels are not supported in Expo Go on Android
      }
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

/**
 * Schedule a recurring monthly alarm/reminder notification
 */
export async function scheduleReminderNotification(reminder: BillReminder): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    await initNotifications();

    // If there is an existing scheduled notification, cancel it first
    if (reminder.notification_id) {
      await cancelReminderNotification(reminder.notification_id);
    }

    if (!reminder.is_active) {
      return null;
    }

    // Parse notification time (default 09:00 AM)
    let hour = 9;
    let minute = 0;
    if (reminder.time_str && reminder.time_str.includes(':')) {
      const parts = reminder.time_str.split(':');
      hour = parseInt(parts[0], 10) || 9;
      minute = parseInt(parts[1], 10) || 0;
    }

    // Format amount for notification body
    const rupees = reminder.amount > 0 ? `₹${(reminder.amount / 100).toLocaleString('en-IN')}` : '';
    const vendorNote = reminder.vendor ? ` to ${reminder.vendor}` : '';
    const bodyText = rupees
      ? `Reminder: Pay ${rupees} for ${reminder.title}${vendorNote} today!`
      : `Reminder: ${reminder.title}${vendorNote} is due today!`;

    const day = Math.min(Math.max(reminder.day_of_month, 1), 31);

    const trigger =
      Platform.OS === 'android'
        ? {
            type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
            day,
            hour,
            minute,
            ...(isExpoGo ? {} : { channelId: 'bill-reminders' }),
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            day,
            hour,
            minute,
            repeats: true,
          };

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔔 Bill Due: ${reminder.title}`,
        body: bodyText,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          reminderId: reminder.id,
          title: reminder.title,
          amount: reminder.amount,
          vendor: reminder.vendor,
        },
      },
      trigger: trigger as any,
    });

    // Update notification_id in SQLite
    updateReminderNotificationId(reminder.id, notifId);
    return notifId;
  } catch (err) {
    console.error('Failed to schedule reminder notification:', err);
    return null;
  }
}

/**
 * Cancel a scheduled reminder notification
 */
export async function cancelReminderNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (err) {
    console.warn('Failed to cancel scheduled notification:', err);
  }
}

/**
 * Trigger an immediate test notification in 2 seconds so the user can hear and see the alarm
 */
export async function triggerTestNotification(title: string = 'Milk Bill', amountPaise: number = 150000): Promise<string | null> {
  try {
    await initNotifications();

    const rupees = amountPaise > 0 ? `₹${(amountPaise / 100).toLocaleString('en-IN')}` : '₹1,500';

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔔 Bill Due Alarm Test: ${title}`,
        body: `Testing alarm! Pay ${rupees} for ${title} due today.`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        repeats: false,
      },
    });

    return notifId;
  } catch (err) {
    console.error('Failed to trigger test notification:', err);
    return null;
  }
}

/**
 * Sync all active reminders with system notification scheduler
 */
export async function syncAllRemindersWithNotifications(): Promise<void> {
  try {
    const hasPermission = await initNotifications();
    if (!hasPermission) return;

    const reminders = getReminders();
    for (const r of reminders) {
      if (r.is_active) {
        await scheduleReminderNotification(r);
      } else if (r.notification_id) {
        await cancelReminderNotification(r.notification_id);
        updateReminderNotificationId(r.id, null);
      }
    }
  } catch (err) {
    console.warn('Sync reminders error:', err);
  }
}
