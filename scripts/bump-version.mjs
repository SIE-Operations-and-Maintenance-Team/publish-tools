#!/usr/bin/env node
/**
 * 一键升级版本号（package.json 为唯一事实源，纯 Node 实现，不依赖 npm/git 子进程）
 *
 * 用法：
 *   npm run version:bump -- patch    # 0.0.39 → 0.0.40
 *   npm run version:bump -- minor    # 0.0.39 → 0.1.0
 *   npm run version:bump -- 0.1.0    # 指定具体版本
 *
 * 同步更新：
 *   1. package.json / package-lock.json
 *   2. src-tauri/Cargo.toml 的 [package] version + src-tauri/Cargo.lock 本应用条目
 *      （CI 以 cargo check --locked 校验，两者必须同步）
 *   3. CHANGELOG.md 顶部插入新版本骨架（已存在同名条目则跳过）
 *   （tauri.conf.json 直接引用 ../package.json、前端经 vite define 注入，均无需改）
 *
 * 之后：填写 CHANGELOG → commit → git tag vX.Y.Z → push（CI 会强制校验 tag 与版本一致）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// 显式 UTF-8，避免中文 Windows 默认 GBK 损坏文件
const read = (p) => readFileSync(path.join(root, p), "utf-8");
const write = (p, content) => writeFileSync(path.join(root, p), content, "utf-8");

const target = process.argv[2] || "patch";
if (!/^(patch|minor|major|\d+\.\d+\.\d+)$/.test(target)) {
  console.error(`✗ 无效的版本参数: ${target}（支持 patch | minor | major 或 x.y.z）`);
  process.exit(1);
}

// 0. 计算新版本
const pkg = JSON.parse(read("package.json"));
const oldVersion = pkg.version;
let version = target;
if (!/^\d+\.\d+\.\d+$/.test(target)) {
  const m = oldVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    console.error(`✗ package.json 当前版本 "${oldVersion}" 不是 x.y.z 格式，请显式指定目标版本`);
    process.exit(1);
  }
  let [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (target === "major") {
    maj += 1;
    min = 0;
    pat = 0;
  } else if (target === "minor") {
    min += 1;
    pat = 0;
  } else {
    pat += 1;
  }
  version = `${maj}.${min}.${pat}`;
}
if (version === oldVersion) {
  console.error(`✗ 目标版本与当前版本相同: ${version}`);
  process.exit(1);
}

// 1. package.json / package-lock.json（2 空格缩进 + 末尾换行，与 npm 写回格式一致）
pkg.version = version;
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

const lock = JSON.parse(read("package-lock.json"));
lock.version = version;
if (lock.packages && lock.packages[""]) lock.packages[""].version = version;
write("package-lock.json", JSON.stringify(lock, null, 2) + "\n");

// 2. Cargo.toml [package] version + Cargo.lock 本应用条目
const cargo = read("src-tauri/Cargo.toml");
const newCargo = cargo.replace(/^version = "[^"]*"/m, `version = "${version}"`);
if (newCargo === cargo) {
  console.error("✗ 未能在 src-tauri/Cargo.toml 中找到 [package] version 行");
  process.exit(1);
}
write("src-tauri/Cargo.toml", newCargo);

const cargoLock = read("src-tauri/Cargo.lock");
const newCargoLock = cargoLock.replace(
  /(name = "SmomPublish"\r?\nversion = ")[^"]*(")/,
  `$1${version}$2`
);
if (newCargoLock === cargoLock) {
  console.error('✗ 未能在 src-tauri/Cargo.lock 中找到 name = "SmomPublish" 条目');
  process.exit(1);
}
write("src-tauri/Cargo.lock", newCargoLock);

// 3. CHANGELOG.md 顶部插入新版本骨架（沿用文件既有行尾格式）
const changelogPath = "CHANGELOG.md";
const changelog = read(changelogPath);
if (changelog.includes(`## v${version}`)) {
  console.log(`- CHANGELOG.md 已存在 v${version} 条目，跳过骨架插入`);
} else {
  const eol = changelog.includes("\r\n") ? "\r\n" : "\n";
  const skeleton = [`## v${version}`, "", "### 功能", "", "- ", "", "### 修复", "", "- ", "", ""].join(eol);
  const idx = changelog.search(/^## /m);
  const updated =
    idx === -1
      ? changelog.trimEnd() + eol + eol + skeleton
      : changelog.slice(0, idx) + skeleton + changelog.slice(idx);
  write(changelogPath, updated);
  console.log(`- CHANGELOG.md 已插入 v${version} 骨架`);
}

console.log(`\n✔ 版本已升级: v${oldVersion} → v${version}`);
console.log("  已同步: package.json / package-lock.json / Cargo.toml / Cargo.lock");
console.log("下一步：");
console.log(`  1. 填写 CHANGELOG.md 的 v${version} 条目`);
console.log(`  2. git commit -am "chore: 升级版本至 v${version}"`);
console.log(`  3. git tag v${version} && git push origin master v${version}`);
