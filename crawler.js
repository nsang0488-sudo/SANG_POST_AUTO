const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");

function convertToMBasic(url) {
  try {
    const u = new URL(url);
    u.hostname = "mbasic.facebook.com";
    return u.toString();
  } catch {
    return url;
  }
}

async function runBot() {
  console.log("🚀 BOT SĂN XE FACEBOOK (CRAW VIP - AUTO COOKIE)");

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL:
          "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app"
      });
    }

    const db = admin.database();

    // 1. ĐỌC TẤT CẢ CONFIG TỪ FIREBASE (BAO GỒM CẢ COOKIE)
    const configSnap = await db.ref("hunt_settings").once("value");
    const config = configSnap.val();

    // KIỂM TRA THÊM config.cookie
    if (!config || !config.groups || !config.keywords || !config.cookie) {
      console.log("❌ Thiếu config hoặc Cookie trên Firebase (Value của ô cookie đang trống)");
      process.exit(0);
    }

    const groups = config.groups
      .split("\n")
      .map(g => g.trim())
      .filter(g => g.length > 0);

    const keywords = config.keywords
      .split(",")
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    // 2. LẤY COOKIE TỪ FIREBASE THAY VÌ DÁN CỨNG
    const rawCookie = config.cookie;

    console.log("📌 SỐ GROUP:", groups.length);
    console.log("🔑 KEYWORDS:", keywords);
    console.log("🍪 TRẠNG THÁI: Đã tải Cookie từ Firebase");

    const scanned = new Set();

    for (let group of groups) {
      let url = convertToMBasic(group);
      console.log("🌐 URL FINAL:", url);

      let page = 0;
      while (url && page < 6) {
        console.log("🔎 QUÉT:", url);

        const res = await axios.get(url, {
          headers: {
            cookie: rawCookie,
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });

        const html = res.data;

        if (html.includes("login") || html.includes("checkpoint") || html.includes("Log In")) {
          console.log("❌ COOKIE TRÊN FIREBASE HẾT HẠN HOẶC SAI");
          // Lưu ý: Không process.exit(0) ở đây để nếu group sau là công khai thì vẫn chạy được, 
          // nhưng ở đây mình giữ nguyên cấu trúc của Sang là thoát luôn để Sang biết mà thay Cookie.
          process.exit(0); 
        }

        const $ = cheerio.load(html);
        let found = 0;

        $("div[role='article']").each((i, el) => {
          const text = $(el).text().toLowerCase();
          if (!keywords.some(k => text.includes(k))) return;

          let linkRaw =
            $(el).find("a[href*='story.php']").attr("href") ||
            $(el).find("a").attr("href");

          if (!linkRaw) return;

          let fullLink = linkRaw.startsWith("http")
            ? linkRaw
            : "https://facebook.com" + linkRaw.split("?")[0];

          if (scanned.has(fullLink)) return;
          scanned.add(fullLink);

          console.log("🚗 XE PHÁT HIỆN:", text.substring(0, 80));

          db.ref("xe_san_duoc").push({
            ten_xe: text.substring(0, 150),
            link: fullLink,
            ngay_quet: new Date().toLocaleString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh"
            })
          });
          found++;
        });

        console.log("📄 TÌM ĐƯỢC:", found);

        let next =
          $("a:contains('See more posts')").attr("href") ||
          $("a:contains('Xem thêm bài viết')").attr("href") ||
          $("a:contains('See More Posts')").attr("href");

        if (next) {
          url = "https://mbasic.facebook.com" + next;
        } else {
          url = null;
        }

        page++;
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    console.log("🎉 HOÀN THÀNH QUÉT");
    process.exit(0);

  } catch (err) {
    console.log("❌ LỖI:", err.message);
    process.exit(1);
  }
}

runBot();
