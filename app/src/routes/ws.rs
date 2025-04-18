use axum::{routing::get, Router};
use crate::handlers::ws_handler::ws_handler;

pub fn ws_routes() -> Router {
    Router::new().route("/ws", get(ws_handler))
}