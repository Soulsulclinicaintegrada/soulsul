# Migração por Paridade - Módulo Pacientes

Data: 21/03/2026

## Objetivo
Migrar o módulo `Pacientes` sem perder nenhuma regra de negócio do sistema original.

Este documento define:
- o que existe hoje
- o que depende do módulo
- o que precisa existir no backend
- o que precisa existir no frontend
- o checklist mínimo antes de considerar a migração válida

## Escopo funcional do módulo no sistema original

O módulo `Pacientes` no sistema Streamlit cobre dois fluxos principais:

1. busca/listagem de pacientes
2. ficha completa do paciente

## Fluxo 1 - Tela de busca de pacientes

Arquivo base:
- [sistema_soul_sul_master_corrigido.py](C:/Users/jusgo/Documents/sistema_clinica/sistema_soul_sul_master_corrigido.py)

Entrada principal:
- `renderizar_pagina_pacientes()`

Funcionalidades existentes:
- busca por:
  - nome
  - apelido
  - prontuário
  - telefone
  - CPF
- pacientes recentes
- últimos acessados
- botão `Novo paciente`
- importação de paciente por PDF
- cards com:
  - nome
  - prontuário
  - nascimento
  - telefone / email
- botão `Abrir ficha`
- lista completa
- exportação da lista para Excel

Regras de negócio:
- ao abrir ficha de paciente, registra o paciente como recente
- o novo paciente usa cadastro completo, não rápido
- a importação por PDF preenche o cadastro

## Fluxo 2 - Ficha completa do paciente

Entrada principal:
- `renderizar_ficha_paciente()`

Funcionalidades existentes:
- busca do paciente
- seleção do paciente
- hero da ficha com:
  - nome
  - telefone
  - email
  - status
- ações:
  - WhatsApp
  - abrir financeiro

### Resumo lateral
- dados rápidos
- próximo agendamento
- alerta financeiro

### Aba Principal
- `Cadastro`
- `Financeiro`
- `Agendamentos`

#### Cadastro
Campos completos:
- nome
- apelido
- sexo
- prontuário
- CPF
- RG
- nascimento
- telefone
- email
- CEP
- endereço
- número
- bairro
- cidade
- estado
- estado civil
- observações
- menor de idade
- responsável
- CPF do responsável

Regras:
- CEP consulta ViaCEP e preenche endereço
- valida CPF
- valida responsável para menor
- salva alterações completas do paciente

#### Financeiro
- total do paciente
- pago
- em aberto
- lista visual de recebíveis
- status colorido
- vencimento
- forma de pagamento
- parcela
- data de pagamento
- observação

#### Agendamentos
- histórico de agendamentos do paciente
- data
- horário
- profissional
- status
- procedimento
- observação

### Aba Clínico
- Plano e ficha clínica
- Odontograma
- Anamnese
- Especialidades

Regras:
- plano e ficha clínica vêm dos contratos/procedimentos do paciente
- odontograma existe como espaço preservado
- anamnese usa observações clínicas iniciais
- especialidades derivam dos procedimentos dos contratos

### Aba Documentos
- `Documentos`
- `Exames`
- `Recibos`

#### Documentos
- lista arquivos locais do paciente
- botão de download

#### Exames
- upload manual
- leitura da pasta local do paciente
- preview de imagem quando aplicável
- download

#### Recibos
- lista recebíveis pagos do paciente

### Aba Comercial
- `Orçamentos`
- abre detalhes do orçamento/contrato do paciente

## Estrutura de dados do paciente

Tabela base:
- `pacientes`

Campos observados:
- `id`
- `nome`
- `apelido`
- `sexo`
- `prontuario`
- `cpf`
- `rg`
- `data_nascimento`
- `telefone`
- `email`
- `cep`
- `endereco`
- `numero`
- `bairro`
- `cidade`
- `estado`
- `estado_civil`
- `observacoes`
- `menor_idade`
- `responsavel`
- `cpf_responsavel`

## Dependências do módulo Pacientes

### Dependências de leitura
- `contratos`
- `procedimentos_contrato`
- `recebiveis`
- `agendamentos`
- arquivos locais de documentos
- arquivos locais de exames

### Dependências de navegação
- `Financeiro`
- `Editar Paciente`
- `Agenda`
- `Contratos`

### Dependências de automação
- importação por PDF
- CEP via ViaCEP
- geração de histórico recente

## Funções centrais no sistema original

Cadastro e atualização:
- `salvar_paciente_completo(dados)`
- `atualizar_paciente_completo(paciente_id, dados)`
- `validar_dados_paciente(...)`
- `renderizar_campos_paciente(prefixo, dados_iniciais)`

Busca e contexto:
- `carregar_pacientes()`
- `filtrar_pacientes_busca(...)`
- `registrar_paciente_recente(...)`
- `pacientes_recentes(...)`

Ficha do paciente:
- `carregar_contratos_paciente(paciente_id)`
- `carregar_recebiveis_paciente(paciente_row)`
- `carregar_agendamentos_paciente(paciente_row)`
- `proximo_agendamento_paciente(...)`
- `resumo_financeiro_paciente(...)`
- `listar_documentos_paciente(paciente_row)`
- `listar_exames_paciente(paciente_row)`
- `salvar_uploads_exames_paciente(...)`

## Checklist de paridade obrigatória

### Bloco A - Busca e listagem
- [ ] buscar por nome
- [ ] buscar por apelido
- [ ] buscar por prontuário
- [ ] buscar por telefone
- [ ] buscar por CPF
- [ ] abrir ficha do paciente
- [ ] exportar lista para Excel
- [ ] mostrar pacientes recentes

### Bloco B - Novo paciente
- [ ] formulário completo
- [ ] validação de CPF
- [ ] validação de menor / responsável
- [ ] integração com ViaCEP
- [ ] salvar no banco real
- [ ] abrir ficha após salvar

### Bloco C - Edição completa do paciente
- [ ] carregar dados atuais
- [ ] salvar alterações reais
- [ ] manter todos os campos

### Bloco D - Ficha do paciente
- [ ] hero com dados do paciente
- [ ] dados rápidos
- [ ] próximo agendamento
- [ ] alerta financeiro

### Bloco E - Aba Principal
- [ ] cadastro
- [ ] financeiro do paciente
- [ ] histórico de agendamentos

### Bloco F - Aba Clínico
- [ ] plano e ficha clínica
- [ ] odontograma
- [ ] anamnese
- [ ] especialidades

### Bloco G - Aba Documentos
- [ ] listar documentos
- [ ] baixar documentos
- [ ] upload de exames
- [ ] listar exames
- [ ] preview de imagem
- [ ] listar recibos

### Bloco H - Aba Comercial
- [ ] listar orçamentos/contratos do paciente
- [ ] abrir detalhe do orçamento

## Status atual no frontend novo

### O que existe
- busca visual
- cards
- modal de novo paciente
- esqueleto da ficha
- abas visuais

### O que está faltando ou instável
- persistência real
- PDF
- ViaCEP
- exames reais
- documentos reais
- odontograma real
- recibos reais
- financeiro do paciente real
- orçamentos reais
- histórico real do paciente

Classificação:
- **parcialmente migrado**

## Contrato de API necessário para Pacientes

### 1. Busca de pacientes
`GET /api/pacientes?q=`

Retorno mínimo:
- `id`
- `nome`
- `apelido`
- `prontuario`
- `telefone`
- `cpf`
- `email`
- `data_nascimento`

### 2. Pacientes recentes
`GET /api/pacientes/recentes`

Retorno:
- lista resumida de pacientes recentes

### 3. Criar paciente
`POST /api/pacientes`

Entrada:
- todos os campos do cadastro completo

Saída:
- paciente criado completo

### 4. Buscar paciente por ID
`GET /api/pacientes/{id}`

Retorno:
- dados completos do paciente

### 5. Atualizar paciente
`PUT /api/pacientes/{id}`

Entrada:
- todos os campos do cadastro completo

### 6. Contexto da ficha do paciente
`GET /api/pacientes/{id}/ficha`

Retorno agregado:
- `paciente`
- `financeiro`
- `agendamentos`
- `contratos`
- `documentos`
- `exames`
- `recibos`
- `resumoFinanceiro`
- `proximoAgendamento`

### 7. Upload de exames
`POST /api/pacientes/{id}/exames`

### 8. Listagem de documentos
`GET /api/pacientes/{id}/documentos`

### 9. Listagem de exames
`GET /api/pacientes/{id}/exames`

## Ordem recomendada de implementação do módulo Pacientes

1. API de busca/lista
2. API de criação/edição
3. API de ficha agregada
4. integração real do frontend com cadastro completo
5. integração da ficha completa
6. documentos e exames
7. PDF e ViaCEP

## Implementado nesta etapa

Arquivo:
- [api_pacientes.py](C:/Users/jusgo/Documents/sistema_clinica/api_pacientes.py)

Endpoints já implementados:
- `GET /api/pacientes`
- `GET /api/pacientes/recentes`
- `GET /api/pacientes/cep/{cep}`
- `GET /api/pacientes/{id}`
- `GET /api/pacientes/{id}/ficha`
- `POST /api/pacientes`
- `PUT /api/pacientes/{id}`

Paridade já coberta por esta API:
- busca por nome, apelido, prontuario, CPF e telefone
- criação de paciente com cadastro completo
- edição completa do paciente
- geração automática de prontuario quando não vier no payload
- validação de CPF
- validação de menor / responsavel
- ficha agregada com:
  - contratos
  - recebiveis
  - resumo financeiro
  - agendamentos
  - proximo agendamento
  - documentos locais
  - exames locais
  - recibos

Pendências da próxima etapa:
- ligar o frontend novo a essa API
- upload real de exames por endpoint
- endpoints separados para documentos/exames, se necessário para a UI
- importação por PDF do cadastro

## Critério de aceite

O módulo `Pacientes` só pode ser considerado migrado quando:
- não depender de mock
- salvar e editar no banco real
- abrir a ficha com dados reais
- manter o vínculo com financeiro, agenda, contratos, documentos e exames
- preservar o mesmo conjunto de campos do sistema original
