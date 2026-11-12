# Rottera na Microsoft Store

A loja assina o app (some o aviso "O Windows protegeu o computador", o Controle Inteligente de Aplicativos deixa
abrir e o ícone do Rottera aparece em todo lugar) e cuida das atualizações. A conta de desenvolvedor individual é
gratuita.

## 1. Criar a conta (uma vez)

1. Entre em https://storedeveloper.microsoft.com com uma conta Microsoft pessoal e escolha **Individual**.
2. Preencha nome e país. A Microsoft confere a identidade (pode pedir documento com foto e uma selfie).

## 2. Reservar o nome

1. No Partner Center: **Aplicativos e jogos → Novo produto → Aplicativo MSIX ou PWA**.
2. Reserve **Rottera**. Se estiver ocupado, por exemplo: "Rottera Roteiros".
3. Abra **Gerenciamento de produto → Identidade do produto** e copie três valores:
   - `Package/Identity/Name`
   - `Package/Identity/Publisher` (começa com `CN=`)
   - `Package/Properties/PublisherDisplayName`

Coloque-os em `build/store-identity.json` (ou mande para o Claude, que cria o arquivo):

```json
{ "identityName": "…", "publisher": "CN=…", "publisherDisplayName": "…" }
```

## 3. Gerar o pacote

```
npm run dist:store
```

Sai `dist/Rottera-<versão>-loja.appx`. A loja assina, então não precisa de certificado. Sem o arquivo de
identidade, o comando gera um pacote de teste que a loja recusa.

As imagens do pacote saem do ícone: `python scripts/make-appx-assets.py` (refazer quando o ícone mudar).

Capturas de tela para a página da loja (1920×1080, com um roteiro de demonstração):
`npm run build` e depois `node scripts/store-screenshots.mjs . dist/capturas-loja`.

## 4. Enviar (Partner Center → Iniciar envio)

- **Preços e disponibilidade**: grátis ou pago; mercados. Para testar antes de todo mundo ver, use
  **Visibilidade → Público privado** (só as contas que você listar acham o app) e depois troque para público.
- **Propriedades**: categoria **Produtividade**. Não coleta dados pessoais.
- **Classificação etária**: o questionário IARC. O app não tem conteúdo próprio, não tem chat entre pessoas e não
  compartilha o que o usuário escreve.
- **Pacotes**: envie o `.appx`.
- **Recursos restritos**: o pacote declara `runFullTrust`. Justificativa:
  > O Rottera é um app de desktop: abre e grava roteiros nas pastas que a pessoa escolhe, exporta PDF e Word e
  > atende assistentes de IA que a pessoa conecta, só no próprio computador (127.0.0.1).
- **Listagens da loja (português do Brasil)**: os textos abaixo e pelo menos uma captura de tela (1366×768 ou
  maior).

A certificação leva até uns três dias úteis.

## 5. Depois de publicado

- Instale pela loja e confira: abrir um `.rottera` com dois cliques; **Arquivo → Conectar a uma IA** mostra o
  comando com `…\WindowsApps\rottera.exe` e a IA consegue ler o roteiro.
- Cada versão nova: aumente `version` no `package.json`, `npm run dist:store`, novo envio.

### Diferenças do app instalado pela loja

- As configurações, versões automáticas e rascunhos ficam numa pasta do pacote; desinstalar o app apaga essa
  pasta. Os roteiros (`.rottera`) ficam onde a pessoa salvou e não são apagados.
- A conexão com IA usa `C:\Users\<pessoa>\.rottera\` (arquivo da ponte e cópia do script), porque os outros
  programas não enxergam a pasta do pacote.

---

## Textos da página da loja

**Nome:** Rottera

**Descrição curta:**
Editor de roteiros em português: escreva, e o formato de cinema fica por conta do app.

**Descrição:**

O Rottera é um editor de roteiros para cinema, TV e curtas, feito em português. Você escreve; o app cuida do
formato padrão da indústria, conta as páginas e guarda cópias de segurança sozinho.

Do argumento ao set, num arquivo só:

- Formatação automática: cabeçalho de cena, ação, personagem, diálogo e transição com Enter e Tab, e sugestões
  dos personagens e locais que já apareceram.
- Beat Board e estruturas narrativas para organizar a história antes de escrever.
- Fichas de personagem.
- Storyboard com os quadros de cada cena.
- Mapa de luz: luzes, câmeras com lente e movimento, cenário e a carga elétrica, desenhados em escala.
- Decupagem, plano de filmagem e relatórios (cenas, locais, elenco, equipamento), em PDF e planilha.
- Revisões coloridas e números de cena travados, como se usa em produção.
- Leitura de mesa com as vozes do computador.
- Exporta PDF, Word, Final Draft (FDX), Fountain e página da web; importa FDX e Fountain.
- Sem conta e sem e-mail: os roteiros ficam no seu computador.
- Opcional: conecte o Claude, o Codex ou outra IA para ler e editar o roteiro aberto.

**Recursos (lista curta da loja):**
- Formatação de roteiro automática
- Storyboard e mapa de luz
- Decupagem e plano de filmagem
- Exporta PDF, Word, Final Draft e Fountain
- Cópias de segurança automáticas
- Funciona sem internet

**Palavras-chave:** roteiro, screenplay, cinema, storyboard, decupagem

---

## Política de privacidade (para publicar num endereço público)

> **Política de privacidade do Rottera**
>
> O Rottera não coleta, não envia e não vende dados pessoais. Não há conta, cadastro, anúncios nem análise de uso.
>
> Os roteiros e as configurações ficam no seu computador, nas pastas que você escolhe. O app não envia o que você
> escreve para nenhum servidor.
>
> A conexão com assistentes de IA atende só programas no próprio computador (endereço 127.0.0.1) que tenham a
> chave gerada pelo app, e pode ser desligada em Arquivo → Conectar a uma IA. O Rottera não chama nenhum assistente
> por conta própria: é você quem conecta o seu. O que o assistente faz com o texto é regido pela política de quem
> o fornece.
>
> Na versão para Linux, o corretor ortográfico baixa o dicionário de português dos servidores do Google na
> primeira vez que o app abre. Nenhum texto seu vai junto.
>
> O app guarda no seu computador um registro técnico (quando abriu, erros) para ajudar a resolver problemas. Esse
> registro e o relatório de diagnóstico só saem do computador se você mesmo os enviar.
>
> Última atualização: 12 de novembro de 2026.
