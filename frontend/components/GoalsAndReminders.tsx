import React, { useState, useEffect } from 'react';
import { AlarmClock, Bell, Lightbulb, PartyPopper, Plus, Target, X } from 'lucide-react';
import { ClayDialog, ClaySwitch } from './clay';
import { reminderService, WellnessGoal, ReminderSettings } from '../services/reminderService';

interface GoalsAndRemindersProps {
  onClose: () => void;
}

const GoalsAndReminders: React.FC<GoalsAndRemindersProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'reminders' | 'goals'>('reminders');
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    enabled: false,
    time: '09:00',
    frequency: 'daily',
    message: 'Time for your wellness check-in!'
  });
  const [activeGoals, setActiveGoals] = useState<WellnessGoal[]>([]);
  const [completedGoals, setCompletedGoals] = useState<WellnessGoal[]>([]);
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetValue: 1,
    unit: 'times',
    frequency: 'weekly' as 'daily' | 'weekly' | 'monthly'
  });
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);

  useEffect(() => {
    loadData();
    checkNotificationPermission();
  }, []);

  const loadData = () => {
    setActiveGoals(reminderService.getActiveGoals());
    setCompletedGoals(reminderService.getCompletedGoals());
  };

  const checkNotificationPermission = () => {
    setHasNotificationPermission(Notification.permission === 'granted');
  };

  const handleReminderToggle = (enabled: boolean) => {
    const newSettings = { ...reminderSettings, enabled };
    setReminderSettings(newSettings);
    reminderService.setDailyReminder(newSettings);
  };

  const handleTimeChange = (time: string) => {
    const newSettings = { ...reminderSettings, time };
    setReminderSettings(newSettings);
    reminderService.setDailyReminder(newSettings);
  };

  const requestNotificationPermission = async () => {
    const granted = await reminderService.requestNotificationPermission();
    setHasNotificationPermission(granted);
    if (!granted) {
      alert('Please enable notifications in your browser settings to receive reminders.');
    }
  };

  const handleCreateGoal = () => {
    if (!newGoal.title.trim()) return;

    reminderService.createGoal(newGoal);
    setNewGoal({
      title: '',
      description: '',
      targetValue: 1,
      unit: 'times',
      frequency: 'weekly'
    });
    setShowCreateGoal(false);
    loadData();
  };

  const handleGoalProgress = (goalId: string) => {
    reminderService.updateGoalProgress(goalId);
    loadData();
  };

  const handleDeactivateGoal = (goalId: string) => {
    if (window.confirm('Are you sure you want to remove this goal?')) {
      reminderService.deactivateGoal(goalId);
      loadData();
    }
  };

  const createDefaultGoal = (defaultGoal: any) => {
    reminderService.createGoal(defaultGoal);
    loadData();
  };

  const getProgressPercentage = (goal: WellnessGoal) => {
    return Math.min((goal.currentValue / goal.targetValue) * 100, 100);
  };

  const tabClass = (active: boolean) =>
    `clay-btn flex-1 ${active ? 'clay-coral' : 'bg-transparent shadow-none'}`;

  return (
    <ClayDialog title="Goals & Reminders" onClose={onClose} width="max-w-4xl">
        {/* Tab Navigation */}
        <div className="clay-well mb-8 flex gap-2 rounded-full p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('reminders')}
            aria-pressed={activeTab === 'reminders'}
            className={tabClass(activeTab === 'reminders')}
          >
            <AlarmClock className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            Reminders
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('goals')}
            aria-pressed={activeTab === 'goals'}
            className={tabClass(activeTab === 'goals')}
          >
            <Target className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            Goals
          </button>
        </div>

        {/* Reminders Tab */}
        {activeTab === 'reminders' && (
          <div className="space-y-6">
            <div className="clay-card bg-mint p-5 sm:p-6">
              <h3 className="mb-4 text-lg font-extrabold text-ink">Daily Check-in Reminders</h3>

              {/* Notification Permission */}
              {!hasNotificationPermission && (
                <div className="mb-4 flex flex-col items-start gap-3 rounded-clay bg-white p-4 shadow-well">
                  <p className="text-sm text-ink">
                    Enable notifications to receive wellness reminders
                  </p>
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    className="clay-btn clay-sand text-sm"
                  >
                    <Bell className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                    Enable Notifications
                  </button>
                </div>
              )}

              {/* Reminder Toggle */}
              <div className="mb-4 flex items-center justify-between gap-4">
                <span className="text-base font-bold text-ink">
                  Daily mood check-in reminders
                </span>
                <ClaySwitch
                  checked={reminderSettings.enabled}
                  onChange={() => handleReminderToggle(!reminderSettings.enabled)}
                  label="Daily mood check-in reminders"
                />
              </div>

              {/* Time Picker */}
              {reminderSettings.enabled && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="reminder-time" className="mb-2 block text-sm font-bold text-ink">
                      Reminder Time
                    </label>
                    <input
                      id="reminder-time"
                      type="time"
                      value={reminderSettings.time}
                      onChange={(e) => handleTimeChange(e.target.value)}
                      className="clay-input"
                    />
                  </div>

                  <div className="flex items-start gap-2 text-sm text-ink">
                    <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2.5} aria-hidden="true" />
                    <span>You'll receive a daily reminder at {reminderSettings.time} to check in with your mood and feelings.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Goals Tab */}
        {activeTab === 'goals' && (
          <div className="space-y-6">
            {/* Create Goal Button */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-extrabold text-ink">Your Wellness Goals</h3>
              <button
                type="button"
                onClick={() => setShowCreateGoal(true)}
                className="clay-btn clay-coral"
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                Create Goal
              </button>
            </div>

            {/* Active Goals */}
            {activeGoals.length > 0 && (
              <div>
                <h4 className="mb-3 font-bold text-ink-soft">Active Goals</h4>
                <div className="space-y-4">
                  {activeGoals.map(goal => (
                    <div key={goal.id} className="clay-card p-5">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h5 className="font-extrabold text-ink">{goal.title}</h5>
                          <p className="text-sm text-ink-soft">{goal.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeactivateGoal(goal.id)}
                          className="clay-btn clay-btn-icon flex-shrink-0"
                          aria-label={`Remove goal: ${goal.title}`}
                          title="Remove goal"
                        >
                          <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-ink-soft">
                          {goal.currentValue} / {goal.targetValue} {goal.unit}
                        </span>
                        <span className="text-sm font-extrabold text-ink">
                          {Math.round(getProgressPercentage(goal))}%
                        </span>
                      </div>

                      <div className="clay-well mb-4 h-4 w-full overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full bg-leaf shadow-clay-sm"
                          style={{ width: `${getProgressPercentage(goal)}%` }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGoalProgress(goal.id)}
                        className="clay-btn clay-mint w-full"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                        Mark Progress
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Default Goals Suggestions */}
            {activeGoals.length === 0 && (
              <div>
                <h4 className="mb-3 font-bold text-ink-soft">Suggested Goals</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {reminderService.getDefaultGoals().map((defaultGoal, index) => (
                    <div key={index} className="clay-card flex flex-col items-start bg-mint p-5">
                      <h5 className="mb-1 font-extrabold text-ink">{defaultGoal.title}</h5>
                      <p className="mb-4 flex-1 text-sm text-ink-soft">{defaultGoal.description}</p>
                      <button
                        type="button"
                        onClick={() => createDefaultGoal(defaultGoal)}
                        className="clay-btn text-sm"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                        Add this goal
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Goals */}
            {completedGoals.length > 0 && (
              <div>
                <h4 className="mb-3 flex items-center gap-2 font-bold text-ink-soft">
                  Completed Goals
                  <PartyPopper className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                </h4>
                <div className="space-y-3">
                  {completedGoals.map(goal => (
                    <div key={goal.id} className="clay-card bg-mint p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-extrabold text-ink">{goal.title}</span>
                        <span className="text-sm text-ink-soft">
                          Completed {goal.completedAt?.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create Goal Modal */}
        {showCreateGoal && (
          <ClayDialog title="Create New Goal" onClose={() => setShowCreateGoal(false)} closeLabel="Cancel" width="max-w-md" zClass="z-[60]">
              <div className="space-y-4">
                <div>
                  <label htmlFor="goal-title" className="mb-1 block text-sm font-bold text-ink">
                    Goal Title
                  </label>
                  <input
                    id="goal-title"
                    type="text"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                    className="clay-input"
                    placeholder="e.g., Daily Meditation"
                  />
                </div>

                <div>
                  <label htmlFor="goal-description" className="mb-1 block text-sm font-bold text-ink">
                    Description
                  </label>
                  <textarea
                    id="goal-description"
                    value={newGoal.description}
                    onChange={(e) => setNewGoal({...newGoal, description: e.target.value})}
                    className="clay-input"
                    placeholder="Describe your goal..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="goal-target" className="mb-1 block text-sm font-bold text-ink">
                      Target
                    </label>
                    <input
                      id="goal-target"
                      type="number"
                      min="1"
                      value={newGoal.targetValue}
                      onChange={(e) => setNewGoal({...newGoal, targetValue: parseInt(e.target.value) || 1})}
                      className="clay-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="goal-unit" className="mb-1 block text-sm font-bold text-ink">
                      Unit
                    </label>
                    <input
                      id="goal-unit"
                      type="text"
                      value={newGoal.unit}
                      onChange={(e) => setNewGoal({...newGoal, unit: e.target.value})}
                      className="clay-input"
                      placeholder="e.g., times, minutes"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="goal-frequency" className="mb-1 block text-sm font-bold text-ink">
                    Frequency
                  </label>
                  <select
                    id="goal-frequency"
                    value={newGoal.frequency}
                    onChange={(e) => setNewGoal({...newGoal, frequency: e.target.value as any})}
                    className="clay-input"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateGoal(false)}
                  className="clay-btn px-6"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateGoal}
                  disabled={!newGoal.title.trim()}
                  className="clay-btn clay-coral px-6"
                >
                  Create Goal
                </button>
              </div>
          </ClayDialog>
        )}
    </ClayDialog>
  );
};

export default GoalsAndReminders;