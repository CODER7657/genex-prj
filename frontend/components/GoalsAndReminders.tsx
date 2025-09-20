import React, { useState, useEffect } from 'react';
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Goals & Reminders</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('reminders')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'reminders'
                ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            ⏰ Reminders
          </button>
          <button
            onClick={() => setActiveTab('goals')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'goals'
                ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            🎯 Goals
          </button>
        </div>

        {/* Reminders Tab */}
        {activeTab === 'reminders' && (
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Daily Check-in Reminders</h3>
              
              {/* Notification Permission */}
              {!hasNotificationPermission && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                    Enable notifications to receive wellness reminders
                  </p>
                  <button
                    onClick={requestNotificationPermission}
                    className="text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
                  >
                    Enable Notifications
                  </button>
                </div>
              )}

              {/* Reminder Toggle */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Daily mood check-in reminders
                </span>
                <button
                  onClick={() => handleReminderToggle(!reminderSettings.enabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                    reminderSettings.enabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                      reminderSettings.enabled ? 'transform translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Time Picker */}
              {reminderSettings.enabled && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Reminder Time
                    </label>
                    <input
                      type="time"
                      value={reminderSettings.time}
                      onChange={(e) => handleTimeChange(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    💡 You'll receive a daily reminder at {reminderSettings.time} to check in with your mood and feelings.
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
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Your Wellness Goals</h3>
              <button
                onClick={() => setShowCreateGoal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                + Create Goal
              </button>
            </div>

            {/* Active Goals */}
            {activeGoals.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Active Goals</h4>
                <div className="space-y-3">
                  {activeGoals.map(goal => (
                    <div key={goal.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h5 className="font-semibold text-gray-800 dark:text-gray-200">{goal.title}</h5>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{goal.description}</p>
                        </div>
                        <button
                          onClick={() => handleDeactivateGoal(goal.id)}
                          className="text-gray-400 hover:text-red-500 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {goal.currentValue} / {goal.targetValue} {goal.unit}
                        </span>
                        <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                          {Math.round(getProgressPercentage(goal))}%
                        </span>
                      </div>
                      
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-3">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${getProgressPercentage(goal)}%` }}
                        />
                      </div>
                      
                      <button
                        onClick={() => handleGoalProgress(goal.id)}
                        className="w-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 py-2 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                      >
                        + Mark Progress
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Default Goals Suggestions */}
            {activeGoals.length === 0 && (
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Suggested Goals</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {reminderService.getDefaultGoals().map((defaultGoal, index) => (
                    <div key={index} className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                      <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">{defaultGoal.title}</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{defaultGoal.description}</p>
                      <button
                        onClick={() => createDefaultGoal(defaultGoal)}
                        className="text-purple-600 dark:text-purple-400 text-sm hover:text-purple-700 dark:hover:text-purple-300"
                      >
                        + Add this goal
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Goals */}
            {completedGoals.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Completed Goals 🎉</h4>
                <div className="space-y-2">
                  {completedGoals.map(goal => (
                    <div key={goal.id} className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-green-800 dark:text-green-300">{goal.title}</span>
                        <span className="text-sm text-green-600 dark:text-green-400">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Create New Goal</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Goal Title
                  </label>
                  <input
                    type="text"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="e.g., Daily Meditation"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newGoal.description}
                    onChange={(e) => setNewGoal({...newGoal, description: e.target.value})}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Describe your goal..."
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Target
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newGoal.targetValue}
                      onChange={(e) => setNewGoal({...newGoal, targetValue: parseInt(e.target.value) || 1})}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={newGoal.unit}
                      onChange={(e) => setNewGoal({...newGoal, unit: e.target.value})}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="e.g., times, minutes"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={newGoal.frequency}
                    onChange={(e) => setNewGoal({...newGoal, frequency: e.target.value as any})}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateGoal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGoal}
                  disabled={!newGoal.title.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Goal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoalsAndReminders;