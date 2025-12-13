import jsPDF from 'jspdf';
import cobraFacilLogo from '@/assets/cobrafacil-logo.png';

// Theme colors (HSL converted to RGB)
const PRIMARY_GREEN = { r: 34, g: 197, b: 94 }; // #22c55e
const DARK_GREEN = { r: 22, g: 163, b: 74 }; // #16a34a
const LIGHT_GREEN_BG = { r: 220, g: 252, b: 231 }; // #dcfce7
const WHITE = { r: 255, g: 255, b: 255 };
const DARK_TEXT = { r: 30, g: 30, b: 30 };
const MUTED_TEXT = { r: 100, g: 100, b: 100 };

// Utility functions
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
};

const getContractPrefix = (type: 'loan' | 'product' | 'vehicle' | 'contract'): string => {
  switch (type) {
    case 'loan': return 'EMP';
    case 'product': return 'PRD';
    case 'vehicle': return 'VEI';
    case 'contract': return 'CTR';
    default: return 'DOC';
  }
};

const getContractTypeName = (type: 'loan' | 'product' | 'vehicle' | 'contract'): string => {
  switch (type) {
    case 'loan': return 'EMPRÉSTIMO';
    case 'product': return 'VENDA DE PRODUTO';
    case 'vehicle': return 'VENDA DE VEÍCULO';
    case 'contract': return 'CONTRATO';
    default: return 'DOCUMENTO';
  }
};

// Load logo as base64
const loadLogoAsBase64 = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = cobraFacilLogo;
  });
};

export interface ContractReceiptData {
  type: 'loan' | 'product' | 'vehicle' | 'contract';
  contractId: string;
  companyName: string;
  client: {
    name: string;
    phone?: string;
    cpf?: string;
    rg?: string;
    email?: string;
    address?: string;
  };
  negotiation: {
    principal: number;
    interestRate?: number;
    installments: number;
    installmentValue: number;
    totalToReceive: number;
    startDate: string;
    downPayment?: number;
    costValue?: number;
    profit?: number;
  };
  dueDates: string[];
  vehicleInfo?: {
    brand: string;
    model: string;
    year: number;
    color?: string;
    plate?: string;
    chassis?: string;
  };
  productInfo?: {
    name: string;
    description?: string;
  };
  // Informações de pagamento apenas de juros
  interestOnlyPayment?: {
    amountPaid: number;
    paymentDate: string;
    remainingBalance: number;
  };
}

export interface PaymentReceiptData {
  type: 'loan' | 'product' | 'vehicle' | 'contract';
  contractId: string;
  companyName: string;
  clientName: string;
  installmentNumber: number;
  totalInstallments: number;
  amountPaid: number;
  paymentDate: string;
  remainingBalance: number;
  totalPaid?: number;
  totalContract?: number;
}

export const generateContractReceipt = async (data: ContractReceiptData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let currentY = 0;

  // Load logo
  let logoBase64 = '';
  try {
    logoBase64 = await loadLogoAsBase64();
  } catch (e) {
    console.warn('Could not load logo:', e);
  }

  // === HEADER BAR ===
  doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Logo
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 5, 40, 25);
  } else {
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('CobraFácil', margin, 22);
  }

  // Company name on the right
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (data.companyName) {
    doc.text(data.companyName, pageWidth - margin, 15, { align: 'right' });
  }

  currentY = 45;

  // === DOCUMENT TITLE ===
  doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 18, 3, 3, 'F');
  
  doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const documentTitle = data.interestOnlyPayment 
    ? 'COMPROVANTE DE PAGAMENTO DE JUROS' 
    : `COMPROVANTE DE ${getContractTypeName(data.type)}`;
  doc.text(documentTitle, pageWidth / 2, currentY + 8, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const contractNumber = `Nº: ${getContractPrefix(data.type)}-${data.contractId.substring(0, 8).toUpperCase()}`;
  doc.text(contractNumber, pageWidth / 2, currentY + 14, { align: 'center' });

  currentY += 25;

  // === CLIENT DATA SECTION ===
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 45, 2, 2, 'S');

  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', margin + 5, currentY + 8);

  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  let clientY = currentY + 15;
  const col1X = margin + 5;
  const col2X = pageWidth / 2 + 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Nome:', col1X, clientY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.client.name || '-', col1X + 20, clientY);

  if (data.client.phone) {
    doc.setFont('helvetica', 'bold');
    doc.text('Telefone:', col2X, clientY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.client.phone, col2X + 25, clientY);
  }

  clientY += 8;

  if (data.client.cpf) {
    doc.setFont('helvetica', 'bold');
    doc.text('CPF:', col1X, clientY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.client.cpf, col1X + 15, clientY);
  }

  if (data.client.rg) {
    doc.setFont('helvetica', 'bold');
    doc.text('RG:', col2X, clientY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.client.rg, col2X + 12, clientY);
  }

  clientY += 8;

  if (data.client.email) {
    doc.setFont('helvetica', 'bold');
    doc.text('E-mail:', col1X, clientY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.client.email, col1X + 20, clientY);
  }

  clientY += 8;

  if (data.client.address) {
    doc.setFont('helvetica', 'bold');
    doc.text('Endereço:', col1X, clientY);
    doc.setFont('helvetica', 'normal');
    const maxWidth = pageWidth - 2 * margin - 35;
    const addressLines = doc.splitTextToSize(data.client.address, maxWidth);
    doc.text(addressLines[0] || '-', col1X + 28, clientY);
  }

  currentY += 52;

  // === VEHICLE INFO (if applicable) ===
  if (data.type === 'vehicle' && data.vehicleInfo) {
    doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 32, 2, 2, 'S');

    doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO VEÍCULO', margin + 5, currentY + 8);

    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFontSize(9);

    let vehY = currentY + 15;
    doc.setFont('helvetica', 'bold');
    doc.text('Veículo:', col1X, vehY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.vehicleInfo.brand} ${data.vehicleInfo.model} ${data.vehicleInfo.year}`, col1X + 22, vehY);

    if (data.vehicleInfo.plate) {
      doc.setFont('helvetica', 'bold');
      doc.text('Placa:', col2X, vehY);
      doc.setFont('helvetica', 'normal');
      doc.text(data.vehicleInfo.plate, col2X + 18, vehY);
    }

    vehY += 8;

    if (data.vehicleInfo.color) {
      doc.setFont('helvetica', 'bold');
      doc.text('Cor:', col1X, vehY);
      doc.setFont('helvetica', 'normal');
      doc.text(data.vehicleInfo.color, col1X + 12, vehY);
    }

    if (data.vehicleInfo.chassis) {
      doc.setFont('helvetica', 'bold');
      doc.text('Chassi:', col2X, vehY);
      doc.setFont('helvetica', 'normal');
      doc.text(data.vehicleInfo.chassis, col2X + 20, vehY);
    }

    currentY += 38;
  }

  // === PRODUCT INFO (if applicable) ===
  if (data.type === 'product' && data.productInfo) {
    doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 20, 2, 2, 'S');

    doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUTO', margin + 5, currentY + 8);

    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(data.productInfo.name, margin + 5, currentY + 15);

    currentY += 26;
  }

  // === NEGOTIATION DATA ===
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 45, 2, 2, 'S');

  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DA NEGOCIAÇÃO', margin + 5, currentY + 8);

  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(9);

  let negY = currentY + 15;

  // First row
  doc.setFont('helvetica', 'bold');
  doc.text(data.type === 'loan' ? 'Valor Emprestado:' : 'Valor Total:', col1X, negY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(data.negotiation.principal), col1X + (data.type === 'loan' ? 45 : 32), negY);

  if (data.negotiation.interestRate !== undefined && data.type === 'loan') {
    doc.setFont('helvetica', 'bold');
    doc.text('Taxa de Juros:', col2X, negY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.negotiation.interestRate.toFixed(2)}%`, col2X + 38, negY);
  }

  negY += 8;

  // Second row
  doc.setFont('helvetica', 'bold');
  doc.text('Parcelas:', col1X, negY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.negotiation.installments}x de ${formatCurrency(data.negotiation.installmentValue)}`, col1X + 25, negY);

  doc.setFont('helvetica', 'bold');
  doc.text('Início:', col2X, negY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(data.negotiation.startDate), col2X + 18, negY);

  negY += 8;

  // Third row - Total with highlight
  doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
  doc.roundedRect(col1X - 2, negY - 5, 85, 10, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.text('Total a Receber:', col1X, negY);
  doc.setFontSize(10);
  doc.text(formatCurrency(data.negotiation.totalToReceive), col1X + 40, negY);

  if (data.negotiation.downPayment && data.negotiation.downPayment > 0) {
    doc.setFontSize(9);
    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFont('helvetica', 'bold');
    doc.text('Entrada:', col2X, negY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(data.negotiation.downPayment), col2X + 22, negY);
  }

  currentY += 52;

  // === INTEREST ONLY PAYMENT INFO (if applicable) ===
  if (data.interestOnlyPayment) {
    const PURPLE = { r: 168, g: 85, b: 247 }; // #a855f7
    const LIGHT_PURPLE_BG = { r: 245, g: 235, b: 255 }; // light purple bg
    
    doc.setDrawColor(PURPLE.r, PURPLE.g, PURPLE.b);
    doc.setFillColor(LIGHT_PURPLE_BG.r, LIGHT_PURPLE_BG.g, LIGHT_PURPLE_BG.b);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 40, 2, 2, 'FD');

    doc.setTextColor(PURPLE.r, PURPLE.g, PURPLE.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGAMENTO DE JUROS', margin + 5, currentY + 8);

    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFontSize(9);

    let payY = currentY + 16;

    doc.setFont('helvetica', 'bold');
    doc.text('Valor Pago:', col1X, payY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(PURPLE.r, PURPLE.g, PURPLE.b);
    doc.text(formatCurrency(data.interestOnlyPayment.amountPaid), col1X + 28, payY);

    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFont('helvetica', 'bold');
    doc.text('Data:', col2X, payY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(data.interestOnlyPayment.paymentDate), col2X + 15, payY);

    payY += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Valor Restante:', col1X, payY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(PURPLE.r, PURPLE.g, PURPLE.b);
    doc.text(formatCurrency(data.interestOnlyPayment.remainingBalance), col1X + 38, payY);

    doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
    doc.setFontSize(7);
    payY += 8;
    doc.text('* Este pagamento corresponde apenas aos juros. O valor principal permanece inalterado.', margin + 5, payY);

    currentY += 48;
  }

  // === DUE DATES ===
  if (data.dueDates.length > 0) {
    const datesBoxHeight = Math.min(Math.ceil(data.dueDates.length / 3) * 8 + 15, 50);
    
    doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, datesBoxHeight, 2, 2, 'F');

    doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DATAS DE VENCIMENTO', margin + 5, currentY + 8);

    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    let dateY = currentY + 15;
    const colWidth = (pageWidth - 2 * margin) / 3;
    
    data.dueDates.slice(0, 15).forEach((date, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = margin + 5 + col * colWidth;
      const y = dateY + row * 7;
      
      doc.text(`${index + 1}ª: ${formatDate(date)}`, x, y);
    });

    if (data.dueDates.length > 15) {
      doc.text(`... e mais ${data.dueDates.length - 15} parcela(s)`, margin + 5, dateY + Math.ceil(15 / 3) * 7);
    }

    currentY += datesBoxHeight + 8;
  }

  // === SIGNATURES ===
  currentY = Math.max(currentY, 220);

  doc.setDrawColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setLineWidth(0.3);
  
  const sigWidth = 70;
  const sig1X = margin + 15;
  const sig2X = pageWidth - margin - sigWidth - 15;

  doc.line(sig1X, currentY, sig1X + sigWidth, currentY);
  doc.line(sig2X, currentY, sig2X + sigWidth, currentY);

  doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setFontSize(8);
  doc.text('Assinatura do Cliente', sig1X + sigWidth / 2, currentY + 5, { align: 'center' });
  doc.text('Assinatura da Empresa', sig2X + sigWidth / 2, currentY + 5, { align: 'center' });

  // === FOOTER BAR ===
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.rect(0, footerY, pageWidth, 15, 'F');

  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(8);
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, footerY + 9);
  doc.text('CobraFácil - Sistema de Gestão de Cobranças', pageWidth - margin, footerY + 9, { align: 'right' });

  // Download
  const fileName = `comprovante-${getContractPrefix(data.type).toLowerCase()}-${data.contractId.substring(0, 8)}.pdf`;
  doc.save(fileName);
};

export const generatePaymentReceipt = async (data: PaymentReceiptData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let currentY = 0;

  // Load logo
  let logoBase64 = '';
  try {
    logoBase64 = await loadLogoAsBase64();
  } catch (e) {
    console.warn('Could not load logo:', e);
  }

  // === HEADER BAR ===
  doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Logo
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 5, 40, 25);
  } else {
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('CobraFácil', margin, 22);
  }

  // Company name on the right
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (data.companyName) {
    doc.text(data.companyName, pageWidth - margin, 15, { align: 'right' });
  }

  currentY = 45;

  // === DOCUMENT TITLE ===
  doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 18, 3, 3, 'F');
  
  doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROVANTE DE PAGAMENTO', pageWidth / 2, currentY + 8, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const contractNumber = `Contrato: ${getContractPrefix(data.type)}-${data.contractId.substring(0, 8).toUpperCase()}`;
  doc.text(contractNumber, pageWidth / 2, currentY + 14, { align: 'center' });

  currentY += 28;

  // === PAYMENT INFO ===
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 70, 2, 2, 'S');

  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO PAGAMENTO', margin + 5, currentY + 8);

  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(10);

  let payY = currentY + 18;
  const col1X = margin + 5;

  // Client
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', col1X, payY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientName, col1X + 22, payY);

  payY += 10;

  // Installment
  doc.setFont('helvetica', 'bold');
  doc.text('Parcela:', col1X, payY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.installmentNumber}ª de ${data.totalInstallments}`, col1X + 22, payY);

  payY += 10;

  // Payment date
  doc.setFont('helvetica', 'bold');
  doc.text('Data do Pagamento:', col1X, payY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(data.paymentDate), col1X + 50, payY);

  payY += 12;

  // Amount paid - highlighted
  doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
  doc.roundedRect(col1X - 2, payY - 5, 100, 12, 1, 1, 'F');

  doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Valor Pago:', col1X, payY);
  doc.setFontSize(14);
  doc.text(formatCurrency(data.amountPaid), col1X + 32, payY);

  payY += 14;

  // Total do contrato (principal + juros)
  if (data.totalContract) {
    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Total do Contrato:', col1X, payY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(data.totalContract), col1X + 48, payY);
    payY += 10;
  }

  // Total pago até agora
  if (data.totalPaid) {
    doc.setFont('helvetica', 'bold');
    doc.text('Total Pago:', col1X, payY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(data.totalPaid), col1X + 30, payY);
    payY += 10;
  }

  // Remaining balance
  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Saldo Restante:', col1X, payY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(data.remainingBalance), col1X + 42, payY);

  currentY += 80;

  // === STATUS MESSAGE ===
  const isTotallyPaid = data.remainingBalance <= 0;
  
  doc.setFillColor(
    isTotallyPaid ? PRIMARY_GREEN.r : LIGHT_GREEN_BG.r,
    isTotallyPaid ? PRIMARY_GREEN.g : LIGHT_GREEN_BG.g,
    isTotallyPaid ? PRIMARY_GREEN.b : LIGHT_GREEN_BG.b
  );
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 20, 2, 2, 'F');

  doc.setTextColor(isTotallyPaid ? WHITE.r : DARK_GREEN.r, isTotallyPaid ? WHITE.g : DARK_GREEN.g, isTotallyPaid ? WHITE.b : DARK_GREEN.b);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  
  const statusText = isTotallyPaid ? '✓ CONTRATO QUITADO' : `Pagamento da ${data.installmentNumber}ª parcela confirmado`;
  doc.text(statusText, pageWidth / 2, currentY + 12, { align: 'center' });

  currentY += 35;

  // === SIGNATURES ===
  doc.setDrawColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setLineWidth(0.3);
  
  const sigWidth = 70;
  const sig1X = margin + 15;
  const sig2X = pageWidth - margin - sigWidth - 15;

  doc.line(sig1X, currentY, sig1X + sigWidth, currentY);
  doc.line(sig2X, currentY, sig2X + sigWidth, currentY);

  doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setFontSize(8);
  doc.text('Assinatura do Cliente', sig1X + sigWidth / 2, currentY + 5, { align: 'center' });
  doc.text('Assinatura da Empresa', sig2X + sigWidth / 2, currentY + 5, { align: 'center' });

  // === FOOTER BAR ===
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.rect(0, footerY, pageWidth, 15, 'F');

  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(8);
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, footerY + 9);
  doc.text('CobraFácil - Sistema de Gestão de Cobranças', pageWidth - margin, footerY + 9, { align: 'right' });

  // Download
  const fileName = `pagamento-${getContractPrefix(data.type).toLowerCase()}-${data.contractId.substring(0, 8)}-parcela${data.installmentNumber}.pdf`;
  doc.save(fileName);
};

// Interface for complete operations report
export interface LoanOperationData {
  id: string;
  clientName: string;
  principalAmount: number;
  interestRate: number;
  interestMode: string;
  installments: number;
  totalInterest: number;
  totalToReceive: number;
  totalPaid: number;
  remainingBalance: number;
  status: string;
  startDate: string;
  dueDate: string;
  paymentType: string;
  payments: {
    date: string;
    amount: number;
    principalPaid: number;
    interestPaid: number;
    notes?: string;
  }[];
}

export interface OperationsReportData {
  companyName: string;
  userName: string;
  generatedAt: string;
  loans: LoanOperationData[];
  summary: {
    totalLoans: number;
    totalLent: number;
    totalInterest: number;
    totalToReceive: number;
    totalReceived: number;
    totalPending: number;
    paidLoans: number;
    pendingLoans: number;
    overdueLoans: number;
  };
}

export const generateOperationsReport = async (data: OperationsReportData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = 0;
  let pageNumber = 1;

  // Dark background color (matching platform theme)
  const DARK_BG = { r: 17, g: 24, b: 39 }; // slate-900
  const CARD_BG = { r: 30, g: 41, b: 59 }; // slate-800

  // Load logo
  let logoBase64 = '';
  try {
    logoBase64 = await loadLogoAsBase64();
  } catch (e) {
    console.warn('Could not load logo:', e);
  }

  const drawBackground = () => {
    doc.setFillColor(DARK_BG.r, DARK_BG.g, DARK_BG.b);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const addHeader = () => {
    // Green header pill
    doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.roundedRect(margin, 10, pageWidth - 2 * margin, 25, 5, 5, 'F');

    // Logo or company name centered
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CobraFácil', pageWidth / 2, 22, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(data.companyName || data.userName, pageWidth / 2, 30, { align: 'center' });
  };

  const addFooter = () => {
    // Green footer pill
    doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.roundedRect(margin, pageHeight - 20, pageWidth - 2 * margin, 12, 3, 3, 'F');

    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(8);
    doc.text('CobraFácil - Sistema de Gestão de Cobranças', pageWidth / 2, pageHeight - 12, { align: 'center' });
    doc.setFontSize(6);
    doc.text(`Página ${pageNumber} | Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
  };

  const checkNewPage = (neededSpace: number) => {
    if (currentY + neededSpace > pageHeight - 30) {
      addFooter();
      doc.addPage();
      pageNumber++;
      drawBackground();
      addHeader();
      currentY = 50;
    }
  };

  const drawSectionHeader = (title: string, y: number) => {
    doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 8, 2, 2, 'F');
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 5, y + 5.5);
    return y + 10;
  };

  // === FIRST PAGE ===
  drawBackground();
  addHeader();
  currentY = 45;

  // === REPORT TITLE (pill style) ===
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setLineWidth(1);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 14, 3, 3, 'S');
  
  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE OPERAÇÕES - EMPRÉSTIMOS', pageWidth / 2, currentY + 9, { align: 'center' });

  currentY += 22;

  // === SUMMARY SECTION ===
  currentY = drawSectionHeader('RESUMO GERAL', currentY);

  // Summary card with dark background
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setLineWidth(0.5);
  doc.setFillColor(CARD_BG.r, CARD_BG.g, CARD_BG.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 45, 2, 2, 'FD');

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  let summaryY = currentY + 10;
  const col1X = margin + 8;
  const col2X = margin + 65;
  const col3X = margin + 125;

  // Row 1
  doc.text('Total de Contratos:', col1X, summaryY);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont('helvetica', 'bold');
  doc.text(data.summary.totalLoans.toString(), col1X + 42, summaryY);

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Emprestado:', col2X, summaryY);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.summary.totalLent), col2X + 40, summaryY);

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Total de Juros:', col3X, summaryY);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.summary.totalInterest), col3X + 32, summaryY);

  summaryY += 12;

  // Row 2
  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Total a Receber:', col1X, summaryY);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.summary.totalToReceive), col1X + 36, summaryY);

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Recebido:', col2X, summaryY);
  doc.setTextColor(34, 197, 94);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.summary.totalReceived), col2X + 34, summaryY);

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Pendente:', col3X, summaryY);
  doc.setTextColor(239, 68, 68);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.summary.totalPending), col3X + 22, summaryY);

  summaryY += 12;

  // Row 3 - Status counts
  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Pagos:', col1X, summaryY);
  doc.setTextColor(34, 197, 94);
  doc.setFont('helvetica', 'bold');
  doc.text(data.summary.paidLoans.toString(), col1X + 16, summaryY);

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Pendentes:', col2X, summaryY);
  doc.setTextColor(234, 179, 8);
  doc.setFont('helvetica', 'bold');
  doc.text(data.summary.pendingLoans.toString(), col2X + 25, summaryY);

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Em Atraso:', col3X, summaryY);
  doc.setTextColor(239, 68, 68);
  doc.setFont('helvetica', 'bold');
  doc.text(data.summary.overdueLoans.toString(), col3X + 25, summaryY);

  currentY += 55;

  // === LOANS LIST ===
  currentY = drawSectionHeader('DETALHAMENTO DOS CONTRATOS', currentY);

  for (const loan of data.loans) {
    checkNewPage(55);

    // Loan card with status color header
    const statusColor = loan.status === 'paid' ? { r: 34, g: 197, b: 94 } : 
                       loan.status === 'overdue' ? { r: 239, g: 68, b: 68 } : 
                       loan.status === 'interest_only' ? { r: 168, g: 85, b: 247 } :
                       { r: 234, g: 179, b: 8 };

    // Card header with status
    doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 7, 2, 2, 'F');

    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const statusText = loan.status === 'paid' ? 'PAGO' : 
                      loan.status === 'overdue' ? 'EM ATRASO' : 
                      loan.status === 'interest_only' ? 'SÓ JUROS' : 'PENDENTE';
    doc.text(`EMP-${loan.id.substring(0, 8).toUpperCase()} | ${loan.clientName}`, margin + 5, currentY + 5);
    doc.text(statusText, pageWidth - margin - 5, currentY + 5, { align: 'right' });

    currentY += 8;

    // Check if it's an interest-only payment loan - simplified layout
    if (loan.status === 'interest_only') {
      doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
      doc.setLineWidth(0.5);
      doc.setFillColor(CARD_BG.r, CARD_BG.g, CARD_BG.b);
      doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 18, 2, 2, 'FD');

      doc.setFontSize(9);
      let detailY = currentY + 7;

      // Line 1: Cliente pagou só o juros
      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'normal');
      doc.text('Cliente pagou só o juros:', margin + 8, detailY);
      doc.setTextColor(168, 85, 247);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(loan.totalPaid), margin + 58, detailY);

      // Line 2: Falta
      detailY += 7;
      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'normal');
      doc.text('Falta:', margin + 8, detailY);
      doc.setTextColor(239, 68, 68);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(loan.remainingBalance), margin + 22, detailY);

      currentY += 23;
    } else {
      // Standard layout card
      doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
      doc.setLineWidth(0.5);
      doc.setFillColor(CARD_BG.r, CARD_BG.g, CARD_BG.b);
      doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 30, 2, 2, 'FD');

      doc.setFontSize(8);
      let detailY = currentY + 7;
      const dcol1 = margin + 8;
      const dcol2 = margin + 65;
      const dcol3 = margin + 125;

      // Row 1
      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'normal');
      doc.text('Valor Emprestado:', dcol1, detailY);
      doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(loan.principalAmount), dcol1 + 40, detailY);

      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'normal');
      doc.text('Taxa de Juros:', dcol2, detailY);
      doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
      doc.setFont('helvetica', 'bold');
      doc.text(`${loan.interestRate.toFixed(2)}%`, dcol2 + 32, detailY);

      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'normal');
      doc.text('Início:', dcol3, detailY);
      doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
      doc.setFont('helvetica', 'bold');
      doc.text(formatDate(loan.startDate), dcol3 + 15, detailY);

      detailY += 8;

      // Row 2
      const paymentTypeLabel = loan.paymentType === 'single' ? 'Único' : 
                              loan.paymentType === 'installment' ? 'Parcelado' :
                              loan.paymentType === 'daily' ? 'Diário' : 'Semanal';
      
      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'normal');
      doc.text('Parcelas:', dcol1, detailY);
      doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
      doc.setFont('helvetica', 'bold');
      doc.text(`${loan.installments}x de ${formatCurrency(loan.totalToReceive / loan.installments)}`, dcol1 + 22, detailY);

      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'normal');
      doc.text('Tipo:', dcol2, detailY);
      doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
      doc.setFont('helvetica', 'bold');
      doc.text(paymentTypeLabel, dcol2 + 14, detailY);

      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'normal');
      doc.text('Vencimento:', dcol3, detailY);
      doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
      doc.setFont('helvetica', 'bold');
      doc.text(formatDate(loan.dueDate), dcol3 + 28, detailY);

      detailY += 8;

      // Row 3 - Total a Receber highlight
      doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
      doc.roundedRect(margin + 3, detailY - 3, pageWidth - 2 * margin - 6, 7, 1, 1, 'F');

      doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
      doc.setFont('helvetica', 'bold');
      doc.text('Total a Receber:', margin + 8, detailY + 2);
      doc.text(formatCurrency(loan.totalToReceive), pageWidth - margin - 8, detailY + 2, { align: 'right' });

      currentY += 35;
    }

    // Payments history (if any)
    if (loan.payments.length > 0) {
      checkNewPage(12 + loan.payments.length * 5);
      
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Histórico de Pagamentos:', margin + 5, currentY);
      currentY += 5;

      doc.setFont('helvetica', 'normal');
      for (const payment of loan.payments) {
        doc.setTextColor(150, 150, 150);
        doc.text(`• ${formatDate(payment.date)} - `, margin + 8, currentY);
        doc.setTextColor(34, 197, 94);
        doc.text(`${formatCurrency(payment.amount)}`, margin + 38, currentY);
        doc.setTextColor(150, 150, 150);
        doc.text(`(Principal: ${formatCurrency(payment.principalPaid)}, Juros: ${formatCurrency(payment.interestPaid)})`, margin + 62, currentY);
        currentY += 5;
      }
    }

    currentY += 5;
  }

  addFooter();

  // Download
  const fileName = `relatorio-operacoes-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
