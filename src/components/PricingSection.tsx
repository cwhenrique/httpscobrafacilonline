import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Calendar,
  CheckCircle2,
  Shield,
  Star,
  Zap,
  Sparkles,
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
};

interface AffiliateLinks {
  monthly: string;
  annual: string;
  lifetime: string;
}

interface PricingSectionProps {
  affiliateLinks?: AffiliateLinks;
  showTitle?: boolean;
  className?: string;
}

const defaultLinks: AffiliateLinks = {
  monthly: "https://pay.cakto.com.br/32tjeaa",
  annual: "https://pay.cakto.com.br/37et5v3",
  lifetime: "https://pay.cakto.com.br/fhwfptb",
};

const PricingSection = ({
  affiliateLinks = defaultLinks,
  showTitle = true,
  className = "",
}: PricingSectionProps) => {
  const monthlyLink = affiliateLinks.monthly;
  const annualLink = affiliateLinks.annual;
  const lifetimeLink = affiliateLinks.lifetime;
  return (
    <section id="pricing" className={`py-16 px-4 relative ${className}`}>
      <div className="container mx-auto">
        {showTitle && (
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
        )}
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
          {/* Plano Mensal */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <Card className="bg-gradient-to-b from-card to-muted/30 border border-primary/50 h-full backdrop-blur-sm">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <Badge variant="outline" className="mb-4 border-muted-foreground/30 text-muted-foreground">Mensal</Badge>
                  <div className="text-4xl font-bold text-foreground mb-1">
                    R$ 47<span className="text-2xl">,90</span>
                  </div>
                  <p className="text-sm text-muted-foreground">por mês</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">Clientes ilimitados</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">Empréstimos ilimitados</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">Cálculo automático de juros</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">Alertas WhatsApp</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">Calendário de cobranças</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">Score de clientes</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">Relatórios da operação</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">Comprovantes em PDF</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">Taxas de renovação</span>
                  </li>
                </ul>
                <a href={monthlyLink} target="_blank" rel="noopener noreferrer" className="block">
                  <Button variant="outline" size="lg" className="w-full h-12">
                    Assinar Mensal
                  </Button>
                </a>
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
              <div className="absolute top-10 sm:top-12 left-0 right-0 flex justify-center gap-2 px-4">
                <span className="bg-yellow-500 text-yellow-950 text-[10px] sm:text-xs font-bold py-1 px-3 rounded-full animate-pulse">
                  🔥 APENAS 20 VAGAS
                </span>
                <span className="bg-red-500 text-white text-[10px] sm:text-xs font-bold py-1 px-3 rounded-full">
                  💰 ECONOMIZE 50%
                </span>
              </div>
              <CardContent className="p-6 sm:p-8 pt-20 sm:pt-24">
                <div className="text-center mb-6 sm:mb-8">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                    <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
                  </div>
                  <Badge className="mb-4 bg-primary text-primary-foreground font-bold px-4 py-1">Vitalício</Badge>
                  <div className="text-lg text-muted-foreground line-through mb-1">
                    De R$ 599,00
                  </div>
                  <div className="text-4xl sm:text-5xl font-bold text-primary mb-1">
                    R$ 299<span className="text-xl sm:text-2xl">,00</span>
                  </div>
                  <p className="text-sm text-muted-foreground">à vista</p>
                  <p className="text-xs sm:text-sm text-foreground font-medium mt-1">ou 12x de R$ 34,76</p>
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
                    <span className="text-foreground text-xs sm:text-sm font-medium">Comprovantes em PDF</span>
                  </li>
                  <li className="flex items-center gap-2 sm:gap-3">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                    <span className="text-foreground text-xs sm:text-sm font-medium">Taxas de renovação</span>
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
                <a href={lifetimeLink} target="_blank" rel="noopener noreferrer" className="block">
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
            <Card className="bg-gradient-to-b from-card to-muted/30 border border-primary/50 h-full backdrop-blur-sm">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-6 h-6 text-primary" />
                  </div>
                  <Badge variant="outline" className="mb-4 border-primary/50 text-primary">Anual</Badge>
                  <div className="text-4xl font-bold text-foreground mb-1">
                    R$ 299<span className="text-2xl">,00</span>
                  </div>
                  <p className="text-sm text-muted-foreground">por ano</p>
                  <p className="text-xs sm:text-sm text-foreground font-medium mt-1">ou 12x de R$ 34,76</p>
                  <div className="mt-2 text-xs text-primary font-semibold bg-primary/10 rounded-full px-3 py-1 inline-block">
                    Economia de R$ 275/ano
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
                    <span className="text-muted-foreground text-sm">Suporte via WhatsApp</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">Comprovantes em PDF</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">Taxas de renovação</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">Atualizações gratuitas</span>
                  </li>
                </ul>
                <a href={annualLink} target="_blank" rel="noopener noreferrer" className="block">
                  <Button variant="outline" size="lg" className="w-full h-12 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                    Assinar Anual
                  </Button>
                </a>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
