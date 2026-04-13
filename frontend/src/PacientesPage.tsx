import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, ChevronDown, FileText, IdCard, Mail, MoreVertical, Pencil, Phone, Plus, Printer, Search, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  marcarPacienteFinalizadoCrmApi,
  alterarStatusOrcamentoPacienteApi,
  buscarCepApi,
  baixarRecebivelPacienteApi,
  detalharOrcamentoPacienteApi,
  criarOrcamentoPacienteApi,
  criarPacienteApi,
  enviarFotoPacienteApi,
  fichaPacienteApi,
  listarPacientesApi,
  listarProcedimentosApi,
  listarOrdensServicoPacienteApi,
  criarOrdemServicoPacienteApi,
  odontogramaPacienteApi,
  atualizarRecebivelPacienteApi,
  urlDocumentoPaciente,
  urlReciboPaciente,
  urlExamePaciente,
  urlFotoPaciente,
  type OrcamentoPacientePayload,
  type ParcelaPagamentoApi,
  type RecebivelAtualizacaoPayload,
  type RecebivelResumoApi,
  atualizarOrcamentoPacienteApi,
  type ArquivoPacienteItemApi,
  type FichaPacienteApi,
  type PacienteApiPayload,
  type PacienteDetalheApi,
  type PacienteResumoApi,
  type ProcedimentoResumoApi,
  type OrdemServicoResumoApi,
  atualizarPacienteApi
} from "./pacientesApi";
import { Odontograma } from "./Odontograma";
import logoSoulSul from "./assets/logo-soul-sul.png";

type PacientesPageProps = {
  busca: string;
  pacientesAbas?: Record<string, string>;
  navegacao?: {
    pacienteId?: number;
    abaPrincipal?: "Cadastro" | "Financeiro" | "Agendamentos";
    abaClinica?: string;
    abrirOrcamento?: boolean;
    abrirNovoPaciente?: boolean;
    chave: number;
  } | null;
};

type PacienteForm = {
  nome: string;
  apelido: string;
  sexo: string;
  prontuario: string;
  cpf: string;
  rg: string;
  dataNascimento: string;
  telefone: string;
  email: string;
  cep: string;
  endereco: string;
  complemento: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  estadoCivil: string;
  profissao: string;
  origem: string;
  observacoes: string;
  menorIdade: boolean;
  responsavel: string;
  cpfResponsavel: string;
};

type AbaPrincipal = "Cadastro" | "Financeiro" | "Agendamentos" | "Clínico" | "Documentos" | "Comercial" | "Ordem de serviço";
type AbaClinica = "Plano e ficha clínica" | "Odontograma";
type AbaDocumentos = "Documentos" | "Exames" | "Recibos";
type CadastroSecao = "dados" | "contato" | "complementares";
type AbaFicha = {
  label: string;
  principal: AbaPrincipal;
  clinica?: AbaClinica;
  documentos?: AbaDocumentos;
};

const OPCOES_SEXO = ["Feminino", "Masculino"] as const;
const ABAS_PRINCIPAIS: Array<{ key: AbaPrincipal; label: string }> = [
  { key: "Cadastro", label: "Cadastro" },
  { key: "Financeiro", label: "Financeiro" },
  { key: "Agendamentos", label: "Agenda" },
  { key: "Clínico", label: "Clínico" },
  { key: "Documentos", label: "Documentos" },
  { key: "Ordem de serviço", label: "Ordem de serviço" },
  { key: "Comercial", label: "Comercial" }
];
const ABAS_FICHA: AbaFicha[] = [
  { label: "Cadastro", principal: "Cadastro" as AbaPrincipal },
  { label: "Orçamentos", principal: "Comercial" as AbaPrincipal },
  { label: "Financeiro", principal: "Financeiro" as AbaPrincipal },
  { label: "Documentos", principal: "Documentos" as AbaPrincipal, documentos: "Documentos" as AbaDocumentos },
  { label: "Documentos", principal: "Documentos" as AbaPrincipal, documentos: "Exames" as AbaDocumentos },
  { label: "Documentos", principal: "Documentos" as AbaPrincipal, documentos: "Recibos" as AbaDocumentos },
  { label: "Ordem de serviço", principal: "Ordem de serviço" as AbaPrincipal },
  { label: "Plano e Ficha Clínica", principal: "Clínico" as AbaPrincipal, clinica: "Plano e ficha clínica" as AbaClinica },
  { label: "Odontograma", principal: "Clínico" as AbaPrincipal, clinica: "Odontograma" as AbaClinica },
  { label: "Agendamentos", principal: "Agendamentos" as AbaPrincipal }
] as const;

const MAPA_PERMISSAO_ABAS_PACIENTE: Record<string, string> = {
  Cadastro: "Cadastro",
  Orçamentos: "Orcamentos",
  Financeiro: "Financeiro",
  Documentos: "Documentos",
  "Ordem de serviço": "Documentos",
  "Plano e Ficha Clínica": "Plano e Ficha Clinica",
  Odontograma: "Odontograma",
  Agendamentos: "Agendamentos"
};

function nivelPermissao(valor?: string) {
  const texto = String(valor || "").toLowerCase();
  if (texto === "edicao") return 2;
  if (texto === "visualizacao") return 1;
  return 0;
}
const SECOES_CADASTRO = [
  { key: "dados" as CadastroSecao, label: "Dados Cadastrais" },
  { key: "contato" as CadastroSecao, label: "Contato" },
  { key: "complementares" as CadastroSecao, label: "Dados Complementares" }
] as const;
const MESES_ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const OPCOES_ESTADO_CIVIL = ["", "Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União estável"] as const;

const CLINICAS_ORCAMENTO = ["Soul Sul Clinica Integrada"];
const CRIADORES_ORCAMENTO = ["Avaliacao", "Juliana", "Recepcao"];
const TABELAS_ORCAMENTO = ["Soul Sul Clinica"];
const DENTICOES = ["Permanente", "Decidua"];
const PROFISSIONAIS_ORCAMENTO = ["Avaliacao", "Dra. Gabriela", "Dr. Caio", "Dra. Ester", "Dr. Ayrton"];
const FILEIRA_SUPERIOR_PERMANENTE = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const FILEIRA_INFERIOR_PERMANENTE = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const FILEIRA_SUPERIOR_DECIDUA = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const FILEIRA_INFERIOR_DECIDUA = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];
const OPCOES_ARCADA = ["Arcadas Superior e Inferior", "Arcada Superior", "Arcada Inferior"] as const;
const FACES_PADRAO = ["V", "D", "M", "C", "P", "I"] as const;
const FORMAS_PAGAMENTO: Array<{ value: FormaPagamentoOpcao; label: string }> = [
  { value: "PIX", label: "Pix" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CARTAO_CREDITO", label: "Cartao de Credito" },
  { value: "CARTAO_DEBITO", label: "Cartao de Debito" },
  { value: "DINHEIRO", label: "Dinheiro" }
];
const FORMAS_A_VISTA = new Set<FormaPagamentoOpcao>(["PIX", "CARTAO_DEBITO", "DINHEIRO"]);
const TAXA_CARTAO_CREDITO: Record<number, number> = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 1,
  6: 1,
  7: 1,
  8: 1,
  9: 1,
  10: 1,
  11: 1,
  12: 1
};

type ProcedimentoCatalogo = {
  id: number;
  nome: string;
  valor: number;
  categoria: string;
  duracaoPadraoMinutos?: number;
  ativo?: boolean;
  etapasPadrao?: string[];
  materiaisPadrao?: string[];
};

type OrdemServicoForm = {
  procedimentoId: string;
  material: string;
  materialOutro: string;
  cor: string;
  escala: string;
  elementoArcada: string;
  cargaImediata: boolean;
  retornoSolicitado: string;
  observacao: string;
  etapas: Array<{ id: number; etapa: string; descricaoOutro: string }>;
};

type RegiaoOrcamento = {
  id: number;
  nome: string;
  valor: number;
  ativo: boolean;
  faces: string[];
};

type ProcedimentoOrcamento = {
  id: number;
  nome: string;
  profissional: string;
  denticao: string;
  tabela: string;
  clinica: string;
  criadoPor: string;
  regioes: RegiaoOrcamento[];
  expandido: boolean;
};

type OrcamentoDraft = {
  clinica: string;
  criadoPor: string;
  data: string;
  observacoes: string;
  tabela: string;
  termoProcedimento: string;
  profissional: string;
  regiaoInput: string;
  regioesSelecionadas: string[];
  denticao: string;
  valorUnitario: string;
};

type FormaPagamentoOpcao = "PIX" | "BOLETO" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "DINHEIRO";

type ParcelaPagamento = {
  indice: number;
  descricao: string;
  data: string;
  forma: FormaPagamentoOpcao;
  valor: number;
  parcelasCartao: number;
};

type PlanoPagamento = {
  entrada: boolean;
  parcelas: number;
  linhas: ParcelaPagamento[];
};

type DescontoOrcamento = {
  percentual: string;
  valor: string;
  validade: string;
};

type RecebivelForm = {
  id: number;
  vencimento: string;
  valor: string;
  formaPagamento: string;
  status: string;
  dataPagamento: string;
  observacao: string;
};

type ResumoFinanceiroCards = {
  total: string;
  emAberto: string;
  atrasado: string;
  pagos: string;
};

const FORM_INICIAL: PacienteForm = {
  nome: "",
  apelido: "",
  sexo: "",
  prontuario: "",
  cpf: "",
  rg: "",
  dataNascimento: "",
  telefone: "",
  email: "",
  cep: "",
  endereco: "",
  complemento: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  estadoCivil: "",
  profissao: "",
  origem: "",
  observacoes: "",
  menorIdade: false,
  responsavel: "",
  cpfResponsavel: ""
};

const ORCAMENTO_INICIAL = (dataAtual: string): OrcamentoDraft => ({
  clinica: CLINICAS_ORCAMENTO[0],
  criadoPor: CRIADORES_ORCAMENTO[0],
  data: dataAtual,
  observacoes: "",
  tabela: TABELAS_ORCAMENTO[0],
  termoProcedimento: "",
  profissional: PROFISSIONAIS_ORCAMENTO[0],
  regiaoInput: "",
  regioesSelecionadas: [],
  denticao: DENTICOES[0],
  valorUnitario: ""
});

const DESCONTO_INICIAL: DescontoOrcamento = {
  percentual: "",
  valor: "",
  validade: ""
};

const MATERIAIS_ORDEM_SERVICO = [
  "Metal",
  "Barra",
  "Cera",
  "Mockup",
  "Cerâmica",
  "Cerômero",
  "Placa miorrelaxante",
  "Placa de clareamento",
  "Outro"
] as const;

const ORDEM_SERVICO_INICIAL: OrdemServicoForm = {
  procedimentoId: "",
  material: "",
  materialOutro: "",
  cor: "",
  escala: "",
  elementoArcada: "",
  cargaImediata: false,
  retornoSolicitado: "",
  observacao: "",
  etapas: [{ id: 1, etapa: "", descricaoOutro: "" }]
};

function normalizarTextoComparacao(valor: string) {
  return (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function arredondarCentavos(valor: number) {
  return Math.round((Number.isFinite(valor) ? valor : 0) * 100);
}

function distribuirTotalParcelas(valorTotal: number, quantidade: number) {
  const partes = Math.max(1, quantidade);
  const totalCentavos = arredondarCentavos(valorTotal);
  const base = Math.floor(totalCentavos / partes);
  const resto = totalCentavos - base * partes;
  return Array.from({ length: partes }, (_, indice) => (base + (indice < resto ? 1 : 0)) / 100);
}

function adicionarMesesData(dataIso: string, quantidadeMeses: number) {
  const base = dataIso || dataHojeIso();
  const [anoTexto, mesTexto, diaTexto] = base.split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);
  if (!ano || !mes || !dia) return base;
  const mesDestinoBase = mes - 1 + quantidadeMeses;
  const anoFinal = ano + Math.floor(mesDestinoBase / 12);
  const mesNormalizado = ((mesDestinoBase % 12) + 12) % 12;
  const ultimoDiaMes = new Date(anoFinal, mesNormalizado + 1, 0).getDate();
  const diaFinalNumero = Math.min(dia, ultimoDiaMes);
  const mesFinal = `${mesNormalizado + 1}`.padStart(2, "0");
  const diaFinal = `${diaFinalNumero}`.padStart(2, "0");
  return `${anoFinal}-${mesFinal}-${diaFinal}`;
}

function aplicarTaxaCartaoCredito(valor: number, parcelasCartao: number) {
  const fator = TAXA_CARTAO_CREDITO[Math.max(1, parcelasCartao)] ?? 1;
  return Math.round(valor * fator * 100) / 100;
}

function dataParcelaPagamento(dataBase: string, indice: number, entrada: boolean, forma: FormaPagamentoOpcao) {
  if (forma !== "BOLETO") return dataBase || dataHojeIso();
  const deslocamento = entrada ? Math.max(0, indice - 1) : indice;
  return adicionarMesesData(dataBase || dataHojeIso(), deslocamento);
}

function resumoFormaPagamento(plano: PlanoPagamento) {
  const formasAtivas = [...new Set(plano.linhas.map((linha) => linha.forma))];
  if (!formasAtivas.length) return "A Definir";
  if (formasAtivas.length === 1) return FORMAS_PAGAMENTO.find((item) => item.value === formasAtivas[0])?.label || "A Definir";
  return "Multiplas";
}

function normalizarPlanoPagamento(
  plano: PlanoPagamento | null | undefined,
  valorTotal: number,
  dataBase: string
): PlanoPagamento {
  const entrada = Boolean(plano?.entrada);
  const parcelas = Math.max(1, plano?.parcelas || 1);
  const totalLinhas = parcelas + (entrada ? 1 : 0);
  const valores = distribuirTotalParcelas(valorTotal, totalLinhas);

  const linhas = Array.from({ length: totalLinhas }, (_, indice) => {
    const linhaAnterior = plano?.linhas[indice];
    const descricao = entrada && indice === 0 ? "Entrada" : String(entrada ? indice : indice + 1);
    const forma = linhaAnterior?.forma || "PIX";
    const parcelasCartao = Math.max(1, linhaAnterior?.parcelasCartao || 1);
    const valorBase = valores[indice] || 0;
    return {
      indice,
      descricao,
      forma,
      parcelasCartao,
      data: dataParcelaPagamento(dataBase, indice, entrada, forma),
      valor: forma === "CARTAO_CREDITO" ? aplicarTaxaCartaoCredito(valorBase, parcelasCartao) : valorBase
    };
  });

  return { entrada, parcelas, linhas };
}

function recalcularPlanoPagamentoAPartir(
  plano: PlanoPagamento,
  valorTotal: number,
  dataBase: string,
  indiceBase: number
) {
  const linhas = [...plano.linhas];
  if (!linhas.length) return normalizarPlanoPagamento(plano, valorTotal, dataBase);

  const indiceSeguro = Math.min(Math.max(indiceBase, 0), linhas.length - 1);
  const somaAteBase = linhas
    .slice(0, indiceSeguro + 1)
    .reduce((total, linha) => total + (Number.isFinite(linha.valor) ? linha.valor : 0), 0);
  const restantes = linhas.length - (indiceSeguro + 1);
  const saldoRestante = Math.max(0, Math.round((valorTotal - somaAteBase) * 100) / 100);
  const distribuicao = distribuirTotalParcelas(saldoRestante, Math.max(restantes, 1));
  const dataBaseLinha = linhas[indiceSeguro]?.data || dataBase || dataHojeIso();

  const linhasRecalculadas = linhas.map((linha, indice) => {
    if (indice < indiceSeguro) return linha;
    if (indice === indiceSeguro) {
      return {
        ...linha,
        data: linha.data || dataBaseLinha,
        valor: linha.forma === "CARTAO_CREDITO"
          ? aplicarTaxaCartaoCredito(linha.valor, linha.parcelasCartao)
          : linha.valor
      };
    }
    const valorBase = distribuicao[indice - indiceSeguro - 1] || 0;
    return {
      ...linha,
      data: adicionarMesesData(dataBaseLinha, indice - indiceSeguro),
      valor: linha.forma === "CARTAO_CREDITO"
        ? aplicarTaxaCartaoCredito(valorBase, linha.parcelasCartao)
        : valorBase
    };
  });

  return {
    ...plano,
    linhas: linhasRecalculadas
  };
}

function planoPagamentoParaApi(plano: PlanoPagamento): ParcelaPagamentoApi[] {
  return plano.linhas.map((linha) => ({
    indice: linha.indice,
    descricao: linha.descricao,
    data: linha.data,
    forma: linha.forma,
    valor: linha.valor,
    parcelas_cartao: linha.parcelasCartao
  }));
}

function planoPagamentoDaApi(
  parcelasApi: ParcelaPagamentoApi[] | undefined,
  entrada: boolean | undefined,
  parcelas: number | undefined,
  valorTotal: number,
  dataBase: string
): PlanoPagamento {
  const base: PlanoPagamento = {
    entrada: Boolean(entrada),
    parcelas: Math.max(1, parcelas || 1),
    linhas: (parcelasApi || []).map((linha) => ({
      indice: linha.indice || 0,
      descricao: linha.descricao || "",
      data: linha.data || dataBase,
      forma: (linha.forma as FormaPagamentoOpcao) || "PIX",
      valor: Number(linha.valor || 0),
      parcelasCartao: Math.max(1, linha.parcelas_cartao || 1)
    }))
  };
  return normalizarPlanoPagamento(base, valorTotal, dataBase);
}

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

function resumoFinanceiroIndicador(indicador?: string) {
  const texto = (indicador || "").toLowerCase();
  if (texto.includes("atras")) return "atrasado";
  if (texto.includes("pend")) return "atencao";
  return "ok";
}

function mapPacienteParaForm(paciente?: PacienteDetalheApi | null): PacienteForm {
  if (!paciente) return FORM_INICIAL;
  return {
    nome: paciente.nome || "",
    apelido: paciente.apelido || "",
    sexo: paciente.sexo || "",
    prontuario: paciente.prontuario || "",
    cpf: paciente.cpf || "",
    rg: paciente.rg || "",
    dataNascimento: paciente.dataNascimento || "",
    telefone: paciente.telefone || "",
    email: paciente.email || "",
    cep: paciente.cep || "",
    endereco: paciente.endereco || "",
    complemento: paciente.complemento || "",
    numero: paciente.numero || "",
    bairro: paciente.bairro || "",
    cidade: paciente.cidade || "",
    estado: paciente.estado || "",
    estadoCivil: paciente.estadoCivil || "",
    profissao: paciente.profissao || "",
    origem: paciente.origem || "",
    observacoes: paciente.observacoes || "",
    menorIdade: Boolean(paciente.menorIdade),
    responsavel: paciente.responsavel || "",
    cpfResponsavel: paciente.cpfResponsavel || ""
  };
}

function mapFormParaPayload(form: PacienteForm): PacienteApiPayload {
  return {
    nome: form.nome.trim(),
    apelido: form.apelido.trim(),
    sexo: form.sexo.trim(),
    prontuario: form.prontuario.trim() || null,
    cpf: form.cpf.trim(),
    rg: form.rg.trim(),
    data_nascimento: form.dataNascimento.trim(),
    telefone: form.telefone.trim(),
    email: form.email.trim(),
    cep: form.cep.trim(),
    endereco: form.endereco.trim(),
    complemento: form.complemento.trim(),
    numero: form.numero.trim(),
    bairro: form.bairro.trim(),
    cidade: form.cidade.trim(),
    estado: form.estado.trim(),
    estado_civil: form.estadoCivil.trim(),
    profissao: form.profissao.trim(),
    origem: form.origem.trim(),
    observacoes: form.observacoes.trim(),
    menor_idade: form.menorIdade,
    responsavel: form.responsavel.trim(),
    cpf_responsavel: form.cpfResponsavel.trim()
  };
}

function formatarArquivo(arquivo: ArquivoPacienteItemApi) {
  return arquivo.nome || arquivo.caminho.split(/[\\/]/).pop() || "Arquivo";
}

function abrirArquivo(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function extrairNascimentoInfo(data: string) {
  const match = (data || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return { dia: "", mes: "", ano: "", idade: "" };
  }
  const [, dia, mes, ano] = match;
  const hoje = new Date();
  const nascimento = new Date(Number(ano), Number(mes) - 1, Number(dia));
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const antesDoAniversario =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
  if (antesDoAniversario) idade -= 1;

  return {
    dia,
    mes: MESES_ABREV[Number(mes) - 1] || "",
    ano,
    idade: idade > 0 ? String(idade) : ""
  };
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseMoeda(valor: string | number | null | undefined) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const texto = String(valor ?? "").trim();
  if (!texto) return 0;
  const normalizado = texto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

function formatarMoedaInput(valor: string | number | null | undefined) {
  const texto = String(valor ?? "");
  const somenteDigitos = texto.replace(/\D/g, "");
  if (!somenteDigitos) return "";
  return formatarMoeda(Number(somenteDigitos) / 100);
}

function clamp(numero: number, min: number, max: number) {
  return Math.min(Math.max(numero, min), max);
}

function dataBrParaIso(valor?: string) {
  const texto = String(valor || "").trim();
  const match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function recebivelParaForm(item: RecebivelResumoApi): RecebivelForm {
  return {
    id: item.id,
    vencimento: dataBrParaIso(item.vencimento),
    valor: item.valor || "",
    formaPagamento: item.formaPagamento || "PIX",
    status: item.status || "Aberto",
    dataPagamento: dataBrParaIso(item.dataPagamento),
    observacao: item.observacao || ""
  };
}

function resumoFinanceiroCards(ficha?: FichaPacienteApi | null): ResumoFinanceiroCards {
  if (!ficha) {
    return { total: formatarMoeda(0), emAberto: formatarMoeda(0), atrasado: formatarMoeda(0), pagos: formatarMoeda(0) };
  }

  const resumo = ficha.financeiro;
  if (resumo) {
    return {
      total: resumo.total || formatarMoeda(0),
      emAberto: resumo.emAberto || formatarMoeda(0),
      atrasado: resumo.atrasado || formatarMoeda(0),
      pagos: resumo.pagos || formatarMoeda(0)
    };
  }

  const acumulado = ficha.recebiveis.reduce((total, item) => {
    const valor = parseMoeda(item.valor);
    const status = (item.status || "").toLowerCase();
    total.total += valor;
    if (status.includes("pago")) total.pagos += valor;
    else if (status.includes("atras")) total.atrasado += valor;
    else total.emAberto += valor;
    return total;
  }, { total: 0, emAberto: 0, atrasado: 0, pagos: 0 });

  return {
    total: formatarMoeda(acumulado.total),
    emAberto: formatarMoeda(acumulado.emAberto),
    atrasado: formatarMoeda(acumulado.atrasado),
    pagos: formatarMoeda(acumulado.pagos)
  };
}

function dataHojeIso() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = `${hoje.getMonth() + 1}`.padStart(2, "0");
  const dia = `${hoje.getDate()}`.padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarDataHora(valor?: string) {
  const texto = String(valor || "").trim();
  if (!texto) return "";
  const data = new Date(texto.replace(" ", "T"));
  if (Number.isNaN(data.getTime())) return texto;
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatarDataCurta(valor?: string) {
  const texto = String(valor || "").trim();
  if (!texto) return "";
  const data = new Date(texto.length <= 10 ? `${texto}T00:00:00` : texto.replace(" ", "T"));
  if (Number.isNaN(data.getTime())) return texto;
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function normalizarRegiao(valor: string) {
  return valor.trim().replace(/\s+/g, " ");
}

function fileirasDenticao(denticao: string) {
  if (denticao === "Decidua") {
    return {
      superior: FILEIRA_SUPERIOR_DECIDUA,
      inferior: FILEIRA_INFERIOR_DECIDUA
    };
  }
  return {
    superior: FILEIRA_SUPERIOR_PERMANENTE,
    inferior: FILEIRA_INFERIOR_PERMANENTE
  };
}

function selecaoEhArcada(valor: string) {
  return OPCOES_ARCADA.includes(valor as (typeof OPCOES_ARCADA)[number]);
}

function ordenarRegioes(denticao: string, regioes: string[]) {
  const ordemDentes = [...fileirasDenticao(denticao).superior, ...fileirasDenticao(denticao).inferior].map(String);
  return [...regioes].sort((a, b) => {
    const arcadaA = OPCOES_ARCADA.indexOf(a as (typeof OPCOES_ARCADA)[number]);
    const arcadaB = OPCOES_ARCADA.indexOf(b as (typeof OPCOES_ARCADA)[number]);
    if (arcadaA >= 0 && arcadaB >= 0) return arcadaA - arcadaB;
    if (arcadaA >= 0) return -1;
    if (arcadaB >= 0) return 1;
    const indiceA = ordemDentes.indexOf(a);
    const indiceB = ordemDentes.indexOf(b);
    if (indiceA >= 0 && indiceB >= 0) return indiceA - indiceB;
    if (indiceA >= 0) return -1;
    if (indiceB >= 0) return 1;
    return a.localeCompare(b, "pt-BR");
  });
}

function dentesDaSelecaoRegiao(valor: string, denticao: string) {
  const regiao = normalizarRegiao(valor);
  if (!regiao) return [];
  const fileiras = fileirasDenticao(denticao);
  if (regiao === "Arcada Superior") return fileiras.superior.map(String);
  if (regiao === "Arcada Inferior") return fileiras.inferior.map(String);
  if (regiao === "Arcadas Superior e Inferior") return [...fileiras.superior, ...fileiras.inferior].map(String);
  return [regiao];
}

function normalizarSelecaoRegiao(valor: string) {
  const regiao = normalizarRegiao(valor);
  if (!regiao) return "";
  if (regiao === "Arcada Completa") return "Arcadas Superior e Inferior";
  return regiao;
}

function subtotalProcedimento(item: ProcedimentoOrcamento) {
  return item.regioes.filter((regiao) => regiao.ativo).reduce((total, regiao) => total + regiao.valor, 0);
}

function limparCamposResponsavel(form: PacienteForm): PacienteForm {
  return {
    ...form,
    responsavel: "",
    cpfResponsavel: ""
  };
}

function mapProcedimentoCatalogoApi(item: ProcedimentoResumoApi): ProcedimentoCatalogo {
  return {
    id: item.id,
    nome: item.nome,
    valor: item.valorPadrao,
    categoria: item.categoria || "",
    duracaoPadraoMinutos: item.duracaoPadraoMinutos || 60,
    ativo: item.ativo,
    etapasPadrao: item.etapasPadrao || [],
    materiaisPadrao: item.materiaisPadrao || []
  };
}

export function PacientesPage({ busca, navegacao, pacientesAbas = {} }: PacientesPageProps) {
  const [pacientes, setPacientes] = useState<PacienteResumoApi[]>([]);
  const [pacienteAtivoId, setPacienteAtivoId] = useState<number | null>(null);
  const [ficha, setFicha] = useState<FichaPacienteApi | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [orcamentoAtivoId, setOrcamentoAtivoId] = useState<number | null>(null);
  const [novoForm, setNovoForm] = useState<PacienteForm>(FORM_INICIAL);
  const [editForm, setEditForm] = useState<PacienteForm>(FORM_INICIAL);
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [abaPrincipal, setAbaPrincipal] = useState<AbaPrincipal>("Cadastro");
  const [abaClinica, setAbaClinica] = useState<AbaClinica>("Plano e ficha clínica");
  const [abaDocumentos, setAbaDocumentos] = useState<AbaDocumentos>("Documentos");
  const [secaoCadastro, setSecaoCadastro] = useState<CadastroSecao>("dados");
  const [modalOrcamentoAberto, setModalOrcamentoAberto] = useState(false);
  const [orcamentoEditandoId, setOrcamentoEditandoId] = useState<number | null>(null);
  const [orcamentoStatusAtual, setOrcamentoStatusAtual] = useState<"EM_ABERTO" | "APROVADO">("EM_ABERTO");
  const [orcamentoDraft, setOrcamentoDraft] = useState<OrcamentoDraft>(() => ORCAMENTO_INICIAL(dataHojeIso()));
  const [planoPagamento, setPlanoPagamento] = useState<PlanoPagamento>(() => normalizarPlanoPagamento(null, 0, dataHojeIso()));
  const [planoPagamentoEditor, setPlanoPagamentoEditor] = useState<PlanoPagamento>(() => normalizarPlanoPagamento(null, 0, dataHojeIso()));
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [valoresParcelasEditando, setValoresParcelasEditando] = useState<Record<number, string>>({});
  const [procedimentosCatalogo, setProcedimentosCatalogo] = useState<ProcedimentoCatalogo[]>([]);
  const [procedimentoSelecionado, setProcedimentoSelecionado] = useState<ProcedimentoCatalogo | null>(null);
  const [procedimentosOrcamento, setProcedimentosOrcamento] = useState<ProcedimentoOrcamento[]>([]);
  const [dentesContratados, setDentesContratados] = useState<number[]>([]);
  const [odontogramaElementos, setOdontogramaElementos] = useState<Array<{
    elemento: string;
    dente?: number | null;
    denticao?: string;
    procedimentos: string[];
  }>>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServicoResumoApi[]>([]);
  const [ordemServicoForm, setOrdemServicoForm] = useState<OrdemServicoForm>(ORDEM_SERVICO_INICIAL);
  const [salvandoOrdemServico, setSalvandoOrdemServico] = useState(false);
  const [salvandoCrmFinalizado, setSalvandoCrmFinalizado] = useState(false);
  const [denticaoClinica, setDenticaoClinica] = useState<"Permanente" | "Decidua">("Permanente");
  const [elementoClinicoAtivo, setElementoClinicoAtivo] = useState<number[]>([]);
  const [salvandoOrcamento, setSalvandoOrcamento] = useState(false);
  const [confirmarDesaprovarId, setConfirmarDesaprovarId] = useState<number | null>(null);
  const [alterandoStatusOrcamentoId, setAlterandoStatusOrcamentoId] = useState<number | null>(null);
  const [menuOrcamentoAberto, setMenuOrcamentoAberto] = useState(false);
  const [modoReordenarOrcamento, setModoReordenarOrcamento] = useState(false);
  const [modalDescontoAberto, setModalDescontoAberto] = useState(false);
  const [descontoOrcamento, setDescontoOrcamento] = useState<DescontoOrcamento>(DESCONTO_INICIAL);
  const [descontoEditor, setDescontoEditor] = useState<DescontoOrcamento>(DESCONTO_INICIAL);
  const [modalRecebivelAberto, setModalRecebivelAberto] = useState(false);
  const [recebivelForm, setRecebivelForm] = useState<RecebivelForm | null>(null);
  const [salvandoRecebivel, setSalvandoRecebivel] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [fotoVersao, setFotoVersao] = useState(0);
  const [fotoErro, setFotoErro] = useState(false);
  const ultimoCepNovo = useRef("");
  const ultimoCepEdicao = useRef("");
  const inputFotoPacienteRef = useRef<HTMLInputElement | null>(null);

  const pacienteDetalhe = ficha?.paciente ?? null;
  const fotoPacienteSrc = pacienteDetalhe?.fotoUrl ? `${urlFotoPaciente(pacienteDetalhe.id)}?v=${fotoVersao}` : "";
  const buscaAtiva = busca.trim().length > 0;
  const nascimentoInfo = extrairNascimentoInfo(editForm.dataNascimento);
  const orcamentoBloqueado = orcamentoStatusAtual === "APROVADO";
  const financeiroResumo = useMemo(() => resumoFinanceiroCards(ficha), [ficha]);
  const dentesSelecionadosOdontograma = useMemo(
    () =>
      [...new Set(
        orcamentoDraft.regioesSelecionadas
          .flatMap((item) => dentesDaSelecaoRegiao(item, orcamentoDraft.denticao))
          .filter((item) => /^\d+$/.test(item))
          .map((item) => Number(item))
      )],
    [orcamentoDraft.regioesSelecionadas]
  );
  const elementosOdontogramaVisiveis = useMemo(
    () =>
      odontogramaElementos.filter((item) => {
        if (item.dente == null) return true;
        return (item.denticao || "Permanente") === denticaoClinica;
      }),
    [odontogramaElementos, denticaoClinica]
  );
  const dentesContratadosClinicos = useMemo(
    () =>
      dentesContratados.filter((dente) => (
        denticaoClinica === "Decidua" ? dente >= 51 && dente <= 85 : dente < 50
      )),
    [dentesContratados, denticaoClinica]
  );
  const elementosOdontogramaListados = useMemo(
    () => {
      if (!elementoClinicoAtivo.length) return elementosOdontogramaVisiveis;
      return elementosOdontogramaVisiveis.filter((item) => item.dente != null && elementoClinicoAtivo.includes(item.dente));
    },
    [elementoClinicoAtivo, elementosOdontogramaVisiveis]
  );
  const abasFichaDisponiveis = useMemo(
    () =>
      ABAS_FICHA.filter((aba) => {
        const chave = MAPA_PERMISSAO_ABAS_PACIENTE[aba.label] || aba.label;
        return nivelPermissao(String(pacientesAbas[chave] || "Sem acesso")) > 0;
      }),
    [pacientesAbas]
  );
  const acessoAbaAtual = useMemo(() => {
    const abaAtual = ABAS_FICHA.find((aba) => {
      if (aba.principal !== abaPrincipal) return false;
      if (aba.clinica && aba.clinica !== abaClinica) return false;
      if (aba.documentos && aba.documentos !== abaDocumentos) return false;
      return true;
    });
    if (!abaAtual) return 0;
    const chave = MAPA_PERMISSAO_ABAS_PACIENTE[abaAtual.label] || abaAtual.label;
    return nivelPermissao(String(pacientesAbas[chave] || "Sem acesso"));
  }, [abaPrincipal, abaClinica, abaDocumentos, pacientesAbas]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (confirmarDesaprovarId) {
        setConfirmarDesaprovarId(null);
        return;
      }
      if (modalRecebivelAberto) {
        setModalRecebivelAberto(false);
        return;
      }
      if (modalPagamentoAberto) {
        setModalPagamentoAberto(false);
        return;
      }
      if (modalDescontoAberto) {
        setModalDescontoAberto(false);
        return;
      }
      if (menuOrcamentoAberto) {
        setMenuOrcamentoAberto(false);
        return;
      }
      if (modalOrcamentoAberto) {
        setModalOrcamentoAberto(false);
        return;
      }
      if (modalNovoAberto) {
        setModalNovoAberto(false);
        return;
      }
      if (orcamentoAtivoId) {
        setOrcamentoAtivoId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    confirmarDesaprovarId,
    menuOrcamentoAberto,
    modalDescontoAberto,
    modalNovoAberto,
    modalOrcamentoAberto,
    modalPagamentoAberto,
    modalRecebivelAberto,
    orcamentoAtivoId
  ]);

  async function carregarLista() {
    setCarregandoLista(true);
    setErro(null);
    try {
      const lista = await listarPacientesApi(busca);
      setPacientes(lista);
      const alvoId = navegacao?.pacienteId ?? (buscaAtiva ? null : null);
      if (alvoId) setPacienteAtivoId(alvoId);
      if (buscaAtiva && !navegacao?.pacienteId) {
        setPacienteAtivoId(null);
        setFicha(null);
      } else if (!buscaAtiva && !navegacao?.pacienteId) {
        setPacienteAtivoId(null);
        setFicha(null);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar pacientes.");
    } finally {
      setCarregandoLista(false);
    }
  }

  async function carregarFicha(pacienteId: number) {
    setCarregandoFicha(true);
    setErro(null);
    try {
      const [resposta, odontograma] = await Promise.all([
        fichaPacienteApi(pacienteId),
        odontogramaPacienteApi(pacienteId).catch(() => ({ dentes_contratados: [], elementos: [] }))
      ]);
      const ordens = await listarOrdensServicoPacienteApi(pacienteId).catch(() => []);
      setFicha(resposta);
      setDentesContratados(odontograma.dentes_contratados || []);
      setOdontogramaElementos(odontograma.elementos || []);
      setOrdensServico(ordens);
      setElementoClinicoAtivo([]);
      setEditForm(mapPacienteParaForm(resposta.paciente));
      if (navegacao?.abrirOrcamento && resposta.contratos[0]) {
        setOrcamentoAtivoId(resposta.contratos[0].id);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar ficha do paciente.");
      setDentesContratados([]);
      setOdontogramaElementos([]);
      setOrdensServico([]);
    } finally {
      setCarregandoFicha(false);
    }
  }

  useEffect(() => {
    carregarLista();
  }, [busca]);

  useEffect(() => {
    let ativo = true;
    listarProcedimentosApi("")
      .then((lista) => {
        if (!ativo) return;
        setProcedimentosCatalogo(lista.map(mapProcedimentoCatalogoApi));
      })
      .catch(() => {
        if (!ativo) return;
        setProcedimentosCatalogo([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (pacienteAtivoId) carregarFicha(pacienteAtivoId);
    else setFicha(null);
  }, [pacienteAtivoId]);

  useEffect(() => {
    if (!navegacao) return;
    if (navegacao.abrirNovoPaciente) {
      setModalNovoAberto(true);
      setPacienteAtivoId(null);
      setFicha(null);
    } else if (navegacao.pacienteId) {
      setPacienteAtivoId(navegacao.pacienteId);
    }
    if (navegacao.abrirOrcamento) setAbaPrincipal("Comercial");
    else if (navegacao.abaPrincipal) setAbaPrincipal(navegacao.abaPrincipal);
  }, [navegacao]);

  useEffect(() => {
    if (acessoAbaAtual > 0) return;
    const primeiraAba = abasFichaDisponiveis[0];
    if (!primeiraAba) return;
    setAbaPrincipal(primeiraAba.principal);
    if (primeiraAba.clinica) setAbaClinica(primeiraAba.clinica);
    if (primeiraAba.documentos) setAbaDocumentos(primeiraAba.documentos);
  }, [abasFichaDisponiveis, acessoAbaAtual]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    const cep = novoForm.cep.replace(/\D/g, "");
    if (cep.length !== 8 || cep === ultimoCepNovo.current) return;
    const timer = window.setTimeout(async () => {
      await aplicarCep(novoForm, setNovoForm);
      ultimoCepNovo.current = cep;
    }, 350);
    return () => window.clearTimeout(timer);
  }, [novoForm.cep]);

  useEffect(() => {
    const cep = editForm.cep.replace(/\D/g, "");
    if (cep.length !== 8 || cep === ultimoCepEdicao.current) return;
    const timer = window.setTimeout(async () => {
      await aplicarCep(editForm, setEditForm);
      ultimoCepEdicao.current = cep;
    }, 350);
    return () => window.clearTimeout(timer);
  }, [editForm.cep]);

  const procedimentosFiltrados = useMemo(() => {
    const termo = orcamentoDraft.termoProcedimento.trim().toLowerCase();
    if (!termo) return [];
    return procedimentosCatalogo.filter((item) => item.nome.toLowerCase().includes(termo)).slice(0, 8);
  }, [orcamentoDraft.termoProcedimento, procedimentosCatalogo]);
  const totalOrcamento = useMemo(
    () => procedimentosOrcamento.reduce((total, item) => total + subtotalProcedimento(item), 0),
    [procedimentosOrcamento]
  );
  const descontoPercentualAplicado = useMemo(
    () => clamp(parseMoeda(descontoOrcamento.percentual), 0, 100),
    [descontoOrcamento.percentual]
  );
  const descontoValorAplicado = useMemo(
    () => clamp(parseMoeda(descontoOrcamento.valor), 0, totalOrcamento),
    [descontoOrcamento.valor, totalOrcamento]
  );
  const totalDesconto = useMemo(
    () => Math.min(totalOrcamento, Math.round(((totalOrcamento * descontoPercentualAplicado / 100) + descontoValorAplicado) * 100) / 100),
    [descontoPercentualAplicado, descontoValorAplicado, totalOrcamento]
  );
  const totalOrcamentoFinal = useMemo(
    () => Math.max(0, Math.round((totalOrcamento - totalDesconto) * 100) / 100),
    [totalDesconto, totalOrcamento]
  );
  const procedimentoOrdemServicoSelecionado = useMemo(
    () => procedimentosCatalogo.find((item) => item.id === Number(ordemServicoForm.procedimentoId)) || null,
    [ordemServicoForm.procedimentoId, procedimentosCatalogo]
  );
  const materiaisOrdemServicoDisponiveis = useMemo(() => {
    if (!procedimentoOrdemServicoSelecionado) return [...MATERIAIS_ORDEM_SERVICO];
    const materiais = (procedimentoOrdemServicoSelecionado.materiaisPadrao || []).filter(Boolean);
    return materiais.length ? materiais : [...MATERIAIS_ORDEM_SERVICO];
  }, [procedimentoOrdemServicoSelecionado]);
  const procedimentosContratadosPaciente = useMemo(() => {
    const nomesContratados = new Set(
      (ficha?.contratos || [])
        .filter((contrato) => (contrato.status || "").toUpperCase() === "APROVADO")
        .flatMap((contrato) => contrato.procedimentos || [])
        .map((nome) => normalizarTextoComparacao(nome))
        .filter(Boolean)
    );
    return procedimentosCatalogo.filter((item) =>
      item.ativo !== false && nomesContratados.has(normalizarTextoComparacao(item.nome))
    );
  }, [ficha?.contratos, procedimentosCatalogo]);

  useEffect(() => {
    setPlanoPagamento((atual) => normalizarPlanoPagamento(atual, totalOrcamentoFinal, orcamentoDraft.data));
  }, [totalOrcamentoFinal, orcamentoDraft.data]);

  useEffect(() => {
    if (!modalPagamentoAberto) return;
    setPlanoPagamentoEditor((atual) => normalizarPlanoPagamento(atual, totalOrcamentoFinal, orcamentoDraft.data));
  }, [modalPagamentoAberto, totalOrcamentoFinal, orcamentoDraft.data]);

  useEffect(() => {
    if (!ordemServicoForm.material) return;
    if (materiaisOrdemServicoDisponiveis.includes(ordemServicoForm.material)) return;
    setOrdemServicoForm((atual) => ({
      ...atual,
      material: "",
      materialOutro: ""
    }));
  }, [materiaisOrdemServicoDisponiveis, ordemServicoForm.material]);

  async function salvarNovoPaciente() {
    setSalvandoNovo(true);
    setErro(null);
    try {
      const criado = await criarPacienteApi(mapFormParaPayload(novoForm));
      setModalNovoAberto(false);
      setNovoForm(FORM_INICIAL);
      setFeedback("Paciente criado com sucesso.");
      await carregarLista();
      setPacienteAtivoId(criado.id);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao criar paciente.");
    } finally {
      setSalvandoNovo(false);
    }
  }

  async function salvarEdicaoPaciente() {
    if (!pacienteAtivoId) return;
    setSalvandoEdicao(true);
    setErro(null);
    try {
      await atualizarPacienteApi(pacienteAtivoId, mapFormParaPayload(editForm));
      setFeedback("Paciente atualizado com sucesso.");
      await carregarLista();
      await carregarFicha(pacienteAtivoId);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao atualizar paciente.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function enviarPacienteFinalizadoParaCrm() {
    if (!pacienteAtivoId) return;
    setSalvandoCrmFinalizado(true);
    setErro(null);
    try {
      await marcarPacienteFinalizadoCrmApi(pacienteAtivoId);
      setFeedback("Paciente enviado para a lista de finalizados do CRM.");
      await carregarFicha(pacienteAtivoId);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao enviar paciente para o CRM.");
    } finally {
      setSalvandoCrmFinalizado(false);
    }
  }

  async function enviarFotoPaciente(event: ChangeEvent<HTMLInputElement>) {
    if (!pacienteAtivoId) return;
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;
    setEnviandoFoto(true);
    setErro(null);
    try {
      await enviarFotoPacienteApi(pacienteAtivoId, arquivo);
      setFotoErro(false);
      setFotoVersao(Date.now());
      setFeedback("Foto do paciente atualizada com sucesso.");
      await carregarLista();
      await carregarFicha(pacienteAtivoId);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao enviar foto do paciente.");
    } finally {
      setEnviandoFoto(false);
      event.target.value = "";
    }
  }

  useEffect(() => {
    setFotoErro(false);
    setFotoVersao(Date.now());
  }, [pacienteDetalhe?.id, pacienteDetalhe?.fotoUrl]);

  async function aplicarCep(form: PacienteForm, setter: (valor: PacienteForm) => void) {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const dados = await buscarCepApi(cep);
      setter({
        ...form,
        endereco: dados.logradouro || "",
        bairro: dados.bairro || "",
        cidade: dados.localidade || "",
        estado: dados.uf || ""
      });
    } catch {
      return;
    }
  }

  function abrirModalPagamento() {
    if (orcamentoBloqueado) return;
    setValoresParcelasEditando({});
    setPlanoPagamentoEditor(normalizarPlanoPagamento(planoPagamento, totalOrcamentoFinal, orcamentoDraft.data));
    setModalPagamentoAberto(true);
  }

  function fecharModalPagamento() {
    setValoresParcelasEditando({});
    setModalPagamentoAberto(false);
  }

  function confirmarModalPagamento() {
    setValoresParcelasEditando({});
    setPlanoPagamento(normalizarPlanoPagamento(planoPagamentoEditor, totalOrcamentoFinal, orcamentoDraft.data));
    setModalPagamentoAberto(false);
  }

  function atualizarPlanoPagamentoBase(campo: "entrada" | "parcelas", valor: boolean | number) {
    setPlanoPagamentoEditor((atual) => normalizarPlanoPagamento({
      ...atual,
      [campo]: valor
    }, totalOrcamentoFinal, orcamentoDraft.data));
  }

  function atualizarFormaParcela(indice: number, forma: FormaPagamentoOpcao) {
    setPlanoPagamentoEditor((atual) => recalcularPlanoPagamentoAPartir({
      ...atual,
      linhas: atual.linhas.map((linha, linhaIndice) => {
        if (linhaIndice < indice) return linha;
        return {
          ...linha,
          forma,
          parcelasCartao: forma === "CARTAO_CREDITO" ? Math.max(1, linha.parcelasCartao || 1) : 1
        };
      })
    }, totalOrcamentoFinal, orcamentoDraft.data, indice));
  }

  function atualizarParcelasCartao(indice: number, parcelasCartao: number) {
    setPlanoPagamentoEditor((atual) => recalcularPlanoPagamentoAPartir({
      ...atual,
      linhas: atual.linhas.map((linha, linhaIndice) => linhaIndice === indice ? { ...linha, parcelasCartao: Math.max(1, parcelasCartao) } : linha)
    }, totalOrcamentoFinal, orcamentoDraft.data, indice));
  }

  function atualizarValorParcela(indice: number, valorTexto: string) {
    const valor = parseMoeda(valorTexto);
    setPlanoPagamentoEditor((atual) => recalcularPlanoPagamentoAPartir({
      ...atual,
      linhas: atual.linhas.map((linha, linhaIndice) => linhaIndice === indice ? { ...linha, valor } : linha)
    }, totalOrcamentoFinal, orcamentoDraft.data, indice));
  }

  function iniciarEdicaoValorParcela(indice: number, valor: number) {
    setValoresParcelasEditando((atual) => ({
      ...atual,
      [indice]: valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }));
  }

  function alterarTextoValorParcela(indice: number, valorTexto: string) {
    setValoresParcelasEditando((atual) => ({
      ...atual,
      [indice]: valorTexto
    }));
  }

  function concluirEdicaoValorParcela(indice: number) {
    const valorTexto = valoresParcelasEditando[indice];
    if (valorTexto != null) {
      atualizarValorParcela(indice, valorTexto);
    }
    setValoresParcelasEditando((atual) => {
      const proximo = { ...atual };
      delete proximo[indice];
      return proximo;
    });
  }

  function atualizarDataParcela(indice: number, data: string) {
    setPlanoPagamentoEditor((atual) => recalcularPlanoPagamentoAPartir({
      ...atual,
      linhas: atual.linhas.map((linha, linhaIndice) => linhaIndice === indice ? { ...linha, data } : linha)
    }, totalOrcamentoFinal, orcamentoDraft.data, indice));
  }

  function abrirRecebivel(item: RecebivelResumoApi) {
    setRecebivelForm(recebivelParaForm(item));
    setModalRecebivelAberto(true);
  }

  function fecharRecebivel() {
    if (salvandoRecebivel) return;
    setModalRecebivelAberto(false);
    setRecebivelForm(null);
  }

  async function salvarRecebivel(payloadOverride?: Partial<RecebivelAtualizacaoPayload>) {
    if (!pacienteAtivoId || !recebivelForm) return;
    setSalvandoRecebivel(true);
    setErro(null);
    try {
      const payload: RecebivelAtualizacaoPayload = {
        paciente_nome: ficha?.paciente.nome || "",
        prontuario: ficha?.paciente.prontuario || "",
        vencimento: recebivelForm.vencimento,
        valor: parseMoeda(recebivelForm.valor),
        forma_pagamento: recebivelForm.formaPagamento || "PIX",
        status: recebivelForm.status || "Aberto",
        data_pagamento: recebivelForm.dataPagamento,
        observacao: recebivelForm.observacao || "",
        ...payloadOverride
      };
      await atualizarRecebivelPacienteApi(pacienteAtivoId, recebivelForm.id, payload);
      setFeedback(payload.status === "Pago" ? "Parcela baixada com sucesso." : "Recebível atualizado com sucesso.");
      await carregarFicha(pacienteAtivoId);
      setModalRecebivelAberto(false);
      setRecebivelForm(null);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao atualizar recebível.");
    } finally {
      setSalvandoRecebivel(false);
    }
  }

  async function baixarRecebivel(item: RecebivelResumoApi) {
    if (!pacienteAtivoId) return;
    setSalvandoRecebivel(true);
    setErro(null);
    try {
      await baixarRecebivelPacienteApi(pacienteAtivoId, item.id, {
        data_pagamento: dataHojeIso(),
        forma_pagamento: item.formaPagamento || "PIX",
        conta_caixa: item.formaPagamento || "PIX",
        observacao: item.observacao || ""
      });
      setFeedback("Parcela baixada com sucesso.");
      await carregarFicha(pacienteAtivoId);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao baixar recebível.");
    } finally {
      setSalvandoRecebivel(false);
    }
  }

  function renderFinanceiroSection() {
    return (
      <div className="finance-shell">
        <div className="finance-overview">
          <div className="finance-summary-card">
            <span>Total</span>
            <strong>{financeiroResumo.total}</strong>
          </div>
          <div className="finance-summary-card">
            <span>Em aberto</span>
            <strong>{financeiroResumo.emAberto}</strong>
          </div>
          <div className="finance-summary-card finance-summary-card-alert">
            <span>Atrasado</span>
            <strong>{financeiroResumo.atrasado}</strong>
          </div>
          <div className="finance-summary-card finance-summary-card-ok">
            <span>Pagos</span>
            <strong>{financeiroResumo.pagos}</strong>
          </div>
        </div>

        {ficha?.recebiveis.length ? (
          <div className="finance-board">
            <div className="finance-board-header">
              <span>Parcela</span>
              <span>Vencimento</span>
              <span>Forma</span>
              <span>Valor</span>
              <span>Status</span>
              <span>Ações</span>
            </div>
            <div className="finance-board-body">
              {ficha.recebiveis.map((item) => (
                <div className="finance-row" key={item.id}>
                  <div className="finance-row-main">
                    <strong>{item.parcela ? `Parcela ${item.parcela}` : "Recebível avulso"}</strong>
                    <span>{item.observacao || "Plano de pagamento do paciente"}</span>
                  </div>
                  <span>{item.vencimento || "-"}</span>
                  <span>{item.formaPagamento || "-"}</span>
                  <strong>{item.valor}</strong>
                  <span className={`finance-status ${(item.status || "a-vencer").toLowerCase().replace(/\s+/g, "-")}`}>
                    {item.status || "A vencer"}
                  </span>
                  <div className="finance-row-actions">
                    {(item.status || "").toLowerCase().includes("pago") ? null : (
                      <button type="button" className="ghost-action compact" onClick={() => baixarRecebivel(item)} disabled={salvandoRecebivel}>
                        Baixar
                      </button>
                    )}
                    <button type="button" className="primary-action compact" onClick={() => abrirRecebivel(item)} disabled={salvandoRecebivel}>
                      Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : <span className="empty-inline">Sem lançamentos financeiros.</span>}
      </div>
    );
  }

  function abrirNovoOrcamento() {
    setOrcamentoDraft(ORCAMENTO_INICIAL(dataHojeIso()));
    setDescontoOrcamento(DESCONTO_INICIAL);
    setDescontoEditor(DESCONTO_INICIAL);
    setPlanoPagamento(normalizarPlanoPagamento(null, 0, dataHojeIso()));
    setPlanoPagamentoEditor(normalizarPlanoPagamento(null, 0, dataHojeIso()));
    setProcedimentoSelecionado(null);
    setProcedimentosOrcamento([]);
    setOrcamentoEditandoId(null);
    setOrcamentoStatusAtual("EM_ABERTO");
    setModalOrcamentoAberto(true);
  }

  async function abrirOrcamentoExistente(contratoId: number) {
    if (!pacienteAtivoId) return;
    setErro(null);
    try {
      const detalhe = await detalharOrcamentoPacienteApi(pacienteAtivoId, contratoId);
      setOrcamentoEditandoId(contratoId);
      setOrcamentoStatusAtual(detalhe.status === "APROVADO" ? "APROVADO" : "EM_ABERTO");
      setOrcamentoDraft({
        clinica: detalhe.clinica || CLINICAS_ORCAMENTO[0],
        criadoPor: detalhe.criadoPor || CRIADORES_ORCAMENTO[0],
        data: detalhe.data ? detalhe.data.split("/").reverse().join("-") : dataHojeIso(),
        observacoes: detalhe.observacoes || "",
        tabela: detalhe.tabela || TABELAS_ORCAMENTO[0],
        termoProcedimento: "",
        profissional: PROFISSIONAIS_ORCAMENTO[0],
        regiaoInput: "",
        regioesSelecionadas: [],
        denticao: DENTICOES[0],
        valorUnitario: ""
      });
      setDescontoOrcamento({
        percentual: detalhe.descontoPercentual ? String(detalhe.descontoPercentual).replace(".", ",") : "",
        valor: detalhe.descontoValor ? formatarMoeda(detalhe.descontoValor) : "",
        validade: detalhe.validadeOrcamento ? detalhe.validadeOrcamento.split("/").reverse().join("-") : ""
      });
      setDescontoEditor({
        percentual: detalhe.descontoPercentual ? String(detalhe.descontoPercentual).replace(".", ",") : "",
        valor: detalhe.descontoValor ? formatarMoeda(detalhe.descontoValor) : "",
        validade: detalhe.validadeOrcamento ? detalhe.validadeOrcamento.split("/").reverse().join("-") : ""
      });
      setProcedimentoSelecionado(null);
      const procedimentosCarregados = detalhe.itens.map((item, index) => ({
          id: contratoId * 1000 + index + 1,
          nome: item.procedimento,
          profissional: item.profissional,
          denticao: item.denticao,
          tabela: detalhe.tabela || TABELAS_ORCAMENTO[0],
          clinica: detalhe.clinica || CLINICAS_ORCAMENTO[0],
          criadoPor: detalhe.criadoPor || CRIADORES_ORCAMENTO[0],
          expandido: false,
          regioes: item.regioes.map((regiao, regiaoIndex) => ({
            id: contratoId * 100000 + index * 100 + regiaoIndex + 1,
            nome: regiao.regiao,
            valor: regiao.valor,
            ativo: regiao.ativo,
            faces: regiao.faces
          }))
        }));
      setProcedimentosOrcamento(procedimentosCarregados);
      const totalDetalhe = procedimentosCarregados.reduce((total, item) => total + subtotalProcedimento(item), 0);
      const planoCarregado = planoPagamentoDaApi(detalhe.planoPagamento, detalhe.entrada, detalhe.parcelas, totalDetalhe, detalhe.data ? detalhe.data.split("/").reverse().join("-") : dataHojeIso());
      setPlanoPagamento(planoCarregado);
      setPlanoPagamentoEditor(planoCarregado);
      setModalOrcamentoAberto(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar orçamento.");
    }
  }

  function selecionarProcedimento(item: ProcedimentoCatalogo) {
    setProcedimentoSelecionado(item);
    setOrcamentoDraft((atual) => ({
      ...atual,
      termoProcedimento: "",
      valorUnitario: formatarMoeda(item.valor),
      regiaoInput: atual.regiaoInput || "",
      regioesSelecionadas: atual.regioesSelecionadas
    }));
  }

  function adicionarRegiaoSelecionada(valor: string) {
    const regiao = normalizarSelecaoRegiao(valor);
    if (!regiao) return;
    setOrcamentoDraft((atual) => {
      if (atual.regioesSelecionadas.includes(regiao)) {
        return { ...atual, regiaoInput: "" };
      }
      let base = atual.regioesSelecionadas;
      if (regiao === "Arcadas Superior e Inferior") {
        base = base.filter((item) => item !== "Arcada Superior" && item !== "Arcada Inferior");
      } else if (regiao === "Arcada Superior" || regiao === "Arcada Inferior") {
        base = base.filter((item) => item !== "Arcadas Superior e Inferior");
      }
      return {
        ...atual,
        regiaoInput: "",
        regioesSelecionadas: ordenarRegioes(atual.denticao, [...base, regiao])
      };
    });
  }

  function removerRegiaoSelecionada(valor: string) {
    const regiao = normalizarSelecaoRegiao(valor);
    setOrcamentoDraft((atual) => ({
      ...atual,
      regioesSelecionadas: atual.regioesSelecionadas.filter((item) => item !== regiao)
    }));
  }

  function alternarRegiaoSelecionada(valor: string) {
    const regiao = normalizarSelecaoRegiao(valor);
    if (!regiao) return;
    setOrcamentoDraft((atual) => {
      const jaSelecionada = atual.regioesSelecionadas.includes(regiao);
      let base = atual.regioesSelecionadas;
      if (regiao === "Arcadas Superior e Inferior") {
        base = base.filter((item) => item !== "Arcada Superior" && item !== "Arcada Inferior");
      } else if (regiao === "Arcada Superior" || regiao === "Arcada Inferior") {
        base = base.filter((item) => item !== "Arcadas Superior e Inferior");
      }
      const proximas = jaSelecionada ? base.filter((item) => item !== regiao) : [...base, regiao];
      return {
        ...atual,
        regioesSelecionadas: ordenarRegioes(atual.denticao, proximas)
      };
    });
  }

  function atualizarFacesRegiao(procedimentoId: number, regiaoId: number, face: string) {
    setProcedimentosOrcamento((atual) => atual.map((item) => {
      if (item.id !== procedimentoId) return item;
      return {
        ...item,
        regioes: item.regioes.map((regiao) => {
          if (regiao.id !== regiaoId) return regiao;
          const faces = regiao.faces.includes(face)
            ? regiao.faces.filter((itemFace) => itemFace !== face)
            : [...regiao.faces, face];
          return { ...regiao, faces };
        })
      };
    }));
  }

  function atualizarValorRegiao(procedimentoId: number, regiaoId: number, valor: string) {
    const numerico = parseMoeda(valor);
    setProcedimentosOrcamento((atual) => atual.map((item) => {
      if (item.id !== procedimentoId) return item;
      return {
        ...item,
        regioes: item.regioes.map((regiao) => regiao.id === regiaoId ? { ...regiao, valor: Number.isFinite(numerico) ? numerico : 0 } : regiao)
      };
    }));
  }

  function alternarRegiaoAtiva(procedimentoId: number, regiaoId: number) {
    setProcedimentosOrcamento((atual) => atual.map((item) => {
      if (item.id !== procedimentoId) return item;
      return {
        ...item,
        regioes: item.regioes.map((regiao) => regiao.id === regiaoId ? { ...regiao, ativo: !regiao.ativo } : regiao)
      };
    }));
  }

  function alternarProcedimentoExpandido(procedimentoId: number) {
    setProcedimentosOrcamento((atual) => atual.map((item) => item.id === procedimentoId ? { ...item, expandido: !item.expandido } : item));
  }

  function moverProcedimentoOrcamento(procedimentoId: number, direcao: "up" | "down") {
    setProcedimentosOrcamento((atual) => {
      const indiceAtual = atual.findIndex((item) => item.id === procedimentoId);
      if (indiceAtual < 0) return atual;
      const proximoIndice = direcao === "up" ? indiceAtual - 1 : indiceAtual + 1;
      if (proximoIndice < 0 || proximoIndice >= atual.length) return atual;
      const copia = [...atual];
      const [item] = copia.splice(indiceAtual, 1);
      copia.splice(proximoIndice, 0, item);
      return copia;
    });
  }

  function imprimirOrcamentoAtual() {
    const validadeInformada = window.prompt("Informe a validade deste orçamento (DD/MM/AAAA):", descontoOrcamento.validade ? descontoOrcamento.validade.split("-").reverse().join("/") : "");
    if (validadeInformada === null) return;
    const validadeTexto = validadeInformada.trim() || "NÃO INFORMADA";
    const matchValidade = validadeInformada.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (matchValidade) {
      const iso = `${matchValidade[3]}-${matchValidade[2]}-${matchValidade[1]}`;
      setDescontoOrcamento((atual) => ({ ...atual, validade: iso }));
    }
    const janela = window.open("", "_blank", "width=960,height=720");
    if (!janela) return;
    const linhas = procedimentosOrcamento.map((item) => {
      const detalhes = item.regioes
        .filter((regiao) => regiao.ativo)
        .map((regiao) => `
          <tr>
            <td>${regiao.nome}</td>
            <td>${formatarMoeda(regiao.valor)}</td>
          </tr>
        `)
        .join("");
      if (!detalhes) return "";
      return `
        <section style="margin-bottom:24px;">
          <h3 style="margin:0 0 10px;font-size:18px;">${item.nome}</h3>
          <div style="margin-bottom:8px;color:#555;">${item.clinica} | ${item.profissional}</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="text-align:left;border-bottom:1px solid #ddd;padding:6px 0;">REGIÃO</th>
                <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px 0;">VALOR</th>
              </tr>
            </thead>
            <tbody>${detalhes}</tbody>
          </table>
          <div style="text-align:right;margin-top:8px;font-weight:700;">SUBTOTAL: ${formatarMoeda(subtotalProcedimento(item))}</div>
        </section>
      `;
    }).join("");

    janela.document.write(`
      <html>
        <head>
          <title>ORÇAMENTO</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #222; }
            h1 { margin: 0 0 12px; }
            h3 { text-transform: uppercase; }
            td { padding: 6px 0; border-bottom: 1px solid #eee; }
            .header { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; margin-bottom:28px; }
            .brand { display:flex; gap:14px; align-items:flex-start; }
            .brand-mark { width:150px; height:52px; display:flex; align-items:center; justify-content:flex-start; }
            .brand-mark img { display:block; max-width:150px; max-height:52px; object-fit:contain; }
            .brand-copy small { display:block; color:#6b645c; letter-spacing:.12em; text-transform:uppercase; margin-bottom:4px; }
            .warning { margin:18px 0 22px; padding:14px 16px; border:1px solid #d8c9aa; background:#fbf6ec; color:#5e5347; font-size:13px; line-height:1.5; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              <div class="brand-mark"><img src="${logoSoulSul}" alt="Soul Sul" /></div>
              <div class="brand-copy">
                <small>SOUL SUL CLÍNICA</small>
                <h1>ORÇAMENTO</h1>
              </div>
            </div>
            <div style="text-align:right;font-size:13px;line-height:1.6;">
              <div>RUA TENENTE CORONEL CARDOSO, 82, CENTRO.</div>
              <div>CAMPOS DOS GOYTACAZES/RJ</div>
              <div>CEP 28035-042</div>
              <div>WHATSAPP (22) 3025-4300</div>
            </div>
          </div>
          <div style="margin-bottom:24px;">
            <div><strong>CLÍNICA:</strong> ${orcamentoDraft.clinica}</div>
            <div><strong>CRIADO POR:</strong> ${orcamentoDraft.criadoPor}</div>
            <div><strong>DATA:</strong> ${orcamentoDraft.data}</div>
            <div><strong>VALIDADE:</strong> ${validadeTexto}</div>
          </div>
          <div class="warning">
            ESTE DOCUMENTO TEM CARÁTER EXCLUSIVO DE ORÇAMENTO E NÃO POSSUI VALIDADE DE CONTRATO. A FORMALIZAÇÃO CONTRATUAL SOMENTE OCORRE APÓS APROVAÇÃO E ASSINATURA DO INSTRUMENTO PRÓPRIO.
          </div>
          ${linhas}
          ${totalDesconto > 0 ? `<div style="margin-top:16px;text-align:right;color:#9d3d32;font-weight:700;">DESCONTO: ${descontoPercentualAplicado ? `${descontoPercentualAplicado.toFixed(2).replace(".", ",")}%` : ""}${descontoPercentualAplicado && descontoValorAplicado ? " + " : ""}${descontoValorAplicado ? formatarMoeda(descontoValorAplicado) : ""}</div>` : ""}
          <div style="margin-top:24px;font-size:20px;font-weight:800;text-align:right;">TOTAL: ${formatarMoeda(totalOrcamentoFinal)}</div>
        </body>
      </html>
    `);
    janela.document.close();
    janela.focus();
    janela.print();
  }

  function abrirModalDesconto() {
    if (orcamentoBloqueado) return;
    setDescontoEditor(descontoOrcamento);
    setMenuOrcamentoAberto(false);
    setModalDescontoAberto(true);
  }

  function confirmarDesconto() {
    const percentual = clamp(parseMoeda(descontoEditor.percentual), 0, 100);
    const valorFixo = clamp(parseMoeda(descontoEditor.valor), 0, totalOrcamento);
    setDescontoOrcamento({
      percentual: percentual ? String(percentual).replace(".", ",") : "",
      valor: valorFixo ? formatarMoeda(valorFixo) : "",
      validade: descontoEditor.validade
    });
    setModalDescontoAberto(false);
  }

  function resumoDescontoTexto() {
    if (!totalDesconto) return "";
    const partes: string[] = [];
    if (descontoValorAplicado) partes.push(formatarMoeda(descontoValorAplicado));
    if (descontoPercentualAplicado) partes.push(`${descontoPercentualAplicado.toFixed(2).replace(".", ",")}%`);
    return partes.join(" + ");
  }

  function redefinirOrdemServicoForm(procedimentoId = "") {
    setOrdemServicoForm({
      procedimentoId,
      material: "",
      materialOutro: "",
      cor: "",
      escala: "",
      elementoArcada: "",
      cargaImediata: false,
      retornoSolicitado: "",
      observacao: "",
      etapas: [{ id: Date.now(), etapa: "", descricaoOutro: "" }]
    });
  }

  function adicionarEtapaOrdemServico() {
    setOrdemServicoForm((atual) => ({
      ...atual,
      etapas: [...atual.etapas, { id: Date.now(), etapa: "", descricaoOutro: "" }]
    }));
  }

  function atualizarEtapaOrdemServico(etapaId: number, parcial: Partial<{ etapa: string; descricaoOutro: string }>) {
    setOrdemServicoForm((atual) => ({
      ...atual,
      etapas: atual.etapas.map((item) => item.id === etapaId ? {
        ...item,
        ...parcial,
        descricaoOutro: parcial.etapa && parcial.etapa !== "Outro" ? "" : (parcial.descricaoOutro ?? item.descricaoOutro)
      } : item)
    }));
  }

  function removerEtapaOrdemServico(etapaId: number) {
    setOrdemServicoForm((atual) => ({
      ...atual,
      etapas: atual.etapas.length <= 1 ? atual.etapas : atual.etapas.filter((item) => item.id !== etapaId)
    }));
  }

  async function salvarOrdemServicoPaciente() {
    if (!pacienteAtivoId || !procedimentoOrdemServicoSelecionado) return;
    const etapas = ordemServicoForm.etapas
      .map((item) => ({
        etapa: item.etapa.trim(),
        descricao_outro: item.descricaoOutro.trim()
      }))
      .filter((item) => item.etapa);
    if (!etapas.length) {
      setErro("Selecione ao menos uma etapa para a ordem de serviço.");
      return;
    }
    if (etapas.some((item) => item.etapa === "Outro" && !item.descricao_outro)) {
      setErro("Descreva a etapa quando selecionar Outro.");
      return;
    }
    if (!ordemServicoForm.material) {
      setErro("Selecione o material.");
      return;
    }
    if (ordemServicoForm.material === "Outro" && !ordemServicoForm.materialOutro.trim()) {
      setErro("Descreva o material quando selecionar Outro.");
      return;
    }
    if (!ordemServicoForm.elementoArcada.trim()) {
      setErro("Informe o elemento ou arcada.");
      return;
    }
    if (!ordemServicoForm.retornoSolicitado) {
      setErro("Informe a data de retorno solicitada.");
      return;
    }
    setSalvandoOrdemServico(true);
    setErro(null);
    try {
      const ordem = await criarOrdemServicoPacienteApi(pacienteAtivoId, {
        procedimento_id: procedimentoOrdemServicoSelecionado.id,
        material: ordemServicoForm.material,
        material_outro: ordemServicoForm.materialOutro,
        cor: ordemServicoForm.cor,
        escala: ordemServicoForm.escala,
        elemento_arcada: ordemServicoForm.elementoArcada,
        carga_imediata: ordemServicoForm.cargaImediata,
        retorno_solicitado: ordemServicoForm.retornoSolicitado,
        observacao: ordemServicoForm.observacao,
        etapas
      });
      setOrdensServico((atual) => [ordem, ...atual]);
      redefinirOrdemServicoForm("");
      setFeedback("Ordem de serviço salva.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar ordem de serviço.");
    } finally {
      setSalvandoOrdemServico(false);
    }
  }

  function excluirProcedimentoOrcamento(procedimentoId: number) {
    setProcedimentosOrcamento((atual) => atual.filter((item) => item.id !== procedimentoId));
  }

  function editarProcedimentoOrcamento(procedimentoId: number) {
    const item = procedimentosOrcamento.find((procedimento) => procedimento.id === procedimentoId);
    if (!item) return;
    const catalogo = procedimentosCatalogo.find((procedimento) => procedimento.nome === item.nome) ?? {
      id: item.id,
      nome: item.nome,
      valor: item.regioes[0]?.valor || 0,
      categoria: "Personalizado"
    };

    setProcedimentoSelecionado(catalogo);
    setOrcamentoDraft((atual) => ({
      ...atual,
      termoProcedimento: "",
      profissional: item.profissional,
      denticao: item.denticao,
      valorUnitario: formatarMoeda(item.regioes[0]?.valor || 0),
      regiaoInput: "",
      regioesSelecionadas: ordenarRegioes(item.denticao, item.regioes.map((regiao) => regiao.nome))
    }));
    setProcedimentosOrcamento((atual) => atual.filter((procedimento) => procedimento.id !== procedimentoId));
  }

  function alternarTodasRegioes(procedimentoId: number) {
    setProcedimentosOrcamento((atual) => atual.map((item) => {
      if (item.id !== procedimentoId) return item;
      const ativar = item.regioes.some((regiao) => !regiao.ativo);
      return {
        ...item,
        regioes: item.regioes.map((regiao) => ({ ...regiao, ativo: ativar }))
      };
    }));
  }

  function adicionarProcedimentoAoOrcamento() {
    if (!procedimentoSelecionado) return;
    const valor = parseMoeda(orcamentoDraft.valorUnitario || procedimentoSelecionado.valor || 0);
    const regioes = orcamentoDraft.regioesSelecionadas.length
      ? orcamentoDraft.regioesSelecionadas
      : (normalizarRegiao(orcamentoDraft.regiaoInput) ? [normalizarRegiao(orcamentoDraft.regiaoInput)] : []);
    if (!regioes.length) return;
    setProcedimentosOrcamento((atual) => [
      ...atual,
      {
        id: Date.now(),
        nome: procedimentoSelecionado.nome,
        profissional: orcamentoDraft.profissional,
        denticao: orcamentoDraft.denticao,
        tabela: orcamentoDraft.tabela,
        clinica: orcamentoDraft.clinica,
        criadoPor: orcamentoDraft.criadoPor,
        expandido: false,
        regioes: regioes.map((regiao, index) => ({
          id: Date.now() + index + 1,
          nome: regiao,
          valor,
          ativo: true,
          faces: [...FACES_PADRAO]
        }))
      }
    ]);
    setProcedimentoSelecionado(null);
    setOrcamentoDraft((atual) => ({
      ...atual,
      termoProcedimento: "",
      valorUnitario: "",
      regiaoInput: "",
      regioesSelecionadas: []
    }));
  }

  async function salvarOrcamentoPaciente() {
    if (!pacienteAtivoId) return;
    const itens = procedimentosOrcamento
      .map((item) => ({
        procedimento: item.nome,
        profissional: item.profissional,
        denticao: item.denticao,
        valor_unitario: item.regioes[0]?.valor || 0,
        regioes: item.regioes.map((regiao) => ({
          regiao: regiao.nome,
          dente: /^\d+$/.test(regiao.nome) ? Number(regiao.nome) : null,
          valor: regiao.valor,
          ativo: regiao.ativo,
          faces: regiao.faces
        }))
      }))
      .filter((item) => item.regioes.some((regiao) => regiao.ativo));

    if (!itens.length) {
      setErro("Adicione ao menos um procedimento com dentes/regiões ativos.");
      return;
    }

    setSalvandoOrcamento(true);
    setErro(null);
    try {
      const payload: OrcamentoPacientePayload = {
        clinica: orcamentoDraft.clinica,
        criado_por: orcamentoDraft.criadoPor,
        data: orcamentoDraft.data,
        observacoes: orcamentoDraft.observacoes,
        tabela: orcamentoDraft.tabela,
        desconto_percentual: descontoPercentualAplicado,
        desconto_valor: descontoValorAplicado,
        validade_orcamento: descontoOrcamento.validade,
        forma_pagamento: resumoFormaPagamento(planoPagamento),
        parcelas: planoPagamento.parcelas,
        entrada: planoPagamento.entrada,
        plano_pagamento: planoPagamentoParaApi(planoPagamento),
        itens
      };
      const resposta = orcamentoEditandoId
        ? await atualizarOrcamentoPacienteApi(pacienteAtivoId, orcamentoEditandoId, payload)
        : await criarOrcamentoPacienteApi(pacienteAtivoId, payload);
      setFeedback("Orçamento salvo com sucesso.");
      setModalOrcamentoAberto(false);
      setOrcamentoAtivoId(resposta.contrato_id);
      setOrcamentoEditandoId(null);
      setOrcamentoStatusAtual("EM_ABERTO");
      await carregarFicha(pacienteAtivoId);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar orçamento.");
    } finally {
      setSalvandoOrcamento(false);
    }
  }

  async function aprovarOrcamento(contratoId: number) {
    if (!pacienteAtivoId) return;
    try {
      setAlterandoStatusOrcamentoId(contratoId);
      await alterarStatusOrcamentoPacienteApi(pacienteAtivoId, contratoId, "APROVADO");
      setFeedback("Orçamento aprovado.");
      await carregarFicha(pacienteAtivoId);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao aprovar orçamento.");
    } finally {
      setAlterandoStatusOrcamentoId(null);
    }
  }

  async function desaprovarOrcamento() {
    if (!pacienteAtivoId || !confirmarDesaprovarId) return;
    try {
      setAlterandoStatusOrcamentoId(confirmarDesaprovarId);
      await alterarStatusOrcamentoPacienteApi(pacienteAtivoId, confirmarDesaprovarId, "EM_ABERTO");
      setConfirmarDesaprovarId(null);
      setFeedback("Orçamento desaprovado.");
      await carregarFicha(pacienteAtivoId);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao desaprovar orçamento.");
    } finally {
      setAlterandoStatusOrcamentoId(null);
    }
  }

  const renderListaPacientes = (
    <section className={`patient-directory${busca.trim() ? " patient-directory-floating" : " panel"}`}>
      {!busca.trim() ? (
        <div className="search-actions search-actions-patients">
          <button type="button" className="primary-action" onClick={() => setModalNovoAberto(true)}>
            <Plus size={18} />
            Novo paciente
          </button>
        </div>
      ) : null}

      {carregandoLista && busca.trim() ? (
        <div className="patient-search-dropdown">
          <span className="empty-inline">Carregando pacientes...</span>
        </div>
      ) : !busca.trim() ? (
        <article className="patient-search-empty">
          <strong>Digite no campo de busca para localizar um paciente.</strong>
          <span>Pesquise por nome, prontuário, telefone ou CPF.</span>
        </article>
      ) : carregandoLista ? null : !pacienteAtivoId ? (
        <div className="patient-search-dropdown">
          {pacientes.length ? pacientes.map((paciente) => (
            <button
              key={paciente.id}
              type="button"
              className={`patient-list-row patient-list-row-compact${paciente.id === pacienteAtivoId ? " active" : ""}`}
              onClick={() => setPacienteAtivoId(paciente.id)}
            >
              <div className="patient-list-main">
                <strong>{paciente.nome}</strong>
                <span>Prontuário {paciente.prontuario || "Sem prontuário"}</span>
              </div>
              <span>{paciente.telefone || "Telefone não informado"}</span>
              <span>{paciente.dataNascimento || "Nascimento não informado"}</span>
            </button>
          )) : <span className="empty-inline">Nenhum paciente encontrado para essa busca.</span>}
        </div>
      ) : null}
    </section>
  );

  const renderFichaPaciente = pacienteDetalhe ? (
    <section className="patient-detail-shell">
      <article className="patient-hero">
        <div className="patient-hero-left">
          <button type="button" className="patient-big-avatar patient-big-avatar-button" onClick={() => inputFotoPacienteRef.current?.click()}>
            {pacienteDetalhe.fotoUrl && !fotoErro ? (
              <img src={fotoPacienteSrc} alt={pacienteDetalhe.nome} onError={() => setFotoErro(true)} />
            ) : (
              iniciais(pacienteDetalhe.nome)
            )}
          </button>
          <input
            ref={inputFotoPacienteRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="patient-photo-input"
            onChange={enviarFotoPaciente}
          />
          <div className="patient-hero-copy">
            <span className="panel-kicker">Paciente</span>
            <h2>{pacienteDetalhe.nome}</h2>
            <span className="patient-status">Ativo</span>
            <div className="patient-hero-meta">
              <span><Phone size={15} /> {pacienteDetalhe.telefone || "Telefone não informado"}</span>
              <span><Mail size={15} /> {pacienteDetalhe.email || "E-mail não informado"}</span>
              <span>Prontuário {pacienteDetalhe.prontuario || "Sem prontuário"}</span>
            </div>
          </div>
        </div>

        <div className="patient-hero-actions">
          <button type="button" className="icon-action" onClick={() => inputFotoPacienteRef.current?.click()} disabled={enviandoFoto}>
            <IdCard size={18} />
            {enviandoFoto ? "Enviando foto..." : "Foto"}
          </button>
          <button type="button" className="icon-action" onClick={() => setAbaPrincipal("Cadastro")}>
            <Pencil size={18} />
            Editar
          </button>
          <button type="button" className="icon-action" onClick={() => setAbaPrincipal("Financeiro")}>
            <Wallet size={18} />
            Financeiro
          </button>
        </div>
      </article>

      <div className="patient-layout-grid">
        <aside className="patient-summary-column">
          <article className="panel summary-card">
            <div className="summary-card-title">Dados rápidos</div>
            <div className="summary-card-body">
              <div><span>CPF</span><strong>{pacienteDetalhe.cpf || "Não informado"}</strong></div>
              <div><span>RG</span><strong>{pacienteDetalhe.rg || "Não informado"}</strong></div>
              <div><span>Nascimento</span><strong>{pacienteDetalhe.dataNascimento || "Não informado"}</strong></div>
              <div><span>Estado civil</span><strong>{pacienteDetalhe.estadoCivil || "Não informado"}</strong></div>
            </div>
          </article>

          <article className="panel summary-card">
            <div className="summary-card-title">Próximo agendamento</div>
            {ficha?.proximoAgendamento ? (
              <div className="summary-card-body">
                <div><span>Data</span><strong>{ficha.proximoAgendamento.data || "-"}</strong></div>
                <div><span>Horário</span><strong>{ficha.proximoAgendamento.horario || "-"}</strong></div>
                <div><span>Profissional</span><strong>{ficha.proximoAgendamento.profissional || "-"}</strong></div>
              </div>
            ) : (
              <span className="empty-inline">Sem agendamento futuro.</span>
            )}
          </article>

          <article className={`panel summary-card finance-alert ${resumoFinanceiroIndicador(ficha?.financeiro.indicador)}`}>
            <div className="summary-card-title">Alerta financeiro</div>
            <div className="summary-card-body">
              <div><span>Indicador</span><strong>{ficha?.financeiro.indicador || "Sem vínculo"}</strong></div>
              <div><span>Total em aberto</span><strong>{ficha?.financeiro.emAberto || "R$ 0,00"}</strong></div>
              <div><span>Atrasado</span><strong>{ficha?.financeiro.atrasado || "R$ 0,00"}</strong></div>
            </div>
          </article>
        </aside>

        <section className="patient-content-column">
          <article className="panel patient-tabs-panel">
            <div className="tab-group">
              <div className="tab-shell tab-shell-primary">
                {ABAS_PRINCIPAIS.map((aba) => (
                  <button
                    key={aba.key}
                    type="button"
                    className={`segmented-tab segmented-tab-primary${abaPrincipal === aba.key ? " active" : ""}`}
                    onClick={() => setAbaPrincipal(aba.key)}
                  >
                    {aba.label}
                  </button>
                ))}
              </div>
            </div>

            {acessoAbaAtual > 0 && abaPrincipal === "Cadastro" ? (
              <div className="form-panel">
                <div className="form-section-grid">
                  <div className="form-block">
                    <h3>Dados principais</h3>
                    <div className="form-grid two">
                      <label><span>Nome *</span><input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} /></label>
                      <label><span>Apelido</span><input value={editForm.apelido} onChange={(e) => setEditForm({ ...editForm, apelido: e.target.value })} /></label>
                      <label>
                        <span>Sexo</span>
                        <select value={editForm.sexo} onChange={(e) => setEditForm({ ...editForm, sexo: e.target.value })}>
                          <option value="">Selecionar</option>
                          {OPCOES_SEXO.map((opcao) => (
                            <option key={opcao} value={opcao}>
                              {opcao}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label><span>Nascimento</span><input value={editForm.dataNascimento} onChange={(e) => setEditForm({ ...editForm, dataNascimento: e.target.value })} /></label>
                      <label><span>Menor de idade</span><input type="checkbox" checked={editForm.menorIdade} onChange={(e) => setEditForm(e.target.checked ? { ...editForm, menorIdade: true } : limparCamposResponsavel({ ...editForm, menorIdade: false }))} /></label>
                    </div>
                  </div>

                  <div className="form-block">
                    <h3>Contato</h3>
                    <div className="form-grid two">
                      <label className="highlight-field"><span>Telefone *</span><input value={editForm.telefone} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} /></label>
                      <label><span>E-mail</span><input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></label>
                      <label><span>CEP</span><input value={editForm.cep} onChange={(e) => setEditForm({ ...editForm, cep: e.target.value })} /></label>
                      <label><span>Endereço</span><input value={editForm.endereco} onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })} /></label>
                      <label><span>Número</span><input value={editForm.numero} onChange={(e) => setEditForm({ ...editForm, numero: e.target.value })} /></label>
                      <label><span>Bairro</span><input value={editForm.bairro} onChange={(e) => setEditForm({ ...editForm, bairro: e.target.value })} /></label>
                      <label><span>Cidade</span><input value={editForm.cidade} onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })} /></label>
                      <label><span>Estado</span><input value={editForm.estado} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })} /></label>
                    </div>
                  </div>

                  <div className="form-block">
                    <h3>Documentos</h3>
                    <div className="form-grid two">
                      <label><span>Prontuário</span><input value={editForm.prontuario} onChange={(e) => setEditForm({ ...editForm, prontuario: e.target.value })} /></label>
                      <label><span>CPF</span><input value={editForm.cpf} onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })} /></label>
                      <label><span>RG</span><input value={editForm.rg} onChange={(e) => setEditForm({ ...editForm, rg: e.target.value })} /></label>
                      <label><span>Estado civil</span><input value={editForm.estadoCivil} onChange={(e) => setEditForm({ ...editForm, estadoCivil: e.target.value })} /></label>
                    </div>
                  </div>

                  <div className="form-block">
                    <h3>Complementar</h3>
                    <div className="form-grid two">
                      <label><span>Responsável</span><input value={editForm.responsavel} onChange={(e) => setEditForm({ ...editForm, responsavel: e.target.value })} disabled={!editForm.menorIdade} /></label>
                      <label><span>CPF do responsável</span><input value={editForm.cpfResponsavel} onChange={(e) => setEditForm({ ...editForm, cpfResponsavel: e.target.value })} disabled={!editForm.menorIdade} /></label>
                      <label className="full"><span>Observações</span><textarea rows={5} value={editForm.observacoes} onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })} /></label>
                    </div>
                  </div>
                </div>

                <div className="sticky-actions">
                  <button type="button" className="ghost-action" onClick={() => setEditForm(mapPacienteParaForm(pacienteDetalhe))}>
                    Cancelar
                  </button>
                  <button type="button" className="primary-action" onClick={salvarEdicaoPaciente} disabled={salvandoEdicao}>
                    {salvandoEdicao ? "Salvando..." : "Salvar paciente"}
                  </button>
                </div>
              </div>
            ) : null}

            {acessoAbaAtual > 0 && abaPrincipal === "Financeiro" ? (
              renderFinanceiroSection()
            ) : null}

            {acessoAbaAtual > 0 && abaPrincipal === "Agendamentos" ? (
              <div className="schedule-list">
                {ficha?.agendamentos.length ? ficha.agendamentos.map((item) => (
                  <button type="button" className="schedule-item" key={item.id}>
                    <div className="schedule-item-main">
                      <strong>{item.procedimento || "Agendamento"}</strong>
                      <span>{item.profissional || "Profissional não informado"}</span>
                    </div>
                    <div className="finance-card-right">
                      <strong>{item.data || "-"}</strong>
                      <span>{item.horario || "-"}</span>
                    </div>
                    <span className={`finance-status ${(item.status || "agendado").toLowerCase().replace(/\s+/g, "-")}`}>
                      {item.status || "Agendado"}
                    </span>
                  </button>
                )) : <span className="empty-inline">Sem histórico de agendamentos.</span>}
              </div>
            ) : null}

            {acessoAbaAtual > 0 && abaPrincipal === "Clínico" ? (
              <div className="tab-group">
                <span className="tab-group-title">Clínico</span>
                <div className="tab-shell">
                  {(["Plano e ficha clínica", "Odontograma"] as AbaClinica[]).map((aba) => (
                    <button
                      key={aba}
                      type="button"
                      className={`segmented-tab${abaClinica === aba ? " active" : ""}`}
                      onClick={() => setAbaClinica(aba)}
                    >
                      {aba}
                    </button>
                  ))}
                </div>

                {abaClinica === "Plano e ficha clínica" ? (
                  <article className="compact-panel">
                    <strong>Plano e ficha clínica</strong>
                    <span className="empty-inline">Área preservada para integração com a ficha clínica real do ERP.</span>
                  </article>
                ) : null}

                {abaClinica === "Odontograma" ? renderOdontogramaClinico() : null}

              </div>
            ) : null}

            {acessoAbaAtual > 0 && abaPrincipal === "Documentos" ? (
              <div className="tab-group">
                <span className="tab-group-title">Documentos</span>
                <div className="tab-shell">
                  {(["Documentos", "Exames", "Recibos"] as AbaDocumentos[]).map((aba) => (
                    <button
                      key={aba}
                      type="button"
                      className={`segmented-tab${abaDocumentos === aba ? " active" : ""}`}
                      onClick={() => setAbaDocumentos(aba)}
                    >
                      {aba}
                    </button>
                  ))}
                </div>

                {abaDocumentos === "Documentos" ? (
                  <div className="doc-grid">
                    {ficha?.documentos.length ? ficha.documentos.map((arquivo) => (
                      <article
                        key={arquivo.caminho}
                        className="doc-card"
                        onClick={() => pacienteAtivoId ? abrirArquivo(urlDocumentoPaciente(pacienteAtivoId, arquivo.nome)) : undefined}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && pacienteAtivoId) {
                            event.preventDefault();
                            abrirArquivo(urlDocumentoPaciente(pacienteAtivoId, arquivo.nome));
                          }
                        }}
                      >
                        <FileText size={18} />
                        <div>
                          <strong>{formatarArquivo(arquivo)}</strong>
                          <span>{arquivo.modificadoEm || "Arquivo local"}</span>
                        </div>
                      </article>
                    )) : <span className="empty-inline">Sem documentos encontrados.</span>}
                  </div>
                ) : null}

                {abaDocumentos === "Exames" ? (
                  <div className="exam-grid">
                    {ficha?.exames.length ? ficha.exames.map((arquivo) => (
                      <article
                        key={arquivo.caminho}
                        className="exam-card"
                        onClick={() => pacienteAtivoId ? abrirArquivo(urlExamePaciente(pacienteAtivoId, arquivo.nome)) : undefined}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && pacienteAtivoId) {
                            event.preventDefault();
                            abrirArquivo(urlExamePaciente(pacienteAtivoId, arquivo.nome));
                          }
                        }}
                      >
                        <div className="exam-preview">EXAME</div>
                        <div>
                          <strong>{formatarArquivo(arquivo)}</strong>
                          <span>{arquivo.modificadoEm || "Arquivo local"}</span>
                        </div>
                      </article>
                    )) : <span className="empty-inline">Sem exames encontrados.</span>}
                  </div>
                ) : null}

                {abaDocumentos === "Recibos" ? (
                  <div className="finance-list">
                    {ficha?.recibos.length ? ficha.recibos.map((item) => (
                      <div className="finance-card" key={item.id}>
                        <div className="schedule-item-main">
                          <strong>{item.parcela ? `Recibo parcela ${item.parcela}` : "Recibo"}</strong>
                          <span>{item.dataPagamento || "Sem data de pagamento"}</span>
                        </div>
                        <div className="finance-card-right">
                          <strong>{item.valor}</strong>
                          <span>{item.formaPagamento || "Forma não informada"}</span>
                        </div>
                        <span className="finance-status pago">{item.status || "Pago"}</span>
                        {pacienteAtivoId && item.formaPagamento === "DINHEIRO" ? (
                          <div className="users-template-actions">
                            <button type="button" className="ghost-action" onClick={() => abrirArquivo(urlReciboPaciente(pacienteAtivoId, item.id))}>
                              Abrir recibo
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )) : <span className="empty-inline">Sem recibos para exibir.</span>}
                  </div>
                ) : null}
              </div>
            ) : null}

            {acessoAbaAtual > 0 && abaPrincipal === "Ordem de serviço" ? (
              renderOrdemServico()
            ) : null}

            {acessoAbaAtual > 0 && abaPrincipal === "Comercial" ? (
              <div className="commercial-shell">
                <div className="commercial-toolbar">
                  <div>
                    <span className="panel-kicker">Orçamentos</span>
                    <h3>Orçamentos do paciente</h3>
                  </div>
                  <button type="button" className="primary-action" onClick={abrirNovoOrcamento}>
                    <Plus size={18} />
                    Novo orçamento
                  </button>
                </div>

                <div className="budget-grid">
                  {ficha?.contratos.length ? ficha.contratos.map((contrato) => (
                    <article key={contrato.id} className="budget-card">
                      <div className="budget-card-top">
                        <strong>Contrato #{contrato.id}</strong>
                        <span>{contrato.formaPagamento || "Forma não informada"}</span>
                      </div>
                      <div className="budget-value">{contrato.valorTotal}</div>
                      <div className="budget-footer">
                        <span>{contrato.dataCriacao || "Sem data"}</span>
                        <button
                          type="button"
                          className="ghost-action"
                          onClick={() => abrirOrcamentoExistente(contrato.id)}
                        >
                          Abrir
                        </button>
                      </div>
                    </article>
                  )) : <span className="empty-inline">Sem contratos vinculados.</span>}
                </div>
              </div>
            ) : null}
          </article>
        </section>
      </div>
    </section>
  ) : null;

  const renderFichaPacienteNova = pacienteDetalhe ? (
    <section className="patient-detail-shell patient-detail-shell-clean">
      <article className="patient-record-shell">
        <div className="patient-record-topbar">
          <div className="patient-record-tabs">
            <div className="patient-record-tabs-scroll">
              {abasFichaDisponiveis.map((aba) => {
                const ativo =
                  abaPrincipal === aba.principal &&
                  (aba.clinica ? abaClinica === aba.clinica : true) &&
                  (aba.documentos ? abaDocumentos === aba.documentos : true);
                return (
                  <button
                    key={aba.label}
                    type="button"
                    className={`patient-record-tab${ativo ? " active" : ""}`}
                    onClick={() => {
                      setAbaPrincipal(aba.principal);
                      if (aba.clinica) setAbaClinica(aba.clinica);
                      if (aba.documentos) setAbaDocumentos(aba.documentos);
                    }}
                  >
                    {aba.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            className="icon-action patient-finalizar-action"
            onClick={() => void enviarPacienteFinalizadoParaCrm()}
            disabled={salvandoCrmFinalizado}
          >
            <Plus size={18} />
            {salvandoCrmFinalizado
              ? "Enviando ao CRM..."
              : ficha?.crm?.finalizado
                ? "Finalizado no CRM"
                : "Marcar como finalizado"}
          </button>
        </div>

        <div className="patient-record-body">
          {acessoAbaAtual <= 0 ? (
            <article className="panel patient-record-fallback">
              <h3>Sem acesso a esta aba</h3>
              <p>As permissões deste usuário não permitem visualizar este conteúdo.</p>
            </article>
          ) : null}
          {acessoAbaAtual > 0 && abaPrincipal === "Cadastro" ? (
            <div className="patient-cadastro-layout">
              <aside className="patient-cadastro-sidebar">
                {SECOES_CADASTRO.map((secao) => (
                  <button
                    key={secao.key}
                    type="button"
                    className={`patient-cadastro-nav${secaoCadastro === secao.key ? " active" : ""}`}
                    onClick={() => setSecaoCadastro(secao.key)}
                  >
                    <span className="patient-cadastro-nav-inner">
                      <span className="patient-cadastro-nav-icon" aria-hidden="true">
                        {secao.key === "dados" ? <IdCard size={18} /> : null}
                        {secao.key === "contato" ? <Phone size={18} /> : null}
                        {secao.key === "complementares" ? <FileText size={18} /> : null}
                      </span>
                      <span>{secao.label}</span>
                    </span>
                  </button>
                ))}
              </aside>

              <article className="patient-cadastro-card">
                {secaoCadastro === "dados" ? (
                  <div className="patient-form-section">
                    <div className="patient-form-heading">
                      <span className="patient-form-heading-icon" aria-hidden="true"><IdCard size={18} /></span>
                      <div className="patient-form-title">Dados Cadastrais</div>
                    </div>
                    <div className="patient-photo-upload-row">
                      <button type="button" className="patient-photo-upload" onClick={() => inputFotoPacienteRef.current?.click()} disabled={enviandoFoto}>
                        {pacienteDetalhe?.fotoUrl && !fotoErro ? (
                          <img src={fotoPacienteSrc} alt={pacienteDetalhe.nome} onError={() => setFotoErro(true)} />
                        ) : (
                          <span>{iniciais(editForm.nome || pacienteDetalhe?.nome || "P")}</span>
                        )}
                      </button>
                      <input
                        ref={inputFotoPacienteRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="patient-photo-input"
                        onChange={enviarFotoPaciente}
                      />
                      <div className="patient-photo-upload-copy">
                        <strong>Foto do paciente</strong>
                        <span>Envie uma imagem com fundo limpo para identificação na ficha.</span>
                      </div>
                    </div>
                    <div className="patient-form-grid two">
                      <label className="patient-line-field">
                        <span>Nome</span>
                        <input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
                      </label>
                      <label className="patient-line-field">
                        <span>Apelido</span>
                        <input value={editForm.apelido} onChange={(e) => setEditForm({ ...editForm, apelido: e.target.value })} />
                      </label>
                      <div className="patient-form-grid two patient-birth-grid">
                        <label className="patient-line-field">
                          <span>Data de Nascimento</span>
                          <input
                            value={editForm.dataNascimento}
                            onChange={(e) => setEditForm({ ...editForm, dataNascimento: e.target.value })}
                            placeholder="DD/MM/AAAA"
                          />
                        </label>
                        <label className="patient-line-field">
                          <span>Idade</span>
                          <input value={nascimentoInfo.idade} readOnly />
                        </label>
                      </div>
                      <div className="patient-line-field">
                        <span>Sexo</span>
                        <div className="patient-radio-row">
                          {["Masculino", "Feminino", "Outro"].map((opcao) => (
                            <label key={opcao} className="patient-radio-option">
                              <input
                                type="radio"
                                name="sexo-paciente"
                                checked={editForm.sexo === opcao}
                                onChange={() => setEditForm({ ...editForm, sexo: opcao })}
                              />
                              <span>{opcao}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <label className="patient-line-field">
                        <span>CPF</span>
                        <input value={editForm.cpf} onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })} />
                      </label>
                      <label className="patient-line-field">
                        <span>RG</span>
                        <input value={editForm.rg} onChange={(e) => setEditForm({ ...editForm, rg: e.target.value })} />
                      </label>
                      <label className="patient-line-field">
                        <span>Estado Civil</span>
                        <select value={editForm.estadoCivil} onChange={(e) => setEditForm({ ...editForm, estadoCivil: e.target.value })}>
                          {OPCOES_ESTADO_CIVIL.map((opcao) => (
                            <option key={opcao || "vazio"} value={opcao}>
                              {opcao}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="patient-line-field">
                        <span>Como conheceu?</span>
                        <input value={editForm.origem} onChange={(e) => setEditForm({ ...editForm, origem: e.target.value })} />
                      </label>
                      <label className="patient-line-field full">
                        <span>Observações</span>
                        <textarea rows={3} value={editForm.observacoes} onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })} />
                      </label>
                    </div>
                  </div>
                ) : null}

                {secaoCadastro === "contato" ? (
                  <div className="patient-form-section">
                    <div className="patient-form-heading">
                      <span className="patient-form-heading-icon" aria-hidden="true"><Phone size={18} /></span>
                      <div className="patient-form-title">Contato</div>
                    </div>
                    <div className="patient-form-grid three">
                      <label className="patient-line-field">
                        <span>Celular</span>
                        <input value={editForm.telefone} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} />
                      </label>
                      <label className="patient-line-field full">
                        <span>Email</span>
                        <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                      </label>
                    </div>

                    <div className="patient-form-subtitle">Endereço</div>
                    <div className="patient-form-grid three">
                      <label className="patient-line-field">
                        <span>CEP</span>
                        <input value={editForm.cep} onChange={(e) => setEditForm({ ...editForm, cep: e.target.value })} />
                      </label>
                      <label className="patient-line-field">
                        <span>Cidade</span>
                        <input value={editForm.cidade} onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })} />
                      </label>
                      <label className="patient-line-field">
                        <span>Estado</span>
                        <input value={editForm.estado} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })} />
                      </label>
                      <label className="patient-line-field full">
                        <span>Endereço</span>
                        <input value={editForm.endereco} onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })} />
                      </label>
                      <label className="patient-line-field">
                        <span>Número</span>
                        <input value={editForm.numero} onChange={(e) => setEditForm({ ...editForm, numero: e.target.value })} />
                      </label>
                      <label className="patient-line-field">
                        <span>Bairro</span>
                        <input value={editForm.bairro} onChange={(e) => setEditForm({ ...editForm, bairro: e.target.value })} />
                      </label>
                      <label className="patient-line-field">
                        <span>Complemento</span>
                        <input value={editForm.complemento} onChange={(e) => setEditForm({ ...editForm, complemento: e.target.value })} />
                      </label>
                    </div>
                  </div>
                ) : null}

                {secaoCadastro === "complementares" ? (
                  <div className="patient-form-section">
                    <div className="patient-form-heading">
                      <span className="patient-form-heading-icon" aria-hidden="true"><FileText size={18} /></span>
                      <div className="patient-form-title">Dados Complementares</div>
                    </div>
                    <div className="patient-form-grid two">
                      <label className="patient-line-field"><span>Profissão</span><input value={editForm.profissao} onChange={(e) => setEditForm({ ...editForm, profissao: e.target.value })} /></label>
                      <label className="patient-line-field"><span>Núm. Prontuário</span><input value={editForm.prontuario} onChange={(e) => setEditForm({ ...editForm, prontuario: e.target.value })} /></label>
                    </div>

                    <div className="patient-form-subtitle">Representante Legal</div>
                    <div className="patient-form-grid two">
                      <label className="patient-line-field">
                        <span>Nome do Representante Legal</span>
                        <input value={editForm.responsavel} onChange={(e) => setEditForm({ ...editForm, responsavel: e.target.value })} disabled={!editForm.menorIdade} />
                      </label>
                      <label className="patient-line-field">
                        <span>CPF do Representante Legal</span>
                        <input value={editForm.cpfResponsavel} onChange={(e) => setEditForm({ ...editForm, cpfResponsavel: e.target.value })} disabled={!editForm.menorIdade} />
                      </label>
                    </div>
                  </div>
                ) : null}

                <div className="patient-form-actions">
                  <button type="button" className="ghost-action" onClick={() => setEditForm(mapPacienteParaForm(pacienteDetalhe))}>
                    Cancelar
                  </button>
                  <button type="button" className="primary-action" onClick={salvarEdicaoPaciente} disabled={salvandoEdicao}>
                    {salvandoEdicao ? "Salvando..." : "Salvar paciente"}
                  </button>
                </div>
              </article>
            </div>
          ) : (
            <article className="panel patient-tabs-panel patient-record-fallback">
              {acessoAbaAtual > 0 && abaPrincipal === "Financeiro" ? (
                renderFinanceiroSection()
              ) : null}

              {acessoAbaAtual > 0 && abaPrincipal === "Agendamentos" ? (
                <div className="schedule-list">
                  {ficha?.agendamentos.length ? ficha.agendamentos.map((item) => (
                    <button type="button" className="schedule-item" key={item.id}>
                      <div className="schedule-item-main">
                        <strong>{item.procedimento || "Agendamento"}</strong>
                        <span>{item.profissional || "Profissional não informado"}</span>
                      </div>
                      <div className="finance-card-right">
                        <strong>{item.data || "-"}</strong>
                        <span>{item.horario || "-"}</span>
                      </div>
                      <span className={`finance-status ${(item.status || "agendado").toLowerCase().replace(/\s+/g, "-")}`}>
                        {item.status || "Agendado"}
                      </span>
                    </button>
                  )) : <span className="empty-inline">Sem histórico de agendamentos.</span>}
                </div>
              ) : null}

              {acessoAbaAtual > 0 && abaPrincipal === "Clínico" ? (
                <div className="tab-group">
                  <span className="tab-group-title">Clínico</span>
                  <div className="tab-shell">
                    {(["Plano e ficha clínica", "Odontograma"] as AbaClinica[]).map((aba) => (
                      <button
                        key={aba}
                        type="button"
                        className={`segmented-tab${abaClinica === aba ? " active" : ""}`}
                        onClick={() => setAbaClinica(aba)}
                      >
                        {aba}
                      </button>
                    ))}
                  </div>

                  {abaClinica === "Plano e ficha clínica" ? (
                    <article className="compact-panel">
                      <strong>Plano e ficha clínica</strong>
                      <span className="empty-inline">Área preservada para integração com a ficha clínica real do ERP.</span>
                    </article>
                  ) : null}

                  {abaClinica === "Odontograma" ? renderOdontogramaClinico() : null}

                </div>
              ) : null}

              {acessoAbaAtual > 0 && abaPrincipal === "Documentos" ? (
                <div className="tab-group">
                  <span className="tab-group-title">Documentos</span>
                  <div className="tab-shell">
                    {(["Documentos", "Exames", "Recibos"] as AbaDocumentos[]).map((aba) => (
                      <button
                        key={aba}
                        type="button"
                        className={`segmented-tab${abaDocumentos === aba ? " active" : ""}`}
                        onClick={() => setAbaDocumentos(aba)}
                      >
                        {aba}
                      </button>
                    ))}
                  </div>

                  {abaDocumentos === "Documentos" ? (
                    <div className="doc-grid">
                      {ficha?.documentos.length ? ficha.documentos.map((arquivo) => (
                        <article
                          key={arquivo.caminho}
                          className="doc-card"
                          onClick={() => pacienteAtivoId ? abrirArquivo(urlDocumentoPaciente(pacienteAtivoId, arquivo.nome)) : undefined}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if ((event.key === "Enter" || event.key === " ") && pacienteAtivoId) {
                              event.preventDefault();
                              abrirArquivo(urlDocumentoPaciente(pacienteAtivoId, arquivo.nome));
                            }
                          }}
                        >
                          <FileText size={18} />
                          <div>
                            <strong>{formatarArquivo(arquivo)}</strong>
                            <span>{arquivo.modificadoEm || "Arquivo local"}</span>
                          </div>
                        </article>
                      )) : <span className="empty-inline">Sem documentos encontrados.</span>}
                    </div>
                  ) : null}

                  {abaDocumentos === "Exames" ? (
                    <div className="exam-grid">
                      {ficha?.exames.length ? ficha.exames.map((arquivo) => (
                        <article
                          key={arquivo.caminho}
                          className="exam-card"
                          onClick={() => pacienteAtivoId ? abrirArquivo(urlExamePaciente(pacienteAtivoId, arquivo.nome)) : undefined}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if ((event.key === "Enter" || event.key === " ") && pacienteAtivoId) {
                              event.preventDefault();
                              abrirArquivo(urlExamePaciente(pacienteAtivoId, arquivo.nome));
                            }
                          }}
                        >
                          <div className="exam-preview">EXAME</div>
                          <div>
                            <strong>{formatarArquivo(arquivo)}</strong>
                            <span>{arquivo.modificadoEm || "Arquivo local"}</span>
                          </div>
                        </article>
                      )) : <span className="empty-inline">Sem exames encontrados.</span>}
                    </div>
                  ) : null}

                  {abaDocumentos === "Recibos" ? (
                    <div className="finance-list">
                      {ficha?.recibos.length ? ficha.recibos.map((item) => (
                        <div className="finance-card" key={item.id}>
                          <div className="schedule-item-main">
                            <strong>{item.parcela ? `Recibo parcela ${item.parcela}` : "Recibo"}</strong>
                            <span>{item.dataPagamento || "Sem data de pagamento"}</span>
                          </div>
                          <div className="finance-card-right">
                            <strong>{item.valor}</strong>
                            <span>{item.formaPagamento || "Forma não informada"}</span>
                          </div>
                          <span className="finance-status pago">{item.status || "Pago"}</span>
                          {pacienteAtivoId && item.formaPagamento === "DINHEIRO" ? (
                            <div className="users-template-actions">
                              <button type="button" className="ghost-action" onClick={() => abrirArquivo(urlReciboPaciente(pacienteAtivoId, item.id))}>
                                Abrir recibo
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )) : <span className="empty-inline">Sem recibos para exibir.</span>}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {acessoAbaAtual > 0 && abaPrincipal === "Ordem de serviço" ? (
                renderOrdemServico()
              ) : null}

              {acessoAbaAtual > 0 && abaPrincipal === "Comercial" ? (
                <div className="commercial-shell">
                  <div className="commercial-toolbar">
                    <div>
                      <span className="panel-kicker">Orçamentos</span>
                      <h3>Orçamentos do paciente</h3>
                    </div>
                    <button type="button" className="primary-action" onClick={abrirNovoOrcamento}>
                      <Plus size={18} />
                      Novo orçamento
                    </button>
                  </div>

                  <div className="budget-list-shell">
                    {ficha?.contratos.length ? ficha.contratos.map((contrato) => (
                      <article key={contrato.id} className="budget-list-row">
                        <div className="budget-list-row-left">
                          <button
                            type="button"
                            className={`budget-status-badge ${contrato.status === "APROVADO" ? "approved" : "open"}`}
                            disabled={alterandoStatusOrcamentoId === contrato.id}
                            onClick={() => {
                              if (contrato.status === "APROVADO") setConfirmarDesaprovarId(contrato.id);
                              else void aprovarOrcamento(contrato.id);
                            }}
                          >
                            {alterandoStatusOrcamentoId === contrato.id
                              ? "Salvando..."
                              : contrato.status === "APROVADO"
                                ? "Aprovado"
                                : "Em Aberto"}
                          </button>
                          <span>{contrato.dataCriacao || "Sem data"}</span>
                          {contrato.aprovadoPor ? <span>{`Aprovado por ${contrato.aprovadoPor}`}</span> : null}
                        </div>
                        <button
                          type="button"
                          className="budget-list-row-main"
                          onClick={() => abrirOrcamentoExistente(contrato.id)}
                        >
                          <strong>{`Orçamento #${contrato.id}`}</strong>
                          <span>{contrato.procedimentos.join(", ") || "Sem procedimentos"}</span>
                        </button>
                        <strong className="budget-list-row-value">{contrato.valorTotal}</strong>
                      </article>
                    )) : <span className="empty-inline">Sem contratos vinculados.</span>}
                  </div>
                </div>
              ) : null}
            </article>
          )}
        </div>
      </article>
    </section>
  ) : null;

  function renderOdontogramaClinico() {
    return (
      <div className="clinical-odontograma-layout">
        <div className="clinical-odontograma-main">
          <div className="clinical-odontograma-toolbar">
            <label>
              <span>Dentição</span>
              <select value={denticaoClinica} onChange={(e) => {
                setDenticaoClinica(e.target.value as "Permanente" | "Decidua");
                setElementoClinicoAtivo([]);
              }}>
                {DENTICOES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            {elementoClinicoAtivo.length ? (
              <button type="button" className="ghost-action" onClick={() => setElementoClinicoAtivo([])}>
                Limpar seleção
              </button>
            ) : null}
          </div>

          <Odontograma
            denticao={denticaoClinica}
            dentesContratados={dentesContratadosClinicos}
            dentesSelecionados={elementoClinicoAtivo}
            onSelectTooth={(toothId) => {
              setElementoClinicoAtivo((atual) => atual.includes(toothId) ? atual.filter((item) => item !== toothId) : [toothId]);
            }}
          />
        </div>

        <aside className="clinical-element-list">
          <div className="clinical-element-list-header">
            <strong>Procedimentos por elemento</strong>
            <span>{elementosOdontogramaListados.length} item(ns)</span>
          </div>

          <div className="clinical-element-list-body">
            {elementosOdontogramaListados.length ? elementosOdontogramaListados.map((item) => (
              <article key={`${item.elemento}-${item.denticao || "geral"}`} className="clinical-element-card">
                <div className="clinical-element-card-top">
                  <strong>{item.dente != null ? `Elemento ${item.elemento}` : item.elemento}</strong>
                  {item.denticao ? <span>{item.denticao}</span> : null}
                </div>
                <div className="clinical-element-procedures">
                  {item.procedimentos.map((procedimento) => (
                    <span key={`${item.elemento}-${procedimento}`} className="clinical-element-procedure">{procedimento}</span>
                  ))}
                </div>
              </article>
            )) : <span className="empty-inline">Nenhum procedimento contratado nesta dentição.</span>}
          </div>
        </aside>
      </div>
    );
  }

  function renderOrdemServico() {
    const etapasPadrao = procedimentoOrdemServicoSelecionado?.etapasPadrao || [];
    const opcoesEtapa = [...etapasPadrao, "Outro"];
    return (
      <div className="clinical-panel">
        <div className="clinical-panel-header">
          <div>
            <strong>Ordem de serviço protético</strong>
            <span>Base vinculada ao arquivo ORDEM DE SERVIÇO PROTÉTICO e à tabela de procedimentos.</span>
          </div>
        </div>

        <div className="users-create-grid procedures-form-grid">
          <label className="procedures-form-wide">
            <span>Procedimento</span>
            <select
              value={ordemServicoForm.procedimentoId}
              onChange={(event) => redefinirOrdemServicoForm(event.target.value)}
              disabled={!procedimentosContratadosPaciente.length}
            >
              <option value="">{procedimentosContratadosPaciente.length ? "Selecione" : "Nenhum procedimento contratado"}</option>
              {procedimentosContratadosPaciente.map((item) => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Material</span>
            <select
              value={ordemServicoForm.material}
              onChange={(event) =>
                setOrdemServicoForm((atual) => ({
                  ...atual,
                  material: event.target.value,
                  materialOutro: event.target.value === "Outro" ? atual.materialOutro : ""
                }))
              }
            >
              <option value="">Selecione</option>
              {materiaisOrdemServicoDisponiveis.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          {ordemServicoForm.material === "Outro" ? (
            <label>
              <span>Descrição do material</span>
              <input
                value={ordemServicoForm.materialOutro}
                onChange={(event) => setOrdemServicoForm((atual) => ({ ...atual, materialOutro: event.target.value }))}
                placeholder="Descreva o material"
              />
            </label>
          ) : null}

          <label>
            <span>Elemento ou arcada</span>
            <input
              value={ordemServicoForm.elementoArcada}
              onChange={(event) => setOrdemServicoForm((atual) => ({ ...atual, elementoArcada: event.target.value }))}
              placeholder="Ex.: 11, 21 ou Arcada superior"
            />
          </label>

          <label>
            <span>Escala</span>
            <input
              value={ordemServicoForm.escala}
              onChange={(event) => setOrdemServicoForm((atual) => ({ ...atual, escala: event.target.value }))}
              placeholder="Informe a escala"
            />
          </label>

          <label>
            <span>Cor</span>
            <input
              value={ordemServicoForm.cor}
              onChange={(event) => setOrdemServicoForm((atual) => ({ ...atual, cor: event.target.value }))}
              placeholder="Informe a cor"
            />
          </label>

          <label>
            <span>Data de retorno solicitada</span>
            <input
              type="date"
              value={ordemServicoForm.retornoSolicitado}
              onChange={(event) => setOrdemServicoForm((atual) => ({ ...atual, retornoSolicitado: event.target.value }))}
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={ordemServicoForm.cargaImediata}
              onChange={(event) => setOrdemServicoForm((atual) => ({ ...atual, cargaImediata: event.target.checked }))}
            />
            <span>Carga imediata</span>
          </label>

          {procedimentoOrdemServicoSelecionado ? (
            <div className="procedures-form-wide os-steps-box">
              <div className="clinical-panel-header compact">
                <div>
                  <strong>Etapas</strong>
                  <span>Selecione as etapas da planilha. Se usar Outro, a descrição é obrigatória.</span>
                </div>
                <button type="button" className="ghost-action" onClick={adicionarEtapaOrdemServico}>Adicionar etapa</button>
              </div>
              <div className="os-steps-list">
                {ordemServicoForm.etapas.map((item) => (
                  <div key={item.id} className="os-step-row">
                    <select value={item.etapa} onChange={(event) => atualizarEtapaOrdemServico(item.id, { etapa: event.target.value })}>
                      <option value="">Selecione a etapa</option>
                      {opcoesEtapa.map((opcao) => (
                        <option key={opcao} value={opcao}>{opcao}</option>
                      ))}
                    </select>
                    {item.etapa === "Outro" ? (
                      <input
                        value={item.descricaoOutro}
                        onChange={(event) => atualizarEtapaOrdemServico(item.id, { descricaoOutro: event.target.value })}
                        placeholder="Descreva a etapa"
                      />
                    ) : (
                      <input value={item.etapa} readOnly placeholder="Etapa selecionada" />
                    )}
                    <button type="button" className="ghost-action danger" onClick={() => removerEtapaOrdemServico(item.id)}>Remover</button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <label className="procedures-form-wide">
            <span>Observação</span>
            <textarea
              rows={4}
              value={ordemServicoForm.observacao}
              onChange={(event) => setOrdemServicoForm((atual) => ({ ...atual, observacao: event.target.value }))}
            />
          </label>
        </div>

        <div className="users-template-actions">
          <button type="button" className="primary-action" onClick={salvarOrdemServicoPaciente} disabled={!procedimentoOrdemServicoSelecionado || salvandoOrdemServico}>
            Salvar ordem de serviço
          </button>
        </div>

        <div className="clinical-elements-panel">
          <div className="clinical-elements-header">
            <strong>Ordens salvas</strong>
            <span>{ordensServico.length} item(ns)</span>
          </div>
          {ordensServico.length ? ordensServico.map((item) => (
            <div key={item.id} className="clinical-element-card">
              <div className="clinical-element-row">
                <strong>{item.procedimentoNome}</strong>
                <span>{formatarDataHora(item.criadoEm)}</span>
              </div>
              <div className="clinical-element-row muted">
                <span>{item.material}{item.materialOutro ? ` - ${item.materialOutro}` : ""}</span>
                <span>{item.elementoArcada || "Sem elemento informado"}</span>
              </div>
              <div className="clinical-element-row muted">
                <span>Escala: {item.escala || "-"}</span>
                <span>Cor: {item.cor || "-"}</span>
              </div>
              <div className="clinical-element-row muted">
                <span>{item.cargaImediata ? "Carga imediata" : "Sem carga imediata"}</span>
                <span>Retorno: {formatarDataCurta(item.retornoSolicitado) || "Não informado"}</span>
              </div>
              <div className="clinical-element-procedures">
                {item.etapas.map((etapa, indice) => (
                  <span key={`${item.id}-${indice}`} className="clinical-element-procedure">
                    {etapa.etapa === "Outro" ? `Outro: ${etapa.descricao_outro}` : etapa.etapa}
                  </span>
                ))}
              </div>
              {item.observacao ? <p className="clinical-element-note">{item.observacao}</p> : null}
              {item.documentoNome && pacienteAtivoId ? (
                <div className="users-template-actions">
                  <button type="button" className="ghost-action" onClick={() => abrirArquivo(urlDocumentoPaciente(pacienteAtivoId, item.documentoNome || "", true))}>
                    Baixar Word
                  </button>
                </div>
              ) : null}
            </div>
          )) : <span className="empty-inline">Nenhuma ordem de serviço salva para este paciente.</span>}
        </div>
      </div>
    );
  }

  return (
    <section className="module-shell">
      {feedback ? <article className="panel compact-panel">{feedback}</article> : null}
      {erro ? <article className="panel compact-panel">{erro}</article> : null}

      {renderListaPacientes}
      {buscaAtiva && pacienteAtivoId ? (
        carregandoFicha ? <article className="panel compact-panel">Carregando ficha do paciente...</article> : renderFichaPacienteNova
      ) : null}

      {modalRecebivelAberto && recebivelForm ? (
        <div className="overlay" role="presentation">
          <article className="modal-shell modal-shell-finance">
            <header className="modal-header">
              <div>
                <span className="panel-kicker">Financeiro</span>
                <h2>Editar parcela</h2>
              </div>
              <button type="button" className="icon-only" onClick={fecharRecebivel}>×</button>
            </header>

            <div className="modal-body">
              <div className="finance-modal-grid">
                <label>
                  <span>Vencimento</span>
                  <input
                    type="date"
                    value={recebivelForm.vencimento}
                    onChange={(e) => setRecebivelForm({ ...recebivelForm, vencimento: e.target.value })}
                  />
                </label>
                <label>
                  <span>Forma de pagamento</span>
                  <select
                    value={recebivelForm.formaPagamento}
                    onChange={(e) => setRecebivelForm({ ...recebivelForm, formaPagamento: e.target.value })}
                  >
                    {FORMAS_PAGAMENTO.map((forma) => (
                      <option key={forma.value} value={forma.label.toUpperCase()}>{forma.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={recebivelForm.status}
                    onChange={(e) => setRecebivelForm({
                      ...recebivelForm,
                      status: e.target.value,
                      dataPagamento: e.target.value === "Pago" ? (recebivelForm.dataPagamento || dataHojeIso()) : ""
                    })}
                  >
                    <option value="Aberto">Aberto</option>
                    <option value="A vencer">A vencer</option>
                    <option value="Atrasado">Atrasado</option>
                    <option value="Pago">Pago</option>
                  </select>
                </label>
                <label>
                  <span>Data do pagamento</span>
                  <input
                    type="date"
                    value={recebivelForm.dataPagamento}
                    onChange={(e) => setRecebivelForm({ ...recebivelForm, dataPagamento: e.target.value })}
                    disabled={recebivelForm.status !== "Pago"}
                  />
                </label>
                <label className="full">
                  <span>Valor</span>
                  <input
                    value={recebivelForm.valor}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setRecebivelForm({ ...recebivelForm, valor: e.target.value })}
                  />
                </label>
                <label className="full">
                  <span>Observação</span>
                  <textarea
                    rows={4}
                    value={recebivelForm.observacao}
                    onChange={(e) => setRecebivelForm({ ...recebivelForm, observacao: e.target.value })}
                  />
                </label>
              </div>
            </div>

            <footer className="modal-footer">
              <button type="button" className="ghost-action" onClick={fecharRecebivel}>Fechar</button>
              <button type="button" className="primary-action" onClick={() => salvarRecebivel()} disabled={salvandoRecebivel}>
                {salvandoRecebivel ? "Salvando..." : "Salvar parcela"}
              </button>
            </footer>
          </article>
        </div>
      ) : null}

      {modalNovoAberto ? (
        <div className="overlay" role="presentation">
          <article className="modal-shell">
            <header className="modal-header">
              <div>
                <span className="panel-kicker">Cadastro</span>
                <h2>Novo paciente</h2>
              </div>
              <button type="button" className="icon-only" onClick={() => setModalNovoAberto(false)}>×</button>
            </header>

            <div className="modal-body">
              <div className="form-section-grid">
                <div className="form-block">
                  <h3>Dados principais</h3>
                  <div className="form-grid two">
                    <label><span>Nome *</span><input value={novoForm.nome} onChange={(e) => setNovoForm({ ...novoForm, nome: e.target.value })} /></label>
                    <label><span>Apelido</span><input value={novoForm.apelido} onChange={(e) => setNovoForm({ ...novoForm, apelido: e.target.value })} /></label>
                    <label>
                      <span>Sexo</span>
                      <select value={novoForm.sexo} onChange={(e) => setNovoForm({ ...novoForm, sexo: e.target.value })}>
                        <option value="">Selecionar</option>
                        {OPCOES_SEXO.map((opcao) => (
                          <option key={opcao} value={opcao}>
                            {opcao}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label><span>Nascimento</span><input value={novoForm.dataNascimento} onChange={(e) => setNovoForm({ ...novoForm, dataNascimento: e.target.value })} /></label>
                    <label><span>Menor de idade</span><input type="checkbox" checked={novoForm.menorIdade} onChange={(e) => setNovoForm(e.target.checked ? { ...novoForm, menorIdade: true } : limparCamposResponsavel({ ...novoForm, menorIdade: false }))} /></label>
                  </div>
                </div>

                <div className="form-block">
                  <h3>Contato</h3>
                  <div className="form-grid two">
                    <label className="highlight-field"><span>Telefone *</span><input value={novoForm.telefone} onChange={(e) => setNovoForm({ ...novoForm, telefone: e.target.value })} /></label>
                    <label><span>E-mail</span><input value={novoForm.email} onChange={(e) => setNovoForm({ ...novoForm, email: e.target.value })} /></label>
                    <label><span>CEP</span><input value={novoForm.cep} onChange={(e) => setNovoForm({ ...novoForm, cep: e.target.value })} onBlur={() => aplicarCep(novoForm, setNovoForm)} /></label>
                    <label><span>Endereço</span><input value={novoForm.endereco} onChange={(e) => setNovoForm({ ...novoForm, endereco: e.target.value })} /></label>
                    <label><span>Número</span><input value={novoForm.numero} onChange={(e) => setNovoForm({ ...novoForm, numero: e.target.value })} /></label>
                    <label><span>Bairro</span><input value={novoForm.bairro} onChange={(e) => setNovoForm({ ...novoForm, bairro: e.target.value })} /></label>
                    <label><span>Cidade</span><input value={novoForm.cidade} onChange={(e) => setNovoForm({ ...novoForm, cidade: e.target.value })} /></label>
                    <label><span>Estado</span><input value={novoForm.estado} onChange={(e) => setNovoForm({ ...novoForm, estado: e.target.value })} /></label>
                  </div>
                </div>

                <div className="form-block">
                  <h3>Documentos</h3>
                  <div className="form-grid two">
                    <label><span>Prontuário</span><input value={novoForm.prontuario} onChange={(e) => setNovoForm({ ...novoForm, prontuario: e.target.value })} /></label>
                    <label><span>CPF</span><input value={novoForm.cpf} onChange={(e) => setNovoForm({ ...novoForm, cpf: e.target.value })} /></label>
                    <label><span>RG</span><input value={novoForm.rg} onChange={(e) => setNovoForm({ ...novoForm, rg: e.target.value })} /></label>
                  </div>
                </div>

                <div className="form-block">
                  <h3>Complementar</h3>
                  <div className="form-grid two">
                    <label><span>Estado civil</span><input value={novoForm.estadoCivil} onChange={(e) => setNovoForm({ ...novoForm, estadoCivil: e.target.value })} /></label>
                    <label><span>Responsável</span><input value={novoForm.responsavel} onChange={(e) => setNovoForm({ ...novoForm, responsavel: e.target.value })} disabled={!novoForm.menorIdade} /></label>
                    <label><span>CPF do responsável</span><input value={novoForm.cpfResponsavel} onChange={(e) => setNovoForm({ ...novoForm, cpfResponsavel: e.target.value })} disabled={!novoForm.menorIdade} /></label>
                    <label className="full"><span>Observações</span><textarea rows={5} value={novoForm.observacoes} onChange={(e) => setNovoForm({ ...novoForm, observacoes: e.target.value })} /></label>
                  </div>
                </div>
              </div>
            </div>

            <footer className="modal-footer">
              <div className="sticky-actions">
                <button type="button" className="ghost-action" onClick={() => setModalNovoAberto(false)}>Cancelar</button>
                <button type="button" className="primary-action" onClick={salvarNovoPaciente} disabled={salvandoNovo}>
                  {salvandoNovo ? "Salvando..." : "Salvar paciente"}
                </button>
              </div>
            </footer>
          </article>
        </div>
      ) : null}

      {modalDescontoAberto ? (
        <div className="overlay" role="presentation">
          <article className="modal-shell modal-shell-discount">
            <header className="modal-header">
              <div>
                <h2>Desconto</h2>
              </div>
              <button type="button" className="icon-only" onClick={() => setModalDescontoAberto(false)}>×</button>
            </header>
            <div className="modal-body">
              <div className="discount-modal-grid">
                <label>
                  <span>Valor dos procedimentos</span>
                  <input value={formatarMoeda(totalOrcamento)} disabled />
                </label>
                <label>
                  <span>Desconto %</span>
                  <input
                    value={descontoEditor.percentual}
                    onChange={(e) => setDescontoEditor({ ...descontoEditor, percentual: e.target.value })}
                    placeholder="0,00"
                  />
                </label>
                <label>
                  <span>Valor do desconto</span>
                  <input
                    value={descontoEditor.valor}
                    onChange={(e) => setDescontoEditor({ ...descontoEditor, valor: formatarMoedaInput(e.target.value) })}
                    placeholder="R$ 0,00"
                  />
                </label>
                <label>
                  <span>Validade do orçamento</span>
                  <input
                    type="date"
                    value={descontoEditor.validade}
                    onChange={(e) => setDescontoEditor({ ...descontoEditor, validade: e.target.value })}
                  />
                </label>
                <label className="full">
                  <span>Valor final</span>
                  <input
                    value={formatarMoeda(Math.max(0, totalOrcamento - Math.min(totalOrcamento, ((totalOrcamento * clamp(parseMoeda(descontoEditor.percentual), 0, 100)) / 100) + clamp(parseMoeda(descontoEditor.valor), 0, totalOrcamento))))}
                    disabled
                  />
                </label>
              </div>
            </div>
            <footer className="modal-footer">
              <button type="button" className="ghost-action" onClick={() => setModalDescontoAberto(false)}>Cancelar</button>
              <button type="button" className="primary-action" onClick={confirmarDesconto}>Confirmar</button>
            </footer>
          </article>
        </div>
      ) : null}

      {modalOrcamentoAberto ? (
        <div className="overlay" role="presentation">
          <article className="modal-shell modal-shell-budget">
            <header className="modal-header">
              <div>
                <span className="panel-kicker">Comercial</span>
                <h2>{orcamentoEditandoId ? `Orçamento #${orcamentoEditandoId}` : "Novo orçamento"}</h2>
              </div>
              <button type="button" className="icon-only" onClick={() => setModalOrcamentoAberto(false)}>
                <X size={20} />
              </button>
            </header>

            <div className="modal-body budget-modal-body">
              <div className="budget-builder-grid">
                <section className="budget-builder-form">
                  <div className="form-section-grid">
                    <div className="form-block">
                      <h3>Identificação</h3>
                      <div className="form-grid three">
                        <label>
                          <span>Clínica</span>
                          <select value={orcamentoDraft.clinica} onChange={(e) => setOrcamentoDraft({ ...orcamentoDraft, clinica: e.target.value })} disabled={orcamentoBloqueado}>
                            {CLINICAS_ORCAMENTO.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Orçamento criado por</span>
                          <select value={orcamentoDraft.criadoPor} onChange={(e) => setOrcamentoDraft({ ...orcamentoDraft, criadoPor: e.target.value })} disabled={orcamentoBloqueado}>
                            {CRIADORES_ORCAMENTO.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Data</span>
                          <input type="date" value={orcamentoDraft.data} onChange={(e) => setOrcamentoDraft({ ...orcamentoDraft, data: e.target.value })} disabled={orcamentoBloqueado} />
                        </label>
                        <label className="full">
                          <span>Observações</span>
                          <textarea rows={3} value={orcamentoDraft.observacoes} onChange={(e) => setOrcamentoDraft({ ...orcamentoDraft, observacoes: e.target.value })} disabled={orcamentoBloqueado} />
                        </label>
                        <label className="budget-table-field">
                          <span>Tabela</span>
                          <select value={orcamentoDraft.tabela} onChange={(e) => setOrcamentoDraft({ ...orcamentoDraft, tabela: e.target.value })} disabled={orcamentoBloqueado}>
                            {TABELAS_ORCAMENTO.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="form-block">
                      <div className="budget-procedure-header">
                        <h3>Adicionar procedimento</h3>
                        <button type="button" className="primary-action" onClick={adicionarProcedimentoAoOrcamento} disabled={!procedimentoSelecionado || orcamentoBloqueado}>
                          <Plus size={18} />
                          Adicionar
                        </button>
                      </div>

                      <div className="budget-search-field">
                        <Search size={18} />
                        <input
                          type="text"
                          placeholder="Buscar procedimento existente"
                          value={orcamentoDraft.termoProcedimento}
                          onChange={(e) => {
                            setProcedimentoSelecionado(null);
                            setOrcamentoDraft({ ...orcamentoDraft, termoProcedimento: e.target.value });
                          }}
                          disabled={orcamentoBloqueado}
                        />
                      </div>

                      {orcamentoDraft.termoProcedimento.trim() ? (
                        <div className="procedure-catalog-list procedure-catalog-dropdown">
                          {procedimentosFiltrados.length ? procedimentosFiltrados.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className={`procedure-catalog-item${procedimentoSelecionado?.id === item.id ? " active" : ""}`}
                              onClick={() => selecionarProcedimento(item)}
                              disabled={orcamentoBloqueado}
                            >
                              <div>
                                <strong>{item.nome}</strong>
                                <span>{item.categoria}</span>
                              </div>
                              <strong>{formatarMoeda(item.valor)}</strong>
                            </button>
                          )) : (
                            <div className="procedure-catalog-empty">Nenhum procedimento encontrado.</div>
                          )}
                        </div>
                      ) : null}

                      {procedimentoSelecionado ? (
                        <div className="budget-procedure-editor">
                          <div className="budget-procedure-editor-head">
                            <strong>{procedimentoSelecionado.nome}</strong>
                            <button type="button" className="icon-only" onClick={() => setProcedimentoSelecionado(null)}>
                              <X size={18} />
                            </button>
                          </div>

                          <div className="form-grid three">
                            <label>
                              <span>Elemento</span>
                              <input
                                value={orcamentoDraft.regiaoInput}
                                onChange={(e) => setOrcamentoDraft({ ...orcamentoDraft, regiaoInput: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    adicionarRegiaoSelecionada(orcamentoDraft.regiaoInput);
                                  }
                                }}
                                placeholder="Elemento"
                                disabled={orcamentoBloqueado}
                              />
                            </label>
                            <label>
                              <span>Dentista</span>
                              <select value={orcamentoDraft.profissional} onChange={(e) => setOrcamentoDraft({ ...orcamentoDraft, profissional: e.target.value })} disabled={orcamentoBloqueado}>
                                {PROFISSIONAIS_ORCAMENTO.map((item) => (
                                  <option key={item} value={item}>{item}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span>Valor unitário</span>
                              <input
                                value={orcamentoDraft.valorUnitario}
                                onChange={(e) => setOrcamentoDraft({ ...orcamentoDraft, valorUnitario: formatarMoedaInput(e.target.value) })}
                                placeholder="R$ 0,00"
                                disabled={orcamentoBloqueado}
                              />
                            </label>
                            <label>
                              <span>Dentição</span>
                              <select
                                value={orcamentoDraft.denticao}
                                onChange={(e) =>
                                  setOrcamentoDraft({
                                    ...orcamentoDraft,
                                    denticao: e.target.value,
                                    regiaoInput: "",
                                    regioesSelecionadas: []
                                  })}
                                disabled={orcamentoBloqueado}
                              >
                                {DENTICOES.map((item) => (
                                  <option key={item} value={item}>{item}</option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <div className="budget-region-shortcuts">
                            {OPCOES_ARCADA.map((item) => (
                              <button key={item} type="button" className="ghost-action" onClick={() => adicionarRegiaoSelecionada(item)} disabled={orcamentoBloqueado}>
                                {item}
                              </button>
                            ))}
                          </div>

                          <div className="budget-selected-regions">
                            {orcamentoDraft.regioesSelecionadas.length ? orcamentoDraft.regioesSelecionadas.map((regiao) => (
                              <button key={regiao} type="button" className="budget-region-chip active" onClick={() => removerRegiaoSelecionada(regiao)} disabled={orcamentoBloqueado}>
                                <span>{regiao}</span>
                                <X size={14} />
                              </button>
                            )) : (
                              <span className="empty-inline">Nenhum dente/região selecionado.</span>
                            )}
                          </div>

                          <Odontograma
                            denticao={orcamentoDraft.denticao as "Permanente" | "Decidua"}
                            dentesContratados={dentesContratados}
                            dentesSelecionados={dentesSelecionadosOdontograma}
                            onSelectTooth={(toothId) => {
                              if (!orcamentoBloqueado) alternarRegiaoSelecionada(String(toothId));
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>

                <aside className="budget-preview-panel">
                  <header className="budget-preview-header">
                    <strong>Orçamento</strong>
                    <div className="budget-preview-actions">
                      <button
                        type="button"
                        className={`icon-only${modoReordenarOrcamento ? " active" : ""}`}
                        onClick={() => setModoReordenarOrcamento((atual) => !atual)}
                      >
                        <ArrowUpDown size={18} />
                      </button>
                      <button type="button" className="icon-only" onClick={imprimirOrcamentoAtual}><Printer size={18} /></button>
                      <button type="button" className="icon-only"><Mail size={18} /></button>
                      <div className="budget-menu-shell">
                        <button type="button" className={`icon-only${menuOrcamentoAberto ? " active" : ""}`} onClick={() => setMenuOrcamentoAberto((atual) => !atual)}>
                          <MoreVertical size={18} />
                        </button>
                        {menuOrcamentoAberto ? (
                          <div className="budget-menu-dropdown">
                            <button type="button" className="budget-menu-item" onClick={abrirModalDesconto}>DESCONTO</button>
                            <button
                              type="button"
                              className="budget-menu-item"
                              onClick={() => {
                                setMenuOrcamentoAberto(false);
                                if (orcamentoEditandoId) setConfirmarDesaprovarId(orcamentoEditandoId);
                              }}
                            >
                              REPROVAR
                            </button>
                            <button type="button" className="budget-menu-item" onClick={() => setMenuOrcamentoAberto(false)}>REUTILIZAR ORÇAMENTO</button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </header>

                  <div className="budget-preview-body">
                    {procedimentosOrcamento.length ? procedimentosOrcamento.map((item) => (
                      <article key={item.id} className={`budget-preview-item${item.regioes.every((regiao) => !regiao.ativo) ? " ghost" : ""}`}>
                        <div className="budget-preview-item-main budget-preview-item-main-rich">
                          <div className="budget-preview-item-top">
                            <label className="budget-preview-check">
                              <input
                                type="checkbox"
                                checked={item.regioes.every((regiao) => regiao.ativo)}
                                onChange={() => alternarTodasRegioes(item.id)}
                              />
                            </label>
                            <button type="button" className="budget-preview-expand" onClick={() => alternarProcedimentoExpandido(item.id)}>
                              <ChevronDown size={16} className={item.expandido ? "expanded" : ""} />
                              <strong>{`${item.nome}(x${item.regioes.length})`}</strong>
                            </button>
                            {modoReordenarOrcamento ? (
                              <div className="budget-preview-order-actions">
                                <button type="button" className="icon-only" onClick={() => moverProcedimentoOrcamento(item.id, "up")}>
                                  <ArrowUp size={15} />
                                </button>
                                <button type="button" className="icon-only" onClick={() => moverProcedimentoOrcamento(item.id, "down")}>
                                  <ArrowDown size={15} />
                                </button>
                              </div>
                            ) : null}
                          </div>

                          {item.expandido ? (
                            <div className="budget-preview-detail-list">
                              {item.regioes.map((regiao) => (
                                <div key={regiao.id} className={`budget-preview-detail-row${regiao.ativo ? "" : " muted"}`}>
                                  <label className="budget-preview-check">
                                    <input
                                      type="checkbox"
                                      checked={regiao.ativo}
                                      onChange={() => alternarRegiaoAtiva(item.id, regiao.id)}
                                      disabled={orcamentoBloqueado}
                                    />
                                  </label>
                                  <span className="budget-preview-region-name">{regiao.nome}</span>
                                  <div className="budget-preview-faces">
                                    {FACES_PADRAO.map((face) => (
                                      <button
                                        key={face}
                                        type="button"
                                        className={`budget-face-chip${regiao.faces.includes(face) ? " active" : ""}`}
                                        onClick={() => atualizarFacesRegiao(item.id, regiao.id, face)}
                                        disabled={orcamentoBloqueado}
                                      >
                                        {face}
                                      </button>
                                    ))}
                                  </div>
                                  <input
                                    className="budget-preview-value-input"
                                    value={formatarMoeda(regiao.valor)}
                                    onChange={(e) => atualizarValorRegiao(item.id, regiao.id, e.target.value)}
                                    disabled={orcamentoBloqueado}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <span>{item.clinica}</span>
                          <span>{item.profissional}</span>
                          <span>{item.regioes.map((regiao) => regiao.nome).join(",")}</span>
                        </div>
                        <div className="budget-preview-value">
                          <strong>{formatarMoeda(subtotalProcedimento(item))}</strong>
                          <div className="budget-preview-value-actions">
                            <button
                              type="button"
                              className="budget-preview-value-action"
                              onClick={() => editarProcedimentoOrcamento(item.id)}
                              disabled={orcamentoBloqueado}
                            >
                              <Pencil size={16} />
                              EDITAR
                            </button>
                            <button
                              type="button"
                              className="budget-preview-value-action budget-preview-value-action-danger"
                              onClick={() => excluirProcedimentoOrcamento(item.id)}
                              disabled={orcamentoBloqueado}
                            >
                              <X size={16} />
                              EXCLUIR
                            </button>
                          </div>
                        </div>
                      </article>
                    )) : (
                      <div className="budget-preview-empty">
                        <strong>Seu orçamento aparece aqui.</strong>
                        <span>Selecione um procedimento da lista e clique em adicionar.</span>
                      </div>
                    )}
                  </div>

                  <footer className="budget-preview-footer">
                    <div className="budget-preview-total">
                      <span>Total Particular</span>
                      <div className="budget-preview-total-values">
                        {totalDesconto > 0 ? <em>{`(${resumoDescontoTexto()} desconto)`}</em> : null}
                        <strong>{formatarMoeda(totalOrcamentoFinal)}</strong>
                      </div>
                    </div>
                    <div className="budget-preview-footer-actions">
                      <button type="button" className="ghost-action budget-payment-action" onClick={abrirModalPagamento}>
                        {`Forma: ${resumoFormaPagamento(planoPagamento)}`}
                      </button>
                      <button type="button" className="primary-action" onClick={salvarOrcamentoPaciente} disabled={salvandoOrcamento || orcamentoBloqueado}>
                        {salvandoOrcamento ? "Salvando..." : "Salvar orçamento"}
                      </button>
                    </div>
                  </footer>
                </aside>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {modalPagamentoAberto ? (
        <div className="overlay" role="presentation">
          <article className="modal-shell modal-shell-payment">
            <header className="modal-header">
              <div>
                <h2>Forma de Pagamento</h2>
              </div>
              <button type="button" className="icon-only" onClick={fecharModalPagamento}>
                <X size={20} />
              </button>
            </header>
            <div className="modal-body payment-modal-body">
              <div className="payment-modal-top">
                <label className="payment-check">
                  <input
                    type="checkbox"
                    checked={planoPagamentoEditor.entrada}
                    onChange={(e) => atualizarPlanoPagamentoBase("entrada", e.target.checked)}
                    disabled={orcamentoBloqueado}
                  />
                  Entrada
                </label>
                <label className="form-field">
                  <span>Parcelas</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={planoPagamentoEditor.parcelas}
                    onChange={(e) => atualizarPlanoPagamentoBase("parcelas", Number(e.target.value) || 1)}
                    disabled={orcamentoBloqueado}
                  />
                </label>
              </div>

              <div className="payment-table-shell">
                <table className="payment-table">
                  <thead>
                    <tr>
                      <th>Parcela</th>
                      <th>Data</th>
                      <th>Forma</th>
                      <th>Detalhe</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planoPagamentoEditor.linhas.map((linha, indice) => (
                      <tr key={`${linha.descricao}-${indice}`}>
                        <td>{linha.descricao}</td>
                        <td>
                          <input
                            type="date"
                            value={linha.data}
                            onChange={(e) => atualizarDataParcela(indice, e.target.value)}
                            disabled={orcamentoBloqueado}
                          />
                        </td>
                        <td>
                          <select value={linha.forma} onChange={(e) => atualizarFormaParcela(indice, e.target.value as FormaPagamentoOpcao)} disabled={orcamentoBloqueado}>
                            {FORMAS_PAGAMENTO.map((forma) => (
                              <option key={forma.value} value={forma.value}>{forma.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {linha.forma === "CARTAO_CREDITO" ? (
                            <div className="payment-card-detail">
                              <span>Parcelas no cartao</span>
                              <select value={linha.parcelasCartao} onChange={(e) => atualizarParcelasCartao(indice, Number(e.target.value) || 1)} disabled={orcamentoBloqueado}>
                                {Array.from({ length: 12 }, (_, itemIndice) => itemIndice + 1).map((opcao) => (
                                  <option key={opcao} value={opcao}>{`${opcao}x`}</option>
                                ))}
                              </select>
                            </div>
                          ) : FORMAS_A_VISTA.has(linha.forma) ? (
                            <span className="payment-inline-note">A vista</span>
                          ) : (
                            <span className="payment-inline-note">Mensal</span>
                          )}
                        </td>
                        <td>
                          <input
                            className="payment-value-input"
                            value={valoresParcelasEditando[indice] ?? formatarMoeda(linha.valor)}
                            onFocus={(e) => {
                              iniciarEdicaoValorParcela(indice, linha.valor);
                              window.setTimeout(() => e.target.select(), 0);
                            }}
                            onChange={(e) => alterarTextoValorParcela(indice, e.target.value)}
                            onBlur={() => concluirEdicaoValorParcela(indice)}
                            disabled={orcamentoBloqueado}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <footer className="modal-footer">
              <div className="sticky-actions">
                <button type="button" className="ghost-action" onClick={fecharModalPagamento}>Fechar</button>
                {!orcamentoBloqueado ? <button type="button" className="primary-action" onClick={confirmarModalPagamento}>OK</button> : null}
              </div>
            </footer>
          </article>
        </div>
      ) : null}

      {confirmarDesaprovarId ? (
        <div className="overlay" role="presentation">
          <article className="modal-shell modal-shell-confirm">
            <header className="modal-header">
              <div>
                <h2>Desaprovar orçamento</h2>
              </div>
              <button type="button" className="icon-only" onClick={() => setConfirmarDesaprovarId(null)}>
                <X size={20} />
              </button>
            </header>
            <div className="modal-body confirm-modal-body">
              <div className="confirm-modal-copy">
                <strong>Tem certeza que deseja prosseguir?</strong>
                <p>Ao desaprovar, o orçamento volta para o estado em aberto e poderá ser editado novamente.</p>
              </div>
            </div>
            <footer className="modal-footer">
              <div className="sticky-actions">
                <button type="button" className="ghost-action" onClick={() => setConfirmarDesaprovarId(null)}>Fechar</button>
                <button type="button" className="primary-action" onClick={desaprovarOrcamento}>Confirmar</button>
              </div>
            </footer>
          </article>
        </div>
      ) : null}

    </section>
  );
}


