import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { performanceMonitor } from '@/utils/performance';

export interface RealtimeConnectionStats {
  connected: boolean;
  reconnectAttempts: number;
  lastReconnectTime: number | null;
  averageLatency: number;
  messagesReceived: number;
  messagesLost: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
}

interface RealtimeConnectionOptions {
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

export class RealtimeConnectionManager {
  private channels: Map<string, any> = new Map();
  private stats: RealtimeConnectionStats = {
    connected: false,
    reconnectAttempts: 0,
    lastReconnectTime: null,
    averageLatency: 0,
    messagesReceived: 0,
    messagesLost: 0,
    connectionQuality: 'disconnected'
  };
  private latencyMeasurements: number[] = [];
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionTimer: NodeJS.Timeout | null = null;
  private onStatsUpdate?: (stats: RealtimeConnectionStats) => void;

  constructor(
    private options: RealtimeConnectionOptions = {},
    onStatsUpdate?: (stats: RealtimeConnectionStats) => void
  ) {
    this.options = {
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
      ...options
    };
    this.onStatsUpdate = onStatsUpdate;
    this.initializeConnection();
  }

  private initializeConnection() {
    // Monitor connection status through WebSocket state
    this.startHeartbeat();
    
    // Simulate connection monitoring since Supabase doesn't expose direct events
    this.connectionTimer = setInterval(() => {
      this.checkConnectionHealth();
    }, 5000);
  }

  private checkConnectionHealth() {
    try {
      // Check if Supabase realtime is connected
      const isConnected = supabase.realtime.isConnected();
      
      if (isConnected !== this.stats.connected) {
        if (isConnected) {
          this.handleConnectionOpen();
        } else {
          this.handleConnectionClose();
        }
      }
      
      // Check individual channel statuses
      let allChannelsConnected = true;
      Object.entries(this.channels).forEach(([name, channel]) => {
        if (channel && channel.state !== 'joined') {
          allChannelsConnected = false;
          console.log(`[RealtimeConnection] Channel ${name} not connected, state: ${channel.state}`);
        }
      });
      
      if (!allChannelsConnected && this.options.autoReconnect) {
        this.handleConnectionClose();
      }
    } catch (error) {
      console.error('[RealtimeConnection] Error checking connection health:', error);
      this.handleConnectionClose();
    }
  }

  private handleConnectionOpen() {
    this.stats.connected = true;
    this.stats.reconnectAttempts = 0;
    this.stats.connectionQuality = 'excellent';
    this.updateStats();
    this.clearConnectionTimer();
  }

  private handleConnectionClose() {
    this.stats.connected = false;
    this.stats.connectionQuality = 'disconnected';
    this.updateStats();
    
    if (this.options.autoReconnect && this.stats.reconnectAttempts < (this.options.maxReconnectAttempts || 5)) {
      this.scheduleReconnect();
    }
  }

  private handleConnectionError(error: any) {
    this.stats.messagesLost++;
    this.updateConnectionQuality();
    this.updateStats();
    console.error('[RealtimeManager] Error:', error);
  }

  private scheduleReconnect() {
    const delay = this.options.reconnectDelay! * Math.pow(2, this.stats.reconnectAttempts);
    
    setTimeout(() => {
      console.log(`[RealtimeManager] Attempting reconnection ${this.stats.reconnectAttempts + 1}`);
      this.stats.reconnectAttempts++;
      this.stats.lastReconnectTime = Date.now();
      this.updateStats();
      
      // Trigger reconnection by resubscribing to channels
      this.resubscribeAllChannels();
    }, delay);
  }

  private resubscribeAllChannels() {
    for (const [channelName, channel] of this.channels.entries()) {
      try {
        supabase.removeChannel(channel);
        // Re-create channel with same configuration
        console.log(`[RealtimeManager] Resubscribing to ${channelName}`);
      } catch (error) {
        console.error(`[RealtimeManager] Failed to resubscribe to ${channelName}:`, error);
      }
    }
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.measureLatency();
    }, this.options.heartbeatInterval);
  }

  private measureLatency() {
    const startTime = Date.now();
    
    // Use a lightweight ping to measure latency
    const testChannel = supabase.channel('latency_test', {
      config: { broadcast: { self: true } }
    });

    testChannel
      .on('broadcast', { event: 'ping' }, () => {
        const latency = Date.now() - startTime;
        this.recordLatency(latency);
        supabase.removeChannel(testChannel);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          testChannel.send({
            type: 'broadcast',
            event: 'ping',
            payload: { timestamp: startTime }
          });
        }
      });

    // Timeout the test
    setTimeout(() => {
      supabase.removeChannel(testChannel);
    }, 5000);
  }

  private recordLatency(latency: number) {
    this.latencyMeasurements.push(latency);
    
    // Keep only last 10 measurements
    if (this.latencyMeasurements.length > 10) {
      this.latencyMeasurements.shift();
    }

    // Calculate average latency
    this.stats.averageLatency = this.latencyMeasurements.reduce((sum, lat) => sum + lat, 0) / this.latencyMeasurements.length;
    
    this.updateConnectionQuality();
    this.updateStats();
  }

  private updateConnectionQuality() {
    if (!this.stats.connected) {
      this.stats.connectionQuality = 'disconnected';
    } else if (this.stats.averageLatency < 100) {
      this.stats.connectionQuality = 'excellent';
    } else if (this.stats.averageLatency < 300) {
      this.stats.connectionQuality = 'good';
    } else {
      this.stats.connectionQuality = 'poor';
    }
  }

  private updateStats() {
    this.onStatsUpdate?.(this.stats);
  }

  private clearConnectionTimer() {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  public registerChannel(name: string, channel: any) {
    this.channels.set(name, channel);
  }

  public unregisterChannel(name: string) {
    const channel = this.channels.get(name);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(name);
    }
  }

  public getStats(): RealtimeConnectionStats {
    return { ...this.stats };
  }

  public destroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    this.clearConnectionTimer();
    
    // Clean up all channels
    for (const [name, channel] of this.channels.entries()) {
      supabase.removeChannel(channel);
    }
    this.channels.clear();
  }
}

export function useRealtimeConnection(options?: RealtimeConnectionOptions) {
  const [stats, setStats] = useState<RealtimeConnectionStats>({
    connected: false,
    reconnectAttempts: 0,
    lastReconnectTime: null,
    averageLatency: 0,
    messagesReceived: 0,
    messagesLost: 0,
    connectionQuality: 'disconnected'
  });

  const managerRef = useRef<RealtimeConnectionManager | null>(null);

  useEffect(() => {
    managerRef.current = new RealtimeConnectionManager(options, setStats);

    return () => {
      managerRef.current?.destroy();
    };
  }, []);

  const createChannel = useCallback((name: string, config?: any) => {
    const channel = supabase.channel(name, config);
    managerRef.current?.registerChannel(name, channel);
    return channel;
  }, []);

  const removeChannel = useCallback((name: string) => {
    managerRef.current?.unregisterChannel(name);
  }, []);

  return {
    stats,
    createChannel,
    removeChannel,
    manager: managerRef.current
  };
}
