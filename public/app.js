// Config — tweak freely
const COMMENT_INTERVAL_MS = 45_000;
const JPEG_QUALITY = 0.6;

const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const bubbleEl = document.getElementById('bubble');
const captionEl = document.getElementById('caption');
const avatarEl = document.getElementById('avatar');
const reopenEl = document.getElementById('reopen');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');

let stream = null;
let intervalHandle = null;
let lastComment = '';

async function startCapture() {
  try {
    // Browser-native screen/window/tab picker — same underlying capability
    // Electron's desktopCapturer uses, just via the standard web API.
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 5 }, // we only need occasional stills, keep it light
      audio: false,
    });
  } catch (err) {
    console.error('Screen share cancelled or failed:', err);
    return;
  }

  video.srcObject = stream;
  await video.play();

  // If the user stops sharing via the browser's own UI, reset gracefully.
  stream.getVideoTracks()[0].addEventListener('ended', () => {
    clearInterval(intervalHandle);
    stream = null;
    startScreen.style.display = 'flex';
    bubbleEl.style.display = 'none';
    reopenEl.style.display = 'none';
  });

  startScreen.style.display = 'none';
  bubbleEl.style.display = 'flex';
  reopenEl.style.display = 'block';

  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = setInterval(captureAndComment, COMMENT_INTERVAL_MS);
  setTimeout(captureAndComment, 3000); // first line shortly after starting
}

function captureFrameAsBase64() {
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];
}

async function captureAndComment() {
  if (!stream) return;
  try {
    const imageBase64 = captureFrameAsBase64();
    const res = await fetch('/api/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, lastComment }),
    });
    const data = await res.json();
    if (data.line) {
      lastComment = data.line;
      say(data.line);
    } else if (data.error) {
      console.error('Commentary error:', data.error);
    }
  } catch (err) {
    console.error('capture/comment failed:', err);
  }
}

// getVoices() returns an empty list until the browser finishes loading them
// (fires 'voiceschanged' async), so we cache the pick and refresh on that event.
let cachedVoice = null;

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const english = voices.filter((v) => v.lang.startsWith('en'));
  const pool = english.length ? english : voices;
  // On-device voices are consistently clearer than the remote/network ones
  // Chrome also lists, which can sound worse and add latency.
  return pool.find((v) => v.localService) || pool[0];
}

if ('speechSynthesis' in window) {
  cachedVoice = pickVoice();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = pickVoice();
  };
}

function say(text) {
  captionEl.textContent = text;
  avatarEl.classList.add('talking');

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  if (cachedVoice) utter.voice = cachedVoice;
  utter.rate = 1.0;
  utter.pitch = 1.1;
  utter.onend = () => avatarEl.classList.remove('talking');
  window.speechSynthesis.speak(utter);
}

startBtn.addEventListener('click', startCapture);
reopenEl.addEventListener('click', () => {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  clearInterval(intervalHandle);
  startScreen.style.display = 'flex';
  bubbleEl.style.display = 'none';
  reopenEl.style.display = 'none';
});
