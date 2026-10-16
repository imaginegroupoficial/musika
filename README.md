# Musika

Plataforma de música para artistas independentes e seus fãs.

- **Ouvinte**: player rápido em HLS com fila, letra e controles na tela de bloqueio; tops, estourados e busca que entende erro de digitação; download liberado pelo artista; playlists (inclusive colaborativas); comentários marcando o momento da música; ouvir junto em tempo real com chat; card de story; retrospectiva do ano e do São João; Premium sem anúncios.
- **Gamificação**: pontos, níveis, sequência diária, ranking de fãs por artista e geral, insígnias, pontos por indicação, missões do artista, check-in por QR no show e recompensas trocadas por pontos.
- **Artista (Studio)**: upload pelo celular com conversão automática, edição de faixas e letras, painel de dados, agenda com telão de check-in, missões, recompensas e resgates, fã-clube pago com mural exclusivo, impulsionamento pago de lançamento e equipe com convite por link.
- **Anúncios (rede própria)**: áudio entre faixas e banners, segmentação por estilo e estado, cobrança por CPM com orçamento pré-pago, análise antes de ir ao ar e relatório para o anunciante.
- **Pagamentos**: Pix via Pagar.me para Premium, fã-clube, impulsionamento e campanhas.
- **Administração** (`/admin`): visão geral e receita, aprovação de campanhas, pagamentos, verificação de artistas, denúncias, repasses do fã-clube, banners da casa, aparência (tema, cores, nome e logo), textos do site e preços.
- **Identidade**: tema Cartaz (claro, azul elétrico e rosa) com a fonte Archivo esticada como letra de cartaz de show, hospedada no próprio servidor. Temas Noite de São João e Paredão (escuros) prontos no admin.

Tudo roda numa VPS só (Hostinger KVM 8, Ubuntu 24.04) com o domínio `musika.tech`.

## O que sobe na VPS

| Serviço | Endereço | Função |
| --- | --- | --- |
| Traefik | portas 80 e 443 | HTTPS automático (Let's Encrypt) para todos os subdomínios |
| Site (Next.js 14) | https://musika.tech | Páginas, player, Studio, API de plays e downloads |
| Supabase self-hosted | https://db.musika.tech | Banco Postgres, login, storage dos originais e capas, painel |
| Worker (Node + FFmpeg) | interno | Converte cada faixa enviada em HLS 64 e 128 kbps |
| Mídia (nginx) | https://media.musika.tech | Entrega o áudio com cache longo |

## Instalação

1. No DNS do domínio, crie registros **A** para `musika.tech`, `www`, `db` e `media` apontando para o IP da VPS.
2. Suba este código num repositório Git (GitHub privado, por exemplo).
3. No console da Hostinger, como root, rode uma linha só:

```
git clone https://github.com/imaginegroupoficial/musika /opt/musika && ACME_EMAIL=musikafarm@proton.me PAGARME_SECRET_KEY=sk_SUA_CHAVE bash /opt/musika/infra/install.sh
```

`ADMIN_EMAIL` é opcional (padrão: o mesmo do `ACME_EMAIL`). A conta criada no site com esse e-mail vira administradora. Sem `PAGARME_SECRET_KEY` o site funciona, só os pagamentos ficam desligados; dá para rodar de novo depois só com a chave.

O script instala o Docker, libera as portas 80 e 443 (desativa o nginx nativo da Hostinger), sobe o Supabase com chaves novas, aplica as migrations, constrói o site e o worker e agenda backup diário do banco. No final ele imprime o usuário e a senha do painel do Supabase.

Depois da instalação, cadastre o webhook no painel do Pagar.me com o endereço que o script imprime no final (eventos `order.paid` e `charge.paid`). Mesmo sem webhook, a tela do Pix confirma o pagamento consultando o Pagar.me a cada 4 segundos.

Para atualizar depois de mudar o código:

```
cd /opt/musika && git pull && bash infra/install.sh
```

Rodar de novo é seguro: migrations já aplicadas são puladas.

## Primeiro uso

1. Abra https://musika.tech, clique em **Entrar** e crie sua conta.
2. Vá em **Sou artista**, crie o perfil e clique em **Publicar lançamento**.
3. Envie a capa e as faixas. A página do Studio mostra a conversão; quando termina, o CD aparece na página inicial.
4. Para dar o selo de verificado: no painel do Supabase, tabela `artists`, marque `verified`.

## Gamificação

| Ação | Pontos | Trava |
| --- | --- | --- |
| Ouvir uma faixa até 70% | 1 | Até 50 por artista por dia; repetir a mesma faixa em sequência não conta |
| Ouvir um lançamento nas primeiras 48 h | 10 | Uma vez por lançamento |
| Sequência diária | 2 a 10 | Cresce a cada dia seguido |
| Amigo ouviu pelo seu link | 5 | Uma vez por amigo por lançamento |

Níveis: Ouvinte (0), Fã (50), Fã de Carteirinha (200), Paredão (600), Lenda (1500). Insígnias: Pioneiro, Maratona, Fiel e Divulgador. Os pontos só são gravados pelo banco (função `record_play`); o navegador não consegue alterar XP.

## Estrutura

```
docker-compose.yml        site, worker, mídia e Traefik
infra/install.sh          instalação completa em uma linha
infra/nginx-media.conf    entrega do áudio
supabase/migrations/      schema, funções, gamificação, RLS e storage
worker/                   conversão de áudio (FFmpeg)
web/                      site Next.js
```

## Operação

- Logs: `docker logs -f musika-web`, `docker logs -f musika-worker`
- Segredos: `/opt/musika-supabase/.env` (guarde uma cópia fora da VPS)
- Backups do banco: `/opt/musika-backups`, 14 dias. Copie para fora da VPS.
- Áudio convertido: volume Docker `musika_media`. Os originais ficam no storage do Supabase (`/opt/musika-supabase/volumes/storage`).
- Disco: acompanhe com `df -h`. Quando passar de 70%, é hora de mover o áudio para um object storage com CDN.

## Preços padrão (mudam em /admin, aba Preços e regras)

| Item | Padrão |
| --- | --- |
| Premium | R$ 9,90 por 30 dias |
| Anúncio em áudio | R$ 25 por mil execuções |
| Banner | R$ 8 por mil exibições |
| Campanha mínima | R$ 50 |
| Anúncio em áudio | a cada 3 faixas para quem não é Premium |
| Impulsionamento por dia | destaque R$ 49,90, fileira R$ 19,90, busca R$ 9,90 |
| Taxa do Musika no fã-clube | 15% |

## Limites conhecidos desta versão

- E-mail: o cadastro entra direto, sem confirmação. Para recuperar senha por e-mail, configure SMTP em `/opt/musika-supabase/.env` (variáveis `SMTP_*`) e rode o install de novo.
- Os links de áudio HLS são públicos (endereços longos e imprevisíveis). Proteção contra uso em outros sites e assinatura de URL ficam para a próxima fase.
- Pagamento só por Pix, sem cartão nem renovação automática: Premium e fã-clube valem 30 dias por pagamento.
- O repasse do fã-clube ao artista é manual (Pix feito por você e marcado em /admin). O split automático do Pagar.me exige cadastrar cada artista como recebedor.
- Ouvir junto depende do Realtime do Supabase, que já sobe com a instalação.
- App nas lojas ainda não: o site instala como app (PWA) no celular.
- Cidade do ouvinte não é registrada (exige serviço de geolocalização por IP).
