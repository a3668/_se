FROM ubuntu:24.04

# 安裝時不顯示互動提示，並設定時區
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Taipei

# 安裝基礎開發工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    make \
    curl \
    git \
    vim \
    tmux \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    ca-certificates \
    sudo \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# 安裝 Rust 工具鏈
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && rustup --version \
    && cargo --version \
    && rustc --version

# 容器內的工作目錄，之後由 Compose 掛載 Mac 的 shain 資料夾
WORKDIR /shain

# 讓容器持續在背景執行
CMD ["sleep", "infinity"]
