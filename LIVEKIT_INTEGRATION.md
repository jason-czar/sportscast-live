# LiveKit Integration Complete Guide

This document outlines the complete LiveKit integration for multi-camera sports streaming.

## Overview

The LiveKit integration enables:
- Real-time multi-camera streaming
- Live director dashboard with camera switching
- WebRTC-based low-latency communication
- Simulcast to YouTube and Twitch
- Professional sports broadcasting workflows

## Architecture

### Components

1. **Director Dashboard** (`src/pages/DirectorDashboard.tsx`)
   - Joins LiveKit room as director
   - Views live camera feeds as thumbnails
   - Controls which camera is active in the program feed
   - Sends real-time layout updates to egress

2. **Camera Stream** (`src/components/LiveKitCameraStream.tsx`)
   - Connects cameras to LiveKit room
   - Publishes video/audio tracks
   - Provides camera controls (mute/unmute)

3. **Viewer Experience** (`src/pages/ViewerPage.tsx`)
   - Embedded YouTube/Twitch players
   - Live chat integration
   - Real-time viewer count

### Edge Functions

1. **livekit-token** (`supabase/functions/livekit-token/index.ts`)
   - Generates JWT tokens for LiveKit room access
   - Handles authentication and permissions

2. **livekit-egress** (`supabase/functions/livekit-egress/index.ts`)
   - Starts/stops streaming to external platforms
   - Updates layouts dynamically based on active camera
   - Manages simulcast to YouTube and Twitch

3. **register-camera** (`supabase/functions/register-camera/index.ts`)
   - Registers cameras in database
   - Manages camera metadata and status

### Hooks

1. **useLiveKitRoom** (`src/hooks/useLiveKitRoom.tsx`)
   - Core LiveKit room management
   - Handles connection, participants, and messaging
   - Provides video track access

2. **useRealtimePresence** (`src/hooks/useRealtimePresence.tsx`)
   - Real-time viewer counting
   - Online status tracking

3. **useRealtimeEventUpdates** (`src/hooks/useRealtimeEventUpdates.tsx`)
   - Live event status updates
   - Camera status synchronization

## Workflow

### Event Creation
1. Event creator sets up event with streaming keys
2. QR codes generated for camera operators
3. Director dashboard becomes available

### Camera Connection
1. Camera operators scan QR code or enter event code
2. Camera registers with database
3. Camera joins LiveKit room
4. Video/audio tracks published to room

### Live Direction
1. Director sees all camera feeds as thumbnails
2. Director clicks camera to make it active
3. Layout update sent via LiveKit data channel
4. Egress compositor switches to selected camera
5. Program feed updates on all platforms

### Viewer Experience
1. Viewers access event via web link
2. YouTube/Twitch embedded players show live stream
3. Live chat integration for audience engagement
4. Real-time statistics and viewer count

## Key Features

### Real-time Camera Switching
- Director can switch between cameras instantly
- Changes propagate through LiveKit data channels
- Egress layout updates in real-time
- No interruption to live stream

### Multi-platform Simulcast
- Simultaneous streaming to YouTube and Twitch
- Centralized control from director dashboard
- Single source feeds multiple destinations

### Low Latency
- WebRTC for camera feeds (~100ms)
- LiveKit's optimized infrastructure
- Regional edge servers

### Professional Controls
- Individual camera mute/unmute
- Video enable/disable
- Connection status monitoring
- Participant tracking

## Configuration

### Environment Variables
```
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_secret
LIVEKIT_WS_URL=wss://your-project.livekit.cloud
YOUTUBE_STREAM_KEY=your_youtube_key
TWITCH_STREAM_KEY=your_twitch_key
```

### Database Tables
- `events`: Event metadata and streaming configuration
- `cameras`: Camera registration and status
- `switch_logs`: Camera switching history

## Deployment

The integration is deployed automatically with the Lovable platform:
1. Edge functions deploy automatically
2. Environment variables configured in Supabase
3. Frontend builds include LiveKit client SDK

## Security

- JWT tokens for room access
- RLS policies on database tables
- Secure WebRTC connections
- API key management through Supabase secrets

## Monitoring

### Director Dashboard
- Connection status indicators
- Participant count
- Camera feed quality
- Error notifications

### Logs
- LiveKit room events
- Camera connection/disconnection
- Stream start/stop events
- Layout switching history

## Troubleshooting

### Common Issues
1. **Camera not connecting**: Check permissions and network
2. **No video in dashboard**: Verify LiveKit token generation
3. **Stream not starting**: Check streaming keys configuration
4. **Layout not switching**: Verify egress function deployment

### Debug Information
- Browser console logs for client-side issues
- Supabase function logs for backend issues
- LiveKit dashboard for room status
- Network panel for WebRTC connectivity

This integration provides a complete, professional-grade multi-camera streaming solution suitable for sports broadcasting and live events.