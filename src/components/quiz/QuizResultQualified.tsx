import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle, MessageCircle, Sparkles } from "lucide-react";

interface QuizAnswer {
  question: string;
  answer: string;
}

interface QuizResultQualifiedProps {
  score: number;
  answers: QuizAnswer[];
  isHot: boolean;
}

export function QuizResultQualified({ score, answers, isHot }: QuizResultQualifiedProps) {
  const whatsappNumber = "5511932935877";
  
  // Código discreto: Q = Quente, M = Morno + score
  const refCode = `${isHot ? 'Q' : 'M'}${score}`;
  
  const message = `Olá! Fiz o quiz no site e tenho interesse no CobraFacil.

Meu perfil:
${answers.map(a => `• ${a.question}: ${a.answer}`).join('\n')}

Gostaria de saber mais!

Ref: ${refCode}`;

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="text-center space-y-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="flex justify-center"
      >
        <div className="p-4 rounded-full bg-green-500/20">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>
      </motion.div>

      <div className="space-y-4">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          Perfeito! <Sparkles className="inline w-8 h-8 text-yellow-500" />
        </h2>
        <h3 className="text-xl md:text-2xl font-semibold text-primary">
          O CobraFacil pode te ajudar!
        </h3>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Vamos conversar e entender melhor como organizar seu negócio de forma profissional.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          size="lg"
          className="w-full max-w-sm py-6 text-lg bg-green-600 hover:bg-green-700"
          onClick={() => window.open(whatsappUrl, '_blank')}
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          Falar no WhatsApp
        </Button>
      </motion.div>

      <p className="text-xs text-muted-foreground">
        Você será redirecionado para o WhatsApp
      </p>
    </motion.div>
  );
}
