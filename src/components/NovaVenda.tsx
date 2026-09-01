import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Alert
} from '@mui/material';
import Grid from '@mui/material/Grid';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PercentIcon from '@mui/icons-material/Percent';

import { gerarProjecaoVazia, getStatusInicial, calcularTotaisLinha } from '../data/initialData';

import type { LancamentoVenda, Vendedor, RegraMaster, TipoTabela, SegmentoType, ProjecaoMensalType, Administradora } from '../types';

const extrairValorCru = (valorFormatado: string): number => {
  const apenasNumeros = valorFormatado.replace(/\D/g, '');
  return Number(apenasNumeros) / 100;
};

const formatarMascaraDinheiro = (valor: string): string => {
  let v = valor.replace(/\D/g, '');
  if (v.length === 0) return '';
  if (v.length <= 2) {
    v = ('00' + v).slice(-3);
  }
  const parteInteira = v.substring(0, v.length - 2).replace(/^0+/, '') || '0';
  const parteDecimal = v.substring(v.length - 2);
  const inteiraFormatada = parteInteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${inteiraFormatada},${parteDecimal}`;
};

const calcularDataPrevisaoRecebimento = (dataVencimentoParcela: string, _ciclos?: Record<string, [number, number]>): string => {
  if (!dataVencimentoParcela) return '';
  const dt = new Date(dataVencimentoParcela + 'T00:00:00');
  if (isNaN(dt.getTime())) return '';
  const ultimoDia = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
  const ano = ultimoDia.getFullYear();
  const mes = String(ultimoDia.getMonth() + 1).padStart(2, '0');
  const dia = String(ultimoDia.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

export const BotaoNovaVendaWrapper = ({ theme, permissoes, onAdicionarVenda, vendedores, regras, ciclos, administradoras, mostrarSnackbar }: any) => {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      {permissoes.editarVendas && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpen(true)}
          sx={{
            borderRadius: 2.5,
            textTransform: 'none',
            fontWeight: 600,
            fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
          }}
        >
          Nova Venda
        </Button>
      )}
      <NovaVendaDialog
        open={open}
        onClose={() => setOpen(false)}
        onSave={(novaVenda) => {
          onAdicionarVenda(novaVenda);
          setOpen(false);
          mostrarSnackbar('✅ Venda lançada com sucesso!');
        }}
        vendedores={vendedores}
        regras={regras}
        ciclos={ciclos}
        administradoras={administradoras}
      />
    </>
  );
};


export interface NovaVendaDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (venda: LancamentoVenda) => void;
  vendedores: Vendedor[];
  regras: RegraMaster[];
  ciclos: Record<string, [number, number]>;
  administradoras?: Administradora[];
}

export const NovaVendaDialog: React.FC<NovaVendaDialogProps> = ({
  open,
  onClose,
  onSave,
  vendedores,
  regras,
  ciclos,
  administradoras = []
}) => {
  const theme = useTheme();
  const [cliente, setCliente] = useState('');
  const [pac, setPac] = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [administradoraIdInput, setAdministradoraIdInput] = useState('');
  const [administradoraNomeInput, setAdministradoraNomeInput] = useState('');
  const [segmento, setSegmento] = useState<SegmentoType | ''>('');
  const [tabela, setTabela] = useState('');
  const [qtdParcelas, setQtdParcelas] = useState<number | ''>('');
  const [percentualComissao, setPercentualComissao] = useState<number>(0);

  const [valorVendaExibicao, setValorVendaExibicao] = useState('');
  const [valorParcelaExibicao, setValorParcelaExibicao] = useState('');
  const [dataVendaInput, setDataVendaInput] = useState<string>('');
  const [dataVencimentoClienteInput, setDataVencimentoClienteInput] = useState<string>('');
  const [dataAssembleiaInput, setDataAssembleiaInput] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tabelasDisponiveis, setTabelasDisponiveis] = useState<string[]>([]);
  const [parcelasDisponiveis, setParcelasDisponiveis] = useState<number[]>([]);

  useEffect(() => {
    if (segmento) {
      const tabs = regras
        .filter((r) => r.segmento === segmento)
        .map((r) => r.tabela);
      setTabelasDisponiveis(Array.from(new Set(tabs)));
      setTabela('');
      setQtdParcelas('');
      setPercentualComissao(0);
    } else {
      setTabelasDisponiveis([]);
      setTabela('');
      setQtdParcelas('');
      setPercentualComissao(0);
    }
  }, [segmento, regras]);

  const [tipoTabelaInput, setTipoTabelaInput] = useState<TipoTabela>('Linear');
  const [percentualAdesaoInput, setPercentualAdesaoInput] = useState<number>(0);
  const [percentualMensalInput, setPercentualMensalInput] = useState<number>(0);
  const [percentuaisParcelasInput, setPercentuaisParcelasInput] = useState<number[] | undefined>(undefined);

  const opcoesAdministradoras = useMemo(() => {
    const lista = [...administradoras];
    if (administradoraIdInput && !lista.some(a => a.id === administradoraIdInput)) {
      lista.unshift({
        id: administradoraIdInput,
        nome: administradoraNomeInput || 'Âncora',
        ativo: true
      });
    }
    return lista;
  }, [administradoras, administradoraIdInput, administradoraNomeInput]);

  useEffect(() => {
    if (segmento && tabela) {
      const parsFiltrado = regras
        .filter((r) => r.segmento === segmento && r.tabela === tabela)
        .map((r) => r.qtdParcelas);
      setParcelasDisponiveis(Array.from(new Set(parsFiltrado)));
      setQtdParcelas('');
      setPercentualComissao(0);
      setTipoTabelaInput('Linear');
      setPercentualAdesaoInput(0);
      setPercentualMensalInput(0);
      setPercentuaisParcelasInput(undefined);
    } else {
      setParcelasDisponiveis([]);
      setQtdParcelas('');
      setPercentualComissao(0);
      setTipoTabelaInput('Linear');
      setPercentualAdesaoInput(0);
      setPercentualMensalInput(0);
      setPercentuaisParcelasInput(undefined);
    }
  }, [tabela, segmento, regras]);

  useEffect(() => {
    if (segmento && tabela && qtdParcelas !== '') {
      const regra = regras.find(
        (r) =>
          r.segmento === segmento &&
          r.tabela === tabela &&
          r.qtdParcelas === Number(qtdParcelas)
      );
      if (regra) {
        setPercentualComissao(regra.percentualComissao);
        setTipoTabelaInput(regra.tipoTabela || 'Linear');
        setPercentualAdesaoInput(regra.percentualAdesao || 0);
        setPercentualMensalInput(regra.percentualMensal || 0);
        setPercentuaisParcelasInput(regra.percentuaisParcelas);
        if (regra.administradoraId) {
          setAdministradoraIdInput(regra.administradoraId);
          setAdministradoraNomeInput(regra.administradoraNome || '');
        } else if (regra.administradoraNome) {
          setAdministradoraNomeInput(regra.administradoraNome);
          const adm = administradoras.find(a => a.nome.toLowerCase() === regra.administradoraNome?.toLowerCase());
          if (adm) setAdministradoraIdInput(adm.id);
        }
      } else {
        setPercentualComissao(0);
        setTipoTabelaInput('Linear');
        setPercentualAdesaoInput(0);
        setPercentualMensalInput(0);
        setPercentuaisParcelasInput(undefined);
      }
    } else {
      setPercentualComissao(0);
      setTipoTabelaInput('Linear');
      setPercentualAdesaoInput(0);
      setPercentualMensalInput(0);
      setPercentuaisParcelasInput(undefined);
    }
  }, [qtdParcelas, tabela, segmento, regras, administradoras]);

  const handleSalvarVenda = () => {
    const tempErrors: Record<string, string> = {};
    if (!cliente.trim()) tempErrors.cliente = 'Nome do cliente é obrigatório.';
    if (!pac.trim()) tempErrors.pac = 'PAC (Contrato) é obrigatório.';
    if (!vendedorId) tempErrors.vendedorId = 'Selecione o vendedor.';
    if (!segmento) tempErrors.segmento = 'Selecione o segmento.';
    if (!tabela) tempErrors.tabela = 'Selecione a tabela.';
    if (qtdParcelas === '') tempErrors.qtdParcelas = 'Selecione a quantidade de parcelas.';
    
    const valorVendaV = extrairValorCru(valorVendaExibicao);
    const valorParcelaV = extrairValorCru(valorParcelaExibicao);
    
    if (valorVendaV <= 0) {
      tempErrors.valorVendaInput = 'O valor do crédito é obrigatório e deve ser maior que zero.';
    }
    if (valorParcelaV <= 0) {
      tempErrors.valorParcelaInput = 'O valor da parcela é obrigatório e deve ser maior que zero.';
    }
    if (!dataVendaInput) {
      tempErrors.dataVendaInput = 'A data da venda é obrigatória.';
    }
    if (!dataVencimentoClienteInput) {
      tempErrors.dataVencimentoClienteInput = 'Vencimento do cliente é obrigatório.';
    }
    if (!dataAssembleiaInput) {
      tempErrors.dataAssembleiaInput = 'A data da 1ª Assembleia é obrigatória.';
    }

    setErrors(tempErrors);

    if (Object.keys(tempErrors).length > 0) return;

    const proj: ProjecaoMensalType = {};
    const parcelas = Number(qtdParcelas);
    const isAdesao = tipoTabelaInput === 'Adesão';
    const percentualMensalLinear = percentualComissao / parcelas;
    const parcelasRestantes = Math.max(1, parcelas - 1);
    const vendedorSelecionado = vendedores.find((v) => v.id === vendedorId);

    const projVaziaBase = gerarProjecaoVazia();
    Object.assign(proj, projVaziaBase);

    const mesInicioChave = dataVendaInput.substring(0, 7);

    for (let i = 0; i < parcelas; i++) {
      let dataVenc: string;
      if (i === 0) {
        dataVenc = dataVendaInput;
      } else {
        const dateAssembleiaBase = new Date(dataAssembleiaInput + 'T00:00:00');
        const dateVencClienteBase = new Date(dataVencimentoClienteInput + 'T00:00:00');
        const diaVenc = dateVencClienteBase.getDate();
        
        const dtAlvo = new Date(dateAssembleiaBase.getFullYear(), dateAssembleiaBase.getMonth() + (i - 1), 1);
        const ultimoDiaMes = new Date(dtAlvo.getFullYear(), dtAlvo.getMonth() + 1, 0).getDate();
        const diaFinal = Math.min(diaVenc, ultimoDiaMes);
        dtAlvo.setDate(diaFinal);
        
        const anoCalc = dtAlvo.getFullYear();
        const mesCalc = String(dtAlvo.getMonth() + 1).padStart(2, '0');
        const diaCalc = String(dtAlvo.getDate()).padStart(2, '0');
        dataVenc = `${anoCalc}-${mesCalc}-${diaCalc}`;
      }

      const mesChave = dataVenc.substring(0, 7);
      const status = i === 0 ? 'Paga' : getStatusInicial(dataVenc);
      const dataPrevisaoRecebimento = calcularDataPrevisaoRecebimento(dataVenc, ciclos);

      let comissaoCalculada = 0;
      if (percentuaisParcelasInput && percentuaisParcelasInput.length > 0) {
        const pParcela = percentuaisParcelasInput[i] !== undefined ? percentuaisParcelasInput[i] : 0;
        comissaoCalculada = Number((valorVendaV * (pParcela / 100)).toFixed(2));
      } else if (isAdesao) {
        if (i === 0) {
          // 1ª Parcela recebe comissão de Adesão
          comissaoCalculada = Number((valorVendaV * (percentualAdesaoInput / 100)).toFixed(2));
        } else {
          // Parcelas 2..N recebem percentual mensal fracionado
          comissaoCalculada = Number((valorVendaV * ((percentualMensalInput / parcelasRestantes) / 100)).toFixed(2));
        }
      } else {
        comissaoCalculada = Number((valorVendaV * (percentualMensalLinear / 100)).toFixed(2));
      }

      // ✅ Proteção contra colisão de chave de mês (YYYY-MM):
      // Na tabela Adesão, a 1ª parcela usa a data da venda e as demais usam a data da assembleia.
      // Se ambas caem no mesmo mês, a 2ª+ parcela NÃO deve sobrescrever a 1ª.
      // Em vez disso, acumula a comissão na entrada existente, preservando status/data da 1ª parcela.
      const entradaExistente = proj[mesChave];
      if (entradaExistente && entradaExistente.valorVenda > 0 && i > 0) {
        proj[mesChave] = {
          ...entradaExistente,
          comissaoGerada: Number((entradaExistente.comissaoGerada + comissaoCalculada).toFixed(2)),
        };
      } else {
        proj[mesChave] = {
          valorVenda: valorVendaV,
          valorParcela: valorParcelaV,
          comissaoGerada: comissaoCalculada,
          status,
          dataVencimento: dataVenc,
          dataPrevisaoRecebimento
        };
      }
    }

    const { totalVendas, totalComissoes, projecaoAtualizada } = calcularTotaisLinha(
      proj,
      percentualComissao,
      parcelas,
      tipoTabelaInput,
      percentualAdesaoInput,
      percentualMensalInput,
      percentuaisParcelasInput
    );

    const novaVenda: LancamentoVenda = {
      id: `v_${Date.now()}`,
      cliente: cliente.trim(),
      administradoraId: administradoraIdInput || undefined,
      administradoraNome: administradoraNomeInput || undefined,
      pac: pac.trim(),
      vendedorId,
      vendedorNome: vendedorSelecionado?.nome || '',
      dataVenda: dataVendaInput,
      dataVencimentoCliente: dataVencimentoClienteInput,
      dataAssembleia: dataAssembleiaInput,
      mesInicio: mesInicioChave,
      segmento: segmento as SegmentoType,
      tabela,
      qtdParcelas: parcelas,
      tipoTabela: tipoTabelaInput,
      percentualComissao,
      percentualAdesao: isAdesao ? percentualAdesaoInput : undefined,
      percentualMensal: isAdesao ? percentualMensalInput : undefined,
      percentuaisParcelas: percentuaisParcelasInput,
      valorVenda: valorVendaV,
      valorParcela: valorParcelaV,
      projecaoMensal: projecaoAtualizada,
      totalVendas,
      totalComissoes,
      statusCliente: 'Ativo',
      empresaId: 'emp_vertex'
    };

    onSave(novaVenda);
    
    setCliente('');
    setPac('');
    setVendedorId('');
    setAdministradoraIdInput('');
    setAdministradoraNomeInput('');
    setSegmento('');
    setTabela('');
    setQtdParcelas('');
    setTipoTabelaInput('Linear');
    setPercentualComissao(0);
    setPercentualAdesaoInput(0);
    setPercentualMensalInput(0);
    setValorVendaExibicao('');
    setValorParcelaExibicao('');
    setDataVendaInput('');
    setDataVencimentoClienteInput('');
    setDataAssembleiaInput('');
    setErrors({});
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
            backgroundImage: 'none',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
          }
        }
      }}
    >
      <DialogTitle
        sx={{
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 700,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a'
        }}
      >
        Nova Venda
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Cliente / Projeto"
              placeholder="Ex: Condomínio Jardim Real"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              error={!!errors.cliente}
              helperText={errors.cliente}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth error={!!errors.vendedorId}>
              <InputLabel id="vend-venda-label">Vendedor Responsável</InputLabel>
              <Select
                labelId="vend-venda-label"
                value={vendedorId}
                label="Vendedor Responsável"
                onChange={(e) => setVendedorId(e.target.value)}
              >
                {vendedores.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.nome}
                  </MenuItem>
                ))}
              </Select>
              {errors.vendedorId && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.vendedorId}
                </Typography>
              )}
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Valor do Crédito"
              type="text"
              placeholder="Ex: R$ 1.200.000,00"
              value={valorVendaExibicao}
              onChange={(e) => {
                const formatado = formatarMascaraDinheiro(e.target.value);
                setValorVendaExibicao(formatado);
              }}
              error={!!errors.valorVendaInput}
              helperText={errors.valorVendaInput}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Valor da Parcela"
              type="text"
              placeholder="Ex: R$ 10.000,00"
              value={valorParcelaExibicao}
              onChange={(e) => {
                const formatado = formatarMascaraDinheiro(e.target.value);
                setValorParcelaExibicao(formatado);
              }}
              error={!!errors.valorParcelaInput}
              helperText={errors.valorParcelaInput}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              fullWidth
              label="Data da Venda"
              type="date"
              value={dataVendaInput}
              onChange={(e) => setDataVendaInput(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!errors.dataVendaInput}
              helperText={errors.dataVendaInput}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              fullWidth
              label="Vencimento do Cliente"
              type="date"
              value={dataVencimentoClienteInput}
              onChange={(e) => setDataVencimentoClienteInput(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!errors.dataVencimentoClienteInput}
              helperText={errors.dataVencimentoClienteInput || 'Data da 2ª parcela'}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              fullWidth
              label="Data da 1ª Assembleia"
              type="date"
              value={dataAssembleiaInput}
              onChange={(e) => setDataAssembleiaInput(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!errors.dataAssembleiaInput}
              helperText={errors.dataAssembleiaInput}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth error={!!errors.segmento}>
              <InputLabel id="seg-venda-label">Segmento</InputLabel>
              <Select
                labelId="seg-venda-label"
                value={segmento}
                label="Segmento"
                onChange={(e) => setSegmento(e.target.value as SegmentoType)}
              >
                <MenuItem value="Imóveis">Imóveis</MenuItem>
                <MenuItem value="Autos Leves">Autos Leves</MenuItem>
                <MenuItem value="Pesados">Pesados</MenuItem>
              </Select>
              {errors.segmento && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.segmento}
                </Typography>
              )}
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth>
              <InputLabel id="adm-venda-label">Administradora</InputLabel>
              <Select
                labelId="adm-venda-label"
                value={administradoraIdInput}
                label="Administradora"
                onChange={(e) => {
                  const id = e.target.value;
                  setAdministradoraIdInput(id);
                  const adm = administradoras.find(a => a.id === id);
                  setAdministradoraNomeInput(adm?.nome || '');
                }}
              >
                <MenuItem value=""><em>Nenhuma / Não especificada</em></MenuItem>
                {opcoesAdministradoras.filter(a => a.ativo || a.id === administradoraIdInput).map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <AccountBalanceIcon sx={{ fontSize: 15, color: '#818cf8' }} />
                      {a.nome}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              label="PAC (Contrato)"
              placeholder="Ex: PAC-987654"
              value={pac}
              onChange={(e) => setPac(e.target.value)}
              error={!!errors.pac}
              helperText={errors.pac}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth error={!!errors.tabela} disabled={!segmento}>
              <InputLabel id="tab-venda-label">Tabela</InputLabel>
              <Select
                labelId="tab-venda-label"
                value={tabela}
                label="Tabela"
                onChange={(e) => setTabela(e.target.value)}
              >
                {tabelasDisponiveis.map((tab) => (
                  <MenuItem key={tab} value={tab}>
                    {tab}
                  </MenuItem>
                ))}
              </Select>
              {errors.tabela && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.tabela}
                </Typography>
              )}
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth error={!!errors.qtdParcelas} disabled={!tabela}>
              <InputLabel id="parc-venda-label">Prazo (Parcelas)</InputLabel>
              <Select
                labelId="parc-venda-label"
                value={qtdParcelas}
                label="Prazo (Parcelas)"
                onChange={(e) => setQtdParcelas(Number(e.target.value))}
              >
                {parcelasDisponiveis.map((parc) => (
                  <MenuItem key={parc} value={parc}>
                    {parc}x
                  </MenuItem>
                ))}
              </Select>
              {errors.qtdParcelas && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.qtdParcelas}
                </Typography>
              )}
            </FormControl>
          </Grid>

          {/* Informações da comissão buscada */}
          {segmento && tabela && qtdParcelas !== '' && (
            <Grid size={{ xs: 12 }}>
              <Alert
                severity={percentualComissao > 0 ? 'success' : 'warning'}
                icon={<PercentIcon />}
                sx={{ borderRadius: 3 }}
              >
                {percentualComissao > 0 ? (
                  tipoTabelaInput === 'Adesão' ? (
                    <span>
                      Modalidade <strong>Adesão</strong>: <strong>{Number(percentualAdesaoInput).toFixed(2).replace('.', ',')}%</strong> na 1ª Parcela (Adesão) + <strong>{Number(percentualMensalInput).toFixed(2).replace('.', ',')}%</strong> fracionado em {Math.max(1, Number(qtdParcelas) - 1)}x. (Total: {percentualComissao.toFixed(2).replace('.', ',')}%)
                    </span>
                  ) : (
                    <span>
                      Modalidade <strong>Linear</strong>: Comissão automática de <strong>{percentualComissao.toFixed(2).replace('.', ',')}%</strong> distribuída em {qtdParcelas} parcelas.
                    </span>
                  )
                ) : (
                  <span>Não foi localizada nenhuma comissão para essa combinação no BD Master.</span>
                )}
              </Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b'
          }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSalvarVenda}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)'
          }}
        >
          Lançar Venda
        </Button>
      </DialogActions>
    </Dialog>
  );
};

