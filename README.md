# Rottera

Editor de roteiros para Windows e Linux. Os roteiros ficam no seu computador: sem conta e sem internet.

## Baixar

Na página de [Releases](../../releases), baixe o arquivo do seu sistema:

- **Windows:** `Rottera-0.1.0-windows-x64.zip`. Descompacte e abra `Rottera.exe`; não precisa instalar.
- **Linux (64 bits):** `Rottera-0.1.0-linux-x64.tar.gz`. Descompacte e rode `./abrir-rottera.sh`; `./instalar.sh` coloca o programa no menu.

Cada pacote traz um `LEIA-ME.txt` com o passo a passo. É uma versão de teste: guarde também uma cópia dos seus roteiros em outro lugar.

## O que tem

- **Roteiro** no formato padrão de cinema: Enter cria o próximo elemento, Tab troca o tipo, Ctrl+1 a Ctrl+7 escolhem direto, Ctrl+D faz diálogo duplo.
- **Beat Board** com 33 estruturas narrativas (três atos, jornada do herói, oito sequências e outras).
- **Storyboard**: imagens com legenda e cena, na ordem do roteiro; pode ir no fim do PDF.
- **Mapa de Luz**: planta do set vista de cima, com câmeras, atores, luzes, bandeiras e difusores.
- **Relatórios** e **fichas de personagem**.
- **PDF** em A4 ou Carta, com visualização antes de exportar (Ctrl+Shift+P); também exporta FDX e Fountain.
- **Versões anteriores** de cada roteiro e salvamento automático.
- **Conexão com o Claude** (opcional, desligada até você ativar): o Claude lê e edita o roteiro aberto neste computador.

Os arquivos `.rottera` são iguais nos dois sistemas.

## Desenvolvimento

Electron, React, TipTap e TypeScript.

```bash
npm install
npm run dev            # abre o app em modo de desenvolvimento
npm test               # testes unitários
npm run test:e2e       # gera o app e testa a conexão com o Claude de ponta a ponta
npm run dist:portable  # pasta e zip para Windows em dist/
npm run dist:linux     # .tar.gz para Linux em dist/ (pode ser gerado no Windows)
```

No Windows, trabalhe num caminho curto (por exemplo `Documents\Rottera`): caminhos com mais de 260 caracteres fazem o electron-builder falhar.
