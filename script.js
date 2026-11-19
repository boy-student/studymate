
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
  deleteDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  serverTimestamp
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


// ===================================
// 友達・勉強報告機能
// ===================================
const socialArea = document.getElementById("socialArea");
const bottomNavigation = document.getElementById("bottomNavigation");
const friendListEl = document.getElementById("friendList");
const incomingRequestsEl = document.getElementById("incomingRequests");
const friendCountEl = document.getElementById("friendCount");
const profilePanel = document.getElementById("friendProfilePanel");
const profileContent = document.getElementById("friendProfileContent");
const timelineListEl = document.getElementById("timelineList");
const myReportsListEl = document.getElementById("myReportsList");
let activeSocialPage = "friends";
let friendUnsubscribe = null;
let requestUnsubscribe = null;
let friendProfilesCache = new Map();

function pairId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}
function relativeTime(value) {
  if (!value) return "日時不明";
  const date = value.toDate ? value.toDate() : new Date(value);
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}
function showSocialPage(page) {
  activeSocialPage = page;
  document.querySelector(".container").hidden = page !== "home";
  socialArea.hidden = page === "home";
  bottomNavigation.hidden = false;
  document.querySelectorAll(".nav-item").forEach(button =>
    button.classList.toggle("active", button.dataset.page === page)
  );
  document.getElementById("friendsPanel").hidden = page !== "friends";
  document.getElementById("timelinePanel").hidden = page !== "timeline";
  document.getElementById("recordsPanel").hidden = page !== "records";
  profilePanel.hidden = true;
  document.getElementById("socialTitle").textContent =
    ({friends:"友達", timeline:"タイムライン", records:"記録"}[page] || "Study Mate");
  if (page === "timeline") loadFriendsTimeline();
  if (page === "records") loadMyReports();
}
document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => showSocialPage(button.dataset.page));
});
document.querySelectorAll(".social-tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".social-tab").forEach(b => b.classList.toggle("active", b === button));
    document.getElementById("friendsPanel").hidden = button.dataset.socialTab !== "friends";
    document.getElementById("groupsPanel").hidden = button.dataset.socialTab !== "groups";
  });
});

async function ensureUserProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const displayName = (user.displayName || prompt("Study Mateで表示する名前を入力してください") || "Study Mateユーザー").trim();
  let username = (prompt("ユーザーIDを入力してください（英数字と_、3〜20文字）") || `user_${user.uid.slice(0,8)}`)
    .trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0,20);
  if (username.length < 3) username = `user_${user.uid.slice(0,8)}`;
  const profile = {
    displayName: displayName.slice(0,30),
    username,
    photoURL: user.photoURL || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(ref, profile);
  return profile;
}

function renderFriendRow(profile, activity, onOpen) {
  const row = document.createElement("div");
  row.className = "friend-row";
  const avatar = document.createElement("div");
  avatar.className = "friend-avatar";
  avatar.textContent = (profile.displayName || "?").slice(0,1);
  const main = document.createElement("div");
  main.className = "friend-main";
  const name = document.createElement("strong");
  name.textContent = profile.displayName || "名前未設定";
  const detail = document.createElement("p");
  detail.textContent = activity ? `${activity.subject}を${activity.minutes}分勉強した${activity.comment ? "・" + activity.comment : ""}` : "まだ勉強報告がありません";
  main.append(name, detail);
  const time = document.createElement("span");
  time.className = "friend-time";
  time.textContent = activity ? relativeTime(activity.createdAt) : "";
  const open = document.createElement("button");
  open.className = "friend-open";
  open.type = "button";
  open.textContent = "見る";
  open.addEventListener("click", onOpen);
  row.append(avatar, main, time, open);
  return row;
}

function listenFriends(user) {
  if (friendUnsubscribe) friendUnsubscribe();
  const q = query(collection(db, "friendships"), where("members", "array-contains", user.uid), where("status", "==", "accepted"));
  friendUnsubscribe = onSnapshot(q, async snapshot => {
    friendListEl.replaceChildren();
    friendProfilesCache.clear();
    const docs = snapshot.docs;
    friendCountEl.textContent = `友達 ${docs.length}人`;
    if (!docs.length) {
      friendListEl.innerHTML = '<p class="empty-state">まだ友達がいません。「友達を検索」から追加してみよう！</p>';
      return;
    }
    for (const friendship of docs) {
      const data = friendship.data();
      const friendUid = data.members.find(uid => uid !== user.uid);
      if (!friendUid) continue;
      const userSnap = await getDoc(doc(db, "users", friendUid));
      if (!userSnap.exists()) continue;
      const profile = userSnap.data();
      friendProfilesCache.set(friendUid, profile);
      const records = await getDocs(query(collection(db, "users", friendUid, "studyRecords"), orderBy("createdAt", "desc"), limit(1)));
      const activity = records.empty ? null : {id:records.docs[0].id, ...records.docs[0].data()};
      friendListEl.appendChild(renderFriendRow(profile, activity, () => openFriendProfile(friendUid, profile)));
    }
  }, error => {
    console.error(error);
    friendListEl.textContent = "友達を読み込めませんでした。Firestoreルールを確認してください。";
  });

  if (requestUnsubscribe) requestUnsubscribe();
  const rq = query(collection(db, "friendships"), where("members", "array-contains", user.uid), where("status", "==", "pending"));
  requestUnsubscribe = onSnapshot(rq, async snapshot => {
    incomingRequestsEl.replaceChildren();
    if (snapshot.empty) {
      incomingRequestsEl.innerHTML = '<p class="empty-state">新しい申請はありません。</p>';
      return;
    }
    for (const requestDoc of snapshot.docs) {
      const data = requestDoc.data();
      if (data.recipientUid !== user.uid) continue;
      const senderSnap = await getDoc(doc(db, "users", data.requesterUid));
      const sender = senderSnap.exists() ? senderSnap.data() : {displayName:"ユーザー"};
      const row = document.createElement("div");
      row.className = "friend-row";
      const main = document.createElement("div");
      main.className = "friend-main";
      const title = document.createElement("strong");
      title.textContent = `${sender.displayName}さんから友達申請`;
      const actions = document.createElement("div");
      actions.className = "request-actions";
      const accept = document.createElement("button");
      accept.className = "accept";
      accept.textContent = "承認";
      accept.onclick = async () => updateDoc(requestDoc.ref, {status:"accepted", acceptedAt:serverTimestamp()});
      const reject = document.createElement("button");
      reject.textContent = "拒否";
      reject.onclick = async () => deleteDoc(requestDoc.ref);
      actions.append(accept, reject);
      main.append(title, actions);
      row.append(main);
      incomingRequestsEl.append(row);
    }
  });
}

async function searchAndRequestFriend() {
  const user = auth.currentUser;
  if (!user) return;
  const username = (prompt("追加したい相手のユーザーIDを入力してください") || "").trim().toLowerCase();
  if (!username) return;
  const found = await getDocs(query(collection(db, "users"), where("username", "==", username), limit(2)));
  if (found.empty) return alert("そのユーザーIDは見つかりませんでした。");
  const target = found.docs[0];
  if (target.id === user.uid) return alert("自分自身には申請できません。");
  const friendshipRef = doc(db, "friendships", pairId(user.uid, target.id));
  const existing = await getDoc(friendshipRef);
  if (existing.exists()) return alert("申請済み、または既に友達です。");
  await setDoc(friendshipRef, {
    members:[user.uid, target.id],
    requesterUid:user.uid,
    recipientUid:target.id,
    status:"pending",
    createdAt:serverTimestamp()
  });
  alert("友達申請を送信しました！");
}
document.getElementById("searchFriendButton").addEventListener("click", searchAndRequestFriend);
document.getElementById("addFriendButton").addEventListener("click", searchAndRequestFriend);

async function openFriendProfile(friendUid, profile) {
  document.getElementById("friendsPanel").hidden = true;
  profilePanel.hidden = false;
  document.getElementById("socialTitle").textContent = profile.displayName || "友達プロフィール";
  profileContent.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "profile-heading";
  const avatar = document.createElement("div");
  avatar.className = "friend-avatar";
  avatar.textContent = (profile.displayName || "?").slice(0,1);
  const nameBlock = document.createElement("div");
  const name = document.createElement("h2");
  name.textContent = profile.displayName || "名前未設定";
  const about = document.createElement("p");
  about.textContent = profile.bio || "プロフィール";
  nameBlock.append(name, about);
  heading.append(avatar, nameBlock);
  profileContent.append(heading);

  const tabs = document.createElement("div");
  tabs.className = "profile-subtabs";
  ["記録","タイムライン","予定","プロフィール"].forEach(label => {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = () => showFriendSection(friendUid, profile, label, content);
    tabs.append(b);
  });
  const content = document.createElement("div");
  profileContent.append(tabs, content);
  await showFriendSection(friendUid, profile, "タイムライン", content);
}
async function showFriendSection(friendUid, profile, section, container) {
  container.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = section;
  container.append(heading);
  if (section === "プロフィール") {
    const p = document.createElement("p");
    p.textContent = profile.bio || "自己紹介はまだありません。";
    container.append(p);
    return;
  }
  if (section === "予定") {
    container.innerHTML = '<p class="empty-state">共有予定機能は次の段階で追加します。</p>';
    return;
  }
  const path = section === "記録" ? "studyRecords" : "studyRecords";
  const q = query(collection(db, "users", friendUid, path), orderBy("createdAt", "desc"), limit(30));
  const snap = await getDocs(q);
  if (snap.empty) {
    container.innerHTML = '<p class="empty-state">まだ勉強報告がありません。</p>';
    return;
  }
  snap.forEach(d => {
    const data = d.data();
    const card = document.createElement("article");
    card.className = "timeline-card";
    const strong = document.createElement("strong");
    strong.textContent = `${profile.displayName}：${data.subject}を${data.minutes}分勉強`;
    const p = document.createElement("p");
    p.textContent = data.comment || "勉強を頑張りました！";
    const small = document.createElement("small");
    small.textContent = relativeTime(data.createdAt);
    card.append(strong,p,small);
    container.append(card);
  });
}
document.getElementById("backToFriendsButton").addEventListener("click", () => {
  profilePanel.hidden = true;
  document.getElementById("friendsPanel").hidden = false;
  document.getElementById("socialTitle").textContent = "友達";
});

async function loadFriendsTimeline() {
  const user = auth.currentUser;
  if (!user) return;
  timelineListEl.replaceChildren();
  const friendships = await getDocs(query(collection(db, "friendships"), where("members", "array-contains", user.uid), where("status", "==", "accepted")));
  for (const friendship of friendships.docs) {
    const friendUid = friendship.data().members.find(uid => uid !== user.uid);
    const profileSnap = await getDoc(doc(db, "users", friendUid));
    if (!profileSnap.exists()) continue;
    const profile = profileSnap.data();
    const records = await getDocs(query(collection(db, "users", friendUid, "studyRecords"), orderBy("createdAt", "desc"), limit(20)));
    records.forEach(record => {
      const d = record.data();
      const card = document.createElement("article");
      card.className = "timeline-card";
      const strong = document.createElement("strong");
      strong.textContent = `${profile.displayName}：${d.subject}を${d.minutes}分勉強`;
      const p = document.createElement("p");
      p.textContent = d.comment || "勉強を頑張りました！";
      const small = document.createElement("small");
      small.textContent = relativeTime(d.createdAt);
      card.append(strong,p,small);
      timelineListEl.append(card);
    });
  }
  if (!timelineListEl.children.length) timelineListEl.innerHTML = '<p class="empty-state">友達の勉強報告はまだありません。</p>';
}

document.getElementById("studyReportForm").addEventListener("submit", async event => {
  event.preventDefault();
  const user = auth.currentUser;
  if (!user) return;
  const subject = document.getElementById("reportSubject").value.trim();
  const minutes = Number(document.getElementById("reportMinutes").value);
  const comment = document.getElementById("reportComment").value.trim();
  if (!subject || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return alert("教科と勉強時間を正しく入力してください。");
  await setDoc(doc(collection(db, "users", user.uid, "studyRecords")), {
    subject, minutes, comment, createdAt:serverTimestamp()
  });
  event.target.reset();
  alert("勉強報告を投稿しました！");
  loadMyReports();
  if (activeSocialPage === "friends") listenFriends(auth.currentUser);
});
async function loadMyReports() {
  const user = auth.currentUser;
  if (!user) return;
  myReportsListEl.replaceChildren();
  const snap = await getDocs(query(collection(db, "users", user.uid, "studyRecords"), orderBy("createdAt", "desc"), limit(30)));
  if (snap.empty) {
    myReportsListEl.innerHTML = '<p class="empty-state">まだ勉強報告がありません。</p>';
    return;
  }
  snap.forEach(d => {
    const data = d.data();
    const card = document.createElement("article");
    card.className = "timeline-card";
    const strong = document.createElement("strong");
    strong.textContent = `${data.subject}を${data.minutes}分勉強`;
    const p = document.createElement("p");
    p.textContent = data.comment || "勉強を頑張りました！";
    const small = document.createElement("small");
    small.textContent = relativeTime(data.createdAt);
    card.append(strong,p,small);
    myReportsListEl.append(card);
  });
}

// ログイン後にプロフィールと友達情報を準備
const originalShowAppScreen = showAppScreen;
showAppScreen = function(user) {
  originalShowAppScreen(user);
  showSocialPage("friends");
  ensureUserProfile(user).then(() => listenFriends(user)).catch(error => {
    console.error("プロフィール準備エラー:", error);
    alert("プロフィールの準備に失敗しました。Firestoreのルールを確認してください。");
  });
};
