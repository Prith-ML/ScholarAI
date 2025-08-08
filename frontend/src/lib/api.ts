import axios from 'axios';
import type { Message, ChatResponse } from '@/types/chat';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Chat API
export const chatAPI = {
  sendMessage: async (message: string, sessionId?: string): Promise<ChatResponse> => {
    const response = await api.post('/chat/send/', {
      message,
      session_id: sessionId,
    });
    return response.data;
  },

  getSessions: async () => {
    const response = await api.get('/chat/sessions/');
    return response.data;
  },

  getSession: async (sessionId: string) => {
    const response = await api.get(`/chat/sessions/${sessionId}/`);
    return response.data;
  },

  deleteSession: async (sessionId: string) => {
    const response = await api.delete(`/chat/sessions/${sessionId}/`);
    return response.data;
  },
};

// Research API
export const researchAPI = {
  search: async (query: string, filters?: any) => {
    const response = await api.post('/research/search/', {
      query,
      filters,
    });
    return response.data;
  },

  getSources: async (query: string) => {
    const response = await api.get(`/research/sources/?q=${encodeURIComponent(query)}`);
    return response.data;
  },
};

// Health check
export const healthCheck = async () => {
  try {
    const response = await api.get('/health/');
    return response.data;
  } catch (error) {
    throw new Error('Backend is not available');
  }
};

export default api; 