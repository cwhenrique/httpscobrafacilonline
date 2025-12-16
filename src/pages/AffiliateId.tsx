import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DollarSign,
  Calculator,
  Bell,
  Calendar,
  Users,
  TrendingUp,
  Shield,
  Smartphone,
  Clock,
  FileText,
  CheckCircle2,
  ArrowRight,
  Star,
  Zap,
  BarChart3,
  MessageCircle,
  X,
  Percent,
  Check,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import PricingSection from "@/components/PricingSection";
import { 
  Car, 
  Home, 
  Package, 
  Receipt, 
  Send, 
  QrCode,
  CircleDollarSign,
  ClipboardList,
  PieChart
} from "lucide-react";
import heroPerson from "@/assets/hero-person.png";
import cobraFacilLogo from "@/assets/cobrafacil-logo.png";
import dashboardOverview from "@/assets/dashboard-overview.png";
import loansManagement from "@/assets/loans-management.png";
import loansCards from "@/assets/loans-cards.png";
import calendarPage from "@/assets/calendar-page.png";
import reportsPage from "@/assets/reports-page.png";
import simulatorPage from "@/assets/simulator-page.png";
import scoreDeClientes from "@/assets/score-de-clientes.png";
import whatsappAlert01 from "@/assets/whatsapp-alert-01.png";
import whatsappAlert02 from "@/assets/whatsapp-alert-02.png";
import whatsappAlert03 from "@/assets/whatsapp-alert-03.png";

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
};

// Affiliate links for this page
const AFFILIATE_LINKS = {
  monthly: "https://pay.cakto.com.br/9c8mk4m?affiliate=dFRXD6nE",
  annual: "https://pay.cakto.com.br/nt3n9n6?affiliate=dFRXD6nE",
  lifetime: "https://pay.cakto.com.br/h6rm24y?affiliate=dFRXD6nE",
};

const AffiliateId = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [showBottomBar, setShowBottomBar] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBottomBar(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const features = [
    {
      icon: BarChart3,
      title: "Dashboard Inteligente",
      description: "Visão geral completa de tudo que você tem a receber em tempo real",
    },
    {
      icon: Calculator,
      title: "Cálculo Automático de Juros",
      description: "Juros simples ou por parcela, calculados automaticamente",
    },
    {
      icon: MessageCircle,
      title: "WhatsApp Integrado",
      description: "Receba alertas E envie cobranças direto para seus clientes pelo WhatsApp",
    },
    {
      icon: Calendar,
      title: "Calendário de Cobranças",
      description: "Visualize todas as datas de vencimento em um calendário intuitivo",
    },
  ];

  const steps = [
    {
      number: "1",
      title: "Cadastre-se com Pagamento Único",
      description: "Crie sua conta em menos de 1 minuto e tenha acesso vitalício",
      emoji: "🎯",
    },
    {
      number: "2",
      title: "Adicione Seus Clientes",
      description: "Cadastre clientes com foto, telefone e informações importantes",
      emoji: "👥",
    },
    {
      number: "3",
      title: "Registre Empréstimos",
      description: "Configure juros, parcelas e datas. O sistema calcula tudo automaticamente",
      emoji: "💰",
    },
    {
      number: "4",
      title: "Receba Alertas",
      description: "Seja notificado no WhatsApp sobre vencimentos e atrasos",
      emoji: "🚀",
    },
  ];

  const faqs = [
    {
      question: "Como funciona o cálculo de juros?",
      answer: "Você escolhe entre juros simples ou por parcela. O sistema calcula automaticamente com base na taxa e número de parcelas que você definir.",
    },
    {
      question: "Preciso instalar algo?",
      answer: "Não! O CobraFácil funciona 100% no navegador. Acesse de qualquer dispositivo, seja computador, tablet ou celular.",
    },
    {
      question: "Meus dados estão seguros?",
      answer: "Sim! Utilizamos criptografia de ponta e servidores seguros. Seus dados são isolados e só você tem acesso.",
    },
    {
      question: "Como funcionam os alertas no WhatsApp?",
      answer: "O CobraFácil oferece duas formas de alertas: (1) Você recebe resumos diários, alertas de vencimento e avisos de atraso no seu WhatsApp automaticamente. (2) NOVO: Você também pode enviar cobranças e comprovantes direto para o WhatsApp dos seus clientes conectando seu número via QR Code.",
    },
    {
      question: "Posso enviar cobranças diretamente para meus clientes?",
      answer: "Sim! Basta conectar seu WhatsApp escaneando um QR Code nas configurações. Depois você pode enviar cobranças, comprovantes de pagamento e avisos de atraso diretamente para o WhatsApp dos seus clientes com apenas um clique.",
    },
  ];

  const includedFeatures = [
    "Clientes ilimitados",
    "Empréstimos ilimitados",
    "Cálculo automático de juros",
    "Alertas WhatsApp para você",
    "Cobranças WhatsApp para clientes",
    "Calendário de cobranças",
    "Score de clientes",
    "Simulador de empréstimos",
    "Contas a pagar e receber",
  ];

  const competitorProblems = [
    "Mensalidade todo mês que nunca para",
    "Preços que aumentam sem aviso",
    "Funcionalidades bloqueadas em planos caros",
    "Paga mesmo sem usar no mês",
  ];

  const cobraFacilBenefits = [
    "Pagamento único, use para sempre",
    "Todas as funcionalidades liberadas",
    "Atualizações gratuitas incluídas",
    "Sem surpresas na fatura",
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* Hero Section */}
      <section className="pt-20 pb-8 px-4 relative min-h-[90vh] flex items-center">
        {/* Background Image */}
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src={heroPerson} 
            alt="" 
            className="absolute right-0 top-0 h-full w-auto object-cover opacity-10 max-w-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
          <div className="absolute inset-0 grid-pattern opacity-50" />
        </div>
        
        <div className="container mx-auto text-center relative">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-1.5 sm:gap-2 badge-premium badge-glow rounded-full px-4 py-2 sm:px-6 sm:py-3 text-xs sm:text-sm font-bold text-primary mb-6">
              <span className="animate-pulse">🔥</span>
              <span>CHEGA DE PERDER DINHEIRO!</span>
            </div>
          </motion.div>
          
          <motion.h1 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 leading-tight text-foreground"
          >
            Você Empresta Dinheiro a Juros?
            <br />
            <span className="gradient-text-animated">
              Nunca Mais Perca uma Cobrança!
            </span>
          </motion.h1>

          {/* Target Audience Badges */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 px-2"
          >
            <div className="badge-premium rounded-full px-3 py-1.5 sm:px-5 sm:py-2.5 text-primary font-semibold flex items-center gap-1.5 sm:gap-2 hover:scale-105 transition-transform cursor-default text-xs sm:text-sm">
              <span>💰</span>
              <span>Empréstimos</span>
            </div>
            <div className="badge-premium rounded-full px-3 py-1.5 sm:px-5 sm:py-2.5 text-primary font-semibold flex items-center gap-1.5 sm:gap-2 hover:scale-105 transition-transform cursor-default text-xs sm:text-sm">
              <span>🏠</span>
              <span>Aluguéis</span>
            </div>
            <div className="badge-premium rounded-full px-3 py-1.5 sm:px-5 sm:py-2.5 text-primary font-semibold flex items-center gap-1.5 sm:gap-2 hover:scale-105 transition-transform cursor-default text-xs sm:text-sm">
              <span>🛠️</span>
              <span>Serviços</span>
            </div>
          </motion.div>
          
          <motion.p 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto"
          >
              Sistema completo para quem <strong className="text-foreground">empresta dinheiro a juros</strong>. 
              Calcula juros simples e compostos automaticamente, avisa vencimentos no WhatsApp e controla suas cobranças em um só lugar.
          </motion.p>
          
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button 
              size="lg" 
              className="text-sm sm:text-lg px-6 sm:px-10 h-12 sm:h-16 shadow-glow font-bold bg-gradient-to-r from-primary to-green-600 hover:from-green-600 hover:to-primary transition-all duration-300 animate-bounce-subtle"
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
              <span className="hidden sm:inline">QUERO ORGANIZAR MEUS EMPRÉSTIMOS</span>
              <span className="sm:hidden">ORGANIZAR EMPRÉSTIMOS</span>
            </Button>
          </motion.div>

          {/* Premium Badge */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-6 px-2"
          >
            <a 
              href="https://wa.me/5517992147232?text=Ol%C3%A1!%20Gostaria%20de%20testar%20o%20CobraF%C3%A1cil%20por%201%20dia%20gratuitamente.%20AF2" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 sm:gap-4 badge-premium badge-glow rounded-xl sm:rounded-2xl px-6 py-4 sm:px-10 sm:py-5 hover:scale-105 transition-transform duration-300"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 flex-shrink-0">
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="text-left">
                <div className="font-bold text-primary text-sm sm:text-lg">VENHA FAZER PARTE DO NOSSO SISTEMA</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Solicite pelo WhatsApp agora mesmo</div>
              </div>
            </a>
          </motion.div>


          {/* Trust Badges */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-2 sm:gap-4 mt-8 text-xs sm:text-sm px-4 max-w-md sm:max-w-none mx-auto"
          >
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 stat-card px-2 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-full text-center border-2 border-primary/50">
              <Percent className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
              <span className="font-medium text-foreground text-[10px] sm:text-sm">Empréstimos a Juros</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 stat-card px-2 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-full text-center">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
              <span className="font-medium text-foreground text-[10px] sm:text-sm">Vitalício</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 stat-card px-2 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-full text-center">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
              <span className="font-medium text-foreground text-[10px] sm:text-sm">Updates</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 stat-card px-2 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-full text-center">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
              <span className="font-medium text-foreground text-[10px] sm:text-sm">Suporte</span>
            </div>
          </motion.div>
          
          {/* Stats */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            transition={{ delay: 0.5 }}
            className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto"
          >
            {[
              { value: "1.350+", label: "Clientes Ativos", icon: "👥" },
              { value: "1x", label: "Pagamento Único", icon: "💎" },
              { value: "4.9/5", label: "Avaliação", icon: "⭐" },
              { value: "98.9%", label: "Satisfação", icon: "🏆" },
            ].map((stat, index) => (
              <motion.div 
                key={index} 
                variants={scaleIn}
                className="stat-card text-center p-6 rounded-2xl hover:scale-105 transition-all duration-300 cursor-default"
              >
                {stat.icon && <span className="text-2xl">{stat.icon}</span>}
                <div className="text-2xl sm:text-3xl font-bold gradient-text mt-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Overview Geral de Funcionalidades */}
      <section className="py-16 px-4 relative bg-muted/30">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="container mx-auto relative">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 badge-premium badge-glow rounded-full px-5 py-2.5 text-sm font-bold text-primary mb-4">
              <Sparkles className="w-4 h-4" />
              <span>Sistema Completo</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 text-foreground">
              Tudo que Você Precisa para <span className="gradient-text">Cobrar Melhor</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Uma visão geral de todas as funcionalidades do CobraFácil
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto"
          >
            {[
              { icon: BarChart3, title: "Dashboard Inteligente", description: "Visão geral em tempo real", badge: null },
              { icon: Calculator, title: "Cálculo de Juros", description: "Simples ou por parcela", badge: null },
              { icon: MessageCircle, title: "Alertas WhatsApp", description: "Receba no seu WhatsApp", badge: null },
              { icon: Send, title: "Cobranças p/ Clientes", description: "Envie direto pelo WhatsApp", badge: "🆕 NOVO" },
              { icon: QrCode, title: "Conexão QR Code", description: "Conecte em segundos", badge: "🆕 NOVO" },
              { icon: Calendar, title: "Calendário", description: "Visualize vencimentos", badge: null },
              { icon: Users, title: "Score de Clientes", description: "Avalie confiabilidade", badge: null },
              { icon: CircleDollarSign, title: "Simulador", description: "Planeje empréstimos", badge: null },
              { icon: Receipt, title: "Comprovantes PDF", description: "Gere recibos profissionais", badge: null },
              { icon: ClipboardList, title: "Contas a Pagar", description: "Controle suas despesas", badge: null },
              { icon: Package, title: "Venda de Produtos", description: "Parcele vendas", badge: null },
              { icon: Car, title: "Venda de Veículos", description: "Controle financiamentos", badge: null },
              { icon: Home, title: "Aluguéis", description: "Gerencie inquilinos", badge: null },
              { icon: PieChart, title: "Relatórios", description: "Métricas detalhadas", badge: null },
              { icon: FileText, title: "Contratos", description: "Organize documentos", badge: null },
              { icon: Shield, title: "Dados Seguros", description: "Criptografia de ponta", badge: null },
            ].map((item, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <div className="stat-card rounded-xl p-4 h-full hover:scale-105 transition-all duration-300 relative">
                  {item.badge && (
                    <span className="absolute -top-2 -right-2 bg-gradient-to-r from-primary to-green-600 text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground mb-1">{item.title}</h3>
                  <p className="text-muted-foreground text-xs">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mt-10"
          >
            <Button 
              size="lg" 
              className="text-sm sm:text-lg px-6 sm:px-10 h-12 sm:h-14 shadow-glow font-bold bg-gradient-to-r from-primary to-green-600 hover:from-green-600 hover:to-primary transition-all duration-300"
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Zap className="w-5 h-5 mr-2" />
              Ver Planos e Preços
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Garantia Section */}
      <section className="py-8 px-4 relative">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="max-w-4xl mx-auto"
          >
            <div className="relative flex flex-col md:flex-row items-center justify-center gap-6 badge-premium rounded-3xl p-8 md:p-10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
              <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              
              <div className="flex-shrink-0 relative">
                <div className="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-primary to-green-600 rounded-full flex items-center justify-center shadow-glow animate-pulse-glow">
                  <Shield className="w-12 h-12 md:w-14 md:h-14 text-primary-foreground" />
                </div>
              </div>
              <div className="text-center md:text-left relative">
                <div className="inline-flex items-center gap-2 badge-premium rounded-full px-4 py-1.5 text-xs font-bold text-primary mb-3">
                  <span>✨</span>
                  <span>RISCO ZERO</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                  Garantia Incondicional de 7 Dias
                </h3>
                <p className="text-muted-foreground max-w-xl text-lg">
                  Compre o CobraFácil e teste por 7 dias. Se não gostar, 
                  devolvemos <strong className="text-primary">100% do seu dinheiro</strong>. Sem perguntas, sem burocracia.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <div className="stat-card px-4 py-2 rounded-full flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Reembolso garantido</span>
                  </div>
                  <div className="stat-card px-4 py-2 rounded-full flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Sem burocracia</span>
                  </div>
                  <div className="stat-card px-4 py-2 rounded-full flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Processo simples</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <PricingSection affiliateLinks={AFFILIATE_LINKS} />

      {/* Comparison Section */}
      <section className="py-16 px-4 relative bg-muted/30">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="container mx-auto relative">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 badge-premium badge-glow rounded-full px-5 py-2.5 text-sm font-bold text-primary mb-4">
              <Sparkles className="w-4 h-4" />
              <span>Comparativo</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 text-foreground">
              Por Que o <span className="gradient-text">CobraFácil</span> é Diferente?
            </h2>
          </motion.div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
            {/* Competitor Problems */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
            >
              <Card className="h-full border-destructive/30 bg-destructive/5 hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                      <X className="w-6 h-6 text-destructive" />
                    </div>
                    <h3 className="text-xl font-bold text-destructive">Outras Plataformas</h3>
                  </div>
                  <ul className="space-y-4">
                    {competitorProblems.map((problem, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <X className="w-4 h-4 text-destructive" />
                        </div>
                        <span className="text-foreground">{problem}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            {/* CobraFacil Benefits */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              transition={{ delay: 0.2 }}
            >
              <Card className="h-full border-primary/50 bg-primary/5 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-primary">CobraFácil</h3>
                  </div>
                  <ul className="space-y-4">
                    {cobraFacilBenefits.map((benefit, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-foreground">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Multi-Device Section */}
      <section className="py-16 px-4 relative">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="container mx-auto relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 badge-premium badge-glow rounded-full px-5 py-2.5 text-sm font-bold text-primary mb-4">
              <Smartphone className="w-4 h-4" />
              <span>Multi-dispositivo</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 text-foreground">
              Acesse de <span className="gradient-text">Qualquer Lugar</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Sistema 100% online. Funciona no computador, tablet ou celular.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto"
          >
            {[
              { icon: "🖥️", title: "Desktop", description: "Acesse pelo navegador do seu computador" },
              { icon: "📱", title: "Celular", description: "Instale como app no seu smartphone" },
              { icon: "📲", title: "Tablet", description: "Perfeito para usar em reuniões" },
            ].map((device, index) => (
              <motion.div key={index} variants={scaleIn}>
                <Card className="text-center hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 border-primary/20 hover:border-primary/50">
                  <CardContent className="p-8">
                    <span className="text-5xl mb-4 block">{device.icon}</span>
                    <h3 className="text-xl font-bold text-foreground mb-2">{device.title}</h3>
                    <p className="text-muted-foreground">{device.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Install as App Info */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mt-12 text-center"
          >
            <div className="inline-flex flex-col items-center gap-4 badge-premium rounded-2xl p-6 max-w-lg mx-auto">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                <span className="font-bold text-foreground">Instale como App!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                No celular, acesse o site e toque em "Adicionar à Tela Inicial". 
                O CobraFácil ficará como um app no seu celular, sem precisar baixar nada!
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-16 px-4 relative bg-muted/30">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="container mx-auto relative">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 badge-premium badge-glow rounded-full px-5 py-2.5 text-sm font-bold text-primary mb-4">
              <Star className="w-4 h-4" />
              <span>Conheça o Sistema</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 text-foreground">
              Veja o <span className="gradient-text">CobraFácil</span> em Ação
            </h2>
          </motion.div>

          <div className="space-y-24">
            {/* Dashboard */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="grid md:grid-cols-2 gap-8 items-center"
            >
              <div className="order-2 md:order-1">
                <div className="inline-flex items-center gap-2 badge-premium rounded-full px-4 py-2 text-xs font-bold text-primary mb-4">
                  <BarChart3 className="w-4 h-4" />
                  <span>Dashboard</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                  Visão Geral Completa
                </h3>
                <p className="text-muted-foreground mb-6">
                  Acompanhe todos os seus empréstimos, pagamentos e clientes em um único painel. 
                  Veja quanto você tem a receber, quem está em dia e quem está atrasado.
                </p>
                <ul className="space-y-3">
                  {["Resumo financeiro em tempo real", "Gráficos de evolução mensal", "Alertas de vencimentos"].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="order-1 md:order-2">
                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-primary/20 border border-primary/20">
                  <img src={dashboardOverview} alt="Dashboard do CobraFácil" className="w-full" />
                </div>
              </div>
            </motion.div>

            {/* Loans Management */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="grid md:grid-cols-2 gap-8 items-center"
            >
              <div>
                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-primary/20 border border-primary/20">
                  <img src={loansCards} alt="Gestão de Empréstimos" className="w-full" />
                </div>
              </div>
              <div>
                <div className="inline-flex items-center gap-2 badge-premium rounded-full px-4 py-2 text-xs font-bold text-primary mb-4">
                  <DollarSign className="w-4 h-4" />
                  <span>Empréstimos</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                  Gestão de Empréstimos
                </h3>
                <p className="text-muted-foreground mb-6">
                  Cadastre empréstimos com juros simples ou compostos. O sistema calcula automaticamente 
                  as parcelas, juros e saldo devedor.
                </p>
                <ul className="space-y-3">
                  {["Cálculo automático de juros", "Parcelas ou pagamento único", "Histórico completo de pagamentos"].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {/* Calendar */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="grid md:grid-cols-2 gap-8 items-center"
            >
              <div className="order-2 md:order-1">
                <div className="inline-flex items-center gap-2 badge-premium rounded-full px-4 py-2 text-xs font-bold text-primary mb-4">
                  <Calendar className="w-4 h-4" />
                  <span>Calendário</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                  Calendário de Cobranças
                </h3>
                <p className="text-muted-foreground mb-6">
                  Visualize todas as datas de vencimento em um calendário intuitivo. 
                  Nunca mais perca uma cobrança importante.
                </p>
                <ul className="space-y-3">
                  {["Visão mensal de vencimentos", "Cores por status (pago, pendente, atrasado)", "Clique para ver detalhes"].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="order-1 md:order-2">
                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-primary/20 border border-primary/20">
                  <img src={calendarPage} alt="Calendário de Cobranças" className="w-full" />
                </div>
              </div>
            </motion.div>

            {/* WhatsApp Alerts */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="grid md:grid-cols-2 gap-8 items-center"
            >
              <div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl overflow-hidden shadow-xl shadow-primary/20 border border-primary/20">
                    <img src={whatsappAlert01} alt="Alerta WhatsApp 1" className="w-full" />
                  </div>
                  <div className="rounded-2xl overflow-hidden shadow-xl shadow-primary/20 border border-primary/20">
                    <img src={whatsappAlert02} alt="Alerta WhatsApp 2" className="w-full" />
                  </div>
                  <div className="rounded-2xl overflow-hidden shadow-xl shadow-primary/20 border border-primary/20">
                    <img src={whatsappAlert03} alt="Alerta WhatsApp 3" className="w-full" />
                  </div>
                </div>
              </div>
              <div>
                <div className="inline-flex items-center gap-2 badge-premium rounded-full px-4 py-2 text-xs font-bold text-primary mb-4">
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                  Alertas no WhatsApp
                </h3>
                <p className="text-muted-foreground mb-6">
                  Receba notificações diárias no seu WhatsApp com resumo de vencimentos, 
                  atrasos e pagamentos. Você também pode enviar cobranças direto para seus clientes!
                </p>
                <ul className="space-y-3">
                  {["Resumo diário automático", "Alertas de vencimento e atraso", "🆕 Envie cobranças para clientes"].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {/* Client Score */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="grid md:grid-cols-2 gap-8 items-center"
            >
              <div className="order-2 md:order-1">
                <div className="inline-flex items-center gap-2 badge-premium rounded-full px-4 py-2 text-xs font-bold text-primary mb-4">
                  <Users className="w-4 h-4" />
                  <span>Score</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                  Score de Clientes
                </h3>
                <p className="text-muted-foreground mb-6">
                  Avalie a confiabilidade dos seus clientes com base no histórico de pagamentos. 
                  Saiba quem paga em dia e quem costuma atrasar.
                </p>
                <ul className="space-y-3">
                  {["Pontuação automática", "Baseado em histórico real", "Ajuda na tomada de decisão"].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="order-1 md:order-2">
                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-primary/20 border border-primary/20">
                  <img src={scoreDeClientes} alt="Score de Clientes" className="w-full" />
                </div>
              </div>
            </motion.div>

            {/* Simulator */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="grid md:grid-cols-2 gap-8 items-center"
            >
              <div>
                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-primary/20 border border-primary/20">
                  <img src={simulatorPage} alt="Simulador de Empréstimos" className="w-full" />
                </div>
              </div>
              <div>
                <div className="inline-flex items-center gap-2 badge-premium rounded-full px-4 py-2 text-xs font-bold text-primary mb-4">
                  <Calculator className="w-4 h-4" />
                  <span>Simulador</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                  Simulador de Empréstimos
                </h3>
                <p className="text-muted-foreground mb-6">
                  Calcule juros e parcelas antes de fechar negócio. Mostre ao cliente 
                  exatamente quanto ele vai pagar.
                </p>
                <ul className="space-y-3">
                  {["Cálculo instantâneo", "Juros simples ou compostos", "Compartilhe com o cliente"].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 relative">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="container mx-auto relative">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 badge-premium badge-glow rounded-full px-5 py-2.5 text-sm font-bold text-primary mb-4">
              <Sparkles className="w-4 h-4" />
              <span>Funcionalidades</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 text-foreground">
              Tudo que Você Precisa para <span className="gradient-text">Cobrar Melhor</span>
            </h2>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={scaleIn}>
                <Card className="h-full hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 border-primary/20 hover:border-primary/50 group">
                  <CardContent className="p-6">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-16 px-4 relative bg-muted/30">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="container mx-auto relative">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 badge-premium badge-glow rounded-full px-5 py-2.5 text-sm font-bold text-primary mb-4">
              <ArrowRight className="w-4 h-4" />
              <span>Passo a Passo</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 text-foreground">
              Como <span className="gradient-text">Funciona</span>
            </h2>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-4 gap-8"
          >
            {steps.map((step, index) => (
              <motion.div key={index} variants={fadeInUp} className="relative">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-green-600 flex items-center justify-center shadow-glow">
                    <span className="text-3xl">{step.emoji}</span>
                  </div>
                  <div className="absolute top-10 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent -z-10 hidden md:block" 
                    style={{ display: index === steps.length - 1 ? 'none' : undefined }}
                  />
                  <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Second Pricing CTA */}
      <PricingSection affiliateLinks={AFFILIATE_LINKS} />

      {/* Contact / WhatsApp Section */}
      <section className="py-16 px-4 relative">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="container mx-auto relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 badge-premium badge-glow rounded-full px-5 py-2.5 text-sm font-bold text-primary mb-4">
              <MessageCircle className="w-4 h-4" />
              <span>Suporte</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 text-foreground">
              Ficou com <span className="gradient-text">Dúvidas</span>?
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Fale diretamente com nossa equipe pelo WhatsApp. Estamos prontos para ajudar!
            </p>
            <a 
              href="https://wa.me/5517992147232?text=Ol%C3%A1!%20Tenho%20uma%20d%C3%BAvida%20sobre%20o%20CobraF%C3%A1cil.%20AF2" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button size="lg" className="text-lg px-10 h-16 shadow-glow font-bold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all duration-300">
                <MessageCircle className="w-6 h-6 mr-2" />
                Chamar no WhatsApp
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4 relative bg-muted/30">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="container mx-auto relative">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 badge-premium badge-glow rounded-full px-5 py-2.5 text-sm font-bold text-primary mb-4">
              <span>❓</span>
              <span>FAQ</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 text-foreground">
              Perguntas <span className="gradient-text">Frequentes</span>
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="max-w-3xl mx-auto"
          >
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="border border-primary/20 rounded-xl px-6 bg-card/50 backdrop-blur-sm"
                >
                  <AccordionTrigger className="text-left text-foreground hover:text-primary transition-colors py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-primary/5" />
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="container mx-auto text-center relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-3xl sm:text-5xl font-bold mb-6 text-foreground">
              Pronto para <span className="gradient-text">Organizar suas Cobranças</span>?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Junte-se a mais de 1.350 cobradores que já organizam seus empréstimos com o CobraFácil
            </p>
            <Button 
              size="lg" 
              className="text-lg px-10 h-16 shadow-glow font-bold bg-gradient-to-r from-primary to-green-600 hover:from-green-600 hover:to-primary transition-all duration-300 animate-bounce-subtle"
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Zap className="w-6 h-6 mr-2" />
              COMEÇAR AGORA
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border/50 bg-card/30">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img src={cobraFacilLogo} alt="CobraFácil" className="h-10 w-auto" />
            </div>
            <p className="text-muted-foreground text-sm text-center">
              © {new Date().getFullYear()} CobraFácil. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-primary" />
                <span>Pagamento Seguro</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>Garantia 7 dias</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Fixed Bottom Bar */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: showBottomBar ? 0 : 100, opacity: showBottomBar ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-primary/20 p-4 z-50 shadow-2xl shadow-primary/20"
      >
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={cobraFacilLogo} alt="CobraFácil" className="h-8 w-auto" />
            <span className="text-sm text-muted-foreground hidden sm:inline">Sistema de Gestão de Cobranças</span>
          </div>
          <a 
            href="https://wa.me/5517992147232?text=Ol%C3%A1!%20Gostaria%20de%20testar%20o%20CobraF%C3%A1cil%20por%201%20dia%20gratuitamente.%20AF2" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button className="shadow-glow font-bold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all duration-300">
              <MessageCircle className="w-5 h-5 mr-2" />
              VENHA FAZER PARTE DO NOSSO SISTEMA
            </Button>
          </a>
        </div>
      </motion.div>

    </div>
  );
};

export default AffiliateId;
