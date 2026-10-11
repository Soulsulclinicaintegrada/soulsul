import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  ChevronDown,
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
  type AlunoApi,
  type MatriculaTreinamentoApi,
  type TreinamentoApi,
  type TurmaTreinamentoApi,
} from "./pacientesApi";

function DentalHandpieceIcon({ size = 20, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 19 7.8-7.8" />
      <path d="m8 21-5-5 2.1-2.1 5 5z" />
      <path d="m11.4 12.6 3-3 2.2 2.2-3 3" />
      <path d="m14.4 9.6 2.5-4.2 3.7-1.2-.9 3.8-3.1 3.8" />
      <path d="m18.6 4.9 1.8 1.8" />
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
    "Alunos",
    "Treinamentos",
    "Pacientes",
    "Orçamentos",
    "CRM",
    "Guias",
    "Agenda",
    "Financeiro",
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
    Pacientes: DentalHandpieceIcon,
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
        <p>
          Alunos, treinamentos e gestão financeira educacional em um ambiente
          separado da clínica.
        </p>
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
  const [abaFinanceiro, setAbaFinanceiro] = useState<"Financeiro" | "Tabela de preços">("Financeiro");
  return (
    <div className="education-finance-shell">
      <nav className="education-tabs education-finance-tabs" aria-label="Seções do financeiro">
        <button className={abaFinanceiro === "Financeiro" ? "active" : ""} onClick={() => setAbaFinanceiro("Financeiro")}>Movimentações financeiras</button>
        <button className={abaFinanceiro === "Tabela de preços" ? "active" : ""} onClick={() => setAbaFinanceiro("Tabela de preços")}>Tabela de preços</button>
      </nav>
      <EducacaoModulo modulo={abaFinanceiro} />
    </div>
  );
}

const MODULOS_ACESSO_EDUCACAO = Object.keys(SUBFUNCOES_ACESSO_EDUCACAO);

function EducacaoUsuarios() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ nome:"", usuario:"", senha:"", perfil:"USUARIO", ativo:true, permissoes:permissoesPadraoEducacao() });
  const [editando, setEditando] = useState<number|null>(null);
  const [erro, setErro] = useState("");
  const carregar = () => buscarRecursoEducacaoApi<any[]>("usuarios").then(setUsuarios).catch(e=>setErro(e instanceof Error?e.message:"Falha ao carregar usuários."));
  useEffect(()=>{void carregar()},[]);
  async function salvar(e:FormEvent){e.preventDefault();setErro("");try{const permissoes={...form.permissoes};Object.entries(SUBFUNCOES_ACESSO_EDUCACAO).forEach(([m,subs])=>permissoes[m]=subs.some(s=>(permissoes[`${m}.${s}`]??"edit")!=="none"));const payload={...form,permissoes};if(editando)await atualizarRecursoEducacaoApi("usuarios",editando,payload);else await criarRecursoEducacaoApi("usuarios",payload);setEditando(null);setForm({nome:"",usuario:"",senha:"",perfil:"USUARIO",ativo:true,permissoes:permissoesPadraoEducacao()});await carregar()}catch(ex){setErro(ex instanceof Error?ex.message:"Não foi possível salvar.")}}
  return <section className="education-page">
    <div className="education-hero"><div><span className="page-eyebrow">SEGURANÇA E ACESSOS</span><h1>Usuários</h1><p>Defina o nível e os módulos que cada pessoa pode acessar.</p></div></div>
    {erro&&<div className="education-error">{erro}</div>}
    <div className="education-users-layout">
      <form className="education-card education-form" onSubmit={salvar}>
        <h2>{editando?"Editar acessos":"Novo usuário"}</h2>
        <label>Nome<input required value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></label>
        {!editando&&<><label>Usuário<input required value={form.usuario} onChange={e=>setForm({...form,usuario:e.target.value})}/></label><label>Senha temporária<input required minLength={6} type="password" value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})}/></label></>}
        <label>Nível<select value={form.perfil} onChange={e=>setForm({...form,perfil:e.target.value})}><option value="USUARIO">Usuário</option><option value="ADMINISTRADOR">Administrador</option></select></label>
        <fieldset className="education-permission-matrix" disabled={form.perfil==="ADMINISTRADOR"}><legend>Permissões por módulo e função</legend>{Object.entries(SUBFUNCOES_ACESSO_EDUCACAO).map(([modulo,subs])=><section className="education-permission-module" key={modulo}><h3>{modulo}</h3>{subs.map(sub=>{const chave=`${modulo}.${sub}`;const nivel=form.permissoes?.[chave]??(form.permissoes?.[modulo]===false?"none":"edit");return <label key={chave}><span>{sub}</span><select value={form.perfil==="ADMINISTRADOR"?"edit":nivel} onChange={e=>setForm({...form,permissoes:{...form.permissoes,[chave]:e.target.value}})}><option value="none">Sem acesso</option><option value="view">Somente visualizar</option><option value="edit">Visualizar e editar</option></select></label>})}</section>)}</fieldset>
        <label className="education-check"><input type="checkbox" checked={form.ativo} onChange={e=>setForm({...form,ativo:e.target.checked})}/>Usuário ativo</label>
        <div className="education-actions"><button className="primary-button">Salvar usuário</button>{editando&&<button type="button" onClick={()=>setEditando(null)}>Cancelar</button>}</div>
      </form>
      <div className="education-card"><h2>Usuários cadastrados</h2><div className="education-list">{usuarios.map(u=><div className="education-row" key={u.id}><div><strong>{u.nome}</strong><small>{u.usuario} · {u.perfil}</small><span className={u.ativo?"status-pill ok":"status-pill"}>{u.ativo?"Ativo":"Inativo"}</span></div><div className="education-row-actions"><button onClick={()=>{setEditando(u.id);setForm({nome:u.nome,usuario:u.usuario,senha:"",perfil:u.perfil||"USUARIO",ativo:u.ativo,permissoes:u.permissoes||{}})}}><Pencil size={16}/> Permissões</button><button type="button" onClick={async()=>{if(!window.confirm(`Resetar a senha de ${u.nome} para soulsuledu?`))return;try{await resetarSenhaUsuarioEducacaoApi(u.id);window.alert("Senha resetada. No próximo acesso, o usuário deverá entrar com soulsuledu e criar uma nova senha.")}catch(ex){setErro(ex instanceof Error?ex.message:"Não foi possível resetar a senha.")}}}>Resetar senha</button></div></div>)}</div></div>
    </div>
  </section>
}

function EducacaoModulo({ modulo,pacienteInicialId=null,pacienteAbaInicial="Cadastro",onPacienteAberto,onEditarOrcamento }: { modulo: string; pacienteInicialId?:number|null; pacienteAbaInicial?:AbaFichaPaciente; onPacienteAberto?:(id:number|null)=>void; onEditarOrcamento?:(id:number)=>void }) {
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
      { rotulo: "Pacientes-modelo", valor: d.pacientesModelo, detalhe: "em acompanhamento", Icone: DentalHandpieceIcon },
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
          <span className="page-eyebrow">SOULSUL EDUCAÇÃO</span>
          <h1>{modulo}</h1>
          <p>Dados independentes da operação clínica.</p>
        </div>
        <div className="education-row-actions">
          {modulo === "Pacientes" && (
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
    {aba==="Documentos"&&<div className="education-card"><h2>Documentos</h2><div className="education-list">{ficha.documentos?.map((d:any)=><div className="education-row" key={d.id}><div><strong>{d.nome}</strong><small>{d.data||"Sem data"}</small></div><button onClick={()=>void baixarContratoEducacaoApi(d.contrato_id,d.nome)}>Baixar</button></div>)}{!ficha.documentos?.length&&<p className="education-empty">Nenhum documento gerado.</p>}</div></div>}
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
type ParcelaOrcamentoEducacao = { descricao:string; data:string; forma:string; valor:number; parcelas_cartao:number; operadora_cartao:string; bandeira_cartao:string };

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
  const cobrarComTaxa=(valor:number,parcelas:number)=>{if(!cartaoOrcamento||valor<=0)return valor;const indice=Math.max(0,parcelas-1);if(operadoraCartao==="PagBank")return arredondarCobrancaCartao(valor*FATORES_CARTAO_PAGBANK[Math.min(indice,17)]);const taxa=TAXAS_CARTAO_INFINITEPAY[bandeiraCartao][Math.min(indice,11)];return arredondarCobrancaCartao(valor/(1-taxa/100))};
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
    const linhas:ParcelaOrcamentoEducacao[]=[];
    const valorEntrada=comEntrada?(entradaOrcamento>0?entradaOrcamento:0):0;const saldo=total-valorEntrada;
    if(comEntrada)linhas.push({descricao:"Entrada",data:form.data,forma:form.forma_pagamento||"PIX",valor:valorEntrada,parcelas_cartao:1,operadora_cartao:operadoraCartao,bandeira_cartao:bandeiraCartao});
    const base=new Date(`${form.data}T12:00:00`);
    for(let i=0;i<quantidade;i++){const data=new Date(base);data.setMonth(data.getMonth()+i+(comEntrada?1:0));linhas.push({descricao:`Parcela ${i+1}`,data:data.toISOString().slice(0,10),forma:form.forma_pagamento||"PIX",valor:saldo/quantidade,parcelas_cartao:quantidade,operadora_cartao:operadoraCartao,bandeira_cartao:bandeiraCartao})}
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
          <p>
            Mesmo fluxo contratual da clínica, com dados financeiros exclusivos
            da Educação.
          </p>
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
  return <section className="education-page"><div className="education-hero"><div><span className="page-eyebrow">RELACIONAMENTO</span><h1>CRM de pacientes-modelo</h1><p>Acompanhe aqui o histórico de orçamentos e contratos.</p></div></div>{erro&&<div className="education-error">{erro}</div>}<div className="education-card"><div className="education-list-head"><h2>Histórico de orçamentos</h2><input placeholder="Buscar paciente ou prontuário" value={busca} onChange={e=>setBusca(e.target.value)}/></div><div className="education-list">{lista.map(o=><div className="education-row" key={o.id}><div><strong>{o.prontuario} — {o.paciente_nome}</strong><small>{o.data_contrato||"Sem data"} · {Number(o.valor_total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</small><span className={o.status==="APROVADO"?"status-pill ok":"status-pill"}>{o.status==="APROVADO"?"Aprovado":"Em aberto"}</span></div><div className="education-row-actions">{administrador&&<button onClick={()=>void alterar(o)}>{o.status==="APROVADO"?"Reabrir":"Aprovar"}</button>}{o.status==="APROVADO"&&<button onClick={()=>void baixarContratoEducacaoApi(o.id,`CONTRATO_${o.prontuario}.docx`)}>Contrato</button>}</div></div>)}{lista.length===0&&<p className="education-empty">Nenhum orçamento encontrado.</p>}</div></div></section>
}

export function EducacaoPage({
  secao = "Alunos",
}: {
  secao?: "Alunos" | "Treinamentos";
}) {
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

  return (
    <section className="education-page">
      <div className="education-hero">
        <div>
          <span className="page-eyebrow">EDUCAÇÃO</span>
          <h1>{secao === "Alunos" ? "Alunos" : "Treinamentos"}</h1>
          <p>
            {secao === "Alunos"
              ? "Cadastre e gerencie os alunos da Educação."
              : "Organize cursos, turmas e matrículas em um só lugar."}
          </p>
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
              <button type="button" onClick={() => {
                const proximo = !mostrarExcluidos;
                setMostrarExcluidos(proximo);
                if (proximo) void carregarAlunosExcluidos();
              }}>
                {mostrarExcluidos ? "Voltar aos ativos" : "Cadastros excluídos"}
              </button>
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
          {turmaConsulta>0&&<div className="education-list education-class-students"><h3>Alunos matriculados</h3>{matriculas.filter(m=>m.turmaId===turmaConsulta&&m.status!=="Cancelado").length===0?<p className="education-empty">Nenhum aluno matriculado nesta turma.</p>:matriculas.filter(m=>m.turmaId===turmaConsulta&&m.status!=="Cancelado").map(m=><div className="education-row" key={m.id}><div><strong>{m.alunoNome}</strong><small>{brl(m.valorCurso)} · {m.parcelas} parcela(s) · {m.formaPagamento.replaceAll("_"," ")}</small></div><div className="education-row-actions"><button onClick={()=>void baixarContratoMatriculaEducacaoApi(m.id,`CONTRATO_${m.alunoNome}.docx`)}>Contrato</button><button onClick={()=>void retirarAluno(m)}>Retirar aluno</button></div></div>)}</div>}
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
