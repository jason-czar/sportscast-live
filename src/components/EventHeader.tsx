import React, { memo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LoadingButton from "@/components/ui/LoadingButton";
import { Monitor, Play, Square, Settings, Eye, ExternalLink } from "lucide-react";

interface EventData {
  id: string;
  name: string;
  sport: string;
  event_code: string;
  status: string;
  program_url: string;
  youtube_key?: string;
  twitch_key?: string;
}

interface EventHeaderProps {
  event: EventData;
  viewerCount: number;
  streaming: boolean;
  loading: boolean;
  onStartStream: () => void;
  onEndStream: () => void;
  onAddSimulcast: () => void;
  cameraCount: number;
}

const EventHeader = memo(({
  event,
  viewerCount,
  streaming,
  loading,
  onStartStream,
  onEndStream,
  onAddSimulcast,
  cameraCount
}: EventHeaderProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-6 w-6" />
              {event.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-4 flex-wrap">
              <span>Event Code: <span className="font-mono font-bold">{event.event_code}</span></span>
              <span>Sport: {event.sport}</span>
              <Badge variant={streaming ? "default" : "secondary"}>
                {event.status}
              </Badge>
              {viewerCount > 0 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {viewerCount} watching
                </Badge>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              asChild 
              variant="outline"
              className="flex items-center gap-2"
            >
              <a href={`/watch/${event.id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Watch Stream
              </a>
            </Button>
            
            {!streaming ? (
              <Button onClick={onStartStream} disabled={loading || cameraCount === 0}>
                <Play className="h-4 w-4 mr-2" />
                Start Stream
              </Button>
            ) : (
              <Button onClick={onEndStream} variant="destructive" disabled={loading}>
                <Square className="h-4 w-4 mr-2" />
                End Stream
              </Button>
            )}
            
            {event.youtube_key || event.twitch_key ? (
              <LoadingButton 
                onClick={onAddSimulcast} 
                variant="outline"
                loading={loading && !streaming}
                disabled={streaming}
              >
                <Settings className="h-4 w-4 mr-2" />
                Add Simulcast
              </LoadingButton>
            ) : null}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
});

EventHeader.displayName = 'EventHeader';

export default EventHeader;