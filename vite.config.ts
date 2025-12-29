import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv, ConfigEnv } from 'vite';
import vueSetupExtend from 'vite-plugin-vue-setup-extend-plus';
import viteCompression from 'vite-plugin-compression';
import path from 'path';

// const pathResolve = (dir: string) => {
// 	return resolve(__dirname, '.', dir);
// };

const alias: Record<string, string> = {
	// '/@': pathResolve('./src/'),
	'@': path.resolve(__dirname, './src'),
	'vue-i18n': 'vue-i18n/dist/vue-i18n.cjs.js',
};

// https://vitejs.dev/config/
export default defineConfig((mode: ConfigEnv) => {
  const env = loadEnv(mode.mode, process.cwd());
  return {
    plugins: [vue(), vueSetupExtend(), viteCompression()],
    clearScreen: false,
		root: process.cwd(),
		resolve: { alias },
    publicDir: 'public', // 确保这个目录存在
    build: {
      outDir: "dist",
      assetsDir: 'assets',
      sourcemap: true,
      target: ['es2020'],
      chunkSizeWarningLimit: 1000
    },
    server: {
      host: '0.0.0.0',
			https: false,   // 需要开启https服务
      port: 5200,
      open: Boolean(env.VITE_OPEN),
      hmr: true,
      strictPort: true,
      watch: {
        // 3. tell vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
      /*
      proxy: {
				'/xxx': {
					target: 'https://www.rex.com',
					ws: true,
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/xxx/, '')
				}
			}
      */
    },
    css: { preprocessorOptions: { css: { charset: false } } },
		define: {
			__VUE_I18N_LEGACY_API__: JSON.stringify(false),
			__VUE_I18N_FULL_INSTALL__: JSON.stringify(false),
			__INTLIFY_PROD_DEVTOOLS__: JSON.stringify(false),
			__NEXT_VERSION__: JSON.stringify(process.env.npm_package_version),
			__NEXT_NAME__: JSON.stringify(process.env.npm_package_name),
		}
  };
});
