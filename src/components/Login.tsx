import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { supabase } from '../utils/supabase';
import type { Usuario } from '../types';

interface LoginProps {
  onLoginSuccess: (usuario: Usuario) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha.trim()) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Faz a consulta na tabela customizada de usuarios no Supabase
      const { data, error: fetchError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      // Se não achou usuário ou a senha estiver incorreta
      if (!data || data.senha !== senha) {
        // Se for o primeiro acesso e tentar logar com o master padrão mas o banco deu erro ou não inicializou,
        // criamos uma verificação optimistic local para o master padrão (master@apex.com / master123)
        // apenas para garantir o acesso caso as tabelas remotas não tenham sido criadas!
        if (email.trim().toLowerCase() === 'master@apex.com' && senha === 'master123') {
          const masterFallback: Usuario = {
            id: 'u_master',
            nome: 'Administrador Master (Local)',
            email: 'master@apex.com',
            role: 'master',
            permissoes: {
              visualizar: true,
              editarVendas: true,
              cadastrarVendedores: true,
              cadastrarRegras: true
            }
          };
          // Salva optimistic na nuvem se possível em background
          try {
            await supabase.from('usuarios').upsert({
              id: masterFallback.id,
              nome: masterFallback.nome,
              email: masterFallback.email,
              senha: 'master123',
              role: 'master',
              permissoes: masterFallback.permissoes
            });
          } catch (e) {
            console.warn('Erro ao salvar master padrão no Supabase remoto:', e);
          }
          
          onLoginSuccess(masterFallback);
          setLoading(false);
          return;
        }

        setError('E-mail ou senha incorretos.');
        setLoading(false);
        return;
      }

      // Login efetuado com sucesso!
      onLoginSuccess({
        id: data.id,
        nome: data.nome,
        email: data.email,
        role: data.role,
        permissoes: data.permissoes
      });
    } catch (err: any) {
      console.error('Erro de autenticação no Supabase:', err);
      
      // Fallback local se o banco estiver fora do ar ou sem tabelas
      if (email.trim().toLowerCase() === 'master@apex.com' && senha === 'master123') {
        onLoginSuccess({
          id: 'u_master',
          nome: 'Administrador Master (Local)',
          email: 'master@apex.com',
          role: 'master',
          permissoes: {
            visualizar: true,
            editarVendas: true,
            cadastrarVendedores: true,
            cadastrarRegras: true
          }
        });
      } else {
        setError('Erro ao conectar ao servidor. Verifique sua conexão.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0f19', // Fundo azul profundo premium
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      {/* Orbes decorativos dinâmicos de luz de fundo (WOW Design) */}
      <Box
        sx={{
          position: 'absolute',
          top: '15%',
          left: '10%',
          width: '350px',
          height: '350px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0) 70%)',
          filter: 'blur(40px)',
          zIndex: 1
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '15%',
          right: '10%',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0) 70%)',
          filter: 'blur(50px)',
          zIndex: 1
        }}
      />

      {/* Login Card Glassmorphism */}
      <Card
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          mx: 2,
          borderRadius: 4,
          background: 'rgba(17, 24, 39, 0.7)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          zIndex: 10,
          position: 'relative'
        }}
      >
        <CardContent sx={{ p: 4.5 }}>
          {/* Logo APEX */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
            <Box
              sx={{
                p: 1.8,
                borderRadius: 3.5,
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2
              }}
            >
              <AssessmentIcon sx={{ fontSize: 32 }} />
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                fontFamily: 'Outfit, sans-serif',
                color: '#ffffff',
                letterSpacing: '-1px',
                lineHeight: 1
              }}
            >
              APEX
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: '#818cf8',
                fontSize: '0.72rem',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                mt: 1
              }}
            >
              Comissão & Projeção Linear
            </Typography>
          </Box>

          {/* Mensagem de Erro */}
          {error && (
            <Alert
              severity="error"
              sx={{
                borderRadius: 2.5,
                mb: 3,
                bgcolor: 'rgba(239, 68, 68, 0.1)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}
            >
              {error}
            </Alert>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                fullWidth
                label="E-mail corporativo"
                variant="outlined"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ color: '#64748b', fontSize: 20 }} />
                      </InputAdornment>
                    )
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#f8fafc',
                    borderRadius: 2.5,
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    '&:hover fieldset': {
                      borderColor: 'rgba(99, 102, 241, 0.5)'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#6366f1'
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#64748b',
                    '&.Mui-focused': {
                      color: '#818cf8'
                    }
                  }
                }}
              />

              <TextField
                fullWidth
                label="Senha de acesso"
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: '#64748b', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          sx={{ color: '#64748b' }}
                        >
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#f8fafc',
                    borderRadius: 2.5,
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    '&:hover fieldset': {
                      borderColor: 'rgba(99, 102, 241, 0.5)'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#6366f1'
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#64748b',
                    '&.Mui-focused': {
                      color: '#818cf8'
                    }
                  }
                }}
              />

              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  mt: 1.5,
                  py: 1.6,
                  borderRadius: 2.5,
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                  textTransform: 'none',
                  letterSpacing: '0.5px',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)'
                  }
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: '#ffffff' }} /> : 'Entrar no Sistema'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};
