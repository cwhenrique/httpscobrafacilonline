import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useIPTVPlans, IPTVPlan, CreateIPTVPlanData } from '@/hooks/useIPTVPlans';
import { Settings, Plus, Pencil, Trash2, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) => {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};

export default function IPTVPlanManager() {
  const { plans, createPlan, updatePlan, deletePlan, toggleActive } = useIPTVPlans();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<IPTVPlan | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CreateIPTVPlanData>({
    name: '',
    price: 0,
    max_devices: 1,
    description: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      price: 0,
      max_devices: 1,
      description: '',
    });
  };

  const handleCreate = async () => {
    await createPlan.mutateAsync(formData);
    setIsCreateOpen(false);
    resetForm();
  };

  const handleUpdate = async () => {
    if (!editingPlan) return;
    await updatePlan.mutateAsync({
      id: editingPlan.id,
      data: formData,
    });
    setEditingPlan(null);
    resetForm();
  };

  const handleDelete = async () => {
    if (!deletePlanId) return;
    await deletePlan.mutateAsync(deletePlanId);
    setDeletePlanId(null);
  };

  const openEditDialog = (plan: IPTVPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      price: plan.price,
      max_devices: plan.max_devices,
      description: plan.description || '',
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="w-4 h-4" />
            Gerenciar Planos
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tv className="w-5 h-5" />
              Planos IPTV
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Create new plan button */}
            <Button 
              className="w-full gap-2" 
              onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Novo Plano
            </Button>

            {/* Plans list */}
            <div className="space-y-3">
              {plans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Tv className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum plano cadastrado</p>
                  <p className="text-sm">Crie planos para facilitar o cadastro de assinaturas</p>
                </div>
              ) : (
                plans.map((plan) => (
                  <div 
                    key={plan.id} 
                    className={cn(
                      "p-4 rounded-lg border transition-all",
                      plan.is_active 
                        ? "bg-card" 
                        : "bg-muted/30 opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{plan.name}</h4>
                          {!plan.is_active && (
                            <Badge variant="secondary" className="text-xs">Inativo</Badge>
                          )}
                        </div>
                        <p className="text-lg font-bold text-primary mt-1">
                          {formatCurrency(plan.price)}
                          <span className="text-sm font-normal text-muted-foreground">/mês</span>
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                          <span>📺 {plan.max_devices} {plan.max_devices === 1 ? 'tela' : 'telas'}</span>
                        </div>
                        {plan.description && (
                          <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={plan.is_active}
                          onCheckedChange={(checked) => toggleActive.mutate({ id: plan.id, is_active: checked })}
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => openEditDialog(plan)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeletePlanId(plan.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Plan Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Plano IPTV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Plano *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Premium, Gold, Basic..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Mensal (R$) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price || ''}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  placeholder="50.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Qtd. Dispositivos</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_devices || 1}
                  onChange={(e) => setFormData({ ...formData, max_devices: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalhes do plano..."
                rows={2}
              />
            </div>
            <Button 
              onClick={handleCreate} 
              disabled={!formData.name || !formData.price || createPlan.isPending}
              className="w-full"
            >
              {createPlan.isPending ? 'Salvando...' : 'Criar Plano'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Plano</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Plano *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Mensal (R$) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price || ''}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Qtd. Dispositivos</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_devices || 1}
                  onChange={(e) => setFormData({ ...formData, max_devices: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            <Button 
              onClick={handleUpdate} 
              disabled={!formData.name || !formData.price || updatePlan.isPending}
              className="w-full"
            >
              {updatePlan.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePlanId} onOpenChange={(open) => !open && setDeletePlanId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Plano</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.
              As assinaturas existentes não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
