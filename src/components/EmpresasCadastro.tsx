import React, { useState, useEffect } from "react";
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Button, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Chip, useTheme, Alert, Switch, FormControlLabel,
  Tooltip, CircularProgress, FormControl, InputLabel, Select, MenuItem
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import BusinessIcon from "@mui/icons-material/Business";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import type { Empresa } from "../types";
import { obterEmpresasSupabase, salvarEmpresaSupabase, excluirEmpresaSupabase } from "../utils/supabase";

export const EmpresasCadastro: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [empresaMaeId, setEmpresaMaeId] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const carregarEmpresas = async () => {
    setLoading(true);
    setDbError(null);
    try {
      const data = await obterEmpresasSupabase();
      setEmpresas(data);
    } catch {
      setDbError("Nao foi possivel carregar as empresas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarEmpresas(); }, []);

  const resetForm = () => { setNome(""); setAtivo(true); setEmpresaMaeId(""); setErrors({}); setEditId(null); };
  const handleOpenNova = () => { resetForm(); setOpenDialog(true); };
  const handleOpenEditar = (e: Empresa) => {
    setEditId(e.id);
    setNome(e.nome);
    setAtivo(e.ativo);
    setEmpresaMaeId(e.empresaMaeId || "");
    setErrors({});
    setOpenDialog(true);
  };
  const handleClose = () => { setOpenDialog(false); resetForm(); };

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (!nome.trim() || nome.trim().length < 2) e.nome = "Nome deve ter pelo menos 2 caracteres.";
    // Uma empresa não pode ser mãe de si mesma
    if (empresaMaeId && editId && empresaMaeId === editId) {
      e.empresaMaeId = "Uma empresa não pode ser mãe de si mesma.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setLoading(true);
    try {
      const id = editId || `emp_${nome.trim().toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;
      await salvarEmpresaSupabase({
        id,
        nome: nome.trim(),
        ativo,
        empresaMaeId: empresaMaeId || undefined,
      });
      await carregarEmpresas();
      handleClose();
    } catch {
      setErrors({ geral: "Erro ao salvar empresa." });
    } finally {
      setLoading(false);
    }
  };

  const handleExcluir = async (id: string) => {
    setLoading(true);
    try {
      await excluirEmpresaSupabase(id);
      setEmpresas(prev => prev.filter(e => e.id !== id));
    } catch {
      setDbError("Erro ao excluir empresa.");
    } finally {
      setLoading(false);
      setConfirmDeleteId(null);
    }
  };

  const card = { p: 3, borderRadius: 3, border: `1px solid ${isDark ? "#1f2937" : "#e5e7eb"}`, background: isDark ? "#111827" : "#ffffff" };
  const hCell = { fontWeight: 700, fontFamily: "Outfit, sans-serif", fontSize: "0.78rem", color: "text.secondary", textTransform: "uppercase" as const, letterSpacing: "0.5px", borderBottom: `2px solid ${isDark ? "#1f2937" : "#e5e7eb"}`, py: 1.5 };

  const getNomeMae = (maeId: string | undefined) =>
    maeId ? empresas.find(e => e.id === maeId)?.nome || maeId : null;

  // Empresas disponíveis como mãe (excluindo a que está sendo editada e as que já têm uma mãe — evitar múltiplos níveis)
  const empresasDisponivelMae = empresas.filter(e => e.id !== editId && !e.empresaMaeId);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: "Outfit, sans-serif" }}>Empresas Cadastradas</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.3 }}>
            Gerencie empresas e vincule filhas à empresa mãe para controle de diferenciais de comissão.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNova}
          sx={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", borderRadius: 2, fontWeight: 600, fontFamily: "Outfit, sans-serif", textTransform: "none", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" }}>
          Nova Empresa
        </Button>
      </Box>

      {dbError && <Alert severity="error" onClose={() => setDbError(null)}>{dbError}</Alert>}

      <Box sx={card}>
        <TableContainer component={Paper} elevation={0} sx={{ bgcolor: "transparent" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["Empresa", "Tipo", "ID", "Empresa Mãe", "Status", "Ações"].map(h => <TableCell key={h} sx={hCell}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && empresas.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
              ) : empresas.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>Nenhuma empresa cadastrada.</TableCell></TableRow>
              ) : empresas.map(emp => {
                const nomeMae = getNomeMae(emp.empresaMaeId);
                const isFilha = !!emp.empresaMaeId;
                return (
                  <TableRow key={emp.id} hover sx={{ "&:last-child td": { border: 0 } }}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {isFilha
                          ? <AccountTreeIcon sx={{ fontSize: 16, color: "#f59e0b" }} />
                          : <BusinessIcon sx={{ fontSize: 16, color: "primary.main" }} />
                        }
                        {emp.nome}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={isFilha ? "Filha" : "Mãe / Standalone"}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.7rem",
                          borderRadius: 1.5,
                          bgcolor: isFilha ? "rgba(245,158,11,0.12)" : "rgba(99,102,241,0.12)",
                          color: isFilha ? "#f59e0b" : "#818cf8",
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: "monospace", bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", px: 1, py: 0.3, borderRadius: 1 }}>
                        {emp.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {nomeMae
                        ? <Chip label={nomeMae} size="small" variant="outlined" sx={{ fontSize: "0.7rem", borderRadius: 1.5 }} />
                        : <Typography variant="caption" sx={{ color: "text.disabled" }}>—</Typography>
                      }
                    </TableCell>
                    <TableCell>
                      <Chip label={emp.ativo ? "Ativa" : "Inativa"} size="small" color={emp.ativo ? "success" : "default"} sx={{ fontWeight: 700, fontSize: "0.7rem", borderRadius: 1.5 }} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Tooltip title="Editar"><IconButton size="small" onClick={() => handleOpenEditar(emp)} sx={{ color: "primary.main" }}><EditIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                        <Tooltip title="Excluir"><IconButton size="small" onClick={() => setConfirmDeleteId(emp.id)} sx={{ color: "error.main", "&:hover": { bgcolor: "rgba(239,68,68,0.08)" } }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Dialog — Nova / Editar Empresa */}
      <Dialog open={openDialog} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: "Outfit, sans-serif", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {editId ? "Editar Empresa" : "Nova Empresa"}
          <IconButton size="small" onClick={handleClose}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
            {errors.geral && <Alert severity="error">{errors.geral}</Alert>}

            <TextField
              label="Nome da Empresa"
              value={nome}
              onChange={e => setNome(e.target.value)}
              error={!!errors.nome}
              helperText={errors.nome}
              fullWidth size="small" autoFocus
              slotProps={{ inputLabel: { shrink: true } }}
            />

            {/* Empresa Mãe */}
            <FormControl fullWidth size="small" error={!!errors.empresaMaeId}>
              <InputLabel id="mae-label" shrink>Empresa Mãe (opcional)</InputLabel>
              <Select
                labelId="mae-label"
                value={empresaMaeId}
                label="Empresa Mãe (opcional)"
                onChange={e => setEmpresaMaeId(e.target.value)}
                displayEmpty
              >
                <MenuItem value="">
                  <em>Nenhuma — empresa standalone ou mãe</em>
                </MenuItem>
                {empresasDisponivelMae.map(e => (
                  <MenuItem key={e.id} value={e.id}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <BusinessIcon sx={{ fontSize: 15, color: "primary.main" }} />
                      {e.nome}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              {errors.empresaMaeId && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{errors.empresaMaeId}</Typography>
              )}
            </FormControl>

            {empresaMaeId && (
              <Alert severity="info" icon={<AccountTreeIcon />} sx={{ borderRadius: 2 }}>
                Esta empresa será <strong>filha</strong> de <strong>{empresas.find(e => e.id === empresaMaeId)?.nome}</strong>.
                As comissões desta empresa seguirão os percentuais cadastrados na tabela da filha, e a diferença será repassada à empresa mãe automaticamente.
              </Alert>
            )}

            <FormControlLabel
              control={<Switch checked={ativo} onChange={e => setAtivo(e.target.checked)} color="success" />}
              label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Empresa Ativa</Typography>}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleClose} variant="outlined" sx={{ textTransform: "none", borderRadius: 2 }}>Cancelar</Button>
          <Button onClick={handleSalvar} variant="contained" disabled={loading}
            sx={{ textTransform: "none", borderRadius: 2, fontWeight: 700, background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}>
            {loading ? <CircularProgress size={18} /> : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog — Confirmar Exclusão */}
      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} maxWidth="xs">
        <DialogTitle sx={{ fontFamily: "Outfit, sans-serif", fontWeight: 700 }}>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Tem certeza que deseja excluir esta empresa? Usuários, vendas e regras vinculados a ela podem perder o vínculo.
            Se ela for empresa mãe, as filhas vinculadas ficarão sem mãe.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setConfirmDeleteId(null)} variant="outlined" sx={{ textTransform: "none", borderRadius: 2 }}>Cancelar</Button>
          <Button onClick={() => confirmDeleteId && handleExcluir(confirmDeleteId)} variant="contained" color="error" sx={{ textTransform: "none", borderRadius: 2, fontWeight: 700 }}>Excluir</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
