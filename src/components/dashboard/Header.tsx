import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Droplets, LogOut, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import type { AppUser } from '@/types/floodData';

interface HeaderProps {
  lastUpdate: Date;
  isConnected: boolean;
  onRefresh: () => void;
  user: AppUser | null;
  onLogin: () => void;
  onSignOut: () => void;
}

export const Header = ({
  lastUpdate,
  isConnected,
  onRefresh,
  user,
  onLogin,
  onSignOut,
}: HeaderProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex min-h-14 sm:min-h-16 items-center justify-between gap-2 px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-400 p-1.5 sm:p-2 rounded-lg shrink-0">
            <Droplets className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent truncate">
              FloodMonitor
            </h1>
            <p className="hidden sm:block text-[10px] text-muted-foreground">Flood Monitoring System</p>
          </div>

          <Badge
            variant="outline"
            className={`hidden md:flex items-center gap-1 text-[10px] h-5 px-1.5 ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-red-500/10 text-red-600 border-red-500/20'
            }`}
          >
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isConnected ? 'Live' : 'Off'}
          </Badge>
        </div>

        <div className="hidden lg:flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>
              Updated: {lastUpdate.getTime() > 0 ? lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1 sm:gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={`md:hidden flex items-center gap-1 text-[10px] h-5 px-1.5 ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-red-500/10 text-red-600 border-red-500/20'
            }`}
          >
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          </Badge>

          {user && (
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs font-medium truncate max-w-[140px]">{user.name}</span>
              <span className="text-[10px] text-muted-foreground">{user.role}</span>
            </div>
          )}

          <Button variant="outline" size="icon" onClick={onRefresh} className="h-8 w-8 sm:h-9 sm:w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>

          {user ? (
            <Button variant="outline" size="icon" onClick={onSignOut} className="h-8 w-8 sm:h-9 sm:w-9">
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={onLogin} className="h-8 sm:h-9 px-3 text-xs">
              Admin Login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
