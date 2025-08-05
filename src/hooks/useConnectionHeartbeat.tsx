import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseConnectionHeartbeatProps {
  cameraId?: string;
  eventId?: string;
  enabled?: boolean;
  interval?: number;
}

export const useConnectionHeartbeat = ({
  cameraId,
  eventId,
  enabled = false,
  interval = 30000 // 30 seconds
}: UseConnectionHeartbeatProps) => {
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const lastHeartbeatRef = useRef<number>(Date.now());

  const sendHeartbeat = useCallback(async () => {
    if (!cameraId || !enabled) return;

    try {
      console.log(`[Heartbeat] Sending heartbeat for camera ${cameraId}`);
      
      const { error } = await supabase.functions.invoke('camera-status', {
        body: {
          action: 'heartbeat',
          cameraId: cameraId
        }
      });

      if (error) {
        console.error('[Heartbeat] Failed to send heartbeat:', error);
      } else {
        lastHeartbeatRef.current = Date.now();
        console.log(`[Heartbeat] Successfully sent heartbeat for camera ${cameraId}`);
      }
    } catch (error) {
      console.error('[Heartbeat] Error sending heartbeat:', error);
    }
  }, [cameraId, enabled]);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    console.log(`[Heartbeat] Starting heartbeat for camera ${cameraId} every ${interval}ms`);
    
    // Send initial heartbeat
    sendHeartbeat();
    
    // Set up interval
    heartbeatRef.current = setInterval(sendHeartbeat, interval);
  }, [sendHeartbeat, interval, cameraId]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      console.log(`[Heartbeat] Stopping heartbeat for camera ${cameraId}`);
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = undefined;
    }
  }, [cameraId]);

  const markOffline = useCallback(async () => {
    if (!cameraId) return;
    
    try {
      console.log(`[Heartbeat] Marking camera ${cameraId} as offline`);
      await supabase.functions.invoke('camera-status', {
        body: {
          action: 'disconnect',
          cameraId: cameraId
        }
      });
    } catch (error) {
      console.error('[Heartbeat] Error marking camera offline:', error);
    }
  }, [cameraId]);

  useEffect(() => {
    if (enabled && cameraId) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }

    return stopHeartbeat;
  }, [enabled, cameraId, startHeartbeat, stopHeartbeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
      if (enabled && cameraId) {
        markOffline();
      }
    };
  }, []);

  return {
    sendHeartbeat,
    startHeartbeat,
    stopHeartbeat,
    lastHeartbeat: lastHeartbeatRef.current
  };
};