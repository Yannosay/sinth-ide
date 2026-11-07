import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import '@fontsource/unbounded/500.css'
import '@fontsource/unbounded/700.css'
import './styles/theme.css'
import './styles/main.css'
import './styles/monaco.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.config.errorHandler = (err, _instance, info) => {
  console.error('[sinth-ide]', err, info)
}
app.mount('#app')