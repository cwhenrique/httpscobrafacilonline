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
  Check,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import VideoCarousel from "@/components/VideoCarousel";
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

const Landing = () => {
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
      title: "Alertas WhatsApp",
      description: "Receba avisos de vencimento e atraso direto no seu WhatsApp",
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
      question: "Como recebo os alertas no WhatsApp?",
      answer: "Basta cadastrar seu número de telefone no perfil. O sistema envia automaticamente resumos diários, alertas de vencimento e avisos de atraso.",
    },
  ];

  const includedFeatures = [
    "Clientes ilimitados",
    "Empréstimos ilimitados",
    "Cálculo automático de juros",
    "Alertas WhatsApp",
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
      {/* Floating Banner - Contador de Vagas */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-primary/60 via-green-500/60 to-primary/60 backdrop-blur-md text-primary-foreground py-2.5 px-4 border-b border-primary/10 shadow-lg shadow-primary/5"
      >
        <div className="container mx-auto flex items-center justify-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-400"></span>
            </span>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wide">
              Oferta Limitada
            </span>
          </div>
          <div className="h-4 w-px bg-primary-foreground/30 hidden sm:block" />
          <span className="text-xs sm:text-sm font-medium">
            Apenas <span className="font-bold text-yellow-300 text-sm sm:text-base">47</span> de 50 vagas vitalícias
          </span>
          <div className="hidden sm:flex items-center gap-2 ml-1">
            <div className="w-24 bg-primary-foreground/20 rounded-full h-2 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '94%' }}
                transition={{ duration: 1, delay: 0.5 }}
                className="bg-yellow-400 h-2 rounded-full"
              />
            </div>
            <span className="text-xs font-medium text-yellow-300">94%</span>
          </div>
        </div>
      </motion.div>

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
            Você Empresta, Aluga ou Presta Serviços?
            <br />
            <span className="gradient-text-animated">
              Nunca Mais Esqueça de Cobrar!
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
            Sistema completo para quem trabalha com <strong className="text-foreground">empréstimos, aluguéis ou mensalidades</strong>. 
            Calcula juros automático, avisa no WhatsApp e controla tudo em um só lugar.
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
              <span className="hidden sm:inline">QUERO ORGANIZAR MINHAS COBRANÇAS</span>
              <span className="sm:hidden">ORGANIZAR COBRANÇAS</span>
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
            <div className="inline-flex items-center justify-center gap-2 sm:gap-3 badge-premium badge-glow rounded-xl sm:rounded-2xl px-4 py-2.5 sm:px-8 sm:py-4 text-sm sm:text-lg">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary to-green-600 flex items-center justify-center shadow-glow-sm flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <div className="text-left">
                <div className="font-bold text-primary text-xs sm:text-base">PAGAMENTO ÚNICO</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Pague uma vez, use para sempre</div>
              </div>
            </div>
          </motion.div>

          {/* Trust Badges */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-3 sm:flex sm:flex-wrap sm:justify-center gap-2 sm:gap-4 mt-8 text-xs sm:text-sm px-4 max-w-sm sm:max-w-none mx-auto"
          >
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
                  Teste o CobraFácil por 7 dias. Se por qualquer motivo você não gostar, 
                  devolvemos <strong className="text-primary">100% do seu dinheiro</strong>. Sem perguntas.
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

      {/* Comparison Section */}
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
              <TrendingUp className="w-4 h-4" />
              <span>Compare e Economize</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 text-foreground">
              Chega de Pagar <span className="gradient-text">Mensalidade</span> Todo Mês
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Veja a diferença entre plataformas com mensalidade e o CobraFácil
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Competitors */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
            >
              <Card className="bg-card border-2 h-full shadow-lg" style={{ borderColor: '#ef4444' }}>
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-foreground">Outras Plataformas</h3>
                    <span className="px-3 py-1.5 rounded-full text-sm font-semibold" style={{ backgroundColor: '#16a34a', color: '#ffffff' }}>💸 Mensalidade</span>
                  </div>
                  <div className="space-y-4">
                    {competitorProblems.map((problem, index) => (
                      <div key={index} className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-3" style={{ color: '#f87171' }}>
                        <X className="w-5 h-5 flex-shrink-0" style={{ color: '#ef4444' }} />
                        <span>{problem}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 pt-6" style={{ borderTop: '1px solid #ef4444' }}>
                    <div className="text-sm text-muted-foreground">Custo anual estimado</div>
                    <div className="text-4xl font-bold" style={{ color: '#ef4444' }}>R$ 600+/ano</div>
                    <div className="text-sm text-muted-foreground">em mensalidades recorrentes</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* CobraFácil */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              transition={{ delay: 0.1 }}
            >
              <Card className="card-premium bg-gradient-to-b from-primary/5 to-primary/10 border-2 border-primary/30 h-full relative overflow-hidden shadow-xl shadow-primary/15">
                <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-green-600 text-primary-foreground text-xs font-bold px-4 py-2 rounded-bl-xl">
                  ✨ MELHOR ESCOLHA
                </div>
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-foreground">CobraFácil</h3>
                    <div className="badge-premium badge-glow rounded-full px-4 py-1.5">
                      <span className="text-primary font-bold text-sm">Pagamento Único</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {cobraFacilBenefits.map((benefit, index) => (
                      <div key={index} className="flex items-center gap-3 text-foreground stat-card rounded-lg px-4 py-3">
                        <Check className="w-5 h-5 text-primary flex-shrink-0" />
                        <span className="font-medium">{benefit}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 pt-6 border-t border-primary/20">
                    <div className="text-sm text-muted-foreground">Investimento</div>
                    <div className="text-4xl font-bold gradient-text">1x e Pronto!</div>
                    <div className="text-sm text-muted-foreground">acesso vitalício garantido</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Multi-Device Section */}
      <section className="py-16 px-4 relative">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 badge-premium badge-glow rounded-full px-5 py-2.5 text-sm font-bold text-primary mb-4">
              <Smartphone className="w-4 h-4" />
              <span>Acesse de Qualquer Lugar</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 text-foreground">
              Funciona em <span className="gradient-text">Todos os Dispositivos</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Use no computador, tablet ou celular. E ainda pode instalar como um aplicativo no seu smartphone!
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            {/* Desktop */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
            >
              <div className="stat-card rounded-2xl p-8 text-center hover:scale-105 transition-all duration-300">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <rect width="20" height="14" x="2" y="3" rx="2"/>
                    <line x1="8" x2="16" y1="21" y2="21"/>
                    <line x1="12" x2="12" y1="17" y2="21"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Computador</h3>
                <p className="text-muted-foreground">
                  Acesse pelo navegador no seu PC ou notebook. Tela grande para melhor visualização.
                </p>
              </div>
            </motion.div>

            {/* Tablet */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              transition={{ delay: 0.1 }}
            >
              <div className="stat-card rounded-2xl p-8 text-center hover:scale-105 transition-all duration-300">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
                    <line x1="12" x2="12.01" y1="18" y2="18"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Tablet</h3>
                <p className="text-muted-foreground">
                  Perfeito para usar enquanto visita clientes. Praticidade na palma da mão.
                </p>
              </div>
            </motion.div>

            {/* Mobile */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              transition={{ delay: 0.2 }}
            >
              <div className="stat-card rounded-2xl p-8 text-center hover:scale-105 transition-all duration-300">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center">
                  <Smartphone className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Celular</h3>
                <p className="text-muted-foreground">
                  Leve o CobraFácil no bolso. Consulte e registre pagamentos a qualquer momento.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Install as App Banner */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="max-w-4xl mx-auto"
          >
            <div className="relative badge-premium rounded-3xl p-8 md:p-10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
              <div className="absolute -left-20 -top-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
              <div className="absolute -right-20 -bottom-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
              
              <div className="relative flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0">
                  <div className="w-28 h-28 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl flex items-center justify-center shadow-glow-sm rotate-6 border-2 border-primary/30">
                    <img src={cobraFacilLogo} alt="CobraFácil" className="w-20 h-20 object-contain" />
                  </div>
                </div>
                <div className="text-center md:text-left flex-1">
                  <div className="inline-flex items-center gap-2 bg-primary/20 rounded-full px-4 py-1.5 text-xs font-bold text-primary mb-3">
                    <Zap className="w-3 h-3" />
                    <span>INSTALE COMO APLICATIVO</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                    Crie um Atalho no Seu Celular
                  </h3>
                  <p className="text-muted-foreground text-lg mb-4">
                    Adicione o CobraFácil à tela inicial do seu celular como se fosse um aplicativo da loja. 
                    <strong className="text-foreground"> Sem precisar baixar nada!</strong> Acesse com um toque, sem abrir o navegador.
                  </p>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <div className="stat-card px-4 py-2 rounded-full flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Funciona offline</span>
                    </div>
                    <div className="stat-card px-4 py-2 rounded-full flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Carregamento rápido</span>
                    </div>
                    <div className="stat-card px-4 py-2 rounded-full flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Sem ocupar espaço</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 px-4 relative">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">
              Depoimentos
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              O que nossos clientes dizem
            </h2>
            <p className="text-muted-foreground">Conheça quem já usa o CobraFácil</p>
          </motion.div>
          
          <VideoCarousel />
        </div>
      </section>

      {/* Detailed Features Section */}
      <section className="py-16 px-4 relative">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30 px-4 py-2 font-semibold">
              <Smartphone className="w-4 h-4 mr-2" />
              Conheça o Sistema
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Tudo Que Você Precisa em Um Só Lugar
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Veja em detalhes cada funcionalidade que vai transformar sua gestão de cobranças
            </p>
          </motion.div>

          {/* Feature 1 - Dashboard */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="grid md:grid-cols-2 gap-8 items-center mb-16"
          >
            <div className="order-2 md:order-1">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Dashboard</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                Visão Geral Completa
              </h3>
              <p className="text-muted-foreground mb-6">
                Acompanhe em tempo real todos os seus empréstimos, valores a receber, pagamentos atrasados e muito mais. Tudo em uma única tela intuitiva.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Total emprestado e recebido</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Alertas de atrasos em destaque</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Gráficos de evolução financeira</span>
                </li>
              </ul>
            </div>
            <div className="order-1 md:order-2">
              <div className="bg-muted/50 border border-border rounded-2xl p-2 overflow-hidden">
                <img 
                  src={dashboardOverview} 
                  alt="Dashboard CobraFácil - Visão geral completa do sistema financeiro" 
                  className="w-full h-auto rounded-xl"
                />
              </div>
            </div>
          </motion.div>

          {/* Feature 2 - Empréstimos */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="grid md:grid-cols-2 gap-8 items-center mb-16"
          >
            <div className="order-2">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Empréstimos</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                Gestão Completa de Empréstimos
              </h3>
              <p className="text-muted-foreground mb-6">
                Cadastre empréstimos com juros simples ou por parcela. O sistema calcula tudo automaticamente e exibe em cards visuais e organizados.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Cálculo automático de juros</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Parcelas com datas personalizadas</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Status visual: em dia, atrasado, pago</span>
                </li>
              </ul>
            </div>
            <div className="order-1">
              <div className="bg-muted/50 border border-border rounded-2xl p-2 overflow-hidden">
                <img 
                  src={loansCards} 
                  alt="Cards de Empréstimos CobraFácil - Visualização por status" 
                  className="w-full h-auto rounded-xl"
                />
              </div>
            </div>
          </motion.div>

          {/* Feature 3 - Calendário */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="grid md:grid-cols-2 gap-8 items-center mb-16"
          >
            <div className="order-2 md:order-1">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Calendário</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                Calendário de Cobranças
              </h3>
              <p className="text-muted-foreground mb-6">
                Visualize todas as datas de vencimento em um calendário intuitivo. Nunca mais esqueça de cobrar ninguém.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Indicadores visuais por status</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Detalhes ao clicar na data</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Estatísticas mensais</span>
                </li>
              </ul>
            </div>
            <div className="order-1 md:order-2">
              <div className="bg-muted/50 border border-border rounded-2xl p-2 overflow-hidden">
                <img 
                  src={calendarPage} 
                  alt="Calendário de Cobranças CobraFácil - Visualize datas de vencimento" 
                  className="w-full h-auto rounded-xl"
                />
              </div>
            </div>
          </motion.div>

          {/* Feature 4 - Alertas WhatsApp */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="grid md:grid-cols-2 gap-8 items-center mb-16"
          >
            <div className="order-2">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">WhatsApp</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                Alertas Automáticos no WhatsApp
              </h3>
              <p className="text-muted-foreground mb-6">
                Receba resumos diários, alertas de vencimento e avisos de atraso direto no seu WhatsApp. Você sempre informado.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Resumo diário às 8h</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Alertas de vencimento no dia</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Avisos progressivos de atraso</span>
                </li>
              </ul>
            </div>
            <div className="order-1">
              <div className="bg-muted/50 border border-border rounded-2xl p-4 overflow-hidden">
                <div className="grid grid-cols-3 gap-2">
                  <img 
                    src={whatsappAlert01} 
                    alt="Alerta WhatsApp - Novo empréstimo parcelado" 
                    className="w-full h-auto rounded-lg"
                  />
                  <img 
                    src={whatsappAlert02} 
                    alt="Alerta WhatsApp - Novo empréstimo único" 
                    className="w-full h-auto rounded-lg"
                  />
                  <img 
                    src={whatsappAlert03} 
                    alt="Alerta WhatsApp - Pagamento diário" 
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature 5 - Score de Clientes */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="grid md:grid-cols-2 gap-8 items-center mb-16"
          >
            <div className="order-2 md:order-1">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Score</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                Score de Clientes
              </h3>
              <p className="text-muted-foreground mb-6">
                Sistema inteligente que avalia a confiabilidade de cada cliente baseado no histórico de pagamentos. Saiba quem é bom pagador.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Score de 0 a 150 pontos</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Atualização automática</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Indicador visual por cores</span>
                </li>
              </ul>
            </div>
            <div className="order-1 md:order-2">
              <div className="bg-muted/50 border border-border rounded-2xl p-2 overflow-hidden">
                <img 
                  src={scoreDeClientes} 
                  alt="Score de Clientes CobraFácil - Avalie a confiabilidade dos clientes" 
                  className="w-full h-auto rounded-xl"
                />
              </div>
            </div>
          </motion.div>

          {/* Feature 6 - Simulador */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="grid md:grid-cols-2 gap-8 items-center"
          >
            <div className="order-2">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Simulador</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                Simulador de Empréstimos
              </h3>
              <p className="text-muted-foreground mb-6">
                Planeje empréstimos antes de criar. Simule valores, juros e parcelas para apresentar propostas aos seus clientes.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Cálculo instantâneo</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Tabela de parcelas detalhada</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Total de juros e valor final</span>
                </li>
              </ul>
            </div>
            <div className="order-1">
              <div className="bg-muted/50 border border-border rounded-2xl p-2 overflow-hidden">
                <img 
                  src={simulatorPage} 
                  alt="Simulador de Empréstimos CobraFácil - Planeje antes de criar" 
                  className="w-full h-auto rounded-xl"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 relative">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">
              Benefícios
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Por Que Escolher o CobraFácil?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Tecnologia de ponta para transformar suas cobranças em resultados reais
            </p>
          </motion.div>
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="bg-card border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 h-full group">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all">
                      <feature.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-4 relative bg-muted/30">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">
              Simples e Eficiente
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Do Zero à Organização em 4 Etapas
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Veja como é fácil transformar suas cobranças
            </p>
          </motion.div>
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto"
          >
            {steps.map((step, index) => (
              <motion.div 
                key={index} 
                variants={fadeInUp}
                className="relative"
              >
                <Card className="bg-card border-border h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 text-center">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-lg font-bold text-primary-foreground">
                      {step.number}
                    </div>
                    <div className="text-3xl mb-3">{step.emoji}</div>
                    <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                    <p className="text-muted-foreground text-sm">{step.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 relative bg-muted/30">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">
              Escolha Seu Plano
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Comece a Usar Hoje Mesmo
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Escolha o plano ideal para você. Quanto maior o período, maior a economia!
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
            {/* Plano Mensal */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
            >
              <Card className="bg-gradient-to-b from-card to-muted/30 border-border/50 h-full backdrop-blur-sm">
                <CardContent className="p-8">
                  <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <Badge variant="outline" className="mb-4 border-muted-foreground/30 text-muted-foreground">Mensal</Badge>
                    <div className="text-4xl font-bold text-foreground mb-1">
                      R$ 39<span className="text-2xl">,90</span>
                    </div>
                    <p className="text-sm text-muted-foreground">por mês</p>
                  </div>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Todas as funcionalidades</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Suporte por email</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Ideal para testar</span>
                    </li>
                  </ul>
                  <Link to="/auth" className="block">
                    <Button variant="outline" size="lg" className="w-full h-12">
                      Começar Teste
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            {/* Plano Vitalício - DESTAQUE */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={scaleIn}
              transition={{ delay: 0.1 }}
              className="md:-my-4"
            >
              <Card className="bg-gradient-to-b from-primary/5 via-card to-primary/5 border-2 border-primary h-full relative overflow-hidden shadow-2xl shadow-primary/30">
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary via-green-500 to-primary text-primary-foreground text-center py-2 sm:py-3 text-xs sm:text-sm font-bold tracking-wide px-2">
                  <span className="hidden sm:inline">🔥 MAIS VENDIDO - MELHOR ESCOLHA</span>
                  <span className="sm:hidden">🔥 MAIS VENDIDO</span>
                </div>
                <div className="absolute -right-12 top-20 sm:top-24 rotate-45 bg-red-500 text-white text-xs font-bold py-1 px-12">
                  ECONOMIZE
                </div>
                <CardContent className="p-6 sm:p-8 pt-14 sm:pt-16">
                  <div className="text-center mb-6 sm:mb-8">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                      <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
                    </div>
                    <Badge className="mb-4 bg-primary text-primary-foreground font-bold px-4 py-1">Vitalício</Badge>
                    <div className="text-lg text-muted-foreground line-through mb-1">
                      De R$ 549,90
                    </div>
                    <div className="text-4xl sm:text-5xl font-bold text-primary mb-1">
                      R$ 199<span className="text-xl sm:text-2xl">,90</span>
                    </div>
                    <p className="text-sm text-muted-foreground">à vista</p>
                    <p className="text-xs sm:text-sm text-foreground font-medium mt-1">ou 12x de R$ 23,24</p>
                    <div className="mt-3 inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 sm:px-4 py-2">
                      <Star className="w-4 h-4 text-primary fill-primary" />
                      <span className="text-xs sm:text-sm font-semibold text-primary">Acesso para sempre!</span>
                    </div>
                  </div>
                  <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                    <li className="flex items-center gap-2 sm:gap-3">
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground text-xs sm:text-sm font-medium">Acesso vitalício garantido</span>
                    </li>
                    <li className="flex items-center gap-2 sm:gap-3">
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground text-xs sm:text-sm font-medium">Todas as funcionalidades</span>
                    </li>
                    <li className="flex items-center gap-2 sm:gap-3">
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground text-xs sm:text-sm font-medium">Alertas de cobranças no WhatsApp</span>
                    </li>
                    <li className="flex items-center gap-2 sm:gap-3">
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground text-xs sm:text-sm font-medium">Suporte via WhatsApp</span>
                    </li>
                    <li className="flex items-center gap-2 sm:gap-3">
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground text-xs sm:text-sm font-medium">Atualizações gratuitas</span>
                    </li>
                    <li className="flex items-center gap-2 sm:gap-3">
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground text-xs sm:text-sm font-medium">Sem mensalidades nunca mais</span>
                    </li>
                  </ul>
                  <a href="https://pay.cakto.com.br/fhwfptb" target="_blank" rel="noopener noreferrer" className="block">
                    <Button size="lg" className="w-full text-sm sm:text-lg h-12 sm:h-14 bg-gradient-to-r from-primary to-green-600 hover:from-green-600 hover:to-primary shadow-lg shadow-primary/30 font-bold">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      <span className="hidden sm:inline">QUERO ACESSO VITALÍCIO</span>
                      <span className="sm:hidden">ACESSO VITALÍCIO</span>
                    </Button>
                  </a>
                  <p className="text-xs text-center text-muted-foreground mt-4 flex items-center justify-center gap-2">
                    <Shield className="w-4 h-4 flex-shrink-0" />
                    <span>Pague em até 12x • Garantia de 7 dias</span>
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Plano Anual */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-gradient-to-b from-card to-muted/30 border-border/50 h-full backdrop-blur-sm">
                <CardContent className="p-8">
                  <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <Badge variant="outline" className="mb-4 border-primary/50 text-primary">Anual</Badge>
                    <div className="text-4xl font-bold text-foreground mb-1">
                      R$ 147<span className="text-2xl">,90</span>
                    </div>
                    <p className="text-sm text-muted-foreground">à vista</p>
                    <p className="text-xs sm:text-sm text-foreground font-medium mt-1">ou 12x de R$ 17,20</p>
                    <div className="mt-2 text-xs text-primary font-semibold bg-primary/10 rounded-full px-3 py-1 inline-block">
                      Economia de R$ 330/ano
                    </div>
                  </div>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Acesso por 12 meses</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Todas as funcionalidades</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Suporte prioritário</span>
                    </li>
                  </ul>
                  <a href="https://pay.cakto.com.br/37et5v3" target="_blank" rel="noopener noreferrer" className="block">
                    <Button variant="outline" size="lg" className="w-full h-12 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                      Assinar Anual
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Garantia */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mt-12 text-center"
          >
            <div className="inline-flex items-center gap-3 bg-card border border-border rounded-2xl px-6 py-4">
              <Shield className="w-8 h-8 text-primary" />
              <div className="text-left">
                <div className="font-bold text-foreground">Garantia de 7 Dias</div>
                <div className="text-sm text-muted-foreground">Se não gostar, devolvemos 100% do seu dinheiro</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contact / WhatsApp Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-background to-card">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          transition={{ duration: 0.6 }}
          className="container mx-auto max-w-3xl text-center px-2"
        >
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 md:p-12 shadow-xl">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8 text-green-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              Tem alguma dúvida?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Fale diretamente com nossa equipe pelo WhatsApp. Estamos prontos para tirar todas as suas dúvidas sobre o CobraFácil.
            </p>
            
            <a 
              href="https://wa.me/5517992147232?text=Olá! Vim do site do CobraFácil e tenho uma dúvida." 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block w-full sm:w-auto"
            >
              <Button size="lg" className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white text-base sm:text-lg px-6 sm:px-8 h-12 sm:h-14 shadow-lg shadow-green-500/20">
                <MessageCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span>Chamar no WhatsApp</span>
              </Button>
            </a>

            <div className="mt-8 pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground mb-4">Ou entre em contato por:</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <MessageCircle className="w-4 h-4 text-green-500" />
                  <span className="text-foreground font-medium">(17) 99214-7232</span>
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-4 relative">
        <div className="container mx-auto max-w-3xl">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">
              FAQ
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Perguntas frequentes
            </h2>
          </motion.div>
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`} 
                className="bg-card border border-border rounded-xl px-6 data-[state=open]:border-primary/30 shadow-sm"
              >
                <AccordionTrigger className="text-left text-foreground hover:text-primary hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-4 relative overflow-hidden bg-primary">
        <div className="container mx-auto text-center relative">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-3xl sm:text-5xl font-bold mb-6 text-primary-foreground"
          >
            Pronto para organizar suas cobranças?
          </motion.h2>
          <motion.p 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ delay: 0.1 }}
            className="text-primary-foreground/80 mb-10 max-w-xl mx-auto text-lg"
          >
            Junte-se a centenas de cobradores que já usam o CobraFácil
          </motion.p>
          <a 
            href="#pricing" 
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex justify-center w-full sm:w-auto"
          >
            <Button size="lg" variant="secondary" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-10 h-14 sm:h-16 shadow-lg">
              Adquirir o Acesso Vitalício
              <ArrowRight className="w-5 h-5 ml-2 flex-shrink-0" />
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border bg-card">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl text-foreground">CobraFácil</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Dados protegidos
              </span>
              <span className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                100% Responsivo
              </span>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} CobraFácil. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

      {/* Fixed Bottom Bar */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: showBottomBar ? 0 : 100 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border py-3 px-4"
      >
        <div className="container mx-auto flex items-center justify-center sm:justify-between gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">
              Pagamento único, <span className="text-primary font-semibold">acesso vitalício</span>
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a 
              href="https://wa.me/5517992147232?text=Olá! Vim do site do CobraFácil e gostaria de mais informações." 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              <Button variant="outline" size="icon" className="border-green-500/50 text-green-500 hover:bg-green-500/10 hover:text-green-400">
                <MessageCircle className="w-5 h-5" />
              </Button>
            </a>
            <a href="#pricing" className="flex-1 sm:flex-none">
              <Button className="w-full sm:w-auto">
                Começar Agora
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Landing;
