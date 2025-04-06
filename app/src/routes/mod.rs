// app/src/routes/mod.rs

pub mod home;
pub mod users;
pub mod foo;
pub mod game;
pub mod sandbox;

use axum::Router;

pub fn all_routes() -> Router {
    Router::new()
        .merge(home::home_routes())
        .merge(users::user_routes())
        .merge(foo::foo_routes())
        .merge(game::game_threejs())
        .merge(sandbox::sandbox())
}