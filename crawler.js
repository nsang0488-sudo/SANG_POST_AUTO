const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");

// chuyển group -> mbasic
function toMBasic(url) {
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

  console.log("🚀 FACEBOOK GROUP CRAWLER START");

  try {

    // ===== FIREBASE =====
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL:
          "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app"
      });
    }

    const db = admin.database();

    // ===== LOAD CONFIG =====
    const snap = await db.ref("hunt_settings").once("value");
    const config = snap.val();

    if (!config) {
      console.log("❌ Không có config");
      return;
    }

    const groups = config.groups
      .split("\n")
      .map(g => g.trim())
      .filter(Boolean);

    const keywords = config.keywords
      .split(",")
      .map(k => k.trim().toLowerCase())
      .filter(Boolean);

    const cookie = config.cookie;

    console.log(`📌 Groups: ${groups.length}`);
    console.log(`🔑 Keywords: ${keywords.join(", ")}`);

    const scanned = new Set();

    // ===== QUÉT GROUP =====
    for (let group of groups) {

      let url = toMBasic(group);
      let page = 0;

      while (url && page < 5) {

        console.log(`🔎 PAGE ${page + 1}`);

        const res = await axios.get(url, {
          headers: {
            cookie: cookie,
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
            "accept-language": "vi,en;q=0.9"
          },
          timeout: 20000
        });

        const html = res.data;

        // check cookie
        if (
          html.includes("login") ||
          html.includes("checkpoint") ||
          html.includes("Please log in")
        ) {
          console.log("❌ COOKIE DIE");
          return;
        }

        const $ = cheerio.load(html);

        let found = 0;

        // ===== POST BLOCK =====
        $("div[data-ft]").each((i, el) => {

          const text = $(el)
            .text()
            .replace(/\s+/g, " ")
            .toLowerCase();

          const match = keywords.some(k => text.includes(k));

          if (!match) return;

          let link = null;

          // ===== TÌM LINK POST =====
          $(el)
            .find("a")
            .each((i, a) => {

              const href = $(a).attr("href") || "";

              if (
                href.includes("permalink") ||
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

          if (scanned.has(fullLink)) return;

          scanned.add(fullLink);

          console.log("✅ POST FOUND");
          console.log(fullLink);

          db.ref("xe_san_duoc").push({
            text: text.substring(0, 500),
            link: fullLink,
            time: new Date().toLocaleString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh"
            })
          });

          found++;

        });

        console.log(`📄 Found: ${found}`);

        // ===== NEXT PAGE =====
        const next = $("a:contains('See more'), a:contains('Xem thêm')").attr(
          "href"
        );

        if (next) {

          url = "https://mbasic.facebook.com" + next;
          page++;

          await new Promise(r => setTimeout(r, 3000));

        } else {

          url = null;

        }

      }

    }

    console.log("🎉 DONE");

  } catch (err) {

    console.log("❌ ERROR:", err.message);

  }

}

runBot();
