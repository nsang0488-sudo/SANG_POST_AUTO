const admin = require("firebase-admin");
const puppeteer = require("puppeteer-core");

async function runBot() {
  console.log("🚀 KHỞI ĐỘNG CRAWLER (BẢN VÉT CẠN - KHÔNG COOKIE)");

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

    const groups = (config.groups || "").split("\n").map(g => g.trim()).filter(Boolean);
    const keywords = (config.keywords || "").split(",").map(k => k.trim().toLowerCase()).filter(Boolean);

    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: '/usr/bin/google-chrome',
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--lang=vi-VN"]
    });

    const page = await browser.newPage();
    // Giả lập iPhone để Facebook trả về giao diện mobile nhẹ hơn, ít bị chặn hơn
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1");

    for (let groupUrl of groups) {
      // Chuyển sang m.facebook để dễ quét hơn khi không có login
      let mobileUrl = groupUrl.replace("www.facebook.com", "m.facebook.com");
      console.log(`\n🔎 Đang quét: ${mobileUrl}`);
      
      try {
        await page.goto(mobileUrl, { waitUntil: "networkidle2", timeout: 60000 });
        
        // Cuộn trang để load bài
        await page.evaluate(() => window.scrollBy(0, 1500));
        await new Promise(r => setTimeout(r, 5000));

        const posts = await page.evaluate((kws) => {
          const results = [];
          // Tìm mọi link có cấu trúc bài viết
          const links = document.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"], a[href*="story.php"]');
          
          links.forEach(link => {
            // Tìm khối văn bản lớn nhất chứa cái link này (thường là cả bài viết)
            let container = link.closest('div') || link.parentElement;
            for(let i=0; i<5; i++) { 
                if(container && container.innerText.length < 100) container = container.parentElement;
            }

            const text = container ? container.innerText.toLowerCase() : "";
            const match = kws.find(k => text.includes(k));

            if (match && link.href) {
              results.push({
                content: text.substring(0, 300),
                link: link.href.split('?')[0],
                keyword: match
              });
            }
          });
          return results;
        }, keywords);

        // Lọc trùng link trong 1 lần quét
        const uniquePosts = Array.from(new Map(posts.map(item => [item.link, item])).values());
        
        console.log(`📊 Tìm thấy ${uniquePosts.length} bài tiềm năng.`);
        
        for (let post of uniquePosts) {
          await db.ref("xe_san_duoc").push({
            ...post,
            time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
          });
          console.log(`✅ Đã lưu: ${post.link}`);
        }

      } catch (e) {
        console.log(`⚠️ Lỗi: ${e.message}`);
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
