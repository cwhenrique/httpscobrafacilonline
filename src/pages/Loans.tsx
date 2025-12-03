import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLoans } from '@/hooks/useLoans';
import { useClients } from '@/hooks/useClients';
import { InterestType, LoanPaymentType } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate, getPaymentStatusColor, getPaymentStatusLabel, formatPercentage } from '@/lib/calculations';
import { Plus, Search, Trash2, DollarSign, CreditCard } from 'lucide-react';

export default function Loans() {
  const { loans, loading, createLoan, registerPayment, deleteLoan } = useLoans();
  const { clients } = useClients();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    client_id: '',
    principal_amount: '',
    interest_rate: '',
    interest_type: 'simple' as InterestType,
    payment_type: 'single' as LoanPaymentType,
    installments: '1',
    start_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    principal_paid: '',
    interest_paid: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const filteredLoans = loans.filter(loan =>
    loan.client?.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const loanClients = clients.filter(c => c.client_type === 'loan' || c.client_type === 'both');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLoan({
      ...formData,
      principal_amount: parseFloat(formData.principal_amount),
      interest_rate: parseFloat(formData.interest_rate),
      installments: parseInt(formData.installments),
    });
    setIsDialogOpen(false);
    resetForm();
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId) return;
    await registerPayment({
      loan_id: selectedLoanId,
      amount: parseFloat(paymentData.amount),
      principal_paid: parseFloat(paymentData.principal_paid),
      interest_paid: parseFloat(paymentData.interest_paid),
      payment_date: paymentData.payment_date,
      notes: paymentData.notes,
    });
    setIsPaymentDialogOpen(false);
    setSelectedLoanId(null);
    setPaymentData({ amount: '', principal_paid: '', interest_paid: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
  };

  const resetForm = () => {
    setFormData({
      client_id: '', principal_amount: '', interest_rate: '', interest_type: 'simple',
      payment_type: 'single', installments: '1', start_date: new Date().toISOString().split('T')[0], due_date: '', notes: '',
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Empréstimos</h1>
            <p className="text-muted-foreground">Gerencie seus empréstimos</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Novo Empréstimo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo Empréstimo</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                    <SelectContent>
                      {loanClients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor *</Label>
                    <Input type="number" step="0.01" value={formData.principal_amount} onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Taxa de Juros (%) *</Label>
                    <Input type="number" step="0.01" value={formData.interest_rate} onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Juros</Label>
                    <Select value={formData.interest_type} onValueChange={(v: InterestType) => setFormData({ ...formData, interest_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">Simples</SelectItem>
                        <SelectItem value="compound">Composto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modalidade</Label>
                    <Select value={formData.payment_type} onValueChange={(v: LoanPaymentType) => setFormData({ ...formData, payment_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Pagamento Único</SelectItem>
                        <SelectItem value="installment">Parcelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Vencimento *</Label>
                    <Input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit">Criar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar empréstimos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}</div>
            ) : filteredLoans.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{search ? 'Nenhum empréstimo encontrado' : 'Nenhum empréstimo cadastrado'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Taxa</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium">{loan.client?.full_name}</TableCell>
                        <TableCell>{formatCurrency(loan.principal_amount)}</TableCell>
                        <TableCell>{formatPercentage(loan.interest_rate)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(loan.remaining_balance)}</TableCell>
                        <TableCell>{formatDate(loan.due_date)}</TableCell>
                        <TableCell><Badge className={getPaymentStatusColor(loan.status)}>{getPaymentStatusLabel(loan.status)}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedLoanId(loan.id); setIsPaymentDialogOpen(true); }}>
                              <CreditCard className="w-4 h-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(loan.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Valor Total *</Label>
                <Input type="number" step="0.01" value={paymentData.amount} onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Principal Pago</Label>
                  <Input type="number" step="0.01" value={paymentData.principal_paid} onChange={(e) => setPaymentData({ ...paymentData, principal_paid: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Juros Pago</Label>
                  <Input type="number" step="0.01" value={paymentData.interest_paid} onChange={(e) => setPaymentData({ ...paymentData, interest_paid: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Data do Pagamento</Label>
                <Input type="date" value={paymentData.payment_date} onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Registrar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir este empréstimo?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { deleteLoan(deleteId!); setDeleteId(null); }} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
