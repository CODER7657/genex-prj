/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_SOCKET_URL: string
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
  readonly VITE_ENABLE_VOICE: string
  readonly VITE_ENABLE_ANALYTICS: string
  readonly VITE_ENABLE_3D_BACKGROUND: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}