#!/usr/bin/env python3
"""合成轉輪開啟前的語音（assets/audio/wheel_voice.mp3）。

用開源的 MeloTTS 中文模型（MIT 授權，女聲，經 sherpa-onnx 轉成 onnx），不用網路服務、聲音檔可以放心商用。
換文字或速度：改下面的 TEXT、SPEED 重跑。要換成真人錄音：直接把你的 mp3 覆蓋 assets/audio/wheel_voice.mp3 就好。

準備（只要做一次）：
  pip install sherpa-onnx soundfile numpy
  下載模型：https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-melo-tts-zh_en.tar.bz2  解壓到 MODEL_DIR
  需要 ffmpeg（轉 mp3、調音量）。
"""
import subprocess, sys
import sherpa_onnx, soundfile as sf

TEXT, SPEED = '我要轉輪！', 1.0
MODEL_DIR = sys.argv[1] if len(sys.argv) > 1 else '/tmp/tts/vits-melo-tts-zh_en'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'assets/audio/wheel_voice.mp3'
d = MODEL_DIR
cfg = sherpa_onnx.OfflineTtsConfig(
    model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(
        model=f'{d}/model.onnx', lexicon=f'{d}/lexicon.txt', tokens=f'{d}/tokens.txt', dict_dir=f'{d}/dict'), num_threads=2),
    rule_fsts=f'{d}/date.fst,{d}/number.fst,{d}/phone.fst,{d}/new_heteronym.fst')
audio = sherpa_onnx.OfflineTts(cfg).generate(TEXT, sid=0, speed=SPEED)
sf.write('/tmp/wheel_voice.wav', audio.samples, audio.sample_rate)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', '/tmp/wheel_voice.wav', '-af',
                'loudnorm=I=-14:TP=-1.5:LRA=7,afade=t=in:d=0.01,afade=t=out:st=0.6:d=0.2', '-ar', '44100', '-ac', '1', '-b:a', '96k', OUT], check=True)
print('已產生', OUT, f'{len(audio.samples) / audio.sample_rate:.2f} 秒')
