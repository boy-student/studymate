// ===================================
// Study Mate JavaScript
// Firebase Auth / Firestore / Study Records
// ===================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, getDoc, query, where, orderBy, limit, onSnapshot, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

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
const loginButton = $("loginButton");
const googleLoginButton = $("googleLoginButton");
const logoutButton = $("logoutButton");
const appLogoutButton = $("appLogoutButton");
const authMessage = $("authMessage");

function showAuthMessage(message) { authMessage.textContent = message; }
function showLoginScreen() {
  authScreen.hidden = false;
  appContent.hidden = true;
  signupForm.hidden = false;
  googleLoginButton.hidden = false;
  logoutButton.hidden = true;
}
function showAppScreen() {
  authScreen.hidden = true;
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
  try {
    showAuthMessage("アカウントを作成しています...");
    await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    showAuthMessage("新規登録が完了しました！");
  } catch (error) {
    console.error(error); showAuthMessage("新規登録に失敗しました。"); alert("登録エラー：" + error.message);
  }
});
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
const incomingRequestsEl = document.getElementById("incomingRequests");
const friendCountEl = document.getElementById("friendCount");
const profilePanel = document.getElementById("friendProfilePanel");
const profileContent = document.getElementById("friendProfileContent");
const timelineListEl = document.getElementById("timelineList");
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
  document.getElementById("homePanel").hidden = page !== "home";
  socialArea.hidden = page === "home";
  bottomNavigation.hidden = false;
  document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  document.getElementById("friendsPanel").hidden = page !== "friends";
  document.getElementById("timelinePanel").hidden = page !== "timeline";
  document.getElementById("recordsPanel").hidden = page !== "records";
  profilePanel.hidden = true;
  document.getElementById("groupsPanel").hidden = true;
  document.getElementById("socialTitle").textContent = ({friends:"友達",timeline:"タイムライン",records:"記録"}[page] || "Study Mate");
  if (page === "timeline") loadFriendsTimeline();
  if (page === "records") renderRecordsPage();
}
document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => showSocialPage(button.dataset.page)));
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
  ["記録","タイムライン","プロフィール"].forEach(label => {
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



// 認証状態（画面・友達機能の定義後に開始）
onAuthStateChanged(auth, async user => {
  if (!user) {
    showLoginScreen();
    studyRecords = [];
    currentGoal = null;
    if (friendUnsubscribe) friendUnsubscribe();
    if (requestUnsubscribe) requestUnsubscribe();
    return;
  }
  showAppScreen();
  showSocialPage("home");
  try {
    await ensureUserProfile(user);
    listenFriends(user);
    await Promise.all([loadStudyRecords(), loadWeeklyGoal()]);
  } catch (error) {
    console.error("初期データ読み込みエラー", error);
    alert("データの読み込みに失敗しました。Firestoreルールを確認してください。");
  }
});
