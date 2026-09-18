const fs = require('fs');
let code = fs.readFileSync('src/components/SimuladorVendas.tsx', 'utf8');

code = code.replace('TextField,', 'TextField,\n  Autocomplete,');

code = code.replace('vendedores: Vendedor[];', 'vendedores: Vendedor[];\n  clientes: import(\'../types\').Cliente[];');

code = code.replace('vendedores,\n    onAdicionarVenda', 'vendedores,\n    clientes,\n    onAdicionarVenda');

code = code.replace('administradoras={administradoras}\n          />', 'administradoras={administradoras}\n            clientes={clientes}\n          />');

code = code.replace('administradoras?: Administradora[];\n  }', 'administradoras?: Administradora[];\n    clientes?: import(\'../types\').Cliente[];\n  }');

code = code.replace('administradoras = []\n  }) => {', 'administradoras = [],\n    clientes = []\n  }) => {');

code = code.replace('const [cliente, setCliente] = useState(\'\');', 'const [clienteSelecionado, setClienteSelecionado] = useState<import(\'../types\').Cliente | null>(null);');

code = code.replace('setCliente(venda.cliente);', 'const cliEncontrado = clientes.find(c => c.id === venda.clienteId || (c.nome && venda.cliente && c.nome.toLowerCase().trim() === venda.cliente.toLowerCase().trim()));\n        setClienteSelecionado(cliEncontrado || null);');

code = code.replace('if (!cliente.trim()) tempErrors.cliente = \'Nome do cliente é obrigatório.\';', 'if (!clienteSelecionado) tempErrors.cliente = \'A seleção do cliente é obrigatória.\';');

code = code.replace('cliente: cliente.trim(),', 'cliente: clienteSelecionado!.nome,\n        clienteId: clienteSelecionado!.id,');

// replace the TextField with Autocomplete in EditarVendaDialog
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

code = code.replace(oldGrid, newGrid);

fs.writeFileSync('src/components/SimuladorVendas.tsx', code);
console.log('done');
