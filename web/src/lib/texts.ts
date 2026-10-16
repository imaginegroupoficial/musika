// Textos do site que o admin pode trocar em /admin (aba Textos).
// {preco}, {dias} e {artista} são trocados pelo valor certo na hora de mostrar.
export const TEXTS = {
  meta_title: { group: 'Geral', label: 'Título do site no Google', value: 'Paredão Play: sua música, sem limites' },
  meta_description: { group: 'Geral', label: 'Descrição no Google', value: 'Os lançamentos do piseiro, forró, arrocha, sertanejo, funk e pagode. Ouça grátis, baixe, ganhe pontos e apareça no ranking de fãs do seu artista.' },
  footer_text: { group: 'Geral', label: 'Rodapé', value: 'Paredão Play. Música é o que nos move.' },
  nav_artist_cta: { group: 'Geral', label: 'Botão para artistas no menu', value: 'Sou artista' },

  brand_tagline: { group: 'Geral', label: 'Slogan (rodapé e e-mails)', value: 'Sua música, sem limites.' },
  home_brand_kicker: { group: 'Página inicial', label: 'Chamada do topo: selo', value: 'Música' },
  home_brand_title: { group: 'Página inicial', label: 'Chamada do topo: título', value: 'Aqui o paredão não para!' },
  home_brand_text: { group: 'Página inicial', label: 'Chamada do topo: texto', value: 'As melhores músicas, lançamentos e os maiores sucessos, tudo em um só lugar.' },
  home_brand_cta: { group: 'Página inicial', label: 'Chamada do topo: botão', value: 'Ouvir agora' },
  home_hero_label: { group: 'Página inicial', label: 'Selo do destaque', value: 'Em destaque' },
  home_hero_play: { group: 'Página inicial', label: 'Botão do destaque', value: 'Tocar o CD' },
  home_row_trending: { group: 'Página inicial', label: 'Fileira de estourados', value: 'Em alta' },
  home_row_sponsored: { group: 'Página inicial', label: 'Fileira de patrocinados', value: 'Patrocinados' },
  home_row_top: { group: 'Página inicial', label: 'Fileira de mais ouvidos', value: 'Mais ouvidos da semana' },
  home_row_latest: { group: 'Página inicial', label: 'Fileira de lançamentos', value: 'Lançamentos' },
  home_tracks_title: { group: 'Página inicial', label: 'Título das faixas', value: 'Faixas mais tocadas' },
  home_artists_title: { group: 'Página inicial', label: 'Título dos artistas novos', value: 'Artistas novos no Paredão Play' },
  home_empty_title: { group: 'Página inicial', label: 'Título sem lançamentos', value: 'O paredão ainda está montando.' },
  home_empty_text: { group: 'Página inicial', label: 'Texto sem lançamentos', value: 'Nenhum CD publicado por enquanto. Se você é artista, suba seu repertório agora: o primeiro lançamento aparece aqui no topo da página.' },
  home_empty_cta: { group: 'Página inicial', label: 'Botão sem lançamentos', value: 'Publicar meu CD' },

  cd_early_bonus: { group: 'Página do CD', label: 'Aviso de bônus de lançamento', value: 'Ouça até o fim nas primeiras 48 h e ganhe 10 pontos extras' },

  ranking_title: { group: 'Ranking', label: 'Título', value: 'Ranking de fãs' },
  ranking_intro: { group: 'Ranking', label: 'Texto', value: 'Ganhe pontos ouvindo faixas até o fim, chegando cedo nos lançamentos, mantendo a sequência diária e trazendo amigos pelo seu link.' },

  premium_title: { group: 'Premium', label: 'Título', value: 'Ouça sem parar.' },
  premium_intro: { group: 'Premium', label: 'Texto', value: 'O Paredão Play é grátis para sempre. O Premium tira os anúncios e dobra seus pontos por {preco} a cada {dias} dias, pago no Pix. Sem renovação automática e sem fidelidade.' },
  premium_perks: { group: 'Premium', label: 'Benefícios (um por linha: Título | descrição)', value: 'Sem anúncios | Nada de áudio entre as faixas nem banner na tela.\nPontos em dobro | Cada faixa ouvida até o fim vale 2 pontos no ranking do seu artista.\nSelo Premium | Aparece no seu perfil e no ranking de fãs.\nApoio direto | Parte do valor sustenta o espaço gratuito dos artistas independentes.' },
  player_ad_upsell: { group: 'Premium', label: 'Link no anúncio do player', value: 'Ouvir sem anúncios' },

  ads_title: { group: 'Anunciantes', label: 'Título', value: 'Sua marca no ouvido de quem ama paredão.' },
  ads_intro: { group: 'Anunciantes', label: 'Texto', value: 'Anuncie em áudio entre as faixas ou em banner nas páginas mais vistas. Escolha estilo musical e estado, defina o orçamento e pague no Pix. Você só gasta quando o anúncio aparece.' },
  ads_slot_title: { group: 'Anunciantes', label: 'Espaço vazio de banner: título', value: 'Sua marca aqui' },
  ads_slot_text: { group: 'Anunciantes', label: 'Espaço vazio de banner: texto', value: 'Anuncie para quem ouve forró, piseiro e arrocha todos os dias.' },

  login_title: { group: 'Conta', label: 'Título de entrar', value: 'Bem-vindo de volta.' },
  login_text: { group: 'Conta', label: 'Texto de entrar', value: 'Seus pontos, curtidas e artistas seguidos estão te esperando.' },
  signup_title: { group: 'Conta', label: 'Título de criar conta', value: 'Crie sua conta e comece a pontuar.' },
  signup_text: { group: 'Conta', label: 'Texto de criar conta', value: 'Cada faixa ouvida até o fim vale ponto no ranking do seu artista.' },

  telao_title: { group: 'Shows', label: 'Título do telão', value: 'Aponte a câmera e ganhe 50 pontos' },
  telao_hint: { group: 'Shows', label: 'Dica do telão', value: 'Sem câmera? Entre em {site}/show e digite o código' },
} as const;

export type TextKey = keyof typeof TEXTS;
export type Texts = Record<TextKey, string>;

export function mergeTexts(overrides: Record<string, unknown> | null | undefined): Texts {
  const out = {} as Texts;
  for (const k of Object.keys(TEXTS) as TextKey[]) {
    const v = overrides?.[k];
    out[k] = typeof v === 'string' && v.trim() ? v : TEXTS[k].value;
  }
  return out;
}

export function fill(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}
