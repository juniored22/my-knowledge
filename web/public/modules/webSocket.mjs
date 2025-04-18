function webSocketHandler() {
    // Inicia a conexão com o servidor via WebSocket
    const webSocket = new WebSocket("ws://localhost:5000/ws");
    // const webSocket = new WebSocket("https://fd89-200-53-197-38.ngrok-free.app/ws");

    webSocket.onopen = () => {
        console.log('%c[webSocketHandler][onopen]»»','background: yellow;color: black;', "Conexão WebSocket estabelecida.");
        window.webSocketDebugger = 'canected';
    };

    webSocket.onmessage = (event) => {
       
        window.webSocketData = JSON.parse(event.data);
        // console.log("Resposta do servidor:", window.webSocketData);
 
        // Se a resposta tiver um timestamp, podemos medir o atraso
        if (window.webSocketData.timestamp !== undefined) {
            const now = performance.now();
            const latency = now - window.webSocketData.timestamp; // diferenca em ms
            window.webSocketData.latency = latency.toFixed(1);
            // console.log(`Latência: ${latency.toFixed(1)} ms`);

            // Supondo que 500 ms seja o limite de atraso tolerável
            if (latency > 500) {
                console.warn("Muita latência, descartando dados...");
                  return;
            }
        }

        window.webSocketDebugger = 'message';

    };

    webSocket.onerror = (error) => {
        console.error("Erro na conexão WebSocket:", error);
        window.webSocketDebugger = 'error';
    };

    webSocket.onclose = () => {
        console.log("Conexão WebSocket fechada.");
        window.webSocketDebugger = 'close';
    };

    return webSocket;

}


export { webSocketHandler };