#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE_DIR = fileURLToPath(new URL("../templates/", import.meta.url));
// 這些檔案裡的 {{name}} 會換成專案名稱
const FILES_WITH_NAME = ["package.json", "wrangler.jsonc", "README.md"];
// 檢查資料夾是否為空時忽略的項目
const IGNORED_ENTRIES = new Set([".DS_Store", ".git"]);

const USAGE = `用法:
  csie-quiz init [資料夾] [--force]

  資料夾    要建立專案的位置;省略時使用目前的資料夾
  --force   資料夾裡已經有檔案時仍然寫入(同名檔案會被覆蓋)`;

function fail(message) {
	console.error(`錯誤:${message}`);
	process.exit(1);
}

/** 轉成 npm 套件名稱與 Cloudflare Worker 都接受的格式:小寫英數字與 - */
function toProjectName(dirName) {
	return dirName
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function init(args) {
	const force = args.includes("--force");
	const unknownFlag = args.find((a) => a.startsWith("-") && a !== "--force");
	if (unknownFlag) fail(`不認識的選項 ${unknownFlag}\n\n${USAGE}`);

	const positional = args.filter((a) => !a.startsWith("-"));
	if (positional.length > 1) fail(`只能指定一個資料夾\n\n${USAGE}`);

	const dirArg = positional[0];
	const targetDir = path.resolve(dirArg ?? ".");

	if (fs.existsSync(targetDir) && !fs.statSync(targetDir).isDirectory()) {
		fail(`${targetDir} 已存在且不是資料夾`);
	}

	const projectName = toProjectName(path.basename(targetDir));
	if (!projectName) {
		fail(`無法從資料夾名稱「${path.basename(targetDir)}」產生專案名稱,請改用英文或數字命名`);
	}

	if (fs.existsSync(targetDir)) {
		const entries = fs
			.readdirSync(targetDir)
			.filter((name) => !IGNORED_ENTRIES.has(name));
		if (entries.length > 0 && !force) {
			fail(`${targetDir} 裡已經有檔案,沒有寫入任何檔案。\n要覆蓋請加上 --force。`);
		}
	} else {
		fs.mkdirSync(targetDir, { recursive: true });
	}

	fs.cpSync(TEMPLATE_DIR, targetDir, { recursive: true });

	// npm 打包時會排除 .gitignore,所以範本裡存成 _gitignore
	fs.renameSync(
		path.join(targetDir, "_gitignore"),
		path.join(targetDir, ".gitignore"),
	);

	for (const file of FILES_WITH_NAME) {
		const filePath = path.join(targetDir, file);
		const content = fs.readFileSync(filePath, "utf8");
		fs.writeFileSync(filePath, content.replaceAll("{{name}}", projectName));
	}

	const steps = [
		dirArg ? `cd ${dirArg}` : null,
		"npm install",
		"npm run db:init",
		"npm run dev",
	].filter(Boolean);

	console.log(`
已在 ${targetDir} 建立考古題網站 ${projectName}

接下來:
${steps.map((s) => `  ${s}`).join("\n")}

上線方式請看 README.md。`);
}

const [command, ...rest] = process.argv.slice(2);

if (command === "init") {
	init(rest);
} else if (!command || command === "--help" || command === "-h") {
	console.log(USAGE);
} else {
	fail(`不認識的指令 ${command}\n\n${USAGE}`);
}
