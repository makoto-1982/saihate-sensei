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
  try {
    const db = await openWallDatabase();
    const posts = await new Promise((resolve, reject) => {
      const request = db.transaction("posts", "readonly").objectStore("posts").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    posts.sort((a, b) => b.createdAt - a.createdAt);
    posts.forEach((post) => {
      const image = document.createElement("img");
      const url = URL.createObjectURL(post.image);
      objectUrls.push(url);
      image.src = url;
      image.alt = `${post.name || "匿名"}さんの布教ヘッダー`;
      userPosts.append(image);
      if (manageToken && post.deleteToken === manageToken) managedPost = post;
    });
    if (managedPost) manageBar.hidden = false;
  } catch (error) {
    console.error(error);
  }
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
  const db = await openWallDatabase();
  await new Promise((resolve, reject) => {
    const request = db.transaction("posts", "readwrite").objectStore("posts").delete(managedPost.id);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  location.href = "./";
});

addEventListener("beforeunload", () => objectUrls.forEach((url) => URL.revokeObjectURL(url)));
loadPosts();
