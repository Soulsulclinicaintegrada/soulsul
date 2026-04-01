const STORAGE_KEY = "soulsul_usuario_logado";

export type UsuarioSessao = {
  id: number;
  nome: string;
  usuario: string;
  perfil: string;
  cargo?: string;
  agendaEscopo?: string;
  agendaDisponivel?: boolean;
  nomeAgenda?: string;
  modulos?: Record<string, string>;
  pacientesAbas?: Record<string, string>;
  precisaTrocarSenha?: boolean;
};

export function salvarUsuarioSessao(usuario: UsuarioSessao | null) {
  if (!usuario) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));
}

export function carregarUsuarioSessao(): UsuarioSessao | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UsuarioSessao;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function nomeUsuarioCabecalho() {
  const usuario = carregarUsuarioSessao();
  return usuario?.usuario || usuario?.nome || "";
}
