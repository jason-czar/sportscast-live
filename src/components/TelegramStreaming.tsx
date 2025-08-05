import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Users, Eye, Wifi } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface TelegramStreamingProps {
  eventId: string;
  eventName: string;
  eventCode: string;
  telegramChannelId?: string;
  telegramInviteLink?: string;
  isDirector?: boolean;
}

const TelegramStreaming: React.FC<TelegramStreamingProps> = ({
  eventId,
  eventName,
  eventCode,
  telegramChannelId,
  telegramInviteLink,
  isDirector = false
}) => {
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);

  const startTelegramStream = async () => {
    if (!telegramChannelId) {
      toast({
        title: "Error",
        description: "Telegram channel not configured for this event",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      // Start Telegram live stream
      const { data, error } = await supabase.functions.invoke('telegram-bot', {
        body: {
          action: 'startStream',
          channelId: telegramChannelId,
          eventName
        }
      });

      if (error) throw error;

      // Also start YouTube/Twitch simulcast for maximum reach
      const { data: simulcastData, error: simulcastError } = await supabase.functions.invoke('add-simulcast', {
        body: {
          eventId: eventId
        }
      });

      if (simulcastError) {
        console.warn('Simulcast setup failed:', simulcastError);
        // Don't fail the whole operation if simulcast fails
      }

      setIsLive(true);
      toast({
        title: "Multi-Platform Streaming Started",
        description: "Live streaming on Telegram, YouTube, and Twitch!"
      });

      // Update event status to live
      await supabase
        .from('events')
        .update({ status: 'live' })
        .eq('id', eventId);

    } catch (error) {
      console.error('Error starting Telegram stream:', error);
      toast({
        title: "Error",
        description: "Failed to start live stream",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const joinTelegramChannel = () => {
    if (telegramInviteLink) {
      window.open(telegramInviteLink, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Native Video Player for Live Stream */}
      <div className="relative">
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          {isLive ? (
            <div className="w-full h-full flex items-center justify-center">
              {/* This would be the native video player using Telegram's stream URL */}
              <div className="text-center text-white">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Wifi className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Live Stream Active</h3>
                <p className="opacity-75">Multi-camera streaming powered by advanced infrastructure</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-white">
                <Play className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">Stream Starting Soon</h3>
                <p className="opacity-75">Get ready for live multi-camera coverage</p>
              </div>
            </div>
          )}
        </div>

        {/* Live Indicator */}
        {isLive && (
          <div className="absolute top-4 left-4">
            <Badge variant="destructive" className="bg-red-600 animate-pulse">
              <Wifi className="h-3 w-3 mr-1" />
              LIVE
            </Badge>
          </div>
        )}

        {/* Viewer Count */}
        <div className="absolute top-4 right-4 flex gap-2">
          <Badge variant="secondary" className="bg-black/50 text-white">
            <Eye className="h-3 w-3 mr-1" />
            0 watching
          </Badge>
          <Badge variant="outline" className="bg-black/50 text-white border-white/20">
            <Users className="h-3 w-3 mr-1" />
            0 live
          </Badge>
        </div>
      </div>

      {/* Event Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>{eventName}</CardTitle>
          <CardDescription>
            Professional live streaming with multi-camera coverage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Event Details</h4>
              <p className="text-sm text-muted-foreground">
                <strong>Event:</strong> {eventName}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Code:</strong> {eventCode}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-sm">
                  {isLive ? 'Live Now' : 'Not Live'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Stream Features</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Professional multi-camera angles</li>
                <li>• Real-time camera switching</li>
                <li>• High-definition video quality</li>
                <li>• Low-latency streaming</li>
                <li>• Mobile-optimized viewing</li>
                <li>• Interactive viewer experience</li>
              </ul>
            </div>
          </div>

          {isDirector && (
            <div className="border-t pt-4">
              <Button
                onClick={startTelegramStream}
                disabled={loading || isLive}
                className="w-full sm:w-auto"
                size="lg"
              >
                <Play className="h-4 w-4 mr-2" />
                {loading ? 'Starting Stream...' : isLive ? 'Stream Active' : 'Start Live Stream'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TelegramStreaming;