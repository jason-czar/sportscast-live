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
    const { action, cameraId, eventId } = await req.json();
    console.log('Camera status function called:', action, 'cameraId:', cameraId);

    // Create Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    switch (action) {
      case 'heartbeat':
        // Update camera as live and timestamp
        const { error: heartbeatError } = await supabase
          .from('cameras')
          .update({ 
            is_live: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', cameraId);

        if (heartbeatError) {
          console.error('Heartbeat error:', heartbeatError);
          throw new Error('Failed to update camera heartbeat');
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Heartbeat updated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'disconnect':
        // Mark camera as offline
        const { error: disconnectError } = await supabase
          .from('cameras')
          .update({ 
            is_live: false,
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', cameraId);

        if (disconnectError) {
          console.error('Disconnect error:', disconnectError);
          throw new Error('Failed to mark camera as offline');
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Camera marked as offline' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'cleanup-stale':
        // Clean up cameras that haven't sent heartbeat in 2 minutes
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        
        const { error: cleanupError } = await supabase
          .from('cameras')
          .update({ is_live: false, is_active: false })
          .eq('event_id', eventId)
          .lt('updated_at', twoMinutesAgo)
          .eq('is_live', true);

        if (cleanupError) {
          console.error('Cleanup error:', cleanupError);
          throw new Error('Failed to cleanup stale cameras');
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Stale cameras cleaned up' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Error in camera-status function:', error);
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