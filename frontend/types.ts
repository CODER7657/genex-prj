
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

/** One helpline from the backend (crisisResponse.resources), already chosen by region. */
export interface CrisisLine {
    name: string;
    number: string;
    description: string;
    region: string;
    tel?: string;
    sms?: string;
}

export interface EmergencyResources {
    crisis_lines: CrisisLine[];
    emergency: { region: string; number: string }[];
    immediate_actions: string[];
}
