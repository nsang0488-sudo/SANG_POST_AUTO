const admin = require("firebase-admin");
const puppeteer = require("puppeteer");

async function runBot() {
  console.log("🚀 KHỞI ĐỘNG CRAWLER (PUPPETEER MODE)");

  try {
    // 1. SETUP FIREBASE
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app"
      });
    }
    const db = admin.database();

    // 2. LOAD CONFIG
    const snap = await db.ref("hunt_settings").once("value");
    const config = snap.val();
    if (!config) return console.log("❌ Không tìm thấy config trên Firebase");

    const groups = config.groups.split("\n").map(g => g.trim()).filter(Boolean);
    const keywords = config.keywords.split(",").map(k => k.trim().toLowerCase());
    const rawCookie = config.cookie;

    // 3. MỞ TRÌNH DUYỆT (Cấu hình chuẩn cho GitHub Actions)
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox", 
        "--disable-dev-shm-usage",
        "--disable-notifications"
      ]
    });
    const page = await browser.newPage();

    // Giả lập User-Agent xịn
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    // Nạp Cookie vào trình duyệt
    const cookies = rawCookie.split(';').map(pair => {
      const [name, ...value] = pair.trim().split('=');
      if (!name || value.length === 0) return null;
      return { name, value: value.join('='), domain: '.facebook.com', path: '/' };
    }).filter(Boolean);
    await page.setCookie(...cookies);

    const scanned = new Set();

    for (let groupUrl of groups) {
      console.log(`\n🔎 Đang quét: ${groupUrl}`);
      try {
        await page.goto(groupUrl, { waitUntil: "networkidle2", timeout: 60000 });

        // Cuộn trang để load bài viết (Facebook là trang web động)
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 3000));

        // QUÉT DỮ LIỆU
        const posts = await page.evaluate((keywords) => {
          const results = [];
          const items = document.querySelectorAll('div[role="article"]');

          items.forEach(item => {
            const text = item.innerText.toLowerCase();
            const isMatch = keywords.some(k => text.includes(k));

            if (isMatch) {
              const linkEl = item.querySelector('a[href*="/posts/"], a[href*="/permalink/"], a[href*="story.php"]');
              if (linkEl) {
                let cleanLink = linkEl.href.split('?')[0];
                results.push({
                  content: item.innerText.substring(0, 500),
                  link: cleanLink
                });
              }
            }
          });
          return results;
        }, keywords);

        console.log(`📊 Tìm thấy ${posts.length} bài phù hợp.`);

        for (let post of posts) {
          if (scanned.has(post.link)) continue;
          scanned.add(post.link);

          await db.ref("xe_san_duoc").push({
            text: post.content,
            link: post.link,
            time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
          });
          console.log("✅ Đã lưu bài:", post.link);
        }
      } catch (e) {
        console.log(`⚠️ Lỗi quét group: ${e.message}`);
      }
    }

    await browser.close();
    console.log("\n🎉 HOÀN THÀNH.");
    process.exit(0);
  } catch (err) {
    console.log("❌ LỖI HỆ THỐNG:", err.message);
    process.exit(1);
  }
}

runBot();
