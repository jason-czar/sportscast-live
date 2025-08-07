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
    console.log('Start stream function called');
    const { eventId } = await req.json();
    console.log('Event ID received:', eventId);

    // Create Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get event data
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('mux_stream_id, program_url')
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

    // If program_url is not set, get the live stream details and update it
    if (!eventData.program_url) {
      console.log('Getting Mux live stream details to set program_url');
      
      // Get live stream details from Mux
      const detailsResponse = await fetch(`https://api.mux.com/video/v1/live-streams/${eventData.mux_stream_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        }
      });

      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();
        const playbackId = detailsData.data?.playback_ids?.[0]?.id;
        
        if (playbackId) {
          const programUrl = `https://stream.mux.com/${playbackId}.m3u8`;
          console.log('Updating program_url to:', programUrl);
          
          // Update the event with the program URL
          const { error: updateError } = await supabase
            .from('events')
            .update({ program_url: programUrl })
            .eq('id', eventId);

          if (updateError) {
            console.error('Failed to update program_url:', updateError);
          } else {
            console.log('Successfully updated program_url');
          }
        } else {
          console.error('No playback ID found in Mux response');
        }
      } else {
        console.error('Failed to get Mux live stream details');
      }
    }

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