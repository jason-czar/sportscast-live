import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toastService } from "@/lib/toast-service";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const AppHeader = () => {
  const { user, profile, signOut, loading } = useAuth();
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      toastService.auth.signOutSuccess();
    } catch (error) {
      console.error('Error signing out:', error);
      toastService.error({
        description: "Failed to sign out. Please try again.",
      });
    }
  };

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <img 
              src="/lovable-uploads/e67836c1-4683-4443-9a0b-2cebdeddb921.png" 
              alt="Sportscast Live" 
              className={`${isMobile ? 'h-8' : 'h-10'}`}
            />
          </Link>
          
          {isMobile ? (
            <div className="flex items-center space-x-2">
              {user && (
                <Link 
                  to="/profile" 
                  className="flex items-center hover:text-primary transition-colors"
                >
                  <User className="h-5 w-5" />
                </Link>
              )}
              <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64">
                  <div className="flex flex-col space-y-4 mt-8">
                    {user ? (
                      <>
                        <Link 
                          to="/" 
                          className="text-foreground hover:text-primary text-lg py-2"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Home
                        </Link>
                        <Link 
                          to="/create-event" 
                          className="text-foreground hover:text-primary text-lg py-2"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Create Event
                        </Link>
                        <Link 
                          to="/join-camera" 
                          className="text-foreground hover:text-primary text-lg py-2"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Join as Camera
                        </Link>
                        <Link 
                          to="/profile" 
                          className="text-foreground hover:text-primary text-lg py-2"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Profile
                        </Link>
                        <Button
                          variant="outline"
                          onClick={() => {
                            handleSignOut();
                            setIsMenuOpen(false);
                          }}
                          disabled={loading}
                          className="justify-start"
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Sign Out
                        </Button>
                      </>
                    ) : (
                      <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                        <Button className="w-full">Sign In</Button>
                      </Link>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          ) : (
            <nav className="flex items-center space-x-6">
              {user ? (
                <>
                  <div className="hidden md:flex space-x-6">
                    <Link to="/" className="text-foreground hover:text-primary">Home</Link>
                    <Link to="/create-event" className="text-foreground hover:text-primary">Create Event</Link>
                    <Link to="/join-camera" className="text-foreground hover:text-primary">Join as Camera</Link>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Link 
                      to="/profile" 
                      className="flex items-center space-x-2 hover:text-primary transition-colors"
                    >
                      <User className="h-4 w-4" />
                      <span className="text-sm">{profile?.full_name || user.email}</span>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSignOut}
                      disabled={loading}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </>
              ) : (
                <Link to="/auth">
                  <Button>Sign In</Button>
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;