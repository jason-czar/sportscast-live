import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoadingButton from "@/components/ui/LoadingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  const {
    session
  } = useAuth();
  const {
    handleAsyncError
  } = useErrorHandler();
  const {
    isOnline
  } = useOnlineStatus();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    eventName: "",
    sportType: "",
    dateTime: "",
    expectedDuration: "180",
    description: "",
    thumbnail: null as File | null
  });
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  // Set default datetime to current local time
  useEffect(() => {
    const now = new Date();
    // Create datetime-local string in user's local timezone
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    setFormData(prev => ({
      ...prev,
      dateTime: localDateTime
    }));
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
    const {
      data,
      error
    } = await handleAsyncError(async () => {
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

      // Generate unique event code
      const eventCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Call Supabase edge function to create event with Mux stream
      const {
        data,
        error
      } = await supabase.functions.invoke('create-event', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          name: formData.eventName.trim(),
          sport: formData.sportType,
          startTime: formData.dateTime,
          expectedDuration: parseInt(formData.expectedDuration),
          eventCode,
          streamingType: 'livekit', // Always use LiveKit now
          description: formData.description.trim() || undefined,
          thumbnail: formData.thumbnail
        }
      });
      if (error) throw error;
      toastService.event.created(eventCode);
      return {
        eventId: data.eventId,
        eventCode
      };
    }, {
      title: "Failed to create event",
      fallbackMessage: "Unable to create event. Please check your input and try again."
    });
    if (data?.eventId) {
      navigate(`/director/${data.eventId}`);
    }
    setLoading(false);
    
    // Clean up thumbnail preview URL
    if (thumbnailPreview) {
      URL.revokeObjectURL(thumbnailPreview);
    }
  };
  return <div className="min-h-screen bg-background">
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
                <Input id="eventName" value={formData.eventName} onChange={e => setFormData({
                  ...formData,
                  eventName: e.target.value
                })} placeholder="Championship Soccer Match" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sportType">Sport Type</Label>
                <Select value={formData.sportType} onValueChange={value => setFormData({
                  ...formData,
                  sportType: value
                })}>
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

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={e => setFormData({
                    ...formData,
                    description: e.target.value
                  })}
                  placeholder="Tell viewers more about your stream..."
                  className="min-h-[80px]"
                  maxLength={500}
                />
                <p className="text-sm text-muted-foreground">
                  {formData.description.length}/500 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnail">Thumbnail (Optional)</Label>
                <Input
                  id="thumbnail"
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0] || null;
                    setFormData({
                      ...formData,
                      thumbnail: file
                    });
                    
                    // Create preview URL
                    if (file) {
                      const previewUrl = URL.createObjectURL(file);
                      setThumbnailPreview(previewUrl);
                    } else {
                      setThumbnailPreview(null);
                    }
                  }}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                <p className="text-sm text-muted-foreground">
                  Upload an image that represents your stream. Good thumbnails stand out and draw viewers' attention.
                </p>
                
                {/* Thumbnail Preview */}
                {thumbnailPreview && formData.eventName && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium mb-2 block">Preview</Label>
                    <div className="max-w-sm">
                      <div className="relative group cursor-pointer">
                        <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
                          <img 
                            src={thumbnailPreview} 
                            alt="Thumbnail preview" 
                            className="w-full h-full object-cover"
                          />
                          {/* YouTube-style play button overlay */}
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                              <div className="w-0 h-0 border-l-[8px] border-l-white border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent ml-1"></div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 space-y-1">
                          <h3 className="font-medium text-sm line-clamp-2 leading-tight">
                            {formData.eventName}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {formData.sportType && `${formData.sportType} • `}Live Stream
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <div className="space-y-2">
                  <Label htmlFor="dateTime">Start Date & Time</Label>
                  <div className="flex gap-2">
                    <Input id="dateTime" type="datetime-local" value={formData.dateTime} onChange={e => setFormData({
                      ...formData,
                      dateTime: e.target.value
                    })} required className="flex-1 min-w-0" />
                    <Button type="button" variant="outline" size="sm" onClick={() => {
                      const now = new Date();
                      const year = now.getFullYear();
                      const month = String(now.getMonth() + 1).padStart(2, '0');
                      const day = String(now.getDate()).padStart(2, '0');
                      const hours = String(now.getHours()).padStart(2, '0');
                      const minutes = String(now.getMinutes()).padStart(2, '0');
                      const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
                      setFormData({
                        ...formData,
                        dateTime: localDateTime
                      });
                    }} className="whitespace-nowrap">
                      Set to Now
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expectedDuration">Duration (minutes)</Label>
                  <Input id="expectedDuration" type="number" value={formData.expectedDuration} onChange={e => setFormData({
                    ...formData,
                    expectedDuration: e.target.value
                  })} placeholder="180" min="1" required />
                </div>
              </div>

              <div className="space-y-4">
                
              </div>

              <div className={`flex gap-4 ${isMobile ? 'flex-col' : ''}`}>
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Home
                  </Link>
                </Button>
                <LoadingButton type="submit" className="flex-1" loading={loading} loadingText="Creating Event..." disabled={!isOnline}>
                  {!isOnline ? 'Offline - Cannot Create Event' : 'Create Event'}
                </LoadingButton>
              </div>
            </form>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>;
};
export default CreateEvent;