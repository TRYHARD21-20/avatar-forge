import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'tests',timeout:30000,use:{baseURL:'http://localhost:5173',...devices['Desktop Chrome'],launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}},webServer:{command:'npm run dev',url:'http://localhost:5173',reuseExistingServer:true,timeout:120000}});
