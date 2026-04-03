use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;

/// Save uploaded file to disk at `upload_dir/trip_id/doc_id/file_name`.
/// Returns the relative storage path.
pub async fn save_file(
    upload_dir: &str,
    trip_id: Uuid,
    doc_id: Uuid,
    file_name: &str,
    data: &[u8],
) -> Result<String, std::io::Error> {
    let dir: PathBuf = [upload_dir, &trip_id.to_string(), &doc_id.to_string()]
        .iter()
        .collect();
    fs::create_dir_all(&dir).await?;

    let file_path = dir.join(file_name);
    fs::write(&file_path, data).await?;

    // Return a relative path from upload_dir root.
    let relative = format!("{}/{}/{}", trip_id, doc_id, file_name);
    Ok(relative)
}

/// Delete a file from disk given its relative storage path.
pub async fn delete_file(upload_dir: &str, path: &str) -> Result<(), std::io::Error> {
    let full_path: PathBuf = [upload_dir, path].iter().collect();
    if full_path.exists() {
        fs::remove_file(&full_path).await?;
    }

    // Try to remove the parent directory if empty.
    if let Some(parent) = full_path.parent() {
        let _ = fs::remove_dir(parent).await;
    }

    Ok(())
}
