export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  sources?: Source[];
}

export interface Source {
  id: string;
  title: string;
  url: string;
  snippet: string;
  type: 'academic' | 'industry' | 'web';
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatResponse {
  message: string;
  sources: Source[];
  sessionId: string;
} 