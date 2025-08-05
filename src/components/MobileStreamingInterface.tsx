import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRTMPStreaming } from '@/hooks/useRTMPStreaming';
import { useMuxWebhooks } from '@/hooks/useMuxWebhooks';
import { Loader2, Camera, Mic, MicOff, Video, VideoOff, RotateCcw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

interface MobileStreamingInterfaceProps {
  eventId?: string;
  eventCode?: string;
  onStreamStarted?: (streamInfo: any) => void;
  onStreamStopped?: () => void;
}

export const MobileStreamingInterface = ({ 
  eventId, 
  eventCode, 
  onStreamStarted, 
  onStreamStopped 
}: MobileStreamingInterfaceProps) => {
  const [deviceLabel, setDeviceLabel] = useState('');
  const [eventCodeInput, setEventCodeInput] = useState(eventCode || '');
  const [eventIdInput, setEventIdInput] = useState(eventId || '');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);

  const {
    isStreaming,
    isInitialized,
    isConnecting,
    error,
    streamKey,
    ingestUrl,
    cameraId,
    isNative,
    registerCamera,
    initializeStreaming,
    startStreaming,
    stopStreaming,
    switchCamera,
    toggleAudio,
    toggleVideo,
    getStreamingStats,
    muxRTMPUrl,
  } = useRTMPStreaming();

  const { streamStatus } = useMuxWebhooks(eventIdInput);

  // Auto-fill device label with a default value
  useEffect(() => {
    if (!deviceLabel) {
      const defaultLabel = isNative ? 'Mobile Camera' : 'Web Camera';
      const timestamp = new Date().toLocaleTimeString();
      setDeviceLabel(`${defaultLabel} - ${timestamp}`);
    }
  }, [deviceLabel, isNative]);

  const handleRegisterCamera = async () => {
    if (!eventIdInput || !eventCodeInput || !deviceLabel.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const result = await registerCamera({
        eventId: eventIdInput,
        eventCode: eventCodeInput,
        deviceLabel: deviceLabel.trim(),
      });

      setIsRegistered(true);
      toast.success('Camera registered successfully!');
      
      // Initialize streaming capabilities
      await initializeStreaming({
        rtmpUrl: muxRTMPUrl,
        streamKey: result.streamKey,
        videoBitrate: 2500000, // 2.5 Mbps
        audioBitrate: 128000,  // 128 kbps
        latencyMode: 'low',
      });

    } catch (error) {
      console.error('Failed to register camera:', error);
      toast.error('Failed to register camera. Please check your details.');
    }
  };

  const handleStartStreaming = async () => {
    try {
      const stream = await startStreaming();
      onStreamStarted?.({ streamKey, ingestUrl, cameraId, stream });
      toast.success('Live stream started!');
    } catch (error) {
      console.error('Failed to start streaming:', error);
      toast.error('Failed to start streaming');
    }
  };

  const handleStopStreaming = async () => {
    try {
      await stopStreaming();
      onStreamStopped?.();
      toast.success('Stream stopped');
    } catch (error) {
      console.error('Failed to stop streaming:', error);
      toast.error('Failed to stop streaming');
    }
  };

  const handleToggleAudio = async () => {
    const newState = !audioEnabled;
    await toggleAudio(newState);
    setAudioEnabled(newState);
    toast.success(`Audio ${newState ? 'enabled' : 'disabled'}`);
  };

  const handleToggleVideo = async () => {
    const newState = !videoEnabled;
    await toggleVideo(newState);
    setVideoEnabled(newState);
    toast.success(`Video ${newState ? 'enabled' : 'disabled'}`);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mobile RTMP Streaming
            <Badge variant={isNative ? "default" : "secondary"}>
              {isNative ? "Native App" : "Web Browser"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isRegistered && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="eventId">Event ID</Label>
                  <Input
                    id="eventId"
                    value={eventIdInput}
                    onChange={(e) => setEventIdInput(e.target.value)}
                    placeholder="Enter event ID"
                    disabled={!!eventId}
                  />
                </div>
                <div>
                  <Label htmlFor="eventCode">Event Code</Label>
                  <Input
                    id="eventCode"
                    value={eventCodeInput}
                    onChange={(e) => setEventCodeInput(e.target.value.toUpperCase())}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    disabled={!!eventCode}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="deviceLabel">Camera Name</Label>
                <Input
                  id="deviceLabel"
                  value={deviceLabel}
                  onChange={(e) => setDeviceLabel(e.target.value)}
                  placeholder="Give your camera a name"
                />
              </div>

              <Button 
                onClick={handleRegisterCamera}
                disabled={isConnecting || !eventIdInput || !eventCodeInput || !deviceLabel.trim()}
                className="w-full"
              >
                {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Register Camera
              </Button>
            </div>
          )}

          {isRegistered && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm font-medium mb-2">Stream Configuration</div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>Camera ID: {cameraId}</div>
                  <div>RTMP URL: {muxRTMPUrl}</div>
                  <div>Stream Key: {streamKey?.substring(0, 20)}...</div>
                  {streamStatus && (
                    <div>Status: <Badge variant="outline">{streamStatus.status}</Badge></div>
                  )}
                </div>
              </div>

              {!isStreaming ? (
                <Button 
                  onClick={handleStartStreaming}
                  disabled={!isInitialized}
                  className="w-full"
                  size="lg"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Start Live Stream
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700 font-medium">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      LIVE STREAMING
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={handleToggleAudio}
                      className="flex-1"
                    >
                      {audioEnabled ? (
                        <Mic className="mr-2 h-4 w-4" />
                      ) : (
                        <MicOff className="mr-2 h-4 w-4" />
                      )}
                      {audioEnabled ? 'Mute' : 'Unmute'}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleToggleVideo}
                      className="flex-1"
                    >
                      {videoEnabled ? (
                        <Video className="mr-2 h-4 w-4" />
                      ) : (
                        <VideoOff className="mr-2 h-4 w-4" />
                      )}
                      {videoEnabled ? 'Hide' : 'Show'}
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    onClick={switchCamera}
                    className="w-full"
                    disabled={!isNative}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Switch Camera
                  </Button>

                  <Button 
                    onClick={handleStopStreaming}
                    variant="destructive"
                    className="w-full"
                  >
                    Stop Stream
                  </Button>
                </div>
              )}

              {isNative && (
                <div className="text-xs text-muted-foreground">
                  <p>📱 Native app detected - using device camera capabilities</p>
                  <p>🔄 Stream is sent directly to Mux via RTMP</p>
                  <p>⚡ Low latency mode enabled (5-15s glass-to-glass)</p>
                </div>
              )}

              {!isNative && (
                <div className="text-xs text-muted-foreground">
                  <p>🌐 Web browser detected - using WebRTC bridge</p>
                  <p>📡 Stream is converted to RTMP via WebRTC bridge</p>
                  <p>⚡ Low latency mode enabled</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};