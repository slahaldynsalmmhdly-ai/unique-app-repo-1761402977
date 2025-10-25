export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  isBlocked?: boolean;
}

export interface Message {
  _id: string;
  conversationId: string;
  sender: User;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  createdAt: string;
  isRead: boolean;
}

export interface Conversation {
  _id: string;
  participants: User[];
  lastMessage: {
    text: string;
    createdAt: string;
    sender: string;
    isSender: boolean;
  } | null;
  unreadCount: number;
}

export interface CallLog {
  _id: string;
  caller: User;
  receiver: User;
  callType: 'video' | 'audio';
  status: 'connecting' | 'missed' | 'answered' | 'rejected' | 'cancelled' | 'completed' | 'declined';
  duration: number;
  startedAt: string;
  endedAt?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AppState {
  currentUser: User | null;
  currentConversationId: string | null;
  currentCallLogId: string | null;
  callStartTime: number | null;
  currentCallReceiverId: string | null;
  backgroundSyncIntervalId: number | null;
  selectedMediaUrl: string | null;
  selectedMediaType: 'image' | 'video' | null;
  currentChatUserId: string | null;
  longPressedMessageId: string | null;
}

