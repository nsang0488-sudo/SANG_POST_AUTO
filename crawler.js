const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");

function convertToMBasic(url) {
  try {
    const u = new URL(url);
    u.hostname = "mbasic.facebook.com";
    u.searchParams.set("sorting_setting", "CHRONOLOGICAL");
    return u.toString();
  } catch {
    return url;
  }
}

async function runBot() {
  console.log("🚀 BOT SĂN XE SUPER VIP - BẢN VÉT CẠN");

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app"
      });
    }

    const db = admin.database();
    const configSnap = await db.ref("hunt_settings").once("value");
    const config = configSnap.val();

    if (!config || !config.groups || !config.keywords || !config.cookie) {
      console.log("❌ LỖI: Thiếu Config hoặc Cookie trên Firebase!");
      process.exit(0);
    }

    const groups = config.groups.split("\n").map(g => g.trim()).filter(g => g.length > 0);
    const keywords = config.keywords.split(",").map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
    const rawCookie = config.cookie;

    console.log(`📌 QUÉT ${groups.length} GROUP | 🔑 TỪ KHÓA: [${keywords.join(", ")}]`);

    const scanned = new Set();

    for (let group of groups) {
      let url = convertToMBasic(group);
      let page = 0;

      while (url && page < 5) {
        console.log(`🔎 ĐANG LỌC BÀI TẠI: ${url}`);

        const res = await axios.get(url, {
          headers: {
            'cookie': rawCookie,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        const html = res.data;
        if (html.includes("login") || html.includes("checkpoint")) {
          console.log("❌ COOKIE DIE!");
          process.exit(0);
        }

        const $ = cheerio.load(html);
        let foundCount = 0;

        // THUẬT TOÁN MỚI: Tìm tất cả các link "Xem bài viết đầy đủ" (Full Story)
        // Vì mỗi bài viết chắc chắn có 1 link này.
        $("a").each((i, el) => {
          const linkHref = $(el).attr('href') || "";
          
          if (linkHref.includes("story.php") || linkHref.includes("/permalink/")) {
            
            // Leo lên thẻ cha lớn nhất chứa bài viết (thường là div hoặc article)
            const postContainer = $(el).closest('div[role="article"], div.ba, div.bw, div.bl');
            if (postContainer.length === 0) return;

            const rawText = postContainer.text();
            const cleanText = rawText.replace(/\s+/g, ' ').toLowerCase();

            // Kiểm tra từ khóa
            const isMatch = keywords.some(k => cleanText.includes(k.trim()));

            if (isMatch) {
              let fullLink = linkHref.startsWith("http") ? linkHref : "https://m.facebook.com" + linkHref;
              fullLink = fullLink.split("?")[0] + (linkHref.includes("story_fbid") ? "?story_fbid=" + new URLSearchParams(linkHref.split("?")[1]).get("story_fbid") + "&id=" + new URLSearchParams(linkHref.split("?")[1]).get("id") : "");

              if (scanned.has(fullLink)) return;
              scanned.add(fullLink);

              console.log("✅ TÌM THẤY: ", cleanText.substring(0, 50) + "...");

              db.ref("xe_san_duoc").push({
                ten_xe: rawText.trim().substring(0, 500),
                link: fullLink,
                ngay_quet: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
              });
              foundCount++;
            }
          }
        });

        console.log(`📄 Trang ${page + 1}: Tìm được ${foundCount} bài.`);
        
        let next = $("a:contains('See more'), a:contains('Xem thêm'), a:contains('See More')").attr("href");
        url = next ? "https://mbasic.facebook.com" + next : null;
        page++;
        if (url) await new Promise(r => setTimeout(r, 2000));
      }
    }
    console.log("🎉 HOÀN THÀNH.");
    process.exit(0);
  } catch (err) {
    console.log("❌ LỖI:", err.message);
    process.exit(1);
  }
}

runBot();
