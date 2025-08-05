import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

interface MuxRTMPConfig {
  eventId: string;
  eventCode: string;
  deviceLabel: string;
}

interface RTMPStreamingOptions {
  rtmpUrl: string;
  streamKey: string;
  cameraFacing?: 'front' | 'back';
  videoBitrate?: number;
  audioBitrate?: number;
  latencyMode?: 'low' | 'reduced' | 'standard';
}

interface RTMPStreamingState {
  isStreaming: boolean;
  isInitialized: boolean;
  isConnecting: boolean;
  error: string | null;
  streamKey: string | null;
  ingestUrl: string | null;
  cameraId: string | null;
}

export const useRTMPStreaming = () => {
  const [state, setState] = useState<RTMPStreamingState>({
    isStreaming: false,
    isInitialized: false,
    isConnecting: false,
    error: null,
    streamKey: null,
    ingestUrl: null,
    cameraId: null,
  });

  const isNative = Capacitor.isNativePlatform();

  // Register camera with Mux and get streaming credentials
  const registerCamera = useCallback(async (config: MuxRTMPConfig) => {
    try {
      setState(prev => ({ ...prev, error: null, isConnecting: true }));

      console.log('Registering camera with Mux...', config);

      const response = await fetch(`https://gxlqhoqsnnzqauynrzen.supabase.co/functions/v1/register-camera`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register camera');
      }

      const { cameraId, streamKey, ingestUrl } = await response.json();
      
      console.log('Camera registered successfully:', { cameraId, streamKey, ingestUrl });

      setState(prev => ({ 
        ...prev, 
        cameraId,
        streamKey,
        ingestUrl,
        isInitialized: true,
        isConnecting: false
      }));

      return { cameraId, streamKey, ingestUrl };
    } catch (error) {
      console.error('Failed to register camera:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to register camera',
        isConnecting: false
      }));
      throw error;
    }
  }, []);

  const initializeStreaming = useCallback(async (options: RTMPStreamingOptions) => {
    try {
      setState(prev => ({ ...prev, error: null }));

      if (!isNative) {
        // Web fallback - use WebRTC to RTMP bridge for web streaming
        console.log('Web platform detected - using WebRTC bridge for RTMP streaming');
        setState(prev => ({ ...prev, isInitialized: true }));
        return;
      }

      // For native platforms, initialize camera permissions
      const permissions = await Camera.requestPermissions();
      if (permissions.camera !== 'granted') {
        throw new Error('Camera permission required for streaming');
      }

      console.log('Initializing RTMP streaming with options:', options);
      
      setState(prev => ({ ...prev, isInitialized: true }));
    } catch (error) {
      console.error('Failed to initialize RTMP streaming:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to initialize streaming' 
      }));
    }
  }, [isNative]);

  const startStreaming = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      if (!state.streamKey || !state.ingestUrl) {
        throw new Error('Camera must be registered before streaming');
      }

      if (!isNative) {
        console.log('Starting web-based RTMP streaming via WebRTC bridge...');
        console.log('RTMP URL:', state.ingestUrl);
        
        // For web, we'll use WebRTC to capture and send to our bridge
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: true
        });

        // TODO: Connect to WebRTC-to-RTMP bridge with Mux ingest URL
        console.log('Media stream acquired, connecting to RTMP bridge...');
        
        setState(prev => ({ ...prev, isStreaming: true }));
        return stream;
      }

      // Native RTMP streaming start
      console.log('Starting native RTMP stream to:', state.ingestUrl);
      
      // TODO: Implement native RTMP streaming using Capacitor plugin
      // This would typically use a native plugin like capacitor-community/media
      // or a custom plugin that handles RTMP encoding and streaming
      
      setState(prev => ({ ...prev, isStreaming: true }));
    } catch (error) {
      console.error('Failed to start streaming:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to start streaming' 
      }));
    }
  }, [isNative, state.streamKey, state.ingestUrl]);

  const stopStreaming = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      if (!isNative) {
        console.log('Stopping web-based RTMP streaming...');
        setState(prev => ({ ...prev, isStreaming: false }));
        return;
      }

      // Native RTMP streaming stop
      console.log('Stopping native RTMP stream...');
      setState(prev => ({ ...prev, isStreaming: false }));
    } catch (error) {
      console.error('Failed to stop streaming:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to stop streaming' 
      }));
    }
  }, [isNative]);

  const switchCamera = useCallback(async () => {
    try {
      if (!isNative) {
        console.log('Camera switching on web platform');
        return;
      }

      console.log('Switching camera...');
    } catch (error) {
      console.error('Failed to switch camera:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to switch camera' 
      }));
    }
  }, [isNative]);

  const toggleAudio = useCallback(async (enabled: boolean) => {
    try {
      if (!isNative) {
        console.log(`Audio ${enabled ? 'enabled' : 'disabled'} on web platform`);
        return;
      }

      console.log(`${enabled ? 'Enabling' : 'Disabling'} audio...`);
    } catch (error) {
      console.error('Failed to toggle audio:', error);
    }
  }, [isNative]);

  const toggleVideo = useCallback(async (enabled: boolean) => {
    try {
      if (!isNative) {
        console.log(`Video ${enabled ? 'enabled' : 'disabled'} on web platform`);
        return;
      }

      console.log(`${enabled ? 'Enabling' : 'Disabling'} video...`);
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  }, [isNative]);

  // Get streaming statistics
  const getStreamingStats = useCallback(async () => {
    if (!state.cameraId) return null;

    try {
      // TODO: Implement stats retrieval from Mux API or local metrics
      return {
        bitrate: 0,
        framerate: 0,
        resolution: '1280x720',
        duration: 0,
      };
    } catch (error) {
      console.error('Failed to get streaming stats:', error);
      return null;
    }
  }, [state.cameraId]);

  return {
    ...state,
    isNative,
    registerCamera,
    initializeStreaming,
    startStreaming,
    stopStreaming,
    switchCamera,
    toggleAudio,
    toggleVideo,
    getStreamingStats,
    // Mux RTMP configuration
    muxRTMPUrl: 'rtmp://global-live.mux.com:5222/app',
  };
};