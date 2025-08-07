import { Link } from "react-router-dom";
import LoadingButton from "@/components/ui/LoadingButton";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, Users, Monitor, Play } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { useIsMobile } from "@/hooks/use-mobile";

const Index = () => {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8 sm:py-16">
        <div className="text-center mb-8 sm:mb-16">
          <h1 className={`font-bold mb-4 sm:mb-6 ${isMobile ? 'text-4xl pt-0' : 'text-6xl pt-[100px]'}`}>
            Multi-Camera Sports Streaming
          </h1>
          <p className={`text-muted-foreground mb-6 sm:mb-8 max-w-3xl mx-auto ${isMobile ? 'text-lg px-2' : 'text-xl'}`}>
            Film amateur sports with any iPhone, choose live camera angles, and simulcast to YouTube Live and Twitch. 
            Professional-grade multi-camera coverage made simple.
          </p>
          <div className={`flex gap-3 sm:gap-4 justify-center ${isMobile ? 'flex-col items-center px-4' : 'flex-row'}`}>
            <Button asChild size={isMobile ? "default" : "lg"} className={isMobile ? "w-full max-w-xs" : ""}>
              <Link to="/create-event">
                <Video className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Create Event
              </Link>
            </Button>
            <Button asChild variant="outline" size={isMobile ? "default" : "lg"} className={isMobile ? "w-full max-w-xs" : ""}>
              <Link to="/join-camera">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Join as Camera
              </Link>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-6 w-6 text-primary" />
                Multi-Camera Setup
              </CardTitle>
              <CardDescription>
                Connect up to 8 iPhone cameras for comprehensive coverage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Each camera operator gets a unique QR code for instant connection. 
                Stream directly to our platform with minimal setup required.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-6 w-6 text-primary" />
                Live Direction
              </CardTitle>
              <CardDescription>
                Real-time camera switching and program control
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Director dashboard shows all camera feeds. Click any camera thumbnail 
                to switch the live program feed instantly.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-6 w-6 text-primary" />
                Simulcast Streaming
              </CardTitle>
              <CardDescription>
                Broadcast simultaneously to multiple platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Stream to YouTube Live and Twitch simultaneously while maintaining 
                low latency for live betting and engagement.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <div className="mt-12 sm:mt-24 text-center">
          <h2 className={`font-bold mb-8 sm:mb-12 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>How It Works</h2>
          <div className={`grid gap-6 sm:gap-8 max-w-5xl mx-auto ${isMobile ? 'grid-cols-1 px-4' : 'grid-cols-1 md:grid-cols-4'}`}>
            <div className={`text-center ${isMobile ? 'py-4' : ''}`}>
              <div className={`bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold mb-4 mx-auto ${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}>
                1
              </div>
              <h3 className={`font-semibold mb-2 ${isMobile ? 'text-lg' : ''}`}>Create Event</h3>
              <p className={`text-muted-foreground ${isMobile ? 'text-base px-2' : 'text-sm'}`}>
                Set up your sports event with details and streaming keys
              </p>
            </div>
            <div className={`text-center ${isMobile ? 'py-4' : ''}`}>
              <div className={`bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold mb-4 mx-auto ${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}>
                2
              </div>
              <h3 className={`font-semibold mb-2 ${isMobile ? 'text-lg' : ''}`}>Connect Cameras</h3>
              <p className={`text-muted-foreground ${isMobile ? 'text-base px-2' : 'text-sm'}`}>
                Camera operators scan QR codes to join the event
              </p>
            </div>
            <div className={`text-center ${isMobile ? 'py-4' : ''}`}>
              <div className={`bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold mb-4 mx-auto ${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}>
                3
              </div>
              <h3 className={`font-semibold mb-2 ${isMobile ? 'text-lg' : ''}`}>Direct Live</h3>
              <p className={`text-muted-foreground ${isMobile ? 'text-base px-2' : 'text-sm'}`}>
                Switch between camera angles in real-time
              </p>
            </div>
            <div className={`text-center ${isMobile ? 'py-4' : ''}`}>
              <div className={`bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold mb-4 mx-auto ${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}>
                4
              </div>
              <h3 className={`font-semibold mb-2 ${isMobile ? 'text-lg' : ''}`}>Stream & Share</h3>
              <p className={`text-muted-foreground ${isMobile ? 'text-base px-2' : 'text-sm'}`}>
                Broadcast to multiple platforms simultaneously
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
