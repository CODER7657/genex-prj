// API Service for connecting to the backend
class ApiService {
  private baseURL: string;
  private token: string | null = null;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  }

  // Set authentication token
  setToken(token: string) {
    this.token = token;
  }

  // Get authentication token
  getToken(): string | null {
    return this.token;
  }

  // Generic request method
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Authentication endpoints
  async register(userData: {
    username: string;
    email: string;
    password: string;
    age: number;
    termsAccepted: boolean;
  }) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    if (response.tokens?.accessToken) {
      this.setToken(response.tokens.accessToken);
    }
    
    return response;
  }

  async login(credentials: { email: string; password: string }) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    if (response.tokens?.accessToken) {
      this.setToken(response.tokens.accessToken);
    }
    
    return response;
  }

  // Chat endpoints
  async sendMessage(message: string, sessionId?: string) {
    return await this.request('/chat/message', {
      method: 'POST',
      body: JSON.stringify({ message, sessionId }),
    });
  }

  // Create new chat session
  async createSession(title?: string, initialMessage?: string) {
    return await this.request('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ title, initialMessage }),
    });
  }

  // Get all user sessions
  async getSessions(page = 1, limit = 10) {
    return await this.request(`/chat/sessions?page=${page}&limit=${limit}`);
  }

  // Get messages from specific session
  async getSessionMessages(sessionId: string, page = 1, limit = 50) {
    return await this.request(`/chat/sessions/${sessionId}/messages?page=${page}&limit=${limit}`);
  }

  async getChatHistory(sessionId?: string) {
    const endpoint = sessionId ? `/chat/history/${sessionId}` : '/chat/history';
    return await this.request(endpoint);
  }

  async startNewSession() {
    return await this.request('/chat/session', {
      method: 'POST',
    });
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;