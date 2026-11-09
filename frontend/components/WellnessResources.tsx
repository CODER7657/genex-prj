import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Clock, Flower2, LifeBuoy, Lightbulb, Sparkles, Wind } from 'lucide-react';
import { ClayDialog } from './clay';

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
            'Start your day with 3 deep breaths',
            'Drink water regularly throughout the day',
            'Take short walks, even just 5 minutes',
            'Take breaks from screens every hour',
            'Eat nourishing foods when possible',
            'Maintain a consistent sleep schedule',
            'Write down 3 things you\'re grateful for',
            'Connect with someone you care about',
            'Listen to music that makes you feel good',
            'Practice one mindfulness moment daily'
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
        { id: 'all', label: 'All Resources', Icon: Sparkles },
        { id: 'breathing', label: 'Breathing', Icon: Wind },
        { id: 'meditation', label: 'Meditation', Icon: Flower2 },
        { id: 'tips', label: 'Wellness Tips', Icon: Lightbulb },
        { id: 'crisis', label: 'Crisis Support', Icon: LifeBuoy }
    ];

    const filteredResources = selectedCategory === 'all' 
        ? wellnessResources 
        : wellnessResources.filter(resource => resource.category === selectedCategory);

    if (selectedResource) {
        return (
            <ClayDialog
                title={selectedResource.title}
                onClose={() => setSelectedResource(null)}
                closeKind="back"
                closeLabel="Back to Resources"
            >
                    <div className="mb-6">
                        <p className="mb-3 text-base text-ink-soft">{selectedResource.description}</p>
                        <span className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1 text-sm font-bold text-ink">
                            <Clock className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                            Duration: {selectedResource.duration}
                        </span>
                    </div>

                    <ol className="space-y-3">
                        {selectedResource.content.filter(step => step !== '').map((step, index) => (
                            <li key={index} className="clay-well p-4">
                                <p className="text-base text-ink">{step}</p>
                            </li>
                        ))}
                    </ol>

                    <div className="mt-8 flex justify-center">
                        <button
                            type="button"
                            onClick={() => setSelectedResource(null)}
                            className="clay-btn clay-coral px-6"
                        >
                            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                            Back to Resources
                        </button>
                    </div>
            </ClayDialog>
        );
    }

    return (
        <ClayDialog title="Wellness Resources" onClose={onClose} width="max-w-4xl">
                {/* Category Filter */}
                <div className="mb-8 flex flex-wrap gap-3" role="group" aria-label="Categories">
                    {categories.map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setSelectedCategory(id)}
                            aria-pressed={selectedCategory === id}
                            className={`clay-btn text-sm ${selectedCategory === id ? 'clay-coral' : ''}`}
                        >
                            <Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Crisis Resources */}
                {selectedCategory === 'crisis' && (
                    <div className="mb-8">
                        <div className="rounded-clay-lg border-2 border-ink bg-white p-5 sm:p-6">
                            <h3 className="mb-3 text-lg font-extrabold text-ink">Crisis Support</h3>
                            <p className="mb-4 text-base text-ink">
                                If you're having thoughts of self-harm or suicide, please reach out for help immediately:
                            </p>
                            <div className="space-y-3">
                                {crisisResources.map((resource, index) => (
                                    <div key={index} className="rounded-clay border border-ink-soft bg-white p-4">
                                        <h4 className="font-extrabold text-ink">{resource.title}</h4>
                                        <p className="text-lg font-extrabold text-ink">{resource.phone}</p>
                                        <p className="text-sm text-ink-soft">{resource.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Resource Grid */}
                {selectedCategory !== 'crisis' && (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {filteredResources.map(resource => (
                            <button
                                key={resource.id}
                                type="button"
                                className="clay-card clay-card-hover flex flex-col p-5 text-left sm:p-6"
                                onClick={() => setSelectedResource(resource)}
                            >
                                <span className="mb-3 flex w-full items-start justify-between gap-3">
                                    <span className="text-lg font-extrabold text-ink">{resource.title}</span>
                                    <span className="flex-shrink-0 rounded-full bg-sand px-3 py-1 text-sm font-bold text-ink">
                                        {resource.duration}
                                    </span>
                                </span>
                                <span className="mb-4 flex-1 text-base text-ink-soft">{resource.description}</span>
                                <span className="flex w-full items-center justify-between">
                                    <span className="rounded-full bg-mint px-3 py-1 text-sm font-bold capitalize text-ink">
                                        {resource.category}
                                    </span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-ink">
                                        Start
                                        <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                )}
        </ClayDialog>
    );
};

export default WellnessResources;