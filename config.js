// config.js
//
// DİKKAT: Bu dosya tarayıcıya gönderiliyor. Buradaki hiçbir değer GİZLİ DEĞİLDİR.
// Gizli kalması gereken bir şey buraya YAZILMAZ — sunucu tarafına (api/*.js içinde
// process.env) taşınır ve Vercel environment variable olarak tanımlanır.
//
// Buradaki değerlerin durumu:
//   YOUTUBE_API_KEY — tarayıcıdan çağrıldığı için gizlenemez. Doğru koruma
//     Google Cloud Console'da "HTTP referrer" kısıtlaması (yalnızca kendi
//     domain'inden çağrılabilsin) + YouTube Data API dışındaki API'lere kapalı olması.
//   FIREBASE.apiKey — Firebase'de bu değer TASARIM GEREĞİ herkese açıktır;
//     güvenlik firestore.rules ile sağlanır, anahtarı saklamakla değil.
//   MY_DYNAMIC_API — herkese açık bir Apps Script endpoint'i, sır değil.
//
// 2026-07: Kullanılmayan bir SPOTIFY bloğu (CLIENT_ID + CLIENT_SECRET) buradan
// kaldırıldı — hiçbir kod okumuyordu ama public repoda gerçek bir secret olarak
// duruyordu. Sunucu tarafı Spotify çağrıları api/spotify.js içinde, secret'sız.
const CONFIG = {

    YOUTUBE_API_KEY: "AIzaSyC_iOX3x46Jik-qHnYqKK5na-cJnvEaoh4",
    MY_DYNAMIC_API: "https://script.google.com/macros/s/AKfycbxPQ6iA4QFzIBFbfylzRNRflDsjVXqQ21kVG2ZkiBhpfX_cYKeVglnUXNX8cIVxAGU/exec",

    FIREBASE: {
        apiKey: "AIzaSyAwSc0iMQSXhs8uz8uZuL-XCaeVOrgC2Ic",
        authDomain: "jt-website-5406f.firebaseapp.com",
        projectId: "jt-website-5406f",
        storageBucket: "jt-website-5406f.firebasestorage.app",
        messagingSenderId: "98415821216",
        appId: "1:98415821216:web:3d72c7b4661e96b307a4c5",
        measurementId: "G-8XEDRZKK0D"
    }
};