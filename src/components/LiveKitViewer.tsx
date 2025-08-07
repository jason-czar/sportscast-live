import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Room, RoomEvent, Participant, RemoteVideoTrack, RemoteTrackPublication } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Users, Wifi, Monitor } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function LiveKitViewer() {
  const { eventId } = useParams<{ eventId: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeParticipant, setActiveParticipant] = useState<Participant | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      console.error('LiveKitViewer: No eventId provided');
      return;
    }

    const connectToRoom = async () => {
      try {
        setLoading(true);
        console.log('LiveKitViewer connecting to room for event:', eventId);

        // Get LiveKit token for viewer
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
          body: {
            eventId,
            participantName: 'Viewer',
            participantIdentity: `viewer_${Math.random().toString(36).substr(2, 9)}`,
            metadata: JSON.stringify({ role: 'viewer' })
          }
        });

        if (tokenError) {
          console.error('Error getting LiveKit token:', tokenError);
          throw new Error('Failed to get viewing token');
        }

        if (!tokenData?.token) {
          throw new Error('No token received');
        }

        // Connect to LiveKit room
        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: {
              width: 1920,
              height: 1080,
              frameRate: 30,
            },
          },
        });

        // Set up event listeners
        newRoom.on(RoomEvent.Connected, () => {
          console.log('LiveKitViewer connected to room');
          setIsConnected(true);
          setError(null);
        });

        newRoom.on(RoomEvent.Disconnected, () => {
          console.log('LiveKitViewer disconnected from room');
          setIsConnected(false);
        });

        newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
          console.log('Participant connected:', participant.identity);
          updateParticipants(newRoom);
        });

        newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
          console.log('Participant disconnected:', participant.identity);
          updateParticipants(newRoom);
        });

        newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log('Track subscribed:', track.kind, 'from', participant.identity);
          if (track.kind === 'video' && track instanceof RemoteVideoTrack) {
            // If this is the first camera or the active camera, show it
            if (!activeParticipant || participant.identity === activeParticipant.identity) {
              setActiveParticipant(participant);
              attachVideoTrack(track);
            }
          }
        });

        newRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          console.log('Track unsubscribed:', track.kind, 'from', participant.identity);
          if (participant.identity === activeParticipant?.identity) {
            // Find another camera to show
            const cameraParticipants = Array.from(newRoom.remoteParticipants.values()).filter(p => 
              p.identity.startsWith('camera_') && p.videoTrackPublications.size > 0
            );
            if (cameraParticipants.length > 0) {
              const nextParticipant = cameraParticipants[0];
              setActiveParticipant(nextParticipant);
              const videoTrack = nextParticipant.videoTrackPublications.values().next().value?.track;
              if (videoTrack instanceof RemoteVideoTrack) {
                attachVideoTrack(videoTrack);
              }
            } else {
              setActiveParticipant(null);
            }
          }
        });

        newRoom.on(RoomEvent.DataReceived, (payload, participant) => {
          try {
            const data = JSON.parse(new TextDecoder().decode(payload));
            if (data.type === 'layout_update' && data.activeCamera) {
              // Switch to the active camera specified by director
              const targetParticipant = newRoom.remoteParticipants.get(data.activeCamera);
              if (targetParticipant) {
                setActiveParticipant(targetParticipant);
                const videoTrack = targetParticipant.videoTrackPublications.values().next().value?.track;
                if (videoTrack instanceof RemoteVideoTrack) {
                  attachVideoTrack(videoTrack);
                }
              }
            }
          } catch (error) {
            console.error('Error parsing data message:', error);
          }
        });

        await newRoom.connect(tokenData.wsUrl, tokenData.token);
        setRoom(newRoom);
        updateParticipants(newRoom);

      } catch (error) {
        console.error('Error connecting to LiveKit room:', error);
        setError(error.message || 'Failed to connect to live stream');
      } finally {
        setLoading(false);
      }
    };

    connectToRoom();

    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [eventId]);

  const updateParticipants = (currentRoom: Room) => {
    const allParticipants = Array.from(currentRoom.remoteParticipants.values());
    setParticipants(allParticipants);

    // Auto-select the first camera if none is selected
    if (!activeParticipant) {
      const cameraParticipants = allParticipants.filter(p => 
        p.identity.startsWith('camera_') && p.videoTrackPublications.size > 0
      );
      if (cameraParticipants.length > 0) {
        const firstCamera = cameraParticipants[0];
        setActiveParticipant(firstCamera);
        const videoTrack = firstCamera.videoTrackPublications.values().next().value?.track;
        if (videoTrack instanceof RemoteVideoTrack) {
          attachVideoTrack(videoTrack);
        }
      }
    }
  };

  const attachVideoTrack = (track: RemoteVideoTrack) => {
    if (videoRef.current) {
      track.attach(videoRef.current);
      // Enable reliable autoplay: start muted, then allow user to unmute
      try {
        videoRef.current.muted = true;
        const p = videoRef.current.play();
        if (p && typeof (p as any).catch === 'function') {
          (p as Promise<void>).catch(() => {
            // Autoplay might still be blocked on some browsers until user gesture
          });
        }
      } catch (e) {
        // ignore
      }
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <LoadingSpinner className="mx-auto mb-4" />
          <p className="text-lg">Connecting to live stream...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">Stream Unavailable</p>
          <p className="text-sm opacity-75">{error}</p>
        </div>
      </div>
    );
  }

  const cameraParticipants = participants.filter(p => p.identity.startsWith('camera_'));

  return (
    <div className="w-full h-full bg-black relative">
      {/* Video Player */}
      <div className="w-full h-full">
        {activeParticipant && cameraParticipants.length > 0 ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-white">
              <Play className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl font-semibold mb-2">
                {isConnected ? 'Waiting for Camera Feed' : 'Connecting...'}
              </p>
              <p className="opacity-75">
                {isConnected 
                  ? 'Camera operators will appear here when they connect' 
                  : 'Establishing connection to live stream...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status Overlay */}
      {isConnected && (
        <div className="absolute top-4 left-4 flex gap-2">
          <Badge variant="destructive" className="bg-red-600 animate-pulse">
            <Wifi className="h-3 w-3 mr-1" />
            LIVE
          </Badge>
          {cameraParticipants.length > 0 && (
            <Badge variant="secondary" className="bg-black/50 text-white">
              <Users className="h-3 w-3 mr-1" />
              {cameraParticipants.length} camera{cameraParticipants.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      )}

      {/* Active Camera Info */}
      {activeParticipant && (
        <div className="absolute bottom-4 left-4">
          <Badge variant="outline" className="bg-black/50 text-white border-white/20">
            <Monitor className="h-3 w-3 mr-1" />
            {activeParticipant.metadata || activeParticipant.identity.replace('camera_', '').replace(/_/g, ' ')}
          </Badge>
        </div>
      )}
    </div>
  );
}