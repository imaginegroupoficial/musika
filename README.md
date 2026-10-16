# Musika

Plataforma de música para artistas independentes e seus fãs: player rápido em HLS, CDs e singles, tops por janela de tempo, busca que entende erro de digitação, download liberado pelo artista, gamificação (pontos, níveis, sequência diária, ranking de fãs por artista, insígnias, pontos por indicação) e o Studio do artista (upload pelo celular, conversão automática, painel com plays, ouvintes, horário de pico, origem dos plays e top fãs).

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
git clone https://github.com/SEU-USUARIO/musika /opt/musika && ACME_EMAIL=seu@email.com bash /opt/musika/infra/install.sh
```

O script instala o Docker, libera as portas 80 e 443 (desativa o nginx nativo da Hostinger), sobe o Supabase com chaves novas, aplica as migrations, constrói o site e o worker e agenda backup diário do banco. No final ele imprime o usuário e a senha do painel do Supabase.

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

## Limites conhecidos desta versão

- E-mail: o cadastro entra direto, sem confirmação. Para recuperar senha por e-mail, configure SMTP em `/opt/musika-supabase/.env` (variáveis `SMTP_*`) e rode o install de novo.
- Os links de áudio HLS são públicos (endereços longos e imprevisíveis). Proteção contra uso em outros sites e assinatura de URL ficam para a próxima fase.
- Ainda não há: playlists criadas pelo fã, comentários, missões do artista, loja de recompensas, impulsionamento pago, check-in em show e app nas lojas. O banco já foi desenhado para receber esses módulos.
- Cidade do ouvinte não é registrada (exige serviço de geolocalização por IP).
