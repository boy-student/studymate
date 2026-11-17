
// ===================================
// Study Mate JavaScript
// ===================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";

import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Firebaseの設定
const firebaseConfig = {
  apiKey: "AIzaSyAw08btPXXb-272OtJC1nONUGPuKdQAEMA",
  authDomain: "study-mate-88d68.firebaseapp.com",
  projectId: "study-mate-88d68",
  storageBucket: "study-mate-88d68.firebasestorage.app",
  messagingSenderId: "30413754364",
  appId: "1:30413754364:web:5a7258b22bef204cc16c79",
  measurementId: "G-RB2LNMJ3M4"
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// ログイン機能
const auth = getAuth(app);

// Googleログイン
const googleProvider = new GoogleAuthProvider();

// データベース
const db = getFirestore(app);

// ===================================
// HTMLの要素を取得
// ===================================

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
// 今日の日付を取得
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
// タスクの読み込みと保存
// ===================================

let tasks = JSON.parse(
  localStorage.getItem("studyMateTasks") || "[]"
);

let currentFilter = "all";

function saveTasks() {
  localStorage.setItem(
    "studyMateTasks",
    JSON.stringify(tasks)
  );
}

// ===================================
// タスクを追加
// ===================================

taskForm.addEventListener("submit", function(event) {
  event.preventDefault();

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
    title: title,
    subject: subject,
    date: date,
    duration: duration,
    completed: false
  };

  tasks.push(newTask);

  saveTasks();
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

  let filteredTasks = tasks.filter(function(task) {
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

  filteredTasks.forEach(function(task) {
    const item = document.createElement("div");
    item.className = "task-item";

    if (task.completed) {
      item.classList.add("completed");
    }

    const info = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = task.title;

    const detail = document.createElement("p");
    detail.textContent =
      `${task.subject} ｜ ${task.date} ｜ ${task.duration}分`;

    info.appendChild(title);
    info.appendChild(detail);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", "タスク完了");

    checkbox.addEventListener("change", function() {
      task.completed = checkbox.checked;

      saveTasks();
      renderTasks();
      updateStats();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "削除";

    deleteButton.addEventListener("click", function() {
      const confirmed = confirm("このタスクを削除しますか？");

      if (confirmed) {
        tasks = tasks.filter(function(t) {
          return t.id !== task.id;
        });

        saveTasks();
        renderTasks();
        updateStats();
      }
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

  const todayTotal = tasks
    .filter(task =>
      task.completed && task.date === today
    )
    .reduce((total, task) => total + task.duration, 0);

  const weekTotal = tasks
    .filter(task => {
      const date = new Date(task.date + "T00:00:00");

      return (
        task.completed &&
        date >= monday &&
        date <= new Date(today + "T23:59:59")
      );
    })
    .reduce((total, task) => total + task.duration, 0);

  const completedCount = tasks.filter(
    task => task.completed
  ).length;

  const rate = tasks.length === 0
    ? 0
    : Math.round((completedCount / tasks.length) * 100);

  todayMinutes.textContent = todayTotal + "分";
  weekMinutes.textContent = weekTotal + "分";
  completionRate.textContent = rate + "%";
}

// ===================================
// フィルターボタン
// ===================================

document.querySelectorAll(".filters button").forEach(function(button) {
  button.addEventListener("click", function() {
    currentFilter = button.dataset.filter;
    renderTasks();
  });
});

// ===================================
// 最初の画面を表示
// ===================================

renderTasks();
updateStats();
