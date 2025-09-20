
export interface Message {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export type Mood = 'ecstatic' | 'happy' | 'neutral' | 'sad' | 'crying';

export interface MoodLog {
    mood: Mood;
    note?: string;
    timestamp: Date;
}
