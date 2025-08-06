import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ErrorBoundary from "@/components/error/ErrorBoundary";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { CompactOfflineIndicator } from "@/components/ui/OfflineIndicator";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import CreateEvent from "./pages/CreateEvent";
import JoinAsCamera from "./pages/JoinAsCamera";
// CameraStream removed - using LiveKit only
import TelegramCameraStream from "./pages/TelegramCameraStream";
import { LiveKitCameraPage } from "./pages/LiveKitCameraPage";
import DirectorDashboard from "./pages/DirectorDashboard";
import ViewerPage from "./pages/ViewerPage";
import UserProfile from "./pages/UserProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const { isOnline } = useOnlineStatus();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <TooltipProvider>
          <ErrorBoundary>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route 
                path="/create-event" 
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <CreateEvent />
                    </ProtectedRoute>
                  </ErrorBoundary>
                } 
              />
              <Route 
                path="/join-camera" 
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <JoinAsCamera />
                    </ProtectedRoute>
                  </ErrorBoundary>
                } 
              />
              <Route 
                path="/director/:eventId" 
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <DirectorDashboard />
                    </ProtectedRoute>
                  </ErrorBoundary>
                } 
              />
              <Route 
                path="/watch/:eventId" 
                element={
                  <ErrorBoundary>
                    <ViewerPage />
                  </ErrorBoundary>
                } 
              />
              <Route 
                path="/view/:eventId" 
                element={
                  <ErrorBoundary>
                    <ViewerPage />
                  </ErrorBoundary>
                } 
              />
              {/* Legacy RTMP route removed - all cameras now use LiveKit */}
              <Route 
                path="/camera/telegram/:eventId" 
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <TelegramCameraStream />
                    </ProtectedRoute>
                  </ErrorBoundary>
                } 
              />
              <Route 
                path="/livekit-camera/:eventId" 
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <LiveKitCameraPage />
                    </ProtectedRoute>
                  </ErrorBoundary>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <UserProfile />
                    </ProtectedRoute>
                  </ErrorBoundary>
                } 
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
        {!isOnline && (
          <div className="fixed top-4 right-4 z-50">
            <CompactOfflineIndicator />
          </div>
        )}
        </ErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
