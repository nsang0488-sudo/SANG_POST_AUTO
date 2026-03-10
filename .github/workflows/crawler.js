const admin = require('firebase-admin');

// Kết nối Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
}
const db = admin.database();

async function startBot() {
    console.log("🚀 Bot bắt đầu đi tuần...");
    
    // Lấy cấu hình từ màn hình bạn đã nhập
    const snap = await db.ref('config/hunt_settings').once('value');
    if (!snap.exists()) return console.log("Chưa có cấu hình link/từ khóa!");
    
    const { links, keywords } = snap.val();
    console.log("Đang quét các nhóm:", links);
    console.log("Từ khóa tìm kiếm:", keywords);

    // CHỖ NÀY: Trong thực tế, bạn cần một API hoặc Token Facebook để quét.
    // Tạm thời mình giả lập 1 tin để bạn thấy nó hiện lên màn hình của bạn nhé:
    const testPost = {
        ten_xe: "MỚI QUÉT ĐƯỢC: Có khách đăng bán Xpander giá rẻ!",
        link: links[0] || "https://facebook.com",
        ngay_quet: new Date().toLocaleString('vi-VN')
    };

    // Đẩy tin vào nhánh xe_san_duoc để màn hình HTML của bạn hiển thị
    await db.ref('xe_san_duoc').push(testPost);
    
    console.log("✅ Đã gửi 1 tin mới về màn hình!");
    process.exit();
}

startBot();
