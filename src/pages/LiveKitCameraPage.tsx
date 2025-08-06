import React from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiveKitCameraStream } from '@/components/LiveKitCameraStream';
import AppHeader from '@/components/AppHeader';

export function LiveKitCameraPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  const { eventName, deviceLabel } = location.state || {};

  if (!eventId || !deviceLabel) {
    navigate('/join-camera');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/join-camera')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Join Camera
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">
              {eventName || 'Live Event'}
            </h1>
            <p className="text-muted-foreground">
              Camera: {deviceLabel} • LiveKit Streaming
            </p>
          </div>
        </div>

        <LiveKitCameraStream 
          eventId={eventId}
          deviceLabel={deviceLabel}
        />
      </div>
    </div>
  );
}