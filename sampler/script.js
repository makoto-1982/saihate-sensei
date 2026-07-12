// Web Audio APIのAudioContextを作成
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let soundBuffers = {}; // サウンドバッファを保存
let currentSource = null; // 現在再生中のサウンドを保持

// サウンドファイルを読み込み、バッファに格納
async function loadSound(url, key) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    soundBuffers[key] = await audioContext.decodeAudioData(arrayBuffer);
}

// すべてのサウンドを読み込む
async function loadAllSounds() {
    await loadSound('sounds/sound1.mp3', 'sound1');
    await loadSound('sounds/sound2.mp3', 'sound2');
    await loadSound('sounds/sound3.mp3', 'sound3');
    await loadSound('sounds/sound4.mp3', 'sound4');
    await loadSound('sounds/sound5.mp3', 'sound5');
    await loadSound('sounds/sound6.mp3', 'sound6');
    await loadSound('sounds/sound7.mp3', 'sound7');
    await loadSound('sounds/sound8.mp3', 'sound8');
    await loadSound('sounds/sound9.mp3', 'sound9'); // 9つ目のサウンド
}

// 音声を再生する（同時発音を防ぐため、現在の再生を停止）
function playSound(key) {
    // 現在再生中のサウンドがあれば停止
    if (currentSource) {
        currentSource.stop();
    }

    const buffer = soundBuffers[key];
    if (buffer) {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        currentSource = source; // 現在のサウンドを記録
    }
}

// 初期化：ページ読み込み時にすべてのサウンドを読み込み
loadAllSounds();

// キーボードとパッドの対応
const keyToPadMap = {
    'q': 'sound1',
    'w': 'sound2',
    'e': 'sound3',
    'a': 'sound4',
    's': 'sound5',
    'd': 'sound6',
    'z': 'sound7',
    'x': 'sound8',
    'c': 'sound9'
};

// イベントを割り当てる関数
function assignPadEvents(pad, soundId) {
    const handlePlay = () => {
        playSound(soundId);
        // ビジュアルエフェクト
        pad.classList.add('active');
        setTimeout(() => pad.classList.remove('active'), 100);
    };
    
    // タッチ対応デバイスなら touchstart のみを使い、非対応なら click のみを使う
    if ('ontouchstart' in window) {
        pad.addEventListener('touchstart', handlePlay);
        pad.addEventListener('touchmove', (event) => event.preventDefault()); // タッチ操作でのスクロールを防止
    } else {
        pad.addEventListener('click', handlePlay);
    }
}

// 各パッドにイベントを設定
document.querySelectorAll('.pad').forEach(pad => {
    const soundId = pad.getAttribute('data-sound');
    assignPadEvents(pad, soundId);
});

// キーボード入力でサウンドを再生
document.addEventListener('keydown', (event) => {
    const soundId = keyToPadMap[event.key.toLowerCase()];
    if (soundId) {
        const pad = document.querySelector(`.pad[data-sound="${soundId}"]`);
        playSound(soundId);
        // ビジュアルエフェクト
        pad.classList.add('active');
        setTimeout(() => pad.classList.remove('active'), 100);
    }
});

// ダブルタップによる拡大を防止
let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);
