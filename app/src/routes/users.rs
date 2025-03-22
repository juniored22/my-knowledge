use axum::{routing::post, Router};
use crate::handlers::home::create_user;

pub fn user_routes() -> Router {
    Router::new().route("/users", post(create_user))
}