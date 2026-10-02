use std::io::{self, Write};

use reqwest::blocking::{Client, Response};
use reqwest::header::{CONTENT_TYPE, HeaderMap};
use reqwest::redirect::Policy;
use reqwest::Method;

use crate::cli::Cli;

pub fn send(cli: &Cli) -> Result<Response, reqwest::Error> {
    let redirect = if cli.follow_redirects {
        Policy::limited(10)
    } else {
        Policy::none()
    };
    let client = Client::builder()
        .user_agent(concat!("kcurl/", env!("CARGO_PKG_VERSION")))
        .timeout(cli.timeout)
        .redirect(redirect)
        .build()?;

    let method = cli.method.clone().unwrap_or_else(|| {
        if cli.data.is_empty() {
            Method::GET
        } else {
            Method::POST
        }
    });
    let mut headers = HeaderMap::new();
    for (name, value) in &cli.headers {
        headers.append(name.clone(), value.clone());
    }
    if !cli.data.is_empty() && !headers.contains_key(CONTENT_TYPE) {
        headers.insert(
            CONTENT_TYPE,
            reqwest::header::HeaderValue::from_static("application/x-www-form-urlencoded"),
        );
    }

    let mut request = client.request(method, cli.url.clone()).headers(headers);
    if !cli.data.is_empty() {
        request = request.body(cli.data.join("&"));
    }
    request.send()
}

pub fn write_response(
    response: &mut Response,
    output: &mut impl Write,
    include: bool,
) -> io::Result<()> {
    if include {
        write!(output, "{:?} {}\r\n", response.version(), response.status())?;
        for (name, value) in response.headers() {
            write!(output, "{name}: ")?;
            output.write_all(value.as_bytes())?;
            output.write_all(b"\r\n")?;
        }
        output.write_all(b"\r\n")?;
    }

    // 串流複製原始位元組，避免二進位檔案被文字轉換或整份載入記憶體。
    io::copy(response, output)?;
    output.flush()
}
