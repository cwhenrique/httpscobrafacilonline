import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';
import { useState, useEffect } from 'react';

interface LoansTutorialProps {
  run: boolean;
  onFinish: () => void;
  onOpenDialog: () => void;
  onCloseDialog: () => void;
  isDialogOpen: boolean;
}

const TUTORIAL_STEPS: Step[] = [
  {
    target: '.tutorial-new-loan',
    content: 'Para criar um novo empréstimo, clique neste botão. Vamos ver como funciona o formulário de criação!',
    title: '🆕 Passo 1: Novo Empréstimo',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '.tutorial-form-client',
    content: 'Primeiro, selecione um cliente existente ou clique em "Cadastrar novo cliente" para criar um novo.',
    title: '👤 Passo 2: Selecionar Cliente',
    placement: 'bottom',
  },
  {
    target: '.tutorial-form-value',
    content: 'Informe o valor que será emprestado ao cliente. Este é o valor principal do empréstimo.',
    title: '💰 Passo 3: Valor do Empréstimo',
    placement: 'bottom',
  },
  {
    target: '.tutorial-form-interest',
    content: 'Defina a taxa de juros em percentual. Ex: 10% significa que o cliente pagará 10% a mais sobre o valor.',
    title: '📊 Passo 4: Taxa de Juros',
    placement: 'bottom',
  },
  {
    target: '.tutorial-form-interest-mode',
    content: '"Por Parcela" aplica juros em cada parcela. "Sobre o Total" aplica uma vez no valor total.',
    title: '⚙️ Passo 5: Modo de Juros',
    placement: 'bottom',
  },
  {
    target: '.tutorial-form-payment-type',
    content: 'Escolha a modalidade: Único (1 pagamento), Parcelado (mensal), Semanal ou Diário.',
    title: '📋 Passo 6: Modalidade',
    placement: 'bottom',
  },
  {
    target: '.tutorial-form-dates',
    content: 'Defina a data de início e vencimento. Para parcelados, você pode personalizar cada data.',
    title: '📅 Passo 7: Datas',
    placement: 'top',
  },
  {
    target: '.tutorial-form-notes',
    content: 'Adicione observações opcionais sobre o empréstimo para referência futura.',
    title: '📝 Passo 8: Observações',
    placement: 'top',
  },
  {
    target: '.tutorial-form-submit',
    content: 'Após preencher todos os campos, clique em "Criar" para salvar o empréstimo!',
    title: '✅ Passo 9: Criar Empréstimo',
    placement: 'top',
  },
  {
    target: '.tutorial-search',
    content: 'Pesquise rapidamente por nome do cliente ou valor para encontrar empréstimos específicos.',
    title: '🔍 Buscar Empréstimos',
    placement: 'bottom',
  },
  {
    target: '.tutorial-filters',
    content: 'Filtre por status: Em Dia, Pagos, Atraso, Renegociados, Só Juros, Semanal ou Diário.',
    title: '📋 Filtros de Status',
    placement: 'bottom',
  },
  {
    target: '.tutorial-loan-card',
    content: 'Seus empréstimos aparecem como cards. Veja informações do cliente, valores, parcelas e status.',
    title: '💳 Cards de Empréstimo',
    placement: 'top',
  },
  {
    target: '.tutorial-loan-payment',
    content: 'Clique em "Pagar" para registrar pagamentos: parcelas individuais, múltiplas ou valores parciais.',
    title: '💰 Registrar Pagamento',
    placement: 'top',
  },
  {
    target: '.tutorial-loan-interest',
    content: 'Use "Pagar Juros" quando o cliente paga apenas juros ou para aplicar taxas extras.',
    title: '💵 Pagamento de Juros',
    placement: 'top',
  },
  {
    target: '.tutorial-loan-receipt',
    content: 'Gere comprovantes em PDF e envie via WhatsApp. Útil para confirmar pagamentos!',
    title: '📄 Comprovante',
    placement: 'left',
  },
];

export default function LoansTutorial({ run, onFinish, onOpenDialog, onCloseDialog, isDialogOpen }: LoansTutorialProps) {
  const [stepIndex, setStepIndex] = useState(0);
  // Reset step index when tutorial starts
  useEffect(() => {
    if (run) {
      setStepIndex(0);
    }
  }, [run]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      onCloseDialog();
      onFinish();
      setStepIndex(0);
      return;
    }

    // Handle step navigation
    if (type === EVENTS.STEP_AFTER) {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      
      // Step 0 -> 1: Open dialog before showing form fields
      if (index === 0 && action === ACTIONS.NEXT) {
        onOpenDialog();
        // Wait for dialog to render
        setTimeout(() => {
          setStepIndex(nextIndex);
        }, 300);
        return;
      }
      
      // Step 8 -> 9: Close dialog when leaving form steps
      if (index === 8 && action === ACTIONS.NEXT) {
        onCloseDialog();
        setTimeout(() => {
          setStepIndex(nextIndex);
        }, 300);
        return;
      }
      
      // Step 9 -> 8: Reopen dialog when going back to form
      if (index === 9 && action === ACTIONS.PREV) {
        onOpenDialog();
        setTimeout(() => {
          setStepIndex(nextIndex);
        }, 300);
        return;
      }
      
      // Step 1 -> 0: Close dialog when going back
      if (index === 1 && action === ACTIONS.PREV) {
        onCloseDialog();
        setTimeout(() => {
          setStepIndex(nextIndex);
        }, 300);
        return;
      }

      setStepIndex(nextIndex);
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      stepIndex={stepIndex}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={TUTORIAL_STEPS}
      locale={{
        back: 'Voltar',
        close: 'Fechar',
        last: 'Finalizar',
        next: 'Próximo',
        open: 'Abrir',
        skip: 'Pular Tutorial',
      }}
      styles={{
        options: {
          primaryColor: '#22c55e',
          backgroundColor: '#1e293b',
          textColor: '#f8fafc',
          arrowColor: '#1e293b',
          overlayColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 12,
          padding: 16,
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        tooltipTitle: {
          fontSize: 16,
          fontWeight: 600,
          marginBottom: 8,
        },
        tooltipContent: {
          fontSize: 14,
          lineHeight: 1.5,
        },
        buttonNext: {
          backgroundColor: '#22c55e',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 500,
        },
        buttonBack: {
          color: '#94a3b8',
          marginRight: 8,
          fontSize: 14,
        },
        buttonSkip: {
          color: '#64748b',
          fontSize: 13,
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
    />
  );
}
