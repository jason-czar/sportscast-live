import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoadingButton from "@/components/ui/LoadingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { toastService } from "@/lib/toast-service";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { useIsMobile } from "@/hooks/use-mobile";

const CreateEvent = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { handleAsyncError } = useErrorHandler();
  const { isOnline } = useOnlineStatus();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    eventName: "",
    sportType: "",
    dateTime: "",
    expectedDuration: "180",
    streamingType: ""
  });

  // Set default datetime to current time
  useEffect(() => {
    const now = new Date();
    const defaultDateTime = now.toISOString().slice(0, 16);
    setFormData(prev => ({ ...prev, dateTime: defaultDateTime }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isOnline) {
      toastService.error({
        description: 'Cannot create event while offline. Please check your connection.'
      });
      return;
    }
    
    setLoading(true);

    const { data, error } = await handleAsyncError(async () => {
      if (!session) {
        toastService.auth.sessionExpired();
        navigate('/auth');
        throw new Error('Authentication required');
      }

      // Validate required fields
      if (!formData.eventName.trim()) {
        throw new Error('Event name is required');
      }
      if (!formData.sportType) {
        throw new Error('Sport type is required');
      }
      if (!formData.dateTime) {
        throw new Error('Start date and time is required');
      }
      if (!formData.expectedDuration || parseInt(formData.expectedDuration) < 1) {
        throw new Error('Expected duration must be at least 1 minute');
      }
      if (!formData.streamingType) {
        throw new Error('Streaming type is required');
      }

      // Generate unique event code
      const eventCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Call Supabase edge function to create event with Mux stream
      const { data, error } = await supabase.functions.invoke('create-event', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          name: formData.eventName.trim(),
          sport: formData.sportType,
          startTime: formData.dateTime,
          expectedDuration: parseInt(formData.expectedDuration),
          eventCode,
          streamingType: formData.streamingType
        }
      });

      if (error) throw error;

      toastService.event.created(eventCode);
      return { eventId: data.eventId, eventCode };
    }, {
      title: "Failed to create event",
      fallbackMessage: "Unable to create event. Please check your input and try again."
    });

    if (data?.eventId) {
      navigate(`/director/${data.eventId}`);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="p-4">
        <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Create Sports Event</CardTitle>
            <CardDescription>
              Set up a new multi-camera sports streaming event
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="eventName">Event Name</Label>
                <Input
                  id="eventName"
                  value={formData.eventName}
                  onChange={(e) => setFormData({...formData, eventName: e.target.value})}
                  placeholder="Championship Soccer Match"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sportType">Sport Type</Label>
                <Select 
                  value={formData.sportType} 
                  onValueChange={(value) => setFormData({...formData, sportType: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soccer">Soccer</SelectItem>
                    <SelectItem value="basketball">Basketball</SelectItem>
                    <SelectItem value="football">Football</SelectItem>
                    <SelectItem value="baseball">Baseball</SelectItem>
                    <SelectItem value="tennis">Tennis</SelectItem>
                    <SelectItem value="volleyball">Volleyball</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <div className="space-y-2">
                  <Label htmlFor="dateTime">Start Date & Time</Label>
                  <div className={`flex gap-2 ${isMobile ? 'flex-col' : ''}`}>
                    <Input
                      id="dateTime"
                      type="datetime-local"
                      value={formData.dateTime}
                      onChange={(e) => setFormData({...formData, dateTime: e.target.value})}
                      required
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const now = new Date();
                        const year = now.getFullYear();
                        const month = String(now.getMonth() + 1).padStart(2, '0');
                        const day = String(now.getDate()).padStart(2, '0');
                        const hours = String(now.getHours()).padStart(2, '0');
                        const minutes = String(now.getMinutes()).padStart(2, '0');
                        const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
                        setFormData({...formData, dateTime: localDateTime});
                      }}
                      className={isMobile ? 'w-full' : ''}
                    >
                      Set to Now
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expectedDuration">Duration (minutes)</Label>
                  <Input
                    id="expectedDuration"
                    type="number"
                    value={formData.expectedDuration}
                    onChange={(e) => setFormData({...formData, expectedDuration: e.target.value})}
                    placeholder="180"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="streamingType">Streaming Type</Label>
                <Select 
                  value={formData.streamingType} 
                  onValueChange={(value) => setFormData({...formData, streamingType: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select streaming approach" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobile">Mobile Streaming (Direct RTMP)</SelectItem>
                    <SelectItem value="telegram">Telegram Integration</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose how you want to stream your event. Mobile streaming uses direct RTMP for professional quality, while Telegram integration leverages Telegram's infrastructure.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="text-sm font-medium text-muted-foreground">Live Streaming</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formData.streamingType === 'mobile' && 
                      'Events will use direct RTMP streaming for professional quality video transmission to YouTube and Twitch.'
                    }
                    {formData.streamingType === 'telegram' && 
                      'Events will leverage Telegram\'s social features while simultaneously streaming to YouTube and Twitch for maximum reach and engagement.'
                    }
                    {!formData.streamingType && 
                      'Select a streaming type above to see details about your streaming setup.'
                    }
                  </p>
                </div>
              </div>

              <div className={`flex gap-4 ${isMobile ? 'flex-col' : ''}`}>
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Home
                  </Link>
                </Button>
                <LoadingButton 
                  type="submit" 
                  className="flex-1"
                  loading={loading}
                  loadingText="Creating Event..."
                  disabled={!isOnline}
                >
                  {!isOnline ? 'Offline - Cannot Create Event' : 'Create Event'}
                </LoadingButton>
              </div>
            </form>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateEvent;