'use strict';

const statusBadge = document.getElementById('statusBadge');
const badgeLabel = document.getElementById('badgeLabel');
const timer = document.getElementById('timer');
const profileChip = document.getElementById('profileChip');
const closeBtn = document.getElementById('closeBtn');

let mediaRecorder = null;
let mediaStream = null;
let recordedChunks = [];
let timerInterval = null;
let secondsElapsed = 0;
let activeProfile = '';

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

let sharedMediaStream = null;

async function getOrCreateStream() {
  if (
    sharedMediaStream &&
    sharedMediaStream.active &&
    sharedMediaStream.getVideoTracks().some((t) => t.readyState === 'live')
  ) {
    return sharedMediaStream;
  }

  const sourceId = await window.api.getPrimaryScreenSourceId();
  if (!sourceId) {
    console.warn('Could not acquire primary screen capture source.');
    return null;
  }

  sharedMediaStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        minWidth: 960,
        maxWidth: 1280,
        minHeight: 540,
        maxHeight: 720,
        minFrameRate: 5,
        maxFrameRate: 5
      }
    }
  });

  return sharedMediaStream;
}

// Pre-warm the capture stream on spawn so permission is already established before profile launch
getOrCreateStream().catch((e) => console.warn('Pre-warm stream notice:', e.message));

async function startRecording(profileName = '') {
  // If already recording previous profile, cleanly stop it
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch (_) {}
  }

  activeProfile = profileName;
  if (profileChip) profileChip.textContent = profileName || 'Recording';

  try {
    const stream = await getOrCreateStream();
    if (!stream) {
      statusBadge.className = 'status-badge';
      badgeLabel.textContent = 'NO PERM';
      return;
    }

    recordedChunks = [];
    const options = {
      mimeType: MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
        ? 'video/webm; codecs=vp9'
        : (MediaRecorder.isTypeSupported('video/webm; codecs=vp8')
            ? 'video/webm; codecs=vp8'
            : 'video/webm'),
      videoBitsPerSecond: 100000 // 100 kbps ultra-lean footprint
    };

    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      // Keep sharedMediaStream alive across profiles so the OS never prompts again!
      clearInterval(timerInterval);
    };

    mediaRecorder.start(1000); // 1-second chunks
    secondsElapsed = 0;
    timer.textContent = '00:00';
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      secondsElapsed++;
      timer.textContent = formatTime(secondsElapsed);
      // Auto-stop at 10 minutes (600s) to protect memory if operator walks away
      if (secondsElapsed >= 600) {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }
    }, 1000);

    statusBadge.className = 'status-badge recording';
    badgeLabel.textContent = 'AUTO REC';
  } catch (err) {
    console.error('Auto-recorder start error:', err);
    statusBadge.className = 'status-badge';
    badgeLabel.textContent = 'ERROR';
  }
}

window.addEventListener('beforeunload', () => {
  if (sharedMediaStream) {
    try { sharedMediaStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    sharedMediaStream = null;
  }
});

async function handleSessionDecision({ action, profileName }) {
  if (action === 'discard') {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (_) {}
    }
    clearInterval(timerInterval);
    recordedChunks = [];
    statusBadge.className = 'status-badge discarded';
    badgeLabel.textContent = 'DISCARDED';
    setTimeout(() => {
      statusBadge.className = 'status-badge';
      badgeLabel.textContent = 'IDLE';
      timer.textContent = '00:00';
      profileChip.textContent = '—';
    }, 1500);
    return;
  }

  if (action === 'submit') {
    statusBadge.className = 'status-badge uploading';
    badgeLabel.textContent = 'UPLOADING...';

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (_) {}
    }
    clearInterval(timerInterval);

    // Give MediaRecorder a moment to push final chunk
    await new Promise((r) => setTimeout(r, 250));

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const duration = secondsElapsed;

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const res = await window.api.uploadLeadRecording({
        buffer: arrayBuffer,
        duration
      });

      if (res && res.success) {
        statusBadge.className = 'status-badge saved';
        badgeLabel.textContent = 'SAVED!';
        setTimeout(() => {
          statusBadge.className = 'status-badge';
          badgeLabel.textContent = 'IDLE';
          timer.textContent = '00:00';
          profileChip.textContent = '—';
        }, 2500);
      } else {
        badgeLabel.textContent = 'ERR UPLOAD';
        setTimeout(() => {
          statusBadge.className = 'status-badge';
          badgeLabel.textContent = 'IDLE';
        }, 3000);
      }
    } catch (err) {
      console.error('Lead upload error:', err);
      badgeLabel.textContent = 'ERR UPLOAD';
      setTimeout(() => {
        statusBadge.className = 'status-badge';
        badgeLabel.textContent = 'IDLE';
      }, 3000);
    } finally {
      recordedChunks = [];
    }
  }
}

// IPC event subscriptions
if (window.api && window.api.onAutoStartRecording) {
  window.api.onAutoStartRecording((data) => {
    startRecording(data?.profileName || '');
  });
}

if (window.api && window.api.onSessionDecision) {
  window.api.onSessionDecision((data) => {
    handleSessionDecision(data);
  });
}

// Manual toggle fallback: Clicking the badge allows starting or finishing anytime
if (statusBadge) {
  statusBadge.addEventListener('click', async () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      startRecording('Manual Profile');
    } else {
      if (confirm('Complete this lead and submit video proof to server?\n\n[OK] = Submit Lead\n[Cancel] = Discard Recording')) {
        handleSessionDecision({ action: 'submit', profileName: activeProfile || 'Manual Profile' });
      } else {
        handleSessionDecision({ action: 'discard', profileName: activeProfile || 'Manual Profile' });
      }
    }
  });
}

closeBtn.addEventListener('click', () => {
  window.api.closeFloatingRecorder();
});
