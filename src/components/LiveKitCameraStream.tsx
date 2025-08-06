import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, VideoOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { useLiveKitStreaming } from '@/hooks/useLiveKitStreaming';
import { useToast } from '@/hooks/use-toast';

interface LiveKitCameraStreamProps {
  eventId: string;
  deviceLabel: string;
  onStreamStart?: () => void;
  onStreamStop?: () => void;
}

export function LiveKitCameraStream({ 
  eventId, 
  deviceLabel, 
  onStreamStart, 
  onStreamStop 
}: LiveKitCameraStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  
  const { 
    createIngress, 
    isConnecting, 
    ingestUrl, 
    streamKey, 
    error 
  } = useLiveKitStreaming();
  
  const { toast } = useToast();

  // Initialize camera preview
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true
        });
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Failed to access camera:', error);
        toast({
          title: "Camera Access Failed",
          description: "Unable to access camera and microphone",
          variant: "destructive",
        });
      }
    };

    initializeCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [toast]);

  const startStreaming = async () => {
    try {
      if (!streamRef.current) {
        throw new Error('No media stream available');
      }

      // Create LiveKit ingress
      const { ingestUrl: whipUrl } = await createIngress({
        eventId,
        deviceLabel
      });

      // Create WebRTC peer connection for WHIP
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pcRef.current = pc;

      // Add tracks to peer connection
      streamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, streamRef.current!);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to WHIP endpoint
      const response = await fetch(whipUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      });

      if (!response.ok) {
        throw new Error(`WHIP request failed: ${response.statusText}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });

      setIsStreamActive(true);
      onStreamStart?.();
      
      toast({
        title: "Streaming Started",
        description: "Camera feed is now live",
      });

    } catch (error) {
      console.error('Failed to start streaming:', error);
      toast({
        title: "Streaming Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const stopStreaming = async () => {
    try {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      
      setIsStreamActive(false);
      onStreamStop?.();
      
      toast({
        title: "Streaming Stopped",
        description: "Camera feed is no longer live",
      });
    } catch (error) {
      console.error('Failed to stop streaming:', error);
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{deviceLabel} - LiveKit Stream</span>
          <div className="flex items-center gap-2">
            {isStreamActive && (
              <Badge variant="destructive" className="animate-pulse">
                LIVE
              </Badge>
            )}
            {isConnecting && (
              <Badge variant="secondary">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Connecting
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Preview */}
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-muted flex items-center justify-center">
              <VideoOff className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              variant={isVideoEnabled ? "default" : "secondary"}
              size="sm"
              onClick={toggleVideo}
            >
              {isVideoEnabled ? (
                <Video className="w-4 h-4" />
              ) : (
                <VideoOff className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant={isAudioEnabled ? "default" : "secondary"}
              size="sm"
              onClick={toggleAudio}
            >
              {isAudioEnabled ? (
                <Mic className="w-4 h-4" />
              ) : (
                <MicOff className="w-4 h-4" />
              )}
            </Button>
          </div>

          <Button
            onClick={isStreamActive ? stopStreaming : startStreaming}
            disabled={isConnecting}
            variant={isStreamActive ? "destructive" : "default"}
          >
            {isConnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isStreamActive ? "Stop Streaming" : "Start Streaming"}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            Error: {error}
          </div>
        )}

        {/* Stream Info */}
        {ingestUrl && streamKey && (
          <div className="p-3 text-sm bg-muted rounded-md">
            <div className="font-medium mb-1">LiveKit WHIP Endpoint:</div>
            <div className="text-xs text-muted-foreground break-all">{ingestUrl}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}