import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { onValue } from 'firebase/database';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Header } from '@/components/dashboard/Header';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { MainChart } from '@/components/dashboard/MainChart';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { StationDetail } from '@/components/dashboard/StationDetail';
import { ComponentStatusCard } from '@/components/dashboard/ComponentStatusCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { auth, dbHelpers } from '@/lib/firebase';
import { useFloodData, type TimeRange } from '@/hooks/useFloodData';
import type { AppUser, SensorReading } from '@/types/floodData';
import { Activity, AlertTriangle, BarChart3, Droplets, Gauge, ShieldCheck, Waves } from 'lucide-react';
import './App.css';

function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  useEffect(() => {
    let unsubscribeUserProfile: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribeUserProfile?.();
      unsubscribeUserProfile = undefined;

      if (!firebaseUser) {
        setCurrentUser(null);
        setAuthLoading(false);
        return;
      }

      const userRef = dbHelpers.getUserRef(firebaseUser.uid);
      unsubscribeUserProfile = onValue(userRef, async (snapshot) => {
        if (!snapshot.exists()) {
          setAuthMessage('No admin profile found for this account.');
          setLoginOpen(true);
          setCurrentUser(null);
          await signOut(auth);
          setAuthLoading(false);
          return;
        }

        const profile = snapshot.val() as Omit<AppUser, 'uid'>;
        if (profile.disabled) {
          setAuthMessage('Account disabled.');
          setLoginOpen(true);
          setCurrentUser(null);
          await signOut(auth);
          setAuthLoading(false);
          return;
        }

        if (profile.role !== 'Admin') {
          setAuthMessage('Admin access only.');
          setLoginOpen(true);
          setCurrentUser(null);
          await signOut(auth);
          setAuthLoading(false);
          return;
        }

        setCurrentUser({
          uid: firebaseUser.uid,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          disabled: false,
        });
        setAuthMessage('');
        setLoginOpen(false);
        setAuthLoading(false);
      });
    });

    return () => {
      unsubscribeUserProfile?.();
      unsubscribe();
    };
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthMessage('');

    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      setLoginPassword('');
    } catch {
      setAuthMessage('Invalid email or password.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto mb-3 sm:mb-4"></div>
          <p className="text-sm text-muted-foreground">Checking login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />

      {currentUser ? (
        <Dashboard user={currentUser} onSignOut={handleSignOut} />
      ) : (
        <PublicLanding onLogin={() => setLoginOpen(true)} />
      )}

      <LoginModal
        open={loginOpen && !currentUser}
        email={loginEmail}
        password={loginPassword}
        message={authMessage}
        onOpenChange={setLoginOpen}
        onEmailChange={setLoginEmail}
        onPasswordChange={setLoginPassword}
        onSubmit={handleLogin}
      />
    </div>
  );
}

interface DashboardProps {
  user: AppUser;
  onSignOut: () => Promise<void>;
}

const Dashboard = ({ user, onSignOut }: DashboardProps) => {
  const {
    station,
    history,
    alerts,
    stats,
    chartData,
    loading,
    lastUpdate,
    isConnected,
    componentStatus,
    sirenOn,
    sirenLastUpdate,
    currentTimeRange,
    acknowledgeAlert,
    updateSirenStatus,
    setTimeRange,
  } = useFloodData();

  const shownAlertIds = useRef<Set<string>>(new Set());

  const handleAcknowledge = useCallback(async (alertId: string) => {
    await acknowledgeAlert(alertId, user.email);
    toast.success('Alert acknowledged.');
  }, [acknowledgeAlert, user.email]);

  useEffect(() => {
    alerts
      .filter((alert) => alert.type === 'flood_warning' && !alert.acknowledged && alert.severity === 'critical')
      .forEach((alert) => {
        if (shownAlertIds.current.has(alert.id)) return;
        shownAlertIds.current.add(alert.id);

        toast.error(alert.message, {
          description: new Date(alert.timestamp).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          duration: 10000,
          action: {
            label: 'Acknowledge',
            onClick: () => handleAcknowledge(alert.id),
          },
        });
      });
  }, [alerts, handleAcknowledge]);

  const handleRefresh = () => {
    toast.info('Refreshing data...');
  };

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
  }, [setTimeRange]);

  const handleSirenToggle = async (enabled: boolean) => {
    try {
      await updateSirenStatus(enabled);
      toast.success(`Siren turned ${enabled ? 'on' : 'off'}.`);
    } catch {
      toast.error('Unable to update siren status.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto mb-3 sm:mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        lastUpdate={lastUpdate}
        isConnected={isConnected}
        onRefresh={handleRefresh}
        user={user}
        onSignOut={onSignOut}
      />

      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <section className="mb-4 sm:mb-6">
          <StatsCards
            stats={stats}
            currentReading={station?.currentReading}
            componentStatus={componentStatus}
          />
        </section>

        <section className="mb-4 sm:mb-6">
          <ComponentStatusCard
            status={componentStatus}
            currentReading={station?.currentReading}
            lastUpdate={lastUpdate}
            sirenOn={sirenOn}
            sirenLastUpdate={sirenLastUpdate}
            onSirenToggle={handleSirenToggle}
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-6">
          <div className="lg:col-span-2">
            <MainChart
              data={chartData}
              onTimeRangeChange={handleTimeRangeChange}
              currentRange={currentTimeRange}
            />
          </div>

          <div className="lg:col-span-1">
            <AlertsPanel
              alerts={alerts}
              canAcknowledge
              onAcknowledge={handleAcknowledge}
            />
          </div>
        </div>

        {station && (
          <section className="mb-4 sm:mb-6">
            <StationDetail
              station={station}
              history={chartData}
            />
          </section>
        )}

        <section className="mb-4 sm:mb-6">
          <HistoryTable history={history.slice(-20).reverse()} />
        </section>

        <footer className="mt-8 sm:mt-12 py-4 sm:py-6 border-t">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 text-xs text-muted-foreground">
            <div className="text-center sm:text-left">
              <p className="font-medium">FloodMonitor Pro</p>
              <p className="text-[10px]">Single Station Mode</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
              <span>Refresh: 5s</span>
              <span className="hidden sm:inline">•</span>
              <span>{history.length} Records</span>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
};

interface PublicLandingProps {
  onLogin: () => void;
}

const PublicLanding = ({ onLogin }: PublicLandingProps) => {
  const publicFeatures = [
    { title: 'Project Overview', text: 'A real-time flood monitoring system designed for fast situational awareness.', icon: Waves },
    { title: 'Flood Information', text: 'Track water-level conditions and understand how alerts support community safety.', icon: AlertTriangle },
    { title: 'Dashboard Overview', text: 'Admins can review charts, alert history, and protected device status after login.', icon: BarChart3 },
    { title: 'System Description', text: 'ESP32 sensor readings are sent to Firebase and visualized in a responsive dashboard.', icon: Gauge },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex min-h-14 sm:min-h-16 items-center justify-between gap-3 px-3 sm:px-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-400 p-1.5 sm:p-2 rounded-lg shrink-0">
              <Droplets className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent truncate">
                FloodMonitor
              </h1>
              <p className="hidden sm:block text-[10px] text-muted-foreground">Flood Monitoring System</p>
            </div>
          </div>

          <Button size="sm" onClick={onLogin} className="h-8 sm:h-9 px-3 text-xs">
            Admin Login
          </Button>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-3 sm:px-4 py-10 sm:py-14">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-4 bg-cyan-500/10 text-cyan-600 border-cyan-500/20">
              Public Information
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
              Community flood monitoring with real-time dashboard support.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl">
              FloodMonitor helps present water-level information, system purpose, dashboard summaries, and public-facing safety context in one responsive web experience.
            </p>
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="container mx-auto px-3 sm:px-4 py-8 sm:py-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {publicFeatures.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div key={feature.title} className="rounded-lg border bg-card p-4 hover:shadow-md transition-all duration-300">
                    <div className="mb-3 inline-flex rounded-md bg-blue-500/10 p-2 text-blue-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{feature.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-3 sm:px-4 py-8 sm:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-card p-4 lg:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold">Features Section</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The system supports flood status tracking, historical charts, alert review, and protected monitoring tools for authorized administrators.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-semibold">Protected Monitoring</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Component status, device status, sensor readings, and controls are hidden from public users.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

interface LoginModalProps {
  open: boolean;
  email: string;
  password: string;
  message: string;
  onOpenChange: (open: boolean) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const LoginModal = ({
  open,
  email,
  password,
  message,
  onOpenChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: LoginModalProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <form onSubmit={onSubmit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>Admin Login</DialogTitle>
          <DialogDescription>Sign in with an Admin account to open the monitoring dashboard.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {message && (
          <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {message}
          </p>
        )}

        <DialogFooter>
          <Button type="submit" className="w-full">Login</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
);

interface HistoryTableProps {
  history: SensorReading[];
}

const HistoryTable = ({ history }: HistoryTableProps) => {
  const getStatusBadge = (status: string) => {
    const styles = {
      normal: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      moderate: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      critical: 'bg-red-500/10 text-red-600 border-red-500/20',
      offline: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    };

    return styles[status as keyof typeof styles] || styles.offline;
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-3 sm:p-4 border-b">
        <h3 className="text-sm sm:text-base font-semibold">Recent History</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground">Last 20 readings</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] sm:text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium">Time</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium">Water Level</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium">Status</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium">Ack</th>
            </tr>
          </thead>
          <tbody>
            {history.map((reading) => (
              <tr key={reading.recordKey ?? reading.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                  {new Date(reading.timestamp).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium whitespace-nowrap">
                  {reading.waterLevel.toFixed(2)} cm
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3">
                  <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium border ${getStatusBadge(reading.status)}`}>
                    {reading.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                  {reading.acknowledged ? 'Yes' : 'No'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default App;
