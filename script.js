
// ===================================
// Study Mate JavaScript
// ===================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";


// ===================================
// Firebase設定
// ===================================

const firebaseConfig = {
  apiKey: "AIzaSyAw08btPXXb-272OtJC1nONUGPuKdQAEMA",
  authDomain: "study-mate-88d68.firebaseapp.com",
  projectId: "study-mate-88d68",
  storageBucket: "study-mate-88d68.firebasestorage.app",
  messagingSenderId: "30413754364",
  appId: "1:30413754364:web:5a7258b22bef204cc16c79",
  measurementId: "G-RB2LNMJ3M4"
};


// ===================================
// Firebase初期化
// ===================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();


// ===================================
// HTML要素取得
// ===================================

// ログイン画面
const authScreen = document.getElementById("authScreen");
const appContent = document.getElementById("appContent");

const signupForm = document.getElementById("signupForm");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const loginButton = document.getElementById("loginButton");
const googleLoginButton = document.getElementById("googleLoginButton");

const logoutButton = document.getElementById("logoutButton");
const appLogoutButton = document.getElementById("appLogoutButton");

const authMessage = document.getElementById("authMessage");


// 勉強管理画面
const taskForm = document.getElementById("taskForm");

const taskTitle = document.getElementById("taskTitle");
const taskSubject = document.getElementById("taskSubject");
const taskDate = document.getElementById("taskDate");
const taskDuration = document.getElementById("taskDuration");

const taskList = document.getElementById("taskList");

const todayMinutes = document.getElementById("todayMinutes");
const weekMinutes = document.getElementById("weekMinutes");
const completionRate = document.getElementById("completionRate");


// ===================================
// アプリの状態
// ===================================

let tasks = [];
let currentFilter = "all";


// ===================================
// 日付取得
// ===================================

function getToday() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

taskDate.value = getToday();


// ===================================
// メッセージ表示
// ===================================

function showAuthMessage(message) {
  authMessage.textContent = message;
}


// ===================================
// 画面切り替え
// ===================================

function showLoginScreen() {
  authScreen.hidden = false;
  appContent.hidden = true;

  signupForm.hidden = false;
  googleLoginButton.hidden = false;
  logoutButton.hidden = true;
}

function showAppScreen(user) {
  authScreen.hidden = true;
  appContent.hidden = false;

  signupForm.hidden = true;
  googleLoginButton.hidden = true;
  logoutButton.hidden = true;

  console.log("ログイン中:", user.email);
}


// ===================================
// Firestoreのタスク保存先
// ===================================

function getTasksCollection(user) {
  return collection(db, "users", user.uid, "tasks");
}


// ===================================
// Firestoreからタスクを読み込む
// ===================================

async function loadTasks(user) {
  try {
    const snapshot = await getDocs(
      getTasksCollection(user)
    );

    // 読み込み中に別のユーザーへ
    // 切り替わっていないか確認
    if (auth.currentUser?.uid !== user.uid) return;

    tasks = snapshot.docs.map(document => ({
      ...document.data(),
      id: document.id
    }));

    renderTasks();
    updateStats();

  } catch (error) {
    console.error("タスク読み込みエラー:", error);

    alert("勉強記録を読み込めませんでした。");
  }
}


// ===================================
// Firestoreにタスクを保存
// ===================================

async function saveTaskToFirestore(task) {
  const user = auth.currentUser;

  if (!user) return;

  try {
    await setDoc(
      doc(db, "users", user.uid, "tasks", String(task.id)),
      task
    );

  } catch (error) {
    console.error("タスク保存エラー:", error);

    alert("勉強記録を保存できませんでした。");
  }
}


// ===================================
// Firestoreからタスクを削除
// ===================================

async function deleteTaskFromFirestore(taskId) {
  const user = auth.currentUser;

  if (!user) return;

  try {
    await deleteDoc(
      doc(db, "users", user.uid, "tasks", String(taskId))
    );

  } catch (error) {
    console.error("タスク削除エラー:", error);

    alert("タスクを削除できませんでした。");
  }
}


// ===================================
// 新規登録
// ===================================

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    showAuthMessage("アカウントを作成しています...");

    await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    showAuthMessage("新規登録が完了しました！");

  } catch (error) {
    console.error(error);

    showAuthMessage("新規登録に失敗しました。");

    alert("登録エラー：" + error.message);
  }
});


// ===================================
// メールアドレスでログイン
// ===================================

loginButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    alert("メールアドレスとパスワードを入力してください。");
    return;
  }

  try {
    showAuthMessage("ログインしています...");

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    showAuthMessage("ログインしました！");

  } catch (error) {
    console.error(error);

    showAuthMessage("ログインに失敗しました。");

    alert("ログインエラー：" + error.message);
  }
});


// ===================================
// Googleログイン
// ===================================

googleLoginButton.addEventListener("click", async () => {
  try {
    showAuthMessage("Googleログインしています...");

    await signInWithPopup(auth, googleProvider);

    showAuthMessage("Googleログインしました！");

  } catch (error) {
    console.error(error);

    showAuthMessage("Googleログインに失敗しました。");

    alert("Googleログインエラー：" + error.message);
  }
});


// ===================================
// ログアウト
// ===================================

async function logout() {
  try {
    await signOut(auth);

    alert("ログアウトしました！");

  } catch (error) {
    console.error(error);

    alert("ログアウトエラー：" + error.message);
  }
}

appLogoutButton.addEventListener("click", logout);

logoutButton.addEventListener("click", logout);


// ===================================
// ログイン状態の監視
// ===================================

onAuthStateChanged(auth, async (user) => {

  if (user) {

    showAppScreen(user);

    await loadTasks(user);

  } else {

    showLoginScreen();

    tasks = [];

    renderTasks();
    updateStats();

  }

});


// ===================================
// タスクを追加
// ===================================

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = auth.currentUser;

  if (!user) {
    alert("ログインしてください。");
    return;
  }

  const title = taskTitle.value.trim();
  const subject = taskSubject.value;
  const date = taskDate.value;
  const duration = Number(taskDuration.value);

  if (!title || !subject || !date || duration <= 0) {
    alert("すべての項目を正しく入力してください。");
    return;
  }

  const newTask = {
    id: Date.now().toString() + Math.random(),
    title,
    subject,
    date,
    duration,
    completed: false
  };

  await saveTaskToFirestore(newTask);

  if (auth.currentUser?.uid !== user.uid) return;

  tasks.push(newTask);

  renderTasks();
  updateStats();

  taskForm.reset();
  taskDate.value = getToday();

});


// ===================================
// タスクを表示
// ===================================

function renderTasks() {

  taskList.replaceChildren();

  const today = getToday();

  const filteredTasks = tasks.filter(task => {

    if (currentFilter === "today") {
      return task.date === today;
    }

    if (currentFilter === "upcoming") {
      return task.date > today && !task.completed;
    }

    if (currentFilter === "completed") {
      return task.completed;
    }

    return true;

  });

  if (filteredTasks.length === 0) {

    const message = document.createElement("p");

    message.textContent = "タスクはまだありません。";
    message.style.color = "#999";

    taskList.appendChild(message);

    return;
  }


  filteredTasks.forEach(task => {

    const item = document.createElement("div");

    item.className = "task-item";

    if (task.completed) {
      item.classList.add("completed");
    }


    // タスク情報
    const info = document.createElement("div");

    const title = document.createElement("h3");

    title.textContent = task.title;

    const detail = document.createElement("p");

    detail.textContent =
      `${task.subject} ｜ ${task.date} ｜ ${task.duration}分`;

    info.appendChild(title);
    info.appendChild(detail);


    // 完了チェック
    const checkbox = document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.checked = task.completed;

    checkbox.setAttribute("aria-label", "タスク完了");

    checkbox.addEventListener("change", async () => {

      const user = auth.currentUser;

      if (!user) return;

      const previousValue = task.completed;

      task.completed = checkbox.checked;

      renderTasks();
      updateStats();

      await saveTaskToFirestore(task);

      if (auth.currentUser?.uid !== user.uid) return;

      // 保存エラーが起きた場合は再読み込みで確認する
      // 保存状態の不一致を避けるため
      if (task.completed !== checkbox.checked) {
        task.completed = previousValue;
        renderTasks();
        updateStats();
      }

    });


    // 削除ボタン
    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.textContent = "削除";

    deleteButton.addEventListener("click", async () => {

      const confirmed = confirm(
        "このタスクを削除しますか？"
      );

      if (!confirmed) return;

      const user = auth.currentUser;

      if (!user) return;

      await deleteTaskFromFirestore(task.id);

      if (auth.currentUser?.uid !== user.uid) return;

      tasks = tasks.filter(t => t.id !== task.id);

      renderTasks();
      updateStats();

    });


    item.appendChild(info);
    item.appendChild(checkbox);
    item.appendChild(deleteButton);

    taskList.appendChild(item);

  });

}


// ===================================
// 今週の月曜日を取得
// ===================================

function getMonday() {

  const date = new Date();

  date.setHours(0, 0, 0, 0);

  const day = date.getDay();

  const difference = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + difference);

  return date;

}


// ===================================
// 勉強時間と達成率を更新
// ===================================

function updateStats() {

  const today = getToday();

  const monday = getMonday();


  // 今日の勉強時間
  const todayTotal = tasks

    .filter(task =>
      task.completed &&
      task.date === today
    )

    .reduce(
      (total, task) => total + task.duration,
      0
    );


  // 今週の勉強時間
  const weekTotal = tasks

    .filter(task => {

      const date = new Date(task.date + "T00:00:00");

      return (
        task.completed &&
        date >= monday &&
        date <= new Date(today + "T23:59:59")
      );

    })

    .reduce(
      (total, task) => total + task.duration,
      0
    );


  // 達成率
  const completedCount = tasks.filter(
    task => task.completed
  ).length;

  const rate = tasks.length === 0
    ? 0
    : Math.round(
        (completedCount / tasks.length) * 100
      );


  todayMinutes.textContent = todayTotal + "分";

  weekMinutes.textContent = weekTotal + "分";

  completionRate.textContent = rate + "%";

}


// ===================================
// フィルターボタン
// ===================================

document.querySelectorAll(".filters button").forEach(button => {

  button.addEventListener("click", () => {

    currentFilter = button.dataset.filter;

    renderTasks();

  });

});


// ===================================
// 初期表示
// ===================================

renderTasks();

updateStats();

console.log("Study Mate 起動完了！");
