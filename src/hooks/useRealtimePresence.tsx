import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeConnection } from './useRealtimeConnection';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface PresenceUser {
  user_id: string;
  online_at: string;
  user_agent?: string;
  role?: 'director' | 'camera_operator' | 'viewer';
  activity?: 'viewing' | 'directing' | 'operating_camera' | 'idle';
  last_seen?: string;
  avatar_url?: string;
  display_name?: string;
}

interface CollaborationIndicator {
  type: 'cursor' | 'selection' | 'edit' | 'focus';
  user_id: string;
  position?: { x: number; y: number };
  element?: string;
  data?: any;
}

interface UseRealtimePresenceProps {
  eventId: string;
  userId?: string;
  userProfile?: {
    display_name?: string;
    avatar_url?: string;
    role?: string;
  };
}

export const useRealtimePresence = ({ 
  eventId, 
  userId, 
  userProfile 
}: UseRealtimePresenceProps) => {
  const [presenceState, setPresenceState] = useState<Record<string, PresenceUser[]>>({});
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [collaborationIndicators, setCollaborationIndicators] = useState<CollaborationIndicator[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  
  const { createChannel, removeChannel } = useRealtimeConnection({
    autoReconnect: true,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000
  });

  const handlePresenceSync = useCallback(() => {
    if (!channel) return;
    
    const newState = channel.presenceState() as Record<string, PresenceUser[]>;
    setPresenceState(newState);
    
    // Flatten the presence state to get all online users
    const users = Object.values(newState).flat().filter((user): user is PresenceUser => 
      user && typeof user === 'object' && 'user_id' in user && 'online_at' in user
    );
    
    // Sort by role priority: director > camera_operator > viewer
    const sortedUsers = users.sort((a, b) => {
      const rolePriority = { director: 3, camera_operator: 2, viewer: 1 };
      return (rolePriority[b.role || 'viewer'] || 1) - (rolePriority[a.role || 'viewer'] || 1);
    });
    
    setOnlineUsers(sortedUsers);
  }, [channel]);

  const handlePresenceJoin = useCallback(({ key, newPresences }: any) => {
    console.log('[Presence] User joined:', key, newPresences);
    
    // Broadcast welcome message for new users
    if (channel && newPresences.length > 0) {
      const newUser = newPresences[0] as PresenceUser;
      channel.send({
        type: 'broadcast',
        event: 'user_joined',
        payload: {
          user_id: newUser.user_id,
          display_name: newUser.display_name,
          role: newUser.role,
          timestamp: new Date().toISOString()
        }
      });
    }
  }, [channel]);

  const handlePresenceLeave = useCallback(({ key, leftPresences }: any) => {
    console.log('[Presence] User left:', key, leftPresences);
    
    // Clean up collaboration indicators for users who left
    setCollaborationIndicators(prev => 
      prev.filter(indicator => 
        !leftPresences.some((user: PresenceUser) => user.user_id === indicator.user_id)
      )
    );
  }, []);

  const handleCollaborationEvent = useCallback((payload: any) => {
    const { type, user_id, data } = payload;
    
    switch (type) {
      case 'cursor_move':
        setCollaborationIndicators(prev => {
          const filtered = prev.filter(ind => !(ind.type === 'cursor' && ind.user_id === user_id));
          return [...filtered, {
            type: 'cursor',
            user_id,
            position: data.position,
            element: data.element
          }];
        });
        break;
        
      case 'element_focus':
        setCollaborationIndicators(prev => {
          const filtered = prev.filter(ind => !(ind.type === 'focus' && ind.user_id === user_id));
          return [...filtered, {
            type: 'focus',
            user_id,
            element: data.element,
            data: data.focusData
          }];
        });
        break;
        
      case 'element_edit':
        setCollaborationIndicators(prev => {
          const filtered = prev.filter(ind => !(ind.type === 'edit' && ind.user_id === user_id));
          return [...filtered, {
            type: 'edit',
            user_id,
            element: data.element,
            data: data.editData
          }];
        });
        break;
    }
  }, []);

  useEffect(() => {
    if (!eventId) return;

    const presenceChannel = createChannel(`event_${eventId}`, {
      config: {
        presence: {
          key: userId || 'anonymous'
        },
        broadcast: {
          self: true
        }
      }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, handlePresenceSync)
      .on('presence', { event: 'join' }, handlePresenceJoin)
      .on('presence', { event: 'leave' }, handlePresenceLeave)
      .on('broadcast', { event: 'collaboration' }, handleCollaborationEvent)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && userId) {
          const userStatus: PresenceUser = {
            user_id: userId,
            online_at: new Date().toISOString(),
            user_agent: navigator.userAgent.slice(0, 100),
            role: (userProfile?.role as any) || 'viewer',
            activity: 'viewing',
            display_name: userProfile?.display_name,
            avatar_url: userProfile?.avatar_url
          };
          
          await presenceChannel.track(userStatus);
        }
      });

    setChannel(presenceChannel);

    // Cleanup indicators when component unmounts
    return () => {
      removeChannel(`event_${eventId}`);
      setCollaborationIndicators([]);
      setChannel(null);
    };
  }, [eventId, userId, userProfile?.role, userProfile?.display_name, userProfile?.avatar_url, createChannel, removeChannel]);

  const updatePresence = useCallback(async (data: Partial<PresenceUser>) => {
    if (channel && userId) {
      await channel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
        ...data
      });
    }
  }, [channel, userId]);

  const updateActivity = useCallback(async (activity: PresenceUser['activity']) => {
    await updatePresence({ 
      activity,
      last_seen: new Date().toISOString()
    });
  }, [updatePresence]);

  const broadcastCollaboration = useCallback((
    type: 'cursor_move' | 'element_focus' | 'element_edit',
    data: any
  ) => {
    if (channel && userId) {
      channel.send({
        type: 'broadcast',
        event: 'collaboration',
        payload: {
          type,
          user_id: userId,
          data,
          timestamp: new Date().toISOString()
        }
      });
    }
  }, [channel, userId]);

  const sendCursorPosition = useCallback((position: { x: number; y: number }, element?: string) => {
    broadcastCollaboration('cursor_move', { position, element });
  }, [broadcastCollaboration]);

  const sendElementFocus = useCallback((element: string, focusData?: any) => {
    broadcastCollaboration('element_focus', { element, focusData });
  }, [broadcastCollaboration]);

  const sendElementEdit = useCallback((element: string, editData: any) => {
    broadcastCollaboration('element_edit', { element, editData });
  }, [broadcastCollaboration]);

  // Categorize users by role
  const usersByRole = useMemo(() => {
    const directors = onlineUsers.filter(user => user.role === 'director');
    const operators = onlineUsers.filter(user => user.role === 'camera_operator');
    const viewers = onlineUsers.filter(user => user.role === 'viewer');
    
    return { directors, operators, viewers };
  }, [onlineUsers]);

  const viewerCount = useMemo(() => onlineUsers.length, [onlineUsers.length]);

  const activeCollaborators = useMemo(() => {
    return onlineUsers.filter(user => 
      user.activity === 'directing' || user.activity === 'operating_camera'
    );
  }, [onlineUsers]);

  return {
    onlineUsers,
    usersByRole,
    activeCollaborators,
    collaborationIndicators,
    presenceState,
    viewerCount,
    updatePresence,
    updateActivity,
    sendCursorPosition,
    sendElementFocus,
    sendElementEdit,
    broadcastCollaboration
  };
};