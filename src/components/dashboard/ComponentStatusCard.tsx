import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Circle, Radar } from 'lucide-react';
import type { ComponentStatus } from '@/types/floodData';

interface ComponentStatusCardProps {
  status: ComponentStatus;
}

const statusItems = (status: ComponentStatus) => [
  {
    label: 'Red LED',
    online: status.redLedOnline,
    iconClass: 'text-red-500 fill-red-500',
  },
  {
    label: 'Orange LED',
    online: status.orangeLedOnline,
    iconClass: 'text-orange-500 fill-orange-500',
  },
  {
    label: 'Green LED',
    online: status.greenLedOnline,
    iconClass: 'text-emerald-500 fill-emerald-500',
  },
  {
    label: 'Ultrasonic Sensor',
    online: status.ultrasonicOnline,
    iconClass: 'text-cyan-500',
  },
];

export const ComponentStatusCard = ({ status }: ComponentStatusCardProps) => (
  <Card className="border-2 hover:shadow-md transition-all duration-300">
    <CardHeader className="p-3 sm:p-4 pb-2">
      <CardTitle className="text-sm sm:text-base font-semibold">Component Status</CardTitle>
    </CardHeader>
    <CardContent className="p-3 sm:p-4 pt-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {statusItems(status).map((item) => {
          const Icon = item.label === 'Ultrasonic Sensor' ? Radar : Circle;

          return (
            <div
              key={item.label}
              className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 min-w-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className={`h-4 w-4 shrink-0 ${item.online ? item.iconClass : 'text-slate-400'}`} />
                <span className="text-xs sm:text-sm font-medium truncate">{item.label}</span>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] h-5 px-1.5 shrink-0 ${
                  item.online
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                }`}
              >
                {item.online ? 'ONLINE' : 'OFFLINE'}
              </Badge>
            </div>
          );
        })}
      </div>
    </CardContent>
  </Card>
);

export default ComponentStatusCard;
