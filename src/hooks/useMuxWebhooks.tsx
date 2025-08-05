import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MuxWebhookEvent {
  type: string;
  object: {
    type: string;
    id: string;
  };
  data: any;
  created_at: string;
}

interface StreamStatus {
  streamId: string;
  status: 'idle' | 'active' | 'recording' | 'completed';
  playbackUrl?: string;
  lastUpdate: string;
}

export const useMuxWebhooks = (eventId?: string) => {
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Listen for real-time updates to stream status
  useEffect(() => {
    if (!eventId) return;

    setIsListening(true);

    // Subscribe to event updates
    const channel = supabase
      .channel(`event-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
          filter: `id=eq.${eventId}`,
        },
        (payload) => {
          console.log('Event updated:', payload.new);
          
          // Update stream status based on event changes
          if (payload.new.status) {
            setStreamStatus(prev => ({
              ...prev,
              streamId: payload.new.mux_stream_id,
              status: mapEventStatusToStreamStatus(payload.new.status),
              lastUpdate: new Date().toISOString(),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      setIsListening(false);
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // Map event status to stream status
  const mapEventStatusToStreamStatus = (eventStatus: string): StreamStatus['status'] => {
    switch (eventStatus) {
      case 'live':
        return 'active';
      case 'recording':
        return 'recording';
      case 'ended':
        return 'completed';
      default:
        return 'idle';
    }
  };

  // Process Mux webhook manually (for testing or manual processing)
  const processMuxWebhook = useCallback(async (webhookData: MuxWebhookEvent) => {
    try {
      console.log('Processing Mux webhook:', webhookData);

      const { type, data } = webhookData;
      
      switch (type) {
        case 'video.live_stream.active':
          console.log('Stream went live:', data.id);
          setStreamStatus(prev => ({
            ...prev,
            streamId: data.id,
            status: 'active',
            playbackUrl: data.playback_ids?.[0]?.url,
            lastUpdate: new Date().toISOString(),
          }));
          break;

        case 'video.live_stream.idle':
          console.log('Stream went idle:', data.id);
          setStreamStatus(prev => ({
            ...prev,
            streamId: data.id,
            status: 'idle',
            lastUpdate: new Date().toISOString(),
          }));
          break;

        case 'video.live_stream.recording':
          console.log('Stream recording started:', data.id);
          setStreamStatus(prev => ({
            ...prev,
            streamId: data.id,
            status: 'recording',
            lastUpdate: new Date().toISOString(),
          }));
          break;

        case 'video.asset.live_stream_completed':
          console.log('Stream completed, asset ready:', data.id);
          setStreamStatus(prev => ({
            ...prev,
            streamId: data.live_stream_id,
            status: 'completed',
            lastUpdate: new Date().toISOString(),
          }));
          break;

        default:
          console.log('Unhandled Mux webhook type:', type);
      }
    } catch (error) {
      console.error('Error processing Mux webhook:', error);
    }
  }, []);

  // Get current stream status from Mux API
  const fetchStreamStatus = useCallback(async (streamId: string) => {
    try {
      // This would typically call a backend function that queries Mux API
      // For now, we'll use the database status
      const { data: eventData } = await supabase
        .from('events')
        .select('status, mux_stream_id')
        .eq('mux_stream_id', streamId)
        .single();

      if (eventData) {
        setStreamStatus({
          streamId,
          status: mapEventStatusToStreamStatus(eventData.status),
          lastUpdate: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error fetching stream status:', error);
    }
  }, []);

  return {
    streamStatus,
    isListening,
    processMuxWebhook,
    fetchStreamStatus,
  };
};