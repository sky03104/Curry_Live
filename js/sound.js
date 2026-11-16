// ============================================================
// 音效：目前只有轉輪開啟前的語音「我要轉輪」。
//   ・放 config.wheel.voice 指的聲音檔；檔案放不出來（找不到、瀏覽器擋自動播放）就退一步用瀏覽器內建的語音唸 config.wheel.voiceText；再不行就安靜略過，轉輪照樣開。
//   ・直播軟體（OBS）的瀏覽器來源要勾「透過 OBS 控制音訊」，聲音才會進直播裡。一般 Chrome 要先在頁面上點過一下才允許自動播放。
// ============================================================
window.ML = window.ML || {};

ML.createSound = function (config) {
  const wc = config.wheel || {};
  let last = null;
  function speak(text) {
    try {
      if (!text || !window.speechSynthesis) return false;
      const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-TW'; u.volume = Math.max(0, Math.min(1, Number(wc.voiceVolume) || 1));
      window.speechSynthesis.speak(u); return true;
    } catch (e) { return false; }
  }
  return {
    // 播開啟轉輪的語音。回傳 Promise<'audio'|'speech'|'none'>（只是方便測試，呼叫端不必等它）
    playWheelVoice() {
      return new Promise(resolve => {
        const fallback = () => resolve(speak(wc.voiceText) ? 'speech' : 'none');
        try {
          if (!wc.voice) { fallback(); return; }
          const a = new Audio(wc.voice + (window.APP_VERSION ? '?v=' + window.APP_VERSION : ''));
          a.volume = Math.max(0, Math.min(1, wc.voiceVolume === undefined ? 1 : Number(wc.voiceVolume)));
          last = a;
          const p = a.play();
          if (p && p.then) p.then(() => resolve('audio'), fallback); else resolve('audio');
          a.onerror = fallback;
        } catch (e) { fallback(); }
      });
    },
    stop() { try { if (last) { last.pause(); last = null; } if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* 沒東西可停 */ } },
  };
};
