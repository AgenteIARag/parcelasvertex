import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import HomeIcon from '@mui/icons-material/Home';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import type { Empresa, RegraMaster, RegraFilha, SegmentoType, TipoTabela } from '../types';
import { obterRegrasFilhaSupabase, salvarRegraFilhaSupabase } from '../utils/supabase';

interface RegrasFilhaProps {
  empresas: Empresa[];
  regrasMaster: RegraMaster[]; // Regras da empresa mãe
}

/** Mapa local de edições (regraMasterId -> campos editados) */
type EditMap = Record<string, {
  percentual: number | '';
  percentualAdesao: number | '';
  percentualMensal: number | '';
  percentuaisParcelas?: number[];
  percentualContempl: number | '';
}>;

const SEGMENTO_ICONS: Record<SegmentoType, React.ReactNode> = {
  'Imóveis': <HomeIcon sx={{ fontSize: 16 }} />,
  'Autos Leves': <DirectionsCarIcon sx={{ fontSize: 16 }} />,
  'Pesados': <LocalShippingIcon sx={{ fontSize: 16 }} />,
};

const SEGMENTO_COLORS: Record<SegmentoType, { bg: string; text: string }> = {
  'Imóveis': { bg: 'rgba(99,102,241,0.12)', text: '#818cf8' },
  'Autos Leves': { bg: 'rgba(16,185,129,0.12)', text: '#34d399' },
  'Pesados': { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24' },
};

// Helper para gerar a grade padrão de uma regra
const gerarGradePadrao = (
  qtd: number,
  tipo: TipoTabela = 'Linear',
  pTotal: number = 0,
  pAdesao: number = 0,
  pMensal: number = 0
): number[] => {
  if (!qtd || qtd <= 0) return [];
  if (tipo === 'Adesão') {
    const rest = Math.max(1, qtd - 1);
    const vMensal = Number((pMensal / rest).toFixed(3));
    const arr = [pAdesao];
    for (let i = 1; i < qtd; i++) arr.push(vMensal);
    return arr;
  } else {
    const vLinear = Number((pTotal / qtd).toFixed(3));
    return Array(qtd).fill(vLinear);
  }
};

export const RegrasFilha: React.FC<RegrasFilhaProps> = ({ empresas, regrasMaster }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Empresas filhas disponíveis
  const empresasFilhas = empresas.filter(e => !e.ativo ? false : !!e.empresaMaeId);

  const [empresaFilhaSelecionada, setEmpresaFilhaSelecionada] = useState<string>(
    empresasFilhas[0]?.id || ''
  );
  const [regrasFilha, setRegrasFilha] = useState<RegraFilha[]>([]);
  const [editMap, setEditMap] = useState<EditMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dialog de personalização de parcelas da filha
  const [modalGradeRegra, setModalGradeRegra] = useState<RegraMaster | null>(null);
  const [gradeFilhaTemp, setGradeFilhaTemp] = useState<number[]>([]);

  // Empresa mãe da filha selecionada
  const empresaFilhaObj = useMemo(() => empresas.find(e => e.id === empresaFilhaSelecionada), [empresas, empresaFilhaSelecionada]);
  const empresaMaeId = empresaFilhaObj?.empresaMaeId;
  const empresaMaeObj = useMemo(() => empresas.find(e => e.id === empresaMaeId), [empresas, empresaMaeId]);

  // Regras da empresa mãe (estabilizadas com useMemo)
  const regrasDaMae = useMemo(() => {
    return regrasMaster.filter(r => !r.empresaId || r.empresaId === empresaMaeId);
  }, [regrasMaster, empresaMaeId]);

  const carregarRegrasFilha = useCallback(async () => {
    if (!empresaFilhaSelecionada) return;
    setLoading(true);
    try {
      const data = await obterRegrasFilhaSupabase(empresaFilhaSelecionada);
      setRegrasFilha(data);

      // Montar mapa de edições a partir do que foi carregado
      const mapa: EditMap = {};
      regrasDaMae.forEach(rm => {
        const rFilha = data.find(rf => rf.regraMasterId === rm.id);
        const pComissao = rFilha ? rFilha.percentualComissao : '';
        const pAdesao = rFilha?.percentualAdesao ?? (rm.tipoTabela === 'Adesão' ? rm.percentualAdesao ?? '' : '');
        const pMensal = rFilha?.percentualMensal ?? (rm.tipoTabela === 'Adesão' ? rm.percentualMensal ?? '' : '');
        
        let grade = rFilha?.percentuaisParcelas;
        if (!grade || grade.length !== rm.qtdParcelas) {
          grade = gerarGradePadrao(
            rm.qtdParcelas,
            rm.tipoTabela || 'Linear',
            Number(pComissao || 0),
            Number(pAdesao || 0),
            Number(pMensal || 0)
          );
        }

        mapa[rm.id] = {
          percentual: pComissao,
          percentualAdesao: pAdesao,
          percentualMensal: pMensal,
          percentuaisParcelas: grade,
          percentualContempl: rFilha?.percentualComissaoContemplacao ?? '',
        };
      });
      setEditMap(mapa);
    } catch {
      setErrorMsg('Erro ao carregar regras da empresa filha.');
    } finally {
      setLoading(false);
    }
  }, [empresaFilhaSelecionada, regrasDaMae]);

  useEffect(() => {
    if (empresaFilhaSelecionada) {
      carregarRegrasFilha();
    }
  }, [empresaFilhaSelecionada, empresaMaeId]);

  const handleChangePercentual = (regraMasterId: string, valor: string) => {
    const num = valor === '' ? '' : Math.max(0, parseFloat(valor));
    const rm = regrasDaMae.find(r => r.id === regraMasterId);
    const qtd = rm?.qtdParcelas || 1;
    const grade = num !== '' ? gerarGradePadrao(qtd, 'Linear', Number(num), 0, 0) : [];
    setEditMap(prev => ({
      ...prev,
      [regraMasterId]: {
        ...prev[regraMasterId],
        percentual: num,
        percentuaisParcelas: grade
      }
    }));
  };

  const handleChangeAdesao = (regraMasterId: string, valor: string) => {
    const num = valor === '' ? '' : Math.max(0, parseFloat(valor));
    const rm = regrasDaMae.find(r => r.id === regraMasterId);
    const qtd = rm?.qtdParcelas || 1;
    const mensalAtual = editMap[regraMasterId]?.percentualMensal || 0;
    const grade = gerarGradePadrao(qtd, 'Adesão', 0, Number(num || 0), Number(mensalAtual));
    setEditMap(prev => ({
      ...prev,
      [regraMasterId]: {
        ...prev[regraMasterId],
        percentualAdesao: num,
        percentual: Number((Number(num || 0) + Number(mensalAtual)).toFixed(2)),
        percentuaisParcelas: grade
      }
    }));
  };

  const handleChangeMensal = (regraMasterId: string, valor: string) => {
    const num = valor === '' ? '' : Math.max(0, parseFloat(valor));
    const rm = regrasDaMae.find(r => r.id === regraMasterId);
    const qtd = rm?.qtdParcelas || 1;
    const adesaoAtual = editMap[regraMasterId]?.percentualAdesao || 0;
    const grade = gerarGradePadrao(qtd, 'Adesão', 0, Number(adesaoAtual), Number(num || 0));
    setEditMap(prev => ({
      ...prev,
      [regraMasterId]: {
        ...prev[regraMasterId],
        percentualMensal: num,
        percentual: Number((Number(adesaoAtual) + Number(num || 0)).toFixed(2)),
        percentuaisParcelas: grade
      }
    }));
  };

  const handleChangeContempl = (regraMasterId: string, valor: string) => {
    const num = valor === '' ? '' : Math.max(0, parseFloat(valor));
    setEditMap(prev => ({
      ...prev,
      [regraMasterId]: { ...prev[regraMasterId], percentualContempl: num }
    }));
  };

  const handleAbrirModalGrade = (rm: RegraMaster) => {
    setModalGradeRegra(rm);
    const gradeAtual = editMap[rm.id]?.percentuaisParcelas;
    if (gradeAtual && gradeAtual.length === rm.qtdParcelas) {
      setGradeFilhaTemp([...gradeAtual]);
    } else {
      setGradeFilhaTemp(
        gerarGradePadrao(
          rm.qtdParcelas,
          rm.tipoTabela || 'Linear',
          Number(editMap[rm.id]?.percentual || 0),
          Number(editMap[rm.id]?.percentualAdesao || 0),
          Number(editMap[rm.id]?.percentualMensal || 0)
        )
      );
    }
  };

  const handleSalvarModalGrade = () => {
    if (!modalGradeRegra) return;
    const somaTotal = Number(gradeFilhaTemp.reduce((a, b) => a + (Number(b) || 0), 0).toFixed(2));
    
    setEditMap(prev => ({
      ...prev,
      [modalGradeRegra.id]: {
        ...prev[modalGradeRegra.id],
        percentual: somaTotal,
        percentualAdesao: gradeFilhaTemp[0] || 0,
        percentualMensal: Number(gradeFilhaTemp.slice(1).reduce((a, b) => a + (Number(b) || 0), 0).toFixed(2)),
        percentuaisParcelas: [...gradeFilhaTemp]
      }
    }));
    setModalGradeRegra(null);
  };

  const handleSalvar = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const promises: Promise<void>[] = [];

      for (const rm of regrasDaMae) {
        const edit = editMap[rm.id];
        if (!edit) continue;

        const isAdesao = rm.tipoTabela === 'Adesão';
        const gradeFinal = (edit.percentuaisParcelas && edit.percentuaisParcelas.length === rm.qtdParcelas)
          ? edit.percentuaisParcelas
          : gerarGradePadrao(
              rm.qtdParcelas,
              rm.tipoTabela || 'Linear',
              Number(edit.percentual || 0),
              Number(edit.percentualAdesao || 0),
              Number(edit.percentualMensal || 0)
            );

        if (isAdesao) {
          if (edit.percentualAdesao === '' && edit.percentualMensal === '') continue;
          const pAdesao = Number(edit.percentualAdesao || 0);
          const pMensal = Number(edit.percentualMensal || 0);

          if (rm.percentualAdesao != null && pAdesao > rm.percentualAdesao) {
            setErrorMsg(`"${rm.tabela} / ${rm.qtdParcelas}x": o % Adesão da filha (${pAdesao}%) não pode ser maior que o da mãe (${rm.percentualAdesao}%).`);
            setSaving(false);
            return;
          }
          if (rm.percentualMensal != null && pMensal > rm.percentualMensal) {
            setErrorMsg(`"${rm.tabela} / ${rm.qtdParcelas}x": o % Mensal da filha (${pMensal}%) não pode ser maior que o da mãe (${rm.percentualMensal}%).`);
            setSaving(false);
            return;
          }

          const existente = regrasFilha.find(rf => rf.regraMasterId === rm.id);
          const regra: RegraFilha = {
            id: existente?.id || `rf_${empresaFilhaSelecionada}_${rm.id}_${Date.now()}`,
            empresaFilhaId: empresaFilhaSelecionada,
            regraMasterId: rm.id,
            tipoTabela: 'Adesão',
            percentualComissao: Number((pAdesao + pMensal).toFixed(2)),
            percentualAdesao: pAdesao,
            percentualMensal: pMensal,
            percentuaisParcelas: gradeFinal,
            percentualComissaoContemplacao: edit.percentualContempl !== '' ? Number(edit.percentualContempl) : undefined,
          };
          promises.push(salvarRegraFilhaSupabase(regra));
        } else {
          // Linear
          if (edit.percentual === '') continue;
          const percentual = Number(edit.percentual);
          if (percentual > rm.percentualComissao) {
            setErrorMsg(`"${rm.tabela} / ${rm.qtdParcelas}x": o % da filha (${percentual}%) não pode ser maior que o % da mãe (${rm.percentualComissao}%).`);
            setSaving(false);
            return;
          }

          const existente = regrasFilha.find(rf => rf.regraMasterId === rm.id);
          const regra: RegraFilha = {
            id: existente?.id || `rf_${empresaFilhaSelecionada}_${rm.id}_${Date.now()}`,
            empresaFilhaId: empresaFilhaSelecionada,
            regraMasterId: rm.id,
            tipoTabela: 'Linear',
            percentualComissao: percentual,
            percentuaisParcelas: gradeFinal,
            percentualComissaoContemplacao: edit.percentualContempl !== '' ? Number(edit.percentualContempl) : undefined,
          };
          promises.push(salvarRegraFilhaSupabase(regra));
        }
      }

      await Promise.all(promises);
      await carregarRegrasFilha();
      setSuccessMsg('Tabela da empresa filha salva com sucesso!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch {
      setErrorMsg('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const getDiferencaLinear = (rm: RegraMaster): number | null => {
    const edit = editMap[rm.id];
    if (!edit || edit.percentual === '') return null;
    return Number((rm.percentualComissao - Number(edit.percentual)).toFixed(2));
  };

  const getDiferencaAdesao = (rm: RegraMaster): number | null => {
    const edit = editMap[rm.id];
    if (!edit || edit.percentualAdesao === '' || rm.percentualAdesao == null) return null;
    return Number((rm.percentualAdesao - Number(edit.percentualAdesao)).toFixed(2));
  };

  const getDiferencaMensal = (rm: RegraMaster): number | null => {
    const edit = editMap[rm.id];
    if (!edit || edit.percentualMensal === '' || rm.percentualMensal == null) return null;
    return Number((rm.percentualMensal - Number(edit.percentualMensal)).toFixed(2));
  };

  const getDiferencaContempl = (rm: RegraMaster): number | null => {
    const edit = editMap[rm.id];
    if (!rm.percentualComissaoContemplacao || !edit || edit.percentualContempl === '') return null;
    return Number((rm.percentualComissaoContemplacao - Number(edit.percentualContempl)).toFixed(2));
  };

  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const hCellSx = {
    fontWeight: 700,
    fontSize: '0.75rem',
    color: 'text.secondary',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    borderBottom: `2px solid ${borderColor}`,
    py: 1.5,
    fontFamily: 'Outfit, sans-serif',
  };

  if (empresasFilhas.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <AccountTreeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}>
          Nenhuma empresa filha cadastrada
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          Vá em <strong>Empresas</strong> e vincule uma empresa a uma empresa mãe para habilitar o controle de diferencial de comissão.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
            Tabelas de Comissão por Empresa Filha
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Configure os percentuais das empresas filhas (com ajuste fino parcela a parcela). A diferença para a tabela da mãe gera repasses automáticos de comissão.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSalvar}
          disabled={saving || !empresaFilhaSelecionada}
          sx={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            borderRadius: 2,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
            minWidth: 160,
          }}
        >
          {saving ? 'Salvando...' : 'Salvar Tabela'}
        </Button>
      </Box>

      {successMsg && <Alert severity="success" onClose={() => setSuccessMsg(null)} sx={{ borderRadius: 2 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" onClose={() => setErrorMsg(null)} sx={{ borderRadius: 2 }}>{errorMsg}</Alert>}

      {/* Seletor de empresa filha */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <FormControl sx={{ minWidth: 260 }} size="small">
          <InputLabel>Empresa Filha</InputLabel>
          <Select
            value={empresaFilhaSelecionada}
            label="Empresa Filha"
            onChange={e => setEmpresaFilhaSelecionada(e.target.value)}
          >
            {empresasFilhas.map(ef => (
              <MenuItem key={ef.id} value={ef.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccountTreeIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                  {ef.nome}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {empresaMaeObj && (
          <Chip
            icon={<AccountTreeIcon sx={{ fontSize: 15 }} />}
            label={`Empresa Mãe: ${empresaMaeObj.nome}`}
            sx={{
              fontWeight: 700,
              bgcolor: 'rgba(99,102,241,0.12)',
              color: '#818cf8',
              borderRadius: 2,
              fontSize: '0.8rem',
            }}
          />
        )}
      </Box>

      {/* Info Box */}
      <Box sx={{
        p: 2,
        borderRadius: 2.5,
        border: `1px solid ${isDark ? '#1e3a5f' : '#bfdbfe'}`,
        bgcolor: isDark ? 'rgba(30,58,95,0.3)' : 'rgba(239,246,255,0.8)',
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
      }}>
        <InfoOutlinedIcon sx={{ fontSize: 20, color: '#60a5fa', mt: 0.2, flexShrink: 0 }} />
        <Typography variant="body2" sx={{ color: isDark ? '#93c5fd' : '#1d4ed8', lineHeight: 1.6 }}>
          <strong>Como funciona:</strong> você pode preencher o percentual global da filha ou clicar no botão <strong>"Editar Grade"</strong> para ajustar o percentual de cada parcela individualmente. O repasse da mãe é calculado exatamente pela diferença em cada parcela.
        </Typography>
      </Box>

      <Divider />

      {/* Tabela de Regras */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : regrasDaMae.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            A empresa mãe ainda não possui regras de comissão cadastradas.
          </Typography>
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: 3,
            border: `1px solid ${borderColor}`,
            bgcolor: cardBg,
            overflow: 'visible',
          }}
        >
          <Table sx={{ minWidth: 850 }}>
            <TableHead sx={{ bgcolor: isDark ? '#0f172a' : '#f8fafc' }}>
              <TableRow>
                <TableCell sx={hCellSx}>Segmento</TableCell>
                <TableCell sx={hCellSx}>Tabela</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>Tipo</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>Parcelas</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'right' }}>% Mãe (Base)</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>% Filha Configurado</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>Grade de Parcelas</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>Diferencial (Mãe)</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>% Contempl. Mãe</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>% Contempl. Filha</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>Dif. Contempl.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {regrasDaMae.map(rm => {
                const isAdesao = rm.tipoTabela === 'Adesão';
                const chipColor = SEGMENTO_COLORS[rm.segmento] || { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' };
                const edit = editMap[rm.id] || { percentual: '', percentualAdesao: '', percentualMensal: '', percentualContempl: '' };
                const diferencaContempl = getDiferencaContempl(rm);

                // Validações
                let isInvalido = false;
                if (isAdesao) {
                  const pA = edit.percentualAdesao !== '' ? Number(edit.percentualAdesao) : null;
                  const pM = edit.percentualMensal !== '' ? Number(edit.percentualMensal) : null;
                  if ((pA !== null && rm.percentualAdesao != null && pA > rm.percentualAdesao) ||
                      (pM !== null && rm.percentualMensal != null && pM > rm.percentualMensal)) {
                    isInvalido = true;
                  }
                } else {
                  const pL = edit.percentual !== '' ? Number(edit.percentual) : null;
                  if (pL !== null && pL > rm.percentualComissao) isInvalido = true;
                }

                return (
                  <TableRow key={rm.id} sx={{
                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
                    '&:last-child td': { border: 0 },
                    bgcolor: isInvalido ? (isDark ? 'rgba(239,68,68,0.06)' : 'rgba(254,226,226,0.5)') : 'transparent',
                    transition: 'background 0.2s',
                  }}>
                    {/* Segmento */}
                    <TableCell>
                      <Chip
                        icon={SEGMENTO_ICONS[rm.segmento] as React.ReactElement}
                        label={rm.segmento}
                        size="small"
                        sx={{ bgcolor: chipColor.bg, color: chipColor.text, fontWeight: 700, fontSize: '0.73rem', borderRadius: 1.5 }}
                      />
                    </TableCell>
                    {/* Tabela */}
                    <TableCell sx={{ fontWeight: 500 }}>{rm.tabela}</TableCell>
                    {/* Tipo */}
                    <TableCell align="center">
                      <Chip
                        label={rm.tipoTabela || 'Linear'}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          borderRadius: 1.5,
                          bgcolor: isAdesao ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)',
                          color: isAdesao ? '#f59e0b' : '#818cf8',
                        }}
                      />
                    </TableCell>
                    {/* Parcelas */}
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{rm.qtdParcelas}x</Typography>
                    </TableCell>
                    {/* % Mãe */}
                    <TableCell align="right">
                      {isAdesao ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.2 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                            Adesão: {Number(rm.percentualAdesao || 0).toFixed(2).replace('.', ',')}%
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Mensal: {Number(rm.percentualMensal || 0).toFixed(2).replace('.', ',')}%
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                            Total: {Number(rm.percentualComissao || 0).toFixed(2).replace('.', ',')}%
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                          {rm.percentualComissao.toFixed(2).replace('.', ',')}%
                        </Typography>
                      )}
                    </TableCell>
                    {/* % Filha Configurado */}
                    <TableCell align="center" sx={{ minWidth: 160 }}>
                      {isAdesao ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                          <TextField
                            size="small"
                            type="number"
                            label="Adesão"
                            value={edit.percentualAdesao}
                            onChange={e => handleChangeAdesao(rm.id, e.target.value)}
                            placeholder={`≤ ${rm.percentualAdesao || 0}`}
                            sx={{ width: 120 }}
                            slotProps={{
                              input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                              htmlInput: { step: '0.01', min: '0', max: String(rm.percentualAdesao || 100) }
                            }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label="Mensal"
                            value={edit.percentualMensal}
                            onChange={e => handleChangeMensal(rm.id, e.target.value)}
                            placeholder={`≤ ${rm.percentualMensal || 0}`}
                            sx={{ width: 120 }}
                            slotProps={{
                              input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                              htmlInput: { step: '0.01', min: '0', max: String(rm.percentualMensal || 100) }
                            }}
                          />
                        </Box>
                      ) : (
                        <TextField
                          size="small"
                          type="number"
                          value={edit.percentual}
                          onChange={e => handleChangePercentual(rm.id, e.target.value)}
                          placeholder={`≤ ${rm.percentualComissao}`}
                          sx={{ width: 120 }}
                          slotProps={{
                            input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                            htmlInput: { step: '0.01', min: '0', max: String(rm.percentualComissao) }
                          }}
                        />
                      )}
                    </TableCell>
                    {/* Grade de Parcelas (Botão para ajuste fino) */}
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon sx={{ fontSize: 13 }} />}
                        onClick={() => handleAbrirModalGrade(rm)}
                        sx={{
                          fontSize: '0.72rem',
                          textTransform: 'none',
                          borderRadius: 2,
                          py: 0.4,
                          px: 1.2
                        }}
                      >
                        Ajustar Parcelas
                      </Button>
                    </TableCell>
                    {/* Diferencial */}
                    <TableCell align="center">
                      {isAdesao ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                          {getDiferencaAdesao(rm) !== null && (
                            <Chip
                              label={`Dif. Adesão: +${getDiferencaAdesao(rm)!.toFixed(2).replace('.', ',')}%`}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                borderRadius: 1.5,
                                bgcolor: getDiferencaAdesao(rm)! > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
                                color: getDiferencaAdesao(rm)! > 0 ? '#f59e0b' : '#94a3b8',
                              }}
                            />
                          )}
                          {getDiferencaMensal(rm) !== null && (
                            <Chip
                              label={`Dif. Mensal: +${getDiferencaMensal(rm)!.toFixed(2).replace('.', ',')}%`}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                borderRadius: 1.5,
                                bgcolor: getDiferencaMensal(rm)! > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                                color: getDiferencaMensal(rm)! > 0 ? '#10b981' : '#94a3b8',
                              }}
                            />
                          )}
                        </Box>
                      ) : (
                        getDiferencaLinear(rm) !== null ? (
                          <Chip
                            label={`${getDiferencaLinear(rm)! >= 0 ? '+' : ''}${getDiferencaLinear(rm)!.toFixed(2).replace('.', ',')}%`}
                            size="small"
                            sx={{
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              borderRadius: 2,
                              bgcolor: getDiferencaLinear(rm)! > 0
                                ? 'rgba(16,185,129,0.15)'
                                : getDiferencaLinear(rm)! === 0
                                  ? 'rgba(100,116,139,0.15)'
                                  : 'rgba(239,68,68,0.15)',
                              color: getDiferencaLinear(rm)! > 0
                                ? '#10b981'
                                : getDiferencaLinear(rm)! === 0
                                  ? '#94a3b8'
                                  : '#ef4444',
                            }}
                          />
                        ) : (
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                        )
                      )}
                    </TableCell>
                    {/* % Contempl. Mãe */}
                    <TableCell align="center">
                      {rm.percentualComissaoContemplacao != null ? (
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                          {rm.percentualComissaoContemplacao.toFixed(2).replace('.', ',')}%
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                      )}
                    </TableCell>
                    {/* % Contempl. Filha */}
                    <TableCell align="center" sx={{ width: 130 }}>
                      {rm.percentualComissaoContemplacao != null ? (
                        <TextField
                          size="small"
                          type="number"
                          value={edit.percentualContempl}
                          onChange={e => handleChangeContempl(rm.id, e.target.value)}
                          placeholder={`≤ ${rm.percentualComissaoContemplacao}`}
                          sx={{ width: 110 }}
                          slotProps={{
                            input: {
                              endAdornment: <InputAdornment position="end">%</InputAdornment>,
                            },
                            htmlInput: { step: '0.01', min: '0', max: String(rm.percentualComissaoContemplacao) }
                          }}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                      )}
                    </TableCell>
                    {/* Dif. Contempl. */}
                    <TableCell align="center">
                      {diferencaContempl !== null ? (
                        <Chip
                          label={`${diferencaContempl >= 0 ? '+' : ''}${diferencaContempl.toFixed(2).replace('.', ',')}%`}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            borderRadius: 2,
                            bgcolor: diferencaContempl > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
                            color: diferencaContempl > 0 ? '#f59e0b' : '#94a3b8',
                          }}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Modal de Ajuste Fino de Grade de Parcelas da Filha */}
      {modalGradeRegra && (
        <Dialog
          open={!!modalGradeRegra}
          onClose={() => setModalGradeRegra(null)}
          maxWidth="sm"
          fullWidth
          slotProps={{
            paper: {
              sx: {
                borderRadius: 4,
                bgcolor: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${borderColor}`,
                p: 1
              }
            }
          }}
        >
          <DialogTitle sx={{
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            Ajustar Parcelas da Filha ({modalGradeRegra.tabela} - {modalGradeRegra.qtdParcelas}x)
            <IconButton onClick={() => setModalGradeRegra(null)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Edite o percentual de cada parcela para a empresa filha. O percentual da filha não pode superar o da mãe em cada parcela.
              </Typography>
            </Box>

            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
              gap: 1.5,
              maxHeight: 300,
              overflowY: 'auto',
              p: 0.5
            }}>
              {Array.from({ length: modalGradeRegra.qtdParcelas }).map((_, i) => {
                const gradeMae = modalGradeRegra.percentuaisParcelas && modalGradeRegra.percentuaisParcelas.length === modalGradeRegra.qtdParcelas
                  ? modalGradeRegra.percentuaisParcelas
                  : gerarGradePadrao(modalGradeRegra.qtdParcelas, modalGradeRegra.tipoTabela, modalGradeRegra.percentualComissao, modalGradeRegra.percentualAdesao || 0, modalGradeRegra.percentualMensal || 0);

                const maxMae = gradeMae[i] !== undefined ? gradeMae[i] : 100;
                const valFilha = gradeFilhaTemp[i] !== undefined ? gradeFilhaTemp[i] : 0;
                const difParcela = Number(Math.max(0, maxMae - valFilha).toFixed(2));

                return (
                  <Box key={i} sx={{
                    p: 1.5,
                    border: `1px solid ${valFilha > maxMae ? theme.palette.error.main : borderColor}`,
                    borderRadius: 2,
                    bgcolor: isDark ? 'rgba(15,23,42,0.4)' : '#f8fafc'
                  }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                      Parcela {i + 1} (Mãe: {maxMae}%)
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={valFilha}
                      onChange={(e) => {
                        const num = e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value));
                        const novo = [...gradeFilhaTemp];
                        novo[i] = num;
                        setGradeFilhaTemp(novo);
                      }}
                      error={valFilha > maxMae}
                      slotProps={{
                        input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                        htmlInput: { step: '0.01', min: '0', max: String(maxMae) }
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 700, mt: 0.5, display: 'block' }}>
                      Dif. Repasse: +{difParcela.toFixed(2).replace('.', ',')}%
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Total da Filha: {Number(gradeFilhaTemp.reduce((a, b) => a + (Number(b) || 0), 0)).toFixed(2).replace('.', ',')}%
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setModalGradeRegra(null)} sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
            <Button variant="contained" onClick={handleSalvarModalGrade} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Aplicar Grade
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {regrasDaMae.length > 0 && (
        <Tooltip title="Preencha os percentuais para cada regra e clique em Salvar Tabela">
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSalvar}
              disabled={saving}
              sx={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
                minWidth: 160,
              }}
            >
              {saving ? 'Salvando...' : 'Salvar Tabela'}
            </Button>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
};
