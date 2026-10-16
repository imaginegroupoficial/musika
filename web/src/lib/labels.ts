export const GENRES = ['Forró', 'Piseiro', 'Arrocha', 'Sertanejo', 'Brega', 'Pagode', 'Axé', 'Funk', 'Seresta', 'Vaquejada', 'Gospel', 'Outro'];
export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export const campaignStatus: Record<string, { text: string; cls: string }> = {
  draft: { text: 'Rascunho', cls: 'bg-palco text-nevoa' },
  pending_payment: { text: 'Aguardando pagamento', cls: 'bg-sol/20 text-sol' },
  pending_review: { text: 'Em análise', cls: 'bg-sol/20 text-sol' },
  active: { text: 'Rodando', cls: 'bg-mandacaru/20 text-mandacaru' },
  paused: { text: 'Pausada', cls: 'bg-palco text-luar' },
  rejected: { text: 'Recusada', cls: 'bg-chita/20 text-chita' },
  ended: { text: 'Encerrada', cls: 'bg-palco text-nevoa' },
};

export const placementLabel: Record<string, string> = {
  home_hero: 'Destaque principal da página inicial',
  home_row: 'Fileira patrocinada da página inicial',
  search: 'Topo da busca',
};
