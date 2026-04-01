import { useEffect, useMemo, useState } from "react";
import {
  atualizarContaPagarApi,
  atualizarMovimentoCaixaApi,
  atualizarRecebiveisLoteApi,
  baixarContaPagarApi,
  baixarRecebivelPacienteApi,
  criarReciboManualApi,
  criarSaldoContaApi,
  criarContaPagarApi,
  criarMovimentoCaixaApi,
  excluirMovimentoCaixaApi,
  listarRecibosManuaisApi,
  painelFinanceiroApi,
  type ContaPagarPayload,
  type ContaPagarResumoApi,
  type FinanceiroPainelApi,
  type MovimentoCaixaPayload,
  type MovimentoCaixaResumoApi,
  type ReciboManualApi,
  type ReciboManualPayload,
  type RecebivelAtualizacaoPayload,
  type RecebivelResumoApi,
  atualizarRecebivelPacienteApi,
  urlReciboManual,
  urlExportarCaixaExcel
} from "./pacientesApi";

type AbaFinanceiro = "caixa" | "recebiveis" | "individual" | "lote" | "pagar" | "novo_pagar" | "recibo";

type RecebivelForm = {
  id: number;
  pacienteNome: string;
  prontuario: string;
  vencimento: string;
  valor: string;
  formaPagamento: string;
  status: string;
  dataPagamento: string;
  observacao: string;
};

type ContaPagarForm = {
  id?: number;
  vencimento: string;
  descricao: string;
  fornecedor: string;
  categoria: string;
  valor: string;
  valorPago: string;
  pagoEm: string;
  status: string;
  observacao: string;
};

type CaixaForm = {
  dataMovimento: string;
  tipo: "Entrada" | "Saida";
  formaPagamento: string;
  contaCaixa: string;
  origem: string;
  prontuario: string;
  descricao: string;
  valor: string;
  observacao: string;
};

type SaldoForm = {
  data: string;
  observacao: string;
  contas: Record<string, string>;
};

type MovimentoEditForm = {
  id: number;
  dataMovimento: string;
  tipo: string;
  origem: string;
  descricao: string;
  valor: string;
  prontuario: string;
  formaPagamento: string;
  contaCaixa: string;
  observacao: string;
};

type RecebivelBaixaSelecionado = {
  id: number;
  desconto: string;
};

type ReciboManualForm = {
  valor: string;
  pagador: string;
  recebedor: string;
  dataPagamento: string;
  referente: string;
  observacao: string;
  cidade: string;
};

const STATUS_RECEBIVEIS = ["Aberto", "Pago", "Atrasado", "Suspenso", "Cancelado"] as const;
const STATUS_PAGAR = ["A vencer", "Atrasado", "Pago", "Cancelado"] as const;
const FORMAS = ["PIX", "BOLETO", "CARTAO_CREDITO", "CARTAO_DEBITO", "DINHEIRO"] as const;
const CONTAS_CAIXA = ["CAIXA", "SICOOB", "INFINITEPAY", "PAGBANK", "C6"] as const;

const CONTA_PAGAR_INICIAL: ContaPagarForm = {
  vencimento: "",
  descricao: "",
  fornecedor: "",
  categoria: "",
  valor: "",
  valorPago: "",
  pagoEm: "",
  status: "A vencer",
  observacao: ""
};

const CAIXA_INICIAL: CaixaForm = {
  dataMovimento: new Date().toISOString().slice(0, 10),
  tipo: "Entrada",
  formaPagamento: "PIX",
  contaCaixa: "CAIXA",
  origem: "",
  prontuario: "",
  descricao: "",
  valor: "",
  observacao: ""
};

const SALDO_INICIAL: SaldoForm = {
  data: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
  observacao: "",
  contas: { CAIXA: "", SICOOB: "", INFINITEPAY: "", PAGBANK: "", C6: "" }
};

const RECIBO_INICIAL: ReciboManualForm = {
  valor: "",
  pagador: "",
  recebedor: "SOUL SUL CLINICA INTEGRADA",
  dataPagamento: new Date().toISOString().slice(0, 10),
  referente: "",
  observacao: "",
  cidade: "CAMPOS DOS GOYTACAZES/RJ"
};

function labelParcela(parcela?: number | null) {
  if (parcela === 0) return "Entrada";
  if (parcela == null) return "-";
  return String(parcela);
}

function moedaParaNumero(valor: string) {
  const limpo = valor.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const numero = Number.parseFloat(limpo);
  return Number.isFinite(numero) ? numero : 0;
}

function dataBrParaIso(valor?: string) {
  if (!valor) return "";
  const partes = valor.split("/");
  if (partes.length !== 3) return valor;
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

function dataIsoParaBr(valor?: string) {
  if (!valor) return "";
  const [ano, mes, dia] = valor.split("-");
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

function numeroParaMoedaBr(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function recebivelParaForm(item: RecebivelResumoApi): RecebivelForm {
  return {
    id: item.id,
    pacienteNome: item.pacienteNome || "",
    prontuario: item.prontuario || "",
    vencimento: dataBrParaIso(item.vencimento),
    valor: item.valor || "",
    formaPagamento: item.formaPagamento || "PIX",
    status: item.status || "Aberto",
    dataPagamento: dataBrParaIso(item.dataPagamento),
    observacao: item.observacao || ""
  };
}

function contaParaForm(item: ContaPagarResumoApi): ContaPagarForm {
  return {
    id: item.id,
    vencimento: dataBrParaIso(item.vencimento),
    descricao: item.descricao || "",
    fornecedor: item.fornecedor || "",
    categoria: item.categoria || "",
    valor: item.valor || "",
    valorPago: item.valorPago || "",
    pagoEm: dataBrParaIso(item.pagoEm),
    status: item.status || "A vencer",
    observacao: item.observacao || ""
  };
}

export function FinanceiroPage() {
  const [painel, setPainel] = useState<FinanceiroPainelApi | null>(null);
  const [aba, setAba] = useState<AbaFinanceiro>("caixa");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [caixaForm, setCaixaForm] = useState<CaixaForm>(CAIXA_INICIAL);
  const [recebivelSelecionadoId, setRecebivelSelecionadoId] = useState<number>(0);
  const [recebiveisBaixaSelecionados, setRecebiveisBaixaSelecionados] = useState<RecebivelBaixaSelecionado[]>([]);
  const [recebivelForm, setRecebivelForm] = useState<RecebivelForm | null>(null);
  const [loteContratoId, setLoteContratoId] = useState<number>(0);
  const [contaForm, setContaForm] = useState<ContaPagarForm>(CONTA_PAGAR_INICIAL);
  const [buscaRecebivel, setBuscaRecebivel] = useState("");
  const [buscaBaixaRecebivel, setBuscaBaixaRecebivel] = useState("");
  const [dropdownBaixaAberto, setDropdownBaixaAberto] = useState(false);
  const [saldoForm, setSaldoForm] = useState<SaldoForm>(SALDO_INICIAL);
  const [movimentoEditandoId, setMovimentoEditandoId] = useState<number>(0);
  const [movimentoEditForm, setMovimentoEditForm] = useState<MovimentoEditForm | null>(null);
  const [filtroStatusRecebivel, setFiltroStatusRecebivel] = useState("");
  const [filtroFormaRecebivel, setFiltroFormaRecebivel] = useState("");
  const [filtroVencimentoRecebivel, setFiltroVencimentoRecebivel] = useState("");
  const [filtroFornecedorPagar, setFiltroFornecedorPagar] = useState("");
  const [filtroStatusPagar, setFiltroStatusPagar] = useState("");
  const [filtroCategoriaPagar, setFiltroCategoriaPagar] = useState("");
  const [filtroVencimentoPagar, setFiltroVencimentoPagar] = useState("");
  const [reciboForm, setReciboForm] = useState<ReciboManualForm>(RECIBO_INICIAL);
  const [recibosManuais, setRecibosManuais] = useState<ReciboManualApi[]>([]);

  async function carregarPainel() {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await painelFinanceiroApi();
      const recibos = await listarRecibosManuaisApi();
      setPainel(resposta);
      setRecibosManuais(recibos);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar financeiro.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregarPainel();
  }, []);

  const recebiveis = painel?.recebiveis || [];
  const contasPagar = painel?.contasPagar || [];
  const caixa = painel?.caixa || [];
  const movimentoEditando = useMemo(
    () => caixa.find((item) => item.id === movimentoEditandoId) || null,
    [caixa, movimentoEditandoId]
  );

  useEffect(() => {
    if (!movimentoEditando) {
      setMovimentoEditForm(null);
      return;
    }
    setMovimentoEditForm({
      id: movimentoEditando.id,
      dataMovimento: dataBrParaIso(movimentoEditando.data),
      tipo: movimentoEditando.tipo || "Entrada",
      origem: movimentoEditando.origem || "",
      descricao: movimentoEditando.descricao || "",
      valor: movimentoEditando.valor || "",
      prontuario: movimentoEditando.prontuario || "",
      formaPagamento: movimentoEditando.formaPagamento || "PIX",
      contaCaixa: movimentoEditando.contaCaixa || "CAIXA",
      observacao: movimentoEditando.observacao || ""
    });
  }, [movimentoEditando]);

  const recebiveisAbertos = useMemo(
    () => recebiveis.filter((item) => ["Aberto", "Atrasado"].includes(item.status || "")),
    [recebiveis]
  );

  const recebiveisAbertosFiltrados = useMemo(() => {
    const termo = buscaBaixaRecebivel.trim().toLowerCase();
    if (!termo) return recebiveisAbertos;
    return recebiveisAbertos.filter((item) =>
      `${item.pacienteNome || ""} ${item.prontuario || ""} ${item.parcela || ""} ${item.vencimento || ""}`.toLowerCase().includes(termo)
    );
  }, [recebiveisAbertos, buscaBaixaRecebivel]);

  const recebiveisSelecionadosDetalhe = useMemo(
    () =>
      recebiveisBaixaSelecionados
        .map((item) => {
          const recebivel = recebiveisAbertos.find((row) => row.id === item.id);
          return recebivel ? { ...recebivel, desconto: item.desconto } : null;
        })
        .filter(Boolean) as Array<RecebivelResumoApi & { desconto: string }>,
    [recebiveisAbertos, recebiveisBaixaSelecionados]
  );

  const recebivelSelecionado = recebiveisSelecionadosDetalhe[0] || null;

  const recebiveisFiltrados = useMemo(() => {
    const termo = buscaRecebivel.trim().toLowerCase();
    return recebiveis.filter((item) => {
      const buscaOk = !termo || `${item.pacienteNome || ""} ${item.prontuario || ""} ${item.parcela || ""} ${item.vencimento || ""}`.toLowerCase().includes(termo);
      const statusOk = !filtroStatusRecebivel || String(item.status || "") === filtroStatusRecebivel;
      const formaOk = !filtroFormaRecebivel || String(item.formaPagamento || "") === filtroFormaRecebivel;
      const vencimentoOk = !filtroVencimentoRecebivel || dataBrParaIso(item.vencimento) === filtroVencimentoRecebivel;
      return buscaOk && statusOk && formaOk && vencimentoOk;
    });
  }, [recebiveis, buscaRecebivel, filtroStatusRecebivel, filtroFormaRecebivel, filtroVencimentoRecebivel]);

  const contasPagarFiltradas = useMemo(() => {
    return contasPagar.filter((item) => {
      const fornecedorOk = !filtroFornecedorPagar.trim() || String(item.fornecedor || "").toLowerCase().includes(filtroFornecedorPagar.trim().toLowerCase());
      const statusOk = !filtroStatusPagar || String(item.status || "") === filtroStatusPagar;
      const categoriaOk = !filtroCategoriaPagar.trim() || String(item.categoria || "").toLowerCase().includes(filtroCategoriaPagar.trim().toLowerCase());
      const vencimentoOk = !filtroVencimentoPagar || dataBrParaIso(item.vencimento) === filtroVencimentoPagar;
      return fornecedorOk && statusOk && categoriaOk && vencimentoOk;
    });
  }, [contasPagar, filtroFornecedorPagar, filtroStatusPagar, filtroCategoriaPagar, filtroVencimentoPagar]);

  const lotes = useMemo(() => {
    const mapa = new Map<number, { contratoId: number; pacienteNome: string; prontuario: string; quantidade: number; primeiroVencimento: string }>();
    recebiveis.forEach((item) => {
      if (!item.contratoId) return;
      const atual = mapa.get(item.contratoId);
      if (atual) {
        atual.quantidade += 1;
      } else {
        mapa.set(item.contratoId, {
          contratoId: item.contratoId,
          pacienteNome: item.pacienteNome || "",
          prontuario: item.prontuario || "",
          quantidade: 1,
          primeiroVencimento: item.vencimento || ""
        });
      }
    });
    return Array.from(mapa.values());
  }, [recebiveis]);

  const loteSelecionado = useMemo(
    () => lotes.find((item) => item.contratoId === loteContratoId) || null,
    [lotes, loteContratoId]
  );

  const recebiveisDoLote = useMemo(
    () => recebiveis.filter((item) => item.contratoId === loteContratoId),
    [recebiveis, loteContratoId]
  );

  useEffect(() => {
    if (!recebivelSelecionadoId) return;
    const item = recebiveis.find((row) => row.id === recebivelSelecionadoId);
    if (item) setRecebivelForm(recebivelParaForm(item));
  }, [recebivelSelecionadoId, recebiveis]);

  useEffect(() => {
    const primeiroSelecionado = recebiveisBaixaSelecionados[0]?.id || 0;
    if (!primeiroSelecionado) return;
    const item = recebiveis.find((row) => row.id === primeiroSelecionado);
    if (item) {
      setRecebivelSelecionadoId(primeiroSelecionado);
      setRecebivelForm(recebivelParaForm(item));
    }
  }, [recebiveisBaixaSelecionados, recebiveis]);

  async function registrarCaixaManual() {
    setSalvando(true);
    setErro(null);
    const payload: MovimentoCaixaPayload = {
      origem: caixaForm.origem || "Caixa manual",
      descricao: caixaForm.descricao,
      valor: moedaParaNumero(caixaForm.valor),
      tipo: caixaForm.tipo,
      data_movimento: caixaForm.dataMovimento,
      prontuario: caixaForm.prontuario,
      forma_pagamento: caixaForm.formaPagamento,
      conta_caixa: caixaForm.contaCaixa,
      observacao: caixaForm.observacao
    };
    try {
      await criarMovimentoCaixaApi(payload);
      setCaixaForm(CAIXA_INICIAL);
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao registrar no caixa.");
    } finally {
      setSalvando(false);
    }
  }

  async function registrarSaldosDiaAnterior() {
    setSalvando(true);
    setErro(null);
    try {
      for (const conta of CONTAS_CAIXA) {
        await criarSaldoContaApi({
          data: saldoForm.data,
          conta,
          saldo: moedaParaNumero(saldoForm.contas[conta] || ""),
          observacao: saldoForm.observacao
        });
      }
      setSaldoForm(SALDO_INICIAL);
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao registrar saldos.");
    } finally {
      setSalvando(false);
    }
  }

  async function baixarRecebivel() {
    if (!recebiveisSelecionadosDetalhe.length) return;
    setSalvando(true);
    setErro(null);
    try {
      for (const item of recebiveisSelecionadosDetalhe) {
        if (!item.pacienteId) continue;
        await baixarRecebivelPacienteApi(item.pacienteId, item.id, {
          data_pagamento: caixaForm.dataMovimento,
          forma_pagamento: caixaForm.formaPagamento,
          conta_caixa: caixaForm.contaCaixa,
          desconto_valor: moedaParaNumero(item.desconto),
          observacao: caixaForm.observacao
        });
      }
      setRecebiveisBaixaSelecionados([]);
      setBuscaBaixaRecebivel("");
      setDropdownBaixaAberto(false);
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao baixar recebível.");
    } finally {
      setSalvando(false);
    }
  }

  function adicionarRecebivelBaixa(item: RecebivelResumoApi) {
    setRecebiveisBaixaSelecionados((atual) => {
      if (atual.some((row) => row.id === item.id)) return atual;
      return [...atual, { id: item.id, desconto: "" }];
    });
    setRecebivelSelecionadoId(item.id);
    setBuscaBaixaRecebivel("");
    setDropdownBaixaAberto(false);
  }

  function removerRecebivelBaixa(recebivelId: number) {
    setRecebiveisBaixaSelecionados((atual) => atual.filter((item) => item.id !== recebivelId));
    setRecebivelSelecionadoId((atual) => (atual === recebivelId ? 0 : atual));
  }

  function atualizarDescontoRecebivel(recebivelId: number, desconto: string) {
    setRecebiveisBaixaSelecionados((atual) =>
      atual.map((item) => (item.id === recebivelId ? { ...item, desconto } : item))
    );
  }

  async function salvarRecebivelIndividual() {
    if (!recebivelForm || !recebivelSelecionadoId) return;
    const item = recebiveis.find((row) => row.id === recebivelSelecionadoId);
    if (!item?.pacienteId) return;
    setSalvando(true);
    setErro(null);
    const payload: RecebivelAtualizacaoPayload = {
      paciente_nome: recebivelForm.pacienteNome,
      prontuario: recebivelForm.prontuario,
      vencimento: recebivelForm.vencimento,
      valor: moedaParaNumero(recebivelForm.valor),
      forma_pagamento: recebivelForm.formaPagamento,
      status: recebivelForm.status,
      data_pagamento: recebivelForm.dataPagamento,
      observacao: recebivelForm.observacao
    };
    try {
      await atualizarRecebivelPacienteApi(item.pacienteId, item.id, payload);
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar recebível.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarRecebiveisLote() {
    if (!loteSelecionado) return;
    setSalvando(true);
    setErro(null);
    try {
      await atualizarRecebiveisLoteApi(loteSelecionado.contratoId, {
        paciente_nome: loteSelecionado.pacienteNome,
        prontuario: loteSelecionado.prontuario,
        forma_pagamento: recebiveisDoLote[0]?.formaPagamento || "PIX",
        status: recebiveisDoLote[0]?.status || "Aberto",
        observacao: recebiveisDoLote[0]?.observacao || "",
        primeiro_vencimento: dataBrParaIso(loteSelecionado.primeiroVencimento)
      });
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar lote de recebíveis.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarContaPagar() {
    setSalvando(true);
    setErro(null);
    const payload: ContaPagarPayload = {
      vencimento: contaForm.vencimento,
      descricao: contaForm.descricao,
      fornecedor: contaForm.fornecedor,
      categoria: contaForm.categoria,
      valor: moedaParaNumero(contaForm.valor),
      valor_pago: moedaParaNumero(contaForm.valorPago),
      pago_em: contaForm.pagoEm,
      status: contaForm.status,
      observacao: contaForm.observacao
    };
    try {
      if (contaForm.id) {
        await atualizarContaPagarApi(contaForm.id, payload);
      } else {
        await criarContaPagarApi(payload);
      }
      setContaForm(CONTA_PAGAR_INICIAL);
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar conta a pagar.");
    } finally {
      setSalvando(false);
    }
  }

  async function pagarContaRapida(contaId: number) {
    setSalvando(true);
    setErro(null);
    try {
      await baixarContaPagarApi(contaId, {
        data_pagamento: caixaForm.dataMovimento,
        forma_pagamento: caixaForm.formaPagamento,
        conta_caixa: caixaForm.contaCaixa,
        observacao: caixaForm.observacao
      });
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao pagar conta.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarMovimentoEditado() {
    if (!movimentoEditForm) return;
    setSalvando(true);
    setErro(null);
    try {
      await atualizarMovimentoCaixaApi(movimentoEditForm.id, {
        origem: movimentoEditForm.origem,
        descricao: movimentoEditForm.descricao,
        valor: moedaParaNumero(movimentoEditForm.valor),
        tipo: movimentoEditForm.tipo,
        data_movimento: movimentoEditForm.dataMovimento,
        prontuario: movimentoEditForm.prontuario,
        forma_pagamento: movimentoEditForm.formaPagamento,
        conta_caixa: movimentoEditForm.contaCaixa,
        observacao: movimentoEditForm.observacao
      });
      await carregarPainel();
      setMovimentoEditandoId(0);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao editar movimento.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirMovimentoCaixa(movimentoId: number) {
    if (!window.confirm("Excluir esta movimentação de caixa?")) return;
    setErro("");
    setSalvando(true);
    try {
      await excluirMovimentoCaixaApi(movimentoId);
      if (movimentoEditandoId === movimentoId) {
        setMovimentoEditandoId(0);
      }
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao excluir movimento.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEImprimirReciboManual() {
    setSalvando(true);
    setErro(null);
    try {
      const payload: ReciboManualPayload = {
        valor: moedaParaNumero(reciboForm.valor),
        pagador: reciboForm.pagador,
        recebedor: reciboForm.recebedor,
        data_pagamento: reciboForm.dataPagamento,
        referente: reciboForm.referente,
        observacao: reciboForm.observacao,
        cidade: reciboForm.cidade
      };
      const recibo = await criarReciboManualApi(payload);
      const url = urlReciboManual(recibo.id);
      const janela = window.open(url, "_blank", "noopener,noreferrer");
      if (!janela) {
        window.alert("Nao foi possivel abrir o recibo.");
      }
      setReciboForm(RECIBO_INICIAL);
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar recibo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="module-shell finance-module-shell">
      <section className="module-kpis">
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Recebíveis</span>
          <strong>{painel?.resumo.emAberto || "R$ 0,00"}</strong>
          <span>em aberto</span>
        </article>
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Atrasado</span>
          <strong>{painel?.resumo.atrasado || "R$ 0,00"}</strong>
          <span>inadimplência</span>
        </article>
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Pagos</span>
          <strong>{painel?.resumo.pagos || "R$ 0,00"}</strong>
          <span>já entraram no caixa</span>
        </article>
      </section>

      <section className="panel finance-main-panel">
        <div className="finance-tabs">
          <button type="button" className={aba === "caixa" ? "active" : ""} onClick={() => setAba("caixa")}>Caixa</button>
          <button type="button" className={aba === "recebiveis" ? "active" : ""} onClick={() => setAba("recebiveis")}>Recebíveis</button>
          <button type="button" className={aba === "individual" ? "active" : ""} onClick={() => setAba("individual")}>Editar individual</button>
          <button type="button" className={aba === "lote" ? "active" : ""} onClick={() => setAba("lote")}>Editar lote</button>
          <button type="button" className={aba === "pagar" ? "active" : ""} onClick={() => setAba("pagar")}>Contas a pagar</button>
          <button type="button" className={aba === "novo_pagar" ? "active" : ""} onClick={() => setAba("novo_pagar")}>Novo a pagar</button>
          <button type="button" className={aba === "recibo" ? "active" : ""} onClick={() => setAba("recibo")}>Recibo</button>
        </div>

        {erro ? <div className="finance-inline-error">{erro}</div> : null}
        {carregando ? <div className="empty-inline">Carregando financeiro...</div> : null}

        {!carregando && aba === "caixa" ? (
          <div className="finance-legacy-grid">
            <article className="panel finance-form-panel">
              <span className="panel-kicker">Saldos do dia anterior</span>
              <div className="finance-form-grid">
                <label className="finance-span-2"><span>Data de referência</span><input type="date" value={saldoForm.data} onChange={(e) => setSaldoForm((a) => ({ ...a, data: e.target.value }))} /></label>
                {CONTAS_CAIXA.map((conta) => (
                  <label key={conta}>
                    <span>Saldo {conta}</span>
                    <input type="text" value={saldoForm.contas[conta] || ""} onChange={(e) => setSaldoForm((a) => ({ ...a, contas: { ...a.contas, [conta]: e.target.value } }))} />
                  </label>
                ))}
                <label className="finance-span-2"><span>Observação</span><textarea rows={3} value={saldoForm.observacao} onChange={(e) => setSaldoForm((a) => ({ ...a, observacao: e.target.value }))} /></label>
              </div>
              <div className="finance-form-actions">
                <button type="button" className="primary-action" disabled={salvando} onClick={() => void registrarSaldosDiaAnterior()}>Registrar saldos</button>
              </div>
            </article>

            <article className="panel finance-form-panel">
              <span className="panel-kicker">Lançamento manual</span>
              <div className="finance-form-grid">
                <label><span>Data do movimento</span><input type="date" value={caixaForm.dataMovimento} onChange={(e) => setCaixaForm((a) => ({ ...a, dataMovimento: e.target.value }))} /></label>
                <label><span>Tipo</span><select value={caixaForm.tipo} onChange={(e) => setCaixaForm((a) => ({ ...a, tipo: e.target.value as "Entrada" | "Saida" }))}><option value="Entrada">Entrada</option><option value="Saida">Saída</option></select></label>
                <label><span>Forma pagamento</span><select value={caixaForm.formaPagamento} onChange={(e) => setCaixaForm((a) => ({ ...a, formaPagamento: e.target.value }))}>{FORMAS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label><span>Conta/Banco</span><select value={caixaForm.contaCaixa} onChange={(e) => setCaixaForm((a) => ({ ...a, contaCaixa: e.target.value }))}>{CONTAS_CAIXA.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label><span>Origem</span><input type="text" value={caixaForm.origem} onChange={(e) => setCaixaForm((a) => ({ ...a, origem: e.target.value }))} /></label>
                <label><span>Prontuário</span><input type="text" value={caixaForm.prontuario} onChange={(e) => setCaixaForm((a) => ({ ...a, prontuario: e.target.value }))} /></label>
                <label className="finance-span-2"><span>Descrição</span><input type="text" value={caixaForm.descricao} onChange={(e) => setCaixaForm((a) => ({ ...a, descricao: e.target.value }))} /></label>
                <label><span>Valor</span><input type="text" value={caixaForm.valor} onChange={(e) => setCaixaForm((a) => ({ ...a, valor: e.target.value }))} /></label>
                <label className="finance-span-2"><span>Observação</span><textarea rows={3} value={caixaForm.observacao} onChange={(e) => setCaixaForm((a) => ({ ...a, observacao: e.target.value }))} /></label>
              </div>
              <div className="finance-form-actions">
                <button type="button" className="primary-action" disabled={salvando} onClick={() => void registrarCaixaManual()}>Registrar no caixa</button>
              </div>
            </article>

            <article className="panel finance-form-panel">
              <span className="panel-kicker">Baixa de recebível</span>
              <div className="finance-dropdown-shell">
                <label>
                  <span>Pesquisar paciente</span>
                  <input
                    type="text"
                    placeholder="Digite o nome do paciente"
                    value={buscaBaixaRecebivel}
                    onChange={(e) => {
                      setBuscaBaixaRecebivel(e.target.value);
                      setDropdownBaixaAberto(Boolean(e.target.value.trim()));
                    }}
                    onFocus={() => {
                      if (buscaBaixaRecebivel.trim()) setDropdownBaixaAberto(true);
                    }}
                  />
                </label>
                {dropdownBaixaAberto && buscaBaixaRecebivel.trim() ? (
                  <div className="finance-dropdown-list">
                    {recebiveisAbertosFiltrados.length ? recebiveisAbertosFiltrados.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="finance-dropdown-item"
                        onClick={() => adicionarRecebivelBaixa(item)}
                      >
                        <strong>{item.pacienteNome || "Paciente"}</strong>
                        <span>Prontuário {item.prontuario || "-"} · Parcela {labelParcela(item.parcela)} · {item.vencimento || "-"} · {item.valor}</span>
                      </button>
                    )) : <div className="empty-inline">Nenhum recebível encontrado.</div>}
                  </div>
                ) : null}
              </div>
              {recebiveisSelecionadosDetalhe.length ? (
                <div className="finance-selected-list">
                  {recebiveisSelecionadosDetalhe.map((item) => {
                    const desconto = moedaParaNumero(item.desconto);
                    const valorOriginal = moedaParaNumero(item.valor);
                    const valorLiquido = Math.max(0, valorOriginal - desconto);
                    return (
                      <div className="finance-selected-card" key={item.id}>
                        <div className="finance-selected-card-head">
                          <div>
                            <strong>{item.pacienteNome || "Paciente"}</strong>
                            <span>Prontuário {item.prontuario || "-"} · Parcela {labelParcela(item.parcela)} · {item.vencimento || "-"} · {item.valor}</span>
                          </div>
                          <button type="button" className="ghost-action compact" onClick={() => removerRecebivelBaixa(item.id)}>Remover</button>
                        </div>
                        <div className="finance-selected-card-grid">
                          <label>
                            <span>Desconto</span>
                            <input type="text" placeholder="R$ 0,00" value={item.desconto} onChange={(e) => atualizarDescontoRecebivel(item.id, e.target.value)} />
                          </label>
                          <div className="finance-selected-card-total">
                            <span>Valor líquido</span>
                            <strong>{valorLiquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <div className="finance-form-actions">
                <button type="button" className="primary-action" disabled={salvando || !recebiveisSelecionadosDetalhe.length} onClick={() => void baixarRecebivel()}>Dar baixa nos recebíveis</button>
              </div>
            </article>

            <article className="panel finance-module-list finance-span-all">
              <span className="panel-kicker">Livro-caixa</span>
              <div className="finance-form-actions finance-book-actions">
                <a className="ghost-action" href={urlExportarCaixaExcel()} target="_blank" rel="noreferrer">Exportar Excel</a>
              </div>
              <div className="module-sublist">
                {caixa.length ? caixa.map((item) => (
                  <div className="module-subitem finance-module-subitem" key={item.id}>
                    <div>
                      <strong>{item.descricao || item.origem || "Movimento"}</strong>
                      <span>{item.data || "-"} · {item.contaCaixa || "-"} · {item.formaPagamento || "-"}</span>
                    </div>
                    <div className="module-subitem-right">
                      <strong>{item.valor}</strong>
                      <div className="finance-inline-actions">
                        <span className={`module-status-badge ${(item.tipo || "").toLowerCase()}`}>{item.tipo || "-"}</span>
                        <button type="button" className="ghost-action compact" onClick={() => setMovimentoEditandoId(item.id)}>Editar</button>
                        <button type="button" className="ghost-action compact" onClick={() => void excluirMovimentoCaixa(item.id)}>Excluir</button>
                      </div>
                    </div>
                  </div>
                )) : <div className="empty-inline">Nenhum lançamento no caixa ainda.</div>}
              </div>
            </article>

            {movimentoEditForm ? (
              <article className="panel finance-form-panel finance-span-all">
                <span className="panel-kicker">Editar movimento</span>
                <div className="finance-form-grid">
                  <label><span>Data</span><input type="date" value={movimentoEditForm.dataMovimento} onChange={(e) => setMovimentoEditForm((a) => a ? { ...a, dataMovimento: e.target.value } : a)} /></label>
                  <label><span>Tipo</span><select value={movimentoEditForm.tipo} onChange={(e) => setMovimentoEditForm((a) => a ? { ...a, tipo: e.target.value } : a)}><option value="Entrada">Entrada</option><option value="Saida">Saída</option></select></label>
                  <label><span>Origem</span><input type="text" value={movimentoEditForm.origem} onChange={(e) => setMovimentoEditForm((a) => a ? { ...a, origem: e.target.value } : a)} /></label>
                  <label><span>Conta</span><select value={movimentoEditForm.contaCaixa} onChange={(e) => setMovimentoEditForm((a) => a ? { ...a, contaCaixa: e.target.value } : a)}>{CONTAS_CAIXA.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                  <label><span>Forma pagamento</span><select value={movimentoEditForm.formaPagamento} onChange={(e) => setMovimentoEditForm((a) => a ? { ...a, formaPagamento: e.target.value } : a)}>{FORMAS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                  <label><span>Prontuário</span><input type="text" value={movimentoEditForm.prontuario} onChange={(e) => setMovimentoEditForm((a) => a ? { ...a, prontuario: e.target.value } : a)} /></label>
                  <label className="finance-span-2"><span>Descrição</span><input type="text" value={movimentoEditForm.descricao} onChange={(e) => setMovimentoEditForm((a) => a ? { ...a, descricao: e.target.value } : a)} /></label>
                  <label><span>Valor</span><input type="text" value={movimentoEditForm.valor} onChange={(e) => setMovimentoEditForm((a) => a ? { ...a, valor: e.target.value } : a)} /></label>
                  <label className="finance-span-2"><span>Observação</span><textarea rows={3} value={movimentoEditForm.observacao} onChange={(e) => setMovimentoEditForm((a) => a ? { ...a, observacao: e.target.value } : a)} /></label>
                </div>
                <div className="finance-form-actions">
                  <button type="button" className="ghost-action" onClick={() => setMovimentoEditandoId(0)}>Fechar</button>
                  <button type="button" className="primary-action" disabled={salvando} onClick={() => void salvarMovimentoEditado()}>Salvar edição</button>
                </div>
              </article>
            ) : null}
          </div>
        ) : null}

        {!carregando && aba === "recebiveis" ? (
          <div className="finance-legacy-grid">
            <article className="panel finance-form-panel finance-span-all">
              <span className="panel-kicker">Filtros</span>
              <div className="finance-form-grid">
                <label className="finance-span-2">
                  <span>Pesquisar paciente</span>
                  <input
                    type="text"
                    placeholder="Digite o nome do paciente"
                    value={buscaRecebivel}
                    onChange={(e) => setBuscaRecebivel(e.target.value)}
                  />
                </label>
                <label>
                  <span>Status</span>
                  <select value={filtroStatusRecebivel} onChange={(e) => setFiltroStatusRecebivel(e.target.value)}>
                    <option value="">Todos</option>
                    {STATUS_RECEBIVEIS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  <span>Forma pagamento</span>
                  <select value={filtroFormaRecebivel} onChange={(e) => setFiltroFormaRecebivel(e.target.value)}>
                    <option value="">Todas</option>
                    {FORMAS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  <span>Vencimento</span>
                  <input type="date" value={filtroVencimentoRecebivel} onChange={(e) => setFiltroVencimentoRecebivel(e.target.value)} />
                </label>
              </div>
            </article>
            <article className="panel finance-form-panel"><span>Total filtrado</span><strong>{`R$ ${recebiveisFiltrados.reduce((total, item) => total + moedaParaNumero(item.valor), 0).toFixed(2).replace(".", ",")}`}</strong></article>
            <article className="panel finance-form-panel"><span>Parcelas filtradas</span><strong>{String(recebiveisFiltrados.length)}</strong></article>
            <article className="panel finance-form-panel"><span>Pacientes únicos</span><strong>{String(new Set(recebiveisFiltrados.map((i) => i.pacienteNome || "")).size)}</strong></article>
            <article className="panel finance-module-list finance-span-all">
              <span className="panel-kicker">Detalhamento dos recebíveis</span>
              <div className="module-sublist">
                {recebiveisFiltrados.length ? recebiveisFiltrados.map((item) => (
                  <div className="module-subitem finance-module-subitem" key={item.id}>
                    <div>
                      <strong>{item.pacienteNome || "Paciente"}</strong>
                      <span>Prontuário {item.prontuario || "-"} · Parcela {labelParcela(item.parcela)} · {item.vencimento || "-"}</span>
                    </div>
                    <div className="module-subitem-right">
                      <strong>{item.valor}</strong>
                      <span className={`module-status-badge ${(item.status || "").toLowerCase().replace(/\s+/g, "-")}`}>{item.status || "-"}</span>
                    </div>
                  </div>
                )) : <div className="empty-inline">Nenhum recebível encontrado.</div>}
              </div>
            </article>
          </div>
        ) : null}

        {!carregando && aba === "recibo" ? (
          <div className="finance-legacy-grid">
            <article className="panel finance-form-panel finance-span-all">
              <span className="panel-kicker">Recibo manual</span>
              <div className="finance-form-grid">
                <label>
                  <span>Valor pago</span>
                  <input
                    type="text"
                    placeholder="R$ 0,00"
                    value={reciboForm.valor}
                    onChange={(e) => setReciboForm((a) => ({ ...a, valor: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Quando</span>
                  <input
                    type="date"
                    value={reciboForm.dataPagamento}
                    onChange={(e) => setReciboForm((a) => ({ ...a, dataPagamento: e.target.value }))}
                  />
                </label>
                <label className="finance-span-2">
                  <span>Quem pagou</span>
                  <input
                    type="text"
                    value={reciboForm.pagador}
                    onChange={(e) => setReciboForm((a) => ({ ...a, pagador: e.target.value }))}
                  />
                </label>
                <label className="finance-span-2">
                  <span>A quem foi pago</span>
                  <input
                    type="text"
                    value={reciboForm.recebedor}
                    onChange={(e) => setReciboForm((a) => ({ ...a, recebedor: e.target.value }))}
                  />
                </label>
                <label className="finance-span-2">
                  <span>Referente a</span>
                  <input
                    type="text"
                    placeholder="Ex.: pagamento de tratamento odontologico"
                    value={reciboForm.referente}
                    onChange={(e) => setReciboForm((a) => ({ ...a, referente: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Cidade</span>
                  <input
                    type="text"
                    value={reciboForm.cidade}
                    onChange={(e) => setReciboForm((a) => ({ ...a, cidade: e.target.value }))}
                  />
                </label>
                <label className="finance-span-2">
                  <span>Observação</span>
                  <textarea
                    rows={4}
                    value={reciboForm.observacao}
                    onChange={(e) => setReciboForm((a) => ({ ...a, observacao: e.target.value }))}
                  />
                </label>
              </div>
              <div className="finance-form-actions">
                <button type="button" className="ghost-action" onClick={() => setReciboForm(RECIBO_INICIAL)}>Limpar</button>
                <button type="button" className="primary-action" disabled={salvando} onClick={() => void salvarEImprimirReciboManual()}>Salvar e imprimir</button>
              </div>
            </article>
            <article className="panel finance-module-list finance-span-all">
              <span className="panel-kicker">Recibos salvos</span>
              <div className="module-sublist">
                {recibosManuais.length ? recibosManuais.map((item) => (
                  <div className="module-subitem finance-module-subitem" key={item.id}>
                    <div>
                      <strong>{item.pagador || "Recibo"}</strong>
                      <span>{item.dataPagamento || "-"} · {item.referente || "Sem referência"}</span>
                    </div>
                    <div className="module-subitem-right">
                      <strong>{item.valor}</strong>
                      <div className="finance-inline-actions">
                        <a className="ghost-action compact" href={urlReciboManual(item.id)} target="_blank" rel="noreferrer">Abrir recibo</a>
                      </div>
                    </div>
                  </div>
                )) : <div className="empty-inline">Nenhum recibo manual salvo.</div>}
              </div>
            </article>
          </div>
        ) : null}

        {!carregando && aba === "individual" ? (
          <div className="finance-legacy-grid">
            <article className="panel finance-form-panel finance-span-all">
              <span className="panel-kicker">Editar recebível individual</span>
              <label>
                <span>Recebível</span>
                <select value={recebivelSelecionadoId} onChange={(e) => setRecebivelSelecionadoId(Number(e.target.value))}>
                  <option value={0}>Selecione</option>
                  {recebiveis.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.pacienteNome} - Prontuário {item.prontuario} - Parcela {labelParcela(item.parcela)} - {item.vencimento}
                    </option>
                  ))}
                </select>
              </label>
              {recebivelForm ? (
                <div className="finance-form-grid">
                  <label><span>Nome do paciente</span><input type="text" value={recebivelForm.pacienteNome} onChange={(e) => setRecebivelForm((a) => a ? { ...a, pacienteNome: e.target.value } : a)} /></label>
                  <label><span>Prontuário</span><input type="text" value={recebivelForm.prontuario} onChange={(e) => setRecebivelForm((a) => a ? { ...a, prontuario: e.target.value } : a)} /></label>
                  <label><span>Vencimento</span><input type="date" value={recebivelForm.vencimento} onChange={(e) => setRecebivelForm((a) => a ? { ...a, vencimento: e.target.value } : a)} /></label>
                  <label><span>Valor</span><input type="text" value={recebivelForm.valor} onChange={(e) => setRecebivelForm((a) => a ? { ...a, valor: e.target.value } : a)} /></label>
                  <label><span>Forma pagamento</span><select value={recebivelForm.formaPagamento} onChange={(e) => setRecebivelForm((a) => a ? { ...a, formaPagamento: e.target.value } : a)}>{FORMAS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                  <label><span>Status</span><select value={recebivelForm.status} onChange={(e) => setRecebivelForm((a) => a ? { ...a, status: e.target.value } : a)}>{STATUS_RECEBIVEIS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                  <label><span>Data do pagamento</span><input type="date" value={recebivelForm.dataPagamento} onChange={(e) => setRecebivelForm((a) => a ? { ...a, dataPagamento: e.target.value } : a)} /></label>
                  <label className="finance-span-2"><span>Observação</span><textarea rows={3} value={recebivelForm.observacao} onChange={(e) => setRecebivelForm((a) => a ? { ...a, observacao: e.target.value } : a)} /></label>
                  <div className="finance-form-actions finance-span-2">
                    <button type="button" className="primary-action" disabled={salvando} onClick={() => void salvarRecebivelIndividual()}>Salvar alterações do recebível</button>
                  </div>
                </div>
              ) : null}
            </article>
          </div>
        ) : null}

        {!carregando && aba === "lote" ? (
          <div className="finance-legacy-grid">
            <article className="panel finance-form-panel finance-span-all">
              <span className="panel-kicker">Editar recebíveis em lote</span>
              <label>
                <span>Lote para editar</span>
                <select value={loteContratoId} onChange={(e) => setLoteContratoId(Number(e.target.value))}>
                  <option value={0}>Selecione</option>
                  {lotes.map((item) => (
                    <option key={item.contratoId} value={item.contratoId}>
                      {item.pacienteNome} - Prontuário {item.prontuario} - {item.quantidade} parcelas - início {item.primeiroVencimento}
                    </option>
                  ))}
                </select>
              </label>
              {loteSelecionado ? (
                <>
                  <div className="finance-form-grid">
                    <label><span>Nome do paciente</span><input type="text" value={loteSelecionado.pacienteNome} readOnly /></label>
                    <label><span>Prontuário</span><input type="text" value={loteSelecionado.prontuario} readOnly /></label>
                    <label><span>Novo primeiro vencimento</span><input type="date" value={dataBrParaIso(loteSelecionado.primeiroVencimento)} onChange={() => {}} readOnly /></label>
                    <label><span>Forma pagamento</span><input type="text" value={recebiveisDoLote[0]?.formaPagamento || ""} readOnly /></label>
                    <label><span>Status</span><input type="text" value={recebiveisDoLote[0]?.status || ""} readOnly /></label>
                  </div>
                  <div className="module-sublist">
                    {recebiveisDoLote.map((item) => (
                      <div className="module-subitem finance-module-subitem" key={item.id}>
                        <div>
                          <strong>Parcela {labelParcela(item.parcela)}</strong>
                          <span>{item.vencimento || "-"} · {item.formaPagamento || "-"}</span>
                        </div>
                        <div className="module-subitem-right">
                          <strong>{item.valor}</strong>
                          <span className={`module-status-badge ${(item.status || "").toLowerCase().replace(/\s+/g, "-")}`}>{item.status || "-"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="finance-form-actions">
                    <button type="button" className="primary-action" disabled={salvando} onClick={() => void salvarRecebiveisLote()}>Salvar alterações em lote</button>
                  </div>
                </>
              ) : null}
            </article>
          </div>
        ) : null}

        {!carregando && aba === "pagar" ? (
          <div className="finance-legacy-grid">
            <article className="panel finance-form-panel finance-span-all">
              <span className="panel-kicker">Filtros e resumo</span>
              <div className="finance-form-grid">
                <label>
                  <span>Fornecedor</span>
                  <input type="text" value={filtroFornecedorPagar} onChange={(e) => setFiltroFornecedorPagar(e.target.value)} />
                </label>
                <label>
                  <span>Status</span>
                  <select value={filtroStatusPagar} onChange={(e) => setFiltroStatusPagar(e.target.value)}>
                    <option value="">Todos</option>
                    {STATUS_PAGAR.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label className="finance-span-2">
                  <span>Categoria</span>
                  <input type="text" value={filtroCategoriaPagar} onChange={(e) => setFiltroCategoriaPagar(e.target.value)} />
                </label>
                <label>
                  <span>Vencimento</span>
                  <input type="date" value={filtroVencimentoPagar} onChange={(e) => setFiltroVencimentoPagar(e.target.value)} />
                </label>
              </div>
              <div className="finance-mini-metrics">
                <div><span>Total filtrado</span><strong>{`R$ ${contasPagarFiltradas.reduce((total, item) => total + moedaParaNumero(item.valor), 0).toFixed(2).replace(".", ",")}`}</strong></div>
                <div><span>Títulos</span><strong>{String(contasPagarFiltradas.length)}</strong></div>
                <div><span>Fornecedores</span><strong>{String(new Set(contasPagarFiltradas.map((item) => item.fornecedor || "")).size)}</strong></div>
                <div><span>Pagos</span><strong>{`R$ ${contasPagarFiltradas.reduce((total, item) => total + moedaParaNumero(item.valorPago || ""), 0).toFixed(2).replace(".", ",")}`}</strong></div>
              </div>
            </article>

            <article className="panel finance-module-list finance-span-all">
              <span className="panel-kicker">Detalhamento</span>
              <div className="module-sublist">
                {contasPagarFiltradas.length ? contasPagarFiltradas.map((item) => (
                  <div className="module-subitem finance-module-subitem" key={item.id}>
                    <div>
                      <strong>{item.descricao || "Conta a pagar"}</strong>
                      <span>{item.fornecedor || "-"} · {item.vencimento || "-"} · {item.categoria || "-"}</span>
                    </div>
                    <div className="module-subitem-right">
                      <strong>{item.valor}</strong>
                      <div className="finance-inline-actions">
                        <span className={`module-status-badge ${(item.status || "").toLowerCase().replace(/\s+/g, "-")}`}>{item.status || "-"}</span>
                        <button type="button" className="ghost-action compact" onClick={() => {
                          setContaForm(contaParaForm(item));
                          setAba("novo_pagar");
                        }}>Editar</button>
                        {(item.status || "") === "Pago" ? null : <button type="button" className="primary-action compact" disabled={salvando} onClick={() => void pagarContaRapida(item.id)}>Pagar</button>}
                      </div>
                    </div>
                  </div>
                )) : <div className="empty-inline">Não há contas a pagar cadastradas.</div>}
              </div>
            </article>
          </div>
        ) : null}

        {!carregando && aba === "novo_pagar" ? (
          <div className="finance-legacy-grid">
            <article className="panel finance-form-panel finance-span-all">
              <span className="panel-kicker">{contaForm.id ? "Atualização rápida" : "Nova conta a pagar"}</span>
              <div className="finance-form-grid">
                <label><span>Vencimento</span><input type="date" value={contaForm.vencimento} onChange={(e) => setContaForm((a) => ({ ...a, vencimento: e.target.value }))} /></label>
                <label><span>Fornecedor</span><input type="text" value={contaForm.fornecedor} onChange={(e) => setContaForm((a) => ({ ...a, fornecedor: e.target.value }))} /></label>
                <label className="finance-span-2"><span>Título / descrição</span><input type="text" value={contaForm.descricao} onChange={(e) => setContaForm((a) => ({ ...a, descricao: e.target.value }))} /></label>
                <label><span>Categoria</span><input type="text" value={contaForm.categoria} onChange={(e) => setContaForm((a) => ({ ...a, categoria: e.target.value }))} /></label>
                <label><span>Status</span><select value={contaForm.status} onChange={(e) => setContaForm((a) => ({ ...a, status: e.target.value }))}>{STATUS_PAGAR.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label><span>Valor do título</span><input type="text" value={contaForm.valor} onChange={(e) => setContaForm((a) => ({ ...a, valor: e.target.value }))} /></label>
                <label><span>Valor pago</span><input type="text" value={contaForm.valorPago} onChange={(e) => setContaForm((a) => ({ ...a, valorPago: e.target.value }))} /></label>
                <label><span>Data do pagamento</span><input type="date" value={contaForm.pagoEm} onChange={(e) => setContaForm((a) => ({ ...a, pagoEm: e.target.value }))} /></label>
                <label className="finance-span-2"><span>Observação</span><textarea rows={3} value={contaForm.observacao} onChange={(e) => setContaForm((a) => ({ ...a, observacao: e.target.value }))} /></label>
              </div>
              <div className="finance-form-actions">
                <button type="button" className="ghost-action" onClick={() => setContaForm(CONTA_PAGAR_INICIAL)} disabled={salvando}>Limpar</button>
                <button type="button" className="primary-action" disabled={salvando} onClick={() => void salvarContaPagar()}>Salvar conta a pagar</button>
              </div>
            </article>
          </div>
        ) : null}
      </section>
    </section>
  );
}
