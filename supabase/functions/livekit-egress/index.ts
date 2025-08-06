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
    const { eventId, action, activeCamera } = await req.json()
    
    if (!eventId) {
      throw new Error('Missing eventId')
    }

    const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY')
    const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET')
    const livekitUrl = Deno.env.get('LIVEKIT_WS_URL')
    const youtubeKey = Deno.env.get('YOUTUBE_STREAM_KEY')
    const twitchKey = Deno.env.get('TWITCH_STREAM_KEY')

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

    if (action === 'start') {
      // Start egress stream
      const streamOutputs = []
      
      if (youtubeKey) {
        streamOutputs.push({
          urls: [`rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`]
        })
      }
      
      if (twitchKey) {
        streamOutputs.push({
          urls: [`rtmp://live.twitch.tv/app/${twitchKey}`]
        })
      }

      if (streamOutputs.length === 0) {
        throw new Error('No stream keys configured for YouTube or Twitch')
      }

      const egressResponse = await fetch(`${livekitUrl.replace('wss://', 'https://')}/egress/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room_name: eventId,
          layout: 'single-speaker',
          stream_outputs: streamOutputs,
          layout_options: {
            logo_text: '',
            background_color: '#000000'
          }
        })
      })

      if (!egressResponse.ok) {
        const errorText = await egressResponse.text()
        console.error('LiveKit egress start failed:', errorText)
        throw new Error(`Failed to start LiveKit egress: ${errorText}`)
      }

      const egressData = await egressResponse.json()
      console.log('LiveKit egress started:', egressData)

      // Update event status
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const { error: updateError } = await supabase
        .from('events')
        .update({ 
          status: 'live',
          mux_stream_id: egressData.egress_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId)

      if (updateError) {
        console.error('Database update error:', updateError)
        throw new Error(`Database update failed: ${updateError.message}`)
      }

      return new Response(
        JSON.stringify({
          success: true,
          egressId: egressData.egress_id,
          status: 'started'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )

    } else if (action === 'update_layout') {
      // Update egress layout in real-time
      if (!activeCamera) {
        throw new Error('Missing activeCamera for layout update')
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Get current event to find egress ID
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('mux_stream_id')
        .eq('id', eventId)
        .single()

      if (eventError || !event?.mux_stream_id) {
        console.log('No active egress found for layout update')
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No active egress to update'
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        )
      }

      // Update layout via LiveKit API
      const layoutResponse = await fetch(`${livekitUrl.replace('wss://', 'https://')}/egress/layout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          egress_id: event.mux_stream_id,
          layout: 'single-speaker',
          layout_options: {
            active_speaker_identity: activeCamera
          }
        })
      })

      if (!layoutResponse.ok) {
        const errorText = await layoutResponse.text()
        console.error('LiveKit layout update failed:', errorText)
        // Don't throw - layout updates can be best effort
      }

      console.log('Layout updated for camera:', activeCamera)

      return new Response(
        JSON.stringify({
          success: true,
          activeCamera,
          status: 'layout_updated'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )

    } else if (action === 'stop') {
      // Stop egress - we'll need the egress ID from the database or event
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Update event status to ended
      const { error: updateError } = await supabase
        .from('events')
        .update({ 
          status: 'ended',
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId)

      if (updateError) {
        console.error('Database update error:', updateError)
        throw new Error(`Database update failed: ${updateError.message}`)
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: 'stopped'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    throw new Error('Invalid action. Use "start", "stop", or "update_layout"')

  } catch (error) {
    console.error('LiveKit egress error:', error)
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