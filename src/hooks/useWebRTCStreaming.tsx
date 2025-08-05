import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WebRTCStreamingState {
  isStreaming: boolean;
  isConnecting: boolean;
  sessionId: string | null;
  error: string | null;
}

interface RTMPConfig {
  rtmpUrl: string;
  streamKey: string;
}

export function useWebRTCStreaming() {
  const [state, setState] = useState<WebRTCStreamingState>({
    isStreaming: false,
    isConnecting: false,
    sessionId: null,
    error: null
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Initialize WebRTC streaming to RTMP
  const initializeStreaming = useCallback(async (rtmpConfig: RTMPConfig): Promise<void> => {
    try {
      console.log('Initializing WebRTC streaming to RTMP:', rtmpConfig);
      setState(prev => ({ ...prev, isConnecting: true, error: null }));

      // Create WebRTC-RTMP bridge session
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('webrtc-rtmp-bridge', {
        body: {
          action: 'createSession',
          rtmpUrl: rtmpConfig.rtmpUrl,
          streamKey: rtmpConfig.streamKey
        }
      });

      if (sessionError || !sessionData?.success) {
        throw new Error('Failed to create WebRTC-RTMP bridge session');
      }

      console.log('Bridge session created:', sessionData.sessionId);
      setState(prev => ({ ...prev, sessionId: sessionData.sessionId }));

    } catch (error) {
      console.error('Failed to initialize WebRTC streaming:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to initialize streaming',
        isConnecting: false 
      }));
      throw error;
    }
  }, []);

  // Start WebRTC streaming
  const startStreaming = useCallback(async (mediaStream: MediaStream): Promise<void> => {
    if (!state.sessionId) {
      throw new Error('No active bridge session');
    }

    try {
      console.log('Starting WebRTC streaming');
      setState(prev => ({ ...prev, isConnecting: true, error: null }));

      // Store local stream reference
      localStreamRef.current = mediaStream;

      // Create RTCPeerConnection
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = peerConnection;

      // Add tracks to peer connection
      mediaStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, mediaStream);
        console.log('Added track to peer connection:', track.kind);
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('ICE candidate:', event.candidate);
          // In real implementation, send ICE candidates to bridge
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        
        if (peerConnection.connectionState === 'connected') {
          setState(prev => ({ ...prev, isStreaming: true, isConnecting: false }));
        } else if (peerConnection.connectionState === 'failed') {
          setState(prev => ({ 
            ...prev, 
            error: 'WebRTC connection failed',
            isConnecting: false,
            isStreaming: false 
          }));
        }
      };

      // Create offer
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });

      await peerConnection.setLocalDescription(offer);
      console.log('Created WebRTC offer');

      // Send offer to bridge and get answer
      const { data: streamData, error: streamError } = await supabase.functions.invoke('webrtc-rtmp-bridge', {
        body: {
          action: 'startStreaming',
          sessionId: state.sessionId,
          sdpOffer: offer.sdp
        }
      });

      if (streamError || !streamData?.success) {
        throw new Error('Failed to start WebRTC-RTMP streaming');
      }

      // Set remote description with bridge answer
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: streamData.sdpAnswer
      });

      await peerConnection.setRemoteDescription(answer);
      console.log('WebRTC streaming started successfully');

    } catch (error) {
      console.error('Failed to start WebRTC streaming:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to start streaming',
        isConnecting: false 
      }));
      throw error;
    }
  }, [state.sessionId]);

  // Stop WebRTC streaming
  const stopStreaming = useCallback(async (): Promise<void> => {
    try {
      console.log('Stopping WebRTC streaming');

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Stop local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // Stop bridge session
      if (state.sessionId) {
        const { error: stopError } = await supabase.functions.invoke('webrtc-rtmp-bridge', {
          body: {
            action: 'stopStreaming',
            sessionId: state.sessionId
          }
        });

        if (stopError) {
          console.error('Failed to stop bridge session:', stopError);
        }
      }

      setState({
        isStreaming: false,
        isConnecting: false,
        sessionId: null,
        error: null
      });

      console.log('WebRTC streaming stopped successfully');

    } catch (error) {
      console.error('Failed to stop WebRTC streaming:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to stop streaming' 
      }));
    }
  }, [state.sessionId]);

  // Get session status
  const getSessionStatus = useCallback(async (): Promise<any> => {
    if (!state.sessionId) {
      return null;
    }

    try {
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('webrtc-rtmp-bridge', {
        body: {
          action: 'getSession',
          sessionId: state.sessionId
        }
      });

      if (sessionError || !sessionData?.success) {
        throw new Error('Failed to get session status');
      }

      return sessionData.session;

    } catch (error) {
      console.error('Failed to get session status:', error);
      return null;
    }
  }, [state.sessionId]);

  return {
    ...state,
    initializeStreaming,
    startStreaming,
    stopStreaming,
    getSessionStatus
  };
}