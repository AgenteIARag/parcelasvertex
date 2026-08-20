import { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  IconButton,
  Tooltip,
  useTheme,
  Divider,
  Button,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Alert,
} from '@mui/material';
import Checkbox from '@mui/material/Checkbox';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableSortLabel from '@mui/material/TableSortLabel';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptIcon from '@mui/icons-material/Receipt';
import RemoveCircleOutlinedIcon from '@mui/icons-material/RemoveCircleOutlined';
import Snackbar from '@mui/material/Snackbar';
import type { LancamentoVenda, Vendedor, RegraMaster, UserPermissions, StatusParcela } from '../types';
import { EditarVendaDialog } from './SimuladorVendas';
import { obterStatusEfetivo } from '../utils/formatters';
import { salvarVendaSupabase } from '../utils/supabase';


// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const NOMES_MESES: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

const formatarMoeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatarData = (iso: string): string => {
  if (!iso || iso.includes('undefined')) return '—';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

const formatarMesAno = (iso: string): string => {
  if (!iso || iso.includes('undefined')) return '—';
  const [ano, mes] = iso.split('-');
  return `${NOMES_MESES[mes] || mes}/${ano}`;
};

const calcularDataPrevisaoRecebimento = (
  dataVenc: string,
  _ciclos?: Record<string, [number, number]>
): string => {
  if (!dataVenc || dataVenc.includes('undefined')) return '';
  const dt = new Date(`${dataVenc}T00:00:00`);
  if (isNaN(dt.getTime())) return '';
  // Previsão = último dia do mês de vencimento da parcela
  const ultimoDia = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
  const ano = ultimoDia.getFullYear();
  const mes = String(ultimoDia.getMonth() + 1).padStart(2, '0');
  const dia = String(ultimoDia.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};



// ──────────────────────────────────────────────────────────
// Tipos internos
// ──────────────────────────────────────────────────────────

interface ParcelaLinha {
  id: string;
  vendaId: string;
  cliente: string;
  pac: string;
  vendedorNome: string;
  segmento: string;
  tabela: string;
  dataVenda: string;          // YYYY-MM-DD (data da venda)
  mesReferencia: string;      // YYYY-MM
  dataVencimento: string;     // YYYY-MM-DD
  dataPrevisaoRecebimento: string; // YYYY-MM-DD (último dia do mês de vencimento)
  comissao: number;
  valorParcela: number;
  valorVenda: number;
  statusParcela: StatusParcela;
  situacaoRecebimento: 'A receber' | 'Recebida';
  parcelaIndex: number;
  qtdParcelas: number;
  numeroRelatorio?: string;   // Nº do relatório ADM da venda
  dataRelatorio?: string;     // Data do relatório ADM (YYYY-MM-DD)
  // Campos de controle de pagamento e recebimento
  dataPagamentoCliente?: string;       // Data em que o cliente pagou (YYYY-MM-DD)
  numeroRelatorioRecebimento?: string; // Nº do relatório do recebimento da comissão
  notaFiscalRecebimento?: string;      // NF relativa ao recebimento da comissão
  dataRecebimentoComissao?: string;    // Data de recebimento da comissão (YYYY-MM-DD)
  // Espelhamento
  grupoVisual: string;                 // Mês em que a linha será renderizada (YYYY-MM)
  isEspelho: boolean;                  // True se for a linha de caixa (gerada no mês do pagamento)
  pagaForaCompetencia: boolean;        // True se a parcela foi paga num mês diferente do vencimento
}

interface TotaisStatus {
  aVencer: number;
  vencida: number;
  paga: number;
  recebida: number;
  cancelada: number;
  aReceber: number;   // = aVencer + vencida (ainda não liquidado)
  espelhoRecebido: number; // Valor (comissão) espelhada que entrou neste mês vinda de meses anteriores
  pagaForaMes: number;     // Valor (comissão) da competência original que foi paga apenas em meses futuros
}

interface GrupoPeriodo {
  mesPeriodo: string;         // YYYY-MM (chave de agrupamento por mês)
  totalComissoes: number;
  totalParcelas: number;
  qtdParcelas: number;
  itens: ParcelaLinha[];
  totaisStatus: TotaisStatus;
}

// ──────────────────────────────────────────────────────────
// Helper: calcula totais de comissão por status
// ──────────────────────────────────────────────────────────

const calcularTotaisStatus = (itens: ParcelaLinha[]): TotaisStatus => {
  const t: TotaisStatus = { aVencer: 0, vencida: 0, paga: 0, recebida: 0, cancelada: 0, aReceber: 0, espelhoRecebido: 0, pagaForaMes: 0 };
  itens.forEach((i) => {
    const v = i.comissao;
    
    // Se for espelho, conta apenas no total de espelho recebido (Caixa de meses anteriores)
    if (i.isEspelho) {
      t.espelhoRecebido += v;
      return;
    }

    // Se for original e foi paga fora do mês, soma no KPI de atraso/desvio
    if (i.pagaForaCompetencia && i.statusParcela === 'Paga') {
      t.pagaForaMes += v;
    }

    if (i.statusParcela === 'Cancelada') t.cancelada += v;
    else if (i.statusParcela === 'Paga') t.paga += v;
    else if (i.statusParcela === 'Vencida') t.vencida += v;
    else if (i.statusParcela === 'A vencer') t.aVencer += v;

    if (i.situacaoRecebimento === 'Recebida') t.recebida += v;
    else t.aReceber += v;
  });
  return t;
};

// ──────────────────────────────────────────────────────────
// Sub-componente: Mini badges de status com valor
// ──────────────────────────────────────────────────────────

const StatusValorRow = ({ totais }: { totais: TotaisStatus }) => {
  const items = [
    { label: 'Cancelada', value: totais.cancelada, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    { label: 'A vencer',  value: totais.aVencer,   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    { label: 'Vencida',   value: totais.vencida,   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    { label: 'Paga',      value: totais.paga,      color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    { label: 'A receber', value: totais.aReceber,  color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
    { label: 'Recebida',  value: totais.recebida,  color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  ];

  if (totais.pagaForaMes > 0) {
    items.push({ label: 'Paga em Atraso (Outro Mês)', value: totais.pagaForaMes, color: '#eab308', bg: 'rgba(234,179,8,0.12)' });
  }
  if (totais.espelhoRecebido > 0) {
    items.push({ label: 'Caixa Adicional (Meses Anteriores)', value: totais.espelhoRecebido, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' });
  }

  const validItems = items.filter((item) => item.value > 0);

  if (validItems.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', alignItems: 'center' }}>
      {validItems.map((item) => (
        <Tooltip key={item.label} title={item.label}>
          <Box sx={{
            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
            px: 0.7, py: 0.2, borderRadius: 1.2,
            bgcolor: item.bg, color: item.color, whiteSpace: 'nowrap'
          }}>
            <Typography sx={{ fontSize: '0.54rem', fontWeight: 700, lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: '0.2px' }}>
              {item.label}
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, lineHeight: 1.1, fontFamily: 'Outfit, sans-serif' }}>
              {formatarMoeda(item.value)}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
};

// ──────────────────────────────────────────────────────────
// Sub-componente: Badging de Status e Recebimento
// ──────────────────────────────────────────────────────────

const StatusParcelaBadge = ({ status }: { status: StatusParcela }) => {
  const map: Record<StatusParcela, { color: string; bg: string; icon: React.ReactNode }> = {
    'A vencer':  { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',   icon: <HourglassEmptyIcon sx={{ fontSize: 12 }} /> },
    'Vencida':   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    icon: <CancelIcon sx={{ fontSize: 12 }} /> },
    'Paga':      { color: '#10b981', bg: 'rgba(16,185,129,0.12)',   icon: <CheckCircleIcon sx={{ fontSize: 12 }} /> },
    'Cancelada': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    icon: <CancelIcon sx={{ fontSize: 12 }} /> },
  };
  const s = map[status] || map['A vencer'];
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 1, py: 0.25,
      borderRadius: 99, bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: '0.7rem'
    }}>
      {s.icon} {status}
    </Box>
  );
};

const SituacaoRecebimentoBadge = ({ situacao }: { situacao: 'A receber' | 'Recebida' }) => {
  const isRecebida = situacao === 'Recebida';
  const color = isRecebida ? '#0ea5e9' : '#f97316';
  const bg = isRecebida ? 'rgba(14,165,233,0.12)' : 'rgba(249,115,22,0.12)';
  const icon = isRecebida ? <CheckCircleIcon sx={{ fontSize: 12 }} /> : <HourglassEmptyIcon sx={{ fontSize: 12 }} />;

  return (
    <Tooltip title="Situação do recebimento (Informação não editável)">
      <Box sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 1, py: 0.25,
        borderRadius: 99, bgcolor: bg, color: color, fontWeight: 700, fontSize: '0.7rem',
        userSelect: 'none', cursor: 'default'
      }}>
        {icon} {situacao}
      </Box>
    </Tooltip>
  );
};

// ──────────────────────────────────────────────────────────
// PDF Export Helper
// ──────────────────────────────────────────────────────────

const exportarRecebimentosParaPDF = (mesAnoFormatado: string, itens: ParcelaLinha[], totais: { totalComissoes: number, totalCredito: number }) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Título e Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(99, 102, 241); // Indigo
  doc.text('APEX - Relatório de Previsão de Recebimentos', 14, 15);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Período de Referência: ${mesAnoFormatado}`, 14, 21);

  // Resumo Financeiro
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 25, 269, 15, 'F');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Total de Parcelas: ${itens.length}`, 20, 34);
  doc.text(`Valor Total do Crédito: ${formatarMoeda(totais.totalCredito)}`, 100, 34);
  doc.text(`Comissões a Receber: ${formatarMoeda(totais.totalComissoes)}`, 190, 34);

  // Tabela
  const headers = [
    'Cliente / PAC',
    'Vendedor',
    'Data Venda',
    'Vencimento',
    'Nº Rel ADM',
    'Data Rel',
    'Valor da Cota',
    'Parcela',
    'Tabela',
    'Status Parcela',
    'Recebimento',
    'Parcela Nº',
    'Comissão'
  ];

  const rows = itens.map(item => [
    item.cliente + (item.pac ? `\nPAC: ${item.pac}` : ''),
    item.vendedorNome || '—',
    item.dataVenda ? formatarData(item.dataVenda) : '—',
    formatarData(item.dataVencimento),
    item.numeroRelatorio || '—',
    item.dataRelatorio ? formatarData(item.dataRelatorio) : '—',
    formatarMoeda(item.valorVenda),
    formatarMoeda(item.valorParcela),
    item.tabela,
    item.statusParcela,
    item.situacaoRecebimento,
    `${item.parcelaIndex}/${item.qtdParcelas}`,
    formatarMoeda(item.comissao)
  ]);

  autoTable(doc, {
    startY: 45,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85],
      valign: 'top'
    },
    columnStyles: {
      0: { cellWidth: 32 }, // Cliente / PAC
      1: { cellWidth: 18 }, // Vendedor
      2: { cellWidth: 15 }, // Data Venda
      3: { cellWidth: 15 }, // Vencimento
      4: { cellWidth: 16 }, // Nº Rel ADM
      5: { cellWidth: 15 }, // Data Rel
      6: { cellWidth: 18, halign: 'right' }, // Valor da Cota
      7: { cellWidth: 18, halign: 'right' }, // Parcela
      8: { cellWidth: 25 }, // Tabela
      9: { cellWidth: 18, halign: 'center' }, // Status Parcela
      10: { cellWidth: 18, halign: 'center' }, // Recebimento
      11: { cellWidth: 12, halign: 'center' }, // Parcela Nº
      12: { cellWidth: 18, halign: 'right' } // Comissão
    },
    margin: { left: 14, right: 14 }
  });

  // Adicionar numeração de página no final
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    const numPaginaStr = `Página ${i} de ${totalPages}`;
    doc.text(numPaginaStr, 283 - doc.getTextWidth(numPaginaStr), 200);
    doc.text('Gerado por APEX - Previsão de Recebimentos', 14, 200);
  }

  // Salvar PDF
  doc.save(`apex_recebimentos_${mesAnoFormatado.replace('/', '_')}.pdf`);
};

// ──────────────────────────────────────────────────────────
// Helper de Ordenação Genérica
// ──────────────────────────────────────────────────────────

type Order = 'asc' | 'desc';

function obterValorOrdenacao(item: ParcelaLinha, campo: string) {
  switch (campo) {
    case 'cliente':
      return item.cliente || '';
    case 'vendedorNome':
      return item.vendedorNome || '';
    case 'dataVenda':
      return item.dataVenda || '';
    case 'dataVencimento':
      return item.dataVencimento || '';
    case 'dataPagamentoCliente':
      return item.dataPagamentoCliente || '';
    case 'numeroRelatorio':
      return item.numeroRelatorio || '';
    case 'dataRelatorio':
      return item.dataRelatorio || '';
    case 'valorVenda':
      return item.valorVenda || 0;
    case 'valorParcela':
      return item.valorParcela || 0;
    case 'tabela':
      return item.tabela || '';
    case 'statusParcela':
      return item.statusParcela || '';
    case 'situacaoRecebimento':
      return item.situacaoRecebimento || '';
    case 'dataRecebimentoComissao':
      return item.dataRecebimentoComissao || '';
    case 'parcelaIndex':
      return item.parcelaIndex || 0;
    case 'comissao':
      return item.comissao || 0;
    default:
      return '';
  }
}

function ordenarItens(itens: ParcelaLinha[], orderBy: string, order: Order): ParcelaLinha[] {
  return [...itens].sort((a, b) => {
    const valA = obterValorOrdenacao(a, orderBy);
    const valB = obterValorOrdenacao(b, orderBy);

    if (typeof valA === 'number' && typeof valB === 'number') {
      return order === 'asc' ? valA - valB : valB - valA;
    }

    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();

    if (strA < strB) return order === 'asc' ? -1 : 1;
    if (strA > strB) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

// ──────────────────────────────────────────────────────────
// Sub-componente: Sub-grupo por data de corte
// ──────────────────────────────────────────────────────────

const SubGrupoData = ({
  dataRecebimento,
  itens,
  totalComissoes,
  totalCredito,
  bgCard,
  selecionadas,
  onToggleSelecionar,
  onToggleSelecionarData,
  onEditarVenda,
  onMarcarPaga,
  onMarcarRecebida,
  onDesfazerPaga,
  onDesfazerRecebida,
  permissoes,
  isMaster,
}: {
  dataRecebimento: string;
  itens: ParcelaLinha[];
  totalComissoes: number;
  totalCredito: number;
  bgCard?: string;
  selecionadas: string[];
  onToggleSelecionar: (id: string) => void;
  onToggleSelecionarData: (ids: string[], marcar: boolean) => void;
  onEditarVenda?: (vendaId: string) => void;
  onMarcarPaga?: (item: ParcelaLinha) => void;
  onMarcarRecebida?: (item: ParcelaLinha) => void;
  onDesfazerPaga?: (item: ParcelaLinha) => void;
  onDesfazerRecebida?: (item: ParcelaLinha) => void;
  permissoes?: UserPermissions;
  isMaster?: boolean;
}) => {
  const totaisStatus = calcularTotaisStatus(itens);
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const isDark = theme.palette.mode === 'dark';
  const hoje = new Date().toISOString().split('T')[0];
  const isHoje = dataRecebimento === hoje;
  const isPast = dataRecebimento < hoje;

  // Estados de Ordenação
  const [orderBy, setOrderBy] = useState<string>('cliente');
  const [order, setOrder] = useState<Order>('asc');

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const colunas = [
    { label: 'Cliente / PAC', field: 'cliente' },
    { label: 'Vendedor', field: 'vendedorNome' },
    { label: 'Data Venda', field: 'dataVenda' },
    { label: 'Vencimento', field: 'dataVencimento' },
    { label: 'DT. PAG', field: 'dataPagamentoCliente' },
    { label: 'Nº Rel', field: 'numeroRelatorio' },
    { label: 'Data Rel', field: 'dataRelatorio' },
    { label: 'Valor da Cota', field: 'valorVenda' },
    { label: 'Parcela', field: 'valorParcela' },
    { label: 'Tabela', field: 'tabela' },
    { label: 'Status', field: 'statusParcela' },
    { label: 'Recebimento', field: 'situacaoRecebimento' },
    { label: 'DT. RECEB.', field: 'dataRecebimentoComissao' },
    { label: 'Parcela Nº', field: 'parcelaIndex' },
    { label: 'Comissão', field: 'comissao' },
    { label: 'Ações', field: 'acoes' },
  ];

  const itensOrdenados = useMemo(() => {
    return ordenarItens(itens, orderBy, order);
  }, [itens, orderBy, order]);

  // Cores de fundo sólidas e 100% opacas para colunas congeladas
  const stickyBgHeader = isDark ? '#0f172a' : '#f8fafc';

  return (
    <Box sx={{ borderBottom: `1px solid ${isDark ? '#1f2937' : '#f1f5f9'}`, '&:last-child': { borderBottom: 0 } }}>
      {/* Header do sub-grupo */}
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 3,
          py: 1.2,
          cursor: 'pointer',
          bgcolor: isHoje
            ? (isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)')
            : 'transparent',
          '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)' },
        }}
      >
        <IconButton size="small" sx={{ p: 0.2, color: 'text.secondary' }}>
          {open ? <KeyboardArrowDownIcon sx={{ fontSize: 16 }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />}
        </IconButton>

        {/* Data */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 160 }}>
          <Box sx={{
            width: 7, height: 7, borderRadius: '50%',
            bgcolor: isHoje ? '#6366f1' : isPast ? '#f59e0b' : '#10b981',
            flexShrink: 0,
          }} />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', lineHeight: 1, fontSize: '0.68rem' }}>
              Corte de
            </Typography>
            <Typography variant="body2" sx={{
              fontWeight: 800,
              fontFamily: 'Outfit, sans-serif',
              color: isHoje ? theme.palette.primary.main : isPast ? '#f59e0b' : '#10b981',
              fontSize: '0.88rem',
            }}>
              {formatarData(dataRecebimento)}
            </Typography>
          </Box>
          {isHoje && (
            <Chip label="HOJE" size="small" sx={{
              height: 18, fontSize: '0.58rem', fontWeight: 800,
              background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff',
            }} />
          )}
          {isPast && !isHoje && (
            <Chip label="Passado" size="small" sx={{
              height: 18, fontSize: '0.58rem', fontWeight: 700,
              bgcolor: isDark ? '#374151' : '#e5e7eb', color: 'text.secondary',
            }} />
          )}
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 28 }} />

        {/* Métricas do sub-grupo */}
        <Box sx={{ display: 'flex', gap: 3, flexGrow: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.65rem', display: 'block' }}>
              Comissões
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#10b981', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem' }}>
              {formatarMoeda(totalComissoes)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.65rem', display: 'block' }}>
              Crédito
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem' }}>
              {formatarMoeda(totalCredito)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.65rem', display: 'block' }}>
              Parcelas
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem' }}>
              {itens.length}
            </Typography>
          </Box>
          {/* Breakdown por status com valor a receber */}
          <Box sx={{ ml: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.62rem', display: 'block', mb: 0.3 }}>
              Por Status
            </Typography>
            <StatusValorRow totais={totaisStatus} />
          </Box>
        </Box>
      </Box>

      {/* Tabela do sub-grupo */}
      <Collapse in={open} timeout="auto" unmountOnExit>
        <TableContainer sx={{ overflowX: 'auto', width: '100%' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 12,
                  width: 36,
                  minWidth: 36,
                  maxWidth: 36,
                  bgcolor: stickyBgHeader,
                  py: 0.8,
                  px: 0.5,
                  textAlign: 'center',
                }}>
                  <Checkbox
                    size="small"
                    checked={itens.length > 0 && itens.every(i => selecionadas.includes(i.id))}
                    indeterminate={itens.some(i => selecionadas.includes(i.id)) && !itens.every(i => selecionadas.includes(i.id))}
                    onChange={(e) => onToggleSelecionarData(itens.map(i => i.id), e.target.checked)}
                    sx={{ p: 0.2 }}
                  />
                </TableCell>
                {colunas.map((col, index) => {
                  let stickySx = {};
                  if (index === 0) {
                    stickySx = {
                      position: 'sticky',
                      left: 36,
                      zIndex: 11,
                      width: 210,
                      minWidth: 210,
                      bgcolor: stickyBgHeader,
                    };
                  } else if (index === 1) {
                    stickySx = {
                      position: 'sticky',
                      left: 246,
                      zIndex: 11,
                      width: 120,
                      minWidth: 120,
                      bgcolor: stickyBgHeader,
                    };
                  } else if (index === 2) {
                    stickySx = {
                      position: 'sticky',
                      left: 366,
                      zIndex: 11,
                      width: 95,
                      minWidth: 95,
                      bgcolor: stickyBgHeader,
                      borderRight: `2px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                    };
                  }
                  const isSortedActive = orderBy === col.field;
                  return (
                    <TableCell key={col.label} sx={{
                      fontWeight: 700, fontSize: '0.68rem', color: 'text.secondary',
                      bgcolor: isDark ? '#0a0e18' : '#f8fafc', textTransform: 'uppercase',
                      letterSpacing: '0.4px', whiteSpace: 'nowrap', py: 0.8,
                      pl: col.label === 'Cliente / PAC' ? 2 : undefined,
                      ...stickySx
                    }}>
                      <TableSortLabel
                        active={isSortedActive}
                        direction={isSortedActive ? order : 'asc'}
                        onClick={() => handleRequestSort(col.field)}
                        sx={{
                          '&.MuiTableSortLabel-root': {
                            color: isSortedActive ? 'text.primary' : 'inherit',
                          },
                          '&.MuiTableSortLabel-root:hover': {
                            color: 'text.primary',
                          },
                          '& .MuiTableSortLabel-icon': {
                            color: `${theme.palette.primary.main} !important`,
                          }
                        }}
                      >
                        {col.label}
                      </TableSortLabel>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {itensOrdenados
                .map((item, idx, arr) => {
                  const isFirstOfGroup = idx === 0 || item.cliente !== arr[idx - 1].cliente;
                  const isLastOfGroup  = idx === arr.length - 1 || item.cliente !== arr[idx + 1].cliente;
                  
                  const isLaranja = item.isEspelho;
                  const isAmarelo = !item.isEspelho && item.pagaForaCompetencia && item.statusParcela === 'Paga';
                  
                  const baseRowBg = bgCard && bgCard !== 'transparent' ? bgCard : (isDark ? '#111827' : '#ffffff');
                  
                  // Cores opacas sólidas para as sticky columns e para todas as células da linha
                  const rowBg = isLaranja 
                    ? (isDark ? '#563020' : '#FCE1CB') 
                    : isAmarelo 
                      ? (isDark ? '#4D4519' : '#FDF1C2') 
                      : baseRowBg;

                  const rowHoverBg = isLaranja 
                    ? (isDark ? '#6B3C28' : '#FBD1AE') 
                    : isAmarelo 
                      ? (isDark ? '#61561E' : '#FCEB9C') 
                      : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)');

                  return (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{
                        bgcolor: `${rowBg} !important`,
                        '& > td': { 
                          bgcolor: `${rowBg} !important`, 
                          borderBottom: isLastOfGroup ? undefined : 'none' 
                        },
                        '&:last-child td': { border: 0 },
                        '&:hover': {
                          bgcolor: `${rowHoverBg} !important`,
                          '& > td': { bgcolor: `${rowHoverBg} !important` }
                        },
                        ...(isFirstOfGroup && idx > 0 ? {
                          '& td': { borderTop: `2px solid ${isDark ? '#1f2937' : '#e5e7eb'} !important` },
                        } : {}),
                      }}
                    >
                      {/* Checkbox de Linha com Fundo Sólido Opaco */}
                      <TableCell sx={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 3,
                        bgcolor: rowBg,
                        width: 36,
                        minWidth: 36,
                        maxWidth: 36,
                        py: 0.8,
                        px: 0.5,
                        textAlign: 'center',
                      }}>
                        <Checkbox
                          size="small"
                          checked={selecionadas.includes(item.id)}
                          onChange={() => onToggleSelecionar(item.id)}
                          sx={{ p: 0.2 }}
                        />
                      </TableCell>
                      {/* Célula Cliente/PAC com Fundo Sólido Opaco */}
                      <TableCell
                        sx={{
                          py: 0.8, pl: 2, pr: 1.5,
                          borderBottom: isLastOfGroup ? undefined : 'none',
                          verticalAlign: 'top',
                          position: 'sticky',
                          left: 36,
                          zIndex: 3,
                          bgcolor: rowBg,
                          width: 210,
                          minWidth: 210,
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>{item.cliente}</Typography>
                        {item.pac && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                            PAC: {item.pac}
                          </Typography>
                        )}
                        {item.isEspelho && (
                           <Box sx={{ display: 'block', mt: 0.5 }}>
                             <Chip size="small" label={`Ref: ${item.dataVencimento.substring(5, 7)}/${item.dataVencimento.substring(0, 4)}`} sx={{ height: 16, fontSize: '0.55rem', bgcolor: 'rgba(139,92,246,0.12)', color: '#8b5cf6', fontWeight: 700 }} />
                           </Box>
                        )}
                      </TableCell>
                      {/* Célula Vendedor com Fundo Sólido Opaco */}
                      <TableCell sx={{
                        py: 0.8, fontSize: '0.75rem', color: 'text.secondary',
                        position: 'sticky',
                        left: 246,
                        zIndex: 3,
                        bgcolor: rowBg,
                        width: 120,
                        minWidth: 120,
                      }}>
                        {item.vendedorNome || '—'}
                      </TableCell>
                      {/* Célula Data Venda com Fundo Sólido Opaco */}
                      <TableCell sx={{
                        py: 0.8, fontSize: '0.75rem', whiteSpace: 'nowrap', color: 'text.secondary',
                        position: 'sticky',
                        left: 366,
                        zIndex: 3,
                        bgcolor: rowBg,
                        width: 95,
                        minWidth: 95,
                        borderRight: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                      }}>
                        {item.dataVenda ? formatarData(item.dataVenda) : '—'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: rowBg, py: 0.8, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {formatarData(item.dataVencimento)}
                      </TableCell>
                      {/* Dt. Pagamento pelo Cliente */}
                      <TableCell sx={{ bgcolor: rowBg, py: 0.8, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                        {item.dataPagamentoCliente ? (
                          <Box sx={{
                            display: 'inline-flex', alignItems: 'center', gap: 0.4,
                            px: 0.8, py: 0.2, borderRadius: 1,
                            bgcolor: 'rgba(16,185,129,0.1)', color: '#10b981',
                            fontWeight: 700, fontSize: '0.7rem'
                          }}>
                            {formatarData(item.dataPagamentoCliente)}
                          </Box>
                        ) : (
                          <Typography sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>—</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ bgcolor: rowBg, py: 0.8, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                        {item.numeroRelatorio ? (
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.8, py: 0.2, borderRadius: 1, bgcolor: 'rgba(99,102,241,0.1)', color: '#6366f1', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.7rem' }}>
                            {item.numeroRelatorio}
                          </Box>
                        ) : '—'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: rowBg, py: 0.8, fontSize: '0.72rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {item.dataRelatorio ? formatarData(item.dataRelatorio) : '—'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: rowBg, py: 0.8, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', color: 'text.primary' }}>
                        {formatarMoeda(item.valorVenda)}
                      </TableCell>
                      <TableCell sx={{ bgcolor: rowBg, py: 0.8, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {formatarMoeda(item.valorParcela)}
                      </TableCell>
                      <TableCell sx={{ bgcolor: rowBg, py: 0.8, fontSize: '0.68rem', color: 'text.secondary' }}>
                        {item.tabela}
                      </TableCell>
                      <TableCell sx={{ bgcolor: rowBg, py: 0.8 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                          <StatusParcelaBadge status={item.statusParcela} />
                          {!item.isEspelho && item.pagaForaCompetencia && item.statusParcela === 'Paga' && (
                            <Chip size="small" label="Paga Atrasada" sx={{ height: 14, fontSize: '0.5rem', bgcolor: 'rgba(234,179,8,0.15)', color: '#eab308', fontWeight: 800 }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ bgcolor: rowBg, py: 0.8 }}>
                        <SituacaoRecebimentoBadge situacao={item.situacaoRecebimento} />
                      </TableCell>
                      {/* Dt. Recebimento da Comissão */}
                      <TableCell sx={{ bgcolor: rowBg, py: 0.8, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                        {item.dataRecebimentoComissao ? (
                          <Box sx={{
                            display: 'inline-flex', alignItems: 'center', gap: 0.4,
                            px: 0.8, py: 0.2, borderRadius: 1,
                            bgcolor: 'rgba(14,165,233,0.1)', color: '#0ea5e9',
                            fontWeight: 700, fontSize: '0.7rem'
                          }}>
                            {formatarData(item.dataRecebimentoComissao)}
                          </Box>
                        ) : (
                          <Typography sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>—</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ bgcolor: rowBg, py: 0.8, fontSize: '0.75rem', textAlign: 'center', color: 'text.secondary' }}>
                        <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 0.3 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.primary' }}>
                            {item.parcelaIndex}/{item.qtdParcelas}
                          </Typography>
                          {item.parcelaIndex === 1 ? (
                            <Chip
                              label="1ª Parcela"
                              size="small"
                              sx={{
                                height: 17,
                                fontSize: '0.58rem',
                                fontWeight: 800,
                                bgcolor: isDark ? 'rgba(14,165,233,0.15)' : 'rgba(14,165,233,0.1)',
                                color: '#0ea5e9',
                                border: '1px solid rgba(14,165,233,0.3)',
                                px: 0.2
                              }}
                            />
                          ) : (
                            <Chip
                              label="Recorrência"
                              size="small"
                              sx={{
                                height: 17,
                                fontSize: '0.58rem',
                                fontWeight: 700,
                                bgcolor: isDark ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.08)',
                                color: '#a855f7',
                                border: '1px solid rgba(168,85,247,0.25)',
                                px: 0.2
                              }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 0.8, fontWeight: 800, color: '#10b981', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {formatarMoeda(item.comissao)}
                      </TableCell>
                      <TableCell sx={{ py: 0.8, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.3 }}>
                          {/* Botão: Registrar Pagamento do Cliente (→ Paga) */}
                          {item.statusParcela !== 'Paga' && item.statusParcela !== 'Cancelada' && !item.isEspelho && (
                            <Tooltip title={`Registrar pagamento do cliente`}>
                              <IconButton
                                size="small"
                                onClick={() => onMarcarPaga?.(item)}
                                sx={{
                                  p: 0.4,
                                  color: '#10b981',
                                  '&:hover': { bgcolor: 'rgba(16,185,129,0.12)' }
                                }}
                              >
                                <AttachMoneyIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {/* Desfazer Pagamento (Master) */}
                          {item.statusParcela === 'Paga' && !item.isEspelho && isMaster && (
                            <Tooltip title="Desfazer pagamento">
                              <IconButton
                                size="small"
                                onClick={() => onDesfazerPaga?.(item)}
                                sx={{
                                  p: 0.4,
                                  color: '#f43f5e',
                                  '&:hover': { bgcolor: 'rgba(244,63,94,0.12)' }
                                }}
                              >
                                <RemoveCircleOutlinedIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {/* Indicador visual quando já está Paga mas não Recebida */}
                          {item.statusParcela === 'Paga' && item.situacaoRecebimento !== 'Recebida' && !item.isEspelho && (
                            <Tooltip title={`Registrar recebimento da comissão`}>
                              <IconButton
                                size="small"
                                onClick={() => onMarcarRecebida?.(item)}
                                sx={{
                                  p: 0.4,
                                  color: '#0ea5e9',
                                  '&:hover': { bgcolor: 'rgba(14,165,233,0.12)' }
                                }}
                              >
                                <ReceiptIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {/* Indicador visual quando Recebida */}
                          {item.situacaoRecebimento === 'Recebida' && (
                            <Tooltip title={`Comissão recebida${item.dataRecebimentoComissao ? ` em ${formatarData(item.dataRecebimentoComissao)}` : ''}${item.numeroRelatorioRecebimento ? ` · Rel: ${item.numeroRelatorioRecebimento}` : ''}${item.notaFiscalRecebimento ? ` · NF: ${item.notaFiscalRecebimento}` : ''}`}>
                              <Box sx={{
                                display: 'inline-flex', alignItems: 'center', px: 0.6, py: 0.2,
                                borderRadius: 1, bgcolor: 'rgba(14,165,233,0.1)', color: '#0ea5e9'
                              }}>
                                <CheckCircleIcon sx={{ fontSize: 14 }} />
                              </Box>
                            </Tooltip>
                          )}
                          {/* Desfazer Recebimento (Master) */}
                          {item.situacaoRecebimento === 'Recebida' && !item.isEspelho && isMaster && (
                            <Tooltip title="Desfazer recebimento">
                              <IconButton
                                size="small"
                                onClick={() => onDesfazerRecebida?.(item)}
                                sx={{
                                  p: 0.4,
                                  color: '#f43f5e',
                                  '&:hover': { bgcolor: 'rgba(244,63,94,0.12)' }
                                }}
                              >
                                <RemoveCircleOutlinedIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {/* Botão Editar Venda */}
                          {permissoes?.editarVendas ? (
                            <Tooltip title="Editar venda">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => onEditarVenda?.(item.vendaId)}
                                sx={{ p: 0.4, '&:hover': { bgcolor: 'rgba(99,102,241,0.12)' } }}
                              >
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Sem permissão para editar vendas">
                              <span>
                                <IconButton size="small" disabled sx={{ p: 0.4 }}>
                                  <EditIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Box>
  );
};

// ──────────────────────────────────────────────────────────
// Sub-componente: Linha do grupo (accordion)
// ──────────────────────────────────────────────────────────

const GrupoRecebimento = ({
  grupo,
  isAtual,
  isPast,
  onEditarVenda,
  onMarcarPaga,
  onMarcarRecebida,
  onDesfazerPaga,
  onDesfazerRecebida,
  permissoes,
  isMaster,
}: {
  grupo: GrupoPeriodo;
  isAtual: boolean;
  isPast: boolean;
  onEditarVenda?: (vendaId: string) => void;
  onMarcarPaga?: (item: ParcelaLinha) => void;
  onMarcarRecebida?: (item: ParcelaLinha) => void;
  onDesfazerPaga?: (item: ParcelaLinha) => void;
  onDesfazerRecebida?: (item: ParcelaLinha) => void;
  permissoes?: UserPermissions;
  isMaster?: boolean;
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const isDark = theme.palette.mode === 'dark';

  const [selecionados, setSelecionados] = useState<string[]>(() => grupo.itens.map(i => i.id));

  const handleToggleSelecionar = (id: string) => {
    setSelecionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelecionarData = (ids: string[], marcar: boolean) => {
    if (marcar) {
      setSelecionados(prev => [...new Set([...prev, ...ids])]);
    } else {
      setSelecionados(prev => prev.filter(x => !ids.includes(x)));
    }
  };

  const handleToggleSelecionarTodosMes = (marcar: boolean) => {
    if (marcar) {
      setSelecionados(grupo.itens.map(i => i.id));
    } else {
      setSelecionados([]);
    }
  };

  const handleExportarPDF = (e: React.MouseEvent) => {
    e.stopPropagation();
    const itensParaExportar = grupo.itens.filter(i => selecionados.includes(i.id));
    if (itensParaExportar.length === 0) {
      alert('Selecione pelo menos um registro para exportar.');
      return;
    }
    const totalComissoes = itensParaExportar.reduce((acc, i) => acc + i.comissao, 0);
    const totalCredito = itensParaExportar.reduce((acc, i) => acc + i.valorVenda, 0);

    exportarRecebimentosParaPDF(
      formatarMesAno(grupo.mesPeriodo + '-01'),
      itensParaExportar,
      { totalComissoes, totalCredito }
    );
  };

  const bgCard = isAtual
    ? (isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.07)')
    : isPast
    ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
    : (isDark ? '#111827' : '#ffffff');

  const borderColor = isAtual
    ? '#6366f1'
    : (isDark ? '#1f2937' : '#e5e7eb');

  const datasUnicas = [...new Set(grupo.itens.map((i) => i.dataPrevisaoRecebimento))].sort();

  // Indicadores de Vendas Novas vs Recorrência do Mês
  const itensNovasVendas = useMemo(() => grupo.itens.filter(i => i.parcelaIndex === 1), [grupo.itens]);
  const totalNovasVendasComissao = useMemo(() => itensNovasVendas.reduce((acc, i) => acc + i.comissao, 0), [itensNovasVendas]);
  const totalNovasVendasCredito = useMemo(() => itensNovasVendas.reduce((acc, i) => acc + i.valorVenda, 0), [itensNovasVendas]);
  const qtdNovasVendas = itensNovasVendas.length;

  const itensRecorrencia = useMemo(() => grupo.itens.filter(i => i.parcelaIndex > 1), [grupo.itens]);
  const totalRecorrenciaComissao = useMemo(() => itensRecorrencia.reduce((acc, i) => acc + i.comissao, 0), [itensRecorrencia]);
  const totalRecorrenciaCredito = useMemo(() => itensRecorrencia.reduce((acc, i) => acc + i.valorVenda, 0), [itensRecorrencia]);
  const qtdRecorrencia = itensRecorrencia.length;

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${borderColor}`,
        borderRadius: 2.5,
        overflow: 'hidden',
        bgcolor: bgCard,
        transition: 'all 0.2s',
        boxShadow: isAtual ? '0 4px 20px rgba(99,102,241,0.2)' : 'none',
      }}
    >
      {/* Header do grupo */}
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.2,
          cursor: 'pointer',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' },
        }}
      >
        <IconButton size="small" sx={{ p: 0.25, color: 'text.secondary', flexShrink: 0 }}>
          {open ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
        </IconButton>

        <Checkbox
          size="small"
          checked={grupo.itens.length > 0 && grupo.itens.every(i => selecionados.includes(i.id))}
          indeterminate={grupo.itens.some(i => selecionados.includes(i.id)) && !grupo.itens.every(i => selecionados.includes(i.id))}
          onChange={(e) => handleToggleSelecionarTodosMes(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          sx={{ mr: 0.5, p: 0.25, flexShrink: 0 }}
        />

        {/* Mês de recebimento */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 'auto', flexShrink: 0 }}>
          <Box sx={{
            p: 0.6, borderRadius: 1.5,
            background: isAtual ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : (isDark ? '#1f2937' : '#f1f5f9'),
            color: isAtual ? '#fff' : 'text.secondary',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CalendarMonthIcon sx={{ fontSize: 16 }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.65rem', display: 'block', lineHeight: 1, whiteSpace: 'nowrap' }}>
              Mês de Vencimento
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: isAtual ? theme.palette.primary.main : 'text.primary', fontFamily: 'Outfit, sans-serif', fontSize: '0.92rem', whiteSpace: 'nowrap' }}>
              {formatarMesAno(grupo.mesPeriodo + '-01')}
            </Typography>
          </Box>
          {isAtual && (
            <Chip label="MÊS ATUAL" size="small" sx={{
              ml: 0.5, height: 18, fontSize: '0.58rem', fontWeight: 800,
              background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff',
              letterSpacing: '0.4px', flexShrink: 0
            }} />
          )}
          {isPast && (
            <Chip label="Passado" size="small" sx={{
              ml: 0.5, height: 18, fontSize: '0.58rem', fontWeight: 700,
              bgcolor: isDark ? '#374151' : '#e5e7eb', color: 'text.secondary', flexShrink: 0
            }} />
          )}
        </Box>

        {/* Datas de recebimento do mês */}
        <Box sx={{ display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', minWidth: 'auto', flexShrink: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
            Datas de Corte
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
            {datasUnicas.map(formatarData).join(' · ')}
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.2, flexShrink: 0 }} />

        {/* Métricas resumidas com Vendas do Mês e Recorrência em 1 única linha */}
        <Box sx={{ display: 'flex', gap: 1.8, flexGrow: 1, flexWrap: 'nowrap', alignItems: 'center' }}>
          <Box sx={{ flexShrink: 0 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.65rem', display: 'block', whiteSpace: 'nowrap' }}>
              Comissões a Receber
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#10b981', fontFamily: 'Outfit, sans-serif', fontSize: '0.92rem', whiteSpace: 'nowrap' }}>
              {formatarMoeda(grupo.totalComissoes)}
            </Typography>
          </Box>

          <Box sx={{ flexShrink: 0 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.65rem', display: 'block', whiteSpace: 'nowrap' }}>
              Valor do Crédito
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              {formatarMoeda(grupo.totalParcelas)}
            </Typography>
          </Box>

          <Box sx={{ flexShrink: 0 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.65rem', display: 'block', whiteSpace: 'nowrap' }}>
              Qtd.
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              {grupo.qtdParcelas}
            </Typography>
          </Box>

          {/* Indicador: Vendas do Mês (1ª Parcela) */}
          <Tooltip title={`Vendas do Mês: ${qtdNovasVendas} contrato(s) com crédito total de ${formatarMoeda(totalNovasVendasCredito)}`}>
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              p: '3px 8px',
              borderRadius: 1.5,
              bgcolor: isDark ? 'rgba(14, 165, 233, 0.12)' : 'rgba(14, 165, 233, 0.08)',
              border: `1px solid ${isDark ? 'rgba(14, 165, 233, 0.3)' : 'rgba(14, 165, 233, 0.25)'}`,
              flexShrink: 0
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <FlashOnIcon sx={{ fontSize: 12, color: '#0ea5e9' }} />
                <Typography variant="caption" sx={{ color: '#0ea5e9', fontWeight: 800, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                  Vendas do Mês ({qtdNovasVendas})
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#0ea5e9', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                {formatarMoeda(totalNovasVendasComissao)}
              </Typography>
            </Box>
          </Tooltip>

          {/* Indicador: Recorrência da Carteira (2ª Parcela em diante) */}
          <Tooltip title={`Recorrência da Carteira: ${qtdRecorrencia} parcela(s) com crédito de ${formatarMoeda(totalRecorrenciaCredito)}`}>
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              p: '3px 8px',
              borderRadius: 1.5,
              bgcolor: isDark ? 'rgba(168, 85, 247, 0.12)' : 'rgba(168, 85, 247, 0.08)',
              border: `1px solid ${isDark ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.25)'}`,
              flexShrink: 0
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <AutorenewIcon sx={{ fontSize: 12, color: '#a855f7' }} />
                <Typography variant="caption" sx={{ color: '#a855f7', fontWeight: 800, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                  Recorrência ({qtdRecorrencia})
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#a855f7', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                {formatarMoeda(totalRecorrenciaComissao)}
              </Typography>
            </Box>
          </Tooltip>

          {/* Breakdown por status */}
          <Box sx={{ flexShrink: 0 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.62rem', display: 'block', mb: 0.2, whiteSpace: 'nowrap' }}>
              Por Status
            </Typography>
            <StatusValorRow totais={grupo.totaisStatus} />
          </Box>
        </Box>

        {/* Barra visual de composição */}
        <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 0.5 }}>
          {(['A receber', 'Recebida', 'Cancelada'] as string[]).map((s) => {
            const count = grupo.itens.filter((i) => i.situacaoRecebimento === s || i.statusParcela === s).length;
            if (!count) return null;
            const colors: Record<string, string> = {
              'A receber': '#f97316', 'Recebida': '#0ea5e9', 'Cancelada': '#ef4444'
            };
            return (
              <Tooltip key={s} title={`${s}: ${count}`}>
                <Box sx={{ px: 0.8, py: 0.3, borderRadius: 1, bgcolor: `${colors[s]}22`, color: colors[s], fontSize: '0.68rem', fontWeight: 700 }}>
                  {count}×{s.charAt(0)}
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        {/* Ações do Grupo (Exportar PDF) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleExportarPDF}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.75rem',
              py: 0.5,
              px: 1.5,
              borderRadius: 1.5,
              bgcolor: '#ef4444',
              '&:hover': { bgcolor: '#dc2626' }
            }}
          >
            PDF ({selecionados.length})
          </Button>
        </Box>
      </Box>

      {/* Sub-grupos por data de corte */}
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Divider />
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {datasUnicas.map((dtPrev) => {
            const itensDaData = grupo.itens.filter((i) => i.dataPrevisaoRecebimento === dtPrev);
            const totalComissaoData = itensDaData.reduce((acc, i) => acc + i.comissao, 0);
            const totalCreditoData = itensDaData.reduce((acc, i) => acc + i.valorVenda, 0);
            return (
              <SubGrupoData
                key={dtPrev}
                dataRecebimento={dtPrev}
                itens={itensDaData}
                totalComissoes={totalComissaoData}
                totalCredito={totalCreditoData}
                bgCard={bgCard}
                selecionadas={selecionados}
                onToggleSelecionar={handleToggleSelecionar}
                onToggleSelecionarData={handleToggleSelecionarData}
                onEditarVenda={onEditarVenda}
                onMarcarPaga={onMarcarPaga}
                onMarcarRecebida={onMarcarRecebida}
                onDesfazerPaga={onDesfazerPaga}
                onDesfazerRecebida={onDesfazerRecebida}
                permissoes={permissoes}
                isMaster={isMaster}
              />
            );
          })}
        </Box>
      </Collapse>
    </Paper>
  );
};

// ──────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────

interface RelatorioRecebimentosProps {
  vendas: LancamentoVenda[];
  vendedores?: Vendedor[];
  regras?: RegraMaster[];
  dataInicio: string;
  dataFim: string;
  ciclos: Record<string, [number, number]>;
  onAtualizarVenda?: (venda: LancamentoVenda) => void;
  permissoes?: UserPermissions;
  isMaster?: boolean;
}

export const RelatorioRecebimentos = ({
  vendas,
  vendedores = [],
  regras = [],
  dataInicio,
  dataFim,
  ciclos,
  onAtualizarVenda,
  permissoes,
  isMaster,
}: RelatorioRecebimentosProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const [busca, setBusca] = useState('');
  const [buscaRelatorio, setBuscaRelatorio] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string[]>([]); 

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [vendaEmEdicao, setVendaEmEdicao] = useState<LancamentoVenda | null>(null);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  // ── Modal: Registrar Pagamento do Cliente ──
  const [modalPaga, setModalPaga] = useState<{
    open: boolean;
    item: ParcelaLinha | null;
    dataPagamento: string;
  }>({ open: false, item: null, dataPagamento: new Date().toISOString().split('T')[0] });

  // ── Modal: Registrar Recebimento da Comissão ──
  const [modalRecebida, setModalRecebida] = useState<{
    open: boolean;
    item: ParcelaLinha | null;
    dataRecebimento: string;
    numeroRelatorio: string;
    notaFiscal: string;
  }>({ open: false, item: null, dataRecebimento: new Date().toISOString().split('T')[0], numeroRelatorio: '', notaFiscal: '' });

  const handleAbrirModalPaga = (item: ParcelaLinha) => {
    setModalPaga({ open: true, item, dataPagamento: new Date().toISOString().split('T')[0] });
  };

  const handleAbrirModalRecebida = (item: ParcelaLinha) => {
    setModalRecebida({
      open: true,
      item,
      dataRecebimento: new Date().toISOString().split('T')[0],
      numeroRelatorio: '',
      notaFiscal: '',
    });
  };

  const handleConfirmarPaga = async () => {
    const { item, dataPagamento } = modalPaga;
    if (!item || !dataPagamento || !onAtualizarVenda) return;
    const venda = vendas.find((v) => v.id === item.vendaId);
    if (!venda) return;
    const celula = venda.projecaoMensal[item.mesReferencia];
    if (!celula) return;
    const vendaAtualizada: LancamentoVenda = {
      ...venda,
      projecaoMensal: {
        ...venda.projecaoMensal,
        [item.mesReferencia]: {
          ...celula,
          status: 'Paga',
          dataPagamentoCliente: dataPagamento,
          dataRecebimento: dataPagamento,
        },
      },
    };
    
    try {
      await salvarVendaSupabase(vendaAtualizada);
      onAtualizarVenda(vendaAtualizada);
      setModalPaga({ open: false, item: null, dataPagamento: '' });
      setSnackbarMsg(`✅ Parcela de ${item.cliente} marcada como Paga em ${formatarData(dataPagamento)}`);
    } catch (err: any) {
      console.error('Erro ao salvar no Supabase:', err);
      const msg = err?.message || err?.details || JSON.stringify(err);
      setSnackbarMsg(`❌ Erro no banco: ${msg.substring(0, 100)}`);
    }
  };

  const handleConfirmarRecebida = async () => {
    const { item, dataRecebimento, numeroRelatorio, notaFiscal } = modalRecebida;
    if (!item || !dataRecebimento || !numeroRelatorio || !onAtualizarVenda) return;
    const venda = vendas.find((v) => v.id === item.vendaId);
    if (!venda) return;
    const celula = venda.projecaoMensal[item.mesReferencia];
    if (!celula) return;
    const vendaAtualizada: LancamentoVenda = {
      ...venda,
      projecaoMensal: {
        ...venda.projecaoMensal,
        [item.mesReferencia]: {
          ...celula,
          recebida: true,
          dataRecebimentoComissao: dataRecebimento,
          numeroRelatorioRecebimento: numeroRelatorio,
          notaFiscalRecebimento: notaFiscal,
        },
      },
    };

    try {
      await salvarVendaSupabase(vendaAtualizada);
      onAtualizarVenda(vendaAtualizada);
      setModalRecebida({ open: false, item: null, dataRecebimento: '', numeroRelatorio: '', notaFiscal: '' });
      setSnackbarMsg(`💰 Recebimento da comissão de ${item.cliente} registrado com sucesso!`);
    } catch (err: any) {
      console.error('Erro ao salvar no Supabase:', err);
      const msg = err?.message || err?.details || JSON.stringify(err);
      setSnackbarMsg(`❌ Erro no banco: ${msg.substring(0, 100)}`);
    }
  };

  const handleDesfazerPaga = async (item: ParcelaLinha) => {
    if (!window.confirm(`Deseja desfazer o pagamento da parcela ${item.parcelaIndex}/${item.qtdParcelas} de ${item.cliente}?`)) return;
    if (!onAtualizarVenda) return;
    const venda = vendas.find((v) => v.id === item.vendaId);
    if (!venda) return;
    const celula = venda.projecaoMensal[item.mesReferencia];
    if (!celula) return;

    const novaCelula = { ...celula, status: 'A vencer' as StatusParcela };
    delete novaCelula.dataPagamentoCliente;
    delete novaCelula.dataRecebimento; // Volta a usar default

    const vendaAtualizada: LancamentoVenda = {
      ...venda,
      projecaoMensal: {
        ...venda.projecaoMensal,
        [item.mesReferencia]: novaCelula,
      },
    };

    try {
      await salvarVendaSupabase(vendaAtualizada);
      onAtualizarVenda(vendaAtualizada);
      setSnackbarMsg(`✅ Pagamento desfeito para ${item.cliente}`);
    } catch (err: any) {
      console.error('Erro ao desfazer pagamento no Supabase:', err);
      const msg = err?.message || err?.details || JSON.stringify(err);
      setSnackbarMsg(`❌ Erro no banco: ${msg.substring(0, 100)}`);
    }
  };

  const handleDesfazerRecebida = async (item: ParcelaLinha) => {
    if (!window.confirm(`Deseja desfazer o recebimento da comissão da parcela ${item.parcelaIndex}/${item.qtdParcelas} de ${item.cliente}?`)) return;
    if (!onAtualizarVenda) return;
    const venda = vendas.find((v) => v.id === item.vendaId);
    if (!venda) return;
    const celula = venda.projecaoMensal[item.mesReferencia];
    if (!celula) return;

    const novaCelula = { ...celula };
    delete novaCelula.recebida;
    delete novaCelula.dataRecebimentoComissao;
    delete novaCelula.numeroRelatorioRecebimento;
    delete novaCelula.notaFiscalRecebimento;

    const vendaAtualizada: LancamentoVenda = {
      ...venda,
      projecaoMensal: {
        ...venda.projecaoMensal,
        [item.mesReferencia]: novaCelula,
      },
    };

    try {
      await salvarVendaSupabase(vendaAtualizada);
      onAtualizarVenda(vendaAtualizada);
      setSnackbarMsg(`✅ Recebimento desfeito para ${item.cliente}`);
    } catch (err: any) {
      console.error('Erro ao desfazer recebimento no Supabase:', err);
      const msg = err?.message || err?.details || JSON.stringify(err);
      setSnackbarMsg(`❌ Erro no banco: ${msg.substring(0, 100)}`);
    }
  };

  const handleEditarVenda = (vendaId: string) => {
    const v = vendas.find((item) => item.id === vendaId);
    if (v) {
      setVendaEmEdicao(v);
      setOpenEditDialog(true);
    }
  };

  const toggleFiltroStatus = (s: string) => {
    if (s === 'Todos') { setFiltroStatus([]); return; }
    setFiltroStatus((prev) =>
      prev.includes(s)
        ? prev.filter((x) => x !== s)
        : [...prev, s]
    );
  };

  // 1. Monta lista de parcelas com datas de previsão
  const parcelas = useMemo<ParcelaLinha[]>(() => {
    const lista: ParcelaLinha[] = [];

    vendas.forEach((venda) => {
      if (venda.statusCliente === 'Cancelado') return;

      const todasParcelasVenda = Object.keys(venda.projecaoMensal)
        .filter((m) => { const c = venda.projecaoMensal[m]; return c && c.valorVenda > 0; })
        .sort();

      Object.entries(venda.projecaoMensal).forEach(([mesChave, celula]) => {
        if (!celula || !celula.valorVenda || celula.valorVenda <= 0) return;

        const statusParcela = obterStatusEfetivo(celula.status, celula.dataVencimento || `${mesChave}-15`);
        const situacaoRecebimento: 'A receber' | 'Recebida' = celula.recebida ? 'Recebida' : 'A receber';

        if (filtroStatus.length > 0) {
          let passa = false;
          for (const f of filtroStatus) {
            if (f === 'A receber' || f === 'Recebida') {
              if (situacaoRecebimento === f) { passa = true; break; }
            } else {
              if (statusParcela === f) { passa = true; break; }
            }
          }
          if (!passa) return;
        } else {
          // Nenhum filtro = Todos (exceto canceladas)
          if (celula.status === 'Cancelada') return;
        }

        const dtVenc = celula.dataVencimento || `${mesChave}-15`;
        const dtPrev = calcularDataPrevisaoRecebimento(dtVenc, ciclos);

        if (!dtPrev) return;

        const parcelaIndex = todasParcelasVenda.indexOf(mesChave) + 1;

        // Filtro por busca
        const termoBusca = busca.toLowerCase();
        if (termoBusca && !(
          venda.cliente.toLowerCase().includes(termoBusca) ||
          (venda.pac || '').toLowerCase().includes(termoBusca) ||
          (venda.vendedorNome || '').toLowerCase().includes(termoBusca)
        )) return;

        // Filtro por número de relatório ADM
        const termoRel = buscaRelatorio.trim().toLowerCase();
        if (termoRel && !(venda.numeroRelatorio || '').toLowerCase().includes(termoRel)) return;

        const dtPag = statusParcela === 'Paga'
          ? (celula.dataPagamentoCliente || celula.dataRecebimento || celula.dataVencimento)
          : undefined;

        const mesVencimento = dtVenc.substring(0, 7);
        const mesPagamento = dtPag ? dtPag.substring(0, 7) : undefined;
        const pagaForaCompetencia = !!mesPagamento && (mesPagamento !== mesVencimento);

        const linhaBase: Omit<ParcelaLinha, 'id' | 'grupoVisual' | 'isEspelho' | 'pagaForaCompetencia'> = {
          vendaId: venda.id,
          cliente: venda.cliente,
          pac: venda.pac || '',
          vendedorNome: venda.vendedorNome || '',
          segmento: venda.segmento,
          tabela: venda.tabela,
          dataVenda: venda.dataVenda || '',
          mesReferencia: mesChave,
          dataVencimento: dtVenc,
          dataPrevisaoRecebimento: dtPrev,
          comissao: celula.comissaoGerada || 0,
          valorParcela: celula.valorParcela || venda.valorParcela,
          valorVenda: venda.valorVenda,
          statusParcela,
          situacaoRecebimento,
          parcelaIndex,
          qtdParcelas: venda.qtdParcelas,
          numeroRelatorio: venda.numeroRelatorio,
          dataPagamentoCliente: dtPag,
          numeroRelatorioRecebimento: celula.numeroRelatorioRecebimento,
          notaFiscalRecebimento: celula.notaFiscalRecebimento,
          dataRecebimentoComissao: celula.recebida
            ? (celula.dataRecebimentoComissao || celula.dataRecebimento)
            : undefined,
        };

        // 1. Linha Original (Competência)
        let criarOriginal = true;
        if (dataInicio && dtVenc < dataInicio) criarOriginal = false;
        if (dataFim && dtVenc > dataFim) criarOriginal = false;

        if (criarOriginal) {
          lista.push({
            ...linhaBase,
            id: `${venda.id}_${mesChave}`,
            grupoVisual: mesVencimento,
            isEspelho: false,
            pagaForaCompetencia,
          });
        }

        // 2. Linha Espelho (Caixa)
        if (pagaForaCompetencia && dtPag) {
          let criarEspelho = true;
          if (dataInicio && dtPag < dataInicio) criarEspelho = false;
          if (dataFim && dtPag > dataFim) criarEspelho = false;

          if (criarEspelho) {
            lista.push({
              ...linhaBase,
              id: `${venda.id}_${mesChave}_espelho`,
              grupoVisual: mesPagamento,
              isEspelho: true,
              pagaForaCompetencia: true,
            });
          }
        }
      });
    });

    return lista;
  }, [vendas, dataInicio, dataFim, ciclos, busca, buscaRelatorio, filtroStatus]);

  // 2. Agrupa por grupoVisual (que é o Mês/Ano onde a linha deve aparecer)
  const grupos = useMemo<GrupoPeriodo[]>(() => {
    const mapa = new Map<string, GrupoPeriodo>();

    parcelas.forEach((p) => {
      const key = p.grupoVisual; // Agrupamento por mês de visualização
      if (!mapa.has(key)) {
        mapa.set(key, {
          mesPeriodo: key,
          totalComissoes: 0,
          totalParcelas: 0,
          qtdParcelas: 0,
          itens: [],
          totaisStatus: { aVencer: 0, vencida: 0, paga: 0, recebida: 0, cancelada: 0, aReceber: 0, espelhoRecebido: 0, pagaForaMes: 0 },
        });
      }
      const g = mapa.get(key)!;
      
      // Conforme Opção 1, espelhos não somam no total base daquele mês para evitar duplicação.
      if (!p.isEspelho) {
        g.totalComissoes += p.comissao;
        g.totalParcelas += p.valorVenda;
        g.qtdParcelas += 1;
      }
      
      g.itens.push(p);
    });

    // Recalcula totais por status após montar os grupos
    const resultado = Array.from(mapa.values());
    resultado.forEach((g) => {
      g.totaisStatus = calcularTotaisStatus(g.itens);
    });

    return resultado.sort((a, b) => a.mesPeriodo.localeCompare(b.mesPeriodo));
  }, [parcelas]);


  // 3. Totais gerais
  const totalComissoes = grupos.reduce((acc, g) => acc + g.totalComissoes, 0);
  const totalCredito = grupos.reduce((acc, g) => acc + g.totalParcelas, 0);
  const totalQtd = grupos.reduce((acc, g) => acc + g.qtdParcelas, 0);

  // Totais consolidados de Vendas do Mês vs Recorrência no período filtrado
  const totalNovasVendasGeral = useMemo(() => {
    const itensNovos = parcelas.filter(p => !p.isEspelho && p.parcelaIndex === 1);
    return {
      comissao: itensNovos.reduce((acc, p) => acc + p.comissao, 0),
      credito: itensNovos.reduce((acc, p) => acc + p.valorVenda, 0),
      qtd: itensNovos.length
    };
  }, [parcelas]);

  const totalRecorrenciaGeral = useMemo(() => {
    const itensRecorrentes = parcelas.filter(p => !p.isEspelho && p.parcelaIndex > 1);
    return {
      comissao: itensRecorrentes.reduce((acc, p) => acc + p.comissao, 0),
      credito: itensRecorrentes.reduce((acc, p) => acc + p.valorVenda, 0),
      qtd: itensRecorrentes.length
    };
  }, [parcelas]);

  // 4. Próximo período com valor a receber
  const mesAtual = new Date().toISOString().substring(0, 7); // YYYY-MM
  const proximoPeriodo = grupos.find((g) => g.mesPeriodo >= mesAtual);
  const periodoAtrasados = grupos.filter((g) => g.mesPeriodo < mesAtual);
  const totalAtrasado = periodoAtrasados.reduce((acc, g) => acc + g.totalComissoes, 0);
  const proximoValor = proximoPeriodo ? formatarMoeda(proximoPeriodo.totalComissoes) : '';
  const proximoLabel = proximoPeriodo ? formatarMesAno(proximoPeriodo.mesPeriodo + '-01') : '—';

  // Exportar CSV
  const exportarCSV = () => {
    const header = ['Data de Corte', 'Cliente', 'PAC', 'Vendedor', 'Mês Ref.', 'Vencimento', 'Valor da Cota', 'Valor Parcela', 'Comissão', 'Status Parcela', 'Recebimento', 'Parcela Nº'];
    const rows = parcelas.map((p) => [
      formatarData(p.dataPrevisaoRecebimento),
      p.cliente,
      p.pac,
      p.vendedorNome,
      formatarMesAno(p.mesReferencia),
      formatarData(p.dataVencimento),
      p.valorVenda.toFixed(2).replace('.', ','),
      p.valorParcela.toFixed(2).replace('.', ','),
      p.comissao.toFixed(2).replace('.', ','),
      p.statusParcela,
      p.situacaoRecebimento,
      `${p.parcelaIndex}/${p.qtdParcelas}`,
    ]);
    const csv = [header, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_recebimentos_${hoje}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const STATUS_OPCOES = ['Todos', 'A vencer', 'Vencida', 'Paga', 'Cancelada', 'A receber', 'Recebida'];

  const STATUS_CORES: Record<string, { active: string; border: string }> = {
    'Todos':      { active: theme.palette.primary.main, border: theme.palette.primary.main },
    'A vencer':   { active: '#3b82f6', border: '#3b82f6' },
    'Vencida':    { active: '#ef4444', border: '#ef4444' },
    'Paga':       { active: '#10b981', border: '#10b981' },
    'Cancelada':  { active: '#ef4444', border: '#ef4444' },
    'A receber':  { active: '#f97316', border: '#f97316' },
    'Recebida':   { active: '#0ea5e9', border: '#0ea5e9' },
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: isDark ? '#f8fafc' : '#0f172a' }}>
            Relatório de Previsão de Recebimentos
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Parcelas agrupadas por mês de vencimento · Período: {formatarData(dataInicio)} até {formatarData(dataFim)}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={exportarCSV}
          sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none', fontSize: '0.82rem' }}
        >
          Exportar CSV
        </Button>
      </Box>

      {/* ── KPIs ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr', lg: 'repeat(6, 1fr)' }, gap: 2 }}>
        {[
          {
            label: 'Total a Receber',
            value: formatarMoeda(totalComissoes),
            sub: `${totalQtd} parcela(s)`,
            icon: <AccountBalanceWalletIcon />,
            color: '#10b981',
            bg: 'rgba(16,185,129,0.12)',
          },
          {
            label: 'Vendas do Mês',
            value: formatarMoeda(totalNovasVendasGeral.comissao),
            sub: `${totalNovasVendasGeral.qtd} venda(s) novas`,
            icon: <FlashOnIcon />,
            color: '#0ea5e9',
            bg: 'rgba(14,165,233,0.12)',
          },
          {
            label: 'Recorrência Carteira',
            value: formatarMoeda(totalRecorrenciaGeral.comissao),
            sub: `${totalRecorrenciaGeral.qtd} parcela(s) recorrentes`,
            icon: <AutorenewIcon />,
            color: '#a855f7',
            bg: 'rgba(168,85,247,0.12)',
          },
          {
            label: 'Valor do Crédito',
            value: formatarMoeda(totalCredito),
            sub: 'Volume total',
            icon: <TrendingUpIcon />,
            color: '#6366f1',
            bg: 'rgba(99,102,241,0.12)',
          },
          {
            label: 'Próximo Corte',
            value: proximoLabel,
            sub: proximoValor,
            icon: <CalendarMonthIcon />,
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.12)',
          },
          {
            label: 'Em Atraso',
            value: formatarMoeda(totalAtrasado),
            sub: `${periodoAtrasados.length} período(s)`,
            icon: <HourglassEmptyIcon />,
            color: totalAtrasado > 0 ? '#ef4444' : '#94a3b8',
            bg: totalAtrasado > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(148,163,184,0.08)',
          },
        ].map((kpi) => (
          <Paper
            key={kpi.label}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2.5,
              border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
              bgcolor: isDark ? '#111827' : '#ffffff',
              display: 'flex',
              gap: 2,
              alignItems: 'flex-start',
            }}
          >
            <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: kpi.bg, color: kpi.color, display: 'flex' }}>
              {kpi.icon}
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.72rem', display: 'block' }}>
                {kpi.label}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: kpi.color, fontFamily: 'Outfit, sans-serif', lineHeight: 1.2 }}>
                {kpi.value}
              </Typography>
              {kpi.sub && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                  {kpi.sub}
                </Typography>
              )}
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Subtotal de parcelas */}
      <Box sx={{ px: 0.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {totalQtd} parcelas em {grupos.length} meses de vencimento
        </Typography>
      </Box>

      {/* ── Filtros ── */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Buscar cliente, PAC ou vendedor..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 260 }}
        />
        <TextField
          size="small"
          placeholder="Filtrar por Nº Relatório ADM..."
          value={buscaRelatorio}
          onChange={(e) => setBuscaRelatorio(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 220 }}
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {filtroStatus.length > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', mr: 0.5 }}>
              {filtroStatus.length} selecionado(s)
            </Typography>
          )}
          {STATUS_OPCOES.map((s) => {
            const isAtivo = s === 'Todos' ? filtroStatus.length === 0 : filtroStatus.includes(s as any);
            const cor = STATUS_CORES[s];
            return (
              <Chip
                key={s}
                label={s}
                size="small"
                onClick={() => toggleFiltroStatus(s)}
                variant={isAtivo ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  bgcolor: isAtivo ? cor.active : 'transparent',
                  color: isAtivo ? '#fff' : 'text.secondary',
                  borderColor: isAtivo ? cor.active : (isDark ? '#374151' : '#d1d5db'),
                  '&:hover': {
                    bgcolor: isAtivo ? cor.active : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                    borderColor: cor.border,
                  },
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* ── Lista de grupos ── */}
      {grupos.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: `1px dashed ${isDark ? '#374151' : '#d1d5db'}`, borderRadius: 3, bgcolor: 'transparent' }}>
          <CalendarMonthIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.4, mb: 1 }} />
          <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Nenhum recebimento encontrado para o período selecionado.
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Ajuste o filtro de data ou os critérios de busca.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {grupos.map((grupo) => (
            <GrupoRecebimento
              key={grupo.mesPeriodo}
              grupo={grupo}
              isAtual={grupo.mesPeriodo === mesAtual}
              isPast={grupo.mesPeriodo < mesAtual}
              onEditarVenda={handleEditarVenda}
              onMarcarPaga={handleAbrirModalPaga}
              onMarcarRecebida={handleAbrirModalRecebida}
              onDesfazerPaga={handleDesfazerPaga}
              onDesfazerRecebida={handleDesfazerRecebida}
              permissoes={permissoes}
              isMaster={isMaster}
            />
          ))}
        </Box>
      )}

      {/* ── Resumo por mês ── */}
      {grupos.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2.5, border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`, bgcolor: isDark ? '#111827' : '#ffffff', mt: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', mb: 2 }}>
            Resumo por Mês de Recebimento
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {[
                    'Mês/Ano', 'Parcelas', 'Datas de Recebimento', 'Valor do Crédito',
                    'Total Comissões', 'Cancelada', 'A Vencer', 'Vencida', 'Paga', 'Recebida', 'A Receber'
                  ].map((h) => (
                    <TableCell key={h} sx={{
                      fontWeight: 700, fontSize: '0.72rem', color:
                        h === 'A Receber' ? '#f59e0b' :
                        h === 'Cancelada' ? '#ef4444' :
                        h === 'A Vencer' ? '#6366f1' :
                        h === 'Vencida' ? '#f59e0b' :
                        h === 'Paga' ? '#10b981' :
                        h === 'Recebida' ? '#0ea5e9' :
                        'text.secondary',
                      textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap',
                      bgcolor: isDark ? '#0b0f19' : '#f8fafc',
                      borderBottom: h === 'A Receber' ? `2px solid #f59e0b` : undefined,
                    }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {grupos.map((g) => {
                  const datasUnicas = [...new Set(g.itens.map((i) => i.dataPrevisaoRecebimento))].sort();
                  const ts = g.totaisStatus;
                  return (
                    <TableRow key={g.mesPeriodo} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem', fontFamily: 'Outfit, sans-serif' }}>
                        {formatarMesAno(g.mesPeriodo + '-01')}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{g.qtdParcelas}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{datasUnicas.map(formatarData).join(' · ')}</TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{formatarMoeda(g.totalParcelas)}</TableCell>
                      <TableCell sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>{formatarMoeda(g.totalComissoes)}</TableCell>
                      <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600, color: ts.cancelada > 0 ? '#ef4444' : 'text.disabled' }}>
                        {ts.cancelada > 0 ? formatarMoeda(ts.cancelada) : '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600, color: ts.aVencer > 0 ? '#6366f1' : 'text.disabled' }}>
                        {ts.aVencer > 0 ? formatarMoeda(ts.aVencer) : '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600, color: ts.vencida > 0 ? '#f59e0b' : 'text.disabled' }}>
                        {ts.vencida > 0 ? formatarMoeda(ts.vencida) : '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600, color: ts.paga > 0 ? '#10b981' : 'text.disabled' }}>
                        {ts.paga > 0 ? formatarMoeda(ts.paga) : '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600, color: ts.recebida > 0 ? '#0ea5e9' : 'text.disabled' }}>
                        {ts.recebida > 0 ? formatarMoeda(ts.recebida) : '—'}
                      </TableCell>
                      <TableCell sx={{
                        fontSize: '0.82rem', fontWeight: 900,
                        color: ts.aReceber > 0 ? '#f59e0b' : 'text.disabled',
                        bgcolor: ts.aReceber > 0 ? 'rgba(245,158,11,0.06)' : 'transparent',
                      }}>
                        {ts.aReceber > 0 ? formatarMoeda(ts.aReceber) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Totalizador */}
                {(() => {
                  const totGeral = grupos.reduce(
                    (acc, g) => ({
                      cancelada: acc.cancelada + g.totaisStatus.cancelada,
                      aVencer:   acc.aVencer   + g.totaisStatus.aVencer,
                      vencida:   acc.vencida   + g.totaisStatus.vencida,
                      paga:      acc.paga      + g.totaisStatus.paga,
                      recebida:  acc.recebida  + g.totaisStatus.recebida,
                      aReceber:  acc.aReceber  + g.totaisStatus.aReceber,
                    }),
                    { cancelada: 0, aVencer: 0, vencida: 0, paga: 0, recebida: 0, aReceber: 0 }
                  );
                  return (
                    <TableRow sx={{ '& td': { borderTop: `2px solid ${isDark ? '#374151' : '#e5e7eb'}` } }}>
                      <TableCell colSpan={3} sx={{ fontWeight: 800, fontSize: '0.82rem', fontFamily: 'Outfit, sans-serif' }}>TOTAL GERAL</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.85rem' }}>{formatarMoeda(totalCredito)}</TableCell>
                      <TableCell sx={{ fontWeight: 900, fontSize: '0.9rem', color: '#10b981' }}>{formatarMoeda(totalComissoes)}</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.82rem', color: totGeral.cancelada > 0 ? '#ef4444' : 'text.disabled' }}>
                        {totGeral.cancelada > 0 ? formatarMoeda(totGeral.cancelada) : '—'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.82rem', color: totGeral.aVencer > 0 ? '#6366f1' : 'text.disabled' }}>
                        {totGeral.aVencer > 0 ? formatarMoeda(totGeral.aVencer) : '—'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.82rem', color: totGeral.vencida > 0 ? '#f59e0b' : 'text.disabled' }}>
                        {totGeral.vencida > 0 ? formatarMoeda(totGeral.vencida) : '—'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.82rem', color: totGeral.paga > 0 ? '#10b981' : 'text.disabled' }}>
                        {totGeral.paga > 0 ? formatarMoeda(totGeral.paga) : '—'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.82rem', color: totGeral.recebida > 0 ? '#0ea5e9' : 'text.disabled' }}>
                        {totGeral.recebida > 0 ? formatarMoeda(totGeral.recebida) : '—'}
                      </TableCell>
                      <TableCell sx={{
                        fontWeight: 900, fontSize: '0.9rem',
                        color: totGeral.aReceber > 0 ? '#f59e0b' : 'text.disabled',
                        bgcolor: totGeral.aReceber > 0 ? 'rgba(245,158,11,0.08)' : 'transparent',
                      }}>
                        {totGeral.aReceber > 0 ? formatarMoeda(totGeral.aReceber) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })()}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {/* Dialog para Editar Venda */}
      <EditarVendaDialog
        open={openEditDialog}
        onClose={() => {
          setOpenEditDialog(false);
          setVendaEmEdicao(null);
        }}
        onSave={(vendaAtualizada) => {
          if (onAtualizarVenda) {
            onAtualizarVenda(vendaAtualizada);
          }
          setOpenEditDialog(false);
          setVendaEmEdicao(null);
          setSnackbarMsg('✅ Venda atualizada com sucesso!');
        }}
        venda={vendaEmEdicao}
        vendedores={vendedores}
        regras={regras}
        ciclos={ciclos}
      />

      {/* ── Modal: Registrar Pagamento do Cliente ── */}
      <Dialog
        open={modalPaga.open}
        onClose={() => setModalPaga((p) => ({ ...p, open: false }))}
        maxWidth="xs"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: 3, overflow: 'hidden' } }}
      >
        <DialogTitle sx={{
          fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem',
          bgcolor: isDark ? '#111827' : '#f8fafc',
          borderBottom: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
          display: 'flex', alignItems: 'center', gap: 1.2, py: 1.8
        }}>
          <Box sx={{ p: 0.7, borderRadius: 1.5, bgcolor: 'rgba(16,185,129,0.12)', color: '#10b981', display: 'flex' }}>
            <AttachMoneyIcon sx={{ fontSize: 18 }} />
          </Box>
          Registrar Pagamento do Cliente
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, pb: 1.5 }}>
          {modalPaga.item && (
            <Stack spacing={2}>
              <Alert severity="info" sx={{ fontSize: '0.8rem', py: 0.5, borderRadius: 2 }}>
                <strong>{modalPaga.item.cliente}</strong> · Parcela {modalPaga.item.parcelaIndex}/{modalPaga.item.qtdParcelas} · Venc: {formatarData(modalPaga.item.dataVencimento)}
              </Alert>
              <TextField
                label="Data do Pagamento pelo Cliente"
                type="date"
                fullWidth
                size="small"
                required
                value={modalPaga.dataPagamento}
                onChange={(e) => setModalPaga((p) => ({ ...p, dataPagamento: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Data em que o cliente efetuou o pagamento da parcela"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`, gap: 1 }}>
          <Button
            onClick={() => setModalPaga((p) => ({ ...p, open: false }))}
            variant="outlined"
            size="small"
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmarPaga}
            variant="contained"
            size="small"
            disabled={!modalPaga.dataPagamento}
            startIcon={<CheckCircleIcon />}
            sx={{
              textTransform: 'none', borderRadius: 2, fontWeight: 700,
              bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }
            }}
          >
            Confirmar Pagamento
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Modal: Registrar Recebimento da Comissão ── */}
      <Dialog
        open={modalRecebida.open}
        onClose={() => setModalRecebida((p) => ({ ...p, open: false }))}
        maxWidth="sm"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: 3, overflow: 'hidden' } }}
      >
        <DialogTitle sx={{
          fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem',
          bgcolor: isDark ? '#111827' : '#f8fafc',
          borderBottom: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
          display: 'flex', alignItems: 'center', gap: 1.2, py: 1.8
        }}>
          <Box sx={{ p: 0.7, borderRadius: 1.5, bgcolor: 'rgba(14,165,233,0.12)', color: '#0ea5e9', display: 'flex' }}>
            <ReceiptIcon sx={{ fontSize: 18 }} />
          </Box>
          Registrar Recebimento da Comissão
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, pb: 1.5 }}>
          {modalRecebida.item && (
            <Stack spacing={2.5}>
              <Alert severity="info" sx={{ fontSize: '0.8rem', py: 0.5, borderRadius: 2 }}>
                <strong>{modalRecebida.item.cliente}</strong> · Parcela {modalRecebida.item.parcelaIndex}/{modalRecebida.item.qtdParcelas} · Comissão: <strong>{formatarMoeda(modalRecebida.item.comissao)}</strong>
              </Alert>
              <TextField
                label="Data de Recebimento da Comissão"
                type="date"
                fullWidth
                size="small"
                required
                value={modalRecebida.dataRecebimento}
                onChange={(e) => setModalRecebida((p) => ({ ...p, dataRecebimento: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Data em que a comissão foi creditada/transferida"
              />
              <TextField
                label="Nº do Relatório"
                fullWidth
                size="small"
                required
                placeholder="Ex: REL-2026-08-001"
                value={modalRecebida.numeroRelatorio}
                onChange={(e) => setModalRecebida((p) => ({ ...p, numeroRelatorio: e.target.value }))}
                helperText="Número do relatório da administradora referente ao recebimento (obrigatório)"
              />
              <TextField
                label="Nota Fiscal (opcional)"
                fullWidth
                size="small"
                placeholder="Ex: NF 000123"
                value={modalRecebida.notaFiscal}
                onChange={(e) => setModalRecebida((p) => ({ ...p, notaFiscal: e.target.value }))}
                helperText="Número ou código da Nota Fiscal relacionada ao recebimento (opcional)"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`, gap: 1 }}>
          <Button
            onClick={() => setModalRecebida((p) => ({ ...p, open: false }))}
            variant="outlined"
            size="small"
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmarRecebida}
            variant="contained"
            size="small"
            disabled={!modalRecebida.dataRecebimento || !modalRecebida.numeroRelatorio}
            startIcon={<CheckCircleIcon />}
            sx={{
              textTransform: 'none', borderRadius: 2, fontWeight: 700,
              bgcolor: '#0ea5e9', '&:hover': { bgcolor: '#0284c7' }
            }}
          >
            Confirmar Recebimento
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbarMsg}
        autoHideDuration={3500}
        onClose={() => setSnackbarMsg('')}
        message={snackbarMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ '& .MuiSnackbarContent-root': { fontWeight: 700, borderRadius: 2 } }}
      />
    </Box>
  );
};
