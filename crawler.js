const admin = require("firebase-admin");
const puppeteer = require("puppeteer-core");

async function runBot() {
  console.log("🚀 KHỞI ĐỘNG CRAWLER FREE (MBASIC MODE)");

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
    if (!config) return console.log("❌ Không thấy cấu hình!");

    const groups = (config.groups || "").split("\n").map(g => g.trim()).filter(Boolean);
    const keywords = (config.keywords || "").split(",").map(k => k.trim().toLowerCase()).filter(Boolean);

    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: '/usr/bin/google-chrome',
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    // Giả lập trình duyệt siêu cũ để Facebook trả về bản mbasic
    await page.setUserAgent("Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1");

    for (let groupUrl of groups) {
      // Chuyển link về mbasic
      let mbasicUrl = groupUrl.replace("www.facebook.com", "mbasic.facebook.com").replace("m.facebook.com", "mbasic.facebook.com");
      if (!mbasicUrl.includes('?')) mbasicUrl += "?sort=chronological";
      
      console.log(`\n🔎 Đang quét: ${mbasicUrl}`);
      
      try {
        await page.goto(mbasicUrl, { waitUntil: "networkidle2", timeout: 45000 });

        const posts = await page.evaluate((kws) => {
          const results = [];
          // Ở mbasic, mỗi bài viết thường nằm trong một thẻ <table> hoặc <div> có class đặc trưng
          const elements = document.querySelectorAll('div[id^="u_0_"], div[role="article"], table');
          
          elements.forEach(el => {
            const text = el.innerText.toLowerCase();
            const match = kws.find(k => text.includes(k));

            if (match) {
              // Tìm link bài viết (thường là chữ "Full Story" hoặc "Cả bài viết")
              const linkEl = el.querySelector('a[href*="/story.php"], a[href*="/permalink/"]');
              if (linkEl) {
                results.push({
                  content: el.innerText.substring(0, 400).replace(/\s+/g, ' '),
                  link: linkEl.href.split('&')[0].split('?')[0] // Làm sạch link
                });
              }
            }
          });
          return results;
        }, keywords);

        // Lọc trùng
        const cleanPosts = Array.from(new Map(posts.map(p => [p.link, p])).values());
        console.log(`📊 Tìm thấy ${cleanPosts.length} bài phù hợp.`);

        for (let post of cleanPosts) {
          await db.ref("xe_san_duoc").push({
            ...post,
            time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
          });
          console.log(`✅ Đã lưu: ${post.link}`);
        }
      } catch (e) {
        console.log(`⚠️ Không vào được group này (có thể là group kín).`);
      }
    }

    await browser.close();
    console.log("\n🎉 HOÀN THÀNH.");
    process.exit(0);
  } catch (err) {
    console.log("❌ LỖI:", err.message);
    process.exit(1);
  }
}
runBot();
