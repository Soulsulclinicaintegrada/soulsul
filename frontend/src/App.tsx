import { LogOut, Menu, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import logoUrl from "../../assets/sou sul marca preta fundo.png";
import { carregarUsuarioSessao, salvarUsuarioSessao, type UsuarioSessao } from "./auth";
import { AgendaPage } from "./AgendaPage";
import { DashboardPage } from "./DashboardPage";
import { FinanceiroPage } from "./FinanceiroPage";
import { ImportacoesPage } from "./ImportacoesPage";
import { menuItems, type MenuKey } from "./mockData";
import { PacientesPage } from "./PacientesPage";
import { listarUsuariosApi, loginApi, trocarSenhaApi, type UsuarioResumoApi } from "./pacientesApi";
import { UsuariosPage } from "./UsuariosPage";

type NavegacaoPaciente = {
  pacienteId?: number;
  abaPrincipal?: "Cadastro" | "Financeiro" | "Agendamentos";
  abaClinica?: "Plano e ficha clinica" | "Odontograma" | "Anamnese" | "Especialidades";
  abrirOrcamento?: boolean;
  abrirNovoPaciente?: boolean;
  chave: number;
};

const MENU_TO_MODULO: Record<MenuKey, string> = {
  Dashboard: "Dashboard",
  Pacientes: "Pacientes",
  Agenda: "Agenda",
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

function permissoesPadraoSessao(usuario?: UsuarioSessao | null) {
  const cargo = String(usuario?.cargo || "").trim().toLowerCase();
  const perfil = String(usuario?.perfil || "").trim().toLowerCase();
  const modulos: Record<string, string> = {
    Dashboard: "Sem acesso",
    Pacientes: "Sem acesso",
    Agenda: "Sem acesso",
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
    modulos.Agenda = "Visualizacao";
    pacientesAbas.Documentos = "Edicao";
    pacientesAbas["Plano e Ficha Clinica"] = "Visualizacao";
    pacientesAbas.Odontograma = "Visualizacao";
    pacientesAbas.Agendamentos = "Visualizacao";
    return { modulos, pacientesAbas };
  }
  modulos.Dashboard = "Visualizacao";
  modulos.Pacientes = "Edicao";
  modulos.Agenda = "Edicao";
  modulos.Financeiro = "Visualizacao";
  pacientesAbas.Cadastro = "Edicao";
  pacientesAbas.Orcamentos = "Visualizacao";
  pacientesAbas.Financeiro = "Visualizacao";
  pacientesAbas.Documentos = "Visualizacao";
  pacientesAbas.Agendamentos = "Edicao";
  return { modulos, pacientesAbas };
}

function App() {
  const [menuAtivo, setMenuAtivo] = useState<MenuKey>("Dashboard");
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

  const agendaEmFoco = menuAtivo === "Agenda";
  const inicialUsuario = usuarioLogado?.nome?.trim()?.slice(0, 1)?.toUpperCase() || "U";
  const permissoesSessao = useMemo(() => permissoesPadraoSessao(usuarioLogado), [usuarioLogado]);
  const modulosUsuario = usuarioLogado?.modulos && Object.keys(usuarioLogado.modulos).length ? usuarioLogado.modulos : permissoesSessao.modulos;
  const pacientesAbasUsuario =
    usuarioLogado?.pacientesAbas && Object.keys(usuarioLogado.pacientesAbas).length
      ? usuarioLogado.pacientesAbas
      : permissoesSessao.pacientesAbas;
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
    if (!usuarioLogado) return;
    if (acessoModuloAtual > 0) return;
    const primeiroModulo = menuDisponivel[0]?.key;
    if (primeiroModulo && primeiroModulo !== menuAtivo) {
      setMenuAtivo(primeiroModulo);
    }
  }, [acessoModuloAtual, menuAtivo, menuDisponivel, usuarioLogado]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const usuarios = await listarUsuariosApi();
        if (cancelado) return;
        setUsuariosSistema(usuarios);
        setUsuarioLoginDigitado((atual) => atual || usuarios[0]?.usuario || usuarios[0]?.nome || "");
      } catch {
        if (cancelado) return;
        setUsuariosSistema([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const paginaAtual = useMemo(() => {
    if (menuAtivo === "Dashboard") return { titulo: "Dashboard Executivo", busca: "Buscar paciente, contrato, venda ou vencimento..." };
    if (menuAtivo === "Pacientes") return { titulo: "Pacientes", busca: "Buscar paciente, prontuario, telefone ou CPF..." };
    if (menuAtivo === "Agenda") return { titulo: "Agenda Clinica", busca: "Buscar paciente, profissional, procedimento ou horario..." };
    if (menuAtivo === "Financeiro") return { titulo: "Financeiro", busca: "Buscar recebivel, conta a pagar, categoria ou vencimento..." };
    if (menuAtivo === "Tabelas") return { titulo: "Tabelas", busca: "Buscar procedimento, categoria ou valor..." };
    return { titulo: "Usuarios", busca: "Buscar usuario, perfil ou permissao..." };
  }, [menuAtivo]);

  const renderizarPagina = () => {
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
      return <PacientesPage busca={buscaGlobal} navegacao={navegacaoPaciente} pacientesAbas={pacientesAbasUsuario} />;
    }
    if (menuAtivo === "Agenda") {
      return (
        <AgendaPage
          usuarioLogado={usuarioLogado}
          onAbrirPaciente={(pacienteId, destino) => {
            setNavegacaoPaciente({
              pacienteId,
              abaPrincipal: destino === "financeiro" ? "Financeiro" : "Cadastro",
              abrirOrcamento: destino === "orcamentos",
              chave: Date.now()
            });
            setMenuAtivo("Pacientes");
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
    if (menuAtivo === "Financeiro") return <FinanceiroPage />;
    if (menuAtivo === "Tabelas") return <ImportacoesPage />;
    if (menuAtivo === "Usuários") return <UsuariosPage />;
    return null;
  };

  const selecionarMenu = (key: MenuKey) => {
    setMenuAtivo(key);
    setSidebarOverlayAberta(false);
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
              const termo = usuarioLoginDigitado.trim().toLowerCase();
              const usuarioEscolhido =
                usuariosSistema.find((item) => item.usuario.toLowerCase() === termo)
                || usuariosSistema.find((item) => item.nome.toLowerCase() === termo)
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

