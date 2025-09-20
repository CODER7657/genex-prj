// Reminder and notification service for wellness check-ins

export interface ReminderSettings {
  enabled: boolean;
  time: string; // Format: "HH:MM"
  frequency: 'daily' | 'weekly' | 'custom';
  customDays?: number[]; // 0-6 for Sunday-Saturday
  message: string;
}

export interface WellnessGoal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string; // e.g., "check-ins", "meditation minutes", "exercises"
  frequency: 'daily' | 'weekly' | 'monthly';
  createdAt: Date;
  completedAt?: Date;
  isActive: boolean;
}

export interface ReminderNotification {
  id: string;
  type: 'mood-checkin' | 'goal-reminder' | 'wellness-tip';
  title: string;
  message: string;
  scheduledTime: Date;
  isShown: boolean;
  goalId?: string;
}

class ReminderService {
  private reminders: ReminderNotification[] = [];
  private goals: WellnessGoal[] = [];
  private timeoutIds: Set<number> = new Set();

  constructor() {
    this.loadReminders();
    this.loadGoals();
    this.scheduleNextReminders();
  }

  // Reminder Management
  setDailyReminder(settings: ReminderSettings): void {
    this.clearExistingReminders();
    
    if (!settings.enabled) {
      this.saveReminderSettings(settings);
      return;
    }

    this.saveReminderSettings(settings);
    this.scheduleNextReminders();
  }

  private scheduleNextReminders(): void {
    const settings = this.loadReminderSettings();
    if (!settings.enabled) return;

    const now = new Date();
    const [hours, minutes] = settings.time.split(':').map(Number);
    
    // Schedule for today if time hasn't passed, otherwise tomorrow
    const reminderTime = new Date();
    reminderTime.setHours(hours, minutes, 0, 0);
    
    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }

    const timeUntilReminder = reminderTime.getTime() - now.getTime();
    
    const timeoutId = window.setTimeout(() => {
      this.showMoodCheckInReminder();
      this.scheduleNextReminders(); // Schedule the next one
    }, timeUntilReminder);

    this.timeoutIds.add(timeoutId);
  }

  private clearExistingReminders(): void {
    this.timeoutIds.forEach(id => clearTimeout(id));
    this.timeoutIds.clear();
  }

  private showMoodCheckInReminder(): void {
    const notification: ReminderNotification = {
      id: `reminder-${Date.now()}`,
      type: 'mood-checkin',
      title: '🌟 Time for your wellness check-in!',
      message: 'How are you feeling right now? Take a moment to reflect on your mood.',
      scheduledTime: new Date(),
      isShown: false
    };

    this.showNotification(notification);
  }

  // Goal Management
  createGoal(goal: Omit<WellnessGoal, 'id' | 'createdAt' | 'currentValue' | 'isActive'>): WellnessGoal {
    const newGoal: WellnessGoal = {
      ...goal,
      id: `goal-${Date.now()}`,
      createdAt: new Date(),
      currentValue: 0,
      isActive: true
    };

    this.goals.push(newGoal);
    this.saveGoals();
    return newGoal;
  }

  updateGoalProgress(goalId: string, increment: number = 1): WellnessGoal | null {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return null;

    goal.currentValue += increment;
    
    // Check if goal is completed
    if (goal.currentValue >= goal.targetValue && !goal.completedAt) {
      goal.completedAt = new Date();
      this.showGoalCompletionNotification(goal);
    }

    this.saveGoals();
    return goal;
  }

  getActiveGoals(): WellnessGoal[] {
    return this.goals.filter(goal => goal.isActive && !goal.completedAt);
  }

  getCompletedGoals(): WellnessGoal[] {
    return this.goals.filter(goal => goal.completedAt);
  }

  deactivateGoal(goalId: string): void {
    const goal = this.goals.find(g => g.id === goalId);
    if (goal) {
      goal.isActive = false;
      this.saveGoals();
    }
  }

  // Notification System
  private showNotification(notification: ReminderNotification): void {
    this.reminders.push(notification);
    this.saveReminders();

    // Use browser notification if permission granted
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });
    } else {
      // Fallback to custom in-app notification
      this.showInAppNotification(notification);
    }

    notification.isShown = true;
  }

  private showInAppNotification(notification: ReminderNotification): void {
    // Create and show custom notification element
    const notificationEl = document.createElement('div');
    notificationEl.className = 'fixed top-4 right-4 bg-purple-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm';
    notificationEl.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-1">
          <h4 class="font-semibold">${notification.title}</h4>
          <p class="text-sm opacity-90">${notification.message}</p>
        </div>
        <button class="text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
          ×
        </button>
      </div>
    `;

    document.body.appendChild(notificationEl);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notificationEl.parentElement) {
        notificationEl.remove();
      }
    }, 5000);
  }

  private showGoalCompletionNotification(goal: WellnessGoal): void {
    const notification: ReminderNotification = {
      id: `goal-complete-${Date.now()}`,
      type: 'goal-reminder',
      title: '🎉 Goal Completed!',
      message: `Congratulations! You've completed your goal: ${goal.title}`,
      scheduledTime: new Date(),
      isShown: false,
      goalId: goal.id
    };

    this.showNotification(notification);
  }

  // Notification Permission
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  // Storage Methods
  private saveReminderSettings(settings: ReminderSettings): void {
    localStorage.setItem('wellness-reminder-settings', JSON.stringify(settings));
  }

  private loadReminderSettings(): ReminderSettings {
    const saved = localStorage.getItem('wellness-reminder-settings');
    if (saved) {
      return JSON.parse(saved);
    }
    
    return {
      enabled: false,
      time: '09:00',
      frequency: 'daily',
      message: 'Time for your wellness check-in!'
    };
  }

  private saveGoals(): void {
    const serializedGoals = JSON.stringify(this.goals.map(goal => ({
      ...goal,
      createdAt: goal.createdAt.toISOString(),
      completedAt: goal.completedAt?.toISOString()
    })));
    localStorage.setItem('wellness-goals', serializedGoals);
  }

  private loadGoals(): void {
    const saved = localStorage.getItem('wellness-goals');
    if (saved) {
      const parsed = JSON.parse(saved);
      this.goals = parsed.map((goal: any) => ({
        ...goal,
        createdAt: new Date(goal.createdAt),
        completedAt: goal.completedAt ? new Date(goal.completedAt) : undefined
      }));
    }
  }

  private saveReminders(): void {
    localStorage.setItem('wellness-reminders', JSON.stringify(this.reminders));
  }

  private loadReminders(): void {
    const saved = localStorage.getItem('wellness-reminders');
    if (saved) {
      this.reminders = JSON.parse(saved);
    }
  }

  // Wellness Tips
  getRandomWellnessTip(): string {
    const tips = [
      "Take 3 deep breaths and notice how you feel in this moment.",
      "Remember: It's okay to not be okay. You're doing your best.",
      "Try the 5-4-3-2-1 grounding technique when feeling overwhelmed.",
      "Drink a glass of water and appreciate this simple act of self-care.",
      "You've made it through difficult days before, and you can do it again.",
      "Take a moment to name one thing you're grateful for today.",
      "Your feelings are valid, and it's okay to experience them fully.",
      "Consider reaching out to someone you trust if you need support.",
      "Sometimes the smallest step forward is still progress.",
      "Be gentle with yourself today - you deserve kindness."
    ];
    
    return tips[Math.floor(Math.random() * tips.length)];
  }

  // Default Goals Templates
  getDefaultGoals(): Omit<WellnessGoal, 'id' | 'createdAt' | 'currentValue' | 'isActive'>[] {
    return [
      {
        title: "Daily Mood Check-ins",
        description: "Log your mood once per day for a week",
        targetValue: 7,
        unit: "check-ins",
        frequency: "weekly"
      },
      {
        title: "Mindfulness Practice",
        description: "Complete 5 mindfulness sessions this week",
        targetValue: 5,
        unit: "sessions",
        frequency: "weekly"
      },
      {
        title: "Gratitude Journaling",
        description: "Write down 3 things you're grateful for each day",
        targetValue: 21,
        unit: "entries",
        frequency: "weekly"
      },
      {
        title: "Connect with Others",
        description: "Have meaningful conversations with friends or family",
        targetValue: 3,
        unit: "conversations",
        frequency: "weekly"
      }
    ];
  }
}

// Export singleton instance
export const reminderService = new ReminderService();