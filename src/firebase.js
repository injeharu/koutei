import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// ★ここにFirebaseコンソールからコピーした設定値を貼り付けてください★
const firebaseConfig = {
  apiKey: "AIzaSyAN34k4hzykWVpXeQI7rBW-AZCYodleJZA",
  authDomain: "schedule-app-c19af.firebaseapp.com",
  projectId: "schedule-app-c19af",
  storageBucket: "schedule-app-c19af.firebasestorage.app",
  messagingSenderId: "1033217631383",
  appId: "1:1033217631383:web:00ce932fff85f7efe8f5d2",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
