# Hospedagem (opcional)

A lauda **não exige deploy** nesta fase. Este guia serve para deixar a API e o painel acessíveis por um link público, por exemplo para a correção ou para o vídeo.

## Opção 1: Render (gratuito, usa o `render.yaml`)

O plano gratuito do Render roda serviços Docker e tem PostgreSQL gratuito.

**Limitações do plano gratuito:**
- O serviço "dorme" após 15 min sem acesso, e o primeiro acesso depois disso leva cerca de 1 min.
- O PostgreSQL gratuito **expira 30 dias após a criação**. Antes disso, dá para recriar, migrar para o Neon ou usar um plano pago.

### Passos

1. Suba este repositório para o GitHub (público ou privado).
2. Em https://dashboard.render.com, clique em **New → Blueprint** e selecione o repositório.
3. O Render lê o `render.yaml` e propõe três recursos: `quimiport-db`, `quimiport-api` e `quimiport-web`.
4. Ele vai pedir o valor de **`VITE_API_URL`**. Informe `https://quimiport-api.onrender.com`, ou a URL que o Render mostrar para a API, caso esse nome já esteja em uso.
5. Clique em **Apply**. A API aplica as migrations e o seed sozinha ao subir.
6. Teste:
   - `https://quimiport-api.onrender.com/health`
   - `https://quimiport-api.onrender.com/docs`
   - `https://quimiport-web.onrender.com`

Se a URL final da API for diferente da que você informou, ajuste `VITE_API_URL` no serviço `quimiport-web` e clique em **Manual Deploy → Clear build cache & deploy**. A variável é embutida no build.

## Opção 2: Render (API e painel) + Neon (PostgreSQL sem expiração)

1. Crie um banco gratuito em https://neon.tech e copie a connection string (`postgresql://...?sslmode=require`).
2. No `render.yaml`, remova o bloco `databases` e troque o `DATABASE_URL` da API por:
   ```yaml
   - key: DATABASE_URL
     sync: false
   ```
3. Siga os passos da opção 1 e cole a connection string do Neon quando o Render pedir.

## Opção 3: qualquer VPS com Docker

```bash
git clone https://github.com/ernestocosta/quimiport.git && cd quimiport
cp .env.example .env
# edite .env: POSTGRES_PASSWORD forte e VITE_API_URL=http://SEU_IP:3333
docker compose up -d --build
```
