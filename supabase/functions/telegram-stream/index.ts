import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Telegram stream function called');
    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody));
    
    const { action, eventId, cameraId } = requestBody;
    console.log('Telegram stream action:', action, 'for event:', eventId, 'camera:', cameraId);

    // Create Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get event data to check Telegram configuration
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('name, telegram_channel_id, telegram_invite_link')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      throw new Error('Event not found');
    }

    console.log('Event data:', eventData);
    console.log('Action:', action, 'EventId:', eventId, 'CameraId:', cameraId);

    switch (action) {
      case 'getStreamConfig':
        console.log('Getting RTMP stream configuration via TDLib');
        
        // Call TDLib service to get real RTMP credentials
        const { data: rtmpData, error: rtmpError } = await supabase.functions.invoke('tdlib-service', {
          body: {
            action: 'getRTMPCredentials',
            chatId: eventData.telegram_channel_id || '@sportstreamx',
            eventName: eventData.name,
            eventId: eventId
          }
        });

        if (rtmpError || !rtmpData?.success) {
          console.error('Failed to get RTMP credentials:', rtmpError || rtmpData?.error);
          throw new Error('Failed to get RTMP credentials from TDLib');
        }

        console.log('RTMP credentials received:', rtmpData);

        return new Response(
          JSON.stringify({
            success: true,
            streamConfig: {
              rtmpUrl: rtmpData.rtmpUrl,
              streamKey: rtmpData.streamKey,
              fullRtmpUrl: rtmpData.fullRtmpUrl
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );

      case 'startStream':
        console.log('Starting stream for camera:', cameraId);
        
        // Create or get RTMP stream via TDLib
        const { data: streamData, error: streamError } = await supabase.functions.invoke('tdlib-service', {
          body: {
            action: 'createRTMPStream',
            chatId: eventData.telegram_channel_id || '@sportstreamx',
            eventName: eventData.name,
            eventId: eventId
          }
        });

        if (streamError || !streamData?.success) {
          console.error('Failed to create RTMP stream:', streamError || streamData?.error);
          throw new Error('Failed to create RTMP stream via TDLib');
        }

        console.log('RTMP stream created:', streamData);

        // Update camera status to live with real stream URL
        const { error: startError } = await supabase
          .from('cameras')
          .update({ 
            is_live: true,
            stream_url: streamData.viewUrl || `https://t.me/sportstreamx`,
            stream_key: streamData.streamKey,
            updated_at: new Date().toISOString()
          })
          .eq('id', cameraId);

        if (startError) {
          console.error('Database update error:', startError);
          throw new Error('Failed to update camera status: ' + startError.message);
        }

        console.log('Camera marked as live:', cameraId);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Stream started successfully',
            streamUrl: streamData.viewUrl || `https://t.me/sportstreamx`,
            rtmpUrl: streamData.rtmpUrl,
            streamKey: streamData.streamKey
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );

      case 'stopStream':
        // Update camera status to offline
        const { error: stopError } = await supabase
          .from('cameras')
          .update({ 
            is_live: false,
            stream_url: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', cameraId);

        if (stopError) {
          throw new Error('Failed to update camera status: ' + stopError.message);
        }

        console.log('Camera marked as offline:', cameraId);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Stream stopped successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );

      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Error in telegram-stream function:', error);
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