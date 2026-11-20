// ===================================
// Study Mate JavaScript
// Firebase Auth / Firestore / Study Records
// ===================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, getDoc, query, where, orderBy, limit, onSnapshot, updateDoc, serverTimestamp, startAt, endAt } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAw08btPXXb-272OtJC1nONUGPuKdQAEMA",
  authDomain: "study-mate-88d68.firebaseapp.com",
  projectId: "study-mate-88d68",
  storageBucket: "study-mate-88d68.firebasestorage.app",
  messagingSenderId: "30413754364",
  appId: "1:30413754364:web:5a7258b22bef204cc16c79",
  measurementId: "G-RB2LNMJ3M4"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const $ = id => document.getElementById(id);
const authScreen = $("authScreen");
const appContent = $("appContent");
const signupForm = $("signupForm");
const emailInput = $("email");
const passwordInput = $("password");
const passwordConfirmInput = $("passwordConfirm");
const profileSetupScreen = $("profileSetupScreen");
const profileSetupForm = $("profileSetupForm");
const loginButton = $("loginButton");
const googleLoginButton = $("googleLoginButton");
const logoutButton = $("logoutButton");
const appLogoutButton = $("appLogoutButton");
const authMessage = $("authMessage");

function showAuthMessage(message) { authMessage.textContent = message; }
function showLoginScreen() {
  authScreen.hidden = false;
  profileSetupScreen.hidden = true;
  appContent.hidden = true;
  signupForm.hidden = false;
  googleLoginButton.hidden = false;
  logoutButton.hidden = true;
}
function showProfileSetupScreen(user) {
  authScreen.hidden = true;
  profileSetupScreen.hidden = false;
  appContent.hidden = true;
  $("setupDisplayName").value = user.displayName || "";
  $("setupBio").value = "";
  $("setupPrivate").checked = false;
  const avatar = $("setupAvatar");
  avatar.replaceChildren();
  if (user.photoURL) {
    const img = document.createElement("img"); img.src = user.photoURL; img.alt = "プロフィール画像"; avatar.append(img);
  } else avatar.textContent = (user.displayName || "S").slice(0, 1);
  $("profileSetupMessage").textContent = "";
}
function showAppScreen() {
  authScreen.hidden = true;
  profileSetupScreen.hidden = true;
  appContent.hidden = false;
  signupForm.hidden = true;
  googleLoginButton.hidden = true;
  logoutButton.hidden = true;
}
function logout() { return signOut(auth).catch(error => { console.error(error); alert("ログアウトできませんでした。"); }); }
appLogoutButton.addEventListener("click", logout);
logoutButton.addEventListener("click", logout);

signupForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (passwordInput.value !== passwordConfirmInput.value) {
    alert("確認用パスワードが一致していません。"); return;
  }
  try {
    showAuthMessage("アカウントを作成しています...");
    await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    showAuthMessage("アカウントを作成しました。プロフィールを設定してください。");
  } catch (error) {
    console.error(error); showAuthMessage("新規登録に失敗しました。"); alert("登録エラー：" + error.message);
  }
});
profileSetupForm.addEventListener("submit", async event => {
  event.preventDefault();
  const user = auth.currentUser;
  if (!user) return;
  const displayName = $("setupDisplayName").value.trim();
  if (!displayName) { alert("ユーザーネームを入力してください。"); return; }
  const bio = $("setupBio").value.trim().slice(0, 120);
  const isPrivate = $("setupPrivate").checked;
  const button = $("finishProfileSetupButton");
  button.disabled = true;
  $("profileSetupMessage").textContent = "プロフィールを保存しています...";
  try {
    const profile = {
      displayName: displayName.slice(0, 30), bio,
      photoURL: user.photoURL || "", isPrivate,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, "users", user.uid), profile, { merge: true });
    await setDoc(doc(db, "profileDirectory", user.uid), {
      displayName: profile.displayName, photoURL: profile.photoURL,
      isPrivate, updatedAt: serverTimestamp()
    }, { merge: true });
    showAppScreen();
    await ensureUserProfile(user);
    await Promise.all([loadStudyRecords(), loadWeeklyGoal(), loadMyProfileSettings()]);
    showSocialPage("home");
  } catch (error) {
    console.error("プロフィール設定エラー", error);
    $("profileSetupMessage").textContent = "保存できませんでした。通信状態とFirestoreルールを確認してください。";
    alert("プロフィールを保存できませんでした。もう一度お試しください。");
  } finally { button.disabled = false; }
});
$("setupLogoutButton").addEventListener("click", logout);

loginButton.addEventListener("click", async () => {
  if (!emailInput.value.trim() || !passwordInput.value) return alert("メールアドレスとパスワードを入力してください。");
  try { showAuthMessage("ログインしています..."); await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value); }
  catch (error) { console.error(error); showAuthMessage("ログインに失敗しました。"); alert("ログインエラー：" + error.message); }
});
googleLoginButton.addEventListener("click", async () => {
  try { showAuthMessage("Googleログインしています..."); await signInWithPopup(auth, googleProvider); }
  catch (error) { console.error(error); showAuthMessage("Googleログインに失敗しました。"); alert("Googleログインエラー：" + error.message); }
});

// 日本時間（Asia/Tokyo）の日付処理
function tokyoDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(date);
  const v = Object.fromEntries(parts.map(p => [p.type,p.value]));
  return `${v.year}-${v.month}-${v.day}`;
}
function dateFromKey(key) { return new Date(`${key}T00:00:00Z`); }
function mondayKeyFor(date = new Date()) {
  const d = dateFromKey(tokyoDateKey(date));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}
function addDays(key, amount) {
  const d = dateFromKey(key); d.setUTCDate(d.getUTCDate()+amount);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}
function formatDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60), m = totalMinutes % 60;
  return `${h}時間${String(m).padStart(2,"0")}分`;
}
function timestampDate(value) {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
}
function dateKeyFromTimestamp(value) {
  const d = timestampDate(value);
  return d && !Number.isNaN(d.getTime()) ? tokyoDateKey(d) : null;
}

// 勉強記録（手入力・タイマー共通）
let studyRecords = [];
let recordUnsubscribe = null;
async function saveStudyRecord({subject, minutes, comment = ""}) {
  const user = auth.currentUser;
  if (!user) throw new Error("ログインしてください。");
  if (!subject || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new Error("教科と勉強時間を正しく入力してください。");
  await setDoc(doc(collection(db, "users", user.uid, "studyRecords")), {
    subject: subject.trim(), minutes, comment: comment.trim(), createdAt: serverTimestamp()
  });
  await loadStudyRecords();
}
async function loadStudyRecords() {
  const user = auth.currentUser; if (!user) return;
  const snap = await getDocs(query(collection(db, "users", user.uid, "studyRecords"), orderBy("createdAt", "desc")));
  if (auth.currentUser?.uid !== user.uid) return;
  studyRecords = snap.docs.map(d => ({id:d.id, ...d.data()}));
  renderRecordsPage();
}

// ホーム：手入力フォーム
$("studyEntryForm").addEventListener("submit", async event => {
  event.preventDefault();
  const subject = $("entrySubject").value.trim();
  const hours = Number($("entryHours").value);
  const minutesPart = Number($("entryMinutes").value);
  const total = hours * 60 + minutesPart;
  if (!subject) return alert("教科を入力してください。");
  if (!Number.isInteger(hours) || hours < 0 || hours > 24 || !Number.isInteger(minutesPart) || minutesPart < 0 || minutesPart > 59 || total < 1 || total > 1440) return alert("勉強時間は0〜24時間、分は0〜59分で入力してください（合計24時間以内）。");
  try {
    await saveStudyRecord({subject, minutes:total, comment:$("entryComment").value});
    event.target.reset(); $("entryHours").value = 0; $("entryMinutes").value = 0;
    alert("勉強記録を保存しました！");
  } catch (error) { console.error(error); alert("記録を保存できませんでした。Firestoreルールを確認してください。"); }
});

// ホーム：タイマー
let timerStartedAt = null;
let timerElapsedBeforePause = 0;
let timerInterval = null;
function elapsedTimerMs() { return timerElapsedBeforePause + (timerStartedAt ? Date.now() - timerStartedAt : 0); }
function updateTimerDisplay() {
  const seconds = Math.floor(elapsedTimerMs()/1000);
  const h = Math.floor(seconds/3600), m = Math.floor((seconds%3600)/60), s = seconds%60;
  $("timerDisplay").textContent = [h,m,s].map(v=>String(v).padStart(2,"0")).join(":");
}
function setTimerButtons(running, hasStarted) {
  $("timerStartButton").disabled = running;
  $("timerPauseButton").disabled = !running;
  $("timerStopButton").disabled = !hasStarted;
  $("timerStartButton").textContent = hasStarted && !running ? "再開" : "スタート";
}
$("timerStartButton").addEventListener("click", () => {
  if (!$("timerSubject").value.trim()) return alert("タイマーを始める前に教科を入力してください。");
  if (!timerStartedAt) timerStartedAt = Date.now();
  timerInterval = setInterval(updateTimerDisplay, 250);
  $("timerStatus").textContent = "勉強時間を計測中...";
  setTimerButtons(true, true);
});
$("timerPauseButton").addEventListener("click", () => {
  if (!timerStartedAt) return;
  timerElapsedBeforePause += Date.now() - timerStartedAt; timerStartedAt = null;
  clearInterval(timerInterval); updateTimerDisplay();
  $("timerStatus").textContent = "一時停止中"; setTimerButtons(false, true);
});
$("timerStopButton").addEventListener("click", async () => {
  const elapsed = elapsedTimerMs();
  const minutes = Math.max(1, Math.round(elapsed/60000));
  if (elapsed < 1000) return alert("勉強時間が短すぎるため保存できません。");
  if (minutes > 1440) return alert("1回の勉強記録は24時間以内にしてください。");
  clearInterval(timerInterval); timerInterval = null; timerStartedAt = null; timerElapsedBeforePause = 0;
  try {
    await saveStudyRecord({subject:$("timerSubject").value.trim(), minutes});
    $("timerDisplay").textContent = "00:00:00"; $("timerStatus").textContent = "記録を保存しました！";
    $("timerSubject").value = ""; setTimerButtons(false, false); alert(`${formatDuration(minutes)}を保存しました！`);
  } catch (error) { console.error(error); $("timerStatus").textContent = "保存に失敗しました"; alert("タイマー記録を保存できませんでした。"); }
});

// 週目標：月曜に一度だけ設定。Firestore文書は更新不可の想定
let currentGoal = null;
let goalDocId = "";
let goalModalOpen = false;
const subjectColors = ["#8060D5","#E89AB9","#63B69C","#E4B65C","#6EA8D9","#E58A70","#9B8ABF","#8BB9C8","#B7A36A","#A0A0A0"];
function colorForSubject(subject) {
  let hash = 0;
  for (const char of subject) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return subjectColors[hash % subjectColors.length];
}
function currentWeekIsMonday() { return new Date().toLocaleString("en-US", {timeZone:"Asia/Tokyo", weekday:"short"}) === "Mon"; }
async function loadWeeklyGoal() {
  const user = auth.currentUser; if (!user) return;
  goalDocId = mondayKeyFor(new Date());
  const ref = doc(db, "users", user.uid, "weeklyGoals", goalDocId);
  const snap = await getDoc(ref);
  currentGoal = snap.exists() ? snap.data() : null;
  updateGoalCard();
}
function updateGoalCard() {
  const monday = currentWeekIsMonday();
  const canSet = monday && !currentGoal;
  const hasGoal = Boolean(currentGoal);
  const target = hasGoal ? Number(currentGoal.goalMinutes) : 0;
  const weekStart = mondayKeyFor(new Date());
  const weekEnd = addDays(weekStart, 7);
  const total = studyRecords.reduce((sum,r) => {
    const key = dateKeyFromTimestamp(r.createdAt);
    return key && key >= weekStart && key < weekEnd ? sum + Number(r.minutes || 0) : sum;
  },0);
  const percent = target > 0 ? Math.round(total/target*100) : 0;
  $("goalPercent").textContent = hasGoal ? `${percent}%` : "目標未設定";
  $("goalCurrentTime").textContent = formatDuration(total);
  $("goalTargetTime").textContent = hasGoal ? `目標：${formatDuration(target)}` : "目標：未設定";
  $("goalProgressFill").style.width = `${Math.min(100, percent)}%`;
  $("goalMessage").textContent = hasGoal ? (target === 0 ? "今週の目標は00時間00分です。" : percent >= 100 ? "今週の目標を達成しました！" : `あと${formatDuration(Math.max(0,target-total))}で目標達成！`) : (canSet ? "タップして今週の目標を設定できます。" : "次の月曜日に目標を設定できます。");
  $("goalCardAction").textContent = canSet ? "タップして設定" : currentGoal ? "設定済み・変更不可" : "月曜日に設定可能";
  $("goalLockIcon").textContent = canSet ? "›" : "🔒";
  $("goalCard").setAttribute("aria-label", canSet ? "今週の目標を設定" : "今週の目標と次回設定日を確認");
  const homeGoalValue = $("homeGoalValue");
  const homeGoalProgress = $("homeGoalProgress");
  if (homeGoalValue && homeGoalProgress) {
    homeGoalValue.textContent = hasGoal ? `今週の目標：${formatDuration(target)}` : "今週の目標：未設定";
    homeGoalProgress.textContent = hasGoal ? `現在 ${formatDuration(total)} 勉強しています ・ 達成率 ${percent}%` : (canSet ? "タップして今週の目標を設定しよう" : "次の月曜日に目標を設定できます");
  }
}
function makeWheelOptions(container, max, selected) {
  container.replaceChildren();
  for (let i=0;i<=max;i++) {
    const option=document.createElement("div"); option.className="wheel-option"; option.textContent=String(i).padStart(2,"0"); option.dataset.value=String(i);
    container.append(option);
  }
  scrollWheelTo(container, selected);
}
function scrollWheelTo(container, value) { container.scrollTop = value*44; updateWheelSelected(container); }
function updateWheelSelected(container) {
  const selected=Math.max(0,Math.min(Number(container.dataset.max),Math.round(container.scrollTop/44)));
  container.querySelectorAll(".wheel-option").forEach((el,i)=>el.classList.toggle("selected",i===selected));
  container.dataset.value=String(selected);
}
function createGoalModal() {
  if ($("goalModalBackdrop")) return;
  const backdrop=document.createElement("div"); backdrop.id="goalModalBackdrop"; backdrop.className="goal-modal-backdrop"; backdrop.hidden=true;
  backdrop.innerHTML=`<section class="goal-modal" role="dialog" aria-modal="true" aria-labelledby="goalModalTitle"><h3 id="goalModalTitle">今週の目標を設定</h3><p>上下にスワイプして、今週の目標時間を決めよう。</p><div class="wheel-picker"><div class="wheel-group"><span class="wheel-label">時間</span><div id="goalHoursWheel" class="wheel-column" tabindex="0" aria-label="時間"></div></div><div class="wheel-group"><span class="wheel-label">分</span><div id="goalMinutesWheel" class="wheel-column" tabindex="0" aria-label="分"></div></div></div><div class="goal-modal-actions"><button type="button" id="goalCancel" class="goal-modal-cancel">キャンセル</button><button type="button" id="goalSave" class="goal-modal-save">この目標に決定</button></div></section>`;
  document.body.append(backdrop);
  makeWheelOptions($("goalHoursWheel"),168,0); makeWheelOptions($("goalMinutesWheel"),59,0);
  [$("goalHoursWheel"),$("goalMinutesWheel")].forEach(el=>{
    el.dataset.max=el.id==="goalHoursWheel"?"168":"59";
    el.addEventListener("scroll",()=>{updateWheelSelected(el); if(el.id==="goalHoursWheel") updateMinuteWheelAvailability();},{passive:true});
    el.addEventListener("keydown",event=>{if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();const delta=event.key==="ArrowDown"?1:-1;const next=Math.max(0,Math.min(Number(el.dataset.max),Number(el.dataset.value||0)+delta));scrollWheelTo(el,next);if(el.id==="goalHoursWheel")updateMinuteWheelAvailability();}});
  });
  $("goalCancel").addEventListener("click",closeGoalModal);
  backdrop.addEventListener("click",event=>{if(event.target===backdrop)closeGoalModal();});
  $("goalSave").addEventListener("click",saveWeeklyGoal);
}
function updateMinuteWheelAvailability() {
  const isMax=Number($("goalHoursWheel").dataset.value||0)===168;
  $("goalMinutesWheel").classList.toggle("is-disabled",isMax);
  if(isMax) scrollWheelTo($("goalMinutesWheel"),0);
}
function openGoalModal() {
  if (!currentWeekIsMonday() || currentGoal) return;
  createGoalModal(); goalModalOpen=true; $("goalModalBackdrop").hidden=false;
  scrollWheelTo($("goalHoursWheel"),0); scrollWheelTo($("goalMinutesWheel"),0); updateMinuteWheelAvailability();
}
function closeGoalModal() { if($("goalModalBackdrop")) $("goalModalBackdrop").hidden=true; goalModalOpen=false; }
$("goalCard").addEventListener("click",()=>{
  if(currentGoal){alert(`今週の目標は${formatDuration(currentGoal.goalMinutes)}です。次回は次の月曜日に設定できます。`);return;}
  if(!currentWeekIsMonday()){alert("今週の目標は月曜日のみ設定できます。次の月曜日に設定してください。");return;}
  openGoalModal();
});
async function saveWeeklyGoal() {
  const user=auth.currentUser; if(!user || !currentWeekIsMonday() || currentGoal) return;
  const hours=Number($("goalHoursWheel").dataset.value||0);
  const minutes=hours===168?0:Number($("goalMinutesWheel").dataset.value||0);
  const goalMinutes=hours*60+minutes;
  const weekStart=mondayKeyFor(new Date());
  try {
    await setDoc(doc(db,"users",user.uid,"weeklyGoals",weekStart),{goalMinutes,weekStart,createdAt:serverTimestamp()});
    currentGoal={goalMinutes,weekStart}; closeGoalModal(); updateGoalCard();
  } catch(error) { console.error(error); alert("目標を保存できませんでした。Firestoreルールを更新してください。"); }
}

// グラフ集計
let chartPeriod="week", chartUnit="hours", periodOffset=0, selectedChartIndex=null;
function shiftMonth(year,month,offset){const d=new Date(Date.UTC(year,month+offset,1));return {year:d.getUTCFullYear(),month:d.getUTCMonth()};}
function getChartRange() {
  const nowKey=tokyoDateKey();
  if(chartPeriod==="week") { const monday=addDays(mondayKeyFor(new Date()),periodOffset*7); return {start:monday,end:addDays(monday,7),label:periodOffset===0?"今週":`${monday}の週`}; }
  if(chartPeriod==="month") { const [y,m]=nowKey.split("-").map(Number); const d=shiftMonth(y,m-1,periodOffset); const start=`${d.year}-${String(d.month+1).padStart(2,"0")}-01`; const next=shiftMonth(d.year,d.month,1); const end=`${next.year}-${String(next.month+1).padStart(2,"0")}-01`; return {start,end,label:`${d.year}年${d.month+1}月`}; }
  const year=Number(nowKey.slice(0,4))+periodOffset; return {start:`${year}-01-01`,end:`${year+1}-01-01`,label:`${year}年`};
}
function aggregateRecords(start,end) {
  const map=new Map();
  studyRecords.forEach(r=>{const key=dateKeyFromTimestamp(r.createdAt); if(!key||key<start||key>=end)return; const subject=r.subject||"その他"; map.set(subject,(map.get(subject)||0)+Number(r.minutes||0));});
  return map;
}
function getChartBuckets(range) {
  const buckets=[];
  if(chartPeriod==="week") { for(let i=0;i<7;i++){const key=addDays(range.start,i);buckets.push({key,label:["月","火","水","木","金","土","日"][i]});} }
  else if(chartPeriod==="month") { const days=Math.round((dateFromKey(range.end)-dateFromKey(range.start))/86400000); for(let i=0;i<days;i++){const key=addDays(range.start,i);buckets.push({key,label:String(i+1)});} }
  else { for(let i=0;i<12;i++){const key=`${range.start.slice(0,4)}-${String(i+1).padStart(2,"0")}-01`;buckets.push({key,label:`${i+1}月`,month:true});} }
  return buckets;
}
function renderChart() {
  const range=getChartRange(); $("chartPeriodLabel").textContent=range.label;
  $("chartDetail").textContent = "棒グラフをタップすると詳細を確認できます。";
  const buckets=getChartBuckets(range); const subjects=[...new Set(studyRecords.map(r=>r.subject||"その他"))];
  const datasets=buckets.map(bucket=>{
    const totals=new Map(); studyRecords.forEach(r=>{const key=dateKeyFromTimestamp(r.createdAt);let match=false;if(chartPeriod==="year")match=key?.startsWith(bucket.key.slice(0,7));else match=key===bucket.key;if(match){const sub=r.subject||"その他";totals.set(sub,(totals.get(sub)||0)+Number(r.minutes||0));}});return {bucket,totals,total:[...totals.values()].reduce((a,b)=>a+b,0)};
  });
  const max=Math.max(1,...datasets.map(d=>d.total)); const chart=$("stackedChart"); chart.replaceChildren();
  datasets.forEach((d,index)=>{
    const col=document.createElement("button"); col.type="button"; col.className="chart-column"; if(selectedChartIndex===index)col.classList.add("selected");
    const bar=document.createElement("span"); bar.className="chart-bar";
    subjects.forEach((subject,si)=>{const value=d.totals.get(subject)||0;if(!value)return;const seg=document.createElement("span");seg.className="chart-segment";seg.style.height=`${value/max*100}%`;seg.style.background=colorForSubject(subject);bar.append(seg);});
    const label=document.createElement("span");label.className="chart-label";label.textContent=d.bucket.label;col.append(bar,label);
    col.addEventListener("click",()=>{selectedChartIndex=index;renderChart();const details=[...d.totals.entries()].sort((a,b)=>b[1]-a[1]);$("chartDetail").textContent=details.length?`${d.bucket.key}：${details.map(([s,v])=>`${s} ${formatChartValue(v)}`).join(" / ")}（合計 ${formatChartValue(d.total)}）`:`${d.bucket.key}：勉強記録はありません。`;});
    chart.append(col);
  });
  const legend=$("chartLegend");legend.replaceChildren();subjects.forEach(subject=>{const item=document.createElement("span");item.className="legend-item";const dot=document.createElement("i");dot.className="legend-dot";dot.style.background=colorForSubject(subject);const name=document.createElement("span");name.textContent=subject;item.append(dot,name);legend.append(item);});
  if(!subjects.length){chart.innerHTML='<p class="empty-summary">勉強記録がまだありません。</p>';$("chartDetail").textContent="勉強を記録するとグラフが表示されます。";}
  const rangeTotals=aggregateRecords(range.start,range.end);const total=[...rangeTotals.values()].reduce((a,b)=>a+b,0);const summary=$("subjectSummary");summary.replaceChildren();$("subjectSummaryPeriod").textContent=`${range.label}の教科別合計`;
  [...rangeTotals.entries()].sort((a,b)=>b[1]-a[1]).forEach(([subject,value])=>{const row=document.createElement("div");row.className="subject-summary-row";const top=document.createElement("div");top.className="subject-summary-top";const name=document.createElement("strong");name.textContent=subject;const val=document.createElement("span");val.textContent=`${formatChartValue(value)}（${total?Math.round(value/total*100):0}%）`;top.append(name,val);const track=document.createElement("div");track.className="subject-progress-track";const fill=document.createElement("div");fill.className="subject-progress-fill";fill.style.width=`${total?value/total*100:0}%`;fill.style.background=colorForSubject(subject);track.append(fill);row.append(top,track);summary.append(row);});
  if(!rangeTotals.size)summary.innerHTML='<p class="empty-summary">この期間の勉強記録はまだありません。</p>';
  $("nextPeriod").disabled=periodOffset>=0;
}
function formatChartValue(minutes){return chartUnit==="hours"?`${(minutes/60).toFixed(1)}時間`:`${minutes}分`;}
function renderRecordsPage(){
  const thisMonday = mondayKeyFor(new Date());
  if (goalDocId && goalDocId !== thisMonday) loadWeeklyGoal();
  updateGoalCard();
  renderChart();
}
$("periodControls").addEventListener("click",event=>{const b=event.target.closest("button[data-period]");if(!b)return;chartPeriod=b.dataset.period;periodOffset=0;selectedChartIndex=null;document.querySelectorAll("#periodControls button").forEach(x=>x.classList.toggle("active",x===b));renderChart();});
$("unitControls").addEventListener("click",event=>{const b=event.target.closest("button[data-unit]");if(!b)return;chartUnit=b.dataset.unit;document.querySelectorAll("#unitControls button").forEach(x=>x.classList.toggle("active",x===b));renderChart();});
$("previousPeriod").addEventListener("click",()=>{periodOffset--;selectedChartIndex=null;renderChart();});
$("nextPeriod").addEventListener("click",()=>{if(periodOffset<0)periodOffset++;selectedChartIndex=null;renderChart();});

const socialArea = document.getElementById("socialArea");
const bottomNavigation = document.getElementById("bottomNavigation");
const friendListEl = document.getElementById("friendList");
const friendCountEl = document.getElementById("friendCount");
const profilePanel = document.getElementById("friendProfilePanel");
const profileContent = document.getElementById("friendProfileContent");
const timelineListEl = document.getElementById("timelineList");
let activeSocialPage = "home";
let followUnsubscribe = null;
let currentProfile = null;
let scanStream = null;
let scanFrame = null;
const ADMIN_UID = "4FSh4Ems9lXyQVhoDVKRoO6PoKw1";
let reportTargetUid = null;
let reportFilter = "all";

function relativeTime(value) {
  if (!value) return "日時不明";
  const date = value.toDate ? value.toDate() : new Date(value);
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}
function followDocId(from, to) { return `${from}_${to}`; }
async function follows(from, to) {
  const snap = await getDoc(doc(db, "follows", followDocId(from, to)));
  return snap.exists();
}
async function canViewProfile(targetUid, targetProfile) {
  const user = auth.currentUser;
  if (!user) return false;
  if (user.uid === targetUid || !targetProfile.isPrivate) return true;
  return (await follows(user.uid, targetUid)) && (await follows(targetUid, user.uid));
}
async function ensureUserProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists() || !snap.data().displayName) throw new Error("プロフィール設定が完了していません。");
  const profile = snap.data();
  if (typeof profile.bio !== "string") profile.bio = "";
  if (typeof profile.isPrivate !== "boolean") profile.isPrivate = false;
  await setDoc(ref, {bio:profile.bio, photoURL:profile.photoURL || user.photoURL || "", isPrivate:profile.isPrivate, updatedAt:serverTimestamp()}, {merge:true});
  await setDoc(doc(db,"profileDirectory",user.uid), {displayName:profile.displayName, photoURL:profile.photoURL || user.photoURL || "", isPrivate:!!profile.isPrivate, updatedAt:serverTimestamp()}, {merge:true});
  return profile;
}
function showSocialPage(page) {
  activeSocialPage = page;
  $("homePanel").hidden = page !== "home";
  socialArea.hidden = page === "home";
  bottomNavigation.hidden = false;
  document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  $("friendsPanel").hidden = page !== "friends";
  $("timelinePanel").hidden = page !== "timeline";
  $("recordsPanel").hidden = page !== "records";
  profilePanel.hidden = true;
  $("socialTitle").textContent = ({friends:"フォロー",timeline:"タイムライン",records:"記録"}[page] || "Study Mate");
  if (page === "timeline") loadFriendsTimeline();
  if (page === "records") renderRecordsPage();
  if (page === "friends") loadFollowingList();
}
document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => showSocialPage(button.dataset.page)));

function makeAvatar(profile, className="friend-avatar") {
  const avatar = document.createElement("div"); avatar.className = className;
  if (profile.photoURL) { const img=document.createElement("img"); img.src=profile.photoURL; img.alt=""; img.referrerPolicy="no-referrer"; avatar.append(img); }
  else avatar.textContent=(profile.displayName || "?").slice(0,1);
  return avatar;
}
function makeFollowButton(uid, isFollowing, isPrivate) {
  const button=document.createElement("button"); button.type="button"; button.className=isFollowing?"secondary-button":"primary-button";
  button.textContent=isFollowing?"フォロー中":"フォロー";
  button.addEventListener("click",async()=>{
    const me=auth.currentUser; if(!me)return;
    button.disabled=true;
    try {
      const ref=doc(db,"follows",followDocId(me.uid,uid));
      if(await follows(me.uid,uid)){ await deleteDoc(ref); button.textContent="フォロー"; button.className="primary-button"; }
      else { await setDoc(ref,{followerUid:me.uid,targetUid:uid,createdAt:serverTimestamp()}); button.textContent="フォロー中"; button.className="secondary-button"; }
      button.disabled=false;
      if(currentProfile?.uid===uid) openUserProfile(uid);
      if(activeSocialPage==="friends") loadFollowingList();
    } catch(e){ console.error(e); alert("フォロー状態を変更できませんでした。Firestoreルールを確認してください。"); button.disabled=false; }
  });
  return button;
}
async function loadFollowingList() {
  const user=auth.currentUser; if(!user)return;
  friendListEl.replaceChildren();
  try {
    const snap=await getDocs(query(collection(db,"follows"),where("followerUid","==",user.uid)));
    friendCountEl.textContent=`フォロー中 ${snap.size}人`;
    if(snap.empty){friendListEl.innerHTML='<p class="empty-state">まだフォローしていません。「名前で検索」またはQRコードから追加できます。</p>';return;}
    for(const f of snap.docs){
      const uid=f.data().targetUid; const ps=await getDoc(doc(db,"profileDirectory",uid)); if(!ps.exists())continue;
      const p=ps.data(); const row=document.createElement("div"); row.className="friend-row";
      const main=document.createElement("div");main.className="friend-main";const name=document.createElement("strong");name.textContent=p.displayName||"名前未設定";const detail=document.createElement("p");detail.textContent=p.isPrivate?"非公開アカウント":"公開アカウント";main.append(name,detail);
      const open=document.createElement("button");open.className="friend-open";open.textContent="プロフィール";open.onclick=()=>openUserProfile(uid);
      row.append(makeAvatar(p),main,open);friendListEl.append(row);
    }
  }catch(e){console.error(e);friendListEl.textContent="フォロー一覧を読み込めませんでした。";}
}
function openSearchModal(){ $("searchModal").hidden=false; $("userSearchInput").focus(); }
$("searchFriendButton").addEventListener("click",openSearchModal);
$("addFriendButton").addEventListener("click",()=>openQrModal(false));
$("closeSearchModal").addEventListener("click",()=>$("searchModal").hidden=true);
$("runUserSearch").addEventListener("click",searchUsers);
$("userSearchInput").addEventListener("keydown",e=>{if(e.key==="Enter")searchUsers();});
async function searchUsers(){
  const term=$("userSearchInput").value.trim();const results=$("userSearchResults");results.replaceChildren();
  if(!term)return alert("名前を入力してください。");
  try{
    const snap=await getDocs(query(collection(db,"profileDirectory"),orderBy("displayName"),startAt(term),endAt(term+"\uf8ff"),limit(25)));
    const hits=snap.docs.filter(d=>d.id!==auth.currentUser.uid);
    if(!hits.length){results.innerHTML='<p class="empty-state">該当するユーザーが見つかりませんでした。</p>';return;}
    for(const d of hits){const p=d.data();const row=document.createElement("div");row.className="friend-row search-result-row";const main=document.createElement("div");main.className="friend-main";const name=document.createElement("strong");name.textContent=p.displayName||"名前未設定";const privacy=document.createElement("p");privacy.textContent=p.isPrivate?"非公開アカウント":"公開アカウント";main.append(name,privacy);const open=document.createElement("button");open.className="friend-open";open.textContent="見る";open.onclick=()=>{$("searchModal").hidden=true;openUserProfile(d.id);};row.append(makeAvatar(p),main,open);results.append(row);}
  }catch(e){console.error(e);results.textContent="検索に失敗しました。Firestoreルールとインデックスを確認してください。";}
}
async function openUserProfile(uid){
  const me=auth.currentUser;if(!me)return;
  try{
    const directorySnap=await getDoc(doc(db,"profileDirectory",uid));if(!directorySnap.exists())return alert("プロフィールが見つかりません。");
    const directory=directorySnap.data();const allowed=uid===me.uid || !directory.isPrivate || ((await follows(me.uid,uid))&&(await follows(uid,me.uid)));
    const fullSnap=allowed?await getDoc(doc(db,"users",uid)):null;
    const profile=fullSnap?.exists()?fullSnap.data():{displayName:directory.displayName,photoURL:directory.photoURL,isPrivate:directory.isPrivate,bio:""};
    currentProfile={uid,...profile};
    $("friendsPanel").hidden=true;$("timelinePanel").hidden=true;$("recordsPanel").hidden=true;profilePanel.hidden=false;
    $("socialTitle").textContent=profile.displayName||"プロフィール";profileContent.replaceChildren();
    const head=document.createElement("div");head.className="profile-heading";head.append(makeAvatar(profile));
    const info=document.createElement("div");info.className="profile-heading-info";const name=document.createElement("h2");name.textContent=profile.displayName||"名前未設定";const counts=document.createElement("p");counts.className="profile-counts";
    const [followers,following]=await Promise.all([getDocs(query(collection(db,"follows"),where("targetUid","==",uid))),getDocs(query(collection(db,"follows"),where("followerUid","==",uid)))]);
    counts.textContent=`フォロワー ${followers.size}人　フォロー中 ${following.size}人`;info.append(name,counts);
    const isFollowing=await follows(me.uid,uid);if(uid!==me.uid)info.append(makeFollowButton(uid,isFollowing,profile.isPrivate));
    head.append(info);profileContent.append(head);
    if (uid !== me.uid) {
      const reportButton = document.createElement("button"); reportButton.type = "button"; reportButton.className = "report-user-button"; reportButton.textContent = "このユーザーを通報";
      reportButton.addEventListener("click", () => openReportModal(uid, profile.displayName));
      profileContent.append(reportButton);
    }
    const tabs=document.createElement("div");tabs.className="profile-subtabs";const content=document.createElement("div");
    ["記録","タイムライン","プロフィール"].forEach(label=>{const b=document.createElement("button");b.textContent=label;b.onclick=()=>{tabs.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));showFriendSection(uid,profile,label,content,allowed);};tabs.append(b);});
    profileContent.append(tabs,content);
    if(!allowed){content.innerHTML='<p class="empty-state">このアカウントは非公開です。勉強記録とプロフィールを見るには相互フォローが必要です。</p>';return;}
    tabs.querySelector("button").classList.add("active");await showFriendSection(uid,profile,"記録",content,true);
  }catch(e){console.error(e);alert("プロフィールを開けませんでした。公開範囲またはFirestoreルールを確認してください。");}
}
async function showFriendSection(uid,profile,section,container,allowed){
  container.replaceChildren();
  if(!allowed){container.textContent="相互フォローすると閲覧できます。";return;}
  if(section==="プロフィール"){
    const p=document.createElement("p");
    p.className="friend-bio";
    p.textContent=profile.bio||"自己紹介はまだありません。";
    container.append(p);
    return;
  }

  try {
    // 年間表示にも対応するため、最新50件ではなく対象ユーザーの記録を取得
    const snap=await getDocs(query(
      collection(db,"users",uid,"studyRecords"),
      orderBy("createdAt","desc")
    ));
    const records=snap.docs.map(d=>({id:d.id,...d.data()}));

    if(section==="記録"){
      renderFriendStackedChart(container,records);
      return;
    }

    // タイムラインは新しい記録から表示
    if(!records.length){
      container.innerHTML='<p class="empty-state">まだ勉強記録がありません。</p>';
      return;
    }
    records.slice(0,50).forEach(data=>{
      const card=document.createElement("article");card.className="timeline-card";
      const strong=document.createElement("strong");
      strong.textContent=`${profile.displayName}：${data.subject||"その他"}を${Number(data.minutes)||0}分勉強`;
      const p=document.createElement("p");p.textContent=data.comment||"勉強を頑張りました！";
      const small=document.createElement("small");small.textContent=relativeTime(data.createdAt);
      card.append(strong,p,small);container.append(card);
    });
  } catch(error) {
    console.error("友達の勉強記録読み込みエラー",error);
    container.innerHTML='<p class="empty-state">勉強記録を読み込めませんでした。閲覧権限とFirestoreルールを確認してください。</p>';
  }
}

function renderFriendStackedChart(container,records){
  if(!records.length){
    container.innerHTML='<p class="empty-state">まだ勉強記録がありません。</p>';
    return;
  }

  let period="week",unit="hours",offset=0,selectedKey=null;
  const root=document.createElement("section");root.className="friend-chart";
  const controls=document.createElement("div");controls.className="friend-chart-controls";
  const periodGroup=document.createElement("div");periodGroup.className="segmented-control";
  const unitGroup=document.createElement("div");unitGroup.className="segmented-control unit-controls";
  const nav=document.createElement("div");nav.className="chart-period-nav";
  const prev=document.createElement("button");prev.type="button";prev.textContent="‹";prev.setAttribute("aria-label","前の期間");
  const periodLabel=document.createElement("strong");
  const next=document.createElement("button");next.type="button";next.textContent="›";next.setAttribute("aria-label","次の期間");
  nav.append(prev,periodLabel,next);
  const chart=document.createElement("div");chart.className="friend-stacked-chart";chart.setAttribute("aria-label","友達の教科別勉強時間グラフ");
  const legend=document.createElement("div");legend.className="chart-legend";
  const detail=document.createElement("div");detail.className="chart-detail";detail.setAttribute("aria-live","polite");
  const summaryTitle=document.createElement("h3");summaryTitle.className="friend-chart-summary-title";summaryTitle.textContent="教科別の勉強時間";
  const summary=document.createElement("div");summary.className="subject-summary";
  ["week","month","year"].forEach((value,i)=>{
    const b=document.createElement("button");b.type="button";b.dataset.value=value;b.textContent=["週","月","年"][i];
    b.addEventListener("click",()=>{period=value;offset=0;selectedKey=null;render();});
    periodGroup.append(b);
  });
  ["hours","minutes"].forEach((value,i)=>{
    const b=document.createElement("button");b.type="button";b.dataset.value=value;b.textContent=["時間","分"][i];
    b.addEventListener("click",()=>{unit=value;render();});
    unitGroup.append(b);
  });
  controls.append(periodGroup,unitGroup);
  root.append(controls,nav,chart,legend,detail,summaryTitle,summary);
  container.append(root);

  function rangeForPeriod(){
    const now=tokyoDateKey();
    if(period==="week"){
      const start=addDays(mondayKeyFor(new Date()),offset*7);
      return {start,end:addDays(start,7),label:offset===0?"今週":`${start}の週`};
    }
    if(period==="month"){
      const [y,m]=now.split("-").map(Number);
      const d=new Date(Date.UTC(y,m-1+offset,1));
      const start=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-01`;
      const e=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1));
      const end=`${e.getUTCFullYear()}-${String(e.getUTCMonth()+1).padStart(2,"0")}-01`;
      return {start,end,label:`${d.getUTCFullYear()}年${d.getUTCMonth()+1}月`};
    }
    const year=Number(now.slice(0,4))+offset;
    return {start:`${year}-01-01`,end:`${year+1}-01-01`,label:`${year}年`};
  }
  function bucketsForRange(range){
    const out=[];
    if(period==="week"){
      for(let i=0;i<7;i++){const key=addDays(range.start,i);out.push({key,label:["月","火","水","木","金","土","日"][i]});}
    }else if(period==="month"){
      const count=(dateFromKey(range.end)-dateFromKey(range.start))/86400000;
      for(let i=0;i<count;i++){const key=addDays(range.start,i);out.push({key,label:String(i+1)});}
    }else{
      for(let i=0;i<12;i++){const key=`${range.start.slice(0,4)}-${String(i+1).padStart(2,"0")}-01`;out.push({key,label:`${i+1}月`,month:true});}
    }
    return out;
  }
  function valueText(minutes){return unit==="hours"?`${(minutes/60).toFixed(1)}時間`:`${minutes}分`;}
  function render(){
    const range=rangeForPeriod();periodLabel.textContent=range.label;
    periodGroup.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.value===period));
    unitGroup.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.value===unit));
    next.disabled=offset>=0;
    const inRange=records.filter(r=>{const key=dateKeyFromTimestamp(r.createdAt);return key&&key>=range.start&&key<range.end;});
    const subjects=[...new Set(inRange.map(r=>r.subject||"その他"))];
    const buckets=bucketsForRange(range).map(bucket=>{
      const totals=new Map();
      inRange.forEach(r=>{
        const key=dateKeyFromTimestamp(r.createdAt);
        const match=period==="year"?key?.startsWith(bucket.key.slice(0,7)):key===bucket.key;
        if(match){const subject=r.subject||"その他";totals.set(subject,(totals.get(subject)||0)+Number(r.minutes||0));}
      });
      return {...bucket,totals,total:[...totals.values()].reduce((a,b)=>a+b,0)};
    });
    const max=Math.max(1,...buckets.map(b=>b.total));
    chart.replaceChildren();
    buckets.forEach(bucket=>{
      const col=document.createElement("button");col.type="button";col.className="friend-chart-column";
      if(selectedKey===bucket.key)col.classList.add("selected");
      col.setAttribute("aria-label",`${bucket.key} ${valueText(bucket.total)}`);
      const bar=document.createElement("span");bar.className="friend-chart-bar";
      subjects.forEach(subject=>{
        const value=bucket.totals.get(subject)||0;if(!value)return;
        const segment=document.createElement("span");segment.className="friend-chart-segment";
        segment.style.height=`${value/max*100}%`;segment.style.background=colorForSubject(subject);
        segment.title=`${subject} ${valueText(value)}`;bar.append(segment);
      });
      const label=document.createElement("span");label.className="chart-label";label.textContent=bucket.label;
      col.append(bar,label);
      col.addEventListener("click",()=>{
        selectedKey=bucket.key;render();
        const details=[...bucket.totals.entries()].sort((a,b)=>b[1]-a[1]);
        detail.textContent=details.length?`${bucket.key}：${details.map(([s,v])=>`${s} ${valueText(v)}`).join(" / ")}（合計 ${valueText(bucket.total)}）`:`${bucket.key}：勉強記録はありません。`;
      });
      chart.append(col);
    });
    legend.replaceChildren();
    subjects.forEach(subject=>{
      const item=document.createElement("span");item.className="legend-item";
      const dot=document.createElement("i");dot.className="legend-dot";dot.style.background=colorForSubject(subject);
      const name=document.createElement("span");name.textContent=subject;item.append(dot,name);legend.append(item);
    });
    detail.textContent="棒グラフをタップすると教科別の勉強時間を確認できます。";
    const totals=new Map();inRange.forEach(r=>{const s=r.subject||"その他";totals.set(s,(totals.get(s)||0)+Number(r.minutes||0));});
    const total=[...totals.values()].reduce((a,b)=>a+b,0);summary.replaceChildren();
    [...totals.entries()].sort((a,b)=>b[1]-a[1]).forEach(([subject,value])=>{
      const row=document.createElement("div");row.className="subject-summary-row";
      const top=document.createElement("div");top.className="subject-summary-top";
      const name=document.createElement("strong");name.textContent=subject;
      const val=document.createElement("span");val.textContent=`${valueText(value)}（${total?Math.round(value/total*100):0}%）`;
      top.append(name,val);
      const track=document.createElement("div");track.className="subject-progress-track";
      const fill=document.createElement("div");fill.className="subject-progress-fill";
      fill.style.width=`${total?value/total*100:0}%`;fill.style.background=colorForSubject(subject);
      track.append(fill);row.append(top,track);summary.append(row);
    });
    if(!totals.size)summary.innerHTML='<p class="empty-summary">この期間の勉強記録はまだありません。</p>';
  }
  prev.addEventListener("click",()=>{offset--;selectedKey=null;render();});
  next.addEventListener("click",()=>{if(offset<0){offset++;selectedKey=null;render();}});
  render();
}
$("backToFriendsButton").addEventListener("click",()=>{profilePanel.hidden=true;$("friendsPanel").hidden=false;$("socialTitle").textContent="フォロー";loadFollowingList();});
async function loadFriendsTimeline(){
  const user=auth.currentUser;if(!user)return;timelineListEl.replaceChildren();
  try{const snap=await getDocs(query(collection(db,"follows"),where("followerUid","==",user.uid)));
    for(const f of snap.docs){const uid=f.data().targetUid;const ps=await getDoc(doc(db,"profileDirectory",uid));if(!ps.exists())continue;const p=ps.data();const mutual=await follows(uid,user.uid);if(p.isPrivate&&!mutual)continue;
      const records=await getDocs(query(collection(db,"users",uid,"studyRecords"),orderBy("createdAt","desc"),limit(20)));
      records.forEach(r=>{const d=r.data();const card=document.createElement("article");card.className="timeline-card";const strong=document.createElement("strong");strong.textContent=`${p.displayName}：${d.subject}を${d.minutes}分勉強`;const comment=document.createElement("p");comment.textContent=d.comment||"勉強を頑張りました！";const time=document.createElement("small");time.textContent=relativeTime(d.createdAt);card.append(strong,comment,time);timelineListEl.append(card);});
    }
    if(!timelineListEl.children.length)timelineListEl.innerHTML='<p class="empty-state">表示できる勉強報告はまだありません。</p>';
  }catch(e){console.error(e);timelineListEl.textContent="タイムラインを読み込めませんでした。";}
}

// 自分のホームプロフィール表示・編集
function renderHomeStyleTags(styles = []) {
  const container = $("homeStudyStyleTags");
  if (!container) return;
  container.replaceChildren();
  if (!styles.length) { const empty=document.createElement("span"); empty.className="home-empty-tag"; empty.textContent="勉強スタイルを追加しよう"; container.append(empty); return; }
  styles.forEach(tag => { const chip=document.createElement("span"); chip.className="home-style-tag"; chip.textContent="#" + tag; container.append(chip); });
}
function renderHomeAvatar(user, profile) {
  const avatar=$("homeProfileAvatar"); avatar.replaceChildren();
  const photo=profile.photoURL || user.photoURL;
  if(photo){const img=document.createElement("img");img.src=photo;img.alt="プロフィール画像";img.referrerPolicy="no-referrer";avatar.append(img);}
  else avatar.textContent=(profile.displayName || "S").slice(0,1);
}
async function loadMyProfileSettings(){
  const u=auth.currentUser;if(!u)return;
  const s=await getDoc(doc(db,"users",u.uid));if(!s.exists())return;
  const p=s.data();
  $("myDisplayName").value=p.displayName||"";$("myBio").value=p.bio||"";$("privateAccountToggle").checked=!!p.isPrivate;
  $("myStudyStyles").value=(Array.isArray(p.studyStyles)?p.studyStyles:[]).join("#");
  $("homeProfileName").textContent=p.displayName||"名前未設定";
  $("homeBioText").textContent=p.bio||"自己紹介はまだありません。";
  renderHomeAvatar(u,p);renderHomeStyleTags(Array.isArray(p.studyStyles)?p.studyStyles:[]);
  updatePrivacyLabel();
  const [followers,following]=await Promise.all([getDocs(query(collection(db,"follows"),where("targetUid","==",u.uid))),getDocs(query(collection(db,"follows"),where("followerUid","==",u.uid)))]);
  $("homeFollowerCount").textContent=followers.size;$("homeFollowingCount").textContent=following.size;
}
function updatePrivacyLabel(){const label=$("privateAccountToggle").checked?"非公開アカウント":"公開アカウント";$("accountPrivacyLabel").textContent=label;$("profileEditPrivacyLabel").textContent=label;}
$("privateAccountToggle").addEventListener("change",updatePrivacyLabel);
$("editHomeProfileButton").addEventListener("click",()=>{$("profileEditPanel").hidden=false;$("profileEditPanel").scrollIntoView({behavior:"smooth",block:"center"});});
$("cancelProfileEditButton").addEventListener("click",()=>{$("profileEditPanel").hidden=true;loadMyProfileSettings();});
$("saveProfileButton").addEventListener("click",async()=>{
  const u=auth.currentUser;if(!u)return;const displayName=$("myDisplayName").value.trim();if(!displayName)return alert("表示名を入力してください。");
  const isPrivate=$("privateAccountToggle").checked;
  try{
    await updateDoc(doc(db,"users",u.uid),{displayName:displayName.slice(0,30),isPrivate,updatedAt:serverTimestamp()});
    await setDoc(doc(db,"profileDirectory",u.uid),{displayName:displayName.slice(0,30),photoURL:u.photoURL||"",isPrivate,updatedAt:serverTimestamp()},{merge:true});
    $("profileSaveMessage").textContent="プロフィールを保存しました。";$("profileEditPanel").hidden=true;await loadMyProfileSettings();
  }catch(e){console.error(e);alert("保存できませんでした。Firestoreルールを確認してください。");}
});
$("editBioButton").addEventListener("click",()=>{$("bioEditor").hidden=!$("bioEditor").hidden;$("myBio").value=$("homeBioText").textContent==="自己紹介はまだありません。"?"":$("homeBioText").textContent;});
$("saveBioButton").addEventListener("click",async()=>{const u=auth.currentUser;if(!u)return;const bio=$("myBio").value.trim().slice(0,120);try{await updateDoc(doc(db,"users",u.uid),{bio,updatedAt:serverTimestamp()});$("homeBioText").textContent=bio||"自己紹介はまだありません。";$("bioEditor").hidden=true;}catch(e){console.error(e);alert("自己紹介を保存できませんでした。");}});
$("editStudyStyleButton").addEventListener("click",()=>{$("studyStyleEditor").hidden=!$("studyStyleEditor").hidden;});
$("saveStudyStyleButton").addEventListener("click",async()=>{
  const u=auth.currentUser;if(!u)return;
  const raw=$("myStudyStyles").value;
  const styles=[...new Set(raw.split("#").map(x=>x.trim().replace(/^#+/,"")).filter(Boolean))].slice(0,12).map(x=>x.slice(0,24));
  try{await updateDoc(doc(db,"users",u.uid),{studyStyles:styles,updatedAt:serverTimestamp()});renderHomeStyleTags(styles);$("myStudyStyles").value=styles.join("#");$("studyStyleEditor").hidden=true;}catch(e){console.error(e);alert("勉強スタイルを保存できませんでした。Firestoreルールを確認してください。");}
});
$("homeGoalSummary").addEventListener("click",()=>showSocialPage("records"));

// QRコード：URLにはプロフィールを開くためのUIDだけを含め、認証情報は含めない
function profileUrl(uid){return `${location.origin}${location.pathname}?profile=${encodeURIComponent(uid)}`;}
function stopQrCamera(){if(scanFrame)cancelAnimationFrame(scanFrame);scanFrame=null;if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null;}$("qrVideo").hidden=true;}
function openQrModal(scan){$("qrModal").hidden=false;$("myQrCode").replaceChildren();$("qrVideo").hidden=true;$("qrScanMessage").textContent="";$("startQrScanButton").hidden=!scan;$("qrModalTitle").textContent=scan?"QRコードを読み取る":"自分のQRコード";if(!scan){const u=auth.currentUser;const url=profileUrl(u.uid);if(window.QRCode)new QRCode($("myQrCode"),{text:url,width:220,height:220,colorDark:"#30234d",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});else $("myQrCode").textContent=url;}}
$("showMyQrButton").addEventListener("click",()=>openQrModal(false));
$("closeQrModal").addEventListener("click",()=>{stopQrCamera();$("qrModal").hidden=true;});
$("startQrScanButton").addEventListener("click",async()=>{
  if(!("BarcodeDetector" in window)){ $("qrScanMessage").textContent="このブラウザはQRカメラ読み取りに対応していません。相手のQRコードに記載されたプロフィールURLを開いてください。";return; }
  try{const detector=new BarcodeDetector({formats:["qr_code"]});scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});const video=$("qrVideo");video.srcObject=scanStream;video.hidden=false;await video.play();$("qrScanMessage").textContent="QRコードをカメラに映してください。";
    const scan=async()=>{if(!scanStream)return;try{const codes=await detector.detect(video);if(codes.length){const url=new URL(codes[0].rawValue);const uid=url.searchParams.get("profile");if(uid){stopQrCamera();$("qrModal").hidden=true;openUserProfile(uid);return;}}}catch(e){}scanFrame=requestAnimationFrame(scan);};scan();
  }catch(e){console.error(e);$("qrScanMessage").textContent="カメラを起動できませんでした。ブラウザのカメラ許可を確認してください。";}
});
// QRのリンクからプロフィールを直接開く
async function openProfileFromUrl(){const uid=new URLSearchParams(location.search).get("profile");if(uid){showSocialPage("friends");await openUserProfile(uid);}}

// 通報機能：プロフィールから送信し、管理者だけが一覧を閲覧できる
function openReportModal(uid, displayName) {
  if (!uid || uid === auth.currentUser?.uid) return;
  reportTargetUid = uid;
  $("reportTargetName").textContent = `通報対象：${displayName || "ユーザー"}`;
  $("reportReason").value = "迷惑行為";
  $("reportDetails").value = "";
  $("reportModal").hidden = false;
}
$("closeReportModal").addEventListener("click", () => { $("reportModal").hidden = true; reportTargetUid = null; });
$("submitReportButton").addEventListener("click", async () => {
  const me = auth.currentUser;
  if (!me || !reportTargetUid) return;
  const reason = $("reportReason").value;
  const details = $("reportDetails").value.trim().slice(0, 500);
  const button = $("submitReportButton");
  button.disabled = true;
  try {
    const reportRef = doc(collection(db, "reports"));
    await setDoc(reportRef, {
      reporterUid: me.uid,
      targetUid: reportTargetUid,
      reason,
      details,
      status: "unresolved",
      createdAt: serverTimestamp()
    });
    $("reportModal").hidden = true;
    reportTargetUid = null;
    alert("通報を送信しました。ご協力ありがとうございます。");
  } catch (error) {
    console.error("通報送信エラー", error);
    alert("通報を送信できませんでした。時間をおいて再度お試しください。");
  } finally { button.disabled = false; }
});

function formatReportDate(value) {
  const date = timestampDate(value);
  if (!date || Number.isNaN(date.getTime())) return "日時不明";
  return new Intl.DateTimeFormat("ja-JP", {timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"}).format(date);
}
async function loadAdminReports() {
  if (auth.currentUser?.uid !== ADMIN_UID) return;
  const list = $("adminReportsList");
  list.textContent = "読み込み中...";
  try {
    const snap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(100)));
    list.replaceChildren();
    const reports = snap.docs.map(d => ({id:d.id, ...d.data()})).filter(r => reportFilter === "all" || (reportFilter === "resolved" ? r.status === "resolved" : r.status !== "resolved"));
    if (!reports.length) { list.innerHTML = '<p class="empty-state">該当する通報はありません。</p>'; return; }
    for (const report of reports) {
      const card = document.createElement("article"); card.className = "admin-report-card";
      const heading = document.createElement("div"); heading.className = "admin-report-heading";
      const title = document.createElement("strong"); title.textContent = report.reason || "理由未設定";
      const status = document.createElement("span"); status.className = report.status === "resolved" ? "report-status resolved" : "report-status"; status.textContent = report.status === "resolved" ? "対応済み" : "未対応";
      heading.append(title, status);
      const target = document.createElement("p"); target.textContent = `通報対象 UID：${report.targetUid || "不明"}`;
      const reporter = document.createElement("p"); reporter.textContent = `通報者 UID：${report.reporterUid || "不明"}`;
      const date = document.createElement("small"); date.textContent = `通報日時：${formatReportDate(report.createdAt)}`;
      const details = document.createElement("p"); details.className = "admin-report-details"; details.textContent = report.details || "詳細説明はありません。";
      const action = document.createElement("button"); action.type = "button"; action.className = report.status === "resolved" ? "secondary-button" : "primary-button"; action.textContent = report.status === "resolved" ? "未対応に戻す" : "対応済みにする";
      action.addEventListener("click", async () => {
        action.disabled = true;
        try { await updateDoc(doc(db, "reports", report.id), {status:report.status === "resolved" ? "unresolved" : "resolved", reviewedAt:serverTimestamp()}); await loadAdminReports(); }
        catch (error) { console.error(error); alert("対応状況を更新できませんでした。"); action.disabled = false; }
      });
      card.append(heading, target, reporter, date, details, action); list.append(card);
    }
  } catch (error) {
    console.error("通報一覧読み込みエラー", error);
    list.textContent = "通報一覧を読み込めませんでした。Firestoreルールが更新されているか確認してください。";
  }
}
$("adminReportsButton").addEventListener("click", async () => {
  if (auth.currentUser?.uid !== ADMIN_UID) return;
  $("homePanel").hidden = true; socialArea.hidden = true; $("adminReportsPanel").hidden = false; bottomNavigation.hidden = true;
  await loadAdminReports();
});
$("closeAdminReportsButton").addEventListener("click", () => { $("adminReportsPanel").hidden = true; showSocialPage("home"); });
document.querySelectorAll("[data-report-filter]").forEach(button => button.addEventListener("click", async () => {
  reportFilter = button.dataset.reportFilter;
  document.querySelectorAll("[data-report-filter]").forEach(b => b.classList.toggle("active", b === button));
  await loadAdminReports();
}));

// 認証状態（画面・友達機能の定義後に開始）
onAuthStateChanged(auth, async user => {
  if (!user) {
    $("adminReportsButton").hidden = true;
    $("adminReportsPanel").hidden = true;
    showLoginScreen();
    studyRecords = [];
    currentGoal = null;
    return;
  }
  try {
    const profileSnap = await getDoc(doc(db, "users", user.uid));
    if (!profileSnap.exists() || !profileSnap.data().displayName) {
      showProfileSetupScreen(user);
      return;
    }
    showAppScreen();
    $("adminReportsButton").hidden = user.uid !== ADMIN_UID;
    $("adminReportsPanel").hidden = true;
    showSocialPage("home");
    await ensureUserProfile(user);
    await Promise.all([loadStudyRecords(), loadWeeklyGoal(), loadMyProfileSettings()]);
    if (new URLSearchParams(location.search).has("profile")) await openProfileFromUrl();
    else loadFollowingList();
  } catch (error) {
    console.error("初期データ読み込みエラー", error);
    alert("データの読み込みに失敗しました。Firestoreルールを確認してください。");
  }
});
