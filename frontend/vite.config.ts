import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No secrets reach the browser bundle: the chat goes through the backend (/api), which
// holds the model key and runs the crisis routing. Only VITE_-prefixed variables (here
// VITE_API_URL) are exposed to client code, by Vite's own rule.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
});
