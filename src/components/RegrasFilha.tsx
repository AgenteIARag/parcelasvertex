import React, { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import HomeIcon from '@mui/icons-material/Home';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { Empresa, RegraMaster, RegraFilha, SegmentoType } from '../types';
import { obterRegrasFilhaSupabase, salvarRegraFilhaSupabase } from '../utils/supabase';

interface RegrasFilhaProps {
  empresas: Empresa[];
  regrasMaster: RegraMaster[]; // Regras da empresa mãe
}

/** Mapa local de edições (regraMasterId -> percentualComissao editado) */
type EditMap = Record<string, { percentual: number | ''; percentualContempl: number | '' }>;

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

export const RegrasFilha: React.FC<RegrasFilhaProps> = ({ empresas, regrasMaster }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Empresas filhas disponíveis
  const empresasFilhas = empresas.filter(e => !!e.empresaMaeId && e.ativo);

  const [empresaFilhaSelecionada, setEmpresaFilhaSelecionada] = useState<string>(
    empresasFilhas[0]?.id || ''
  );
  const [regrasFilha, setRegrasFilha] = useState<RegraFilha[]>([]);
  const [editMap, setEditMap] = useState<EditMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Empresa mãe da filha selecionada
  const empresaFilhaObj = empresas.find(e => e.id === empresaFilhaSelecionada);
  const empresaMaeId = empresaFilhaObj?.empresaMaeId;
  const empresaMaeObj = empresas.find(e => e.id === empresaMaeId);

  // Regras da empresa mãe (filtradas)
  const regrasDaMae = regrasMaster.filter(r =>
    !r.empresaId || r.empresaId === empresaMaeId
  );

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
        mapa[rm.id] = {
          percentual: rFilha ? rFilha.percentualComissao : '',
          percentualContempl: rFilha?.percentualComissaoContemplacao ?? '',
        };
      });
      setEditMap(mapa);
    } catch {
      setErrorMsg('Erro ao carregar regras da empresa filha.');
    } finally {
      setLoading(false);
    }
  }, [empresaFilhaSelecionada]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (empresaFilhaSelecionada) carregarRegrasFilha();
  }, [empresaFilhaSelecionada, carregarRegrasFilha]);

  const handleChangePercentual = (regraMasterId: string, valor: string) => {
    const num = valor === '' ? '' : Math.max(0, parseFloat(valor));
    setEditMap(prev => ({
      ...prev,
      [regraMasterId]: { ...prev[regraMasterId], percentual: num }
    }));
  };

  const handleChangeContempl = (regraMasterId: string, valor: string) => {
    const num = valor === '' ? '' : Math.max(0, parseFloat(valor));
    setEditMap(prev => ({
      ...prev,
      [regraMasterId]: { ...prev[regraMasterId], percentualContempl: num }
    }));
  };

  const handleSalvar = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const promises: Promise<void>[] = [];

      for (const rm of regrasDaMae) {
        const edit = editMap[rm.id];
        if (!edit || edit.percentual === '') continue; // Pular se não preenchido

        const percentual = Number(edit.percentual);
        if (percentual > rm.percentualComissao) {
          setErrorMsg(`"${rm.tabela} / ${rm.qtdParcelas}x": o % da filha (${percentual}%) não pode ser maior que o % da mãe (${rm.percentualComissao}%).`);
          setSaving(false);
          return;
        }

        // Verificar se já existe uma regra filha para esta combinação
        const existente = regrasFilha.find(rf => rf.regraMasterId === rm.id);
        const regra: RegraFilha = {
          id: existente?.id || `rf_${empresaFilhaSelecionada}_${rm.id}_${Date.now()}`,
          empresaFilhaId: empresaFilhaSelecionada,
          regraMasterId: rm.id,
          percentualComissao: percentual,
          percentualComissaoContemplacao: edit.percentualContempl !== '' ? Number(edit.percentualContempl) : undefined,
        };
        promises.push(salvarRegraFilhaSupabase(regra));
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

  const getDiferenca = (rm: RegraMaster): number | null => {
    const edit = editMap[rm.id];
    if (!edit || edit.percentual === '') return null;
    return rm.percentualComissao - Number(edit.percentual);
  };

  const getDiferencaContempl = (rm: RegraMaster): number | null => {
    const edit = editMap[rm.id];
    if (!rm.percentualComissaoContemplacao || !edit || edit.percentualContempl === '') return null;
    return rm.percentualComissaoContemplacao - Number(edit.percentualContempl);
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
            Configure os percentuais das empresas filhas. A diferença entre o % da mãe e o % da filha gera parcelas de repasse automáticas para a empresa mãe.
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
          <strong>Como funciona:</strong> quando uma venda é registrada pela empresa filha, o sistema gera automaticamente uma venda espelho para a empresa mãe com o <strong>percentual diferencial</strong> (% Mãe − % Filha). Assim, a mãe recebe o repasse pela diferença. As vendas espelho ficam visíveis apenas para o <em>super_master</em> e administradores da empresa mãe.
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
          <Table sx={{ minWidth: 750 }}>
            <TableHead sx={{ bgcolor: isDark ? '#0f172a' : '#f8fafc' }}>
              <TableRow>
                <TableCell sx={hCellSx}>Segmento</TableCell>
                <TableCell sx={hCellSx}>Tabela</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>Parcelas</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'right' }}>% Mãe (Base)</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>% Filha</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>Diferencial</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>% Contempl. Mãe</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>% Contempl. Filha</TableCell>
                <TableCell sx={{ ...hCellSx, textAlign: 'center' }}>Dif. Contempl.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {regrasDaMae.map(rm => {
                const diferenca = getDiferenca(rm);
                const diferencaContempl = getDiferencaContempl(rm);
                const chipColor = SEGMENTO_COLORS[rm.segmento] || { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' };
                const edit = editMap[rm.id] || { percentual: '', percentualContempl: '' };
                const percentualFilhaNum = edit.percentual !== '' ? Number(edit.percentual) : null;
                const isInvalido = percentualFilhaNum !== null && percentualFilhaNum > rm.percentualComissao;

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
                    {/* Parcelas */}
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{rm.qtdParcelas}x</Typography>
                    </TableCell>
                    {/* % Mãe */}
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                        {rm.percentualComissao.toFixed(2).replace('.', ',')}%
                      </Typography>
                    </TableCell>
                    {/* % Filha (editável) */}
                    <TableCell align="center" sx={{ width: 130 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={edit.percentual}
                        onChange={e => handleChangePercentual(rm.id, e.target.value)}
                        error={isInvalido}
                        helperText={isInvalido ? `Máx: ${rm.percentualComissao}%` : ''}
                        placeholder={`≤ ${rm.percentualComissao}`}
                        sx={{ width: 110 }}
                        slotProps={{
                          input: {
                            endAdornment: <InputAdornment position="end">%</InputAdornment>,
                          },
                          htmlInput: { step: '0.01', min: '0', max: String(rm.percentualComissao) }
                        }}
                      />
                    </TableCell>
                    {/* Diferencial */}
                    <TableCell align="center">
                      {diferenca !== null ? (
                        <Chip
                          label={`${diferenca >= 0 ? '+' : ''}${diferenca.toFixed(2).replace('.', ',')}%`}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            borderRadius: 2,
                            bgcolor: diferenca > 0
                              ? 'rgba(16,185,129,0.15)'
                              : diferenca === 0
                                ? 'rgba(100,116,139,0.15)'
                                : 'rgba(239,68,68,0.15)',
                            color: diferenca > 0
                              ? '#10b981'
                              : diferenca === 0
                                ? '#94a3b8'
                                : '#ef4444',
                          }}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
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
                    {/* % Contempl. Filha (editável) */}
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

      {regrasDaMae.length > 0 && (
        <Tooltip title="Preencha o % Filha para cada regra desejada e clique em Salvar Tabela">
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
