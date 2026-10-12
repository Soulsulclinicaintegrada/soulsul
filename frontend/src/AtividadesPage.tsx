import { Check, ChevronLeft, ChevronRight, Circle, Clock3, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
const CORES_RESPONSAVEIS = ["#7b61a8", "#2f7d66", "#b0603d", "#4175a6", "#9a6b22", "#a64f72", "#527b35", "#725b9d", "#277f87"];

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

function adicionarMes(valor: string, deslocamento: number) {
  const data = new Date(`${valor}T12:00:00`);
  return dataIso(new Date(data.getFullYear(), data.getMonth() + deslocamento, 1, 12));
}

function payloadVazio(usuarioId: number, data: string): AgendaAtividadePayloadApi {
  return { titulo: "", descricao: "", responsavel_id: usuarioId, responsaveis_ids: [usuarioId], data_atividade: data, hora_inicio: "", hora_fim: "", prioridade: "Normal", status: "Pendente" };
}

export function AtividadesPage({ usuarioLogado }: Props) {
  const hoje = dataIso(new Date());
  const [referencia, setReferencia] = useState(hoje);
  const [atividades, setAtividades] = useState<AgendaAtividadeApi[]>([]);
  const [usuarios, setUsuarios] = useState<ResponsavelAtividadeApi[]>([]);
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<number[]>([]);
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
  const diasCalendario = useMemo(() => {
    const base = new Date(`${referencia}T12:00:00`);
    const primeiro = new Date(base.getFullYear(), base.getMonth(), 1, 12);
    primeiro.setDate(primeiro.getDate() - primeiro.getDay());
    return Array.from({ length: 42 }, (_, indice) => {
      const data = new Date(primeiro);
      data.setDate(primeiro.getDate() + indice);
      return dataIso(data);
    });
  }, [referencia]);
  const mesReferencia = referencia.slice(0, 7);
  const usuariosVisiveis = usuarios.filter((usuario) => responsaveisSelecionados.includes(usuario.id));

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
    setForm((atual) => {
      const responsaveisValidos = atual.responsaveis_ids.filter((id) => usuarios.some((usuario) => usuario.id === id));
      const ids = responsaveisValidos.length ? responsaveisValidos : [usuarios[0].id];
      return { ...atual, responsavel_id: ids[0], responsaveis_ids: ids };
    });
    setResponsaveisSelecionados((atuais) => {
      const validos = atuais.filter((id) => usuarios.some((usuario) => usuario.id === id));
      return validos.length ? validos : usuarios.map((usuario) => usuario.id);
    });
  }, [usuarios]);

  const visiveis = useMemo(
    () => atividades.filter((item) => (item.responsaveisIds || [item.responsavelId]).some((id) => responsaveisSelecionados.includes(id))),
    [atividades, responsaveisSelecionados]
  );

  function abrirNova(data = referencia) {
    setEditandoId(null);
    setForm(payloadVazio(usuarioLogado.id, data));
    setFormAberto(true);
    setErro("");
  }

  function abrirEdicao(item: AgendaAtividadeApi) {
    setEditandoId(item.id);
    const ids = item.responsaveisIds?.length ? item.responsaveisIds : [item.responsavelId];
    setForm({ titulo: item.titulo, descricao: item.descricao || "", responsavel_id: ids[0], responsaveis_ids: ids, data_atividade: item.dataAtividade, hora_inicio: item.horaInicio || "", hora_fim: item.horaFim || "", prioridade: item.prioridade, status: item.status });
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
    const ids = item.responsaveisIds?.length ? item.responsaveisIds : [item.responsavelId];
    const atualizada = await atualizarAtividadeApi(item.id, { titulo: item.titulo, descricao: item.descricao || "", responsavel_id: ids[0], responsaveis_ids: ids, data_atividade: item.dataAtividade, hora_inicio: item.horaInicio || "", hora_fim: item.horaFim || "", prioridade: item.prioridade, status }, identificadorUsuario);
    setAtividades((atuais) => atuais.map((atual) => atual.id === item.id ? atualizada : atual));
  }

  async function remover(item: AgendaAtividadeApi) {
    if (!window.confirm(`Excluir a atividade “${item.titulo}”?`)) return;
    await excluirAtividadeApi(item.id, identificadorUsuario);
    setAtividades((atuais) => atuais.filter((atual) => atual.id !== item.id));
  }

  function corResponsavel(id: number) {
    const indice = Math.max(0, usuarios.findIndex((usuario) => usuario.id === id));
    return CORES_RESPONSAVEIS[indice % CORES_RESPONSAVEIS.length];
  }

  function alternarResponsavel(id: number) {
    setForm((atual) => {
      const selecionados = atual.responsaveis_ids.includes(id)
        ? atual.responsaveis_ids.filter((item) => item !== id)
        : [...atual.responsaveis_ids, id];
      const ids = selecionados.length ? selecionados : atual.responsaveis_ids;
      return { ...atual, responsaveis_ids: ids, responsavel_id: ids[0] };
    });
  }

  function alternarResponsavelVisivel(id: number) {
    setResponsaveisSelecionados((atuais) => atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]);
  }

  return <section className="activities-page">
    <header className="panel activities-hero">
      <div><span className="panel-kicker">Organização da equipe</span><h2>Agenda de atividades</h2><p>{acessoEquipe ? "Acompanhe e distribua as atividades de todos os funcionários." : "Acompanhe e atualize suas atividades."}</p></div>
      <button className="primary-action" onClick={() => abrirNova()}><Plus size={17}/> Nova atividade</button>
    </header>

    <div className="activities-agenda-shell">
      {acessoEquipe ? <aside className="panel activities-team-sidebar">
        <div className="activities-mini-calendar">
          <header><button onClick={() => setReferencia(adicionarMes(referencia, -1))}><ChevronLeft size={16}/></button><strong>{new Date(`${referencia}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong><button onClick={() => setReferencia(adicionarMes(referencia, 1))}><ChevronRight size={16}/></button></header>
          <div className="activities-mini-weekdays">{["D", "S", "T", "Q", "Q", "S", "S"].map((dia, indice) => <span key={`${dia}-${indice}`}>{dia}</span>)}</div>
          <div className="activities-mini-days">{diasCalendario.map((dia) => <button key={dia} className={`${dia === referencia ? "selected" : ""}${dia === hoje ? " today" : ""}${dia.slice(0, 7) !== mesReferencia ? " outside" : ""}`} onClick={() => setReferencia(dia)}>{Number(dia.slice(-2))}</button>)}</div>
        </div>
        <div><span className="panel-kicker">Equipe</span><h2>Administrativo</h2><p>Marque quem deseja visualizar.</p></div>
        <div className="activities-team-actions"><button onClick={() => setResponsaveisSelecionados(usuarios.map((usuario) => usuario.id))}>Mostrar todos</button><button onClick={() => setResponsaveisSelecionados([])}>Limpar seleção</button></div>
        <div className="activities-team-list">{usuarios.map((usuario) => <label key={usuario.id} className={responsaveisSelecionados.includes(usuario.id) ? "active" : ""} style={{ "--person-color": corResponsavel(usuario.id) } as CSSProperties}><button type="button" onClick={() => setResponsaveisSelecionados([usuario.id])} aria-label={`Mostrar somente ${usuario.nome}`}><i/></button><input type="checkbox" checked={responsaveisSelecionados.includes(usuario.id)} onChange={() => alternarResponsavelVisivel(usuario.id)}/><span>{usuario.nome}</span></label>)}</div>
        <small>A inclusão de outras pessoas é definida em Usuários e Cargos → Agenda de atividades.</small>
      </aside> : null}
      <section className="activities-calendar-main">
        <div className="panel activities-toolbar">
          <div className="activities-nav"><button onClick={() => setReferencia(adicionarDias(referencia, -1))}><ChevronLeft size={17}/></button><button onClick={() => setReferencia(hoje)}>Hoje</button><button onClick={() => setReferencia(adicionarDias(referencia, 1))}><ChevronRight size={17}/></button><strong>{new Date(`${referencia}T12:00:00`).toLocaleDateString("pt-BR", { weekday:"long", day: "2-digit", month: "long", year: "numeric" })}</strong></div>
        </div>
        {erro && !formAberto ? <div className="crm-inline-alert">{erro}</div> : null}
        <div className="activities-people-board">
          {usuariosVisiveis.map((usuario) => {
            const itens = visiveis.filter((item) => item.dataAtividade === referencia && (item.responsaveisIds || [item.responsavelId]).includes(usuario.id));
            return <section className="activities-person-column" style={{ "--person-color": corResponsavel(usuario.id) } as CSSProperties} key={usuario.id}>
              <header><div><i/><strong>{usuario.nome}</strong></div><button onClick={() => { setEditandoId(null); setForm({ ...payloadVazio(usuario.id, referencia), responsaveis_ids:[usuario.id] }); setFormAberto(true); setErro(""); }} aria-label={`Adicionar atividade para ${usuario.nome}`}><Plus size={15}/></button></header>
              <div className="activities-day-list">{itens.map((item) => <article className={`activity-card priority-${item.prioridade.toLowerCase()} status-${item.status.toLowerCase().replaceAll(" ", "-")}`} style={{ "--activity-person-color": corResponsavel((item.responsaveisIds || [item.responsavelId])[0]) } as CSSProperties} key={item.id}>
                <div className="activity-card-top"><span>{item.horaInicio ? <><Clock3 size={13}/>{item.horaInicio}{item.horaFim ? `–${item.horaFim}` : ""}</> : "Atividade do dia"}</span><b className="activity-priority-tag">{item.prioridade}</b></div>
                <strong className="activity-card-title">{item.titulo}</strong>{acessoEquipe ? <div className="activity-assignees">{(item.responsaveisIds || [item.responsavelId]).map((id, indice) => <small key={id} style={{ "--person-color": corResponsavel(id) } as CSSProperties}><i/>{item.responsaveisNomes?.[indice] || usuarios.find((usuario) => usuario.id === id)?.nome || item.responsavelNome}</small>)}</div> : null}{item.descricao ? <p>{item.descricao}</p> : null}
                <div className="activity-card-actions"><select value={item.status} onChange={(event) => void mudarStatus(item, event.target.value)}>{STATUS.map((status) => <option key={status}>{status}</option>)}</select><button onClick={() => abrirEdicao(item)} title="Editar"><Pencil size={14}/></button><button onClick={() => void remover(item)} title="Excluir"><Trash2 size={14}/></button></div>
              </article>)}{!itens.length ? <button className="activities-empty" onClick={() => { setEditandoId(null); setForm({ ...payloadVazio(usuario.id, referencia), responsaveis_ids:[usuario.id] }); setFormAberto(true); setErro(""); }}>+ Adicionar atividade</button> : null}</div>
            </section>;
          })}
          {!usuariosVisiveis.length ? <div className="activities-no-people"><strong>Selecione ao menos uma pessoa</strong><span>Use o painel lateral para escolher quem deseja visualizar.</span></div> : null}
        </div>
        {carregando ? <div className="activities-loading">Carregando atividades...</div> : null}
      </section>
    </div>

    {formAberto ? <div className="education-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormAberto(false); }}><div className="education-modal activity-modal">
      <div className="education-list-head"><div><span className="page-eyebrow">{editandoId ? "EDITAR" : "NOVA"}</span><h2>{editandoId ? "Editar atividade" : "Nova atividade"}</h2></div><button onClick={() => setFormAberto(false)}><X size={18}/></button></div>
      {erro ? <div className="crm-inline-alert">{erro}</div> : null}
      <div className="activity-form-grid"><label className="wide"><span>Título</span><input value={form.titulo} onChange={(event) => setForm((atual) => ({ ...atual, titulo: event.target.value }))}/></label>{acessoEquipe ? <fieldset className="wide activity-assignee-picker" disabled={!usuarios.length}><legend>Responsáveis</legend>{!usuarios.length ? <span>Carregando funcionários...</span> : usuarios.map((usuario) => <label key={usuario.id} style={{ "--person-color": corResponsavel(usuario.id) } as CSSProperties}><input type="checkbox" checked={form.responsaveis_ids.includes(usuario.id)} onChange={() => alternarResponsavel(usuario.id)}/><i/>{usuario.nome}</label>)}</fieldset> : null}<label><span>Data</span><input type="date" value={form.data_atividade} onChange={(event) => setForm((atual) => ({ ...atual, data_atividade: event.target.value }))}/></label><label><span>Prioridade</span><select value={form.prioridade} onChange={(event) => setForm((atual) => ({ ...atual, prioridade: event.target.value }))}>{PRIORIDADES.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Início <em>opcional</em></span><input type="time" value={form.hora_inicio} onChange={(event) => setForm((atual) => ({ ...atual, hora_inicio: event.target.value }))}/></label><label><span>Fim <em>opcional</em></span><input type="time" value={form.hora_fim} onChange={(event) => setForm((atual) => ({ ...atual, hora_fim: event.target.value }))}/></label><label><span>Status</span><select value={form.status} onChange={(event) => setForm((atual) => ({ ...atual, status: event.target.value }))}>{STATUS.map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide"><span>Descrição</span><textarea rows={4} value={form.descricao} onChange={(event) => setForm((atual) => ({ ...atual, descricao: event.target.value }))}/></label></div>
      <div className="education-actions activity-modal-actions"><button className="primary-action" onClick={() => void salvar()} disabled={salvando || (acessoEquipe && !usuarios.length)}><Check size={16}/>{salvando ? "Salvando..." : "Salvar atividade"}</button><button onClick={() => setFormAberto(false)}><Circle size={15}/>Cancelar</button></div>
    </div></div> : null}
  </section>;
}
