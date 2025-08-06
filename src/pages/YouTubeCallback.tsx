import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Youtube, CheckCircle, AlertCircle } from 'lucide-react';

export const YouTubeCallback: React.FC = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const state = searchParams.get('state');

      if (error) {
        // Send error to parent window
        window.opener?.postMessage({
          type: 'youtube-auth-error',
          error: error === 'access_denied' ? 'Access denied by user' : 'Authorization failed'
        }, window.location.origin);
        window.close();
        return;
      }

      if (!code) {
        window.opener?.postMessage({
          type: 'youtube-auth-error',
          error: 'No authorization code received'
        }, window.location.origin);
        window.close();
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/auth/youtube/callback`;
        
        const { data, error: exchangeError } = await supabase.functions.invoke('youtube-auth', {
          body: {
            action: 'exchangeCode',
            code,
            redirectUri
          }
        });

        if (exchangeError) throw exchangeError;

        // Send success to parent window
        window.opener?.postMessage({
          type: 'youtube-auth-success',
          channel: data.channel
        }, window.location.origin);
        
        window.close();
      } catch (err) {
        console.error('Error exchanging code:', err);
        window.opener?.postMessage({
          type: 'youtube-auth-error',
          error: 'Failed to complete authorization'
        }, window.location.origin);
        window.close();
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Youtube className="h-6 w-6 text-red-600" />
            YouTube Authorization
          </CardTitle>
          <CardDescription>
            Processing your YouTube authorization...
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
            Connecting your YouTube account
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            This window will close automatically when complete.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};