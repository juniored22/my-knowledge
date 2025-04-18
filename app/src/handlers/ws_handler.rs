// app/src/handlers/ws_handler.rs

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
};
use futures::{StreamExt};
use base64::{engine::general_purpose, Engine as _};
use image::GenericImageView;

// Função que será chamada para atualizar a conexão WebSocket.
pub async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

/// Função que lida com a conexão WebSocket, processando as mensagens recebidas.
async fn handle_socket(mut socket: WebSocket) {
    while let Some(result) = socket.next().await {
        match result {
            Ok(Message::Text(text)) => {
                // Remove o prefixo "data:image/jpeg;base64,", se presente.
                let base64_str = text
                    .strip_prefix("data:image/jpeg;base64,")
                    .unwrap_or(&text);
                    
                // Decodifica a string base64 para bytes.
                match general_purpose::STANDARD.decode(base64_str) {
                    Ok(image_bytes) => {
                        // Tenta carregar a imagem a partir dos bytes.
                        match image::load_from_memory(&image_bytes) {
                            Ok(img) => {
                                // Exemplo de processamento: obtém as dimensões da imagem.
                                let (width, height) = img.dimensions();
                                let response_text = format!("Imagem processada: {}x{}", width, height);
                                
                                if let Err(e) = socket.send(Message::Text(response_text)).await {
                                    eprintln!("Erro ao enviar mensagem: {}", e);
                                }
                            }
                            Err(e) => {
                                let error_msg = format!("Erro ao carregar a imagem: {}", e);
                                let _ = socket.send(Message::Text(error_msg)).await;
                            }
                        }
                    }
                    Err(e) => {
                        let error_msg = format!("Erro na decodificação base64: {}", e);
                        let _ = socket.send(Message::Text(error_msg)).await;
                    }
                }
            }
            Ok(Message::Close(_)) => {
                break;
            }
            Err(e) => {
                eprintln!("Erro na mensagem WebSocket: {}", e);
                break;
            }
            _ => {}
        }
    }
}