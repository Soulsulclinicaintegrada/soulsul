import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType, type FormEvent } from "react";
import logoUrl from "./assets/logo-soulsul-eleven.png";
import { EducacaoAgendaPage } from "./EducacaoAgendaPage";
import {
  atualizarAlunoApi,
  atualizarTreinamentoApi,
  atualizarTurmaTreinamentoApi,
  alterarStatusTurmaEducacaoApi,
  criarAlunoApi,
  criarMatriculaTreinamentoApi,
  criarTreinamentoApi,
  criarTurmaTreinamentoApi,
  excluirAlunoApi,
  listarAlunosExcluidosApi,
  desativarPacienteModeloEducacaoApi,
  listarPacientesModeloExcluidosApi,
  cancelarMatriculaTreinamentoApi,
  excluirMatriculaTreinamentoApi,
  excluirTreinamentoApi,
  excluirTurmaTreinamentoApi,
  listarAlunosApi,
  listarMatriculasTreinamentoApi,
  listarTreinamentosApi,
  listarTurmasTreinamentoApi,
  loginEducacaoApi,
  buscarRecursoEducacaoApi,
  criarRecursoEducacaoApi,
  atualizarRecursoEducacaoApi,
  alterarStatusOrcamentoEducacaoApi,
  baixarContratoEducacaoApi,
  baixarContratoMatriculaEducacaoApi,
  resetarSenhaUsuarioEducacaoApi,
  trocarSenhaEducacaoApi,
  listarGuiasEducacaoApi,
  criarGuiaEducacaoApi,
  baixarGuiaEducacaoApi,
  baixarLancamentoFinanceiroEducacaoApi,
  buscarConfiguracoesFinanceiroEducacaoApi,
  salvarConfiguracoesFinanceiroEducacaoApi,
  type GuiaEducacaoApi,
  type AlunoApi,
  type MatriculaTreinamentoApi,
  type TreinamentoApi,
  type TurmaTreinamentoApi,
} from "./pacientesApi";

function ToothIcon({ size = 20, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5.2c-1.8 0-2.7-1.2-4.5-1.2C4.7 4 3 6.2 3 9c0 2.2 1 3.8 1.7 5.4.8 1.9 1.1 5.6 3 5.6 1.7 0 1.8-4.4 4.3-4.4s2.6 4.4 4.3 4.4c1.9 0 2.2-3.7 3-5.6C20 12.8 21 11.2 21 9c0-2.8-1.7-5-4.5-5-1.8 0-2.7 1.2-4.5 1.2Z" />
      <path d="M9.1 7.3c1.8.8 4 .8 5.8 0" />
    </svg>
  );
}

const dashboardEducacaoVazio: Record<string, unknown> = {
  alunos: 0,
  pacientesModelo: 0,
  turmasAtivas: 0,
  agendaHoje: 0,
  receitas: 0,
  despesas: 0,
  aReceber: 0,
};

type Aba = "Alunos" | "Treinamentos" | "Matrículas" | "Turmas";
const alunoVazio = {
  nome: "",
  sexo: "",
  cpf: "",
  rg: "",
  data_nascimento: "",
  telefone: "",
  email: "",
  cep: "",
  endereco: "",
  complemento: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  estado_civil: "",
  cro: "",
  profissao: "",
  origem: "",
  menor_idade: false,
  responsavel: "",
  cpf_responsavel: "",
  indicado_por_aluno: "",
  indicado_clinica: false,
  observacoes: "",
  ativo: true,
};
const treinamentoVazio = {
  nome: "",
  categoria: "",
  descricao: "",
  carga_horaria: 0,
  valor: 0,
  ativo: true,
  quantidade_turmas:1,
  max_alunos_por_turma:0,
  data_inicio:"",
  horario_inicio:"",
  periodicidade:"Quinzenal",
  dias_horarios:{} as Record<string,{inicio:string;fim:string}>,
};
const turmaVazia = {
  treinamento_id: 0,
  nome: "",
  instrutor: "",
  data_inicio: "",
  data_fim: "",
  horario: "",
  local: "",
  vagas: 0,
  status: "Turma confirmada",
};
function numeroEducacao(valor: string) {
  const texto = String(valor || "")
    .trim()
    .replace(/\s/g, "");
  if (!texto) return 0;
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

const TAXAS_CARTAO_INFINITEPAY = {
  "Visa / Mastercard": [3.15, 5.39, 6.12, 6.85, 7.57, 8.28, 8.99, 9.69, 10.38, 11.06, 11.74, 12.4],
  "Elo / Amex / Hipercard": [4.91, 6.47, 7.2, 7.92, 8.63, 9.33, 10.03, 10.72, 11.41, 12.08, 12.75, 13.41],
} as const;
const FATORES_CARTAO_PAGBANK = [1.0526, 1.1101, 1.1273, 1.1447, 1.1624, 1.1803, 1.1984, 1.2167, 1.2352, 1.2538, 1.2728, 1.2919, 1.3112, 1.3307, 1.3505, 1.3703, 1.3905, 1.4109] as const;
const TAXAS_CONFIGURACAO_PADRAO = [
  ...TAXAS_CARTAO_INFINITEPAY["Visa / Mastercard"].map((taxa, i) => ({ maquina: "InfinitePay", bandeira: "Visa / Mastercard", parcelas: i + 1, taxa: String(taxa) })),
  ...TAXAS_CARTAO_INFINITEPAY["Elo / Amex / Hipercard"].map((taxa, i) => ({ maquina: "InfinitePay", bandeira: "Elo / Amex / Hipercard", parcelas: i + 1, taxa: String(taxa) })),
  ...FATORES_CARTAO_PAGBANK.map((fator, i) => ({ maquina: "PagBank", bandeira: "Todas", parcelas: i + 1, taxa: String(((fator - 1) * 100).toFixed(2)) })),
];
type OperadoraCartaoEducacao = "InfinitePay" | "PagBank";
type BandeiraCartaoEducacao = keyof typeof TAXAS_CARTAO_INFINITEPAY;
type AbaFichaPaciente = "Cadastro"|"Orçamentos"|"Financeiro"|"Documentos"|"Agendamentos";
const SUBFUNCOES_ACESSO_EDUCACAO:Record<string,string[]>={Alunos:["Cadastro","Documentos"],Treinamentos:["Treinamentos","Matrículas","Turmas"],Pacientes:["Cadastro","Orçamentos","Financeiro","Documentos","Agendamentos"],Orçamentos:["Gerenciar orçamentos","Aprovar orçamentos"],CRM:["Acompanhamento"],Guias:["Guias"],Agenda:["Agenda"],Financeiro:["Movimentações","Tabela de preços"]};
const permissoesPadraoEducacao=()=>Object.fromEntries(Object.entries(SUBFUNCOES_ACESSO_EDUCACAO).flatMap(([modulo,subs])=>[[modulo,true],...subs.map(sub=>[`${modulo}.${sub}`,"edit"])]));

function arredondarCobrancaCartao(valor: number) {
  return Math.ceil((Math.max(0, valor) - 1e-9) * 100) / 100;
}

export function EducacaoPortal() {
  const [autenticado, setAutenticado] = useState(() =>
    Boolean(localStorage.getItem("soulsul_educacao_token")),
  );
  const [credenciais, setCredenciais] = useState({ usuario: "", senha: "" });
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [usuarioEducacao, setUsuarioEducacao] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem("soulsul_educacao_usuario") || "null"); } catch { return null; }
  });
  const [modulo, setModulo] = useState("Dashboard");
  const [novaSenhaObrigatoria,setNovaSenhaObrigatoria]=useState({senha:"",confirmacao:""});
  const [menuExpandido, setMenuExpandido] = useState(() =>
    localStorage.getItem("soulsul.educacao.sidebar.expanded") !== "false",
  );
  const [menuMovelAberto, setMenuMovelAberto] = useState(false);
  const [pacienteSelecionadoId,setPacienteSelecionadoId]=useState<number|null>(null);
  const [orcamentoEditandoId,setOrcamentoEditandoId]=useState<number|null>(null);
  const [pacienteAbaInicial,setPacienteAbaInicial]=useState<AbaFichaPaciente>("Cadastro");
  const modulos = [
    "Dashboard",
    "Agenda",
    "Alunos",
    "Pacientes",
    "Treinamentos",
    "Orçamentos",
    "Guias",
    "Financeiro",
    "CRM",
    "Usuários",
  ].filter(item => {
    const admin = usuarioEducacao?.perfil === "ADMINISTRADOR" || usuarioEducacao?.usuario === "educacao.admin";
    if (item === "Usuários") return admin;
    if(admin||item==="Dashboard")return true;const p=usuarioEducacao?.permissoes||{};const subs=SUBFUNCOES_ACESSO_EDUCACAO[item]||[];return p[item]!==false&&subs.some(sub=>(p[`${item}.${sub}`]??"edit")!=="none");
  });
  const iconesModulo: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
    Dashboard: LayoutDashboard,
    Alunos: GraduationCap,
    Treinamentos: BookOpen,
    Pacientes: ToothIcon,
    Orçamentos: ReceiptText,
    CRM: HeartHandshake,
    Guias: ClipboardList,
    Agenda: CalendarDays,
    Financeiro: WalletCards,
    Usuários: ShieldCheck,
  };
  const navegar = (item: string) => {
    setModulo(item);
    setMenuMovelAberto(false);
    if (item !== "Pacientes") setPacienteSelecionadoId(null);
    if (item === "Orçamentos") setOrcamentoEditandoId(null);
  };
  const alternarMenu = () => {
    const proximo = !menuExpandido;
    setMenuExpandido(proximo);
    localStorage.setItem("soulsul.educacao.sidebar.expanded", String(proximo));
  };
  if(autenticado&&usuarioEducacao?.precisaTrocarSenha)return <main className="education-login-shell"><form className="education-login-card" onSubmit={async e=>{e.preventDefault();setErro("");if(novaSenhaObrigatoria.senha!==novaSenhaObrigatoria.confirmacao){setErro("As senhas não conferem.");return}try{await trocarSenhaEducacaoApi(novaSenhaObrigatoria.senha);const atualizado={...usuarioEducacao,precisaTrocarSenha:false};localStorage.setItem("soulsul_educacao_usuario",JSON.stringify(atualizado));setUsuarioEducacao(atualizado)}catch(ex){setErro(ex instanceof Error?ex.message:"Não foi possível redefinir a senha.")}}}><span className="page-eyebrow">PRIMEIRO ACESSO</span><h1>Crie uma nova senha</h1><p>A senha padrão precisa ser substituída antes de acessar o sistema.</p><label>Nova senha<input required minLength={6} type="password" value={novaSenhaObrigatoria.senha} onChange={e=>setNovaSenhaObrigatoria({...novaSenhaObrigatoria,senha:e.target.value})}/></label><label>Confirme a nova senha<input required minLength={6} type="password" value={novaSenhaObrigatoria.confirmacao} onChange={e=>setNovaSenhaObrigatoria({...novaSenhaObrigatoria,confirmacao:e.target.value})}/></label>{erro&&<div className="education-error">{erro}</div>}<button className="primary-button">Redefinir senha e entrar</button></form></main>;
  if (autenticado)
    return (
      <div className={`education-portal-shell${menuExpandido ? "" : " education-sidebar-collapsed"}`}>
        {menuMovelAberto && <button className="education-sidebar-backdrop" aria-label="Fechar menu" onClick={() => setMenuMovelAberto(false)} />}
        <aside className={`education-sidebar${menuMovelAberto ? " open" : ""}`}>
          <button className="education-sidebar-toggle" type="button" onClick={alternarMenu} aria-label={menuExpandido ? "Recolher menu" : "Expandir menu"}>
            {menuExpandido ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
          </button>
          <div className="education-brand">
            <div className="education-brand-mark">
              <img src={logoUrl} alt="SoulSul Eleven" />
            </div>
          </div>
          <div className="education-sidebar-label">GESTÃO ACADÊMICA</div>
          <nav className="education-main-nav" aria-label="Navegação da educação">
            {modulos.map((item) => {
              const Icone = iconesModulo[item] || FileText;
              return <button
                key={item}
                className={modulo === item ? "active" : ""}
                onClick={() => navegar(item)}
                title={!menuExpandido ? item : undefined}
                aria-label={item}
              >
                <Icone size={20} strokeWidth={1.8} />
                <span>{item}</span>
              </button>;
            })}
          </nav>
          <div className="education-sidebar-footer">
            <div className="education-user-card">
              <span className="education-user-avatar"><UserRound size={18} /></span>
              <div><strong>{usuarioEducacao?.nome || usuarioEducacao?.usuario || "Usuário"}</strong><small>{usuarioEducacao?.perfil || "Educação"}</small></div>
            </div>
            <button className="education-logout" onClick={() => {
              localStorage.removeItem("soulsul_educacao_token");
              localStorage.removeItem("soulsul_educacao_usuario");
              setUsuarioEducacao(null);
              setAutenticado(false);
            }}><LogOut size={18} /><span>Sair do portal</span></button>
          </div>
        </aside>
        <main className="education-workspace">
          <header className="education-portal-top">
            <button className="education-mobile-menu" type="button" aria-label="Abrir menu" onClick={() => setMenuMovelAberto(true)}><Menu size={21} /></button>
            <div className="education-page-title"><span>SoulSul Eleven</span><strong>{modulo}</strong></div>
            <div className="education-top-status"><span className="education-status-dot" />Portal seguro</div>
          </header>
          <div className="education-content">
          {modulo === "Alunos" ? (
          <EducacaoPage secao="Alunos" />
        ) : modulo === "Treinamentos" ? (
          <EducacaoPage secao="Treinamentos" />
        ) : modulo === "Orçamentos" ? (
          <EducacaoOrcamentos orcamentoId={orcamentoEditandoId} onAbrirPaciente={(id,aba="Orçamentos")=>{setOrcamentoEditandoId(null);setPacienteSelecionadoId(id);setPacienteAbaInicial(aba);setModulo("Pacientes")}} />
        ) : modulo === "CRM" ? (
          <EducacaoCrm />
        ) : modulo === "Financeiro" ? (
          <EducacaoFinanceiro />
        ) : modulo === "Guias" ? (
          <EducacaoGuias />
        ) : modulo === "Agenda" ? (
          <EducacaoAgendaPage usuarioLogado={usuarioEducacao} />
        ) : modulo === "Usuários" ? (
          <EducacaoUsuarios />
        ) : (
          <EducacaoModulo modulo={modulo} pacienteInicialId={modulo==="Pacientes"?pacienteSelecionadoId:null} pacienteAbaInicial={pacienteAbaInicial} onPacienteAberto={(id)=>{setPacienteSelecionadoId(id);if(id)setPacienteAbaInicial("Cadastro")}} onEditarOrcamento={(id)=>{setOrcamentoEditandoId(id);setPacienteAbaInicial("Orçamentos");setModulo("Orçamentos")}} />
          )}
          </div>
        </main>
      </div>
    );
  return (
    <main className="education-login-shell">
      <form
        className="education-login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setEntrando(true);
          setErro("");
          try {
            const resposta = await loginEducacaoApi(
              credenciais.usuario,
              credenciais.senha,
            );
            localStorage.setItem("soulsul_educacao_token", resposta.token);
            localStorage.setItem("soulsul_educacao_usuario", JSON.stringify(resposta.usuario));
            setUsuarioEducacao(resposta.usuario);
            setAutenticado(true);
          } catch (ex) {
            setErro(
              ex instanceof Error ? ex.message : "Não foi possível entrar.",
            );
          } finally {
            setEntrando(false);
          }
        }}
      >
        <div className="education-login-brand">
          <img src={logoUrl} alt="SoulSul Instituto Eleven" />
        </div>
        <span className="page-eyebrow">PORTAL EXCLUSIVO</span>
        <h1>Bem-vindo de volta</h1>
        <label>
          Usuário
          <input
            autoFocus
            required
            value={credenciais.usuario}
            onChange={(e) =>
              setCredenciais({ ...credenciais, usuario: e.target.value })
            }
          />
        </label>
        <label>
          Senha
          <input
            required
            type="password"
            value={credenciais.senha}
            onChange={(e) =>
              setCredenciais({ ...credenciais, senha: e.target.value })
            }
          />
        </label>
        {erro && <div className="education-error">{erro}</div>}
        <button className="primary-button" disabled={entrando}>
          {entrando ? "Entrando..." : "Entrar no portal"}
        </button>
        <small>
          Este acesso não permite visualizar os dados administrativos da
          clínica.
        </small>
      </form>
    </main>
  );
}

type CampoModulo = {
  nome: string;
  rotulo: string;
  tipo?: string;
  obrigatorio?: boolean;
  opcoes?: string[];
};
const camposModulo: Record<string, CampoModulo[]> = {
  Pacientes: [
    { nome: "nome", rotulo: "Nome completo", obrigatorio: true },
    { nome: "cpf", rotulo: "CPF", obrigatorio: true },
    {
      nome: "sexo",
      rotulo: "Sexo",
      tipo: "radio",
      opcoes: ["Feminino", "Masculino", "Outro"],
      obrigatorio: true,
    },
    { nome: "telefone", rotulo: "Telefone", obrigatorio: true },
    { nome: "rg", rotulo: "RG" },
    { nome: "data_nascimento", rotulo: "Data de nascimento", tipo: "date" },
    { nome: "email", rotulo: "E-mail" },
    { nome: "cep", rotulo: "CEP", obrigatorio: true },
    { nome: "endereco", rotulo: "Endereço", obrigatorio: true },
    { nome: "complemento", rotulo: "Complemento" },
    { nome: "numero", rotulo: "Número", obrigatorio: true },
    { nome: "bairro", rotulo: "Bairro", obrigatorio: true },
    { nome: "cidade", rotulo: "Cidade", obrigatorio: true },
    { nome: "estado", rotulo: "Estado", obrigatorio: true },
    { nome: "estado_civil", rotulo: "Estado civil" },
    { nome: "profissao", rotulo: "Profissão" },
    { nome: "origem", rotulo: "Como conheceu" },
    {
      nome: "indicado_aluno",
      rotulo: "Indicado por aluno(a)",
      tipo: "checkbox",
    },
    {
      nome: "indicado_clinica",
      rotulo: "Indicado pela clínica",
      tipo: "checkbox",
    },
    {
      nome: "indicado_por_aluno",
      rotulo: "Selecione o aluno indicador",
      tipo: "aluno",
    },
    { nome: "responsavel", rotulo: "Responsável (se menor)" },
    { nome: "cpf_responsavel", rotulo: "CPF do responsável" },
    { nome: "observacoes", rotulo: "Observações", tipo: "textarea" },
  ],
  "Tabela de preços": [
    { nome: "nome", rotulo: "Tratamento", obrigatorio: true },
    { nome: "valor", rotulo: "Valor", tipo: "number", obrigatorio: true },
    { nome: "duracao_minutos", rotulo: "Duração em minutos", tipo: "number" },
    { nome: "descricao", rotulo: "Descrição", tipo: "textarea" },
  ],
  Guias: [
    { nome: "descricao", rotulo: "Descrição da guia", obrigatorio: true },
    { nome: "data_solicitacao", rotulo: "Data da solicitação", tipo: "date" },
    { nome: "responsavel", rotulo: "Responsável" },
    {
      nome: "status",
      rotulo: "Status",
      tipo: "select",
      opcoes: ["Pendente", "Em andamento", "Concluída", "Cancelada"],
    },
    { nome: "observacoes", rotulo: "Observações", tipo: "textarea" },
  ],
  Agenda: [
    { nome: "data", rotulo: "Data", tipo: "date", obrigatorio: true },
    { nome: "hora_inicio", rotulo: "Hora inicial", tipo: "time" },
    { nome: "hora_fim", rotulo: "Hora final", tipo: "time" },
    { nome: "titulo", rotulo: "Atividade", obrigatorio: true },
    { nome: "responsavel", rotulo: "Responsável" },
    { nome: "local", rotulo: "Local" },
    {
      nome: "status",
      rotulo: "Status",
      tipo: "select",
      opcoes: ["Agendado", "Confirmado", "Realizado", "Cancelado"],
    },
    { nome: "observacoes", rotulo: "Observações", tipo: "textarea" },
  ],
  Financeiro: [
    { nome: "descricao", rotulo: "Descrição", obrigatorio: true },
    {
      nome: "tipo",
      rotulo: "Tipo",
      tipo: "select",
      opcoes: ["Receita", "Despesa"],
    },
    { nome: "categoria", rotulo: "Categoria" },
    { nome: "valor", rotulo: "Valor", tipo: "number", obrigatorio: true },
    { nome: "data_vencimento", rotulo: "Vencimento", tipo: "date" },
    {
      nome: "status",
      rotulo: "Status",
      tipo: "select",
      opcoes: ["Em aberto", "Pago", "Cancelado"],
    },
    { nome: "forma_pagamento", rotulo: "Forma de pagamento" },
  ],
  Usuários: [
    { nome: "nome", rotulo: "Nome", obrigatorio: true },
    { nome: "usuario", rotulo: "Usuário de acesso", obrigatorio: true },
    {
      nome: "senha",
      rotulo: "Senha temporária",
      tipo: "password",
      obrigatorio: true,
    },
  ],
};

function EducacaoFinanceiro() {
  const [abaFinanceiro, setAbaFinanceiro] = useState<"Caixa"|"Recebíveis"|"Contas a pagar"|"Tabela de preços"|"Configurações">("Caixa");
  const [lancamentos,setLancamentos]=useState<any[]>([]);const [alunos,setAlunos]=useState<any[]>([]);const [pacientes,setPacientes]=useState<any[]>([]);const [erro,setErro]=useState("");const [receber,setReceber]=useState<any|null>(null);const [salvando,setSalvando]=useState(false);
  const [manualAberto,setManualAberto]=useState(false);const [filtroConta,setFiltroConta]=useState("Todas");const [filtroInicio,setFiltroInicio]=useState("");const [filtroFim,setFiltroFim]=useState("");const [manual,setManual]=useState({descricao:"",tipo:"Entrada",valor:"",data_vencimento:new Date().toISOString().slice(0,10),forma_pagamento:"PIX",conta_caixa:"CAIXA",categoria:"Manual",origem:"Manual",operadora_cartao:"",parcelas_cartao:1,status:"Pago",data_pagamento:new Date().toISOString().slice(0,10)});
  const [config,setConfig]=useState<any>({contas:["CAIXA","SICOOB","C6"],maquinas:["InfinitePay","PagBank"],taxas:{},parcelas_boleto:1,parcelas_cartao:12,descontos:{}});const [configTexto,setConfigTexto]=useState({contas:"CAIXA\nSICOOB\nC6",maquinas:"InfinitePay\nPagBank",taxas:"",descontos:""});
  const [taxasLista,setTaxasLista]=useState<any[]>(TAXAS_CONFIGURACAO_PADRAO);const [novaTaxa,setNovaTaxa]=useState({maquina:"InfinitePay",bandeira:"Visa / Mastercard",parcelas:1,taxa:""});
  const hoje=new Date().toISOString().slice(0,10);const brl=(v:any)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const carregar=()=>Promise.all([buscarRecursoEducacaoApi<any[]>("financeiro"),buscarRecursoEducacaoApi<any[]>("alunos"),buscarRecursoEducacaoApi<any[]>("pacientes-modelo")]).then(([f,a,p])=>{setLancamentos(f);setAlunos(a);setPacientes(p);setErro("")}).catch(e=>setErro(e instanceof Error?e.message:"Falha ao carregar o financeiro."));
  useEffect(()=>{void carregar();void buscarConfiguracoesFinanceiroEducacaoApi().then((c:any)=>{setConfig(c);setConfigTexto({contas:(c.contas||[]).join("\n"),maquinas:(c.maquinas||[]).join("\n"),taxas:"",descontos:""});const lista=Object.entries(c.taxas||{}).map(([k,v])=>{const p=String(k).split("|");return {maquina:p[0]||"InfinitePay",bandeira:p[2]||"Visa / Mastercard",parcelas:Number(p[1])||1,taxa:String(v)}});setTaxasLista(lista.length?lista:TAXAS_CONFIGURACAO_PADRAO)}).catch(()=>{})},[]);
  const nome=(l:any)=>l.aluno_id?alunos.find(a=>Number(a.id)===Number(l.aluno_id))?.nome:l.paciente_modelo_id?pacientes.find(p=>Number(p.id)===Number(l.paciente_modelo_id))?.nome:"";
  const receitasPagas=lancamentos.filter(l=>l.tipo==="Receita"&&l.status==="Pago");const despesasPagas=lancamentos.filter(l=>l.tipo==="Despesa"&&l.status==="Pago");const abertos=lancamentos.filter(l=>l.tipo==="Receita"&&l.status!=="Pago"&&l.status!=="Cancelado");
  const total=(lista:any[],campo="valor")=>lista.reduce((s,l)=>s+Number(l[campo]||l.valor||0),0);
  async function confirmarBaixa(){if(!receber)return;const cartao=String(receber.forma_pagamento||"").toUpperCase().includes("CARTAO");if(cartao&&!receber.operadora_cartao){setErro("Selecione a máquina de cartão utilizada.");return}setSalvando(true);try{await baixarLancamentoFinanceiroEducacaoApi(receber.id,receber);setReceber(null);await carregar()}catch(e){setErro(e instanceof Error?e.message:"Não foi possível registrar o recebimento.")}finally{setSalvando(false)}}
  const listaBase=abaFinanceiro==="Recebíveis"?abertos:abaFinanceiro==="Contas a pagar"?lancamentos.filter(l=>l.tipo==="Despesa"&&l.status!=="Pago"&&l.status!=="Cancelado"):lancamentos.filter(l=>l.status==="Pago");
  const lista=listaBase.filter(l=>(filtroConta==="Todas"||String(l.conta_caixa||"CAIXA").toUpperCase()===filtroConta)&&(!filtroInicio||String(l.data_pagamento||l.data_vencimento||"")>=filtroInicio)&&(!filtroFim||String(l.data_pagamento||l.data_vencimento||"")<=filtroFim));
  async function salvarManual(){if(!manual.descricao||Number(manual.valor)<=0){setErro("Informe a descrição e um valor válido.");return}const bruto=Number(manual.valor);const cartao=String(manual.forma_pagamento).includes("CARTAO");const parcelas=Math.max(1,Number(manual.parcelas_cartao)||1);const taxa=cartao?Number(config.taxas?.[`${manual.operadora_cartao}|${parcelas}|Visa / Mastercard`]??config.taxas?.[`${manual.operadora_cartao}|${parcelas}`]??0):0;const taxaValor=cartao?bruto*(taxa/100):0;setSalvando(true);try{await criarRecursoEducacaoApi("financeiro",{...manual,valor:bruto,valor_bruto:bruto,taxa_valor:taxaValor,valor_liquido:bruto-taxaValor,tipo:manual.tipo==="Saída"?"Despesa":"Receita",parcelas_cartao:cartao?parcelas:1});setManualAberto(false);setManual({...manual,descricao:"",valor:""});await carregar()}catch(e){setErro(e instanceof Error?e.message:"Não foi possível lançar no caixa.")}finally{setSalvando(false)}}
  async function salvarConfig(){try{const taxas=Object.fromEntries(taxasLista.filter(x=>Number(x.taxa)>=0).map(x=>[`${x.maquina}|${x.parcelas}|${x.bandeira}`,Number(String(x.taxa).replace(",","."))]));const payload={contas:configTexto.contas.split("\n").map(x=>x.trim()).filter(Boolean),maquinas:configTexto.maquinas.split("\n").map(x=>x.trim()).filter(Boolean),taxas,parcelas_boleto:Number(config.parcelas_boleto)||1,parcelas_cartao:Number(config.parcelas_cartao)||12};await salvarConfiguracoesFinanceiroEducacaoApi(payload);setConfig({...config,...payload});setErro("")}catch(e){setErro(e instanceof Error?e.message:"Não foi possível salvar as configurações.")}}
  return (
    <div className="education-finance-shell">
      <section className="education-hero finance-hero"><div><span className="page-eyebrow">GESTÃO FINANCEIRA</span><h1>Financeiro</h1></div></section>
      <div className="finance-kpi-grid"><article><span>Recebido</span><strong>{brl(total(receitasPagas,"valor_liquido"))}</strong><small>Valor líquido após taxas</small></article><article><span>A receber</span><strong>{brl(total(abertos,"valor_bruto"))}</strong><small>{abertos.length} lançamento(s)</small></article><article><span>Taxas de cartão</span><strong>{brl(total(receitasPagas,"taxa_valor"))}</strong><small>Descontadas pelas maquininhas</small></article><article><span>Saldo de caixa</span><strong>{brl(total(receitasPagas,"valor_liquido")-total(despesasPagas,"valor_liquido"))}</strong><small>Receitas líquidas menos despesas</small></article></div>
      <nav className="education-tabs education-finance-tabs" aria-label="Seções do financeiro">
        {(["Caixa","Recebíveis","Contas a pagar"] as const).map(aba=><button key={aba} className={abaFinanceiro===aba?"active":""} onClick={()=>setAbaFinanceiro(aba)}>{aba}</button>)}
        <button className={abaFinanceiro === "Tabela de preços" ? "active" : ""} onClick={() => setAbaFinanceiro("Tabela de preços")}>Tabela de preços</button>
        <button className={abaFinanceiro === "Configurações" ? "active" : ""} onClick={() => setAbaFinanceiro("Configurações")}>Configurações</button>
      </nav>
      <section className="finance-settings panel" style={{display:abaFinanceiro==="Configurações"?"block":"none"}}><div className="finance-ledger-head"><div><span className="panel-kicker">FINANCEIRO</span><h2>Configurações</h2></div></div><div className="finance-settings-grid"><label>Contas e bancos<textarea rows={6} value={configTexto.contas} onChange={e=>setConfigTexto({...configTexto,contas:e.target.value})}/></label><label>Maquininhas<textarea rows={6} value={configTexto.maquinas} onChange={e=>setConfigTexto({...configTexto,maquinas:e.target.value})}/></label><label className="finance-legacy-field">Taxas<textarea rows={6} value={configTexto.taxas} onChange={e=>setConfigTexto({...configTexto,taxas:e.target.value})}/></label><label className="finance-legacy-field">Descontos<textarea rows={6} value={configTexto.descontos} onChange={e=>setConfigTexto({...configTexto,descontos:e.target.value})}/></label><label>Máximo de parcelas no boleto<input type="number" min="1" max="60" value={config.parcelas_boleto} onChange={e=>setConfig({...config,parcelas_boleto:Number(e.target.value)})}/></label><label>Máximo de parcelas no cartão<input type="number" min="1" max="60" value={config.parcelas_cartao} onChange={e=>setConfig({...config,parcelas_cartao:Number(e.target.value)})}/></label></div><button className="primary-action" onClick={()=>void salvarConfig()}>Salvar configurações</button></section>
      <section className="finance-rate-list panel" style={{display:abaFinanceiro==="Configurações"?"block":"none"}}><div className="finance-ledger-head"><div><span className="panel-kicker">CARTÕES</span><h2>Taxas por maquininha</h2></div></div><div className="finance-rate-add"><label>Maquininha<select value={novaTaxa.maquina} onChange={e=>setNovaTaxa({...novaTaxa,maquina:e.target.value})}>{(config.maquinas||["InfinitePay","PagBank"]).map((m:string)=><option key={m}>{m}</option>)}</select></label><label>Bandeira<select value={novaTaxa.bandeira} onChange={e=>setNovaTaxa({...novaTaxa,bandeira:e.target.value})}><option>Visa / Mastercard</option><option>Elo</option><option>Hipercard</option><option>Amex</option></select></label><label>Parcelas<input type="number" min="1" max="60" value={novaTaxa.parcelas} onChange={e=>setNovaTaxa({...novaTaxa,parcelas:Number(e.target.value)})}/></label><label>Taxa (%)<input type="number" min="0" step="0.01" placeholder="2,99" value={novaTaxa.taxa} onChange={e=>setNovaTaxa({...novaTaxa,taxa:e.target.value})}/></label><button className="primary-action" onClick={()=>{if(!String(novaTaxa.taxa).trim())return;setTaxasLista([...taxasLista,{...novaTaxa}]);setNovaTaxa({...novaTaxa,taxa:""})}}>Adicionar taxa</button></div><div className="finance-table-scroll"><table><thead><tr><th>Maquininha</th><th>Bandeira</th><th>Parcelas</th><th>Taxa</th><th></th></tr></thead><tbody>{taxasLista.map((t,i)=><tr key={`${t.maquina}-${t.parcelas}-${i}`}><td>{t.maquina}</td><td>{t.bandeira}</td><td>{t.parcelas}x</td><td>{t.taxa}%</td><td><button className="ghost-action compact" onClick={()=>setTaxasLista(taxasLista.filter((_,j)=>j!==i))}>Remover</button></td></tr>)}{!taxasLista.length&&<tr><td colSpan={5} className="empty-inline">Nenhuma taxa cadastrada.</td></tr>}</tbody></table></div><button className="primary-action" onClick={()=>void salvarConfig()}>Salvar taxas e limites</button></section>
      {manualAberto&&<div className="finance-manual-extra"><label>Origem<select value={manual.origem} onChange={e=>setManual({...manual,origem:e.target.value})}><option>Manual</option><option>Recebível</option><option>Contrato</option><option>Venda</option><option>Reembolso</option></select></label><label>Categoria<select value={manual.categoria} onChange={e=>setManual({...manual,categoria:e.target.value})}><option>Recebível</option><option>Despesa operacional</option><option>Tarifa bancária</option><option>Reembolso</option><option>Fornecedor</option><option>Imposto</option><option>Manual</option></select></label><label>Forma<select value={manual.forma_pagamento} onChange={e=>setManual({...manual,forma_pagamento:e.target.value})}><option>PIX</option><option>DINHEIRO</option><option>BOLETO</option><option>CARTAO_CREDITO</option><option>CARTAO_DEBITO</option></select></label>{String(manual.forma_pagamento).includes("CARTAO")&&<><label>Maquininha<select value={manual.operadora_cartao} onChange={e=>setManual({...manual,operadora_cartao:e.target.value})}><option value="">Selecione</option>{(config.maquinas||["InfinitePay","PagBank"]).map((m:string)=><option key={m}>{m}</option>)}</select></label><label>Parcelas<input type="number" min="1" max="60" value={manual.parcelas_cartao} onChange={e=>setManual({...manual,parcelas_cartao:Number(e.target.value)})}/></label></>}</div>}
      {erro&&<div className="education-error">{erro}</div>}
      {abaFinanceiro==="Tabela de preços"?<EducacaoModulo modulo="Tabela de preços" />:<section className="finance-ledger panel"><div className="finance-ledger-head"><div><span className="panel-kicker">{abaFinanceiro}</span><h2>{abaFinanceiro==="Caixa"?"Movimentações realizadas":abaFinanceiro}</h2></div><div className="finance-head-actions"><span>{lista.length} registro(s)</span>{abaFinanceiro==="Caixa"&&<button className="primary-action compact" onClick={()=>setManualAberto(v=>!v)}>+ Lançamento</button>}</div></div>{(abaFinanceiro==="Caixa"||abaFinanceiro==="Recebíveis")&&<div className="finance-filters"><label>Conta<select value={filtroConta} onChange={e=>setFiltroConta(e.target.value)}><option>Todas</option><option>CAIXA</option><option>SICOOB</option><option>INFINITEPAY</option><option>PAGBANK</option><option>C6</option></select></label><label>De<input type="date" value={filtroInicio} onChange={e=>setFiltroInicio(e.target.value)}/></label><label>Até<input type="date" value={filtroFim} onChange={e=>setFiltroFim(e.target.value)}/></label></div>}{manualAberto&&<div className="finance-manual-form"><label>Descrição<input value={manual.descricao} onChange={e=>setManual({...manual,descricao:e.target.value})}/></label><label>Tipo<select value={manual.tipo} onChange={e=>setManual({...manual,tipo:e.target.value})}><option>Entrada</option><option>Saída</option></select></label><label>Valor<input type="number" step="0.01" value={manual.valor} onChange={e=>setManual({...manual,valor:e.target.value})}/></label><label>Data<input type="date" value={manual.data_vencimento} onChange={e=>setManual({...manual,data_vencimento:e.target.value,data_pagamento:e.target.value})}/></label><label>Conta<select value={manual.conta_caixa} onChange={e=>setManual({...manual,conta_caixa:e.target.value})}><option>CAIXA</option><option>SICOOB</option><option>INFINITEPAY</option><option>PAGBANK</option><option>C6</option></select></label><button className="primary-action" disabled={salvando} onClick={()=>void salvarManual()}>{salvando?"Salvando...":"Salvar lançamento"}</button></div>}<div className="finance-table-scroll"><table><thead><tr><th>Data</th><th>Descrição / pessoa</th><th>Origem</th><th>Forma</th><th>Conta</th><th>Bruto</th><th>Taxa</th><th>Líquido</th><th>Status</th><th></th></tr></thead><tbody>{lista.map(l=><tr key={l.id}><td>{(l.data_pagamento||l.data_vencimento||"").split("-").reverse().join("/")}</td><td><strong>{l.descricao}</strong><small>{nome(l)||"Sem vínculo"}</small></td><td>{l.origem||l.categoria||"Manual"}</td><td>{String(l.forma_pagamento||"—").replaceAll("_"," ")}{l.operadora_cartao&&<small>{l.operadora_cartao}</small>}</td><td>{l.conta_caixa||"—"}</td><td>{brl(l.valor_bruto||l.valor)}</td><td>{brl(l.taxa_valor)}</td><td><strong>{brl(l.valor_liquido||l.valor)}</strong></td><td><span className={`finance-status ${l.status==="Pago"?"paid":"open"}`}>{l.status}</span></td><td>{abaFinanceiro==="Recebíveis"&&<button className="primary-action compact" onClick={()=>setReceber({...l,data_pagamento:hoje,valor_bruto:Number(l.valor_bruto||l.valor),valor_liquido:Number(l.valor_liquido||l.valor),conta_caixa:l.conta_caixa||"CAIXA"})}>Receber</button>}</td></tr>)}{!lista.length&&<tr><td colSpan={10} className="empty-inline">Nenhum lançamento nesta seção.</td></tr>}</tbody></table></div></section>}
      {receber&&<div className="education-modal-backdrop"><section className="education-modal finance-receive-modal"><div className="education-list-head"><div><span className="page-eyebrow">BAIXA DE RECEBÍVEL</span><h2>Registrar recebimento</h2></div><button onClick={()=>setReceber(null)}><X size={18}/></button></div><div className="education-module-fields"><label><span>Data do recebimento</span><input type="date" value={receber.data_pagamento} onChange={e=>setReceber({...receber,data_pagamento:e.target.value})}/></label><label><span>Forma de pagamento</span><select value={receber.forma_pagamento||"PIX"} onChange={e=>setReceber({...receber,forma_pagamento:e.target.value,operadora_cartao:""})}><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="BOLETO">Boleto</option><option value="CARTAO_DEBITO">Cartão de débito</option><option value="CARTAO_CREDITO">Cartão de crédito</option></select></label>{String(receber.forma_pagamento||"").includes("CARTAO")&&<label><span>Máquina utilizada *</span><select value={receber.operadora_cartao||""} onChange={e=>setReceber({...receber,operadora_cartao:e.target.value,conta_caixa:e.target.value})}><option value="">Selecione a maquininha</option><option value="InfinitePay">InfinitePay</option><option value="PagBank">PagBank</option></select></label>}<label><span>Conta de entrada</span><select value={receber.conta_caixa||"CAIXA"} onChange={e=>setReceber({...receber,conta_caixa:e.target.value})}><option>CAIXA</option><option>SICOOB</option><option>C6</option><option>InfinitePay</option><option>PagBank</option></select></label><label><span>Valor bruto</span><input type="number" step="0.01" value={receber.valor_bruto} onChange={e=>setReceber({...receber,valor_bruto:Number(e.target.value)})}/></label><label><span>Valor líquido</span><input type="number" step="0.01" value={receber.valor_liquido} onChange={e=>setReceber({...receber,valor_liquido:Number(e.target.value)})}/></label></div><div className="finance-fee-preview"><span>Taxa</span><strong>{brl(Math.max(0,Number(receber.valor_bruto)-Number(receber.valor_liquido)))}</strong></div><div className="users-template-actions"><button className="ghost-action" onClick={()=>setReceber(null)}>Cancelar</button><button className="primary-action" disabled={salvando} onClick={()=>void confirmarBaixa()}>{salvando?"Registrando...":"Confirmar recebimento"}</button></div></section></div>}
    </div>
  );
}

type EtapaGuiaForm={id:number;etapa:string;descricao_outro:string};
const guiaVazia=()=>({paciente_modelo_id:0,procedimento_id:0,procedimento_nome:"",cor:"",escala:"",elemento_arcada:"",carga_imediata:false,retorno_solicitado:"",observacao:"",etapas:[{id:Date.now(),etapa:"",descricao_outro:""}] as EtapaGuiaForm[]});

function EducacaoGuias(){
  const [pacientes,setPacientes]=useState<any[]>([]);const [procedimentos,setProcedimentos]=useState<any[]>([]);const [busca,setBusca]=useState("");
  const [pacienteId,setPacienteId]=useState(0);const [guias,setGuias]=useState<GuiaEducacaoApi[]>([]);const [form,setForm]=useState(guiaVazia());const [erro,setErro]=useState("");const [feedback,setFeedback]=useState("");const [salvando,setSalvando]=useState(false);
  useEffect(()=>{void Promise.all([buscarRecursoEducacaoApi<any[]>("pacientes-modelo"),buscarRecursoEducacaoApi<any[]>("procedimentos")]).then(([p,t])=>{setPacientes(p);setProcedimentos(t);if(p[0]?.id)setPacienteId(Number(p[0].id))}).catch(e=>setErro(e instanceof Error?e.message:"Falha ao carregar guias."))},[]);
  useEffect(()=>{if(!pacienteId){setGuias([]);return}setForm({...guiaVazia(),paciente_modelo_id:pacienteId});void listarGuiasEducacaoApi(pacienteId).then(setGuias).catch(e=>setErro(e instanceof Error?e.message:"Falha ao carregar o histórico."))},[pacienteId]);
  const pacientesFiltrados=useMemo(()=>{const q=busca.trim().toLocaleLowerCase("pt-BR");return pacientes.filter(p=>!q||`${p.nome} ${p.prontuario} ${p.telefone}`.toLocaleLowerCase("pt-BR").includes(q)).slice(0,30)},[pacientes,busca]);
  const paciente=pacientes.find(p=>Number(p.id)===pacienteId);
  async function salvar(){setErro("");setFeedback("");setSalvando(true);try{const nova=await criarGuiaEducacaoApi({...form,paciente_modelo_id:pacienteId,etapas:form.etapas.map(({etapa,descricao_outro})=>({etapa,descricao_outro}))});setGuias(g=>[nova,...g]);setForm({...guiaVazia(),paciente_modelo_id:pacienteId});setFeedback("Guia emitida e salva no histórico do paciente-modelo.")}catch(e){setErro(e instanceof Error?e.message:"Não foi possível emitir a guia.")}finally{setSalvando(false)}}
  return <section className="education-page"><div className="education-hero"><div><span className="page-eyebrow">CONTROLE PROTÉTICO</span><h1>Guias</h1></div></div>
    <div className="guides-shell">
      <aside className="panel guides-sidebar"><div className="section-title-row"><div><span className="panel-kicker">Paciente-modelo</span><h2>Selecionar</h2></div></div><label className="guides-search"><Search size={16}/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar nome, prontuário ou telefone"/></label><div className="guides-patient-list">{pacientesFiltrados.map(p=><button type="button" key={p.id} className={`guides-patient-card${Number(p.id)===pacienteId?" active":""}`} onClick={()=>setPacienteId(Number(p.id))}><strong>{p.nome}</strong><span>{p.prontuario||"Sem prontuário"}</span><small>{p.telefone||"Sem telefone"}</small></button>)}</div></aside>
      <section className="panel guides-main"><div className="guides-main-header"><div><span className="panel-kicker">Ordem de serviço</span><h2>{paciente?.nome||"Selecione um paciente-modelo"}</h2><p>{paciente?`Prontuário ${paciente.prontuario||"não informado"}`:"Escolha um cadastro para emitir a guia."}</p></div></div>{erro&&<div className="education-error">{erro}</div>}{feedback&&<div className="dashboard-note success">{feedback}</div>}
      {paciente&&<><div className="guides-summary-grid"><article className="dashboard-card"><span>Guias emitidas</span><strong>{guias.length}</strong></article></div>
      <div className="clinical-panel"><div className="clinical-panel-header"><div><strong>Nova guia</strong><span>Preencha a ordem de serviço protético.</span></div></div><div className="users-create-grid procedures-form-grid">
        <label className="procedures-form-wide"><span>Procedimento</span><select value={form.procedimento_id} onChange={e=>{const id=Number(e.target.value);setForm({...form,procedimento_id:id,procedimento_nome:id?"":form.procedimento_nome})}}><option value={0}>Informar procedimento não listado</option>{procedimentos.filter(p=>p.ativo!==false&&p.ativo!==0).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        {!form.procedimento_id&&<label className="procedures-form-wide"><span>Procedimento não listado</span><input value={form.procedimento_nome} onChange={e=>setForm({...form,procedimento_nome:e.target.value})} placeholder="Digite o procedimento"/></label>}
        <label><span>Elemento ou arcada</span><input value={form.elemento_arcada} onChange={e=>setForm({...form,elemento_arcada:e.target.value})} placeholder="Ex.: 11, 21 ou Arcada superior"/></label><label><span>Escala</span><input value={form.escala} onChange={e=>setForm({...form,escala:e.target.value})}/></label><label><span>Cor</span><input value={form.cor} onChange={e=>setForm({...form,cor:e.target.value})}/></label><label><span>Data de retorno solicitada</span><input type="date" value={form.retorno_solicitado} onChange={e=>setForm({...form,retorno_solicitado:e.target.value})}/></label>
        <label className="checkbox-row"><input type="checkbox" checked={form.carga_imediata} onChange={e=>setForm({...form,carga_imediata:e.target.checked})}/><span>Carga imediata</span></label>
        <div className="procedures-form-wide os-steps-box"><div className="clinical-panel-header compact"><div><strong>Etapas</strong><span>Adicione todas as etapas necessárias.</span></div><button type="button" className="ghost-action" onClick={()=>setForm({...form,etapas:[...form.etapas,{id:Date.now(),etapa:"",descricao_outro:""}]})}>Adicionar etapa</button></div><div className="os-steps-list">{form.etapas.map(et=><div className="os-step-row" key={et.id}><input value={et.etapa} onChange={e=>setForm({...form,etapas:form.etapas.map(x=>x.id===et.id?{...x,etapa:e.target.value}:x)})} placeholder="Ex.: Moldagem, prova, instalação ou Outro"/><input value={et.descricao_outro} onChange={e=>setForm({...form,etapas:form.etapas.map(x=>x.id===et.id?{...x,descricao_outro:e.target.value}:x)})} placeholder="Descrição complementar"/><button type="button" className="ghost-action danger" onClick={()=>setForm({...form,etapas:form.etapas.length>1?form.etapas.filter(x=>x.id!==et.id):form.etapas})}>Remover</button></div>)}</div></div>
        <label className="procedures-form-wide"><span>Observação</span><textarea rows={4} value={form.observacao} onChange={e=>setForm({...form,observacao:e.target.value})}/></label></div><div className="users-template-actions"><button type="button" className="primary-action" disabled={salvando} onClick={()=>void salvar()}>{salvando?"Emitindo...":"Salvar ordem de serviço"}</button></div></div>
      <div className="clinical-elements-panel"><div className="clinical-elements-header"><strong>Guias emitidas</strong><span>{guias.length} item(ns)</span></div>{guias.length?guias.map(g=><div className="clinical-element-card" key={g.id}><div className="clinical-element-row"><strong>{g.procedimento_nome_snapshot||"Procedimento"}</strong><span>{g.documento_nome||"Documento"}</span></div><div className="clinical-element-procedures"><span>{g.elemento_arcada}</span>{g.retorno_solicitado&&<span>Retorno {g.retorno_solicitado}</span>}{g.etapas?.map((e,i)=><span key={i}>{e.etapa}{e.descricao_outro?`: ${e.descricao_outro}`:""}</span>)}</div><div className="clinical-element-actions"><button type="button" className="ghost-action" onClick={()=>void baixarGuiaEducacaoApi(g.id,g.documento_nome||`GUIA_${g.id}.docx`)}>Abrir / imprimir</button></div></div>):<span className="empty-inline">Nenhuma guia emitida para este paciente.</span>}</div></>}</section>
    </div></section>
}

type VisaoAgendaEducacao="Dia"|"Semana"|"Mês";
const hojeAgendaEducacao=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const adicionarDiasAgenda=(iso:string,dias:number)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+dias);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const dataBrAgenda=(iso:string)=>iso?iso.split("-").reverse().join("/"):"";
const formAgendaVazio=(data=hojeAgendaEducacao())=>({data,hora_inicio:"09:00",hora_fim:"10:00",paciente_modelo_id:0,procedimento_id:0,guia_id:0,titulo:"",tipo_atendimento:"Atendimento",responsavel:"",local:"",status:"Agendado",observacoes:"",cancelado_motivo:""});

function AgendaEducacaoLegada(){
  const [eventos,setEventos]=useState<any[]>([]);const [pacientes,setPacientes]=useState<any[]>([]);const [procedimentos,setProcedimentos]=useState<any[]>([]);const [usuarios,setUsuarios]=useState<any[]>([]);const [guias,setGuias]=useState<GuiaEducacaoApi[]>([]);
  const [data,setData]=useState(hojeAgendaEducacao());const [visao,setVisao]=useState<VisaoAgendaEducacao>("Dia");const [form,setForm]=useState<any>(formAgendaVazio());const [modal,setModal]=useState(false);const [editando,setEditando]=useState<number|null>(null);const [erro,setErro]=useState("");
  const carregar=()=>buscarRecursoEducacaoApi<any[]>("agenda").then(setEventos).catch(e=>setErro(e instanceof Error?e.message:"Falha ao carregar agenda."));
  useEffect(()=>{void carregar();void Promise.all([buscarRecursoEducacaoApi<any[]>("pacientes-modelo"),buscarRecursoEducacaoApi<any[]>("procedimentos"),buscarRecursoEducacaoApi<any[]>("usuarios")]).then(([p,pr,u])=>{setPacientes(p);setProcedimentos(pr);setUsuarios(u.filter((x:any)=>x.ativo!==0&&x.ativo!==false&&x.agendaAtiva))})},[]);
  useEffect(()=>{if(!form.paciente_modelo_id){setGuias([]);return}void listarGuiasEducacaoApi(Number(form.paciente_modelo_id)).then(setGuias)},[form.paciente_modelo_id]);
  const dias=useMemo(()=>{if(visao==="Dia")return [data];if(visao==="Semana"){const d=new Date(`${data}T12:00:00`);const segunda=adicionarDiasAgenda(data,-((d.getDay()+6)%7));return Array.from({length:7},(_,i)=>adicionarDiasAgenda(segunda,i))}const d=new Date(`${data.slice(0,7)}-01T12:00:00`);const inicio=adicionarDiasAgenda(`${data.slice(0,7)}-01`,-d.getDay());return Array.from({length:42},(_,i)=>adicionarDiasAgenda(inicio,i))},[data,visao]);
  const eventosVisiveis=useMemo(()=>eventos.filter(e=>dias.includes(String(e.data||""))).sort((a,b)=>`${a.data} ${a.hora_inicio}`.localeCompare(`${b.data} ${b.hora_inicio}`)),[eventos,dias]);
  const pacienteNome=(id:any)=>pacientes.find(p=>Number(p.id)===Number(id))?.nome||"Compromisso interno";
  const procedimentoNome=(id:any)=>procedimentos.find(p=>Number(p.id)===Number(id))?.nome||"";
  function abrirNovo(d=data,hora="09:00"){setEditando(null);setForm(formAgendaVazio(d));setForm((f:any)=>({...f,hora_inicio:hora,hora_fim:`${String(Math.min(23,Number(hora.slice(0,2))+1)).padStart(2,"0")}:${hora.slice(3)}`}));setModal(true);setErro("")}
  function abrirEditar(e:any){setEditando(Number(e.id));setForm({...formAgendaVazio(e.data),...e,paciente_modelo_id:Number(e.paciente_modelo_id||0),procedimento_id:Number(e.procedimento_id||0),guia_id:Number(e.guia_id||0)});setModal(true);setErro("")}
  async function salvar(e:FormEvent){e.preventDefault();setErro("");try{if(editando)await atualizarRecursoEducacaoApi("agenda",editando,form);else await criarRecursoEducacaoApi("agenda",form);setModal(false);await carregar()}catch(ex){setErro(ex instanceof Error?ex.message:"Não foi possível salvar o agendamento.")}}
  const tituloData=new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
  return <section className="education-page education-agenda-page"><div className="education-hero"><div><span className="page-eyebrow">AGENDA SOULSUL ELEVEN</span><h1>Agenda</h1></div><button className="primary-button" onClick={()=>abrirNovo()}><Plus size={17}/> Novo agendamento</button></div>
    {erro&&!modal&&<div className="education-error">{erro}</div>}<div className="education-agenda-toolbar"><div className="education-agenda-nav"><button onClick={()=>setData(adicionarDiasAgenda(data,visao==="Dia"?-1:visao==="Semana"?-7:-30))}><ChevronLeft size={18}/></button><button onClick={()=>setData(hojeAgendaEducacao())}>Hoje</button><button onClick={()=>setData(adicionarDiasAgenda(data,visao==="Dia"?1:visao==="Semana"?7:30))}><ChevronRight size={18}/></button><strong>{tituloData}</strong></div><div className="education-agenda-views">{(["Dia","Semana","Mês"] as const).map(v=><button className={visao===v?"active":""} onClick={()=>setVisao(v)} key={v}>{v}</button>)}</div></div>
    <div className={`education-agenda-calendar view-${visao.toLowerCase().replace("ê","e")}`}>{dias.map(d=><section className={`education-agenda-day${d===hojeAgendaEducacao()?" today":""}`} key={d}><header><b>{new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR",{weekday:"short"})}</b><span>{dataBrAgenda(d)}</span></header><div className="education-agenda-day-body" onDoubleClick={()=>abrirNovo(d)}>{eventosVisiveis.filter(e=>e.data===d).map(e=><button type="button" className={`education-agenda-event status-${String(e.status||"").toLowerCase().replaceAll(" ","-")}`} key={e.id} onClick={()=>abrirEditar(e)}><span>{e.hora_inicio}–{e.hora_fim}</span><strong>{pacienteNome(e.paciente_modelo_id)}</strong><small>{e.titulo||e.tipo_atendimento}{procedimentoNome(e.procedimento_id)?` · ${procedimentoNome(e.procedimento_id)}`:""}</small><em>{e.responsavel||"Sem profissional"} · {e.status}</em></button>)}{!eventosVisiveis.some(e=>e.data===d)&&<button className="education-agenda-empty-slot" onClick={()=>abrirNovo(d)}>+ Agendar</button>}</div></section>)}</div>
    {modal&&<div className="education-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><form className="education-modal education-agenda-modal" onSubmit={salvar}><div className="education-list-head"><div><span className="page-eyebrow">{editando?"EDITAR":"NOVO"}</span><h2>{editando?"Editar agendamento":"Novo agendamento"}</h2></div><button type="button" onClick={()=>setModal(false)}><X size={18}/></button></div>{erro&&<div className="education-error">{erro}</div>}<div className="education-module-fields">
      <label>Tipo<select value={form.tipo_atendimento} onChange={e=>setForm({...form,tipo_atendimento:e.target.value})}><option>Atendimento</option><option>Avaliação</option><option>Retorno</option><option>Compromisso</option><option>Evento</option></select></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{["Agendado","Confirmado","Aguardando","Em atendimento","Atendido","Atrasado","Faltou","Desmarcado","Cancelado"].map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Data<input required type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/></label><label>Horário inicial<input required type="time" value={form.hora_inicio} onChange={e=>setForm({...form,hora_inicio:e.target.value})}/></label><label>Horário final<input required type="time" value={form.hora_fim} onChange={e=>setForm({...form,hora_fim:e.target.value})}/></label><label>Profissional<select required value={form.responsavel} onChange={e=>setForm({...form,responsavel:e.target.value})}><option value="">Selecione</option>{usuarios.map(u=><option key={u.id} value={u.nomeAgenda||u.nome}>{u.nomeAgenda||u.nome}</option>)}</select></label>
      <label className="education-field-wide">Paciente-modelo<select value={form.paciente_modelo_id} onChange={e=>setForm({...form,paciente_modelo_id:Number(e.target.value),guia_id:0})}><option value={0}>Sem paciente — compromisso interno</option>{pacientes.map(p=><option key={p.id} value={p.id}>{p.prontuario} — {p.nome}</option>)}</select></label><label>Procedimento<select value={form.procedimento_id} onChange={e=>setForm({...form,procedimento_id:Number(e.target.value)})}><option value={0}>Selecione</option>{procedimentos.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><label>Guia vinculada<select value={form.guia_id} onChange={e=>setForm({...form,guia_id:Number(e.target.value)})}><option value={0}>Sem guia</option>{guias.map(g=><option key={g.id} value={g.id}>{g.procedimento_nome_snapshot} · {g.elemento_arcada}</option>)}</select></label>
      <label className="education-field-wide">Título<input required value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} placeholder="Descrição do atendimento ou compromisso"/></label><label>Local / consultório<input value={form.local} onChange={e=>setForm({...form,local:e.target.value})}/></label><label className="education-field-wide">Observações<textarea rows={4} value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})}/></label>{["Desmarcado","Cancelado"].includes(form.status)&&<label className="education-field-wide">Motivo<input required value={form.cancelado_motivo} onChange={e=>setForm({...form,cancelado_motivo:e.target.value})}/></label>}
      </div><div className="education-actions"><button className="primary-button">{editando?"Salvar alterações":"Confirmar agendamento"}</button><button type="button" onClick={()=>setModal(false)}>Cancelar</button></div></form></div>}
  </section>
}

const MODULOS_ACESSO_EDUCACAO = Object.keys(SUBFUNCOES_ACESSO_EDUCACAO);

function EducacaoUsuarios() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ nome:"", usuario:"", senha:"", perfil:"USUARIO", ativo:true, agendaAtiva:false,nomeAgenda:"", permissoes:permissoesPadraoEducacao() });
  const [editando, setEditando] = useState<number|null>(null);
  const [erro, setErro] = useState("");
  const carregar = () => buscarRecursoEducacaoApi<any[]>("usuarios").then(setUsuarios).catch(e=>setErro(e instanceof Error?e.message:"Falha ao carregar usuários."));
  useEffect(()=>{void carregar()},[]);
  async function salvar(e:FormEvent){e.preventDefault();setErro("");try{const permissoes={...form.permissoes};Object.entries(SUBFUNCOES_ACESSO_EDUCACAO).forEach(([m,subs])=>permissoes[m]=subs.some(s=>(permissoes[`${m}.${s}`]??"edit")!=="none"));const payload={...form,nomeAgenda:form.nomeAgenda||form.nome,permissoes};if(editando)await atualizarRecursoEducacaoApi("usuarios",editando,payload);else await criarRecursoEducacaoApi("usuarios",payload);setEditando(null);setForm({nome:"",usuario:"",senha:"",perfil:"USUARIO",ativo:true,agendaAtiva:false,nomeAgenda:"",permissoes:permissoesPadraoEducacao()});await carregar()}catch(ex){setErro(ex instanceof Error?ex.message:"Não foi possível salvar.")}}
  return <section className="education-page">
    <div className="education-hero"><div><span className="page-eyebrow">SEGURANÇA E ACESSOS</span><h1>Usuários</h1></div></div>
    {erro&&<div className="education-error">{erro}</div>}
    <div className="education-users-layout">
      <form className="education-card education-form" onSubmit={salvar}>
        <h2>{editando?"Editar acessos":"Novo usuário"}</h2>
        <label>Nome<input required value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></label>
        {!editando&&<><label>Usuário<input required value={form.usuario} onChange={e=>setForm({...form,usuario:e.target.value})}/></label><label>Senha temporária<input required minLength={6} type="password" value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})}/></label></>}
        <label>Nível<select value={form.perfil} onChange={e=>setForm({...form,perfil:e.target.value})}><option value="USUARIO">Usuário</option><option value="ADMINISTRADOR">Administrador</option></select></label>
        <div className="education-agenda-user-config"><label className="education-check"><input type="checkbox" checked={Boolean(form.agendaAtiva)} onChange={e=>setForm({...form,agendaAtiva:e.target.checked})}/>Ter agenda aberta</label>{form.agendaAtiva&&<label>Nome exibido na agenda<input required value={form.nomeAgenda||""} onChange={e=>setForm({...form,nomeAgenda:e.target.value})} placeholder={form.nome||"Nome do profissional"}/></label>}<small>Pode ser ativado tanto para Administradores quanto para Usuários.</small></div>
        <fieldset className="education-permission-matrix" disabled={form.perfil==="ADMINISTRADOR"}><legend>Permissões por módulo e função</legend>{Object.entries(SUBFUNCOES_ACESSO_EDUCACAO).map(([modulo,subs])=><section className="education-permission-module" key={modulo}><h3>{modulo}</h3>{subs.map(sub=>{const chave=`${modulo}.${sub}`;const nivel=form.permissoes?.[chave]??(form.permissoes?.[modulo]===false?"none":"edit");return <label key={chave}><span>{sub}</span><select value={form.perfil==="ADMINISTRADOR"?"edit":nivel} onChange={e=>setForm({...form,permissoes:{...form.permissoes,[chave]:e.target.value}})}><option value="none">Sem acesso</option><option value="view">Somente visualizar</option><option value="edit">Visualizar e editar</option></select></label>})}</section>)}</fieldset>
        <label className="education-check"><input type="checkbox" checked={form.ativo} onChange={e=>setForm({...form,ativo:e.target.checked})}/>Usuário ativo</label>
        <div className="education-actions"><button className="primary-button">Salvar usuário</button>{editando&&<button type="button" onClick={()=>setEditando(null)}>Cancelar</button>}</div>
      </form>
      <div className="education-card"><h2>Usuários cadastrados</h2><div className="education-list">{usuarios.map(u=><div className="education-row" key={u.id}><div><strong>{u.nome}</strong><small>{u.usuario} · {u.perfil}</small>{u.agendaAtiva&&<small>Agenda aberta como: <b>{u.nomeAgenda||u.nome}</b></small>}<span className={u.ativo?"status-pill ok":"status-pill"}>{u.ativo?"Ativo":"Inativo"}</span></div><div className="education-row-actions"><button onClick={()=>{setEditando(u.id);setForm({nome:u.nome,usuario:u.usuario,senha:"",perfil:u.perfil||"USUARIO",ativo:u.ativo,agendaAtiva:Boolean(u.agendaAtiva),nomeAgenda:u.nomeAgenda||u.nome,permissoes:u.permissoes||{}})}}><Pencil size={16}/> Permissões e agenda</button><button type="button" onClick={async()=>{if(!window.confirm(`Resetar a senha de ${u.nome} para soulsuledu?`))return;try{await resetarSenhaUsuarioEducacaoApi(u.id);window.alert("Senha resetada. No próximo acesso, o usuário deverá entrar com soulsuledu e criar uma nova senha.")}catch(ex){setErro(ex instanceof Error?ex.message:"Não foi possível resetar a senha.")}}}>Resetar senha</button></div></div>)}</div></div>
    </div>
  </section>
}

function EducacaoModulo({ modulo,pacienteInicialId=null,pacienteAbaInicial="Cadastro",onPacienteAberto,onEditarOrcamento }: { modulo: string; pacienteInicialId?:number|null; pacienteAbaInicial?:AbaFichaPaciente; onPacienteAberto?:(id:number|null)=>void; onEditarOrcamento?:(id:number)=>void }) {
  let usuarioModulo:any=null;try{usuarioModulo=JSON.parse(localStorage.getItem("soulsul_educacao_usuario")||"null")}catch{}
  const administradorModulo=usuarioModulo?.perfil==="ADMINISTRADOR"||usuarioModulo?.usuario==="educacao.admin";
  const [dados, setDados] = useState<
    Record<string, unknown> | Record<string, unknown>[]
  >(() => modulo === "Dashboard" ? dashboardEducacaoVazio : []);
  const [erro, setErro] = useState("");
  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [buscaPaciente, setBuscaPaciente] = useState("");
  const [edicaoId, setEdicaoId] = useState<number | null>(null);
  const [alunosIndicacao, setAlunosIndicacao] = useState<AlunoApi[]>([]);
  const [pacientesExcluidos, setPacientesExcluidos] = useState<Record<string, any>[]>([]);
  const [mostrarPacientesExcluidos, setMostrarPacientesExcluidos] = useState(false);
  const [pacienteFichaId,setPacienteFichaId]=useState<number|null>(pacienteInicialId);
  const recurso: Record<string, string> = {
    Dashboard: "dashboard",
    Pacientes: "pacientes-modelo",
    "Tabela de preços": "procedimentos",
    Guias: "guias",
    Agenda: "agenda",
    Financeiro: "financeiro",
    Usuários: "usuarios",
  };
  const buscarCep = async () => {
    if (modulo !== "Pacientes") return;
    const cep = String(form.cep || "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const dados = await resposta.json();
      if (!dados.erro)
        setForm((atual) => ({
          ...atual,
          cep,
          endereco: dados.logradouro || atual.endereco || "",
          bairro: dados.bairro || atual.bairro || "",
          cidade: dados.localidade || atual.cidade || "",
          estado: dados.uf || atual.estado || "",
          complemento: dados.complemento || atual.complemento || "",
        }));
    } catch {
      setErro(
        "Não foi possível consultar o CEP. Você ainda pode preencher o endereço manualmente.",
      );
    }
  };
  const carregar = () =>
    buscarRecursoEducacaoApi<
      Record<string, unknown> | Record<string, unknown>[]
    >(recurso[modulo])
      .then(setDados)
      .catch((e) => {
        if (modulo === "Dashboard") {
          setDados(dashboardEducacaoVazio);
          setErro("Os indicadores estão temporariamente sem sincronização.");
          return;
        }
        setErro(e instanceof Error ? e.message : "Falha ao carregar");
      });
  const carregarPacientesExcluidos = async () => {
    try {
      setPacientesExcluidos(await listarPacientesModeloExcluidosApi());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar cadastros excluídos.");
    }
  };
  const desativarPaciente = async (item: Record<string, unknown>) => {
    const justificativa = window.prompt(`Informe a justificativa para excluir o cadastro de ${String(item.nome || "este paciente")}:`)?.trim();
    if (!justificativa) return;
    const senha = window.prompt("Digite a senha gerencial:") || "";
    if (!senha) return;
    setSalvando(true);
    setErro("");
    try {
      await desativarPacienteModeloEducacaoApi(Number(item.id), { senha_gerencial: senha, justificativa });
      await carregar();
      if (mostrarPacientesExcluidos) await carregarPacientesExcluidos();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir o cadastro.");
    } finally {
      setSalvando(false);
    }
  };
  useEffect(() => {
    setErro("");
    setFormAberto(false);
    setForm({});
    setBuscaPaciente("");
    setEdicaoId(null);
    setMostrarPacientesExcluidos(false);
    void carregar();
    if (modulo === "Pacientes") void listarAlunosApi().then(setAlunosIndicacao);
  }, [modulo]);
  useEffect(()=>{if(modulo==="Pacientes"&&pacienteInicialId)setPacienteFichaId(pacienteInicialId)},[modulo,pacienteInicialId]);
  if(modulo==="Pacientes"&&pacienteFichaId)return <EducacaoFichaPaciente pacienteId={pacienteFichaId} abaInicial={pacienteAbaInicial} onVoltar={()=>{setPacienteFichaId(null);onPacienteAberto?.(null)}} onEditarOrcamento={onEditarOrcamento}/>;
  if (erro && !formAberto && modulo !== "Dashboard") return <div className="education-error">{erro}</div>;
  if (modulo === "Dashboard" && !Array.isArray(dados)) {
    const d = dados as Record<string, unknown>;
    const moeda = (valor: unknown) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const receitas = Number(d.receitas || 0);
    const despesas = Number(d.despesas || 0);
    const operacao = [
      { rotulo: "Alunos", valor: d.alunos, detalhe: "cadastrados", Icone: GraduationCap },
      { rotulo: "Pacientes-modelo", valor: d.pacientesModelo, detalhe: "em acompanhamento", Icone: ToothIcon },
      { rotulo: "Turmas ativas", valor: d.turmasAtivas, detalhe: "em andamento", Icone: BookOpen },
      { rotulo: "Agenda hoje", valor: d.agendaHoje, detalhe: "atendimentos", Icone: CalendarDays },
    ];
    const dataHoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
    return (
      <section className="education-page education-dashboard">
        {erro && <div className="education-dashboard-sync-note">{erro}</div>}
        <div className="education-dashboard-intro">
          <div>
            <span className="page-eyebrow">VISÃO GERAL</span>
            <h1>Dashboard educacional</h1>
          </div>
          <div className="education-dashboard-date"><CalendarDays size={18} /><div><span>Hoje</span><strong>{dataHoje}</strong></div></div>
        </div>
        <div className="education-dashboard-kpis">
          {operacao.map(({ rotulo, valor, detalhe, Icone }) => (
            <article className="education-dashboard-kpi" key={rotulo}>
              <span className="education-dashboard-kpi-icon"><Icone size={20} strokeWidth={1.8} /></span>
              <div><small>{rotulo}</small><strong>{String(valor ?? 0)}</strong><span>{detalhe}</span></div>
            </article>
          ))}
        </div>
        <div className="education-dashboard-panels">
          <article className="education-card education-dashboard-finance">
            <header><div><span className="page-eyebrow">FINANCEIRO</span><h2>Resumo financeiro</h2></div><WalletCards size={21} /></header>
            <div className="education-finance-summary-row positive"><span>Receitas</span><strong>{moeda(receitas)}</strong></div>
            <div className="education-finance-summary-row pending"><span>A receber</span><strong>{moeda(d.aReceber)}</strong></div>
            <div className="education-finance-summary-row negative"><span>Despesas</span><strong>{moeda(despesas)}</strong></div>
            <footer><span>Resultado</span><strong>{moeda(receitas - despesas)}</strong></footer>
          </article>
          <article className="education-card education-dashboard-overview">
            <header><div><span className="page-eyebrow">OPERAÇÃO</span><h2>Panorama de hoje</h2></div><LayoutDashboard size={21} /></header>
            <div className="education-overview-highlight"><span className="education-dashboard-kpi-icon"><CalendarDays size={22} /></span><div><strong>{String(d.agendaHoje ?? 0)}</strong><span>atendimentos agendados para hoje</span></div></div>
            <div className="education-overview-list">
              <div><span>Base de alunos</span><strong>{String(d.alunos ?? 0)}</strong></div>
              <div><span>Pacientes-modelo</span><strong>{String(d.pacientesModelo ?? 0)}</strong></div>
              <div><span>Turmas em andamento</span><strong>{String(d.turmasAtivas ?? 0)}</strong></div>
            </div>
          </article>
        </div>
      </section>
    );
  }
  const itens = modulo === "Pacientes" && mostrarPacientesExcluidos ? pacientesExcluidos : Array.isArray(dados) ? dados : [];
  const campos = camposModulo[modulo] || [];
  const termoBusca = buscaPaciente.trim().toLowerCase();
  const itensVisiveis =
    modulo === "Pacientes"
      ? termoBusca
        ? itens.filter((item) =>
            `${item.nome || ""} ${item.prontuario || ""} ${item.cpf || ""} ${item.telefone || ""}`
              .toLowerCase()
              .includes(termoBusca),
          )
        : []
      : itens;
  return (
    <section className="education-page">
      <div className="education-hero">
        <div>
          <span className="page-eyebrow">Soul Sul Treinamentos</span>
          <h1>{modulo}</h1>
        </div>
        <div className="education-row-actions">
          {modulo === "Pacientes" && administradorModulo && (
            <button type="button" onClick={() => {
              const proximo = !mostrarPacientesExcluidos;
              setMostrarPacientesExcluidos(proximo);
              setFormAberto(false);
              if (proximo) void carregarPacientesExcluidos();
            }}>
              {mostrarPacientesExcluidos ? "Voltar aos ativos" : "Cadastros excluídos"}
            </button>
          )}
          {!mostrarPacientesExcluidos && <button
            className="education-new-button"
            onClick={() => {
              setErro("");
              setForm({});
              setEdicaoId(null);
              setFormAberto(true);
            }}
          >
            + Novo registro
          </button>}
        </div>
      </div>
      {formAberto && (
        <form
          className="education-card education-form education-module-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSalvando(true);
            setErro("");
            try {
              if (modulo === "Pacientes") {
                const porAluno = Boolean(form.indicado_aluno);
                const pelaClinica = Boolean(form.indicado_clinica);
                if (porAluno === pelaClinica)
                  throw new Error(
                    "Escolha uma indicação: aluno(a) ou clínica.",
                  );
                if (porAluno && !form.indicado_aluno_id)
                  throw new Error(
                    "Selecione o aluno indicador na lista de sugestões.",
                  );
              }
              const payload = Object.fromEntries(
                Object.entries(form).map(([k, v]) => [
                  k,
                  ["valor", "duracao_minutos"].includes(k)
                    ? numeroEducacao(v)
                    : v,
                ]),
              );
              if (edicaoId && modulo === "Pacientes")
                await atualizarRecursoEducacaoApi(
                  recurso[modulo],
                  edicaoId,
                  payload,
                );
              else await criarRecursoEducacaoApi(recurso[modulo], payload);
              setFormAberto(false);
              setForm({});
              setEdicaoId(null);
              await carregar();
            } catch (ex) {
              setErro(
                ex instanceof Error
                  ? ex.message
                  : "Não foi possível cadastrar.",
              );
            } finally {
              setSalvando(false);
            }
          }}
        >
          <div className="education-list-head">
            <h2>{edicaoId ? "Editar paciente" : "Novo registro"}</h2>
            <button
              type="button"
              onClick={() => {
                setFormAberto(false);
                setEdicaoId(null);
              }}
            >
              Fechar
            </button>
          </div>
          {erro && <div className="education-error">{erro}</div>}
          <div className="education-module-fields">
            {campos
              .filter(
                (c) =>
                  c.tipo !== "aluno" || Boolean(form.indicado_aluno),
              )
              .map((c) => (
              <label
                key={c.nome}
                className={c.tipo === "checkbox" ? "education-check" : ""}
              >
                {c.tipo !== "checkbox" && c.rotulo}
                {c.tipo === "textarea" ? (
                  <textarea
                    required={c.obrigatorio}
                    value={form[c.nome] || ""}
                    onChange={(e) =>
                      setForm({ ...form, [c.nome]: e.target.value })
                    }
                  />
                ) : c.tipo === "select" ? (
                  <select
                    required={c.obrigatorio}
                    value={form[c.nome] || c.opcoes?.[0] || ""}
                    onChange={(e) =>
                      setForm({ ...form, [c.nome]: e.target.value })
                    }
                  >
                    {c.opcoes?.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : c.tipo === "radio" ? (
                  <span className="education-choice-group">
                    {c.opcoes?.map((o) => (
                      <label key={o}>
                        <input
                          type="radio"
                          name={c.nome}
                          required={c.obrigatorio}
                          checked={form[c.nome] === o}
                          onChange={() => setForm({ ...form, [c.nome]: o })}
                        />
                        {o}
                      </label>
                    ))}
                  </span>
                ) : c.tipo === "checkbox" ? (
                  <>
                    <input
                      type="checkbox"
                      checked={Boolean(form[c.nome]) && form[c.nome] !== "0"}
                      onChange={(e) => {
                        const marcado = e.target.checked;
                        if (c.nome === "indicado_aluno")
                          setForm({
                            ...form,
                            indicado_aluno: marcado ? "1" : "",
                            indicado_clinica: "",
                            ...(!marcado
                              ? {
                                  indicado_aluno_id: "",
                                  indicado_por_aluno: "",
                                }
                              : {}),
                          });
                        else if (c.nome === "indicado_clinica")
                          setForm({
                            ...form,
                            indicado_clinica: marcado ? "1" : "",
                            indicado_aluno: "",
                            indicado_aluno_id: "",
                            indicado_por_aluno: "",
                          });
                        else
                          setForm({
                            ...form,
                            [c.nome]: marcado ? "1" : "",
                          });
                      }}
                    />
                    {c.rotulo}
                  </>
                ) : c.tipo === "aluno" ? (
                  <>
                    <input
                      required
                      list="alunos-indicacao"
                      placeholder="Digite o código ou nome do aluno"
                      value={form.indicado_por_aluno || ""}
                      onChange={(e) => {
                        const texto = e.target.value;
                        const selecionado = alunosIndicacao.find(
                          (a) =>
                            `${a.codigo} — ${a.nome}`.toLowerCase() ===
                            texto.toLowerCase(),
                        );
                        setForm({
                          ...form,
                          indicado_por_aluno: texto,
                          indicado_aluno_id: selecionado
                            ? String(selecionado.id)
                            : "",
                        });
                      }}
                    />
                    <datalist id="alunos-indicacao">
                      {alunosIndicacao
                        .filter((a) => a.ativo)
                        .map((a) => (
                          <option
                            key={a.id}
                            value={`${a.codigo} — ${a.nome}`}
                          />
                        ))}
                    </datalist>
                  </>
                ) : (
                  <input
                    required={c.obrigatorio}
                    type={c.tipo || "text"}
                    step={c.tipo === "number" ? "0.01" : undefined}
                    value={form[c.nome] || ""}
                    onBlur={
                      c.nome === "cep" ? () => void buscarCep() : undefined
                    }
                    onChange={(e) =>
                      setForm({ ...form, [c.nome]: e.target.value })
                    }
                  />
                )}
              </label>
              ))}
          </div>
          <div className="education-actions">
            <button className="primary-button" disabled={salvando}>
              {salvando
                ? "Salvando..."
                : edicaoId
                  ? "Salvar alterações"
                  : "Salvar registro"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormAberto(false);
                setEdicaoId(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      <div className="education-card">
        {modulo === "Pacientes" && (
          <div className="education-list-head">
            <h2>{mostrarPacientesExcluidos ? "Pesquisar cadastro excluído" : "Pesquisar paciente"}</h2>
            <input
              placeholder="Nome, prontuário, CPF ou telefone"
              value={buscaPaciente}
              onChange={(e) => setBuscaPaciente(e.target.value)}
            />
          </div>
        )}
        {modulo !== "Pacientes" && <h2>{itens.length} registro(s)</h2>}
        {modulo === "Pacientes" && !termoBusca ? (
          <p className="education-empty">
            Digite na barra de pesquisa para localizar um paciente.
          </p>
        ) : itensVisiveis.length === 0 ? (
          <p className="education-empty">Nenhum registro encontrado.</p>
        ) : (
          <div className="education-data-table">
            {itensVisiveis.map((item, index) => (
              <div className="education-row" key={String(item.id ?? index)}>
                <div>
                  <strong>
                    {modulo === "Pacientes"
                      ? `${String(item.prontuario || "")} — ${String(item.nome || "")}`
                      : String(
                          item.nome ??
                            item.titulo ??
                            item.descricao ??
                            `Registro ${index + 1}`,
                        )}
                  </strong>
                  <small>
                    {modulo === "Pacientes"
                      ? mostrarPacientesExcluidos ? [
                          `Excluído em: ${String(item.excluido_em || "-")}`,
                          `Por: ${String(item.excluido_por || "-")}`,
                          `Motivo: ${String(item.excluido_motivo || "-")}`,
                          `Histórico: ${String((item.historico as any)?.orcamentos?.length || 0)} orçamento(s), ${String((item.historico as any)?.agendamentos?.length || 0)} agendamento(s), ${String((item.historico as any)?.guias?.length || 0)} guia(s)`,
                        ].join(" · ") : [
                          item.cpf && `CPF: ${item.cpf}`,
                          item.telefone && `Telefone: ${item.telefone}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : Object.entries(item)
                          .filter(
                            ([k]) =>
                              ![
                                "id",
                                "nome",
                                "titulo",
                                "descricao",
                                "senha_hash",
                                "criado_em",
                                "atualizado_em",
                              ].includes(k),
                          )
                          .slice(0, 5)
                          .map(([k, v]) => `${k}: ${String(v ?? "")}`)
                          .join(" · ")}
                  </small>
                </div>
                {modulo === "Pacientes" && !mostrarPacientesExcluidos && (
                  <div className="education-row-actions">
                  <button onClick={()=>{const id=Number(item.id);setPacienteFichaId(id);onPacienteAberto?.(id)}}>Abrir ficha</button>
                  <button
                    onClick={() => {
                      const preenchido = Object.fromEntries(
                        campos.map((c) => [
                          c.nome,
                          c.tipo === "checkbox"
                            ? item[c.nome]
                              ? "1"
                              : ""
                            : String(item[c.nome] ?? ""),
                        ]),
                      );
                      preenchido.indicado_aluno = item.indicado_aluno_id
                        ? "1"
                        : "";
                      setForm(preenchido);
                      setEdicaoId(Number(item.id));
                      setFormAberto(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <Pencil size={16} /> Editar
                  </button>
                  <button type="button" disabled={salvando} onClick={() => void desativarPaciente(item)}>
                    <Trash2 size={16} /> Excluir
                  </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function EducacaoFichaPaciente({pacienteId,abaInicial="Cadastro",onVoltar,onEditarOrcamento}:{pacienteId:number;abaInicial?:AbaFichaPaciente;onVoltar:()=>void;onEditarOrcamento?:(id:number)=>void}){
  const [ficha,setFicha]=useState<any>(null);const [aba,setAba]=useState<AbaFichaPaciente>(abaInicial);const [form,setForm]=useState<Record<string,any>>({});const [erro,setErro]=useState("");const [salvando,setSalvando]=useState(false);
  const carregar=async()=>{try{const dados=await buscarRecursoEducacaoApi<any>(`pacientes-modelo/${pacienteId}/ficha`);setFicha(dados);setForm(dados.paciente||{});setErro("")}catch(e){setErro(e instanceof Error?e.message:"Não foi possível carregar a ficha.")}};
  useEffect(()=>{void carregar()},[pacienteId]);
  useEffect(()=>setAba(abaInicial),[abaInicial,pacienteId]);
  async function salvar(e:FormEvent){e.preventDefault();setSalvando(true);setErro("");try{await atualizarRecursoEducacaoApi("pacientes-modelo",pacienteId,form);await carregar()}catch(ex){setErro(ex instanceof Error?ex.message:"Não foi possível salvar o cadastro.")}finally{setSalvando(false)}}
  const brlFicha=(v:any)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  if(!ficha)return <section className="education-page">{erro?<div className="education-error">{erro}</div>:<div className="education-card">Carregando ficha...</div>}</section>;
  const paciente=ficha.paciente||{};
  return <section className="education-page education-patient-record"><div className="education-patient-record-hero"><button type="button" onClick={onVoltar}>← Voltar</button><div><span className="page-eyebrow">PACIENTE-MODELO</span><h1>{paciente.prontuario} — {paciente.nome}</h1><p>{paciente.cpf||"CPF não informado"} · {paciente.telefone||"Telefone não informado"}</p></div></div>{erro&&<div className="education-error">{erro}</div>}<nav className="education-record-tabs">{(["Cadastro","Orçamentos","Financeiro","Documentos","Agendamentos"] as const).map(item=><button type="button" key={item} className={aba===item?"active":""} onClick={()=>setAba(item)}>{item}</button>)}</nav>
    {aba==="Cadastro"&&<form className="education-card education-form" onSubmit={salvar}><div className="education-list-head"><h2>Cadastro editável</h2><button className="primary-button" disabled={salvando}>{salvando?"Salvando...":"Salvar alterações"}</button></div><div className="education-module-fields">{camposModulo.Pacientes.filter(c=>!["indicado_aluno","indicado_por_aluno","responsavel","cpf_responsavel"].includes(c.nome)).map(c=><label key={c.nome} className={c.tipo==="checkbox"?"education-check":""}>{c.tipo!=="checkbox"&&c.rotulo}{c.tipo==="textarea"?<textarea value={form[c.nome]||""} onChange={e=>setForm({...form,[c.nome]:e.target.value})}/>:c.tipo==="radio"?<span className="education-choice-group">{c.opcoes?.map(o=><label key={o}><input type="radio" name={c.nome} checked={form[c.nome]===o} onChange={()=>setForm({...form,[c.nome]:o})}/>{o}</label>)}</span>:c.tipo==="checkbox"?<><input type="checkbox" checked={Boolean(form[c.nome])} onChange={e=>setForm({...form,[c.nome]:e.target.checked})}/>{c.rotulo}</>:<input type={c.tipo||"text"} required={c.obrigatorio} value={form[c.nome]||""} onChange={e=>setForm({...form,[c.nome]:e.target.value})}/>}</label>)}</div>{paciente.indicado_por_aluno&&<div className="education-record-note"><b>Indicado pelo aluno:</b> {paciente.indicado_por_aluno}</div>}</form>}
    {aba==="Orçamentos"&&<div className="education-card"><h2>Orçamentos</h2><div className="education-list">{ficha.orcamentos?.map((o:any)=><button type="button" className="education-row education-budget-record-row" key={o.id} onClick={()=>onEditarOrcamento?.(o.id)}><div><strong>Orçamento #{o.id}</strong><small>{o.data_contrato||"Sem data"} · {brlFicha(o.valor_total)}</small><span className={o.status==="APROVADO"?"status-pill ok":"status-pill"}>{o.status}</span></div><span>Editar orçamento →</span></button>)}{!ficha.orcamentos?.length&&<p className="education-empty">Nenhum orçamento.</p>}</div></div>}
    {aba==="Financeiro"&&<div className="education-card"><h2>Financeiro do paciente</h2><div className="education-list">{ficha.financeiro?.map((f:any)=><div className="education-row" key={f.id}><div><strong>{f.descricao||"Recebível"}</strong><small>Vencimento: {f.data_vencimento||"-"} · {f.forma_pagamento||"-"}</small></div><div><strong>{brlFicha(f.valor)}</strong><span className={f.status==="Pago"?"status-pill ok":"status-pill"}>{f.status}</span></div></div>)}{!ficha.financeiro?.length&&<p className="education-empty">Nenhum lançamento financeiro.</p>}</div></div>}
    {aba==="Documentos"&&<div className="education-card"><h2>Documentos</h2><div className="education-list">{ficha.documentos?.map((d:any)=><div className="education-row" key={d.id}><div><strong>{d.tipo?`${d.tipo} — `:""}{d.procedimento||d.nome}</strong>{d.procedimento&&<small>{d.nome}</small>}<small>{d.data||"Sem data"}</small></div><button onClick={()=>void (d.guia_id?baixarGuiaEducacaoApi(d.guia_id,d.nome):baixarContratoEducacaoApi(d.contrato_id,d.nome))}>Abrir / baixar</button></div>)}{!ficha.documentos?.length&&<p className="education-empty">Nenhum documento gerado.</p>}</div></div>}
    {aba==="Agendamentos"&&<div className="education-card"><h2>Agendamentos</h2><div className="education-list">{ficha.agendamentos?.map((a:any)=><div className="education-row" key={a.id}><div><strong>{a.titulo||"Atendimento"}</strong><small>{a.data||"-"} · {a.hora_inicio||""}{a.hora_fim?` às ${a.hora_fim}`:""} · {a.responsavel||"Sem responsável"}</small></div><span className={a.status==="Realizado"?"status-pill ok":"status-pill"}>{a.status}</span></div>)}{!ficha.agendamentos?.length&&<p className="education-empty">Nenhum agendamento.</p>}</div></div>}
  </section>
}

type PacienteModelo = {
  id: number;
  nome: string;
  prontuario: string;
  cpf?: string;
  telefone?: string;
};
type ProcedimentoEducacao = { id: number; nome: string; valor: number };
type OrcamentoEducacao = {
  id: number;
  paciente_nome: string;
  prontuario: string;
  valor_total: number;
  status: string;
  data_contrato: string;
};
type ItemOrcamentoEducacao = {
  procedimento_id: number;
  procedimento: string;
  valor: number;
  quantidade: number;
  profissional: string;
  denticao: string;
  regioes: string[];
  regioesInativas: string[];
  ativo: boolean;
  expandido: boolean;
};
type ParcelaOrcamentoEducacao = { descricao:string; data:string; forma:string; valor:number; valor_liquido:number; parcelas_cartao:number; operadora_cartao:string; bandeira_cartao:string };

function EducacaoOrcamentos({onAbrirPaciente,orcamentoId=null}:{onAbrirPaciente?:(id:number,aba?:AbaFichaPaciente)=>void;orcamentoId?:number|null}) {
  const [pacientes, setPacientes] = useState<PacienteModelo[]>([]);
  const [procedimentos, setProcedimentos] = useState<ProcedimentoEducacao[]>(
    [],
  );
  const [pacienteId, setPacienteId] = useState(0);
  const [pacienteBusca,setPacienteBusca]=useState("");
  const [procedimentoId, setProcedimentoId] = useState(0);
  const [tratamentoBusca,setTratamentoBusca]=useState("");
  const [itens, setItens] = useState<ItemOrcamentoEducacao[]>([]);
  const [itemEditandoIndex, setItemEditandoIndex] = useState<number | null>(null);
  const [modalPagamentoAberto,setModalPagamentoAberto]=useState(false);
  const [planoPagamento,setPlanoPagamento]=useState<ParcelaOrcamentoEducacao[]>([]);
  const [valorLiquidoCalculadora,setValorLiquidoCalculadora]=useState("");
  const [pagamentoComEntrada,setPagamentoComEntrada]=useState(false);
  const [quantidadeParcelasPagamento,setQuantidadeParcelasPagamento]=useState(1);
  const [statusOrcamento,setStatusOrcamento]=useState("EM_ABERTO");
  let usuarioEducacao:any=null;try{usuarioEducacao=JSON.parse(localStorage.getItem("soulsul_educacao_usuario")||"null")}catch{}
  const administrador=usuarioEducacao?.perfil==="ADMINISTRADOR"||usuarioEducacao?.usuario==="educacao.admin";
  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    validade_orcamento: "",
    observacoes: "",
    desconto_percentual: "0",
    desconto_valor: "0",
    entrada: "0",
    parcelas: "1",
    forma_pagamento: "",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [operadoraCartao,setOperadoraCartao]=useState<OperadoraCartaoEducacao>("InfinitePay");
  const [bandeiraCartao,setBandeiraCartao]=useState<BandeiraCartaoEducacao>("Visa / Mastercard");
  const [configFinanceiro,setConfigFinanceiro]=useState<any>({taxas:{},descontos:{},parcelas_maximas:12});
  useEffect(()=>{void buscarConfiguracoesFinanceiroEducacaoApi().then(setConfigFinanceiro).catch(()=>{})},[]);
  const brl = (v: number) =>
    Number(v || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  const bruto = itens.filter(i=>i.ativo).reduce((s, i) => s + i.valor * i.quantidade, 0);
  const total = Math.max(
    0,
    bruto -
      (bruto * numeroEducacao(form.desconto_percentual)) / 100 -
      numeroEducacao(form.desconto_valor),
  );
  const parcelasOrcamento=Math.max(1,Number(form.parcelas)||1);
  const entradaOrcamento=Math.min(total,numeroEducacao(form.entrada));
  const saldoOrcamento=total-entradaOrcamento;
  const cartaoOrcamento=form.forma_pagamento==="CARTAO_CREDITO";
  const cobrarComTaxa=(valor:number,parcelas:number)=>{if(!cartaoOrcamento||valor<=0)return valor;const indice=Math.max(0,parcelas-1);const personalizada=Number(configFinanceiro.taxas?.[`${operadoraCartao}|${parcelas}`]??configFinanceiro.taxas?.[operadoraCartao]);if(personalizada>0)return arredondarCobrancaCartao(valor/(1-personalizada/100));if(operadoraCartao==="PagBank")return arredondarCobrancaCartao(valor*FATORES_CARTAO_PAGBANK[Math.min(indice,17)]);const taxa=TAXAS_CARTAO_INFINITEPAY[bandeiraCartao][Math.min(indice,11)];return arredondarCobrancaCartao(valor/(1-taxa/100))};
  const entradaCobrada=cobrarComTaxa(entradaOrcamento,1);const saldoCobrado=cobrarComTaxa(saldoOrcamento,parcelasOrcamento);const totalCobrado=entradaCobrada+saldoCobrado;
  async function carregar() {
    try {
      const [p, t] = await Promise.all([
        buscarRecursoEducacaoApi<PacienteModelo[]>("pacientes-modelo"),
        buscarRecursoEducacaoApi<ProcedimentoEducacao[]>("procedimentos"),
      ]);
      setPacientes(p);
      setProcedimentos(t);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar orçamentos.");
    }
  }
  useEffect(() => {
    void (async()=>{await carregar();if(!orcamentoId){setStatusOrcamento("EM_ABERTO");return}try{const o=await buscarRecursoEducacaoApi<any>(`orcamentos/${orcamentoId}`);setStatusOrcamento(o.status||"EM_ABERTO");setPacienteId(Number(o.paciente_modelo_id)||0);const paciente=(await buscarRecursoEducacaoApi<PacienteModelo[]>("pacientes-modelo")).find(p=>p.id===Number(o.paciente_modelo_id));setPacienteBusca(paciente?`${paciente.prontuario} — ${paciente.nome}`:"");setForm({data:o.data_contrato||new Date().toISOString().slice(0,10),validade_orcamento:o.validade_orcamento||"",observacoes:o.descricao||"",desconto_percentual:String(o.desconto_percentual||0),desconto_valor:String(o.desconto_valor||0),entrada:String(o.entrada||0),parcelas:String(o.parcelas||1),forma_pagamento:o.forma_pagamento||""});setItens((o.itens||[]).map((item:any)=>({...item,regioes:Array.isArray(item.regioes)?item.regioes:[],regioesInativas:[],ativo:item.ativo!==false,expandido:false})));setPlanoPagamento(Array.isArray(o.plano_pagamento)?o.plano_pagamento:[])}catch(e){setErro(e instanceof Error?e.message:"Não foi possível abrir o orçamento.")}})();
  }, [orcamentoId]);
  function adicionar() {
    const p = procedimentos.find((x) => x.id === procedimentoId);
    if (!p) return;
    const novosItens = [
      ...itens,
      {
        procedimento_id: p.id,
        procedimento: p.nome,
        valor: Number(p.valor || 0),
        quantidade: 1,
        profissional: "",
        denticao: "Permanente",
        regioes: [],
        regioesInativas: [],
        ativo: true,
        expandido: false,
      },
    ];
    setItens(novosItens);
    setItemEditandoIndex(novosItens.length - 1);
    setProcedimentoId(0);
    setTratamentoBusca("");
  }
  function alternarItemAtivo(index:number){setItens(itens.map((item,i)=>{if(i!==index)return item;const ativar=!item.ativo;return {...item,ativo:ativar,regioesInativas:ativar?[]:[...item.regioes],quantidade:Math.max(1,item.regioes.length)}}))}
  function alternarItemExpandido(index:number){setItens(itens.map((item,i)=>i===index?{...item,expandido:!item.expandido}:item))}
  function alternarRegiaoAtivaResumo(index:number,regiao:string){setItens(itens.map((item,i)=>{if(i!==index)return item;const estavaInativa=item.regioesInativas.includes(regiao);const inativas=estavaInativa?item.regioesInativas.filter(r=>r!==regiao):[...item.regioesInativas,regiao];const quantidadeAtiva=item.regioes.filter(r=>!inativas.includes(r)).length;return {...item,regioesInativas:inativas,ativo:quantidadeAtiva>0,quantidade:Math.max(1,quantidadeAtiva)}}))}
  function criarPlanoPagamento(comEntrada=entradaOrcamento>0,quantidade=parcelasOrcamento):ParcelaOrcamentoEducacao[]{
    const limiteParcelas=cartaoOrcamento?Number(configFinanceiro.parcelas_cartao||12):Number(configFinanceiro.parcelas_boleto||1);quantidade=Math.min(Math.max(1,quantidade),limiteParcelas);
    const linhas:ParcelaOrcamentoEducacao[]=[];
    const valorEntrada=comEntrada?(entradaOrcamento>0?entradaOrcamento:0):0;const saldo=total-valorEntrada;
    if(comEntrada)linhas.push({descricao:"Entrada",data:form.data,forma:form.forma_pagamento||"PIX",valor:cobrarComTaxa(valorEntrada,1),valor_liquido:valorEntrada,parcelas_cartao:1,operadora_cartao:operadoraCartao,bandeira_cartao:bandeiraCartao});
    const base=new Date(`${form.data}T12:00:00`);
    for(let i=0;i<quantidade;i++){const data=new Date(base);data.setMonth(data.getMonth()+i+(comEntrada?1:0));const liquido=saldo/quantidade;linhas.push({descricao:`Parcela ${i+1}`,data:data.toISOString().slice(0,10),forma:form.forma_pagamento||"PIX",valor:cobrarComTaxa(liquido,quantidade),valor_liquido:liquido,parcelas_cartao:quantidade,operadora_cartao:operadoraCartao,bandeira_cartao:bandeiraCartao})}
    return linhas;
  }
  function abrirPagamento(){const comEntrada=entradaOrcamento>0;setPagamentoComEntrada(comEntrada);setQuantidadeParcelasPagamento(parcelasOrcamento);setPlanoPagamento(criarPlanoPagamento(comEntrada,parcelasOrcamento));setModalPagamentoAberto(true)}
  function redefinirPlanoPagamento(comEntrada:boolean,quantidade:number){const qtd=Math.max(1,quantidade||1);setPagamentoComEntrada(comEntrada);setQuantidadeParcelasPagamento(qtd);setPlanoPagamento(criarPlanoPagamento(comEntrada,qtd))}
  function atualizarParcela(index:number,campo:keyof ParcelaOrcamentoEducacao,valor:string|number){setPlanoPagamento(planoPagamento.map((linha,i)=>i===index?{...linha,[campo]:valor}:linha))}
  function renderCalculadoraFinanceira(){
    const digitado=numeroEducacao(valorLiquidoCalculadora);const liquido=digitado>0?digitado:total;const boleto=arredondarCobrancaCartao(liquido*1.08);const taxas=TAXAS_CARTAO_INFINITEPAY[bandeiraCartao];
    return <section className="budget-finance-calculator"><div className="budget-finance-calculator-head"><div><span className="panel-kicker">Calculadora financeira</span><h4>Quanto cobrar para receber o valor desejado</h4><p>Informe o valor líquido. Os totais abaixo já compensam as taxas.</p></div><label className="budget-finance-value-field"><span>Quero receber</span><input inputMode="decimal" placeholder={total>0?brl(total):"R$ 0,00"} value={valorLiquidoCalculadora} onChange={e=>setValorLiquidoCalculadora(e.target.value)}/>{total>0&&digitado<=0&&<small>Usando o total atual do orçamento.</small>}</label></div>{liquido>0?<div className="budget-finance-results"><article className="budget-finance-boleto"><div><span className="panel-kicker">Boleto</span><strong>{brl(boleto)}</strong><small>Valor com 8% de taxa de segurança</small></div><div className="budget-finance-entry-grid">{[30,15,10].map(percentual=>{const entrada=arredondarCobrancaCartao(boleto*percentual/100);return <div key={percentual}><span>Entrada {percentual}%</span><strong>{brl(entrada)}</strong><small>Saldo {brl(boleto-entrada)}</small></div>})}</div></article><article className="budget-finance-card-table"><div className="budget-finance-card-table-head"><div><span className="panel-kicker">Cartão de crédito</span><strong>InfinitePay × PagBank</strong></div><label><span>Bandeira na InfinitePay</span><select value={bandeiraCartao} onChange={e=>setBandeiraCartao(e.target.value as BandeiraCartaoEducacao)}>{Object.keys(TAXAS_CARTAO_INFINITEPAY).map(b=><option key={b}>{b}</option>)}</select></label></div><div className="budget-finance-table-scroll"><table><thead><tr><th>Parcelas</th><th>InfinitePay</th><th>PagBank</th><th>Menor cobrança</th></tr></thead><tbody>{FATORES_CARTAO_PAGBANK.map((fator,i)=>{const qtd=i+1;const taxa=taxas[i];const infinite=taxa==null?null:arredondarCobrancaCartao(liquido/(1-taxa/100));const pagbank=arredondarCobrancaCartao(liquido*fator);const menor=infinite==null||pagbank<infinite?"PagBank":"InfinitePay";return <tr key={qtd}><td><strong>{qtd}x</strong></td><td>{infinite==null?"—":brl(infinite)}{infinite!=null&&<small>{qtd}x de {brl(infinite/qtd)} • {taxa.toFixed(2).replace(".",",")}%</small>}</td><td>{brl(pagbank)}<small>{qtd}x de {brl(pagbank/qtd)}</small></td><td><span className="budget-finance-best">{menor}</span></td></tr>})}</tbody></table></div><p className="budget-finance-note">Valores mínimos arredondados para cima em centavos.</p></article></div>:<span className="budget-finance-empty">Adicione tratamentos ou digite um valor para comparar as opções.</span>}</section>
  }
  function retirarItem(index:number) {
    setItens(itens.filter((_, i) => i !== index));
    setItemEditandoIndex((atual) => {
      if (atual === null) return null;
      if (atual === index) return null;
      return atual > index ? atual - 1 : atual;
    });
  }
  function alternarRegiaoItem(index:number,regiao:string){
    setItens(itens.map((item,i)=>{if(i!==index)return item;const regioes=item.regioes.includes(regiao)?item.regioes.filter(r=>r!==regiao):[...item.regioes,regiao];const regioesInativas=item.regioesInativas.filter(r=>regioes.includes(r));const quantidadeAtiva=regioes.filter(r=>!regioesInativas.includes(r)).length;return {...item,regioes,regioesInativas,ativo:quantidadeAtiva>0,quantidade:Math.max(1,quantidadeAtiva)}}));
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    const botao=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    const aprovarSolicitado=botao?.dataset.aprovar==="1";
    if (itens.some((item) => item.ativo && item.regioes.length === 0)) {
      setErro("Selecione ao menos um dente ou uma arcada para cada tratamento.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const pacienteSalvoId=pacienteId;
      const payload = {
        paciente_modelo_id: pacienteId,
        itens: itens.map(item=>({...item,regioes:item.regioes.filter(regiao=>!item.regioesInativas.includes(regiao)),quantidade:item.ativo?Math.max(1,item.regioes.filter(regiao=>!item.regioesInativas.includes(regiao)).length):item.quantidade})),
        data: form.data,
        validade_orcamento: form.validade_orcamento,
        observacoes: form.observacoes,
        desconto_percentual: numeroEducacao(form.desconto_percentual),
        desconto_valor: numeroEducacao(form.desconto_valor),
        entrada: cartaoOrcamento ? entradaCobrada : numeroEducacao(form.entrada),
        parcelas: Number(form.parcelas || 1),
        forma_pagamento: form.forma_pagamento,
        valor_cobrado: cartaoOrcamento ? totalCobrado : total,
        acrescimo_cartao: cartaoOrcamento ? totalCobrado-total : 0,
        plano_pagamento: planoPagamento.length ? planoPagamento : [
          ...(entradaOrcamento>0?[{descricao:"Entrada",valor:cartaoOrcamento?entradaCobrada:entradaOrcamento,forma:form.forma_pagamento,data:form.data}]:[]),
          ...Array.from({length:parcelasOrcamento},(_,i)=>({descricao:`Parcela ${i+1}`,valor:(cartaoOrcamento?saldoCobrado:saldoOrcamento)/parcelasOrcamento,forma:form.forma_pagamento,data:form.data,parcelas_cartao:cartaoOrcamento?parcelasOrcamento:1,operadora_cartao:cartaoOrcamento?operadoraCartao:"",bandeira_cartao:cartaoOrcamento?bandeiraCartao:""})),
        ],
      };
      const resposta=orcamentoId?await atualizarRecursoEducacaoApi<{contrato_id:number}>("orcamentos",orcamentoId,payload):await criarRecursoEducacaoApi<{contrato_id:number}>("orcamentos",payload);
      const contratoSalvoId=Number(resposta?.contrato_id||orcamentoId||0);
      if((aprovarSolicitado||statusOrcamento==="APROVADO")&&administrador&&contratoSalvoId)await alterarStatusOrcamentoEducacaoApi(contratoSalvoId,"APROVADO");
      setItens([]);
      setItemEditandoIndex(null);
      setPacienteId(0);
      setPacienteBusca("");
      await carregar();
      onAbrirPaciente?.(pacienteSalvoId);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível salvar o orçamento.",
      );
    } finally {
      setSalvando(false);
    }
  }
  return (
    <section className="education-page">
      <div className="education-hero">
        <div>
          <span className="page-eyebrow">PACIENTES-MODELO</span>
          <h1>Orçamentos e contratos</h1>
        </div>
      </div>
      {orcamentoId&&pacienteId>0&&<nav className="education-record-tabs education-budget-patient-tabs" aria-label="Ficha do paciente">{(["Cadastro","Orçamentos","Financeiro","Documentos","Agendamentos"] as AbaFichaPaciente[]).map(aba=><button type="button" key={aba} className={aba==="Orçamentos"?"active":""} onClick={()=>{if(aba!=="Orçamentos")onAbrirPaciente?.(pacienteId,aba)}}>{aba}</button>)}</nav>}
      {erro && <div className="education-error">{erro}</div>}
      <div className="education-budget-full">
        <form className="education-budget-workspace" onSubmit={salvar}>
          <div className="education-card education-form education-budget-editor">
          <h2>{orcamentoId?`Editar orçamento #${orcamentoId}`:"Novo orçamento"}</h2>
          <label>
            Paciente-modelo
            <input
              required
              list="pacientes-modelo-orcamento"
              placeholder="Digite o nome, CPF ou prontuário"
              value={pacienteBusca}
              onChange={e=>{const texto=e.target.value;setPacienteBusca(texto);const procurado=texto.trim().toLowerCase();const encontrado=pacientes.find(p=>`${p.prontuario} — ${p.nome}`.toLowerCase()===procurado||String(p.cpf||"").toLowerCase()===procurado);setPacienteId(encontrado?.id||0)}}
            />
            <datalist id="pacientes-modelo-orcamento">{pacientes.map(p=><option key={p.id} value={`${p.prontuario} — ${p.nome}`}>{p.cpf||""}</option>)}</datalist>
            {pacienteBusca&&!pacienteId&&<small>Selecione o paciente correto nas sugestões.</small>}
          </label>
          <div className="education-form-row">
            <label>
              Data
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </label>
            <label>
              Validade
              <input
                type="date"
                value={form.validade_orcamento}
                onChange={(e) =>
                  setForm({ ...form, validade_orcamento: e.target.value })
                }
              />
            </label>
          </div>
          <div className="education-treatment-picker">
            <div className="education-treatment-picker-head"><h3>Adicionar tratamento</h3><button type="button" className="primary-action" onClick={adicionar} disabled={!procedimentoId}><Plus size={17}/> Adicionar</button></div>
            <div className="budget-search-field"><Search size={18}/><input placeholder="Buscar tratamento existente" value={tratamentoBusca} onChange={e=>{setTratamentoBusca(e.target.value);setProcedimentoId(0)}}/></div>
            {tratamentoBusca.trim()&&!procedimentoId&&<div className="procedure-catalog-list procedure-catalog-dropdown education-treatment-results">
              {procedimentos.filter(p=>p.nome.toLowerCase().includes(tratamentoBusca.toLowerCase())).map(p=><button key={p.id} type="button" className={`procedure-catalog-item${procedimentoId===p.id?" active":""}`} onClick={()=>{setProcedimentoId(p.id);setTratamentoBusca(p.nome)}}><div><strong>{p.nome}</strong></div><strong>{brl(p.valor)}</strong></button>)}
              {!procedimentos.some(p=>p.nome.toLowerCase().includes(tratamentoBusca.toLowerCase()))&&<div className="procedure-catalog-empty">Nenhum tratamento encontrado.</div>}
            </div>}
          </div>
          {itemEditandoIndex !== null && itens[itemEditandoIndex] && (() => {
            const item = itens[itemEditandoIndex];
            const index = itemEditandoIndex;
            return (
              <div className="education-treatment-editor" key={`${item.procedimento_id}-${index}`}>
                <div>
                  <div className="education-treatment-editor-head">
                    <div><small>EDITANDO TRATAMENTO</small><strong>{item.procedimento}</strong></div>
                    <button type="button" onClick={() => setItemEditandoIndex(null)}>Concluir</button>
                  </div>
                  <div className="education-form-row">
                    <label>
                      Quantidade
                      <input
                        type="number"
                        min="1"
                        readOnly={item.regioes.length > 0}
                        value={item.quantidade}
                        onChange={(e) =>
                          setItens(
                            itens.map((x, i) =>
                              i === index
                                ? { ...x, quantidade: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                      {item.regioes.length>0&&<small>Atualizada automaticamente pelas regiões.</small>}
                    </label>
                    <label>
                      Valor unitário
                      <input
                        type="number"
                        step="0.01"
                        value={item.valor}
                        onChange={(e) =>
                          setItens(
                            itens.map((x, i) =>
                              i === index
                                ? { ...x, valor: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Profissional
                    <input
                      value={item.profissional}
                      onChange={(e) =>
                        setItens(
                          itens.map((x, i) =>
                            i === index
                              ? { ...x, profissional: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="education-dental-selector">
                    <span>Selecione dentes ou arcadas</span>
                    <div className="education-arch-buttons">
                      {["Arcada superior","Arcada inferior"].map(regiao=><button type="button" className={item.regioes.includes(regiao)?"active":""} key={regiao} onClick={()=>alternarRegiaoItem(index,regiao)}>{regiao}</button>)}
                    </div>
                    <div className="education-teeth-grid">
                      {[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map(dente=>{const valor=String(dente);return <button type="button" className={item.regioes.includes(valor)?"active":""} key={dente} onClick={()=>alternarRegiaoItem(index,valor)}>{dente}</button>})}
                    </div>
                    {item.regioes.length>0&&<small>Selecionados: {item.regioes.join(", ")}</small>}
                  </div>
                </div>
              </div>
            );
          })()}
          {renderCalculadoraFinanceira()}
          <label>
            Observações
            <textarea
              value={form.observacoes}
              onChange={(e) =>
                setForm({ ...form, observacoes: e.target.value })
              }
            />
          </label>
          </div>
          <aside className="budget-preview-panel education-budget-preview">
            <header className="budget-preview-header">
              <div><strong>Orçamento</strong><small>Resumo dos tratamentos</small></div>
              <span>{itens.length} {itens.length === 1 ? "item" : "itens"}</span>
            </header>
            <div className="budget-preview-body">
              {itens.length === 0 && <div className="budget-preview-empty"><strong>Nenhum tratamento adicionado</strong><span>Escolha um tratamento ao lado para começar.</span></div>}
              {itens.map((item,index)=><article className={`budget-preview-item${item.ativo?"":" ghost"}`} key={`${item.procedimento_id}-resumo-${index}`}>
                <div className="budget-preview-item-row">
                  <div className="budget-preview-item-main budget-preview-item-main-rich">
                    <div className="budget-preview-item-top">
                      <label className="budget-preview-check"><input type="checkbox" checked={item.ativo} onChange={()=>alternarItemAtivo(index)}/></label>
                      <button type="button" className="budget-preview-expand" onClick={()=>alternarItemExpandido(index)}><ChevronDown size={16} className={item.expandido?"expanded":""}/><div className="budget-preview-expand-copy"><strong>{item.procedimento} (x{item.quantidade})</strong><span className="budget-preview-inline-summary">Dentes/Regiões: {item.regioes.length?item.regioes.join(", "):"Ainda não selecionados"}</span></div></button>
                    </div>
                    <div className="budget-preview-meta">
                      {item.profissional && <div className="budget-preview-meta-line"><b>Profissional:</b> {item.profissional}</div>}
                      <div className="budget-preview-meta-line">{brl(item.valor)} por unidade</div>
                    </div>
                  </div>
                  <div className="budget-preview-value">
                    <strong>{brl(item.valor * item.quantidade)}</strong>
                    <div className="budget-preview-value-actions">
                      <button type="button" className="budget-preview-value-action" onClick={()=>setItemEditandoIndex(index)}>Editar</button>
                      <button type="button" className="budget-preview-value-action budget-preview-value-action-danger" onClick={()=>alternarItemAtivo(index)}>{item.ativo?<X size={13}/>:<Plus size={13}/>} {item.ativo?"Retirar":"Restaurar"}</button>
                    </div>
                  </div>
                </div>
                {item.expandido&&<div className="budget-preview-detail-shell"><div className="budget-preview-detail-list">{item.regioes.map(regiao=>{const ativa=item.ativo&&!item.regioesInativas.includes(regiao);return <div className={`budget-preview-detail-row${ativa?"":" muted"}`} key={regiao}><label className="budget-preview-check"><input type="checkbox" checked={ativa} onChange={()=>alternarRegiaoAtivaResumo(index,regiao)}/></label><span className="budget-preview-region-name">{regiao}</span><strong>{brl(ativa?item.valor:0)}</strong></div>})}</div><button type="button" className="education-remove-definitive" onClick={()=>retirarItem(index)}><Trash2 size={14}/> Excluir definitivamente</button></div>}
              </article>)}
            </div>
            <footer className="budget-preview-footer">
              {bruto !== total && <div className="education-budget-summary-line"><span>Subtotal</span><strong>{brl(bruto)}</strong></div>}
              {cartaoOrcamento && totalCobrado > total && <div className="education-budget-summary-line"><span>Taxa do cartão</span><strong>{brl(totalCobrado-total)}</strong></div>}
              <div className="budget-preview-total"><span>Total</span><strong>{brl(cartaoOrcamento?totalCobrado:total)}</strong></div>
              <small>{entradaOrcamento > 0 ? `Entrada de ${brl(cartaoOrcamento?entradaCobrada:entradaOrcamento)} + ` : ""}{parcelasOrcamento}x de {brl((cartaoOrcamento?saldoCobrado:saldoOrcamento)/parcelasOrcamento)}</small>
              <div className="budget-preview-footer-actions"><button type="button" className="ghost-action budget-payment-action" onClick={abrirPagamento}>Forma: {form.forma_pagamento||"Não definida"}</button><div className="education-budget-save-actions"><button className="primary-action" disabled={salvando || !pacienteId || !itens.some(i=>i.ativo) || (statusOrcamento==="APROVADO"&&!administrador)}>{salvando ? "Salvando..." : statusOrcamento==="APROVADO"?"Salvar e atualizar contrato":"Salvar orçamento"}</button>{administrador&&statusOrcamento!=="APROVADO"&&<button className="primary-action education-approve-action" data-aprovar="1" disabled={salvando || !pacienteId || !itens.some(i=>i.ativo)}>Salvar e aprovar</button>}</div></div>
            </footer>
          </aside>
        </form>
      </div>
      {modalPagamentoAberto&&<div className="overlay" role="presentation"><article className="modal-shell modal-shell-payment"><header className="modal-header"><div><h2>Forma de Pagamento</h2></div><button type="button" className="icon-only" onClick={()=>setModalPagamentoAberto(false)}><X size={20}/></button></header><div className="modal-body payment-modal-body"><div className="payment-modal-top"><label className="payment-check"><input type="checkbox" checked={pagamentoComEntrada} onChange={e=>redefinirPlanoPagamento(e.target.checked,quantidadeParcelasPagamento)}/> Entrada</label><label className="form-field"><span>Parcelas</span><input inputMode="numeric" value={quantidadeParcelasPagamento} onChange={e=>redefinirPlanoPagamento(pagamentoComEntrada,Math.max(1,Number(e.target.value)||1))}/></label></div><div className="payment-table-shell"><table className="payment-table"><thead><tr><th>Parcela</th><th>Data</th><th>Forma</th><th>Detalhe</th><th>Valor</th></tr></thead><tbody>{planoPagamento.map((linha,index)=><tr key={`${linha.descricao}-${index}`}><td>{linha.descricao}</td><td><input type="date" value={linha.data} onChange={e=>atualizarParcela(index,"data",e.target.value)}/></td><td><select value={linha.forma} onChange={e=>atualizarParcela(index,"forma",e.target.value)}><option value="PIX">PIX</option><option value="BOLETO">Boleto</option><option value="CARTAO_CREDITO">Cartão de crédito</option><option value="CARTAO_DEBITO">Cartão de débito</option><option value="DINHEIRO">Dinheiro</option><option value="PERMUTA">Permuta</option></select></td><td>{linha.forma==="CARTAO_CREDITO"?<select value={linha.parcelas_cartao} onChange={e=>atualizarParcela(index,"parcelas_cartao",Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}x</option>)}</select>:<span className="payment-inline-note">{["PIX","DINHEIRO","CARTAO_DEBITO"].includes(linha.forma)?"À vista":"Mensal"}</span>}</td><td><input className="payment-value-input" type="number" step="0.01" value={linha.valor} onChange={e=>atualizarParcela(index,"valor",Number(e.target.value))}/></td></tr>)}</tbody></table></div>{planoPagamento.some(l=>l.forma==="PERMUTA")&&<div className="payment-inline-note">O valor permanece no contrato, mas a permuta não deve ser contabilizada como venda.</div>}</div><footer className="modal-footer"><div className="sticky-actions"><button type="button" className="ghost-action" onClick={()=>setModalPagamentoAberto(false)}>Fechar</button><button type="button" className="primary-action" onClick={()=>{const entrada=pagamentoComEntrada?planoPagamento[0]?.valor||0:0;setForm({...form,entrada:String(entrada),parcelas:String(quantidadeParcelasPagamento),forma_pagamento:planoPagamento.map(l=>l.forma).filter((v,i,a)=>a.indexOf(v)===i).join(" + ")});setModalPagamentoAberto(false)}}>OK</button></div></footer></article></div>}
    </section>
  );
}

function EducacaoCrm() {
  const [orcamentos,setOrcamentos]=useState<OrcamentoEducacao[]>([]);const [erro,setErro]=useState("");const [busca,setBusca]=useState("");
  let usuario:any=null;try{usuario=JSON.parse(localStorage.getItem("soulsul_educacao_usuario")||"null")}catch{}
  const administrador=usuario?.perfil==="ADMINISTRADOR"||usuario?.usuario==="educacao.admin";
  const carregar=()=>buscarRecursoEducacaoApi<OrcamentoEducacao[]>("orcamentos").then(setOrcamentos).catch(e=>setErro(e instanceof Error?e.message:"Falha ao carregar o CRM."));
  useEffect(()=>{void carregar()},[]);
  async function alterar(o:OrcamentoEducacao){setErro("");try{await alterarStatusOrcamentoEducacaoApi(o.id,o.status==="APROVADO"?"EM_ABERTO":"APROVADO");await carregar()}catch(e){setErro(e instanceof Error?e.message:"Não foi possível alterar o orçamento.")}}
  const lista=orcamentos.filter(o=>`${o.paciente_nome} ${o.prontuario}`.toLowerCase().includes(busca.toLowerCase()));
  return <section className="education-page"><div className="education-hero"><div><span className="page-eyebrow">RELACIONAMENTO</span><h1>CRM de pacientes-modelo</h1></div></div>{erro&&<div className="education-error">{erro}</div>}<div className="education-card"><div className="education-list-head"><h2>Histórico de orçamentos</h2><input placeholder="Buscar paciente ou prontuário" value={busca} onChange={e=>setBusca(e.target.value)}/></div><div className="education-list">{lista.map(o=><div className="education-row" key={o.id}><div><strong>{o.prontuario} — {o.paciente_nome}</strong><small>{o.data_contrato||"Sem data"} · {Number(o.valor_total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</small><span className={o.status==="APROVADO"?"status-pill ok":"status-pill"}>{o.status==="APROVADO"?"Aprovado":"Em aberto"}</span></div><div className="education-row-actions">{administrador&&<button onClick={()=>void alterar(o)}>{o.status==="APROVADO"?"Reabrir":"Aprovar"}</button>}{o.status==="APROVADO"&&<button onClick={()=>void baixarContratoEducacaoApi(o.id,`CONTRATO_${o.prontuario}.docx`)}>Contrato</button>}</div></div>)}{lista.length===0&&<p className="education-empty">Nenhum orçamento encontrado.</p>}</div></div></section>
}

export function EducacaoPage({
  secao = "Alunos",
}: {
  secao?: "Alunos" | "Treinamentos";
}) {
  let usuarioPagina:any=null;try{usuarioPagina=JSON.parse(localStorage.getItem("soulsul_educacao_usuario")||"null")}catch{}
  const administradorPagina=usuarioPagina?.perfil==="ADMINISTRADOR"||usuarioPagina?.usuario==="educacao.admin";
  const [aba, setAba] = useState<Aba>(secao);
  const [alunos, setAlunos] = useState<AlunoApi[]>([]);
  const [alunosExcluidos, setAlunosExcluidos] = useState<Record<string, any>[]>([]);
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);
  const [treinamentos, setTreinamentos] = useState<TreinamentoApi[]>([]);
  const [turmas, setTurmas] = useState<TurmaTreinamentoApi[]>([]);
  const [matriculas, setMatriculas] = useState<MatriculaTreinamentoApi[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aluno, setAluno] = useState(alunoVazio);
  const [alunoId, setAlunoId] = useState<number | null>(null);
  const [abaAluno, setAbaAluno] = useState<"Cadastro" | "Documentos">(
    "Cadastro",
  );
  const [documentosAluno, setDocumentosAluno] = useState<
    { id: number; nome: string; data: string; arquivo: string }[]
  >([]);
  const [treinamento, setTreinamento] = useState(treinamentoVazio);
  const [treinamentoId, setTreinamentoId] = useState<number | null>(null);
  const [turma, setTurma] = useState(turmaVazia);
  const [turmaId, setTurmaId] = useState<number | null>(null);
  const [novaMatricula, setNovaMatricula] = useState({
    alunoId: 0,
    turmaId: 0,
    valor: "0",
    descontoPercentual: "0",
    descontoValor: "0",
    entrada: "0",
    parcelas: "1",
    formaPagamento: "PIX",
    primeiroVencimento: new Date().toISOString().slice(0, 10),
  });
  const [operadoraCartao, setOperadoraCartao] = useState<OperadoraCartaoEducacao>("InfinitePay");
  const [bandeiraCartao, setBandeiraCartao] = useState<BandeiraCartaoEducacao>("Visa / Mastercard");
  const [matriculaConcluida, setMatriculaConcluida] = useState<{ id: number; alunoNome: string } | null>(null);
  const [turmaConsulta,setTurmaConsulta]=useState(0);
  const [filtroTurma,setFiltroTurma]=useState("");

  async function carregar() {
    try {
      const [a, t, tu, m] = await Promise.all([
        listarAlunosApi(),
        listarTreinamentosApi(),
        listarTurmasTreinamentoApi(),
        listarMatriculasTreinamentoApi(),
      ]);
      setAlunos(a);
      setTreinamentos(t);
      setTurmas(tu);
      setMatriculas(m);
      setErro("");
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar a área de educação.",
      );
    }
  }
  async function carregarAlunosExcluidos() {
    try {
      setAlunosExcluidos(await listarAlunosExcluidosApi());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os cadastros excluídos.");
    }
  }
  async function desativarAluno(a: AlunoApi) {
    const justificativa = window.prompt(`Informe a justificativa para excluir o cadastro de ${a.nome}:`)?.trim();
    if (!justificativa) return;
    const senha = window.prompt("Digite a senha gerencial:") || "";
    if (!senha) return;
    await executar(() => excluirAlunoApi(a.id, { senha_gerencial: senha, justificativa }), () => {});
    if (mostrarExcluidos) await carregarAlunosExcluidos();
  }
  useEffect(() => {
    setAba(secao);
    void carregar();
  }, [secao]);
  const alunosFiltrados = useMemo(
    () =>
      alunos.filter((a) =>
        `${a.nome} ${a.cpf} ${a.email}`
          .toLowerCase()
          .includes(busca.toLowerCase()),
      ),
    [alunos, busca],
  );
  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const turmaMatricula = turmas.find((t) => t.id === novaMatricula.turmaId);
  const valorCurso =
    numeroEducacao(novaMatricula.valor) ||
    turmaMatricula?.treinamentoValor ||
    0;
  const descontoMatricula = Math.max(
    numeroEducacao(novaMatricula.descontoValor),
    (valorCurso * numeroEducacao(novaMatricula.descontoPercentual)) / 100,
  );
  const totalMatricula = Math.max(0, valorCurso - descontoMatricula);
  const entradaMatricula = Math.min(
    totalMatricula,
    numeroEducacao(novaMatricula.entrada),
  );
  const parcelasMatricula = Math.max(1, Number(novaMatricula.parcelas) || 1);
  const pagamentoCartao = novaMatricula.formaPagamento === "CARTAO_CREDITO";
  const aplicarTaxaCartao = (valorLiquido: number, parcelas: number) => {
    if (!pagamentoCartao || valorLiquido <= 0) return valorLiquido;
    const indice = Math.max(0, parcelas - 1);
    if (operadoraCartao === "PagBank") {
      const fator = FATORES_CARTAO_PAGBANK[Math.min(indice, FATORES_CARTAO_PAGBANK.length - 1)];
      return arredondarCobrancaCartao(valorLiquido * fator);
    }
    const taxa = TAXAS_CARTAO_INFINITEPAY[bandeiraCartao][Math.min(indice, TAXAS_CARTAO_INFINITEPAY[bandeiraCartao].length - 1)];
    return arredondarCobrancaCartao(valorLiquido / (1 - taxa / 100));
  };
  const saldoLiquidoMatricula = totalMatricula - entradaMatricula;
  const entradaCobradaMatricula = aplicarTaxaCartao(entradaMatricula, 1);
  const saldoCobradoMatricula = aplicarTaxaCartao(saldoLiquidoMatricula, parcelasMatricula);
  const totalCobradoMatricula = entradaCobradaMatricula + saldoCobradoMatricula;
  const taxaCartaoMatricula = Math.max(0, totalCobradoMatricula - totalMatricula);
  const valorParcela = saldoCobradoMatricula / parcelasMatricula;
  const planoMatricula = [
    ...(entradaMatricula > 0
      ? [
          {
            descricao: "Entrada",
            data: novaMatricula.primeiroVencimento,
            forma: novaMatricula.formaPagamento,
            valor: entradaCobradaMatricula,
            parcelas_cartao: 1,
            valor_liquido: entradaMatricula,
            operadora_cartao: pagamentoCartao ? operadoraCartao : "",
            bandeira_cartao: pagamentoCartao ? bandeiraCartao : "",
          },
        ]
      : []),
    ...Array.from({ length: parcelasMatricula }, (_, i) => {
      const d = new Date(`${novaMatricula.primeiroVencimento}T12:00:00`);
      d.setMonth(d.getMonth() + i + (entradaMatricula > 0 ? 1 : 0));
      return {
        descricao: `Parcela ${i + 1}`,
        data: d.toISOString().slice(0, 10),
        forma: novaMatricula.formaPagamento,
        valor: Number(valorParcela.toFixed(2)),
        parcelas_cartao: pagamentoCartao ? parcelasMatricula : 1,
        valor_liquido: Number((saldoLiquidoMatricula / parcelasMatricula).toFixed(2)),
        operadora_cartao: pagamentoCartao ? operadoraCartao : "",
        bandeira_cartao: pagamentoCartao ? bandeiraCartao : "",
      };
    }),
  ];

  async function executar(acao: () => Promise<unknown>, limpar: () => void) {
    setSalvando(true);
    setErro("");
    try {
      await acao();
      limpar();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }
  async function confirmarMatricula() {
    const alunoSelecionado = alunos.find((a) => a.id === novaMatricula.alunoId);
    setSalvando(true);
    setErro("");
    try {
      const matricula = await criarMatriculaTreinamentoApi({
        aluno_id: novaMatricula.alunoId,
        turma_id: novaMatricula.turmaId,
        valor_curso: valorCurso,
        desconto_percentual: numeroEducacao(novaMatricula.descontoPercentual),
        desconto_valor: numeroEducacao(novaMatricula.descontoValor),
        entrada: entradaCobradaMatricula,
        parcelas: parcelasMatricula,
        forma_pagamento: novaMatricula.formaPagamento,
        plano_pagamento: planoMatricula,
      });
      setMatriculaConcluida({ id: matricula.id, alunoNome: matricula.alunoNome || alunoSelecionado?.nome || "ALUNO" });
      setNovaMatricula({
        alunoId: 0,
        turmaId: 0,
        valor: "0",
        descontoPercentual: "0",
        descontoValor: "0",
        entrada: "0",
        parcelas: "1",
        formaPagamento: "PIX",
        primeiroVencimento: new Date().toISOString().slice(0, 10),
      });
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível confirmar a matrícula.");
    } finally {
      setSalvando(false);
    }
  }
  async function buscarCepAluno() {
    const cep = aluno.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (!d.erro)
        setAluno((a) => ({
          ...a,
          cep,
          endereco: d.logradouro || a.endereco,
          bairro: d.bairro || a.bairro,
          cidade: d.localidade || a.cidade,
          estado: d.uf || a.estado,
          complemento: d.complemento || a.complemento,
        }));
    } catch {
      setErro(
        "Não foi possível consultar o CEP. Preencha o endereço manualmente.",
      );
    }
  }
  async function carregarDocumentosAluno(id: number) {
    try {
      setDocumentosAluno(
        await buscarRecursoEducacaoApi<
          { id: number; nome: string; data: string; arquivo: string }[]
        >(`alunos/${id}/documentos`),
      );
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar os documentos.",
      );
    }
  }
  async function retirarAluno(matricula:MatriculaTreinamentoApi){
    const senha=window.prompt(`Digite a senha de administrador para retirar ${matricula.alunoNome}:`);if(!senha)return;
    const reembolso=window.confirm("Haverá reembolso para este aluno?");let valor_reembolso=0;let data_reembolso="";
    if(reembolso){const valor=window.prompt("Qual é o valor do reembolso?");if(valor===null)return;valor_reembolso=numeroEducacao(valor);data_reembolso=window.prompt("Data do pagamento do reembolso (AAAA-MM-DD):",new Date().toISOString().slice(0,10))||"";if(!valor_reembolso||!data_reembolso){setErro("Informe o valor e a data do reembolso.");return}}
    await executar(()=>cancelarMatriculaTreinamentoApi(matricula.id,{senha_admin:senha,reembolso,valor_reembolso,data_reembolso}),()=>{});
  }
  function imprimirRelatorioTurma(){
    const turmaAtual=turmas.find(t=>t.id===turmaConsulta);if(!turmaAtual)return;const lista=matriculas.filter(m=>m.turmaId===turmaConsulta&&m.status!=="Cancelado");const esc=(v:any)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));const linhas=lista.map(m=>`<tr><td>${esc(m.alunoNome)}</td><td>${esc(m.status)}</td><td>${(m.pacientesIndicadosFechados||[]).length?(m.pacientesIndicadosFechados||[]).map(p=>`${esc(p.prontuario)} — ${esc(p.nome)}`).join("<br>"):"Nenhum contrato fechado"}</td></tr>`).join("");const janela=window.open("","_blank","width=1000,height=760");if(!janela)return;janela.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório da turma</title><style>body{font-family:Arial;padding:32px;color:#2d2925}h1{margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #ddd;padding:10px;text-align:left;vertical-align:top}th{background:#332d27;color:white}</style></head><body><h1>${esc(turmaAtual.treinamentoNome)} — ${esc(turmaAtual.nome)}</h1><p>Relatório completo de matriculados e pacientes indicados com contrato aprovado.</p><table><thead><tr><th>Aluno</th><th>Status</th><th>Pacientes indicados que fecharam contrato</th></tr></thead><tbody>${linhas}</tbody></table><script>window.print()<\/script></body></html>`);janela.document.close();
  }

  return (
    <section className="education-page">
      <div className="education-hero">
        <div>
          <span className="page-eyebrow">EDUCAÇÃO</span>
          <h1>{secao === "Alunos" ? "Alunos" : "Treinamentos"}</h1>
        </div>
        <div className="education-metrics">
          <span>
            <b>{alunos.filter((a) => a.ativo).length}</b> alunos
          </span>
          <span>
            <b>{treinamentos.filter((t) => t.ativo).length}</b> treinamentos
          </span>
          <span>
            <b>{turmas.filter((t) => !["Turma encerrada", "Turma cancelada"].includes(t.status)).length}</b>{" "}
            turmas ativas
          </span>
        </div>
      </div>
      {secao === "Treinamentos" && (
        <div className="education-tabs">
          {(["Treinamentos", "Matrículas", "Turmas"] as Aba[]).map((item) => (
            <button
              className={aba === item ? "active" : ""}
              onClick={() => setAba(item)}
              key={item}
            >
              {item === "Treinamentos" ? (
                <BookOpen size={17} />
              ) : (
                <GraduationCap size={17} />
              )}{" "}
              {item}
            </button>
          ))}
        </div>
      )}
      {erro && <div className="education-error">{erro}</div>}

      {aba === "Alunos" && (
        <div className="education-grid education-student-grid">
          <form
            className="education-card education-form"
            onSubmit={(e) => {
              e.preventDefault();
              void executar(
                () =>
                  alunoId
                    ? atualizarAlunoApi(alunoId, aluno)
                    : criarAlunoApi(aluno),
                () => {
                  setAluno(alunoVazio);
                  setAlunoId(null);
                },
              );
            }}
          >
            <h2>{alunoId ? "Editar aluno" : "Novo aluno"}</h2>
            {alunoId && (
              <div className="education-tabs">
                <button
                  type="button"
                  className={abaAluno === "Cadastro" ? "active" : ""}
                  onClick={() => setAbaAluno("Cadastro")}
                >
                  Cadastro
                </button>
                <button
                  type="button"
                  className={abaAluno === "Documentos" ? "active" : ""}
                  onClick={() => {
                    setAbaAluno("Documentos");
                    void carregarDocumentosAluno(alunoId);
                  }}
                >
                  Documentos
                </button>
              </div>
            )}
            {abaAluno === "Cadastro" && (
              <>
                <label>
                  Nome completo
                  <input
                    required
                    value={aluno.nome}
                    onChange={(e) =>
                      setAluno({ ...aluno, nome: e.target.value })
                    }
                  />
                </label>
                <div className="education-form-row">
                  <label>
                    CPF
                    <input
                      required
                      value={aluno.cpf}
                      onChange={(e) =>
                        setAluno({ ...aluno, cpf: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Telefone
                    <input
                      required
                      value={aluno.telefone}
                      onChange={(e) =>
                        setAluno({ ...aluno, telefone: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  Sexo
                  <span className="education-choice-group">
                    {["Feminino", "Masculino", "Outro"].map((s) => (
                      <label key={s}>
                        <input
                          type="radio"
                          name="sexo-aluno"
                          required
                          checked={aluno.sexo === s}
                          onChange={() => setAluno({ ...aluno, sexo: s })}
                        />
                        {s}
                      </label>
                    ))}
                  </span>
                </label>
                <div className="education-form-row">
                  <label>
                    RG
                    <input
                      value={aluno.rg}
                      onChange={(e) =>
                        setAluno({ ...aluno, rg: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Data de nascimento
                    <input
                      type="date"
                      value={aluno.data_nascimento}
                      onChange={(e) =>
                        setAluno({ ...aluno, data_nascimento: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  E-mail
                  <input
                    type="email"
                    value={aluno.email}
                    onChange={(e) =>
                      setAluno({ ...aluno, email: e.target.value })
                    }
                  />
                </label>
                <div className="education-form-row">
                  <label>
                    CEP
                    <input
                      required
                      value={aluno.cep}
                      onBlur={() => void buscarCepAluno()}
                      onChange={(e) =>
                        setAluno({ ...aluno, cep: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Endereço
                    <input
                      required
                      value={aluno.endereco}
                      onChange={(e) =>
                        setAluno({ ...aluno, endereco: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="education-form-row">
                  <label>
                    Número
                    <input
                      required
                      value={aluno.numero}
                      onChange={(e) =>
                        setAluno({ ...aluno, numero: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Complemento
                    <input
                      value={aluno.complemento}
                      onChange={(e) =>
                        setAluno({ ...aluno, complemento: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="education-form-row">
                  <label>
                    Bairro
                    <input
                      required
                      value={aluno.bairro}
                      onChange={(e) =>
                        setAluno({ ...aluno, bairro: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Cidade
                    <input
                      required
                      value={aluno.cidade}
                      onChange={(e) =>
                        setAluno({ ...aluno, cidade: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="education-form-row">
                  <label>
                    Estado
                    <input
                      required
                      value={aluno.estado}
                      onChange={(e) =>
                        setAluno({ ...aluno, estado: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Estado civil
                    <input
                      value={aluno.estado_civil}
                      onChange={(e) =>
                        setAluno({ ...aluno, estado_civil: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="education-form-row">
                  <label>
                    CRO
                    <input
                      value={aluno.cro}
                      onChange={(e) =>
                        setAluno({ ...aluno, cro: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Como conheceu
                    <input
                      value={aluno.origem}
                      onChange={(e) =>
                        setAluno({ ...aluno, origem: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  Observações
                  <textarea
                    value={aluno.observacoes}
                    onChange={(e) =>
                      setAluno({ ...aluno, observacoes: e.target.value })
                    }
                  />
                </label>
                <label className="education-check">
                  <input
                    type="checkbox"
                    checked={aluno.ativo}
                    onChange={(e) =>
                      setAluno({ ...aluno, ativo: e.target.checked })
                    }
                  />{" "}
                  Aluno ativo
                </label>
                <div className="education-actions">
                  <button disabled={salvando} className="primary-button">
                    <Plus size={16} />{" "}
                    {alunoId ? "Salvar alterações" : "Cadastrar aluno"}
                  </button>
                  {alunoId && (
                    <button
                      type="button"
                      onClick={() => {
                        setAluno(alunoVazio);
                        setAlunoId(null);
                      }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </>
            )}
            {abaAluno === "Documentos" && (
              <div className="education-list">
                {documentosAluno.length === 0 ? (
                  <p className="education-empty">
                    Nenhum contrato gerado para este aluno.
                  </p>
                ) : (
                  documentosAluno.map((d) => (
                    <div className="education-row" key={d.id}>
                      <div>
                        <strong>{d.nome}</strong>
                        <small>
                          {d.data} · {d.arquivo}
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void baixarContratoMatriculaEducacaoApi(
                            d.id,
                            d.arquivo,
                          )
                        }
                      >
                        Baixar / imprimir
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </form>
          <div className="education-card">
            <div className="education-list-head">
              <h2>{mostrarExcluidos ? "Cadastros excluídos" : "Alunos"}</h2>
              <input
                placeholder="Buscar aluno..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {administradorPagina&&<button type="button" onClick={() => {
                const proximo = !mostrarExcluidos;
                setMostrarExcluidos(proximo);
                if (proximo) void carregarAlunosExcluidos();
              }}>
                {mostrarExcluidos ? "Voltar aos ativos" : "Cadastros excluídos"}
              </button>}
            </div>
            <div className="education-list">
              {mostrarExcluidos ? alunosExcluidos
                .filter(a => `${a.nome || ""} ${a.codigo || ""} ${a.cpf || ""}`.toLowerCase().includes(busca.toLowerCase()))
                .map(a => (
                  <div className="education-row" key={a.id}>
                    <div>
                      <strong>{a.codigo} — {a.nome}</strong>
                      <small>Excluído em {a.excluido_em || "-"} por {a.excluido_por || "-"}</small>
                      <small>Motivo: {a.excluido_motivo || "-"}</small>
                      <span className="status-pill">{a.historico?.matriculas?.length || 0} matrícula(s) · {a.historico?.financeiro?.length || 0} lançamento(s) financeiro(s) · {a.historico?.pacientesIndicados?.length || 0} paciente(s) indicado(s)</span>
                    </div>
                  </div>
                )) : alunosFiltrados.map((a) => (
                <div className="education-row" key={a.id}>
                  <div>
                    <strong>
                      {a.codigo} — {a.nome}
                    </strong>
                    <small>
                      {[a.telefone, a.email].filter(Boolean).join(" · ") ||
                        "Sem contato informado"}
                    </small>
                    <span
                      className={a.ativo ? "status-pill ok" : "status-pill"}
                    >
                      {a.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <div className="education-row-actions">
                    <button
                      title="Editar"
                      onClick={() => {
                        setAlunoId(a.id);
                        setAluno({ ...alunoVazio, ...a });
                        setAbaAluno("Cadastro");
                        setDocumentosAluno([]);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      title="Excluir"
                      onClick={() => void desativarAluno(a)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {aba === "Treinamentos" && (
        <div className="education-grid">
          <div className="education-card education-training-dashboard">
            <h2>Turmas atuais</h2>
            <div className="education-dashboard-grid">
              {turmas.filter((t) => ["Turma confirmada", "Turma em andamento"].includes(t.status)).length === 0 ? (
                <p className="education-empty">Nenhuma turma confirmada ou em andamento.</p>
              ) : turmas
                .filter((t) => ["Turma confirmada", "Turma em andamento"].includes(t.status))
                .map((t) => (
                  <button
                    type="button"
                    className="education-metric-card education-class-card"
                    key={t.id}
                    onClick={() => {
                      setTurmaConsulta(t.id);
                      setFiltroTurma("");
                      setAba("Turmas");
                    }}
                  >
                    <small>{t.status}</small>
                    <strong>{t.treinamentoNome} — {t.nome}</strong>
                    <span>{t.matriculados}/{t.vagas || "∞"} matriculados</span>
                    <b>{t.vagas ? `${Math.max(0, t.vagas - t.matriculados)} vaga(s) disponível(is)` : "Sem limite de vagas"}</b>
                    <span className="education-class-card-action">Ver matriculados →</span>
                  </button>
                ))}
            </div>
          </div>
          <form
            className="education-card education-form"
            onSubmit={(e) => {
              e.preventDefault();
              void executar(
                () =>
                  treinamentoId
                    ? atualizarTreinamentoApi(treinamentoId, treinamento)
                    : criarTreinamentoApi(treinamento),
                () => {
                  setTreinamento(treinamentoVazio);
                  setTreinamentoId(null);
                },
              );
            }}
          >
            <h2>{treinamentoId ? "Editar treinamento" : "Novo treinamento"}</h2>
            <label>
              Nome
              <input
                required
                value={treinamento.nome}
                onChange={(e) =>
                  setTreinamento({ ...treinamento, nome: e.target.value })
                }
              />
            </label>
            <label>
              Categoria
              <input
                placeholder="Ex.: Imersão, curso, mentoria"
                value={treinamento.categoria}
                onChange={(e) =>
                  setTreinamento({ ...treinamento, categoria: e.target.value })
                }
              />
            </label>
            <div className="education-form-row">
              <label>
                Carga horária
                <input
                  type="number"
                  min="0"
                  value={treinamento.carga_horaria}
                  onChange={(e) =>
                    setTreinamento({
                      ...treinamento,
                      carga_horaria: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Valor
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={treinamento.valor}
                  onChange={(e) =>
                    setTreinamento({
                      ...treinamento,
                      valor: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div className="education-form-row">
              <label>Quantidade de turmas<input type="number" min="1" required value={treinamento.quantidade_turmas} onChange={e=>setTreinamento({...treinamento,quantidade_turmas:Number(e.target.value)})}/></label>
              <label>Máximo de alunos por turma<input type="number" min="1" required value={treinamento.max_alunos_por_turma} onChange={e=>setTreinamento({...treinamento,max_alunos_por_turma:Number(e.target.value)})}/></label>
            </div>
            <div className="education-form-row">
              <label>Data inicial<input type="date" required value={treinamento.data_inicio} onChange={e=>setTreinamento({...treinamento,data_inicio:e.target.value})}/></label>
              <label>Horário inicial<input type="time" required value={treinamento.horario_inicio} onChange={e=>setTreinamento({...treinamento,horario_inicio:e.target.value})}/></label>
            </div>
            <label>Periodicidade<select value={treinamento.periodicidade} onChange={e=>setTreinamento({...treinamento,periodicidade:e.target.value})}><option>Semanal</option><option>Quinzenal</option><option>Mensal</option></select></label>
            <fieldset className="education-schedule"><legend>Dias e horários das aulas</legend>{["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"].map(dia=>{const selecionado=Boolean(treinamento.dias_horarios[dia]);const horario=treinamento.dias_horarios[dia]||{inicio:"",fim:""};return <div className="education-schedule-row" key={dia}><label className="education-check"><input type="checkbox" checked={selecionado} onChange={e=>{const dias={...treinamento.dias_horarios};if(e.target.checked)dias[dia]={inicio:treinamento.horario_inicio||"09:00",fim:"18:00"};else delete dias[dia];setTreinamento({...treinamento,dias_horarios:dias})}}/>{dia}</label>{selecionado&&<><label>Início<input type="time" required value={horario.inicio} onChange={e=>setTreinamento({...treinamento,dias_horarios:{...treinamento.dias_horarios,[dia]:{...horario,inicio:e.target.value}}})}/></label><label>Fim<input type="time" required value={horario.fim} onChange={e=>setTreinamento({...treinamento,dias_horarios:{...treinamento.dias_horarios,[dia]:{...horario,fim:e.target.value}}})}/></label></>}</div>})}</fieldset>
            <label>
              Descrição
              <textarea
                value={treinamento.descricao}
                onChange={(e) =>
                  setTreinamento({ ...treinamento, descricao: e.target.value })
                }
              />
            </label>
            <label className="education-check">
              <input
                type="checkbox"
                checked={treinamento.ativo}
                onChange={(e) =>
                  setTreinamento({ ...treinamento, ativo: e.target.checked })
                }
              />{" "}
              Disponível para novas turmas
            </label>
            <div className="education-actions">
              <button className="primary-button" disabled={salvando}>
                {treinamentoId ? "Salvar alterações" : "Cadastrar treinamento"}
              </button>
              {treinamentoId && (
                <button
                  type="button"
                  onClick={() => {
                    setTreinamento(treinamentoVazio);
                    setTreinamentoId(null);
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
          <div className="education-card">
            <h2>Catálogo</h2>
            <div className="education-list">
              {treinamentos.map((t) => (
                <div className="education-row" key={t.id}>
                  <div>
                    <strong>{t.nome}</strong>
                    <small>
                      {t.categoria || "Sem categoria"} · {t.cargaHoraria}h ·{" "}
                      {brl(t.valor)}
                    </small>
                    <span
                      className={t.ativo ? "status-pill ok" : "status-pill"}
                    >
                      {t.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <div className="education-row-actions">
                    <button
                      onClick={() => {
                        setTreinamentoId(t.id);
                        setTreinamento({
                          nome: t.nome,
                          categoria: t.categoria,
                          descricao: t.descricao,
                          carga_horaria: t.cargaHoraria,
                          valor: t.valor,
                          ativo: t.ativo,
                          quantidade_turmas:t.quantidadeTurmas,
                          max_alunos_por_turma:t.maxAlunosPorTurma,
                          data_inicio:t.dataInicio,
                          horario_inicio:t.horarioInicio,
                          periodicidade:t.periodicidade,
                          dias_horarios:t.diasHorarios||{},
                        });
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() =>
                        confirm(`Excluir ${t.nome}?`) &&
                        void executar(
                          () => excluirTreinamentoApi(t.id),
                          () => {},
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {aba === "Matrículas" && (
        <div className="education-grid education-matricula-grid">
          <form
            className="education-card education-form"
            onSubmit={(e) => {
              e.preventDefault();
              void executar(
                () =>
                  turmaId
                    ? atualizarTurmaTreinamentoApi(turmaId, turma)
                    : criarTurmaTreinamentoApi(turma),
                () => {
                  setTurma(turmaVazia);
                  setTurmaId(null);
                },
              );
            }}
          >
            <h2>{turmaId ? "Editar turma" : "Nova turma"}</h2>
            <label>
              Treinamento
              <select
                required
                value={turma.treinamento_id}
                onChange={(e) =>
                  setTurma({ ...turma, treinamento_id: Number(e.target.value) })
                }
              >
                <option value={0}>Selecione...</option>
                {treinamentos
                  .filter((t) => t.ativo || t.id === turma.treinamento_id)
                  .map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.nome}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Nome da turma
              <input
                required
                placeholder="Ex.: Turma Outubro 2026"
                value={turma.nome}
                onChange={(e) => setTurma({ ...turma, nome: e.target.value })}
              />
            </label>
            <label>
              Instrutor
              <input
                value={turma.instrutor}
                onChange={(e) =>
                  setTurma({ ...turma, instrutor: e.target.value })
                }
              />
            </label>
            <div className="education-form-row">
              <label>
                Início
                <input
                  type="date"
                  value={turma.data_inicio}
                  onChange={(e) =>
                    setTurma({ ...turma, data_inicio: e.target.value })
                  }
                />
              </label>
              <label>
                Fim
                <input
                  type="date"
                  value={turma.data_fim}
                  onChange={(e) =>
                    setTurma({ ...turma, data_fim: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="education-form-row">
              <label>
                Horário
                <input
                  value={turma.horario}
                  onChange={(e) =>
                    setTurma({ ...turma, horario: e.target.value })
                  }
                />
              </label>
              <label>
                Vagas
                <input
                  type="number"
                  min="0"
                  value={turma.vagas}
                  onChange={(e) =>
                    setTurma({ ...turma, vagas: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <label>
              Local
              <input
                value={turma.local}
                onChange={(e) => setTurma({ ...turma, local: e.target.value })}
              />
            </label>
            <label>
              Status
              <select
                value={turma.status}
                onChange={(e) => setTurma({ ...turma, status: e.target.value })}
              >
                {[
                  "Turma confirmada",
                  "Turma em andamento",
                  "Turma encerrada",
                  "Turma cancelada",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <div className="education-actions">
              <button className="primary-button" disabled={salvando}>
                {turmaId ? "Salvar alterações" : "Cadastrar turma"}
              </button>
              {turmaId && (
                <button
                  type="button"
                  onClick={() => {
                    setTurma(turmaVazia);
                    setTurmaId(null);
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
          <div className="education-card">
            <h2>Matrícula e pagamento</h2>
            <div className="education-form">
              <label>
                Aluno
                <select
                  value={novaMatricula.alunoId}
                  onChange={(e) =>
                    setNovaMatricula({
                      ...novaMatricula,
                      alunoId: Number(e.target.value),
                    })
                  }
                >
                  <option value={0}>Selecione o aluno</option>
                  {alunos
                    .filter((a) => a.ativo)
                    .map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.codigo} — {a.nome}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Turma
                <select
                  value={novaMatricula.turmaId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const selecionada = turmas.find((t) => t.id === id);
                    setNovaMatricula({
                      ...novaMatricula,
                      turmaId: id,
                      valor: String(selecionada?.treinamentoValor || 0),
                    });
                  }}
                >
                  <option value={0}>Selecione a turma</option>
                  {turmas
                    .filter(
                      (t) =>
                        t.status !== "Turma encerrada" && t.status !== "Turma cancelada",
                    )
                    .map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.treinamentoNome} — {t.nome} —{" "}
                        {brl(t.treinamentoValor)}
                      </option>
                    ))}
                </select>
              </label>
              <div className="education-form-row">
                <label>
                  Valor do curso
                  <input
                    value={novaMatricula.valor}
                    onChange={(e) =>
                      setNovaMatricula({
                        ...novaMatricula,
                        valor: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Entrada
                  <input
                    value={novaMatricula.entrada}
                    onChange={(e) =>
                      setNovaMatricula({
                        ...novaMatricula,
                        entrada: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="education-form-row">
                <label>
                  Desconto %
                  <input
                    value={novaMatricula.descontoPercentual}
                    onChange={(e) =>
                      setNovaMatricula({
                        ...novaMatricula,
                        descontoPercentual: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Desconto R$
                  <input
                    value={novaMatricula.descontoValor}
                    onChange={(e) =>
                      setNovaMatricula({
                        ...novaMatricula,
                        descontoValor: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="education-form-row">
                <label>
                  Parcelas
                  <input
                    type="number"
                    min="1"
                    max={pagamentoCartao && operadoraCartao === "InfinitePay" ? 12 : 18}
                    value={novaMatricula.parcelas}
                    onChange={(e) =>
                      setNovaMatricula({
                        ...novaMatricula,
                        parcelas: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Forma de pagamento
                  <select
                    value={novaMatricula.formaPagamento}
                    onChange={(e) =>
                      setNovaMatricula({
                        ...novaMatricula,
                        formaPagamento: e.target.value,
                      })
                    }
                  >
                    {[
                      "PIX",
                      "BOLETO",
                      "CARTAO_CREDITO",
                      "CARTAO_DEBITO",
                      "DINHEIRO",
                    ].map((f) => (
                      <option key={f} value={f}>
                        {f.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {pagamentoCartao && (
                <div className="education-card-fee-box">
                  <div className="education-form-row">
                    <label>
                      Maquininha
                      <select
                        value={operadoraCartao}
                        onChange={(e) => {
                          const operadora = e.target.value as OperadoraCartaoEducacao;
                          setOperadoraCartao(operadora);
                          if (operadora === "InfinitePay" && parcelasMatricula > 12) {
                            setNovaMatricula({ ...novaMatricula, parcelas: "12" });
                          }
                        }}
                      >
                        <option>InfinitePay</option>
                        <option>PagBank</option>
                      </select>
                    </label>
                    {operadoraCartao === "InfinitePay" && (
                      <label>
                        Bandeira do cartão
                        <select value={bandeiraCartao} onChange={(e) => setBandeiraCartao(e.target.value as BandeiraCartaoEducacao)}>
                          {Object.keys(TAXAS_CARTAO_INFINITEPAY).map((bandeira) => <option key={bandeira}>{bandeira}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                  <small>A taxa é calculada pela mesma tabela usada no sistema da clínica e repassada ao valor cobrado.</small>
                </div>
              )}
              <label>
                Primeiro vencimento
                <input
                  type="date"
                  value={novaMatricula.primeiroVencimento}
                  onChange={(e) =>
                    setNovaMatricula({
                      ...novaMatricula,
                      primeiroVencimento: e.target.value,
                    })
                  }
                />
              </label>
              <div className="education-payment-summary">
                <span>
                  Valor líquido do curso <b>{brl(totalMatricula)}</b>
                </span>
                <span>
                  {pagamentoCartao ? "Taxa do cartão" : "Saldo"} <b>{brl(pagamentoCartao ? taxaCartaoMatricula : saldoLiquidoMatricula)}</b>
                </span>
                <span>
                  {pagamentoCartao ? "Total a cobrar" : `${parcelasMatricula} parcela(s) de`} <b>{brl(pagamentoCartao ? totalCobradoMatricula : valorParcela)}</b>
                </span>
              </div>
              {pagamentoCartao && <div className="education-card-installment-summary"><span>Entrada cobrada: <b>{brl(entradaCobradaMatricula)}</b></span><span>Saldo em {parcelasMatricula}x de <b>{brl(valorParcela)}</b></span></div>}
              <div className="education-list">
                {planoMatricula.map((p, i) => (
                  <div className="education-enrolled" key={i}>
                    <span>
                      {p.descricao} · {p.data} · {p.forma.replaceAll("_", " ")}
                    </span>
                    <b>{brl(p.valor)}</b>
                  </div>
                ))}
              </div>
              <button
                className="primary-button"
                disabled={
                  !novaMatricula.alunoId || !novaMatricula.turmaId || salvando
                }
                onClick={() => void confirmarMatricula()}
              >
                Confirmar matrícula
              </button>
            </div>
          </div>
        </div>
      )}
      {aba === "Turmas" && (
        <div className="education-card education-classes-panel">
          <div className="education-classes-heading">
            <div><span className="page-eyebrow">GESTÃO DE TURMAS</span><h2>Turmas e matriculados</h2></div>
            <input className="education-class-search" placeholder="Buscar por curso, turma ou instrutor" value={filtroTurma} onChange={e=>setFiltroTurma(e.target.value)}/>
          </div>
          <label className="education-class-select-label">
            <span>Turma selecionada</span>
            <select className="education-class-select" value={turmaConsulta} onChange={e=>setTurmaConsulta(Number(e.target.value))}>
              <option value={0}>Escolha uma turma para visualizar</option>
              {turmas.filter(t=>`${t.treinamentoNome} ${t.nome} ${t.instrutor}`.toLowerCase().includes(filtroTurma.toLowerCase())).map(t=><option key={t.id} value={t.id}>{t.treinamentoNome} — {t.nome} · {t.matriculados}/{t.vagas || "∞"} alunos</option>)}
            </select>
          </label>
          {turmaConsulta > 0 && (
            <div className="education-selected-class-summary">
              <div>
                <strong>{turmas.find(t => t.id === turmaConsulta)?.treinamentoNome} — {turmas.find(t => t.id === turmaConsulta)?.nome}</strong>
                <small>{turmas.find(t => t.id === turmaConsulta)?.matriculados}/{turmas.find(t => t.id === turmaConsulta)?.vagas || "∞"} alunos matriculados</small>
              </div>
              <button type="button" onClick={imprimirRelatorioTurma}>Relatório completo</button>
            <label>Status da turma
              <select
                value={turmas.find(t => t.id === turmaConsulta)?.status || ""}
                disabled={salvando}
                onChange={e => void executar(() => alterarStatusTurmaEducacaoApi(turmaConsulta, e.target.value), () => {})}
              >
                {["Turma confirmada", "Turma em andamento", "Turma encerrada", "Turma cancelada"].map(status => <option key={status}>{status}</option>)}
              </select>
            </label>
            </div>
          )}
          {turmaConsulta>0&&<div className="education-list education-class-students"><div className="education-attendance-head"><h3>Alunos matriculados</h3><span>P</span></div>{matriculas.filter(m=>m.turmaId===turmaConsulta&&m.status!=="Cancelado").length===0?<p className="education-empty">Nenhum aluno matriculado nesta turma.</p>:matriculas.filter(m=>m.turmaId===turmaConsulta&&m.status!=="Cancelado").map(m=><div className="education-row education-attendance-row" key={m.id}><div><strong>{m.alunoNome}</strong><small>{brl(m.valorCurso)} · {m.parcelas} parcela(s) · {m.formaPagamento.replaceAll("_"," ")}</small></div><div className="education-row-actions"><button onClick={()=>void baixarContratoMatriculaEducacaoApi(m.id,`CONTRATO_${m.alunoNome}.docx`)}>Contrato</button><button onClick={()=>void retirarAluno(m)}>Retirar aluno</button></div><span className={`education-patient-referral-mark${m.pacienteIndicadoFechou?" checked":""}`} title={m.pacienteIndicadoFechou?"Paciente indicado com contrato aprovado":"Nenhum paciente indicado com contrato aprovado"}>P {m.pacienteIndicadoFechou?"✓":""}</span></div>)}</div>}
          {turmaConsulta === 0 && <p className="education-empty">Selecione uma turma acima para visualizar os matriculados.</p>}
        </div>
      )}
      {matriculaConcluida && (
        <div className="education-modal-backdrop" role="presentation" onMouseDown={() => setMatriculaConcluida(null)}>
          <div className="education-success-modal" role="dialog" aria-modal="true" aria-labelledby="matricula-concluida-titulo" onMouseDown={(e) => e.stopPropagation()}>
            <div className="education-success-icon">✓</div>
            <span className="page-eyebrow">MATRÍCULA CONCLUÍDA</span>
            <h2 id="matricula-concluida-titulo">Aluno matriculado com sucesso</h2>
            <p>A matrícula de <strong>{matriculaConcluida.alunoNome}</strong> foi salva. Você já pode gerar, baixar e imprimir o contrato.</p>
            <div className="education-success-actions">
              <button type="button" onClick={() => setMatriculaConcluida(null)}>Fechar</button>
              <button className="primary-button" type="button" onClick={() => void baixarContratoMatriculaEducacaoApi(matriculaConcluida.id, `CONTRATO_${matriculaConcluida.alunoNome}.docx`)}>
                Baixar contrato
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
