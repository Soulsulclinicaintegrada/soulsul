import { LogOut, Menu, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CheckSquare2, Plus, Trash2 } from "lucide-react";
import logoUrl from "./assets/logo-soul-sul.png";
import { carregarUsuarioSessao, salvarUsuarioSessao, type UsuarioSessao } from "./auth";
import { AgendaPage } from "./AgendaPage";
import { CRMPage } from "./CRMPage";
import { DashboardPage } from "./DashboardPage";
import { FinanceiroPage } from "./FinanceiroPage";
import { GuiasPage } from "./GuiasPage";
import { ImportacoesPage } from "./ImportacoesPage";
import { menuItems, type MenuKey } from "./mockData";
import { PacientesPage } from "./PacientesPage";
import { listarUsuariosApi, loginApi, trocarSenhaApi, type UsuarioResumoApi } from "./pacientesApi";
import {
  arquivarChecklistApi,
  atualizarChecklistApi,
  atualizarRegistroChecklistApi,
  buscarChecklistMeuApi,
  criarChecklistMeuApi,
  type ChecklistUsuarioItemApi,
  type ChecklistUsuarioPainelApi
} from "./pacientesApi";
import { UsuariosPage } from "./UsuariosPage";

type NavegacaoPaciente = {
  pacienteId?: number;
  abaPrincipal?: "Cadastro" | "Financeiro" | "Agendamentos" | "Ordem de serviço";
  abaClinica?: "Plano e ficha clinica" | "Odontograma" | "Anamnese" | "Especialidades";
  abrirOrcamento?: boolean;
  abrirNovoPaciente?: boolean;
  chave: number;
};

const MENU_TO_MODULO: Record<MenuKey, string> = {
  Dashboard: "Dashboard",
  Pacientes: "Pacientes",
  Guias: "Guias",
  Agenda: "Agenda",
  CRM: "CRM",
  Financeiro: "Financeiro",
  Tabelas: "Tabelas",
  "Usuários": "Usuarios"
};

function nivelPermissao(valor?: string) {
  const texto = String(valor || "").toLowerCase();
  if (texto === "edicao") return 2;
  if (texto === "visualizacao") return 1;
  return 0;
}

function textoPermissao(nivel: number) {
  if (nivel >= 2) return "Edicao";
  if (nivel >= 1) return "Visualizacao";
  return "Sem acesso";
}

function normalizarBusca(valor?: string) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tituloTipoChecklist(tipo: string, tipos: Array<{ id: string; label: string }>) {
  return tipos.find((item) => item.id === tipo)?.label || "Manual";
}

function permissoesPadraoSessao(usuario?: UsuarioSessao | null) {
  const cargo = String(usuario?.cargo || "").trim().toLowerCase();
  const perfil = String(usuario?.perfil || "").trim().toLowerCase();
  const modulos: Record<string, string> = {
    Dashboard: "Sem acesso",
    Pacientes: "Sem acesso",
    Guias: "Sem acesso",
    Agenda: "Sem acesso",
    CRM: "Sem acesso",
    Financeiro: "Sem acesso",
    Tabelas: "Sem acesso",
    Usuarios: "Sem acesso"
  };
  const pacientesAbas: Record<string, string> = {
    Cadastro: "Sem acesso",
    Orcamentos: "Sem acesso",
    Financeiro: "Sem acesso",
    Documentos: "Sem acesso",
    "Plano e Ficha Clinica": "Sem acesso",
    Odontograma: "Sem acesso",
    Agendamentos: "Sem acesso"
  };
  if (perfil === "administrador" || cargo === "administrador") {
    Object.keys(modulos).forEach((chave) => {
      modulos[chave] = "Edicao";
    });
    Object.keys(pacientesAbas).forEach((chave) => {
      pacientesAbas[chave] = "Edicao";
    });
    return { modulos, pacientesAbas };
  }
  if (cargo === "profissional") {
    modulos.Pacientes = "Edicao";
    modulos.Guias = "Edicao";
    modulos.Agenda = "Visualizacao";
    modulos.CRM = "Sem acesso";
    pacientesAbas.Documentos = "Edicao";
    pacientesAbas["Plano e Ficha Clinica"] = "Visualizacao";
    pacientesAbas.Odontograma = "Visualizacao";
    pacientesAbas.Agendamentos = "Visualizacao";
    return { modulos, pacientesAbas };
  }
  modulos.Dashboard = "Visualizacao";
  modulos.Pacientes = "Edicao";
  modulos.Guias = "Edicao";
  modulos.Agenda = "Edicao";
  modulos.CRM = "Edicao";
  modulos.Financeiro = "Visualizacao";
  pacientesAbas.Cadastro = "Edicao";
  pacientesAbas.Orcamentos = "Visualizacao";
  pacientesAbas.Financeiro = "Visualizacao";
  pacientesAbas.Documentos = "Visualizacao";
  pacientesAbas.Agendamentos = "Edicao";
  return { modulos, pacientesAbas };
}

function mesclarPermissoes(
  padrao: { modulos: Record<string, string>; pacientesAbas: Record<string, string> },
  sessao?: UsuarioSessao | null
) {
  const modulosSalvos = sessao?.modulos || {};
  const abasSalvas = sessao?.pacientesAbas || {};
  const temModulosSalvos = Object.keys(modulosSalvos).length > 0;
  const temAbasSalvas = Object.keys(abasSalvas).length > 0;

  // Permissoes gravadas para a pessoa sao a fonte de verdade. O padrao do cargo
  // so atende contas antigas que ainda nao possuem nenhuma configuracao salva.
  const modulos = Object.fromEntries(
    Object.keys(padrao.modulos).map((chave) => [
      chave,
      temModulosSalvos ? textoPermissao(nivelPermissao(modulosSalvos[chave])) : padrao.modulos[chave]
    ])
  );
  const pacientesAbas = Object.fromEntries(
    Object.keys(padrao.pacientesAbas).map((chave) => [
      chave,
      temAbasSalvas ? textoPermissao(nivelPermissao(abasSalvas[chave])) : padrao.pacientesAbas[chave]
    ])
  );

  return { modulos, pacientesAbas };
}

function App() {
  const [menuAtivo, setMenuAtivo] = useState<MenuKey>("Agenda");
  const [buscaGlobal, setBuscaGlobal] = useState("");
  const [sidebarOverlayAberta, setSidebarOverlayAberta] = useState(false);
  const [navegacaoPaciente, setNavegacaoPaciente] = useState<NavegacaoPaciente | null>(null);
  const [usuarioLogado, setUsuarioLogado] = useState<UsuarioSessao | null>(carregarUsuarioSessao());
  const [usuariosSistema, setUsuariosSistema] = useState<UsuarioResumoApi[]>([]);
  const [usuarioLoginDigitado, setUsuarioLoginDigitado] = useState("");
  const [senhaLogin, setSenhaLogin] = useState("");
  const [erroLogin, setErroLogin] = useState("");
  const [trocaSenha, setTrocaSenha] = useState({ atual: "", nova: "", confirmar: "", erro: "" });
  const [modalMinhaSenhaAberto, setModalMinhaSenhaAberto] = useState(false);
  const [minhaSenha, setMinhaSenha] = useState({ atual: "", nova: "", confirmar: "", erro: "", sucesso: "" });
  const [checklistAberto, setChecklistAberto] = useState(false);
  const [checklistPainel, setChecklistPainel] = useState<ChecklistUsuarioPainelApi | null>(null);
  const [checklistCarregando, setChecklistCarregando] = useState(false);
  const [checklistErro, setChecklistErro] = useState("");
  const [checklistSalvandoId, setChecklistSalvandoId] = useState<number | null>(null);
  const [checklistEditandoId, setChecklistEditandoId] = useState<number | null>(null);
  const [checklistEdicao, setChecklistEdicao] = useState({ titulo: "", descricao: "", tipo_meta: "manual", meta_diaria: 1 });
  const [novoChecklist, setNovoChecklist] = useState({ titulo: "", descricao: "", tipo_meta: "manual", meta_diaria: 1 });

  const agendaEmFoco = menuAtivo === "Agenda";
  const inicialUsuario = usuarioLogado?.nome?.trim()?.slice(0, 1)?.toUpperCase() || "U";
  const permissoesSessao = useMemo(() => permissoesPadraoSessao(usuarioLogado), [usuarioLogado]);
  const permissoesUsuario = useMemo(() => mesclarPermissoes(permissoesSessao, usuarioLogado), [permissoesSessao, usuarioLogado]);
  const modulosUsuario = permissoesUsuario.modulos;
  const pacientesAbasUsuario = permissoesUsuario.pacientesAbas;
  const menuDisponivel = useMemo(
    () => menuItems.filter((item) => nivelPermissao(modulosUsuario[MENU_TO_MODULO[item.key]]) > 0),
    [modulosUsuario]
  );
  const acessoModuloAtual = nivelPermissao(modulosUsuario[MENU_TO_MODULO[menuAtivo]]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (sidebarOverlayAberta) {
        setSidebarOverlayAberta(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOverlayAberta]);

  useEffect(() => {
    function onCopy(event: ClipboardEvent) {
      const raiz = document.getElementById("root");
      const alvo = event.target as Node | null;
      if (raiz && alvo && !raiz.contains(alvo)) return;

      let texto = "";
      const ativo = document.activeElement;
      const campoAtivo =
        ativo instanceof HTMLInputElement || ativo instanceof HTMLTextAreaElement
          ? ativo
          : null;
      if (
        alvo
        && campoAtivo
        && alvo === campoAtivo
        && campoAtivo.type !== "password"
      ) {
        const inicio = campoAtivo.selectionStart ?? 0;
        const fim = campoAtivo.selectionEnd ?? 0;
        texto = String(campoAtivo.value || "").slice(inicio, fim);
      }

      if (!texto) {
        const selecao = window.getSelection?.();
        texto = selecao ? selecao.toString() : "";
      }
      if (!texto) return;

      event.preventDefault();
      event.clipboardData?.setData("text/plain", texto.toLocaleUpperCase("pt-BR"));
    }

    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, []);

  useEffect(() => {
    if (!usuarioLogado) return;
    if (acessoModuloAtual > 0) return;
    const primeiroModulo = menuDisponivel[0]?.key;
    if (primeiroModulo && primeiroModulo !== menuAtivo) {
      setMenuAtivo(primeiroModulo);
    }
  }, [acessoModuloAtual, menuAtivo, menuDisponivel, usuarioLogado]);

  useEffect(() => {
    const termo = buscaGlobal.trim();
    if (!usuarioLogado || !termo) return;
    if (menuAtivo === "Pacientes") return;
    if (nivelPermissao(modulosUsuario.Pacientes) <= 0) return;
    setMenuAtivo("Pacientes");
    setNavegacaoPaciente(null);
  }, [buscaGlobal, menuAtivo, modulosUsuario.Pacientes, usuarioLogado]);

  useEffect(() => {
    let cancelado = false;
    async function sincronizarUsuarios() {
      try {
        const usuarios = await listarUsuariosApi();
        if (cancelado) return;
        setUsuariosSistema(usuarios);
        setUsuarioLoginDigitado((atual) => atual || usuarios[0]?.usuario || usuarios[0]?.nome || "");
        setUsuarioLogado((sessaoAtual) => {
          if (!sessaoAtual) return sessaoAtual;
          const cadastroAtual = usuarios.find(
            (item) => item.id === sessaoAtual.id || normalizarBusca(item.usuario) === normalizarBusca(sessaoAtual.usuario)
          );
          if (!cadastroAtual || normalizarBusca(cadastroAtual.status) !== "ativo") {
            salvarUsuarioSessao(null);
            return null;
          }
          const sessaoAtualizada: UsuarioSessao = {
            ...sessaoAtual,
            nome: cadastroAtual.nome,
            usuario: cadastroAtual.usuario,
            perfil: cadastroAtual.perfil,
            cargo: cadastroAtual.cargo,
            agendaEscopo: cadastroAtual.agendaEscopo,
            agendaDisponivel: cadastroAtual.agendaDisponivel,
            nomeAgenda: cadastroAtual.nomeAgenda,
            modulos: cadastroAtual.modulos,
            pacientesAbas: cadastroAtual.pacientesAbas
          };
          const semAlteracao =
            JSON.stringify(sessaoAtualizada.modulos) === JSON.stringify(sessaoAtual.modulos)
            && JSON.stringify(sessaoAtualizada.pacientesAbas) === JSON.stringify(sessaoAtual.pacientesAbas)
            && sessaoAtualizada.nome === sessaoAtual.nome
            && sessaoAtualizada.usuario === sessaoAtual.usuario
            && sessaoAtualizada.perfil === sessaoAtual.perfil
            && sessaoAtualizada.cargo === sessaoAtual.cargo
            && sessaoAtualizada.agendaEscopo === sessaoAtual.agendaEscopo
            && sessaoAtualizada.agendaDisponivel === sessaoAtual.agendaDisponivel
            && sessaoAtualizada.nomeAgenda === sessaoAtual.nomeAgenda;
          if (semAlteracao) return sessaoAtual;
          salvarUsuarioSessao(sessaoAtualizada);
          return sessaoAtualizada;
        });
      } catch {
        if (cancelado) return;
        // Uma falha temporaria de rede nao deve encerrar a sessao nem restaurar permissoes antigas.
      }
    }

    void sincronizarUsuarios();
    const intervalo = window.setInterval(() => void sincronizarUsuarios(), 30_000);
    const aoRetomar = () => {
      if (document.visibilityState === "visible") void sincronizarUsuarios();
    };
    window.addEventListener("focus", aoRetomar);
    document.addEventListener("visibilitychange", aoRetomar);
    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      window.removeEventListener("focus", aoRetomar);
      document.removeEventListener("visibilitychange", aoRetomar);
    };
  }, []);

  async function carregarChecklist() {
    if (!usuarioLogado) return;
    setChecklistCarregando(true);
    setChecklistErro("");
    try {
      const painel = await buscarChecklistMeuApi();
      setChecklistPainel(painel);
    } catch (error) {
      setChecklistErro(error instanceof Error ? error.message : "Falha ao carregar checklist.");
    } finally {
      setChecklistCarregando(false);
    }
  }

  useEffect(() => {
    if (!usuarioLogado) {
      setChecklistPainel(null);
      setChecklistAberto(false);
      return;
    }
    void carregarChecklist();
  }, [usuarioLogado]);

  const paginaAtual = useMemo(() => {
    if (menuAtivo === "Dashboard") return { titulo: "Dashboard Executivo", busca: "Buscar paciente" };
    if (menuAtivo === "Pacientes") return { titulo: "Pacientes", busca: "Buscar paciente, prontuario, telefone ou CPF..." };
    if (menuAtivo === "Guias") return { titulo: "Guias", busca: "Buscar paciente" };
    if (menuAtivo === "Agenda") return { titulo: "Agenda Clínica", busca: "Buscar paciente" };
    if (menuAtivo === "CRM") return { titulo: "CRM", busca: "Buscar paciente" };
    if (menuAtivo === "Financeiro") return { titulo: "Financeiro", busca: "Buscar paciente" };
    if (menuAtivo === "Tabelas") return { titulo: "Tabelas", busca: "Buscar paciente" };
    return { titulo: "Usuarios", busca: "Buscar paciente" };
  }, [menuAtivo]);

  const checklistResumo = checklistPainel?.resumo;
  const checklistItens = checklistPainel?.itens || [];
  const checklistTipos = checklistPainel?.tiposAutomaticos || [{ id: "manual", label: "Manual" }];
  const checklistManuais = checklistItens.filter((item) => item.tipoMeta === "manual");
  const checklistAutomaticos = checklistItens.filter((item) => item.tipoMeta !== "manual");

  async function criarItemChecklist() {
    if (!novoChecklist.titulo.trim()) {
      setChecklistErro("Informe o título da tarefa.");
      return;
    }
    setChecklistCarregando(true);
    setChecklistErro("");
    try {
      await criarChecklistMeuApi({
        titulo: novoChecklist.titulo.trim(),
        descricao: novoChecklist.descricao.trim(),
        tipo_meta: novoChecklist.tipo_meta,
        meta_diaria: Math.max(Number(novoChecklist.meta_diaria || 1), 1),
        ativo: true,
      });
      setNovoChecklist({ titulo: "", descricao: "", tipo_meta: "manual", meta_diaria: 1 });
      await carregarChecklist();
    } catch (error) {
      setChecklistErro(error instanceof Error ? error.message : "Falha ao criar tarefa.");
    } finally {
      setChecklistCarregando(false);
    }
  }

  async function atualizarManualChecklist(item: ChecklistUsuarioItemApi, proximoValor: number, concluidoManual?: boolean) {
    setChecklistSalvandoId(item.id);
    setChecklistErro("");
    try {
      await atualizarRegistroChecklistApi(item.id, {
        progresso_manual: Math.max(proximoValor, 0),
        concluido_manual: concluidoManual,
      });
      await carregarChecklist();
    } catch (error) {
      setChecklistErro(error instanceof Error ? error.message : "Falha ao atualizar tarefa.");
    } finally {
      setChecklistSalvandoId(null);
    }
  }

  async function arquivarItemChecklist(item: ChecklistUsuarioItemApi) {
    setChecklistSalvandoId(item.id);
    setChecklistErro("");
    try {
      await arquivarChecklistApi(item.id);
      await carregarChecklist();
    } catch (error) {
      setChecklistErro(error instanceof Error ? error.message : "Falha ao arquivar tarefa.");
    } finally {
      setChecklistSalvandoId(null);
    }
  }

  function iniciarEdicaoChecklist(item: ChecklistUsuarioItemApi) {
    setChecklistEditandoId(item.id);
    setChecklistEdicao({
      titulo: item.titulo,
      descricao: item.descricao || "",
      tipo_meta: item.tipoMeta,
      meta_diaria: item.metaDiaria,
    });
  }

  async function salvarEdicaoChecklist(item: ChecklistUsuarioItemApi) {
    if (!checklistEdicao.titulo.trim()) {
      setChecklistErro("Informe o título da tarefa.");
      return;
    }
    setChecklistSalvandoId(item.id);
    setChecklistErro("");
    try {
      await atualizarChecklistApi(item.id, {
        titulo: checklistEdicao.titulo.trim(),
        descricao: checklistEdicao.descricao.trim(),
        tipo_meta: checklistEdicao.tipo_meta,
        meta_diaria: Math.max(Number(checklistEdicao.meta_diaria || 1), 1),
      });
      setChecklistEditandoId(null);
      await carregarChecklist();
    } catch (error) {
      setChecklistErro(error instanceof Error ? error.message : "Falha ao salvar tarefa.");
    } finally {
      setChecklistSalvandoId(null);
    }
  }

  async function aplicarPresetChecklist(tipo: string, titulo: string, meta: number, descricao = "") {
    setChecklistCarregando(true);
    setChecklistErro("");
    try {
      await criarChecklistMeuApi({
        titulo,
        descricao,
        tipo_meta: tipo,
        meta_diaria: meta,
        ativo: true,
      });
      await carregarChecklist();
    } catch (error) {
      setChecklistErro(error instanceof Error ? error.message : "Falha ao aplicar modelo.");
    } finally {
      setChecklistCarregando(false);
    }
  }

  async function moverChecklist(item: ChecklistUsuarioItemApi, direcao: -1 | 1) {
    const grupo = item.tipoMeta === "manual" ? checklistManuais : checklistAutomaticos;
    const indice = grupo.findIndex((atual) => atual.id === item.id);
    const destino = indice + direcao;
    if (indice < 0 || destino < 0 || destino >= grupo.length) return;
    const alvo = grupo[destino];
    setChecklistSalvandoId(item.id);
    setChecklistErro("");
    try {
      await Promise.all([
        atualizarChecklistApi(item.id, { ordem: alvo.ordem }),
        atualizarChecklistApi(alvo.id, { ordem: item.ordem }),
      ]);
      await carregarChecklist();
    } catch (error) {
      setChecklistErro(error instanceof Error ? error.message : "Falha ao reordenar tarefa.");
    } finally {
      setChecklistSalvandoId(null);
    }
  }

  const renderizarPagina = () => {
    const abrirPaciente = (pacienteId: number, abaPrincipal: NavegacaoPaciente["abaPrincipal"] = "Cadastro", abrirOrcamento = false) => {
      setBuscaGlobal("");
      setNavegacaoPaciente({
        pacienteId,
        abaPrincipal,
        abrirOrcamento,
        chave: Date.now()
      });
      setMenuAtivo("Pacientes");
    };

    if (acessoModuloAtual <= 0) {
      return (
        <section className="panel empty-state">
          <span className="panel-kicker">Acesso</span>
          <h2>Sem acesso a este módulo</h2>
          <p>As permissões deste usuário não permitem abrir esta área.</p>
        </section>
      );
    }
    if (menuAtivo === "Dashboard") return <DashboardPage />;
    if (menuAtivo === "Pacientes") {
      return (
        <PacientesPage
          busca={buscaGlobal}
          onLimparBusca={() => setBuscaGlobal("")}
          navegacao={navegacaoPaciente}
          pacientesAbas={pacientesAbasUsuario}
        />
      );
    }
    if (menuAtivo === "Guias") return <GuiasPage />;
    if (menuAtivo === "Agenda") {
      return (
        <AgendaPage
          usuarioLogado={usuarioLogado}
          onAbrirPaciente={(pacienteId, destino) => {
            abrirPaciente(
              pacienteId,
              destino === "financeiro"
                ? "Financeiro"
                : destino === "ordem_servico"
                  ? "Ordem de serviço"
                  : "Cadastro",
              destino === "orcamentos"
            );
          }}
          onAbrirNovoPaciente={() => {
            setNavegacaoPaciente({
              abrirNovoPaciente: true,
              abaPrincipal: "Cadastro",
              chave: Date.now()
            });
            setMenuAtivo("Pacientes");
          }}
        />
      );
    }
    if (menuAtivo === "CRM") {
      return (
        <CRMPage
          busca={buscaGlobal}
          onAbrirPaciente={(pacienteId, destino = "Cadastro") => {
            abrirPaciente(pacienteId, destino);
          }}
        />
      );
    }
    if (menuAtivo === "Financeiro") return <FinanceiroPage />;
    if (menuAtivo === "Tabelas") return <ImportacoesPage />;
    if (menuAtivo === "Usuários") return <UsuariosPage />;
    return null;
  };

  const selecionarMenu = (key: MenuKey) => {
    setMenuAtivo(key);
    setSidebarOverlayAberta(false);
    if (key !== "Pacientes") setBuscaGlobal("");
    if (key !== "Pacientes") setNavegacaoPaciente(null);
  };

  if (!usuarioLogado) {
    return (
      <div className="login-shell">
        <section className="login-card">
          <div className="brand-logo-wrap">
            <img className="brand-logo" src={logoUrl} alt="SoulSul" />
          </div>
          <div className="login-copy">
            <span className="page-eyebrow">SoulSul ERP</span>
            <h1 className="page-title">Entrar no sistema</h1>
          </div>
          <label className="login-field">
            <span>Usuario</span>
            <input
              list="usuarios-login-list"
              value={usuarioLoginDigitado}
              onChange={(event) => setUsuarioLoginDigitado(event.target.value)}
              placeholder="Digite o nome ou login"
            />
            <datalist id="usuarios-login-list">
              {usuariosSistema.map((usuario) => (
                <option key={usuario.id} value={usuario.usuario}>
                  {usuario.nome}
                </option>
              ))}
              {usuariosSistema.map((usuario) => (
                <option key={`nome-${usuario.id}`} value={usuario.nome} />
              ))}
            </datalist>
          </label>
          <label className="login-field">
            <span>Senha</span>
            <input type="password" value={senhaLogin} onChange={(event) => setSenhaLogin(event.target.value)} />
          </label>
          <span className="login-hint">Senha padrao inicial: SOULSUL</span>
          {erroLogin ? <span className="login-error">{erroLogin}</span> : null}
          <button
            type="button"
            className="primary-action"
            onClick={async () => {
              const termo = normalizarBusca(usuarioLoginDigitado);
              const usuarioEscolhido =
                usuariosSistema.find((item) => normalizarBusca(item.usuario) === termo)
                || usuariosSistema.find((item) => normalizarBusca(item.nome) === termo)
                || null;
              const usuarioParaLogin = usuarioEscolhido?.usuario || usuarioLoginDigitado.trim();
              if (!usuarioParaLogin) {
                setErroLogin("Usuario nao configurado.");
                return;
              }
              try {
                setErroLogin("");
                const usuario = await loginApi({ usuario: usuarioParaLogin, senha: senhaLogin });
                salvarUsuarioSessao(usuario);
                setUsuarioLogado(usuario);
                setTrocaSenha({ atual: senhaLogin, nova: "", confirmar: "", erro: "" });
                setSenhaLogin("");
              } catch (error) {
                setErroLogin(error instanceof Error ? error.message : "Falha ao entrar.");
              }
            }}
          >
            Entrar
          </button>
        </section>
      </div>
    );
  }

  if (usuarioLogado.precisaTrocarSenha) {
    return (
      <div className="login-shell">
        <section className="login-card">
          <div className="brand-logo-wrap">
            <img className="brand-logo" src={logoUrl} alt="SoulSul" />
          </div>
          <div className="login-copy">
            <span className="page-eyebrow">Primeiro acesso</span>
            <h1 className="page-title">Trocar senha</h1>
          </div>
          <label className="login-field">
            <span>Nova senha</span>
            <input type="password" value={trocaSenha.nova} onChange={(event) => setTrocaSenha((atual) => ({ ...atual, nova: event.target.value }))} />
          </label>
          <label className="login-field">
            <span>Confirmar nova senha</span>
            <input type="password" value={trocaSenha.confirmar} onChange={(event) => setTrocaSenha((atual) => ({ ...atual, confirmar: event.target.value }))} />
          </label>
          {trocaSenha.erro ? <span className="login-error">{trocaSenha.erro}</span> : null}
          <button
            type="button"
            className="primary-action"
            onClick={async () => {
              if (!usuarioLogado.usuario) return;
              if (!trocaSenha.nova || trocaSenha.nova !== trocaSenha.confirmar) {
                setTrocaSenha((atual) => ({ ...atual, erro: "Confirme a nova senha corretamente." }));
                return;
              }
              try {
                const atualizado = await trocarSenhaApi({
                  usuario: usuarioLogado.usuario,
                  senha_atual: trocaSenha.atual,
                  nova_senha: trocaSenha.nova
                });
                salvarUsuarioSessao(atualizado);
                setUsuarioLogado(atualizado);
              } catch (error) {
                setTrocaSenha((atual) => ({ ...atual, erro: error instanceof Error ? error.message : "Falha ao trocar senha." }));
              }
            }}
          >
            Salvar nova senha
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className={`shell${agendaEmFoco ? " agenda-focus" : ""}`}>
      <div className="app-ambient app-ambient-one" />
      <div className="app-ambient app-ambient-two" />

      {agendaEmFoco && sidebarOverlayAberta ? (
        <button type="button" className="sidebar-overlay-backdrop" aria-label="Fechar menu" onClick={() => setSidebarOverlayAberta(false)} />
      ) : null}

      {modalMinhaSenhaAberto ? (
        <div className="overlay" role="presentation" onClick={() => setModalMinhaSenhaAberto(false)}>
          <article className="modal-shell modal-shell-compact user-password-modal" onClick={(event) => event.stopPropagation()}>
            <div className="section-title-row">
              <div>
                <span className="panel-kicker">Conta</span>
                <h2>Alterar minha senha</h2>
              </div>
            </div>
            <div className="users-password-panel">
              <label>
                <span>Senha atual</span>
                <input
                  type="password"
                  value={minhaSenha.atual}
                  onChange={(e) => setMinhaSenha((atual) => ({ ...atual, atual: e.target.value, erro: "", sucesso: "" }))}
                />
              </label>
              <label>
                <span>Nova senha</span>
                <input
                  type="password"
                  value={minhaSenha.nova}
                  onChange={(e) => setMinhaSenha((atual) => ({ ...atual, nova: e.target.value, erro: "", sucesso: "" }))}
                />
              </label>
              <label>
                <span>Confirmar nova senha</span>
                <input
                  type="password"
                  value={minhaSenha.confirmar}
                  onChange={(e) => setMinhaSenha((atual) => ({ ...atual, confirmar: e.target.value, erro: "", sucesso: "" }))}
                />
              </label>
              {minhaSenha.erro ? <p className="users-password-feedback error">{minhaSenha.erro}</p> : null}
              {minhaSenha.sucesso ? <p className="users-password-feedback success">{minhaSenha.sucesso}</p> : null}
              <div className="users-template-actions">
                <button type="button" className="ghost-action" onClick={() => setModalMinhaSenhaAberto(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="primary-action"
                  onClick={async () => {
                    if (!usuarioLogado?.usuario) return;
                    if (!minhaSenha.atual || !minhaSenha.nova || minhaSenha.nova !== minhaSenha.confirmar) {
                      setMinhaSenha((atual) => ({ ...atual, erro: "Confirme a nova senha corretamente.", sucesso: "" }));
                      return;
                    }
                    try {
                      const atualizado = await trocarSenhaApi({
                        usuario: usuarioLogado.usuario,
                        senha_atual: minhaSenha.atual,
                        nova_senha: minhaSenha.nova
                      });
                      salvarUsuarioSessao(atualizado);
                      setUsuarioLogado(atualizado);
                      setMinhaSenha({ atual: "", nova: "", confirmar: "", erro: "", sucesso: "Senha alterada com sucesso." });
                      setTimeout(() => setModalMinhaSenhaAberto(false), 800);
                    } catch (error) {
                      setMinhaSenha((atual) => ({ ...atual, erro: error instanceof Error ? error.message : "Falha ao alterar a senha.", sucesso: "" }));
                    }
                  }}
                >
                  Salvar nova senha
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {checklistAberto ? (
        <div className="drawer-backdrop" onClick={() => setChecklistAberto(false)}>
          <aside className="drawer-shell checklist-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span className="panel-kicker">Minha rotina</span>
                <h2>Checklist do dia</h2>
                <span>{checklistResumo ? `${checklistResumo.concluidos}/${checklistResumo.total} concluídas` : "Organize metas por login"}</span>
              </div>
              <button type="button" className="icon-action" onClick={() => setChecklistAberto(false)}>Fechar</button>
            </div>
            <div className="modal-body checklist-body">
              <section className="checklist-summary-grid">
                <article className="panel module-kpi-card">
                  <span className="panel-kicker">Concluídas</span>
                  <strong>{checklistResumo?.concluidos || 0}</strong>
                  <span>tarefas batidas hoje</span>
                </article>
                <article className="panel module-kpi-card">
                  <span className="panel-kicker">Pendentes</span>
                  <strong>{checklistResumo?.pendentes || 0}</strong>
                  <span>itens ainda em aberto</span>
                </article>
                <article className="panel module-kpi-card">
                  <span className="panel-kicker">Progresso</span>
                  <strong>{checklistResumo?.progressoPercentual || 0}%</strong>
                  <span>produção do dia</span>
                </article>
              </section>

              <section className="panel checklist-create-panel">
                <div className="section-title-row">
                  <div>
                    <span className="panel-kicker">Nova tarefa</span>
                    <h2>Checklist personalizável</h2>
                    <p className="agenda-inline-hint">Você define as tarefas e metas. Se for algo fora do sistema, deixe como manual para a profissional dar baixa.</p>
                  </div>
                </div>
                <div className="crm-form-grid">
                  <label>
                    <span>Título</span>
                    <input value={novoChecklist.titulo} onChange={(event) => setNovoChecklist((atual) => ({ ...atual, titulo: event.target.value }))} placeholder="Ex.: cobrar leads antigos" />
                  </label>
                  <label>
                    <span>Tipo</span>
                    <select value={novoChecklist.tipo_meta} onChange={(event) => setNovoChecklist((atual) => ({ ...atual, tipo_meta: event.target.value }))}>
                      {checklistTipos.map((tipo) => (
                        <option key={tipo.id} value={tipo.id}>{tipo.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Meta diária</span>
                    <input type="number" min={1} value={novoChecklist.meta_diaria} onChange={(event) => setNovoChecklist((atual) => ({ ...atual, meta_diaria: Number(event.target.value || 1) }))} />
                  </label>
                  <label className="crm-field-wide">
                    <span>Descrição</span>
                    <input value={novoChecklist.descricao} onChange={(event) => setNovoChecklist((atual) => ({ ...atual, descricao: event.target.value }))} placeholder="Detalhes opcionais" />
                  </label>
                </div>
                <div className="crm-inline-actions">
                  <button type="button" className="primary-action" onClick={() => void criarItemChecklist()} disabled={checklistCarregando}>
                    <Plus size={15} />
                    Adicionar tarefa
                  </button>
                </div>
              </section>

              <section className="panel checklist-create-panel">
                <div className="section-title-row">
                  <div>
                    <span className="panel-kicker">Modelos</span>
                    <h2>Modelos editáveis</h2>
                  </div>
                </div>
                <div className="checklist-preset-groups">
                  <div className="checklist-preset-group">
                    <strong>Captação</strong>
                    <div className="crm-inline-actions">
                      <button type="button" className="ghost-action" onClick={() => void aplicarPresetChecklist("crm_contatos", "Entrar em contato com leads", 60, "Baixa automática a cada atualização do funil no CRM.")}>
                        60 contatos
                      </button>
                      <button type="button" className="ghost-action" onClick={() => void aplicarPresetChecklist("crm_agendou_avaliacao", "Agendar avaliações", 10, "Conta quantos leads o usuário moveu para Agendou avaliação hoje.")}>
                        10 avaliações
                      </button>
                    </div>
                  </div>
                  <div className="checklist-preset-group">
                    <strong>Recepção</strong>
                    <div className="crm-inline-actions">
                      <button type="button" className="ghost-action" onClick={() => void aplicarPresetChecklist("manual", "Confirmar agenda do dia", 20, "Baixa manual para contatos feitos fora do sistema.")}>
                        Confirmar agenda
                      </button>
                      <button type="button" className="ghost-action" onClick={() => void aplicarPresetChecklist("manual", "Cobrar faltosos e desmarcados", 8, "Baixa manual conforme retorno da recepção.")}>
                        Cobrar faltosos
                      </button>
                    </div>
                  </div>
                  <div className="checklist-preset-group">
                    <strong>Profissional</strong>
                    <div className="crm-inline-actions">
                      <button type="button" className="ghost-action" onClick={() => void aplicarPresetChecklist("manual", "Evoluções clínicas concluídas", 12, "Baixa manual quando finalizar tarefas fora do sistema.")}>
                        Evoluções clínicas
                      </button>
                      <button type="button" className="ghost-action" onClick={() => void aplicarPresetChecklist("crm_avaliacao_enviada", "Levar avaliações ao CRM", 5, "Conta quantas avaliações foram enviadas ao CRM hoje.")}>
                        Avaliações no CRM
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {checklistErro ? <p className="users-password-feedback error">{checklistErro}</p> : null}

              <section className="checklist-items">
                {checklistCarregando ? <div className="module-subitem"><strong>Carregando checklist...</strong></div> : null}
                {!checklistCarregando ? (
                  <div className="checklist-section-block">
                    <div className="section-title-row">
                      <div>
                        <span className="panel-kicker">Tarefas fora do sistema</span>
                        <h2>Checklist manual</h2>
                      </div>
                    </div>
                    {checklistManuais.map((item) => {
                      const progressoCompleto = `${item.progressoAtual}/${item.metaDiaria}`;
                      const editando = checklistEditandoId === item.id;
                      return (
                        <article key={item.id} className={`panel checklist-item-card${item.concluido ? " done" : ""}`}>
                          {editando ? (
                            <div className="crm-form-grid">
                              <label>
                                <span>Título</span>
                                <input value={checklistEdicao.titulo} onChange={(event) => setChecklistEdicao((atual) => ({ ...atual, titulo: event.target.value }))} />
                              </label>
                              <label>
                                <span>Tipo</span>
                                <select value={checklistEdicao.tipo_meta} onChange={(event) => setChecklistEdicao((atual) => ({ ...atual, tipo_meta: event.target.value }))}>
                                  {checklistTipos.map((tipo) => (
                                    <option key={tipo.id} value={tipo.id}>{tipo.label}</option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span>Meta diária</span>
                                <input type="number" min={1} value={checklistEdicao.meta_diaria} onChange={(event) => setChecklistEdicao((atual) => ({ ...atual, meta_diaria: Number(event.target.value || 1) }))} />
                              </label>
                              <label className="crm-field-wide">
                                <span>Descrição</span>
                                <input value={checklistEdicao.descricao} onChange={(event) => setChecklistEdicao((atual) => ({ ...atual, descricao: event.target.value }))} />
                              </label>
                            </div>
                          ) : (
                            <div className="checklist-item-top">
                              <div>
                                <strong>{item.titulo}</strong>
                                <span>{tituloTipoChecklist(item.tipoMeta, checklistTipos)} · Meta {item.metaDiaria}</span>
                                {item.descricao ? <p>{item.descricao}</p> : null}
                              </div>
                              <div className="checklist-badge">{progressoCompleto}</div>
                            </div>
                          )}
                          <div className="checklist-progress-bar">
                            <span style={{ width: `${Math.min((item.progressoAtual / Math.max(item.metaDiaria, 1)) * 100, 100)}%` }} />
                          </div>
                          <div className="crm-inline-actions">
                            {editando ? (
                              <>
                                <button type="button" className="ghost-action compact" onClick={() => setChecklistEditandoId(null)} disabled={checklistSalvandoId === item.id}>Cancelar</button>
                                <button type="button" className="primary-action" onClick={() => void salvarEdicaoChecklist(item)} disabled={checklistSalvandoId === item.id}>Salvar tarefa</button>
                              </>
                            ) : (
                              <>
                                <button type="button" className="ghost-action compact" onClick={() => void moverChecklist(item, -1)} disabled={checklistSalvandoId === item.id}>↑</button>
                                <button type="button" className="ghost-action compact" onClick={() => void moverChecklist(item, 1)} disabled={checklistSalvandoId === item.id}>↓</button>
                                <button type="button" className="ghost-action compact" onClick={() => void atualizarManualChecklist(item, item.progressoManual - 1, false)} disabled={checklistSalvandoId === item.id || item.progressoManual <= 0}>-1</button>
                                <button type="button" className="ghost-action compact" onClick={() => void atualizarManualChecklist(item, item.progressoManual + 1, item.progressoManual + 1 >= item.metaDiaria)} disabled={checklistSalvandoId === item.id}>+1</button>
                                <button type="button" className="primary-action" onClick={() => void atualizarManualChecklist(item, item.metaDiaria, !item.concluidoManual)} disabled={checklistSalvandoId === item.id}>
                                  <CheckSquare2 size={15} />
                                  {item.concluidoManual ? "Reabrir" : "Dar baixa"}
                                </button>
                                <button type="button" className="ghost-action compact" onClick={() => iniciarEdicaoChecklist(item)} disabled={checklistSalvandoId === item.id}>Editar</button>
                              </>
                            )}
                            <button type="button" className="ghost-action compact" onClick={() => void arquivarItemChecklist(item)} disabled={checklistSalvandoId === item.id}>
                              <Trash2 size={14} />
                              Arquivar
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    {!checklistManuais.length ? <div className="module-subitem"><strong>Nenhuma tarefa manual cadastrada.</strong></div> : null}
                  </div>
                ) : null}
                {!checklistCarregando ? (
                  <div className="checklist-section-block">
                    <div className="section-title-row">
                      <div>
                        <span className="panel-kicker">Metas rastreadas</span>
                        <h2>Checklist automático</h2>
                      </div>
                    </div>
                    {checklistAutomaticos.map((item) => {
                      const progressoCompleto = `${item.progressoAtual}/${item.metaDiaria}`;
                      const editando = checklistEditandoId === item.id;
                      return (
                        <article key={item.id} className={`panel checklist-item-card${item.concluido ? " done" : ""}`}>
                          {editando ? (
                            <div className="crm-form-grid">
                              <label>
                                <span>Título</span>
                                <input value={checklistEdicao.titulo} onChange={(event) => setChecklistEdicao((atual) => ({ ...atual, titulo: event.target.value }))} />
                              </label>
                              <label>
                                <span>Tipo</span>
                                <select value={checklistEdicao.tipo_meta} onChange={(event) => setChecklistEdicao((atual) => ({ ...atual, tipo_meta: event.target.value }))}>
                                  {checklistTipos.map((tipo) => (
                                    <option key={tipo.id} value={tipo.id}>{tipo.label}</option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span>Meta diária</span>
                                <input type="number" min={1} value={checklistEdicao.meta_diaria} onChange={(event) => setChecklistEdicao((atual) => ({ ...atual, meta_diaria: Number(event.target.value || 1) }))} />
                              </label>
                              <label className="crm-field-wide">
                                <span>Descrição</span>
                                <input value={checklistEdicao.descricao} onChange={(event) => setChecklistEdicao((atual) => ({ ...atual, descricao: event.target.value }))} />
                              </label>
                            </div>
                          ) : (
                            <div className="checklist-item-top">
                              <div>
                                <strong>{item.titulo}</strong>
                                <span>{tituloTipoChecklist(item.tipoMeta, checklistTipos)} · Meta {item.metaDiaria}</span>
                                {item.descricao ? <p>{item.descricao}</p> : null}
                              </div>
                              <div className="checklist-badge">{progressoCompleto}</div>
                            </div>
                          )}
                          <div className="checklist-progress-bar">
                            <span style={{ width: `${Math.min((item.progressoAtual / Math.max(item.metaDiaria, 1)) * 100, 100)}%` }} />
                          </div>
                          <div className="crm-inline-actions">
                            {editando ? (
                              <>
                                <button type="button" className="ghost-action compact" onClick={() => setChecklistEditandoId(null)} disabled={checklistSalvandoId === item.id}>Cancelar</button>
                                <button type="button" className="primary-action" onClick={() => void salvarEdicaoChecklist(item)} disabled={checklistSalvandoId === item.id}>Salvar tarefa</button>
                              </>
                            ) : (
                              <>
                                <button type="button" className="ghost-action compact" onClick={() => void moverChecklist(item, -1)} disabled={checklistSalvandoId === item.id}>↑</button>
                                <button type="button" className="ghost-action compact" onClick={() => void moverChecklist(item, 1)} disabled={checklistSalvandoId === item.id}>↓</button>
                                <span className="agenda-inline-hint">Baixa automática conforme ações do usuário no sistema.</span>
                                <button type="button" className="ghost-action compact" onClick={() => iniciarEdicaoChecklist(item)} disabled={checklistSalvandoId === item.id}>Editar</button>
                              </>
                            )}
                            <button type="button" className="ghost-action compact" onClick={() => void arquivarItemChecklist(item)} disabled={checklistSalvandoId === item.id}>
                              <Trash2 size={14} />
                              Arquivar
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    {!checklistAutomaticos.length ? <div className="module-subitem"><strong>Nenhuma meta automática cadastrada.</strong></div> : null}
                  </div>
                ) : null}
                {!checklistCarregando && !checklistItens.length ? <div className="module-subitem"><strong>Nenhuma tarefa cadastrada para este login.</strong></div> : null}
              </section>
            </div>
          </aside>
        </div>
      ) : null}

      <aside className={`sidebar${agendaEmFoco ? " sidebar-floating" : ""}${sidebarOverlayAberta ? " open" : ""}`}>
        <div className="brand-card">
          <div className="brand-logo-wrap">
            <img className="brand-logo" src={logoUrl} alt="SoulSul" />
          </div>
          <div className="brand-title">SoulSul</div>
        </div>

        <div className="sidebar-section-title">Menu</div>
        <nav className="menu-list">
          {menuDisponivel.map((item) => (
            <button key={item.key} className={`menu-item${menuAtivo === item.key ? " active" : ""}`} type="button" onClick={() => selecionarMenu(item.key)}>
              <span className="menu-icon">{item.icon}</span>
              <span className="menu-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-user-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">{inicialUsuario}</div>
            <div className="sidebar-user-info">
              <span>Logado</span>
              <strong>{usuarioLogado.nome}</strong>
            </div>
          </div>
          <button
            type="button"
            className="ghost-action sidebar-logout"
            onClick={() => {
              setMinhaSenha({ atual: "", nova: "", confirmar: "", erro: "", sucesso: "" });
              setModalMinhaSenhaAberto(true);
            }}
          >
            Alterar senha
          </button>
          <button
            type="button"
            className="ghost-action sidebar-logout"
            onClick={() => {
              salvarUsuarioSessao(null);
              setUsuarioLogado(null);
              setSidebarOverlayAberta(false);
              setErroLogin("");
              setSenhaLogin("");
            }}
          >
            <LogOut size={14} />
            Deslogar
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            {agendaEmFoco ? (
              <button type="button" className="topbar-menu-toggle" aria-label="Abrir menu" onClick={() => setSidebarOverlayAberta((atual) => !atual)}>
                <Menu size={18} />
              </button>
            ) : null}
            <div className="page-title-wrap">
              <span className="page-eyebrow">SoulSul ERP</span>
              <h1 className="page-title">{paginaAtual.titulo}</h1>
            </div>
          </div>

          <div className="topbar-right">
            <label className="search-box">
              <Search size={18} />
              <input type="text" placeholder={paginaAtual.busca} value={buscaGlobal} onChange={(event) => setBuscaGlobal(event.target.value)} />
            </label>
            <button type="button" className="ghost-action checklist-topbar-button" onClick={() => setChecklistAberto(true)}>
              <CheckSquare2 size={16} />
              {checklistResumo ? `Rotina ${checklistResumo.concluidos}/${checklistResumo.total}` : "Minha rotina"}
            </button>
            <div className="header-user">
              <div className="header-user-text">
                <span className="header-user-kicker">{usuarioLogado.cargo || "Usuario"}</span>
                <strong>{usuarioLogado.nome}</strong>
              </div>
              <div className="header-avatar">{inicialUsuario}</div>
            </div>
          </div>
        </header>
        {renderizarPagina()}
      </main>
    </div>
  );
}

export default App;

