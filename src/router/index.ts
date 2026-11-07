import { createRouter, createWebHashHistory } from 'vue-router'
import Workbench from '@/views/Workbench.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'workbench', component: Workbench },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

export default router