

<div align="center">
	<img src="https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools/raw/master/doc/pic/smom.png">
	<p align="center">
		<a href="https://tauri.app" target="_blank">
			<img src="https://img.shields.io/badge/website-tauri.app-purple.svg" alt="tauri">
		</a>
		<a href="https://v3.vuejs.org/" target="_blank">
			<img src="https://img.shields.io/badge/vue.js-vue3.x-green" alt="vue">
		</a>
		<a href="https://element-plus.gitee.io/#/zh-CN/component/changelog" target="_blank">
			<img src="https://img.shields.io/badge/element--plus->1.0.0-blue" alt="element plus">
		</a>
		<a href="https://www.tslang.cn/" target="_blank">
			<img src="https://img.shields.io/badge/typescript->4.0.0-blue" alt="typescript">
		</a>
		<a href="https://vitejs.dev/" target="_blank">
			<img src="https://img.shields.io/badge/vite->2.0.0-yellow" alt="vite">
		</a>
		<a href="https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools/blob/master/LICENSE" target="_blank">
			<img src="https://img.shields.io/badge/license-MIT-success" alt="license">
		</a>
	</p>
	<p align="center">&nbsp;</p>
</div>

#### 介绍
基于 tauri + vue3.x + CompositionAPI setup 语法糖 + typescript + vite + element plus + vue-router-next + pinia 技术，实现SMOM框架的快速发布，减少开发人员的工作量。

#### 使用说明
建议 <a href="http://nodejs.cn/" target="_blank">node 版本 > 14.18+/16+</a>  
> Vite 不再支持 Node 12 / 13 / 15，因为上述版本已经进入EOL阶段。现在你必须使用 Node 14.18+ / 16+ 版本。

```bash
# 配置NPM镜像源
npm config set registry https://mirrors.huaweicloud.com/repository/npm/

# 克隆项目
git clone https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools.git

# 进入项目
cd Rex.SmomPublish

# 安装依赖
npm install

# 运行项目
npm run tauri dev

# 打包发布
npm run tauri build
```

#### 🌞 功能截图
![项目发布](https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools/raw/master/doc/pic/项目发布.png)  
![项目管理](https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools/raw/master/doc/pic/项目管理.png)  
![应用配置](https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools/raw/master/doc/pic/应用配置.png)  
![文件发布](https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools/raw/master/doc/pic/文件发布.png)  
![服务器](https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools/raw/master/doc/pic/服务器.png)  
![TFS](https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools/raw/master/doc/pic/TFS.png)  
![备份记录](https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools/raw/master/doc/pic/备份记录.png)  

#### ❤️ 鸣谢
- [tauri](https://tauri.app)
- [vue](https://github.com/vuejs/vue)
- [vue-next](https://github.com/vuejs/vue-next)
- [typescript](https://www.tslang.cn/)
- [vite](https://vitejs.dev/)
- [MIT License](https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools/blob/master/LICENSE)
- [element-plus](https://github.com/element-plus/element-plus)
- [vue-next-admin](https://gitee.com/lyt-top/vue-next-admin)
- [vue-router-next](https://github.com/vuejs/vue-router-next)
- [pinia](https://github.com/vuejs/pinia)
- [mitt](https://github.com/developit/mitt)
- [screenfull](https://github.com/sindresorhus/screenfull.js)
- [sass](https://github.com/sass/sass)
- [vue-i18n](https://github.com/intlify/vue-i18n-next)
- [vite-plugin-compression](https://github.com/vbenjs/vite-plugin-compression)
- [vite-plugin-vue-setup-extend-plus](https://github.com/chenxch/vite-plugin-vue-setup-extend-plus)

#### 支持作者
如果帮助到了你，希望你可以去[Gitee](https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools) 帮我点个 ⭐ Star，这将是对我极大的鼓励与支持。