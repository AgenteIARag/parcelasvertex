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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
import PersonIcon from '@mui/icons-material/Person';
import type { LancamentoVenda, StatusParcela, Vendedor } from '../types';

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

interface ParcelaComissaoLinha {
  id: string;
  cliente: string;
  pac: string;
  vendedorId: string;
  vendedorNome: string;
  segmento: string;
  tabela: string;
  mesReferencia: string;           // YYYY-MM
  dataVencimento: string;          // YYYY-MM-DD
  dataPrevisaoPagamento: string;   // YYYY-MM-DD
  comissaoVendedor: number;        // R$ da comissão do vendedor
  percentualVendedor: number;      // % do vendedor
  valorParcela: number;
  valorVenda: number;
  status: StatusParcela;
  parcelaIndex: number;
  qtdParcelas: number;
}

interface GrupoPeriodoComissao {
  mesPeriodo: string;              // YYYY-MM
  totalComissoesVendedores: number;
  totalCredito: number;
  qtdParcelas: number;
  itens: ParcelaComissaoLinha[];
}

// ──────────────────────────────────────────────────────────
// Sub-componente: Badge de Status
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
// Sub-componente: Sub-grupo por data de previsão de pagamento
// ──────────────────────────────────────────────────────────

const SubGrupoDataComissao = ({
  dataPagamento,
  itens,
  totalComissoes,
  totalCredito,
}: {
  dataPagamento: string;
  itens: ParcelaComissaoLinha[];
  totalComissoes: number;
  totalCredito: number;
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const isDark = theme.palette.mode === 'dark';
  const hoje = new Date().toISOString().split('T')[0];
  const isHoje = dataPagamento === hoje;
  const isPast = dataPagamento < hoje;

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
            ? (isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.05)')
            : 'transparent',
          '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)' },
        }}
      >
        <IconButton size="small" sx={{ p: 0.2, color: 'text.secondary' }}>
          {open ? <KeyboardArrowDownIcon sx={{ fontSize: 16 }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />}
        </IconButton>

        {/* Data */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 170 }}>
          <Box sx={{
            width: 7, height: 7, borderRadius: '50%',
            bgcolor: isHoje ? '#f59e0b' : isPast ? '#ef4444' : '#10b981',
            flexShrink: 0,
          }} />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', lineHeight: 1, fontSize: '0.68rem' }}>
              Previsão de Pagamento
            </Typography>
            <Typography variant="body2" sx={{
              fontWeight: 800,
              fontFamily: 'Outfit, sans-serif',
              color: isHoje ? '#f59e0b' : isPast ? '#ef4444' : '#10b981',
              fontSize: '0.88rem',
            }}>
              {formatarData(dataPagamento)}
            </Typography>
          </Box>
          {isHoje && (
            <Chip label="HOJE" size="small" sx={{
              height: 18, fontSize: '0.58rem', fontWeight: 800,
              background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff',
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
        <Box sx={{ display: 'flex', gap: 3, flexGrow: 1 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.65rem', display: 'block' }}>
              Comissão Vendedores
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#f59e0b', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem' }}>
              {formatarMoeda(totalComissoes)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.65rem', display: 'block' }}>
              Crédito Total
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
        </Box>
      </Box>

      {/* Tabela do sub-grupo */}
      <Collapse in={open} timeout="auto" unmountOnExit>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Vendedor', 'Cliente / PAC', 'Mês Ref.', 'Vencimento', 'Valor da Cota', 'Parcela', 'Tabela', 'Status', 'Parcela Nº', 'Comissão Vendedor'].map((h) => (
                  <TableCell key={h} sx={{
                    fontWeight: 700, fontSize: '0.68rem', color: 'text.secondary',
                    bgcolor: isDark ? '#0a0e18' : '#f8fafc', textTransform: 'uppercase',
                    letterSpacing: '0.4px', whiteSpace: 'nowrap', py: 0.8,
                    pl: h === 'Vendedor' ? 4 : undefined,
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
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.78rem', color: theme.palette.primary.main }}>
                      {item.vendedorNome || 'Vendedor Não Atribuído'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 0.8 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{item.cliente}</Typography>
                    {item.pac && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block' }}>
                        PAC: {item.pac}
                      </Typography>
                    )}
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
                  <TableCell sx={{ py: 0.8, fontWeight: 800, color: '#f59e0b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {formatarMoeda(item.comissaoVendedor)}
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
// Sub-componente: Linha do grupo (Accordion por mês)
// ──────────────────────────────────────────────────────────

const GrupoPagamentoComissao = ({
  grupo,
  isAtual,
  isPast,
}: {
  grupo: GrupoPeriodoComissao;
  isAtual: boolean;
  isPast: boolean;
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const isDark = theme.palette.mode === 'dark';

  const bgCard = isAtual
    ? (isDark ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.07)')
    : isPast
    ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
    : (isDark ? '#111827' : '#ffffff');

  const borderColor = isAtual
    ? '#f59e0b'
    : (isDark ? '#1f2937' : '#e5e7eb');

  const datasUnicas = [...new Set(grupo.itens.map((i) => i.dataPrevisaoPagamento))].sort();

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${borderColor}`,
        borderRadius: 2.5,
        overflow: 'hidden',
        bgcolor: bgCard,
        transition: 'all 0.2s',
        boxShadow: isAtual ? '0 4px 20px rgba(245,158,11,0.2)' : 'none',
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

        {/* Mês de pagamento */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 190 }}>
          <Box sx={{
            p: 0.8, borderRadius: 1.5,
            background: isAtual ? 'linear-gradient(135deg,#f59e0b,#d97706)' : (isDark ? '#1f2937' : '#f1f5f9'),
            color: isAtual ? '#fff' : 'text.secondary',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CalendarMonthIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', lineHeight: 1 }}>
              Mês de Pagamento
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, color: isAtual ? '#f59e0b' : 'text.primary', fontFamily: 'Outfit, sans-serif', fontSize: '1rem' }}>
              {formatarMesAno(grupo.mesPeriodo + '-01')}
            </Typography>
          </Box>
          {isAtual && (
            <Chip label="MÊS ATUAL" size="small" sx={{
              ml: 0.5, height: 20, fontSize: '0.62rem', fontWeight: 800,
              background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff',
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

        {/* Datas de pagamento do mês */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', minWidth: 130 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.68rem' }}>
            Datas de Pagamento
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.75rem' }}>
            {datasUnicas.map(formatarData).join(' · ')}
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Métricas resumidas */}
        <Box sx={{ display: 'flex', gap: 4, flexGrow: 1, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
              Comissões a Pagar
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, color: '#f59e0b', fontFamily: 'Outfit, sans-serif' }}>
              {formatarMoeda(grupo.totalComissoesVendedores)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
              Valor do Crédito Comercial
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, color: 'text.primary', fontFamily: 'Outfit, sans-serif' }}>
              {formatarMoeda(grupo.totalCredito)}
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
        </Box>

        {/* Badges de status */}
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

      {/* Sub-grupos por data de pagamento */}
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Divider />
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {datasUnicas.map((dtPag) => {
            const itensDaData = grupo.itens.filter((i) => i.dataPrevisaoPagamento === dtPag);
            const totalComissaoData = itensDaData.reduce((acc, i) => acc + i.comissaoVendedor, 0);
            const totalCreditoData = itensDaData.reduce((acc, i) => acc + i.valorVenda, 0);
            return (
              <SubGrupoDataComissao
                key={dtPag}
                dataPagamento={dtPag}
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
// Componente Principal
// ──────────────────────────────────────────────────────────

interface RelatorioComissoesProps {
  vendas: LancamentoVenda[];
  vendedores: Vendedor[];
  dataInicio: string;
  dataFim: string;
  diasCorte: [number, number];
  diasRecebimento: [number, number];
}

export const RelatorioComissoes = ({
  vendas,
  vendedores,
  dataInicio,
  dataFim,
  diasCorte,
  diasRecebimento,
}: RelatorioComissoesProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const hoje = new Date().toISOString().split('T')[0];

  const [busca, setBusca] = useState('');
  const [vendedorIdFiltro, setVendedorIdFiltro] = useState<string>('Todos');
  const [filtroStatus, setFiltroStatus] = useState<StatusParcela | 'Todos'>('Todos');

  // Mapa de vendedores para busca rápida de percentual e nome
  const mapaVendedores = useMemo(() => {
    const map = new Map<string, Vendedor>();
    vendedores.forEach((v) => map.set(v.id, v));
    return map;
  }, [vendedores]);

  // 1. Monta lista de parcelas de comissão de vendedores com previsões de pagamento
  const parcelas = useMemo<ParcelaComissaoLinha[]>(() => {
    const lista: ParcelaComissaoLinha[] = [];
    const mesInicioChave = dataInicio.substring(0, 7);
    const mesFimChave = dataFim.substring(0, 7);

    vendas.forEach((venda) => {
      if (venda.statusCliente === 'Cancelado') return;

      // Filtro por vendedor selecionado
      if (vendedorIdFiltro !== 'Todos' && venda.vendedorId !== vendedorIdFiltro) return;

      const vendedorObj = venda.vendedorId ? mapaVendedores.get(venda.vendedorId) : null;
      const pctVendedor = Number(vendedorObj?.percentualComissao ?? venda.percentualComissao ?? 2.0);
      const pctMensalVendedor = pctVendedor / venda.qtdParcelas;

      const todasParcelasVenda = Object.keys(venda.projecaoMensal)
        .filter((m) => { const c = venda.projecaoMensal[m]; return c && c.valorVenda > 0; })
        .sort();

      Object.entries(venda.projecaoMensal).forEach(([mesChave, celula]) => {
        if (!celula || !celula.valorVenda || celula.valorVenda <= 0) return;
        if (mesChave < mesInicioChave || mesChave > mesFimChave) return;

        const statusEf = obterStatusEfetivo(celula.status, celula.dataVencimento);
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

        const comissaoVendedorCalculada = Number((venda.valorVenda * (pctMensalVendedor / 100)).toFixed(2));

        // Filtro de busca textual
        const termo = busca.toLowerCase();
        if (termo && !(
          venda.cliente.toLowerCase().includes(termo) ||
          (venda.pac || '').toLowerCase().includes(termo) ||
          (venda.vendedorNome || '').toLowerCase().includes(termo)
        )) return;

        lista.push({
          id: `${venda.id}_${mesChave}`,
          cliente: venda.cliente,
          pac: venda.pac || '',
          vendedorId: venda.vendedorId || '',
          vendedorNome: venda.vendedorNome || 'Vendedor Não Atribuído',
          segmento: venda.segmento,
          tabela: venda.tabela,
          mesReferencia: mesChave,
          dataVencimento: dtVenc,
          dataPrevisaoPagamento: dtPrev,
          comissaoVendedor: comissaoVendedorCalculada,
          percentualVendedor: pctVendedor,
          valorParcela: celula.valorParcela || venda.valorParcela,
          valorVenda: venda.valorVenda,
          status: statusEf,
          parcelaIndex,
          qtdParcelas: venda.qtdParcelas,
        });
      });
    });

    return lista;
  }, [vendas, vendedores, mapaVendedores, dataInicio, dataFim, diasCorte, diasRecebimento, busca, vendedorIdFiltro, filtroStatus]);

  // 2. Agrupa por mês de pagamento (YYYY-MM)
  const grupos = useMemo<GrupoPeriodoComissao[]>(() => {
    const mapa = new Map<string, GrupoPeriodoComissao>();

    parcelas.forEach((p) => {
      const key = p.dataPrevisaoPagamento.substring(0, 7); // YYYY-MM
      if (!mapa.has(key)) {
        mapa.set(key, { mesPeriodo: key, totalComissoesVendedores: 0, totalCredito: 0, qtdParcelas: 0, itens: [] });
      }
      const g = mapa.get(key)!;
      g.totalComissoesVendedores += p.comissaoVendedor;
      g.totalCredito += p.valorVenda;
      g.qtdParcelas += 1;
      g.itens.push(p);
    });

    return Array.from(mapa.values()).sort((a, b) => a.mesPeriodo.localeCompare(b.mesPeriodo));
  }, [parcelas]);

  // 3. Totais gerais
  const totalComissoesVendedores = grupos.reduce((acc, g) => acc + g.totalComissoesVendedores, 0);
  const totalCreditoGeral = grupos.reduce((acc, g) => acc + g.totalCredito, 0);
  const totalQtdParcelas = grupos.reduce((acc, g) => acc + g.qtdParcelas, 0);

  // 4. Próximo período e atrasados
  const mesAtual = new Date().toISOString().substring(0, 7);
  const proximoPeriodo = grupos.find((g) => g.mesPeriodo >= mesAtual);
  const periodoAtrasados = grupos.filter((g) => g.mesPeriodo < mesAtual);
  const totalAtrasado = periodoAtrasados.reduce((acc, g) => acc + g.totalComissoesVendedores, 0);
  const proximoValor = proximoPeriodo ? formatarMoeda(proximoPeriodo.totalComissoesVendedores) : '';
  const proximoLabel = proximoPeriodo ? formatarMesAno(proximoPeriodo.mesPeriodo + '-01') : '—';

  // Exportar CSV de comissões
  const exportarCSV = () => {
    const header = ['Data Pagamento', 'Vendedor', 'Cliente', 'PAC', 'Mês Ref.', 'Vencimento', 'Valor da Cota', 'Valor Parcela', 'Comissão Vendedor', 'Status', 'Parcela Nº'];
    const rows = parcelas.map((p) => [
      formatarData(p.dataPrevisaoPagamento),
      p.vendedorNome,
      p.cliente,
      p.pac,
      formatarMesAno(p.mesReferencia),
      formatarData(p.dataVencimento),
      p.valorVenda.toFixed(2).replace('.', ','),
      p.valorParcela.toFixed(2).replace('.', ','),
      p.comissaoVendedor.toFixed(2).replace('.', ','),
      p.status,
      `${p.parcelaIndex}/${p.qtdParcelas}`,
    ]);
    const csv = [header, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_comissoes_vendedores_${hoje}.csv`;
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
            Relatório de Previsão de Pagamento de Comissões
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Comissões devidas a vendedores agrupadas por data de pagamento · Período: {formatarData(dataInicio)} até {formatarData(dataFim)}
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
            label: 'Comissões Vendedores a Pagar',
            value: formatarMoeda(totalComissoesVendedores),
            icon: <AccountBalanceWalletIcon />,
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.12)',
          },
          {
            label: 'Crédito Comercial Total',
            value: formatarMoeda(totalCreditoGeral),
            icon: <TrendingUpIcon />,
            color: '#6366f1',
            bg: 'rgba(99,102,241,0.12)',
          },
          {
            label: 'Próximo Pagamento Vendedores',
            value: proximoLabel,
            sub: proximoValor,
            icon: <CalendarMonthIcon />,
            color: '#10b981',
            bg: 'rgba(16,185,129,0.12)',
          },
          {
            label: 'Comissões em Atraso / Pendentes',
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
          {totalQtdParcelas} parcelas de comissão distribuídas em {grupos.length} meses de pagamento
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

        {/* Seletor de Vendedor */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="vendedor-select-label">Vendedor</InputLabel>
          <Select
            labelId="vendedor-select-label"
            value={vendedorIdFiltro}
            label="Vendedor"
            onChange={(e) => setVendedorIdFiltro(e.target.value)}
            startAdornment={
              <InputAdornment position="start">
                <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            }
          >
            <MenuItem value="Todos">Todos os Vendedores</MenuItem>
            {vendedores.map((v) => (
              <MenuItem key={v.id} value={v.id}>
                {v.nome}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

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
                bgcolor: filtroStatus === s ? '#f59e0b' : 'transparent',
                color: filtroStatus === s ? '#fff' : 'text.secondary',
                borderColor: filtroStatus === s ? '#f59e0b' : (isDark ? '#374151' : '#d1d5db'),
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
            Nenhuma comissão de vendedor encontrada para os critérios selecionados.
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Ajuste o período, seletor de vendedor ou os termos de busca.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {grupos.map((grupo) => (
            <GrupoPagamentoComissao
              key={grupo.mesPeriodo}
              grupo={grupo}
              isAtual={grupo.mesPeriodo === mesAtual}
              isPast={grupo.mesPeriodo < mesAtual}
            />
          ))}
        </Box>
      )}

    </Box>
  );
};
