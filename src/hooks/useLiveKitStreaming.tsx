import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LiveKitStreamingState {
  isStreaming: boolean;
  isConnecting: boolean;
  ingestUrl: string | null;
  streamKey: string | null;
  error: string | null;
  participantIdentity: string | null;
}

interface LiveKitConfig {
  eventId: string;
  deviceLabel: string;
}

export function useLiveKitStreaming() {
  const [state, setState] = useState<LiveKitStreamingState>({
    isStreaming: false,
    isConnecting: false,
    ingestUrl: null,
    streamKey: null,
    error: null,
    participantIdentity: null
  });

  const { toast } = useToast();

  const createIngress = useCallback(async (config: LiveKitConfig) => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      const { data, error } = await supabase.functions.invoke('livekit-ingress', {
        body: {
          eventId: config.eventId,
          deviceLabel: config.deviceLabel
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to create LiveKit ingress');
      }

      setState(prev => ({
        ...prev,
        isConnecting: false,
        ingestUrl: data.ingestUrl,
        streamKey: data.streamKey,
        participantIdentity: data.participantIdentity,
        error: null
      }));

      toast({
        title: "LiveKit Ingress Created",
        description: "Ready to start streaming via WHIP",
      });

      return {
        ingestUrl: data.ingestUrl,
        streamKey: data.streamKey,
        participantIdentity: data.participantIdentity
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMessage
      }));
      
      toast({
        title: "Failed to Create Ingress",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    }
  }, [toast]);

  const startEgress = useCallback(async (eventId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('livekit-egress', {
        body: {
          eventId,
          action: 'start'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to start LiveKit egress');
      }

      setState(prev => ({ ...prev, isStreaming: true }));
      
      toast({
        title: "Stream Started",
        description: "Broadcasting to YouTube and Twitch",
      });

      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Failed to Start Stream",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  const stopEgress = useCallback(async (eventId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('livekit-egress', {
        body: {
          eventId,
          action: 'stop'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      setState(prev => ({ ...prev, isStreaming: false }));
      
      toast({
        title: "Stream Stopped",
        description: "Broadcasting has ended",
      });

      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Failed to Stop Stream",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  const resetState = useCallback(() => {
    setState({
      isStreaming: false,
      isConnecting: false,
      ingestUrl: null,
      streamKey: null,
      error: null,
      participantIdentity: null
    });
  }, []);

  return {
    ...state,
    createIngress,
    startEgress,
    stopEgress,
    resetState
  };
}