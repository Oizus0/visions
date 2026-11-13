import { defineConfig } from 'vite';
export default defineConfig({base:'./',resolve:process.env.VISIONS_TEST==='1'?{alias:{'@owlbear-rodeo/sdk':new URL('./tests/mock-sdk.js',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')}}:undefined,build:{rollupOptions:{input:{panel:'index.html',background:'background.html',screen:'screen.html'}}}});
