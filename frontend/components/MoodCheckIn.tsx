
import React, { useState } from 'react';
import { Mood } from '../types';
import { CryingFaceIcon, EcstaticFaceIcon, HappyFaceIcon, NeutralFaceIcon, SadFaceIcon } from './icons';

interface MoodCheckInProps {
    onClose: () => void;
    onSaveMood: (mood: Mood, note?: string) => void;
}

const moodOptions: { mood: Mood, label: string, icon: React.ReactNode }[] = [
    { mood: 'ecstatic', label: 'Ecstatic', icon: <EcstaticFaceIcon className="w-12 h-12" /> },
    { mood: 'happy', label: 'Happy', icon: <HappyFaceIcon className="w-12 h-12" /> },
    { mood: 'neutral', label: 'Neutral', icon: <NeutralFaceIcon className="w-12 h-12" /> },
    { mood: 'sad', label: 'Sad', icon: <SadFaceIcon className="w-12 h-12" /> },
    { mood: 'crying', label: 'Crying', icon: <CryingFaceIcon className="w-12 h-12" /> },
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full animate-fade-in-up">
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">How are you feeling right now?</h2>
                <p className="text-center text-gray-500 mb-6">Select a mood that best describes you.</p>

                <div className="flex justify-around items-center mb-6">
                    {moodOptions.map(({ mood, icon, label }) => (
                        <button
                            key={mood}
                            onClick={() => setSelectedMood(mood)}
                            className={`flex flex-col items-center p-2 rounded-lg transition-all duration-200 transform hover:scale-110 focus:outline-none ${selectedMood === mood ? 'text-purple-600' : 'text-gray-400 hover:text-purple-500'}`}
                            aria-label={label}
                        >
                            {icon}
                            <span className={`mt-2 text-xs font-semibold ${selectedMood === mood ? 'text-purple-600' : 'text-gray-500'}`}>{label}</span>
                        </button>
                    ))}
                </div>

                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What's making you feel this way? (Optional)"
                    className="w-full p-3 border border-gray-300 rounded-lg h-24 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 transition-shadow duration-200"
                />

                <div className="flex justify-end gap-4 mt-6">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-gray-700 bg-gray-100 rounded-full font-semibold hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!selectedMood}
                        className="px-6 py-2 text-white bg-purple-600 rounded-full font-semibold hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MoodCheckIn;
