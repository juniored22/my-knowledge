import * as THREE from 'https://esm.sh/three';



const options = { 
    antialias: true,  // suaviza serrilhado (FXAA)
    alpha: false,      // fundo transparente
    depth: true,      // habilita/depth buffer
    stencil: false,   // habilita/desabilita stencil buffer
    logarithmicDepthBuffer: true, // útil em cenas muito grandes
    preserveDrawingBuffer: false,  // para screenshots
    powerPreference: "high-performance", // ou "low-power"
}

export const Render = async (canvas, {width, height, devicePixelRatio} = {}) => {
   
    console.log('[myRender]»');

    if (!canvas)  throw new Error('Render: canvas is undefined');

    options.canvas = canvas;
   
    const renderer = new THREE.WebGLRenderer(options);

    renderer.setClearColor(0x000000, 1);
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min( devicePixelRatio, 1));
    renderer.xr.enabled = true; 
    renderer.clear(); // limpa buffers

    renderer.physicallyCorrectLights = true;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // outras: BasicShadowMap, PCFShadowMap

    // renderer.autoClear = false;
    renderer.sortObjects = true;
    
    return renderer;
}
