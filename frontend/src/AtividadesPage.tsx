import { CalendarDays, Check, ChevronLeft, ChevronRight, Circle, Clock3, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { UsuarioSessao } from "./auth";
import {
  atualizarAtividadeApi,
  criarAtividadeApi,
  excluirAtividadeApi,
  listarAtividadesApi,
  listarResponsaveisAtividadesApi,
  type AgendaAtividadeApi,
  type AgendaAtividadePayloadApi,
  type ResponsavelAtividadeApi
} from "./pacientesApi";

type Props = { usuarioLogado: UsuarioSessao };

const STATUS = ["Pendente", "Em andamento", "Concluída", "Cancelada"];
const PRIORIDADES = ["Baixa", "Normal", "Alta", "Urgente"];

function dataIso(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function adicionarDias(valor: string, dias: number) {
  const data = new Date(`${valor}T12:00:00`);
  data.setDate(data.getDate() + dias);
  return dataIso(data);
}

function inicioSemana(valor: string) {
  const data = new Date(`${valor}T12:00:00`);
  const deslocamento = data.getDay() === 0 ? -6 : 1 - data.getDay();
  data.setDate(data.getDate() + deslocamento);
  return dataIso(data);
}

function payloadVazio(usuarioId: number, data: string): AgendaAtividadePayloadApi {
  return { titulo: "", descricao: "", responsavel_id: usuarioId, data_atividade: data, hora_inicio: "09:00", hora_fim: "10:00", prioridade: "Normal", status: "Pendente" };
}

function rotuloDia(valor: string) {
  return new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
}

export function AtividadesPage({ usuarioLogado }: Props) {
  const hoje = dataIso(new Date());
  const [referencia, setReferencia] = useState(hoje);
  const [atividades, setAtividades] = useState<AgendaAtividadeApi[]>([]);
  const [usuarios, setUsuarios] = useState<ResponsavelAtividadeApi[]>([]);
  const [responsavelFiltro, setResponsavelFiltro] = useState(0);
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState(() => payloadVazio(usuarioLogado.id, hoje));
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const identificadorUsuario = usuarioLogado.usuario || usuarioLogado.nome;
  const acessoEquipe = String(usuarioLogado.atividadesEscopo || "").toUpperCase() === "EQUIPE" || String(usuarioLogado.perfil).toLowerCase() === "administrador";
  const inicio = inicioSemana(referencia);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, indice) => adicionarDias(inicio, indice)), [inicio]);

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const [lista, equipe] = await Promise.all([
        listarAtividadesApi(dias[0], dias[6], identificadorUsuario),
        listarResponsaveisAtividadesApi(identificadorUsuario)
      ]);
      setAtividades(lista);
      setUsuarios(equipe);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar as atividades.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); }, [inicio, acessoEquipe]);

  useEffect(() => {
    if (!usuarios.length) return;
    setForm((atual) => usuarios.some((usuario) => usuario.id === atual.responsavel_id)
      ? atual
      : { ...atual, responsavel_id: usuarios[0].id });
  }, [usuarios]);

  const visiveis = useMemo(
    () => responsavelFiltro ? atividades.filter((item) => item.responsavelId === responsavelFiltro) : atividades,
    [atividades, responsavelFiltro]
  );

  function abrirNova(data = referencia) {
    setEditandoId(null);
    setForm(payloadVazio(usuarioLogado.id, data));
    setFormAberto(true);
    setErro("");
  }

  function abrirEdicao(item: AgendaAtividadeApi) {
    setEditandoId(item.id);
    setForm({ titulo: item.titulo, descricao: item.descricao || "", responsavel_id: item.responsavelId, data_atividade: item.dataAtividade, hora_inicio: item.horaInicio || "09:00", hora_fim: item.horaFim || "10:00", prioridade: item.prioridade, status: item.status });
    setFormAberto(true);
    setErro("");
  }

  async function salvar() {
    if (!form.titulo.trim()) { setErro("Informe o título da atividade."); return; }
    setSalvando(true);
    setErro("");
    try {
      const salva = editandoId ? await atualizarAtividadeApi(editandoId, form, identificadorUsuario) : await criarAtividadeApi(form, identificadorUsuario);
      setAtividades((atuais) => editandoId ? atuais.map((item) => item.id === salva.id ? salva : item) : [...atuais, salva]);
      setFormAberto(false);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a atividade.");
    } finally { setSalvando(false); }
  }

  async function mudarStatus(item: AgendaAtividadeApi, status: string) {
    const atualizada = await atualizarAtividadeApi(item.id, { titulo: item.titulo, descricao: item.descricao || "", responsavel_id: item.responsavelId, data_atividade: item.dataAtividade, hora_inicio: item.horaInicio || "", hora_fim: item.horaFim || "", prioridade: item.prioridade, status }, identificadorUsuario);
    setAtividades((atuais) => atuais.map((atual) => atual.id === item.id ? atualizada : atual));
  }

  async function remover(item: AgendaAtividadeApi) {
    if (!window.confirm(`Excluir a atividade “${item.titulo}”?`)) return;
    await excluirAtividadeApi(item.id, identificadorUsuario);
    setAtividades((atuais) => atuais.filter((atual) => atual.id !== item.id));
  }

  return <section className="activities-page">
    <header className="panel activities-hero">
      <div><span className="panel-kicker">Organização da equipe</span><h2>Agenda de atividades</h2><p>{acessoEquipe ? "Acompanhe e distribua as atividades de todos os funcionários." : "Acompanhe e atualize suas atividades."}</p></div>
      <button className="primary-action" onClick={() => abrirNova()}><Plus size={17}/> Nova atividade</button>
    </header>

    <div className="panel activities-toolbar">
      <div className="activities-nav"><button onClick={() => setReferencia(adicionarDias(referencia, -7))}><ChevronLeft size={17}/></button><button onClick={() => setReferencia(hoje)}>Hoje</button><button onClick={() => setReferencia(adicionarDias(referencia, 7))}><ChevronRight size={17}/></button><strong>{new Date(`${dias[0]}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} — {new Date(`${dias[6]}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</strong></div>
      {acessoEquipe ? <label className="activities-filter"><Users size={16}/><select value={responsavelFiltro} onChange={(event) => setResponsavelFiltro(Number(event.target.value))}><option value={0}>Toda a equipe</option>{usuarios.map((usuario) => <option value={usuario.id} key={usuario.id}>{usuario.nome}</option>)}</select></label> : null}
    </div>

    {erro && !formAberto ? <div className="crm-inline-alert">{erro}</div> : null}
    <div className="activities-week">
      {dias.map((dia) => {
        const itens = visiveis.filter((item) => item.dataAtividade === dia);
        return <section className={`activities-day${dia === hoje ? " today" : ""}`} key={dia}>
          <header><div><CalendarDays size={15}/><strong>{rotuloDia(dia)}</strong></div><button onClick={() => abrirNova(dia)} aria-label={`Adicionar atividade em ${rotuloDia(dia)}`}><Plus size={15}/></button></header>
          <div className="activities-day-list">{itens.map((item) => <article className={`activity-card priority-${item.prioridade.toLowerCase()} status-${item.status.toLowerCase().replaceAll(" ", "-")}`} key={item.id}>
            <div className="activity-card-top"><span><Clock3 size={13}/>{item.horaInicio || "Sem horário"}{item.horaFim ? `–${item.horaFim}` : ""}</span><b>{item.prioridade}</b></div>
            <strong>{item.titulo}</strong>{acessoEquipe ? <small>{item.responsavelNome}</small> : null}{item.descricao ? <p>{item.descricao}</p> : null}
            <div className="activity-card-actions"><select value={item.status} onChange={(event) => void mudarStatus(item, event.target.value)}>{STATUS.map((status) => <option key={status}>{status}</option>)}</select><button onClick={() => abrirEdicao(item)} title="Editar"><Pencil size={14}/></button><button onClick={() => void remover(item)} title="Excluir"><Trash2 size={14}/></button></div>
          </article>)}{!itens.length ? <button className="activities-empty" onClick={() => abrirNova(dia)}>+ Adicionar atividade</button> : null}</div>
        </section>;
      })}
    </div>
    {carregando ? <div className="activities-loading">Carregando atividades...</div> : null}

    {formAberto ? <div className="education-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormAberto(false); }}><div className="education-modal activity-modal">
      <div className="education-list-head"><div><span className="page-eyebrow">{editandoId ? "EDITAR" : "NOVA"}</span><h2>{editandoId ? "Editar atividade" : "Nova atividade"}</h2></div><button onClick={() => setFormAberto(false)}><X size={18}/></button></div>
      {erro ? <div className="crm-inline-alert">{erro}</div> : null}
      <div className="activity-form-grid"><label className="wide"><span>Título</span><input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })}/></label>{acessoEquipe ? <label className="wide"><span>Responsável</span><select value={form.responsavel_id} disabled={!usuarios.length} onChange={(event) => setForm({ ...form, responsavel_id: Number(event.target.value) })}>{!usuarios.length ? <option value={0}>Carregando funcionários...</option> : null}{usuarios.map((usuario) => <option value={usuario.id} key={usuario.id}>{usuario.nome}</option>)}</select></label> : null}<label><span>Data</span><input type="date" value={form.data_atividade} onChange={(event) => setForm({ ...form, data_atividade: event.target.value })}/></label><label><span>Prioridade</span><select value={form.prioridade} onChange={(event) => setForm({ ...form, prioridade: event.target.value })}>{PRIORIDADES.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Início</span><input type="time" value={form.hora_inicio} onChange={(event) => setForm({ ...form, hora_inicio: event.target.value })}/></label><label><span>Fim</span><input type="time" value={form.hora_fim} onChange={(event) => setForm({ ...form, hora_fim: event.target.value })}/></label><label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{STATUS.map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide"><span>Descrição</span><textarea rows={4} value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })}/></label></div>
      <div className="education-actions activity-modal-actions"><button className="primary-action" onClick={() => void salvar()} disabled={salvando || (acessoEquipe && !usuarios.length)}><Check size={16}/>{salvando ? "Salvando..." : "Salvar atividade"}</button><button onClick={() => setFormAberto(false)}><Circle size={15}/>Cancelar</button></div>
    </div></div> : null}
  </section>;
}
