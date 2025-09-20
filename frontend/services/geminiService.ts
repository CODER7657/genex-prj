
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Message } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const systemInstruction = `You are Aura, a friendly and supportive AI companion for mental wellness. Your tone must be calming, empathetic, and non-judgmental. Offer encouragement and gentle guidance. You are not a therapist and must not provide medical advice. If a user expresses thoughts of self-harm or is in immediate crisis, gently provide the following helpline number: 988 (in the US and Canada) or 111 (in the UK) and strongly advise them to contact a mental health professional or emergency services immediately. Keep your responses concise and easy to read. Use positive and uplifting language.`;

const chat: Chat = ai.chats.create({
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction,
  },
});

export const getChatResponse = async (message: string): Promise<GenerateContentResponse> => {
    try {
        const response = await chat.sendMessage({ message });
        return response;
    } catch (error) {
        console.error("Gemini API error:", error);
        throw new Error("Failed to get response from AI. Please try again.");
    }
};
