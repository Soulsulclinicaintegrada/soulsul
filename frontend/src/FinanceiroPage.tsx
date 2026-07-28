import { useEffect, useMemo, useState } from "react";
import {
  atualizarContaPagarApi,
  atualizarMetaFinanceiraApi,
  atualizarMovimentoCaixaApi,
  atualizarNotaFiscalEmitidaApi,
  atualizarRecebiveisLoteApi,
  baixarContaPagarApi,
  baixarRecebivelPacienteApi,
  criarNotaFiscalEmitidaApi,
  criarReciboManualApi,
  criarSaldoContaApi,
  criarContaPagarApi,
  criarMovimentoCaixaApi,
  excluirMovimentoCaixaApi,
  listarMetasFinanceirasApi,
  listarNotasFiscaisEmitidasApi,
  listarRecibosManuaisApi,
  painelFinanceiroApi,
  type ContaPagarPayload,
  type ContaPagarResumoApi,
  type FinanceiroPainelApi,
  type MetaMensalApi,
  type MetaMensalPayload,
  type MovimentoCaixaPayload,
  type MovimentoCaixaResumoApi,
  type NotaFiscalEmitidaApi,
  type NotaFiscalEmitidaPayload,
  type ReciboManualApi,
  type ReciboManualPayload,
  type RecebivelRenegociacaoParcelaPayload,
  type RecebivelAtualizacaoPayload,
  type RecebivelResumoApi,
  atualizarRecebivelPacienteApi,
  urlReciboManual,
  urlExportarCaixaExcel
} from "./pacientesApi";

type AbaFinanceiro = "caixa" | "recebiveis" | "cobrancas" | "individual" | "lote" | "pagar" | "novo_pagar" | "recibo" | "metas" | "notas_fiscais";

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
  cobrancaRealizada: boolean;
  observacaoCobranca: string;
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

type RenegociacaoParcelaForm = {
  vencimento: string;
  valor: string;
  formaPagamento: string;
  observacao: string;
};

type GeradorRenegociacaoForm = {
  quantidade: string;
  primeiroVencimento: string;
  valor: string;
  formaPagamento: string;
  observacao: string;
};

type LoteRecebivelItem = {
  loteId: string;
  contratoId: number | null;
  pacienteId: number | null;
  pacienteNome: string;
  prontuario: string;
  quantidade: number;
  primeiroVencimento: string;
};

type RecebivelGridMap = Record<number, RecebivelForm>;
type OrdenacaoCobranca = "nome" | "vencimento" | "valor" | "status" | "prontuario";

type ReciboManualForm = {
  valor: string;
  pagador: string;
  recebedor: string;
  dataPagamento: string;
  referente: string;
  observacao: string;
  cidade: string;
};

type MetaForm = {
  ano: number;
  mes: number;
  meta: string;
  supermeta: string;
  hipermeta: string;
};

type NotaFiscalForm = {
  id?: number;
  competencia: string;
  dataEmissao: string;
  dataRecebimento: string;
  numeroNf: string;
  serie: string;
  cliente: string;
  descricao: string;
  contaDestino: string;
  valorNf: string;
  valorRecebido: string;
  status: string;
  observacao: string;
};

const STATUS_RECEBIVEIS = ["Aberto", "Pago", "Atrasado", "Suspenso", "Cancelado"] as const;
const STATUS_RECEBIVEIS_VISIVEIS = ["Aberto", "Pago", "Atrasado"] as const;
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

const GERADOR_RENEGOCIACAO_INICIAL: GeradorRenegociacaoForm = {
  quantidade: "1",
  primeiroVencimento: new Date().toISOString().slice(0, 10),
  valor: "",
  formaPagamento: "PIX",
  observacao: ""
};

function normalizarBuscaTexto(valor?: string) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const META_FORM_INICIAL: MetaForm = {
  ano: new Date().getFullYear(),
  mes: new Date().getMonth() + 1,
  meta: "",
  supermeta: "",
  hipermeta: ""
};

const NOTA_FISCAL_INICIAL: NotaFiscalForm = {
  competencia: new Date().toISOString().slice(0, 7),
  dataEmissao: new Date().toISOString().slice(0, 10),
  dataRecebimento: "",
  numeroNf: "",
  serie: "",
  cliente: "",
  descricao: "",
  contaDestino: "SICOOB",
  valorNf: "",
  valorRecebido: "",
  status: "Pendente",
  observacao: ""
};

const STATUS_NOTA_FISCAL = ["Pendente", "Recebida", "Conciliada", "Cancelada"] as const;

const MESES_ANO = [
  { valor: 1, rotulo: "Janeiro" },
  { valor: 2, rotulo: "Fevereiro" },
  { valor: 3, rotulo: "Marco" },
  { valor: 4, rotulo: "Abril" },
  { valor: 5, rotulo: "Maio" },
  { valor: 6, rotulo: "Junho" },
  { valor: 7, rotulo: "Julho" },
  { valor: 8, rotulo: "Agosto" },
  { valor: 9, rotulo: "Setembro" },
  { valor: 10, rotulo: "Outubro" },
  { valor: 11, rotulo: "Novembro" },
  { valor: 12, rotulo: "Dezembro" }
] as const;

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

function novaParcelaRenegociacao(
  vencimento = new Date().toISOString().slice(0, 10),
  valor = "",
  formaPagamento = "PIX"
): RenegociacaoParcelaForm {
  return { vencimento, valor, formaPagamento, observacao: "" };
}

function dataEstaNoPeriodo(dataIso: string, inicio?: string, fim?: string) {
  if (!dataIso) return !inicio && !fim;
  if (inicio && dataIso < inicio) return false;
  if (fim && dataIso > fim) return false;
  return true;
}

function numeroParaMoedaBr(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escaparCsv(valor: string) {
  const texto = String(valor ?? "");
  if (!/[;"\n\r]/.test(texto)) return texto;
  return `"${texto.replace(/"/g, '""')}"`;
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
    observacao: item.observacao || "",
    cobrancaRealizada: false,
    observacaoCobranca: ""
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

function metaParaForm(item: MetaMensalApi): MetaForm {
  return {
    ano: item.ano,
    mes: item.mes,
    meta: item.meta ? item.meta.toFixed(2).replace(".", ",") : "",
    supermeta: item.supermeta ? item.supermeta.toFixed(2).replace(".", ",") : "",
    hipermeta: item.hipermeta ? item.hipermeta.toFixed(2).replace(".", ",") : ""
  };
}

function notaFiscalParaForm(item: NotaFiscalEmitidaApi): NotaFiscalForm {
  return {
    id: item.id,
    competencia: item.competencia || "",
    dataEmissao: dataBrParaIso(item.dataEmissao),
    dataRecebimento: dataBrParaIso(item.dataRecebimento),
    numeroNf: item.numeroNf || "",
    serie: item.serie || "",
    cliente: item.cliente || "",
    descricao: item.descricao || "",
    contaDestino: item.contaDestino || "SICOOB",
    valorNf: item.valorNf || "",
    valorRecebido: item.valorRecebido || "",
    status: item.status || "Pendente",
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
  const [recebiveisGrid, setRecebiveisGrid] = useState<RecebivelGridMap>({});
  const [loteContratoId, setLoteContratoId] = useState<string>("");
  const [buscaLotePaciente, setBuscaLotePaciente] = useState("");
  const [dropdownLoteAberto, setDropdownLoteAberto] = useState(false);
  const [renegociacaoParcelas, setRenegociacaoParcelas] = useState<RenegociacaoParcelaForm[]>([]);
  const [renegociacaoObservacao, setRenegociacaoObservacao] = useState("");
  const [geradorRenegociacao, setGeradorRenegociacao] = useState<GeradorRenegociacaoForm>(GERADOR_RENEGOCIACAO_INICIAL);
  const [contaForm, setContaForm] = useState<ContaPagarForm>(CONTA_PAGAR_INICIAL);
  const [buscaRecebivel, setBuscaRecebivel] = useState("");
  const [buscaBaixaRecebivel, setBuscaBaixaRecebivel] = useState("");
  const [dropdownBaixaAberto, setDropdownBaixaAberto] = useState(false);
  const [saldoForm, setSaldoForm] = useState<SaldoForm>(SALDO_INICIAL);
  const [movimentoEditandoId, setMovimentoEditandoId] = useState<number>(0);
  const [movimentoEditForm, setMovimentoEditForm] = useState<MovimentoEditForm | null>(null);
  const [filtroStatusRecebivel, setFiltroStatusRecebivel] = useState("");
  const [mostrarTodosRecebiveis, setMostrarTodosRecebiveis] = useState(false);
  const [filtroFormaRecebivel, setFiltroFormaRecebivel] = useState("");
  const [filtroVencimentoRecebivelInicio, setFiltroVencimentoRecebivelInicio] = useState("");
  const [filtroVencimentoRecebivelFim, setFiltroVencimentoRecebivelFim] = useState("");
  const [ordenacaoCobranca, setOrdenacaoCobranca] = useState<OrdenacaoCobranca>("nome");
  const [direcaoCobranca, setDirecaoCobranca] = useState<"asc" | "desc">("asc");
  const [filtroFornecedorPagar, setFiltroFornecedorPagar] = useState("");
  const [filtroStatusPagar, setFiltroStatusPagar] = useState("");
  const [filtroCategoriaPagar, setFiltroCategoriaPagar] = useState("");
  const [filtroVencimentoPagarInicio, setFiltroVencimentoPagarInicio] = useState("");
  const [filtroVencimentoPagarFim, setFiltroVencimentoPagarFim] = useState("");
  const [reciboForm, setReciboForm] = useState<ReciboManualForm>(RECIBO_INICIAL);
  const [recibosManuais, setRecibosManuais] = useState<ReciboManualApi[]>([]);
  const [metasAno, setMetasAno] = useState(new Date().getFullYear());
  const [metasMensais, setMetasMensais] = useState<MetaMensalApi[]>([]);
  const [metaForm, setMetaForm] = useState<MetaForm>(META_FORM_INICIAL);
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscalEmitidaApi[]>([]);
  const [notaFiscalForm, setNotaFiscalForm] = useState<NotaFiscalForm>(NOTA_FISCAL_INICIAL);

  async function carregarPainel() {
    setCarregando(true);
    setErro(null);
    try {
      const [resposta, recibos, metas, notas] = await Promise.all([
        painelFinanceiroApi(),
        listarRecibosManuaisApi(),
        listarMetasFinanceirasApi(metasAno),
        listarNotasFiscaisEmitidasApi()
      ]);
      setPainel(resposta);
      setRecibosManuais(recibos);
      setMetasMensais(metas);
      setNotasFiscais(notas);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar financeiro.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregarPainel();
  }, [metasAno]);

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

  useEffect(() => {
    const selecionada =
      metasMensais.find((item) => item.mes === metaForm.mes && item.ano === metasAno)
      || metasMensais[0]
      || null;
    if (!selecionada) return;
    setMetaForm(metaParaForm(selecionada));
  }, [metasAno, metasMensais, metaForm.mes]);

  const recebiveisAbertos = useMemo(
    () => recebiveis.filter((item) => ["Aberto", "Atrasado"].includes(item.status || "")),
    [recebiveis]
  );

  const recebiveisAbertosFiltrados = useMemo(() => {
    const termo = normalizarBuscaTexto(buscaBaixaRecebivel);
    if (!termo) return recebiveisAbertos;
    return recebiveisAbertos.filter((item) =>
      normalizarBuscaTexto(`${item.pacienteNome || ""} ${item.prontuario || ""} ${item.parcela || ""} ${item.vencimento || ""}`).includes(termo)
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
  const recebivelSelecionadoHistorico = useMemo(
    () => recebiveis.find((item) => item.id === recebivelSelecionadoId) || null,
    [recebivelSelecionadoId, recebiveis]
  );

  const recebiveisFiltrados = useMemo(() => {
    const termo = normalizarBuscaTexto(buscaRecebivel);
    return recebiveis.filter((item) => {
      const statusAtual = String(item.status || "");
      const buscaOk = !termo || normalizarBuscaTexto(`${item.pacienteNome || ""} ${item.prontuario || ""} ${item.parcela || ""} ${item.vencimento || ""}`).includes(termo);
      const visibilidadeOk = mostrarTodosRecebiveis || STATUS_RECEBIVEIS_VISIVEIS.includes(statusAtual as typeof STATUS_RECEBIVEIS_VISIVEIS[number]);
      const statusOk = !filtroStatusRecebivel || statusAtual === filtroStatusRecebivel;
      const formaOk = !filtroFormaRecebivel || String(item.formaPagamento || "") === filtroFormaRecebivel;
      const vencimentoOk = dataEstaNoPeriodo(
        dataBrParaIso(item.vencimento),
        filtroVencimentoRecebivelInicio,
        filtroVencimentoRecebivelFim
      );
      return buscaOk && visibilidadeOk && statusOk && formaOk && vencimentoOk;
    }).sort((a, b) => {
      const nome = String(a.pacienteNome || "").localeCompare(String(b.pacienteNome || ""), "pt-BR");
      if (nome !== 0) return nome;
      return String(a.vencimento || "").localeCompare(String(b.vencimento || ""), "pt-BR");
    });
  }, [recebiveis, buscaRecebivel, filtroStatusRecebivel, mostrarTodosRecebiveis, filtroFormaRecebivel, filtroVencimentoRecebivelInicio, filtroVencimentoRecebivelFim]);

  useEffect(() => {
    if (mostrarTodosRecebiveis) return;
    if (filtroStatusRecebivel && !STATUS_RECEBIVEIS_VISIVEIS.includes(filtroStatusRecebivel as typeof STATUS_RECEBIVEIS_VISIVEIS[number])) {
      setFiltroStatusRecebivel("");
    }
  }, [filtroStatusRecebivel, mostrarTodosRecebiveis]);

  const cobrancasFiltradas = useMemo(
    () => recebiveisFiltrados.filter((item) => ["Aberto", "Atrasado"].includes(item.status || "")),
    [recebiveisFiltrados]
  );

  const recebiveisRenegociaveis = useMemo(
    () => recebiveis.filter((item) => !["Pago", "Cancelado", "Suspenso"].includes(item.status || "")),
    [recebiveis]
  );

  const cobrancasOrdenadas = useMemo(() => {
    const lista = [...cobrancasFiltradas];
    const fator = direcaoCobranca === "desc" ? -1 : 1;
    return lista.sort((a, b) => {
      let comparacao = 0;
      if (ordenacaoCobranca === "valor") {
        comparacao = moedaParaNumero(a.valor) - moedaParaNumero(b.valor);
      } else if (ordenacaoCobranca === "vencimento") {
        comparacao = dataBrParaIso(a.vencimento).localeCompare(dataBrParaIso(b.vencimento));
      } else if (ordenacaoCobranca === "status") {
        comparacao = String(a.status || "").localeCompare(String(b.status || ""), "pt-BR");
      } else if (ordenacaoCobranca === "prontuario") {
        comparacao = String(a.prontuario || "").localeCompare(String(b.prontuario || ""), "pt-BR");
      } else {
        comparacao = String(a.pacienteNome || "").localeCompare(String(b.pacienteNome || ""), "pt-BR");
      }
      if (comparacao !== 0) return comparacao * fator;
      return String(a.pacienteNome || "").localeCompare(String(b.pacienteNome || ""), "pt-BR") * fator;
    });
  }, [cobrancasFiltradas, direcaoCobranca, ordenacaoCobranca]);

  const totalCobrancas = useMemo(
    () => cobrancasFiltradas.reduce((total, item) => total + moedaParaNumero(item.valor), 0),
    [cobrancasFiltradas]
  );

  const totalPacientesCobranca = useMemo(
    () => new Set(cobrancasFiltradas.map((item) => item.pacienteNome || "")).size,
    [cobrancasFiltradas]
  );

  const contasPagarFiltradas = useMemo(() => {
    return contasPagar.filter((item) => {
      const fornecedorOk = !filtroFornecedorPagar.trim() || normalizarBuscaTexto(item.fornecedor).includes(normalizarBuscaTexto(filtroFornecedorPagar));
      const statusOk = !filtroStatusPagar || String(item.status || "") === filtroStatusPagar;
      const categoriaOk = !filtroCategoriaPagar.trim() || normalizarBuscaTexto(item.categoria).includes(normalizarBuscaTexto(filtroCategoriaPagar));
      const vencimentoOk = dataEstaNoPeriodo(
        dataBrParaIso(item.vencimento),
        filtroVencimentoPagarInicio,
        filtroVencimentoPagarFim
      );
      return fornecedorOk && statusOk && categoriaOk && vencimentoOk;
    });
  }, [contasPagar, filtroFornecedorPagar, filtroStatusPagar, filtroCategoriaPagar, filtroVencimentoPagarInicio, filtroVencimentoPagarFim]);

  const notasFiscaisOrdenadas = useMemo(
    () => [...notasFiscais].sort((a, b) => `${b.competencia}|${b.dataEmissao}`.localeCompare(`${a.competencia}|${a.dataEmissao}`)),
    [notasFiscais]
  );

  const resumoNotasFiscais = useMemo(() => ({
    totalNf: notasFiscais.reduce((total, item) => total + (item.valorNfNumero || 0), 0),
    totalRecebido: notasFiscais.reduce((total, item) => total + (item.valorRecebidoNumero || 0), 0),
    totalDiferenca: notasFiscais.reduce((total, item) => total + (item.diferencaNumero || 0), 0),
    quantidadePendentes: notasFiscais.filter((item) => !item.conciliado && item.status !== "Cancelada").length
  }), [notasFiscais]);

  const lotes = useMemo(() => {
    const mapa = new Map<string, LoteRecebivelItem>();
    recebiveis.forEach((item) => {
      const loteId = item.contratoId
        ? `contrato:${item.contratoId}`
        : `sem-contrato:${item.pacienteId || 0}:${normalizarBuscaTexto(item.prontuario)}:${normalizarBuscaTexto(item.pacienteNome)}`;
      const atual = mapa.get(loteId);
      if (atual) {
        atual.quantidade += 1;
        if (!atual.primeiroVencimento || dataBrParaIso(item.vencimento) < dataBrParaIso(atual.primeiroVencimento)) {
          atual.primeiroVencimento = item.vencimento || atual.primeiroVencimento;
        }
      } else {
        mapa.set(loteId, {
          loteId,
          contratoId: item.contratoId ?? null,
          pacienteId: item.pacienteId ?? null,
          pacienteNome: item.pacienteNome || "",
          prontuario: item.prontuario || "",
          quantidade: 1,
          primeiroVencimento: item.vencimento || ""
        });
      }
    });
    return Array.from(mapa.values()).sort((a, b) => {
      const nome = normalizarBuscaTexto(a.pacienteNome).localeCompare(normalizarBuscaTexto(b.pacienteNome));
      if (nome !== 0) return nome;
      if (a.prontuario !== b.prontuario) return a.prontuario.localeCompare(b.prontuario, "pt-BR");
      return (a.contratoId || 0) - (b.contratoId || 0);
    });
  }, [recebiveis]);

  const loteSelecionado = useMemo(
    () => lotes.find((item) => item.loteId === loteContratoId) || null,
    [lotes, loteContratoId]
  );

  const lotesFiltrados = useMemo(() => {
    const termo = normalizarBuscaTexto(buscaLotePaciente);
    if (!termo) return lotes;
    return lotes.filter((item) =>
      normalizarBuscaTexto(`${item.pacienteNome} ${item.prontuario} ${item.contratoId || "sem contrato"}`).includes(termo)
    );
  }, [buscaLotePaciente, lotes]);

  const recebiveisDoLote = useMemo(
    () => recebiveis.filter((item) => {
      if (!loteSelecionado) return false;
      if (loteSelecionado.contratoId) return item.contratoId === loteSelecionado.contratoId;
      return !item.contratoId
        && (item.pacienteId || 0) === (loteSelecionado.pacienteId || 0)
        && normalizarBuscaTexto(item.prontuario) === normalizarBuscaTexto(loteSelecionado.prontuario)
        && normalizarBuscaTexto(item.pacienteNome) === normalizarBuscaTexto(loteSelecionado.pacienteNome);
    }),
    [recebiveis, loteSelecionado]
  );

  const totalRecebiveisDoLote = useMemo(
    () => recebiveisDoLote.reduce((total, item) => total + moedaParaNumero(item.valor), 0),
    [recebiveisDoLote]
  );

  const totalRenegociacao = useMemo(
    () => renegociacaoParcelas.reduce((total, item) => total + moedaParaNumero(item.valor), 0),
    [renegociacaoParcelas]
  );

  useEffect(() => {
    if (!recebivelSelecionadoId) return;
    const item = recebiveis.find((row) => row.id === recebivelSelecionadoId);
    if (item) setRecebivelForm(recebivelParaForm(item));
  }, [recebivelSelecionadoId, recebiveis]);

  useEffect(() => {
    if (!recebiveisDoLote.length) {
      setRenegociacaoParcelas([]);
      setRenegociacaoObservacao("");
      return;
    }
    const ordenados = [...recebiveisDoLote].sort((a, b) => {
      const parcelaA = Number(a.parcela ?? 0);
      const parcelaB = Number(b.parcela ?? 0);
      if (parcelaA !== parcelaB) return parcelaA - parcelaB;
      return dataBrParaIso(a.vencimento).localeCompare(dataBrParaIso(b.vencimento));
    });
    setRenegociacaoParcelas(
      ordenados.map((item) =>
        novaParcelaRenegociacao(
          dataBrParaIso(item.vencimento) || new Date().toISOString().slice(0, 10),
          item.valor || "",
          item.formaPagamento || "PIX"
        )
      )
    );
    setRenegociacaoObservacao("");
    setGeradorRenegociacao({
      quantidade: String(Math.max(1, ordenados.filter((item) => !["Pago", "Cancelado", "Suspenso"].includes(item.status || "")).length || ordenados.length || 1)),
      primeiroVencimento: dataBrParaIso(ordenados[0]?.vencimento) || new Date().toISOString().slice(0, 10),
      valor: ordenados[0]?.valor || "",
      formaPagamento: ordenados[0]?.formaPagamento || "PIX",
      observacao: ""
    });
  }, [recebiveisDoLote]);

  useEffect(() => {
    const proximo: RecebivelGridMap = {};
    recebiveis.forEach((item) => {
      proximo[item.id] = recebivelParaForm(item);
    });
    setRecebiveisGrid(proximo);
  }, [recebiveis]);

  function selecionarLote(item: LoteRecebivelItem) {
    setLoteContratoId(item.loteId);
    setBuscaLotePaciente(item.pacienteNome || "");
    setDropdownLoteAberto(false);
  }

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

  function abrirRecebivelParaEdicao(recebivelId: number) {
    setRecebivelSelecionadoId(recebivelId);
    setAba("individual");
  }

  function exportarRecebiveisFiltrados() {
    const linhas = [
      ["Paciente", "Prontuário", "Parcela", "Vencimento", "Valor", "Status", "Forma pagamento", "Data da baixa", "Observação"],
      ...recebiveisFiltrados.map((item) => [
        item.pacienteNome || "",
        item.prontuario || "",
        labelParcela(item.parcela),
        item.vencimento || "",
        item.valor || "",
        item.status || "",
        item.formaPagamento || "",
        item.dataPagamento || "",
        item.observacao || ""
      ])
    ];
    const conteudo = `\uFEFF${linhas.map((colunas) => colunas.map(escaparCsv).join(";")).join("\r\n")}`;
    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recebiveis_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
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
      observacao: recebivelForm.observacao,
      cobranca_realizada: recebivelForm.cobrancaRealizada,
      observacao_cobranca: recebivelForm.observacaoCobranca
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

  function atualizarRecebivelGrid(recebivelId: number, campo: keyof RecebivelForm, valor: string | boolean) {
    setRecebiveisGrid((atual) => {
      const base = atual[recebivelId] || recebivelParaForm(recebiveis.find((item) => item.id === recebivelId) || { id: recebivelId, valor: "0,00" });
      return {
        ...atual,
        [recebivelId]: {
          ...base,
          [campo]: valor
        }
      };
    });
  }

  async function salvarRecebivelLinha(recebivelId: number) {
    const atual = recebiveis.find((row) => row.id === recebivelId);
    const formLinha = recebiveisGrid[recebivelId];
    if (!atual?.pacienteId || !formLinha) return;
    setSalvando(true);
    setErro(null);
    try {
      await atualizarRecebivelPacienteApi(atual.pacienteId, recebivelId, {
        paciente_nome: formLinha.pacienteNome,
        prontuario: formLinha.prontuario,
        vencimento: formLinha.vencimento,
        valor: moedaParaNumero(formLinha.valor),
        forma_pagamento: formLinha.formaPagamento,
        status: formLinha.status,
        data_pagamento: formLinha.dataPagamento,
        observacao: formLinha.observacao,
        cobranca_realizada: formLinha.cobrancaRealizada,
        observacao_cobranca: formLinha.observacaoCobranca
      });
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar recebível.");
    } finally {
      setSalvando(false);
    }
  }

  function limparFiltrosRecebiveis() {
    setBuscaRecebivel("");
    setFiltroStatusRecebivel("");
    setMostrarTodosRecebiveis(false);
    setFiltroFormaRecebivel("");
    setFiltroVencimentoRecebivelInicio("");
    setFiltroVencimentoRecebivelFim("");
  }

  function limparFiltrosCobrancas() {
    setBuscaRecebivel("");
    setFiltroStatusRecebivel("");
    setFiltroVencimentoRecebivelInicio("");
    setFiltroVencimentoRecebivelFim("");
    setOrdenacaoCobranca("nome");
    setDirecaoCobranca("asc");
  }

  function adicionarParcelaRenegociacao() {
    const ultimaParcela = renegociacaoParcelas[renegociacaoParcelas.length - 1];
    const vencimentoBase = ultimaParcela?.vencimento || new Date().toISOString().slice(0, 10);
    const proximoVencimento = (() => {
      const dataBase = new Date(`${vencimentoBase}T12:00:00`);
      if (Number.isNaN(dataBase.getTime())) return new Date().toISOString().slice(0, 10);
      dataBase.setMonth(dataBase.getMonth() + 1);
      return dataBase.toISOString().slice(0, 10);
    })();
    setRenegociacaoParcelas((atual) => [
      ...atual,
      novaParcelaRenegociacao(proximoVencimento, "", ultimaParcela?.formaPagamento || "PIX")
    ]);
  }

  function removerParcelaRenegociacao(indice: number) {
    setRenegociacaoParcelas((atual) => atual.filter((_, atualIndice) => atualIndice !== indice));
  }

  function gerarParcelasRenegociacao() {
    const quantidade = Math.max(1, Number.parseInt(geradorRenegociacao.quantidade.replace(/\D/g, ""), 10) || 0);
    const primeiroVencimento = geradorRenegociacao.primeiroVencimento;
    if (!primeiroVencimento) {
      setErro("Informe o primeiro vencimento para gerar as parcelas.");
      return;
    }
    if (moedaParaNumero(geradorRenegociacao.valor) <= 0) {
      setErro("Informe um valor válido para gerar as parcelas.");
      return;
    }
    const base = new Date(`${primeiroVencimento}T12:00:00`);
    if (Number.isNaN(base.getTime())) {
      setErro("Informe uma data válida para gerar as parcelas.");
      return;
    }
    setErro(null);
    setRenegociacaoParcelas(
      Array.from({ length: quantidade }, (_, indice) => {
        const data = new Date(base);
        data.setMonth(base.getMonth() + indice);
        return novaParcelaRenegociacao(
          data.toISOString().slice(0, 10),
          geradorRenegociacao.valor,
          geradorRenegociacao.formaPagamento || "PIX"
        );
      }).map((item) => ({ ...item, observacao: geradorRenegociacao.observacao }))
    );
  }

  function atualizarParcelaRenegociacao(
    indice: number,
    campo: keyof RenegociacaoParcelaForm,
    valor: string
  ) {
    setRenegociacaoParcelas((atual) =>
      atual.map((item, atualIndice) => (atualIndice === indice ? { ...item, [campo]: valor } : item))
    );
  }

  async function salvarRecebiveisLote() {
    if (!loteSelecionado || !renegociacaoParcelas.length) return;
    setSalvando(true);
    setErro(null);
    try {
      const novasParcelas: RecebivelRenegociacaoParcelaPayload[] = renegociacaoParcelas.map((item, indice) => {
        if (!item.vencimento) {
          throw new Error(`Informe o vencimento da nova parcela ${indice + 1}.`);
        }
        if (moedaParaNumero(item.valor) <= 0) {
          throw new Error(`Informe um valor maior que zero para a nova parcela ${indice + 1}.`);
        }
        return {
          vencimento: item.vencimento,
          valor: moedaParaNumero(item.valor),
          forma_pagamento: item.formaPagamento || "PIX",
          observacao: item.observacao
        };
      });
      await atualizarRecebiveisLoteApi(loteSelecionado.loteId, {
        paciente_id: loteSelecionado.pacienteId,
        paciente_nome: loteSelecionado.pacienteNome,
        prontuario: loteSelecionado.prontuario,
        forma_pagamento: recebiveisDoLote[0]?.formaPagamento || "PIX",
        status: "Suspenso",
        observacao: renegociacaoObservacao,
        primeiro_vencimento: novasParcelas[0]?.vencimento || dataBrParaIso(loteSelecionado.primeiroVencimento),
        novas_parcelas: novasParcelas,
        suspender_anteriores: true,
        observacao_renegociacao: renegociacaoObservacao
      });
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao renegociar lote de recebíveis.");
    } finally {
      setSalvando(false);
    }
  }

  async function suspenderRecebiveisLote() {
    if (!loteSelecionado) return;
    setSalvando(true);
    setErro(null);
    try {
      await atualizarRecebiveisLoteApi(loteSelecionado.loteId, {
        paciente_id: loteSelecionado.pacienteId,
        paciente_nome: loteSelecionado.pacienteNome,
        prontuario: loteSelecionado.prontuario,
        forma_pagamento: recebiveisDoLote[0]?.formaPagamento || "PIX",
        status: "Suspenso",
        observacao: renegociacaoObservacao,
        primeiro_vencimento: "",
        novas_parcelas: [],
        suspender_anteriores: true,
        observacao_renegociacao: renegociacaoObservacao
      });
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao suspender parcelas do lote.");
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

  async function salvarMetaMensal() {
    setSalvando(true);
    setErro(null);
    try {
      const payload: MetaMensalPayload = {
        meta: moedaParaNumero(metaForm.meta),
        supermeta: moedaParaNumero(metaForm.supermeta),
        hipermeta: moedaParaNumero(metaForm.hipermeta)
      };
      await atualizarMetaFinanceiraApi(metaForm.ano, metaForm.mes, payload);
      const metasAtualizadas = await listarMetasFinanceirasApi(metaForm.ano);
      setMetasMensais(metasAtualizadas);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar meta mensal.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarNotaFiscal() {
    setSalvando(true);
    setErro(null);
    try {
      const payload: NotaFiscalEmitidaPayload = {
        competencia: notaFiscalForm.competencia,
        data_emissao: notaFiscalForm.dataEmissao,
        data_recebimento: notaFiscalForm.dataRecebimento,
        numero_nf: notaFiscalForm.numeroNf,
        serie: notaFiscalForm.serie,
        cliente: notaFiscalForm.cliente,
        descricao: notaFiscalForm.descricao,
        conta_destino: notaFiscalForm.contaDestino,
        valor_nf: moedaParaNumero(notaFiscalForm.valorNf),
        valor_recebido: moedaParaNumero(notaFiscalForm.valorRecebido),
        status: notaFiscalForm.status,
        observacao: notaFiscalForm.observacao
      };
      if (notaFiscalForm.id) {
        await atualizarNotaFiscalEmitidaApi(notaFiscalForm.id, payload);
      } else {
        await criarNotaFiscalEmitidaApi(payload);
      }
      setNotaFiscalForm(NOTA_FISCAL_INICIAL);
      setNotasFiscais(await listarNotasFiscaisEmitidasApi());
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar nota fiscal.");
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
          <button type="button" className={aba === "cobrancas" ? "active" : ""} onClick={() => setAba("cobrancas")}>Cobranças</button>
          <button type="button" className={aba === "individual" ? "active" : ""} onClick={() => setAba("individual")}>Editar individual</button>
          <button type="button" className={aba === "lote" ? "active" : ""} onClick={() => setAba("lote")}>Editar lote</button>
          <button type="button" className={aba === "pagar" ? "active" : ""} onClick={() => setAba("pagar")}>Contas a pagar</button>
          <button type="button" className={aba === "novo_pagar" ? "active" : ""} onClick={() => setAba("novo_pagar")}>Novo a pagar</button>
          <button type="button" className={aba === "recibo" ? "active" : ""} onClick={() => setAba("recibo")}>Recibo</button>
          <button type="button" className={aba === "metas" ? "active" : ""} onClick={() => setAba("metas")}>Metas</button>
          <button type="button" className={aba === "notas_fiscais" ? "active" : ""} onClick={() => setAba("notas_fiscais")}>NF emitidas</button>
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
                  <div className="module-subitem finance-module-subitem" key={item.id} onDoubleClick={() => abrirRecebivelParaEdicao(item.id)}>
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
                    {(mostrarTodosRecebiveis ? STATUS_RECEBIVEIS : STATUS_RECEBIVEIS_VISIVEIS).map((item) => <option key={item} value={item}>{item}</option>)}
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
                  <span>Vencimento de</span>
                  <input type="date" value={filtroVencimentoRecebivelInicio} onChange={(e) => setFiltroVencimentoRecebivelInicio(e.target.value)} />
                </label>
                <label>
                  <span>Vencimento até</span>
                  <input type="date" value={filtroVencimentoRecebivelFim} onChange={(e) => setFiltroVencimentoRecebivelFim(e.target.value)} />
                </label>
                <label>
                  <span>Ordenar por</span>
                  <select value={ordenacaoCobranca} onChange={(e) => setOrdenacaoCobranca(e.target.value as OrdenacaoCobranca)}>
                    <option value="nome">Paciente</option>
                    <option value="vencimento">Vencimento</option>
                    <option value="valor">Valor</option>
                    <option value="status">Status</option>
                    <option value="prontuario">Prontuário</option>
                  </select>
                </label>
                <label>
                  <span>Direção</span>
                  <select value={direcaoCobranca} onChange={(e) => setDirecaoCobranca(e.target.value as "asc" | "desc")}>
                    <option value="asc">Crescente</option>
                    <option value="desc">Decrescente</option>
                  </select>
                </label>
              </div>
              <div className="finance-form-actions">
                <button
                  type="button"
                  className="ghost-action"
                  onClick={() => setMostrarTodosRecebiveis((atual) => !atual)}
                >
                  {mostrarTodosRecebiveis ? "Ocultar suspensos/cancelados" : "Exibir tudo"}
                </button>
                <button type="button" className="ghost-action" onClick={limparFiltrosRecebiveis}>Limpar filtros</button>
              </div>
            </article>
            <article className="panel finance-form-panel"><span>Total filtrado</span><strong>{`R$ ${recebiveisFiltrados.reduce((total, item) => total + moedaParaNumero(item.valor), 0).toFixed(2).replace(".", ",")}`}</strong></article>
            <article className="panel finance-form-panel"><span>Parcelas filtradas</span><strong>{String(recebiveisFiltrados.length)}</strong></article>
            <article className="panel finance-form-panel"><span>Pacientes únicos</span><strong>{String(new Set(recebiveisFiltrados.map((i) => i.pacienteNome || "")).size)}</strong></article>
            <article className="panel finance-module-list finance-span-all">
              <span className="panel-kicker">Grade de recebíveis</span>
              <div className="finance-form-actions finance-book-actions">
                <button type="button" className="ghost-action" onClick={exportarRecebiveisFiltrados} disabled={!recebiveisFiltrados.length}>
                  Baixar relatório
                </button>
              </div>
              <div className="finance-receivables-grid-shell">
                <table className="finance-receivables-grid">
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Prontuário</th>
                      <th>Parcela</th>
                      <th>Vencimento</th>
                      <th>Valor</th>
                      <th>Forma</th>
                      <th>Status</th>
                      <th>Data da baixa</th>
                      <th>Observação</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recebiveisFiltrados.length ? recebiveisFiltrados.map((item) => {
                      const linha = recebiveisGrid[item.id] || recebivelParaForm(item);
                      return (
                        <tr key={item.id}>
                          <td className="finance-receivables-patient-cell">
                            <input
                              type="text"
                              className="finance-receivables-patient-input"
                              title={linha.pacienteNome || item.pacienteNome || ""}
                              value={linha.pacienteNome}
                              onChange={(e) => atualizarRecebivelGrid(item.id, "pacienteNome", e.target.value)}
                            />
                          </td>
                          <td>
                            <input type="text" value={linha.prontuario} onChange={(e) => atualizarRecebivelGrid(item.id, "prontuario", e.target.value)} />
                          </td>
                          <td>
                            <span className="finance-grid-static-cell">{labelParcela(item.parcela)}</span>
                          </td>
                          <td>
                            <input type="date" value={linha.vencimento} onChange={(e) => atualizarRecebivelGrid(item.id, "vencimento", e.target.value)} />
                          </td>
                          <td>
                            <input type="text" value={linha.valor} onChange={(e) => atualizarRecebivelGrid(item.id, "valor", e.target.value)} />
                          </td>
                          <td>
                            <select value={linha.formaPagamento} onChange={(e) => atualizarRecebivelGrid(item.id, "formaPagamento", e.target.value)}>
                              {FORMAS.map((forma) => <option key={forma} value={forma}>{forma}</option>)}
                            </select>
                          </td>
                          <td>
                            <select value={linha.status} onChange={(e) => atualizarRecebivelGrid(item.id, "status", e.target.value)}>
                              {STATUS_RECEBIVEIS.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </td>
                          <td>
                            <input type="date" value={linha.dataPagamento} onChange={(e) => atualizarRecebivelGrid(item.id, "dataPagamento", e.target.value)} />
                          </td>
                          <td>
                            <input type="text" value={linha.observacao} onChange={(e) => atualizarRecebivelGrid(item.id, "observacao", e.target.value)} />
                          </td>
                          <td>
                            <div className="finance-grid-actions">
                              <button type="button" className="ghost-action compact" onClick={() => { setRecebivelSelecionadoId(item.id); setAba("individual"); }}>
                                Abrir
                              </button>
                              <button type="button" className="primary-action compact" disabled={salvando} onClick={() => void salvarRecebivelLinha(item.id)}>
                                Salvar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={10}>
                          <div className="empty-inline">Nenhum recebível encontrado.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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

        {!carregando && aba === "metas" ? (
          <div className="finance-legacy-grid">
            <article className="panel finance-form-panel">
              <span className="panel-kicker">Meta mensal</span>
              <div className="finance-form-grid">
                <label>
                  <span>Ano</span>
                  <input
                    type="number"
                    value={metasAno}
                    onChange={(e) => {
                      const ano = Number(e.target.value) || new Date().getFullYear();
                      setMetasAno(ano);
                      setMetaForm((atual) => ({ ...atual, ano }));
                    }}
                  />
                </label>
                <label>
                  <span>Mês</span>
                  <select
                    value={metaForm.mes}
                    onChange={(e) => setMetaForm((atual) => ({ ...atual, mes: Number(e.target.value) }))}
                  >
                    {MESES_ANO.map((item) => <option key={item.valor} value={item.valor}>{item.rotulo}</option>)}
                  </select>
                </label>
                <label>
                  <span>Meta</span>
                  <input type="text" value={metaForm.meta} onChange={(e) => setMetaForm((atual) => ({ ...atual, meta: e.target.value }))} />
                </label>
                <label>
                  <span>Supermeta</span>
                  <input type="text" value={metaForm.supermeta} onChange={(e) => setMetaForm((atual) => ({ ...atual, supermeta: e.target.value }))} />
                </label>
                <label>
                  <span>Hipermeta</span>
                  <input type="text" value={metaForm.hipermeta} onChange={(e) => setMetaForm((atual) => ({ ...atual, hipermeta: e.target.value }))} />
                </label>
              </div>
              <div className="finance-form-actions">
                <button type="button" className="primary-action" disabled={salvando} onClick={() => void salvarMetaMensal()}>Salvar metas do mês</button>
              </div>
            </article>

            <article className="panel finance-module-list finance-span-all">
              <span className="panel-kicker">Planejamento do ano</span>
              <div className="module-sublist">
                {metasMensais.length ? metasMensais.map((item) => (
                  <div className="module-subitem finance-module-subitem" key={`${item.ano}-${item.mes}`}>
                    <div>
                      <strong>{item.mesNome}</strong>
                      <span>Meta {numeroParaMoedaBr(item.meta)} · Supermeta {numeroParaMoedaBr(item.supermeta)} · Hipermeta {numeroParaMoedaBr(item.hipermeta)}</span>
                    </div>
                    <div className="module-subitem-right">
                      <strong>{item.dataAtualizacao ? `Atualizado ${item.dataAtualizacao}` : "Sem ajuste"}</strong>
                      <div className="finance-inline-actions">
                        <button type="button" className="ghost-action compact" onClick={() => setMetaForm(metaParaForm(item))}>Editar</button>
                      </div>
                    </div>
                  </div>
                )) : <div className="empty-inline">Nenhuma meta mensal cadastrada.</div>}
              </div>
            </article>
          </div>
        ) : null}

        {!carregando && aba === "notas_fiscais" ? (
          <div className="finance-legacy-grid">
            <article className="panel finance-form-panel finance-span-all">
              <span className="panel-kicker">{notaFiscalForm.id ? "Editar NF emitida" : "Nova NF emitida"}</span>
              <div className="finance-form-grid">
                <label><span>Competência</span><input type="month" value={notaFiscalForm.competencia} onChange={(e) => setNotaFiscalForm((atual) => ({ ...atual, competencia: e.target.value }))} /></label>
                <label><span>Data emissão</span><input type="date" value={notaFiscalForm.dataEmissao} onChange={(e) => setNotaFiscalForm((atual) => ({ ...atual, dataEmissao: e.target.value }))} /></label>
                <label><span>Data recebimento</span><input type="date" value={notaFiscalForm.dataRecebimento} onChange={(e) => setNotaFiscalForm((atual) => ({ ...atual, dataRecebimento: e.target.value }))} /></label>
                <label><span>Número NF</span><input type="text" value={notaFiscalForm.numeroNf} onChange={(e) => setNotaFiscalForm((atual) => ({ ...atual, numeroNf: e.target.value }))} /></label>
                <label><span>Série</span><input type="text" value={notaFiscalForm.serie} onChange={(e) => setNotaFiscalForm((atual) => ({ ...atual, serie: e.target.value }))} /></label>
                <label><span>Conta de entrada</span><select value={notaFiscalForm.contaDestino} onChange={(e) => setNotaFiscalForm((atual) => ({ ...atual, contaDestino: e.target.value }))}>{CONTAS_CAIXA.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="finance-span-2"><span>Cliente / tomador</span><input type="text" value={notaFiscalForm.cliente} onChange={(e) => setNotaFiscalForm((atual) => ({ ...atual, cliente: e.target.value }))} /></label>
                <label className="finance-span-2"><span>Descrição</span><input type="text" value={notaFiscalForm.descricao} onChange={(e) => setNotaFiscalForm((atual) => ({ ...atual, descricao: e.target.value }))} /></label>
                <label><span>Valor da NF</span><input type="text" value={notaFiscalForm.valorNf} onChange={(e) => setNotaFiscalForm((atual) => ({ ...atual, valorNf: e.target.value }))} /></label>
                <label><span>Valor recebido</span><input type="text" value={notaFiscalForm.valorRecebido} onChange={(e) => setNotaFiscalForm((atual) => ({ ...atual, valorRecebido: e.target.value }))} /></label>
                <label><span>Status</span><select value={notaFiscalForm.status} onChange={(e) => setNotaFiscalForm((atual) => ({ ...atual, status: e.target.value }))}>{STATUS_NOTA_FISCAL.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="finance-span-2"><span>Observação</span><textarea rows={3} value={notaFiscalForm.observacao} onChange={(e) => setNotaFiscalForm((atual) => ({ ...atual, observacao: e.target.value }))} /></label>
              </div>
              <div className="finance-form-actions">
                <button type="button" className="ghost-action" onClick={() => setNotaFiscalForm(NOTA_FISCAL_INICIAL)}>Limpar</button>
                <button type="button" className="primary-action" disabled={salvando} onClick={() => void salvarNotaFiscal()}>Salvar NF</button>
              </div>
            </article>

            <article className="panel finance-form-panel"><span>Total NF</span><strong>{numeroParaMoedaBr(resumoNotasFiscais.totalNf)}</strong></article>
            <article className="panel finance-form-panel"><span>Total recebido</span><strong>{numeroParaMoedaBr(resumoNotasFiscais.totalRecebido)}</strong></article>
            <article className="panel finance-form-panel"><span>Diferença acumulada</span><strong>{numeroParaMoedaBr(resumoNotasFiscais.totalDiferenca)}</strong></article>
            <article className="panel finance-form-panel"><span>Pendentes de conferência</span><strong>{String(resumoNotasFiscais.quantidadePendentes)}</strong></article>

            <article className="panel finance-module-list finance-span-all">
              <span className="panel-kicker">Controle de NF emitidas</span>
              <div className="module-sublist">
                {notasFiscaisOrdenadas.length ? notasFiscaisOrdenadas.map((item) => (
                  <div className="module-subitem finance-module-subitem" key={item.id}>
                    <div>
                      <strong>{item.numeroNf ? `NF ${item.numeroNf}` : "NF sem número"} · {item.cliente || "Sem cliente"}</strong>
                      <span>{item.competencia || "-"} · {item.dataEmissao || "-"} · {item.contaDestino || "-"} · {item.descricao || "Sem descrição"}</span>
                    </div>
                    <div className="module-subitem-right">
                      <strong>{item.diferenca}</strong>
                      <div className="finance-inline-actions">
                        <span className={`module-status-badge ${item.conciliado ? "ok" : "pendente"}`}>{item.conciliado ? "Conciliada" : item.status || "Pendente"}</span>
                        <button type="button" className="ghost-action compact" onClick={() => setNotaFiscalForm(notaFiscalParaForm(item))}>Editar</button>
                      </div>
                    </div>
                  </div>
                )) : <div className="empty-inline">Nenhuma NF emitida cadastrada ainda.</div>}
              </div>
            </article>
          </div>
        ) : null}

        {!carregando && aba === "cobrancas" ? (
          <div className="finance-legacy-grid">
            <article className="panel finance-form-panel finance-span-all">
              <span className="panel-kicker">Cobranças</span>
              <div className="finance-form-grid">
                <label className="finance-span-2">
                  <span>Pesquisar devedor</span>
                  <input
                    type="text"
                    placeholder="Nome, prontuário, parcela ou vencimento"
                    value={buscaRecebivel}
                    onChange={(e) => setBuscaRecebivel(e.target.value)}
                  />
                </label>
                <label>
                  <span>Status</span>
                  <select value={filtroStatusRecebivel} onChange={(e) => setFiltroStatusRecebivel(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="Atrasado">Atrasado</option>
                    <option value="Aberto">Em aberto</option>
                  </select>
                </label>
                <label>
                  <span>Vencimento de</span>
                  <input type="date" value={filtroVencimentoRecebivelInicio} onChange={(e) => setFiltroVencimentoRecebivelInicio(e.target.value)} />
                </label>
                <label>
                  <span>Vencimento até</span>
                  <input type="date" value={filtroVencimentoRecebivelFim} onChange={(e) => setFiltroVencimentoRecebivelFim(e.target.value)} />
                </label>
              </div>
              <div className="finance-form-actions">
                <button type="button" className="ghost-action" onClick={limparFiltrosCobrancas}>Limpar filtros</button>
              </div>
            </article>

            <article className="panel finance-form-panel"><span>Total devedor</span><strong>{`R$ ${totalCobrancas.toFixed(2).replace(".", ",")}`}</strong></article>
            <article className="panel finance-form-panel"><span>Parcelas devedoras</span><strong>{String(cobrancasFiltradas.length)}</strong></article>
            <article className="panel finance-form-panel"><span>Pacientes devedores</span><strong>{String(totalPacientesCobranca)}</strong></article>

            <article className="panel finance-module-list finance-span-all">
              <span className="panel-kicker">Lista de cobranças</span>
              <div className="finance-receivables-grid-shell finance-collections-grid-shell">
                <table className="finance-receivables-grid finance-collections-grid">
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Prontuário</th>
                      <th>Parcela</th>
                      <th>Vencimento</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th>Cobrei agora</th>
                      <th>Nova observação</th>
                      <th>Histórico</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobrancasOrdenadas.length ? cobrancasOrdenadas.map((item) => {
                      const linha = recebiveisGrid[item.id] || recebivelParaForm(item);
                      const historico = item.historicoCobranca || [];
                      return (
                        <tr key={item.id}>
                          <td className="finance-receivables-patient-cell">
                            <div className="finance-collections-patient">
                              <strong>{linha.pacienteNome || item.pacienteNome || "Paciente"}</strong>
                              <span>{item.formaPagamento || "-"}</span>
                            </div>
                          </td>
                          <td>
                            <span className="finance-grid-static-cell">{linha.prontuario || "-"}</span>
                          </td>
                          <td>
                            <span className="finance-grid-static-cell">{labelParcela(item.parcela)}</span>
                          </td>
                          <td>
                            <input type="date" value={linha.vencimento} onChange={(e) => atualizarRecebivelGrid(item.id, "vencimento", e.target.value)} />
                          </td>
                          <td>
                            <input type="text" value={linha.valor} onChange={(e) => atualizarRecebivelGrid(item.id, "valor", e.target.value)} />
                          </td>
                          <td>
                            <select value={linha.status} onChange={(e) => atualizarRecebivelGrid(item.id, "status", e.target.value)}>
                              <option value="Atrasado">Atrasado</option>
                              <option value="Aberto">Aberto</option>
                              <option value="Pago">Pago</option>
                              <option value="Suspenso">Suspenso</option>
                              <option value="Cancelado">Cancelado</option>
                            </select>
                          </td>
                          <td>
                            <label className="finance-check-row finance-collections-check">
                              <input
                                type="checkbox"
                                checked={linha.cobrancaRealizada}
                                onChange={(e) => atualizarRecebivelGrid(item.id, "cobrancaRealizada", e.target.checked)}
                              />
                              <span>Sim</span>
                            </label>
                          </td>
                          <td>
                            <textarea
                              rows={4}
                              className="finance-collections-textarea"
                              placeholder="Ex.: liguei, não atendeu, pediu retorno sexta..."
                              value={linha.observacaoCobranca}
                              onChange={(e) => atualizarRecebivelGrid(item.id, "observacaoCobranca", e.target.value)}
                            />
                          </td>
                          <td>
                            <div className="finance-history-list finance-collections-history">
                              {historico.length ? historico.map((registro) => (
                                <div key={registro.id} className="finance-history-item">
                                  <strong>{registro.criadoEm || "Sem data"} · {registro.criadoPor || "-"}</strong>
                                  <span>{registro.status || (registro.cobrado ? "Cobrado" : "Contato")}</span>
                                  <span>{registro.observacao || "-"}</span>
                                </div>
                              )) : <span className="finance-collections-empty">Sem histórico ainda.</span>}
                            </div>
                          </td>
                          <td>
                            <div className="finance-grid-actions finance-collections-actions">
                              <button type="button" className="ghost-action compact" onClick={() => { setRecebivelSelecionadoId(item.id); setAba("individual"); }}>
                                Abrir
                              </button>
                              <button type="button" className="primary-action compact" disabled={salvando} onClick={() => void salvarRecebivelLinha(item.id)}>
                                Salvar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={10}>
                          <div className="empty-inline">Nenhum devedor encontrado.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                  <label className="finance-check-row finance-span-2">
                    <input
                      type="checkbox"
                      checked={recebivelForm.cobrancaRealizada}
                      onChange={(e) => setRecebivelForm((a) => a ? { ...a, cobrancaRealizada: e.target.checked } : a)}
                    />
                    <span>Marcar que cobrei este recebível agora</span>
                  </label>
                  <label className="finance-span-2">
                    <span>Nova observação de cobrança</span>
                    <textarea
                      rows={3}
                      placeholder="Ex.: cobrei por WhatsApp, prometeu pagar sexta, não atendeu..."
                      value={recebivelForm.observacaoCobranca}
                      onChange={(e) => setRecebivelForm((a) => a ? { ...a, observacaoCobranca: e.target.value } : a)}
                    />
                  </label>
                  <div className="finance-span-2 finance-history-shell">
                    <strong>Histórico de cobranças</strong>
                    <div className="finance-history-list">
                      {(recebivelSelecionadoHistorico?.historicoCobranca || []).map((registro) => (
                        <div key={registro.id} className="finance-history-item">
                          <strong>{registro.criadoEm || "Sem data"} · {registro.criadoPor || "-"}</strong>
                          <span>{registro.status || (registro.cobrado ? "Cobrado" : "Contato")}</span>
                          <span>{registro.observacao || "-"}</span>
                        </div>
                      ))}
                      {!recebivelSelecionadoHistorico?.historicoCobranca?.length ? <span>Sem histórico ainda.</span> : null}
                    </div>
                  </div>
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
              <span className="panel-kicker">Renegociar recebíveis em lote</span>
              <div className="finance-dropdown-shell finance-dropdown-shell-inline">
                <label>
                  <span>Buscar por nome do paciente</span>
                  <input
                    type="text"
                    value={buscaLotePaciente}
                    onChange={(e) => {
                      setBuscaLotePaciente(e.target.value);
                      setLoteContratoId("");
                      setDropdownLoteAberto(Boolean(e.target.value.trim()));
                    }}
                    onFocus={() => {
                      setDropdownLoteAberto(true);
                    }}
                    placeholder="Digite o nome do paciente"
                  />
                </label>
                {dropdownLoteAberto ? (
                  <div className="finance-dropdown-list">
                    {lotesFiltrados.length ? lotesFiltrados.map((item) => (
                      <button
                        key={item.loteId}
                        type="button"
                        className="finance-dropdown-item"
                        onClick={() => selecionarLote(item)}
                      >
                        <strong>{item.pacienteNome || "Paciente"}</strong>
                        <span>
                          Prontuário {item.prontuario || "-"} · {item.contratoId ? `Contrato #${item.contratoId}` : "Sem contrato vinculado"} · {item.quantidade} parcelas · início {item.primeiroVencimento || "-"}
                        </span>
                      </button>
                    )) : <div className="empty-inline">Nenhum contrato encontrado.</div>}
                  </div>
                ) : null}
              </div>
              {loteSelecionado ? (
                <span className="finance-selected-helper">
                  Selecionado: {loteSelecionado.contratoId ? `Contrato #${loteSelecionado.contratoId}` : "Lote sem contrato vinculado"}
                </span>
              ) : null}
              {loteSelecionado ? (
                <>
                  <div className="finance-mini-metrics">
                    <div><span>Parcelas atuais</span><strong>{String(recebiveisDoLote.length)}</strong></div>
                    <div><span>Saldo atual</span><strong>{numeroParaMoedaBr(totalRecebiveisDoLote)}</strong></div>
                    <div><span>Novas parcelas</span><strong>{String(renegociacaoParcelas.length)}</strong></div>
                    <div><span>Novo total</span><strong>{numeroParaMoedaBr(totalRenegociacao)}</strong></div>
                  </div>
                  <div className="finance-form-grid">
                    <label><span>Nome do paciente</span><input type="text" value={loteSelecionado.pacienteNome} readOnly /></label>
                    <label><span>Prontuário</span><input type="text" value={loteSelecionado.prontuario} readOnly /></label>
                    <label><span>Contrato</span><input type="text" value={loteSelecionado.contratoId ? `#${loteSelecionado.contratoId}` : "Sem contrato vinculado"} readOnly /></label>
                    <label><span>Primeiro vencimento atual</span><input type="text" value={loteSelecionado.primeiroVencimento || "-"} readOnly /></label>
                    <label className="finance-span-2">
                      <span>Observação da renegociação</span>
                      <textarea
                        value={renegociacaoObservacao}
                        onChange={(e) => setRenegociacaoObservacao(e.target.value)}
                        placeholder="Ex.: saldo renegociado com a paciente em novo cronograma."
                        rows={3}
                      />
                    </label>
                  </div>
                  <div className="module-sublist">
                    <span className="panel-kicker">Recebíveis atuais que serão suspensos</span>
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
                  <div className="module-sublist">
                    <span className="panel-kicker">Novos recebíveis substitutos</span>
                    <div className="finance-form-grid finance-span-all">
                      <label>
                        <span>Quantidade de parcelas</span>
                        <input
                          type="text"
                          value={geradorRenegociacao.quantidade}
                          onChange={(e) => setGeradorRenegociacao((atual) => ({ ...atual, quantidade: e.target.value.replace(/\D/g, "") }))}
                        />
                      </label>
                      <label>
                        <span>Primeiro vencimento</span>
                        <input
                          type="date"
                          value={geradorRenegociacao.primeiroVencimento}
                          onChange={(e) => setGeradorRenegociacao((atual) => ({ ...atual, primeiroVencimento: e.target.value }))}
                        />
                      </label>
                      <label>
                        <span>Valor de cada parcela</span>
                        <input
                          type="text"
                          value={geradorRenegociacao.valor}
                          onChange={(e) => setGeradorRenegociacao((atual) => ({ ...atual, valor: e.target.value }))}
                          placeholder="0,00"
                        />
                      </label>
                      <label>
                        <span>Forma de pagamento</span>
                        <select
                          value={geradorRenegociacao.formaPagamento}
                          onChange={(e) => setGeradorRenegociacao((atual) => ({ ...atual, formaPagamento: e.target.value }))}
                        >
                          {FORMAS.map((forma) => <option key={forma} value={forma}>{forma}</option>)}
                        </select>
                      </label>
                      <label className="finance-span-2">
                        <span>Observação para todas as parcelas</span>
                        <input
                          type="text"
                          value={geradorRenegociacao.observacao}
                          onChange={(e) => setGeradorRenegociacao((atual) => ({ ...atual, observacao: e.target.value }))}
                          placeholder="Opcional"
                        />
                      </label>
                      <div className="finance-form-actions finance-span-2">
                        <button type="button" className="ghost-action" disabled={salvando} onClick={gerarParcelasRenegociacao}>
                          Gerar parcelas iguais
                        </button>
                      </div>
                    </div>
                    {renegociacaoParcelas.length ? renegociacaoParcelas.map((item, indice) => (
                      <div className="finance-form-grid finance-span-all" key={`renegociacao-${indice}`}>
                        <label>
                          <span>Parcela</span>
                          <input type="text" value={String(indice + 1)} readOnly />
                        </label>
                        <label>
                          <span>Vencimento</span>
                          <input type="date" value={item.vencimento} onChange={(e) => atualizarParcelaRenegociacao(indice, "vencimento", e.target.value)} />
                        </label>
                        <label>
                          <span>Valor</span>
                          <input type="text" value={item.valor} onChange={(e) => atualizarParcelaRenegociacao(indice, "valor", e.target.value)} placeholder="0,00" />
                        </label>
                        <label>
                          <span>Forma de pagamento</span>
                          <select value={item.formaPagamento} onChange={(e) => atualizarParcelaRenegociacao(indice, "formaPagamento", e.target.value)}>
                            {FORMAS.map((forma) => <option key={forma} value={forma}>{forma}</option>)}
                          </select>
                        </label>
                        <label className="finance-span-2">
                          <span>Observação da parcela</span>
                          <input type="text" value={item.observacao} onChange={(e) => atualizarParcelaRenegociacao(indice, "observacao", e.target.value)} placeholder="Opcional" />
                        </label>
                        <div className="finance-form-actions finance-span-2">
                          <button
                            type="button"
                            className="ghost-action danger"
                            onClick={() => removerParcelaRenegociacao(indice)}
                            disabled={salvando || renegociacaoParcelas.length === 1}
                          >
                            Remover parcela
                          </button>
                        </div>
                      </div>
                    )) : <span className="empty-inline">Adicione pelo menos uma nova parcela para concluir a renegociação.</span>}
                  </div>
                  <div className="finance-form-actions">
                    <button type="button" className="ghost-action danger" disabled={salvando} onClick={() => void suspenderRecebiveisLote()}>
                      Suspender parcelas ativas
                    </button>
                    <button type="button" className="ghost-action" disabled={salvando} onClick={adicionarParcelaRenegociacao}>Adicionar parcela</button>
                    <button type="button" className="primary-action" disabled={salvando || !renegociacaoParcelas.length} onClick={() => void salvarRecebiveisLote()}>
                      Suspender antigas e lançar novas
                    </button>
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
                  <span>Vencimento de</span>
                  <input type="date" value={filtroVencimentoPagarInicio} onChange={(e) => setFiltroVencimentoPagarInicio(e.target.value)} />
                </label>
                <label>
                  <span>Vencimento até</span>
                  <input type="date" value={filtroVencimentoPagarFim} onChange={(e) => setFiltroVencimentoPagarFim(e.target.value)} />
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
