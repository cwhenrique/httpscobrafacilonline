import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Users, Plus, Trash2, Edit, Loader2, Lock, Check, UserCheck, UserX, AlertTriangle, KeyRound, UserCog, Circle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { EmployeePermission } from '@/hooks/useEmployeeContext';
import { ClientAssignmentDialog } from '@/components/ClientAssignmentDialog';

interface Employee {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  employee_user_id: string;
  permissions: EmployeePermission[];
  last_seen_at: string | null;
  last_login_at: string | null;
}

const PERMISSION_GROUPS = {
  'Empréstimos': [
    { key: 'view_loans' as EmployeePermission, label: 'Ver empréstimos próprios' },
    { key: 'view_all_loans' as EmployeePermission, label: 'Ver TODOS os empréstimos' },
    { key: 'create_loans' as EmployeePermission, label: 'Criar empréstimos' },
    { key: 'register_payments' as EmployeePermission, label: 'Registrar pagamentos' },
    { key: 'adjust_dates' as EmployeePermission, label: 'Ajustar datas/renegociar' },
    { key: 'delete_loans' as EmployeePermission, label: 'Excluir empréstimos' },
  ],
  'Clientes': [
    { key: 'view_clients' as EmployeePermission, label: 'Ver clientes próprios' },
    { key: 'view_all_clients' as EmployeePermission, label: 'Ver TODOS os clientes' },
    { key: 'create_clients' as EmployeePermission, label: 'Cadastrar clientes' },
    { key: 'edit_clients' as EmployeePermission, label: 'Editar clientes' },
    { key: 'delete_clients' as EmployeePermission, label: 'Excluir clientes' },
  ],
  'Outros': [
    { key: 'view_dashboard' as EmployeePermission, label: 'Ver Dashboard (resumo financeiro)' },
    { key: 'view_reports' as EmployeePermission, label: 'Ver relatórios' },
    { key: 'manage_bills' as EmployeePermission, label: 'Gerenciar contas' },
    { key: 'manage_vehicles' as EmployeePermission, label: 'Gerenciar veículos' },
    { key: 'manage_products' as EmployeePermission, label: 'Gerenciar produtos' },
    { key: 'view_settings' as EmployeePermission, label: 'Ver configurações' },
    { key: 'view_calendar' as EmployeePermission, label: 'Ver calendário de cobranças' },
  ],
};

export default function EmployeeManagement() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [disableLoginOnDelete, setDisableLoginOnDelete] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [maxEmployees, setMaxEmployees] = useState(3);
  const [showClientAssignmentDialog, setShowClientAssignmentDialog] = useState(false);
  const [employeeForAssignment, setEmployeeForAssignment] = useState<Employee | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [formPermissions, setFormPermissions] = useState<EmployeePermission[]>([]);

  useEffect(() => {
    fetchEmployees();
    fetchMaxEmployees();
  }, [user?.id]);

  async function fetchMaxEmployees() {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('max_employees')
      .eq('id', user.id)
      .single();
    if (data?.max_employees) {
      setMaxEmployees(data.max_employees);
    }
  }

  async function fetchEmployees() {
    if (!user) return;
    setLoading(true);

    try {
      const { data: employeesData, error } = await supabase
        .from('employees')
        .select('id, name, email, is_active, created_at, employee_user_id, last_seen_at, last_login_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar permissões para cada funcionário
      const employeesWithPermissions: Employee[] = [];
      for (const emp of employeesData || []) {
        const { data: perms } = await supabase
          .from('employee_permissions')
          .select('permission')
          .eq('employee_id', emp.id);

        employeesWithPermissions.push({
          ...emp,
          permissions: (perms || []).map(p => p.permission as EmployeePermission),
        });
      }

      setEmployees(employeesWithPermissions);
    } catch (err) {
      console.error('Erro ao buscar funcionários:', err);
      toast.error('Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword('');
    setFormConfirmPassword('');
    setFormPermissions([]);
  }

  function formatPhone(value: string) {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  }

  async function handleAddEmployee() {
    if (!formName.trim() || !formEmail.trim()) {
      toast.error('Preencha nome e email');
      return;
    }

    if (!formPassword || formPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (formPassword !== formConfirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }

    if (employees.length >= maxEmployees) {
      toast.error(`Limite de ${maxEmployees} funcionários atingido`);
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: {
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          phone: formPhone.replace(/\D/g, ''),
          password: formPassword,
          permissions: formPermissions,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Funcionário cadastrado com sucesso!', {
        description: 'O funcionário pode acessar usando o email e senha definidos.',
      });

      setShowAddDialog(false);
      resetForm();
      fetchEmployees();
    } catch (err: any) {
      console.error('Erro ao adicionar funcionário:', err);
      toast.error(err.message || 'Erro ao adicionar funcionário');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateEmployee() {
    if (!selectedEmployee) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-employee', {
        body: {
          employeeId: selectedEmployee.id,
          permissions: formPermissions,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Permissões atualizadas!');
      setShowEditDialog(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (err: any) {
      console.error('Erro ao atualizar funcionário:', err);
      toast.error(err.message || 'Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(employee: Employee) {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ is_active: !employee.is_active })
        .eq('id', employee.id);

      if (error) throw error;

      toast.success(employee.is_active ? 'Funcionário desativado' : 'Funcionário ativado');
      fetchEmployees();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      toast.error('Erro ao alterar status');
    }
  }

  function openDeleteDialog(employee: Employee) {
    setEmployeeToDelete(employee);
    setDisableLoginOnDelete(true);
    setShowDeleteDialog(true);
  }

  async function handleDeleteEmployee() {
    if (!employeeToDelete) return;

    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-employee', {
        body: {
          employeeId: employeeToDelete.id,
          disableLogin: disableLoginOnDelete,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(
        disableLoginOnDelete 
          ? 'Funcionário removido e acesso desativado' 
          : 'Funcionário removido'
      );
      
      setShowDeleteDialog(false);
      setEmployeeToDelete(null);
      fetchEmployees();
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      toast.error(err.message || 'Erro ao excluir funcionário');
    } finally {
      setDeleting(false);
    }
  }

  function openEditDialog(employee: Employee) {
    setSelectedEmployee(employee);
    setFormPermissions(employee.permissions);
    setShowEditDialog(true);
  }

  async function handleResetPassword() {
    if (!selectedEmployee) return;

    setResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: {
          email: selectedEmployee.email,
          newPassword: '123456',
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Senha resetada para 123456', {
        description: `A senha de ${selectedEmployee.name} foi alterada.`,
      });
    } catch (err: any) {
      console.error('Erro ao resetar senha:', err);
      toast.error(err.message || 'Erro ao resetar senha');
    } finally {
      setResettingPassword(false);
    }
  }

  function togglePermission(permission: EmployeePermission) {
    setFormPermissions(prev => {
      if (prev.includes(permission)) {
        return prev.filter(p => p !== permission);
      }
      const updated = [...prev, permission];
      // Auto-selecionar view_all_clients quando view_all_loans é marcado
      if (permission === 'view_all_loans' && !updated.includes('view_all_clients')) {
        updated.push('view_all_clients');
      }
      return updated;
    });
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <CardTitle>Funcionários</CardTitle>
              <CardDescription>
                {employees.length} de {maxEmployees} funcionários cadastrados
              </CardDescription>
            </div>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                disabled={employees.length >= maxEmployees}
                onClick={() => { resetForm(); setShowAddDialog(true); }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Adicionar Funcionário</DialogTitle>
                <DialogDescription>
                  Cadastre um novo funcionário com acesso limitado à sua conta.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Nome do funcionário"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formPhone}
                    onChange={e => setFormPhone(formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha de Acesso *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formConfirmPassword}
                    onChange={e => setFormConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Permissões</Label>
                  {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                    <div key={group} className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">{group}</p>
                      <div className="grid gap-2">
                        {perms.map(perm => (
                          <Button
                            key={perm.key}
                            type="button"
                            variant={formPermissions.includes(perm.key) ? 'default' : 'outline'}
                            size="sm"
                            className={`justify-start gap-2 w-full ${
                              formPermissions.includes(perm.key) 
                                ? 'bg-green-600 hover:bg-green-700 text-white' 
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => togglePermission(perm.key)}
                          >
                            {formPermissions.includes(perm.key) ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Lock className="w-4 h-4" />
                            )}
                            {perm.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddEmployee} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {employees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum funcionário cadastrado</p>
            <p className="text-sm">Adicione funcionários para compartilhar acesso limitado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {employees.map(employee => (
              <div
                key={employee.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    employee.is_active ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    {employee.is_active ? (
                      <UserCheck className="w-5 h-5 text-primary" />
                    ) : (
                      <UserX className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{employee.name}</span>
                      {employee.is_active ? (
                        <Badge variant="default" className="text-xs">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inativo</Badge>
                      )}
                      {/* Status online indicator */}
                      {employee.is_active && (() => {
                        const lastSeen = employee.last_seen_at ? new Date(employee.last_seen_at) : null;
                        const now = new Date();
                        const diffMinutes = lastSeen ? (now.getTime() - lastSeen.getTime()) / 60000 : Infinity;
                        
                        if (diffMinutes <= 3) {
                          return (
                            <Badge className="text-xs bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20">
                              <Circle className="w-2 h-2 mr-1 fill-green-500 text-green-500" />
                              Online
                            </Badge>
                          );
                        } else if (diffMinutes <= 30) {
                          return (
                            <Badge className="text-xs bg-yellow-500/15 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/20">
                              <Circle className="w-2 h-2 mr-1 fill-yellow-500 text-yellow-500" />
                              Recente
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <p className="text-sm text-muted-foreground">{employee.email}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {employee.permissions.length} permissões
                      </p>
                      {employee.is_active && (() => {
                        const lastSeen = employee.last_seen_at ? new Date(employee.last_seen_at) : null;
                        const now = new Date();
                        const diffMinutes = lastSeen ? (now.getTime() - lastSeen.getTime()) / 60000 : Infinity;
                        
                        if (diffMinutes > 3 && lastSeen) {
                          return (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Visto {formatDistanceToNow(lastSeen, { addSuffix: true, locale: ptBR })}
                            </p>
                          );
                        } else if (!lastSeen) {
                          return (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Nunca acessou
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={employee.is_active}
                    onCheckedChange={() => handleToggleActive(employee)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Atribuir clientes"
                    onClick={() => {
                      setEmployeeForAssignment(employee);
                      setShowClientAssignmentDialog(true);
                    }}
                  >
                    <UserCog className="w-4 h-4 text-primary" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(employee)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDeleteDialog(employee)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Dialog de edição */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Funcionário</DialogTitle>
            <DialogDescription>
              {selectedEmployee?.name} - {selectedEmployee?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Resetar Senha */}
            <div className="p-3 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Resetar Senha</p>
                    <p className="text-xs text-muted-foreground">A nova senha será: 123456</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleResetPassword}
                  disabled={resettingPassword}
                >
                  {resettingPassword ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Resetar'
                  )}
                </Button>
              </div>
            </div>

            {/* Permissões */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Permissões</p>
              {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                <div key={group} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{group}</p>
                  <div className="grid gap-2">
                    {perms.map(perm => (
                      <Button
                        key={perm.key}
                        type="button"
                        variant={formPermissions.includes(perm.key) ? 'default' : 'outline'}
                        size="sm"
                        className={`justify-start gap-2 w-full ${
                          formPermissions.includes(perm.key) 
                            ? 'bg-green-600 hover:bg-green-700 text-white' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => togglePermission(perm.key)}
                      >
                        {formPermissions.includes(perm.key) ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                        {perm.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateEmployee} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Excluir Funcionário
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Tem certeza que deseja excluir <strong>{employeeToDelete?.name}</strong>?
              </p>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Checkbox
                  id="disable-login"
                  checked={disableLoginOnDelete}
                  onCheckedChange={(checked) => setDisableLoginOnDelete(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="disable-login" className="text-sm font-medium cursor-pointer">
                    Desativar acesso ao sistema
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {disableLoginOnDelete 
                      ? 'O funcionário não poderá mais fazer login no sistema.'
                      : 'O funcionário ainda poderá acessar o sistema com conta própria (sem vínculo).'}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteEmployee}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de atribuição de clientes */}
      {employeeForAssignment && (
        <ClientAssignmentDialog
          open={showClientAssignmentDialog}
          onOpenChange={(open) => {
            setShowClientAssignmentDialog(open);
            if (!open) setEmployeeForAssignment(null);
          }}
          employeeId={employeeForAssignment.id}
          employeeName={employeeForAssignment.name}
        />
      )}
    </Card>
  );
}
