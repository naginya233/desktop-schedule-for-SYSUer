import { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } from "react";
import { getCurrentWindow } from '@tauri-apps/api/window';

// ============================================================
//  Desktop Widget v3
//  LXGW WenKai · Card panels · Dark mode · Custom countdowns
//  Viewport-level draggable sticky notes
// ============================================================

const pad = (n) => String(n).padStart(2, "0");
const daysDiff = (t) => Math.ceil((new Date(t) - new Date()) / 86400000);

/* ---- Theme context ---- */
const ThemeCtx = createContext();
function useTheme() { return useContext(ThemeCtx); }

function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try { return window.localStorage.getItem("widget_dark") === "true"; } catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem("widget_dark", String(dark)); } catch {}
  }, [dark]);
  return (
    <ThemeCtx.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      {children}
    </ThemeCtx.Provider>
  );
}

/* ---- Hooks ---- */
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
}

function useHitokoto() {
  const [q, setQ] = useState({ text: "", from: "" });
  const load = useCallback(async () => {
    try {
      const r = await fetch("https://v1.hitokoto.cn/?c=a&c=b&c=d&c=k&encode=json");
      const d = await r.json();
      setQ({ text: d.hitokoto, from: d.from || d.from_who || "" });
    } catch { setQ({ text: "今天也要好好加油。", from: "" }); }
  }, []);
  useEffect(() => { load(); }, []);
  return { ...q, refresh: load };
}

const WK = ["日","一","二","三","四","五","六"];

/* ---- Mock data ---- */
const COURSES = [
  { time: "08:00-09:35", name: "机器学习", loc: "教三201", c: "#5b8def" },
  { time: "10:10-11:45", name: "运筹学", loc: "教一305", c: "#e8913a" },
  { time: "14:00-15:35", name: "交通工程", loc: "交通楼102", c: "#3dab80" },
];
const WEEK_DATA = {
  1:[{t:"08:00",n:"机器学习",c:"#5b8def"},{t:"10:10",n:"运筹学",c:"#e8913a"},{t:"14:00",n:"交通工程",c:"#3dab80"}],
  2:[{t:"08:00",n:"数据结构",c:"#9b72cf"},{t:"14:00",n:"概率论",c:"#cfad3d"}],
  3:[{t:"10:10",n:"机器学习",c:"#5b8def"},{t:"14:00",n:"智能交通",c:"#cf5b7c"}],
  4:[{t:"08:00",n:"运筹学",c:"#e8913a"},{t:"10:10",n:"数据结构",c:"#9b72cf"}],
  5:[{t:"10:10",n:"交通工程",c:"#3dab80"},{t:"14:00",n:"概率论",c:"#cfad3d"}],
};
const INIT_DDL = [
  {id:1,title:"ML课程论文终稿",due:"2026-04-15",tag:"课业"},
  {id:2,title:"场景图实验 v3",due:"2026-04-18",tag:"研究"},
  {id:3,title:"运筹学作业5",due:"2026-04-12",tag:"课业"},
];
const INIT_TODO = [
  {id:1,text:"复现 BEV baseline",done:false},
  {id:2,text:"读 SceneGraphNet",done:true},
  {id:3,text:"整理实验日志",done:false},
];
const NC = ["#fff8e1","#e3f2fd","#fce4ec","#e8f5e9","#f3e5f5","#fff3e0"];
const NC_D = ["#3a3520","#1e2d3a","#3a1e28","#1e3a24","#2e1e3a","#3a2e1e"];
const INIT_NOTES = [
  {id:1,x:640,y:100,text:"记得回复导师邮件 ✉️",color:0},
  {id:2,x:660,y:250,text:"BEV新idea:\n场景图约束蒸馏",color:1},
];

/* ---- Data Provider ---- */
function usePersistedState(key, initialValue) {
  const [state, setState] = useState(() => {
    try { const item = window.localStorage.getItem(key); return item ? JSON.parse(item) : initialValue; } catch { return initialValue; }
  });
  useEffect(() => { try { window.localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState];
}
const DataCtx = createContext();
function useData() { return useContext(DataCtx); }
function DataProvider({ children }) {
  const [courses, setCourses] = usePersistedState("widget_courses", COURSES);
  const [weekData, setWeekData] = usePersistedState("widget_week", WEEK_DATA);
  const [ddl, setDdl] = usePersistedState("widget_ddl", INIT_DDL);
  const [todo, setTodo] = usePersistedState("widget_todo", INIT_TODO);
  const [countdown, setCountdown] = usePersistedState("widget_countdowns", [{id:1,label:"期末考试",date:"2026-06-20",emoji:"📖"}]);
  const [notes, setNotes] = usePersistedState("widget_notes", INIT_NOTES);
  const [settings, setSettings] = usePersistedState("widget_settings", { 
    weather: { lat: 39.9042, lon: 116.4074, city: "北京" },
    semesterStart: "2026-03-02",
    cards: [
      { name: "Courses",    x: 16,  y: 16  },
      { name: "WeekStrip",  x: 336, y: 16  },
      { name: "DDLBoard",   x: 656, y: 16  },
      { name: "Countdowns", x: 16,  y: 320 },
      { name: "TodoList",   x: 336, y: 320 },
    ]
  });
  return (
    <DataCtx.Provider value={{ courses, setCourses, weekData, setWeekData, ddl, setDdl, todo, setTodo, countdown, setCountdown, notes, setNotes, settings, setSettings }}>
      {children}
    </DataCtx.Provider>
  );
}

function useTodayCourses() {
  const { weekData, settings } = useData();
  const todayNum = new Date().getDay() || 7;
  const start = new Date(settings?.semesterStart || "2026-03-02");
  const now = new Date();
  const currentWeek = Math.floor((now - start) / (7 * 86400000)) + 1;
  const todayList = weekData[todayNum] || [];
  return todayList.filter(c => {
    if(!c.weekInfo) return true;
    const m = c.weekInfo.match(/^(\d+)-(\d+)(.*)$/);
    if(m) {
      const s = parseInt(m[1]), e = parseInt(m[2]), type = m[3];
      if(currentWeek < s || currentWeek > e) return false;
      if(type.includes("双") && currentWeek % 2 !== 0) return false;
      if(type.includes("单") && currentWeek % 2 === 0) return false;
    }
    return true;
  });
}

/* ---- Panel wrapper ---- */
function Panel({ children, className = "" }) {
  return <div className={`p ${className}`}>{children}</div>;
}

/* ---- Header inside panel ---- */
function PH({ title, right }) {
  return <div className="ph"><h2>{title}</h2>{right && <div className="ph__r">{right}</div>}</div>;
}

/* ============ MODULES ============ */

function Clock() {
  const now = useClock();
  return (
    <div className="clk">
      <div className="clk__t">
        {pad(now.getHours())}<span className="clk__c">:</span>{pad(now.getMinutes())}
        <span className="clk__s">{pad(now.getSeconds())}</span>
      </div>
      <div className="clk__d">{now.getFullYear()}.{pad(now.getMonth()+1)}.{pad(now.getDate())} 周{WK[now.getDay()]}</div>
    </div>
  );
}

function Hito() {
  const { text, from, refresh } = useHitokoto();
  if (!text) return null;
  return (
    <div className="hito" onClick={refresh} title="换一句">
      「{text}」{from && <span className="hito__f">— {from}</span>}
    </div>
  );
}

const WMO = {
  0: ["☀️", "晴朗"], 1: ["🌤️", "少云"], 2: ["⛅", "局部多云"], 3: ["☁️", "阴天"],
  45: ["🌫️", "雾"], 48: ["🌫️", "雾(结霜)"], 51: ["🌧️", "毛毛雨"], 53: ["🌧️", "毛毛雨"], 55: ["🌧️", "毛毛雨"],
  61: ["🌧️", "小雨"], 63: ["🌧️", "中雨"], 65: ["🌧️", "大雨"],
  71: ["🌨️", "小雪"], 73: ["🌨️", "中雪"], 75: ["🌨️", "大雪"],
  95: ["⛈️", "雷暴"]
};
function useWeather(lat, lon) {
  const [w, setW] = useState(null);
  useEffect(() => {
    if(!lat || !lon) return;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
      .then(r => r.json()).then(d => setW(d.current_weather)).catch(() => {});
  }, [lat, lon]);
  return w;
}
function Weather() {
  const { settings, setSettings } = useData();
  const loc = settings?.weather || { lat: 39.9042, lon: 116.4074, city: "北京" };
  const w = useWeather(loc.lat, loc.lon);
  
  const changeLoc = async () => {
    const input = prompt("修改天气位置：\n输入拼音/英文（如 beijing）\n或者输入 auto 自动定位", loc.city);
    if (!input) return;
    if (input.toLowerCase() === 'auto') {
      navigator.geolocation.getCurrentPosition(
        (pos) => setSettings(p => ({...p, weather: {lat: pos.coords.latitude, lon: pos.coords.longitude, city: "自动定位"}})),
        () => alert("获取定位失败，请检查浏览器权限，或手动输入。")
      );
    } else {
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${input}&count=1`);
        const d = await r.json();
        if (d.results && d.results[0]) {
          const res = d.results[0];
          setSettings(p => ({...p, weather: {lat: res.latitude, lon: res.longitude, city: res.name}}));
        } else alert("未找到该城市记录，请尝试其他拼写。");
      } catch { alert("网络错误"); }
    }
  };

  if(!w) return <div className="wt" onClick={changeLoc} style={{cursor:"pointer"}}><span className="wt__i">☁</span><span className="wt__t">--°</span><span className="wt__d">加载中...</span></div>;
  const [icon, desc] = WMO[w.weathercode] || ["☁", "未知"];
  return <div className="wt" onClick={changeLoc} title={`当前位置: ${loc.city}\n点击修改位置`} style={{cursor:"pointer"}}><span className="wt__i">{icon}</span><span className="wt__t">{w.temperature}°</span><span className="wt__d">{desc}</span></div>;
}

function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button className="thm" onClick={toggle} title={dark ? "切换亮色" : "切换暗色"}>
      <span className="thm__track">
        <span className="thm__thumb" />
      </span>
      <span className="thm__label">{dark ? "🌙" : "☀️"}</span>
    </button>
  );
}

function Summary() {
  const { ddl, todo } = useData();
  const todayCourses = useTodayCourses();
  const cCount = todayCourses.length;
  const dCount = ddl.filter(d => daysDiff(d.due) <= 5 && daysDiff(d.due) >= 0).length;
  const tTotal = todo.length;
  const tDone = todo.filter(t => t.done).length;
  
  return (
    <div className="sum">
      <div className="sum__i"><span className="sum__v">{cCount}</span><span className="sum__l">今日课程</span></div>
      <div className="sum__sep"/>
      <div className="sum__i"><span className={`sum__v ${dCount>0?'sum__v--w':''}`}>{dCount}</span><span className="sum__l">DDL临近</span></div>
      <div className="sum__sep"/>
      <div className="sum__i"><span className="sum__v">{tDone}/{tTotal}</span><span className="sum__l">待办进度</span></div>
    </div>
  );
}

function Courses() {
  const now = useClock();
  const m = now.getHours()*60+now.getMinutes();
  const todayCourses = useTodayCourses();
  const { setWeekData } = useData();

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = e => {
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.periods_definition && data.schedule) {
             const timeMap = {};
             data.periods_definition.forEach(p => timeMap[p.index] = p.time.replace('~', '-'));
             const daysMap = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
             const newWeekData = { 1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[] };
             const colors = ["#5b8def", "#e8913a", "#3dab80", "#9b72cf", "#cfad3d", "#cf5b7c"];
             let cid = 0;
             Object.keys(data.schedule).forEach(dayKey => {
                const dayNum = daysMap[dayKey];
                if(!dayNum) return;
                data.schedule[dayKey].forEach(item => {
                   const pStart = item.periods[0];
                   const pEnd = item.periods[item.periods.length - 1];
                   const tStart = timeMap[pStart]?.split('-')[0] || "00:00";
                   const tEnd = timeMap[pEnd]?.split('-')[1] || "00:00";
                   const timeStr = `${tStart}-${tEnd}`;
                   let content = item.content.replace(/\[cite:\s*[\d,\s]*\]/g, '').trim();
                   const parts = content.split('/');
                   const weekInfo = parts[0];
                   let name = parts[1] || "";
                   name = name.replace(/^.*?\)/, '');
                   const teacher = parts[2] || "";
                   let loc = parts[3] || "";
                   loc = loc.replace(/\(.*?座\).*/, '');
                   // Join the last two segments if there are multiple hyphens (e.g. 深圳校区-西教学楼-西2-403 => 西2-403)
                   loc = loc.split('-').slice(-2).join('-');
                   loc = loc.replace(/^工学园/, '工');
                   
                   newWeekData[dayNum].push({
                      t: tStart, time: timeStr, name: name, n: name,
                      c: colors[cid++ % colors.length], loc: loc,
                      weekInfo: weekInfo, teacher: teacher
                   });
                });
             });
             for(let i=1; i<=7; i++) newWeekData[i].sort((a,b) => a.t.localeCompare(b.t));
             setWeekData(newWeekData);
             alert("教务系统课表导入成功！");
          } else {
             alert("请选择正确的教务系统课表 JSON 文件");
          }
        } catch { alert("数据格式错误"); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <Panel>
      <PH title="今日课程" right={<button className="gb" onClick={handleImport}>导入</button>} />
      <div className="cl">
        {todayCourses.length === 0 && <div style={{fontSize:12,color:"var(--tx3)",textAlign:"center",padding:"10px 0"}}>今天没有课~</div>}
        {todayCourses.map((c,i)=>{
          const time = c.time || `${c.t||"00:00"}-00:00`;
          const name = c.name || c.n || "未知课程";
          const loc = c.loc || "";
          const [sh,sm] = time.split("-")[0].split(":").map(Number);
          const [eh,em] = (time.split("-")[1] || "00:00").split(":").map(Number);
          const on=m>=sh*60+sm&&m<=eh*60+em, past=m>eh*60+em;
          return(
            <div key={i} className={`ci ${on?"on":""} ${past?"past":""}`}>
              <div className="ci__bar" style={{background:c.c}}/>
              <div className="ci__b"><span className="ci__n">{name}</span><span className="ci__m">{time}　{loc}</span></div>
              {on&&<span className="ci__live">now</span>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function WeekStrip() {
  const { weekData, settings } = useData();
  const td = new Date().getDay() || 7;
  
  const start = new Date(settings?.semesterStart || "2026-03-02");
  const now = new Date();
  const currentWeek = Math.floor((now - start) / (7 * 86400000)) + 1;

  const getWeekCourses = (day) => {
    const list = weekData[day] || [];
    return list.filter(c => {
      if(!c.weekInfo) return true;
      const m = c.weekInfo.match(/^(\d+)-(\d+)(.*)$/);
      if(m) {
        const s = parseInt(m[1]), e = parseInt(m[2]), type = m[3];
        if(currentWeek < s || currentWeek > e) return false;
        if(type.includes("双") && currentWeek % 2 !== 0) return false;
        if(type.includes("单") && currentWeek % 2 === 0) return false;
      }
      return true;
    });
  };

  return (
    <Panel>
      <PH title={`第 ${currentWeek} 周概览`}/>
      <div className="wk">
        {[1,2,3,4,5,6,7].map(d=>{
          const courses = getWeekCourses(d);
          return (
            <div key={d} className={`wk__d ${d===td?"cur":""}`}>
              <span className="wk__l">周{WK[d]}</span>
              <div className="wk__ps">
                {courses.length === 0 ? <div className="wk__empty">·</div> : 
                  courses.map((s,j)=><div key={j} className="wk__p" style={{background:s.c}} title={`${s.time || s.t} ${s.name || s.n}`}/>)}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function DDLBoard() {
  const { ddl: items, setDdl: setItems } = useData();
  const [show,setShow]=useState(false);
  const [t,setT]=useState("");const [d,setD]=useState("");const [tag,setTag]=useState("课业");
  const [eid,setEid]=useState(null);
  const [et,setEt]=useState("");const [ed,setEd]=useState("");const [etag,setEtag]=useState("");
  const sorted=useMemo(()=>[...items].sort((a,b)=>new Date(a.due)-new Date(b.due)),[items]);
  const add=()=>{if(!t.trim()||!d)return;setItems(p=>[...p,{id:Date.now(),title:t.trim(),due:d,tag}]);setT("");setD("");setShow(false);};
  const startE=(dd)=>{setEid(dd.id);setEt(dd.title);setEd(dd.due);setEtag(dd.tag);};
  const saveE=()=>{if(!et.trim()||!ed)return;setItems(p=>p.map(x=>x.id===eid?{...x,title:et,due:ed,tag:etag}:x));setEid(null);};
  const urg=(l)=>l<0?"past":l<=2?"urg":l<=5?"soon":"ok";
  return(
    <Panel>
      <PH title="DDL" right={<button className="gb" onClick={()=>setShow(!show)}>+</button>}/>
      {show&&<div className="fm"><input placeholder="名称" value={t} onChange={e=>setT(e.target.value)}/><input type="date" value={d} onChange={e=>setD(e.target.value)}/><select value={tag} onChange={e=>setTag(e.target.value)}><option>课业</option><option>研究</option><option>其他</option></select><button className="sb" onClick={add}>添加</button></div>}
      <div className="dl">{sorted.map(dd=>{
        if(eid===dd.id) return(
          <div key={dd.id} className="fm" style={{marginBottom:4,marginTop:4}}>
            <input value={et} onChange={e=>setEt(e.target.value)}/>
            <input type="date" value={ed} onChange={e=>setEd(e.target.value)}/>
            <select value={etag} onChange={e=>setEtag(e.target.value)}><option>课业</option><option>研究</option><option>其他</option></select>
            <button className="sb" onClick={saveE}>保存</button>
            <button className="gb" onClick={()=>setEid(null)}>取消</button>
          </div>
        );
        const l=daysDiff(dd.due);const u=urg(l);return(
        <div key={dd.id} className={`di ${u}`} onDoubleClick={()=>startE(dd)} title="双击编辑">
          <div className="di__l"><span className="di__t">{dd.title}</span><span className="di__tag">{dd.tag}</span></div>
          <div className="di__r"><span className="di__d">{l<0?`${-l}d ago`:l===0?"Today":`${l}d`}</span><button className="rm" onClick={()=>setItems(p=>p.filter(x=>x.id!==dd.id))}>×</button></div>
        </div>
      );})}</div>
    </Panel>
  );
}

function TodoList() {
  const { todo: todos, setTodo: setTodos } = useData();
  const [inp,setInp]=useState("");
  const dn=todos.filter(t=>t.done).length;
  const add=()=>{if(!inp.trim())return;setTodos(p=>[...p,{id:Date.now(),text:inp.trim(),done:false}]);setInp("");};
  return(
    <Panel>
      <PH title="Todo" right={<span className="cnt">{dn}/{todos.length}</span>}/>
      <div className="ti"><input placeholder="新待办…" value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/></div>
      <div className="tl">{todos.map(t=>(
        <div key={t.id} className={`to ${t.done?"dn":""}`}>
          <button className="to__ck" onClick={()=>setTodos(p=>p.map(x=>x.id===t.id?{...x,done:!x.done}:x))}>{t.done?"✓":""}</button>
          <span className="to__tx">{t.text}</span>
          <button className="rm" onClick={()=>setTodos(p=>p.filter(x=>x.id!==t.id))}>×</button>
        </div>
      ))}</div>
    </Panel>
  );
}

function Countdowns() {
  const { countdown: items, setCountdown: setItems } = useData();
  const [show,setShow]=useState(false);
  const [lb,setLb]=useState("");const [dt,setDt]=useState("");const [em,setEm]=useState("🎯");
  const add=()=>{if(!lb.trim()||!dt)return;setItems(p=>[...p,{id:Date.now(),label:lb.trim(),date:dt,emoji:em}]);setLb("");setDt("");setEm("🎯");setShow(false);};
  const [eid,setEid]=useState(null);
  const [elb,setElb]=useState("");const [edt,setEdt]=useState("");const [eem,setEem]=useState("");
  const startE=(it)=>{setEid(it.id);setElb(it.label);setEdt(it.date);setEem(it.emoji);};
  const saveE=()=>{setItems(p=>p.map(x=>x.id===eid?{...x,label:elb,date:edt,emoji:eem}:x));setEid(null);};
  return(
    <Panel>
      <PH title="倒计时" right={<button className="gb" onClick={()=>setShow(!show)}>+</button>}/>
      {show&&<div className="fm"><input placeholder="名称" value={lb} onChange={e=>setLb(e.target.value)}/><input type="date" value={dt} onChange={e=>setDt(e.target.value)}/><input placeholder="emoji" value={em} onChange={e=>setEm(e.target.value)} style={{width:44,flex:"none"}}/><button className="sb" onClick={add}>添加</button></div>}
      <div className="cdl">{items.map(it=>{
        const left=daysDiff(it.date);
        if(eid===it.id) return(
          <div key={it.id} className="fm" style={{marginBottom:4}}>
            <input value={eem} onChange={e=>setEem(e.target.value)} style={{width:36,flex:"none"}}/>
            <input value={elb} onChange={e=>setElb(e.target.value)}/>
            <input type="date" value={edt} onChange={e=>setEdt(e.target.value)}/>
            <button className="sb" onClick={saveE}>保存</button>
            <button className="gb" onClick={()=>setEid(null)}>取消</button>
          </div>
        );
        return(
          <div key={it.id} className="cd" onDoubleClick={()=>startE(it)} title="双击编辑">
            <span className="cd__em">{it.emoji}</span>
            <span className="cd__lb">{it.label}</span>
            <span className="cd__n">{left>0?left:0}</span>
            <span className="cd__u">天</span>
            <button className="rm" onClick={()=>setItems(p=>p.filter(x=>x.id!==it.id))}>×</button>
          </div>
        );
      })}</div>
    </Panel>
  );
}

/* ---- Sticky Notes ---- */
function StickyNotes() {
  const { dark } = useTheme();
  const { notes, setNotes } = useData();
  const [drag,setDrag]=useState(null);
  const [off,setOff]=useState({x:0,y:0});

  const addNote=()=>{
    setNotes(p=>[...p,{id:Date.now(),x:100+Math.random()*400,y:80+Math.random()*200,text:"",color:Math.floor(Math.random()*NC.length)}]);
  };

  const onDown=(e,id)=>{
    if(e.target.tagName==="TEXTAREA"||e.target.closest("button"))return;
    e.preventDefault();
    const r=e.currentTarget.getBoundingClientRect();
    setDrag(id);setOff({x:e.clientX-r.left,y:e.clientY-r.top});
    setNotes(p=>{const n=p.find(x=>x.id===id);return[...p.filter(x=>x.id!==id),n];});
  };

  const onMove=useCallback(e=>{
    if(drag===null)return;
    setNotes(p=>p.map(n=>n.id===drag?{...n,x:Math.max(0,e.clientX-off.x),y:Math.max(0,e.clientY-off.y)}:n));
  },[drag,off]);

  const onUp=useCallback(()=>setDrag(null),[]);

  useEffect(()=>{
    if(drag!==null){
      window.addEventListener("mousemove",onMove);
      window.addEventListener("mouseup",onUp);
      return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
    }
  },[drag,onMove,onUp]);

  return(
    <>
      <button className="fab" onClick={addNote}>＋ 便签</button>
      <div className="sl" style={{pointerEvents:drag!==null?"auto":"none"}}>
        {notes.map(n=>{
          const bg = dark ? NC_D[n.color] : NC[n.color];
          return(
            <div key={n.id} className="sn" style={{
              left:n.x,top:n.y,background:bg,pointerEvents:"auto",
              zIndex:drag===n.id?9999:100,
              transform:drag===n.id?"rotate(-1.5deg) scale(1.04)":"none",
            }} onMouseDown={e=>onDown(e,n.id)}>
              <div className="sn__hd">
                <span className="sn__grip">⋮⋮</span>
                <span style={{display:"flex",gap:4,alignItems:"center"}}>
                  <button className="sn__col" onClick={()=>setNotes(p=>p.map(x=>x.id===n.id?{...x,color:(x.color+1)%NC.length}:x))} title="换颜色">🎨</button>
                  <button className="sn__rm" onClick={()=>setNotes(p=>p.filter(x=>x.id!==n.id))} title="删除">×</button>
                </span>
              </div>
              <textarea className="sn__tx" value={n.text}
                onChange={e=>setNotes(p=>p.map(x=>x.id===n.id?{...x,text:e.target.value}:x))}
                placeholder="写点什么…"/>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ============ MAIN ============ */
function BackupRestore() {
  const { courses, setCourses, weekData, setWeekData, ddl, setDdl, todo, setTodo, countdown, setCountdown, notes, setNotes } = useData();
  const exportData = () => {
    const data = { courses, weekData, ddl, todo, countdown, notes };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `widget-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };
  const importData = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = e => {
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.courses) setCourses(data.courses);
          if (data.weekData) setWeekData(data.weekData);
          if (data.ddl) setDdl(data.ddl);
          if (data.todo) setTodo(data.todo);
          if (data.countdown) setCountdown(data.countdown);
          if (data.notes) setNotes(data.notes);
          alert("导入成功！");
        } catch { alert("数据格式错误"); }
      };
      reader.readAsText(file);
    };
    input.click();
  };
  return (
    <div style={{display:"flex",gap:4}}>
      <button className="gb" onClick={exportData} title="导出备份" style={{padding:"2px 6px"}}>📤</button>
      <button className="gb" onClick={importData} title="导入备份" style={{padding:"2px 6px"}}>📥</button>
    </div>
  );
}

const COMPS = { Courses, WeekStrip, DDLBoard, Countdowns, TodoList };
const COMP_LIST = ["Courses", "WeekStrip", "DDLBoard", "Countdowns", "TodoList"];

function Layout() {
  const { dark } = useTheme();
  const { settings, setSettings } = useData();
  const HEADER_H = 130; // approximate header height in px
  const p0 = settings?.pos;
  const pos = p0 || {
    Courses:    { x: 16,  y: HEADER_H + 16 },
    WeekStrip:  { x: 332, y: HEADER_H + 16 },
    DDLBoard:   { x: 648, y: HEADER_H + 16 },
    Countdowns: { x: 16,  y: HEADER_H + 340 },
    TodoList:   { x: 332, y: HEADER_H + 340 },
  };

  const containerRef = useRef(null);
  const [active, setActive] = useState(null);

  const startDrag = (e, name) => {
    if (e.target.closest('button, input, textarea, select, a')) return;
    e.preventDefault();
    const { x: ox, y: oy } = pos[name] || { x: 0, y: 0 };
    const sx = e.clientX, sy = e.clientY;
    let nx = ox, ny = oy;
    setActive(name);
    const el = e.currentTarget.closest('.fc');
    if (el) el.style.zIndex = 100;

    const move = (ev) => {
      const c = containerRef.current;
      if (!c || !el) return;
      nx = Math.max(0, Math.min(ox + ev.clientX - sx, c.clientWidth  - el.offsetWidth));
      ny = Math.max(0, Math.min(oy + ev.clientY - sy, c.clientHeight - el.offsetHeight));
      el.style.left = nx + 'px';
      el.style.top  = ny + 'px';
    };
    const up = () => {
      if (el) el.style.zIndex = '';
      setActive(null);
      setSettings(p => ({ ...p, pos: { ...(p.pos || pos), [name]: { x: nx, y: ny } } }));
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className={`R ${dark?"dk":""}`} ref={containerRef}>
      <div className="dragbar" data-tauri-drag-region="true">
        <div className="dragbar__line" data-tauri-drag-region="true"/>
      </div>
      <div className="widget-header">
        <div className="topbar">
          <div className="topbar__l"><Clock/><Weather/></div>
          <div className="topbar__r"><Hito/><BackupRestore/><ThemeToggle/></div>
        </div>
        <Summary/>
      </div>
      <div className="freecanvas">
        {COMP_LIST.map(name => {
          const Comp = COMPS[name];
          const p = pos[name] || { x: 0, y: 0 };
          return (
            <div key={name} className={`fc${active===name?' fc--active':''}`}
              style={{ left: p.x, top: p.y }}
            >
              <div className="fc__handle" onMouseDown={e=>startDrag(e,name)} title="按住拖动">
                <span className="fc__dots">⠿</span>
              </div>
              <Comp/>
            </div>
          );
        })}
      </div>
      <StickyNotes/>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DataProvider>
      <style>{`
@import url('https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/style.css');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html, body {
  background: transparent; overflow: hidden;
}

/* ===== THEME VARS ===== */
.R{
  --bg:rgba(244,243,239,0.7);--card:rgba(255,255,255,0.75);--bd:rgba(230,229,224,0.5);--bd2:rgba(216,215,210,0.6);
  --tx:#1c1c1a;--tx2:#5c5c58;--tx3:#9c9c96;
  --ac:#4a7fd8;--red:#d14;--orange:#d48a3b;--green:#3ba868;
  --f:'LXGW WenKai Screen','LXGW WenKai',system-ui,sans-serif;
  --fm:'LXGW WenKai Mono','LXGW WenKai Screen',monospace;
  --r:12px;--rs:8px;
  --shadow:0 1px 3px rgba(0,0,0,.04),0 0 0 1px var(--bd);
  --shadow-hover:0 3px 12px rgba(0,0,0,.07),0 0 0 1px var(--bd2);
  height: 100vh; width: 100vw;
  background:var(--bg);font-family:var(--f);color:var(--tx);
  padding:0;font-size:13.5px;line-height:1.55;
  transition:background .35s,color .35s;
  border-radius: 12px; overflow: hidden;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  position: relative;
}

.dragbar {
  display: flex; justify-content: center; align-items: center;
  height: 20px; width: 100%;
  background: var(--card); opacity: 0.6; cursor: grab;
  border-bottom: 1px solid var(--bd); transition: opacity 0.2s;
  flex-shrink: 0;
}
.dragbar:hover { opacity: 1; }
.dragbar__line {
  width: 40px; height: 4px; border-radius: 2px;
  background: var(--tx3); opacity: 0.5;
}

/* ===== DARK ===== */
.R.dk{
  --bg:rgba(25,25,24,0.7);--card:rgba(36,36,35,0.75);--bd:rgba(255,255,255,0.08);--bd2:rgba(255,255,255,0.15);
  --tx:#e8e8e4;--tx2:#a0a098;--tx3:#686864;
  --ac:#6a9de8;--red:#e55;--orange:#e8a050;--green:#50c878;
  --shadow:0 1px 3px rgba(0,0,0,.2),0 0 0 1px var(--bd);
  --shadow-hover:0 3px 12px rgba(0,0,0,.3),0 0 0 1px var(--bd2);
}

/* ===== TOP BAR ===== */
.topbar{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:8px 0 14px;border-bottom:1px solid var(--bd)}
.topbar__l{display:flex;align-items:flex-end;gap:20px}
.topbar__r{display:flex;align-items:center;gap:16px}

/* clock */
.clk__t{font-family:var(--fm);font-size:40px;font-weight:500;letter-spacing:-1px;line-height:1}
.clk__c{opacity:.2}
.clk__s{font-size:15px;color:var(--tx3);margin-left:2px;vertical-align:top;line-height:40px}
.clk__d{font-size:12px;color:var(--tx2);margin-top:2px}

/* hito */
.hito{max-width:340px;font-size:12px;color:var(--tx2);line-height:1.7;cursor:pointer;text-align:right;transition:color .2s}
.hito:hover{color:var(--tx)}
.hito__f{display:block;font-size:11px;color:var(--tx3);margin-top:1px}

/* weather */
.wt{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--tx2)}
.wt__i{font-size:16px}
.wt__t{font-family:var(--fm);font-weight:500;font-size:15px;color:var(--tx)}

/* theme toggle */
.thm{background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;padding:4px}
.thm__track{
  width:36px;height:20px;border-radius:10px;background:var(--bd);
  position:relative;transition:background .3s;
}
.R.dk .thm__track{background:var(--ac)}
.thm__thumb{
  position:absolute;top:2px;left:2px;width:16px;height:16px;
  border-radius:50%;background:var(--card);
  transition:transform .3s cubic-bezier(.4,.0,.2,1);
  box-shadow:0 1px 3px rgba(0,0,0,.15);
}
.R.dk .thm__thumb{transform:translateX(16px)}
.thm__label{font-size:14px;line-height:1}

/* summary */
.sum{display:flex;align-items:center;gap:18px;padding:6px 0 10px}
.sum__i{display:flex;align-items:baseline;gap:4px}
.sum__v{font-family:var(--fm);font-size:17px;font-weight:500}
.sum__v--w{color:var(--red)}
.sum__l{font-size:11px;color:var(--tx3)}
.sum__sep{width:1px;height:14px;background:var(--bd)}

/* ===== LAYOUT HEADER ===== */
.widget-header {
  padding: 0 20px;
  position: relative; z-index: 10;
  background: var(--bg);
}

/* ===== PANEL (card) ===== */
.p{
  background:var(--card);
  border:1px solid var(--bd);
  border-radius:var(--r);
  padding:14px 16px;
  box-shadow:var(--shadow);
  transition:background .35s,border-color .35s,box-shadow .25s;
}
.p:hover{box-shadow:var(--shadow-hover)}

/* panel header */
.ph{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.ph h2{font-size:14px;font-weight:600;letter-spacing:.2px}
.ph__r{display:flex;align-items:center;gap:6px}

/* ===== FREE CANVAS ===== */
.freecanvas {
  position: absolute; inset: 0;
  overflow: visible; pointer-events: none;
  z-index: 1;
}
.fc {
  position: absolute;
  width: 300px;
  pointer-events: all;
  transition: box-shadow 0.15s;
}
.fc--active { z-index: 50 !important; }
.fc--active .p { box-shadow: 0 8px 32px rgba(0,0,0,0.15), 0 0 0 1.5px var(--ac); }

/* drag handle on each card */
.fc__handle {
  display: flex; align-items: center; justify-content: center;
  height: 14px; margin-bottom: 4px;
  cursor: grab; opacity: 0; transition: opacity 0.2s;
  border-radius: var(--rs) var(--rs) 0 0;
}
.fc:hover .fc__handle { opacity: 1; }
.fc__handle:active { cursor: grabbing; }
.fc__dots { font-size: 14px; color: var(--tx3); user-select: none; letter-spacing: 2px; }


/* ===== SHARED CONTROLS ===== */
.gb{background:none;border:1px solid var(--bd);border-radius:var(--rs);padding:1px 10px;font-size:11px;color:var(--tx2);cursor:pointer;font-family:var(--f);transition:all .15s}
.gb:hover{border-color:var(--ac);color:var(--ac)}
.sb{background:var(--ac);border:none;border-radius:var(--rs);padding:4px 12px;font-size:11px;color:#fff;cursor:pointer;font-family:var(--f)}
.sb:hover{opacity:.85}
.rm{background:none;border:none;color:transparent;font-size:14px;cursor:pointer;transition:color .1s}
*:hover>.rm{color:var(--tx3)}
.rm:hover{color:var(--red)!important}
.cnt{font-family:var(--fm);font-size:11px;color:var(--tx3)}

.fm{display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap}
.fm input,.fm select{padding:4px 8px;border:1px solid var(--bd);border-radius:var(--rs);font-size:11px;font-family:var(--f);background:var(--bg);color:var(--tx);flex:1;min-width:0;transition:border-color .15s,background .35s}
.fm input:focus,.fm select:focus{outline:none;border-color:var(--ac)}

/* ===== COURSES ===== */
.cl{display:flex;flex-direction:column;gap:2px}
.ci{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--rs);transition:background .12s}
.ci:hover{background:rgba(128,128,128,.04)}
.ci.past{opacity:.3}
.ci.on{background:rgba(74,127,216,.06)}
.ci__bar{width:3px;height:22px;border-radius:1.5px;flex-shrink:0}
.ci__b{flex:1;min-width:0}
.ci__n{font-weight:500;display:block;font-size:13px}
.ci__m{font-size:11px;color:var(--tx3);font-family:var(--fm)}
.ci__live{font-family:var(--fm);font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--ac);background:rgba(74,127,216,.08);padding:1px 7px;border-radius:4px}

/* week */
.wk{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.wk__d{text-align:center;padding:6px 1px 8px;border-radius:var(--rs)}
.wk__d.cur{background:rgba(74,127,216,.08);box-shadow: inset 0 0 0 1px rgba(74,127,216,0.1)}
.wk__l{font-size:10px;color:var(--tx3);display:block;margin-bottom:5px;font-weight: 500}
.wk__ps{display:flex;flex-direction:column;align-items:center;gap:3px;min-height: 20px;justify-content: center}
.wk__p{width:6px;height:6px;border-radius:1.5px;transition:transform .15s}
.wk__p:hover{transform:scale(1.8);z-index: 10}
.wk__empty{font-size: 10px; color: var(--tx3); opacity: 0.3}

/* ddl */
.dl{display:flex;flex-direction:column;gap:2px}
.di{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:var(--rs);border-left:3px solid transparent;transition:background .1s}
.di:hover{background:rgba(128,128,128,.03)}
.di.urg{border-left-color:var(--red)}.di.soon{border-left-color:var(--orange)}.di.ok{border-left-color:var(--green)}.di.past{border-left-color:var(--tx3);opacity:.35}
.di__l{display:flex;align-items:center;gap:7px;min-width:0}
.di__t{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}
.di__tag{font-size:9px;padding:0 5px;border-radius:3px;background:rgba(128,128,128,.06);color:var(--tx3);flex-shrink:0}
.di__r{display:flex;align-items:center;gap:8px;flex-shrink:0}
.di__d{font-family:var(--fm);font-size:12px;font-weight:500;min-width:36px;text-align:right}
.di.urg .di__d{color:var(--red)}.di.soon .di__d{color:var(--orange)}

/* todo */
.ti{margin-bottom:6px}
.ti input{width:100%;padding:6px 10px;border:1px solid var(--bd);border-radius:var(--rs);font-size:12px;font-family:var(--f);background:var(--bg);color:var(--tx);transition:border-color .15s,background .35s}
.ti input:focus{outline:none;border-color:var(--ac)}
.tl{display:flex;flex-direction:column;gap:0}
.to{display:flex;align-items:center;gap:7px;padding:6px 6px;border-radius:var(--rs)}
.to:hover{background:rgba(128,128,128,.03)}
.to__ck{width:16px;height:16px;border:1.5px solid var(--bd);border-radius:4px;background:none;cursor:pointer;font-size:10px;color:var(--ac);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.to.dn .to__ck{background:var(--ac);border-color:var(--ac);color:#fff}
.to__tx{flex:1;font-size:13px}
.to.dn .to__tx{text-decoration:line-through;color:var(--tx3)}

/* countdown */
.cdl{display:flex;flex-direction:column;gap:4px}
.cd{display:flex;align-items:center;gap:7px;padding:9px 10px;border-radius:var(--rs);background:rgba(128,128,128,.03);cursor:default;transition:background .35s}
.cd__em{font-size:15px}
.cd__lb{flex:1;color:var(--tx2);font-size:13px}
.cd__n{font-family:var(--fm);font-size:22px;font-weight:500;line-height:1}
.cd__u{font-size:11px;color:var(--tx3);margin-left:-2px}

/* ===== STICKY NOTES ===== */
.sl{position:fixed;inset:0;z-index:100}
.sn{position:fixed;width:154px;border-radius:4px;box-shadow:0 1px 6px rgba(0,0,0,.08);transition:transform .12s,box-shadow .12s;display:flex;flex-direction:column}
.sn:hover{box-shadow:0 3px 14px rgba(0,0,0,.12)}
.sn__hd{display:flex;align-items:center;justify-content:space-between;padding:3px 6px;cursor:grab;user-select:none}
.sn__grip{font-size:9px;color:rgba(128,128,128,.35);letter-spacing:1px}
.sn__rm{background:none;border:none;color:rgba(128,128,128,.25);font-size:13px;cursor:pointer;padding:0 2px}
.sn__rm:hover{color:var(--red)}
.sn__col{background:none;border:none;font-size:11px;cursor:pointer;opacity:0.3;transition:opacity .15s}
.sn__col:hover{opacity:1}
.sn__tx{border:none;background:transparent;font-family:var(--f);font-size:12px;line-height:1.5;padding:1px 8px 8px;resize:none;flex:1;min-height:44px;color:var(--tx)}
.sn__tx:focus{outline:none}
.sn__tx::placeholder{color:rgba(128,128,128,.3)}

.fab{position:fixed;bottom:22px;right:22px;z-index:200;background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:5px 14px;font-size:11px;font-family:var(--f);color:var(--tx2);cursor:pointer;box-shadow:0 1px 8px rgba(0,0,0,.05);transition:all .2s}
.fab:hover{border-color:var(--ac);color:var(--ac);box-shadow:0 3px 16px rgba(0,0,0,.1);transform:translateY(-1px)}

/* ===== ANIMATIONS ===== */
.p,.topbar,.sum{animation:fi .3s ease both}
@keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.col:nth-child(1) .p:nth-child(1){animation-delay:.03s}
.col:nth-child(1) .p:nth-child(2){animation-delay:.06s}
.col:nth-child(2) .p:nth-child(1){animation-delay:.09s}
.col:nth-child(2) .p:nth-child(2){animation-delay:.12s}
.col:nth-child(3) .p:nth-child(1){animation-delay:.15s}

/* responsive */
@media(max-width:860px){.grid{grid-template-columns:1fr}.topbar{flex-direction:column;align-items:flex-start;gap:10px}.topbar__r{align-self:flex-end}}
      `}</style>
      <Layout />
      </DataProvider>
    </ThemeProvider>
  );
}
