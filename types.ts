
// --- TYPE DEFINITIONS ---
export interface User {
  _id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface Message {
  _id: string;
  sender: User;
  messageType: string;
  content: string;
  mediaUrl?: string;
  createdAt: string;
  isSender: boolean;
  status?: 'sending' | 'failed';
  uploadProgress?: number;
}

export interface Conversation {
  _id: string;
  participant: User;
  lastMessage: {
    content: string;
    messageType: string;
    mediaUrl?: string;
    createdAt: string;
    isSender: boolean;
  } | null;
  unreadCount: number;
}

export interface BlockStatus {
    isBlocked: boolean;
    amITheBlocker: boolean;
}