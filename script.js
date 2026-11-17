
// Study Mate JavaScript

// HTMLの要素を取得
const taskForm = document.getElementById("taskForm");
const taskTitle = document.getElementById("taskTitle");
const taskSubject = document.getElementById("taskSubject");
const taskDate = document.getElementById("taskDate");
const taskDuration = document.getElementById("taskDuration");
const taskList = document.getElementById("taskList");

const todayMinutes = document.getElementById("todayMinutes");
const weekMinutes = document.getElementById("weekMinutes");
const completionRate = document.getElementById("completionRate");

// 今日の日付を取得
function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// 今日の日付を初期設定
taskDate.value = getToday();

// 保存されたタスクを読み込む
let tasks = JSON.parse(
  localStorage.getItem("studyMateTasks") || "[]"
);

// 現在の表示フィルター
let currentFilter = "all";

// タスクを保存する
function saveTasks() {
  localStorage.setItem(
    "studyMateTasks",
    JSON.stringify(tasks)
  );
}

// タスクを追加する
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

// タスクを表示する
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

    // タスクの情報
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

    checkbox.addEventListener("change", function() {
      task.completed = checkbox.checked;

      saveTasks();
      renderTasks();
      updateStats();
    });

    // 削除ボタン
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

// 今週の月曜日を取得
function getMonday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  const day = date.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + difference);

  return date;
}

// 勉強時間と達成率を更新
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

// フィルターボタン
document.querySelectorAll(".filters button").forEach(function(button) {
  button.addEventListener("click", function() {
    currentFilter = button.dataset.filter;
    renderTasks();
  });
});

// 最初の画面を表示
renderTasks();
updateStats();
