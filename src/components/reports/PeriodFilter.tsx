import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Download, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

export type PeriodType = 'custom';

interface PeriodFilterProps {
  period: PeriodType;
  startDate: Date;
  endDate: Date;
  onPeriodChange: (period: PeriodType, startDate: Date, endDate: Date) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  lastUpdated?: Date;
}

export function PeriodFilter({
  startDate,
  endDate,
  onPeriodChange,
  onExport,
  onRefresh,
  lastUpdated,
}: PeriodFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>({ from: startDate, to: endDate });

  const handleRangeSelect = (range: DateRange | undefined) => {
    setTempRange(range);
    
    if (range?.from && range?.to) {
      onPeriodChange('custom', range.from, range.to);
      setCalendarOpen(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setCalendarOpen(open);
    if (open) {
      // Reset temp range when opening to allow fresh selection
      setTempRange(undefined);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 bg-card rounded-lg border shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarIcon className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Período:</span>

        {/* Date Range Picker */}
        <Popover open={calendarOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline"
              size="sm" 
              className="text-xs h-8 gap-2 min-w-[180px] justify-start"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>
                {format(startDate, 'dd/MM/yyyy', { locale: ptBR })} - {format(endDate, 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 border-b">
              <p className="text-sm text-muted-foreground">
                {!tempRange?.from ? 'Selecione a data inicial' : !tempRange?.to ? 'Selecione a data final' : 'Período selecionado'}
              </p>
            </div>
            <Calendar
              mode="range"
              selected={tempRange}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Actions Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lastUpdated && (
            <>
              <RefreshCw className="w-3 h-3" />
              <span>Atualizado: {format(lastUpdated, 'HH:mm', { locale: ptBR })}</span>
            </>
          )}
        </div>
        
        <div className="flex gap-2">
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} className="h-7 px-2">
              <RefreshCw className="w-3 h-3" />
            </Button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} className="h-7 px-2 gap-1">
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline text-xs">Exportar</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
