import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Mic, MicOff, Video, VideoOff, LogOut, Wifi, Play } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';
import { toastService } from '@/lib/toast-service';
import { supabase } from '@/integrations/supabase/client';
import { useConnectionHeartbeat } from '@/hooks/useConnectionHeartbeat';

interface LocationState {
  eventData: any;
  deviceLabel: string;
}

const TelegramCameraStream: React.FC = () => {
  const { eventId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [streamingMethod, setStreamingMethod] = useState<'rtmp' | 'webrtc'>('webrtc');

  // WebRTC streaming hook
  const webrtcStreaming = useWebRTCStreaming();

  // Use heartbeat to maintain connection status
  const { sendHeartbeat } = useConnectionHeartbeat({
    cameraId: cameraId || undefined,
    eventId: eventId || undefined,
    enabled: !!cameraId && !!stream,
    interval: 15000 // Every 15 seconds
  });
  const isMobile = useIsMobile();

  const state = location.state as LocationState;

  useEffect(() => {
    if (!state?.eventData) {
      toastService.error({
        description: "Missing event data. Please join the event again.",
      });
      navigate('/join-camera');
      return;
    }

    const initializeCamera = async () => {
      await startVideoPreview();
    };

    initializeCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startVideoPreview = async () => {
    try {
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'environment'
        },
        audio: true
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toastService.error({
        description: "Failed to access camera. Please check permissions.",
      });
    }
  };

  const toggleVideo = async () => {
    const newVideoState = !isVideoEnabled;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = newVideoState;
        setIsVideoEnabled(newVideoState);
      }
    }
  };

  const toggleAudio = async () => {
    const newAudioState = !isAudioEnabled;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = newAudioState;
        setIsAudioEnabled(newAudioState);
      }
    }
  };

  const startTelegramStreaming = async () => {
    if (!stream || isStreaming) return;

    try {
      console.log('Starting Telegram streaming for event:', eventId);
      setIsStreaming(true);

      // Register camera first if not already done
      let currentCameraId = cameraId;
      if (!currentCameraId) {
        console.log('Registering camera for Telegram streaming');
        const { data: registerData, error: registerError } = await supabase.functions.invoke('register-camera', {
          body: {
            eventId,
            deviceLabel: state?.deviceLabel || 'Telegram Camera',
            eventCode: state?.eventData?.event_code
          }
        });

        if (registerError) {
          console.error('Error registering camera:', registerError);
          throw registerError;
        }

        currentCameraId = registerData.cameraId;
        setCameraId(currentCameraId);
        console.log('Camera registered with ID:', currentCameraId);
      }

      // Get RTMP streaming configuration from TDLib
      const { data: configData, error: configError } = await supabase.functions.invoke('telegram-stream', {
        body: {
          action: 'getStreamConfig',
          eventId,
          cameraId: currentCameraId
        }
      });

      if (configError || !configData?.success) {
        console.error('Failed to get RTMP config:', configError || configData?.error);
        throw new Error('Failed to get streaming configuration');
      }

      console.log('RTMP config received:', configData.streamConfig);

      if (streamingMethod === 'webrtc') {
        // Use WebRTC-to-RTMP bridge for web browsers
        console.log('Starting WebRTC-to-RTMP streaming');
        
        await webrtcStreaming.initializeStreaming({
          rtmpUrl: configData.streamConfig.rtmpUrl,
          streamKey: configData.streamConfig.streamKey
        });

        await webrtcStreaming.startStreaming(stream);
        
        console.log('WebRTC streaming initialized and started');
      } else {
        // Direct RTMP streaming (for native apps)
        console.log('Starting direct RTMP streaming');
        // This would be implemented for native mobile apps
      }

      // Start RTMP streaming to Telegram
      const { data, error } = await supabase.functions.invoke('telegram-stream', {
        body: {
          action: 'startStream',
          eventId,
          cameraId: currentCameraId
        }
      });

      if (error) {
        console.error('Error starting Telegram stream:', error);
        throw error;
      }

      console.log('Telegram stream started successfully:', data);
      
      // Send initial heartbeat
      sendHeartbeat();
      
      toastService.success({
        title: "🎥 Live Stream Started!",
        description: `Your stream is now broadcasting live to Telegram using ${streamingMethod.toUpperCase()} technology.`,
      });

    } catch (error) {
      console.error('Failed to start Telegram streaming:', error);
      setIsStreaming(false);
      
      // Stop WebRTC streaming if it was started
      if (webrtcStreaming.isStreaming) {
        await webrtcStreaming.stopStreaming();
      }
      
      toastService.error({
        description: "Failed to start live stream. Please try again.",
      });
    }
  };

  const stopTelegramStreaming = async () => {
    try {
      console.log('Stopping Telegram streaming for event:', eventId);
      
      // Stop WebRTC streaming if active
      if (webrtcStreaming.isStreaming) {
        await webrtcStreaming.stopStreaming();
        console.log('WebRTC streaming stopped');
      }
      
      // Get camera ID from database
      const { data: cameras, error: fetchError } = await supabase
        .from('cameras')
        .select('id')
        .eq('event_id', eventId)
        .eq('device_label', state.deviceLabel)
        .single();

      if (fetchError || !cameras) {
        console.error('Camera not found:', fetchError);
        throw new Error('Camera not found in database');
      }

      // Call edge function to stop stream
      const { data: streamResponse, error: streamError } = await supabase.functions
        .invoke('telegram-stream', {
          body: {
            action: 'stopStream',
            eventId,
            cameraId: cameras.id
          }
        });

      if (streamError || !streamResponse?.success) {
        console.error('Failed to stop stream:', streamError || streamResponse?.error);
        // Continue anyway to update local state
      }
      
      setIsStreaming(false);
      
      toastService.success({
        description: "Live stream stopped.",
      });
    } catch (error) {
      console.error('Error stopping Telegram stream:', error);
      toastService.error({
        description: "Failed to stop live stream.",
      });
    }
  };

  const openTelegramChannel = () => {
    if (state.eventData.telegram_invite_link) {
      window.open(state.eventData.telegram_invite_link, '_blank');
    } else {
      toastService.error({
        description: "Telegram channel link not available.",
      });
    }
  };

  const leaveEvent = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    navigate('/');
  };

  if (!state) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile optimized layout */}
      <div className="flex flex-col h-screen">
        {/* Header - compact for mobile */}
        <div className="flex items-center justify-between p-4 bg-card border-b">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <span className="font-semibold">Live Camera</span>
            <Badge variant={isStreaming ? "default" : "secondary"} className="text-xs">
              {isStreaming ? "Streaming" : "Standby"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {!isMobile && (
              <span className="text-sm text-muted-foreground">
                Event: {state.eventData?.name || 'Unknown Event'}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={leaveEvent}>
              <LogOut className="h-4 w-4" />
              {!isMobile && <span className="ml-2">Leave Event</span>}
            </Button>
          </div>
        </div>

        {/* Video Preview - takes most of the screen */}
        <div className="flex-1 relative bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
              <VideoOff className="h-12 w-12 text-gray-400" />
            </div>
          )}
          
          {/* Mobile event name overlay */}
          {isMobile && (
            <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm">
              Event: {state.eventData?.name || 'Unknown Event'}
            </div>
          )}

          {/* Streaming status overlay */}
          <div className="absolute top-4 right-4 bg-primary/80 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2">
            {isStreaming ? <Wifi className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isStreaming ? 'Live Stream' : 'Ready to Stream'}
          </div>
        </div>

        {/* Controls - bottom bar optimized for mobile and landscape */}
        <div className="p-4 bg-card border-t">
          {/* Streaming method selector */}
          <div className="mb-3 flex gap-2">
            <Button
              variant={streamingMethod === 'webrtc' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStreamingMethod('webrtc')}
              className="flex-1"
            >
              WebRTC (Web)
            </Button>
            <Button
              variant={streamingMethod === 'rtmp' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStreamingMethod('rtmp')}
              className="flex-1"
              disabled={true} // Disabled for web-only implementation
            >
              RTMP (Native)
            </Button>
          </div>

          {/* Streaming info */}
          <div className="mb-4 p-3 bg-muted/50 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Professional Streaming Active</p>
                <p className="text-xs text-muted-foreground">
                  {streamingMethod === 'webrtc' 
                    ? 'WebRTC-to-RTMP bridge • High-quality web streaming'
                    : 'Direct RTMP • Native mobile streaming'
                  }
                </p>
              </div>
              <Badge variant={isStreaming ? "default" : "secondary"}>
                {isStreaming ? "Broadcasting" : "Ready"}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 md:gap-4">
            <Button
              variant={isVideoEnabled ? "default" : "destructive"}
              size={isMobile ? "default" : "lg"}
              onClick={toggleVideo}
              className="aspect-square"
            >
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
            
            <Button
              variant={isAudioEnabled ? "default" : "destructive"}
              size={isMobile ? "default" : "lg"}
              onClick={toggleAudio}
              className="aspect-square"
            >
              {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>

            {!isStreaming ? (
              <Button 
                size={isMobile ? "default" : "lg"} 
                onClick={startTelegramStreaming} 
                className="px-6"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Live Stream
              </Button>
            ) : (
              <Button 
                size={isMobile ? "default" : "lg"} 
                variant="destructive" 
                onClick={stopTelegramStreaming} 
                className="px-6"
              >
                Stop Stream
              </Button>
            )}
          </div>
          
          <div className="text-center mt-3">
            <p className="text-xs text-muted-foreground">
              Camera: {state.deviceLabel} • {streamingMethod.toUpperCase()} streaming to Telegram
            </p>
            {webrtcStreaming.isConnecting && (
              <p className="text-xs text-blue-600 mt-1">Establishing WebRTC connection...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelegramCameraStream;