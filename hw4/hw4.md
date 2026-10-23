# Docker 開發環境建置步驟

## 步驟 1：確認 Docker 版本

查看目前安裝的 Docker 版本：

```bash
docker --version
```

目前記錄的輸出：

```text
Docker version 29.8.2, build 7fc2dff
```

## 步驟 2：下載 Ubuntu 映像

下載 Ubuntu 24.04，作為開發環境的基礎映像：

```bash
docker pull ubuntu:24.04
```

這個步驟已執行完成，Ubuntu 24.04 映像已下載到本機。

## 步驟 3：建立 Dockerfile

在 `hw4` 目錄建立 `Dockerfile`，用來設定開發環境需要安裝的工具：

```bash
touch Dockerfile
```

開啟 `Dockerfile`，貼入以下內容並儲存：

```dockerfile
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
```

## 步驟 4：建立共用資料夾

在 Mac 上建立 `shain` 資料夾，供容器存取共用檔案：

```bash
mkdir -p /Users/Shared/shain
```

後續會將這個資料夾掛載到容器內的 `/shain`。

## 步驟 5：建立 Docker Compose 設定

設定映像建置方式、容器名稱及共用資料夾。

在 `hw4` 目錄建立 `docker-compose.yml`：

```bash
touch docker-compose.yml
```

開啟 `docker-compose.yml`，貼入以下內容並儲存：

```yaml
services:
  dev-vm:
    build: .
    container_name: my-dev-vm
    restart: always
    volumes:
      # 將 Mac 的 shain 資料夾掛載到容器內的 /shain
      - /Users/Shared/shain:/shain
    working_dir: /shain
```

`build: .` 會使用同一個目錄下的 `Dockerfile` 建置映像，容器名稱為 `my-dev-vm`。Mac 的 `/Users/Shared/shain` 對應到容器內的 `/shain`，進入容器後的預設工作目錄也是 `/shain`。

## 步驟 6：建置開發環境映像

在 `hw4` 目錄執行以下指令，依照前面的設定建置開發環境映像：

```bash
docker compose build
```

建置時會使用前面下載的 Ubuntu 24.04 基礎映像，並下載、安裝 `Dockerfile` 中設定的開發工具。

## 步驟 7：設定 vm 快捷指令

在 Mac 終端機執行以下指令，將 `vm` 別名加入 `~/.zshrc`，並載入設定。這個設定只需要新增一次：

```bash
echo 'alias vm="docker exec -it my-dev-vm bash"' >> ~/.zshrc
source ~/.zshrc
```

之後容器正在執行時，可以在 Mac 的任何目錄輸入以下指令，進入容器的 `/shain`：

```bash
vm
```

在容器內輸入 `exit` 即可離開 Bash，容器仍會在背景執行。
