import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, VideoOff, Mic, MicOff, Loader2, Users, Signal } from 'lucide-react';
import { useLiveKitRoom } from '@/hooks/useLiveKitRoom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Track } from 'livekit-client';

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
  
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [cameraRegistered, setCameraRegistered] = useState(false);

  // Generate camera identity
  const cameraIdentity = `camera_${deviceLabel.toLowerCase().replace(/\s+/g, '_')}`;
  
  const {
    room,
    isConnecting,
    isConnected,
    error: roomError,
    participants,
    connectToRoom,
    disconnectFromRoom,
    localParticipant
  } = useLiveKitRoom({
    eventId,
    participantName: deviceLabel,
    participantIdentity: cameraIdentity,
    autoConnect: false
  });
  
  const { toast } = useToast();

  // Initialize camera and register with database
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true
        });
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Register camera in database
        await registerCameraInDatabase();
        
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
      disconnectFromRoom();
    };
  }, [eventId, deviceLabel]);

  const registerCameraInDatabase = async () => {
    try {
      const { error } = await supabase.functions.invoke('register-camera', {
        body: {
          eventId,
          deviceLabel,
          identity: cameraIdentity
        }
      });

      if (error) throw error;
      
      setCameraRegistered(true);
      toast({
        title: "Camera Registered",
        description: `${deviceLabel} is ready to stream`,
      });
    } catch (error) {
      console.error('Failed to register camera:', error);
      toast({
        title: "Registration Failed",
        description: "Failed to register camera with event",
        variant: "destructive",
      });
    }
  };

  const startStreaming = async () => {
    try {
      if (!streamRef.current) {
        throw new Error('No media stream available');
      }

      if (!cameraRegistered) {
        throw new Error('Camera not registered. Please wait for registration to complete.');
      }

      // Connect to LiveKit room
      await connectToRoom();

      // Publish video and audio tracks
      if (room && localParticipant) {
        const videoTrack = streamRef.current.getVideoTracks()[0];
        const audioTrack = streamRef.current.getAudioTracks()[0];
        
        if (videoTrack) {
          await localParticipant.publishTrack(videoTrack, {
            name: 'camera',
            source: Track.Source.Camera
          });
        }
        
        if (audioTrack) {
          await localParticipant.publishTrack(audioTrack, {
            name: 'microphone',
            source: Track.Source.Microphone
          });
        }
      }

      onStreamStart?.();
      
      toast({
        title: "Streaming Started",
        description: "Camera feed is now live in LiveKit room",
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
      // Unpublish all tracks and disconnect from room
      if (localParticipant) {
        const publications = localParticipant.trackPublications;
        for (const publication of publications.values()) {
          if (publication.track) {
            localParticipant.unpublishTrack(publication.track);
          }
        }
      }
      
      await disconnectFromRoom();
      
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
          <span>{deviceLabel} - LiveKit Camera</span>
          <div className="flex items-center gap-2">
            {isConnected && (
              <Badge variant="default" className="bg-green-600">
                <Signal className="w-3 h-3 mr-1" />
                CONNECTED
              </Badge>
            )}
            {isConnecting && (
              <Badge variant="secondary">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Connecting
              </Badge>
            )}
            {participants.length > 0 && (
              <Badge variant="outline">
                <Users className="w-3 h-3 mr-1" />
                {participants.length} participants
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
            onClick={isConnected ? stopStreaming : startStreaming}
            disabled={isConnecting || !cameraRegistered}
            variant={isConnected ? "destructive" : "default"}
          >
            {isConnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isConnected ? "Stop Streaming" : 
             !cameraRegistered ? "Registering..." : "Start Streaming"}
          </Button>
        </div>

        {/* Error Display */}
        {roomError && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            LiveKit Error: {roomError}
          </div>
        )}

        {/* Room Info */}
        {isConnected && (
          <div className="p-3 text-sm bg-muted rounded-md">
            <div className="font-medium mb-1">LiveKit Room Status:</div>
            <div className="text-xs text-muted-foreground">
              Connected to room: {eventId} • Identity: {cameraIdentity}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {participants.length} total participants in room
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}