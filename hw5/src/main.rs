use axum::{extract::{DefaultBodyLimit, Path, State}, http::StatusCode, response::{IntoResponse, Response}, routing::get, Json, Router};
use mips_pipeline_lab::simulation::{simulate, Simulation, SimulationInput};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tower_http::services::{ServeDir, ServeFile};

type Database = Arc<Mutex<Connection>>;
struct ApiError(StatusCode, String);
impl IntoResponse for ApiError {
    fn into_response(self) -> Response { (self.0, Json(serde_json::json!({"error": self.1}))).into_response() }
}
fn internal(error: impl std::fmt::Display) -> ApiError {
    eprintln!("{error}"); ApiError(StatusCode::INTERNAL_SERVER_ERROR, "儲存或處理失敗，請查看後端日誌".into())
}
fn missing() -> ApiError { ApiError(StatusCode::NOT_FOUND, "紀錄不存在".into()) }
async fn database<T: Send + 'static>(db: Database, task: impl FnOnce(&mut Connection) -> Result<T, ApiError> + Send + 'static) -> Result<T, ApiError> {
    tokio::task::spawn_blocking(move || { let mut conn = db.lock().map_err(internal)?; task(&mut conn) }).await.map_err(internal)?
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ProgramDraft { title: String, input: SimulationInput }
#[derive(Serialize)]
struct Program { id: i64, title: String, input: SimulationInput, updated_at: i64 }
fn validate_draft(draft: &ProgramDraft) -> Result<(), ApiError> {
    if draft.title.trim().is_empty() || draft.title.chars().count() > 100 { return Err(ApiError(StatusCode::BAD_REQUEST, "名稱須為 1–100 字".into())); }
    if draft.input.source.len() > 262144 { return Err(ApiError(StatusCode::BAD_REQUEST, "程式文字最多 256 KiB".into())); }
    Ok(())
}
fn get_program(conn: &Connection, id: i64) -> Result<Program, ApiError> {
    let row = conn.query_row("SELECT id,title,input,updated_at FROM programs WHERE id=?", [id], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, i64>(3)?))).optional().map_err(internal)?.ok_or_else(missing)?;
    Ok(Program { id: row.0, title: row.1, input: serde_json::from_str(&row.2).map_err(internal)?, updated_at: row.3 })
}
async fn programs(State(db): State<Database>) -> Result<Json<Vec<Program>>, ApiError> {
    database(db, |conn| {
        let mut stmt = conn.prepare("SELECT id FROM programs ORDER BY updated_at DESC,id DESC LIMIT 100").map_err(internal)?;
        let ids: Vec<i64> = stmt.query_map([], |row| row.get(0)).map_err(internal)?.collect::<Result<_, _>>().map_err(internal)?;
        ids.into_iter().map(|id| get_program(conn, id)).collect::<Result<Vec<_>, _>>().map(Json)
    }).await
}
async fn program(State(db): State<Database>, Path(id): Path<i64>) -> Result<Json<Program>, ApiError> { database(db, move |conn| get_program(conn, id).map(Json)).await }
async fn create_program(State(db): State<Database>, Json(draft): Json<ProgramDraft>) -> Result<(StatusCode, Json<Program>), ApiError> {
    validate_draft(&draft)?;
    database(db, move |conn| {
        conn.execute("INSERT INTO programs(title,input) VALUES(?,?)", params![draft.title.trim(), serde_json::to_string(&draft.input).map_err(internal)?]).map_err(internal)?;
        Ok((StatusCode::CREATED, Json(get_program(conn, conn.last_insert_rowid())?)))
    }).await
}
async fn update_program(State(db): State<Database>, Path(id): Path<i64>, Json(draft): Json<ProgramDraft>) -> Result<Json<Program>, ApiError> {
    validate_draft(&draft)?;
    database(db, move |conn| {
        let changed = conn.execute("UPDATE programs SET title=?,input=?,updated_at=unixepoch() WHERE id=?", params![draft.title.trim(), serde_json::to_string(&draft.input).map_err(internal)?, id]).map_err(internal)?;
        if changed == 0 { return Err(missing()); } get_program(conn, id).map(Json)
    }).await
}
async fn delete_program(State(db): State<Database>, Path(id): Path<i64>) -> Result<StatusCode, ApiError> {
    database(db, move |conn| { if conn.execute("DELETE FROM programs WHERE id=?", [id]).map_err(internal)? == 0 { return Err(missing()); } Ok(StatusCode::NO_CONTENT) }).await
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RunDraft { title: String, program_id: Option<i64>, input: SimulationInput }
#[derive(Serialize)]
struct RunSummary { id: i64, title: String, program_id: Option<i64>, created_at: i64, status: String, cycles: usize, retired: usize }
#[derive(Serialize)]
struct Run { id: i64, title: String, program_id: Option<i64>, created_at: i64, simulation: Simulation }
async fn create_run(State(db): State<Database>, Json(draft): Json<RunDraft>) -> Result<(StatusCode, Json<Run>), ApiError> {
    if draft.title.trim().is_empty() || draft.title.chars().count() > 100 { return Err(ApiError(StatusCode::BAD_REQUEST, "名稱須為 1–100 字".into())); }
    let simulation = tokio::task::spawn_blocking(move || simulate(draft.input)).await.map_err(internal)?.map_err(|e| ApiError(StatusCode::BAD_REQUEST, e))?;
    database(db, move |conn| {
        if let Some(id) = draft.program_id { get_program(conn, id)?; }
        let json = serde_json::to_string(&simulation).map_err(internal)?;
        conn.execute("INSERT INTO runs(title,program_id,result,status,cycles,retired) VALUES(?,?,?,?,?,?)", params![draft.title.trim(), draft.program_id, json, simulation.status, simulation.statistics.cycles as i64, simulation.statistics.retired as i64]).map_err(internal)?;
        let id = conn.last_insert_rowid();
        let created_at = conn.query_row("SELECT created_at FROM runs WHERE id=?", [id], |r| r.get(0)).map_err(internal)?;
        Ok((StatusCode::CREATED, Json(Run { id, title: draft.title.trim().into(), program_id: draft.program_id, created_at, simulation })))
    }).await
}
async fn runs(State(db): State<Database>) -> Result<Json<Vec<RunSummary>>, ApiError> {
    database(db, |conn| {
        let mut stmt = conn.prepare("SELECT id,title,program_id,created_at,status,cycles,retired FROM runs ORDER BY id DESC LIMIT 100").map_err(internal)?;
        let rows = stmt.query_map([], |r| Ok(RunSummary { id: r.get(0)?, title: r.get(1)?, program_id: r.get(2)?, created_at: r.get(3)?, status: r.get(4)?, cycles: r.get::<_, u32>(5)? as usize, retired: r.get::<_, u32>(6)? as usize })).map_err(internal)?;
        rows.collect::<Result<Vec<_>, _>>().map(Json).map_err(internal)
    }).await
}
async fn run(State(db): State<Database>, Path(id): Path<i64>) -> Result<Json<Run>, ApiError> {
    database(db, move |conn| {
        let (title, program_id, created_at, result) = conn.query_row("SELECT title,program_id,created_at,result FROM runs WHERE id=?", [id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, Option<i64>>(1)?, r.get::<_, i64>(2)?, r.get::<_, String>(3)?))).optional().map_err(internal)?.ok_or_else(missing)?;
        let simulation: Simulation = serde_json::from_str(&result).map_err(internal)?;
        if simulation.model_version != mips_pipeline_lab::simulation::MODEL_VERSION { return Err(ApiError(StatusCode::CONFLICT, "此紀錄的模型版本不受目前介面支援".into())); }
        Ok(Json(Run { id, title, program_id, created_at, simulation }))
    }).await
}
async fn delete_run(State(db): State<Database>, Path(id): Path<i64>) -> Result<StatusCode, ApiError> {
    database(db, move |conn| { if conn.execute("DELETE FROM runs WHERE id=?", [id]).map_err(internal)? == 0 { return Err(missing()); } Ok(StatusCode::NO_CONTENT) }).await
}
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let conn = Connection::open(std::env::var("DATABASE_PATH").unwrap_or_else(|_| "mips.db".into()))?;
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    conn.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS programs(id INTEGER PRIMARY KEY, title TEXT NOT NULL, input TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT(unixepoch()));
        CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY, title TEXT NOT NULL, program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL, result TEXT NOT NULL, status TEXT NOT NULL, cycles INTEGER NOT NULL, retired INTEGER NOT NULL, created_at INTEGER NOT NULL DEFAULT(unixepoch()));")?;
    let api = Router::new()
        .route("/programs", get(programs).post(create_program))
        .route("/programs/{id}", get(program).put(update_program).delete(delete_program))
        .route("/simulations", get(runs).post(create_run))
        .route("/simulations/{id}", get(run).delete(delete_run))
        .fallback(|| async { ApiError(StatusCode::NOT_FOUND, "API 不存在".into()) });
    let app = Router::new().nest("/api/v1", api)
        .route("/health", get(|| async { "OK" }))
        .fallback_service(ServeDir::new("frontend/dist").not_found_service(ServeFile::new("frontend/dist/index.html")))
        .layer(DefaultBodyLimit::max(524288)).with_state(Arc::new(Mutex::new(conn)));
    let address = std::env::var("SERVER_ADDR").unwrap_or_else(|_| "127.0.0.1:8080".into());
    let listener = tokio::net::TcpListener::bind(&address).await?;
    println!("MIPS Pipeline Lab：http://{address}");
    axum::serve(listener, app).with_graceful_shutdown(async { let _ = tokio::signal::ctrl_c().await; }).await?;
    Ok(())
}
