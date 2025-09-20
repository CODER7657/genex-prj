
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Message } from '../types';

// Get API key from environment with fallback
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.warn("Gemini API key not set. Using fallback responses.");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const systemInstruction = `You are Aura, a friendly and supportive AI companion for mental wellness. Your tone must be calming, empathetic, and non-judgmental. Offer encouragement and gentle guidance. You are not a therapist and must not provide medical advice. If a user expresses thoughts of self-harm or is in immediate crisis, gently provide the following helpline number: 988 (in the US and Canada) or 111 (in the UK) and strongly advise them to contact a mental health professional or emergency services immediately. Keep your responses concise and easy to read. Use positive and uplifting language.`;

const chat: Chat | null = ai ? ai.chats.create({
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction,
  },
}) : null;

export const getChatResponse = async (message: string): Promise<GenerateContentResponse> => {
    try {
        if (!chat) {
            // Fallback response when Gemini is not available
            return {
                text: "I'm here to listen and support you. However, I'm currently having some technical difficulties connecting to my AI service. Please try connecting to our main backend service or try again later.",
            } as GenerateContentResponse;
        }
        const response = await chat.sendMessage({ message });
        return response;
    } catch (error) {
        console.error("Gemini API error:", error);
        throw new Error("Failed to get response from AI. Please try again.");
    }
};
