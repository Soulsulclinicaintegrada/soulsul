import {
  BadgeDollarSign,
  Bell,
  CalendarDays,
  CircleUserRound,
  Import,
  LayoutDashboard,
  Settings,
  Stethoscope,
  TrendingUp,
  UsersRound
} from "lucide-react";
import type { ReactNode } from "react";

export type MenuKey =
  | "Dashboard"
  | "Pacientes"
  | "Guias"
  | "Agenda"
  | "CRM"
  | "Tabelas"
  | "Financeiro"
  | "Usuários";

export type MenuItem = {
  key: MenuKey;
  label: string;
  icon: ReactNode;
};

export type Paciente = {
  id: number;
  nome: string;
  apelido?: string;
  sexo: string;
  nascimento: string;
  telefone: string;
  email: string;
  cpf: string;
  rg: string;
  estadoCivil: string;
  prontuario: string;
  status: "Ativo" | "Pendente";
  observacoes: string;
  financeiro: {
    saldo: string;
    alerta: "ok" | "atencao" | "atrasado";
    proximoRecebimento: string;
    itens: Array<{
      descricao: string;
      valor: string;
      status: "Pago" | "A vencer" | "Atrasado";
      forma: string;
    }>;
  };
  proximoAgendamento?: {
    data: string;
    horario: string;
    profissional: string;
    status: "Confirmado" | "Agendado";
  };
  agendamentos: Array<{
    data: string;
    horario: string;
    procedimento: string;
    status: "Confirmado" | "Agendado" | "Atendido" | "Cancelado";
  }>;
  contratos: Array<{
    id: number;
    status: "Aprovado" | "Aberto";
    total: string;
    data: string;
    responsavel: string;
    procedimentos: Array<{ nome: string; valor: string }>;
  }>;
  documentos: string[];
  exames: Array<{ nome: string; tipo: string; data: string }>;
  especialidades: string[];
};

export type ProfissionalAgenda = {
  id: number;
  nome: string;
  cor: string;
  corSuave: string;
};

export type TipoAtendimentoAgenda = {
  id: number;
  nome: string;
  cor: string;
};

export type EventoAgenda = {
  id: number;
  paciente: string;
  prontuario: string;
  telefone: string;
  profissionalId: number;
  profissional: string;
  tipoAtendimentoId: number;
  tipoAtendimento: string;
  procedimento: string;
  status: "Agendado" | "Confirmado" | "Em espera" | "Em atendimento" | "Atendido" | "Atrasado" | "Faltou" | "Cancelado";
  data: string;
  inicio: string;
  fim: string;
  observacoes?: string;
  financeiro?: "Financeiro Ok" | "RecebÃ­vel pendente";
};

export const menuItems: MenuItem[] = [
  { key: "Dashboard", label: "Dashboard", icon: <LayoutDashboard size={19} /> },
  { key: "Pacientes", label: "Pacientes", icon: <CircleUserRound size={19} /> },
  { key: "Guias", label: "Guias", icon: <Stethoscope size={19} /> },
  { key: "Agenda", label: "Agenda", icon: <CalendarDays size={19} /> },
  { key: "CRM", label: "CRM", icon: <TrendingUp size={19} /> },
  { key: "Tabelas", label: "Tabelas", icon: <Import size={19} /> },
  { key: "Financeiro", label: "Financeiro", icon: <BadgeDollarSign size={19} /> },
  { key: "Usuários", label: "Usuários", icon: <Settings size={19} /> }
];

export const indicadores = [
  {
    titulo: "Faturamento do mÃªs",
    valor: "R$ 142.274,50",
    detalhe: "MarÃ§o de 2026",
    icone: <BadgeDollarSign size={20} />
  },
  {
    titulo: "Pacientes atendidos",
    valor: "94",
    detalhe: "Atendimentos concluÃ­dos",
    icone: <UsersRound size={20} />
  },
  {
    titulo: "Procedimentos do mÃªs",
    valor: "95",
    detalhe: "ProduÃ§Ã£o clÃ­nica atual",
    icone: <Stethoscope size={20} />
  },
  {
    titulo: "Recebimentos de hoje",
    valor: "R$ 3.730,79",
    detalhe: "Caixa confirmado hoje",
    icone: <TrendingUp size={20} />
  }
];

export const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const serieVendas = [38000, 46200, 51200, 48600, 55300, 60700, 58300, 62500, 71200, 69400, 74100, 80500];

export const agendaHoje = [
  { horario: "08:00", titulo: "Sonia Cristina", subtitulo: "AvaliaÃ§Ã£o Â· Dra Ester" },
  { horario: "09:45", titulo: "Diego Luiz", subtitulo: "Moldagem Â· Dr Caio" },
  { horario: "11:00", titulo: "Jovana Pereira", subtitulo: "Retorno Â· Dra Gabriela" }
];

export const alertas = [
  { titulo: "3 inadimplÃªncias crÃ­ticas", detalhe: "RecebÃ­veis vencidos acima de 15 dias" },
  { titulo: "2 contratos sem recebÃ­vel", detalhe: "ImportaÃ§Ãµes exigem revisÃ£o financeira" },
  { titulo: "1 paciente sem prontuÃ¡rio", detalhe: "Cadastro rÃ¡pido pendente de complementaÃ§Ã£o" }
];

export const atividades = [
  { paciente: "Mariana Lima", evento: "Contrato aprovado", valor: "R$ 4.800,00", status: "Aprovado" },
  { paciente: "Carlos Souza", evento: "Recebimento confirmado", valor: "R$ 650,00", status: "Pago" },
  { paciente: "Beatriz Alves", evento: "Nova avaliaÃ§Ã£o", valor: "R$ 0,00", status: "Agendado" },
  { paciente: "Ricardo Melo", evento: "Parcela vencida", valor: "R$ 420,00", status: "Atrasado" }
];

export const pacientesMock: Paciente[] = [
  {
    id: 1,
    nome: "Caroline Garcia GonÃ§alves",
    apelido: "Carol",
    sexo: "Feminino",
    nascimento: "13/05/1998",
    telefone: "(22) 99878-0392",
    email: "caroline@soulsul.com",
    cpf: "470.411.318-31",
    rg: "23.556.889-1",
    estadoCivil: "Solteira",
    prontuario: "2746",
    status: "Ativo",
    observacoes: "Paciente com foco em reabilitaÃ§Ã£o estÃ©tica e financeira em dia.",
    financeiro: {
      saldo: "R$ 0,00",
      alerta: "ok",
      proximoRecebimento: "Sem pendÃªncias",
      itens: [
        { descricao: "Parcela 1/4", valor: "R$ 1.250,00", status: "Pago", forma: "CartÃ£o" },
        { descricao: "Parcela 2/4", valor: "R$ 1.250,00", status: "Pago", forma: "CartÃ£o" },
        { descricao: "Parcela 3/4", valor: "R$ 1.250,00", status: "A vencer", forma: "Boleto" }
      ]
    },
    proximoAgendamento: {
      data: "22/03/2026",
      horario: "09:15",
      profissional: "Dra Gabriela",
      status: "Confirmado"
    },
    agendamentos: [
      { data: "22/03/2026", horario: "09:15", procedimento: "Lente de contato dental", status: "Confirmado" },
      { data: "16/03/2026", horario: "10:30", procedimento: "AvaliaÃ§Ã£o estÃ©tica", status: "Atendido" }
    ],
    contratos: [
      {
        id: 101,
        status: "Aprovado",
        total: "R$ 7.310,00",
        data: "18/03/2026",
        responsavel: "Juliana Ribeiro",
        procedimentos: [
          { nome: "Retratamento EndodÃ´ntico", valor: "R$ 2.580,00" },
          { nome: "Pino Fibra de Vidro", valor: "R$ 390,00" },
          { nome: "Lente de contato dental", valor: "R$ 4.340,00" }
        ]
      }
    ],
    documentos: ["Contrato odontolÃ³gico", "Consentimento cirÃºrgico", "AutorizaÃ§Ã£o de boletos"],
    exames: [
      { nome: "Tomografia inicial", tipo: "Tomografia", data: "10/03/2026" },
      { nome: "RX panorÃ¢mico", tipo: "RX", data: "05/03/2026" }
    ],
    especialidades: ["EstÃ©tica", "PrÃ³tese", "Endodontia"]
  },
  {
    id: 2,
    nome: "Jolvani Alves",
    apelido: "Jol",
    sexo: "Masculino",
    nascimento: "20/07/1984",
    telefone: "(22) 99212-4422",
    email: "jolvani@email.com",
    cpf: "051.865.117-73",
    rg: "19.223.771-0",
    estadoCivil: "Casado",
    prontuario: "379",
    status: "Ativo",
    observacoes: "Acompanhamento periodontal com recebÃ­veis em aberto.",
    financeiro: {
      saldo: "R$ 5.040,00",
      alerta: "atrasado",
      proximoRecebimento: "10/04/2026 Â· R$ 560,00",
      itens: [
        { descricao: "Parcela 1/10", valor: "R$ 560,00", status: "Pago", forma: "Boleto" },
        { descricao: "Parcela 2/10", valor: "R$ 560,00", status: "Atrasado", forma: "Boleto" },
        { descricao: "Parcela 3/10", valor: "R$ 560,00", status: "A vencer", forma: "Boleto" }
      ]
    },
    proximoAgendamento: {
      data: "21/03/2026",
      horario: "14:00",
      profissional: "Dr Ayrton",
      status: "Agendado"
    },
    agendamentos: [
      { data: "21/03/2026", horario: "14:00", procedimento: "Tratamento periodontal", status: "Agendado" },
      { data: "12/03/2026", horario: "08:00", procedimento: "Consulta de revisÃ£o", status: "Atendido" }
    ],
    contratos: [
      {
        id: 102,
        status: "Aberto",
        total: "R$ 5.600,00",
        data: "16/03/2026",
        responsavel: "Juliana Ribeiro",
        procedimentos: [
          { nome: "Tratamento periodontal", valor: "R$ 4.200,00" },
          { nome: "Profilaxia", valor: "R$ 1.400,00" }
        ]
      }
    ],
    documentos: ["Recibo 16/03", "Plano de tratamento"],
    exames: [{ nome: "RX interproximal", tipo: "RX", data: "02/03/2026" }],
    especialidades: ["Periodontia"]
  },
  {
    id: 3,
    nome: "Diego Luiz GonÃ§alves Teixeira Cabral",
    apelido: "Diego",
    sexo: "Masculino",
    nascimento: "18/11/1991",
    telefone: "(22) 99816-1901",
    email: "diego@corp.com",
    cpf: "145.159.837-84",
    rg: "28.005.114-0",
    estadoCivil: "Solteiro",
    prontuario: "2767",
    status: "Ativo",
    observacoes: "Paciente com contrato em execuÃ§Ã£o e boa adesÃ£o clÃ­nica.",
    financeiro: {
      saldo: "R$ 0,00",
      alerta: "ok",
      proximoRecebimento: "Sem pendÃªncias",
      itens: [{ descricao: "Entrada", valor: "R$ 2.500,00", status: "Pago", forma: "Pix" }]
    },
    proximoAgendamento: {
      data: "20/03/2026",
      horario: "09:45",
      profissional: "Dr Caio",
      status: "Confirmado"
    },
    agendamentos: [{ data: "20/03/2026", horario: "09:45", procedimento: "Moldagem", status: "Confirmado" }],
    contratos: [
      {
        id: 103,
        status: "Aprovado",
        total: "R$ 2.500,00",
        data: "19/03/2026",
        responsavel: "Juliana Ribeiro",
        procedimentos: [{ nome: "Moldagem", valor: "R$ 2.500,00" }]
      }
    ],
    documentos: ["OrÃ§amento aprovado"],
    exames: [],
    especialidades: ["PrÃ³tese"]
  }
];

export const profissionaisAgenda: ProfissionalAgenda[] = [
  { id: 1, nome: "AvaliaÃ§Ã£o", cor: "#f4b2be", corSuave: "#fbe3e8" },
  { id: 2, nome: "Berenice", cor: "#f6e88f", corSuave: "#fdf7d6" },
  { id: 3, nome: "Dr Ayrton", cor: "#ff8d0a", corSuave: "#ffe6c2" },
  { id: 4, nome: "Dr Caio", cor: "#ff2f2f", corSuave: "#ffd7d7" },
  { id: 5, nome: "Dra Ester", cor: "#ef10ff", corSuave: "#f9d8fd" },
  { id: 6, nome: "Dra Gabriela", cor: "#8ce07a", corSuave: "#e0f7db" },
  { id: 7, nome: "Dra Sophia", cor: "#9f92f0", corSuave: "#e5e1ff" },
  { id: 8, nome: "Fisio Adriel", cor: "#ffb347", corSuave: "#ffe8c8" },
  { id: 9, nome: "Juliana", cor: "#f7a9b8", corSuave: "#fde1e7" },
  { id: 10, nome: "PsicÃ³loga Caroline", cor: "#7b0000", corSuave: "#eed3d3" },
  { id: 11, nome: "Psicopedagoga Juliana F", cor: "#8c14e7", corSuave: "#eedbff" }
];

export const tiposAtendimentoAgenda: TipoAtendimentoAgenda[] = [
  { id: 1, nome: "Avaliação", cor: "#fff2a8" },
  { id: 2, nome: "Cirurgia", cor: "#d6b8ee" },
  { id: 3, nome: "Consulta", cor: "#bfe4df" },
  { id: 4, nome: "Emergência", cor: "#ff1c1c" },
  { id: 5, nome: "Periódico", cor: "#c6e0ff" },
  { id: 6, nome: "Retorno", cor: "#ccbdb7" }
];

export const eventosAgendaDia: EventoAgenda[] = [
  {
    id: 1,
    paciente: "Sonia Cristina",
    prontuario: "2481",
    telefone: "(22) 99811-7702",
    profissionalId: 1,
    profissional: "AvaliaÃ§Ã£o",
    tipoAtendimentoId: 1,
    tipoAtendimento: "AvaliaÃ§Ã£o",
    procedimento: "AvaliaÃ§Ã£o estÃ©tica",
    status: "Confirmado",
    data: "20/03/2026",
    inicio: "09:00",
    fim: "09:30",
    financeiro: "Financeiro Ok"
  },
  {
    id: 2,
    paciente: "Diego Luiz GonÃ§alves",
    prontuario: "2767",
    telefone: "(22) 99816-1901",
    profissionalId: 4,
    profissional: "Dr Caio",
    tipoAtendimentoId: 3,
    tipoAtendimento: "Consulta",
    procedimento: "Moldagem",
    status: "Atendido",
    data: "20/03/2026",
    inicio: "09:45",
    fim: "10:45",
    observacoes: "Paciente compareceu no horÃ¡rio.",
    financeiro: "Financeiro Ok"
  },
  {
    id: 3,
    paciente: "Flavia Cristina",
    prontuario: "3442",
    telefone: "(22) 99844-2211",
    profissionalId: 9,
    profissional: "Juliana",
    tipoAtendimentoId: 6,
    tipoAtendimento: "Retorno",
    procedimento: "Retorno clÃ­nico",
    status: "Agendado",
    data: "20/03/2026",
    inicio: "11:00",
    fim: "11:30"
  }
];

export type ContratoResumo = {
  id: number;
  paciente: string;
  prontuario: string;
  status: "Aprovado" | "Aberto" | "Em revisao";
  formaPagamento: string;
  valorTotal: string;
  data: string;
  responsavel: string;
  procedimentos: Array<{ nome: string; valor: string }>;
};

export type RecebivelResumo = {
  paciente: string;
  prontuario: string;
  vencimento: string;
  valor: string;
  status: "Pago" | "A vencer" | "Atrasado" | "Suspenso";
  forma: string;
};

export type ContaPagarResumo = {
  titulo: string;
  categoria: string;
  vencimento: string;
  valor: string;
  status: "Pago" | "A vencer" | "Atrasado";
};

export type ImportacaoResumo = {
  id: number;
  tipo: "Contratos" | "Recebiveis" | "A pagar" | "Vendas";
  arquivo: string;
  status: "Concluida" | "Parcial" | "Pendente";
  data: string;
  linhas: number;
};

export type UsuarioResumo = {
  id: number;
  nome: string;
  usuario?: string;
  nomeAgenda?: string;
  perfil: "Administrador" | "Usuario";
  cargo?: "Administrador" | "Profissional" | "Recepcionista";
  agendaEscopo?: "Toda a clinica" | "Somente a propria";
  agendaDisponivel?: boolean;
  status: "Ativo" | "Inativo";
  ultimoAcesso: string;
  modulos: string[];
};

const USUARIOS_STORAGE_KEY = "soulsul_usuarios";

export const contratosMock: ContratoResumo[] = [
  {
    id: 13,
    paciente: "Juliana Sousa Gomes Ribeiro",
    prontuario: "3255",
    status: "Aprovado",
    formaPagamento: "Boleto",
    valorTotal: "R$ 4.474,00",
    data: "20/03/2026",
    responsavel: "Juliana",
    procedimentos: [
      { nome: "Tratamento periodontal moderado", valor: "R$ 1.280,00" },
      { nome: "Coroa metaloceramica", valor: "R$ 2.194,00" },
      { nome: "Restauracao resina", valor: "R$ 1.000,00" }
    ]
  },
  {
    id: 12,
    paciente: "Jolvani Alves",
    prontuario: "379",
    status: "Aberto",
    formaPagamento: "Boleto",
    valorTotal: "R$ 5.600,00",
    data: "10/03/2026",
    responsavel: "Juliana",
    procedimentos: [
      { nome: "Perio", valor: "R$ 5.000,00" },
      { nome: "Restauracao", valor: "R$ 600,00" }
    ]
  },
  {
    id: 15,
    paciente: "Caroline Garcia Goncalves",
    prontuario: "2746",
    status: "Em revisao",
    formaPagamento: "Pix",
    valorTotal: "R$ 7.310,00",
    data: "18/03/2026",
    responsavel: "Juliana",
    procedimentos: [
      { nome: "Retratamento endodontico", valor: "R$ 2.580,00" },
      { nome: "Lente de contato dental", valor: "R$ 4.340,00" }
    ]
  }
];

export const recebiveisMock: RecebivelResumo[] = [
  { paciente: "Jolvani Alves", prontuario: "379", vencimento: "10/04/2026", valor: "R$ 560,00", status: "A vencer", forma: "Boleto" },
  { paciente: "Juliana Sousa Gomes Ribeiro", prontuario: "3255", vencimento: "20/03/2026", valor: "R$ 447,40", status: "Pago", forma: "Boleto" },
  { paciente: "Sandra da Silva", prontuario: "3385", vencimento: "05/03/2026", valor: "R$ 300,00", status: "Atrasado", forma: "Boleto" },
  { paciente: "Maria Cecilia de Carvalho", prontuario: "3369", vencimento: "12/04/2026", valor: "R$ 720,00", status: "Suspenso", forma: "Boleto" }
];

export const contasPagarMock: ContaPagarResumo[] = [
  { titulo: "Clinicorp", categoria: "Servicos", vencimento: "25/03/2026", valor: "R$ 149,90", status: "A vencer" },
  { titulo: "Funcionarios", categoria: "Funcionarios", vencimento: "05/04/2026", valor: "R$ 8.900,00", status: "A vencer" },
  { titulo: "Aguas Paraiba", categoria: "Custo fixo", vencimento: "05/04/2026", valor: "R$ 500,00", status: "Pago" },
  { titulo: "Contador", categoria: "Servicos", vencimento: "26/12/2024", valor: "R$ 1.600,00", status: "Atrasado" }
];

export const importacoesMock: ImportacaoResumo[] = [
  { id: 1, tipo: "Contratos", arquivo: "CADASTRO DE CONTRATOS 2026 2.xlsx", status: "Concluida", data: "20/03/2026 11:24", linhas: 95 },
  { id: 2, tipo: "Recebiveis", arquivo: "recebiveis.xlsx", status: "Concluida", data: "20/03/2026 11:40", linhas: 214 },
  { id: 3, tipo: "A pagar", arquivo: "a pagar.xlsx", status: "Parcial", data: "20/03/2026 12:05", linhas: 88 },
  { id: 4, tipo: "Vendas", arquivo: "vendas.xlsx", status: "Pendente", data: "20/03/2026 12:18", linhas: 132 }
];

export const usuariosMock: UsuarioResumo[] = [
  { id: 1, nome: "Juliana", usuario: "juliana", nomeAgenda: "JULIANA", perfil: "Administrador", cargo: "Administrador", agendaEscopo: "Toda a clinica", agendaDisponivel: false, status: "Ativo", ultimoAcesso: "21/03/2026 10:14", modulos: ["Dashboard", "Pacientes", "Agenda", "Financeiro", "Usuarios"] },
  { id: 2, nome: "Eliane", usuario: "eliane", nomeAgenda: "ELIANE", perfil: "Usuario", cargo: "Profissional", agendaEscopo: "Somente a propria", agendaDisponivel: true, status: "Ativo", ultimoAcesso: "21/03/2026 09:42", modulos: ["Dashboard", "Pacientes", "Agenda"] },
  { id: 3, nome: "Dra Ester", usuario: "draester", nomeAgenda: "DRA ESTER", perfil: "Usuario", cargo: "Profissional", agendaEscopo: "Somente a propria", agendaDisponivel: true, status: "Ativo", ultimoAcesso: "21/03/2026 08:58", modulos: ["Agenda", "Pacientes"] },
  { id: 4, nome: "Camila", usuario: "camila", nomeAgenda: "CAMILA", perfil: "Usuario", cargo: "Recepcionista", agendaEscopo: "Toda a clinica", agendaDisponivel: false, status: "Ativo", ultimoAcesso: "21/03/2026 08:41", modulos: ["Dashboard", "Pacientes", "Agenda", "Financeiro"] }
];

export function obterUsuariosSistema(): UsuarioResumo[] {
  if (typeof window === "undefined") return usuariosMock;
  const bruto = window.localStorage.getItem(USUARIOS_STORAGE_KEY);
  if (!bruto) return usuariosMock;
  try {
    const parsed = JSON.parse(bruto) as UsuarioResumo[];
    return Array.isArray(parsed) && parsed.length ? parsed : usuariosMock;
  } catch {
    return usuariosMock;
  }
}

export function salvarUsuariosSistema(usuarios: UsuarioResumo[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USUARIOS_STORAGE_KEY, JSON.stringify(usuarios));
}

