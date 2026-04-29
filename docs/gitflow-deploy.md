# Git Flow e Deploy do Frontend

Este projeto usa Git Flow classico e deploy automatico do frontend quando ha push na branch `main`.

## Fluxo de branches

- `feature/*`: desenvolvimento de funcionalidades.
- `develop`: integracao continua das features.
- `release/*`: estabilizacao e preparacao para producao.
- `main`: branch de producao.

Fluxo recomendado:

1. Criar branch `feature/*` a partir de `develop`.
2. Abrir PR para `develop`.
3. Quando for preparar release, criar `release/*` a partir de `develop`.
4. Abrir PR de `release/*` para `main`.
5. Ao fazer merge em `main`, o deploy do frontend e disparado automaticamente.
6. Depois da release, fazer merge de volta para `develop` para manter historico alinhado.

## Workflow de deploy

Arquivo: `.github/workflows/frontend-deploy.yml`

Gatilhos:

- `push` na branch `main` (somente quando houver alteracao em `frontend/**` ou no proprio workflow).
- `workflow_dispatch` para disparo manual.

O job faz:

1. Executa no runner self-hosted (na sua tailnet/servidor).
2. Roda `git fetch`, `git checkout main`, `git pull --ff-only` no caminho configurado.
3. Atualiza o frontend com `docker compose build --pull web` e `docker compose up -d --remove-orphans web`.
4. Roda `docker compose ps`.
5. Executa health check HTTP; se falhar, o workflow falha.

## Secrets obrigatorios no GitHub

Configure em **Settings > Secrets and variables > Actions**:
- `DEPLOY_PATH`: caminho absoluto do repositorio no servidor (ex.: `/home/delsuc-linux/WhatsAppConnect`).

Variavel opcional de ambiente do repositorio:

- `FRONTEND_HEALTH_URL`: URL para health check no servidor (padrao `http://127.0.0.1:4173/`).

## Checklist de validacao inicial

1. Existe um GitHub self-hosted runner online no repositorio.
2. O repositorio existe em `DEPLOY_PATH`.
3. O Docker e Docker Compose estao instalados no servidor.
4. O comando `docker compose up -d --build` funciona dentro de `frontend/`.
5. A URL de health retorna HTTP 200 localmente no servidor.

## Setup rapido do self-hosted runner (Linux)

No GitHub: **Settings > Actions > Runners > New self-hosted runner** e copie os comandos.

No servidor Linux, execute o setup do runner (exemplo):

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64.tar.gz
tar xzf ./actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/iagogaldino/saas-whats-connect-delsuc --token <TOKEN>
sudo ./svc.sh install
sudo ./svc.sh start
```

Depois confirme no GitHub que o runner aparece como **Idle/Online**.

## Rollback operacional rapido

No servidor:

```bash
cd /caminho/do/repositorio
git log --oneline -n 5
git checkout <commit-ou-tag-anterior>
cd frontend
docker compose up -d --build web
```

Depois, corrija o problema e faca novo deploy em `main`.
