# Visions

Extensão para Owlbear Rodeo com biblioteca de cutscenes e máscaras visuais controladas pelo GM. Na versão 0.1.1, imagem e áudio têm fade na entrada, no encerramento e na troca/interrupção. Máscaras usam o áudio original a 80%, quando existir, sem novo seletor de volume.

## O que está implementado

- Painel com duas abas: **Cutscenes** e **Máscaras**.
- Adição por link HTTPS direto ou envio de MP4/WebM do PC ao servidor de uploads incluído.
- Biblioteca pessoal salva neste navegador para a conta do GM, com exportação/importação de backup.
- **Jogar** apresenta o vídeo aos participantes conectados. Uma nova cutscene substitui a anterior; uma nova máscara substitui a anterior. A máscara pode coexistir com uma cutscene.
- Cutscenes com áudio, proporção original, fade-in e fade-out. Botão **Interromper** somente para o GM e verificação de papel do remetente nos comandos remotos.
- Máscaras em loop com o áudio do arquivo, se houver, ajustadas à área do Owlbear, com opacidade configurável e cliques liberados pelo `disablePointerEvents` do SDK.
- Encerramento automático de cutscenes; máscaras permanecem até o GM retirá-las.
- Participantes que chegam depois recebem o estado ativo do GM e entram no ponto aproximado da reprodução.

## Limites que precisam ficar claros

1. **GitHub Pages hospeda a extensão, mas não recebe uploads.** Links diretos funcionam sem servidor adicional. O botão de arquivo do PC exige hospedar e configurar o servidor da pasta `server`. Ele não está hospedado por este projeto e nenhuma conta externa foi criada.
2. Arquivos do PC são enviados à hospedagem configurada, que deve estar acessível aos jogadores. Guardá-los apenas no computador do GM não funciona para distribuir a apresentação.
3. Use WebM com canal alfa real para máscaras. A transparência depende do codec e do navegador de cada jogador. Um MP4 comum ou vídeo com fundo preto não vira transparente automaticamente. Teste o arquivo nos navegadores da mesa. Esta versão não implementa chroma key.
4. Áudio automático pode ser bloqueado. A apresentação mostra **Assistir com áudio** quando necessário. Se o navegador bloquear o áudio da máscara, ela continua visualmente; abra o painel e use **Ativar áudio**. Se necessário, permita reprodução automática com som no navegador.
5. Sincronização aproximada, baseada no horário dos computadores, com 1,5 s de preparação. Não há barreira que aguarda todos terminarem o download nem sincronização de precisão. Quem carrega depois entra no trecho atual. Relógios corretos ajudam.
6. A biblioteca fica no armazenamento local do navegador, não na conta do Owlbear nem compartilhada automaticamente entre GMs. Exporte backup antes de limpar dados ou trocar de dispositivo. O backup contém links, nunca a chave de upload.
7. **Deletar** remove o cadastro da biblioteca e interrompe o item se estiver ativo. Não apaga o arquivo da hospedagem. Os arquivos do servidor podem ser removidos administrativamente pelo responsável por ele, depois de verificar se ainda são usados.
8. O Visions não dá aos jogadores um botão para encerrar a cutscene para a sala. Isso não impede que uma pessoa feche sua própria aba, recarregue o site ou use controles do próprio Owlbear/navegador.
9. O servidor permite até 250 MB por arquivo, 3 uploads simultâneos e 2 GB de armazenamento total por padrão. Os arquivos têm URLs aleatórias públicas: quem tiver o link consegue acessar. Não armazene segredos nos vídeos.

## Publicação pelo GitHub Desktop

Crie um **novo** repositório público chamado exatamente `visions` (minúsculo). Não substitua o projeto dos fios.

1. Clone esse repositório pelo GitHub Desktop.
2. Extraia o ZIP e copie seu conteúdo para a pasta clonada, inclusive `.github`. `package.json` e `index.html` devem ficar na raiz.
3. Faça **Commit to main → Push origin**.
4. No GitHub, abra **Settings → Pages → Source → GitHub Actions**.
5. Em **Actions → Publicar Visions**, use **Run workflow** e aguarde ficar verde.
6. No perfil do Owlbear, adicione a extensão pelo endereço `https://SEU-USUARIO.github.io/visions/manifest.json` e habilite-a na sala.

Para a conta Oizus0, o endereço será:

```text
https://oizus0.github.io/visions/manifest.json
```

O manifest usa caminhos completos a partir da raiz do domínio, como `/visions/index.html`, evitando concatenação incorreta do domínio. Se mudar o nome do repositório ou hospedar na raiz, ajuste todos os caminhos em `public/manifest.json`. Para testar em `npm run dev`, use temporariamente `/index.html`, `/background.html` e `/icon.svg` no manifest.

## Usar links de vídeo

No painel, **Adicionar → Link direto de vídeo**. Dê um nome, cole o link, escolha transição e volume/opacidade e salve. O painel verifica se o navegador consegue ler a duração. Máscaras têm opacidade de 0 a 100%; isso não altera o volume do áudio. Links de página do YouTube não são aceitos. Links GitHub `/blob/` são convertidos para o arquivo raw, mas um arquivo publicado no GitHub Pages é preferível.

Use **Jogar** para apresentar. O GM vê **Interromper** na própria cutscene. Para retirar uma máscara, abra o painel e use **Retirar máscara**.

## Ativar uploads de arquivos do PC

O backend incluído usa apenas módulos nativos do Node, grava em disco e entrega vídeo com suporte a `Range` (necessário para avançar no vídeo). Precisa de uma hospedagem Node com HTTPS e **disco persistente**. Um disco temporário perde os arquivos após reinícios/deploys.

Configure no ambiente do servidor:

| Variável | Valor |
|---|---|
| `PUBLIC_URL` | Endereço HTTPS público do servidor, sem subpasta |
| `ALLOWED_ORIGIN` | `https://oizus0.github.io` (ou a origem real da extensão) |
| `UPLOAD_DIR` | Caminho do volume persistente, por exemplo `/data/visions` |
| `UPLOAD_TOKEN` | Chave aleatória com pelo menos 32 caracteres |
| `PORT` | Porta informada pelo provedor; padrão 8787 |
| `MAX_STORAGE_MB` | Limite total; padrão 2048 |

Inicie com `node server/server.mjs` (ou `npm run server`). O arquivo `server/.env.example` é só um modelo; o processo lê variáveis de ambiente, não carrega `.env` automaticamente. Nunca coloque a chave no repositório.

No painel do GM, expanda **Arquivos do PC e backup**, informe o endereço e a chave e clique em **Salvar conexão**. A chave fica apenas no armazenamento local do navegador do GM. Depois, **Adicionar → Arquivo do computador** envia o arquivo e salva o link retornado. Não feche o painel durante o envio.

O servidor só aceita envio com chave válida e a origem configurada; testa a assinatura inicial MP4/WebM, impõe limites e limpa uploads incompletos. Isso não substitui validação/transcodificação completa de mídia. O TLS deve ser fornecido pela hospedagem ou proxy reverso. Faça backup do volume de uploads e da biblioteca.

## Desenvolvimento e testes

Node 22.12+.

```sh
npm ci
npm test
npm run build
npm run dev
```

`dist` contém somente a extensão publicável. O servidor não vai para o GitHub Pages.

Teste de navegador em ambiente simulado:

```sh
npx playwright test
```

Usa Microsoft Edge instalado e uma implementação simulada do SDK, ativada somente pelo servidor de testes com `VISIONS_TEST=1`. O build normal usa o SDK real. Não publique com essa variável ativada. Os testes cobrem GM/jogador, rejeição de comando de jogador, entrada tardia, clique através da máscara, reprodução de vídeo real no navegador, interrupção, término automático e persistência/exclusão.

## Estado da validação

Build de produção e testes locais executados. A interação com o SDK foi testada com simulação; **a extensão ainda precisa ser validada em uma sala real do Owlbear com dois participantes**. Validar também transparência WebM, som automático, celulares, convivência com outros modais e conexão lenta. Nenhuma publicação ou implantação do servidor foi feita nesta entrega.

O npm informa dois avisos moderados relacionados ao `uuid` transitivo do SDK 3.1.0. O aviso conhecido afeta APIs v3/v5/v6 com buffer; o SDK usa v4 nos pontos identificados. Não foi forçada uma troca incompatível da dependência.

Referências: [Modal](https://docs.owlbear.rodeo/extensions/apis/modal/), [Broadcast](https://docs.owlbear.rodeo/extensions/apis/broadcast/), [autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).
