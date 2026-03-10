const admin = require("firebase-admin");
const puppeteer = require("puppeteer-core");

async function runBot() {
  console.log("🚀 KHỞI ĐỘNG CRAWLER (PUPPETEER-CORE MODE)");

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app"
      });
    }
    const db = admin.database();

    const snap = await db.ref("hunt_settings").once("value");
    const config = snap.val();
    if (!config) return console.log("❌ Không thấy config");

    const groups = config.groups.split("\n").map(g => g.trim()).filter(Boolean);
    const keywords = config.keywords.split(",").map(k => k.trim().toLowerCase());
    const rawCookie = config.cookie;

    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: '/usr/bin/google-chrome', // Mượn Chrome của GitHub
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    const cookies = rawCookie.split(';').map(pair => {
      const [name, ...value] = pair.trim().split('=');
      if (!name || value.length === 0) return null;
      return { name, value: value.join('='), domain: '.facebook.com', path: '/' };
    }).filter(Boolean);
    await page.setCookie(...cookies);

    for (let groupUrl of groups) {
      console.log(`\n🔎 Đang vào Group: ${groupUrl}`);
      try {
        await page.goto(groupUrl, { waitUntil: "networkidle2", timeout: 60000 });
        
        // Cuộn xuống để bài viết hiện ra
        await page.evaluate(() => window.scrollBy(0, 1200));
        await new Promise(r => setTimeout(r, 4000));

        const posts = await page.evaluate((keywords) => {
          const results = [];
          // Quét mọi bài viết có role="article"
          document.querySelectorAll('div[role="article"]').forEach(art => {
            const text = art.innerText.toLowerCase();
            if (keywords.some(k => text.includes(k))) {
              const linkEl = art.querySelector('a[href*="/posts/"], a[href*="/permalink/"], a[href*="story.php"]');
              if (linkEl) {
                results.push({ content: art.innerText.substring(0, 500), link: linkEl.href.split('?')[0] });
              }
            }
          });
          return results;
        }, keywords);

        console.log(`📊 Tìm thấy ${posts.length} bài tiềm năng.`);
        for (let post of posts) {
          await db.ref("xe_san_duoc").push({
            ...post,
            time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
          });
          console.log("✅ Đã hốt:", post.link);
        }
      } catch (e) {
        console.log(`⚠️ Lỗi: ${e.message}`);
      }
    }
    await browser.close();
    console.log("\n🎉 XONG!");
    process.exit(0);
  } catch (err) {
    console.log("❌ CRASH:", err.message);
    process.exit(1);
  }
}
runBot();
