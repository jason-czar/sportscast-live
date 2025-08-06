import { useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import LoadingButton from "@/components/ui/LoadingButton";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { toastService } from "@/lib/toast-service";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { supabase } from "@/integrations/supabase/client";
import ErrorMessage from "@/components/error/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Play, Square, Users, Wifi, WifiOff, Monitor, Settings, Eye, Youtube, Twitch, ExternalLink } from "lucide-react";
import { useRealtimePresence } from "@/hooks/useRealtimePresence";
import { useRealtimeEventUpdates } from "@/hooks/useRealtimeEventUpdates";
import { useRealtimeCleanup } from "@/hooks/useRealtimeCleanup";
import CameraCard from "@/components/CameraCard";
import EventHeader from "@/components/EventHeader";
import EventQRCode from "@/components/EventQRCode";
import AppHeader from "@/components/AppHeader";

interface Camera {
  id: string;
  device_label: string;
  is_live: boolean;
  is_active: boolean;
  event_id: string;
  stream_url?: string | null;
}

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

const DirectorDashboard = () => {
  const { eventId } = useParams();
  const { handleAsyncError } = useErrorHandler();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId] = useState(`director_${Math.random().toString(36).substr(2, 9)}`);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  
  // Use real-time hooks
  const { viewerCount } = useRealtimePresence({ 
    eventId: eventId || '', 
    userId: currentUserId 
  });
  
  const { event, cameras, loading: dataLoading } = useRealtimeEventUpdates({
    eventId: eventId || ''
  });

  // Cleanup stale connections
  useRealtimeCleanup({
    eventId: eventId || '',
    enabled: true,
    interval: 30000 // Clean up every 30 seconds
  });
  
  



  const handleCameraSelect = useCallback((cameraId: string) => {
    setSelectedCameraId(cameraId);
  }, []);

  const setActiveCamera = useCallback(async (cameraId: string) => {
    try {
      // First, deactivate all cameras
      await supabase
        .from('cameras')
        .update({ is_active: false })
        .eq('event_id', eventId);

      // Then activate the selected camera
      const { error } = await supabase
        .from('cameras')
        .update({ is_active: true })
        .eq('id', cameraId);

      if (error) throw error;

      // Call edge function to switch camera and log the switch
      await supabase.functions.invoke('switch-camera', {
        body: { eventId, cameraId }
      });

      // Set this camera as selected for the main feed
      setSelectedCameraId(cameraId);

      const activeCamera = cameras.find(cam => cam.id === cameraId);
      if (activeCamera) {
        toastService.event.cameraSwitched(activeCamera.device_label);
      }
    } catch (error) {
      console.error('Error switching camera:', error);
      toastService.error({
        description: "Failed to switch camera. Please try again.",
      });
    }
  }, [eventId, cameras]);

  const startStream = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Starting LiveKit egress for event:', eventId);
      
      const { data, error } = await supabase.functions.invoke('livekit-egress', {
        body: { 
          eventId,
          action: 'start'
        }
      });

      if (error) {
        console.error('LiveKit egress start error:', error);
        throw error;
      }

      console.log('LiveKit egress start response:', data);

      await supabase
        .from('events')
        .update({ status: 'live' })
        .eq('id', eventId);

      toastService.event.streamStarted();
    } catch (error) {
      console.error('Error starting stream:', error);
      toastService.error({
        title: "Stream Start Failed",
        description: error.message || "Failed to start stream. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const endStream = useCallback(async () => {
    try {
      setLoading(true);
      const { error } = await supabase.functions.invoke('livekit-egress', {
        body: { 
          eventId,
          action: 'stop'
        }
      });

      if (error) throw error;

      await supabase
        .from('events')
        .update({ status: 'ended' })
        .eq('id', eventId);

      toastService.event.streamEnded();
    } catch (error) {
      console.error('Error ending stream:', error);
      toastService.error({
        description: "Failed to end stream. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const addSimulcastTargets = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Adding simulcast targets for event:', eventId);
      
      const { data, error } = await supabase.functions.invoke('add-simulcast', {
        body: { eventId }
      });

      if (error) {
        console.error('Add simulcast function error:', error);
        throw error;
      }

      console.log('Add simulcast response:', data);
      toastService.event.simulcastConfigured();
    } catch (error) {
      console.error('Error adding simulcast:', error);
      toastService.error({
        title: "Simulcast Setup Failed",
        description: error.message || "Failed to configure simulcast targets. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const streaming = useMemo(() => event?.status === 'live', [event?.status]);

  if (dataLoading && !event) {
    return <LoadingSpinner fullScreen text="Loading director dashboard..." />;
  }

  if (error && !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <ErrorMessage
          title="Unable to load director dashboard"
          message={error}
          onRetry={() => window.location.reload()}
          className="max-w-md"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="p-4">
        <div className="max-w-7xl mx-auto space-y-6">
        {/* Event Header */}
        {event && (
          <EventHeader
            event={event}
            viewerCount={viewerCount}
            streaming={streaming}
            loading={loading}
            onStartStream={startStream}
            onEndStream={endStream}
            onAddSimulcast={addSimulcastTargets}
            cameraCount={cameras.length}
          />
        )}

        {/* QR Code and Camera Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* QR Code Section */}
          {event && (
            <div className="lg:col-span-1">
              <EventQRCode 
                eventCode={event.event_code} 
                eventName={event.name} 
              />
            </div>
          )}
          
          {/* Camera Grid */}
          <div className="lg:col-span-3 space-y-4">
            {/* Main Program Feed Display */}
            {selectedCameraId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Live Program Feed
                  </CardTitle>
                  <CardDescription>
                    Currently showing: {cameras.find(c => c.id === selectedCameraId)?.device_label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-black rounded-lg flex items-center justify-center relative overflow-hidden">
                    {event?.program_url ? (
                      <video
                        className="w-full h-full object-cover"
                        src={event.program_url}
                        autoPlay
                        muted
                        playsInline
                        controls={false}
                        onError={(e) => {
                          console.error('Video playback error:', e);
                        }}
                      />
                    ) : (
                      <div className="text-white text-center">
                        <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Program Feed</p>
                        <p className="text-sm opacity-75">Start streaming to see live video</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-6 w-6" />
                Connected Cameras ({cameras.length}/8)
              </h2>
            </div>

            {cameras.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Cameras Connected</h3>
                  <p className="text-muted-foreground mb-4">
                    Camera operators can scan the QR code or use event code <span className="font-mono font-bold">{event?.event_code}</span> to connect.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cameras.map((camera) => (
                  <CameraCard
                    key={camera.id}
                    camera={camera}
                    onActivate={setActiveCamera}
                    onSelect={handleCameraSelect}
                    isSelected={selectedCameraId === camera.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Program Feed Info */}
        {event?.program_url && (
          <Card>
            <CardHeader>
              <CardTitle>Program Feed</CardTitle>
              <CardDescription>
                Share this URL with viewers or embed in your application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-3 rounded-md font-mono text-sm break-all">
                {event.program_url}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live Stream URLs */}
        {streaming && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Live Stream URLs
              </CardTitle>
              <CardDescription>
                Share these URLs with your audience to watch the live stream
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Live Stream Player */}
              <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
                {cameras.some(cam => cam.is_live) ? (
                  <iframe
                    src={`https://www.youtube.com/embed/live_stream?channel=${cameras.find(cam => cam.is_live)?.stream_url?.split('?v=')[1] || ''}&autoplay=1`}
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Play className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No live streams active</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Stream Links */}
              {cameras.some(cam => cam.is_live && cam.stream_url) && (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Youtube className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium">Live Stream</p>
                      <p className="text-sm text-muted-foreground">Professional streaming active</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(cameras.find(cam => cam.is_live)?.stream_url, '_blank')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Live
                  </Button>
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                <p>💡 These URLs will be active only when the stream is live. Share them with your audience!</p>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
};

export default DirectorDashboard;