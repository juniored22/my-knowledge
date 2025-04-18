// DeviceOrientationControls.js
import * as THREE from 'https://esm.sh/three';

window.bStop = false;

export class DeviceOrientationControls {
  constructor(camera) {
    this.camera = camera;
    this.enabled = true;

    this.deviceQuaternion = new THREE.Quaternion();
    this.screenTransform = new THREE.Quaternion();
    this.worldTransform = new THREE.Quaternion(
      //-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5) // Rotaciona -90° no eixo X para alinhar com o mundo
      0, 0, 0,  Math.sqrt(0.5)
    );
    this.euler = new THREE.Euler();

    // Indicador simples de que já iniciamos o listener após permissão
    this.initialized = false;

    // Bind do método para manter o "this" correto no eventListener
    this.setOrientation = this.setOrientation.bind(this);
    
  }

  /**
   * Solicita permissão de acesso aos eventos de orientação
   * (relevante apenas em iOS 13+, caso contrário, não é necessário).
   */
  async requestPermission() {
    // Verifica se a API está disponível (iOS 13+)
    const hasPermissionAPI =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function';

    if (hasPermissionAPI) {
      try {
        const permissionState = await DeviceOrientationEvent.requestPermission();
        if (permissionState === 'granted') {
          // Se o usuário concedeu permissão, ativamos o listener
          window.addEventListener('deviceorientation', this.setOrientation, true);
          this.initialized = true;
          console.log('Permissão de DeviceOrientation concedida!');
          alert('✅ Permissão de DeviceOrientation concedida!');
        } else {
          console.warn('Permissão de DeviceOrientation negada pelo usuário.');
          alert('🔓 Permissão de DeviceOrientation negada pelo usuário.');
        }
      } catch (error) {
        console.error('Erro ao solicitar permissão de DeviceOrientation:', error);
      }
    } else {
      // Se não estamos em iOS 13+ ou o método não existe, basta ativar o listener
      window.addEventListener('deviceorientation', this.setOrientation, true);
      this.initialized = true;
      alert('✅ Permissão de DeviceOrientation concedida!');
      console.log('API requestPermission não encontrada; listener adicionado sem necessidade de permissão.');

      return 'granted';
    }
  }

  /**
   * Callback chamado quando o dispositivo emite evento de orientação.
   */
  setOrientation(event) {

  
    // Bloqueia caso o controle esteja desativado ou ainda não tenha inicializado
    if (!this.enabled || !this.initialized) return;

   
    const { alpha, beta, gamma } = event;
    if (alpha === null || beta === null || gamma === null) return;
 

    const degToRad = Math.PI / 45;
  


    // Define os ângulos de Euler de acordo com a orientação do dispositivo
    // this.euler.set(
    //   -gamma * degToRad,   // Inclinação lateral, invertida (Z)
    //   0,//alpha * degToRad,    // Bússola (Y)
    //   - beta * degToRad,     // Inclinação para frente/trás (X)
     
    
   
    //   'XYZ'                // Ordem de rotação importante!
    // );

    this.euler.set(
      -gamma * degToRad ,alpha * degToRad,0,
      'XYZ'                // Ordem de rotação importante!
    );


 
    // Constrói a rotação final a partir dos eixos (Euler)
    this.deviceQuaternion.setFromEuler(this.euler);


 
    // document.querySelector('.infoSystem').innerHTML = `${JSON.stringify(this.camera.quaternion)}`
    // Multiplica na ordem necessária para obter a rotação correta da câmera
    this.camera.quaternion.copy(this.worldTransform);
    this.camera.quaternion.multiply(this.deviceQuaternion);
    this.camera.quaternion.multiply(this.screenTransform);

    // this.camera.rotation.x = this.euler.x;
    // this.camera.rotation.y = this.euler.y;
    // this.camera.rotation.z = this.euler.z;


    // document.querySelector('.infoSystem').innerHTML = `alpha: ${alpha.toFixed(2)} | beta: ${beta.toFixed(2)} | gamma: ${gamma.toFixed(2)} | euler: ${this.euler.x.toFixed(2)} | ${this.euler.y.toFixed(2)} | ${this.euler.z.toFixed(2)}`
    // if(!window.bStop) {
    //   window.bStop = true;
    //   alert(JSON.stringify(alpha));
    // }
    // return
   
  }

  /**
   * Método de atualização (caso queira adicionar alguma lógica adicional por frame).
   */
  update() {
    // Se necessário, adicionar lógica adicional aqui.
  }

  /**
   * Remove o listener para evitar vazamento de memória ou conflitos.
   */
  dispose() {
    
    return;
    window.removeEventListener('deviceorientation', this.setOrientation, true);
  }
}
