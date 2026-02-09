import { useState, useMemo } from 'react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/calculations';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertTriangle, Clock, User, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CalendarEvent {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  status: string;
  installmentNumber?: number;
  totalInstallments?: number;
  description?: string;
  isOverdue: boolean;
}

interface TabCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  events: CalendarEvent[];
  accentColor?: string;
}

export default function TabCalendarDialog({ open, onOpenChange, title, events, accentColor = 'primary' }: TabCalendarDialogProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach(event => {
      if (event.status === 'paid') return;
      const key = event.dueDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    });
    return map;
  }, [events]);

  // Calendar days
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const startDay = start.getDay();
    const paddingDays = [];
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(start);
      date.setDate(date.getDate() - (i + 1));
      paddingDays.push({ date, isOutside: true });
    }
    return [...paddingDays, ...days.map(date => ({ date, isOutside: false }))];
  }, [currentMonth]);

  // Day status
  const getDayStatus = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    const dayEvents = eventsByDate.get(key);
    if (!dayEvents || dayEvents.length === 0) return null;
    const hasOverdue = dayEvents.some(e => e.isOverdue);
    if (hasOverdue) return 'overdue';
    return 'pending';
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'overdue': return 'bg-destructive text-destructive-foreground';
      case 'pending': return 'bg-warning text-warning-foreground';
      default: return '';
    }
  };

  // Selected date events
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return eventsByDate.get(key) || [];
  }, [selectedDate, eventsByDate]);

  // Month stats
  const monthStats = useMemo(() => {
    let totalDue = 0;
    let overdueCount = 0;
    let pendingCount = 0;

    calendarDays.forEach(({ date, isOutside }) => {
      if (isOutside) return;
      const key = format(date, 'yyyy-MM-dd');
      const dayEvents = eventsByDate.get(key);
      if (!dayEvents) return;
      dayEvents.forEach(event => {
        totalDue += event.amount;
        if (event.isOverdue) overdueCount++;
        else pendingCount++;
      });
    });

    return { totalDue, overdueCount, pendingCount };
  }, [calendarDays, eventsByDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="p-3 text-center">
              <Clock className="w-4 h-4 mx-auto text-warning mb-1" />
              <p className="text-xs text-muted-foreground">A Vencer</p>
              <p className="text-lg font-bold">{monthStats.pendingCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <AlertTriangle className="w-4 h-4 mx-auto text-destructive mb-1" />
              <p className="text-xs text-muted-foreground">Vencidos</p>
              <p className="text-lg font-bold">{monthStats.overdueCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <CalendarIcon className="w-4 h-4 mx-auto text-primary mb-1" />
              <p className="text-xs text-muted-foreground">Total no Mês</p>
              <p className="text-sm font-bold truncate">{formatCurrency(monthStats.totalDue)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          {/* Calendar */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setCurrentMonth(new Date())}>
                  Hoje
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map(({ date, isOutside }, index) => {
                const status = getDayStatus(date);
                const dateKey = format(date, 'yyyy-MM-dd');
                const eventCount = eventsByDate.get(dateKey)?.length || 0;
                const isSelected = selectedDate && isSameDay(date, selectedDate);

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      'relative aspect-square p-0.5 rounded-md transition-all hover:bg-muted/50 border border-transparent',
                      isOutside && 'opacity-30',
                      isToday(date) && 'ring-1 ring-primary ring-offset-1 border-primary',
                      isSelected && 'bg-primary/10 ring-1 ring-primary border-primary',
                    )}
                  >
                    <span className={cn('text-xs', isToday(date) && 'font-bold text-primary')}>
                      {format(date, 'd')}
                    </span>
                    {eventCount > 0 && (
                      <div className={cn(
                        'absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold',
                        getStatusColor(status)
                      )}>
                        {eventCount}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-4 mt-3 pt-3 border-t">
              <div className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2.5 h-2.5 rounded-full bg-warning" />
                <span>A Vencer</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
                <span>Vencido</span>
              </div>
            </div>
          </div>

          {/* Selected Date Details */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold mb-2">
              {selectedDate
                ? format(selectedDate, "d 'de' MMMM", { locale: ptBR })
                : 'Selecione uma data'}
            </h3>
            {selectedDate ? (
              selectedDateEvents.length > 0 ? (
                <ScrollArea className="h-[350px] pr-2">
                  <div className="space-y-2">
                    {selectedDateEvents.map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          'p-2.5 rounded-lg border',
                          event.isOverdue
                            ? 'bg-destructive/5 border-destructive/20'
                            : 'bg-warning/5 border-warning/20'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className={cn(
                            'p-1.5 rounded-full flex-shrink-0',
                            event.isOverdue ? 'bg-destructive/10' : 'bg-warning/10'
                          )}>
                            {event.isOverdue
                              ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                              : <Clock className="w-3.5 h-3.5 text-warning" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium truncate text-sm">{event.clientName}</span>
                              {event.installmentNumber && event.totalInstallments && (
                                <Badge variant="secondary" className="text-[10px] ml-auto">
                                  {event.installmentNumber}/{event.totalInstallments}
                                </Badge>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mb-1">{event.description}</p>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Valor:</span>
                              <span className="font-bold text-sm">{formatCurrency(event.amount)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum vencimento nesta data</p>
                </div>
              )
            ) : (
              <div className="text-center py-8">
                <CalendarIcon className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Clique em uma data para ver os vencimentos</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
