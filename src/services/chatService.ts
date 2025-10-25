import { apiFetch } from './api';
import type { Conversation, Message } from '../types';

export const chatService = {
  /**
   * Get all conversations
   */
  async getConversations(): Promise<Conversation[]> {
    return await apiFetch('/api/v1/chat/conversations');
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    return await apiFetch(`/api/v1/chat/conversations/${conversationId}/messages`);
  },

  /**
   * Send a text message
   */
  async sendMessage(conversationId: string, text: string): Promise<Message> {
    return await apiFetch(`/api/v1/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  /**
   * Send a media message
   */
  async sendMediaMessage(conversationId: string, mediaUrl: string, mediaType: 'image' | 'video'): Promise<Message> {
    return await apiFetch(`/api/v1/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ mediaUrl, mediaType }),
    });
  },

  /**
   * Mark messages as read
   */
  async markAsRead(conversationId: string): Promise<void> {
    await apiFetch(`/api/v1/chat/conversations/${conversationId}/read`, {
      method: 'PUT',
    });
  },

  /**
   * Delete a message
   */
  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    await apiFetch(`/api/v1/chat/conversations/${conversationId}/messages/${messageId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Block a user
   */
  async blockUser(userId: string): Promise<{ message: string }> {
    return await apiFetch(`/api/v1/users/${userId}/block`, {
      method: 'POST',
    });
  },

  /**
   * Unblock a user
   */
  async unblockUser(userId: string): Promise<{ message: string }> {
    return await apiFetch(`/api/v1/users/${userId}/unblock`, {
      method: 'POST',
    });
  },

  /**
   * Report a user
   */
  async reportUser(userId: string, reason: string, details: string): Promise<{ message: string }> {
    return await apiFetch('/api/v1/reports', {
      method: 'POST',
      body: JSON.stringify({
        reportType: 'user',
        targetId: userId,
        reason,
        details,
      }),
    });
  },
};

