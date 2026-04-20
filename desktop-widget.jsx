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
  const [partnerWeekData, setPartnerWeekData] = usePersistedState("widget_week_partner", {});
  const [ddl, setDdl] = usePersistedState("widget_ddl", INIT_DDL);
  const [todo, setTodo] = usePersistedState("widget_todo", INIT_TODO);
  const [countdown, setCountdown] = usePersistedState("widget_countdowns", [{id:1,label:"期末考试",date:"2026-06-20",emoji:"📖"}]);
  const [notes, setNotes] = usePersistedState("widget_notes", INIT_NOTES);
  const [settings, setSettings] = usePersistedState("widget_settings", { 
    weather: { lat: 39.9042, lon: 116.4074, city: "北京" },
    semesterStart: "2026-03-02",
    research: {
      keywords: ["Scene Graph", "Autonomous Driving"],
      maxResults: 10
    },
    hiddenTiles: [],
    cards: [
      { name: "Courses",    x: 16,  y: 16  },
      { name: "WeekStrip",  x: 336, y: 16  },
      { name: "DDLBoard",   x: 656, y: 16  },
      { name: "Countdowns", x: 16,  y: 320 },
      { name: "TodoList",   x: 336, y: 320 },
      { name: "FreeTime",   x: 656, y: 320 },
    ]
  });
  return (
    <DataCtx.Provider value={{ 
      courses, setCourses, 
      weekData, setWeekData, 
      partnerWeekData, setPartnerWeekData,
      ddl, setDdl, 
      todo, setTodo, 
      countdown, setCountdown, 
      notes, setNotes, 
      settings, setSettings 
    }}>
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
  const DAY_NAMES = ["周日","周一","周二","周三","周四","周五","周六"];
  
  // Robust Lunar Calendar support using formatToParts
  const lunar = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
        month: 'long', day: 'numeric'
      }).formatToParts(now);
      const m = parts.find(p => p.type === 'month')?.value || "";
      const d = parts.find(p => p.type === 'day')?.value || "";
      return m + d;
    } catch { return ""; }
  }, [now.getDate()]); 

  return (
    <div className="clk">
      <div className="clk__t">
        {pad(now.getHours())}<span className="clk__c">:</span>{pad(now.getMinutes())}
        <span className="clk__s">{pad(now.getSeconds())}</span>
      </div>
      <div className="clk__d">
        {now.getFullYear()}.{pad(now.getMonth()+1)}.{pad(now.getDate())} {DAY_NAMES[now.getDay()]}
        {lunar && <span className="clk__lunar"> {lunar}</span>}
      </div>
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
  const { setWeekData, setPartnerWeekData } = useData();

  const handleImport = (target = 'me') => {
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
                   loc = loc.split('-').slice(-2).join('-');
                   loc = loc.replace(/^工学园/, '工');
                   
                   newWeekData[dayNum].push({
                      t: tStart, time: timeStr, name: name, n: name,
                      c: colors[cid++ % colors.length], loc: loc,
                      weekInfo: weekInfo, teacher: teacher,
                      periods: item.periods
                   });
                });
             });
             for(let i=1; i<=7; i++) newWeekData[i].sort((a,b) => a.t.localeCompare(b.t));
             if (target === 'me') setWeekData(newWeekData);
             else setPartnerWeekData(newWeekData);
             alert(`${target === 'me' ? '我的' : '对象的'}课表导入成功！`);
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
      <PH title="今日课程" right={
        <div style={{display:'flex', gap:4}}>
          <button className="gb" onClick={() => handleImport('me')}>导入</button>
          <button className="gb" onClick={() => handleImport('partner')} title="导入对象课表">❤️</button>
        </div>
      } />
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
  const now = useClock();

  // Detect container width to switch layouts
  const wrapRef = useRef(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setWide(entry.contentRect.width >= 520);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const start = new Date(settings?.semesterStart || "2026-03-02");
  const currentWeek = Math.floor((new Date() - start) / (7 * 86400000)) + 1;

  const getWeekCourses = (day) => {
    const list = weekData[day] || [];
    return list.filter(c => {
      if (!c.weekInfo) return true;
      const m = c.weekInfo.match(/^(\d+)-(\d+)(.*)$/);
      if (m) {
        const s = parseInt(m[1]), e = parseInt(m[2]), type = m[3];
        if (currentWeek < s || currentWeek > e) return false;
        if (type.includes("双") && currentWeek % 2 !== 0) return false;
        if (type.includes("单") && currentWeek % 2 === 0) return false;
      }
      return true;
    });
  };

  const DAYS = [1,2,3,4,5,6,7];
  const nowM = now.getHours() * 60 + now.getMinutes();

  // ── Compact dot view (narrow) ─────────────────────────────────
  if (!wide) return (
    <Panel>
      <PH title={`第 ${currentWeek} 周概览`}/>
      <div className="wk" ref={wrapRef}>
        {DAYS.map(d => {
          const courses = getWeekCourses(d);
          return (
            <div key={d} className={`wk__d ${d===td?"cur":""}`}>
              <span className="wk__l">周{WK[d%7]}</span>
              <div className="wk__ps">
                {courses.length === 0
                  ? <div className="wk__empty">·</div>
                  : courses.map((s,j) => (
                    <div key={j} className="wk__p" style={{background:s.c}}
                      title={`${s.time||s.t} ${s.name||s.n}`}/>
                  ))
                }
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );

  // ── Full expanded view (wide): same 7-col layout, full course cards ─────
  return (
    <Panel>
      <PH title={`第 ${currentWeek} 周 · 完整课表`}/>
      <div className="wk wk--full" ref={wrapRef}>
        {DAYS.map(d => {
          const courses = getWeekCourses(d);
          return (
            <div key={d} className={`wk__d wk__d--full ${d===td?"cur":""}`}>
              <span className="wk__l">周{WK[d%7]}</span>
              <div className="wk__ps wk__ps--full">
                {courses.length === 0
                  ? <div className="wk__empty">·</div>
                  : courses.map((c, j) => {
                    const [sh,sm] = (c.t||"00:00").split(":").map(Number);
                    const [eh,em] = ((c.time||"").split("-")[1]||"00:00").split(":").map(Number);
                    const on = nowM >= sh*60+sm && nowM <= eh*60+em && d === td;
                    return (
                      <div key={j} className={`wk__fc ${on?"on":""}`}
                        style={{borderLeftColor: c.c||"var(--ac)"}}>
                        <span className="wk__fn">{c.name||c.n}</span>
                        <span className="wk__ft">{c.t||""}</span>
                        {c.loc && <span className="wk__fl">{c.loc}</span>}
                      </div>
                    );
                  })
                }
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

function Pomodoro() {
  const [sec, setSec] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (running && sec > 0) {
      timerRef.current = setInterval(() => setSec(s => s - 1), 1000);
    } else if (sec === 0) {
      setRunning(false);
      setComplete(true);
    }
    return () => clearInterval(timerRef.current);
  }, [running, sec]);

  const toggle = () => {
    if (complete) reset();
    else setRunning(!running);
  };
  const reset = () => { setRunning(false); setSec(25 * 60); setComplete(false); };
  const fmt = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

  return (
    <Panel className={complete ? "p--flash" : ""}>
      <PH title="番茄钟" right={<button className="gb" onClick={reset}>↺</button>} />
      <div className="pomo text-center">
        <div className="pomo__display" onClick={toggle}>
          <div className="pomo__time">{fmt(sec)}</div>
          <div className="pomo__status">
            {complete ? "🎉 已完成！" : running ? "专注于工作中..." : "好的开始是成功的一半"}
          </div>
        </div>
        <button className={`sb ${running ? 'sb--stop' : ''}`} onClick={toggle} style={{ width: '100%', marginTop: 10 }}>
          {complete ? "再次开启" : running ? "暂停" : "开始专注"}
        </button>
      </div>
    </Panel>
  );
}

function Atmosphere() {
  const [active, setActive] = useState(null);
  const [vol, setVol] = useState(50);
  const [music, setMusic] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio();
    let unlisten = null;
    
    const initListen = async () => {
      try {
        if (window.__TAURI__?.event) {
          unlisten = await window.__TAURI__.event.listen('now-playing', (event) => {
            setMusic(event.payload);
          });
        }
      } catch (err) {
        console.error("Failed to setup listener:", err);
      }
    };
    initListen();

    return () => {
      audioRef.current.pause();
      audioRef.current = null;
      if (unlisten) unlisten.then(f => f());
    };
  }, []);

  const sounds = [
    { id: 'rain', name: '深度雨声', icon: '🌧️', url: '/audio/rain.ogg' },
    { id: 'forest', name: '雷鸣森林', icon: '⛈️', url: '/audio/forest.ogg' },
    { id: 'cafe', name: '午后书店', icon: '☕', url: '/audio/cafe.ogg' }
  ];

  const toggle = (s) => {
    if (!audioRef.current) return;
    if (active === s.id) {
      audioRef.current.pause();
      setActive(null);
    } else {
      audioRef.current.src = s.url;
      audioRef.current.loop = true;
      audioRef.current.volume = vol / 100;
      audioRef.current.play().catch(e => console.log("Autoplay blocked", e));
      setActive(s.id);
    }
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = vol / 100;
  }, [vol]);

  return (
    <Panel>
      <PH title="氛围感" />
      <div className="atm">
        <div className="atm__grid">
          {sounds.map(s => (
            <button key={s.id} className={`atm__btn ${active === s.id ? 'on' : ''}`} onClick={() => toggle(s)}>
              <span className="atm__icon">{s.icon}</span>
              <span className="atm__name">{s.name}</span>
            </button>
          ))}
        </div>
        <div className="atm__ctrl">
          <span style={{ fontSize: 10, opacity:0.6 }}>🔈</span>
          <input type="range" min="0" max="100" value={vol} onChange={e => setVol(e.target.value)} className="atm__vol" />
          <span style={{ fontSize: 10, opacity:0.6 }}>🔊</span>
        </div>
        <div className="atm__music">
          <div className={`atm__m-icon ${music?'atm__m-icon--playing':''}`}>{music?'🎵':'🔇'}</div>
          <div className="atm__m-info">
            <div className="atm__m-tit">{music ? music.title : "系统媒体未连接"}</div>
            <div className="atm__m-sub">{music ? music.artist : "等待播放器信号..."}</div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function FreeTime() {
  const { weekData, partnerWeekData, settings } = useData();
  const todayNum = new Date().getDay() || 7;
  const start = new Date(settings?.semesterStart || "2026-03-02");
  const currentWeek = Math.floor((new Date() - start) / (7 * 86400000)) + 1;

  const getOccupiedPeriods = (data) => {
    const list = data[todayNum] || [];
    const periods = new Set();
    list.forEach(c => {
      let active = true;
      if (c.weekInfo) {
        const m = c.weekInfo.match(/^(\d+)-(\d+)(.*)$/);
        if (m) {
          const s = parseInt(m[1]), e = parseInt(m[2]), type = m[3];
          if (currentWeek < s || currentWeek > e) active = false;
          if (type.includes("双") && currentWeek % 2 !== 0) active = false;
          if (type.includes("单") && currentWeek % 2 === 0) active = false;
        }
      }
      if (active && c.periods) {
        c.periods.forEach(p => periods.add(p));
      }
    });
    return periods;
  };

  const myOccupied = getOccupiedPeriods(weekData);
  const partnerOccupied = getOccupiedPeriods(partnerWeekData);

  const periods = [
    { id: 1,  name: "1",  time: "08:00-08:45" },
    { id: 2,  name: "2",  time: "08:55-09:40" },
    { id: 3,  name: "3",  time: "10:10-10:55" },
    { id: 4,  name: "4",  time: "11:05-11:50" },
    { id: 5,  name: "5",  time: "14:20-15:05" },
    { id: 6,  name: "6",  time: "15:15-16:00" },
    { id: 7,  name: "7",  time: "16:30-17:15" },
    { id: 8,  name: "8",  time: "17:25-18:10" },
    { id: 9,  name: "9",  time: "19:00-19:45" },
    { id: 10, name: "10", time: "19:55-20:40" },
    { id: 11, name: "11", time: "20:50-21:35" },
  ];

  const commonFree = periods.filter(p => !myOccupied.has(p.id) && !partnerOccupied.has(p.id));

  // Determine if partner data exists
  const hasPartner = Object.keys(partnerWeekData).length > 0;

  return (
    <Panel>
      <PH title="共同空闲" right={hasPartner ? "❤️ 已连接" : <span style={{fontSize:10, opacity:0.5}}>未导入对方课表</span>} />
      <div className="ft">
        {!hasPartner ? (
          <div style={{fontSize:12, color:"var(--tx3)", textAlign:"center", padding:"20px 0"}}>
            点击课程面板的 ❤️ 导入对方课表<br/>即可查看共同空闲时间
          </div>
        ) : commonFree.length === 0 ? (
          <div style={{fontSize:12, color:"var(--tx3)", textAlign:"center", padding:"20px 0"}}>今天没有重合的空闲时间 😭</div>
        ) : (
          <div className="ft__list">
            {commonFree.map(p => (
              <div key={p.id} className="ft__item">
                <span className="ft__p">第{p.name}节</span>
                <span className="ft__t">{p.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
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
  const { settings, setSettings, courses, setCourses, weekData, setWeekData, ddl, setDdl, todo, setTodo, countdown, setCountdown, notes, setNotes } = useData();
  
  const exportData = async () => {
    if (!window.__TAURI__) {
      // Fallback for browser (might not work well in Tauri)
      const data = { settings, courses, weekData, ddl, todo, countdown, notes };
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `widget-backup.json`;
      a.click(); URL.revokeObjectURL(url);
      return;
    }

    try {
      const { save } = window.__TAURI__.dialog;
      const { writeTextFile } = window.__TAURI__.fs;
      
      const path = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: `widget-backup-${new Date().toISOString().slice(0,10)}.json`
      });

      if (path) {
        const data = { settings, courses, weekData, ddl, todo, countdown, notes };
        await writeTextFile(path, JSON.stringify(data, null, 2));
        alert("备份成功！");
      }
    } catch (e) {
      console.error("Backup failed:", e);
      alert("备份失败，请检查控制台");
    }
  };

  const importData = async () => {
    if (!window.__TAURI__) {
      const input = document.createElement("input");
      input.type = "file"; input.accept = ".json";
      input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = ev => {
          try {
            const data = JSON.parse(ev.target.result);
            if (data.settings) setSettings(data.settings);
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
      return;
    }

    try {
      const { open } = window.__TAURI__.dialog;
      const { readTextFile } = window.__TAURI__.fs;
      
      const selected = await open({
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (selected) {
        const content = await readTextFile(selected);
        const data = JSON.parse(content);
        if (data.settings) setSettings(data.settings);
        if (data.courses) setCourses(data.courses);
        if (data.weekData) setWeekData(data.weekData);
        if (data.ddl) setDdl(data.ddl);
        if (data.todo) setTodo(data.todo);
        if (data.countdown) setCountdown(data.countdown);
        if (data.notes) setNotes(data.notes);
        alert("导入成功！");
      }
    } catch (e) {
      console.error("Import failed:", e);
      alert("导入失败");
    }
  };

  return (
    <div style={{display:"flex",gap:4}}>
      <button className="gb" onClick={exportData} title="导出备份" style={{padding:"2px 6px"}}>📤</button>
      <button className="gb" onClick={importData} title="导入备份" style={{padding:"2px 6px"}}>📥</button>
    </div>
  );
}


// ============================================================
//  TILE REGISTRY
//  Adding a new tile = calling registerTile() at the bottom of
//  its component definition. The Layout renders all tiles
//  automatically; no other changes required.
//
//  registerTile({
//    id       : string          – unique key, used for storage
//    label    : string          – human-readable title shown on hover menus
//    icon     : string          – emoji icon
//    component: React component – the tile's render function
//    defaultW : number          – default width in px  (default: 300)
//    defaultH : number|undefined – default height in px (undefined = auto)
//    defaultPos: { col, row }   – grid hint for initial placement
//  })
// ============================================================

const TILE_REGISTRY = new Map(); // id → tile descriptor

function registerTile({ id, label, icon, component, pages, defaultW = 300, defaultH = undefined, defaultPos = { col: 0, row: 0 } }) {
  TILE_REGISTRY.set(id, { id, label, icon, component, pages, defaultW, defaultH, defaultPos });
}

/* ---- Tile Pager Component ---- */
function TilePager({ tileId, pages }) {
  const { settings, setSettings } = useData();
  const curIdx = settings?.pageIdx?.[tileId] || 0;
  const stageRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [isD, setIsD] = useState(false);

  const setIdx = (i) => {
    setSettings(p => ({ ...p, pageIdx: { ...(p.pageIdx || {}), [tileId]: i } }));
  };

  const onMD = (e) => {
    if (e.target.closest('button, input, textarea, select, a')) return;
    const startX = e.clientX;
    setIsD(true);
    const mm = (ev) => setDragX(ev.clientX - startX);
    const mu = (ev) => {
      setIsD(false);
      const diff = ev.clientX - startX;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && curIdx > 0) setIdx(curIdx - 1);
        else if (diff < 0 && curIdx < pages.length - 1) setIdx(curIdx + 1);
      }
      setDragX(0);
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
    };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
  };

  const xOffset = -curIdx * 100;
  const dragOffset = stageRef.current ? (dragX / stageRef.current.offsetWidth) * 100 : 0;

  return (
    <div className="pg" onMouseDown={onMD}>
      <div className="pg__stage" ref={stageRef}
        style={{ 
          transform: `translateX(${xOffset + dragOffset}%)`,
          transition: isD ? 'none' : 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
        {pages.map((p, i) => (
          <div key={i} className="pg__page">
            <p.component />
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="pg__dots">
          {pages.map((p, i) => (
            <button key={i} className={`pg__dot ${curIdx===i?'on':''}`} 
              onClick={(e) => { e.stopPropagation(); setIdx(i); }} title={p.label} />
          ))}
        </div>
      )}
    </div>
  );
}

function TileManagerBtn() {
  const { setSettings } = useData();
  return (
    <button className="gb" onClick={() => setSettings(p => ({ ...p, showTileManager: true }))} title="管理磁贴" style={{ padding: "2px 6px" }}>🧱</button>
  );
}

function TileManagerModal() {
  const { settings, setSettings } = useData();
  const hidden = settings?.hiddenTiles || [];
  const toggle = (id) => {
    const next = hidden.includes(id) ? hidden.filter(x => x !== id) : [...hidden, id];
    setSettings(p => ({ ...p, hiddenTiles: next }));
  };

  return (
    <div className="tm-modal" onClick={() => setSettings(p => ({ ...p, showTileManager: false }))}>
      <div className="tm-card" onClick={e => e.stopPropagation()}>
        <div className="tm-head"><h3>磁贴展示管理</h3><button onClick={() => setSettings(p => ({ ...p, showTileManager: false }))}>×</button></div>
        <div className="tm-list">
          {[...TILE_REGISTRY.values()].map(tile => {
            const isOff = hidden.includes(tile.id);
            return (
              <div key={tile.id} className={`tm-item ${isOff ? 'off' : ''}`} onClick={() => toggle(tile.id)}>
                <div className="tm-item__info">
                  <span className="tm-item__icon">{tile.icon}</span>
                  <span className="tm-item__label">{tile.label}</span>
                </div>
                <div className="tm-switch"><div className="tm-switch__knob" /></div>
              </div>
            );
          })}
        </div>
        <div className="tm-foot">隐藏组件不会丢失数据，仅在桌面不可见</div>
      </div>
    </div>
  );
}

const AppLauncher = () => {
  const [apps, setApps] = useState(() => {
    const saved = localStorage.getItem('desktop_apps');
    return saved ? JSON.parse(saved) : [
      { name: 'CMD', path: 'cmd.exe' },
      { name: 'Calc', path: 'calc.exe' }
    ];
  });

  useEffect(() => {
    localStorage.setItem('desktop_apps', JSON.stringify(apps));
  }, [apps.length]);

  const getTileStyle = (name) => {
    const colors = [
      ['#ff5f6d', '#ffc371'], ['#2193b0', '#6dd5ed'], 
      ['#ee0979', '#ff6a00'], ['#00b09b', '#96c93d'],
      ['#654ea3', '#eaafc8'], ['#3a1c71', '#ffaf7b']
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const pair = colors[Math.abs(hash) % colors.length];
    return { background: `linear-gradient(135deg, ${pair[0]}, ${pair[1]})` };
  };

  const handleLaunch = async (path) => {
    if (window.__TAURI__) {
      try {
        await window.__TAURI__.core.invoke('launch_app', { path });
      } catch (e) { console.error("Launch failed:", e); }
    }
  };

  const handleAdd = async () => {
    if (window.__TAURI__) {
      try {
        const selected = await window.__TAURI__.dialog.open({
          filters: [{ name: 'Executable', extensions: ['exe', 'lnk'] }]
        });
        if (selected) {
          const name = selected.split(/\\|\//).pop().replace(/\.(exe|lnk)$/i, '');
          setApps([...apps, { name, path: selected }]);
        }
      } catch (e) { console.error("Dialog error:", e); }
    }
  };

  return (
    <Panel>
      <div className="flex justify-between items-center mb-3 px-1">
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--tx3)', opacity: 0.6 }}>Launchpad</span>
        <button onClick={handleAdd} className="w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg transition-all border-0 outline-none active:scale-90 cursor-pointer">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" style={{ color: 'var(--tx2)' }}><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-y-4 gap-x-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {apps.map((app, i) => (
          <button
            key={i}
            onClick={() => handleLaunch(app.path)}
            className="group flex flex-col items-center border-0 outline-none bg-transparent p-0 cursor-pointer"
            style={{ border: 'none', outline: 'none', background: 'transparent' }}
          >
            <div className="w-12 h-12 rounded-[18px] shadow-xl flex items-center justify-center mb-1.5 group-hover:scale-110 group-active:scale-95 transition-all duration-300"
                 style={{ ...getTileStyle(app.name), border: 'none', boxShadow: '0 10px 20px -5px rgba(0,0,0,0.3)' }}>
              <span className="text-xl font-black uppercase select-none" style={{ color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                {app.name.charAt(0)}
              </span>
            </div>
            <span className="text-[9px] font-bold truncate w-full text-center uppercase tracking-wider transition-all"
                  style={{ color: 'var(--tx3)' }}>
              {app.name}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
};

// Build default positions from registry data. Called lazily inside Layout.
function buildDefaultPos(headerH) {
  const COLS = [16, 332, 648, 964];
  const ROW_H = 340;
  const pos = {};
  for (const [id, tile] of TILE_REGISTRY) {
    const col = Math.min(tile.defaultPos.col ?? 0, COLS.length - 1);
    const row = tile.defaultPos.row ?? 0;
    pos[id] = { x: COLS[col], y: headerH + 16 + row * ROW_H, w: tile.defaultW, h: tile.defaultH };
  }
  return pos;
}

registerTile({ 
  id: "CourseSchedule", label: "课程日程", icon: "🗓️", 
  pages: [
    { label: "今日课程", component: Courses },
    { label: "本周概览", component: WeekStrip }
  ],
  defaultW: 300, defaultPos: { col: 0, row: 0 } 
});
registerTile({ id: "DDLBoard",   label: "截止日期",    icon: "⏰", component: DDLBoard,   defaultW: 300, defaultPos: { col: 2, row: 0 } });
registerTile({ id: "Countdowns", label: "自定义倒计时", icon: "🎯", component: Countdowns, defaultW: 300, defaultPos: { col: 0, row: 1 } });
registerTile({ id: "TodoList",   label: "待办事项",    icon: "✅", component: TodoList,   defaultW: 300, defaultPos: { col: 1, row: 1 } });
registerTile({ id: "Pomodoro",   label: "番茄钟",      icon: "🍅", component: Pomodoro,   defaultW: 240, defaultPos: { col: 2, row: 1 } });
registerTile({ id: "Atmosphere", label: "氛围感",      icon: "🌊", component: Atmosphere, defaultW: 240, defaultPos: { col: 2, row: 2 } });
registerTile({ id: "AppLauncher", label: "快速启动", icon: "🚀", component: AppLauncher, defaultW: 240, defaultPos: { col: 1, row: 2 } });
registerTile({ id: "BEVHUD", label: "自动驾驶幻境", icon: "🛸", component: BEVHUD, defaultW: 300, defaultH: 300, defaultPos: { col: 3, row: 1 } });
registerTile({ id: "FreeTime", label: "共同空闲", icon: "❤️", component: FreeTime, defaultW: 300, defaultPos: { col: 2, row: 2 } });
registerTile({ 
  id: "ResearchFeed", label: "科研动态", icon: "🧬", 
  pages: [
    { label: "最新论文", component: ResearchFeed },
    { label: "订阅配置", component: ResearchSettings }
  ],
  defaultW: 340, defaultH: 420, defaultPos: { col: 3, row: 0 } 
});

function ResearchFeed() {
  const { settings } = useData();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchLock = useRef(false);

  const keywords = useMemo(() => 
    settings?.research?.keywords || ["Scene Graph", "Autonomous Driving"], 
    [settings?.research?.keywords]
  );

  const fetchArxiv = useCallback(async () => {
    if (fetchLock.current) return;
    fetchLock.current = true;
    setLoading(true);
    setError(null);
    try {
      if (!keywords || keywords.length === 0) {
        setPapers([]);
        return;
      }
      
      const q = keywords.map(k => `abs:"${k.trim()}"`).join("+OR+");
      const baseUrl = `https://export.arxiv.org/api/query?search_query=${q}&sortBy=submittedDate&sortOrder=descending&max_results=${settings?.research?.maxResults || 10}`;
      
      let text = "";
      
      // Aggressive Tauri API detection
      const tauri = window.__TAURI__ || window.__TAURI_INTERNALS__;
      const invoker = tauri?.core?.invoke || tauri?.invoke;

      if (invoker) {
        try {
          text = await invoker('fetch_url', { url: baseUrl });
        } catch (e) {
          console.error("[ArXiv] Native fetch failed:", e);
        }
      }

      if (!text) {
        // Fallback: Using a different, usually more stable proxy
        const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(baseUrl)}`);
        text = await response.text();
      }

      if (!text || text.includes("Oops...") || text.includes("Timeout")) throw new Error("获取内容失败或服务器繁忙");

      // Handle Base64 wrapper if proxy returned it (safeguard)
      if (text.startsWith("data:")) {
        try {
          const b64 = text.split(",")[1];
          text = new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
        } catch (e) { console.error("[ArXiv] B64 decode error:", e); }
      }

      const parser = new DOMParser();
      const xml = parser.parseFromString(text.trim(), "text/xml");
      
      const parseError = xml.getElementsByTagName("parsererror");
      if (parseError.length > 0) throw new Error("XML 解析失败");

      const entries = Array.from(xml.getElementsByTagName("entry"));

      const parsed = entries.map(entry => {
        const getTagContent = (tagName) => entry.getElementsByTagName(tagName)[0]?.textContent || "";
        const getLink = (rel) => {
          const links = Array.from(entry.getElementsByTagName("link"));
          const target = links.find(l => l.getAttribute("title") === rel || l.getAttribute("type") === "application/pdf") ;
          return target?.getAttribute("href") || links[0]?.getAttribute("href");
        };

        return {
          id: getTagContent("id"),
          title: getTagContent("title").replace(/\n/g, " ").trim(),
          summary: getTagContent("summary").replace(/\n/g, " ").trim().substring(0, 150) + "...",
          authors: Array.from(entry.getElementsByTagName("author")).map(a => a.getElementsByTagName("name")[0]?.textContent).join(", "),
          link: getLink("pdf"),
          published: new Date(getTagContent("published")).toLocaleDateString()
        };
      });
      setPapers(parsed);
    } catch (e) {
      console.error("[ArXiv] Fetch Error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
      fetchLock.current = false;
    }
  }, [keywords, settings?.research?.maxResults]);

  useEffect(() => { fetchArxiv(); }, [fetchArxiv]);

  return (
    <Panel>
      <PH title="科研动态" right={<button className="gb" onClick={fetchArxiv}>{loading ? "..." : "刷新"}</button>} />
      <div className="rsf">
        {loading && papers.length === 0 && <div className="rsf__msg">正在同步 arXiv 数据库...</div>}
        {error && <div className="rsf__msg" style={{color:'var(--red)'}}>❌ 出错了: {error}<br/><small style={{fontSize:9}}>请检查调试控制台 (F12)</small></div>}
        {!loading && !error && papers.length === 0 && <div className="rsf__msg">未发现相关动态，请检查订阅关键词。</div>}
        {papers.map((p, i) => (
          <a key={i} href={p.link} target="_blank" rel="noopener noreferrer" className="paper">
            <div className="paper__t">{p.title}</div>
            <div className="paper__a">{p.authors}</div>
            <div className="paper__s">{p.summary}</div>
            <div className="paper__f">
              <span className="paper__d">{p.published}</span>
              <span className="paper__tag">arXiv</span>
            </div>
          </a>
        ))}
      </div>
    </Panel>
  );
}

function BEVHUD() {
  const canvasRef = useRef(null);
  const { dark } = useTheme();
  const { settings } = useData();
  const weather = settings?.weather?.city; // Basic trigger for weather-based visuals

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frameId;

    // Simulation Data
    const lanes = [{ x: 50 }, { x: 150 }, { x: 250 }];
    let laneOffset = 0;
    const obstacles = [
      { id: 1, x: 140, y: 50, w: 20, h: 36, speed: 1.2, color: '#4a7fd8' },
      { id: 2, x: 60, y: 180, w: 18, h: 32, speed: 0.8, color: '#3ba868' }
    ];
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * 300, y: Math.random() * 300, s: Math.random() * 2 + 1
    }));

    const draw = () => {
      ctx.clearRect(0, 0, 300, 300);
      const accent = dark ? '#6a9de8' : '#4a7fd8';
      const secondary = dark ? '#a0a098' : '#9c9c96';
      const bg = dark ? '#191918' : '#f4f3ef';

      // 1. Draw Grid / Lanes
      laneOffset = (laneOffset + 2) % 60;
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
      ctx.setLineDash([20, 40]);
      lanes.forEach(l => {
        ctx.beginPath();
        ctx.moveTo(l.x, 0);
        ctx.lineTo(l.x, 300);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // 2. Draw Ego car (Static Center)
      ctx.fillStyle = accent;
      ctx.beginPath();
      // Round rect for car
      const r = 4;
      ctx.moveTo(140 + r, 240);
      ctx.lineTo(160 - r, 240);
      ctx.quadraticCurveTo(160, 240, 160, 240 + r);
      ctx.lineTo(160, 276 - r);
      ctx.quadraticCurveTo(160, 276, 160 - r, 276);
      ctx.lineTo(140 + r, 276);
      ctx.quadraticCurveTo(140, 276, 140, 276 - r);
      ctx.lineTo(140, 240 + r);
      ctx.quadraticCurveTo(140, 240, 140 + r, 240);
      ctx.fill();
      
      // Ego highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 3. Draw perception boxes (Obstacles)
      obstacles.forEach(o => {
        o.y += o.speed;
        if (o.y > 320) {
          o.y = -50;
          o.x = lanes[Math.floor(Math.random() * 3)].x - 10;
        }
        
        // Draw box
        ctx.fillStyle = `${o.color}33`; // Alpha
        ctx.strokeStyle = o.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.fillRect(o.x, o.y, o.w, o.h);

        // Draw relationship lines (Scene Graph Mock)
        if (Math.abs(o.y - 150) < 50) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(212,138,59,0.3)';
          ctx.moveTo(150, 258);
          ctx.lineTo(o.x + 10, o.y + o.h/2);
          ctx.stroke();
          // tag
          ctx.fillStyle = 'rgba(212,138,59,0.6)';
          ctx.font = '8px monospace';
          ctx.fillText('IN_ZONE', (150 + o.x)/2 + 10, (258 + o.y)/2);
        }
      });

      // 4. Radar Noise (The "Vibe")
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
      particles.forEach(p => {
        p.y = (p.y + p.s) % 300;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. HUD overlay text
      ctx.fillStyle = secondary;
      ctx.font = '9px monospace';
      ctx.fillText('SENSOR: ACTIVE', 10, 20);
      ctx.fillText(`OBJS: ${obstacles.length}`, 10, 32);
      ctx.fillText(`FPS: 30`, 10, 44);

      frameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frameId);
  }, [dark]);

  return (
    <Panel style={{ padding: 0, position: 'relative' }}>
      <PH title="自动驾驶幻境" style={{ position: 'absolute', top: 14, left: 16, zIndex: 10, pointerEvents: 'none' }} />
      <canvas ref={canvasRef} width="300" height="300" style={{ display: 'block', width: '100%', height: '100%' }} />
      <div className="bev__overlay">
        <span className="bev__tag">EGO_STATUS: NOMINAL</span>
      </div>
    </Panel>
  );
}
function ResearchSettings() {
  const { settings, setSettings } = useData();
  const [input, setInput] = useState("");
  const keywords = settings?.research?.keywords || [];

  const add = () => {
    if (!input.trim() || keywords.includes(input.trim())) return;
    setSettings(p => ({
      ...p,
      research: { ...p.research, keywords: [...keywords, input.trim()] }
    }));
    setInput("");
  };

  const remove = (k) => {
    setSettings(p => ({
      ...p,
      research: { ...p.research, keywords: keywords.filter(x => x !== k) }
    }));
  };

  return (
    <Panel>
      <PH title="订阅配置" />
      <div className="ti" style={{ marginBottom: 10 }}>
        <input 
          placeholder="输入 arXiv 关键词并回车..." 
          value={input} 
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
        />
      </div>
      <div className="rt" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div className="rt__l" style={{ fontSize: 11, marginBottom: 8, opacity: 0.7 }}>当前关注领域：</div>
        <div className="rt__tags" style={{ flex: 1, overflowY: 'auto', alignContent: 'flex-start' }}>
          {keywords.map(k => (
            <span key={k} className="rt__tag">
              {k}
              <button onClick={() => remove(k)}>×</button>
            </span>
          ))}
          {keywords.length === 0 && <div style={{fontSize:11, color:'var(--tx3)', padding: '10px 0'}}>暂无订阅，请添加关键词</div>}
        </div>
        <div style={{marginTop:12, pt: 8, borderTop: '1px dashed var(--bd)', fontSize: 10, color:'var(--tx3)', lineHeight: 1.4, opacity: 0.8}}>
          💡 建议使用 "Scene Graph" 等精准词组。支持多项订阅，系统将自动汇总最新动态。
        </div>
      </div>
    </Panel>
  );
}

function Layout() {
  const { dark } = useTheme();
  const { settings, setSettings } = useData();
  const HEADER_H = 130;
  const p0 = settings?.pos;

  // Merge stored positions with registry defaults (new tiles auto-appear)
  const pos = useMemo(() => {
    const defaults = buildDefaultPos(HEADER_H);
    const merged = { ...defaults, ...(p0 || {}) };
    // Safety: clamp Y above header, fill missing w from registry
    const out = {};
    for (const [id, tile] of TILE_REGISTRY) {
      const stored = merged[id] || defaults[id];
      out[id] = {
        ...stored,
        y: Math.max(HEADER_H, stored.y || 0),
        w: stored.w || tile.defaultW || 300,
        h: stored.h,
      };
    }
    return out;
  }, [p0]);

  const containerRef = useRef(null);
  const [active, setActive] = useState(null);

  const startDrag = (e, id) => {
    if (e.target.closest('button, input, textarea, select, a, .fc__rsz')) return;
    e.preventDefault();
    const { x: ox, y: oy } = pos[id] || { x: 0, y: 0 };
    const sx = e.clientX, sy = e.clientY;
    let nx = ox, ny = oy;
    setActive(id);
    const el = e.currentTarget.closest('.fc');
    if (el) el.style.zIndex = 100;

    const move = (ev) => {
      const c = containerRef.current;
      if (!c || !el) return;
      nx = Math.max(0, Math.min(ox + ev.clientX - sx, c.clientWidth - el.offsetWidth));
      ny = Math.max(HEADER_H, Math.min(oy + ev.clientY - sy, c.clientHeight - el.offsetHeight));
      el.style.left = nx + 'px';
      el.style.top  = ny + 'px';
    };
    const up = () => {
      if (el) el.style.zIndex = '';
      setActive(null);
      setSettings(p => ({ ...p, pos: { ...(p.pos || pos), [id]: { ...(p.pos?.[id] || pos[id]), x: nx, y: ny } } }));
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const startResize = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget.closest('.fc');
    if (!el) return;
    const { w: ow, h: oh } = pos[id] || { w: 300 };
    const currentH = oh || el.offsetHeight;
    const sx = e.clientX, sy = e.clientY;
    let nw = ow, nh = currentH;
    setActive(id);

    const move = (ev) => {
      nw = Math.max(200, ow + ev.clientX - sx);
      nh = Math.max(100, currentH + ev.clientY - sy);
      el.style.width = nw + 'px';
      el.style.height = nh + 'px';
    };
    const up = () => {
      setActive(null);
      setSettings(p => ({ ...p, pos: { ...(p.pos || pos), [id]: { ...(p.pos?.[id] || pos[id]), w: nw, h: nh } } }));
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
          <Hito/>
          <div className="topbar__r">
            <BackupRestore/>
            <TileManagerBtn />
            <ThemeToggle/>
          </div>
        </div>
        <Summary/>
      </div>
      <div className="freecanvas">
        {[...TILE_REGISTRY.values()]
          .filter(tile => !settings?.hiddenTiles?.includes(tile.id))
          .map(tile => {
          const { id, label, icon, component: Comp, pages } = tile;
          const p = pos[id] || { x: 0, y: HEADER_H + 16, w: 300 };
          return (
            <div key={id} className={`fc${active===id?' fc--active':''}`}
              style={{ left: p.x, top: p.y, width: p.w, height: p.h || 'auto' }}
            >
              <div className="fc__handle" onMouseDown={e=>startDrag(e,id)} title={`${icon} ${label}`}>
                <span className="fc__dots">⠿</span>
                <span className="fc__label">{icon} {label}</span>
              </div>
              {pages ? <TilePager tileId={id} pages={pages} /> : <Comp />}
              <div className="fc__rsz" onMouseDown={e=>startResize(e,id)} title="调整大小" />
            </div>
          );
        })}
      </div>
      <StickyNotes/>
      {settings?.showTileManager && <TileManagerModal />}
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
.clk__d{font-size:12px;color:var(--tx2);margin-top:2px;display:flex;align-items:center}
.clk__lunar{font-size:10px;color:var(--ac);background:rgba(74,127,216,0.1);padding:0px 5px;border-radius:4px;margin-left:8px;font-weight:600;letter-spacing:0.5px}

/* hito */
.hito{
  flex: 1; 
  padding: 0 20px;
  max-width: 500px;
  font-size: 12px;
  color: var(--tx2);
  line-height: 1.6;
  cursor: pointer;
  text-align: center;
  transition: color 0.2s;
  opacity: 0.85;
}
.hito:hover{color:var(--tx); opacity: 1;}
.hito__f{display:inline-block;font-size:11px;color:var(--tx3);margin-left:8px}

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
  display: flex; flex-direction: column;
  height: 100%; width: 100%;
  overflow: hidden;
}
.p:hover{box-shadow:var(--shadow-hover)}

/* Allow content inside p to scroll if height is fixed */
.p > *:not(.ph) {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
/* custom scrollbar for cards */
.p > *:not(.ph)::-webkit-scrollbar { width: 4px; }
.p > *:not(.ph)::-webkit-scrollbar-thumb { background: var(--bd2); border-radius: 2px; }

/* pager */
.pg { position: relative; width: 100%; height: 100%; overflow: hidden; display: flex; flex-direction: column; }
.pg__stage { display: flex; transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); height: 100%; width: 100%; }
.pg__page { min-width: 100%; flex-shrink: 0; height: 100%; overflow: hidden; }
.pg__dots { 
  display: flex; justify-content: center; gap: 6px; 
  padding: 4px 10px; border-radius: 10px;
  position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%);
  z-index: 5; pointer-events: all;
  opacity: 0.1; transition: opacity 0.2s;
  background: var(--card); box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.pg:hover .pg__dots { opacity: 1; }
.pg__dot { 
  width: 6px; height: 6px; border-radius: 3px; border: none; 
  background: var(--bd2); cursor: pointer; transition: all 0.2s; 
}
.pg__dot.on { background: var(--ac); width: 14px; }
.pg__dot:hover { background: var(--tx3); }

/* pomodoro */
.pomo { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 5px 0 10px; }
.pomo__display { cursor: pointer; text-align: center; width: 100%; padding: 15px 0; border-radius: var(--rs); transition: background 0.2s; }
.pomo__display:hover { background: rgba(128,128,128,0.05); }
.pomo__time { font-family: var(--fm); font-size: 48px; font-weight: 500; color: var(--tx); line-height: 1; }
.pomo__status { font-size: 13px; color: var(--tx2); margin-top: 8px; }
.sb--stop { background: var(--red) !important; }
.p--flash { animation: pomo-flash 2.5s infinite ease-in-out; }
@keyframes pomo-flash { 0% { background: var(--card); } 50% { background: var(--ac); opacity: 0.15; } 100% { background: var(--card); } }

/* atmosphere */
.atm { display: flex; flex-direction: column; gap: 12px; }
.atm__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.atm__btn {
  display: flex; flex-direction: column; align-items: center; gap: 4px; border: 1px solid var(--bd); 
  border-radius: var(--rs); background: var(--bg); padding: 8px 0; cursor: pointer; transition: all 0.2s;
}
.atm__btn:hover { border-color: var(--ac); background: rgba(128,128,128,0.03); }
.atm__btn.on { background: rgba(74,127,216,0.08); border-color: var(--ac); }
.atm__icon { font-size: 18px; }
.atm__name { font-size: 10px; color: var(--tx2); }
.atm__btn.on .atm__name { color: var(--ac); font-weight: 500; }

.atm__ctrl { display: flex; align-items: center; gap: 8px; padding: 0 4px; }
.atm__vol { flex: 1; height: 3px; accent-color: var(--ac); cursor: pointer; }

.atm__music { 
  display: flex; align-items: center; gap: 10px; padding: 8px 10px; 
  background: rgba(128,128,128,0.04); border-radius: var(--rs); border: 1px dashed var(--bd);
}
.atm__m-icon { font-size: 16px; opacity: 0.5; }
.atm__m-info { flex: 1; min-width: 0; }
.atm__m-tit { font-size: 11px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.atm__m-sub { font-size: 9.5px; color: var(--tx3); }

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
  pointer-events: all;
  transition: box-shadow 0.15s;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.fc--active { z-index: 50 !important; }
.fc--active .p { box-shadow: 0 8px 32px rgba(0,0,0,0.15), 0 0 0 1.5px var(--ac); }

.fc__rsz {
  position: absolute; right: 0; bottom: 0; width: 14px; height: 14px;
  cursor: nwse-resize; opacity: 0; transition: opacity 0.2s;
  background: linear-gradient(135deg, transparent 50%, var(--tx3) 50%);
  border-radius: 0 0 var(--rs) 0;
}
.fc:hover .fc__rsz { opacity: 0.5; }
.fc__rsz:hover { opacity: 1 !important; }

/* drag handle on each card */
.fc__handle {
  display: flex; align-items: center; justify-content: center;
  height: 18px; margin-bottom: 2px;
  cursor: grab; opacity: 0.1; transition: all 0.2s;
  border-radius: var(--rs) var(--rs) 0 0;
  background: var(--bd);
}
.fc:hover .fc__handle { opacity: 0.8; background: var(--bd2); }
.fc__handle:active { cursor: grabbing; background: var(--ac); opacity: 1; }
.fc__dots { font-size: 13px; color: var(--tx2); user-select: none; letter-spacing: 2px; }
.fc__label { font-size: 11px; color: var(--tx2); user-select: none; margin-left: 6px; opacity: 0; transition: opacity 0.2s; white-space: nowrap; }
.fc:hover .fc__label { opacity: 1; }


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

/* week compact */
.wk{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.wk__d{text-align:center;padding:6px 1px 8px;border-radius:var(--rs)}
.wk__d.cur{background:rgba(74,127,216,.08);box-shadow:inset 0 0 0 1px rgba(74,127,216,0.1)}
.wk__l{font-size:10px;color:var(--tx3);display:block;margin-bottom:5px;font-weight:500}
.wk__ps{display:flex;flex-direction:column;align-items:center;gap:3px;min-height:20px;justify-content:center}
.wk__p{width:6px;height:6px;border-radius:1.5px;transition:transform .15s}
.wk__p:hover{transform:scale(1.8);z-index:10}
.wk__empty{font-size:10px;color:var(--tx3);opacity:0.3}

/* week expanded (wide mode) */
.wk--full{gap:4px}
.wk__d--full{padding:6px 3px 8px;text-align:left}
.wk__ps--full{align-items:stretch;gap:4px}
.wk__fc{
  border-left:2.5px solid var(--ac);
  border-radius:0 var(--rs) var(--rs) 0;
  padding:4px 6px;
  background:var(--bg);
  font-size:10px;line-height:1.4;
  transition:background .15s;
}
.wk__fc:hover{background:rgba(128,128,128,.06)}
.wk__fc.on{background:rgba(74,127,216,.1)}
.wk__fn{display:block;font-weight:500;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wk__ft{display:block;color:var(--tx3);font-size:9.5px;font-family:var(--fm)}
.wk__fl{display:block;color:var(--tx3);font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

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

/* research feed */
.rsf { display: flex; flex-direction: column; gap: 8px; }
.rsf__msg { text-align: center; padding: 20px 0; color: var(--tx3); font-size: 12px; }
.paper { 
  display: block; text-decoration: none; color: inherit; 
  padding: 12px; border-radius: var(--rs); background: var(--bg);
  border: 1px solid transparent; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.paper:hover { 
  background: var(--card); border-color: var(--ac); 
  transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); 
}
.paper__t { font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--tx); margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.paper__a { font-size: 11px; color: var(--tx2); margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.paper__s { font-size: 11px; color: var(--tx3); line-height: 1.5; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.paper__f { display: flex; justify-content: space-between; align-items: center; }
.paper__d { font-size: 10px; color: var(--tx3); font-family: var(--fm); }
.paper__tag { font-size: 9px; font-weight: 700; color: var(--ac); background: rgba(74,127,216,0.1); padding: 1px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; }

/* research settings */
.rt { display: flex; flex-direction: column; gap: 10px; }
.rt__l { font-size: 12px; font-weight: 500; color: var(--tx2); }
.rt__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.rt__tag { 
  display: flex; align-items: center; gap: 4px; padding: 3px 8px; 
  background: var(--bg); border: 1px solid var(--bd); border-radius: 6px; 
  font-size: 11px; color: var(--tx); 
}
.rt__tag button { 
  background: none; border: none; font-size: 14px; color: var(--tx3); 
  cursor: pointer; padding: 0; line-height: 1; 
}
.rt__tag button:hover { color: var(--red); }

/* BEV HUD */
.bev__overlay { position: absolute; bottom: 12px; right: 12px; pointer-events: none; }
.bev__tag { 
  font-family: var(--fm); font-size: 8px; color: var(--ac); 
  background: rgba(74,127,216,0.1); padding: 2px 6px; border-radius: 4px; 
  letter-spacing: 0.5px; text-transform: uppercase;
}

/* common free time */
.ft { display: flex; flex-direction: column; gap: 8px; justify-content: center; height: 100%; }
.ft__list { display: flex; flex-direction: column; gap: 4px; }
.ft__item { 
  display: flex; align-items: center; justify-content: space-between; 
  padding: 8px 12px; background: var(--bg); border-radius: var(--rs);
  border: 1px solid var(--bd); transition: all 0.2s;
}
.ft__item:hover { border-color: var(--ac); background: var(--card); transform: translateX(2px); }
.ft__p { font-size: 11px; font-weight: 600; color: var(--tx); }
.ft__t { font-size: 11px; color: var(--tx3); font-family: var(--fm); }

/* responsive */
@media(max-width:860px){.grid{grid-template-columns:1fr}.topbar{flex-direction:column;align-items:flex-start;gap:10px}.topbar__r{align-self:flex-end}}
      `}</style>
      <Layout />
      <style>{`
/* Tile Manager */
.tm-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.3); backdrop-filter: blur(25px); z-index: 99999; display: flex; align-items: center; justify-content: center; animation: tm-fade 0.3s ease; }
@keyframes tm-fade { from { opacity: 0; } to { opacity: 1; } }
.tm-card { 
  background: var(--card); border: 1px solid var(--bd2); border-radius: 24px; width: 320px; 
  box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; 
  animation: tm-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  backdrop-filter: blur(40px);
}
@keyframes tm-pop { from { transform: scale(0.9) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
.tm-head { padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--bd); background: rgba(128,128,128,0.03); }
.tm-head h3 { font-size: 16px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
.tm-head button { background: var(--bd); border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: none; font-size: 18px; color: var(--tx2); cursor: pointer; transition: all 0.2s; }
.tm-head button:hover { background: var(--bd2); transform: rotate(90deg); }
.tm-list { padding: 12px; max-height: min(480px, 60vh); overflow-y: auto; display: grid; grid-template-columns: 1fr; gap: 4px; }
.tm-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 14px; cursor: pointer; transition: all 0.2s ease; border: 1px solid transparent; }
.tm-item:hover { background: rgba(128,128,128,0.06); border-color: var(--bd); transform: translateX(2px); }
.tm-item.off { opacity: 0.6; grayscale: 0.5; }
.tm-item__info { display: flex; align-items: center; gap: 12px; }
.tm-item__icon { font-size: 18px; background: rgba(128,128,128,0.08); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 10px; }
.tm-item__label { font-size: 13.5px; font-weight: 600; color: var(--tx); }
.tm-switch { width: 38px; height: 20px; border-radius: 10px; background: linear-gradient(135deg, #4a7fd8, #6a9de8); position: relative; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); }
.tm-item.off .tm-switch { background: var(--bd2); box-shadow: none; }
.tm-switch__knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 8px; background: white; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.tm-item.off .tm-switch__knob { transform: translateX(0); }
.tm-item:not(.off) .tm-switch__knob { transform: translateX(18px); }
.tm-foot { padding: 14px; font-size: 11px; color: var(--tx3); text-align: center; border-top: 1px solid var(--bd); font-weight: 500; opacity: 0.7; }
      `}</style>
      </DataProvider>
    </ThemeProvider>
  );
}
