/**
 * GitHub Release 说明获取与渲染（升级弹窗用）
 */

// 仓库 GitHub API 地址（与 update.json、安装包下载同源）
const GITHUB_REPO_API =
  "https://api.github.com/repos/SIE-Operations-and-Maintenance-Team/publish-tools";

/** GitHub Release 接口返回中本工具关心的字段 */
interface GithubRelease {
  body?: string | null;
}

/** 转义 HTML 特殊字符，防止说明文本被当成标签解析 */
const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Markdown 转简单 HTML（与 CI 生成 update.json notes 的规则一致）：
 * `##/### 标题` → 加粗；`-/* 条目` → 圆点；行内 `**粗体**`、URL 转标签；其余按行 <br> 拼接
 * @param markdown Release 正文 Markdown 原文
 */
export const releaseNotesToHtml = (markdown: string): string => {
  const lines: string[] = [];
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const html = escapeHtml(line)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(
        /(https?:\/\/[^\s<]+)/g,
        `<a style="color:green" target="_blank" href="$1">$1</a>`
      );
    if (/^#{1,6}\s+/.test(html)) {
      lines.push(`<b>${html.replace(/^#+\s*/, "")}</b>`);
    } else if (html.startsWith("- ") || html.startsWith("* ")) {
      lines.push(`• ${html.slice(2)}`);
    } else {
      lines.push(html);
    }
  }
  return lines.join("<br>");
};

/**
 * 拉取指定版本 GitHub Release 说明并转成弹窗可渲染的 HTML
 * @param version 版本号（不含 v 前缀，如 0.0.39）
 * @returns 成功返回 HTML 字符串；Release 不存在/接口限流/网络异常等返回 null（调用方回退 update.json notes）
 */
export const fetchGithubReleaseNotes = async (
  version: string
): Promise<string | null> => {
  try {
    const resp = await fetch(`${GITHUB_REPO_API}/releases/tags/v${version}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as GithubRelease;
    if (!data.body || !data.body.trim()) return null;
    return releaseNotesToHtml(data.body);
  } catch (e) {
    console.error("获取 GitHub Release 说明失败，回退 update.json notes：", e);
    return null;
  }
};
