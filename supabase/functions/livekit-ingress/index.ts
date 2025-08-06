import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { eventId, deviceLabel } = await req.json()
    
    if (!eventId || !deviceLabel) {
      throw new Error('Missing eventId or deviceLabel')
    }

    const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY')
    const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET')
    const livekitUrl = Deno.env.get('LIVEKIT_WS_URL')

    if (!livekitApiKey || !livekitApiSecret || !livekitUrl) {
      throw new Error('Missing LiveKit configuration')
    }

    // Generate JWT for LiveKit API
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const now = Math.floor(Date.now() / 1000)
    const payload = btoa(JSON.stringify({
      iss: livekitApiKey,
      sub: livekitApiKey,
      iat: now,
      exp: now + 3600,
      video: {
        room: eventId,
        roomCreate: true,
        canPublish: true,
        canSubscribe: true
      }
    }))

    const signature = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(livekitApiSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      signature,
      new TextEncoder().encode(`${header}.${payload}`)
    )

    const token = `${header}.${payload}.${btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))}`

    // Create WHIP ingress
    const ingressResponse = await fetch(`${livekitUrl.replace('wss://', 'https://')}/ingress`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input_type: 'WHIP_INPUT',
        room_name: eventId,
        participant_identity: `camera_${deviceLabel.toLowerCase().replace(/\s+/g, '_')}`,
        name: `Camera ${deviceLabel}`
      })
    })

    if (!ingressResponse.ok) {
      const errorText = await ingressResponse.text()
      console.error('LiveKit ingress creation failed:', errorText)
      throw new Error(`Failed to create LiveKit ingress: ${errorText}`)
    }

    const ingressData = await ingressResponse.json()
    console.log('LiveKit ingress created:', ingressData)

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Update camera record with LiveKit details
    const { error: updateError } = await supabase
      .from('cameras')
      .update({
        stream_key: ingressData.stream_key || ingressData.ingress_id,
        stream_url: ingressData.url,
        is_live: true
      })
      .eq('event_id', eventId)
      .eq('device_label', deviceLabel)

    if (updateError) {
      console.error('Database update error:', updateError)
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        ingestUrl: ingressData.url,
        streamKey: ingressData.stream_key || ingressData.ingress_id,
        ingressId: ingressData.ingress_id,
        participantIdentity: `camera_${deviceLabel.toLowerCase().replace(/\s+/g, '_')}`
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('LiveKit ingress error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})