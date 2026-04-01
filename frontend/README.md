# SoulSul ERP Frontend

## Status atual

Este frontend React está **congelado como experimental**.

Ele **não substitui** o ERP principal da clínica neste momento.
O sistema oficial e funcional continua sendo o Streamlit em:

- [sistema_soul_sul_master_corrigido.py](C:/Users/jusgo/Documents/sistema_clinica/sistema_soul_sul_master_corrigido.py)

Prioridade atual do projeto:
- preservar regras de negócio do ERP existente
- garantir paridade funcional antes de qualquer nova migração visual

Use este frontend apenas como referência de layout ou protótipo, não como ambiente de operação da clínica.

---

Base nova do frontend premium da SoulSul, separada do sistema Streamlit atual.

## Rodar localmente

```powershell
cd C:\Users\jusgo\Documents\sistema_clinica\frontend
npm install
npm run dev
```

## Build

```powershell
npm run build
npm run preview
```

## Escopo atual

- sidebar premium da SoulSul
- dashboard executivo inicial
- logo real carregada de `..\assets\sou sul marca preta fundo.png`

## Próximos passos

- migração só poderá continuar com paridade funcional validada
- nenhuma tela nova deve substituir o sistema real sem preservar fluxos e integrações
