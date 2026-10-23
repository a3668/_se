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

# 依賴安裝在獨立目錄，避免被 /shain 的 bind mount 蓋掉。
WORKDIR /opt/chat-deps
COPY chat/package.json chat/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
ENV NODE_PATH=/opt/chat-deps/node_modules

# 保留映像內的程式；Compose 使用 Mac 的 chat 目錄覆蓋它。
COPY chat/ /shain/chat/

# 保留進入容器時的預設工作目錄
WORKDIR /shain

# 啟動後端後，仍可透過 vm 或 03-attach.sh 進入 Bash
EXPOSE 3000
CMD ["node", "/shain/chat/server.cjs"]
