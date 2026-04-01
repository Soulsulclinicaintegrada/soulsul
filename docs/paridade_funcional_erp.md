# Paridade Funcional do ERP SoulSul

Data da análise: 21/03/2026  
Base analisada:
- Sistema original: [sistema_soul_sul_master_corrigido.py](C:/Users/jusgo/Documents/sistema_clinica/sistema_soul_sul_master_corrigido.py)
- Frontend novo: [frontend/src](C:/Users/jusgo/Documents/sistema_clinica/frontend/src)
- API nova da agenda: [api_agenda.py](C:/Users/jusgo/Documents/sistema_clinica/api_agenda.py)

## Regra de migração adotada
De agora em diante, a migração deve seguir esta ordem:
1. mapear funcionalidade real do sistema original
2. preservar regras de negócio e integrações
3. só depois refinar UX e layout

## Módulos existentes no sistema original

### 1. Dashboard
Escopo existente:
- dashboard de vendas
- metas mensais, supermeta e hipermeta
- evolução mensal
- filtros por paciente, avaliador, vendedor e mês
- edição de vendas importadas
- calendário de pagamentos no dashboard

Regras de negócio:
- metas são mensais
- gráfico usa ordem Janeiro a Dezembro
- dashboard mistura vendas com indicadores financeiros do dia

Dependências:
- `vendas`
- `financeiro`
- `contas_pagar`
- `recebiveis`

Status no frontend novo:
- **parcialmente migrado**
- existe layout visual
- usa `mockData`
- não preserva filtros, edição de vendas, metas reais nem calendário financeiro real

### 2. Pacientes
Escopo existente:
- busca de pacientes
- pacientes recentes / últimos acessados
- novo paciente com cadastro completo
- importação de paciente por PDF
- ficha completa do paciente
- exportação da lista de pacientes para Excel

Regras de negócio:
- validação de nome, prontuário, CPF e responsável para menor
- CEP preenche endereço
- novo paciente completo salva em `pacientes`
- importação por PDF preenche formulário
- registro de paciente recente

Dependências:
- `recebiveis`
- `agendamentos`
- `contratos`
- `documentos`
- `exames`

Status no frontend novo:
- **parcialmente migrado / quebrado**
- existe interface nova
- parte do fluxo ainda está em estado local do frontend
- não há paridade garantida com PDF, exames reais, documentos reais, odontograma real e atualização persistente do cadastro

### 3. Editar Paciente / Ficha do paciente
Escopo existente:
- seleção do paciente
- hero com status, telefone e email
- abas:
  - Principal
    - Cadastro
    - Financeiro
    - Agendamentos
  - Clínico
    - Plano e ficha clínica
    - Odontograma
    - Anamnese
    - Especialidades
  - Documentos
    - Documentos
    - Exames
    - Recibos
  - Comercial
    - Orçamentos

Regras de negócio:
- atualização completa dos dados do paciente
- financeiro do paciente vem dos recebíveis
- histórico de agendamentos vem da agenda
- documentos e exames leem arquivos locais
- recibos derivam de recebíveis pagos
- orçamentos são contratos do paciente

Dependências:
- `contratos`
- `recebiveis`
- `agendamentos`
- arquivos locais do paciente

Status no frontend novo:
- **quebrado**
- navegação foi parcialmente simulada
- ainda não existe paridade real com financeiro, documentos, exames, odontograma e recibos do sistema antigo

### 4. Contratos
Escopo existente:
- novo contrato
- lista de contratos
- filtros por paciente, prontuário, forma e período
- exportação em Excel
- geração de documento do contrato

Regras de negócio:
- contrato exige paciente existente
- formas à vista não geram recebíveis
- boleto gera cronograma de recebíveis
- salvar contrato sincroniza:
  - `procedimentos_contrato`
  - `financeiro`
  - `recebiveis`
- documento é gerado automaticamente

Dependências:
- `pacientes`
- `procedimentos_contrato`
- `financeiro`
- `recebiveis`
- documentos Word/PDF

Status no frontend novo:
- **não migrado**
- tela atual é visual com mock
- não cria nem lista contratos reais

### 5. Editar Contrato
Escopo existente:
- busca por contrato
- edição de paciente, forma, entrada, parcelas, vencimento
- edição de procedimentos e valores
- regeneração de documento

Regras de negócio:
- atualização do contrato ressincroniza `financeiro`
- atualização do cronograma ressincroniza `recebiveis`
- se virar à vista, remove recebíveis

Dependências:
- `contratos`
- `procedimentos_contrato`
- `financeiro`
- `recebiveis`
- documentos

Status no frontend novo:
- **não migrado**
- só existe visual de detalhe de contrato em mock

### 6. Importações
Escopo existente:
- importação de:
  - contratos
  - recebíveis
  - contas a pagar
  - vendas

Regras de negócio:
- criação ou atualização de pacientes
- deduplicação por hash
- atualização de contratos existentes
- sincronização de recebíveis
- criação opcional de contrato por venda
- normalização de status e observações

Dependências:
- `pacientes`
- `contratos`
- `recebiveis`
- `contas_pagar`
- `vendas`

Status no frontend novo:
- **não migrado**
- tela atual é mock e não processa planilhas

### 7. Financeiro
Escopo existente:
- Caixa
  - lançamento manual
  - saldos do dia anterior
  - baixa de recebível
  - livro-caixa
  - importação de extrato
  - exportação Excel/PDF
- Visão de recebíveis
  - filtros
  - resumo
  - agenda mensal
  - detalhamento
  - exportação Excel
- Editar Individual de recebível
- Editar em Lote por contrato
- Contas a pagar
- Calendário de vencimentos
- Nova dívida

Regras de negócio:
- baixa no caixa marca recebível como pago
- caixa mostra só movimentação efetiva
- contas a pagar atualizam status automaticamente
- recebíveis avulsos continuam no controle financeiro
- categorização automática de contas a pagar
- agenda mensal e calendário derivam de vencimentos

Dependências:
- `financeiro`
- `recebiveis`
- `contas_pagar`
- `saldos_conta`
- importação de extrato

Status no frontend novo:
- **não migrado**
- tela atual é mock sem leitura/escrita real

### 8. Agenda
Escopo existente:
- agenda clínica completa
- profissionais
- tipos de atendimento
- procedimentos
- agendamento com seleção de slots de 15 minutos
- busca de paciente
- paciente rápido
- procedimentos contratados em aberto
- procedimentos manuais
- mensagens de confirmação/lembretes
- detalhe do agendamento
- mudança de status
- atalhos para paciente e financeiro

Regras de negócio:
- conflito por profissional e horário
- grade dinâmica por profissional e data
- detalhe do agendamento com dados completos
- procedimentos do agendamento persistidos
- mensagens registradas no banco
- vínculo opcional com contrato

Dependências:
- `agendamentos`
- `agendamento_procedimentos`
- `profissionais`
- `tipos_atendimento`
- `procedimentos`
- `pacientes`
- `contratos`
- `recebiveis` / `financeiro`

Status no frontend novo:
- **parcialmente migrado / quebrado**
- é o módulo mais avançado da nova interface
- já possui API própria parcial
- ainda não atingiu a estabilidade funcional do sistema antigo

### 9. Usuários e acessos
Escopo existente:
- login
- criação de usuários
- permissões por módulo
- redefinição de senha
- logs de acesso

Regras de negócio:
- somente administrador gerencia usuários
- usuário inicial admin
- perfis controlam menu e acessos

Dependências:
- `usuarios`
- `logs_acesso`

Status no frontend novo:
- **não migrado**
- tela atual é mock sem CRUD real

## Matriz de paridade funcional

| Módulo | Sistema original | Frontend novo | Status |
|---|---|---|---|
| Dashboard | Completo com vendas, metas, filtros e indicadores | Visual com mock | Não migrado funcionalmente |
| Pacientes | Completo | Parcial, sem paridade completa de persistência e integrações | Parcialmente migrado |
| Editar Paciente / Ficha | Completo com abas e integrações | Instável, sem paridade real | Quebrado |
| Contratos | Completo | Visual com mock | Não migrado |
| Editar Contrato | Completo | Visual com mock | Não migrado |
| Importações | Completo | Visual com mock | Não migrado |
| Financeiro | Completo | Visual com mock | Não migrado |
| Agenda | Completa | API parcial + frontend parcial | Parcialmente migrado / quebrado |
| Usuários | Completo | Visual com mock | Não migrado |

## Fluxos essenciais e situação atual

### Pacientes
Necessário preservar:
- cadastro completo
- edição completa
- PDF
- documentos
- exames
- odontograma
- agendamentos do paciente
- financeiro do paciente

Situação:
- frontend novo ainda não cobre o fluxo integral

### Orçamentos
Necessário preservar:
- visualização dos contratos/orçamentos do paciente
- abertura detalhada
- aprovação visual
- vínculo comercial com contrato

Situação:
- não migrado de forma funcional

### Contratos
Necessário preservar:
- criação
- edição
- geração de documento
- sincronização com financeiro
- sincronização com recebíveis

Situação:
- não migrado

### Financeiro
Necessário preservar:
- caixa
- baixa de recebíveis
- recebíveis
- contas a pagar
- calendário
- exportações
- integração com agenda e paciente

Situação:
- não migrado

### Agenda
Necessário preservar:
- visual diário/semanal/mensal
- seleção de profissional e data
- novo agendamento
- edição por duplo clique
- detalhe rápido
- vínculo com contrato/procedimentos
- mensagens
- indicador financeiro

Situação:
- parcialmente migrado, mas ainda instável

### Compromissos
Necessário preservar:
- estrutura visual reservada
- futura expansão a partir da agenda

Situação:
- não implementado funcionalmente no frontend novo

## Dependências transversais do ERP

### Paciente como eixo central
O paciente se conecta a:
- contratos
- recebíveis
- agendamentos
- documentos
- exames
- ficha clínica

### Contrato como eixo comercial-financeiro
O contrato se conecta a:
- procedimentos contratados
- documento emitido
- financeiro
- recebíveis
- orçamento exibido na ficha do paciente

### Agenda como eixo clínico-operacional
A agenda se conecta a:
- paciente
- procedimentos
- contratos
- financeiro
- status do atendimento
- mensagens

### Financeiro como eixo operacional
O financeiro se conecta a:
- contrato
- recebíveis
- contas a pagar
- caixa
- agenda
- status financeiro do paciente

## Prioridade correta de migração

### Prioridade 1
- Pacientes
- Editar Paciente / Ficha completa
- Orçamentos
- Contratos
- Editar Contrato

### Prioridade 2
- Financeiro
- Agenda
- Compromissos

### Prioridade 3
- Importações
- Dashboard
- Usuários

## Regra operacional daqui para frente

Antes de migrar qualquer tela:
1. listar funções e regras do sistema original
2. listar dependências com outros módulos
3. definir o contrato de API necessário
4. marcar o que precisa de persistência real
5. só então redesenhar a interface

## Decisão prática
O frontend novo não deve mais avançar por estética isolada.
Cada módulo novo deve sair com:
- paridade mínima obrigatória
- persistência real
- vínculos preservados
- status explícito de migração

