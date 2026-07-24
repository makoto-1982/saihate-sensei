const userPosts = document.querySelector("#userPosts");
const objectUrls = [];

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
    });
  } catch (error) {
    console.error(error);
  }
}

addEventListener("beforeunload", () => objectUrls.forEach((url) => URL.revokeObjectURL(url)));
loadPosts();
