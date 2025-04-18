async function requestDeviceOrientationPermission(controlsMobile) {
    if (typeof controlsMobile !== 'undefined' && typeof controlsMobile.requestPermission === 'function') {

        try {
            const response = await controlsMobile.requestPermission();
            if (response === 'granted') {
                alert('✅ Permissão concedida para sensores!');
                console.log('✅ Permissão concedida para sensores!');
            } else {
                alert('⚠️ Permissão negada para sensores!');
                console.warn('⚠️ Permissão negada para sensores!');
            }
        } catch (error) {
            alert('Erro ao solicitar permissão de orientação');
            console.error('Erro ao solicitar permissão de orientação:', error);
        }
  
    } else {
        alert('🔓 Permissão não necessária (Android ou desktop)');
        console.log('🔓 Permissão não necessária (Android ou desktop)');
    }
}



export { requestDeviceOrientationPermission };