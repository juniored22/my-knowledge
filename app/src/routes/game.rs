use axum::{routing::get, Router};
use crate::handlers::game::game_page;

pub fn game_threejs() -> Router {
    Router::new().route("/game", get(game_page))
}