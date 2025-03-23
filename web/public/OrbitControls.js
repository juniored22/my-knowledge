// OrbitControls.js
import {
    EventDispatcher,
    MOUSE,
    Quaternion,
    Spherical,
    TOUCH,
    Vector2,
    Vector3
  } from 'https://unpkg.com/three@0.155.0/build/three.module.js';
  
  const OrbitControls = function (object, domElement) {
    // Adaptado do OrbitControls oficial da three.js r155
    // Fonte original: https://github.com/mrdoob/three.js/blob/r155/examples/jsm/controls/OrbitControls.js
  
    this.object = object;
    this.domElement = domElement;
  
    // Suporte básico para rotação com mouse
    const scope = this;
    const rotateStart = new Vector2();
    const rotateEnd = new Vector2();
    const rotateDelta = new Vector2();
  
    this.enabled = true;
    this.target = new Vector3();
  
    const spherical = new Spherical();
    const sphericalDelta = new Spherical();
  
    const position = new Vector3();
    const offset = new Vector3();
  
    this.update = function () {
      const quat = new Quaternion().setFromUnitVectors(object.up, new Vector3(0, 1, 0));
      const quatInverse = quat.clone().invert();
  
      position.copy(scope.object.position).sub(scope.target);
      position.applyQuaternion(quat);
  
      spherical.setFromVector3(position);
      spherical.theta += sphericalDelta.theta;
      spherical.phi += sphericalDelta.phi;
  
      spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));
  
      spherical.makeSafe();
  
      position.setFromSpherical(spherical);
      position.applyQuaternion(quatInverse);
      scope.object.position.copy(scope.target).add(position);
  
      scope.object.lookAt(scope.target);
  
      sphericalDelta.set(0, 0, 0);
    };
  
    function onMouseDown(event) {
      if (scope.enabled === false) return;
      event.preventDefault();
  
      rotateStart.set(event.clientX, event.clientY);
      domElement.addEventListener('mousemove', onMouseMove, false);
      domElement.addEventListener('mouseup', onMouseUp, false);
    }
  
    function onMouseMove(event) {
      if (scope.enabled === false) return;
  
      rotateEnd.set(event.clientX, event.clientY);
      rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(0.005);
  
      sphericalDelta.theta -= rotateDelta.x;
      sphericalDelta.phi -= rotateDelta.y;
  
      rotateStart.copy(rotateEnd);
      scope.update();
    }
  
    function onMouseUp() {
      domElement.removeEventListener('mousemove', onMouseMove, false);
      domElement.removeEventListener('mouseup', onMouseUp, false);
    }
  
    domElement.addEventListener('mousedown', onMouseDown, false);
  };
  
  export { OrbitControls };
  