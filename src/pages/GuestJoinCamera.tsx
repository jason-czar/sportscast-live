import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Users, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const JoinAsCamera = () => {
  const [eventCode, setEventCode] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Guest camera joining - no authentication required
  const handleJoinAsCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventCode.trim() || !deviceLabel.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both event code and camera name.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      console.log('🎥 Joining as guest camera:', { eventCode, deviceLabel });

      // Find event by code (guest access)
      const { data: events, error: eventError } = await supabase
        .from('events')
        .select('id, name, sport, status, streaming_type')
        .eq('event_code', eventCode.toUpperCase())
        .single();

      if (eventError || !events) {
        console.error('Event lookup failed:', eventError);
        throw new Error('Event not found. Please check your event code.');
      }

      if (events.status !== 'scheduled' && events.status !== 'live') {
        throw new Error('This event is not currently active.');
      }

      console.log('✅ Event found:', events.name);

      // Determine which camera streaming page to use based on streaming type
      if (events.streaming_type === 'telegram') {
        // Navigate to Telegram camera stream page
        navigate(`/camera/telegram/${events.id}`, {
          state: {
            eventData: events,
            deviceLabel: deviceLabel.trim(),
            isGuest: true // Flag to indicate guest access
          }
        });
      } else {
        // Navigate to regular camera stream page for RTMP/other streaming
        navigate(`/camera-stream/${events.id}`, {
          state: {
            eventData: events,
            deviceLabel: deviceLabel.trim(),
            isGuest: true
          }
        });
      }

      toast({
        title: "Joining Event",
        description: `Connecting to ${events.name}...`,
      });

    } catch (error) {
      console.error('Error joining as camera:', error);
      toast({
        title: "Failed to Join",
        description: error instanceof Error ? error.message : 'Unable to join event. Please try again.',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <form onSubmit={handleJoinAsCamera} className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Camera className="w-12 h-12 text-primary" />
            </div>
            <CardTitle>Join as Camera</CardTitle>
            <CardDescription>
              Join an event as a camera operator. No account required - just enter the event code and camera name to get started.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Guest Access:</strong> You can join as a camera without creating an account. Your stream will be available immediately.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="eventCode">Event Code</Label>
              <Input
                id="eventCode"
                type="text"
                placeholder="Enter 6-character event code"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                className="uppercase tracking-wider text-center font-mono"
                maxLength={6}
                required
              />
              <p className="text-xs text-muted-foreground">
                Ask the event organizer for the 6-character event code
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deviceLabel">Camera Name</Label>
              <Input
                id="deviceLabel"
                type="text"
                placeholder="e.g., Main Camera, Sideline Cam"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Choose a name to identify your camera in the stream
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading || !eventCode.trim() || !deviceLabel.trim()}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Join as Camera
                </>
              )}
            </Button>
            
            <div className="text-center text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="w-4 h-4" />
                <span>Guest Access Enabled</span>
              </div>
              <p>No registration required. Just enter the event code and camera name to start streaming.</p>
            </div>

            <div className="text-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Event organizer? <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/auth')}>Sign in here</Button>
              </p>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default JoinAsCamera;