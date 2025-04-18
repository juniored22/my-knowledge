/**
 * Converte uma cor do formato RGB para HSV.
 *
 * @param {number} r - Valor de vermelho (0 a 255)
 * @param {number} g - Valor de verde (0 a 255)
 * @param {number} b - Valor de azul (0 a 255)
 * @returns {{ h: number, s: number, v: number }} Objeto com:
 *   - h: Matiz (Hue) de 0 a 360 graus
 *   - s: Saturação (Saturation) de 0 a 100%
 *   - v: Valor (Value) de 0 a 100%
 *
 * @example
 * // Para a cor azul clara RGB(38, 190, 255)
 * const hsv = rgbToHsv(38, 190, 255);
 * console.log(hsv); // { h: 197, s: 85, v: 100 }
 *
 * @example
 * // Para a cor vermelha RGB(255, 0, 0)
 * const hsv = rgbToHsv(255, 0, 0);
 * console.log(hsv); // { h: 0, s: 100, v: 100 }
 */
function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
  
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
  
    let h = 0;
    let s = max === 0 ? 0 : delta / max;
    const v = max;
  
    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta) % 6;
      } else if (max === g) {
        h = (b - r) / delta + 2;
      } else {
        h = (r - g) / delta + 4;
      }
  
      h *= 60;
      if (h < 0) h += 360;
    }
  
    return {
      h: Math.round(h),
      s: Math.round(s * 100),
      v: Math.round(v * 100)
    };
}


/**
 * Calcula o contorno convexo (convex hull) de um conjunto de pontos 2D.
 * 
 * Usa o algoritmo Graham Scan para ordenar os pontos que formam o menor polígono convexa
 * que contém todos os pontos fornecidos.
 * 
 * @param {{x: number, y: number}[]} points - Lista de pontos no plano 2D
 * @returns {{x: number, y: number}[]} - Pontos ordenados formando o casco convexo (em sentido horário)
 * 
 * @example
 * const pontos = [
 *   { x: 30, y: 50 },
 *   { x: 50, y: 20 },
 *   { x: 70, y: 50 },
 *   { x: 50, y: 80 },
 *   { x: 50, y: 50 }
 * ];
 * 
 * const hull = convexHull(pontos);
 * console.log(hull);
 * // Resultado: [{x: 50, y: 20}, {x: 70, y: 50}, {x: 50, y: 80}, {x: 30, y: 50}]
 */
function convexHull(points) {
  // Casos triviais: menos de 3 pontos não formam polígono
  if (points.length < 3) return points;

  // Ordena os pontos da esquerda para a direita, e de cima para baixo em empate
  points.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

  // Função auxiliar que calcula o produto vetorial (orientação de três pontos)
  const cross = (o, a, b) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  // Se > 0 → curva à esquerda (manter)
  // Se < 0 → curva à direita (remover ponto intermediário)
  // Se = 0 → os pontos são colineares

  const lower = []; // Parte inferior do casco
  for (const p of points) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop(); // Remove o ponto que faz curva para dentro
    }
    lower.push(p);
  }

  const upper = []; // Parte superior do casco
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop(); // Remove o ponto que faz curva para dentro
    }
    upper.push(p);
  }

  // Remove pontos duplicados nas pontas
  upper.pop();
  lower.pop();

  // Junta os dois lados para formar o casco convexo
  return lower.concat(upper);
}


/**
 * Detecta uma bolinha (mancha de pixels) com base em uma faixa HSV.
 *
 * - A função percorre os pixels da imagem, converte cada um para HSV,
 *   aplica um filtro customizado (via callback), e retorna:
 *   centro (x, y), profundidade estimada (z), área, raio, diâmetro e contorno (convex hull).
 *
 * - O retorno é `null` se a quantidade de pixels encontrados for insuficiente.
 *
 * @param {Uint8ClampedArray} data - Dados RGBA do canvas (imageData.data)
 * @param {number} width - Largura da imagem em pixels
 * @param {(h: number, s: number, v: number) => boolean} filtroHSV - Função que recebe HSV e retorna `true` para pixels válidos
 * @returns {{
*   x: number,
*   y: number,
*   z: number,
*   raio: number,
*   area: number,
*   diametro: number,
*   pontos: {x: number, y: number}[]
* } | null} Informações da bolinha detectada, ou `null` se não encontrada
*
* @example
* // Detecta azul claro (≈ h: 197, s: 85, v: 100)
* const bolinha = detectarBolinhaHSV(data, width, (h, s, v) =>
*   h > 190 && h < 210 && s > 60 && v > 80
* );
* if (bolinha) {
*   console.log(bolinha.x, bolinha.y, bolinha.z);
* }
*/
function detectarBolinhaHSV(data, width, filtroHSV, flipX = false) {
  const pontos = [];

  // Percorre os pixels RGBA (4 componentes por pixel)
  // Pula de 4 em 4, e ainda multiplica por 4 para processar só 25% dos pixels
  for (let i = 0; i < data.length; i += 4 * 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Calcula a posição (x, y) do pixel no canvas
    const pixelIndex = i / 4;
    const x = flipX ? width - 1 - (pixelIndex % width) :  pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    // Converte para HSV
    const hsv = rgbToHsv(r, g, b);

    // Se passar no filtro, adiciona aos pontos detectados
    if (filtroHSV(hsv.h, hsv.s, hsv.v)) {
      pontos.push({ x, y });
    }
  }
  
  // Ignora se poucos pixels foram detectados (possivelmente ruído)
  if (pontos.length < 50) return null;

  // Área = número de pixels detectados
  const area = pontos.length;

  // Raio estimado assumindo forma circular: A = πr² → r = √(A / π)
  const raio = Math.sqrt(area / Math.PI);
  const diametro = 2 * raio;

  // Ponto médio (x, y) = centro aproximado da bolinha
  const x = pontos.reduce((sum, p) => sum + p.x, 0) / area;
  const y = pontos.reduce((sum, p) => sum + p.y, 0) / area;

  // Estimativa de profundidade Z (inversamente proporcional ao raio)
  const z = 1 / raio;

  // Contorno do objeto (casco convexo dos pontos)
  const hull = convexHull(pontos);

  // Retorna todos os dados da bolinha
  return { x, y, z, raio, area, diametro, pontos: hull };
}


/**
 * Cria um canvas HTML dinâmico e adiciona ao DOM
 * @param {string} id - ID do canvas
 * @param {number} width - Largura
 * @param {number} height - Altura
 * @param {boolean} hidden - Se deve estar visível
 * @param {boolean} absolute - Se deve usar position absolute
 * @returns {HTMLCanvasElement}
 */
function createCanvas(id, width, height, hidden = false, absolute = true) {
  const canvas = document.createElement('canvas');
  canvas.id = id;
  canvas.width = width;
  canvas.height = height;

  canvas.style.display = hidden ? 'none' : 'block';
  if (absolute) {
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '25%';
    canvas.style.pointerEvents = 'none'; // permite clique "passar por cima"
  }

  document.body.appendChild(canvas);
  return canvas;
}


/**
 * Desenha uma bolinha (contorno) no canvas e exibe informações sobre ela.
 *
 * A função usa os pontos do casco convexo (pontos.pontos) para traçar o contorno
 * da bolinha detectada, preenche com uma cor transparente e exibe os dados calculados.
 *
 * @param {CanvasRenderingContext2D} ctx - Contexto 2D do canvas onde desenhar
 * @param {{ x: number, y: number, z: number, raio: number, area: number, diametro: number, pontos: {x: number, y: number}[] }} bolinha - Objeto da bolinha detectada
 * @param {string} cor - Cor principal do contorno ('lime', 'blue', etc.)
 * @param {number} offsetY - Deslocamento vertical (em px) para desenhar os textos de legenda
 *
 * @example
 * const bolinha = {
 *   x: 123.4,
 *   y: 221.5,
 *   z: 0.0065,
 *   raio: 25.6,
 *   area: 2059,
 *   diametro: 51.2,
 *   pontos: [...array de coordenadas convexas...]
 * };
 * desenharBolinha(ctx, bolinha, 'blue', 150);
 */
function desenharBolinha(ctx, bolinha, cor = 'lime', offsetY = 20) {
  const { x, y, z, raio, area, diametro, pontos } = bolinha;
  
  // Segurança: evita erro se não houver pontos
  if (!pontos || pontos.length === 0) return;

  // ✏️ Desenha o contorno com base nos pontos da bolinha (casco convexo)
  ctx.beginPath();
  ctx.moveTo(pontos[0].x, pontos[0].y);
  for (let i = 1; i < pontos.length; i++) {
    ctx.lineTo(pontos[i].x, pontos[i].y);
  }
  ctx.closePath();

  // Contorno colorido
  ctx.strokeStyle = cor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Preenchimento semitransparente (azul ou verde por padrão)
  ctx.fillStyle = cor === 'blue'
    ? 'rgba(0, 0, 255, 0.1)'
    : 'rgba(0, 255, 0, 0.1)';
  ctx.fill();

  // 🏷️ Exibição de informações no canvas
  ctx.fillStyle = "white";
  ctx.font = "10px Arial";
  const linhas = [
    `🎯 ${cor.toUpperCase()}`,
    `x: ${x.toFixed(1)} px`,
    `y: ${y.toFixed(1)} px`,
    `z: ${z.toFixed(4)} (estimado)`,
    `Raio: ${raio.toFixed(1)} px`,
    `Área: ${area} px²`,
    `Diâmetro: ${diametro.toFixed(1)} px`
  ];

  // Desenha as linhas do texto com espaçamento vertical
  linhas.forEach((texto, i) => {
    ctx.fillText(texto, 10, offsetY + i * 16);
  });
}



export { rgbToHsv, convexHull, detectarBolinhaHSV, createCanvas, desenharBolinha };
