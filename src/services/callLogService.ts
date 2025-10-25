import { apiFetch } from './api';
import type { CallLog } from '../types';

export const callLogService = {
  /**
   * Get all call logs for current user
   */
  async getCallLogs(): Promise<CallLog[]> {
    return await apiFetch('/api/v1/call-logs');
  },

  /**
   * Get missed calls only
   */
  async getMissedCalls(): Promise<CallLog[]> {
    return await apiFetch('/api/v1/call-logs/missed');
  },

  /**
   * Get unread call count
   */
  async getUnreadCount(): Promise<{ count: number }> {
    return await apiFetch('/api/v1/call-logs/unread-count');
  },

  /**
   * Create a new call log
   */
  async createCallLog(receiverId: string, callType: 'video' | 'audio', status: string = 'connecting'): Promise<CallLog> {
    return await apiFetch('/api/v1/call-logs', {
      method: 'POST',
      body: JSON.stringify({ receiverId, callType, status }),
    });
  },

  /**
   * Update call log status
   */
  async updateCallLog(id: string, data: { status?: string; duration?: number; endedAt?: string }): Promise<CallLog> {
    return await apiFetch(`/api/v1/call-logs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Mark a call as read
   */
  async markAsRead(id: string): Promise<{ message: string }> {
    return await apiFetch(`/api/v1/call-logs/${id}/mark-read`, {
      method: 'PUT',
    });
  },

  /**
   * Mark all calls as read
   */
  async markAllAsRead(): Promise<{ message: string }> {
    return await apiFetch('/api/v1/call-logs/mark-all-read', {
      method: 'PUT',
    });
  },

  /**
   * Delete a call log
   */
  async deleteCallLog(id: string): Promise<{ message: string }> {
    return await apiFetch(`/api/v1/call-logs/${id}`, {
      method: 'DELETE',
    });
  },
};

