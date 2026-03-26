import { useState, useEffect, useCallback } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Header } from '@/components/dashboard/Header';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { MainChart } from '@/components/dashboard/MainChart';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { StationDetail } from '@/components/dashboard/StationDetail';
import { useFloodData, type TimeRange } from '@/hooks/useFloodData';
import type { ChartDataPoint } from '@/types/floodData';
import './App.css';

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
    currentTimeRange,
    acknowledgeAlert,
    setTimeRange
  } = useFloodData(false);

  const [displayData, setDisplayData] = useState<ChartDataPoint[]>([]);

  // Update display data when chartData changes
  useEffect(() => {
    if (chartData.length > 0) {
      setDisplayData(chartData);
    }
  }, [chartData]);

  // Handle new flood warning alerts
  useEffect(() => {
    const unacknowledgedFloodAlerts = alerts.filter(
      a => a.type === 'flood_warning' && !a.acknowledged && a.severity === 'critical'
    );
    
    unacknowledgedFloodAlerts.forEach(alert => {
      toast.error(alert.message, {
        description: new Date(alert.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        duration: 10000,
        action: {
          label: 'Acknowledge',
          onClick: () => acknowledgeAlert(alert.id)
        }
      });
    });
  }, [alerts, acknowledgeAlert]);

  const handleRefresh = () => {
    toast.info('Refreshing data...');
    setDisplayData([...chartData]);
  };

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
  }, [setTimeRange]);

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged && a.type === 'flood_warning').length;

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
        unacknowledgedAlerts={unacknowledgedCount}
      />

      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {/* Stats Overview */}
        <section className="mb-4 sm:mb-6">
          <StatsCards 
            stats={stats} 
            currentReading={station?.currentReading}
          />
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-6">
          {/* Main Chart - Takes 2 columns */}
          <div className="lg:col-span-2">
            <MainChart 
              data={displayData} 
              onTimeRangeChange={handleTimeRangeChange}
              currentRange={currentTimeRange}
            />
          </div>

          {/* Alerts Panel - Takes 1 column */}
          <div className="lg:col-span-1">
            <AlertsPanel 
              alerts={alerts} 
              onAcknowledge={acknowledgeAlert}
            />
          </div>
        </div>

        {/* Station Detail Section */}
        {station && (
          <section className="mb-4 sm:mb-6">
            <StationDetail 
              station={station}
              history={displayData}
            />
          </section>
        )}

        {/* History Table Section */}
        <section className="mb-4 sm:mb-6">
          <HistoryTable history={history.slice(-20).reverse()} />
        </section>

        {/* Footer */}
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
              <span className="hidden sm:inline">•</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

// History Table Component
interface HistoryTableProps {
  history: Array<{
    timestamp: number;
    waterLevel: number;
    status: string;
  }>;
}

const HistoryTable = ({ history }: HistoryTableProps) => {
  const getStatusBadge = (status: string) => {
    const styles = {
      normal: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      critical: 'bg-red-500/10 text-red-600 border-red-500/20',
      offline: 'bg-slate-500/10 text-slate-600 border-slate-500/20'
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
            </tr>
          </thead>
          <tbody>
            {history.map((reading, index) => (
              <tr key={index} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                  {new Date(reading.timestamp).toLocaleString([], { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium whitespace-nowrap">
                  {reading.waterLevel.toFixed(2)} m
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3">
                  <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium border ${getStatusBadge(reading.status)}`}>
                    {reading.status.toUpperCase()}
                  </span>
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
