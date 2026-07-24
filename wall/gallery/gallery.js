const userPosts = document.querySelector("#userPosts");
const objectUrls = [];
const params = new URLSearchParams(location.search);
const manageToken = params.get("manage");
const manageBar = document.querySelector("#manageBar");
let managedPost = null;

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

async function loadPosts() {
  const posts = [];
  try {
    const db = await openWallDatabase();
    const databasePosts = await new Promise((resolve, reject) => {
      const request = db.transaction("posts", "readonly").objectStore("posts").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    posts.push(...databasePosts.map((post) => ({ ...post, storage: "indexedDB" })));
  } catch (error) {
    console.warn("端末内データベースを読み込めませんでした", error);
  }
  try {
    const fallbackPosts = JSON.parse(localStorage.getItem("saihate-wall-posts") || "[]");
    posts.push(...fallbackPosts.map((post) => ({ ...post, storage: "localStorage" })));
  } catch (error) {
    console.warn("予備の端末内保存を読み込めませんでした", error);
  }
  posts.sort((a, b) => b.createdAt - a.createdAt);
  posts.forEach((post) => {
    const image = document.createElement("img");
    if (post.image) {
      const url = URL.createObjectURL(post.image);
      objectUrls.push(url);
      image.src = url;
    } else {
      image.src = post.imageDataUrl;
    }
    image.alt = `${post.name || "匿名"}さんの布教ヘッダー`;
    userPosts.append(image);
    if (manageToken && post.deleteToken === manageToken) managedPost = post;
  });
  if (managedPost) manageBar.hidden = false;
}

document.querySelector("#copyDeleteUrl").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    document.querySelector("#copyDeleteUrl").textContent = "コピーしました";
  } catch {
    prompt("このURLをコピーしてください", location.href);
  }
});

document.querySelector("#deletePost").addEventListener("click", async () => {
  if (!managedPost) return;
  if (!confirm("この布教ヘッダーを最果ての壁から削除しますか？")) return;
  if (managedPost.storage === "localStorage") {
    const posts = JSON.parse(localStorage.getItem("saihate-wall-posts") || "[]");
    localStorage.setItem("saihate-wall-posts", JSON.stringify(posts.filter((post) => post.id !== managedPost.id)));
  } else {
    const db = await openWallDatabase();
    await new Promise((resolve, reject) => {
      const request = db.transaction("posts", "readwrite").objectStore("posts").delete(managedPost.id);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }
  location.href = "./";
});

addEventListener("beforeunload", () => objectUrls.forEach((url) => URL.revokeObjectURL(url)));
loadPosts();
