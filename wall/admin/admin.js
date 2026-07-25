const wallApi = String(window.SAIHATE_WALL_API || "").replace(/\/$/, "");
const loginPanel = document.querySelector("#loginPanel");
const adminPanel = document.querySelector("#adminPanel");
const adminTokenInput = document.querySelector("#adminToken");
const loginStatus = document.querySelector("#loginStatus");
const postList = document.querySelector("#postList");
const loadMoreButton = document.querySelector("#loadMore");
let adminToken = sessionStorage.getItem("saihate-wall-admin-token") || "";
let offset = 0;

function apiReady() {
  return wallApi && !wallApi.includes("REPLACE-ME");
}

async function loadPosts(reset = false) {
  if (reset) {
    offset = 0;
    postList.replaceChildren();
  }
  const response = await fetch(`${wallApi}/posts?offset=${offset}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "投稿を読み込めませんでした");
  result.posts.forEach(addPost);
  offset = result.nextOffset;
  loadMoreButton.hidden = !result.hasMore;
}

function addPost(post) {
  const card = document.createElement("article");
  card.className = "post-card";
  const image = document.createElement("img");
  image.src = post.imageUrl;
  image.alt = `${post.name || "匿名"}さんの布教ヘッダー`;
  image.loading = "lazy";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "管理者として削除";
  button.addEventListener("click", () => removePost(post, card, button));
  card.append(image, button);
  postList.append(card);
}

async function removePost(post, card, button) {
  if (!confirm("この投稿を完全に削除しますか？")) return;
  button.disabled = true;
  const response = await fetch(`${wallApi}/posts/${encodeURIComponent(post.id)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${adminToken}` }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    button.disabled = false;
    alert(result.error || "削除できませんでした");
    return;
  }
  card.remove();
}

async function login() {
  if (!apiReady()) {
    loginStatus.textContent = "Cloudflareの接続設定が完了していません";
    return;
  }
  adminToken = adminTokenInput.value.trim() || adminToken;
  if (!adminToken) {
    loginStatus.textContent = "管理パスワードを入力してください";
    return;
  }
  try {
    const check = await fetch(`${wallApi}/admin/check`, {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    const checkResult = await check.json().catch(() => ({}));
    if (!check.ok) throw new Error(checkResult.error || "管理パスワードが違います");
    await loadPosts(true);
    sessionStorage.setItem("saihate-wall-admin-token", adminToken);
    loginPanel.hidden = true;
    adminPanel.hidden = false;
  } catch (error) {
    loginStatus.textContent = error.message;
  }
}

document.querySelector("#loginButton").addEventListener("click", login);
adminTokenInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});
document.querySelector("#logoutButton").addEventListener("click", () => {
  sessionStorage.removeItem("saihate-wall-admin-token");
  location.reload();
});
loadMoreButton.addEventListener("click", () => loadPosts());

if (adminToken) login();
