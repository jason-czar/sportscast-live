import { useState, useCallback, useMemo, useEffect } from "react";
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
import { useLiveKitRoom } from "@/hooks/useLiveKitRoom";
import { LiveCameraCard } from "@/components/LiveCameraCard";
import EventHeader from "@/components/EventHeader";
import EventQRCode from "@/components/EventQRCode";
import AppHeader from "@/components/AppHeader";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const [activeCameraIdentity, setActiveCameraIdentity] = useState<string | null>(null);
  const isMobile = useIsMobile();
  
  // Use real-time hooks for database updates
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

  // LiveKit room integration for director
  const {
    room,
    isConnecting: roomConnecting,
    isConnected: roomConnected,
    error: roomError,
    participants,
    connectToRoom,
    disconnectFromRoom,
    sendDataMessage,
    getParticipantVideoTracks
  } = useLiveKitRoom({
    eventId: eventId || '',
    participantName: 'Director',
    participantIdentity: `director_${currentUserId}`,
    autoConnect: false
  });

  // Filter camera participants (exclude director)
  const cameraParticipants = useMemo(() => {
    return participants.filter(p => 
      p.identity.startsWith('camera_') && !p.identity.includes('director')
    );
  }, [participants]);

  // Get video tracks for camera participants
  const videoTracks = useMemo(() => {
    const tracks = getParticipantVideoTracks();
    console.log('DirectorDashboard videoTracks:', {
      roomConnected,
      trackCount: tracks.size,
      participantCount: participants.length,
      cameraParticipantCount: cameraParticipants.length,
      roomIdentity: room?.localParticipant?.identity,
      roomName: room?.name,
      allParticipants: participants.map(p => ({
        identity: p.identity,
        metadata: p.metadata,
        videoPublications: p.videoTrackPublications.size,
        audioPublications: p.audioTrackPublications.size,
        publications: Array.from(p.videoTrackPublications.values()).map(pub => ({
          trackSid: pub.trackSid,
          isSubscribed: pub.isSubscribed,
          hasTrack: !!pub.track,
          isMuted: pub.track?.isMuted
        }))
      })),
      tracks: Array.from(tracks.entries()).map(([id, track]) => ({
        participantId: id,
        hasTrack: !!track,
        isMuted: track?.isMuted
      }))
    });
    return tracks;
  }, [getParticipantVideoTracks, participants.length, cameraParticipants.length, roomConnected, room]);
  
  
  // Calculate streaming status
  const streaming = useMemo(() => event?.status === 'live', [event?.status]);

  // Auto-connect to LiveKit room when event is loaded
  useEffect(() => {
    if (event && !roomConnected && !roomConnecting) {
      console.log('Auto-connecting director to LiveKit room:', {
        eventId,
        eventData: event,
        roomConnected,
        roomConnecting
      });
      connectToRoom();
    }
  }, [event, roomConnected, roomConnecting, connectToRoom, eventId]);

  // Auto-select first camera when cameras connect
  useEffect(() => {
    if (cameraParticipants.length > 0 && !selectedCameraId) {
      const firstCamera = cameraParticipants[0];
      console.log('Auto-selecting first camera:', firstCamera.identity);
      setSelectedCameraId(firstCamera.identity);
    }
  }, [cameraParticipants.length, selectedCameraId]);

  // Handle camera selection from LiveKit participants
  const handleCameraSelect = useCallback((participantIdentity: string) => {
    setSelectedCameraId(participantIdentity);
    console.log('Selected camera participant:', participantIdentity);
  }, []);

  // Set active camera and notify through LiveKit data channel
  const setActiveCamera = useCallback(async (participantIdentity: string) => {
    try {
      setActiveCameraIdentity(participantIdentity);
      
      // Send layout update through LiveKit data channel
      await sendDataMessage({
        type: 'layout_update',
        activeCamera: participantIdentity,
        timestamp: Date.now()
      });

      // Update LiveKit egress layout in real-time
      if (streaming) {
        try {
          await supabase.functions.invoke('livekit-egress', {
            body: { 
              eventId,
              action: 'update_layout',
              activeCamera: participantIdentity
            }
          });
        } catch (layoutError) {
          console.warn('Layout update failed:', layoutError);
          // Don't block the UI for layout update failures
        }
      }

      // Also update database for persistence
      const cameraRecord = cameras.find(cam => 
        cam.device_label.toLowerCase().replace(/\s+/g, '_') === participantIdentity.replace('camera_', '')
      );

      if (cameraRecord) {
        // Deactivate all cameras first
        await supabase
          .from('cameras')
          .update({ is_active: false })
          .eq('event_id', eventId);

        // Activate selected camera
        await supabase
          .from('cameras')
          .update({ is_active: true })
          .eq('id', cameraRecord.id);

        // Log the switch
        await supabase.functions.invoke('switch-camera', {
          body: { eventId, cameraId: cameraRecord.id }
        });
      }

      setSelectedCameraId(participantIdentity);
      
      const participant = participants.find(p => p.identity === participantIdentity);
      if (participant) {
        toastService.event.cameraSwitched(participant.metadata || participantIdentity);
      }
    } catch (error) {
      console.error('Error switching camera:', error);
      toastService.error({
        description: "Failed to switch camera. Please try again.",
      });
    }
  }, [eventId, cameras, participants, sendDataMessage, streaming]);

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
        
        {/* Connection Status */}
        {event && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${roomConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium">
                    LiveKit Status: {roomConnected ? 'Connected' : roomConnecting ? 'Connecting...' : 'Disconnected'}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {cameraParticipants.length} camera(s) connected
                </div>
              </div>
              {roomError && (
                <div className="mt-2 text-sm text-destructive">
                  Error: {roomError}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
            cameraCount={cameraParticipants.length}
          />
        )}

        {/* QR Code and Camera Grid */}
        <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-4'}`}>
          {/* QR Code Section */}
          {event && (
            <div className={isMobile ? 'order-2' : 'lg:col-span-1'}>
              <EventQRCode 
                eventCode={event.event_code} 
                eventName={event.name} 
              />
            </div>
          )}
          
          {/* Live Camera Grid */}
          <div className={`space-y-4 ${isMobile ? 'order-1' : 'lg:col-span-3'}`}>
            {/* Main Program Feed Display */}
            {selectedCameraId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Live Program Feed
                  </CardTitle>
                  <CardDescription>
                    Currently showing: {
                      participants.find(p => p.identity === selectedCameraId)?.metadata || 
                      selectedCameraId.replace('camera_', '').replace(/_/g, ' ')
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-black rounded-lg flex items-center justify-center relative overflow-hidden">
                    {videoTracks.get(selectedCameraId) ? (
                      <video
                        className="w-full h-full object-cover"
                        ref={(video) => {
                          const track = videoTracks.get(selectedCameraId);
                          console.log('DirectorDashboard video ref callback:', { 
                            hasVideo: !!video, 
                            hasTrack: !!track,
                            selectedCameraId,
                            trackSid: track?.sid
                          });
                          if (video && track) {
                            track.attach(video);
                            console.log('Successfully attached track to video element');
                          }
                        }}
                        autoPlay
                        muted={false}
                        playsInline
                      />
                    ) : (
                      <div className="text-white text-center">
                        <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Program Feed</p>
                        <p className="text-sm opacity-75">
                          {roomConnected ? 'Select a camera to see live video' : 'Connecting to LiveKit...'}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-6 w-6" />
                Live Cameras ({cameraParticipants.length})
              </h2>
            </div>

            {!roomConnected ? (
              <Card>
                <CardContent className="text-center py-12">
                  <LoadingSpinner className="mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Connecting to LiveKit</h3>
                  <p className="text-muted-foreground">
                    Establishing real-time connection for live camera feeds...
                  </p>
                </CardContent>
              </Card>
            ) : cameraParticipants.length === 0 ? (
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
              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                {cameraParticipants.map((participant) => (
                  <LiveCameraCard
                    key={participant.identity}
                    participant={participant}
                    videoTrack={videoTracks.get(participant.identity) || null}
                    isSelected={selectedCameraId === participant.identity}
                    isActive={activeCameraIdentity === participant.identity}
                    onSelect={() => handleCameraSelect(participant.identity)}
                    onActivate={() => setActiveCamera(participant.identity)}
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
                {event?.program_url ? (
                  <iframe
                    src={event.program_url}
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                    frameBorder="0"
                  />
                ) : cameraParticipants.length > 0 ? (
                  <iframe
                    src={`${window.location.origin}/watch/${eventId}`}
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                    frameBorder="0"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Play className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>This video is unavailable</p>
                      <p className="text-xs mt-1">Stream will appear here when cameras connect</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Stream Links */}
              {cameraParticipants.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Wifi className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Live Stream Active</p>
                      <p className="text-sm text-muted-foreground">Camera feed streaming via LiveKit</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`${window.location.origin}/watch/${eventId}`, '_blank')}
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