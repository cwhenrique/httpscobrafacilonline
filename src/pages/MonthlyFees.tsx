import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useMonthlyFees } from '@/hooks/useMonthlyFees';
import { useClients } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate, getPaymentStatusColor, getPaymentStatusLabel } from '@/lib/calculations';
import { Plus, Calendar as CalendarIcon, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MonthlyFees() {
  const { monthlyFees, payments, loading, createMonthlyFee, generateMonthlyPayment, registerPayment } = useMonthlyFees();
  const { clients } = useClients();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    client_id: '',
    amount: '',
    description: '',
    dueDate: new Date(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMonthlyFee({
      client_id: formData.client_id,
      amount: parseFloat(formData.amount),
      description: formData.description,
      due_day: formData.dueDate.getDate(),
    });
    setIsDialogOpen(false);
    setFormData({ client_id: '', amount: '', description: '', dueDate: new Date() });
  };

  const handleGeneratePayment = async (feeId: string) => {
    await generateMonthlyPayment(feeId, new Date());
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    await registerPayment(paymentId, new Date().toISOString().split('T')[0]);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Mensalidades</h1>
            <p className="text-muted-foreground">Gerencie cobranças recorrentes</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Nova Mensalidade</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Mensalidade</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor *</Label>
                    <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Vencimento *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.dueDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.dueDate ? format(formData.dueDate, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={formData.dueDate}
                          onSelect={(date) => date && setFormData({ ...formData, dueDate: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit">Criar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="fees" className="space-y-4">
          <TabsList>
            <TabsTrigger value="fees">Mensalidades</TabsTrigger>
            <TabsTrigger value="payments">Cobranças</TabsTrigger>
          </TabsList>

          <TabsContent value="fees">
            <Card className="shadow-soft">
              <CardContent className="pt-6">
                {loading ? (
                  <div className="space-y-3">{[...Array(3)].map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}</div>
                ) : monthlyFees.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhuma mensalidade cadastrada</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Dia Venc.</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyFees.map((fee) => (
                        <TableRow key={fee.id}>
                          <TableCell className="font-medium">{fee.client?.full_name}</TableCell>
                          <TableCell>{formatCurrency(fee.amount)}</TableCell>
                          <TableCell>Dia {fee.due_day}</TableCell>
                          <TableCell><Badge className={fee.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>{fee.is_active ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => handleGeneratePayment(fee.id)}>Gerar Cobrança</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card className="shadow-soft">
              <CardContent className="pt-6">
                {loading ? (
                  <div className="space-y-3">{[...Array(3)].map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}</div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-12"><p className="text-muted-foreground">Nenhuma cobrança gerada</p></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">{(payment.monthly_fee as any)?.client?.full_name}</TableCell>
                          <TableCell>{formatCurrency(payment.amount)}</TableCell>
                          <TableCell>{formatDate(payment.due_date)}</TableCell>
                          <TableCell><Badge className={getPaymentStatusColor(payment.status)}>{getPaymentStatusLabel(payment.status)}</Badge></TableCell>
                          <TableCell className="text-right">
                            {payment.status !== 'paid' && (
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => handleMarkAsPaid(payment.id)}>
                                <Check className="w-3 h-3" />Pago
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
