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
    const { action, eventId, cameraId } = await req.json();
    console.log('Telegram stream action:', action, 'for event:', eventId, 'camera:', cameraId);

    // Create Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Telegram stream key from environment
    const telegramStreamKey = Deno.env.get('TELEGRAM_STREAM_KEY');
    if (!telegramStreamKey) {
      throw new Error('Telegram stream key not configured');
    }

    switch (action) {
      case 'getStreamConfig':
        // Return the RTMP configuration for the camera to use
        return new Response(
          JSON.stringify({
            success: true,
            streamConfig: {
              rtmpUrl: 'rtmp://ingest.rtmp.youtube.com/live2',
              streamKey: telegramStreamKey,
              fullRtmpUrl: `rtmp://ingest.rtmp.youtube.com/live2/${telegramStreamKey}`
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );

      case 'startStream':
        // Update camera status to live
        const { error: startError } = await supabase
          .from('cameras')
          .update({ 
            is_live: true,
            stream_url: `https://www.youtube.com/watch?v=${telegramStreamKey}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', cameraId);

        if (startError) {
          throw new Error('Failed to update camera status: ' + startError.message);
        }

        console.log('Camera marked as live:', cameraId);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Stream started successfully',
            streamUrl: `https://www.youtube.com/watch?v=${telegramStreamKey}`
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