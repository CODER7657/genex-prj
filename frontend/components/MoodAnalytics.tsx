import React from 'react';
import { MoodLog, Mood } from '../types';

interface MoodAnalyticsProps {
    moodLogs: MoodLog[];
    onClose: () => void;
}

const moodColors: Record<Mood, string> = {
    ecstatic: '#8B5CF6', // Purple-500
    happy: '#10B981', // Green-500
    neutral: '#6B7280', // Gray-500
    sad: '#F59E0B', // Yellow-500
    crying: '#EF4444', // Red-500
};

const moodValues: Record<Mood, number> = {
    ecstatic: 5,
    happy: 4,
    neutral: 3,
    sad: 2,
    crying: 1,
};

const MoodAnalytics: React.FC<MoodAnalyticsProps> = ({ moodLogs, onClose }) => {
    // Calculate mood statistics
    const calculateMoodStats = () => {
        if (moodLogs.length === 0) return null;

        const moodCounts = moodLogs.reduce((acc, log) => {
            acc[log.mood] = (acc[log.mood] || 0) + 1;
            return acc;
        }, {} as Record<Mood, number>);

        const totalLogs = moodLogs.length;
        const averageMood = moodLogs.reduce((sum, log) => sum + moodValues[log.mood], 0) / totalLogs;
        
        const mostCommonMood = Object.entries(moodCounts).reduce((a, b) => 
            moodCounts[a[0] as Mood] > moodCounts[b[0] as Mood] ? a : b
        )[0] as Mood;

        return {
            moodCounts,
            totalLogs,
            averageMood,
            mostCommonMood
        };
    };

    // Get recent mood trend (last 7 days)
    const getRecentTrend = () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentLogs = moodLogs.filter(log => log.timestamp >= sevenDaysAgo);
        
        if (recentLogs.length < 2) return 'insufficient-data';
        
        const recentAverage = recentLogs.reduce((sum, log) => sum + moodValues[log.mood], 0) / recentLogs.length;
        const olderLogs = moodLogs.filter(log => log.timestamp < sevenDaysAgo);
        
        if (olderLogs.length === 0) return 'insufficient-data';
        
        const olderAverage = olderLogs.reduce((sum, log) => sum + moodValues[log.mood], 0) / olderLogs.length;
        
        if (recentAverage > olderAverage + 0.3) return 'improving';
        if (recentAverage < olderAverage - 0.3) return 'declining';
        return 'stable';
    };

    const stats = calculateMoodStats();
    const trend = getRecentTrend();

    const getTrendMessage = (trend: string) => {
        switch (trend) {
            case 'improving': return '📈 Your mood has been improving lately!';
            case 'declining': return '📉 You seem to be going through a tough time. Remember, it\'s okay to seek support.';
            case 'stable': return '📊 Your mood has been relatively stable.';
            default: return '📋 Keep logging your mood to see trends over time.';
        }
    };

    if (!stats) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">Mood Analytics</h2>
                        <button 
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 text-2xl"
                        >
                            ×
                        </button>
                    </div>
                    
                    <div className="text-center py-12">
                        <p className="text-gray-500 mb-4">No mood data available yet.</p>
                        <p className="text-sm text-gray-400">Start logging your moods to see insights and trends!</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Mood Analytics</h2>
                    <button 
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Overview Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                        <h3 className="text-lg font-semibold text-purple-700 mb-2">Total Check-ins</h3>
                        <p className="text-3xl font-bold text-purple-600">{stats.totalLogs}</p>
                    </div>
                    
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <h3 className="text-lg font-semibold text-blue-700 mb-2">Average Mood</h3>
                        <p className="text-3xl font-bold text-blue-600">{stats.averageMood.toFixed(1)}/5</p>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                        <h3 className="text-lg font-semibold text-green-700 mb-2">Most Common</h3>
                        <p className="text-2xl font-bold text-green-600 capitalize">{stats.mostCommonMood}</p>
                    </div>
                </div>

                {/* Trend Analysis */}
                <div className="bg-gray-50 rounded-lg p-6 mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Recent Trend (Last 7 Days)</h3>
                    <p className="text-gray-600">{getTrendMessage(trend)}</p>
                </div>

                {/* Mood Distribution Chart */}
                <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Mood Distribution</h3>
                    <div className="space-y-3">
                        {(Object.entries(stats.moodCounts) as [Mood, number][]).map(([mood, count]) => {
                            const percentage = (count / stats.totalLogs) * 100;
                            return (
                                <div key={mood} className="flex items-center">
                                    <div className="w-20 text-sm font-medium capitalize text-gray-600">
                                        {mood}
                                    </div>
                                    <div className="flex-1 bg-gray-200 rounded-full h-6 mx-3 relative overflow-hidden">
                                        <div 
                                            className="h-full rounded-full transition-all duration-500 ease-out"
                                            style={{ 
                                                width: `${percentage}%`,
                                                backgroundColor: moodColors[mood]
                                            }}
                                        />
                                    </div>
                                    <div className="w-16 text-sm text-gray-600 text-right">
                                        {count} ({percentage.toFixed(1)}%)
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Recent Entries */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Entries</h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                        {moodLogs
                            .slice(-10)
                            .reverse()
                            .map((log, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center">
                                    <div 
                                        className="w-4 h-4 rounded-full mr-3"
                                        style={{ backgroundColor: moodColors[log.mood] }}
                                    />
                                    <span className="font-medium capitalize">{log.mood}</span>
                                    {log.note && (
                                        <span className="ml-2 text-sm text-gray-600 italic">
                                            "{log.note}"
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm text-gray-500">
                                    {log.timestamp.toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MoodAnalytics;