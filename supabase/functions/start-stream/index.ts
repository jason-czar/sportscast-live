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
    const { eventId } = await req.json();

    // Create Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get event data
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('mux_stream_id')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      throw new Error('Event not found');
    }

    // Initialize Mux client
    const muxTokenId = Deno.env.get('MUX_TOKEN_ID');
    const muxSecretKey = Deno.env.get('MUX_SECRET_KEY');
    
    if (!muxTokenId || !muxSecretKey) {
      throw new Error('Mux credentials not configured');
    }

    // Start Mux Live Stream
    const auth = btoa(`${muxTokenId}:${muxSecretKey}`);
    const muxResponse = await fetch(`https://api.mux.com/video/v1/live-streams/${eventData.mux_stream_id}/enable`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      }
    });

    if (!muxResponse.ok) {
      const error = await muxResponse.text();
      console.error('Mux API Error:', error);
      throw new Error('Failed to start Mux live stream');
    }

    console.log('Mux stream started for event:', eventId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Stream started successfully',
        eventId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in start-stream function:', error);
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