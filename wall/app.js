const canvas = document.querySelector("#headerCanvas");
const ctx = canvas.getContext("2d");

const stampCatalog = {
  "maeda-a": { name: "前田壮太 A", src: "./assets/stamps/maeda-a.png" },
  "maeda-b": { name: "前田壮太 B", src: "./assets/stamps/maeda-b.png" },
  "oyama-a": { name: "大山和也 A", src: "./assets/stamps/oyama-a.png" },
  "oyama-b": { name: "大山和也 B", src: "./assets/stamps/oyama-b.png" }
};

const background = new Image();
background.src = "./assets/backgrounds/bricks.png";

const loadedImages = {};
const state = {
  name: "マコト",
  message: "木曜夜は最果てに集合",
  choice: "maeda-a",
  stamps: [],
  selectedId: null,
  dragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0
};

const $ = (selector) => document.querySelector(selector);
const nameInput = $("#userName");
const messageInput = $("#message");
const nameCount = $("#nameCount");
const messageCount = $("#messageCount");
const notice = $("#inputNotice");
const scaleInput = $("#stampScale");
const rotationInput = $("#stampRotation");
const statusMessage = $("#statusMessage");

const emojiPattern = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;
const cleanText = (value, max) => value.replace(emojiPattern, "").slice(0, max);

function loadImage(src) {
  if (loadedImages[src]) return Promise.resolve(loadedImages[src]);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      loadedImages[src] = image;
      resolve(image);
    };
    image.onerror = reject;
    image.src = src;
  });
}

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawStamp(stamp) {
  const image = loadedImages[stamp.src];
  if (!image) return;
  const width = stamp.baseSize * stamp.scale;
  const height = width * (image.naturalHeight / image.naturalWidth);
  ctx.save();
  ctx.translate(stamp.x, stamp.y);
  ctx.rotate(stamp.rotation * Math.PI / 180);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  if (stamp.id === state.selectedId) {
    ctx.strokeStyle = "#f0c900";
    ctx.lineWidth = 7;
    ctx.setLineDash([18, 12]);
    ctx.strokeRect(-width / 2, -height / 2, width, height);
  }
  ctx.restore();
}

function strokeFillText(text, x, y, size) {
  ctx.font = `${size}px "Reggae One", "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#171616";
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 16;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function drawTextLayer() {
  ctx.save();
  ctx.translate(750, 0);
  ctx.scale(.82, 1);
  ctx.translate(-750, 0);
  strokeFillText(`${state.name || "〇〇"}は`, 750, 166, 41);
  strokeFillText("カラタチの最果てのセンセイ！", 750, 234, 58);
  strokeFillText("を愛聴しています", 750, 298, 41);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#171616";
  roundedRectPath(ctx, 420, 350, 690, 80, 16);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(450, 433);
  ctx.quadraticCurveTo(770, 423, 1090, 429);
  ctx.strokeStyle = "#171616";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.stroke();
  let messageSize = 53;
  ctx.font = `${messageSize}px "New Tegomin", "Noto Sans JP", serif`;
  const maxMessageWidth = 620;
  const measuredWidth = ctx.measureText(state.message || "あなたの言葉").width;
  if (measuredWidth > maxMessageWidth) {
    messageSize = Math.max(36, messageSize * (maxMessageWidth / measuredWidth));
    ctx.font = `${messageSize}px "New Tegomin", "Noto Sans JP", serif`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(state.message || "あなたの言葉", 765, 392);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (background.complete) ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
  state.stamps.forEach(drawStamp);
  drawTextLayer();
}

function selectedStamp() {
  return state.stamps.find((stamp) => stamp.id === state.selectedId);
}

async function addStamp() {
  const config = stampCatalog[state.choice];
  const image = await loadImage(config.src);
  const index = state.stamps.length;
  const stamp = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    key: state.choice,
    src: config.src,
    x: index % 2 ? 1170 : 330,
    y: 285,
    startX: index % 2 ? 1170 : 330,
    startY: 285,
    scale: 1,
    rotation: 0,
    baseSize: Math.min(500, image.naturalWidth)
  };
  state.stamps.push(stamp);
  state.selectedId = stamp.id;
  scaleInput.value = 100;
  rotationInput.value = 0;
  draw();
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function hitTest(point) {
  for (let i = state.stamps.length - 1; i >= 0; i -= 1) {
    const stamp = state.stamps[i];
    const image = loadedImages[stamp.src];
    if (!image) continue;
    const width = stamp.baseSize * stamp.scale;
    const height = width * image.naturalHeight / image.naturalWidth;
    const angle = -stamp.rotation * Math.PI / 180;
    const dx = point.x - stamp.x;
    const dy = point.y - stamp.y;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
    if (Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2) return stamp;
  }
  return null;
}

canvas.addEventListener("pointerdown", (event) => {
  const point = canvasPoint(event);
  const stamp = hitTest(point);
  if (!stamp) {
    state.selectedId = null;
    draw();
    return;
  }
  state.selectedId = stamp.id;
  state.dragging = true;
  state.dragOffsetX = point.x - stamp.x;
  state.dragOffsetY = point.y - stamp.y;
  scaleInput.value = Math.round(stamp.scale * 100);
  rotationInput.value = stamp.rotation;
  canvas.setPointerCapture(event.pointerId);
  draw();
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.dragging) return;
  const stamp = selectedStamp();
  if (!stamp) return;
  const point = canvasPoint(event);
  stamp.x = point.x - state.dragOffsetX;
  stamp.y = point.y - state.dragOffsetY;
  draw();
});

const stopDragging = () => { state.dragging = false; };
canvas.addEventListener("pointerup", stopDragging);
canvas.addEventListener("pointercancel", stopDragging);

nameInput.addEventListener("input", () => {
  const cleaned = cleanText(nameInput.value, 10);
  if (cleaned !== nameInput.value) notice.textContent = "絵文字を取り除きました";
  nameInput.value = cleaned;
  state.name = cleaned;
  nameCount.textContent = [...cleaned].length;
  draw();
});

messageInput.addEventListener("input", () => {
  const cleaned = cleanText(messageInput.value, 16);
  if (cleaned !== messageInput.value) notice.textContent = "絵文字を取り除きました";
  messageInput.value = cleaned;
  state.message = cleaned;
  messageCount.textContent = [...cleaned].length;
  draw();
});

document.querySelectorAll(".stamp-choice").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".stamp-choice").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    state.choice = button.dataset.stamp;
    $("#stampChoiceName").textContent = stampCatalog[state.choice].name;
  });
});

$("#addStamp").addEventListener("click", addStamp);
scaleInput.addEventListener("input", () => {
  const stamp = selectedStamp();
  if (!stamp) return;
  stamp.scale = Number(scaleInput.value) / 100;
  draw();
});
rotationInput.addEventListener("input", () => {
  const stamp = selectedStamp();
  if (!stamp) return;
  stamp.rotation = Number(rotationInput.value);
  draw();
});
$("#resetStamp").addEventListener("click", () => {
  const stamp = selectedStamp();
  if (!stamp) return;
  stamp.x = stamp.startX;
  stamp.y = stamp.startY;
  stamp.scale = 1;
  stamp.rotation = 0;
  scaleInput.value = 100;
  rotationInput.value = 0;
  draw();
});
$("#deleteStamp").addEventListener("click", () => {
  if (!state.selectedId) return;
  state.stamps = state.stamps.filter((stamp) => stamp.id !== state.selectedId);
  state.selectedId = null;
  draw();
});

function exportBlob(type = "image/png", quality = .94) {
  const selected = state.selectedId;
  state.selectedId = null;
  draw();
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      state.selectedId = selected;
      draw();
      resolve(blob);
    }, type, quality);
  });
}

$("#saveImage").addEventListener("click", async () => {
  const blob = await exportBlob("image/png");
  const file = new File([blob], "saihate-fukyo-header.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] }) && matchMedia("(max-width: 780px)").matches) {
    try {
      await navigator.share({ files: [file], title: "最果て布教ヘッダー" });
      statusMessage.textContent = "画像を共有しました";
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "saihate-fukyo-header.png";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  statusMessage.textContent = "1500×500pxの画像を保存しました";
});

function openWallDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("saihate-wall", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("posts")) db.createObjectStore("posts", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

$("#publishWall").addEventListener("click", async () => {
  const blob = await exportBlob("image/jpeg", .9);
  const db = await openWallDatabase();
  const post = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
    createdAt: Date.now(),
    name: state.name,
    message: state.message,
    image: blob
  };
  await new Promise((resolve, reject) => {
    const request = db.transaction("posts", "readwrite").objectStore("posts").put(post);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  location.href = "./gallery/?added=1";
});

Promise.all([
  document.fonts.ready,
  new Promise((resolve) => {
    if (background.complete) resolve();
    else background.onload = resolve;
  }),
  ...Object.values(stampCatalog).map((item) => loadImage(item.src))
]).then(async () => {
  await addStamp();
  state.choice = "oyama-a";
  await addStamp();
  state.choice = "maeda-a";
  draw();
});
