import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Play, Users, Wifi, Eye, Youtube, Twitch, ExternalLink, MessageCircle } from "lucide-react";
import Hls from "hls.js";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useRealtimePresence } from "@/hooks/useRealtimePresence";
import { useRealtimeEventUpdates } from "@/hooks/useRealtimeEventUpdates";
import TelegramStreaming from "@/components/TelegramStreaming";
import AppHeader from "@/components/AppHeader";
import { useIsMobile } from "@/hooks/use-mobile";

interface EventData {
  id: string;
  name: string;
  sport: string;
  status: string;
  program_url: string;
  streaming_type?: string;
  telegram_channel_id?: string;
  telegram_invite_link?: string;
  youtube_key?: string;
  twitch_key?: string;
}

const ViewerPage = () => {
  const { eventId } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [currentUserId] = useState(`viewer_${Math.random().toString(36).substr(2, 9)}`);
  const isMobile = useIsMobile();
  
  // Use real-time hooks
  const { viewerCount, onlineUsers } = useRealtimePresence({ 
    eventId: eventId || '', 
    userId: currentUserId 
  });

  const initializePlayer = useCallback(() => {
    if (!videoRef.current) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    const programUrl = videoRef.current.dataset.programUrl;
    if (!programUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });
      
      hlsRef.current = hls;
      hls.loadSource(programUrl);
      hls.attachMedia(videoRef.current);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data);
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      videoRef.current.src = programUrl;
      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current?.play();
      });
    }
  }, []);
  
  const { event, loading } = useRealtimeEventUpdates({
    eventId: eventId || '',
    onEventUpdate: useCallback((updatedEvent) => {
      // Re-initialize player if program URL changes
      if (videoRef.current) {
        videoRef.current.dataset.programUrl = updatedEvent.program_url;
        setTimeout(initializePlayer, 100);
      }
    }, [initializePlayer]),
    onCameraSwitch: useCallback(() => {
      // Reload HLS when camera switches
      if (hlsRef.current && videoRef.current?.dataset.programUrl) {
        hlsRef.current.loadSource(videoRef.current.dataset.programUrl);
      }
    }, [])
  });

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (event?.program_url && videoRef.current) {
      videoRef.current.dataset.programUrl = event.program_url;
      initializePlayer();
    }
  }, [event?.program_url, initializePlayer]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header Skeleton */}
        <div className="aspect-video bg-muted animate-pulse" />
        
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <LoadingSkeleton variant="text" className="h-6 w-3/4" />
                  <LoadingSkeleton variant="text" className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <LoadingSkeleton variant="text" lines={3} />
                </CardContent>
              </Card>
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <LoadingSkeleton variant="text" className="h-5 w-1/2" />
                </CardHeader>
                <CardContent>
                  <LoadingSkeleton variant="card" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <LoadingSkeleton variant="text" className="h-5 w-1/2" />
                </CardHeader>
                <CardContent>
                  <LoadingSkeleton variant="text" lines={4} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">Event Not Found</h3>
            <p className="text-muted-foreground">
              The requested event could not be found or may have ended.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine the best streaming source
  const getStreamingSource = () => {
    if (event?.youtube_key) {
      return {
        type: 'youtube',
        url: `https://www.youtube.com/embed/live_stream?channel=${event.youtube_key}&autoplay=1&controls=1`,
        chatUrl: `https://www.youtube.com/live_chat?v=${event.youtube_key}&embed_domain=${window.location.hostname}`
      };
    }
    if (event?.twitch_key) {
      return {
        type: 'twitch',
        url: `https://player.twitch.tv/?channel=${event.twitch_key}&parent=${window.location.hostname}&autoplay=true`,
        chatUrl: `https://www.twitch.tv/embed/${event.twitch_key}/chat?parent=${window.location.hostname}`
      };
    }
    if (event?.program_url) {
      return {
        type: 'hls',
        url: event.program_url,
        chatUrl: null
      };
    }
    return null;
  };

  const streamingSource = getStreamingSource();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      {/* Check if this is a Telegram streaming event */}
      {event.streaming_type === 'telegram' ? (
        <div className="container mx-auto px-4 py-6">
          <TelegramStreaming
            eventId={event.id}
            eventName={event.name}
            eventCode={event.id} // Using event ID as code for now
            telegramChannelId={event.telegram_channel_id}
            telegramInviteLink={event.telegram_invite_link}
            isDirector={false}
          />
        </div>
      ) : (
        <>
          {/* Main Video Player */}
          <div className="relative">
            <div className="aspect-video bg-black">
              {streamingSource && event.status === 'live' ? (
                streamingSource.type === 'hls' ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full"
                    controls
                    muted
                    autoPlay
                    playsInline
                  />
                ) : (
                  <iframe
                    src={streamingSource.url}
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                    frameBorder="0"
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-white">
                    <Play className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-xl font-semibold mb-2">
                      {event.status === 'scheduled' ? 'Stream Starting Soon' : 'Stream Offline'}
                    </h3>
                    <p className="opacity-75 mb-4">
                      {event.status === 'scheduled' 
                        ? 'The event will begin shortly. Stay tuned!' 
                        : 'This stream has ended.'}
                    </p>
                    {/* Platform Links */}
                    <div className="flex gap-2 justify-center">
                      {event.youtube_key && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://youtube.com/channel/${event.youtube_key}`, '_blank')}
                          className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                        >
                          <Youtube className="h-4 w-4 mr-2" />
                          YouTube
                        </Button>
                      )}
                      {event.twitch_key && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://twitch.tv/${event.twitch_key}`, '_blank')}
                          className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                        >
                          <Twitch className="h-4 w-4 mr-2" />
                          Twitch
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Live Indicator */}
            {event.status === 'live' && (
              <div className="absolute top-4 left-4 flex gap-2">
                <Badge variant="destructive" className="bg-red-600 animate-pulse">
                  <Wifi className="h-3 w-3 mr-1" />
                  LIVE
                </Badge>
                {streamingSource?.type === 'youtube' && (
                  <Badge className="bg-red-600">
                    <Youtube className="h-3 w-3 mr-1" />
                    YouTube
                  </Badge>
                )}
                {streamingSource?.type === 'twitch' && (
                  <Badge className="bg-purple-600">
                    <Twitch className="h-3 w-3 mr-1" />
                    Twitch
                  </Badge>
                )}
              </div>
            )}

            {/* Viewer Count */}
            <div className="absolute top-4 right-4 flex gap-2">
              <Badge variant="secondary" className="bg-black/50 text-white">
                <Eye className="h-3 w-3 mr-1" />
                {viewerCount.toLocaleString()} watching
              </Badge>
              {useMemo(() => onlineUsers.length > 0 && (
                <Badge variant="outline" className="bg-black/50 text-white border-white/20">
                  <Users className="h-3 w-3 mr-1" />
                  {onlineUsers.length} live
                </Badge>
              ), [onlineUsers.length])}
            </div>
          </div>
        </>
      )}

      {/* Event Info and Chat */}
      {event.streaming_type !== 'telegram' && (
        <div className="container mx-auto px-4 py-6">
          <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
            <div className={isMobile ? '' : 'lg:col-span-2'}>
              <Card>
                <CardHeader>
                  <CardTitle className={`flex items-center justify-between ${isMobile ? 'flex-col gap-3 items-start' : ''}`}>
                    <span>{event.name}</span>
                    <div className={`flex gap-2 ${isMobile ? 'flex-col w-full' : ''}`}>
                      {event.youtube_key && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://youtube.com/channel/${event.youtube_key}`, '_blank')}
                          className={isMobile ? 'w-full justify-start' : ''}
                        >
                          <Youtube className="h-4 w-4 mr-2" />
                          YouTube
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                      {event.twitch_key && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://twitch.tv/${event.twitch_key}`, '_blank')}
                          className={isMobile ? 'w-full justify-start' : ''}
                        >
                          <Twitch className="h-4 w-4 mr-2" />
                          Twitch
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-4">
                    <span>Sport: {event.sport}</span>
                    <Badge variant={event.status === 'live' ? 'default' : 'secondary'}>
                      {event.status}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Experience the action from multiple camera angles with our live multi-camera sports streaming.
                    Professional-grade coverage with real-time camera switching for the best viewing experience.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Chat Section */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Live Chat
                  </CardTitle>
                  <CardDescription>
                    Connect with other viewers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`bg-muted rounded-md overflow-hidden ${isMobile ? 'h-64' : 'h-96'}`}>
                    {streamingSource?.chatUrl ? (
                      <iframe
                        src={streamingSource.chatUrl}
                        className="w-full h-full"
                        frameBorder="0"
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-sm text-muted-foreground text-center">
                          Live chat will appear here when streaming
                          <br />
                          to YouTube or Twitch
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Event Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Current Viewers</span>
                    <span className="text-sm font-medium">{viewerCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Stream Source</span>
                    <span className="text-sm font-medium capitalize">
                      {streamingSource?.type || 'HLS'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Stream Quality</span>
                    <span className="text-sm font-medium">1080p</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Latency</span>
                    <span className="text-sm font-medium">
                      {streamingSource?.type === 'hls' ? '~3-5s' : '~10-15s'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewerPage;