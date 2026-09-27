import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8788' },
    // 평가용 사진(약 500MB)과 받는 중인 압축 파일은 감시하지 않는다.
    // 받는 중인 파일을 감시하려다 EBUSY로 개발 서버가 죽은 적이 있다.
    watch: { ignored: ['**/sample_img/**', '**/.cache/**', '**/eval/results/**'] },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
