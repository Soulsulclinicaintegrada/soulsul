import { Check, ChevronLeft, ChevronRight, Circle, Clock3, LockKeyhole, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { UsuarioSessao } from "./auth";
import {
  atualizarAtividadeApi,
  atualizarCorResponsavelAtividadesApi,
  criarAtividadeApi,
  excluirAtividadeApi,
  listarAtividadesApi,
  listarResponsaveisAtividadesApi,
  type AgendaAtividadeApi,
  type AgendaAtividadePayloadApi,
  type ResponsavelAtividadeApi
} from "./pacientesApi";

type Props = { usuarioLogado: UsuarioSessao; dataInicial?: string };

const STATUS = ["Pendente", "Em andamento", "Concluída", "Cancelada"];
const PRIORIDADES = ["Baixa", "Normal", "Alta", "Urgente"];
const CORES_RESPONSAVEIS = ["#7b61a8", "#2f7d66", "#b0603d", "#4175a6", "#9a6b22", "#a64f72", "#527b35", "#725b9d", "#277f87"];
const FERIADOS_FIXOS = new Map<string, string>([
  ["01-01", "Confraternização Universal"], ["03-28", "Aniversário de Campos"],
  ["04-21", "Tiradentes"], ["04-23", "São Jorge"], ["05-01", "Dia do Trabalho"],
  ["08-06", "Santíssimo Salvador"], ["09-07", "Independência do Brasil"],
  ["10-12", "Nossa Senhora Aparecida"], ["11-02", "Finados"],
  ["11-15", "Proclamação da República"], ["11-20", "Consciência Negra"], ["12-25", "Natal"]
]);

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

function calcularPascoa(ano: number) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia, 12);
}

function descricaoFeriado(valor: string) {
  const [anoTexto, mes, dia] = valor.split("-");
  const ano = Number(anoTexto);
  if (!ano || !mes || !dia) return "";
  const fixo = FERIADOS_FIXOS.get(`${mes}-${dia}`);
  if (fixo) return fixo;
  const pascoa = calcularPascoa(ano);
  const sexta = new Date(pascoa); sexta.setDate(sexta.getDate() - 2);
  const corpus = new Date(pascoa); corpus.setDate(corpus.getDate() + 60);
  if (valor === dataIso(sexta)) return "Paixão de Cristo";
  if (valor === dataIso(corpus)) return "Corpus Christi";
  return "";
}

function payloadVazio(usuarioId: number, data: string): AgendaAtividadePayloadApi {
  return { titulo: "", descricao: "", responsavel_id: usuarioId, responsaveis_ids: [usuarioId], data_atividade: data, hora_inicio: "", hora_fim: "", prioridade: "Normal", status: "Pendente", cor: "#c7aa78", secreta: false, repeticao: "NENHUMA", repetir_ate: "" };
}

function textoComparacao(valor: string) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleUpperCase("pt-BR");
}

function formatarLeitura(valor: string) {
  const texto = String(valor || "").trim();
  if (!texto) return "Visto";
  const correspondencia = texto.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!correspondencia) return `Visto em ${texto}`;
  return `Visto em ${correspondencia[3]}/${correspondencia[2]}/${correspondencia[1]} às ${correspondencia[4]}:${correspondencia[5]}`;
}

function ordenarAtividades(a: AgendaAtividadeApi, b: AgendaAtividadeApi) {
  const ordemPrioridade: Record<string, number> = { URGENTE: 0, ALTA: 1, NORMAL: 2, BAIXA: 3 };
  const prioridadeA = ordemPrioridade[textoComparacao(a.prioridade)] ?? 4;
  const prioridadeB = ordemPrioridade[textoComparacao(b.prioridade)] ?? 4;
  if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;
  const emissorA = ["JULIANA", "ELIANE"].includes(textoComparacao(a.criadoPor)) ? 0 : 1;
  const emissorB = ["JULIANA", "ELIANE"].includes(textoComparacao(b.criadoPor)) ? 0 : 1;
  if (emissorA !== emissorB) return emissorA - emissorB;
  const horarioA = a.horaInicio || "99:99";
  const horarioB = b.horaInicio || "99:99";
  const porHorario = horarioA.localeCompare(horarioB);
  return porHorario || a.id - b.id;
}

export function AtividadesPage({ usuarioLogado, dataInicial = "" }: Props) {
  const hoje = dataIso(new Date());
  const [referencia, setReferencia] = useState(dataInicial || hoje);
  const [atividades, setAtividades] = useState<AgendaAtividadeApi[]>([]);
  const [usuarios, setUsuarios] = useState<ResponsavelAtividadeApi[]>([]);
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<number[]>([]);
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState(() => payloadVazio(usuarioLogado.id, hoje));
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const carregamentoRef = useRef(0);
  const identificadorUsuario = usuarioLogado.usuario || usuarioLogado.nome;
  const usuarioEhAdministrador = String(usuarioLogado.perfil || "").toLowerCase() === "administrador" || String(usuarioLogado.cargo || "").toLowerCase() === "administrador";
  const acessoEquipe = String(usuarioLogado.atividadesEscopo || "").toUpperCase() === "EQUIPE" || usuarioEhAdministrador;
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
  const feriadoReferencia = descricaoFeriado(referencia);

  async function carregar() {
    const carregamentoId = ++carregamentoRef.current;
    setCarregando(true);
    setErro("");
    try {
      const [lista, equipe] = await Promise.all([
        listarAtividadesApi(dias[0], dias[6], identificadorUsuario),
        listarResponsaveisAtividadesApi(identificadorUsuario)
      ]);
      if (carregamentoId !== carregamentoRef.current) return;
      setAtividades(lista);
      setUsuarios(equipe);
    } catch (error) {
      if (carregamentoId !== carregamentoRef.current) return;
      setErro(error instanceof Error ? error.message : "Não foi possível carregar as atividades.");
    } finally {
      if (carregamentoId === carregamentoRef.current) setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); }, [inicio, acessoEquipe]);

  useEffect(() => {
    if (dataInicial) setReferencia(dataInicial);
  }, [dataInicial]);

  useEffect(() => {
    if (!usuarios.length) return;
    setForm((atual) => {
      if (formAberto) return atual;
      const responsaveisValidos = atual.responsaveis_ids.filter((id) => usuarios.some((usuario) => usuario.id === id));
      const ids = responsaveisValidos.length ? responsaveisValidos : [usuarios[0].id];
      return { ...atual, responsavel_id: ids[0], responsaveis_ids: ids };
    });
    setResponsaveisSelecionados((atuais) => {
      const validos = atuais.filter((id) => usuarios.some((usuario) => usuario.id === id));
      return validos.length ? validos : usuarios.map((usuario) => usuario.id);
    });
  }, [usuarios, formAberto]);

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
    setForm({ titulo: item.titulo, descricao: item.descricao || "", responsavel_id: ids[0], responsaveis_ids: ids, data_atividade: item.dataAtividade, hora_inicio: item.horaInicio || "", hora_fim: item.horaFim || "", prioridade: item.prioridade, status: item.status, cor: item.cor || "#c7aa78", secreta: Boolean(item.secreta), repeticao: "NENHUMA", repetir_ate: "" });
    setFormAberto(true);
    setErro("");
  }

  async function salvar() {
    if (!form.titulo.trim()) { setErro("Informe o título da atividade."); return; }
    if (!editandoId && form.repeticao !== "NENHUMA" && !form.repetir_ate) { setErro("Informe até quando a atividade deve se repetir."); return; }
    setSalvando(true);
    setErro("");
    try {
      const salva = editandoId ? await atualizarAtividadeApi(editandoId, form, identificadorUsuario) : await criarAtividadeApi(form, identificadorUsuario);
      carregamentoRef.current += 1;
      setAtividades((atuais) => editandoId ? atuais.map((item) => item.id === salva.id ? salva : item) : [...atuais, salva]);
      setFormAberto(false);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a atividade.");
    } finally { setSalvando(false); }
  }

  async function mudarStatus(item: AgendaAtividadeApi, status: string) {
    setAtividades((atuais) => atuais.map((atual) => atual.id === item.id ? { ...atual, status } : atual));
    try {
      const ids = item.responsaveisIds?.length ? item.responsaveisIds : [item.responsavelId];
      const atualizada = await atualizarAtividadeApi(item.id, { titulo: item.titulo, descricao: item.descricao || "", responsavel_id: ids[0], responsaveis_ids: ids, data_atividade: item.dataAtividade, hora_inicio: item.horaInicio || "", hora_fim: item.horaFim || "", prioridade: item.prioridade, status, cor: item.cor || "#c7aa78", secreta: Boolean(item.secreta) }, identificadorUsuario);
      setAtividades((atuais) => atuais.map((atual) => atual.id === item.id ? atualizada : atual));
      setErro("");
    } catch (error) {
      setAtividades((atuais) => atuais.map((atual) => atual.id === item.id ? item : atual));
      setErro(error instanceof Error ? error.message : "Não foi possível alterar o status.");
    }
  }

  async function remover(item: AgendaAtividadeApi) {
    if (!window.confirm(`Excluir a atividade “${item.titulo}”?`)) return;
    await excluirAtividadeApi(item.id, identificadorUsuario);
    setAtividades((atuais) => atuais.filter((atual) => atual.id !== item.id));
  }

  function corResponsavel(id: number) {
    const indice = Math.max(0, usuarios.findIndex((usuario) => usuario.id === id));
    return usuarios.find((usuario) => usuario.id === id)?.cor || CORES_RESPONSAVEIS[indice % CORES_RESPONSAVEIS.length];
  }

  async function alterarCorResponsavel(id: number, cor: string) {
    const anteriores = usuarios;
    setUsuarios((atuais) => atuais.map((usuario) => usuario.id === id ? { ...usuario, cor } : usuario));
    try {
      const atualizado = await atualizarCorResponsavelAtividadesApi(id, cor, identificadorUsuario);
      setUsuarios((atuais) => atuais.map((usuario) => usuario.id === id ? atualizado : usuario));
      setErro("");
    } catch (error) {
      setUsuarios(anteriores);
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a cor da pessoa.");
    }
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
          <div className="activities-mini-days">{diasCalendario.map((dia) => { const feriado = descricaoFeriado(dia); const classes = [dia === referencia ? "selected" : "", dia === hoje ? "today" : "", dia.slice(0, 7) !== mesReferencia ? "outside" : "", feriado ? "holiday" : ""].filter(Boolean).join(" "); return <button key={dia} title={feriado || undefined} className={classes} onClick={() => setReferencia(dia)}>{Number(dia.slice(-2))}</button>; })}</div>
        </div>
        <div><span className="panel-kicker">Equipe</span><h2>Administrativo</h2><p>Marque quem deseja visualizar.</p></div>
        <div className="activities-team-actions"><button onClick={() => setResponsaveisSelecionados(usuarios.map((usuario) => usuario.id))}>Mostrar todos</button><button onClick={() => setResponsaveisSelecionados([])}>Limpar seleção</button></div>
        <div className="activities-team-list">{usuarios.map((usuario) => <label key={usuario.id} className={responsaveisSelecionados.includes(usuario.id) ? "active" : ""} style={{ "--person-color": corResponsavel(usuario.id) } as CSSProperties}><input className="activity-person-color" type="color" value={corResponsavel(usuario.id)} title={`Cor de ${usuario.nome}`} aria-label={`Cor de ${usuario.nome}`} onClick={(event) => event.stopPropagation()} onChange={(event) => void alterarCorResponsavel(usuario.id, event.target.value)}/><input type="checkbox" checked={responsaveisSelecionados.includes(usuario.id)} onChange={() => alternarResponsavelVisivel(usuario.id)}/><span>{usuario.nome}</span></label>)}</div>
        <small>A inclusão de outras pessoas é definida em Usuários e Cargos → Agenda de atividades.</small>
      </aside> : null}
      <section className="activities-calendar-main">
        <div className="panel activities-toolbar">
          <div className="activities-nav"><button onClick={() => setReferencia(adicionarDias(referencia, -1))}><ChevronLeft size={17}/></button><button onClick={() => setReferencia(hoje)}>Hoje</button><button onClick={() => setReferencia(adicionarDias(referencia, 1))}><ChevronRight size={17}/></button><strong>{new Date(`${referencia}T12:00:00`).toLocaleDateString("pt-BR", { weekday:"long", day: "2-digit", month: "long", year: "numeric" })}</strong></div>
          {feriadoReferencia ? <span className="activities-holiday-label">Feriado · {feriadoReferencia}</span> : null}
        </div>
        {erro && !formAberto ? <div className="crm-inline-alert">{erro}</div> : null}
        <div className="activities-people-board">
          {usuariosVisiveis.map((usuario) => {
            const itens = visiveis
              .filter((item) => item.dataAtividade === referencia && (item.responsaveisIds || [item.responsavelId]).includes(usuario.id))
              .sort(ordenarAtividades);
            return <section className="activities-person-column" style={{ "--person-color": corResponsavel(usuario.id) } as CSSProperties} key={usuario.id}>
              <header><div><i/><strong>{usuario.nome}</strong></div><button onClick={() => { setEditandoId(null); setForm({ ...payloadVazio(usuario.id, referencia), responsaveis_ids:[usuario.id] }); setFormAberto(true); setErro(""); }} aria-label={`Adicionar atividade para ${usuario.nome}`}><Plus size={15}/></button></header>
              <div className="activities-day-list">{itens.map((item) => <article className={`activity-card priority-${item.prioridade.toLowerCase()} status-${item.status.toLowerCase().replaceAll(" ", "-")}`} key={item.id}>
                <div className="activity-card-top"><span>{item.horaInicio ? <><Clock3 size={13}/>{item.horaInicio}{item.horaFim ? `–${item.horaFim}` : ""}</> : "Atividade do dia"}</span><b className="activity-priority-tag">{item.prioridade}</b></div>
                <strong className="activity-card-title">{item.secreta ? <LockKeyhole size={13}/> : null}{item.titulo}</strong>{acessoEquipe ? <><div className="activity-assignees">{(item.responsaveisIds || [item.responsavelId]).map((id, indice) => <small key={id} style={{ "--person-color": corResponsavel(id) } as CSSProperties}><i/>{item.responsaveisNomes?.[indice] || usuarios.find((usuario) => usuario.id === id)?.nome || item.responsavelNome}</small>)}</div>{usuarioEhAdministrador ? <div className="activity-read-receipts">{(item.confirmacoesLeitura || []).map((confirmacao) => <span key={confirmacao.usuarioId} className={confirmacao.lida ? "read" : "pending"} title={confirmacao.lidaEm || undefined}>{confirmacao.lida ? <Check size={11}/> : <Clock3 size={11}/>} {confirmacao.nome}: {confirmacao.lida ? formatarLeitura(confirmacao.lidaEm) : "Não visualizado"}</span>)}</div> : null}</> : null}{item.descricao ? <p>{item.descricao}</p> : null}
                <div className="activity-card-actions"><div className="activity-status-buttons" aria-label="Alterar status">{STATUS.map((status) => <button type="button" key={status} className={item.status === status ? "active" : ""} onClick={() => void mudarStatus(item, status)}>{status}</button>)}</div><button onClick={() => abrirEdicao(item)} title="Editar"><Pencil size={14}/></button><button onClick={() => void remover(item)} title="Excluir"><Trash2 size={14}/></button></div>
              </article>)}{feriadoReferencia ? <div className="activities-day-holiday"><strong>Feriado</strong><span>{feriadoReferencia}</span></div> : !itens.length ? <button className="activities-empty" onClick={() => { setEditandoId(null); setForm({ ...payloadVazio(usuario.id, referencia), responsaveis_ids:[usuario.id] }); setFormAberto(true); setErro(""); }}>+ Adicionar atividade</button> : null}</div>
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
      <div className="activity-form-grid"><label className="wide"><span>Título</span><input value={form.titulo} onChange={(event) => setForm((atual) => ({ ...atual, titulo: event.target.value }))}/></label>{acessoEquipe ? <fieldset className="wide activity-assignee-picker" disabled={!usuarios.length}><legend>Responsáveis</legend>{!usuarios.length ? <span>Carregando funcionários...</span> : usuarios.map((usuario) => <label key={usuario.id} style={{ "--person-color": corResponsavel(usuario.id) } as CSSProperties}><input type="checkbox" checked={form.responsaveis_ids.includes(usuario.id)} onChange={() => alternarResponsavel(usuario.id)}/><i/>{usuario.nome}</label>)}</fieldset> : null}<label><span>Data</span><input type="date" value={form.data_atividade} onChange={(event) => setForm((atual) => ({ ...atual, data_atividade: event.target.value }))}/></label>{!editandoId ? <><label><span>Repetir</span><select value={form.repeticao || "NENHUMA"} onChange={(event) => setForm((atual) => ({ ...atual, repeticao: event.target.value, repetir_ate: event.target.value === "NENHUMA" ? "" : atual.repetir_ate }))}><option value="NENHUMA">Não repetir</option><option value="DIARIA">Diariamente</option><option value="SEMANAL">Semanalmente</option><option value="MENSAL">Mensalmente</option></select></label>{form.repeticao !== "NENHUMA" ? <label><span>Repetir até</span><input type="date" min={adicionarDias(form.data_atividade, 1)} value={form.repetir_ate || ""} onChange={(event) => setForm((atual) => ({ ...atual, repetir_ate: event.target.value }))}/></label> : null}</> : null}<fieldset className="activity-choice-group"><legend>Prioridade</legend>{PRIORIDADES.map((item) => <button type="button" key={item} className={`priority-${item.toLowerCase()}${form.prioridade === item ? " active" : ""}`} onClick={() => setForm((atual) => ({ ...atual, prioridade: item }))}>{item}</button>)}</fieldset><label><span>Início <em>opcional</em></span><input type="time" value={form.hora_inicio} onChange={(event) => setForm((atual) => ({ ...atual, hora_inicio: event.target.value }))}/></label><label><span>Fim <em>opcional</em></span><input type="time" value={form.hora_fim} onChange={(event) => setForm((atual) => ({ ...atual, hora_fim: event.target.value }))}/></label><fieldset className="activity-choice-group"><legend>Status</legend>{STATUS.map((item) => <button type="button" key={item} className={form.status === item ? "active" : ""} onClick={() => setForm((atual) => ({ ...atual, status: item }))}>{item}</button>)}</fieldset><button type="button" className={`activity-secret-toggle${form.secreta ? " active" : ""}`} onClick={() => setForm((atual) => ({ ...atual, secreta: !atual.secreta }))}><LockKeyhole size={16}/><span><strong>{form.secreta ? "Tarefa secreta" : "Tarefa visível à equipe"}</strong><small>{form.secreta ? "Somente emissor e responsáveis podem visualizar" : "Quem acessa toda a equipe também pode visualizar"}</small></span></button><label className="wide"><span>Descrição</span><textarea rows={4} value={form.descricao} onChange={(event) => setForm((atual) => ({ ...atual, descricao: event.target.value }))}/></label></div>
      <div className="education-actions activity-modal-actions"><button className="primary-action" onClick={() => void salvar()} disabled={salvando || (acessoEquipe && !usuarios.length)}><Check size={16}/>{salvando ? "Salvando..." : "Salvar atividade"}</button><button onClick={() => setFormAberto(false)}><Circle size={15}/>Cancelar</button></div>
    </div></div> : null}
  </section>;
}
