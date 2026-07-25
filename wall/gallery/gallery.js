const userPosts = document.querySelector("#userPosts");
const params = new URLSearchParams(location.search);
const manageToken = params.get("manage");
const managedPostId = params.get("post");
const manageBar = document.querySelector("#manageBar");
const wallStatus = document.querySelector("#wallStatus");
const loadSentinel = document.querySelector("#loadSentinel");
const wallApi = String(window.SAIHATE_WALL_API || "").replace(/\/$/, "");
let offset = 0;
let hasMore = true;
let loading = false;

function apiReady() {
  return wallApi && !wallApi.includes("REPLACE-ME");
}

async function loadPosts() {
  if (loading || !hasMore) return;
  if (!apiReady()) {
    wallStatus.textContent = "Cloudflareの接続設定が完了していません";
    return;
  }
  loading = true;
  wallStatus.textContent = offset ? "続きを読み込んでいます…" : "壁を読み込んでいます…";
  try {
    const response = await fetch(`${wallApi}/posts?offset=${offset}`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "壁を読み込めませんでした");
    result.posts.forEach(addPostImage);
    offset = result.nextOffset;
    hasMore = result.hasMore;
    wallStatus.textContent = "";
    loadSentinel.hidden = !hasMore;
  } catch (error) {
    wallStatus.textContent = error.message;
  } finally {
    loading = false;
  }
}

function addPostImage(post) {
  const image = document.createElement("img");
  image.src = post.imageUrl;
  image.alt = `${post.name || "匿名"}さんの布教ヘッダー`;
  image.loading = offset > 0 ? "lazy" : "eager";
  image.dataset.postId = post.id;
  userPosts.append(image);
}

document.querySelector("#copyDeleteUrl").addEventListener("click", async () => {
  const button = document.querySelector("#copyDeleteUrl");
  try {
    await navigator.clipboard.writeText(location.href);
    button.textContent = "コピーしました";
  } catch {
    prompt("このURLをコピーしてください", location.href);
  }
});

document.querySelector("#deletePost").addEventListener("click", async () => {
  if (!manageToken || !managedPostId || !apiReady()) return;
  if (!confirm("この布教ヘッダーを最果ての壁から削除しますか？")) return;
  const response = await fetch(`${wallApi}/posts/${encodeURIComponent(managedPostId)}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deleteToken: manageToken })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    alert(result.error || "削除できませんでした");
    return;
  }
  location.href = "./";
});

if (manageToken && managedPostId) manageBar.hidden = false;

const observer = new IntersectionObserver((entries) => {
  if (entries.some((entry) => entry.isIntersecting)) loadPosts();
}, { rootMargin: "800px" });
observer.observe(loadSentinel);
loadPosts();
