import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Droplets, 
  Clock, 
  RefreshCw, 
  Bell,
  Settings,
  Menu,
  Wifi,
  WifiOff
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface HeaderProps {
  lastUpdate: Date;
  isConnected: boolean;
  onRefresh: () => void;
  unacknowledgedAlerts: number;
}

export const Header = ({ lastUpdate, isConnected, onRefresh, unacknowledgedAlerts }: HeaderProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-400 p-1.5 sm:p-2 rounded-lg shrink-0">
            <Droplets className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent truncate">
              FloodMonitor
            </h1>
            <p className="hidden sm:block text-[10px] text-muted-foreground">Flood Monitoring System</p>
          </div>
          
          {/* Connection Status - Desktop */}
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

        {/* Center - Time - Desktop Only */}
        <div className="hidden lg:flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Updated: {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Connection Status - Mobile */}
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

          {/* Refresh Button */}
          <Button 
            variant="outline" 
            size="icon" 
            onClick={onRefresh}
            className="h-8 w-8 sm:h-9 sm:w-9"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* Alerts Button */}
          <Button 
            variant="outline" 
            size="icon"
            className="relative h-8 w-8 sm:h-9 sm:w-9"
          >
            <Bell className="h-4 w-4" />
            {unacknowledgedAlerts > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center animate-pulse">
                {unacknowledgedAlerts > 9 ? '9+' : unacknowledgedAlerts}
              </span>
            )}
          </Button>

          {/* Settings - Desktop */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Alert Thresholds</DropdownMenuItem>
              <DropdownMenuItem>Notifications</DropdownMenuItem>
              <DropdownMenuItem>Data Export</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden h-8 w-8">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[250px]">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Current Time</p>
                  <p className="text-sm font-medium">{currentTime.toLocaleTimeString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Last Update</p>
                  <p className="text-sm font-medium">{lastUpdate.toLocaleTimeString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Connection</p>
                  <Badge 
                    variant="outline" 
                    className={`${
                      isConnected 
                        ? 'bg-emerald-500/10 text-emerald-600' 
                        : 'bg-red-500/10 text-red-600'
                    }`}
                  >
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <div className="pt-4 border-t space-y-2">
                  <Button variant="ghost" className="w-full justify-start text-sm">Alert Thresholds</Button>
                  <Button variant="ghost" className="w-full justify-start text-sm">Notifications</Button>
                  <Button variant="ghost" className="w-full justify-start text-sm">Data Export</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;
