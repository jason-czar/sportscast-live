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
    const { action, eventId, cameraId, streamType } = await req.json();
    console.log('Stream proxy function called:', action, 'eventId:', eventId, 'cameraId:', cameraId);

    // Create Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    switch (action) {
      case 'getStreamUrl':
        // Get the event and camera information
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('mux_stream_id, streaming_type, program_url')
          .eq('id', eventId)
          .single();

        if (eventError || !eventData) {
          console.error('Event not found:', eventError);
          throw new Error('Event not found');
        }

        const { data: cameraData, error: cameraError } = await supabase
          .from('cameras')
          .select('stream_url, stream_key')
          .eq('id', cameraId)
          .single();

        if (cameraError || !cameraData) {
          console.error('Camera not found:', cameraError);
          throw new Error('Camera not found');
        }

        console.log('Event streaming type:', eventData.streaming_type);
        console.log('Camera data:', cameraData);

        let streamUrl = null;

        if (eventData.streaming_type === 'telegram') {
          // For Telegram streams, provide a test video stream for demo
          // In production, this would be the actual Telegram live stream URL
          streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
          console.log('Using demo video for Telegram stream');
        } else if (eventData.streaming_type === 'mobile' && eventData.mux_stream_id) {
          // For mobile RTMP streams, use Mux's HLS endpoint
          streamUrl = `https://stream.mux.com/${eventData.mux_stream_id}.m3u8`;
          console.log('Using Mux HLS stream:', streamUrl);
        }

        // Fallback to event program URL if available and valid
        if (!streamUrl && eventData.program_url && 
            (eventData.program_url.includes('.m3u8') || 
             eventData.program_url.includes('.mp4') ||
             eventData.program_url.includes('stream.mux.com'))) {
          streamUrl = eventData.program_url;
          console.log('Using event program URL:', streamUrl);
        }

        // Final fallback - provide a demo stream
        if (!streamUrl) {
          streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4";
          console.log('Using fallback demo video');
        }

        return new Response(
          JSON.stringify({
            success: true,
            streamUrl: streamUrl,
            streamType: eventData.streaming_type,
            hlsUrl: streamUrl?.endsWith('.m3u8') ? streamUrl : null
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );

      case 'generateTestStream':
        // Generate a test stream for demo purposes
        const testStreamUrl = `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`;
        
        return new Response(
          JSON.stringify({
            success: true,
            streamUrl: testStreamUrl,
            streamType: 'demo',
            message: 'Test stream generated'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );

      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Error in stream-proxy function:', error);
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