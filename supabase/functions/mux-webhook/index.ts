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
  const { error: statusError } = await supabase
    .from('events')
    .update({ 
      status: 'live',
      started_at: new Date().toISOString()
    })
    .eq('mux_stream_id', streamData.id);

  if (statusError) {
    console.error('Error updating event status to live:', statusError);
  }

  // Also set program_url from Mux playback ID if available
  try {
    const muxTokenId = Deno.env.get('MUX_TOKEN_ID');
    const muxSecretKey = Deno.env.get('MUX_SECRET_KEY');
    if (!muxTokenId || !muxSecretKey) {
      console.warn('Mux credentials missing; cannot fetch playback URL');
      return;
    }

    const auth = btoa(`${muxTokenId}:${muxSecretKey}`);
    const muxRes = await fetch(`https://api.mux.com/video/v1/live-streams/${streamData.id}`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!muxRes.ok) {
      console.warn('Failed to fetch Mux live stream details');
      return;
    }

    const muxJson = await muxRes.json();
    const playbackId = muxJson?.data?.playback_ids?.find((p: any) => p.policy === 'public')?.id
      || muxJson?.data?.playback_ids?.[0]?.id;

    if (playbackId) {
      const playbackUrl = `https://stream.mux.com/${playbackId}.m3u8`;
      const { error: urlError } = await supabase
        .from('events')
        .update({ program_url: playbackUrl, updated_at: new Date().toISOString() })
        .eq('mux_stream_id', streamData.id);

      if (urlError) {
        console.error('Error updating program_url:', urlError);
      } else {
        console.log('program_url set from Mux playback ID');
      }
    }
  } catch (e) {
    console.error('Error fetching/setting Mux playback URL:', e);
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

  // Fetch asset details to get playback ID
  try {
    const muxTokenId = Deno.env.get('MUX_TOKEN_ID');
    const muxSecretKey = Deno.env.get('MUX_SECRET_KEY');
    let recordingUrl: string | null = null;
    if (muxTokenId && muxSecretKey) {
      const auth = btoa(`${muxTokenId}:${muxSecretKey}`);
      const assetRes = await fetch(`https://api.mux.com/video/v1/assets/${assetData.id}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });
      if (assetRes.ok) {
        const assetJson = await assetRes.json();
        const assetPlaybackId = assetJson?.data?.playback_ids?.find((p: any) => p.policy === 'public')?.id
          || assetJson?.data?.playback_ids?.[0]?.id;
        if (assetPlaybackId) {
          recordingUrl = `https://stream.mux.com/${assetPlaybackId}.m3u8`;
        }
      }
    } else {
      console.warn('Mux credentials missing; cannot fetch asset playback URL');
    }

    // Update event with completed asset information
    const { error } = await supabase
      .from('events')
      .update({ 
        status: 'ended',
        recording_url: recordingUrl,
        ended_at: new Date().toISOString()
      })
      .eq('mux_stream_id', assetData.live_stream_id);
  
    if (error) {
      console.error('Error updating event with completed asset:', error);
    }
  } catch (e) {
    console.error('Error fetching asset details:', e);
  }
}