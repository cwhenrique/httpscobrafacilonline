import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';

interface LoanFormTutorialProps {
  run: boolean;
  onFinish: () => void;
  stepIndex: number;
  onStepChange: (index: number) => void;
}

const TUTORIAL_STEPS: Step[] = [
  {
    target: '.tutorial-client-select',
    content: 'Selecione um cliente já cadastrado no sistema para vincular ao empréstimo.',
    title: '👤 Selecionar Cliente',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '.tutorial-new-client-btn',
    content: 'Se o cliente não existir, clique aqui para cadastrar um novo cliente sem sair do formulário.',
    title: '➕ Cadastrar Novo Cliente',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '.tutorial-form-value',
    content: 'Digite o valor principal que será emprestado ao cliente (sem juros).',
    title: '💰 Valor do Empréstimo',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '.tutorial-form-interest',
    content: 'Defina a taxa de juros em percentual. Exemplo: 10% ao mês.',
    title: '📊 Taxa de Juros',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '.tutorial-form-interest-mode',
    content: 'Por Parcela: juros multiplicado pelo número de parcelas. Sobre o Total: juros aplicado uma única vez.',
    title: '⚙️ Modo de Juros',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '.tutorial-form-payment-type',
    content: 'Escolha a modalidade: Parcelado (várias parcelas), Semanal, ou Pagamento Único.',
    title: '💳 Modalidade de Pagamento',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '.tutorial-form-dates',
    content: 'Defina a data de início do empréstimo. O vencimento é calculado automaticamente.',
    title: '📅 Datas do Contrato',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '.tutorial-form-notes',
    content: 'Adicione observações opcionais sobre o empréstimo ou acordos especiais.',
    title: '📝 Observações',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.tutorial-form-submit',
    content: 'Parabéns! Você conheceu todas as funcionalidades do formulário de empréstimos. Clique aqui para salvar quando estiver pronto!',
    title: '🎉 Tutorial Concluído!',
    placement: 'top',
    disableBeacon: true,
  },
];

export default function LoanFormTutorial({ run, onFinish, stepIndex, onStepChange }: LoanFormTutorialProps) {
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
