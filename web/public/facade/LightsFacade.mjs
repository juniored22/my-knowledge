// web/public/facade/LightsFacade.mjs

import * as THREE from 'https://esm.sh/three';
import { RectAreaLightHelper } from '/static/modules/RectAreaLightHelper.mjs';
import { RectAreaLightUniformsLib }  from '/static/modules/RectAreaLightUniformsLib.mjs';

export const Lights = ({name=''}={}) => {
    const color = 0xFFFFFF;
    const intensity = 1;
    const light = new THREE.AmbientLight(color, intensity);
    light.name = name
    light.updateMatrixWorld();
    return light
}

export const HemisphereLight = ({skyColor=0xffffff, groundColor=0xffffff, intensity=1, name=''}={}) => {
    const hemisphereLight = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    hemisphereLight.name = name
    return hemisphereLight;
}

export const DirectionalLight = ({color=0xffffff, intensity=1, name=''}={}) => {
    const directionalLight = new THREE.DirectionalLight(color, intensity);
    directionalLight.name = name
    directionalLight.position.set(-5, 1, -8);
    directionalLight.target.position.set(0, 0, -10);
    directionalLight.updateMatrixWorld();
    directionalLight.target.updateMatrixWorld();

    return directionalLight
}

export const DirectionalLightHelper = ({light}={}) => {
    const helper = new THREE.DirectionalLightHelper(light);
    return helper    
}

export const PointLight = ({color=0xffffff, intensity=1, distance=0, decay=1, name=''}={}) => {
    const pointLight = new THREE.PointLight(color, intensity, distance, decay);
    pointLight.name = name
    pointLight.position.set(0, 5, -4);
    pointLight.updateMatrixWorld();
    return pointLight
}

export const PointLightHelper = ({light}={}) => {
    const helper = new THREE.PointLightHelper(light);
    return helper    
}

export const SpotLight = ({color=0xff0000, intensity=1, name=''}={}) => {
    const spotLight = new THREE.SpotLight(color, intensity);
    spotLight.position.set(-10, 10, -10);
    spotLight.target.position.set(5, -5, -10);
    spotLight.angle = 19.17;
    spotLight.penumbra = 1;
    spotLight.decay = 2;
    spotLight.distance = 30;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    spotLight.shadow.camera.fov = 30;
    spotLight.shadow.camera.near = 1;
    spotLight.shadow.camera.far = 50;
    spotLight.name = name

    // Força atualização das matrizes da luz e do target
    spotLight.updateMatrixWorld();
    spotLight.target.updateMatrixWorld();
    return spotLight;
}

export const SpotLightHelper = ({light}={}) => {
    const helper = new THREE.SpotLightHelper(light);
    return helper    
}

export const RectAreaLight = ({color=0xffffff, intensity=1, name=''}={}) => {

    RectAreaLightUniformsLib.init();
    const rectAreaLight = new THREE.RectAreaLight(color, intensity, 12, 4);
    rectAreaLight.position.set(0, 0, -100);
    rectAreaLight.rotation.set(THREE.MathUtils.degToRad(-180), 0, THREE.MathUtils.degToRad(-90));
    rectAreaLight.name = name
    // rectAreaLight.lookAt(0, 0, 0);
    rectAreaLight.updateMatrixWorld();
    return rectAreaLight
}

export const RectAreaLightHelperModified = ({light}={}) => {
    const helper = new RectAreaLightHelper(light);
    return helper    
}

/**
 * moveSpotLight - Atualiza a posição de um SpotLight e seu alvo de forma oscilatória
 * ao longo dos eixos X e Z, e atualiza também o SpotLightHelper, se fornecido.
 *
 * A função calcula um deslocamento baseado em funções senoidais do tempo, permitindo
 * que a luz se mova "para frente e para trás" elegantemente, mantendo seu target sincronizado.
 *
 * @param {THREE.SpotLight} spotLight - A instância do SpotLight a ser movimentada.
 * @param {THREE.Object3D} target - O objeto alvo associado ao SpotLight.
 * @param {Object} [options={}] - Opções para o movimento.
 * @param {number} [options.amplitude=10] - A amplitude (distância máxima) do movimento.
 * @param {number} [options.speed=1] - A velocidade do movimento.
 * @param {THREE.SpotLightHelper} [options.helper] - O SpotLightHelper que acompanhará o SpotLight.
 *
 * EXEMPLO DE USO:
 *
 * import { moveSpotLight } from './moveSpotLight.js';
 * import * as THREE from 'https://esm.sh/three';
 *
 * // Criação da cena, câmera e renderizador
 * const scene = new THREE.Scene();
 * const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
 * const renderer = new THREE.WebGLRenderer({ antialias: true });
 * renderer.setSize(window.innerWidth, window.innerHeight);
 * document.body.appendChild(renderer.domElement);
 *
 * // Criação do SpotLight e do objeto target
 * const spotLight = new THREE.SpotLight(0xff0000, 1);
 * const target = new THREE.Object3D();
 * spotLight.target = target;
 *
 * // Criação do SpotLightHelper
 * const spotLightHelper = new THREE.SpotLightHelper(spotLight);
 *
 * scene.add(spotLight);
 * scene.add(target);
 * scene.add(spotLightHelper);
 *
 * // Posiciona a câmera
 * camera.position.set(0, 10, 30);
 *
 * // Função de animação
 * function animate() {
 *   requestAnimationFrame(animate);
 *
 *   // Move o SpotLight, atualiza o target e o helper com amplitude 5 e velocidade 2
 *   moveSpotLight(spotLight, target, { amplitude: 5, speed: 2, helper: spotLightHelper });
 *
 *   renderer.render(scene, camera);
 * }
 *
 * animate();
 */
export function moveSpotLight(spotLight, target, options = {}) {
    const amplitude = options.amplitude ?? 10; // Distância máxima do movimento
    const speed = options.speed ?? 1;          // Velocidade do movimento
  
    // Obtem o tempo atual (em milissegundos)
    const time = performance.now();
  
    // Calcula os deslocamentos para X e Z usando funções senoidais
    const newX = amplitude * Math.sin(time * speed * 0.001);
    const newZ = amplitude * Math.cos(time * speed * 0.001);
  
    // Atualiza a posição do SpotLight (mantém o valor atual de Y)
    spotLight.position.set(target.position.x, spotLight.position.y, newZ);
  
    // Atualiza a posição do target, se fornecido
    if (target) {
    //   target.position.set(newX, target.position.y, newZ);
      spotLight.target.position.set(target.position.x, spotLight.target.position.y, newZ);
      spotLight.target.updateMatrixWorld();

    //   spotLight.updateMatrixWorld();
    //   spotLight.target.updateMatrixWorld();
    }
  
    // Atualiza o SpotLightHelper, se fornecido
    if (options.helper && typeof options.helper.update === 'function') {
      options.helper.update();
    }
  }
  


  /**
 * swingSpotLight - Anima um SpotLight suspenso com um movimento oscilatório, simulando o balanço de uma lâmpada
 * que foi atingida.
 *
 * A função calcula um ângulo de balanço com base em uma função senoidal e atualiza a rotação do SpotLight.
 * É importante que o SpotLight esteja "pendurado" num pivot (ou seja, sua origem de rotação esteja posicionada de
 * modo adequado) para que o efeito de balanço fique realista.
 *
 * Parâmetros:
 * @param {THREE.SpotLight} spotLight - A instância do SpotLight a ser animada.
 * @param {Object} [options={}] - Opções para o movimento.
 * @param {number} [options.amplitude=Math.PI/8] - Amplitude máxima do balanço (em radianos).
 * @param {number} [options.frequency=1] - Frequência do balanço (oscilação por segundo).
 * @param {number} [options.phase=0] - Fase inicial da oscilação (em radianos).
 * @param {THREE.SpotLightHelper} [options.helper] - Opcional. Se fornecido, o helper é atualizado a cada quadro.
 *
 * EXEMPLO DE USO:
 *
 * import * as THREE from 'https://esm.sh/three';
 * import { swingSpotLight } from './swingSpotLight.js';
 *
 * // Configuração básica da cena
 * const scene = new THREE.Scene();
 * const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
 * const renderer = new THREE.WebGLRenderer({ antialias: true });
 * renderer.setSize(window.innerWidth, window.innerHeight);
 * renderer.shadowMap.enabled = true;
 * document.body.appendChild(renderer.domElement);
 *
 * // Criação do SpotLight e definição das sombras
 * const spotLight = new THREE.SpotLight(0xffdd99, 1);
 * spotLight.castShadow = true;
 * spotLight.position.set(0, 10, 0);
 * scene.add(spotLight);
 *
 * // (Opcional) Criação e adição do helper
 * const spotLightHelper = new THREE.SpotLightHelper(spotLight);
 * scene.add(spotLightHelper);
 *
 * // Configuração de um objeto para visualizar a sombra
 * const planeGeometry = new THREE.PlaneGeometry(100, 100);
 * const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
 * const ground = new THREE.Mesh(planeGeometry, planeMaterial);
 * ground.rotation.x = - Math.PI / 2;
 * ground.receiveShadow = true;
 * scene.add(ground);
 *
 * camera.position.set(0, 15, 25);
 *
 * // Função de animação
 * function animate() {
 *   requestAnimationFrame(animate);
 *
 *   // Anima o SpotLight com um balanço oscilatório
 *   swingSpotLight(spotLight, { amplitude: Math.PI/6, frequency: 1.5, phase: 0, helper: spotLightHelper });
 *
 *   renderer.render(scene, camera);
 * }
 *
 * animate();
 */
export function swingSpotLight(spotLight, options = {}) {
    const amplitude = options.amplitude ?? Math.PI / 8; // Ângulo máximo em radianos
    const frequency = options.frequency ?? 1;            // Oscilações por segundo
    const phase = options.phase ?? 0;                    // Fase inicial em radianos
  
    // Obtém o tempo atual e converte para segundos
    const timeInSeconds = performance.now() * 0.001;
  
    // Calcula o ângulo de balanço usando a função senoidal
    const angle = amplitude * Math.sin(2 * Math.PI * frequency * timeInSeconds + phase);
  
    
    // Atualiza a rotação do SpotLight ao redor do eixo Z
    // (É importante que o pivot de rotação esteja posicionado adequadamente na hierarquia do objeto)
    spotLight.rotation.z = angle;


    // spotLight.target.updateMatrixWorld();
  
    // Se um helper for fornecido, atualize-o
    if (options.helper && typeof options.helper.update === 'function') {
        options.helper.update();
    }
  }
  