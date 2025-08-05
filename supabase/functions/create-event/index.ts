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
    // Get user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create Supabase client first to validate auth
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
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

    const { name, sport, startTime, expectedDuration, eventCode, streamingType } = await req.json();

    console.log('Creating event:', { name, sport, startTime, expectedDuration, eventCode, streamingType });

    if (!name || !sport || !startTime || !expectedDuration || !eventCode || !streamingType) {
      throw new Error('Missing required fields: name, sport, startTime, expectedDuration, eventCode, and streamingType are required');
    }

    let telegramChannelData = null;

    // Handle Telegram integration if selected
    if (streamingType === 'telegram') {
      console.log('Setting up Telegram channel for event...');
      
      try {
        const telegramResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            action: 'createChannel',
            eventName: name,
            eventCode
          })
        });

        if (!telegramResponse.ok) {
          const errorText = await telegramResponse.text();
          console.error('Telegram channel creation failed:', errorText);
          console.warn('Proceeding without Telegram channel - will create event with basic setup');
          // Don't fail the whole operation, just proceed without Telegram integration
        } else {
          const telegramResult = await telegramResponse.json();
          telegramChannelData = telegramResult.data;
          console.log('Telegram channel created:', telegramChannelData);
        }
      } catch (error) {
        console.error('Error setting up Telegram channel:', error);
        console.warn('Proceeding without Telegram channel - will create event with basic setup');
        // Don't fail the whole operation, just proceed without Telegram integration
      }
    }

    // Streaming keys are now stored securely in environment variables
    // and retrieved by the add-simulcast function when needed

    // Initialize Mux client
    const muxTokenId = Deno.env.get('MUX_TOKEN_ID');
    const muxSecretKey = Deno.env.get('MUX_SECRET_KEY');
    
    if (!muxTokenId || !muxSecretKey) {
      throw new Error('Mux credentials not configured');
    }

    // Create Mux Live Stream
    const auth = btoa(`${muxTokenId}:${muxSecretKey}`);
    const muxResponse = await fetch('https://api.mux.com/video/v1/live-streams', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playback_policy: ['public'],
        new_asset_settings: { 
          playback_policy: ['public'] 
        },
        reconnect_window: 60,
        reduced_latency: true
      })
    });

    if (!muxResponse.ok) {
      const error = await muxResponse.text();
      console.error('Mux API Error:', error);
      throw new Error('Failed to create Mux live stream');
    }

    const muxData = await muxResponse.json();
    console.log('Mux stream created:', muxData.data.id);

    // Insert event into database
    const { data: eventData, error: dbError } = await supabase
      .from('events')
      .insert({
        name,
        sport,
        start_time: startTime,
        expected_duration: expectedDuration,
        event_code: eventCode,
        mux_stream_id: muxData.data.id,
        program_url: streamingType === 'telegram' && telegramChannelData
          ? `https://t.me/${telegramChannelData.channelUsername}`
          : muxData.data.playback_ids[0]?.url || null,
        status: 'scheduled',
        owner_id: user.id,
        streaming_type: streamingType,
        telegram_channel_id: telegramChannelData?.channelId || null,
        telegram_invite_link: telegramChannelData?.inviteLink || null
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to create event in database');
    }

    console.log('Event created successfully:', eventData.id);

    // Send welcome notification to Telegram channel if applicable
    if (streamingType === 'telegram' && telegramChannelData) {
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            action: 'sendNotification',
            channelId: telegramChannelData.channelId,
            eventName: name,
            eventCode
          })
        });
      } catch (error) {
        console.error('Failed to send Telegram notification:', error);
        // Don't fail the event creation if notification fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        eventId: eventData.id,
        eventCode,
        streamId: muxData.data.id,
        programUrl: eventData.program_url,
        telegramChannel: telegramChannelData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in create-event function:', error);
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