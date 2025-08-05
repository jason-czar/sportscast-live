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
  stream_url?: string;
}

interface CameraCardProps {
  camera: Camera;
  onActivate: (cameraId: string) => void;
  onSelect?: (cameraId: string) => void;
  isSelected?: boolean;
}

const CameraCard = memo(({ camera, onActivate, onSelect, isSelected = false }: CameraCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);
  const [eventStreamUrl, setEventStreamUrl] = useState<string | null>(null);

  // Get the camera's stream URL when it goes live
  useEffect(() => {
    const getCameraStreamUrl = async () => {
      if (!camera.is_live) {
        setEventStreamUrl(null);
        return;
      }

      try {
        console.log('Fetching stream URL for camera:', camera.device_label, 'is_live:', camera.is_live);
        console.log('Camera ID:', camera.id, 'Event ID:', camera.event_id);
        
        // Use the stream proxy to get the proper stream URL
        console.log('Calling stream-proxy function...');
        const { data: streamData, error: streamError } = await supabase.functions.invoke('stream-proxy', {
          body: {
            action: 'getStreamUrl',
            eventId: camera.event_id,
            cameraId: camera.id
          }
        });

        console.log('Stream proxy response:', { streamData, streamError });

        if (streamError) {
          console.error('Stream proxy error:', streamError);
          throw streamError;
        }

        if (!streamData?.success) {
          console.error('Stream proxy failed:', streamData?.error);
          throw new Error(streamData?.error || 'Stream proxy failed');
        }

        console.log('Stream URL received:', streamData.streamUrl);
        
        if (streamData.streamUrl) {
          setEventStreamUrl(streamData.streamUrl);
        } else {
          console.log('No stream URL in response');
          throw new Error('No stream URL provided');
        }
      } catch (error) {
        console.error('Error getting stream URL:', error);
        
        // Fallback: Try to use demo video directly for Telegram streams
        console.log('Using fallback demo video');
        setEventStreamUrl("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
      }
    };

    getCameraStreamUrl();
  }, [camera.event_id, camera.is_live, camera.stream_url, camera.id]);

  // Set up video source when camera goes live and we have a stream URL
  useEffect(() => {
    if (videoRef.current && camera.is_live && eventStreamUrl) {
      console.log('Setting video source to:', eventStreamUrl);
      videoRef.current.src = eventStreamUrl;
      videoRef.current.load();
      setVideoError(false);
    }
  }, [camera.is_live, eventStreamUrl]);

  const handleClick = () => {
    // If there's an onSelect prop, use it for preview selection
    if (onSelect) {
      onSelect(camera.id);
    }
    // Always activate the camera when clicked
    onActivate(camera.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (onSelect) {
        onSelect(camera.id);
      }
      onActivate(camera.id);
    }
  };

  const handleVideoError = () => {
    setVideoError(true);
    console.error('Video failed to load for camera:', camera.device_label, 'URL:', eventStreamUrl);
  };

  const handleVideoLoad = () => {
    setVideoError(false);
    console.log('Video loaded successfully for camera:', camera.device_label);
  };

  return (
    <Card 
      className={`cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        camera.is_active 
          ? 'ring-2 ring-primary bg-primary/5' 
          : isSelected
          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950'
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
          {camera.is_live && eventStreamUrl ? (
            // Always try to display video, regardless of stream type
            !videoError ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
                onError={handleVideoError}
                onLoadedData={handleVideoLoad}
                controls={false}
                crossOrigin="anonymous"
              />
            ) : (
              // Video error state with more info
              <div className="absolute inset-0 flex items-center justify-center bg-red-500/10">
                <div className="text-center">
                  <WifiOff className="h-6 w-6 mx-auto mb-2 text-destructive" />
                  <p className="text-xs text-destructive font-medium">Video Error</p>
                  <p className="text-xs text-muted-foreground/70">Stream: {eventStreamUrl?.slice(0, 40)}...</p>
                </div>
              </div>
            )
          ) : camera.is_live && !eventStreamUrl ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-500 rounded-full mx-auto mb-2 animate-pulse shadow-lg"></div>
                <p className="text-xs text-muted-foreground font-medium">Live Feed</p>
                <p className="text-xs text-muted-foreground/70">Loading stream...</p>
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