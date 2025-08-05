import { useState, useCallback, useRef } from 'react';
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

export const useWebRTCStreaming = () => {
  const [state, setState] = useState<WebRTCStreamingState>({
    isStreaming: false,
    isConnecting: false,
    sessionId: null,
    error: null
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Initialize streaming with RTMP configuration
  const initializeStreaming = useCallback(async (rtmpConfig: RTMPConfig): Promise<void> => {
    try {
      console.log('🔧 Initializing WebRTC streaming with config:', {
        rtmpUrl: rtmpConfig.rtmpUrl,
        streamKey: rtmpConfig.streamKey?.substring(0, 10) + '...'
      });

      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('webrtc-rtmp-bridge', {
        body: {
          action: 'createSession',
          rtmpUrl: rtmpConfig.rtmpUrl,
          streamKey: rtmpConfig.streamKey
        }
      });

      console.log('📡 WebRTC bridge response:', { sessionData, sessionError });

      if (sessionError) {
        console.error('❌ WebRTC bridge session creation failed:', sessionError);
        throw new Error(`Failed to create WebRTC bridge session: ${sessionError.message || 'Unknown error'}`);
      }

      if (!sessionData?.success) {
        console.error('❌ WebRTC bridge session creation not successful:', sessionData);
        throw new Error(`Bridge session creation failed: ${sessionData?.error || 'Unknown error'}`);
      }

      if (!sessionData.sessionId) {
        console.error('❌ No session ID returned from bridge');
        throw new Error('Failed to get session ID from WebRTC bridge');
      }

      setState(prev => ({ 
        ...prev, 
        sessionId: sessionData.sessionId,
        error: null 
      }));

      console.log('✅ WebRTC bridge session created successfully:', sessionData.sessionId);

    } catch (error) {
      console.error('❌ WebRTC streaming initialization failed:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to initialize streaming',
        sessionId: null 
      }));
      throw error;
    }
  }, []);

  // Start WebRTC streaming with media stream
  const startStreaming = useCallback(async (mediaStream: MediaStream): Promise<void> => {
    if (!state.sessionId) {
      const error = 'No session ID available. Initialize streaming first.';
      console.error('❌', error);
      throw new Error(error);
    }

    try {
      console.log('🚀 Starting WebRTC streaming for session:', state.sessionId);
      
      setState(prev => ({ ...prev, isConnecting: true, error: null }));

      // Create WebRTC peer connection
      console.log('📡 Creating WebRTC peer connection...');
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = peerConnection;
      localStreamRef.current = mediaStream;

      // Add media stream to peer connection
      console.log('📹 Adding media tracks to peer connection...');
      mediaStream.getTracks().forEach(track => {
        console.log(`Adding ${track.kind} track:`, track.label);
        peerConnection.addTrack(track, mediaStream);
      });

      // Create SDP offer
      console.log('📋 Creating SDP offer...');
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });

      await peerConnection.setLocalDescription(offer);
      console.log('✅ SDP offer created and set as local description');

      // Send offer to WebRTC bridge
      console.log('🌉 Sending SDP offer to WebRTC bridge...');
      const { data: bridgeData, error: bridgeError } = await supabase.functions.invoke('webrtc-rtmp-bridge', {
        body: {
          action: 'startStreaming',
          sessionId: state.sessionId,
          sdpOffer: offer.sdp
        }
      });

      console.log('📡 WebRTC bridge start response:', { bridgeData, bridgeError });

      if (bridgeError) {
        console.error('❌ WebRTC bridge start failed:', bridgeError);
        throw new Error(`WebRTC bridge error: ${bridgeError.message || 'Unknown error'}`);
      }

      if (!bridgeData?.success) {
        console.error('❌ WebRTC bridge start not successful:', bridgeData);
        throw new Error(`Bridge start failed: ${bridgeData?.error || 'Unknown error'}`);
      }

      if (!bridgeData.sdpAnswer) {
        console.error('❌ No SDP answer received from bridge');
        throw new Error('No SDP answer received from WebRTC bridge');
      }

      console.log('✅ SDP answer received from bridge');

      // Set remote description
      console.log('🔗 Setting remote description...');
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: bridgeData.sdpAnswer
      });

      await peerConnection.setRemoteDescription(answer);
      console.log('✅ Remote description set successfully');

      setState(prev => ({ 
        ...prev, 
        isStreaming: true, 
        isConnecting: false, 
        error: null 
      }));

      console.log('🎉 WebRTC streaming started successfully!');

    } catch (error) {
      console.error('❌ Failed to start WebRTC streaming:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to start streaming',
        isConnecting: false,
        isStreaming: false
      }));
      
      // Cleanup on error
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      
      throw error;
    }
  }, [state.sessionId]);

  // Stop WebRTC streaming
  const stopStreaming = useCallback(async (): Promise<void> => {
    try {
      console.log('🛑 Stopping WebRTC streaming');

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

      console.log('✅ WebRTC streaming stopped successfully');

    } catch (error) {
      console.error('❌ Failed to stop WebRTC streaming:', error);
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
};