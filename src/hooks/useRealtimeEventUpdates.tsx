import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toastService } from '@/lib/toast-service';
import { useRealtimeConnection } from './useRealtimeConnection';
import { useAdvancedSync } from './useAdvancedSync';
import { useOptimizedCache } from './useOptimizedCache';

interface EventData {
  id: string;
  name: string;
  sport: string;
  status: string;
  program_url: string;
  viewer_count?: number;
  event_code: string;
  youtube_key?: string;
  twitch_key?: string;
  updated_at?: string;
  streaming_type?: string;
  telegram_channel_id?: string;
  telegram_invite_link?: string;
}

interface Camera {
  id: string;
  device_label: string;
  is_live: boolean;
  is_active: boolean;
  event_id: string;
  stream_url?: string | null;
  updated_at?: string;
}

interface UseRealtimeEventUpdatesProps {
  eventId: string;
  onEventUpdate?: (event: EventData) => void;
  onCameraUpdate?: (cameras: Camera[]) => void;
  onCameraSwitch?: (cameraLabel: string) => void;
}

export const useRealtimeEventUpdates = ({
  eventId,
  onEventUpdate,
  onCameraUpdate,
  onCameraSwitch
}: UseRealtimeEventUpdatesProps) => {
  const [event, setEvent] = useState<EventData | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  
  const { createChannel, removeChannel, stats } = useRealtimeConnection({
    autoReconnect: true,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000
  });
  
  const { optimisticUpdate, conflicts, resolveUserConflict } = useAdvancedSync({
    conflictResolution: { type: 'last-write-wins' },
    enableOptimisticUpdates: true,
    syncInterval: 15000 // 15 seconds
  });
  
  const cache = useOptimizedCache({ 
    maxSize: 200, 
    ttl: 5 * 60 * 1000, // 5 minutes
    staleWhileRevalidate: true 
  });

  const loadEventData = useCallback(async () => {
    try {
      // Try cache first
      const cachedEvent = cache.get(`event-${eventId}`);
      if (cachedEvent) {
        setEvent(cachedEvent as EventData);
        onEventUpdate?.(cachedEvent as EventData);
      }

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      
      // Update cache and state
      cache.set(`event-${eventId}`, data);
      setEvent(data);
      onEventUpdate?.(data);
      setLastUpdateTime(Date.now());
    } catch (error) {
      console.error('[RealtimeEvents] Error loading event:', error);
    }
  }, [eventId, onEventUpdate, cache]);

  const loadCameras = useCallback(async () => {
    try {
      // Try cache first
      const cachedCameras = cache.get(`cameras-${eventId}`);
      if (cachedCameras) {
        setCameras(cachedCameras as Camera[]);
        onCameraUpdate?.(cachedCameras as Camera[]);
      }

      const { data, error } = await supabase
        .from('cameras')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at');

      if (error) throw error;
      
      // Update cache and state
      cache.set(`cameras-${eventId}`, data || []);
      setCameras(data || []);
      onCameraUpdate?.(data || []);
      setLastUpdateTime(Date.now());
    } catch (error) {
      console.error('[RealtimeEvents] Error loading cameras:', error);
    } finally {
      setLoading(false);
    }
  }, [eventId, onCameraUpdate, cache]);

  // Enhanced update handling with conflict detection
  const handleEventUpdate = useCallback((payload: any) => {
    const updatedEvent = payload.new as EventData;
    const oldEvent = payload.old as EventData;
    
    // Check for potential conflicts
    if (event && event.updated_at && oldEvent.updated_at) {
      const localTime = new Date(event.updated_at).getTime();
      const serverTime = new Date(oldEvent.updated_at).getTime();
      
      if (localTime > serverTime) {
        console.warn('[RealtimeEvents] Potential conflict detected in event update');
      }
    }
    
    // Update cache first
    cache.set(`event-${eventId}`, updatedEvent);
    setEvent(updatedEvent);
    onEventUpdate?.(updatedEvent);
    setLastUpdateTime(Date.now());
    
    // Show relevant toasts
    if (oldEvent.status !== updatedEvent.status) {
      if (updatedEvent.status === 'live') {
        toastService.event.streamStarted();
      } else if (updatedEvent.status === 'ended') {
        toastService.event.streamEnded();
      }
    }
  }, [event, eventId, onEventUpdate, cache]);

  const handleCameraUpdate = useCallback(async (payload: any) => {
    const { eventType } = payload;
    
    // For any camera change, reload all cameras to maintain consistency
    await loadCameras();
    
    // Track optimistic updates for better UX
    if (eventType === 'UPDATE') {
      const updatedCamera = payload.new as Camera;
      await optimisticUpdate('cameras', updatedCamera.id, updatedCamera, 'update');
    }
  }, [loadCameras, optimisticUpdate]);

  const handleCameraSwitch = useCallback(async (payload: any) => {
    try {
      // Get camera info for the switch with caching
      let camera = cache.get(`camera-${payload.new.camera_id}`);
      
      if (!camera) {
        const { data } = await supabase
          .from('cameras')
          .select('device_label')
          .eq('id', payload.new.camera_id)
          .single();
        
        if (data) {
          camera = data;
          cache.set(`camera-${payload.new.camera_id}`, data);
        }
      }
      
      if (camera) {
        onCameraSwitch?.((camera as any).device_label);
        toastService.event.cameraSwitched((camera as any).device_label);
      }
    } catch (error) {
      console.error('[RealtimeEvents] Error handling camera switch:', error);
    }
  }, [onCameraSwitch, cache]);

  useEffect(() => {
    if (!eventId) return;

    // Load initial data
    loadEventData();
    loadCameras();

    // Create real-time channels using the connection manager
    const eventChannel = createChannel(`event_updates_${eventId}`, {
      postgres_changes: {
        event: 'UPDATE',
        schema: 'public',
        table: 'events',
        filter: `id=eq.${eventId}`
      }
    });

    const cameraChannel = createChannel(`camera_updates_${eventId}`, {
      postgres_changes: {
        event: '*',
        schema: 'public',
        table: 'cameras',
        filter: `event_id=eq.${eventId}`
      }
    });

    const switchChannel = createChannel(`switch_logs_${eventId}`, {
      postgres_changes: {
        event: 'INSERT',
        schema: 'public',
        table: 'switch_logs',
        filter: `event_id=eq.${eventId}`
      }
    });

    // Subscribe to updates
    if (eventChannel) {
      eventChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventId}` }, handleEventUpdate);
      eventChannel.subscribe();
    }

    if (cameraChannel) {
      cameraChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'cameras', filter: `event_id=eq.${eventId}` }, handleCameraUpdate);
      cameraChannel.subscribe();
    }

    if (switchChannel) {
      switchChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'switch_logs', filter: `event_id=eq.${eventId}` }, handleCameraSwitch);
      switchChannel.subscribe();
    }

    return () => {
      removeChannel(`event_updates_${eventId}`);
      removeChannel(`camera_updates_${eventId}`);
      removeChannel(`switch_logs_${eventId}`);
    };
  }, [eventId, loadEventData, loadCameras, handleEventUpdate, handleCameraUpdate, handleCameraSwitch, createChannel, removeChannel]);

  // Auto-refresh data if connection was restored
  useEffect(() => {
    if (stats.connected && stats.reconnectAttempts > 0) {
      console.log('[RealtimeEvents] Connection restored, refreshing data...');
      loadEventData();
      loadCameras();
    }
  }, [stats.connected, stats.reconnectAttempts, loadEventData, loadCameras]);

  return {
    event,
    cameras,
    loading,
    lastUpdateTime,
    connectionStats: stats,
    conflicts,
    resolveConflict: resolveUserConflict,
    refetch: {
      event: loadEventData,
      cameras: loadCameras
    }
  };
};