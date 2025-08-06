import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Youtube, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface YouTubeAuthProps {
  onConnectionChange?: (connected: boolean) => void;
}

interface YouTubeChannelInfo {
  id: string;
  title: string;
  thumbnail?: string;
}

export const YouTubeAuth: React.FC<YouTubeAuthProps> = ({ onConnectionChange }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [channelInfo, setChannelInfo] = useState<YouTubeChannelInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('youtube_access_token, youtube_channel_id, youtube_channel_title')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.youtube_access_token && profile?.youtube_channel_id) {
        setIsConnected(true);
        setChannelInfo({
          id: profile.youtube_channel_id,
          title: profile.youtube_channel_title || 'YouTube Channel'
        });
        onConnectionChange?.(true);
      } else {
        setIsConnected(false);
        onConnectionChange?.(false);
      }
    } catch (error) {
      console.error('Error checking YouTube connection:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const redirectUri = `${window.location.origin}/auth/youtube/callback`;
      
      const { data, error } = await supabase.functions.invoke('youtube-auth', {
        body: {
          action: 'getAuthUrl',
          redirectUri
        }
      });

      if (error) throw error;

      // Open YouTube OAuth in a popup
      const popup = window.open(
        data.authUrl,
        'youtube-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for the popup to close or receive a message
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          // Check if connection was successful
          setTimeout(() => {
            checkConnectionStatus();
          }, 1000);
        }
      }, 1000);

      // Listen for postMessage from the popup
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'youtube-auth-success') {
          popup?.close();
          clearInterval(checkClosed);
          setChannelInfo(event.data.channel);
          setIsConnected(true);
          onConnectionChange?.(true);
          toast.success('YouTube account connected successfully!');
          window.removeEventListener('message', messageListener);
        }
        
        if (event.data.type === 'youtube-auth-error') {
          popup?.close();
          clearInterval(checkClosed);
          toast.error(event.data.error || 'Failed to connect YouTube account');
          window.removeEventListener('message', messageListener);
        }
      };

      window.addEventListener('message', messageListener);

    } catch (error) {
      console.error('Error connecting to YouTube:', error);
      toast.error('Failed to connect to YouTube');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          youtube_access_token: null,
          youtube_refresh_token: null,
          youtube_channel_id: null,
          youtube_channel_title: null
        })
        .eq('id', user.id);

      if (error) throw error;

      setIsConnected(false);
      setChannelInfo(null);
      onConnectionChange?.(false);
      toast.success('YouTube account disconnected');
    } catch (error) {
      console.error('Error disconnecting YouTube:', error);
      toast.error('Failed to disconnect YouTube account');
    }
  };

  if (checking) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-600" />
            YouTube Integration
          </CardTitle>
          <CardDescription>Checking connection status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-red-600" />
          YouTube Integration
          {isConnected && <CheckCircle className="h-4 w-4 text-green-500" />}
        </CardTitle>
        <CardDescription>
          {isConnected 
            ? 'Your YouTube account is connected and ready for live streaming'
            : 'Connect your YouTube account to enable live streaming to your channel'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && channelInfo ? (
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                <Youtube className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  {channelInfo.title}
                </p>
                <p className="text-sm text-green-600 dark:text-green-300">
                  Connected and ready for streaming
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDisconnect}
              className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                YouTube account not connected
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-300">
                Connect your account to stream live to YouTube
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isConnected ? (
            <Button 
              onClick={handleConnect} 
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Youtube className="h-4 w-4 mr-2" />
              {loading ? 'Connecting...' : 'Connect YouTube'}
            </Button>
          ) : (
            <Button 
              variant="outline"
              onClick={() => window.open(`https://youtube.com/channel/${channelInfo?.id}`, '_blank')}
            >
              <Youtube className="h-4 w-4 mr-2" />
              View Channel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};