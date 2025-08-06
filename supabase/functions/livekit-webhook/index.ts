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
    const webhookEvent = await req.json();
    console.log('LiveKit webhook received:', {
      event: webhookEvent.event,
      room: webhookEvent.room?.name,
      participant: webhookEvent.participant?.identity,
      egress: webhookEvent.egress?.egress_id,
      timestamp: new Date().toISOString()
    });

    // Create Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different webhook events
    switch (webhookEvent.event) {
      case 'room_started':
        await handleRoomStarted(supabase, webhookEvent);
        break;
        
      case 'room_finished':
        await handleRoomFinished(supabase, webhookEvent);
        break;
        
      case 'participant_joined':
        await handleParticipantJoined(supabase, webhookEvent);
        break;
        
      case 'participant_left':
        await handleParticipantLeft(supabase, webhookEvent);
        break;
        
      case 'egress_started':
        await handleEgressStarted(supabase, webhookEvent);
        break;
        
      case 'egress_ended':
        await handleEgressEnded(supabase, webhookEvent);
        break;
        
      case 'track_published':
        await handleTrackPublished(supabase, webhookEvent);
        break;
        
      case 'track_unpublished':
        await handleTrackUnpublished(supabase, webhookEvent);
        break;
        
      default:
        console.log('Unhandled webhook event:', webhookEvent.event);
    }

    return new Response(
      JSON.stringify({ success: true, event: webhookEvent.event }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
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

async function handleRoomStarted(supabase: any, event: any) {
  console.log('Room started:', event.room.name);
  
  // Extract event ID from room name (assuming format like "event_<eventId>")
  const eventId = event.room.name.replace('event_', '');
  
  // Update event status
  await supabase
    .from('events')
    .update({ 
      status: 'live',
      updated_at: new Date().toISOString()
    })
    .eq('id', eventId);
}

async function handleRoomFinished(supabase: any, event: any) {
  console.log('Room finished:', event.room.name);
  
  const eventId = event.room.name.replace('event_', '');
  
  // Update event status and clean up
  await supabase
    .from('events')
    .update({ 
      status: 'ended',
      updated_at: new Date().toISOString()
    })
    .eq('id', eventId);
    
  // Mark all cameras as inactive
  await supabase
    .from('cameras')
    .update({ 
      is_live: false,
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('event_id', eventId);
}

async function handleParticipantJoined(supabase: any, event: any) {
  console.log('Participant joined:', event.participant.identity);
  
  const identity = event.participant.identity;
  const eventId = event.room.name.replace('event_', '');
  
  // If it's a camera participant, update camera status
  if (identity.startsWith('camera_')) {
    const deviceLabel = identity.replace('camera_', '').replace(/_/g, ' ');
    
    await supabase
      .from('cameras')
      .update({ 
        is_live: true,
        updated_at: new Date().toISOString()
      })
      .eq('event_id', eventId)
      .ilike('device_label', `%${deviceLabel}%`);
  }
}

async function handleParticipantLeft(supabase: any, event: any) {
  console.log('Participant left:', event.participant.identity);
  
  const identity = event.participant.identity;
  const eventId = event.room.name.replace('event_', '');
  
  // If it's a camera participant, update camera status
  if (identity.startsWith('camera_')) {
    const deviceLabel = identity.replace('camera_', '').replace(/_/g, ' ');
    
    await supabase
      .from('cameras')
      .update({ 
        is_live: false,
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('event_id', eventId)
      .ilike('device_label', `%${deviceLabel}%`);
  }
}

async function handleEgressStarted(supabase: any, event: any) {
  console.log('Egress started:', event.egress.egress_id);
  
  const eventId = event.room.name.replace('event_', '');
  
  // Update event with egress info
  await supabase
    .from('events')
    .update({ 
      status: 'live',
      updated_at: new Date().toISOString()
    })
    .eq('id', eventId);
}

async function handleEgressEnded(supabase: any, event: any) {
  console.log('Egress ended:', event.egress.egress_id);
  
  const eventId = event.room.name.replace('event_', '');
  
  // Update event status
  await supabase
    .from('events')
    .update({ 
      status: 'ended',
      updated_at: new Date().toISOString()
    })
    .eq('id', eventId);
}

async function handleTrackPublished(supabase: any, event: any) {
  console.log('Track published:', {
    participant: event.participant.identity,
    track: event.track.type
  });
  
  // Update camera stream status when video track is published
  if (event.track.type === 'video' && event.participant.identity.startsWith('camera_')) {
    const eventId = event.room.name.replace('event_', '');
    const deviceLabel = event.participant.identity.replace('camera_', '').replace(/_/g, ' ');
    
    await supabase
      .from('cameras')
      .update({ 
        is_live: true,
        updated_at: new Date().toISOString()
      })
      .eq('event_id', eventId)
      .ilike('device_label', `%${deviceLabel}%`);
  }
}

async function handleTrackUnpublished(supabase: any, event: any) {
  console.log('Track unpublished:', {
    participant: event.participant.identity,
    track: event.track.type
  });
  
  // Update camera stream status when video track is unpublished
  if (event.track.type === 'video' && event.participant.identity.startsWith('camera_')) {
    const eventId = event.room.name.replace('event_', '');
    const deviceLabel = event.participant.identity.replace('camera_', '').replace(/_/g, ' ');
    
    await supabase
      .from('cameras')
      .update({ 
        is_live: false,
        updated_at: new Date().toISOString()
      })
      .eq('event_id', eventId)
      .ilike('device_label', `%${deviceLabel}%`);
  }
}