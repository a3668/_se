import { useState } from 'react';
import type { ReactNode } from 'react';
import { architecture, commands, features, navigation, project, screenshots, technologies } from './content';

function ContainerMark({ small = false }: { small?: boolean }) {
  return <span className={`container-mark${small ? ' small' : ''}`} aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>;
}

function SectionHeading({ number, label, title, children }: { number: string; label: string; title: string; children?: ReactNode }) {
  return <div className="section-heading"><p className="eyebrow"><span>{number}</span> {label}</p><h2>{title}</h2>{children && <p className="section-intro">{children}</p>}</div>;
}

function FlowNode({ item, className = '' }: { item: { title: string; subtitle: string; meta: string }; className?: string }) {
  return <div className={`flow-node ${className}`}><strong>{item.title}</strong><span>{item.subtitle}</span><code>{item.meta}</code></div>;
}

function Architecture() {
  return <div className="architecture-board">
    <div className="board-caption"><span className="diagram-key" /> 系統連線示意 <span>依專案設定繪製</span></div>
    <div className="browser-row"><FlowNode item={architecture.browser} className="browser-node" /><div className="entry-line"><span>HTTP · 127.0.0.1:8080</span><b aria-hidden="true">↓</b></div></div>
    <div className="docker-boundary">
      <div className="boundary-label"><ContainerMark small /><strong>Docker Compose</strong><span>3 個容器服務</span></div>
      <div className="container-flow">
        <FlowNode item={architecture.containers[0]} />
        <div className="flow-link"><code>/api/*</code><b aria-hidden="true">→</b></div>
        <FlowNode item={architecture.containers[1]} className="node-backend" />
        <div className="flow-link"><span>SQL</span><b aria-hidden="true">→</b></div>
        <FlowNode item={architecture.containers[2]} />
      </div>
      <div className="volume-label"><span aria-hidden="true">↳</span> PostgreSQL 持久化儲存 <code>chat-data</code></div>
    </div>
    <div className="external-link"><b aria-hidden="true">↓</b><span>Node.js → 主機 · /api/chat</span></div>
    <div className="external-flow"><div className="host-boundary"><span className="boundary-tag">主機 · 容器外</span><FlowNode item={architecture.host} /></div><div className="flow-link cloud-link"><span>網際網路</span><b aria-hidden="true">→</b></div><div className="cloud-boundary"><span className="boundary-tag">雲端</span><FlowNode item={architecture.cloud} /></div></div>
    <p className="diagram-note">只有 Nginx 對主機 發布連接埠；Node.js 與 PostgreSQL 透過 Docker 內部網路溝通。</p>
  </div>;
}

function CommandCard({ command, index }: { command: (typeof commands)[number]; index: number }) {
  const [feedback, setFeedback] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(command.command);
      setFeedback('已複製指令');
    } catch {
      setFeedback('無法自動複製，請選取下方指令文字後複製。');
    }
  }
  return <article className="command-card"><div className="command-description"><span className="step-number">{String(index + 1).padStart(2, '0')}</span><div><span className="command-location">{command.location}</span><h3>{command.title}</h3><p>{command.description}</p></div></div><div className="command-content"><div className="code-toolbar"><span><span className="terminal-prompt">›_</span> shell</span><button type="button" onClick={copy} aria-label={`複製：${command.title}`}>複製指令 <span aria-hidden="true">⧉</span></button></div><pre tabIndex={0} aria-label={`${command.title}指令`}><code>{command.command}</code></pre><p className="copy-feedback" role="status">{feedback}</p>{command.note && <p className="command-note">{command.note}</p>}</div></article>;
}

export default function App() {
  const [failedImages, setFailedImages] = useState<string[]>([]);
  return <>
    <a className="skip-link" href="#main">跳至主要內容</a>
    <header className="site-header"><a className="brand" href="#top"><ContainerMark small /><span>HW4<span className="brand-divider">/</span>DOCKER LAB</span></a><nav aria-label="主要導覽">{navigation.map(item => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}</nav><span className="header-label">PROJECT SHOWCASE</span></header>
    <main id="main">
      <section className="hero page-width" id="top"><div className="hero-copy"><p className="eyebrow"><span className="tiny-square" /> SOFTWARE ENGINEERING · HW4</p><h1>把服務裝進容器，<br /><span>讓 AI 對話串起來。</span></h1><p className="hero-description">{project.description}</p><div className="hero-actions"><a className="button primary" href="#architecture">探索系統架構 <span aria-hidden="true">↗</span></a><a className="button secondary" href="#commands">查看使用指令 <span aria-hidden="true">↓</span></a></div><ul className="technology-tags" aria-label="使用技術">{project.tags.map(tag => <li key={tag}>{tag}</li>)}</ul></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-label art-label-top">COMPOSE / CONNECT / CHAT</div><div className="container-stack"><div className="art-container art-container-top"><span>01</span>NGINX<i /></div><div className="art-container art-container-middle"><span>02</span>NODE.JS<i /></div><div className="art-container art-container-bottom"><span>03</span>POSTGRES<i /></div></div><div className="art-caption"><span /> ONE SYSTEM. CONNECTED SERVICES.</div></div></section>
      <div className="project-strip"><div className="page-width strip-inner"><span>{project.title}</span><span>03 <small>容器服務</small></span><span>01 <small>統一網頁入口</small></span><span>SSE <small>串流回應</small></span><span>VOLUME <small>持久化儲存</small></span></div></div>
      <section className="section page-width" id="architecture"><SectionHeading number="01" label="ARCHITECTURE" title="一則訊息，如何穿過整個系統？">從網頁入口到資料保存，各個服務各司其職，再由 主機上的 Ollama 接上雲端模型。</SectionHeading><Architecture /></section>
      <section className="section page-width" id="stack"><SectionHeading number="02" label="TECH STACK" title="每個元件，都有自己的任務。">用 Docker Compose 管理三個容器服務，模型服務則保留在 主機。</SectionHeading><div className="technology-grid">{technologies.map(tech => <article className={`technology-card ${tech.color}`} key={tech.code}><div className="tech-top"><span className="tech-icon">{tech.code}</span><span className="tech-role">{tech.role}</span></div><h3>{tech.name}</h3><p>{tech.detail}</p><code>{tech.note}</code></article>)}</div></section>
      <section className="feature-section" id="features"><div className="page-width feature-layout"><div><SectionHeading number="03" label="THE EXPERIENCE" title="從提問，到接續下一段對話。">聊天介面專注在日常使用，容器與資料庫在背後承接每一次訊息。</SectionHeading><div className="keyboard-note"><span><kbd>Enter</kbd> 送出訊息</span><span><kbd>Shift</kbd> + <kbd>Enter</kbd> 換行</span></div><p className="feature-footnote">AI 完整回答後才保存；串流中斷時，尚未完成的回答不會寫入資料庫。</p></div><div className="feature-list">{features.map(feature => <article key={feature.number}><span>{feature.number}</span><div><h3>{feature.title}</h3><p>{feature.description}</p></div></article>)}</div></div></section>
      <section className="section page-width" id="gallery"><SectionHeading number="04" label="PROJECT GALLERY" title="把實際使用的樣子，留在這裡。">這裡將收錄實際操作截圖；目前先保留展示位置，待提供圖片後補上。</SectionHeading><div className="gallery-grid">{screenshots.map((shot, index) => <figure className="screenshot-card" key={shot.id}>{shot.image && !failedImages.includes(shot.id) ? <img src={`${import.meta.env.BASE_URL}${shot.image}`} alt={shot.alt} loading="lazy" onError={() => setFailedImages(previous => [...previous, shot.id])} /> : <div className="screenshot-placeholder"><span className="placeholder-frame" aria-hidden="true"><i /><i /><i /><b>＋</b></span><span>截圖待補</span><small>{String(index + 1).padStart(2, '0')} / {shot.title}</small></div>}<figcaption><h3>{shot.title}</h3><p>{shot.description}</p></figcaption></figure>)}</div></section>
      <section className="section page-width commands-section" id="commands"><SectionHeading number="05" label="GET STARTED" title="幾行指令，認識啟動流程。">以下指令用於 Docker 聊天系統，皆由 主機終端機執行。除啟動 Ollama 外，其餘指令請先切換至專案的 hw4 目錄。</SectionHeading><div className="commands-list">{commands.map((command, index) => <CommandCard key={command.id} command={command} index={index} />)}</div></section>
    </main>
    <footer className="site-footer page-width"><div><a className="brand" href="#top"><ContainerMark small /><span>HW4 / DOCKER LAB</span></a><p>Docker AI 聊天系統 · 專案展示</p></div><p>React + TypeScript<span>獨立純前端介紹頁</span></p><a className="back-top" href="#top">回到頂端 ↑</a></footer>
  </>;
}
