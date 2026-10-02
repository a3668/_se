mod cli;
mod http;

use std::error::Error;
use std::fs::File;
use std::io::{self, BufWriter};
use std::process::ExitCode;

use clap::Parser;

use cli::Cli;

fn main() -> ExitCode {
    let cli = Cli::parse();
    let mut response = match http::send(&cli) {
        Ok(response) => response,
        Err(error) => {
            report_http_error(error);
            return ExitCode::FAILURE;
        }
    };

    let result = match &cli.output {
        Some(path) if path.as_os_str() != "-" => {
            let file = match File::create(path) {
                Ok(file) => file,
                Err(error) => {
                    eprintln!("kcurl: 無法建立輸出檔案 {}：{error}", path.display());
                    return ExitCode::FAILURE;
                }
            };
            http::write_response(&mut response, &mut BufWriter::new(file), cli.include)
        }
        _ => {
            let stdout = io::stdout();
            http::write_response(&mut response, &mut stdout.lock(), cli.include)
        }
    };

    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) if error.kind() == io::ErrorKind::BrokenPipe && is_stdout(&cli) => {
            ExitCode::SUCCESS
        }
        Err(error) => {
            if is_timeout(&error) {
                eprintln!("kcurl: 讀取回應逾時");
            } else {
                eprintln!("kcurl: 讀取回應或寫入輸出失敗：{error}");
            }
            ExitCode::FAILURE
        }
    }
}

fn is_stdout(cli: &Cli) -> bool {
    cli.output.as_ref().is_none_or(|path| path.as_os_str() == "-")
}

fn is_timeout(error: &(dyn Error + 'static)) -> bool {
    if let Some(error) = error.downcast_ref::<reqwest::Error>() {
        if error.is_timeout() {
            return true;
        }
    }
    if let Some(error) = error.downcast_ref::<io::Error>() {
        if error.kind() == io::ErrorKind::TimedOut {
            return true;
        }
        if let Some(inner) = error.get_ref() {
            if is_timeout(inner) {
                return true;
            }
        }
    }
    error.source().is_some_and(is_timeout)
}

fn report_http_error(error: reqwest::Error) {
    let reason = if error.is_timeout() {
        "請求逾時"
    } else if error.is_redirect() {
        "重新導向失敗或超過 10 次上限"
    } else if error.is_connect() {
        "連線失敗，請確認網址、網路與 TLS 憑證"
    } else {
        "HTTP 請求失敗"
    };
    // 不在錯誤訊息中再次輸出完整網址，避免帶出查詢參數中的敏感資料。
    eprintln!("kcurl: {reason}：{}", error.without_url());
}
