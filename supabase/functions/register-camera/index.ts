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
    const { eventId, deviceLabel, eventCode } = await req.json();

    // Create Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify event exists and get Mux stream ID
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('mux_stream_id, event_code')
      .eq('id', eventId)
      .eq('event_code', eventCode)
      .single();

    if (eventError || !eventData) {
      throw new Error('Invalid event or event code');
    }

    // Generate unique stream key for this camera
    const streamKeySuffix = Math.random().toString(36).substring(2, 8);
    const streamKey = `${eventData.mux_stream_id}-${streamKeySuffix}`;

    // Register camera in database
    const { data: cameraData, error: cameraError } = await supabase
      .from('cameras')
      .insert({
        event_id: eventId,
        device_label: deviceLabel,
        stream_key: streamKey,
        is_live: true, // Mark as live immediately when registering
        is_active: false,
        stream_url: null
      })
      .select()
      .single();

    if (cameraError) {
      console.error('Database error:', cameraError);
      throw new Error('Failed to register camera');
    }

    // Construct RTMP ingest URL
    const ingestUrl = `rtmp://global-live.mux.com/live/${streamKey}`;

    console.log('Camera registered successfully:', cameraData.id);

    return new Response(
      JSON.stringify({
        success: true,
        cameraId: cameraData.id,
        streamKey,
        ingestUrl,
        message: 'Camera registered successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in register-camera function:', error);
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