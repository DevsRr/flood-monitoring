import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Activity, 
  AlertTriangle, 
  AlertOctagon, 
  Cpu,
  Droplets, 
  TrendingUp,
  TrendingDown,
  Minus,
  Clock
} from 'lucide-react';
import type { ComponentStatus, DashboardStats, SensorReading } from '@/types/floodData';

interface StatsCardsProps {
  stats: DashboardStats;
  currentReading?: SensorReading | null;
  componentStatus: ComponentStatus;
}

const getTrend = (current: number, previous?: number) => {
  if (previous === undefined) return { icon: Minus, color: 'text-slate-500', value: '0' };
  const diff = current - previous;
  if (diff > 0) return { icon: TrendingUp, color: 'text-red-500', value: `+${diff.toFixed(2)}` };
  if (diff < 0) return { icon: TrendingDown, color: 'text-emerald-500', value: diff.toFixed(2) };
  return { icon: Minus, color: 'text-slate-500', value: '0' };
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'normal':
      return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    case 'moderate':
      return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    case 'warning':
      return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    case 'critical':
      return 'text-red-500 bg-red-500/10 border-red-500/20';
    case 'offline':
      return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    default:
      return 'text-slate-500 bg-slate-500/10';
  }
};

export const StatsCards = ({ stats, currentReading, componentStatus }: StatsCardsProps) => {
  const waterLevelTrend = getTrend(currentReading?.waterLevel || 0, (currentReading?.waterLevel || 0) - 0.1);
  const onlineComponents = [
    componentStatus.redLedOnline,
    componentStatus.orangeLedOnline,
    componentStatus.greenLedOnline,
    componentStatus.ultrasonicOnline,
  ].filter(Boolean).length;

  const cards = [
    {
      title: 'Status',
      value: currentReading?.status?.toUpperCase() || 'UNKNOWN',
      icon: Activity,
      color: getStatusColor(currentReading?.status || 'offline'),
      trend: null,
      subtitle: 'Station'
    },
    {
      title: 'Water Level',
      value: `${currentReading?.waterLevel?.toFixed(2) || '--'} cm`,
      icon: Droplets,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      trend: waterLevelTrend,
      subtitle: 'Current'
    },
    {
      title: 'Avg Level',
      value: `${stats.avgWaterLevel.toFixed(2)} cm`,
      icon: Droplets,
      color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
      trend: null,
      subtitle: 'Average'
    },
    {
      title: 'Max Level',
      value: `${stats.maxWaterLevel.toFixed(2)} cm`,
      icon: Droplets,
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
      trend: null,
      subtitle: 'Peak'
    },
    {
      title: 'Last Update',
      value: currentReading ? new Date(currentReading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
      icon: Clock,
      color: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
      trend: null,
      subtitle: 'Time'
    },
    {
      title: 'Alerts',
      value: (stats.moderateStations ?? 0) + stats.warningStations + stats.criticalStations,
      icon: stats.criticalStations > 0 ? AlertOctagon : stats.warningStations > 0 ? AlertTriangle : Activity,
      color: stats.criticalStations > 0  ? 'text-red-500 bg-red-500/10 border-red-500/20' :
             stats.warningStations > 0   ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
             (stats.moderateStations ?? 0) > 0 ? 'text-blue-500 bg-blue-500/10 border-blue-500/20' :
             'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      trend: null,
      subtitle: 'Flood Warnings'
    },
    {
      title: 'Component Status',
      value: `${onlineComponents}/4`,
      icon: Cpu,
      color: componentStatus.ultrasonicOnline
        ? 'text-teal-500 bg-teal-500/10 border-teal-500/20'
        : 'text-slate-500 bg-slate-500/10 border-slate-500/20',
      trend: null,
      subtitle: 'Online'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
      {cards.map((card, index) => (
        <Card 
          key={index} 
          className={`${card.color} border-2 hover:shadow-md transition-all duration-300`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3">
            <CardTitle className="text-[10px] sm:text-xs font-medium opacity-80 truncate">
              {card.title}
            </CardTitle>
            <div className={`p-1.5 rounded-md bg-white/50 shrink-0`}>
              <card.icon className="h-3 w-3 sm:h-4 sm:w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-base sm:text-lg lg:text-xl font-bold truncate">{card.value}</div>
            {card.trend && (
              <div className={`flex items-center gap-1 text-[10px] sm:text-xs mt-0.5 ${card.trend.color}`}>
                <card.trend.icon className="h-3 w-3" />
                <span className="truncate">{card.trend.value}cm</span>
              </div>
            )}
            {card.subtitle && !card.trend && (
              <p className="text-[10px] sm:text-xs opacity-70 mt-0.5 truncate">{card.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;
