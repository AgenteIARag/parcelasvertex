const fs = require('fs');

// 1. Fix ClientesCadastro.tsx Grid item -> size
let clientesCadastro = fs.readFileSync('src/components/ClientesCadastro.tsx', 'utf8');
clientesCadastro = clientesCadastro.replace(/<Grid item xs={12}>/g, '<Grid size={{ xs: 12 }}>');
clientesCadastro = clientesCadastro.replace(/<Grid item xs={12} sm={6}>/g, '<Grid size={{ xs: 12, sm: 6 }}>');
clientesCadastro = clientesCadastro.replace(/display="block"/g, 'sx={{ display: \\'block\\' }}');
fs.writeFileSync('src/components/ClientesCadastro.tsx', clientesCadastro);

// 2. Fix RelatorioRecebimentos.tsx NovaVendaDialog missing clientes
let relRecebimentos = fs.readFileSync('src/components/RelatorioRecebimentos.tsx', 'utf8');
relRecebimentos = relRecebimentos.replace('administradoras={administradoras}\\n          />', 'administradoras={administradoras}\n          clientes={[]} />');
fs.writeFileSync('src/components/RelatorioRecebimentos.tsx', relRecebimentos);

// 3. Fix SimuladorVendas.tsx
let simuladorVendas = fs.readFileSync('src/components/SimuladorVendas.tsx', 'utf8');

// A. NovaVendaDialog missing clientes
simuladorVendas = simuladorVendas.replace('administradoras={administradoras}\\n          />', 'administradoras={administradoras}\n            clientes={clientes}\n          />');

// B. EditarVendaDialog args missing clientes = []
simuladorVendas = simuladorVendas.replace('administradoras = []\\n  }) => {', 'administradoras = [],\n  clientes = []\n}) => {');

// C. Autocomplete in SimuladorVendas.tsx uses "errors.cliente" inside the grid, let's fix the grid replacement that failed.
// Actually, earlier the script failed to replace the EditarVendaDialog grid. I'll replace it now.

const oldGrid = `<Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Cliente / Projeto"
              placeholder="Ex: Condomínio Jardim Real"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              error={!!errors.cliente}
              helperText={errors.cliente}
            />
          </Grid>`;

const newGrid = `<Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              options={clientes}
              getOptionLabel={(option) => option.nome}
              value={clienteSelecionado}
              onChange={(event, newValue) => {
                setClienteSelecionado(newValue);
                if (errors.cliente) {
                  setErrors((prev) => ({ ...prev, cliente: '' }));
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Cliente / Projeto"
                  placeholder="Selecione um cliente..."
                  error={!!errors.cliente}
                  helperText={errors.cliente || "Caso não encontre, cadastre em 'Clientes'"}
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value?.id}
              noOptionsText="Nenhum cliente encontrado"
            />
          </Grid>`;

simuladorVendas = simuladorVendas.replace(oldGrid, newGrid);

fs.writeFileSync('src/components/SimuladorVendas.tsx', simuladorVendas);
console.log('done');
