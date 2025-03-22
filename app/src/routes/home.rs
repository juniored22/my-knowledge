use axum::{routing::get, Router};
use crate::handlers::home::home_page;

pub fn home_routes() -> Router {
    Router::new().route("/", get(home_page))
}