import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { onValue, set, update } from 'firebase/database';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Header } from '@/components/dashboard/Header';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { MainChart } from '@/components/dashboard/MainChart';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { StationDetail } from '@/components/dashboard/StationDetail';
import { ComponentStatusCard } from '@/components/dashboard/ComponentStatusCard';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { auth, dbHelpers, userManagementAuth } from '@/lib/firebase';
import { useFloodData, type TimeRange } from '@/hooks/useFloodData';
import type { AppUser, ChartDataPoint, SensorReading } from '@/types/floodData';
import './App.css';

type UserFormState = {
  uid?: string;
  name: string;
  email: string;
  password: string;
  role: 'Admin' | 'User';
  disabled: boolean;
};

const emptyUserForm: UserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'User',
  disabled: false,
};

function App() {
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
    currentTimeRange,
    acknowledgeAlert,
    createManualAlert,
    setTimeRange,
  } = useFloodData();

  const [displayData, setDisplayData] = useState<ChartDataPoint[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [manualAlertOpen, setManualAlertOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
  const [savingUser, setSavingUser] = useState(false);
  const shownAlertIds = useRef<Set<string>>(new Set());

  const isAdmin = currentUser?.role === 'Admin';

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
          setAuthMessage('No dashboard role found for this account.');
          setCurrentUser(null);
          await signOut(auth);
          setAuthLoading(false);
          return;
        }

        const profile = snapshot.val() as Omit<AppUser, 'uid'>;
        if (profile.disabled) {
          setAuthMessage('Account Disabled');
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
        setAuthLoading(false);
      });
    });

    return () => {
      unsubscribeUserProfile?.();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setUsers([]);
      return;
    }

    const usersRef = dbHelpers.getUsersRef();
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const rawUsers = snapshot.val() as Record<string, Omit<AppUser, 'uid'>> | null;
      const nextUsers = Object.entries(rawUsers ?? {}).map(([uid, profile]) => ({
        uid,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        disabled: profile.disabled === true,
      }));

      setUsers(nextUsers.sort((a, b) => a.name.localeCompare(b.name)));
    });

    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    if (chartData.length > 0) {
      setDisplayData(chartData);
    }
  }, [chartData]);

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
          action: isAdmin
            ? {
                label: 'Acknowledge',
                onClick: () => handleAcknowledge(alert.id),
              }
            : undefined,
        });
      });
  }, [alerts, isAdmin]);

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
    shownAlertIds.current.clear();
  };

  const handleRefresh = () => {
    toast.info('Refreshing data...');
    setDisplayData([...chartData]);
  };

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
  }, [setTimeRange]);

  const handleAcknowledge = useCallback(async (alertId: string) => {
    if (!isAdmin || !currentUser) return;
    await acknowledgeAlert(alertId, currentUser.email);
    toast.success('Alert acknowledged.');
  }, [acknowledgeAlert, currentUser, isAdmin]);

  const handleManualAlert = async () => {
    if (!currentUser) return;
    await createManualAlert(currentUser.email);
    setManualAlertOpen(false);
    toast.success('Manual alert added to history.');
  };

  const resetUserForm = () => {
    setUserForm(emptyUserForm);
  };

  const editUser = (user: AppUser) => {
    setUserForm({
      uid: user.uid,
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      disabled: user.disabled,
    });
  };

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin) return;

    setSavingUser(true);
    try {
      if (userForm.uid) {
        await update(dbHelpers.getUserRef(userForm.uid), {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          role: userForm.role,
          disabled: userForm.disabled,
        });
        toast.success('User updated.');
      } else {
        const credential = await createUserWithEmailAndPassword(
          userManagementAuth,
          userForm.email.trim(),
          userForm.password
        );

        await set(dbHelpers.getUserRef(credential.user.uid), {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          role: userForm.role,
          disabled: userForm.disabled,
        });
        await signOut(userManagementAuth);
        toast.success('User added.');
      }

      resetUserForm();
    } catch {
      toast.error('Unable to save user. Check the fields and Firebase permissions.');
    } finally {
      setSavingUser(false);
    }
  };

  const disableUser = async (user: AppUser) => {
    if (!isAdmin) return;
    await update(dbHelpers.getUserRef(user.uid), { disabled: true });
    toast.success('User disabled.');
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

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background">
        <Toaster position="top-right" richColors />
        <LoginModal
          email={loginEmail}
          password={loginPassword}
          message={authMessage}
          onEmailChange={setLoginEmail}
          onPasswordChange={setLoginPassword}
          onSubmit={handleLogin}
        />
      </div>
    );
  }

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
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />

      <Header
        lastUpdate={lastUpdate}
        isConnected={isConnected}
        onRefresh={handleRefresh}
        user={currentUser}
        onManualAlert={() => setManualAlertOpen(true)}
        onManageUsers={() => setUserManagementOpen(true)}
        onSignOut={handleSignOut}
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
          <ComponentStatusCard status={componentStatus} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-6">
          <div className="lg:col-span-2">
            <MainChart
              data={displayData}
              onTimeRangeChange={handleTimeRangeChange}
              currentRange={currentTimeRange}
            />
          </div>

          <div className="lg:col-span-1">
            <AlertsPanel
              alerts={alerts}
              canAcknowledge={isAdmin}
              onAcknowledge={handleAcknowledge}
            />
          </div>
        </div>

        {station && (
          <section className="mb-4 sm:mb-6">
            <StationDetail
              station={station}
              history={displayData}
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

      <ManualAlertDialog
        open={manualAlertOpen}
        onOpenChange={setManualAlertOpen}
        onConfirm={handleManualAlert}
      />

      <UserManagementDialog
        open={userManagementOpen}
        users={users}
        form={userForm}
        saving={savingUser}
        onOpenChange={setUserManagementOpen}
        onChange={setUserForm}
        onReset={resetUserForm}
        onEdit={editUser}
        onDisable={disableUser}
        onSave={saveUser}
      />
    </div>
  );
}

interface LoginModalProps {
  email: string;
  password: string;
  message: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const LoginModal = ({
  email,
  password,
  message,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: LoginModalProps) => (
  <Dialog open>
    <DialogContent showCloseButton={false} className="sm:max-w-md">
      <form onSubmit={onSubmit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>FloodMonitor Login</DialogTitle>
          <DialogDescription>Sign in to view the flood monitoring dashboard.</DialogDescription>
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

interface ManualAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

const ManualAlertDialog = ({ open, onOpenChange, onConfirm }: ManualAlertDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create Manual Alert</DialogTitle>
        <DialogDescription>
          This writes a HIGH manual alert into the existing history records.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={onConfirm}>Create Alert</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

interface UserManagementDialogProps {
  open: boolean;
  users: AppUser[];
  form: UserFormState;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (form: UserFormState) => void;
  onReset: () => void;
  onEdit: (user: AppUser) => void;
  onDisable: (user: AppUser) => Promise<void>;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}

const UserManagementDialog = ({
  open,
  users,
  form,
  saving,
  onOpenChange,
  onChange,
  onReset,
  onEdit,
  onDisable,
  onSave,
}: UserManagementDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>User Management</DialogTitle>
        <DialogDescription>Add, edit, or disable dashboard users.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
        <form onSubmit={onSave} className="space-y-3 rounded-lg border p-3">
          <div className="space-y-2">
            <Label htmlFor="user-name">Name</Label>
            <Input
              id="user-name"
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(event) => onChange({ ...form, email: event.target.value })}
              required
            />
          </div>

          {!form.uid && (
            <div className="space-y-2">
              <Label htmlFor="user-password">Password</Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(event) => onChange({ ...form, password: event.target.value })}
                minLength={6}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <select
                id="user-role"
                value={form.role}
                onChange={(event) => onChange({ ...form, role: event.target.value as 'Admin' | 'User' })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="Admin">Admin</option>
                <option value="User">User</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-disabled">Status</Label>
              <select
                id="user-disabled"
                value={form.disabled ? 'disabled' : 'active'}
                onChange={(event) => onChange({ ...form, disabled: event.target.value === 'disabled' })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving} className="flex-1">
              {form.uid ? 'Update User' : 'Add User'}
            </Button>
            <Button type="button" variant="outline" onClick={onReset}>Clear</Button>
          </div>
        </form>

        <ScrollArea className="h-[360px] rounded-lg border">
          <div className="divide-y">
            {users.map((user) => (
              <div key={user.uid} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  <p className="text-[10px] text-muted-foreground">{user.role} · {user.disabled ? 'Disabled' : 'Active'}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button type="button" variant="outline" size="sm" onClick={() => onEdit(user)}>Edit</Button>
                  <Button type="button" variant="outline" size="sm" disabled={user.disabled} onClick={() => onDisable(user)}>
                    Disable
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No users found.</p>
            )}
          </div>
        </ScrollArea>
      </div>
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
