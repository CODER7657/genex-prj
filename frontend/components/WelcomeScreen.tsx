import React from 'react';
import { ArrowRight, HeartPulse } from 'lucide-react';

interface WelcomeScreenProps {
    onStartChat: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStartChat }) => {
    return (
        <div className="clay-surface relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
            {/* Decorative clay pebbles */}
            <span aria-hidden="true" className="clay-pebble bg-coral -left-10 top-[8%] h-28 w-36 sm:h-40 sm:w-52" />
            <span aria-hidden="true" className="clay-pebble bg-leaf -right-12 top-[18%] h-24 w-28 sm:h-36 sm:w-44" />
            <span aria-hidden="true" className="clay-pebble bg-sand -bottom-10 left-[12%] h-28 w-44 sm:h-36 sm:w-64" />
            <span aria-hidden="true" className="clay-pebble bg-white -bottom-6 right-[10%] h-20 w-24 sm:h-28 sm:w-32" />

            <div className="clay-card relative w-full max-w-2xl px-6 py-10 text-center sm:px-12 sm:py-14">
                <span className="clay-card mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-clay-xl bg-coral sm:h-28 sm:w-28" aria-hidden="true">
                    <HeartPulse className="h-12 w-12 sm:h-14 sm:w-14" strokeWidth={2.25} />
                </span>
                <h1 className="mb-4 text-hero font-extrabold tracking-tight text-ink">
                    Welcome to Your AI Wellness Companion
                </h1>
                <p className="mx-auto mb-9 max-w-xl text-lg text-ink-soft">
                    A safe and supportive space to explore your thoughts and feelings. I'm here to listen, without judgment.
                </p>
                <button
                    type="button"
                    onClick={onStartChat}
                    className="clay-btn clay-coral min-h-[3.5rem] px-8 text-lg font-extrabold"
                >
                    Start a Conversation
                    <ArrowRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
};

export default WelcomeScreen;
