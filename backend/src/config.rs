use std::env;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub upload_dir: String,
    pub cors_origin: String,
    pub port: u16,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL")
                .expect("DATABASE_URL must be set"),
            jwt_secret: env::var("JWT_SECRET")
                .expect("JWT_SECRET must be set"),
            upload_dir: env::var("UPLOAD_DIR")
                .unwrap_or_else(|_| "./uploads".to_string()),
            cors_origin: env::var("CORS_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:3001".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .expect("PORT must be a valid number"),
        }
    }
}
