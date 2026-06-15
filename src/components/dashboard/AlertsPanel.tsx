import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  Check,
  Clock
} from 'lucide-react';
import type { Alert } from '@/types/floodData';

interface AlertsPanelProps {
  alerts: Alert[];
  canAcknowledge: boolean;
  onAcknowledge: (alertId: string) => Promise<void>;
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'high':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'medium':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    default:
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  }
};

const getSeverityBorder = (severity: string) => {
  switch (severity) {
    case 'critical': return 'border-red-500/40 bg-red-500/5 hover:border-red-500/60';
    case 'high':     return 'border-orange-500/40 bg-orange-500/5 hover:border-orange-500/60';
    case 'medium':   return 'border-blue-500/40 bg-blue-500/5 hover:border-blue-500/60';
    default:         return 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50';
  }
};

export const AlertsPanel = ({ alerts, canAcknowledge, onAcknowledge }: AlertsPanelProps) => {
  const floodAlerts = alerts.filter(a => a.type === 'flood_warning');
  const unacknowledgedAlerts = floodAlerts.filter(a => !a.acknowledged);
  const acknowledgedAlerts = floodAlerts.filter(a => a.acknowledged);

  const renderAlert = (alert: Alert) => (
    <div
      key={alert.id}
      className={`
        p-3 rounded-lg border-2 mb-2 transition-all duration-200
        ${alert.acknowledged
          ? 'border-border bg-muted/30 opacity-60'
          : getSeverityBorder(alert.severity)
        }
      `}
    >
      {/* Top row: icon + title + badge */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <AlertTriangle className={`h-4 w-4 shrink-0 ${
          alert.severity === 'critical' ? 'text-red-500' :
          alert.severity === 'high'     ? 'text-orange-500' :
          alert.severity === 'medium'   ? 'text-blue-500' :
          'text-amber-500'
        }`} />
        <span className="font-semibold text-xs sm:text-sm">Flood Warning</span>
        <Badge
          variant="outline"
          className={`${getSeverityColor(alert.severity)} text-[10px] px-1.5 py-0 h-5`}
        >
          {alert.severity.toUpperCase()}
        </Badge>
      </div>

      {/* Message */}
      <p className="text-xs text-muted-foreground mb-2 break-words">
        {alert.message}
      </p>

      {/* Bottom row: time + ack button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {new Date(alert.timestamp).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        {!alert.acknowledged && canAcknowledge && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAcknowledge(alert.id)}
            className="shrink-0 h-7 px-3 text-xs font-medium"
          >
            <Check className="h-3 w-3 mr-1" />
            Acknowledge
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Card className="h-full">
      <CardHeader className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm sm:text-base font-semibold">Flood Alerts</CardTitle>
            {unacknowledgedAlerts.length > 0 && (
              <Badge variant="destructive" className="animate-pulse text-xs h-5 px-1.5">
                {unacknowledgedAlerts.length}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[250px] sm:h-[300px] md:h-[350px]">
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            {floodAlerts.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs sm:text-sm">No flood warnings</p>
              </div>
            ) : (
              <>
                {unacknowledgedAlerts.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1.5">
                      New ({unacknowledgedAlerts.length})
                    </h4>
                    {unacknowledgedAlerts.map(renderAlert)}
                  </div>
                )}
                {acknowledgedAlerts.length > 0 && (
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1.5">
                      Acknowledged ({acknowledgedAlerts.length})
                    </h4>
                    {acknowledgedAlerts.map(renderAlert)}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AlertsPanel;
