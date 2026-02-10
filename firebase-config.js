// Конфигурация Firebase - ЗАМЕНИТЕ на свои данные!
const firebaseConfig = {
  apiKey: "AIzaSyB7bod-zyXTc4IIpgfBp5zo7UgZ0ylG7WU",
  authDomain: "worship-songs-app.firebaseapp.com",
  projectId: "worship-songs-app",
  storageBucket: "worship-songs-app.firebasestorage.app",
  messagingSenderId: "686095605763",
  appId: "1:686095605763:web:e5217a403b41656eb0ae36"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Анонимная авторизация для всех пользователей
auth.signInAnonymously()
    .then(() => console.log("Авторизованы анонимно"))
    .catch(error => console.error("Ошибка авторизации:", error));