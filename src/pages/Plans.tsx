import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  Calendar,
  CheckCircle2,
  Shield,
  Star,
  Zap,
  Sparkles,
  Crown,
  LayoutDashboard,
  Users,
  Calculator,
  MessageSquare,
  QrCode,
  CalendarDays,
  TrendingUp,
  FileText,
  Wallet,
  ShoppingCart,
  BarChart3,
  FileSignature,
  Headphones,
  RefreshCw,
  ArrowUp,
  MessageCircle,
  Check,
  Infinity,
  ChevronDown,
} from "lucide-react";
import { useAffiliateLinks, DEFAULT_AFFILIATE_LINKS } from "@/hooks/useAffiliateLinks";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import cobrafacilLogo from "@/assets/cobrafacil-logo.png";

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

const features = [
  { icon: LayoutDashboard, label: "Dashboard Inteligente" },
  { icon: Infinity, label: "Empréstimos ilimitados" },
  { icon: Users, label: "Clientes ilimitados" },
  { icon: Calculator, label: "Cálculo automático de juros" },
  { icon: MessageSquare, label: "WhatsApp integrado" },
  { icon: QrCode, label: "Conexão QR Code" },
  { icon: CalendarDays, label: "Calendário de cobranças" },
  { icon: TrendingUp, label: "Score de clientes" },
  { icon: Zap, label: "Simulador de empréstimos" },
  { icon: FileText, label: "Comprovantes PDF" },
  { icon: Wallet, label: "Contas a pagar/receber" },
  { icon: ShoppingCart, label: "Venda de produtos e veículos" },
  { icon: BarChart3, label: "Relatórios detalhados" },
  { icon: FileSignature, label: "Contratos digitais" },
  { icon: Headphones, label: "Suporte via WhatsApp" },
  { icon: RefreshCw, label: "Atualizações gratuitas" },
];

const faqItems = [
  {
    q: "Posso trocar de plano depois?",
    a: "Sim! Você pode fazer upgrade a qualquer momento. O valor restante do plano atual é descontado proporcionalmente.",
  },
  {
    q: "O que acontece quando meu plano vence?",
    a: "Seus dados ficam salvos por 30 dias. Basta renovar para voltar a ter acesso completo ao sistema.",
  },
  {
    q: "O plano vitalício realmente não tem mensalidade?",
    a: "Correto! Você paga uma única vez e tem acesso permanente ao sistema, incluindo todas as atualizações futuras.",
  },
  {
    q: "Todas as funcionalidades estão liberadas em todos os planos?",
    a: "Sim! Todos os planos incluem 100% das funcionalidades. A única diferença é o período de acesso e o preço.",
  },
  {
    q: "Como funciona a garantia de 7 dias?",
    a: "Se você não gostar do sistema por qualquer motivo, basta solicitar o reembolso em até 7 dias após a compra. Devolvemos 100% do valor, sem perguntas.",
  },
];

const featuresList = [
  "Clientes ilimitados",
  "Empréstimos ilimitados",
  "Cálculo automático de juros",
  "Alertas WhatsApp para você",
  "Cobranças WhatsApp para clientes",
  "Calendário de cobranças",
  "Score de clientes",
  "Relatórios da operação",
  "Comprovantes em PDF",
  "Taxas de renovação",
  "Venda de veículos ou produtos",
  "Suporte via WhatsApp",
  "Atualizações gratuitas",
];

const Plans = () => {
  const { user } = useAuth();
  const { links, loading } = useAffiliateLinks();
  const [openPlan, setOpenPlan] = useState<string | null>(null);

  const effectiveLinks = user && !loading ? links : DEFAULT_AFFILIATE_LINKS;

  const togglePlan = (planId: string) => {
    setOpenPlan(prev => prev === planId ? null : planId);
  };

  const scrollToPlans = () => {
    document.getElementById("plans-grid")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={cobrafacilLogo} alt="CobraFácil" className="h-8" />
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={scrollToPlans}>
              Ver Planos
            </Button>
            <Link to="/auth">
              <Button size="sm">Entrar</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 pb-12 px-4 text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ duration: 0.6 }}
        >
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">
            <Shield className="w-3 h-3 mr-1" /> Garantia de 7 dias
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold mb-4">
            Escolha o Plano Ideal para Você
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
            Sistema completo de gestão de empréstimos e cobranças. Todas as funcionalidades em todos os planos.
          </p>
        </motion.div>
      </section>

      {/* Plans Grid */}
      <section id="plans-grid" className="px-4 pb-20">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
            
            {/* Mensal */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
              <Card className="h-full border-border/50 bg-card cursor-pointer transition-all hover:border-muted-foreground/50" onClick={() => togglePlan('mensal')}>
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between w-full">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">Mensal</Badge>
                    <motion.div animate={{ rotate: openPlan === 'mensal' ? 180 : 0 }} transition={{ duration: 0.3 }}>
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {openPlan === 'mensal' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm text-muted-foreground text-center mb-4">Ideal para testar o sistema sem compromisso</p>
                        <div className="text-center mb-4">
                          <div className="text-lg text-muted-foreground line-through">R$ 69,90</div>
                          <div className="text-4xl font-bold text-foreground">
                            R$ 55<span className="text-xl">,90</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">por mês</p>
                          <Badge className="mt-2 bg-green-500/10 text-green-400 border-green-500/20 text-xs">Economize R$ 14</Badge>
                        </div>
                        <ul className="space-y-2 mb-6 flex-1">
                          {featuresList.map((f) => (
                            <li key={f} className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-muted-foreground text-xs">{f}</span>
                            </li>
                          ))}
                        </ul>
                        <a href={effectiveLinks.monthly} target="_blank" rel="noopener noreferrer" className="block" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="lg" className="w-full">Assinar Mensal</Button>
                        </a>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>

            {/* Trimestral */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} transition={{ delay: 0.1 }}>
              <Card className="h-full border-primary/30 bg-card cursor-pointer transition-all hover:border-primary/60" onClick={() => togglePlan('trimestral')}>
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between w-full">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <Badge variant="outline" className="border-primary/50 text-primary">Trimestral</Badge>
                    <motion.div animate={{ rotate: openPlan === 'trimestral' ? 180 : 0 }} transition={{ duration: 0.3 }}>
                      <ChevronDown className="w-5 h-5 text-primary" />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {openPlan === 'trimestral' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm text-muted-foreground text-center mb-4">Economia garantida com 3 meses de acesso</p>
                        <div className="text-center mb-4">
                          <div className="text-lg text-muted-foreground line-through">R$ 209,90</div>
                          <div className="text-4xl font-bold text-foreground">
                            R$ 149<span className="text-xl">,00</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">por 3 meses (R$ 49,67/mês)</p>
                          <Badge className="mt-2 bg-green-500/10 text-green-400 border-green-500/20 text-xs">Economize R$ 60,90</Badge>
                        </div>
                        <ul className="space-y-2 mb-6 flex-1">
                          {featuresList.map((f) => (
                            <li key={f} className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                              <span className="text-muted-foreground text-xs">{f}</span>
                            </li>
                          ))}
                        </ul>
                        <a href={effectiveLinks.quarterly} target="_blank" rel="noopener noreferrer" className="block" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="lg" className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                            Assinar Trimestral
                          </Button>
                        </a>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>

            {/* Anual - DESTAQUE */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn} transition={{ delay: 0.15 }}>
              <Card className="h-full border-2 border-primary bg-card relative overflow-hidden shadow-2xl shadow-primary/20 cursor-pointer transition-all hover:shadow-primary/30" onClick={() => togglePlan('anual')}>
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary via-green-500 to-primary text-primary-foreground text-center py-2 text-xs font-bold tracking-wide">
                  🔥 MAIS VENDIDO
                </div>
                <CardContent className="p-6 pt-14 flex flex-col h-full">
                  <div className="flex items-center justify-between w-full">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-primary/30 flex-shrink-0">
                      <Calendar className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <Badge className="bg-primary text-primary-foreground font-bold px-4">Anual</Badge>
                    <motion.div animate={{ rotate: openPlan === 'anual' ? 180 : 0 }} transition={{ duration: 0.3 }}>
                      <ChevronDown className="w-5 h-5 text-primary" />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {openPlan === 'anual' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="flex justify-center gap-2 mb-3 mt-2">
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] animate-pulse">
                            🔥 APENAS 20 VAGAS
                          </Badge>
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                            💰 ECONOMIZE R$ 191
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground text-center mb-4">Melhor custo-benefício, o mais vendido</p>
                        <div className="text-center mb-4">
                          <div className="text-lg text-muted-foreground line-through">R$ 699,90</div>
                          <div className="text-4xl font-bold text-primary">
                            R$ 479<span className="text-xl">,00</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">por ano (12x de R$ 39,92)</p>
                          <div className="mt-2 inline-flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
                            <Star className="w-3 h-3 text-primary fill-primary" />
                            <span className="text-xs font-semibold text-primary">Melhor custo-benefício</span>
                          </div>
                        </div>
                        <ul className="space-y-2 mb-6 flex-1">
                          {featuresList.map((f) => (
                            <li key={f} className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                              <span className="text-foreground text-xs font-medium">{f}</span>
                            </li>
                          ))}
                        </ul>
                        <a href={effectiveLinks.annual} target="_blank" rel="noopener noreferrer" className="block" onClick={(e) => e.stopPropagation()}>
                          <Button size="lg" className="w-full bg-gradient-to-r from-primary to-green-600 hover:from-green-600 hover:to-primary shadow-lg shadow-primary/30 font-bold">
                            <Zap className="w-4 h-4 mr-2" /> ASSINAR ANUAL
                          </Button>
                        </a>
                        <p className="text-xs text-center text-muted-foreground mt-3 flex items-center justify-center gap-1">
                          <Shield className="w-3 h-3" /> Pague em até 12x • Garantia de 7 dias
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>

            {/* Vitalício */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} transition={{ delay: 0.25 }}>
              <Card className="h-full border-2 border-yellow-500/50 bg-gradient-to-b from-yellow-500/5 via-card to-yellow-500/5 relative overflow-hidden cursor-pointer transition-all hover:border-yellow-500/70" onClick={() => togglePlan('vitalicio')}>
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 text-yellow-950 text-center py-2 text-xs font-bold tracking-wide">
                  👑 MELHOR INVESTIMENTO
                </div>
                <CardContent className="p-6 pt-14 flex flex-col h-full">
                  <div className="flex items-center justify-between w-full">
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/30 flex-shrink-0">
                      <Crown className="w-5 h-5 text-yellow-950" />
                    </div>
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 font-bold px-4">Vitalício</Badge>
                    <motion.div animate={{ rotate: openPlan === 'vitalicio' ? 180 : 0 }} transition={{ duration: 0.3 }}>
                      <ChevronDown className="w-5 h-5 text-yellow-400" />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {openPlan === 'vitalicio' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm text-muted-foreground text-center mb-4">Pague uma vez, use para sempre</p>
                        <div className="text-center mb-4">
                          <div className="text-lg text-muted-foreground line-through">R$ 1.499,00</div>
                          <div className="text-4xl font-bold text-yellow-400">
                            R$ 999<span className="text-xl">,00</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">pagamento único, acesso permanente</p>
                          <Badge className="mt-2 bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-xs">
                            Economize R$ 500
                          </Badge>
                        </div>
                        <ul className="space-y-2 mb-6 flex-1">
                          {featuresList.map((f) => (
                            <li key={f} className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                              <span className="text-foreground text-xs font-medium">{f}</span>
                            </li>
                          ))}
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                            <span className="text-yellow-400 text-xs font-bold">Acesso PERMANENTE</span>
                          </li>
                        </ul>
                        <a href={effectiveLinks.lifetime} target="_blank" rel="noopener noreferrer" className="block" onClick={(e) => e.stopPropagation()}>
                          <Button size="lg" className="w-full bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-amber-500 hover:to-yellow-600 text-yellow-950 shadow-lg shadow-yellow-500/30 font-bold">
                            <Crown className="w-4 h-4 mr-2" /> ASSINAR VITALÍCIO
                          </Button>
                        </a>
                        <p className="text-xs text-center text-muted-foreground mt-3 flex items-center justify-center gap-1">
                          <Shield className="w-3 h-3" /> Pague uma vez, use para sempre
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 pb-20">
        <div className="container mx-auto max-w-5xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">O que está incluso</h2>
            <p className="text-muted-foreground">Todas as funcionalidades em todos os planos, sem exceção.</p>
          </motion.div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {features.map(({ icon: Icon, label }, i) => (
              <motion.div
                key={label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUp}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-4 rounded-lg border border-border/50 bg-card/50"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-foreground">{label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WhatsApp Support Info */}
      <section className="px-4 pb-8">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="flex items-center gap-4 p-5 rounded-xl border border-green-500/30 bg-green-500/5"
          >
            <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base">Suporte via WhatsApp</h3>
              <p className="text-sm text-muted-foreground">Todos os planos incluem atendimento de segunda a sexta, das 09h às 20h</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="px-4 pb-20">
        <div className="container mx-auto max-w-4xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Comparativo de Planos</h2>
            <p className="text-muted-foreground">A única diferença é o período de acesso e o preço.</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]"></TableHead>
                    <TableHead className="text-center">Mensal</TableHead>
                    <TableHead className="text-center">Trimestral</TableHead>
                    <TableHead className="text-center text-primary font-bold">Anual</TableHead>
                    <TableHead className="text-center text-yellow-400 font-bold">Vitalício</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Funcionalidades</TableCell>
                    <TableCell className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></TableCell>
                    <TableCell className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></TableCell>
                    <TableCell className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></TableCell>
                    <TableCell className="text-center"><Check className="w-5 h-5 text-yellow-400 mx-auto" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Período</TableCell>
                    <TableCell className="text-center text-sm">30 dias</TableCell>
                    <TableCell className="text-center text-sm">90 dias</TableCell>
                    <TableCell className="text-center text-sm text-primary font-medium">12 meses</TableCell>
                    <TableCell className="text-center text-sm text-yellow-400 font-medium">Para sempre</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Custo mensal</TableCell>
                    <TableCell className="text-center text-sm">R$ 55,90</TableCell>
                    <TableCell className="text-center text-sm">R$ 49,67</TableCell>
                    <TableCell className="text-center text-sm text-primary font-medium">R$ 39,92</TableCell>
                    <TableCell className="text-center text-sm text-yellow-400 font-medium">R$ 0</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Investimento</TableCell>
                    <TableCell className="text-center text-sm font-semibold">R$ 55,90</TableCell>
                    <TableCell className="text-center text-sm font-semibold">R$ 149,00</TableCell>
                    <TableCell className="text-center text-sm font-semibold text-primary">R$ 479,00</TableCell>
                    <TableCell className="text-center text-sm font-semibold text-yellow-400">R$ 999,00</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Guarantee */}
      <section className="px-4 pb-20">
        <div className="container mx-auto max-w-3xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn}>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Garantia Incondicional de 7 Dias</h3>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Se por qualquer motivo você não ficar satisfeito, devolvemos 100% do seu dinheiro em até 7 dias. Sem perguntas, sem burocracia. O risco é todo nosso.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 pb-20">
        <div className="container mx-auto max-w-3xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Perguntas Frequentes</h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
            <Accordion type="single" collapsible className="space-y-2">
              {faqItems.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-border/50 rounded-lg px-4 bg-card/50">
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="px-4 pb-20">
        <div className="container mx-auto max-w-2xl text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ainda tem dúvidas?</h2>
            <p className="text-muted-foreground mb-6">Fale com a gente pelo WhatsApp ou escolha seu plano agora mesmo.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="lg" className="w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                  <MessageCircle className="w-4 h-4 mr-2" /> Falar no WhatsApp
                </Button>
              </a>
              <Button size="lg" className="w-full sm:w-auto" onClick={scrollToPlans}>
                <ArrowUp className="w-4 h-4 mr-2" /> Ver Planos
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 px-4 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} CobraFácil. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};

export default Plans;
