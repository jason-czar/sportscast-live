import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseRealtimeCleanupProps {
  eventId?: string;
  enabled?: boolean;
  interval?: number;
}

export const useRealtimeCleanup = ({
  eventId,
  enabled = false,
  interval = 60000 // 1 minute
}: UseRealtimeCleanupProps) => {
  
  const cleanupStaleConnections = useCallback(async () => {
    if (!eventId || !enabled) return;

    try {
      console.log('[RealtimeCleanup] Cleaning up stale connections for event:', eventId);
      
      await supabase.functions.invoke('camera-status', {
        body: {
          action: 'cleanup-stale',
          eventId: eventId
        }
      });
      
      console.log('[RealtimeCleanup] Cleanup completed');
    } catch (error) {
      console.error('[RealtimeCleanup] Error during cleanup:', error);
    }
  }, [eventId, enabled]);

  useEffect(() => {
    if (!enabled || !eventId) return;

    // Run cleanup immediately
    cleanupStaleConnections();

    // Set up periodic cleanup
    const cleanupInterval = setInterval(cleanupStaleConnections, interval);

    return () => {
      clearInterval(cleanupInterval);
    };
  }, [enabled, eventId, cleanupStaleConnections, interval]);

  return {
    cleanupStaleConnections
  };
};