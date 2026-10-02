use std::path::PathBuf;
use std::time::Duration;

use clap::Parser;
use reqwest::header::{HeaderName, HeaderValue};
use reqwest::{Method, Url};

#[derive(Parser)]
#[command(name = "kcurl", version, about = "以命令列傳送 HTTP／HTTPS 請求")]
pub struct Cli {
    /// 請求網址，必須包含 http:// 或 https://
    #[arg(value_name = "URL", value_parser = parse_url)]
    pub url: Url,

    /// 指定 HTTP 方法；預設 GET，使用 -d 時預設 POST
    #[arg(short = 'X', long = "request", value_name = "METHOD", value_parser = parse_method)]
    pub method: Option<Method>,

    /// 自訂標頭，可重複使用，例如 -H 'Content-Type: application/json'
    #[arg(short = 'H', long = "header", value_name = "NAME: VALUE", value_parser = parse_header)]
    pub headers: Vec<(HeaderName, HeaderValue)>,

    /// 傳送原始資料；多個 -d 以 & 連接，不讀取 @檔案
    #[arg(short = 'd', long = "data", value_name = "DATA", allow_hyphen_values = true)]
    pub data: Vec<String>,

    /// 在回應本文前輸出狀態碼與標頭
    #[arg(short = 'i', long = "include")]
    pub include: bool,

    /// 將回應存入檔案（覆寫已有檔案）；- 表示標準輸出
    #[arg(short = 'o', long = "output", value_name = "FILE")]
    pub output: Option<PathBuf>,

    /// 跟隨重新導向，最多 10 次
    #[arg(short = 'L', long = "location")]
    pub follow_redirects: bool,

    /// 請求逾時秒數，須大於 0，支援小數
    #[arg(short = 'm', long = "max-time", visible_alias = "timeout", value_name = "SECONDS", default_value = "30", value_parser = parse_timeout)]
    pub timeout: Duration,
}

fn parse_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|error| format!("網址無效：{error}"))?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("請提供完整的 HTTP／HTTPS 網址".into());
    }
    Ok(url)
}

fn parse_method(value: &str) -> Result<Method, String> {
    Method::from_bytes(value.to_ascii_uppercase().as_bytes())
        .map_err(|_| "HTTP 方法無效".into())
}

fn parse_header(value: &str) -> Result<(HeaderName, HeaderValue), String> {
    let (name, value) = value
        .split_once(':')
        .ok_or("標頭格式須為 NAME: VALUE")?;
    let name = HeaderName::from_bytes(name.trim_matches([' ', '\t']).as_bytes())
        .map_err(|_| "標頭名稱無效".to_string())?;
    let value = HeaderValue::from_str(value.trim_matches([' ', '\t']))
        .map_err(|_| "標頭值無效，不可包含換行或控制字元".to_string())?;
    Ok((name, value))
}

fn parse_timeout(value: &str) -> Result<Duration, String> {
    let seconds = value
        .parse::<f64>()
        .map_err(|_| "逾時秒數須為大於 0 的數字".to_string())?;
    let duration = Duration::try_from_secs_f64(seconds)
        .map_err(|_| "逾時秒數須為有限且大於 0 的數字".to_string())?;
    if duration.is_zero() {
        return Err("逾時秒數須大於 0，最小為 0.000000001 秒".into());
    }
    Ok(duration)
}
