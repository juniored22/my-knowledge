import * as THREE from 'https://esm.sh/three';
import { detectarBolinhaHSV, desenharBolinha } from '/static/utils/detecterTool.mjs';

import { ColorGUIHelper } from '/static/modules/Gui.mjs';
import { Render } from "/static/modules/Render.mjs";
import { Camera } from "/static/modules/Camera.mjs";

import { Lights, HemisphereLight, DirectionalLight, DirectionalLightHelper, PointLight, PointLightHelper, SpotLight, SpotLightHelper, RectAreaLight, RectAreaLightHelperModified } from "/static/modules/Lights.mjs";

self.debuggerLog0 = false;

const scene = new THREE.Scene();
const clock = new THREE.Clock();

let camera;
let renderer;
let ctx;
let lights;
let handLandmarker = null;





self.onmessage = async (e) => {

  if(e.data.type === 'initThree'){

    console.log('%c[worker][initThree]»»','background: green', e.data.type);
    if (!e.data.canvas instanceof OffscreenCanvas) throw new Error('Canvas is not OffscreenCanvas');

    renderer = await Render(e.data.canvas, e.data);
    camera =   await Camera({aspect: e.data.width/e.data.height});

    
    // Chão
    const floor = new THREE.Mesh(new THREE.BoxGeometry( 2000, 0.1, 2000 ),new THREE.MeshStandardMaterial({ color: 0xbcbcbc, roughness: 0.1, metalness: 0 }));
    // floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4;

    lights = await PointLight({intensity: 3});
    lights.name = 'lights';
    scene.add(lights);
    // scene.add(lights.target);
    scene.add(PointLightHelper({light: lights}));

    const spotLight = await SpotLight({intensity: 100});
    spotLight.name = 'spotLight';
    scene.add(spotLight);
    scene.add(SpotLightHelper({light: spotLight}));

    const rectAreaLight = await RectAreaLight({intensity: 3});
    rectAreaLight.name = 'RectAreaLight';
    scene.add(rectAreaLight);
    scene.add(RectAreaLightHelperModified({light: rectAreaLight}));



    // linear color space
    const API = {
      lightProbeIntensity: 1.0,
      directionalLightIntensity: 0.6,
      envMapIntensity: 1
    };

    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.5,
      roughness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 1.0,
      envMapIntensity: API.envMapIntensity,
    });
    const sphere = new THREE.Mesh(geometry, material);
  
    sphere.position.set(3, 0, -10);

    scene.add(sphere);
    scene.add(floor);
    renderer && renderer.setAnimationLoop(animate);
  }

  if (e.data.type === 'envMap') {
    console.log('%c[worker][envMap]»»','background: green', e.data.type);
    const texture = new THREE.CubeTexture(e.data.images);
    texture.needsUpdate = true;
    // scene.background = texture;
  }

  if (e.data.type === 'camera' && camera && renderer) {
    
    if(!self.debuggerLog0){
      console.log('%c[worker][camera]»»','background: green', e.data.type);
      self.debuggerLog0 = true;
    }
    if (camera) {
      camera.position.set(
        e.data.position.x,
        e.data.position.y,
        e.data.position.z
      );
      camera.rotation.set(
        e.data.rotation.x,
        e.data.rotation.y,
        e.data.rotation.z
      );
    }
  }

  if (e.data.type === 'gltf' && renderer) {
    const loader = new THREE.ObjectLoader();
    const model = loader.parse(e.data.model);
    scene.add(model);
    model.position.set(0, 0, -10);

    animate(model);
  }

  if(e.data.type === 'updateColorLight' && renderer && lights){
    console.log('%c[worker][updateColorLight]»»','background: green', e.data.value);
    lights.color.set(e.data.value);
    scene.children.filter((e) => e.name === 'lights')[0].color.set(e.data.value);
  }

  if (e.data.type === 'xr-session' && renderer) {
    renderer.xr.setSession(e.data.session);
  }

  return

  if (e.data.type === 'init') {
    console.log('[worker]»»');
    const canvas = e.data.canvas;
    ctx = canvas.getContext('2d');
    return;
  }

  if (e.data.type === 'process') {
    const { data, width } = e.data;
    const imageData = new Uint8ClampedArray(data);

    ctx.clearRect(0, 0, 640, 480);

    const redFilter = (h, s, v) => ((h < 15 || h > 345) && s > 40 && v > 40);
    const blueFilter = (h, s, v) => (h > 150  && h < 210 && s > 60  && v > 80 );

    const bolinhaVermelha = detectarBolinhaHSV(imageData, width, redFilter, e.data.flip);
    const bolinhaAzul = detectarBolinhaHSV(imageData, width, blueFilter, e.data.flip);

  
    if(e.data.debug){
      if (bolinhaVermelha) desenharBolinha(ctx, bolinhaVermelha, 'red', 26);
      if (bolinhaAzul) desenharBolinha(ctx, bolinhaAzul, 'blue', 150);
    }

    // 📤 Envia de volta para o script principal
    self.postMessage({
      type: 'resultado',
      bolinhaVermelha,
      bolinhaAzul
    });
 
  }
};


function animate() {
  
  self.postMessage({ type: 'fps', value: (1 / clock.getDelta()).toFixed(1) });

  renderer && renderer.render(scene, camera);
  // requestAnimationFrame(animate);
}

