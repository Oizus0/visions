import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'*.spec.mjs',workers:1,timeout:45000,use:{channel:'msedge',headless:true,viewport:{width:1000,height:800}},webServer:{command:'npm run dev -- --port 5193',url:'http://127.0.0.1:5193',env:{VISIONS_TEST:'1'},reuseExistingServer:false}});
