import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { fetchPermit } from './permit';
import { analyzePhoto } from './vision';

config({ path: fileURLToPath(new URL('.env', import.meta.url)) });

const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY ?? '';
const geminiKey = process.env.GEMINI_API_KEY ?? '';
if (!serviceKey) console.warn('⚠ server/.env 에 DATA_GO_KR_SERVICE_KEY가 없어요. 약 설명을 불러올 수 없습니다.');
if (!geminiKey) console.warn('⚠ server/.env 에 GEMINI_API_KEY가 없어요. 사진으로 찾기를 쓸 수 없습니다.');

const app = createApp({
  loadPermit: (seq) => fetchPermit(seq, serviceKey),
  analyzePhoto: (image, mime) => analyzePhoto(image, mime, geminiKey),
});
// 원재료 렌즈(codefair) 서버가 8787을 쓰므로 겹치지 않게 8788
const port = Number(process.env.PORT ?? 8788);
app.listen(port, () => console.log(`server on :${port}`));
