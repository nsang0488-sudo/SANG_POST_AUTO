const admin = require("firebase-admin");
const puppeteer = require("puppeteer-core");

async function runBot() {
  console.log("🚀 KHỞI ĐỘNG CRAWLER (CHẾ ĐỘ KHÔNG COOKIE)");

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app"
      });
    }
    const db = admin.database();

    // 1. LẤY DỮ LIỆU TỪ FIREBASE
    const snap = await db.ref("hunt_settings").once("value");
    const config = snap.val();

    if (!config) {
      console.log("❌ LỖI: Không tìm thấy node 'hunt_settings' trên Firebase!");
      return;
    }

    const rawGroups = config.groups || "";
    const rawKeywords = config.keywords || "";
    const rawCookie = config.cookie || ""; // Có thể trống

    if (!rawGroups || !rawKeywords) {
      console.log("❌ LỖI: Thiếu 'groups' hoặc 'keywords' trên Firebase!");
      return;
    }

    const groups = rawGroups.split("\n").map(g => g.trim()).filter(Boolean);
    const keywords = rawKeywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);

    // 2. KHỞI CHẠY TRÌNH DUYỆT
    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: '/usr/bin/google-chrome',
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    // 3. NẠP COOKIE (CHỈ NẾU CÓ)
    if (rawCookie && rawCookie.trim() !== "") {
      console.log("🔑 Đang nạp Cookie từ Firebase...");
      const cookies = rawCookie.split(';').map(pair => {
        const parts = pair.trim().split('=');
        const name = parts[0];
        const value = parts.slice(1).join('=');
        if (!name || !value) return null;
        return { name, value, domain: '.facebook.com', path: '/' };
      }).filter(Boolean);
      if (cookies.length > 0) await page.setCookie(...cookies);
    } else {
      console.log("🌐 Chạy ở chế độ ẩn danh (Không đăng nhập)");
    }

    for (let groupUrl of groups) {
      console.log(`\n🔎 Đang quét: ${groupUrl}`);
      try {
        // Tăng timeout lên vì không login load sẽ chậm hơn
        await page.goto(groupUrl, { waitUntil: "networkidle2", timeout: 60000 });
        
        // Đợi một chút để bài viết render
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 5000));

        const posts = await page.evaluate((kws) => {
          const results = [];
          // Facebook Public Group thường dùng cấu trúc khác một chút, quét rộng hơn
          const articles = document.querySelectorAll('div[role="article"], div[data-testid="post_message"]');
          
          articles.forEach(art => {
            const text = art.innerText.toLowerCase();
            if (kws.some(k => text.includes(k))) {
              const linkEl = art.querySelector('a[href*="/posts/"], a[href*="/permalink/"], a[href*="story.php"]');
              if (linkEl) {
                // Lấy link sạch
                let href = linkEl.href.split('?')[0];
                results.push({ content: art.innerText.substring(0, 500), link: href });
              }
            }
          });
          return results;
        }, keywords);

        console.log(`📊 Tìm thấy ${posts.length} bài viết mới khớp từ khóa.`);
        
        for (let post of posts) {
          await db.ref("xe_san_duoc").push({
            ...post,
            time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
          });
          console.log(`✅ Đã đẩy lên Firebase: ${post.link}`);
        }
      } catch (e) {
        console.log(`⚠️ Lỗi tại group ${groupUrl}: Group này có thể là Group kín hoặc link sai.`);
      }
    }

    await browser.close();
    console.log("\n🎉 HOÀN THÀNH CHU KỲ QUÉT.");
    process.exit(0);

  } catch (err) {
    console.log("❌ CRASH HỆ THỐNG:", err.message);
    process.exit(1);
  }
}

runBot();
