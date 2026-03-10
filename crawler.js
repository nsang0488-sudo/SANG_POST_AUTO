const admin = require("firebase-admin");
const puppeteer = require("puppeteer-core");

async function runBot() {
  console.log("🚀 KHỞI ĐỘNG CRAWLER (SĂN TIN MỚI NHẤT)");

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
    if (!config) return console.log("❌ Lỗi: Không thấy config");

    const rawGroups = config.groups || "";
    const rawKeywords = config.keywords || "";
    const rawCookie = config.cookie || "";

    const groups = rawGroups.split("\n").map(g => g.trim()).filter(Boolean);
    const keywords = rawKeywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);

    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: '/usr/bin/google-chrome',
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--lang=vi-VN"]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1600 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    if (rawCookie) {
      const cookies = rawCookie.split(';').map(pair => {
        const parts = pair.trim().split('=');
        return { name: parts[0], value: parts.slice(1).join('='), domain: '.facebook.com', path: '/' };
      }).filter(c => c.name && c.value);
      await page.setCookie(...cookies);
    }

    for (let groupUrl of groups) {
      // ÉP FACEBOOK HIỂN THỊ BÀI MỚI NHẤT bằng cách thêm tham số vào URL
      let huntUrl = groupUrl.includes('?') ? `${groupUrl}&sorting_setting=CHRONOLOGICAL` : `${groupUrl}?sorting_setting=CHRONOLOGICAL`;
      
      console.log(`\n🔎 Đang quét: ${huntUrl}`);
      try {
        await page.goto(huntUrl, { waitUntil: "networkidle2", timeout: 60000 });
        
        // Đợi 5 giây để bài viết hiện ra hoàn toàn
        await new Promise(r => setTimeout(r, 5000));

        // Cuộn trang 2 lần để load thêm dữ liệu
        for(let i=0; i<2; i++){
          await page.evaluate(() => window.scrollBy(0, 1000));
          await new Promise(r => setTimeout(r, 2000));
        }

        const posts = await page.evaluate((kws) => {
          const results = [];
          // Quét tất cả các khối có thể chứa văn bản bài viết
          const articles = document.querySelectorAll('div[role="article"], div[data-ad-preview="message"], div.x1yzt60o');
          
          articles.forEach(art => {
            const text = art.innerText.toLowerCase();
            const match = kws.find(k => text.includes(k));
            
            if (match) {
              const linkEl = art.querySelector('a[href*="/posts/"], a[href*="/permalink/"], a[href*="story.php"]');
              if (linkEl) {
                results.push({
                  content: art.innerText.substring(0, 500),
                  link: linkEl.href.split('?')[0],
                  keyword: match
                });
              }
            }
          });
          return results;
        }, keywords);

        console.log(`📊 Tìm thấy ${posts.length} bài khớp từ khóa.`);
        
        for (let post of posts) {
          // Lưu vào Firebase
          await db.ref("xe_san_duoc").push({
            ...post,
            time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
          });
          console.log(`✅ Lưu bài: ${post.link}`);
        }

      } catch (e) {
        console.log(`⚠️ Lỗi tại group: ${e.message}`);
      }
    }

    await browser.close();
    console.log("\n🎉 HOÀN THÀNH.");
    process.exit(0);
  } catch (err) {
    console.log("❌ CRASH:", err.message);
    process.exit(1);
  }
}
runBot();
