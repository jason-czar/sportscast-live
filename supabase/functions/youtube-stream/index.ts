import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface YouTubeStreamRequest {
  action: 'createStream' | 'startStream' | 'stopStream' | 'getStreamStatus';
  eventId: string;
  title?: string;
  description?: string;
  streamId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, eventId, title, description, streamId }: YouTubeStreamRequest = await req.json();

    // Get user's profile with YouTube tokens
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('youtube_access_token, youtube_refresh_token, youtube_channel_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.youtube_access_token) {
      return new Response(JSON.stringify({ 
        error: 'YouTube account not connected. Please connect your YouTube account first.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get event details if eventId is not 'temp' (for event creation flow)
    let event = null;
    if (eventId !== 'temp') {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('name, sport, start_time')
        .eq('id', eventId)
        .single();

      if (eventError) {
        throw new Error('Event not found');
      }
      event = eventData;
    }

    const makeYouTubeRequest = async (url: string, options: RequestInit) => {
      let response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${profile.youtube_access_token}`,
        },
      });

      // If token expired, try to refresh
      if (response.status === 401 && profile.youtube_refresh_token) {
        console.log('YouTube token expired, refreshing...');
        
        const refreshResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/youtube-auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            action: 'refreshToken',
            refreshToken: profile.youtube_refresh_token
          })
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          profile.youtube_access_token = refreshData.accessToken;
          
          // Retry original request with new token
          response = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${profile.youtube_access_token}`,
            },
          });
        }
      }

      return response;
    };

    if (action === 'createStream') {
      const streamTitle = title || (event ? `${event.name} - Live ${event.sport}` : 'Live Stream');
      const streamDescription = description || (event ? `Live streaming ${event.name} - ${event.sport} event. Join us for this exciting match!` : 'Live stream event');
      const scheduledStartTime = event?.start_time || new Date().toISOString();

      // Create YouTube live broadcast
      const broadcastResponse = await makeYouTubeRequest(
        'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            snippet: {
              title: streamTitle,
              description: streamDescription,
              scheduledStartTime: scheduledStartTime,
            },
            status: {
              privacyStatus: 'public',
              selfDeclaredMadeForKids: false
            }
          }),
        }
      );

      if (!broadcastResponse.ok) {
        const error = await broadcastResponse.text();
        console.error('Failed to create YouTube broadcast:', error);
        throw new Error('Failed to create YouTube live broadcast');
      }

      const broadcast = await broadcastResponse.json();

      // Create YouTube live stream
      const streamResponse = await makeYouTubeRequest(
        'https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            snippet: {
              title: streamTitle,
            },
            cdn: {
              frameRate: '30fps',
              ingestionType: 'rtmp',
              resolution: '1080p'
            }
          }),
        }
      );

      if (!streamResponse.ok) {
        throw new Error('Failed to create YouTube live stream');
      }

      const stream = await streamResponse.json();

      // Bind broadcast to stream
      const bindResponse = await makeYouTubeRequest(
        `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcast.id}&streamId=${stream.id}&part=snippet,status`,
        {
          method: 'POST',
        }
      );

      if (!bindResponse.ok) {
        throw new Error('Failed to bind YouTube broadcast to stream');
      }

      // Update event with YouTube stream info only if it's not a temp event
      if (eventId !== 'temp') {
        const { error: updateError } = await supabase
          .from('events')
          .update({
            youtube_stream_key: stream.cdn.ingestionInfo.streamName,
            youtube_broadcast_id: broadcast.id,
            youtube_stream_id: stream.id
          })
          .eq('id', eventId);

        if (updateError) {
          console.error('Failed to update event with YouTube info:', updateError);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        broadcast: {
          id: broadcast.id,
          title: broadcast.snippet.title,
          status: broadcast.status.lifeCycleStatus,
          watchUrl: `https://www.youtube.com/watch?v=${broadcast.id}`
        },
        stream: {
          id: stream.id,
          streamName: stream.cdn.ingestionInfo.streamName,
          rtmpUrl: stream.cdn.ingestionInfo.ingestionAddress
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'startStream' && streamId) {
      // Transition broadcast to live
      const response = await makeYouTubeRequest(
        `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=live&id=${streamId}&part=snippet,status`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to start YouTube live stream');
      }

      const result = await response.json();

      return new Response(JSON.stringify({
        success: true,
        status: result.status.lifeCycleStatus
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'stopStream' && streamId) {
      // Transition broadcast to complete
      const response = await makeYouTubeRequest(
        `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${streamId}&part=snippet,status`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to stop YouTube live stream');
      }

      const result = await response.json();

      return new Response(JSON.stringify({
        success: true,
        status: result.status.lifeCycleStatus
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in youtube-stream function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});