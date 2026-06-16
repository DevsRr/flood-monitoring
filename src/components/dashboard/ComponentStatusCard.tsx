import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Circle, Radar, Siren } from 'lucide-react';
import type { ComponentStatus, SensorReading } from '@/types/floodData';

interface ComponentStatusCardProps {
  status: ComponentStatus;
  currentReading?: SensorReading | null;
  lastUpdate: Date;
  sirenOn: boolean;
  sirenLastUpdate: Date;
  onSirenToggle: (enabled: boolean) => Promise<void>;
}

const formatTimestamp = (date: Date) => (
  date.getTime() > 0
    ? date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'No update yet'
);

const getBadgeClass = (online: boolean, color: 'green' | 'orange' | 'red' | 'cyan' | 'gray' = 'green') => {
  if (!online || color === 'gray') return 'bg-slate-500/10 text-slate-600 border-slate-500/20';

  const colors = {
    green: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    orange: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    red: 'bg-red-500/10 text-red-600 border-red-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  };

  return colors[color];
};

const StatusBadge = ({ online, color }: { online: boolean; color?: 'green' | 'orange' | 'red' | 'cyan' }) => (
  <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${getBadgeClass(online, color)}`}>
    {online ? 'ONLINE' : 'OFFLINE'}
  </Badge>
);

export const ComponentStatusCard = ({
  status,
  currentReading,
  lastUpdate,
  sirenOn,
  sirenLastUpdate,
  onSirenToggle,
}: ComponentStatusCardProps) => {
  const cards = [
    {
      title: 'Red LED',
      online: status.redLedOnline,
      color: 'red' as const,
      icon: Circle,
      detail: status.redLedOnline ? 'Critical or high level active' : 'No high-level trigger',
      timestamp: lastUpdate,
    },
    {
      title: 'Orange LED',
      online: status.orangeLedOnline,
      color: 'orange' as const,
      icon: Circle,
      detail: status.orangeLedOnline ? 'Medium level active' : 'No medium-level trigger',
      timestamp: lastUpdate,
    },
    {
      title: 'Green LED',
      online: status.greenLedOnline,
      color: 'green' as const,
      icon: Circle,
      detail: status.greenLedOnline ? 'Normal level active' : 'Normal indicator inactive',
      timestamp: lastUpdate,
    },
    {
      title: 'Ultrasonic Sensor',
      online: status.ultrasonicOnline,
      color: 'cyan' as const,
      icon: Radar,
      detail: `Distance: ${currentReading?.waterLevel !== undefined ? `${currentReading.waterLevel.toFixed(2)} cm` : 'Last known unavailable'}`,
      timestamp: lastUpdate,
    },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm sm:text-base font-semibold">Component Status</h2>
        <p className="text-[10px] sm:text-xs text-muted-foreground">Admin-only device monitoring and siren override</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.title} className={`${getBadgeClass(card.online, card.color)} border-2 hover:shadow-md transition-all duration-300`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3">
                <CardTitle className="text-xs font-medium truncate">{card.title}</CardTitle>
                <div className="p-1.5 rounded-md bg-white/50 shrink-0">
                  <Icon className={`h-4 w-4 ${card.online ? '' : 'text-slate-400'}`} />
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                <StatusBadge online={card.online} color={card.color} />
                <p className="text-xs font-medium min-h-8">{card.detail}</p>
                <p className="text-[10px] opacity-70">Updated: {formatTimestamp(card.timestamp)}</p>
              </CardContent>
            </Card>
          );
        })}

        <Card className={`${sirenOn ? getBadgeClass(true, 'red') : getBadgeClass(false)} border-2 hover:shadow-md transition-all duration-300`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3">
            <CardTitle className="text-xs font-medium truncate">Siren Control</CardTitle>
            <div className="p-1.5 rounded-md bg-white/50 shrink-0">
              <Siren className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${sirenOn ? getBadgeClass(true, 'red') : getBadgeClass(false)}`}>
              {sirenOn ? 'ON' : 'OFF'}
            </Badge>
            <div className="flex items-center justify-between gap-3 rounded-md border bg-background/60 px-3 py-2">
              <span className="text-xs font-medium">Manual Override</span>
              <Switch checked={sirenOn} onCheckedChange={onSirenToggle} />
            </div>
            <p className="text-[10px] opacity-70">Updated: {formatTimestamp(sirenLastUpdate)}</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ComponentStatusCard;
