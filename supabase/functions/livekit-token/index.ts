import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { eventId, participantName, participantIdentity } = await req.json()
    
    if (!eventId || !participantName || !participantIdentity) {
      throw new Error('Missing required parameters: eventId, participantName, participantIdentity')
    }

    const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY')
    const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET')

    if (!livekitApiKey || !livekitApiSecret) {
      throw new Error('Missing LiveKit configuration')
    }

    // Generate JWT for LiveKit room access
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const now = Math.floor(Date.now() / 1000)
    const exp = now + 3600 // 1 hour expiry
    
    const payload = btoa(JSON.stringify({
      iss: livekitApiKey,
      sub: participantIdentity,
      iat: now,
      exp: exp,
      name: participantName,
      video: {
        room: eventId,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        roomRecord: false,
        roomAdmin: participantIdentity.includes('director')
      }
    }))

    // Create signature
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

    const livekitUrl = Deno.env.get('LIVEKIT_WS_URL')
    if (!livekitUrl) {
      throw new Error('Missing LIVEKIT_WS_URL configuration')
    }

    console.log(`Generated JWT token for participant: ${participantName} (${participantIdentity}) in room: ${eventId}`)

    return new Response(
      JSON.stringify({
        success: true,
        token,
        wsUrl: livekitUrl,
        roomName: eventId,
        participantName,
        participantIdentity
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('LiveKit JWT generation error:', error)
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