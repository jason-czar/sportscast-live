import React, { memo, useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Camera {
  id: string;
  device_label: string;
  is_live: boolean;
  is_active: boolean;
  event_id: string;
}

interface CameraCardProps {
  camera: Camera;
  onActivate: (cameraId: string) => void;
}

const CameraCard = memo(({ camera, onActivate }: CameraCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);
  const [eventStreamUrl, setEventStreamUrl] = useState<string | null>(null);

  // Get the event's program URL for video streaming
  useEffect(() => {
    const getEventStreamUrl = async () => {
      try {
        console.log('Fetching stream URL for camera:', camera.device_label, 'event:', camera.event_id);
        const { data: eventData, error } = await supabase
          .from('events')
          .select('program_url, mux_stream_id')
          .eq('id', camera.event_id)
          .single();

        if (error || !eventData) {
          console.log('No event data found:', error);
          return;
        }

        console.log('Event data:', eventData);
        
        if (eventData.program_url) {
          console.log('Setting stream URL to:', eventData.program_url);
          setEventStreamUrl(eventData.program_url);
        } else {
          console.log('No program URL available for event');
        }
      } catch (error) {
        console.error('Error fetching event stream URL:', error);
      }
    };

    if (camera.is_live) {
      getEventStreamUrl();
    }
  }, [camera.event_id, camera.is_live]);

  // Set up video source when camera goes live and we have a stream URL
  useEffect(() => {
    if (videoRef.current && camera.is_live && eventStreamUrl) {
      videoRef.current.src = eventStreamUrl;
      videoRef.current.load();
      setVideoError(false);
    }
  }, [camera.is_live, eventStreamUrl]);

  const handleClick = () => {
    onActivate(camera.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate(camera.id);
    }
  };

  const handleVideoError = () => {
    setVideoError(true);
    console.error('Video failed to load for camera:', camera.device_label);
  };

  const handleVideoLoad = () => {
    setVideoError(false);
  };

  return (
    <Card 
      className={`cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        camera.is_active 
          ? 'ring-2 ring-primary bg-primary/5' 
          : 'hover:bg-muted/50'
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-pressed={camera.is_active}
      aria-label={`${camera.device_label} camera ${camera.is_active ? 'active' : 'inactive'}, ${camera.is_live ? 'online' : 'offline'}`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-sm font-medium">{camera.device_label}</CardTitle>
          <div className="flex gap-2 items-center">
            {camera.is_live ? (
              <Wifi 
                className="h-4 w-4 text-success" 
                aria-label="Camera online"
              />
            ) : (
              <WifiOff 
                className="h-4 w-4 text-destructive" 
                aria-label="Camera offline"
              />
            )}
            {camera.is_active && (
              <Badge 
                variant="default" 
                className="text-xs animate-pulse"
                aria-label="Currently broadcasting live"
              >
                LIVE
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="aspect-video bg-muted rounded-md overflow-hidden relative">
          {camera.is_live && eventStreamUrl && !videoError ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
              onError={handleVideoError}
              onLoadedData={handleVideoLoad}
              controls={false}
            />
          ) : camera.is_live && !eventStreamUrl ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 bg-destructive rounded-full mx-auto mb-2 animate-pulse shadow-lg"></div>
                <p className="text-xs text-muted-foreground font-medium">Live Feed</p>
                <p className="text-xs text-muted-foreground/70">Connecting...</p>
              </div>
            </div>
          ) : videoError ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <WifiOff className="h-6 w-6 mx-auto mb-2 text-destructive" />
                <p className="text-xs text-muted-foreground">Video Error</p>
                <p className="text-xs text-muted-foreground/70">Stream unavailable</p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <WifiOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-xs text-muted-foreground">Camera Offline</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

CameraCard.displayName = 'CameraCard';

export default CameraCard;