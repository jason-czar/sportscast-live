import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RemoteVideoTrack, Participant } from 'livekit-client';
import { Video, VideoOff, Radio, Users } from 'lucide-react';

interface LiveCameraCardProps {
  participant: Participant;
  videoTrack: RemoteVideoTrack | null;
  isSelected: boolean;
  isActive: boolean;
  onSelect: () => void;
  onActivate: () => void;
}

export function LiveCameraCard({ 
  participant, 
  videoTrack, 
  isSelected, 
  isActive,
  onSelect, 
  onActivate 
}: LiveCameraCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach video track to video element
  useEffect(() => {
    if (videoRef.current && videoTrack) {
      videoTrack.attach(videoRef.current);
      return () => {
        videoTrack.detach();
      };
    }
  }, [videoTrack]);

  const cameraLabel = participant.metadata || participant.identity || 'Unknown Camera';
  const isLive = videoTrack && !videoTrack.isMuted;

  return (
    <Card className={`cursor-pointer transition-all duration-200 ${
      isSelected ? 'ring-2 ring-primary' : ''
    } ${isActive ? 'border-green-500 border-2' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="truncate">{cameraLabel}</span>
          <div className="flex items-center gap-1">
            {isActive && (
              <Badge variant="destructive" className="text-xs animate-pulse">
                ACTIVE
              </Badge>
            )}
            {isLive ? (
              <Badge variant="default" className="text-xs">
                <Radio className="w-3 h-3 mr-1" />
                LIVE
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                <VideoOff className="w-3 h-3 mr-1" />
                OFFLINE
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Video Preview */}
        <div 
          className="relative aspect-video bg-muted rounded-lg overflow-hidden cursor-pointer"
          onClick={onSelect}
        >
          {videoTrack && isLive ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <VideoOff className="w-8 h-8 mx-auto mb-2" />
                <p className="text-xs">No Video Signal</p>
              </div>
            </div>
          )}
          
          {/* Selection overlay */}
          {isSelected && (
            <div className="absolute inset-0 bg-primary/20 border-2 border-primary rounded-lg" />
          )}
        </div>

        {/* Participant Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center justify-between">
            <span>Participant ID:</span>
            <span className="font-mono">{participant.identity}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Connection:</span>
            <span className={participant.connectionQuality === 'excellent' ? 'text-green-600' : 
                           participant.connectionQuality === 'good' ? 'text-yellow-600' : 'text-red-600'}>
              {participant.connectionQuality || 'unknown'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={onSelect}
            className="flex-1"
          >
            <Video className="w-3 h-3 mr-1" />
            {isSelected ? 'Selected' : 'Select'}
          </Button>
          
          <Button
            variant={isActive ? "destructive" : "default"}
            size="sm"
            onClick={onActivate}
            disabled={!isLive}
            className="flex-1"
          >
            {isActive ? 'Active' : 'Set Active'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}