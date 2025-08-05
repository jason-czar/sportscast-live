import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mux-signature',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookBody = await req.text();
    const signature = req.headers.get('mux-signature');
    
    console.log('Received Mux webhook:', {
      signature,
      bodyLength: webhookBody.length
    });

    // TODO: Verify webhook signature using Mux webhook secret
    // const isValidSignature = verifyMuxSignature(webhookBody, signature);
    // if (!isValidSignature) {
    //   return new Response('Invalid signature', { status: 401 });
    // }

    const webhookData = JSON.parse(webhookBody);
    console.log('Mux webhook event:', webhookData.type, webhookData.data?.id);

    // Create Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Process different webhook events
    switch (webhookData.type) {
      case 'video.live_stream.active':
        await handleStreamActive(supabase, webhookData.data);
        break;
      
      case 'video.live_stream.idle':
        await handleStreamIdle(supabase, webhookData.data);
        break;
      
      case 'video.live_stream.recording':
        await handleStreamRecording(supabase, webhookData.data);
        break;
      
      case 'video.asset.live_stream_completed':
        await handleStreamCompleted(supabase, webhookData.data);
        break;
      
      default:
        console.log('Unhandled webhook type:', webhookData.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing Mux webhook:', error);
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

async function handleStreamActive(supabase: any, streamData: any) {
  console.log('Stream went active:', streamData.id);
  
  // Update event status to live
  const { error } = await supabase
    .from('events')
    .update({ 
      status: 'live',
      started_at: new Date().toISOString()
    })
    .eq('mux_stream_id', streamData.id);

  if (error) {
    console.error('Error updating event status to live:', error);
  }
}

async function handleStreamIdle(supabase: any, streamData: any) {
  console.log('Stream went idle:', streamData.id);
  
  // Update event status back to scheduled if it was live
  const { error } = await supabase
    .from('events')
    .update({ 
      status: 'scheduled',
      ended_at: new Date().toISOString()
    })
    .eq('mux_stream_id', streamData.id);

  if (error) {
    console.error('Error updating event status to idle:', error);
  }
}

async function handleStreamRecording(supabase: any, streamData: any) {
  console.log('Stream recording started:', streamData.id);
  
  // Update event status to recording
  const { error } = await supabase
    .from('events')
    .update({ status: 'recording' })
    .eq('mux_stream_id', streamData.id);

  if (error) {
    console.error('Error updating event status to recording:', error);
  }
}

async function handleStreamCompleted(supabase: any, assetData: any) {
  console.log('Stream completed, asset ready:', assetData.id);
  
  // Update event with completed asset information
  const { error } = await supabase
    .from('events')
    .update({ 
      status: 'ended',
      recording_url: assetData.playback_ids?.[0]?.url,
      ended_at: new Date().toISOString()
    })
    .eq('mux_stream_id', assetData.live_stream_id);

  if (error) {
    console.error('Error updating event with completed asset:', error);
  }
}