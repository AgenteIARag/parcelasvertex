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
} from '@mui/material';
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
import type { LancamentoVenda, StatusParcela } from '../types';

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
  cortes: [number, number],
  recebimentos: [number, number]
): string => {
  if (!dataVenc || dataVenc.includes('undefined')) return '';
  const dt = new Date(`${dataVenc}T00:00:00`);
  if (isNaN(dt.getTime())) return '';
  const dia = dt.getDate();

  const c1 = Math.min(...cortes);
  const c2 = Math.max(...cortes);
  const idx1 = cortes.indexOf(c1);
  const idx2 = cortes.indexOf(c2);
  const r1 = recebimentos[idx1 !== -1 && idx1 < recebimentos.length ? idx1 : 0] ?? 15;
  const r2 = recebimentos[idx2 !== -1 && idx2 < recebimentos.length ? idx2 : 1] ?? 30;

  let ano = dt.getFullYear();
  let mes = dt.getMonth();
  let diaPagto: number;

  if (dia <= c1) { diaPagto = r1; }
  else if (dia <= c2) { diaPagto = r2; }
  else { mes += 1; if (mes > 11) { mes = 0; ano += 1; } diaPagto = r1; }

  if (!diaPagto || isNaN(diaPagto)) diaPagto = 15;

  const mesStr = String(mes + 1).padStart(2, '0');
  const diaStr = String(diaPagto).padStart(2, '0');
  return `${ano}-${mesStr}-${diaStr}`;
};

const obterStatusEfetivo = (status: StatusParcela, dataVencimento: string): StatusParcela => {
  if (status === 'A vencer' && dataVencimento) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(`${dataVencimento}T00:00:00`);
    if (venc <= hoje) return 'Vencida';
  }
  return status;
};

// ──────────────────────────────────────────────────────────
// Tipos internos
// ──────────────────────────────────────────────────────────

interface ParcelaLinha {
  id: string;
  cliente: string;
  pac: string;
  vendedorNome: string;
  segmento: string;
  tabela: string;
  mesReferencia: string;      // YYYY-MM
  dataVencimento: string;     // YYYY-MM-DD
  dataPrevisaoRecebimento: string; // YYYY-MM-DD
  comissao: number;
  valorParcela: number;
  valorVenda: number;
  status: StatusParcela;
  parcelaIndex: number;
  qtdParcelas: number;
}

interface TotaisStatus {
  aVencer: number;
  vencida: number;
  paga: number;
  recebida: number;
  cancelada: number;
  aReceber: number;   // = aVencer + vencida (ainda não liquidado)
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
  const t: TotaisStatus = { aVencer: 0, vencida: 0, paga: 0, recebida: 0, cancelada: 0, aReceber: 0 };
  itens.forEach((i) => {
    const v = i.comissao;
    if (i.status === 'A vencer')  t.aVencer   += v;
    else if (i.status === 'Vencida')   t.vencida   += v;
    else if (i.status === 'Paga')      t.paga      += v;
    else if (i.status === 'Recebida')  t.recebida  += v;
    else if (i.status === 'Cancelada') t.cancelada += v;
  });
  t.aReceber = t.aVencer + t.vencida;
  return t;
};

// ──────────────────────────────────────────────────────────
// Sub-componente: Mini badges de status com valor
// ──────────────────────────────────────────────────────────

const StatusValorRow = ({ totais }: { totais: TotaisStatus }) => {
  const items = [
    { label: 'Cancelada', value: totais.cancelada, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    { label: 'A vencer',  value: totais.aVencer,   color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
    { label: 'Vencida',   value: totais.vencida,   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    { label: 'Paga',      value: totais.paga,       color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    { label: 'Recebida',  value: totais.recebida,   color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  ].filter((item) => item.value > 0);

  if (items.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', alignItems: 'center' }}>
      {items.map((item) => (
        <Tooltip key={item.label} title={item.label}>
          <Box sx={{
            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
            px: 1, py: 0.3, borderRadius: 1.5,
            bgcolor: item.bg, color: item.color,
          }}>
            <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              {item.label}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, lineHeight: 1.2, fontFamily: 'Outfit, sans-serif' }}>
              {formatarMoeda(item.value)}
            </Typography>
          </Box>
        </Tooltip>
      ))}
      {totais.aReceber > 0 && (
        <>
          <Box sx={{ width: '1px', height: 28, bgcolor: 'divider', mx: 0.5 }} />
          <Tooltip title="Ainda não recebido (A vencer + Vencida)">
            <Box sx={{
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
              px: 1.2, py: 0.3, borderRadius: 1.5,
              border: '1.5px solid #f59e0b',
              bgcolor: 'rgba(245,158,11,0.08)',
              color: '#f59e0b',
            }}>
              <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                ★ A Receber
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 900, lineHeight: 1.2, fontFamily: 'Outfit, sans-serif' }}>
                {formatarMoeda(totais.aReceber)}
              </Typography>
            </Box>
          </Tooltip>
        </>
      )}
    </Box>
  );
};

// ──────────────────────────────────────────────────────────
// Sub-componente: Linha de KPI do período
// ──────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: StatusParcela }) => {
  const map: Record<StatusParcela, { color: string; bg: string; icon: React.ReactNode }> = {
    'A vencer':  { color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  icon: <HourglassEmptyIcon sx={{ fontSize: 12 }} /> },
    'Vencida':   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: <HourglassEmptyIcon sx={{ fontSize: 12 }} /> },
    'Paga':      { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: <CheckCircleIcon sx={{ fontSize: 12 }} /> },
    'Recebida':  { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',  icon: <CheckCircleIcon sx={{ fontSize: 12 }} /> },
    'Cancelada': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: <CancelIcon sx={{ fontSize: 12 }} /> },
  };
  const s = map[status] || map['A vencer'];
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 1, py: 0.25,
      borderRadius: 99, bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: '0.7rem' }}>
      {s.icon} {status}
    </Box>
  );
};

// ──────────────────────────────────────────────────────────
// Sub-componente: Sub-grupo por data de recebimento
// ──────────────────────────────────────────────────────────

const SubGrupoData = ({
  dataRecebimento,
  itens,
  totalComissoes,
  totalCredito,
}: {
  dataRecebimento: string;
  itens: ParcelaLinha[];
  totalComissoes: number;
  totalCredito: number;
}) => {
  const totaisStatus = calcularTotaisStatus(itens);
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const isDark = theme.palette.mode === 'dark';
  const hoje = new Date().toISOString().split('T')[0];
  const isHoje = dataRecebimento === hoje;
  const isPast = dataRecebimento < hoje;

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
              Previsão de Recebimento
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
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Cliente / PAC', 'Vendedor', 'Mês Ref.', 'Vencimento', 'Valor da Cota', 'Parcela', 'Tabela', 'Status', 'Parcela Nº', 'Comissão'].map((h) => (
                  <TableCell key={h} sx={{
                    fontWeight: 700, fontSize: '0.68rem', color: 'text.secondary',
                    bgcolor: isDark ? '#0a0e18' : '#f8fafc', textTransform: 'uppercase',
                    letterSpacing: '0.4px', whiteSpace: 'nowrap', py: 0.8,
                    pl: h === 'Cliente / PAC' ? 4 : undefined,
                  }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {itens.map((item) => (
                <TableRow key={item.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell sx={{ py: 0.8, pl: 4 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>{item.cliente}</Typography>
                    {item.pac && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        PAC: {item.pac}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 0.8, fontSize: '0.75rem', color: 'text.secondary' }}>
                    {item.vendedorNome || '—'}
                  </TableCell>
                  <TableCell sx={{ py: 0.8, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {formatarMesAno(item.mesReferencia)}
                  </TableCell>
                  <TableCell sx={{ py: 0.8, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {formatarData(item.dataVencimento)}
                  </TableCell>
                  <TableCell sx={{ py: 0.8, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', color: 'text.primary' }}>
                    {formatarMoeda(item.valorVenda)}
                  </TableCell>
                  <TableCell sx={{ py: 0.8, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {formatarMoeda(item.valorParcela)}
                  </TableCell>
                  <TableCell sx={{ py: 0.8, fontSize: '0.68rem', color: 'text.secondary' }}>
                    {item.tabela}
                  </TableCell>
                  <TableCell sx={{ py: 0.8 }}>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell sx={{ py: 0.8, fontSize: '0.75rem', textAlign: 'center', color: 'text.secondary' }}>
                    {item.parcelaIndex}/{item.qtdParcelas}
                  </TableCell>
                  <TableCell sx={{ py: 0.8, fontWeight: 800, color: '#10b981', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {formatarMoeda(item.comissao)}
                  </TableCell>
                </TableRow>
              ))}
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
}: {
  grupo: GrupoPeriodo;
  isAtual: boolean;
  isPast: boolean;
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const isDark = theme.palette.mode === 'dark';

  const bgCard = isAtual
    ? (isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.07)')
    : isPast
    ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
    : (isDark ? '#111827' : '#ffffff');

  const borderColor = isAtual
    ? '#6366f1'
    : (isDark ? '#1f2937' : '#e5e7eb');

  // Datas de recebimento únicas dentro do mês
  const datasUnicas = [...new Set(grupo.itens.map((i) => i.dataPrevisaoRecebimento))].sort();

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
          gap: 2,
          px: 2.5,
          py: 1.8,
          cursor: 'pointer',
          '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' },
        }}
      >
        <IconButton size="small" sx={{ p: 0.25, color: 'text.secondary' }}>
          {open ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
        </IconButton>

        {/* Mês de recebimento */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 180 }}>
          <Box sx={{
            p: 0.8, borderRadius: 1.5,
            background: isAtual ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : (isDark ? '#1f2937' : '#f1f5f9'),
            color: isAtual ? '#fff' : 'text.secondary',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CalendarMonthIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', lineHeight: 1 }}>
              Mês de Recebimento
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, color: isAtual ? theme.palette.primary.main : 'text.primary', fontFamily: 'Outfit, sans-serif', fontSize: '1rem' }}>
              {formatarMesAno(grupo.mesPeriodo + '-01')}
            </Typography>
          </Box>
          {isAtual && (
            <Chip label="MÊS ATUAL" size="small" sx={{
              ml: 0.5, height: 20, fontSize: '0.62rem', fontWeight: 800,
              background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff',
              letterSpacing: '0.5px'
            }} />
          )}
          {isPast && (
            <Chip label="Passado" size="small" sx={{
              ml: 0.5, height: 20, fontSize: '0.62rem', fontWeight: 700,
              bgcolor: isDark ? '#374151' : '#e5e7eb', color: 'text.secondary',
            }} />
          )}
        </Box>

        {/* Datas de recebimento do mês */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', minWidth: 120 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.68rem' }}>
            Datas de Recebimento
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.75rem' }}>
            {datasUnicas.map(formatarData).join(' · ')}
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Métricas resumidas */}
        <Box sx={{ display: 'flex', gap: 4, flexGrow: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
              Comissões a Receber
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, color: '#10b981', fontFamily: 'Outfit, sans-serif' }}>
              {formatarMoeda(grupo.totalComissoes)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
              Valor do Crédito
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, color: 'text.primary', fontFamily: 'Outfit, sans-serif' }}>
              {formatarMoeda(grupo.totalParcelas)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
              Qtd. Parcelas
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, color: 'text.primary', fontFamily: 'Outfit, sans-serif' }}>
              {grupo.qtdParcelas}
            </Typography>
          </Box>
          {/* Breakdown por status */}
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.4 }}>
              Por Status
            </Typography>
            <StatusValorRow totais={grupo.totaisStatus} />
          </Box>
        </Box>

        {/* Barra visual de composição */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5 }}>
          {(['A vencer', 'Vencida', 'Paga', 'Recebida'] as StatusParcela[]).map((s) => {
            const count = grupo.itens.filter((i) => i.status === s).length;
            if (!count) return null;
            const colors: Record<string, string> = {
              'A vencer': '#6366f1', 'Vencida': '#f59e0b', 'Paga': '#10b981', 'Recebida': '#0ea5e9'
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
      </Box>

      {/* Sub-grupos por data de recebimento */}
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
  dataInicio: string;
  dataFim: string;
  diasCorte: [number, number];
  diasRecebimento: [number, number];
}

export const RelatorioRecebimentos = ({
  vendas,
  dataInicio,
  dataFim,
  diasCorte,
  diasRecebimento,
}: RelatorioRecebimentosProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusParcela | 'Todos'>('Todos');

  // 1. Monta lista de parcelas com datas de previsão
  const parcelas = useMemo<ParcelaLinha[]>(() => {
    const lista: ParcelaLinha[] = [];
    const mesInicioChave = dataInicio.substring(0, 7);
    const mesFimChave = dataFim.substring(0, 7);

    vendas.forEach((venda) => {
      if (venda.statusCliente === 'Cancelado') return;

      const todasParcelasVenda = Object.keys(venda.projecaoMensal)
        .filter((m) => { const c = venda.projecaoMensal[m]; return c && c.valorVenda > 0; })
        .sort();

      Object.entries(venda.projecaoMensal).forEach(([mesChave, celula]) => {
        if (!celula || !celula.valorVenda || celula.valorVenda <= 0) return;
        if (mesChave < mesInicioChave || mesChave > mesFimChave) return;

        const statusEf = obterStatusEfetivo(celula.status, celula.dataVencimento);
        // Quando filtro é 'Cancelada', incluir parcelas com esse status; caso contrário excluí-las
        if (filtroStatus === 'Cancelada') {
          if (statusEf !== 'Cancelada' && celula.status !== 'Cancelada') return;
        } else {
          if (celula.status === 'Cancelada') return;
          if (filtroStatus !== 'Todos' && statusEf !== filtroStatus) return;
        }

        const dtVenc = celula.dataVencimento || `${mesChave}-15`;
        const dtPrev = (celula.dataPrevisaoRecebimento && !celula.dataPrevisaoRecebimento.includes('undefined'))
          ? celula.dataPrevisaoRecebimento
          : calcularDataPrevisaoRecebimento(dtVenc, diasCorte, diasRecebimento);

        if (!dtPrev) return;

        const parcelaIndex = todasParcelasVenda.indexOf(mesChave) + 1;

        // Filtro por busca
        const termoBusca = busca.toLowerCase();
        if (termoBusca && !(
          venda.cliente.toLowerCase().includes(termoBusca) ||
          (venda.pac || '').toLowerCase().includes(termoBusca) ||
          (venda.vendedorNome || '').toLowerCase().includes(termoBusca)
        )) return;

        lista.push({
          id: `${venda.id}_${mesChave}`,
          cliente: venda.cliente,
          pac: venda.pac || '',
          vendedorNome: venda.vendedorNome || '',
          segmento: venda.segmento,
          tabela: venda.tabela,
          mesReferencia: mesChave,
          dataVencimento: dtVenc,
          dataPrevisaoRecebimento: dtPrev,
          comissao: celula.comissaoGerada || 0,
          valorParcela: celula.valorParcela || venda.valorParcela,
          valorVenda: venda.valorVenda,
          status: statusEf,
          parcelaIndex,
          qtdParcelas: venda.qtdParcelas,
        });
      });
    });

    return lista;
  }, [vendas, dataInicio, dataFim, diasCorte, diasRecebimento, busca, filtroStatus]);

  // 2. Agrupa por mês de recebimento (YYYY-MM)
  const grupos = useMemo<GrupoPeriodo[]>(() => {
    const mapa = new Map<string, GrupoPeriodo>();

    parcelas.forEach((p) => {
      const key = p.dataPrevisaoRecebimento.substring(0, 7); // YYYY-MM
      if (!mapa.has(key)) {
        mapa.set(key, {
          mesPeriodo: key,
          totalComissoes: 0,
          totalParcelas: 0,
          qtdParcelas: 0,
          itens: [],
          totaisStatus: { aVencer: 0, vencida: 0, paga: 0, recebida: 0, cancelada: 0, aReceber: 0 },
        });
      }
      const g = mapa.get(key)!;
      g.totalComissoes += p.comissao;
      g.totalParcelas += p.valorVenda;
      g.qtdParcelas += 1;
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

  // 4. Próximo período com valor a receber
  const mesAtual = new Date().toISOString().substring(0, 7); // YYYY-MM
  const proximoPeriodo = grupos.find((g) => g.mesPeriodo >= mesAtual);
  const periodoAtrasados = grupos.filter((g) => g.mesPeriodo < mesAtual);
  const totalAtrasado = periodoAtrasados.reduce((acc, g) => acc + g.totalComissoes, 0);
  const proximoValor = proximoPeriodo ? formatarMoeda(proximoPeriodo.totalComissoes) : '';
  const proximoLabel = proximoPeriodo ? formatarMesAno(proximoPeriodo.mesPeriodo + '-01') : '—';

  // Exportar CSV
  const exportarCSV = () => {
    const header = ['Data Recebimento', 'Cliente', 'PAC', 'Vendedor', 'Mês Ref.', 'Vencimento', 'Valor da Cota', 'Valor Parcela', 'Comissão', 'Status', 'Parcela Nº'];
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
      p.status,
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

  const STATUS_OPCOES: Array<StatusParcela | 'Todos'> = ['Todos', 'A vencer', 'Vencida', 'Paga', 'Recebida', 'Cancelada'];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: isDark ? '#f8fafc' : '#0f172a' }}>
            Relatório de Previsão de Recebimentos
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Comissões agrupadas por data prevista de recebimento · Período: {formatarData(dataInicio)} até {formatarData(dataFim)}
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
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
        {[
          {
            label: 'Total a Receber',
            value: formatarMoeda(totalComissoes),
            icon: <AccountBalanceWalletIcon />,
            color: '#10b981',
            bg: 'rgba(16,185,129,0.12)',
          },
          {
            label: 'Valor do Crédito',
            value: formatarMoeda(totalCredito),
            icon: <TrendingUpIcon />,
            color: '#6366f1',
            bg: 'rgba(99,102,241,0.12)',
          },
          {
            label: 'Próximo Recebimento',
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
          {totalQtd} parcelas em {grupos.length} meses de recebimento
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
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {STATUS_OPCOES.map((s) => (
            <Chip
              key={s}
              label={s}
              size="small"
              onClick={() => setFiltroStatus(s)}
              variant={filtroStatus === s ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 600,
                fontSize: '0.72rem',
                cursor: 'pointer',
                bgcolor: filtroStatus === s ? theme.palette.primary.main : 'transparent',
                color: filtroStatus === s ? '#fff' : 'text.secondary',
                borderColor: filtroStatus === s ? theme.palette.primary.main : (isDark ? '#374151' : '#d1d5db'),
              }}
            />
          ))}
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
    </Box>
  );
};
