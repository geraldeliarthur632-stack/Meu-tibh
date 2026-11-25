import { SportId } from '../types/studio';

export interface PositionManualEntry {
  position: string;
  shortCode: string;
  sport: SportId | 'staff';
  summary: string;
  zoneTip: string;
  withBall: string[];
  withoutBall: string[];
  avoid: string[];
  goldenRule: string;
}

export const POSITION_MANUALS: PositionManualEntry[] = [
  // ================= FUTEBOL =================
  {
    position: 'Goleiro',
    shortCode: 'GOL',
    sport: 'futebol',
    summary: 'Último defensor do time e primeiro jogador a iniciar a saída de bola.',
    zoneTip: 'Posicione-se sempre na bissetriz do ângulo entre a bola e o centro do gol, um passo à frente da linha.',
    withBall: [
      'Acalme o jogo após defender; procure laterais ou volantes livres com passe curto ou reposição rápida.',
      'Use as mãos ou os pés para acelerar contra-ataques quando o time adversário estiver desarrumado.',
      'Ofereça linha de passe atrás dos zagueiros quando o time estiver pressionado.',
    ],
    withoutBall: [
      'Organize a barreira nas faltas e oriente a linha defensiva em voz alta e clara.',
      'Mantenha os joelhos semiflexionados e as mãos na altura da cintura na hora do chute.',
      'Saia com decisão nas bolas cruzadas na pequena área.',
    ],
    avoid: [
      'Ficar colado em cima da linha do gol facilitando chutes de média distância.',
      'Tentar dribles arriscados na pequena área quando há pressão próxima.',
    ],
    goldenRule: 'Comunique cada marcação cega dos seus zagueiros — você vê o campo inteiro de frente.',
  },
  {
    position: 'Zagueiro',
    shortCode: 'ZAG',
    sport: 'futebol',
    summary: 'Guardiao da grande área, responsável pelos duelos aéreos, coberturas e saída limpa.',
    zoneTip: 'Atue alinhado ao parceiro de zaga e mantenha distância curta da linha do meio-campo.',
    withBall: [
      'Quebre a primeira linha adversária com passes firmes pelo chão para o volante ou meia.',
      'Inverta o lado quando um corredor estiver congestionado.',
      'Suba para cabecear em escanteios e faltas ofensivas apenas quando o volante cobrir sua vaga.',
    ],
    withoutBall: [
      'Dê o bote na hora certa ou cerque o atacante até a chegada da cobertura.',
      'Faça a dobra sempre que o lateral for vencido no mano a mano.',
      'Acompanhe a linha de impedimento sem dar condição atrás do bloco.',
    ],
    avoid: [
      'Dar carrinho precipitado no meio do campo deixando a área exposta.',
      'Se afastar demais do companheiro de zaga abrindo corredor central.',
    ],
    goldenRule: 'Nunca dê as costas para a bola; primeiro feche o centro, depois empurre para o lado.',
  },
  {
    position: 'Lateral Direito',
    shortCode: 'LD',
    sport: 'futebol',
    summary: 'Dono do corredor direito: fecha a linha de defesa e dá amplitude no ataque.',
    zoneTip: 'Feche por dentro quando a bola estiver na esquerda e abra na linha lateral quando seu time atacar.',
    withBall: [
      'Apoie o ponta passando por fora (ultrapassagem) ou por dentro abrindo linha de passe.',
      'Busque cruzamentos rasteiros na marca do pênalti ou na segunda trave.',
      'Construa tabelas rápidas com o meia pelo lado direito.',
    ],
    withoutBall: [
      'Feche o segundo pau nos cruzamentos vindos do lado esquerdo.',
      'Direcione o ponta adversário para a linha lateral, nunca para o meio.',
      'Recupere rápido após perder a bola lá na frente.',
    ],
    avoid: [
      'Subir ao ataque ao mesmo tempo em que o lateral esquerdo também subiu sem proteção.',
      'Perder o ponto futuro da bola nas costas ao olhar só para o drible.',
    ],
    goldenRule: 'Sincronize sua subida com o outro lateral: quando um sobe, o outro fecha a linha de três.',
  },
  {
    position: 'Lateral Esquerdo',
    shortCode: 'LE',
    sport: 'futebol',
    summary: 'Responsável por proteger o corredor esquerdo defensivo e gerar superioridade ofensiva.',
    zoneTip: 'Fique alinhado com os zagueiros na defesa e avance até a linha de fundo quando o espaço abrir.',
    withBall: [
      'Explore passes diagonais para o ponta ou centroavante quando a defesa abrir.',
      'Alterne entre cruzamentos rápidos e aproximações pelo meio para tabelas.',
      'Mantenha o corpo aberto para enxergar o meio e o corredor antes de dominar.',
    ],
    withoutBall: [
      'Impeça o ponta adversário de cortar para dentro com o pé bom.',
      'Ajuste sua posição fechando a diagonal quando a bola estiver do outro lado.',
      'Trave o cruzamento aproximando com passadas curtas.',
    ],
    avoid: [
      'Deixar espaço livre nas costas quando o time perder a bola no meio.',
      'Cruzar sem levantar a cabeça para ver quem entrou na área.',
    ],
    goldenRule: 'Antes de avançar, confirme se o volante ou zagueiro percebeu sua subida.',
  },
  {
    position: 'Volante',
    shortCode: 'VOL',
    sport: 'futebol',
    summary: 'Motor de equilíbrio entre defesa e ataque; protege a frente da área e dita o ritmo.',
    zoneTip: 'Ocupe a meia-lua defensiva sem bola e ofereça triângulo constante atrás da linha da bola.',
    withBall: [
      'Gire o jogo de um lado para o outro com poucos toques.',
      'Sirva de válvula de escape para zagueiros e laterais sob pressão.',
      'Chegue de surpresa na entrada da área para finalizar rebotes.',
    ],
    withoutBall: [
      'Intercepte passes verticais que tentam encontrar o centroavante ou camisa 10.',
      'Cubra as costas do lateral que subiu ao ataque.',
      'Pressione o portador assim que seu time perder a posse.',
    ],
    avoid: [
      'Reter a bola no círculo central cercado por dois marcadores.',
      'Subir sem combinar com o outro meio-campista e abandonar a frente dos zagueiros.',
    ],
    goldenRule: 'Olhe por cima do ombro antes de receber a bola para já saber onde está o passe livre.',
  },
  {
    position: 'Meia',
    shortCode: 'MEI',
    sport: 'futebol',
    summary: 'Cérebro criativo que conecta o meio ao ataque entre as linhas adversárias.',
    zoneTip: 'Flutue nas costas dos volantes rivais, procurando bolsões de espaço entre defesa e meio.',
    withBall: [
      'Ache passes em profundidade para atacantes e pontas em movimento.',
      'Arrisque finalizações de média distância quando o bloco recuar.',
      'Acelere com condução curta para atrair marcadores e liberar o companheiro.',
    ],
    withoutBall: [
      'Inicie a pressão orientando a saída do zagueiro adversário para um lado só.',
      'Feche o passe central pelo meio quando o adversário tentar construir.',
      'Movimente-se constantemente para não ficar escondido atrás do marcador.',
    ],
    avoid: [
      'Voltar até os zagueiros toda hora tirando presença do último terço.',
      'Forçar passes difíceis quando o time precisa respirar e manter a posse.',
    ],
    goldenRule: 'Receba de meio lado para já dominar olhando para o gol adversário.',
  },
  {
    position: 'Ponta',
    shortCode: 'PON',
    sport: 'futebol',
    summary: 'Desequilibra nos lados do campo com velocidade, drible 1x1 e recomposição disciplinada.',
    zoneTip: 'Dê largura perto da linha lateral para esticar a zaga e ataque o espaço nas costas do lateral.',
    withBall: [
      'Encare o marcador no 1 contra 1 alternando linha de fundo e corte para dentro.',
      'Atire-se na segunda trave sempre que a bola for cruzada do lado oposto.',
      'Combine tabelas curtas com o lateral e o meia.',
    ],
    withoutBall: [
      'Acompanhe a descida do lateral adversário até seu campo defensivo.',
      'Pressione a saída do lateral quando a bola voltar para a defesa rival.',
      'Feche o funil pelo centro quando a jogada estiver do lado contrário.',
    ],
    avoid: [
      'Ficar parado esperando a bola no pé sem atacar o espaço vazio.',
      'Esquecer de ajudar seu lateral quando estiver 2 contra 1.',
    ],
    goldenRule: 'Se a bola está do outro lado, aproxime-se da área: é de lá que saem muitos gols.',
  },
  {
    position: 'Atacante',
    shortCode: 'ATA',
    sport: 'futebol',
    summary: 'Referência ofensiva encarregada de finalizar jogadas, segurar zagueiros e abrir espaços.',
    zoneTip: 'Mantenha-se entre os dois zagueiros pronto para atacar a primeira trave ou fazer o pivô.',
    withBall: [
      'Proteja a bola de costas para o zagueiro e devolva de primeira para quem vem de frente.',
      'Ataque a pequena área com movimentos curtos para escapar da marcação.',
      'Finalize com convicção buscando os cantos ou desvios rápidos.',
    ],
    withoutBall: [
      'Feche a linha de passe entre os dois zagueiros na saída de bola rival.',
      'Faça movimentos de vai-e-vem (desmarque) para não ficar em impedimento.',
      'Dispute a segunda bola em lançamentos longos.',
    ],
    avoid: [
      'Ficar estático na frente do zagueiro sem mudar de direção antes do cruzamento.',
      'Voltar demais para buscar jogo e deixar a área vazia.',
    ],
    goldenRule: 'No cruzamento, ataque sempre o espaço na frente do zagueiro — nunca espere atrás dele.',
  },

  // ================= FUTSAL =================
  {
    position: 'Goleiro',
    shortCode: 'GOL',
    sport: 'futsal',
    summary: 'Reflexo curto, saída agressiva na linha de 6m e apoio constante com os pés na quadra.',
    zoneTip: 'Fique adiantado próximo à linha da área em chutes fechados e feche o ângulo em bloco baixo.',
    withBall: [
      'Lance rápido com as mãos para pegar o adversário fora de posição.',
      'Participe do 5º homem (goleiro-linha) ou dê opção atrás do fixo na pressão alta.',
      'Mantenha precisão no passe rasteiro para os alas.',
    ],
    withoutBall: [
      'Use a técnica de "cruz" ou espacate nos chutes à queima-roupa dentro dos 6 metros.',
      'Antecipe bolas enfiadas no pivô saindo na borda da área.',
      'Grite trocas de marcação imediatamente.',
    ],
    avoid: [
      'Soltar rebotes para o centro da quadra onde chegam os alas adversários.',
      'Segurar a bola mais que 4 segundos na própria quadra (tiro livre indireto).',
    ],
    goldenRule: 'No futsal, 4 segundos passam voando — pense no passe antes mesmo de defender.',
  },
  {
    position: 'Fixo',
    shortCode: 'FIXO',
    sport: 'futsal',
    summary: 'Comandante defensivo do futsal, responsável por marcar o pivô e iniciar a construção.',
    zoneTip: 'Posicione-se no eixo central atrás da linha da bola, sempre enxergando o pivô adversário.',
    withBall: [
      'Passe com velocidade entre linhas buscando o pivô ou o ala contrário.',
      'Finalize forte de média distância quando a defesa fechar no pivô.',
      'Organize o rodízio do quarteto mantendo sempre um equilíbrio atrás.',
    ],
    withoutBall: [
      'Antecipe o passe no pivô ou force-o a receber longe do gol.',
      'Cobre as diagonais quando um ala for driblado na beirada.',
      'Comunique o "troca" ou "acompanha" nas paralelas.',
    ],
    avoid: [
      'Ser atraído até o canto deixando o meio totalmente desprotegido.',
      'Tentar dribles sendo o último jogador antes do goleiro.',
    ],
    goldenRule: 'Nunca deixe a bola entrar limpa no pivô adversário; corte a linha de passe antes.',
  },
  {
    position: 'Ala Direito',
    shortCode: 'ALA D',
    sport: 'futsal',
    summary: 'Velocidade, drible na linha e fechamento defensivo constante no lado direito da quadra.',
    zoneTip: 'Alterne entre a linha lateral direita e cortes em diagonal para dentro no sistema 3-1 ou 4-0.',
    withBall: [
      'Puxe o marcador com condução rápida e acione o pivô em diagonal.',
      'Chute cruzado ou toque para o segundo pau após vencer o 1x1.',
      'Faça "passa e vai" (paralela ou diagonal) sem parar após soltar a bola.',
    ],
    withoutBall: [
      'Feche o segundo pau quando a bola estiver no ala esquerdo rival.',
      'Retorne em sprint após cada finalização ou perda de posse.',
      'Pressione a saída evitando o passe paralelo fácil.',
    ],
    avoid: [
      'Passar a bola e ficar parado olhando o lance.',
      'Deixar a linha de fundo aberta no retorno defensivo.',
    ],
    goldenRule: 'No futsal, quem passa a bola se movimenta imediatamente — nunca assista ao próprio passe.',
  },
  {
    position: 'Ala Esquerdo',
    shortCode: 'ALA E',
    sport: 'futsal',
    summary: 'Criação, intensidade e chegada no segundo pau pelo lado esquerdo da quadra.',
    zoneTip: 'Dê largura na linha esquerda e feche por dentro quando a jogada acontecer na direita.',
    withBall: [
      'Use o giro e a pisada (sola do pé) para proteger e mudar de direção rápido.',
      'Aproxime-se do pivô para tabelas curtas de primeira.',
      'Ataque a segunda trave em todos os ataques vindos da ala direita.',
    ],
    withoutBall: [
      'Feche o passe no meio da quadra mantendo postura baixa.',
      'Ajude o fixo na dobra caso o pivô adversário gire.',
      'Acompanhe a troca de posição dos alas adversários.',
    ],
    avoid: [
      'Ficar preso na lateral sem oferecer opção de diagonal.',
      'Cometer faltas desnecessárias perto do limite de 5 faltas acumuladas.',
    ],
    goldenRule: 'Use a sola do pé para controlar o ritmo e proteger a bola em espaços curtos.',
  },
  {
    position: 'Pivô',
    shortCode: 'PIVÔ',
    sport: 'futsal',
    summary: 'Referência na quadra ofensiva: segura a bola de costas, gira para finalizar e abre espaço.',
    zoneTip: 'Movimente-se entre as linhas na quadra de ataque, oferecendo passe de costas ou nas costas do fixo.',
    withBall: [
      'Proteja com o braço de apoio e a sola do pé, esperando a chegada dos alas.',
      'Gire rápido para o lado em que o fixo deixou o pé aberto.',
      'Devolva de primeira ("parede") para chute frontal de quem vem de trás.',
    ],
    withoutBall: [
      'Atue como primeiro marcador na saída adversária para forçar o erro.',
      'Saia do meio quando o time rodar no 4-0 para confundir os defensores.',
      'Corra para a segunda trave se um ala vencer o marcador.',
    ],
    avoid: [
      'Brigar por posição parado na frente do gol sem fazer desmarque.',
      'Tentar girar contra dois defensores quando o ala está livre de frente.',
    ],
    goldenRule: 'Nem sempre o pivô precisa girar: muitas vezes a melhor jogada é escorar de primeira para o ala chutar.',
  },

  // ================= BASQUETE =================
  {
    position: 'Armador (PG)',
    shortCode: 'PG',
    sport: 'basquete',
    summary: 'General da quadra: traz a bola, chama as jogadas e controla o tempo de posse.',
    zoneTip: 'Opere no topo do garrafão com visão panorâmica dos quatro companheiros.',
    withBall: [
      'Use o pick-and-roll para atacar a cesta, chutar ou achar o pivô rolando.',
      'Proteja a bola com o corpo contra pressão na quadra inteira.',
      'Acelere na transição quando houver vantagem numérica.',
    ],
    withoutBall: [
      'Pressione o armador adversário desde a reposição sem cometer faltas de mão.',
      'Comunique bloqueios (screens) para os companheiros.',
      'Recue rápido para impedir contra-ataques após arremessos.',
    ],
    avoid: [
      'Prender o drible nos cantos da quadra perto das linhas.',
      'Forçar arremessos apressados com 18 segundos no relógio sem movimentar a defesa.',
    ],
    goldenRule: 'Controle o ritmo: acelere quando há espaço, organize quando a defesa está montada.',
  },
  {
    position: 'Ala-Armador (SG)',
    shortCode: 'SG',
    sport: 'basquete',
    summary: 'Pontuador versátil de perímetro que cria arremessos, corta para a cesta e ajuda na armação.',
    zoneTip: 'Ocupe as alas de 3 pontos e utilize cortes sem bola atrás de bloqueios.',
    withBall: [
      'Esteja com os pés prontos para o arremesso rápido (catch and shoot).',
      'Ataque o closeout (defensor correndo para contestar) penetrando com força.',
      'Ajude o armador na saída de bola sob marcação pressão.',
    ],
    withoutBall: [
      'Movimente-se pelas linhas de fundo buscando janelas limpas de arremesso.',
      'Conteste arremessos de 3 pontos sem pular na finta.',
      'Acompanhe o marcador nos bloqueios indiretos.',
    ],
    avoid: [
      'Ficar estático na linha de 3 pontos observando o armador.',
      'Pular antes do arremessador sair do chão.',
    ],
    goldenRule: 'Prepare as mãos e o equilíbrio antes de a bola chegar — o chute bom nasce no movimento sem bola.',
  },
  {
    position: 'Ala (SF)',
    shortCode: 'SF',
    sport: 'basquete',
    summary: 'Peça mais multifuncional: pontua por fora e por dentro, marca múltiplas posições e corre a quadra.',
    zoneTip: 'Atue nas zonas laterais e na linha de fundo (corner e baseline), atacando rebotes e cortes.',
    withBall: [
      'Explore cortes em direção à cesta ("backdoor") quando seu marcador olhar só para a bola.',
      'Combine infiltrações físicas com arremessos de média e longa distância.',
      'Corra os corredores laterais em toda transição.',
    ],
    withoutBall: [
      'Marque o principal pontuador de perímetro adversário.',
      'Ajude o garrafão no rebote defensivo fazendo o box-out.',
      'Esteja pronto para ajudar na cobertura do lado contrário ("help defense").',
    ],
    avoid: [
      'Sumir da partida quando as jogadas não passam por você.',
      'Esquecer de bloquear seu marcador antes de buscar o rebote.',
    ],
    goldenRule: 'Energia nos dois lados da quadra: corte sem bola no ataque e ajude na cobertura na defesa.',
  },
  {
    position: 'Ala-Pivô (PF)',
    shortCode: 'PF',
    sport: 'basquete',
    summary: 'Força e mobilidade perto do garrafão, especialista em bloqueios, rebotes e arremessos de apoio.',
    zoneTip: 'Alterne entre a cabeça do garrafão (high post), bloqueios no topo e o espaço próximo à cesta.',
    withBall: [
      'Faça bloqueios sólidos (picks) no armador e abra para arremessar (pick-and-pop) ou entre no garrafão.',
      'Finalize forte após pegar rebotes ofensivos.',
      'Passe com rapidez quando receber dobra de marcação.',
    ],
    withoutBall: [
      'Garanta o box-out em todo arremesso adversário para assegurar o rebote.',
      'Proteja o aro ajudando quando o armador for batido.',
      'Comunique as trocas nos bloqueios altos.',
    ],
    avoid: [
      'Sair do bloqueio antes da hora cometendo falta de ataque.',
      'Ficar fora do garrafão sem disputar os rebotes importantes.',
    ],
    goldenRule: 'Bloqueio bem feito abre dois caminhos: a cesta do seu armador ou a sua livre.',
  },
  {
    position: 'Pivô (C)',
    shortCode: 'C',
    sport: 'basquete',
    summary: 'Âncora defensiva no aro, dono dos rebotes e finalizador eficiente dentro do garrafão.',
    zoneTip: 'Domine a área pintada (garrafão) mantendo pés ativos e mãos altas.',
    withBall: [
      'Peça a bola selando o marcador com o corpo bem posicionado no poste baixo.',
      'Use ganchos, giros curtos e fintas perto da tabela em vez de dribles longos.',
      'Rebata a bola para os arremessadores livres quando a defesa fechar em você.',
    ],
    withoutBall: [
      'Proteja o garrafão com verticalidade (braços retos para cima) sem fazer faltas bobas.',
      'Fale alto na defesa avisando de bloqueios e cortes pelas costas.',
      'Cace cada rebote defensivo e passe rápido para iniciar o contra-ataque.',
    ],
    avoid: [
      'Abaixar os braços quando o atacante pula perto da cesta.',
      'Permanecer mais de 3 segundos dentro do garrafão ofensivo sem agir.',
    ],
    goldenRule: 'Seja a voz da defesa: você vê toda a quadra atrás do time.',
  },

  // ================= VÔLEI =================
  {
    position: 'Levantador',
    shortCode: 'LEV',
    sport: 'volei',
    summary: 'Estrategista da equipe que toca na segunda bola para deixar os atacantes em condições ideais.',
    zoneTip: 'Corra para a zona de levantamento (próximo à posição 2/3 da rede) assim que o saque acontecer.',
    withBall: [
      'Mantenha postura neutra antes do toque para não entregar ao bloqueio onde vai a bola.',
      'Varie entre bolas rápidas no meio, extremidades e pipe (fundo).',
      'Em passes perfeitos, use o ataque de segunda de surpresa ocasionalmente.',
    ],
    withoutBall: [
      'Defenda bolas curtas atrás do bloqueio na posição 1 ou 2.',
      'Forme bloqueio sólido na rede contra o ponteiro adversário.',
      'Comunique antes do saque quem entra no primeiro tempo.',
    ],
    avoid: [
      'Levantar colado demais na rede dificultando o ataque.',
      'Esquecer a sua posição exata no rodízio antes de o sacador bater na bola.',
    ],
    goldenRule: 'Levantamento consistente e previsível para o seu atacante, imprevisível para o bloqueio rival.',
  },
  {
    position: 'Oposto',
    shortCode: 'OPO',
    sport: 'volei',
    summary: 'Principal definidor de bolas difíceis pelo lado direito e na linha de 3 metros (saída de rede).',
    zoneTip: 'Fique diagonal ao levantador no rodízio, pronto para atacar na saída de rede ou pela linha dos 3m.',
    withBall: [
      'Ataque com potência bolas altas e contra-ataques fora de sistema.',
      'Use o bloqueio adversário a seu favor explorando desvios na ponta dos dedos.',
      'Comunique quando estiver livre na saída para receber bola rápida.',
    ],
    withoutBall: [
      'Bloqueie o ponteiro de entrada adversário fechando a diagonal.',
      'Não participa da linha de passe principal: concentre-se na preparação de ataque e defesa curta.',
      'Cubra o ataque dos colegas em caso de bloqueio.',
    ],
    avoid: [
      'Aproximar-se tarde para a corrida de ataque após defender.',
      'Tentar força bruta contra bloqueio duplo bem montado sem olhar as mãos.',
    ],
    goldenRule: 'Na bola quebrada (longe da rede), a responsabilidade de resolver o ponto é sua — entre com coragem.',
  },
  {
    position: 'Ponteiro',
    shortCode: 'PON',
    sport: 'volei',
    summary: 'Equilíbrio total do vôlei: compõe a linha de passe no fundo e ataca pelas pontas e fundo.',
    zoneTip: 'Responsável pela recepção do saque na zona de trás e pelo ataque na entrada de rede (posição 4).',
    withBall: [
      'Busque um passe alto e direcionado para o levantador trabalhar com conforto.',
      'Alterne golpes fortes na diagonal/paralela com largadas atrás do bloqueio.',
      'Ataque pelo fundo (pipe) quando estiver na linha de trás.',
    ],
    withoutBall: [
      'Leia o ombro do sacador adversário para antecipar o ponto de queda do saque.',
      'Junte-se ao central formando bloqueio duplo nas pontas.',
      'Faça cobertura próxima quando o oposto ou central atacar.',
    ],
    avoid: [
      'Ficar parado nos calcanhares na hora da recepção.',
      'Correr tarde para a entrada de rede depois de passar o saque.',
    ],
    goldenRule: 'Passe primeiro, ataque depois: um bom passe ganha metade do ponto antes da cortada.',
  },
  {
    position: 'Central',
    shortCode: 'CEN',
    sport: 'volei',
    summary: 'Muralha da rede: comanda o bloqueio ao longo de toda a rede e ataca bolas de primeiro tempo.',
    zoneTip: 'Posição 3 na rede; desloca-se para fechar bloqueios duplos tanto na ponta quanto na saída.',
    withBall: [
      'Entre no tempo exato da subida do levantador para atacar bolas rápidas de meio ("china" ou "tempo").',
      'Use sua velocidade para puxar o bloqueio rival mesmo quando não receber a bola (finta).',
      'Saque agressivo para tirar o adversário do passe perfeito.',
    ],
    withoutBall: [
      'Observe o levantador adversário primeiro para saber onde fechar o bloqueio duplo.',
      'Passe os braços por cima da rede invadindo o espaço na hora do bloqueio.',
      'Saia para entrada do líbero assim que rodar para o fundo após seu saque.',
    ],
    avoid: [
      'Saltar adiantado no bloqueio ou deixar espaço aberto entre você e o ponta.',
      'Pular sem finta no ataque — sempre dê opção ao levantador.',
    ],
    goldenRule: 'Mesmo sem receber a bola, pule forte no meio para segurar o bloqueador deles e liberar as pontas.',
  },
  {
    position: 'Líbero',
    shortCode: 'LIB',
    sport: 'volei',
    summary: 'Especialista defensivo de camisa diferente que lidera o passe e defende ataques pesados no fundo.',
    zoneTip: 'Atua exclusivamente na zona de trás (posições 5 e 6), cobrindo grandes áreas da quadra.',
    withBall: [
      'Comande a recepção do saque assumindo bolas divididas entre ponteiros.',
      'Substitua o levantamento com toque (apenas atrás da linha de 3m) ou manchete precisa em bolas quebradas.',
      'Passe baixo e estável mirando o alto da zona do levantador.',
    ],
    withoutBall: [
      'Leia a direção do braço do atacante e fique baixo e equilibrado antes do impacto.',
      'Feche o corredor deixado aberto pelo bloqueio duplo.',
      'Acompanhe a cobertura imediata atrás dos atacantes.',
    ],
    avoid: [
      'Fazer levantamento de toque pisando na zona de frente (entre a rede e a linha de 3m) para ataque acima da borda.',
      'Ficar em silêncio na linha de passe sem chamar "minha!".',
    ],
    goldenRule: 'Líbero não pode sacar, bloquear nem atacar acima da rede — seja o dono absoluto do chão.',
  },

  // ================= COMISSÃO TÉCNICA =================
  {
    position: 'Técnico',
    shortCode: 'TEC',
    sport: 'staff',
    summary: 'Líder tático do time: define escalação titular e reserva, substituições e leitura do jogo.',
    zoneTip: 'Na área técnica ao lado da quadra/campo, observando padrões adversários e orientando o elenco.',
    withBall: [
      'Ajuste a formação (ex: 4-3-3, 1-2-1) conforme o adversário fecha ou abre espaços.',
      'Observe quando o time perde fôlego e acione reservas estratégicos na hora certa.',
      'Peça tempo técnico ou dê orientações curtas e claras sem confundir os atletas.',
    ],
    withoutBall: [
      'Identifique onde o adversário está criando vantagem numérica e corrija a marcação.',
      'Monitore cartões amarelos e faltas acumuladas para evitar expulsões.',
      'Mantenha o grupo unido e focado mesmo após sofrer um gol ou ponto.',
    ],
    avoid: [
      'Gritar dezenas de instruções diferentes ao mesmo tempo durante a jogada.',
      'Demorar para mexer no time quando um setor já mostrou desgaste.',
    ],
    goldenRule: 'Instrução boa em jogo ao vivo tem no máximo cinco palavras e aponta a solução, não o erro.',
  },
  {
    position: 'Treinador de Goleiro',
    shortCode: 'T.GOL',
    sport: 'staff',
    summary: 'Especialista em preparar, corrigir posicionamento e orientar os goleiros titulares e reservas.',
    zoneTip: 'Trabalha junto ao banco e no aquecimento específico de agilidade, saída de bola e cobertura.',
    withBall: [
      'Treine reposições rápidas com mãos e pés para iniciar contra-ataques limpos.',
      'Avalie o pé dominante dos batedores adversários e avise seu goleiro em faltas e pênaltis.',
      'Prepare o goleiro reserva fisicamente pronto para entrar a qualquer instante.',
    ],
    withoutBall: [
      'Corrija pequenos passos de posicionamento do goleiro nas bolas paradas.',
      'Oriente o ângulo de fechamento e a altura da barreira defensiva.',
      'Analise a tomada de decisão em saídas do gol.',
    ],
    avoid: [
      'Cobrar o goleiro imediatamente após uma falha durante a partida — dê confiança primeiro.',
      'Negligenciar o treinamento com os pés exigido pelo jogo moderno.',
    ],
    goldenRule: 'Confiança e posicionamento valem tanto quanto reflexo: ajuste os pés do goleiro antes do chute.',
  },
  {
    position: 'Auxiliar',
    shortCode: 'AUX',
    sport: 'staff',
    summary: 'Braço direito do técnico: monitora detalhes, substituições, súmula, estatísticas e reservas.',
    zoneTip: 'Ao lado do técnico e do banco, atento aos detalhes que escapam da linha da bola.',
    withBall: [
      'Prepare os jogadores reservas explicando exatamente quem marcar e qual função assumir antes de entrarem.',
      'Registre gols, assistências, faltas e cartões em tempo real na aba Partidas.',
      'Ajude o técnico identificando espaços livres nas costas da defesa rival.',
    ],
    withoutBall: [
      'Acompanhe o cronômetro, os acréscimos e o número de faltas por jogador.',
      'Avise rapidamente o técnico sobre desgaste físico ou jogador pendurado com cartão.',
      'Organize o aquecimento do time reserva.',
    ],
    avoid: [
      'Passar recados contraditórios aos do técnico para dentro de campo.',
      'Deixar os atletas do banco desatentos ao ritmo da partida.',
    ],
    goldenRule: 'O auxiliar enxerga os detalhes fora da bola — antecipe a próxima substituição antes do técnico pedir.',
  },
];

export function findPositionManual(position: string, sport: SportId): PositionManualEntry {
  const exact = POSITION_MANUALS.find(
    (item) => item.position === position && (item.sport === sport || item.sport === 'staff')
  );
  if (exact) return exact;
  return (
    POSITION_MANUALS.find((item) => item.position === position) ||
    POSITION_MANUALS.find((item) => item.sport === sport) ||
    POSITION_MANUALS[0]
  );
}
