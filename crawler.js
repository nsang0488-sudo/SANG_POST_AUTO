const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");

// chuyển link group sang mbasic
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

  console.log("🚀 BOT SĂN XE SUPER VIP - FIX LINK CHUẨN");

  try {

    // ===== FIREBASE =====
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app"
      });
    }

    const db = admin.database();

    // ===== LẤY CONFIG =====
    const configSnap = await db.ref("hunt_settings").once("value");
    const config = configSnap.val();

    if (!config || !config.groups || !config.keywords || !config.cookie) {
      console.log("❌ Thiếu config trên Firebase");
      process.exit(0);
    }

    const groups = config.groups
      .split("\n")
      .map(g => g.trim())
      .filter(Boolean);

    const keywords = config.keywords
      .split(",")
      .map(k => k.trim().toLowerCase())
      .filter(Boolean);

    const rawCookie = config.cookie;

    console.log(`📌 QUÉT ${groups.length} GROUP`);
    console.log(`🔑 KEYWORD: ${keywords.join(", ")}`);

    const scanned = new Set();

    // ===== QUÉT GROUP =====
    for (let group of groups) {

      let url = convertToMBasic(group);
      let page = 0;

      while (url && page < 6) {

        console.log(`🔎 TRANG ${page + 1}: ${url}`);

        try {

          const res = await axios.get(url, {
            headers: {
              cookie: rawCookie,
              "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
            },
            timeout: 15000
          });

          const html = res.data;

          if (html.includes("login") || html.includes("checkpoint")) {
            console.log("❌ COOKIE DIE - cập nhật cookie mới");
            process.exit(0);
          }

          const $ = cheerio.load(html);

          let foundCount = 0;

          // ===== QUÉT TẤT CẢ BLOCK =====
          $("article, div").each((i, el) => {

            const rawText = $(el).text();

            const cleanText = rawText
              .replace(/\s+/g, " ")
              .toLowerCase();

            const isMatch = keywords.some(k =>
              cleanText.includes(k)
            );

            if (!isMatch) return;

            let link = null;

            // ===== TÌM LINK POST =====
            $(el).find("a").each((i, a) => {

              const href = $(a).attr("href") || "";

              if (
                href.includes("/permalink/") ||
                href.includes("story.php") ||
                href.includes("/posts/")
              ) {
                link = href;
                return false;
              }

            });

            if (!link) return;

            let fullLink = link.startsWith("http")
              ? link
              : "https://m.facebook.com" + link;

            if (fullLink.includes("story.php")) {
              fullLink = fullLink.split("&")[0];
            }

            if (scanned.has(fullLink)) return;

            scanned.add(fullLink);

            console.log("✅ PHÁT HIỆN:");
            console.log(cleanText.substring(0, 80));
            console.log("🔗", fullLink);

            db.ref("xe_san_duoc").push({
              ten_xe: rawText.trim().substring(0, 600),
              link: fullLink,
              ngay_quet: new Date().toLocaleString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh"
              })
            });

            foundCount++;

          });

          console.log(`📄 Tìm được ${foundCount} bài`);

          // ===== TÌM TRANG TIẾP =====
          let nextLink = $("a:contains('Xem thêm'), a:contains('See more')").attr("href");

          if (nextLink) {
            url = "https://mbasic.facebook.com" + nextLink;
            page++;

            await new Promise(r => setTimeout(r, 3000));

          } else {

            url = null;

          }

        } catch (e) {

          console.log("⚠️ Lỗi truy cập trang");
          url = null;

        }

      }

    }

    console.log("🎉 HOÀN THÀNH VÒNG QUÉT");

    process.exit(0);

  } catch (err) {

    console.log("❌ LỖI HỆ THỐNG:", err.message);

    process.exit(1);

  }

}

runBot();
