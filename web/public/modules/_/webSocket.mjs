function webSocketHandler() {
    // Inicia a conexão com o servidor via WebSocket
    const webSocket = new WebSocket("ws://localhost:5000/ws");

    webSocket.onopen = () => {
        console.log('%c[webSocketHandler][onopen]»»','background: yellow;color: black;', "Conexão WebSocket estabelecida.");
    };

    webSocket.onmessage = (event) => {
        // console.log("Resposta do servidor:", event.data);
        window.webSocketData = JSON.parse(event.data);


        
        // Se a resposta tiver um timestamp, podemos medir o atraso
        // if (window.webSocketData.timestamp !== undefined) {
        //     const now = performance.now();
        //     const latency = now - window.webSocketData.timestamp; // diferenca em ms
        //     console.log(`Latência: ${latency.toFixed(1)} ms`);

        //     // Supondo que 500 ms seja o limite de atraso tolerável
        //     if (latency > 500) {
        //         console.warn("Muita latência, descartando dados...");
        //         //   return;
        //     }
        // }


    };

    webSocket.onerror = (error) => {
        console.error("Erro na conexão WebSocket:", error);
    };

    webSocket.onclose = () => {
        console.log("Conexão WebSocket fechada.");
    };

    return webSocket;

}


export { webSocketHandler };