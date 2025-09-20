import React, { useState } from 'react';

interface WellnessResourcesProps {
    onClose: () => void;
}

interface Resource {
    id: string;
    title: string;
    description: string;
    duration: string;
    category: 'meditation' | 'breathing' | 'tips' | 'crisis';
    content: string[];
}

const wellnessResources: Resource[] = [
    {
        id: 'breathing-4-7-8',
        title: '4-7-8 Breathing Technique',
        description: 'A simple breathing exercise to reduce anxiety and promote relaxation.',
        duration: '5 minutes',
        category: 'breathing',
        content: [
            '1. Sit comfortably with your back straight',
            '2. Place your tongue against the roof of your mouth, behind your front teeth',
            '3. Exhale completely through your mouth, making a whoosh sound',
            '4. Close your mouth and inhale through your nose for 4 counts',
            '5. Hold your breath for 7 counts',
            '6. Exhale through your mouth for 8 counts, making a whoosh sound',
            '7. Repeat this cycle 3-4 times',
            '8. Return to normal breathing'
        ]
    },
    {
        id: 'mindfulness-meditation',
        title: 'Mindfulness Meditation',
        description: 'A basic mindfulness practice to increase awareness and reduce stress.',
        duration: '10 minutes',
        category: 'meditation',
        content: [
            '1. Find a quiet, comfortable place to sit',
            '2. Close your eyes or soften your gaze',
            '3. Focus on your natural breathing',
            '4. Notice when your mind wanders (this is normal)',
            '5. Gently bring your attention back to your breath',
            '6. Don\'t judge yourself for having thoughts',
            '7. Continue for 10 minutes',
            '8. Slowly open your eyes and notice how you feel'
        ]
    },
    {
        id: 'grounding-5-4-3-2-1',
        title: '5-4-3-2-1 Grounding Technique',
        description: 'A sensory technique to help manage anxiety and panic attacks.',
        duration: '3-5 minutes',
        category: 'tips',
        content: [
            'Look around and name:',
            '• 5 things you can see',
            '• 4 things you can touch',
            '• 3 things you can hear',
            '• 2 things you can smell',
            '• 1 thing you can taste',
            '',
            'Take slow, deep breaths throughout this exercise.',
            'This helps bring you back to the present moment.'
        ]
    },
    {
        id: 'box-breathing',
        title: 'Box Breathing',
        description: 'A structured breathing pattern used by Navy SEALs to stay calm under pressure.',
        duration: '5-10 minutes',
        category: 'breathing',
        content: [
            '1. Sit upright in a comfortable position',
            '2. Exhale slowly through your mouth',
            '3. Inhale through your nose for 4 counts',
            '4. Hold your breath for 4 counts',
            '5. Exhale through your mouth for 4 counts',
            '6. Hold empty for 4 counts',
            '7. Repeat this "box" pattern',
            '8. Continue for 5-10 minutes',
            '9. End with normal breathing'
        ]
    },
    {
        id: 'body-scan',
        title: 'Progressive Body Scan',
        description: 'A relaxation technique that helps release physical tension.',
        duration: '15-20 minutes',
        category: 'meditation',
        content: [
            '1. Lie down comfortably on your back',
            '2. Close your eyes and take a few deep breaths',
            '3. Start at the top of your head',
            '4. Notice any tension or sensations',
            '5. Slowly move your attention down your body',
            '6. Spend 30 seconds on each body part',
            '7. Consciously relax each area as you go',
            '8. End at your toes',
            '9. Take a moment to notice your whole body relaxed'
        ]
    },
    {
        id: 'daily-wellness-tips',
        title: 'Daily Wellness Tips',
        description: 'Simple practices to incorporate into your daily routine.',
        duration: 'Ongoing',
        category: 'tips',
        content: [
            '🌅 Start your day with 3 deep breaths',
            '💧 Drink water regularly throughout the day',
            '🚶 Take short walks, even just 5 minutes',
            '📱 Take breaks from screens every hour',
            '🍎 Eat nourishing foods when possible',
            '😴 Maintain a consistent sleep schedule',
            '📝 Write down 3 things you\'re grateful for',
            '🤝 Connect with someone you care about',
            '🎵 Listen to music that makes you feel good',
            '🧘 Practice one mindfulness moment daily'
        ]
    }
];

const crisisResources = [
    {
        title: 'National Suicide Prevention Lifeline',
        phone: '988',
        description: '24/7 free and confidential support'
    },
    {
        title: 'Crisis Text Line',
        phone: 'Text HOME to 741741',
        description: 'Free, 24/7 crisis support via text'
    },
    {
        title: 'SAMHSA National Helpline',
        phone: '1-800-662-4357',
        description: 'Treatment referral and information service'
    }
];

const WellnessResources: React.FC<WellnessResourcesProps> = ({ onClose }) => {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

    const categories = [
        { id: 'all', label: 'All Resources', emoji: '🌟' },
        { id: 'breathing', label: 'Breathing', emoji: '🫁' },
        { id: 'meditation', label: 'Meditation', emoji: '🧘' },
        { id: 'tips', label: 'Wellness Tips', emoji: '💡' },
        { id: 'crisis', label: 'Crisis Support', emoji: '🆘' }
    ];

    const filteredResources = selectedCategory === 'all' 
        ? wellnessResources 
        : wellnessResources.filter(resource => resource.category === selectedCategory);

    if (selectedResource) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">{selectedResource.title}</h2>
                        <button 
                            onClick={() => setSelectedResource(null)}
                            className="text-gray-500 hover:text-gray-700 text-2xl"
                        >
                            ←
                        </button>
                    </div>
                    
                    <div className="mb-6">
                        <p className="text-gray-600 mb-2">{selectedResource.description}</p>
                        <p className="text-sm text-purple-600 font-medium">Duration: {selectedResource.duration}</p>
                    </div>

                    <div className="space-y-3">
                        {selectedResource.content.map((step, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-gray-700">{step}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={() => setSelectedResource(null)}
                            className="bg-purple-600 text-white font-semibold py-3 px-6 rounded-full hover:bg-purple-700 transition-colors"
                        >
                            Back to Resources
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Wellness Resources</h2>
                    <button 
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-3 mb-8">
                    {categories.map(category => (
                        <button
                            key={category.id}
                            onClick={() => setSelectedCategory(category.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${
                                selectedCategory === category.id
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-purple-100'
                            }`}
                        >
                            <span>{category.emoji}</span>
                            {category.label}
                        </button>
                    ))}
                </div>

                {/* Crisis Resources */}
                {selectedCategory === 'crisis' && (
                    <div className="mb-8">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                            <h3 className="text-lg font-semibold text-red-800 mb-4">🚨 Crisis Support</h3>
                            <p className="text-red-700 mb-4">
                                If you're having thoughts of self-harm or suicide, please reach out for help immediately:
                            </p>
                            <div className="space-y-4">
                                {crisisResources.map((resource, index) => (
                                    <div key={index} className="bg-white p-4 rounded-lg border">
                                        <h4 className="font-semibold text-gray-800">{resource.title}</h4>
                                        <p className="text-lg font-bold text-red-600">{resource.phone}</p>
                                        <p className="text-sm text-gray-600">{resource.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Resource Grid */}
                {selectedCategory !== 'crisis' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredResources.map(resource => (
                            <div 
                                key={resource.id}
                                className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                                onClick={() => setSelectedResource(resource)}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="text-lg font-semibold text-gray-800">{resource.title}</h3>
                                    <span className="text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                        {resource.duration}
                                    </span>
                                </div>
                                <p className="text-gray-600 mb-4">{resource.description}</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-purple-600 font-medium capitalize">
                                        {resource.category}
                                    </span>
                                    <span className="text-purple-600 hover:text-purple-700">
                                        Start →
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WellnessResources;