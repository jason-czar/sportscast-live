import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// WebRTC to RTMP bridge service
// This service handles WebRTC streams from browsers and converts them to RTMP
class WebRTCRTMPBridge {
  private sessions = new Map<string, any>();

  async createSession(rtmpUrl: string, streamKey: string): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('Creating WebRTC-RTMP bridge session:', sessionId);
    
    // In a real implementation, this would:
    // 1. Set up FFmpeg process with RTMP output
    // 2. Create WebRTC peer connection with incoming video/audio
    // 3. Pipe WebRTC stream to FFmpeg RTMP output
    
    const session = {
      id: sessionId,
      rtmpUrl: rtmpUrl,
      streamKey: streamKey,
      fullRtmpUrl: `${rtmpUrl}/${streamKey}`,
      status: 'created',
      createdAt: new Date().toISOString(),
      // In real implementation, store FFmpeg process and WebRTC connection
      ffmpegProcess: null,
      webrtcConnection: null
    };

    this.sessions.set(sessionId, session);
    
    console.log('Bridge session created:', session);
    return sessionId;
  }

  async startStreaming(sessionId: string, sdpOffer: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    console.log('Starting WebRTC-RTMP streaming for session:', sessionId);

    // In a real implementation, this would:
    // 1. Create WebRTC answer with proper codecs (H.264, AAC)
    // 2. Start FFmpeg process with RTMP output
    // 3. Connect WebRTC stream to FFmpeg input
    
    // Mock SDP answer for demonstration
    const sdpAnswer = `v=0
o=- ${Date.now()} 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0 1
a=extmap-allow-mixed
a=msid-semantic: WMS
m=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 102 121 127 120 125 107 108 109 124 119 123 118 114 115 116
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:mock
a=ice-pwd:mockpassword
a=ice-options:trickle
a=fingerprint:sha-256 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF
a=setup:active
a=mid:0
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid
a=extmap:5 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
a=extmap:6 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
a=sendrecv
a=msid:- mock-video-track
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:96 VP8/90000
a=rtcp-fb:96 goog-remb
a=rtcp-fb:96 transport-cc
a=rtcp-fb:96 ccm fir
a=rtcp-fb:96 nack
a=rtcp-fb:96 nack pli
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=96
a=rtpmap:98 VP9/90000
a=rtcp-fb:98 goog-remb
a=rtcp-fb:98 transport-cc
a=rtcp-fb:98 ccm fir
a=rtcp-fb:98 nack
a=rtcp-fb:98 nack pli
a=fmtp:98 profile-id=0
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=98
a=rtpmap:100 H264/90000
a=rtcp-fb:100 goog-remb
a=rtcp-fb:100 transport-cc
a=rtcp-fb:100 ccm fir
a=rtcp-fb:100 nack
a=rtcp-fb:100 nack pli
a=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f
a=rtpmap:101 rtx/90000
a=fmtp:101 apt=100
a=ssrc-group:FID 1234567890 1234567891
a=ssrc:1234567890 cname:mock-cname
a=ssrc:1234567890 msid:- mock-video-track
a=ssrc:1234567890 mslabel:-
a=ssrc:1234567890 label:mock-video-track
a=ssrc:1234567891 cname:mock-cname
a=ssrc:1234567891 msid:- mock-video-track
a=ssrc:1234567891 mslabel:-
a=ssrc:1234567891 label:mock-video-track
m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:mock
a=ice-pwd:mockpassword
a=ice-options:trickle
a=fingerprint:sha-256 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF
a=setup:active
a=mid:1
a=extmap:14 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid
a=extmap:5 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
a=extmap:6 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
a=sendrecv
a=msid:- mock-audio-track
a=rtcp-mux
a=rtpmap:111 opus/48000/2
a=rtcp-fb:111 transport-cc
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:103 ISAC/16000
a=rtpmap:104 ISAC/32000
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:106 CN/32000
a=rtpmap:105 CN/16000
a=rtpmap:13 CN/8000
a=rtpmap:110 telephone-event/48000
a=rtpmap:112 telephone-event/32000
a=rtpmap:113 telephone-event/16000
a=rtpmap:126 telephone-event/8000
a=ssrc:1234567892 cname:mock-cname
a=ssrc:1234567892 msid:- mock-audio-track
a=ssrc:1234567892 mslabel:-
a=ssrc:1234567892 label:mock-audio-track`;

    session.status = 'streaming';
    session.startedAt = new Date().toISOString();
    session.sdpAnswer = sdpAnswer;

    console.log('WebRTC-RTMP bridge streaming started');
    return sdpAnswer;
  }

  async stopStreaming(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    console.log('Stopping WebRTC-RTMP streaming for session:', sessionId);

    // In real implementation, this would:
    // 1. Close WebRTC peer connection
    // 2. Stop FFmpeg process
    // 3. Clean up resources

    session.status = 'stopped';
    session.stoppedAt = new Date().toISOString();

    console.log('WebRTC-RTMP bridge streaming stopped');
  }

  getSession(sessionId: string): any {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): any[] {
    return Array.from(this.sessions.values());
  }
}

// Global bridge instance
const webrtcBridge = new WebRTCRTMPBridge();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('WebRTC-RTMP bridge service called');
    const requestBody = await req.json();
    console.log('Bridge request body:', JSON.stringify(requestBody));
    
    const { action, sessionId, rtmpUrl, streamKey, sdpOffer } = requestBody;

    let result;

    switch (action) {
      case 'createSession':
        if (!rtmpUrl || !streamKey) {
          throw new Error('rtmpUrl and streamKey are required');
        }
        
        const newSessionId = await webrtcBridge.createSession(rtmpUrl, streamKey);
        result = {
          success: true,
          sessionId: newSessionId,
          message: 'WebRTC-RTMP bridge session created'
        };
        break;

      case 'startStreaming':
        if (!sessionId || !sdpOffer) {
          throw new Error('sessionId and sdpOffer are required');
        }
        
        const sdpAnswer = await webrtcBridge.startStreaming(sessionId, sdpOffer);
        result = {
          success: true,
          sdpAnswer: sdpAnswer,
          message: 'WebRTC-RTMP streaming started'
        };
        break;

      case 'stopStreaming':
        if (!sessionId) {
          throw new Error('sessionId is required');
        }
        
        await webrtcBridge.stopStreaming(sessionId);
        result = {
          success: true,
          message: 'WebRTC-RTMP streaming stopped'
        };
        break;

      case 'getSession':
        if (!sessionId) {
          throw new Error('sessionId is required');
        }
        
        const session = webrtcBridge.getSession(sessionId);
        if (!session) {
          throw new Error('Session not found');
        }
        
        result = {
          success: true,
          session: session
        };
        break;

      case 'getAllSessions':
        const sessions = webrtcBridge.getAllSessions();
        result = {
          success: true,
          sessions: sessions
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log('Bridge service result:', result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in WebRTC-RTMP bridge service:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});