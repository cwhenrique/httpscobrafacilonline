import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';

interface LoansPageTutorialProps {
  run: boolean;
  onFinish: () => void;
  stepIndex: number;
  onStepChange: (index: number) => void;
}

const TUTORIAL_STEPS: Step[] = [
  {
    target: '.tutorial-new-loan',
    content: 'Crie empréstimos parcelados, semanais ou de pagamento único. Defina valor, juros, parcelas e datas de vencimento personalizadas.',
    title: '➕ Novo Empréstimo',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.tutorial-new-daily',
    content: 'Crie empréstimos com cobrança diária. Você escolhe manualmente cada data de cobrança no calendário.',
    title: '📅 Novo Diário',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.tutorial-download-report',
    content: 'Baixe um PDF completo com todos os empréstimos, histórico de pagamentos, valores recebidos e estatísticas.',
    title: '📄 Relatório de Operações',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.tutorial-search',
    content: 'Busque empréstimos pelo nome do cliente ou valor emprestado.',
    title: '🔍 Buscar',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.tutorial-filters',
    content: 'Filtre por status: Em Dia, Pagos, Em Atraso, Renegociados, Só Juros, Diários ou Semanais.',
    title: '🏷️ Filtros',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.tutorial-loan-card',
    content: 'Cada card mostra: cliente, valor restante, emprestado, juros, parcelas, vencimento e quanto foi pago. As cores indicam o status: verde (pago), vermelho (atrasado), amarelo (renegociado), roxo (só juros), azul (diário).',
    title: '💳 Card de Empréstimo',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.tutorial-loan-payment',
    content: 'Registre pagamentos: escolha pagar uma parcela específica, um valor parcial, ou quitar o empréstimo inteiro. Após o pagamento, você pode gerar comprovante PDF e enviar por WhatsApp.',
    title: '💰 Registrar Pagamento',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.tutorial-loan-interest',
    content: 'Use quando o cliente paga só os juros (as datas são adiadas em 1 mês) ou para aplicar taxa extra de renovação em uma parcela específica. Ideal para renegociações.',
    title: '💵 Pagar Juros / Taxa Extra',
    placement: 'top',
    disableBeacon: true,
  },
];

export default function LoansPageTutorial({ run, onFinish, stepIndex, onStepChange }: LoansPageTutorialProps) {
  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;
    
    if (action === ACTIONS.SKIP || action === ACTIONS.CLOSE) {
      return;
    }

    if (status === STATUS.FINISHED) {
      onFinish();
      return;
    }

    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        onStepChange(index + 1);
      } else if (action === ACTIONS.PREV) {
        onStepChange(Math.max(0, index - 1));
      }
    }
  };

  if (!run) return null;

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      stepIndex={stepIndex}
      scrollToFirstStep
      showProgress
      showSkipButton={false}
      steps={TUTORIAL_STEPS}
      disableOverlayClose
      disableCloseOnEsc
      spotlightClicks={false}
      floaterProps={{
        disableAnimation: true,
        offset: 15,
      }}
      spotlightPadding={8}
      locale={{
        back: '← Voltar',
        close: 'Fechar',
        last: '🎉 Finalizar Tutorial',
        next: 'Próxima Etapa →',
        open: 'Abrir',
        skip: '',
      }}
      styles={{
        options: {
          primaryColor: '#22c55e',
          backgroundColor: '#1e293b',
          textColor: '#f8fafc',
          arrowColor: '#1e293b',
          overlayColor: 'rgba(0, 0, 0, 0.85)',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 12,
          padding: 20,
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        tooltipTitle: {
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 10,
        },
        tooltipContent: {
          fontSize: 15,
          lineHeight: 1.6,
        },
        buttonNext: {
          backgroundColor: '#22c55e',
          borderRadius: 8,
          padding: '10px 20px',
          fontSize: 14,
          fontWeight: 500,
        },
        buttonBack: {
          color: '#94a3b8',
          marginRight: 10,
          fontSize: 14,
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
    />
  );
}
