import { useState, useEffect, useCallback } from 'react';
import { callLogService } from '../services/callLogService';

export const useCallLogBadge = () => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Fetch unread count from API
   */
  const fetchUnreadCount = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await callLogService.getUnreadCount();
      setUnreadCount(response.count || 0);
    } catch (error) {
      console.error('❌ Error fetching unread call count:', error);
      // Silently fail - don't show error to user
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Mark all calls as read and reset count
   */
  const markAllAsRead = useCallback(async () => {
    try {
      await callLogService.markAllAsRead();
      setUnreadCount(0);
      console.log('✅ All call logs marked as read');
    } catch (error) {
      console.error('❌ Error marking call logs as read:', error);
      // Silently fail
    }
  }, []);

  /**
   * Refresh count (for manual updates)
   */
  const refreshCount = useCallback(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  /**
   * Auto-fetch on mount and set up interval
   */
  useEffect(() => {
    fetchUnreadCount();

    // Update every 60 seconds
    const intervalId = setInterval(fetchUnreadCount, 60000);

    return () => clearInterval(intervalId);
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    isLoading,
    markAllAsRead,
    refreshCount,
  };
};

