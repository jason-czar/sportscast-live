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
import GuestJoinCamera from "./pages/GuestJoinCamera";
import CameraStream from "./pages/CameraStream";
import TelegramCameraStream from "./pages/TelegramCameraStream";
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
              {/* Guest camera access - no authentication required */}
              <Route path="/join-camera" element={<GuestJoinCamera />} />
              
              {/* Legacy authenticated camera route */}
              <Route 
                path="/join-as-camera" 
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
                path="/camera/:cameraId" 
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <CameraStream />
                    </ProtectedRoute>
                  </ErrorBoundary>
                } 
              />
              {/* Guest-accessible camera streaming routes */}
              <Route path="/camera/telegram/:eventId" element={<TelegramCameraStream />} />
              <Route path="/camera-stream/:eventId" element={<CameraStream />} />
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
