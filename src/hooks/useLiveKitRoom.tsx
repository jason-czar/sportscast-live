import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Room, 
  ConnectionState, 
  RoomEvent, 
  RemoteParticipant, 
  LocalParticipant,
  Track,
  RemoteTrack,
  RemoteVideoTrack,
  RemoteAudioTrack,
  Participant
} from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LiveKitRoomState {
  room: Room | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  participants: Participant[];
  localParticipant: LocalParticipant | null;
}

interface UseLiveKitRoomOptions {
  eventId: string;
  participantName: string;
  participantIdentity: string;
  autoConnect?: boolean;
}

export function useLiveKitRoom({ 
  eventId, 
  participantName, 
  participantIdentity,
  autoConnect = false 
}: UseLiveKitRoomOptions) {
  const [state, setState] = useState<LiveKitRoomState>({
    room: null,
    isConnecting: false,
    isConnected: false,
    error: null,
    participants: [],
    localParticipant: null
  });

  const roomRef = useRef<Room | null>(null);
  const { toast } = useToast();

  // Update participants list
  const updateParticipants = useCallback((room: Room) => {
    const allParticipants = [
      room.localParticipant,
      ...Array.from(room.remoteParticipants.values())
    ];
    
    setState(prev => ({
      ...prev,
      participants: allParticipants,
      localParticipant: room.localParticipant
    }));
  }, []);

  // Connect to LiveKit room
  const connectToRoom = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      console.log('Requesting LiveKit token for:', { eventId, participantName, participantIdentity });
      
      // Get JWT token from our edge function
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          eventId,
          participantName,
          participantIdentity
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to get LiveKit token');
      }

      console.log('Got LiveKit credentials:', { 
        wsUrl: data.wsUrl, 
        roomName: data.roomName,
        hasToken: !!data.token 
      });

      // Create and connect to room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: {
            width: 1280,
            height: 720,
            frameRate: 30
          }
        }
      });

      roomRef.current = room;

      // Set up event listeners
      room.on(RoomEvent.Connected, () => {
        console.log('Connected to LiveKit room:', eventId);
        setState(prev => ({ 
          ...prev, 
          isConnecting: false, 
          isConnected: true, 
          room,
          error: null 
        }));
        updateParticipants(room);
        
        toast({
          title: "Connected to Room",
          description: `Joined ${eventId} as ${participantName}`,
        });
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from LiveKit room');
        setState(prev => ({ 
          ...prev, 
          isConnected: false, 
          room: null,
          participants: [],
          localParticipant: null
        }));
      });

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log('Participant connected:', participant.identity);
        updateParticipants(room);
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('Participant disconnected:', participant.identity);
        updateParticipants(room);
      });

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
        console.log('Track subscribed:', {
          kind: track.kind,
          participant: participant.identity,
          trackSid: track.sid,
          isMuted: track.isMuted
        });
        updateParticipants(room);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
        console.log('Track unsubscribed:', track.kind, 'from', participant.identity);
        updateParticipants(room);
      });

      room.on(RoomEvent.TrackPublished, (publication, participant: RemoteParticipant) => {
        console.log('Track published:', {
          kind: publication.kind,
          participant: participant.identity,
          trackName: publication.trackName,
          source: publication.source
        });
      });

      room.on(RoomEvent.TrackUnpublished, (publication, participant: RemoteParticipant) => {
        console.log('Track unpublished:', publication.kind, 'from', participant.identity);
      });

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        console.log('Connection state changed:', state);
        if (state === ConnectionState.Reconnecting) {
          toast({
            title: "Reconnecting...",
            description: "Attempting to reconnect to the room",
          });
        }
      });

      // Connect to the room
      console.log('Connecting to LiveKit room with details:', {
        wsUrl: data.wsUrl,
        roomName: data.roomName,
        participantIdentity,
        participantName
      });
      await room.connect(data.wsUrl, data.token);

    } catch (error) {
      console.error('Failed to connect to LiveKit room:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMessage
      }));
      
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [eventId, participantName, participantIdentity, toast, updateParticipants]);

  // Disconnect from room
  const disconnectFromRoom = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
  }, []);

  // Auto-connect if specified
  useEffect(() => {
    if (autoConnect && eventId && participantName && participantIdentity) {
      connectToRoom();
    }

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, [autoConnect, eventId, participantName, participantIdentity, connectToRoom]);

  // Send data message to room
  const sendDataMessage = useCallback(async (data: any, options?: { reliable?: boolean }) => {
    if (!roomRef.current || !state.isConnected) {
      console.warn('Cannot send data: not connected to room');
      return;
    }

    try {
      const encoder = new TextEncoder();
      const message = encoder.encode(JSON.stringify(data));
      await roomRef.current.localParticipant.publishData(message, options);
      console.log('Sent data message:', data);
    } catch (error) {
      console.error('Failed to send data message:', error);
    }
  }, [state.isConnected]);

  // Get video tracks for participants
  const getParticipantVideoTracks = useCallback(() => {
    const videoTracks = new Map<string, RemoteVideoTrack>();
    
    console.log('Getting video tracks for participants:', state.participants.length);
    
    state.participants.forEach(participant => {
      console.log(`Participant ${participant.identity} has ${participant.videoTrackPublications.size} video publications`);
      
      participant.videoTrackPublications.forEach(publication => {
        console.log(`  Publication: ${publication.trackSid}, subscribed: ${publication.isSubscribed}, hasTrack: ${!!publication.track}`);
        
        if (publication.track && publication.isSubscribed) {
          videoTracks.set(participant.identity, publication.track as RemoteVideoTrack);
          console.log(`  Added video track for ${participant.identity}`);
        }
      });
    });

    console.log('Final video tracks map:', videoTracks.size);
    return videoTracks;
  }, [state.participants]);

  return {
    ...state,
    connectToRoom,
    disconnectFromRoom,
    sendDataMessage,
    getParticipantVideoTracks
  };
}