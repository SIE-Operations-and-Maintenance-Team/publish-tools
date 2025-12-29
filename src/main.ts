import { createApp } from 'vue';
import pinia from '@/stores/index';
import App from '@/App.vue';
import router from '@/router';
import { i18n } from '@/i18n/index';
import other from '@/utils/other';

import ElementPlus from 'element-plus';
import '@/theme/index.scss';
import VueGridLayout from 'vue-grid-layout';

const app = createApp(App);
other.elSvg(app);

// 禁用右键菜单
document.addEventListener('contextmenu', function (e) {
    // 只要不是在 <input> 或 <textarea> 中，就阻止右键菜单
    const target = e.target as any;
    if (!['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        e.preventDefault();
    }
});

app.use(pinia).use(router).use(ElementPlus).use(i18n).use(VueGridLayout).mount('#app');
