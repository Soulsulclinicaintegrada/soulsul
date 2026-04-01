import { ArrowUpRight, Sparkles } from "lucide-react";

type PlaceholderPageProps = {
  titulo: string;
  descricao: string;
  blocos: Array<{
    titulo: string;
    texto: string;
  }>;
};

export function PlaceholderPage({ titulo, descricao, blocos }: PlaceholderPageProps) {
  return (
    <section className="placeholder-shell">
      <div className="placeholder-hero panel">
        <div className="placeholder-kicker">
          <Sparkles size={16} />
          <span>Nova interface em construção</span>
        </div>
        <h2>{titulo}</h2>
        <p>{descricao}</p>
      </div>

      <div className="placeholder-grid">
        {blocos.map((bloco) => (
          <article key={bloco.titulo} className="placeholder-card panel">
            <div className="placeholder-card-head">
              <strong>{bloco.titulo}</strong>
              <ArrowUpRight size={16} />
            </div>
            <p>{bloco.texto}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
