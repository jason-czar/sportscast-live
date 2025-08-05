import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toastService } from '@/lib/toast-service';

interface TelegramAuthProps {
  onAuthSuccess?: (authData: any) => void;
  onAuthError?: (error: string) => void;
}

export const TelegramAuth: React.FC<TelegramAuthProps> = ({
  onAuthSuccess,
  onAuthError
}) => {
  const [step, setStep] = useState<'phone' | 'code' | 'authenticated'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authData, setAuthData] = useState<any>(null);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setIsLoading(true);
    try {
      console.log('Starting Telegram authentication with phone:', phone);
      
      const { data, error } = await supabase.functions.invoke('tdlib-service', {
        body: {
          action: 'authenticate',
          phone: phone.trim()
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to send authentication code');
      }

      console.log('SMS code sent successfully');
      setStep('code');
      
      toastService.success({
        title: "SMS Code Sent",
        description: "Please check your phone for the verification code.",
      });

    } catch (error) {
      console.error('Phone authentication error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send SMS code';
      
      toastService.error({
        description: errorMessage,
      });
      
      onAuthError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsLoading(true);
    try {
      console.log('Verifying SMS code');
      
      const { data, error } = await supabase.functions.invoke('tdlib-service', {
        body: {
          action: 'authenticate',
          phone: phone.trim(),
          code: code.trim()
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Invalid verification code');
      }

      console.log('Telegram authentication successful');
      setStep('authenticated');
      setAuthData(data);
      
      toastService.success({
        title: "Authentication Successful",
        description: "You're now authenticated with Telegram for live streaming.",
      });
      
      onAuthSuccess?.(data);

    } catch (error) {
      console.error('Code verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid verification code';
      
      toastService.error({
        description: errorMessage,
      });
      
      onAuthError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setStep('phone');
    setPhone('');
    setCode('');
    setAuthData(null);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Telegram Authentication
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Connect your Telegram account for live streaming
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Enter your phone number with country code
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !phone.trim()}
            >
              {isLoading ? 'Sending Code...' : 'Send SMS Code'}
            </Button>
          </form>
        )}

        {step === 'code' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                SMS code sent to {phone}
              </p>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  disabled={isLoading}
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code from SMS
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleRetry}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading || !code.trim()}
                  className="flex-1"
                >
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {step === 'authenticated' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-800 dark:text-green-200">
                Successfully authenticated with Telegram!
              </p>
            </div>

            <div className="space-y-2">
              <Badge variant="default" className="w-full justify-center">
                Ready for Live Streaming
              </Badge>
              
              <p className="text-xs text-center text-muted-foreground">
                You can now create and manage RTMP streams for Telegram channels
              </p>
            </div>

            <Button 
              onClick={handleRetry}
              variant="outline"
              className="w-full"
            >
              Re-authenticate
            </Button>
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3 w-3" />
            <span>
              Your phone number is used only for Telegram authentication and is not stored.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};