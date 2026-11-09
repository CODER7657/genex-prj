import React, { useState } from 'react';
import { Check, CloudRain, Frown, Laugh, Meh, Smile, type LucideIcon } from 'lucide-react';
import { Mood } from '../types';
import { ClayDialog } from './clay';

interface MoodCheckInProps {
    onClose: () => void;
    onSaveMood: (mood: Mood, note?: string) => void;
}

/** Each mood's clay colour; shared with MoodAnalytics so the two read as one system. */
export const MOOD_COLOR: Record<Mood, string> = {
    ecstatic: 'var(--leaf)',
    happy: 'var(--mint)',
    neutral: 'var(--sand)',
    sad: 'var(--coral)',
    crying: 'var(--clay)',
};

const moodOptions: { mood: Mood; label: string; Icon: LucideIcon }[] = [
    { mood: 'ecstatic', label: 'Ecstatic', Icon: Laugh },
    { mood: 'happy', label: 'Happy', Icon: Smile },
    { mood: 'neutral', label: 'Neutral', Icon: Meh },
    { mood: 'sad', label: 'Sad', Icon: Frown },
    { mood: 'crying', label: 'Crying', Icon: CloudRain },
];

const MoodCheckIn: React.FC<MoodCheckInProps> = ({ onClose, onSaveMood }) => {
    const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
    const [note, setNote] = useState('');

    const handleSave = () => {
        if (selectedMood) {
            onSaveMood(selectedMood, note);
        }
    };

    return (
        <ClayDialog
            title="How are you feeling right now?"
            subtitle="Select a mood that best describes you."
            onClose={onClose}
            closeLabel="Cancel"
            width="max-w-2xl"
        >
            <div className="mb-7 flex flex-wrap justify-center gap-3 sm:gap-4" role="group" aria-label="Moods">
                {moodOptions.map(({ mood, label, Icon }) => {
                    const selected = selectedMood === mood;
                    return (
                        <button
                            key={mood}
                            type="button"
                            onClick={() => setSelectedMood(mood)}
                            aria-pressed={selected}
                            className={`clay-btn relative w-[5.75rem] flex-col gap-2 rounded-clay-lg px-2 pb-3 pt-4 sm:w-[6.5rem] ${selected ? 'outline outline-[3px] outline-ink outline-offset-2' : ''}`}
                        >
                            <span
                                className="flex h-14 w-14 items-center justify-center rounded-full shadow-clay-sm sm:h-16 sm:w-16"
                                style={{ backgroundColor: MOOD_COLOR[mood] }}
                                aria-hidden="true"
                            >
                                <Icon className="h-8 w-8 sm:h-9 sm:w-9" strokeWidth={2.25} />
                            </span>
                            <span className="text-sm font-extrabold">{label}</span>
                            {selected ? (
                                <span className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white" aria-hidden="true">
                                    <Check className="h-4 w-4" strokeWidth={3} />
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>

            <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's making you feel this way? (Optional)"
                aria-label="What's making you feel this way? (Optional)"
                className="clay-input h-28 resize-none p-4 text-base"
            />

            <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={onClose} className="clay-btn px-6">
                    Cancel
                </button>
                <button type="button" onClick={handleSave} disabled={!selectedMood} className="clay-btn clay-coral px-8">
                    Save
                </button>
            </div>
        </ClayDialog>
    );
};

export default MoodCheckIn;
