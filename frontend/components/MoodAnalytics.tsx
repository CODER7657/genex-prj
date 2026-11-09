import React from 'react';
import { Activity, ClipboardList, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { MoodLog, Mood } from '../types';
import { ClayDialog } from './clay';
import { MOOD_COLOR } from './MoodCheckIn';

interface MoodAnalyticsProps {
    moodLogs: MoodLog[];
    onClose: () => void;
}

const moodColors = MOOD_COLOR;

const trendIcons: Record<string, LucideIcon> = {
    improving: TrendingUp,
    declining: TrendingDown,
    stable: Activity,
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
            case 'improving': return 'Your mood has been improving lately!';
            case 'declining': return 'You seem to be going through a tough time. Remember, it\'s okay to seek support.';
            case 'stable': return 'Your mood has been relatively stable.';
            default: return 'Keep logging your mood to see trends over time.';
        }
    };

    if (!stats) {
        return (
            <ClayDialog title="Mood Analytics" onClose={onClose}>
                <div className="clay-well px-6 py-12 text-center">
                    <p className="mb-2 text-lg font-bold text-ink">No mood data available yet.</p>
                    <p className="text-base text-ink-soft">Start logging your moods to see insights and trends!</p>
                </div>
            </ClayDialog>
        );
    }

    const TrendIcon = trendIcons[trend] ?? ClipboardList;

    return (
        <ClayDialog title="Mood Analytics" onClose={onClose} width="max-w-4xl">
                {/* Overview Stats */}
                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="clay-card bg-mint p-5 text-center">
                        <h3 className="mb-1 text-base font-bold text-ink-soft">Total Check-ins</h3>
                        <p className="text-3xl font-extrabold text-ink">{stats.totalLogs}</p>
                    </div>

                    <div className="clay-card bg-sand p-5 text-center">
                        <h3 className="mb-1 text-base font-bold text-ink-soft">Average Mood</h3>
                        <p className="text-3xl font-extrabold text-ink">{stats.averageMood.toFixed(1)}/5</p>
                    </div>

                    <div className="clay-card p-5 text-center">
                        <h3 className="mb-1 text-base font-bold text-ink-soft">Most Common</h3>
                        <p className="text-3xl font-extrabold capitalize text-ink">{stats.mostCommonMood}</p>
                    </div>
                </div>

                {/* Trend Analysis */}
                <div className="clay-well mb-8 flex items-start gap-4 p-5">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-mint shadow-clay-sm" aria-hidden="true">
                        <TrendIcon className="h-5 w-5" strokeWidth={2.25} />
                    </span>
                    <div>
                        <h3 className="mb-1 text-lg font-extrabold text-ink">Recent Trend (Last 7 Days)</h3>
                        <p className="text-base text-ink-soft">{getTrendMessage(trend)}</p>
                    </div>
                </div>

                {/* Mood Distribution Chart */}
                <div className="mb-8">
                    <h3 className="mb-4 text-lg font-extrabold text-ink">Mood Distribution</h3>
                    <div className="space-y-3">
                        {(Object.entries(stats.moodCounts) as [Mood, number][]).map(([mood, count]) => {
                            const percentage = (count / stats.totalLogs) * 100;
                            return (
                                <div key={mood} className="flex items-center gap-3">
                                    <div className="w-20 text-sm font-bold capitalize text-ink">
                                        {mood}
                                    </div>
                                    <div className="clay-well relative h-7 flex-1 overflow-hidden rounded-full">
                                        <div
                                            className="h-full rounded-full shadow-clay-sm"
                                            style={{
                                                width: `${percentage}%`,
                                                backgroundColor: moodColors[mood]
                                            }}
                                        />
                                    </div>
                                    <div className="w-24 text-right text-sm text-ink-soft">
                                        {count} ({percentage.toFixed(1)}%)
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Recent Entries */}
                <div>
                    <h3 className="mb-4 text-lg font-extrabold text-ink">Recent Entries</h3>
                    <div className="clay-scroll max-h-60 space-y-3 overflow-y-auto p-1">
                        {moodLogs
                            .slice(-10)
                            .reverse()
                            .map((log, index) => (
                            <div key={index} className="clay-well flex items-center justify-between gap-3 p-3">
                                <div className="flex min-w-0 items-center">
                                    <div
                                        className="mr-3 h-4 w-4 flex-shrink-0 rounded-full shadow-clay-sm"
                                        style={{ backgroundColor: moodColors[log.mood] }}
                                    />
                                    <span className="font-bold capitalize text-ink">{log.mood}</span>
                                    {log.note && (
                                        <span className="ml-2 truncate text-sm text-ink-soft">
                                            "{log.note}"
                                        </span>
                                    )}
                                </div>
                                <span className="flex-shrink-0 text-sm text-ink-soft">
                                    {log.timestamp.toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
        </ClayDialog>
    );
};

export default MoodAnalytics;
