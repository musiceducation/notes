(function() {
    // ==========================================
    // 核心設定
    // ==========================================
    const CONFIG = {
        // GAS API (needs to be accessible to all)
        API_URL: "https://script.google.com/macros/s/AKfycbwBIO95w0KfMxDSjqMza6PyEHxL5iTH-JvEli5_pfopX6GL4Kxnm4BdW5nZMwLU6wU/exec",
        
        NOTE_FREQUENCIES: {
            'C2':65.41,'D2':73.42,'E2':82.41,'F2':87.31,'G2':98.00,'A2':110.00,'B2':123.47,
            'C3':130.81,'D3':146.83,'E3':164.81,'F3':174.61,'G3':196.00,'A3':220.00,'B3':246.94,
            'C4':261.63,'D4':293.66,'E4':329.63,'F4':349.23,'G4':392.00,'A4':440.00,'B4':493.88,
            'C5':523.25,'D5':587.33,'E5':659.25,'F5':698.46,'G5':783.99,'A5':880.00,'B5':987.77,
            'C#2':69.30,'D#2':77.78,'F#2':92.50,'G#2':103.83,'A#2':116.54,
            'C#3':138.59,'D#3':155.56,'F#3':185.00,'G#3':207.65,'A#3':233.08,
            'C#4':277.18,'D#4':311.13,'F#4':369.99,'G#4':415.30,'A#4':466.16,
            'C#5':554.37,'D#5':622.25,'F#5':739.99,'G#5':830.61,'A#5':932.33,
            'D♭2':69.30,'E♭2':77.78,'G♭2':92.50,'A♭2':103.83,'B♭2':116.54,
            'D♭3':138.59,'E♭3':155.56,'G♭3':185.00,'A♭3':207.65,'B♭3':233.08,
            'D♭4':277.18,'E♭4':311.13,'G♭4':369.99,'A♭4':415.30,'B♭4':466.16,
            'D♭5':554.37,'E♭5':622.25,'G♭5':739.99,'A♭5':830.61,'B♭5':932.33,
        }
    };

    // Named constants (extracted from magic numbers)
    const SLOW_ANSWER_MS = 4000;
    const STAFF_LEFT_PAD_NARROW = 30;
    const STAFF_LEFT_PAD_WIDE = 50;
    const MAX_CONFETTI = 25;
    const COMBO_CONFETTI_INTERVAL = 5;

    function isAppShell() {
        try {
            const C = window.Capacitor;
            if (C && typeof C.isNativePlatform === 'function' && C.isNativePlatform()) return true;
            if (C && typeof C.getPlatform === 'function' && C.getPlatform() !== 'web') return true;
        } catch (e) {}
        // Dev override: ?app=1 or localStorage
        try {
            if (new URLSearchParams(location.search).get('app') === '1') return true;
            if (localStorage.getItem('forceAppShell') === '1') return true;
        } catch (e) {}
        return false;
    }

    function getAppPlayerUser() {
        const social = window.MusicAppAuth && window.MusicAppAuth.user;
        const name =
            (social && social.displayName) ||
            localStorage.getItem('appPlayerName') ||
            '學生';
        return { name, grade: 0, class: 'App', seat: '' };
    }

    const MODE_CONFIG = {
        practice: { name:'練習模式', type:'practice', duration:Infinity, maxWrong:Infinity, scoreMulti:0 },
        classic60:{ name:'高音譜號挑戰', type:'challenge', duration:60, maxWrong:Infinity, scoreMulti:1, forceClef:'treble' },
        bass60:   { name:'低音譜號挑戰', type:'challenge', duration:60, maxWrong:Infinity, scoreMulti:1, forceClef:'bass' },
        mixed60:  { name:'混合譜號挑戰', type:'challenge', duration:60, maxWrong:Infinity, scoreMulti:1.2, forceClef:'mixed' },
        noMiss:   { name:'零失誤挑戰', type:'challenge', duration:Infinity, maxWrong:1, scoreMulti:1.5 },
        keysig_practice:  { name:'調號練習', type:'practice', duration:Infinity, maxWrong:Infinity, scoreMulti:0, gameType:'keysig' },
        keysig60:         { name:'調號挑戰', type:'challenge', duration:60, maxWrong:Infinity, scoreMulti:1, gameType:'keysig' },
        solfege_practice: { name:'唱名練習', type:'practice', duration:Infinity, maxWrong:Infinity, scoreMulti:0, gameType:'solfege' },
        solfege60:        { name:'唱名挑戰', type:'challenge', duration:60, maxWrong:Infinity, scoreMulti:1, gameType:'solfege' }
    };

    const TEXTBOOK_CONFIG = {
        1: { clef:['treble'], accidentalChance:0,    noteRange:[0,4],  ledgerAbove:false, ledgerBelow:false },
        2: { clef:['treble'], accidentalChance:0,    noteRange:[0,7],  ledgerAbove:false, ledgerBelow:false },
        3: { clef:['treble'], accidentalChance:0.1,  noteRange:[0,9],  ledgerAbove:false, ledgerBelow:false },
        4: { clef:['treble','bass'], accidentalChance:0.15, noteRange:[0,11], ledgerAbove:true,  ledgerBelow:false },
        5: { clef:['treble','bass'], accidentalChance:0.25, noteRange:[0,12], ledgerAbove:true,  ledgerBelow:true },
        6: { clef:['treble','bass'], accidentalChance:0.4,  noteRange:[0,12], ledgerAbove:true,  ledgerBelow:true }
    };

    // Per-clef, per-grade challenge levels (P1–P6)
    // Bass MAPS: G2(0) A2(1) B2(2) C3(3) D3(4) E3(5) F3(6) G3(7) A3(8) B3(9) C4(10)
    const CHALLENGE_LEVELS = {
        treble: {
            1: { noteRange:[0,12], accidentalChance:0.4,  ledgerAbove:true,  ledgerBelow:true },
            2: { noteRange:[0,12], accidentalChance:0.4,  ledgerAbove:true,  ledgerBelow:true },
            3: { noteRange:[0,9],  accidentalChance:0.1,  ledgerAbove:false, ledgerBelow:false },
            4: { noteRange:[0,11], accidentalChance:0.15, ledgerAbove:true,  ledgerBelow:false },
            5: { noteRange:[0,12], accidentalChance:0.25, ledgerAbove:true,  ledgerBelow:true },
            6: { noteRange:[0,12], accidentalChance:0.4,  ledgerAbove:true,  ledgerBelow:true }
        },
        bass: {
            1: { noteRange:[0,10], accidentalChance:0.4,  ledgerAbove:true,  ledgerBelow:true },
            2: { noteRange:[0,10], accidentalChance:0.4,  ledgerAbove:true,  ledgerBelow:true },
            3: { noteRange:[1,9],  accidentalChance:0.1,  ledgerAbove:false, ledgerBelow:false },
            4: { noteRange:[0,10], accidentalChance:0.15, ledgerAbove:false, ledgerBelow:true },
            5: { noteRange:[0,10], accidentalChance:0.25, ledgerAbove:true,  ledgerBelow:true },
            6: { noteRange:[0,10], accidentalChance:0.4,  ledgerAbove:true,  ledgerBelow:true }
        }
    };

    const SOLFEGE = {C:'Do',D:'Re',E:'Mi',F:'Fa',G:'Sol',A:'La',B:'Si'};
    const noteSol = n => { const b = SOLFEGE[n.letter]; if (!b) return ''; return b + (n.accidental==='#'?'♯':n.accidental==='♭'?'♭':''); };

    // ==========================================
    // 調號辨別 + 唱名辨別 資料
    // ==========================================
    const KEY_SIGNATURES = [
        { id:'C',  name:'C大調',  sharps:0, flats:0, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-0n.png', grade:1,
          sharpNotes:[], flatNotes:[], scale:['C','D','E','F','G','A','B'] },
        { id:'G',  name:'G大調',  sharps:1, flats:0, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-1s.png', grade:1,
          sharpNotes:['F'], flatNotes:[], scale:['G','A','B','C','D','E','F#'] },
        { id:'F',  name:'F大調',  sharps:0, flats:1, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-1f.png', grade:1,
          sharpNotes:[], flatNotes:['B'], scale:['F','G','A','B♭','C','D','E'] },
        { id:'D',  name:'D大調',  sharps:2, flats:0, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-2s.png', grade:3,
          sharpNotes:['F','C'], flatNotes:[], scale:['D','E','F#','G','A','B','C#'] },
        { id:'Bb', name:'B♭大調', sharps:0, flats:2, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-2f.png', grade:3,
          sharpNotes:[], flatNotes:['B','E'], scale:['B♭','C','D','E♭','F','G','A'] },
        { id:'A',  name:'A大調',  sharps:3, flats:0, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-3s.png', grade:4,
          sharpNotes:['F','C','G'], flatNotes:[], scale:['A','B','C#','D','E','F#','G#'] },
        { id:'Eb', name:'E♭大調', sharps:0, flats:3, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-3f.png', grade:4,
          sharpNotes:[], flatNotes:['B','E','A'], scale:['E♭','F','G','A♭','B♭','C','D'] },
        { id:'E',  name:'E大調',  sharps:4, flats:0, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-4s.png', grade:5,
          sharpNotes:['F','C','G','D'], flatNotes:[], scale:['E','F#','G#','A','B','C#','D#'] },
        { id:'Ab', name:'A♭大調', sharps:0, flats:4, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-4f.png', grade:5,
          sharpNotes:[], flatNotes:['B','E','A','D'], scale:['A♭','B♭','C','D♭','E♭','F','G'] },
        { id:'B',  name:'B大調',  sharps:5, flats:0, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-5s.png', grade:6,
          sharpNotes:['F','C','G','D','A'], flatNotes:[], scale:['B','C#','D#','E','F#','G#','A#'] },
        { id:'Db', name:'D♭大調', sharps:0, flats:5, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-5f.png', grade:6,
          sharpNotes:[], flatNotes:['B','E','A','D','G'], scale:['D♭','E♭','F','G♭','A♭','B♭','C'] }
    ];

    function getKeysigPool(grade) {
        const cap = (grade === 1 || grade === 2) ? 6 : grade;
        let pool = KEY_SIGNATURES.filter(k => k.grade <= cap);
        // Ensure at least 2 options for question generation; expand grade if needed
        if (pool.length < 2) {
            for (let g = cap + 1; g <= 6 && pool.length < 2; g++) {
                pool = KEY_SIGNATURES.filter(k => k.grade <= g);
            }
        }
        return pool;
    }

    // 首調唱名法 (moveable Do): maps each key's scale degrees to solfège names
    const SOLFEGE_NAMES = ['Do','Re','Mi','Fa','Sol','La','Si'];

    // For solfège mode: given a key and a note on the staff, find the solfège name
    // noteWithAcc is like 'F#' or 'B♭' or 'C'
    function getSolfege(keySig, noteWithAcc) {
        const idx = keySig.scale.indexOf(noteWithAcc);
        if (idx >= 0) return SOLFEGE_NAMES[idx];
        // Try enharmonic: # ↔ ♭ not needed for diatonic notes within key
        return null;
    }

    // Solfège grade config: which keys available + note range for treble clef
    const SOLFEGE_LEVELS = {
        1: { keys:['C','G','F','D','Bb','A','Eb','E','Ab','B','Db'], noteRange:[0,12] },
        2: { keys:['C','G','F','D','Bb','A','Eb','E','Ab','B','Db'], noteRange:[0,12] },
        3: { keys:['C','G','F','D','Bb'], noteRange:[0,9]  },
        4: { keys:['C','G','F','D','Bb','A','Eb'], noteRange:[0,9] },
        5: { keys:['C','G','F','D','Bb','A','Eb','E','Ab'], noteRange:[0,11] },
        6: { keys:['C','G','F','D','Bb','A','Eb','E','Ab','B','Db'], noteRange:[0,12] }
    };

    // Key signature drawing positions on treble clef (yFactor values for sharp/flat positions)
    // Sharps order: F C G D A — standard key signature positions
    const KEYSIG_SHARP_POS_TREBLE = [
        { letter:'F', yFactor:0 },    // F5: top line
        { letter:'C', yFactor:1.5 },  // C5: 3rd space
        { letter:'G', yFactor:-0.5 }, // G5: above top line
        { letter:'D', yFactor:1 },    // D5: 4th line
        { letter:'A', yFactor:2.5 }   // A4: 2nd space
    ];
    // Flats order: B E A D G
    const KEYSIG_FLAT_POS_TREBLE = [
        { letter:'B', yFactor:2 },    // B4: 3rd line
        { letter:'E', yFactor:0.5 },  // E5: 4th space
        { letter:'A', yFactor:2.5 },  // A4: 2nd space
        { letter:'D', yFactor:1 },    // D5: 4th line
        { letter:'G', yFactor:3 }     // G4: 2nd line
    ];

    const MAPS = {
        treble: [{letter:'C',octave:4,yFactor:5},{letter:'D',octave:4,yFactor:4.5},{letter:'E',octave:4,yFactor:4},{letter:'F',octave:4,yFactor:3.5},{letter:'G',octave:4,yFactor:3},{letter:'A',octave:4,yFactor:2.5},{letter:'B',octave:4,yFactor:2},{letter:'C',octave:5,yFactor:1.5},{letter:'D',octave:5,yFactor:1},{letter:'E',octave:5,yFactor:0.5},{letter:'F',octave:5,yFactor:0},{letter:'G',octave:5,yFactor:-0.5},{letter:'A',octave:5,yFactor:-1}],
        bass:   [{letter:'G',octave:2,yFactor:4},{letter:'A',octave:2,yFactor:3.5},{letter:'B',octave:2,yFactor:3},{letter:'C',octave:3,yFactor:2.5},{letter:'D',octave:3,yFactor:2},{letter:'E',octave:3,yFactor:1.5},{letter:'F',octave:3,yFactor:1},{letter:'G',octave:3,yFactor:0.5},{letter:'A',octave:3,yFactor:0},{letter:'B',octave:3,yFactor:-0.5},{letter:'C',octave:4,yFactor:-1}],
    };

    // 學生名冊 2026-2027（中一／中二；權威來源：課堂抽籤 DEFAULT_ROSTER）
    const STUDENT_ROSTER = {
        '1A':['陳心瑜', '周倬睿', '周永欣', '周天兒', '陳嘉豪', '何兆剛', '洪宇誠', '鄺俊麒', '郭浠瑜', '林希哲', '李澂', '李卓兒', '李曉晴', '李可晴', '梁嘉琳', '魯安玥', '吳善謙', '施奕希', '蕭梓麟', '蘇祉穎', '譚浚浩', '黃心柔', '胡浚軒', '鍾宛純'],
        '1B':['謝宜真', '肖欣媛', '鍾康盛', '曹靖楓', '梁晞晴', '范明軒', '甘希彤', '何睿恩', '何佩悅', '葉穎', '高悅峻', '黎曜天', '林祉蕎', '李承騫', '梁晏僑', '梁穎希', '梁日曦', '駱浠澄', '盧曉信', '盧柏橋', '勞語晴', '吳若曦', '彭珏熙', '潘悅澄', '阮思雯', '盛家莉', '蘇芷晴', '孫梓祐', '孫睿心', '吳天朗', '黃馨妤', '黃鈺婷', '周柏龍', '周泳霏'],
        '1C':['區逸言', '陳俊睿', '周朗熙', '鄭嘉喬', '陳賢浩', '馮心悅', '馮宛穎', '褟靜韻', '殷紫瑜', '葉佩文', '余明憲', '高信謙', '鄺仲言', '林卓曦', '林依穎', '林樂彤', '李懿恩', '梁凱欣', '梁洛悠', '林樂熙', '劉思怡', '劉思悅', '李欣潼', '蘇睿', '鄧璋泓', '湯芷晴', '鄧凱忻', '吳梓瑩', '韋曉妍', '黃政陽', '黃梓皓', '黃子賢', '黃祉穎', '王家耀'],
        '1D':['陳曼筠', '仇櫟然', '陳芯瑤', '張逸彤', '蔡政亨', '蔡思霖', '朱頌浠', '朱柏橋', '馮珮喬', '方淳亮', '何梓君', '何梓瑜', '楊卓昕', '古日熹', '林頌甯', '林鎧攸', '林栢賢', '劉晉嘉', '劉泳彤', '劉芯語', '李卓熹', '李芊悠', '梁一諾', '梁洋溢', '連思捷', '吳宇軒', '潘悅悠', '施養浩', '蘇頴妍', '孫沚霖', '譚倍豐', '黃琸翹', '楊舒雯'],
        '2A':['陳恩慈', '鄭梓樂', '張紫瑩', '徐睿楷', '馮梓恩', '何浩華', '許芷妍', '許穎瑤', '洪善願', '楊曉穎', '楊穎彤', '高崎峻', '郭泳琳', '黎卓凡', '林晞朗', '林曦佟', '劉珮熙', '劉弘哲', '盧銳曈', '魯辰宇', '施樂兒', '潘睿燊', '蕭佳鍼', '蕭日謙', '鄧沛翹', '涂巧倩', '黃晞瑤', '黃梓軒', '胡芯語', '張得韜'],
        '2B':['陳晞嵐', '陳心怡', '張柏桓', '丁小翁', '官柏霖', '黎康華', '賴穎桐', '林君堯', '李洛榕', '李柏熹', '李泓博', '梁鎧嵐', '梁恩維', '梁家羲', '李宇津', '李浩翔', '梁棋彰', '梁韞鈺', '盧立晴', '勞詩雯', '吳胤熹', '譚悅', '余梓睿', '王康睿', '余揚旌', '余灌珅'],
        '2C':['陳凱琳', '陳衍臻', '張榕栗', '周家馨', '蔡嘉浩', '朱恩雪', '何梓僮', '何詠芯', '洪芷妤', '英卓楠', '容穎彤', '葉逸朗', '江梓翊', '關諾行', '林弘軒', '李梓嫣', '李思朗', '梁諾希', '莫鎮英', '莫永淇', '彭博言', '黃梓程', '黃心悠', '王靖琛', '姚博文', '張叶晨'],
        '2D':['李靖琦', '陳朗熹', '張禧', '盧嘉謙', '歐欣蒨', '霍浩俊', '何政軒', '黃琛貽', '甄子康', '楊昕翹', '姚梓謙', '關進謙', '郭安欣', '劉珀豪', '李林蔚', '李天睿', '梁惠琳', '梁柏翹', '陸昕悅', '麥軒銘', '杜睿晴', '王鍾雨', '王灝宏', '黃暟懿', '吳岷珉', '徐嘉嘉'],
        '3A':[],
        '3B':[],
        '3C':[],
        '3D':[],
        '4A':[],
        '4B':[],
        '4C':[],
        '4D':[],
        '5A':[],
        '5B':[],
        '5C':[],
        '5D':[],
        '6A':[],
        '6B':[],
        '6C':[],
        '6D':[],
    };

    function getStudentList(grade, cls) {
        return STUDENT_ROSTER[grade + cls] || [];
    }

    function populateNameDropdown() {
        const grade = dom.userGrade.value;
        const cls = dom.userClass.value;
        const students = getStudentList(grade, cls);
        const nameEl = dom.userName;
        const prev = nameEl.value;
        const frag = document.createDocumentFragment();
        const firstOpt = document.createElement('option');
        firstOpt.value = ''; firstOpt.textContent = '請選擇姓名';
        frag.appendChild(firstOpt);
        students.forEach((name, i) => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            opt.dataset.seat = i + 1;
            frag.appendChild(opt);
        });
        const otherOpt = document.createElement('option');
        otherOpt.value = '__other__';
        otherOpt.textContent = '✏️ 其他（自行填寫）';
        frag.appendChild(otherOpt);
        nameEl.innerHTML = '';
        nameEl.appendChild(frag);
        if (prev && (students.includes(prev) || prev === '__other__')) nameEl.value = prev;
        else { nameEl.value = ''; dom.userId.value = ''; hideCustomName(); }
    }

    function showCustomName() {
        if (!_customNameInput) {
            const inp = document.createElement('input');
            inp.type = 'text'; inp.id = 'customNameInput'; inp.placeholder = '輸入名字';
            inp.autocomplete = 'off';
            inp.style.cssText = 'background:transparent; border:none; outline:none; color:var(--text-dark); font-weight:800; width:100%; font-size:1rem; font-family:inherit; margin-top:6px;';
            dom.userName.parentNode.appendChild(inp);
            inp.addEventListener('focus', () => state.inputFocused = true);
            inp.addEventListener('blur', () => state.inputFocused = false);
            _customNameInput = inp;
        }
        _customNameInput.style.display = ''; _customNameInput.focus();
    }
    function hideCustomName() {
        if (_customNameInput) _customNameInput.style.display = 'none';
    }
    function getPlayerName() {
        if (dom.userName.value === '__other__') {
            return _customNameInput ? _customNameInput.value.trim() : '';
        }
        return dom.userName.value;
    }

    let _customNameInput = null;
    let dom = {};
    let state = {};
    let audio = {};
    /** 創作工作室實例 — 於 IIFE 末尾以 CompositionStudioFactory 建立 */
    let CompositionStudio = { open() {}, init() {} };
    let noteBtnMap = new Map();
    // Canvas offscreen cache for static staff lines + clef
    let _staffCache = null;
    // Note buttons: visibility-only after first build
    let _noteRowsBuilt = false, _sharpRow = null, _flatRow = null;
    // Countdown timer ID for cleanup on screen switch
    let _countdownTimerId = null;

    // ── Toast notification helper ──
    function _showToast(msg, type) {
        const el = document.createElement('div');
        el.className = 'app-toast ' + (type || 'info');
        el.textContent = msg;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3000);
    }

    // ==========================================
    // 🎯 難度系統 (Difficulty System)
    // ==========================================
    const DIFFICULTY_CONFIG = {
        easy:   { tokenSet: 'basic',    bpm: 60,  winScale: 1.4, label: 'Easy',   emoji: '⭐' },
        normal: { tokenSet: 'basic',    bpm: 72,  winScale: 1.2, label: 'Normal', emoji: '⭐⭐' },
        hard:   { tokenSet: 'medium',   bpm: 84,  winScale: 1.0, label: 'Hard',   emoji: '⭐⭐⭐' },
        expert: { tokenSet: 'advanced', bpm: 96,  winScale: 0.9, label: 'Expert', emoji: '⭐⭐⭐⭐' },
        p1:     { label: '中一', emoji: '🌱' },
        p2:     { label: '中二', emoji: '🌿' },
        p3:     { label: '小三', emoji: '🌳' },
        p4:     { label: '小四', emoji: '⭐' },
        p5:     { label: '小五', emoji: '⭐⭐' },
        p6:     { label: '小六', emoji: '🏆' },
    };

    // ==========================================
    // 👤 玩家個人檔案系統 (Player Profile)
    // ==========================================
    const PROFILE_AVATARS = [
      // 🎶 樂器 Instruments
      {emoji:'🎸', name:'結他手',     bg:'linear-gradient(135deg,#FF6B35,#FF8F65)', cat:'inst'},
      {emoji:'🥁', name:'鼓手',       bg:'linear-gradient(135deg,#FFB800,#FFD54F)', cat:'inst'},
      {emoji:'🎻', name:'小提琴手',   bg:'linear-gradient(135deg,#E040FB,#EA80FC)', cat:'inst'},
      {emoji:'🎹', name:'鋼琴家',     bg:'linear-gradient(135deg,#536DFE,#8C9EFF)', cat:'inst'},
      {emoji:'🎺', name:'小號手',     bg:'linear-gradient(135deg,#FFC107,#FFE082)', cat:'inst'},
      {emoji:'🎷', name:'色士風手',   bg:'linear-gradient(135deg,#FF8A65,#FFAB91)', cat:'inst'},
      {emoji:'🎤', name:'歌手',       bg:'linear-gradient(135deg,#EC407A,#F48FB1)', cat:'inst'},
      {emoji:'🎧', name:'DJ',         bg:'linear-gradient(135deg,#7C4DFF,#B388FF)', cat:'inst'},
      // 🌟 角色 Characters
      {emoji:'🎵', name:'音符精靈',   bg:'linear-gradient(135deg,#8B66FF,#B39DFF)', cat:'char'},
      {emoji:'🎶', name:'和聲仙子',   bg:'linear-gradient(135deg,#FF65A3,#FF8EC4)', cat:'char'},
      {emoji:'🎼', name:'樂譜大師',   bg:'linear-gradient(135deg,#00A6ED,#4FC3F7)', cat:'char'},
      {emoji:'🎙️', name:'錄音師',     bg:'linear-gradient(135deg,#78909C,#B0BEC5)', cat:'char'},
      // 🐾 動物夥伴 Animal Pals
      {emoji:'🦊', name:'狐狸指揮',   bg:'linear-gradient(135deg,#FF7043,#FF8A65)', cat:'animal'},
      {emoji:'🐱', name:'貓咪鋼琴家', bg:'linear-gradient(135deg,#FFB74D,#FFCC80)', cat:'animal'},
      {emoji:'🐶', name:'汪汪鼓手',   bg:'linear-gradient(135deg,#8D6E63,#A1887F)', cat:'animal'},
      {emoji:'🦁', name:'獅王指揮家', bg:'linear-gradient(135deg,#FFA726,#FFB74D)', cat:'animal'},
      {emoji:'🐰', name:'兔兔長笛手', bg:'linear-gradient(135deg,#F48FB1,#F8BBD0)', cat:'animal'},
      {emoji:'🦄', name:'獨角獸歌姬', bg:'linear-gradient(135deg,#CE93D8,#E1BEE7)', cat:'animal'},
      // 🧸 奇幻夥伴 Fantasy Friends (inspired by reference)
      {emoji:'🧸', name:'玩具熊',     bg:'linear-gradient(135deg,#8BC34A,#AED581)', cat:'fantasy'},
      {emoji:'🤖', name:'積木機械人', bg:'linear-gradient(135deg,#FF7043,#FFAB91)', cat:'fantasy'},
      {emoji:'✨', name:'魔法星精靈', bg:'linear-gradient(135deg,#7E57C2,#B39DDB)', cat:'fantasy'},
      {emoji:'🐤', name:'海盜鴨鴨',   bg:'linear-gradient(135deg,#FFD600,#FFEE58)', cat:'fantasy'},
      {emoji:'🚂', name:'火車長',     bg:'linear-gradient(135deg,#42A5F5,#90CAF9)', cat:'fantasy'},
      {emoji:'🖍️', name:'彩色怪獸',   bg:'linear-gradient(135deg,#AB47BC,#CE93D8)', cat:'fantasy'},
      {emoji:'🚀', name:'火箭齒輪頭', bg:'linear-gradient(135deg,#66BB6A,#A5D6A7)', cat:'fantasy'},
      {emoji:'🪁', name:'風箏少年',   bg:'linear-gradient(135deg,#29B6F6,#81D4FA)', cat:'fantasy'},
      // ☁️ 夢幻系列 Dreamy (inspired by reference)
      {emoji:'☁️', name:'雲朵綿羊',   bg:'linear-gradient(135deg,#E1BEE7,#F3E5F5)', cat:'dreamy'},
      {emoji:'🦕', name:'積木恐龍',   bg:'linear-gradient(135deg,#AED581,#DCEDC8)', cat:'dreamy'},
      {emoji:'🧜', name:'月亮美人魚', bg:'linear-gradient(135deg,#4DD0E1,#80DEEA)', cat:'dreamy'},
      {emoji:'🎈', name:'氣球兔兔',   bg:'linear-gradient(135deg,#F48FB1,#F8BBD0)', cat:'dreamy'},
      {emoji:'🐱‍🚀', name:'太空貓',   bg:'linear-gradient(135deg,#EF5350,#EF9A9A)', cat:'dreamy'},
      {emoji:'🐭', name:'海盜鼠',     bg:'linear-gradient(135deg,#8D6E63,#BCAAA4)', cat:'dreamy'},
      {emoji:'🍄', name:'蘑菇小屋',   bg:'linear-gradient(135deg,#EF5350,#FFCDD2)', cat:'dreamy'},
      {emoji:'🌴', name:'叢林樂隊',   bg:'linear-gradient(135deg,#4CAF50,#81C784)', cat:'dreamy'},
      // 🏅 成就 Achievement
      {emoji:'🌟', name:'閃亮之星',   bg:'linear-gradient(135deg,#FFD740,#FFEE58)', cat:'item'},
      {emoji:'🔥', name:'熱力全開',   bg:'linear-gradient(135deg,#FF5722,#FF8A65)', cat:'item'},
      {emoji:'💎', name:'寶石收藏家', bg:'linear-gradient(135deg,#4DD0E1,#80DEEA)', cat:'item'},
      {emoji:'🏆', name:'冠軍',       bg:'linear-gradient(135deg,#FFC107,#FFD54F)', cat:'item'},
      {emoji:'👑', name:'音樂王者',   bg:'linear-gradient(135deg,#FFB300,#FFCA28)', cat:'item'},
    ];
    const AVATAR_CATEGORIES = [
      {key:'all', label:'全部'},
      {key:'inst', label:'🎶 樂器'},
      {key:'char', label:'🌟 角色'},
      {key:'animal', label:'🐾 動物'},
      {key:'fantasy', label:'🧸 奇幻'},
      {key:'dreamy', label:'☁️ 夢幻'},
      {key:'item', label:'🏅 成就'},
    ];
    function _avatarLookup(emoji) { return PROFILE_AVATARS.find(a => a.emoji === emoji) || {emoji, name:'', bg:'linear-gradient(135deg,#8B66FF,#B39DFF)', cat:'char'}; }
    const PROFILE_STORAGE_KEY = 'musicGameProfile';
    const PROFILE_HISTORY_KEY = 'musicGameProfileHistory';
    const _profileCache = new Map();

    function _getProfileKey(user) {
        if (!user || !user.name) return null;
        return `${PROFILE_STORAGE_KEY}_${user.grade}_${user.class}_${user.name}`;
    }

    function loadProfile(user) {
        const key = _getProfileKey(user);
        if (!key) return _defaultProfile(user);
        if (_profileCache.has(key)) return _profileCache.get(key);
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const p = JSON.parse(saved);
                // Ensure all fields exist (backward compat)
                const profile = Object.assign(_defaultProfile(user), p);
                _profileCache.set(key, profile);
                return profile;
            }
        } catch(e) { console.warn('Profile load error, resetting:', e); }
        return _defaultProfile(user);
    }

    function saveProfile(profile) {
        const key = `${PROFILE_STORAGE_KEY}_${profile.grade}_${profile.class}_${profile.name}`;
        _profileCache.set(key, profile); // Update cache
        try { localStorage.setItem(key, JSON.stringify(profile)); } catch(e) { _showToast('⚠️ 儲存空間不足，個人資料可能未能保存', 'warn'); }
        try {
            if (window.MusicAppAuth && typeof window.MusicAppAuth.syncGameData === 'function' && window.MusicAppAuth.signedIn) {
                window.MusicAppAuth.syncGameData(profile).catch(function () {});
            }
        } catch (e) {}
        try { updateHubAsideFromProfile(profile); } catch (e) {}
    }

    function updateHubAsideFromProfile(profile) {
        const nameEl = document.getElementById('hubAsideName');
        const metaEl = document.getElementById('hubAsideMeta');
        const avEl = document.getElementById('hubAsideAvatar');
        const lvEl = document.getElementById('hubAsideLevel');
        const expEl = document.getElementById('hubAsideExp');
        const b1 = document.getElementById('hubAsideBest1');
        const b2 = document.getElementById('hubAsideBest2');
        if (!nameEl) return;
        if (!profile || !profile.name) {
            nameEl.textContent = '尚未選擇身份';
            if (metaEl) metaEl.textContent = '選完年級／姓名後顯示資料';
            return;
        }
        nameEl.textContent = profile.name;
        if (metaEl) {
            metaEl.textContent = profile.grade
                ? `中${['','一','二','三','四','五','六'][profile.grade]||profile.grade} ${profile.class || ''}班 · 座號 ${profile.seat || '--'}`
                : '訪客／測試';
        }
        if (avEl) avEl.textContent = profile.avatar || '🎵';
        if (lvEl) lvEl.textContent = String(profile.level || 1);
        if (expEl) expEl.textContent = String(profile.exp || 0);
        const bests = profile.gameBests || {};
        if (b1) b1.textContent = String(bests.game1 || 0);
        if (b2) b2.textContent = String(bests.game2 || 0);
    }

    function _defaultProfile(user) {
        return {
            name: user ? user.name : '',
            grade: user ? user.grade : 0,
            class: user ? user.class : '',
            seat: user ? (user.seat || user.id || '') : '',
            avatar: '🎵',
            signature: '',
            registeredAt: new Date().toISOString(),
            totalPlayTime: 0, // seconds
            level: 1,
            exp: 0,
            stats: {
                totalPlayed: 0, cleared: 0, totalScore: 0,
                totalAccuracy: 0, accuracyCount: 0,
                maxCombo: 0, fcCount: 0, apCount: 0,
            },
            diffClears: { easy: 0, normal: 0, hard: 0, expert: 0 },
            gameBests: { game1: 0, game2: 0, game3: 0, game4: 0 },
            history: [], // recent sessions for progress trend
        };
    }

    function _expForLevel(lvl) { return lvl * 100; }

    const PROFILE_GAME_LABELS = {
        game1: '音名識辨', game2: '節奏識辨', game3: '術語識辨', game4: '樂器識辨'
    };

    let _profilePlayStartedAt = 0;
    function markProfilePlayStart() { _profilePlayStartedAt = Date.now(); }
    function _consumeProfilePlaySecs() {
        if (!_profilePlayStartedAt) return 0;
        const secs = Math.max(0, Math.round((Date.now() - _profilePlayStartedAt) / 1000));
        _profilePlayStartedAt = 0;
        return Math.min(secs, 30 * 60);
    }

    function _escHtml(value) {
        return escHtml(value);
    }

    function formatPlayTime(totalSecs) {
        const s = Math.max(0, Math.floor(totalSecs || 0));
        if (s < 60) return s > 0 ? `${s} 秒` : '0 分鐘';
        const mins = Math.floor(s / 60);
        if (mins < 60) return `${mins} 分鐘`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m ? `${h} 小時 ${m} 分鐘` : `${h} 小時`;
    }

    function _historyEntryFromRow(row) {
        return {
            date: row.timestamp || row.date || new Date().toLocaleString('zh-TW'),
            game: String(row.game || '').trim(),
            score: parseInt(row.score, 10) || 0,
            accuracy: parseInt(row.accuracy, 10) || 0,
            maxCombo: parseInt(row.max_combo != null ? row.max_combo : row.maxCombo, 10) || 0,
        };
    }

    function getProfileProgressSummary(history) {
        const list = Array.isArray(history) ? history : [];
        if (list.length < 2) {
            return { ready: false, message: list.length === 1
                ? '再次練習後，即可顯示進步趨勢。'
                : '完成遊戲後，這裡會顯示你的進步。' };
        }
        const split = Math.floor(list.length / 2);
        const older = list.slice(0, split);
        const recent = list.slice(split);
        if (!older.length || !recent.length) {
            return { ready: false, message: '再多玩幾次就能比較進步！' };
        }
        const avg = (arr, key) => Math.round(arr.reduce((a, r) => a + (r[key] || 0), 0) / arr.length);
        const recentAcc = avg(recent, 'accuracy');
        const olderAcc = avg(older, 'accuracy');
        const recentScore = avg(recent, 'score');
        const olderScore = avg(older, 'score');
        const accDiff = recentAcc - olderAcc;
        const scoreDiff = recentScore - olderScore;
        let tone = 'stable';
        let headline = '表現穩定，繼續保持！';
        if (accDiff >= 5 || scoreDiff >= 20) {
            tone = 'up';
            headline = '成績有所進步，請繼續練習。';
        } else if (accDiff <= -5 || scoreDiff <= -20) {
            tone = 'down';
            headline = '近期成績稍降，請加強練習。';
        }
        return {
            ready: true, tone, headline,
            olderAcc, recentAcc, accDiff,
            olderScore, recentScore, scoreDiff,
            olderCount: older.length,
            recentCount: recent.length,
            totalSessions: list.length,
        };
    }

    // Derive basic stats from allRanks (leaderboard data) for a student
    function _statsFromRanks(name, grade, cls) {
        const rows = state.allRanks.filter(r =>
            String(r.name || '').trim() === String(name).trim() &&
            String(r.grade || '') === String(grade) &&
            String(r.class || '').trim().toUpperCase() === String(cls).trim().toUpperCase()
        );
        if (!rows.length) return null;
        let totalScore = 0, maxCombo = 0, totalAcc = 0;
        const bests = {};
        rows.forEach(r => {
            const sc = parseInt(r.score) || 0;
            const mc = parseInt(r.max_combo) || 0;
            const acc = parseInt(r.accuracy) || 0;
            totalScore += sc;
            if (mc > maxCombo) maxCombo = mc;
            totalAcc += acc;
            const gk = r.game || '';
            if (gk && sc > (bests[gk] || 0)) bests[gk] = sc;
        });
        return {
            totalPlayed: rows.length,
            totalScore,
            maxCombo,
            avgAccuracy: rows.length ? Math.round(totalAcc / rows.length) : 0,
            gameBests: bests
        };
    }

    function addProfileExp(profile, expGain) {
        profile.exp += expGain;
        while (profile.exp >= _expForLevel(profile.level)) {
            profile.exp -= _expForLevel(profile.level);
            profile.level++;
        }
    }

    function recordGameResult(user, gameKey, score, accuracy, maxCombo, difficulty, hitCounts) {
        const profile = loadProfile(user);
        profile.stats.totalPlayed++;
        profile.stats.totalScore += score;
        profile.stats.totalAccuracy += accuracy;
        profile.stats.accuracyCount++;
        if (maxCombo > profile.stats.maxCombo) profile.stats.maxCombo = maxCombo;
        if (score > (profile.gameBests[gameKey] || 0)) profile.gameBests[gameKey] = score;

        // Play time (seconds)
        const playSecs = _consumeProfilePlaySecs();
        if (playSecs > 0) profile.totalPlayTime = (profile.totalPlayTime || 0) + playSecs;

        // Session history for progress trend
        if (!Array.isArray(profile.history)) profile.history = [];
        profile.history.push({
            date: new Date().toLocaleString('zh-TW'),
            game: gameKey,
            score: score || 0,
            accuracy: accuracy || 0,
            maxCombo: maxCombo || 0,
        });
        if (profile.history.length > 30) profile.history = profile.history.slice(-30);

        // FC / AP detection
        if (hitCounts) {
            const totalNotes = (hitCounts.perfect || 0) + (hitCounts.great || 0) + (hitCounts.good || 0) + (hitCounts.miss || 0);
            if (totalNotes > 0 && hitCounts.miss === 0) {
                profile.stats.fcCount++;
                profile.stats.cleared++;
                if (hitCounts.perfect === totalNotes) profile.stats.apCount++;
            } else if (accuracy >= 60) {
                profile.stats.cleared++;
            }
        } else if (accuracy >= 60) {
            profile.stats.cleared++;
        }

        // Difficulty clears
        if (difficulty && profile.diffClears.hasOwnProperty(difficulty)) {
            if (accuracy >= 60) profile.diffClears[difficulty]++;
        }

        // EXP gain: base 50 + score/10 + accuracy bonus
        const expGain = Math.floor(50 + score / 10 + (accuracy >= 90 ? 30 : accuracy >= 70 ? 15 : 0));
        addProfileExp(profile, expGain);

        saveProfile(profile);
        submitProfileResultToGAS(gameKey, user, score, accuracy, maxCombo, profile);
        return profile;
    }

    const _profileSyncingKeys = new Set();

    async function syncProfileFromGAS(user) {
        const key = _getProfileKey(user);
        if (!key || _profileSyncingKeys.has(key)) return;
        _profileSyncingKeys.add(key);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const url = `${CONFIG.API_URL}?action=getProfile&grade=${encodeURIComponent(user.grade)}&class=${encodeURIComponent(user.class)}&name=${encodeURIComponent(user.name)}&v=${Date.now()}`;
            const res = await fetch(url, {
                method: 'GET',
                redirect: 'follow',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) return;

            const rows = await res.json();
            if (!Array.isArray(rows) || rows.length === 0) return;

            const existing = loadProfile(user);
            const profile = _defaultProfile(user);
            profile.avatar = existing.avatar || profile.avatar;
            profile.signature = existing.signature || profile.signature;
            profile.registeredAt = existing.registeredAt || rows[0].timestamp || profile.registeredAt;
            profile.totalPlayTime = existing.totalPlayTime || 0;

            let latestLevel = 1;
            let latestExp = 0;
            let latestTotalPlayed = 0;
            let latestCleared = 0;
            let latestFcCount = 0;
            let latestApCount = 0;

            rows.forEach(row => {
                const score = parseInt(row.score, 10) || 0;
                const accuracy = parseInt(row.accuracy, 10) || 0;
                const maxCombo = parseInt(row.max_combo, 10) || 0;
                const gameKey = String(row.game || '').trim();

                profile.stats.totalScore += score;
                profile.stats.totalAccuracy += accuracy;
                profile.stats.accuracyCount++;
                profile.stats.maxCombo = Math.max(profile.stats.maxCombo, maxCombo);
                profile.gameBests[gameKey] = Math.max(profile.gameBests[gameKey] || 0, score);

                latestLevel = parseInt(row.level, 10) || latestLevel;
                latestExp = parseInt(row.exp, 10) || latestExp;
                latestTotalPlayed = parseInt(row.total_played, 10) || latestTotalPlayed;
                latestCleared = parseInt(row.cleared, 10) || latestCleared;
                latestFcCount = parseInt(row.fc_count, 10) || latestFcCount;
                latestApCount = parseInt(row.ap_count, 10) || latestApCount;
            });

            profile.level = latestLevel;
            profile.exp = latestExp;
            profile.stats.totalPlayed = latestTotalPlayed || rows.length;
            profile.stats.cleared = latestCleared || rows.filter(row => (parseInt(row.accuracy, 10) || 0) >= 60).length;
            profile.stats.fcCount = latestFcCount;
            profile.stats.apCount = latestApCount;
            profile.history = rows.map(_historyEntryFromRow).slice(-30);
            // Prefer longer local history if GAS returned fewer rows (offline sessions)
            if (Array.isArray(existing.history) && existing.history.length > profile.history.length) {
                profile.history = existing.history.slice(-30);
            }

            saveProfile(profile);
        } catch (e) {
            console.error('Profile 讀取失敗：', e);
        } finally {
            _profileSyncingKeys.delete(key);
        }
    }

    // Batch-sync all profiles for a grade+class from GAS in one request
    let _allProfilesSyncing = false;
    async function syncAllProfiles(grade, cls, callback) {
        if (_allProfilesSyncing) return;
        _allProfilesSyncing = true;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const url = `${CONFIG.API_URL}?action=getAllProfiles&grade=${encodeURIComponent(grade)}&class=${encodeURIComponent(cls)}&v=${Date.now()}`;
            const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) return;
            const allRows = await res.json();
            if (!Array.isArray(allRows) || !allRows.length) return;

            // Group rows by student name
            const byStudent = {};
            allRows.forEach(row => {
                const n = String(row.name || '').trim();
                if (!n) return;
                if (!byStudent[n]) byStudent[n] = [];
                byStudent[n].push(row);
            });

            // Update each student's local profile
            Object.entries(byStudent).forEach(([name, rows]) => {
                const user = { name, grade, class: cls };
                const existing = loadProfile(user);
                const profile = _defaultProfile(user);
                profile.avatar = existing.avatar || profile.avatar;
                profile.signature = existing.signature || profile.signature;
                profile.registeredAt = existing.registeredAt || rows[0].timestamp || profile.registeredAt;
                profile.totalPlayTime = existing.totalPlayTime || 0;

                let latestLevel = 1, latestExp = 0, latestTotalPlayed = 0;
                let latestCleared = 0, latestFcCount = 0, latestApCount = 0;

                rows.forEach(row => {
                    const score = parseInt(row.score, 10) || 0;
                    const accuracy = parseInt(row.accuracy, 10) || 0;
                    const maxCombo = parseInt(row.max_combo, 10) || 0;
                    const gameKey = String(row.game || '').trim();

                    profile.stats.totalScore += score;
                    profile.stats.totalAccuracy += accuracy;
                    profile.stats.accuracyCount++;
                    profile.stats.maxCombo = Math.max(profile.stats.maxCombo, maxCombo);
                    if (gameKey) profile.gameBests[gameKey] = Math.max(profile.gameBests[gameKey] || 0, score);

                    latestLevel = parseInt(row.level, 10) || latestLevel;
                    latestExp = parseInt(row.exp, 10) || latestExp;
                    latestTotalPlayed = parseInt(row.total_played, 10) || latestTotalPlayed;
                    latestCleared = parseInt(row.cleared, 10) || latestCleared;
                    latestFcCount = parseInt(row.fc_count, 10) || latestFcCount;
                    latestApCount = parseInt(row.ap_count, 10) || latestApCount;
                });

                profile.level = latestLevel;
                profile.exp = latestExp;
                profile.stats.totalPlayed = latestTotalPlayed || rows.length;
                profile.stats.cleared = latestCleared || rows.filter(r => (parseInt(r.accuracy, 10) || 0) >= 60).length;
                profile.stats.fcCount = latestFcCount;
                profile.stats.apCount = latestApCount;
                profile.history = rows.map(_historyEntryFromRow).slice(-30);
                if (Array.isArray(existing.history) && existing.history.length > profile.history.length) {
                    profile.history = existing.history.slice(-30);
                }

                saveProfile(profile);
            });

            console.log(`✅ 已批次同步 ${Object.keys(byStudent).length} 位同學的檔案`);
            if (typeof callback === 'function') callback();
        } catch (e) {
            console.error('批次同步檔案失敗：', e);
        } finally {
            _allProfilesSyncing = false;
        }
    }

    function renderProfileScreen(user) {
        const p = loadProfile(user);
        if (user && user.name && (!(p.history && p.history.length) || p.stats.totalPlayed === 0)) {
            const beforePlayed = p.stats.totalPlayed;
            const beforeHist = (p.history && p.history.length) || 0;
            syncProfileFromGAS(user).then(() => {
                const refreshed = loadProfile(user);
                const afterHist = (refreshed.history && refreshed.history.length) || 0;
                if (afterHist > beforeHist || refreshed.stats.totalPlayed > beforePlayed) {
                    renderProfileScreen(user);
                }
            });
        }
        const avInfo = _avatarLookup(p.avatar);
        const avEl = document.getElementById('profileAvatar');
        avEl.textContent = p.avatar;
        avEl.style.background = avInfo.bg;
        document.getElementById('profileName').textContent = p.name + ' 同學';
        document.getElementById('profileSig').textContent = p.signature || '按此編輯簽名';
        document.getElementById('profileId').textContent = `${p.grade ? (['','中一','中二','中三','中四','中五','中六'][p.grade] || '') : ''} ${p.class}班 ${p.seat ? p.seat + '號' : ''}`;
        document.getElementById('profileSince').textContent = '加入日期: ' + (p.registeredAt ? new Date(p.registeredAt).toLocaleDateString() : '---');

        // Level & EXP
        document.getElementById('profileLevel').textContent = 'Lv.' + p.level;
        const needed = _expForLevel(p.level);
        const pct = Math.min(100, Math.round((p.exp / needed) * 100));
        document.getElementById('profileExpFill').style.width = pct + '%';
        document.getElementById('profileExpText').textContent = `${p.exp} / ${needed} EXP`;
        document.getElementById('profilePlaytime').textContent = `🕐 累計練習時間：${formatPlayTime(p.totalPlayTime)}`;

        // Stats
        const s = p.stats;
        document.getElementById('psTotalPlayed').textContent = s.totalPlayed;
        document.getElementById('psCleared').textContent = s.cleared;
        document.getElementById('psTotalScore').textContent = s.totalScore;
        document.getElementById('psAvgAccuracy').textContent = s.accuracyCount > 0 ? Math.round(s.totalAccuracy / s.accuracyCount) + '%' : '0%';
        document.getElementById('psMaxCombo').textContent = s.maxCombo;
        document.getElementById('psFCCount').textContent = s.fcCount;
        document.getElementById('psAPCount').textContent = s.apCount;

        // Difficulty achievements
        document.getElementById('pdEasy').textContent = (p.diffClears.easy || 0) + ' 次通關';
        document.getElementById('pdNormal').textContent = (p.diffClears.normal || 0) + ' 次通關';
        document.getElementById('pdHard').textContent = (p.diffClears.hard || 0) + ' 次通關';
        document.getElementById('pdExpert').textContent = (p.diffClears.expert || 0) + ' 次通關';

        // Game bests
        document.getElementById('pgbGame1').textContent = p.gameBests.game1 || '---';
        document.getElementById('pgbGame2').textContent = p.gameBests.game2 || '---';
        document.getElementById('pgbGame3').textContent = p.gameBests.game3 || '---';
        const pgb4 = document.getElementById('pgbGame4');
        if (pgb4) pgb4.textContent = p.gameBests.game4 || '---';

        // Progress trend + recent sessions
        const trendEl = document.getElementById('profileProgressTrend');
        const recentEl = document.getElementById('profileRecentGames');
        if (trendEl) {
            const summary = getProfileProgressSummary(p.history);
            if (!summary.ready) {
                trendEl.innerHTML = `<div class="profile-trend-empty">${summary.message}</div>`;
            } else {
                const accArrow = summary.accDiff > 0 ? '▲' : summary.accDiff < 0 ? '▼' : '•';
                const scoreArrow = summary.scoreDiff > 0 ? '▲' : summary.scoreDiff < 0 ? '▼' : '•';
                const accSign = summary.accDiff > 0 ? '+' : '';
                const scoreSign = summary.scoreDiff > 0 ? '+' : '';
                trendEl.innerHTML = `
                    <div class="profile-trend-headline trend-${summary.tone}">${summary.headline}</div>
                    <div class="profile-trend-compare">
                        <div class="profile-trend-metric">
                            <div class="ptm-label">準確率</div>
                            <div class="ptm-vals">${summary.olderAcc}% → ${summary.recentAcc}%</div>
                            <div class="ptm-delta trend-${summary.tone}">${accArrow} ${accSign}${summary.accDiff}%</div>
                        </div>
                        <div class="profile-trend-metric">
                            <div class="ptm-label">平均分數</div>
                            <div class="ptm-vals">${summary.olderScore} → ${summary.recentScore}</div>
                            <div class="ptm-delta trend-${summary.tone}">${scoreArrow} ${scoreSign}${summary.scoreDiff}</div>
                        </div>
                    </div>
                    <div class="profile-trend-note">比較近 ${summary.recentCount} 次 vs 更早 ${summary.olderCount} 次（共 ${summary.totalSessions} 次）</div>`;
            }
        }
        if (recentEl) {
            const recent = (p.history || []).slice(-8).reverse();
            if (!recent.length) {
                recentEl.innerHTML = '<div class="profile-trend-empty">尚無練習紀錄</div>';
            } else {
                recentEl.innerHTML = recent.map(h => {
                    const label = PROFILE_GAME_LABELS[h.game] || h.game || '遊戲';
                    return `<div class="profile-recent-row">
                        <div class="prr-game">${_escHtml(label)}</div>
                        <div class="prr-meta">${_escHtml(h.date || '')}</div>
                        <div class="prr-score">${_escHtml(h.score)} 分</div>
                        <div class="prr-acc">${_escHtml(h.accuracy)}%</div>
                    </div>`;
                }).join('');
            }
        }

        // Avatar grid with category filter
        const grid = document.getElementById('profileAvatarGrid');
        const avSection = grid.closest('.profile-avatars-section');
        let avCatFilter = avSection.querySelector('.avatar-cat-filter');
        if (!avCatFilter) {
            avCatFilter = document.createElement('div');
            avCatFilter.className = 'avatar-cat-filter';
            avCatFilter.innerHTML = AVATAR_CATEGORIES.map(c =>
                `<button class="av-cat-btn${c.key === 'all' ? ' active' : ''}" data-cat="${c.key}">${c.label}</button>`
            ).join('');
            avSection.insertBefore(avCatFilter, grid);
        }
        let _avCat = 'all';
        function _renderAvatarGrid() {
            const filtered = _avCat === 'all' ? PROFILE_AVATARS : PROFILE_AVATARS.filter(a => a.cat === _avCat);
            grid.innerHTML = filtered.map(a =>
                `<div class="profile-avatar-opt${a.emoji === p.avatar ? ' selected' : ''}" data-av="${a.emoji}">
                    <div class="pav-circle" style="background:${a.bg}">${a.emoji}</div>
                    <div class="pav-name">${a.name}</div>
                </div>`
            ).join('');
        }
        _renderAvatarGrid();
        avCatFilter.onclick = (e) => {
            const btn = e.target.closest('.av-cat-btn');
            if (!btn) return;
            _avCat = btn.dataset.cat;
            avCatFilter.querySelectorAll('.av-cat-btn').forEach(b => b.classList.toggle('active', b === btn));
            _renderAvatarGrid();
        };
        grid.onclick = (e) => {
            const opt = e.target.closest('.profile-avatar-opt');
            if (!opt) return;
            const av = opt.dataset.av;
            p.avatar = av;
            saveProfile(p);
            const info = _avatarLookup(av);
            const el = document.getElementById('profileAvatar');
            el.textContent = av;
            el.style.background = info.bg;
            grid.querySelectorAll('.profile-avatar-opt').forEach(el => el.classList.toggle('selected', el.dataset.av === av));
        };

        // Signature
        const sigInput = document.getElementById('profileSigInput');
        sigInput.value = p.signature || '';
        document.getElementById('profileSigSave').onclick = () => {
            const val = sigInput.value.trim().slice(0, 30);
            p.signature = val;
            saveProfile(p);
            document.getElementById('profileSig').textContent = val || '按此編輯簽名';
        };
    }

    // Preload clef SVG images (path-based for cross-platform consistency)
    const clefImages = { treble: new Image(), bass: new Image() };
    clefImages.treble.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15.186 40.768"><path fill="#1E1E2F" d="m12.049 3.5296c0.305 3.1263-2.019 5.6563-4.0772 7.7014-0.9349 0.897-0.155 0.148-0.6437 0.594-0.1022-0.479-0.2986-1.731-0.2802-2.11 0.1304-2.6939 2.3198-6.5875 4.2381-8.0236 0.309 0.5767 0.563 0.6231 0.763 1.8382zm0.651 16.142c-1.232-0.906-2.85-1.144-4.3336-0.885-0.1913-1.255-0.3827-2.51-0.574-3.764 2.3506-2.329 4.9066-5.0322 5.0406-8.5394 0.059-2.232-0.276-4.6714-1.678-6.4836-1.7004 0.12823-2.8995 2.156-3.8019 3.4165-1.4889 2.6705-1.1414 5.9169-0.57 8.7965-0.8094 0.952-1.9296 1.743-2.7274 2.734-2.3561 2.308-4.4085 5.43-4.0046 8.878 0.18332 3.334 2.5894 6.434 5.8702 7.227 1.2457 0.315 2.5639 0.346 3.8241 0.099 0.2199 2.25 1.0266 4.629 0.0925 6.813-0.7007 1.598-2.7875 3.004-4.3325 2.192-0.5994-0.316-0.1137-0.051-0.478-0.252 1.0698-0.257 1.9996-1.036 2.26-1.565 0.8378-1.464-0.3998-3.639-2.1554-3.358-2.262 0.046-3.1904 3.14-1.7356 4.685 1.3468 1.52 3.833 1.312 5.4301 0.318 1.8125-1.18 2.0395-3.544 1.8325-5.562-0.07-0.678-0.403-2.67-0.444-3.387 0.697-0.249 0.209-0.059 1.193-0.449 2.66-1.053 4.357-4.259 3.594-7.122-0.318-1.469-1.044-2.914-2.302-3.792zm0.561 5.757c0.214 1.991-1.053 4.321-3.079 4.96-0.136-0.795-0.172-1.011-0.2626-1.475-0.4822-2.46-0.744-4.987-1.116-7.481 1.6246-0.168 3.4576 0.543 4.0226 2.184 0.244 0.577 0.343 1.197 0.435 1.812zm-5.1486 5.196c-2.5441 0.141-4.9995-1.595-5.6343-4.081-0.749-2.153-0.5283-4.63 0.8207-6.504 1.1151-1.702 2.6065-3.105 4.0286-4.543 0.183 1.127 0.366 2.254 0.549 3.382-2.9906 0.782-5.0046 4.725-3.215 7.451 0.5324 0.764 1.9765 2.223 2.7655 1.634-1.102-0.683-2.0033-1.859-1.8095-3.227-0.0821-1.282 1.3699-2.911 2.6513-3.198 0.4384 2.869 0.9413 6.073 1.3797 8.943-0.5054 0.1-1.0211 0.143-1.536 0.143z"/></svg>');
    clefImages.bass.src  = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><text x="4" y="95" font-size="110" fill="#1E1E2F" font-family="Bravura, Noto Music, Apple Symbols, Segoe UI Symbol, serif">𝄢</text></svg>');
    // Redraw staff when clef image finishes loading
    const onClefLoad = () => { if (state.currentNote && dom.ctx) drawStaff(); };
    clefImages.treble.onload = onClefLoad;
    clefImages.bass.onload  = onClefLoad;

    // Preload note head SVG images for whole and half notes
    const noteImages = { whole: new Image(), half: new Image() };
    noteImages.whole.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60"><g transform="rotate(-15, 40, 30)"><ellipse cx="40" cy="30" rx="36" ry="24" fill="#1E1E2F"/><ellipse cx="40" cy="30" rx="24" ry="10" fill="white" transform="rotate(45, 40, 30)"/></g></svg>');
    noteImages.half.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60"><g transform="rotate(-15, 40, 30)"><ellipse cx="40" cy="30" rx="32" ry="22" fill="#1E1E2F"/><ellipse cx="40" cy="30" rx="18" ry="8" fill="white" transform="rotate(45, 40, 30)"/></g></svg>');
    noteImages.whole.onload = onClefLoad;
    noteImages.half.onload = onClefLoad;

    function initDOM() {
        dom = {
            screens: document.querySelectorAll('.screen'),
            screenSetup: document.getElementById('screen-setup'),
            screenGame: document.getElementById('screen-game'),
            screenLeaderboard: document.getElementById('screen-leaderboard'),
            
            // Global & Setup
            soundToggle: document.getElementById('soundToggle'), 
            musicPanel: document.getElementById('musicPanel'),
            musicMuteToggle: document.getElementById('musicMuteToggle'),
            modeCards: document.querySelectorAll('.mode-card'), 
            nameField: document.getElementById('nameField'), 
            idField: document.getElementById('idField'),
            userName: document.getElementById('userName'), 
            userGrade: document.getElementById('userGrade'), 
            userClass: document.getElementById('userClass'), 
            userId: document.getElementById('userId'),
            startBtn: document.getElementById('startBtn'),
            
            // Game
            canvas: document.getElementById('staffCanvas'), 
            canvasWrapper: document.getElementById('canvasWrapper'), 
            ctx: document.getElementById('staffCanvas').getContext('2d'),
            countdownOverlay: document.getElementById('countdownOverlay'), 
            endBtn: document.getElementById('endBtn'), 
            clefBadge: document.getElementById('clefBadge'), 
            inGameUser: document.getElementById('inGameUser'),
            messageBox: document.getElementById('messageBox'), 
            notesGrid: document.getElementById('notesGrid'), 
            revealBtn: document.getElementById('revealBtn'), 
            skipBtn: document.getElementById('skipBtn'), 
            timeProgress: document.getElementById('timeProgress'), 
            timeDisplay: document.getElementById('timeDisplay'), 
            scoreDisplay: document.getElementById('scoreDisplay'), 
            comboDisplay: document.getElementById('comboDisplay'),
            practiceBadge: document.getElementById('practiceBadge'),
            practiceCount: document.getElementById('practiceCount'),
            
            // Leaderboard
            rankList: document.getElementById('rankList'), 
            rankClassFilter: document.getElementById('rankClassFilter'), 
            rankGradeFilter: document.getElementById('rankGradeFilter'), 
            rankModeFilter: document.getElementById('rankModeFilter'),
            reportGrid: document.getElementById('reportGrid'), 
            reportWeakness: document.getElementById('reportWeakness'), 
            backToSetupBtn: document.getElementById('backToSetupBtn'),
            // Cached settings elements for hot-path access
            highlightLine: document.getElementById('highlightLine'),
            noteHeadStyle: document.getElementById('noteHeadStyle'),
            textbookMode: document.getElementById('textbookMode'),
            clefTreble: document.getElementById('clefTreble'),
            accidentalSharp: document.getElementById('accidentalSharp'),
            accidentalFlat: document.getElementById('accidentalFlat'),
            ledgerLineAbove: document.getElementById('ledgerLineAbove'),
            ledgerLineBelow: document.getElementById('ledgerLineBelow'),
            bgVolume: document.getElementById('bgVolume'),
            sfxVolume: document.getElementById('sfxVolume'),
            bgVolumeVal: document.getElementById('bgVolumeVal'),
            sfxVolumeVal: document.getElementById('sfxVolumeVal'),
            bgMusic: document.getElementById('bgMusic'),
            reportHistory: document.getElementById('reportHistory'),
            studentRankHint: document.getElementById('studentRankHint'),
            viewRanksBtn: document.getElementById('viewRanksBtn'),
            leaderboardLayout: document.querySelector('.leaderboard-layout'),
            noteSoundOnly: document.getElementById('noteSoundOnly'),
            countdownSound: document.getElementById('countdownSound'),
            clefGroup: document.getElementById('clefGroup'),
            accidentalGroup: document.getElementById('accidentalGroup'),
            ledgerGroup: document.getElementById('ledgerGroup'),
            noteRangeGroup: document.getElementById('noteRangeGroup'),
            noteRangeFrom: document.getElementById('noteRangeFrom'),
            noteRangeTo: document.getElementById('noteRangeTo'),
            clefBass: document.getElementById('clefBass'),
            practiceDiffRow: document.getElementById('practiceDiffRow'),
            checkboxItems: document.querySelectorAll('.checkbox-item')
        };
        dom.scoreBadge = dom.scoreDisplay.closest('.stat-badge');
        dom.comboBadge = dom.comboDisplay.closest('.stat-badge');
        dom.modeCardMap = new Map([...dom.modeCards].map(c => [c.dataset.mode, c]));
        dom.screenMap = new Map([...dom.screens].map(s => [s.id, s]));
    }

    function initState() {
        state = { 
            currentMode: 'practice', 
            modeConfig: MODE_CONFIG.practice, 
            gameActive: false, 
            timeLeft: 0, 
            timer: null, 
            score: 0, 
            totalQuestions: 0, 
            wrongCount: 0, 
            combo: 0, 
            maxCombo: 0, 
            answered: false, 
            currentUser: { name:'', grade:6, class:'A', id:'' }, 
            currentNote: null, 
            allRanks: [], 
            inputFocused: false, 
            wrongNoteStats: {}, 
            answerTimeList: [], 
            questionStartTime: 0,
            attemptedThisQuestion: false,
            showAnswerHighlight: false,
            slowNoteStats: {},
            lastNoteLetter: null,
            practiceDiff: '3',
            keysigGrade: 1,
            solfegeGrade: 1
        };
    }

    function initAudio() {
        audio = {
            ctx: null, 
            enabled: true, 
            initialized: false,
            _noteSoundOnlyEl: null,
            _countdownSoundEl: null,
            init() { 
                if (this.initialized) return; 
                try { 
                    if (window.AudioEngine && window.AudioEngine.ensureCtx) {
                        this.ctx = window.AudioEngine.ensureCtx();
                    }
                    if (!this.ctx) {
                        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    if (window.AudioEngine && window.AudioEngine.register) {
                        window.AudioEngine.register(this.ctx);
                    }
                    this.initialized = true;
                    this._noteSoundOnlyEl = dom.noteSoundOnly;
                    this._countdownSoundEl = dom.countdownSound;
                } catch (e) { 
                    console.error('Audio context init error:', e);
                } 
            },
            async warmUp() {
                if (window.AudioEngine && window.AudioEngine.unlock) {
                    await window.AudioEngine.unlock();
                    if (!this.ctx && window.AudioEngine.context) this.ctx = window.AudioEngine.context;
                    return;
                }
                if (!this.ctx) return;
                try {
                    if (this.ctx.state === 'suspended') await this.ctx.resume();
                    // Play a silent buffer to fully unlock audio on iOS/Safari
                    const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
                    const src = this.ctx.createBufferSource();
                    src.buffer = buf; src.connect(this.ctx.destination);
                    src.start(0);
                } catch(e) { /* ignore */ }
            },
            bgPlay() {
                if (!dom.bgMusic) return;
                const vol = parseInt(dom.bgVolume?.value ?? 18);
                dom.bgMusic.volume = vol / 100;
                if (this.enabled) dom.bgMusic.play().catch(()=>{});
            },
            bgStop() {
                if (!dom.bgMusic) return;
                dom.bgMusic.pause();
                dom.bgMusic.currentTime = 0;
            },
            bgPause() {
                if (!dom.bgMusic) return;
                dom.bgMusic.pause();
            },
            bgSetMute(muted) {
                if (!dom.bgMusic) return;
                if (muted) { dom.bgMusic.pause(); } else { dom.bgMusic.volume = parseInt(dom.bgVolume?.value ?? 18) / 100; dom.bgMusic.play().catch(()=>{}); }
            },
            getSfxGain() {
                const v = parseInt(dom.sfxVolume?.value ?? 80);
                return v / 100;
            },
            playClick(type) {
                if (!this.ctx || !this.enabled) return;
                this.resume();
                const g = this.getSfxGain();
                const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
                osc.connect(gain); gain.connect(this.ctx.destination);
                if (type === 'select') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(660, this.ctx.currentTime);
                    osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.06);
                    gain.gain.setValueAtTime(0.18 * g, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
                    osc.start(this.ctx.currentTime); osc.stop(this.ctx.currentTime + 0.18);
                } else {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(520, this.ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(380, this.ctx.currentTime + 0.08);
                    gain.gain.setValueAtTime(0.14 * g, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
                    osc.start(this.ctx.currentTime); osc.stop(this.ctx.currentTime + 0.1);
                }
            },
            resume() { 
                if (window.AudioEngine && window.AudioEngine.unlock) {
                    window.AudioEngine.unlock();
                    if (!this.ctx && window.AudioEngine.context) this.ctx = window.AudioEngine.context;
                    return;
                }
                if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(e=>e); 
            },
            playNote(key) {
                if (!this.ctx || !this.enabled || !CONFIG.NOTE_FREQUENCIES[key]) return;
                this.resume();
                const g = this.getSfxGain();
                const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
                osc.type = 'sine'; 
                osc.frequency.value = CONFIG.NOTE_FREQUENCIES[key];
                osc.connect(gain); 
                gain.connect(this.ctx.destination);
                gain.gain.setValueAtTime(0, this.ctx.currentTime); 
                gain.gain.linearRampToValueAtTime(0.4 * g, this.ctx.currentTime + 0.05); 
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
                osc.start(this.ctx.currentTime); 
                osc.stop(this.ctx.currentTime + 0.8);
            },
            playEffect(type) {
                if (!this.ctx || !this.enabled) return; 
                this.resume();
                const g = this.getSfxGain();
                if (this._noteSoundOnlyEl && this._noteSoundOnlyEl.checked && type !== 'countdown' && type !== 'timeup') return;
                if (type === 'warning' && this._countdownSoundEl && !this._countdownSoundEl.checked) return;
                const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
                osc.connect(gain); 
                gain.connect(this.ctx.destination); 
                let dur = 0.3;
                if(type==='countdown'){ 
                    osc.type='sine'; 
                    osc.frequency.value=880; 
                    gain.gain.setValueAtTime(0.2*g, this.ctx.currentTime); 
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime+0.2); 
                    dur=0.2; 
                }
                else if(type==='timeup'){ 
                    osc.type='triangle'; 
                    osc.frequency.setValueAtTime(440, this.ctx.currentTime); 
                    osc.frequency.setValueAtTime(220, this.ctx.currentTime+0.3); 
                    gain.gain.setValueAtTime(0.3*g, this.ctx.currentTime); 
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime+0.5); 
                    dur=0.5; 
                }
                else if(type==='wrong'){ 
                    osc.type='sawtooth'; 
                    osc.frequency.setValueAtTime(200, this.ctx.currentTime); 
                    osc.frequency.setValueAtTime(150, this.ctx.currentTime+0.1); 
                    gain.gain.setValueAtTime(0.2*g, this.ctx.currentTime); 
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime+0.3); 
                }
                else if(type==='warning'){ 
                    osc.type='sine'; 
                    osc.frequency.value=1100; 
                    gain.gain.setValueAtTime(0.15*g, this.ctx.currentTime); 
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime+0.3); 
                }
                osc.start(this.ctx.currentTime); 
                osc.stop(this.ctx.currentTime + dur);
            },
            playBeat(strong = false) {
                if (!this.ctx || !this.enabled) return;
                this.resume();
                const g = this.getSfxGain();
                const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
                osc.connect(gain); gain.connect(this.ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = strong ? 1050 : 700;
                gain.gain.setValueAtTime(0.22 * g, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);
                osc.start(this.ctx.currentTime); osc.stop(this.ctx.currentTime + 0.1);
            },
            playTap() {
                if (!this.ctx || !this.enabled) return;
                this.resume();
                const g = this.getSfxGain();
                const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
                osc.connect(gain); gain.connect(this.ctx.destination);
                osc.type = 'triangle';
                osc.frequency.value = 320;
                gain.gain.setValueAtTime(0.28 * g, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.13);
                osc.start(this.ctx.currentTime); osc.stop(this.ctx.currentTime + 0.15);
            },
            // Rhythm challenge judgment sound: perfect=bright chime, great=mid chime, good=low chime, miss/wrong=buzz
            playHit(jClass) {
                if (!this.ctx || !this.enabled) return;
                this.resume();
                const g = this.getSfxGain();
                const now = this.ctx.currentTime;
                if (jClass === 'perfect') {
                    // Two-tone bright chime
                    [880, 1320].forEach((freq, i) => {
                        const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
                        o.type = 'sine'; o.frequency.value = freq;
                        o.connect(gn); gn.connect(this.ctx.destination);
                        gn.gain.setValueAtTime(0, now + i * 0.04);
                        gn.gain.linearRampToValueAtTime(0.22 * g, now + i * 0.04 + 0.01);
                        gn.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.18);
                        o.start(now + i * 0.04); o.stop(now + i * 0.04 + 0.2);
                    });
                } else if (jClass === 'great') {
                    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
                    o.type = 'sine'; o.frequency.value = 660;
                    o.connect(gn); gn.connect(this.ctx.destination);
                    gn.gain.setValueAtTime(0.2 * g, now);
                    gn.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    o.start(now); o.stop(now + 0.16);
                } else if (jClass === 'good') {
                    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
                    o.type = 'triangle'; o.frequency.value = 440;
                    o.connect(gn); gn.connect(this.ctx.destination);
                    gn.gain.setValueAtTime(0.18 * g, now);
                    gn.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                    o.start(now); o.stop(now + 0.13);
                } else if (jClass === 'miss') {
                    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
                    o.type = 'sine'; o.frequency.value = 200;
                    o.connect(gn); gn.connect(this.ctx.destination);
                    gn.gain.setValueAtTime(0.15 * g, now);
                    gn.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                    o.start(now); o.stop(now + 0.26);
                } else { // wrong
                    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
                    o.type = 'sawtooth'; o.frequency.setValueAtTime(250, now); o.frequency.exponentialRampToValueAtTime(120, now + 0.15);
                    o.connect(gn); gn.connect(this.ctx.destination);
                    gn.gain.setValueAtTime(0.18 * g, now);
                    gn.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                    o.start(now); o.stop(now + 0.19);
                }
            },
            // Short correct/wrong chime for quiz-style answers
            playAnswer(correct) {
                if (!this.ctx || !this.enabled) return;
                this.resume();
                const g = this.getSfxGain();
                const now = this.ctx.currentTime;
                if (correct) {
                    [523, 659, 784].forEach((freq, i) => {
                        const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
                        o.type = 'sine'; o.frequency.value = freq;
                        o.connect(gn); gn.connect(this.ctx.destination);
                        gn.gain.setValueAtTime(0, now + i * 0.07);
                        gn.gain.linearRampToValueAtTime(0.2 * g, now + i * 0.07 + 0.01);
                        gn.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.18);
                        o.start(now + i * 0.07); o.stop(now + i * 0.07 + 0.2);
                    });
                } else {
                    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
                    o.type = 'sawtooth'; o.frequency.setValueAtTime(300, now); o.frequency.exponentialRampToValueAtTime(140, now + 0.2);
                    o.connect(gn); gn.connect(this.ctx.destination);
                    gn.gain.setValueAtTime(0.2 * g, now);
                    gn.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                    o.start(now); o.stop(now + 0.23);
                }
            },
            scheduleTick(audioT, strong = false, countdown = false) {
                // Precise AudioContext-scheduled metronome tick
                if (!this.ctx || !this.enabled) return;
                // Route through a shared metronome bus so we can cut all future ticks
                if (!this._metroBus || this._metroBus.context !== this.ctx) {
                    this._metroBus = this.ctx.createGain();
                    this._metroBus.connect(this.ctx.destination);
                }
                const g = this.getSfxGain();
                const sr = this.ctx.sampleRate;

                // Woodblock / mechanical metronome click using noise burst + pitched body
                const clickDur = 0.06;
                const bufLen = Math.floor(sr * clickDur);
                const buf = this.ctx.createBuffer(1, bufLen, sr);
                const data = buf.getChannelData(0);
                // Shape: sharp attack transient (noise) + decaying sine body
                const bodyFreq = strong ? 1800 : 1100; // Hz — higher pitch on beat 1
                for (let i = 0; i < bufLen; i++) {
                    const t = i / sr;
                    const env = Math.exp(-t * (strong ? 55 : 70));
                    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 300); // transient click
                    const body = Math.sin(2 * Math.PI * bodyFreq * t) * env;
                    data[i] = (noise * 0.4 + body * 0.7) * (strong ? 0.95 : 0.72);
                }
                const src = this.ctx.createBufferSource();
                src.buffer = buf;
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(g, audioT);
                src.connect(gain); gain.connect(this._metroBus);
                src.start(audioT); src.stop(audioT + clickDur + 0.01);
            },
            stopAllTicks() {
                // Disconnect the metronome bus to silence all scheduled ticks
                if (this._metroBus) {
                    try { this._metroBus.disconnect(); } catch(e) { /* ignore */ }
                    this._metroBus = null;
                }
            },
            playInstrumentSound(instrId) {
                if (!this.ctx || !this.enabled) return;
                this.resume();
                const g = this.getSfxGain();
                const now = this.ctx.currentTime;
                const inst = typeof INSTRUMENT_BANK !== 'undefined' && INSTRUMENT_BANK.find(i => i.id === instrId);
                if (!inst) return;
                const p = inst.synthParams;

                if (p.noise) {
                    // Unpitched percussion — white noise shaped with filter + envelope
                    const bufLen = this.ctx.sampleRate * (p.dur || 0.3);
                    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
                    const data = buf.getChannelData(0);
                    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
                    const src = this.ctx.createBufferSource();
                    src.buffer = buf;
                    const filt = this.ctx.createBiquadFilter();
                    filt.type = p.filterType || 'bandpass';
                    filt.frequency.value = p.filterFreq || 3000;
                    filt.Q.value = p.filterQ || 1;
                    const gain = this.ctx.createGain();
                    src.connect(filt); filt.connect(gain); gain.connect(this.ctx.destination);
                    gain.gain.setValueAtTime(0, now);
                    gain.gain.linearRampToValueAtTime((p.vol || 0.3) * g, now + 0.005);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + (p.dur || 0.3));
                    src.start(now); src.stop(now + (p.dur || 0.3));
                    return;
                }

                const osc = this.ctx.createOscillator();
                const gainNode = this.ctx.createGain();
                osc.type = p.wave || 'sine';
                osc.frequency.setValueAtTime(p.freq, now);
                if (p.freqEnd) osc.frequency.exponentialRampToValueAtTime(p.freqEnd, now + (p.dur || 0.8));

                let lastNode = osc;

                // Optional filter
                if (p.filterType) {
                    const filt = this.ctx.createBiquadFilter();
                    filt.type = p.filterType;
                    filt.frequency.value = p.filterFreq || 2000;
                    filt.Q.value = p.filterQ || 1;
                    lastNode.connect(filt);
                    lastNode = filt;
                }

                // Optional vibrato LFO
                if (p.vibRate) {
                    const lfo = this.ctx.createOscillator();
                    const lfoGain = this.ctx.createGain();
                    lfo.frequency.value = p.vibRate;
                    lfoGain.gain.value = p.vibDepth || 3;
                    lfo.connect(lfoGain);
                    lfoGain.connect(osc.frequency);
                    lfo.start(now); lfo.stop(now + (p.dur || 0.8));
                }

                lastNode.connect(gainNode);
                gainNode.connect(this.ctx.destination);

                const vol = (p.vol || 0.3) * g;
                const attack = p.attack || 0.02;
                const dur = p.dur || 0.8;
                gainNode.gain.setValueAtTime(0, now);
                gainNode.gain.linearRampToValueAtTime(vol, now + attack);
                if (p.sustain) {
                    gainNode.gain.setValueAtTime(vol * (p.sustain), now + attack + 0.05);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + dur);
                } else {
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + dur);
                }
                osc.start(now); osc.stop(now + dur);
            }
        };
    }

    // ==========================================
    // 介面切換系統
    // ==========================================
    function switchScreen(screenId) {
        if (isAppShell() && (screenId === 'screen-hub' || screenId === 'screen-app-home')) {
            screenId = 'screen-app-root';
        }
        const current = [...dom.screens].find(s => s.classList.contains('active'));
        const prevScreenId = current?.id;
        const next = dom.screenMap.get(screenId);

        // Cleanup active games when navigating away from game screens
        if (current && current !== next) {
            const cid = current.id;
            if (cid === 'screen-game' && state.gameActive) { state.gameActive = false; clearInterval(state.timer); state.timer = null; }
            if (_countdownTimerId) { clearInterval(_countdownTimerId); _countdownTimerId = null; dom.countdownOverlay?.classList.remove('show'); }
        }

        if (current && current !== next) {
            current.classList.remove('active');
            current.classList.add('screen-exit');
            current.addEventListener('animationend', function handler() {
                current.classList.remove('screen-exit');
                current.removeEventListener('animationend', handler);
            }, { once: true });
            // Fallback cleanup
            setTimeout(() => current.classList.remove('screen-exit'), 300);
        } else if (current) {
            current.classList.remove('active');
        }
        next?.classList.add('active');

        if (isAppShell()) {
            document.body.classList.toggle('app-on-root', screenId === 'screen-app-root');
            if (screenId === 'screen-app-root') {
                try { refreshAppHomeProfile(); } catch (e) {}
            }
            try {
                if (window.AppThreeBg && typeof window.AppThreeBg.setActive === 'function') {
                    window.AppThreeBg.setActive(screenId === 'screen-app-root');
                }
            } catch (e) {}
        }

        // 創作工作室：暫停背景樂；鎖定橫向（離開後恢復直向）
        if (screenId === 'screen-composition-studio') {
            audio.bgPause();
            try { window.AppOrientation && window.AppOrientation.lockLandscape(); } catch (e) {}
        } else if (prevScreenId === 'screen-composition-studio') {
            audio.bgPlay();
            try { window.AppOrientation && window.AppOrientation.lockPortrait(); } catch (e) {}
        }
        
        // 當切換到遊戲畫面時，需要重新計算 Canvas 的大小
        if (screenId === 'screen-game') {
            requestAnimationFrame(() => {
                setupHDPI();
                if (state.currentNote) drawStaff();
            });
        }
    }

    // ==========================================
    // 繪圖系統 (使用純向量數學繪製)
    // ==========================================
    function setupHDPI() {
        const dpr = window.devicePixelRatio || 1;
        const rect = dom.canvasWrapper.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            // Container not laid out yet — schedule retry (capped to prevent infinite loop)
            const retries = (setupHDPI._retries || 0) + 1;
            setupHDPI._retries = retries;
            if (retries > 10) { setupHDPI._retries = 0; return; }
            requestAnimationFrame(() => {
                const r2 = dom.canvasWrapper.getBoundingClientRect();
                if (r2.width && r2.height) {
                    setupHDPI._retries = 0;
                    dom.canvas.width = r2.width * dpr;
                    dom.canvas.height = r2.height * dpr;
                    dom.canvas.style.width = `${r2.width}px`;
                    dom.canvas.style.height = `${r2.height}px`;
                    dom.ctx.scale(dpr, dpr);
                    dom.canvas.logicalWidth = r2.width;
                    dom.canvas.logicalHeight = r2.height;
                    _staffCache = null;
                    if (state.currentNote) drawStaff();
                } else {
                    setupHDPI();
                }
            });
            return;
        }
        setupHDPI._retries = 0;
        dom.canvas.width = rect.width * dpr;
        dom.canvas.height = rect.height * dpr;
        dom.canvas.style.width = `${rect.width}px`;
        dom.canvas.style.height = `${rect.height}px`;
        dom.ctx.scale(dpr, dpr);
        dom.canvas.logicalWidth = rect.width;
        dom.canvas.logicalHeight = rect.height;
        _staffCache = null; // invalidate on resize
    }
    
    function drawTrebleClef(ctx, x, y, ls) {
        // y = G line (2nd line from bottom). Path-based SVG: viewBox 0 0 15.186 40.768
        // G line sits at ~62.3% from top of the SVG
        const imgH = ls * 7.8;
        const imgW = imgH * (15.186 / 40.768);
        const drawX = x - imgW * 0.5;
        const drawY = y - imgH * 0.623;
        if (clefImages.treble.complete && clefImages.treble.naturalWidth > 0) {
            ctx.drawImage(clefImages.treble, drawX, drawY, imgW, imgH);
            return;
        }
        // Fallback: draw path directly on canvas
        ctx.save();
        const scale = imgH / 40.768;
        ctx.translate(drawX, drawY);
        ctx.scale(scale, scale);
        ctx.fillStyle = '#1E1E2F';
        ctx.fill(new Path2D('m12.049 3.5296c0.305 3.1263-2.019 5.6563-4.0772 7.7014-0.9349 0.897-0.155 0.148-0.6437 0.594-0.1022-0.479-0.2986-1.731-0.2802-2.11 0.1304-2.6939 2.3198-6.5875 4.2381-8.0236 0.309 0.5767 0.563 0.6231 0.763 1.8382zm0.651 16.142c-1.232-0.906-2.85-1.144-4.3336-0.885-0.1913-1.255-0.3827-2.51-0.574-3.764 2.3506-2.329 4.9066-5.0322 5.0406-8.5394 0.059-2.232-0.276-4.6714-1.678-6.4836-1.7004 0.12823-2.8995 2.156-3.8019 3.4165-1.4889 2.6705-1.1414 5.9169-0.57 8.7965-0.8094 0.952-1.9296 1.743-2.7274 2.734-2.3561 2.308-4.4085 5.43-4.0046 8.878 0.18332 3.334 2.5894 6.434 5.8702 7.227 1.2457 0.315 2.5639 0.346 3.8241 0.099 0.2199 2.25 1.0266 4.629 0.0925 6.813-0.7007 1.598-2.7875 3.004-4.3325 2.192-0.5994-0.316-0.1137-0.051-0.478-0.252 1.0698-0.257 1.9996-1.036 2.26-1.565 0.8378-1.464-0.3998-3.639-2.1554-3.358-2.262 0.046-3.1904 3.14-1.7356 4.685 1.3468 1.52 3.833 1.312 5.4301 0.318 1.8125-1.18 2.0395-3.544 1.8325-5.562-0.07-0.678-0.403-2.67-0.444-3.387 0.697-0.249 0.209-0.059 1.193-0.449 2.66-1.053 4.357-4.259 3.594-7.122-0.318-1.469-1.044-2.914-2.302-3.792zm0.561 5.757c0.214 1.991-1.053 4.321-3.079 4.96-0.136-0.795-0.172-1.011-0.2626-1.475-0.4822-2.46-0.744-4.987-1.116-7.481 1.6246-0.168 3.4576 0.543 4.0226 2.184 0.244 0.577 0.343 1.197 0.435 1.812zm-5.1486 5.196c-2.5441 0.141-4.9995-1.595-5.6343-4.081-0.749-2.153-0.5283-4.63 0.8207-6.504 1.1151-1.702 2.6065-3.105 4.0286-4.543 0.183 1.127 0.366 2.254 0.549 3.382-2.9906 0.782-5.0046 4.725-3.215 7.451 0.5324 0.764 1.9765 2.223 2.7655 1.634-1.102-0.683-2.0033-1.859-1.8095-3.227-0.0821-1.282 1.3699-2.911 2.6513-3.198 0.4384 2.869 0.9413 6.073 1.3797 8.943-0.5054 0.1-1.0211 0.143-1.536 0.143z'));
        ctx.restore();
    }



    function drawSharp(ctx, x, y, ls) {
        ctx.save();
        ctx.fillStyle = '#1E1E2F';
        ctx.font = `900 ${Math.round(ls * 2.2)}px Bravura, "Noto Music", "Apple Symbols", "Segoe UI Symbol", serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText('\u266F', x, y);
        ctx.restore();
    }

    function drawBassClef(ctx, x, y, ls) {
        // y = F3 line (4th line from bottom = yFactor 1)
        const img = clefImages.bass;
        const imgH = ls * 4.5;
        const imgW = imgH * (100 / 120);
        if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, x - imgW * 0.12, y - imgH * 0.38, imgW, imgH);
            return;
        }
        ctx.save();
        ctx.fillStyle = '#1E1E2F';
        ctx.font = `${Math.round(ls * 4.2)}px Bravura, "Noto Music", "Apple Symbols", "Segoe UI Symbol", serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText('\uD834\uDD22', x - ls * 0.2, y + ls * 0.6);
        ctx.restore();
    }

    function drawFlat(ctx, x, y, ls) {
        ctx.save(); ctx.translate(x, y); const s = ls / 10; ctx.scale(s, s);
        ctx.beginPath(); ctx.moveTo(-3, -16); ctx.lineTo(-3, 8); ctx.strokeStyle = '#1E1E2F'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-3, -4); ctx.bezierCurveTo(8, -10, 12, 5, -3, 8); ctx.bezierCurveTo(3, 4, 1, -2, -3, -4); ctx.fillStyle = '#1E1E2F'; ctx.fill();
        ctx.restore();
    }

    function drawStaff() {
        if(!dom.canvas.logicalWidth) setupHDPI();
        const w = dom.canvas.logicalWidth, h = dom.canvas.logicalHeight, ctx = dom.ctx;
        if (!w || !h) return;
        ctx.clearRect(0, 0, w, h);

        // ---- build / reuse offscreen cache for staff lines + clef ----
        const dpr = window.devicePixelRatio || 1;
        const currentClef = state.currentNote ? state.currentNote.clef : 'treble';
        const clefLoaded = clefImages[currentClef]?.complete && clefImages[currentClef]?.naturalWidth > 0;
        const ls = w < 340 ? 14 : w < 400 ? 16 : 22;
        if (!_staffCache || _staffCache.w !== w || _staffCache.h !== h || _staffCache.dpr !== dpr || _staffCache.clefLoaded !== clefLoaded || _staffCache.clef !== currentClef) {
            const oc = document.createElement('canvas');
            oc.width = w * dpr; oc.height = h * dpr;
            const oc_ctx = oc.getContext('2d');
            oc_ctx.scale(dpr, dpr);
            // Center staff vertically: clef extends ~3.2*ls above baseY, lowest note ~5.5*ls below
            // Content center is at baseY + 1.15*ls, so baseY = h/2 - 1.15*ls
            const _baseY = Math.round(h / 2 - ls * 1.15), _startX = w < 400 ? 30 : 50;
            oc_ctx.strokeStyle = '#1E1E2F'; oc_ctx.lineWidth = 2; oc_ctx.lineCap = 'round';
            oc_ctx.beginPath();
            for (let i = 0; i < 5; i++) { oc_ctx.moveTo(_startX, _baseY + i*ls); oc_ctx.lineTo(w - _startX, _baseY + i*ls); }
            oc_ctx.stroke();
            if (currentClef === 'bass') {
                drawBassClef(oc_ctx, _startX + (w < 400 ? 20 : 35), _baseY + ls * 1, ls);
            } else {
                drawTrebleClef(oc_ctx, _startX + (w < 400 ? 20 : 35), _baseY + ls * 3, ls);
            }
            _staffCache = { canvas: oc, w, h, dpr, ls, clefLoaded, clef: currentClef, baseY: _baseY, startX: _startX };
        }
        ctx.drawImage(_staffCache.canvas, 0, 0, w, h);
        if (dom.clefBadge) dom.clefBadge.textContent = currentClef === 'bass' ? '低音譜號' : '高音譜號';

        const baseY = _staffCache.baseY, startX = _staffCache.startX;
        // Shift note rightward so it never overlaps with the clef
        const clefEndX = startX + (w < 400 ? 20 : 35) + ls * 3;
        const staffEndX = w - startX;
        const centerX = Math.round(clefEndX + (staffEndX - clefEndX) / 2);
        const middleLineY = baseY + 2 * ls;

        if (!state.currentNote) return;

        const noteY = baseY + state.currentNote.yFactor * ls;
        
        const highlightLineEl = dom.highlightLine;
        if (highlightLineEl && highlightLineEl.checked && !state.answered) {
            ctx.strokeStyle = 'rgba(6, 214, 160, 0.4)'; ctx.lineWidth = ls * 0.8;
            ctx.beginPath(); ctx.moveTo(centerX-35, noteY); ctx.lineTo(centerX+35, noteY); ctx.stroke();
        }

        ctx.strokeStyle = '#1E1E2F'; ctx.lineWidth = 2.5; const lW = 24;
        ctx.beginPath();
        if (state.currentNote.yFactor > 4) for(let i=1; i<=Math.floor(state.currentNote.yFactor - 4); i++) { ctx.moveTo(centerX-lW, baseY + (4+i)*ls); ctx.lineTo(centerX+lW, baseY + (4+i)*ls); }
        if (state.currentNote.yFactor < 0) for(let i=1; i<=Math.floor(Math.abs(state.currentNote.yFactor)); i++) { ctx.moveTo(centerX-lW, baseY - i*ls); ctx.lineTo(centerX+lW, baseY - i*ls); }
        ctx.stroke();

        if (state.currentNote.accidental) { 
            const accX = centerX - ls * 1.7;
            if (state.currentNote.accidental === '#') drawSharp(ctx, accX, noteY, ls);
            else drawFlat(ctx, accX, noteY, ls);
        }

        const headStyle = dom.noteHeadStyle ? dom.noteHeadStyle.value : 'filled';
        if (headStyle === 'whole' && noteImages.whole.complete && noteImages.whole.naturalWidth > 0) {
            const nh = ls * 1.15, nw = nh * (80 / 60);
            ctx.drawImage(noteImages.whole, centerX - nw / 2, noteY - nh / 2, nw, nh);
        } else if (headStyle === 'half' && noteImages.half.complete && noteImages.half.naturalWidth > 0) {
            const nh = ls * 1.05, nw = nh * (80 / 60);
            ctx.drawImage(noteImages.half, centerX - nw / 2, noteY - nh / 2, nw, nh);
            ctx.strokeStyle = '#1E1E2F'; ctx.lineWidth = 2.5; ctx.beginPath();
            if (noteY < middleLineY) { ctx.moveTo(centerX - ls*0.55, noteY + 2); ctx.lineTo(centerX - ls*0.55, noteY + ls*3.5); }
            else { ctx.moveTo(centerX + ls*0.55, noteY - 2); ctx.lineTo(centerX + ls*0.55, noteY - ls*3.5); }
            ctx.stroke();
        } else {
            ctx.fillStyle = '#1E1E2F'; ctx.strokeStyle = '#1E1E2F'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.ellipse(centerX, noteY, ls*0.65, ls*0.48, -0.35, 0, Math.PI*2);
            if (headStyle === 'whole') ctx.stroke();
            else {
                if (headStyle === 'half') { ctx.fillStyle = 'white'; ctx.fill(); ctx.stroke(); } else ctx.fill();
                ctx.beginPath();
                if (noteY < middleLineY) { ctx.moveTo(centerX - ls*0.55, noteY + 2); ctx.lineTo(centerX - ls*0.55, noteY + ls*3.5); }
                else { ctx.moveTo(centerX + ls*0.55, noteY - 2); ctx.lineTo(centerX + ls*0.55, noteY - ls*3.5); }
                ctx.stroke();
            }
        }

        if (state.showAnswerHighlight) {
            ctx.save();
            ctx.strokeStyle = '#FF4A6B'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.arc(centerX, noteY, ls * 1.3, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#FF4A6B';
            ctx.font = `bold ${Math.round(ls * 0.85)}px 'Nunito', 'Noto Sans TC', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = noteY > middleLineY ? 'top' : 'bottom';
            const _solLabel = noteSol(state.currentNote); ctx.fillText(state.currentNote.correctName + (_solLabel ? ' = ' + _solLabel : ''), centerX, noteY > middleLineY ? noteY + ls * 1.6 : noteY - ls * 1.6);
            ctx.restore();
        }
    }

    // ==========================================
    // 遊戲主邏輯
    // ==========================================
    function toggleCheckboxAppearance() {
        dom.checkboxItems.forEach(lbl => {
            const cb = lbl.querySelector('input');
            if(cb && cb.checked) lbl.classList.add('checked'); else lbl.classList.remove('checked');
        });
    }

    function handleTextbookModeChange() {
        const tbMode = dom.textbookMode ? dom.textbookMode.value : "0";
        const groups = [dom.clefGroup, dom.accidentalGroup, dom.ledgerGroup, dom.noteRangeGroup];
        if (tbMode !== "0") {
            groups.forEach(el => { if (el) el.classList.add('disabled-group'); });
            const cfg = TEXTBOOK_CONFIG[tbMode];
            if (cfg) {
                if (dom.clefTreble) dom.clefTreble.checked = cfg.clef.includes('treble');
                if (dom.clefBass)   dom.clefBass.checked   = cfg.clef.includes('bass');
                if (dom.accidentalSharp) dom.accidentalSharp.checked = cfg.accidentalChance > 0;
                if (dom.accidentalFlat) dom.accidentalFlat.checked = cfg.accidentalChance > 0;
                if (dom.ledgerLineAbove) dom.ledgerLineAbove.checked = cfg.ledgerAbove;
                if (dom.ledgerLineBelow) dom.ledgerLineBelow.checked = cfg.ledgerBelow;
                if (dom.noteRangeFrom) dom.noteRangeFrom.value = String(cfg.noteRange[0]);
                if (dom.noteRangeTo) dom.noteRangeTo.value = String(cfg.noteRange[1]);
            }
        } else {
            groups.forEach(el => { if (el) el.classList.remove('disabled-group'); });
        }
        toggleCheckboxAppearance(); buildNoteButtons();
    }

    function saveSettings() {
        const s = {};
        s.lastMode = state.currentMode;
        s.practiceDiff = state.practiceDiff;
        s.keysigGrade = state.keysigGrade;
        s.solfegeGrade = state.solfegeGrade;
        s.savedName = dom.userName.value;
        const customInp = _customNameInput;
        if (dom.userName.value === '__other__' && customInp) s.savedCustomName = customInp.value;
        try { localStorage.setItem('musicGameSettingsV4', JSON.stringify(s)); } catch(e) { /* QuotaExceeded — skip silently */ }
    }

    function loadSavedSettings() {
        const stored = localStorage.getItem('musicGameSettingsV4');
        if (!stored) return;
        try {
            const s = JSON.parse(stored);
            if (s) {

                if (s.practiceDiff) state.practiceDiff = s.practiceDiff;
                if (s.keysigGrade) state.keysigGrade = parseInt(s.keysigGrade);
                if (s.solfegeGrade) state.solfegeGrade = parseInt(s.solfegeGrade);
                if (s.lastMode && MODE_CONFIG[s.lastMode]) {
                    state.currentMode = s.lastMode; state.modeConfig = MODE_CONFIG[s.lastMode];
                    dom.modeCards.forEach(c => c.classList.remove('active'));
                    const isClefChallenge = s.lastMode === 'classic60' || s.lastMode === 'bass60' || s.lastMode === 'mixed60';
                    const isKeysigMode = s.lastMode === 'keysig_practice' || s.lastMode === 'keysig60';
                    const isSolfegeMode = s.lastMode === 'solfege_practice' || s.lastMode === 'solfege60';
                    if (isClefChallenge) { dom.modeCardMap.get('classic60')?.classList.add('active'); }
                    else if (isKeysigMode) { dom.modeCardMap.get('keysig_practice')?.classList.add('active'); }
                    else if (isSolfegeMode) { dom.modeCardMap.get('solfege_practice')?.classList.add('active'); }
                    else { dom.modeCardMap.get(s.lastMode)?.classList.add('active'); }
                }
                // Restore saved student name after populating dropdown
                if (s.savedName) {
                    populateNameDropdown();
                    dom.userName.value = s.savedName;
                    if (s.savedName === '__other__') {
                        showCustomName();
                        dom.userId.readOnly = false;
                        if (_customNameInput && s.savedCustomName) _customNameInput.value = s.savedCustomName;
                        if (s.userId) dom.userId.value = s.userId;
                    } else {
                        const sel = dom.userName.selectedOptions[0];
                        if (sel && sel.dataset.seat) dom.userId.value = sel.dataset.seat;
                    }
                }
            }
        } catch (e) {
            console.error('Error loading settings:', e);
        }
        buildNoteButtons();
    }

    function updateScoreboard() {
        dom.scoreDisplay.textContent = state.score;
        dom.comboDisplay.textContent = state.combo;
        if (dom.scoreBadge) { dom.scoreBadge.classList.remove('pop'); void dom.scoreBadge.offsetWidth; dom.scoreBadge.classList.add('pop'); }
        if (dom.comboBadge) { dom.comboBadge.classList.remove('pop'); void dom.comboBadge.offsetWidth; dom.comboBadge.classList.add('pop'); }
        if (dom.practiceBadge) {
            const isPractice = state.modeConfig && state.modeConfig.type === 'practice';
            dom.practiceBadge.style.display = isPractice ? '' : 'none';
            if (isPractice && dom.practiceCount) {
                dom.practiceCount.textContent = `${state.totalQuestions - state.wrongCount} / ${state.totalQuestions}`;
            }
        }
    }

    function showComboBurst(combo) {
        const el = document.createElement('div');
        el.className = 'combo-burst';
        el.textContent = combo >= 10 ? `🔥 ${combo} 題連續答對。` : `⚡ ${combo} 題連續答對。`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 900);
    }

    function spawnConfetti(count) {
        const colors = ['#FF65A3','#FFCB45','#00D28E','#00A6ED','#8B66FF','#FF8C42','#FF4A6B'];
        const frag = document.createDocumentFragment();
        const pieces = new Array(count);
        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = (30 + Math.random() * 40) + 'vw';
            piece.style.top = (35 + Math.random() * 20) + 'vh';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = (Math.random() * 0.3) + 's';
            piece.style.animationDuration = (0.8 + Math.random() * 0.6) + 's';
            piece.style.width = (6 + Math.random() * 8) + 'px';
            piece.style.height = (6 + Math.random() * 8) + 'px';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            pieces[i] = piece;
            frag.appendChild(piece);
        }
        document.body.appendChild(frag);
        setTimeout(() => { for (let i = 0; i < pieces.length; i++) pieces[i].remove(); }, 1400);
    }

    function showScoreFloat(points, x, y) {
        const el = document.createElement('div');
        el.className = 'score-float';
        el.textContent = '+' + points;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 900);
    }
    
    function enableGameControls(enabled) {
        noteBtnMap.forEach(btn => {
            const rowHidden = btn.closest('.note-row')?.style.display === 'none';
            btn.disabled = rowHidden || !enabled || state.answered;
        });
        dom.revealBtn.disabled = !enabled || state.answered;
        dom.skipBtn.disabled = !enabled || state.answered;
        dom.endBtn.disabled = !enabled;
    }

    function _getPracticeConfig() {
        const DIFF_TB = {'1':'1','2':'2','3':'3','4':'5','5':'6'};
        const tbKey = DIFF_TB[state.practiceDiff] || '3';
        return TEXTBOOK_CONFIG[tbKey];
    }

    function generateNote() {
        let clefOptions = [], accidentalChance = 0, noteRange = [0, 10], allowAbove = true, allowBelow = true;
        
        // Challenge modes can force a specific clef
        const forceClef = state.modeConfig && state.modeConfig.forceClef;
        
        if (forceClef) {
            // Use per-clef, per-grade challenge levels
            const gradeKey = state.currentUser ? state.currentUser.grade : 3;
            if (forceClef === 'treble') clefOptions = ['treble'];
            else if (forceClef === 'bass') clefOptions = ['bass'];
            else clefOptions = ['treble','bass'];
            // Pick clef first so we can load the right level config
            const clef = clefOptions[Math.floor(Math.random() * clefOptions.length)];
            const lvl = (CHALLENGE_LEVELS[clef] && CHALLENGE_LEVELS[clef][gradeKey]) || CHALLENGE_LEVELS.treble[3];
            accidentalChance = lvl.accidentalChance;
            allowAbove = lvl.ledgerAbove; allowBelow = lvl.ledgerBelow;
            noteRange = lvl.noteRange;
            // Skip the clef selection below — we already chose
            const maxIdx = Math.min(noteRange[1], MAPS[clef].length - 1);
            const poolSize = maxIdx - noteRange[0] + 1;
            const pickBase = () => MAPS[clef][Math.floor(Math.random() * poolSize) + noteRange[0]];
            let base = pickBase();
            if (poolSize > 1) { let tries = 0; while (base.letter === state.lastNoteLetter && tries < 20) { base = pickBase(); tries++; } }
            let finalName = base.letter, accidental = null;
            if (Math.random() < accidentalChance) {
                const isSharp = Math.random() < 0.5;
                if (isSharp && base.letter !== 'E' && base.letter !== 'B') { finalName += '#'; accidental = '#'; }
                else if (!isSharp && base.letter !== 'F' && base.letter !== 'C') { finalName += '♭'; accidental = '♭'; }
            }
            const note = { ...base, clef, accidental, correctName: finalName, freqKey: finalName + base.octave };
            state.lastNoteLetter = base.letter;
            return note;
        } else {
            // Practice mode — use difficulty-based config
            const config = _getPracticeConfig();
            clefOptions = config.clef; accidentalChance = config.accidentalChance; noteRange = config.noteRange; allowAbove = config.ledgerAbove; allowBelow = config.ledgerBelow;
        }

        const clef = clefOptions[Math.floor(Math.random() * clefOptions.length)];
        // Bass clef uses its full range; range pickers are treble-only
        const effRange = clef === 'bass' ? [0, MAPS.bass.length - 1] : noteRange;
        const maxIdx = Math.min(effRange[1], MAPS[clef].length - 1);
        const poolSize = maxIdx - effRange[0] + 1;
        const pickBase = () => MAPS[clef][Math.floor(Math.random() * poolSize) + effRange[0]];
        let base = pickBase();
        // Anti-repeat: never repeat the same note letter consecutively
        if (poolSize > 1) { let tries = 0; while (base.letter === state.lastNoteLetter && tries < 20) { base = pickBase(); tries++; } }

        let finalName = base.letter, accidental = null;
        if (Math.random() < accidentalChance) {
            const isSharp = Math.random() < 0.5;
            if (isSharp && base.letter !== 'E' && base.letter !== 'B') { finalName += '#'; accidental = '#'; }
            else if (!isSharp && base.letter !== 'F' && base.letter !== 'C') { finalName += '♭'; accidental = '♭'; }
        }
        const note = { ...base, clef, accidental, correctName: finalName, freqKey: finalName + base.octave };
        state.lastNoteLetter = base.letter;
        return note;
    }

    function buildNoteButtons() {
        // Derive sharp/flat visibility from active config
        const forceClef = state.modeConfig && state.modeConfig.forceClef;
        const gradeKey = state.currentUser ? state.currentUser.grade : 3;
        let hasAccidentals;
        if (forceClef) {
            const clefKey = forceClef === 'mixed' ? 'treble' : forceClef;
            const lvl = (CHALLENGE_LEVELS[clefKey] && CHALLENGE_LEVELS[clefKey][gradeKey]) || CHALLENGE_LEVELS.treble[3];
            hasAccidentals = lvl.accidentalChance > 0;
        } else {
            hasAccidentals = _getPracticeConfig().accidentalChance > 0;
        }
        const showSharp = hasAccidentals;
        const showFlat  = hasAccidentals;

        if (!_noteRowsBuilt) {
            dom.notesGrid.innerHTML = '';
            noteBtnMap.clear();
            const keys = { 'C':'1', 'D':'2', 'E':'3', 'F':'4', 'G':'5', 'A':'6', 'B':'7', 'C#':'Q', 'D#':'W', 'F#':'E', 'G#':'R', 'A#':'T', 'D♭':'A', 'E♭':'S', 'G♭':'D', 'A♭':'F', 'B♭':'G'};
            const gridFrag = document.createDocumentFragment();
            const buildRow = (notes, cls) => {
                const div = document.createElement('div'); div.className = 'note-row';
                notes.forEach(n => {
                    const btn = document.createElement('button'); btn.className = `note-btn ${cls}`; btn.dataset.note = n; btn.disabled = true;
                    const sol = SOLFEGE[n]; btn.innerHTML = `${sol?`<span class="note-sol">${sol}</span>`:''}${n}<span class="key-hint">${keys[n]}</span>`;
                    if (window.AudioEngine && window.AudioEngine.onInstantTap) {
                        window.AudioEngine.onInstantTap(btn, () => handleAnswer(n));
                    } else {
                        btn.addEventListener('click', () => handleAnswer(n));
                    }
                    noteBtnMap.set(n, btn);
                    div.appendChild(btn);
                }); return div;
            };
            gridFrag.appendChild(buildRow(['C','D','E','F','G','A','B'], 'natural'));
            _sharpRow = buildRow(['C#','D#','F#','G#','A#'], 'sharp'); gridFrag.appendChild(_sharpRow);
            _flatRow  = buildRow(['D♭','E♭','G♭','A♭','B♭'], 'flat');  gridFrag.appendChild(_flatRow);
            dom.notesGrid.appendChild(gridFrag);
            _noteRowsBuilt = true;
        }
        if (_sharpRow) _sharpRow.style.display = showSharp ? '' : 'none';
        if (_flatRow)  _flatRow.style.display  = showFlat  ? '' : 'none';
    }

    function handleAnswer(answer) {
        if (!state.gameActive || state.answered) return;
        // Capture first-attempt flag and elapsed before setting attemptedThisQuestion
        const isFirstAttempt = !state.attemptedThisQuestion;
        const elapsed = Date.now() - state.questionStartTime;
        if (isFirstAttempt) {
            state.answerTimeList.push(elapsed / 1000);
            state.totalQuestions++;
            state.attemptedThisQuestion = true;
        }
        const correct = answer === state.currentNote.correctName, btn = noteBtnMap.get(answer);

        if (correct) {
            state.answered = true; 
            state.combo++; 
            if (state.combo > state.maxCombo) state.maxCombo = state.combo;
            // Track slow-correct: first attempt correct but took > 4 seconds
            if (isFirstAttempt && elapsed > SLOW_ANSWER_MS) {
                state.slowNoteStats[state.currentNote.correctName] = (state.slowNoteStats[state.currentNote.correctName] || 0) + 1;
            }
            const pts = state.modeConfig.type === 'challenge' ? Math.round(10 * state.modeConfig.scoreMulti + state.combo) : 0;
            if (pts) state.score += pts;
            const _sol = noteSol(state.currentNote); const _secs = isFirstAttempt ? ` ⚡ ${(elapsed/1000).toFixed(1)}s` : ''; dom.messageBox.textContent = `✅ 回答正確。${state.currentNote.correctName}${_sol?' = '+_sol:''}${_secs} ✨ 得分：${state.score}`; 
            dom.messageBox.className = 'message-box correct';
            audio.playNote(state.currentNote.freqKey);
            if (btn) { btn.classList.add('correct'); if (pts) { const r = btn.getBoundingClientRect(); showScoreFloat(pts, r.left + r.width/2 - 15, r.top - 10); } }
            if (state.combo > 0 && state.combo % COMBO_CONFETTI_INTERVAL === 0) { showComboBurst(state.combo); spawnConfetti(Math.min(state.combo, MAX_CONFETTI)); }
            // Practice mode milestone
            if (state.modeConfig.type === 'practice') {
                const correctCount = state.totalQuestions - state.wrongCount;
                if (correctCount > 0 && correctCount % 20 === 0) {
                    showComboBurst(correctCount); spawnConfetti(MAX_CONFETTI + 5);
                    dom.messageBox.textContent = `🎯 已答對 ${correctCount} 題！表現良好，請繼續練習。`;
                }
            }
            setTimeout(() => { if (!state.gameActive) return; if (btn) btn.classList.remove('correct', 'wrong'); nextQuestion(); }, 500);
        } else {
            const clefLabel = state.currentNote.clef === 'bass' ? '低音' : '高音';
            const statKey = `${state.currentNote.correctName} (${clefLabel})`;
            state.wrongNoteStats[statKey] = (state.wrongNoteStats[statKey]||0) + 1; 
            state.combo = 0; 
            audio.playEffect('wrong');
            
            state.answered = true; 
            state.wrongCount++; 
            state.showAnswerHighlight = true; drawStaff();
            const _sol2 = noteSol(state.currentNote); const _secs2 = isFirstAttempt ? `（${(elapsed/1000).toFixed(1)}s）` : ''; dom.messageBox.textContent = `❌ 回答不正確。正確答案是 ${state.currentNote.correctName}${_sol2?' ('+_sol2+')':''}${_secs2}，請記下正確答案。`; 
            dom.messageBox.className = 'message-box wrong';
            if (btn) btn.classList.add('wrong'); 
            setTimeout(() => { if (!state.gameActive) return; if (btn) btn.classList.remove('wrong'); if(state.modeConfig.maxWrong !== Infinity) endGame(); else nextQuestion(); }, 1500);
        } 
        updateScoreboard();
    }

    function nextQuestion() { 
        state.currentNote = generateNote(); 
        state.answered = false;
        state.attemptedThisQuestion = false;
        state.showAnswerHighlight = false;
        state.questionStartTime = Date.now();
        if (!dom.canvas.logicalWidth) setupHDPI();
        drawStaff();
        // Retry draw after layout if canvas still not ready
        if (!dom.canvas.logicalWidth) requestAnimationFrame(() => { setupHDPI(); drawStaff(); });
        enableGameControls(true); 
    }

    function startCountdown(callback) {
        let count = 3; 
        dom.countdownOverlay.textContent = count; 
        dom.countdownOverlay.classList.add('show'); 
        audio.playEffect('countdown');
        if (_countdownTimerId) clearInterval(_countdownTimerId);
        _countdownTimerId = setInterval(() => {
            count--;
            if (count <= 0) { 
                clearInterval(_countdownTimerId);
                _countdownTimerId = null;
                dom.countdownOverlay.classList.remove('show'); 
                callback(); 
            }
            else { 
                dom.countdownOverlay.textContent = count; 
                dom.countdownOverlay.classList.remove('show'); 
                void dom.countdownOverlay.offsetWidth; 
                dom.countdownOverlay.classList.add('show'); 
                audio.playEffect('countdown'); 
            }
        }, 1000);
    }

    function startGame() {
        audio.init(); 
        audio.warmUp();
        // Ensure keysig/solfege UI is hidden for normal note-name game
        showKeysigUI(false);
        showSolfegeUI(false);
        if (dom.notesGrid) dom.notesGrid.style.display = '';
        const canvasWrapper = document.getElementById('canvasWrapper');
        if (canvasWrapper) canvasWrapper.style.display = '';
        const clefBadge = document.getElementById('clefBadge');
        if (clefBadge) clefBadge.style.display = '';
        const playerName = getPlayerName();
        if (!playerName) {
            dom.nameField.classList.add('error');
            alert('❗ 請先請先選擇姓名，方可開始。');
            return;
        }
        dom.nameField.classList.remove('error');
        saveSettings();
        state.currentUser = { name: playerName, grade: parseInt(dom.userGrade.value), class: dom.userClass.value, id: dom.userId.value };
        markProfilePlayStart();
        buildNoteButtons();
        dom.inGameUser.textContent = `👋 ${state.currentUser.name} 同學 · ${state.modeConfig.name}`;
        dom.endBtn.textContent = state.modeConfig.type === 'practice' ? '📊 結束練習' : '🏁 結束挑戰';

        state.gameActive = false; 
        state.timeLeft = state.modeConfig.duration; 
        state.score = 0; 
        state.totalQuestions = 0; 
        state.wrongCount = 0; 
        state.combo = 0; 
        state.maxCombo = 0; 
        state.answered = false; 
        state.wrongNoteStats = {}; 
        state.answerTimeList = [];
        state.slowNoteStats = {};
        state.lastNoteLetter = null;
        state.attemptedThisQuestion = false;
        if (state.timer) { clearInterval(state.timer); state.timer = null; }
        
        // Ensure bg music is playing (may have been stopped after last game)
        audio.bgPlay();
        switchScreen('screen-game');

        startCountdown(() => {
            state.gameActive = true;
            if (state.timeLeft !== Infinity) { 
                state.timer = setInterval(updateTimer, 1000); 
                dom.timeDisplay.textContent = `${state.timeLeft}s`; 
            } else {
                dom.timeDisplay.textContent = '∞';
            }
            dom.timeProgress.style.width = '100%'; 
            dom.timeProgress.style.transition = 'none'; 
            updateScoreboard();
            dom.messageBox.textContent = `🎵 ${state.modeConfig.name} — 練習開始。`; 
            dom.messageBox.className = 'message-box'; 
            nextQuestion();
            if (state.timeLeft !== Infinity) {
                setTimeout(() => { 
                    dom.timeProgress.style.transition = `width ${state.timeLeft}s linear`; 
                    dom.timeProgress.style.width = '0%'; 
                }, 50);
            }
        });
    }

    function updateTimer() {
        if (state.timeLeft === Infinity) return; 
        state.timeLeft--; 
        dom.timeDisplay.textContent = `${state.timeLeft}s`;
        if (state.timeLeft === 10) { 
            dom.timeDisplay.classList.add('warning'); 
            dom.timeProgress.classList.add('warning'); 
            dom.messageBox.textContent = '⚠️ 剩餘 10 秒。'; 
            dom.messageBox.className = 'message-box warning'; 
        }
        if (state.timeLeft <= 10 && state.timeLeft > 0) audio.playEffect('warning');
        if (state.timeLeft <= 0) { 
            clearInterval(state.timer); 
            dom.timeDisplay.classList.remove('warning'); 
            dom.timeProgress.classList.remove('warning'); 
            audio.playEffect('timeup'); 
            endGame(); 
        }
    }

    // ==========================================
    // 調號辨別遊戲
    // ==========================================
    let _keysigCurrentQ = null;

    function showKeysigUI(show) {
        const keysigDisplay = document.getElementById('keysigDisplay');
        const keysigOptions = document.getElementById('keysigOptions');
        const canvasWrapper = document.getElementById('canvasWrapper');
        const clefBadge = document.getElementById('clefBadge');
        if (keysigDisplay) keysigDisplay.style.display = show ? 'flex' : 'none';
        if (keysigOptions) keysigOptions.style.display = show ? 'grid' : 'none';
        if (canvasWrapper) canvasWrapper.style.display = show ? 'none' : '';
        if (clefBadge) clefBadge.style.display = show ? 'none' : '';
        if (dom.notesGrid) dom.notesGrid.style.display = show ? 'none' : '';
    }

    function generateKeysigQuestion(grade) {
        const pool = getKeysigPool(grade);
        if (pool.length < 2) return null;
        const correct = pool[Math.floor(Math.random() * pool.length)];
        // Pick 3 distractors
        const others = pool.filter(k => k.id !== correct.id);
        const shuffled = others.sort(() => Math.random() - 0.5);
        const distractors = shuffled.slice(0, Math.min(3, shuffled.length));
        const options = [correct, ...distractors].sort(() => Math.random() - 0.5);
        return { correct, options, img: correct.img };
    }

    function renderKeysigQuestion(q) {
        _keysigCurrentQ = q;
        const keysigImg = document.getElementById('keysigImg');
        const keysigOptions = document.getElementById('keysigOptions');
        if (keysigImg) { keysigImg.src = q.img; keysigImg.alt = '辨別此調號'; }
        if (!keysigOptions) return;
        keysigOptions.innerHTML = '';
        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'keysig-opt-btn';
            btn.textContent = opt.name;
            btn.disabled = false;
            btn.addEventListener('click', () => handleKeysigAnswer(opt, btn));
            keysigOptions.appendChild(btn);
        });
    }

    function handleKeysigAnswer(selected, btn) {
        if (!state.gameActive || state.answered) return;
        const q = _keysigCurrentQ;
        if (!q) return;
        const isFirstAttempt = !state.attemptedThisQuestion;
        const elapsed = Date.now() - state.questionStartTime;
        if (isFirstAttempt) {
            state.answerTimeList.push(elapsed / 1000);
            state.totalQuestions++;
            state.attemptedThisQuestion = true;
        }
        const correct = selected.id === q.correct.id;
        if (correct) {
            state.answered = true;
            state.combo++;
            if (state.combo > state.maxCombo) state.maxCombo = state.combo;
            if (isFirstAttempt && elapsed > SLOW_ANSWER_MS) {
                state.slowNoteStats[q.correct.name] = (state.slowNoteStats[q.correct.name] || 0) + 1;
            }
            const pts = state.modeConfig.type === 'challenge' ? Math.round(10 * state.modeConfig.scoreMulti + state.combo) : 0;
            if (pts) state.score += pts;
            const _secs = isFirstAttempt ? ` ⚡ ${(elapsed/1000).toFixed(1)}s` : '';
            dom.messageBox.textContent = `✅ 回答正確。${q.correct.name}${_secs} ✨ 得分：${state.score}`;
            dom.messageBox.className = 'message-box correct';
            if (btn) { btn.classList.add('correct'); if (pts) { const r = btn.getBoundingClientRect(); showScoreFloat(pts, r.left + r.width/2 - 15, r.top - 10); } }
            if (state.combo > 0 && state.combo % COMBO_CONFETTI_INTERVAL === 0) { showComboBurst(state.combo); spawnConfetti(Math.min(state.combo, MAX_CONFETTI)); }
            if (state.modeConfig.type === 'practice') {
                const correctCount = state.totalQuestions - state.wrongCount;
                if (correctCount > 0 && correctCount % 20 === 0) {
                    showComboBurst(correctCount); spawnConfetti(MAX_CONFETTI + 5);
                    dom.messageBox.textContent = `🎯 已答對 ${correctCount} 題！表現良好，請繼續練習。`;
                }
            }
            setTimeout(() => { if (!state.gameActive) return; nextKeysigQuestion(); }, 500);
        } else {
            state.wrongNoteStats[q.correct.name] = (state.wrongNoteStats[q.correct.name] || 0) + 1;
            state.combo = 0;
            audio.playEffect('wrong');
            state.answered = true;
            state.wrongCount++;
            dom.messageBox.textContent = `❌ 回答不正確。正確答案是 ${q.correct.name}，請記下正確答案。`;
            dom.messageBox.className = 'message-box wrong';
            if (btn) btn.classList.add('wrong');
            // Highlight correct
            const opts = document.querySelectorAll('.keysig-opt-btn');
            opts.forEach(b => { if (b.textContent === q.correct.name) b.classList.add('correct'); });
            setTimeout(() => { if (!state.gameActive) return; if (state.modeConfig.maxWrong !== Infinity) endGame(); else nextKeysigQuestion(); }, 1500);
        }
        updateScoreboard();
    }

    function nextKeysigQuestion() {
        const grade = state.keysigGrade || state.currentUser.grade || 3;
        const q = generateKeysigQuestion(grade);
        if (!q) return;
        state.answered = false;
        state.attemptedThisQuestion = false;
        state.questionStartTime = Date.now();
        renderKeysigQuestion(q);
        enableGameControls(true);
    }

    function startKeysigGame() {
        audio.init(); audio.warmUp();
        const playerName = getPlayerName();
        if (!playerName) { dom.nameField.classList.add('error'); alert('❗ 請先請先選擇姓名，方可開始。'); return; }
        dom.nameField.classList.remove('error');
        saveSettings();
        state.currentUser = { name: playerName, grade: parseInt(dom.userGrade.value), class: dom.userClass.value, id: dom.userId.value };

        showKeysigUI(true);
        showSolfegeUI(false);
        dom.inGameUser.textContent = `👋 ${state.currentUser.name} 同學 · ${state.modeConfig.name}`;
        dom.endBtn.textContent = state.modeConfig.type === 'practice' ? '📊 結束練習' : '🏁 結束挑戰';

        state.gameActive = false;
        state.timeLeft = state.modeConfig.duration;
        state.score = 0; state.totalQuestions = 0; state.wrongCount = 0;
        state.combo = 0; state.maxCombo = 0; state.answered = false;
        state.wrongNoteStats = {}; state.answerTimeList = []; state.slowNoteStats = {};
        state.attemptedThisQuestion = false;
        if (state.timer) { clearInterval(state.timer); state.timer = null; }

        audio.bgPlay();
        switchScreen('screen-game');

        startCountdown(() => {
            state.gameActive = true;
            if (state.timeLeft !== Infinity) {
                state.timer = setInterval(updateTimer, 1000);
                dom.timeDisplay.textContent = `${state.timeLeft}s`;
            } else {
                dom.timeDisplay.textContent = '∞';
            }
            dom.timeProgress.style.width = '100%';
            dom.timeProgress.style.transition = 'none';
            updateScoreboard();
            dom.messageBox.textContent = `🎼 ${state.modeConfig.name} — 練習開始。`;
            dom.messageBox.className = 'message-box';
            nextKeysigQuestion();
            if (state.timeLeft !== Infinity) {
                setTimeout(() => {
                    dom.timeProgress.style.transition = `width ${state.timeLeft}s linear`;
                    dom.timeProgress.style.width = '0%';
                }, 50);
            }
        });
    }

    // ==========================================
    // 唱名辨別遊戲
    // ==========================================
    let _solfegeCurrentAnswer = null;

    function showSolfegeUI(show) {
        const solfegeGrid = document.getElementById('solfegeGrid');
        const canvasWrapper = document.getElementById('canvasWrapper');
        if (solfegeGrid) solfegeGrid.style.display = show ? 'flex' : 'none';
        if (show) {
            if (canvasWrapper) canvasWrapper.style.display = '';
            if (dom.notesGrid) dom.notesGrid.style.display = 'none';
            const keysigDisplay = document.getElementById('keysigDisplay');
            const keysigOptions = document.getElementById('keysigOptions');
            if (keysigDisplay) keysigDisplay.style.display = 'none';
            if (keysigOptions) keysigOptions.style.display = 'none';
        }
    }

    function generateSolfegeNote(grade) {
        const level = SOLFEGE_LEVELS[grade] || SOLFEGE_LEVELS[3];
        // Pick random key
        const keyId = level.keys[Math.floor(Math.random() * level.keys.length)];
        const keySig = KEY_SIGNATURES.find(k => k.id === keyId);
        if (!keySig) return null;

        // Build diatonic note pool from treble MAPS within noteRange
        const noteRange = level.noteRange;
        const mapNotes = MAPS.treble.slice(noteRange[0], noteRange[1] + 1);

        // Filter to only diatonic notes in this key
        const diatonicPool = [];
        mapNotes.forEach(mapNote => {
            // Check if this note letter (with key sig accidental) is in the scale
            const letter = mapNote.letter;
            // Determine what this note sounds like with the key signature applied
            let noteWithAcc = letter;
            if (keySig.sharpNotes.includes(letter)) noteWithAcc = letter + '#';
            else if (keySig.flatNotes.includes(letter)) noteWithAcc = letter + '♭';

            const solName = getSolfege(keySig, noteWithAcc);
            if (solName) {
                diatonicPool.push({ ...mapNote, clef: 'treble', accidental: null, noteWithAcc, correctSolfege: solName });
            }
        });

        if (!diatonicPool.length) return null;

        // Anti-repeat
        let pick = diatonicPool[Math.floor(Math.random() * diatonicPool.length)];
        if (diatonicPool.length > 1) {
            let tries = 0;
            while (pick.letter === state.lastNoteLetter && tries < 20) {
                pick = diatonicPool[Math.floor(Math.random() * diatonicPool.length)];
                tries++;
            }
        }
        state.lastNoteLetter = pick.letter;

        return {
            ...pick,
            correctName: pick.noteWithAcc,
            freqKey: (pick.noteWithAcc.replace('♭','b')) + pick.octave,
            keySig
        };
    }

    function drawStaffWithKeySig() {
        // First draw the normal staff
        if (!dom.canvas.logicalWidth) setupHDPI();
        const w = dom.canvas.logicalWidth, h = dom.canvas.logicalHeight, ctx = dom.ctx;
        if (!w || !h) return;
        ctx.clearRect(0, 0, w, h);

        const dpr = window.devicePixelRatio || 1;
        const currentClef = 'treble';
        const clefLoaded = clefImages[currentClef]?.complete && clefImages[currentClef]?.naturalWidth > 0;
        const ls = w < 340 ? 14 : w < 400 ? 16 : 22;

        // Rebuild staff cache for treble clef
        if (!_staffCache || _staffCache.w !== w || _staffCache.h !== h || _staffCache.dpr !== dpr || _staffCache.clefLoaded !== clefLoaded || _staffCache.clef !== currentClef || _staffCache._isSolfegeCache) {
            const oc = document.createElement('canvas');
            oc.width = w * dpr; oc.height = h * dpr;
            const oc_ctx = oc.getContext('2d');
            oc_ctx.scale(dpr, dpr);
            const _baseY = Math.round(h / 2 - ls * 1.15), _startX = w < 400 ? 30 : 50;
            oc_ctx.strokeStyle = '#1E1E2F'; oc_ctx.lineWidth = 2; oc_ctx.lineCap = 'round';
            oc_ctx.beginPath();
            for (let i = 0; i < 5; i++) { oc_ctx.moveTo(_startX, _baseY + i * ls); oc_ctx.lineTo(w - _startX, _baseY + i * ls); }
            oc_ctx.stroke();
            drawTrebleClef(oc_ctx, _startX + (w < 400 ? 20 : 35), _baseY + ls * 3, ls);
            _staffCache = { canvas: oc, w, h, dpr, ls, clefLoaded, clef: currentClef, baseY: _baseY, startX: _startX, _isSolfegeCache: false };
        }
        ctx.drawImage(_staffCache.canvas, 0, 0, w, h);

        const baseY = _staffCache.baseY, startX = _staffCache.startX;
        const clefEndX = startX + (w < 400 ? 20 : 35) + ls * 3;

        // Draw key signature accidentals after clef
        const keySig = state.currentNote ? state.currentNote.keySig : null;
        let ksWidth = 0;
        if (keySig) {
            const ksStartX = clefEndX + ls * 0.5;
            const spacing = ls * 1.0;
            if (keySig.sharps > 0) {
                for (let i = 0; i < keySig.sharps; i++) {
                    const pos = KEYSIG_SHARP_POS_TREBLE[i];
                    const y = baseY + pos.yFactor * ls;
                    drawSharp(ctx, ksStartX + i * spacing, y, ls);
                }
                ksWidth = keySig.sharps * spacing + ls * 0.5;
            } else if (keySig.flats > 0) {
                for (let i = 0; i < keySig.flats; i++) {
                    const pos = KEYSIG_FLAT_POS_TREBLE[i];
                    const y = baseY + pos.yFactor * ls;
                    drawFlat(ctx, ksStartX + i * spacing, y, ls);
                }
                ksWidth = keySig.flats * spacing + ls * 0.5;
            }
        }

        // Note position: center between key sig end and staff end
        const noteAreaStart = clefEndX + ksWidth + ls;
        const staffEndX = w - startX;
        const centerX = Math.round(noteAreaStart + (staffEndX - noteAreaStart) / 2);
        const middleLineY = baseY + 2 * ls;

        if (!state.currentNote) return;

        const noteY = baseY + state.currentNote.yFactor * ls;

        // Highlight line
        const highlightLineEl = dom.highlightLine;
        if (highlightLineEl && highlightLineEl.checked && !state.answered) {
            ctx.strokeStyle = 'rgba(6, 214, 160, 0.4)'; ctx.lineWidth = ls * 0.8;
            ctx.beginPath(); ctx.moveTo(centerX - 35, noteY); ctx.lineTo(centerX + 35, noteY); ctx.stroke();
        }

        // Ledger lines
        ctx.strokeStyle = '#1E1E2F'; ctx.lineWidth = 2.5; const lW = 24;
        ctx.beginPath();
        if (state.currentNote.yFactor > 4) for (let i = 1; i <= Math.floor(state.currentNote.yFactor - 4); i++) { ctx.moveTo(centerX - lW, baseY + (4 + i) * ls); ctx.lineTo(centerX + lW, baseY + (4 + i) * ls); }
        if (state.currentNote.yFactor < 0) for (let i = 1; i <= Math.floor(Math.abs(state.currentNote.yFactor)); i++) { ctx.moveTo(centerX - lW, baseY - i * ls); ctx.lineTo(centerX + lW, baseY - i * ls); }
        ctx.stroke();

        // Note: NO individual accidental drawn (key signature handles it)

        // Draw note head (always filled for solfège mode)
        ctx.fillStyle = '#1E1E2F'; ctx.strokeStyle = '#1E1E2F'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(centerX, noteY, ls * 0.65, ls * 0.48, -0.35, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        if (noteY < middleLineY) { ctx.moveTo(centerX - ls * 0.55, noteY + 2); ctx.lineTo(centerX - ls * 0.55, noteY + ls * 3.5); }
        else { ctx.moveTo(centerX + ls * 0.55, noteY - 2); ctx.lineTo(centerX + ls * 0.55, noteY - ls * 3.5); }
        ctx.stroke();

        // Key name badge
        if (keySig) {
            ctx.save();
            ctx.fillStyle = 'rgba(124, 58, 237, 0.85)';
            ctx.font = `bold ${Math.round(ls * 0.7)}px 'Nunito', 'Noto Sans TC', sans-serif`;
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillText(keySig.name, startX + 4, baseY + ls * 4.3);
            ctx.restore();
        }

        // Answer highlight
        if (state.showAnswerHighlight) {
            ctx.save();
            ctx.strokeStyle = '#FF4A6B'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.arc(centerX, noteY, ls * 1.3, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#FF4A6B';
            ctx.font = `bold ${Math.round(ls * 0.85)}px 'Nunito', 'Noto Sans TC', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = noteY > middleLineY ? 'top' : 'bottom';
            ctx.fillText(state.currentNote.correctSolfege + ' (' + state.currentNote.correctName + ')', centerX, noteY > middleLineY ? noteY + ls * 1.6 : noteY - ls * 1.6);
            ctx.restore();
        }
    }

    function handleSolfegeAnswer(solName) {
        if (!state.gameActive || state.answered) return;
        if (!state.currentNote || !state.currentNote.correctSolfege) return;

        const isFirstAttempt = !state.attemptedThisQuestion;
        const elapsed = Date.now() - state.questionStartTime;
        if (isFirstAttempt) {
            state.answerTimeList.push(elapsed / 1000);
            state.totalQuestions++;
            state.attemptedThisQuestion = true;
        }

        const correct = solName === state.currentNote.correctSolfege;
        const btn = document.querySelector(`.solfege-btn[data-sol="${solName}"]`);

        if (correct) {
            state.answered = true;
            state.combo++;
            if (state.combo > state.maxCombo) state.maxCombo = state.combo;
            if (isFirstAttempt && elapsed > SLOW_ANSWER_MS) {
                const statKey = state.currentNote.correctSolfege + ' (' + (state.currentNote.keySig ? state.currentNote.keySig.name : '') + ')';
                state.slowNoteStats[statKey] = (state.slowNoteStats[statKey] || 0) + 1;
            }
            const pts = state.modeConfig.type === 'challenge' ? Math.round(10 * state.modeConfig.scoreMulti + state.combo) : 0;
            if (pts) state.score += pts;
            const _secs = isFirstAttempt ? ` ⚡ ${(elapsed/1000).toFixed(1)}s` : '';
            const keyLabel = state.currentNote.keySig ? ` (${state.currentNote.keySig.name})` : '';
            dom.messageBox.textContent = `✅ 回答正確。${state.currentNote.correctSolfege} = ${state.currentNote.correctName}${keyLabel}${_secs} ✨ 得分：${state.score}`;
            dom.messageBox.className = 'message-box correct';
            audio.playNote(state.currentNote.freqKey);
            if (btn) { btn.classList.add('correct'); if (pts) { const r = btn.getBoundingClientRect(); showScoreFloat(pts, r.left + r.width/2 - 15, r.top - 10); } }
            if (state.combo > 0 && state.combo % COMBO_CONFETTI_INTERVAL === 0) { showComboBurst(state.combo); spawnConfetti(Math.min(state.combo, MAX_CONFETTI)); }
            if (state.modeConfig.type === 'practice') {
                const correctCount = state.totalQuestions - state.wrongCount;
                if (correctCount > 0 && correctCount % 20 === 0) {
                    showComboBurst(correctCount); spawnConfetti(MAX_CONFETTI + 5);
                    dom.messageBox.textContent = `🎯 已答對 ${correctCount} 題！表現良好，請繼續練習。`;
                }
            }
            setTimeout(() => { if (!state.gameActive) return; if (btn) btn.classList.remove('correct', 'wrong'); nextSolfegeQuestion(); }, 500);
        } else {
            const statKey = state.currentNote.correctSolfege + ' (' + (state.currentNote.keySig ? state.currentNote.keySig.name : '') + ')';
            state.wrongNoteStats[statKey] = (state.wrongNoteStats[statKey] || 0) + 1;
            state.combo = 0;
            audio.playEffect('wrong');
            state.answered = true;
            state.wrongCount++;
            state.showAnswerHighlight = true; drawStaffWithKeySig();
            const keyLabel = state.currentNote.keySig ? ` (${state.currentNote.keySig.name})` : '';
            dom.messageBox.textContent = `❌ 回答不正確。正確答案是 ${state.currentNote.correctSolfege} = ${state.currentNote.correctName}${keyLabel}，請記下正確答案。`;
            dom.messageBox.className = 'message-box wrong';
            if (btn) btn.classList.add('wrong');
            // Highlight correct button
            const correctBtn = document.querySelector(`.solfege-btn[data-sol="${state.currentNote.correctSolfege}"]`);
            if (correctBtn) correctBtn.classList.add('correct');
            setTimeout(() => {
                if (!state.gameActive) return;
                document.querySelectorAll('.solfege-btn').forEach(b => b.classList.remove('correct', 'wrong'));
                if (state.modeConfig.maxWrong !== Infinity) endGame(); else nextSolfegeQuestion();
            }, 1500);
        }
        updateScoreboard();
    }

    function nextSolfegeQuestion() {
        const grade = state.solfegeGrade || state.currentUser.grade || 3;
        const note = generateSolfegeNote(grade);
        if (!note) return;
        state.currentNote = note;
        state.answered = false;
        state.attemptedThisQuestion = false;
        state.showAnswerHighlight = false;
        state.questionStartTime = Date.now();
        // Invalidate staff cache so key sig is redrawn
        _staffCache = null;
        drawStaffWithKeySig();
        // Enable solfege buttons
        document.querySelectorAll('.solfege-btn').forEach(b => { b.disabled = false; });
        enableGameControls(true);
    }

    function startSolfegeGame() {
        audio.init(); audio.warmUp();
        const playerName = getPlayerName();
        if (!playerName) { dom.nameField.classList.add('error'); alert('❗ 請先請先選擇姓名，方可開始。'); return; }
        dom.nameField.classList.remove('error');
        saveSettings();
        state.currentUser = { name: playerName, grade: parseInt(dom.userGrade.value), class: dom.userClass.value, id: dom.userId.value };

        showKeysigUI(false);
        showSolfegeUI(true);
        if (dom.clefBadge) dom.clefBadge.textContent = '高音譜號';
        dom.inGameUser.textContent = `👋 ${state.currentUser.name} 同學 · ${state.modeConfig.name}`;
        dom.endBtn.textContent = state.modeConfig.type === 'practice' ? '📊 結束練習' : '🏁 結束挑戰';

        state.gameActive = false;
        state.timeLeft = state.modeConfig.duration;
        state.score = 0; state.totalQuestions = 0; state.wrongCount = 0;
        state.combo = 0; state.maxCombo = 0; state.answered = false;
        state.wrongNoteStats = {}; state.answerTimeList = []; state.slowNoteStats = {};
        state.lastNoteLetter = null; state.attemptedThisQuestion = false;
        state.showAnswerHighlight = false;
        if (state.timer) { clearInterval(state.timer); state.timer = null; }

        audio.bgPlay();
        switchScreen('screen-game');

        startCountdown(() => {
            state.gameActive = true;
            if (state.timeLeft !== Infinity) {
                state.timer = setInterval(updateTimer, 1000);
                dom.timeDisplay.textContent = `${state.timeLeft}s`;
            } else {
                dom.timeDisplay.textContent = '∞';
            }
            dom.timeProgress.style.width = '100%';
            dom.timeProgress.style.transition = 'none';
            updateScoreboard();
            dom.messageBox.textContent = `🎤 ${state.modeConfig.name} — 練習開始。`;
            dom.messageBox.className = 'message-box';
            nextSolfegeQuestion();
            if (state.timeLeft !== Infinity) {
                setTimeout(() => {
                    dom.timeProgress.style.transition = `width ${state.timeLeft}s linear`;
                    dom.timeProgress.style.width = '0%';
                }, 50);
            }
        });
    }

    function generateReport() {
        const accuracy = state.totalQuestions ? Math.round(((state.totalQuestions - state.wrongCount) / state.totalQuestions) * 100) : 0;
        const avg = state.answerTimeList.length ? (state.answerTimeList.reduce((a,b)=>a+b,0)/state.answerTimeList.length).toFixed(1) : 0;
        dom.reportGrid.innerHTML = `<div class="report-item"><div class="report-label">答題數</div><div class="report-value">${state.totalQuestions}</div></div><div class="report-item"><div class="report-label">得分</div><div class="report-value">${state.score}</div></div><div class="report-item"><div class="report-label">正確率</div><div class="report-value">${accuracy}%</div></div><div class="report-item"><div class="report-label">平均速度</div><div class="report-value">${avg}秒</div></div><div class="report-item"><div class="report-label">最高連對</div><div class="report-value">${state.maxCombo}</div></div><div class="report-item"><div class="report-label">答錯</div><div class="report-value" style="color:var(--primary-red)">${state.wrongCount}</div></div>`;
        
        const sorted = Object.entries(state.wrongNoteStats).sort((a,b)=>b[1]-a[1]);
        if (!sorted.length) {
            dom.reportWeakness.innerHTML = '<div>🌟 全部答對。</div>';
            return;
        }
        // Categorize errors
        let ledgerErrors = 0, staffErrors = 0, accidentalErrors = 0, naturalErrors = 0;
        sorted.forEach(([k, v]) => {
            const noteName = k.split(' (')[0];
            if (noteName.includes('#') || noteName.includes('♭')) accidentalErrors += v;
            else naturalErrors += v;
        });
        // Check if errors are from ledger line notes (yFactor > 4 or < 0)
        Object.entries(state.wrongNoteStats).forEach(([k]) => {
            const noteName = k.split(' (')[0].replace('#','').replace('♭','');
            const clefName = k.match(/\((.+)\)/)?.[1] || '';
            const clefKey = clefName === '高音' ? 'treble' : clefName === '低音' ? 'bass' : null;
            if (clefKey && MAPS[clefKey]) {
                const noteInfo = MAPS[clefKey].find(n => n.letter === noteName);
                if (noteInfo && (noteInfo.yFactor > 4 || noteInfo.yFactor < 0)) ledgerErrors += state.wrongNoteStats[k];
                else staffErrors += state.wrongNoteStats[k];
            }
        });
        // Speed trend
        let speedTrend = '';
        if (state.answerTimeList.length >= 6) {
            const list = state.answerTimeList, len = list.length, half = len >> 1;
            let s1 = 0, s2 = 0;
            for (let i = 0; i < half; i++) s1 += list[i];
            for (let i = half; i < len; i++) s2 += list[i];
            const firstHalf = s1 / half;
            const secondHalf = s2 / (len - half);
            if (secondHalf > firstHalf * 1.3) speedTrend = '<li>⚠️ 後半段反應變慢，可能有點累，記得休息</li>';
            else if (secondHalf < firstHalf * 0.8) speedTrend = '<li>🚀 愈做愈快，進步明顯！</li>';
        }
        let analysis = '<ul>';
        analysis += sorted.slice(0,3).map(([k,v]) => `<li><strong>${k}</strong>：錯了 ${v} 次</li>`).join('');
        if (ledgerErrors > staffErrors && ledgerErrors > 2) analysis += '<li>📏 加線音符出錯較多，請多練習上、下加線音域</li>';
        if (accidentalErrors > naturalErrors && accidentalErrors > 2) analysis += '<li>🎵 升降號音符出錯較多，需加強升降記號辨認</li>';
        if (speedTrend) analysis += speedTrend;
        analysis += '</ul>';
        dom.reportWeakness.innerHTML = `<div>尚需加強的音符：</div>${analysis}`;

        // Slow-correct notes section
        const slowSorted = Object.entries(state.slowNoteStats).sort((a,b) => b[1] - a[1]);
        if (slowSorted.length) {
            let slowHtml = '<div class="history-summary" style="margin-top:8px;"><strong>🐢 答得較慢的音符（>4秒）：</strong><ul style="margin-left:20px; margin-top:6px;">';
            slowHtml += slowSorted.slice(0, 3).map(([k,v]) => `<li><strong>${k}</strong>：慢了 ${v} 次</li>`).join('');
            slowHtml += '</ul></div>';
            dom.reportWeakness.innerHTML += slowHtml;
        }

        // Save to history
        saveHistory(accuracy, avg);
    }

    // ==========================================
    // 📊 歷史進度追蹤
    // ==========================================
    function saveHistory(accuracy, avgSpeed) {
        try {
            const history = JSON.parse(localStorage.getItem('musicGameHistory') || '[]');
            history.push({
                date: new Date().toLocaleDateString('zh-TW'),
                mode: state.currentMode,
                score: state.score,
                accuracy: parseInt(accuracy),
                avgSpeed: parseFloat(avgSpeed),
                questions: state.totalQuestions,
                maxCombo: state.maxCombo
            });
            // Keep last 20 records
            if (history.length > 20) history.splice(0, history.length - 20);
            localStorage.setItem('musicGameHistory', JSON.stringify(history));
        } catch(e) { /* ignore storage errors */ }
    }

    function getHistorySummary() {
        try {
            const history = JSON.parse(localStorage.getItem('musicGameHistory') || '[]');
            if (history.length < 2) return '';
            const recent = history.slice(-5);
            const older = history.slice(-10, -5);
            if (!older.length) return '';
            const recentAcc = Math.round(recent.reduce((a,r) => a + (r.accuracy||0), 0) / recent.length);
            const olderAcc = Math.round(older.reduce((a,r) => a + (r.accuracy||0), 0) / older.length);
            const recentSpd = (recent.reduce((a,r) => a + (r.avgSpeed||0), 0) / recent.length).toFixed(1);
            const olderSpd = (older.reduce((a,r) => a + (r.avgSpeed||0), 0) / older.length).toFixed(1);
            let html = '<div class="history-summary"><div class="group-title">📈 進度趨勢（近 ' + history.length + ' 次）</div><ul style="margin:8px 0 0 16px; font-size:0.9rem;">';
            const accDiff = recentAcc - olderAcc;
            if (accDiff > 5) html += `<li>✅ 正確率進步中！${olderAcc}% → ${recentAcc}%</li>`;
            else if (accDiff < -5) html += `<li>⚠️ 正確率下降了 ${olderAcc}% → ${recentAcc}%，請加強練習</li>`;
            else html += `<li>📊 正確率穩定在 ${recentAcc}% 附近</li>`;
            const spdDiff = parseFloat(recentSpd) - parseFloat(olderSpd);
            if (spdDiff < -0.3) html += `<li>🚀 反應速度加快了！${olderSpd}s → ${recentSpd}s</li>`;
            else if (spdDiff > 0.3) html += `<li>🐢 反應變慢了 ${olderSpd}s → ${recentSpd}s</li>`;
            html += '</ul></div>';
            return html;
        } catch(e) { return ''; }
    }

    // ==========================================
    // 🏆 排行榜與 API 串接
    // ==========================================
    /** POST 到 GAS Web App：使用 CORS 讀取 JSON 回應（須部署為可匿名存取）。 */
    async function gasPostJson(record) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(record),
                mode: 'cors',
                redirect: 'follow',
                signal: controller.signal
            });
            const text = await res.text();
            let data = {};
            try {
                data = text ? JSON.parse(text) : {};
            } catch (_parseErr) {
                if (!res.ok) {
                    return { ok: false, error: (text && text.slice(0, 120)) || `HTTP ${res.status}` };
                }
                return { ok: res.ok };
            }
            if (!res.ok) {
                return { ok: false, error: (data && data.error) || (text && text.slice(0, 120)) || `HTTP ${res.status}` };
            }
            if (typeof data.ok === 'boolean') return data;
            return { ok: true };
        } catch (err) {
            const msg = err && err.name === 'AbortError' ? '逾時' : (err && err.message) || 'network';
            return { ok: false, error: msg };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function submitScore() {
        if (!state.currentUser.name || state.modeConfig.type !== 'challenge') return;
        if (state.score === 0 && state.totalQuestions === 0) return;

        const record = {
            game: 'game1',
            name: state.currentUser.name,
            grade: state.currentUser.grade,
            class: state.currentUser.class,
            id: state.currentUser.id,
            mode: state.currentMode,
            mode_name: state.modeConfig.name,
            score: state.score,
            max_combo: state.maxCombo,
            total_questions: state.totalQuestions,
            accuracy: state.totalQuestions ? Math.round(((state.totalQuestions - state.wrongCount) / state.totalQuestions) * 100) : 0,
            timestamp: new Date().toLocaleString('zh-TW')
        };

        // Always save locally as backup
        saveLocalRank('game1', state.currentUser, record.score, record.accuracy, record.max_combo, state.currentMode);
        // Optimistic: show new score on leaderboard immediately
        state.allRanks.push(record);
        _writeRanksCache(state.allRanks);
        try {
            const r = await gasPostJson(record);
            if (r.ok) {
                _showToast('✅ 分數已上傳！', 'success');
                setTimeout(() => loadRanks(2, { force: true }), 800);
            } else {
                console.error('上傳失敗：', r.error);
                _showToast('⚠️ 上傳未成功：' + (r.error || '未知') + '（分數已儲存在本機）', 'warn');
            }
        } catch (e) {
            console.error('上傳失敗：', e);
            _showToast('⚠️ 網絡問題，分數已儲存在本機', 'warn');
        }
    }

    async function submitScoreToGAS(game, user, score, accuracy, maxCombo, modeName) {
        if (!user || !user.name) return;
        const record = {
            game,
            name: user.name,
            grade: user.grade,
            class: user.class,
            id: user.seat || user.id || '',
            mode: modeName || game,
            mode_name: modeName,
            score,
            max_combo: maxCombo,
            accuracy,
            timestamp: new Date().toLocaleString('zh-TW')
        };
        // Always save locally as backup
        saveLocalRank(game, user, score, accuracy, maxCombo, modeName);
        // Optimistic: keep in-memory ranks fresh for instant display
        state.allRanks.push(record);
        _writeRanksCache(state.allRanks);
        try {
            const r = await gasPostJson(record);
            if (r.ok) _showToast('✅ 分數已上傳！', 'success');
            else {
                console.error('上傳失敗：', r.error);
                _showToast('⚠️ 上傳未成功：' + (r.error || '未知') + '（分數已儲存在本機）', 'warn');
            }
        } catch (e) {
            console.error('上傳失敗：', e);
            _showToast('⚠️ 網絡問題，分數已儲存在本機', 'warn');
        }
    }

    async function submitProfileResultToGAS(game, user, score, accuracy, maxCombo, profile) {
        if (!user || !user.name || !profile) return;
        const record = {
            action: 'saveProfileResult',
            game,
            name: user.name,
            grade: user.grade,
            class: user.class,
            id: user.seat || user.id || '',
            score,
            max_combo: maxCombo,
            accuracy,
            level: profile.level,
            exp: profile.exp,
            total_played: profile.stats?.totalPlayed || 0,
            cleared: profile.stats?.cleared || 0,
            fc_count: profile.stats?.fcCount || 0,
            ap_count: profile.stats?.apCount || 0,
            timestamp: new Date().toLocaleString('zh-TW')
        };

        try {
            const r = await gasPostJson(record);
            if (!r.ok) console.error('Profile 上傳失敗：', r.error);
        } catch (e) {
            console.error('Profile 上傳失敗：', e);
        }
    }

    function endGame() { 
        if (!state.gameActive) return;
        state.gameActive = false; 
        enableGameControls(false); 
        clearInterval(state.timer); 
        state.timer = null;
        // Keep BG music playing on result page
        dom.timeProgress.style.transition = 'none'; 
        
        generateReport(); 
        // Show history trend
        if (dom.reportHistory) dom.reportHistory.innerHTML = getHistorySummary();

        // Record to profile
        const _g1Accuracy = state.totalQuestions ? Math.round(((state.totalQuestions - state.wrongCount) / state.totalQuestions) * 100) : 0;
        if (state.currentUser) {
            recordGameResult(state.currentUser, 'game1', state.score, _g1Accuracy, state.maxCombo, state.currentMode);
        }

        if (state.modeConfig.type === 'challenge') submitScore(); 
        
        dom.leaderboardLayout.classList.remove('view-only');
        const isPracticeEnd = state.modeConfig.type === 'practice';
        if (isPracticeEnd) {
            dom.leaderboardLayout.classList.add('practice-end');
        } else {
            dom.leaderboardLayout.classList.remove('practice-end');
            focusLeaderboardToCurrentStudent();
            loadRanks();
        }
        const reportTitleEl = document.querySelector('.report-title');
        if (reportTitleEl) reportTitleEl.textContent = isPracticeEnd ? '📝 練習完成！做得好！' : '🎉 做得好！挑戰完成！';
        switchScreen('screen-leaderboard');
    }

    function _buildSkeletonRanks(count) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `<div class="skeleton-rank-row" style="animation-delay:${i * 0.08}s">
                <div class="skeleton skeleton-circle"></div>
                <div style="flex:1"><div class="skeleton skeleton-text medium"></div><div class="skeleton skeleton-text short"></div></div>
            </div>`;
        }
        return html;
    }

    const RANKS_CACHE_KEY = 'musicGameRanksCacheV1';
    const RANKS_SOFT_TTL_MS = 40000; // skip network if fresher than this
    let _ranksFetchedAt = 0;
    let _ranksFetchPromise = null;

    function _normalizeRankRows(data) {
        if (!Array.isArray(data)) return [];
        return data.filter(r => r && r.mode && r.name).map(r => {
            r.score = parseInt(r.score) || 0;
            r.max_combo = parseInt(r.max_combo) || 0;
            r.accuracy = parseInt(r.accuracy) || 0;
            r.grade = r.grade ? String(r.grade) : '';
            return r;
        });
    }

    function _readRanksCache() {
        try {
            const parsed = JSON.parse(localStorage.getItem(RANKS_CACHE_KEY) || 'null');
            if (!parsed || !Array.isArray(parsed.data)) return null;
            return parsed;
        } catch (e) { return null; }
    }

    function _writeRanksCache(data) {
        try {
            localStorage.setItem(RANKS_CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
        } catch (e) { /* quota */ }
    }

    function _applyRanksData(data, { render = true } = {}) {
        state.allRanks = _normalizeRankRows(data);
        _ranksFetchedAt = Date.now();
        _writeRanksCache(state.allRanks);
        if (render && dom.rankList) renderRanks();
    }

    function _paintRanksFromCache() {
        if (state.allRanks.length) {
            renderRanks();
            return true;
        }
        const cached = _readRanksCache();
        if (cached && cached.data.length) {
            state.allRanks = _normalizeRankRows(cached.data);
            _ranksFetchedAt = cached.at || 0;
            renderRanks();
            return true;
        }
        return false;
    }

    async function loadRanks(retries, opts) {
        if (retries === undefined) retries = 2;
        opts = opts || {};
        const force = !!opts.force;

        // Instant paint from memory / localStorage
        const painted = _paintRanksFromCache();
        if (!painted && dom.rankList) dom.rankList.innerHTML = _buildSkeletonRanks(6);

        // Soft TTL: reuse recent fetch unless forced
        if (!force && state.allRanks.length && _ranksFetchedAt && (Date.now() - _ranksFetchedAt) < RANKS_SOFT_TTL_MS) {
            return state.allRanks;
        }

        if (_ranksFetchPromise) return _ranksFetchPromise;

        _ranksFetchPromise = (async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);
            try {
                const res = await fetch(`${CONFIG.API_URL}?v=${Date.now()}`, { redirect: 'follow', signal: controller.signal });
                if (!res.ok) throw new Error(`伺服器回應錯誤 (HTTP ${res.status})`);
                const contentType = res.headers.get('content-type') || '';
                const text = await res.text();
                if (!contentType.includes('json') && (text.trimStart().startsWith('<'))) {
                    console.error("GAS 回傳 HTML 錯誤頁面，請檢查部署設定：", text.slice(0, 300));
                    throw new Error("GAS 部署錯誤：請確認部署權限設為「所有人」");
                }
                const data = JSON.parse(text);
                if (data && data.error) throw new Error(data.error);
                _applyRanksData(data);
                return state.allRanks;
            } catch (e) {
                if (retries > 0) {
                    console.warn('排行榜載入失敗，重試中...', retries);
                    clearTimeout(timeoutId);
                    _ranksFetchPromise = null;
                    await new Promise(r => setTimeout(r, 1200));
                    return loadRanks(retries - 1, opts);
                }
                // Keep cached list if we already painted it
                if (!state.allRanks.length && dom.rankList) {
                    const isTimeout = e.name === 'AbortError';
                    const msg = isTimeout ? '網絡連線太慢了，請檢查網絡' : (e.message || '未知錯誤');
                    dom.rankList.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-light); font-weight:800;">❌ 無法連線至排行榜<br><span style="font-size:0.8rem; font-weight:normal;">${msg}</span><br><button class="rank-retry-btn" style="margin-top:12px; padding:8px 20px; border-radius:20px; border:2px solid var(--primary-purple); background:white; color:var(--primary-purple-dark); font-weight:900; cursor:pointer;">🔄 重試</button></div>`;
                    const retryBtn = dom.rankList.querySelector('.rank-retry-btn');
                    if (retryBtn) retryBtn.addEventListener('click', () => loadRanks(2, { force: true }));
                }
                console.warn("排行榜載入異常：", e);
                return state.allRanks;
            } finally {
                clearTimeout(timeoutId);
            }
        })().finally(() => { _ranksFetchPromise = null; });

        return _ranksFetchPromise;
    }

    function escHtml(str) {
        return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function isCurrentUserRecord(item) {
        const itemName = String(item?.name || '').trim();
        const userName = String(state.currentUser?.name || '').trim();
        const itemClass = String(item?.class || '');
        const userClass = String(state.currentUser?.class || '');
        const itemGrade = parseInt(item?.grade);
        const userGrade = parseInt(state.currentUser?.grade);
        if (!itemName || !userName) return false;
        if (itemName !== userName || itemClass !== userClass || itemGrade !== userGrade) return false;
        const userId = String(state.currentUser?.id || '').trim();
        const itemId = String(item?.id || '').trim();
        if (userId) return itemId === userId;
        return true;
    }
    
    function _rankRewardBanner() {
        return '<div class="rank-reward-banner">🏆 每級前三名將獲得獎勵！</div>';
    }

    function focusLeaderboardToCurrentStudent() {
        if (!state.currentUser?.name) return;
        if (dom.rankGradeFilter) dom.rankGradeFilter.value = String(state.currentUser.grade || 0);
        if (dom.rankClassFilter) dom.rankClassFilter.value = String(state.currentUser.class || '0');
        if (dom.rankModeFilter && state.modeConfig?.type === 'challenge') dom.rankModeFilter.value = state.currentMode;
    }

    function renderRanks() {
        const gf = document.getElementById('rankGameFilter');
        if (gf && gf.value !== 'game1') { renderRanksForGame(gf.value); return; }
        const fC = dom.rankClassFilter.value, fG = parseInt(dom.rankGradeFilter.value), fM = dom.rankModeFilter.value;
        let f = state.allRanks.filter(r => r.mode === fM); 
        if (fC !== '0') f = f.filter(r => r.class === fC); 
        if (fG !== 0) f = f.filter(r => parseInt(r.grade) === fG);
        f.sort((a,b)=> (parseInt(b.score)||0) - (parseInt(a.score)||0) || (parseInt(b.max_combo)||0) - (parseInt(a.max_combo)||0));
        // Deduplicate: keep only highest score per name+class+id
        const seen = new Set();
        f = f.filter(r => {
            const key = `${String(r.name||'').trim()}|${String(r.class||'')}|${String(r.id||'').trim()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        const selfIndex = f.findIndex(isCurrentUserRecord);
        if (dom.studentRankHint) {
            if (state.currentUser && state.currentUser.name && fC !== '0' && fG !== 0 && selfIndex >= 0) {
                const safeName = escHtml(state.currentUser.name);
                const gradeTxt = `中${['','一','二','三','四','五','六'][state.currentUser.grade]||state.currentUser.grade}`;
                const clsTxt = `${state.currentUser.class}班`;
                const rankTxt = selfIndex + 1;
                dom.studentRankHint.innerHTML = `🎯 ${safeName} 同學（${gradeTxt}${clsTxt}）目前排第 <strong>${rankTxt}</strong> 名`;
                dom.studentRankHint.style.display = '';
            } else {
                dom.studentRankHint.style.display = 'none';
                dom.studentRankHint.innerHTML = '';
            }
        }
        if (!f.length) { 
            dom.rankList.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-light); font-weight:800;">這個模式暫時未有紀錄，做第一個挑戰者吧！🚀</div>'; 
            return; 
        }
        const MAX_RENDER = 100;
        const fDisplay = f.slice(0, MAX_RENDER);
        dom.rankList.innerHTML = _rankRewardBanner() + fDisplay.map((item, i) => {
            const isSelf = isCurrentUserRecord(item);
            const cls = escHtml(item.class); const name = escHtml(item.name);
            const accuracy = parseInt(item.accuracy) || 0; const score = parseInt(item.score) || 0;
            const gradeTxt = item.grade ? `中${['','一','二','三','四','五','六'][item.grade]||item.grade}` : '';
            const seatTxt = item.id ? `${item.id}號` : '';
            return `<div class="rank-item ${i===0?'first':i===1?'second':i===2?'third':''} ${isSelf?'self':''}">
                <div class="rank-pos">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1+'.'}</div>
                <div class="rank-name">
                    <span class="rank-student-name">${name}</span>
                    <div class="rank-badges">
                        ${gradeTxt?`<span class="rank-tag rank-grade-tag">${gradeTxt}</span>`:''}
                        <span class="rank-tag rank-class-tag">${cls}班</span>
                        ${seatTxt?`<span class="rank-tag rank-seat-tag">${seatTxt}</span>`:''}
                        ${isSelf?'<span class="rank-tag" style="background:var(--primary-purple)">我</span>':''}
                        <span class="rank-tag" style="background:#CBD5E1;color:#333;">${accuracy}% 正確</span>
                    </div>
                </div>
                <div class="rank-score">${score}</div></div>`;
        }).join('') + (f.length > MAX_RENDER ? `<div style="text-align:center;padding:16px;color:var(--text-light);font-size:0.85rem;">顯示前 ${MAX_RENDER} 名（共 ${f.length} 人）</div>` : '');
    }

    // Browsers can't defer loading="lazy" inside display:none containers, so modal
    // artwork keeps its URL in data-src until the modal is actually opened.
    function hydrateDeferredImages(container) {
        if (!container) return;
        container.querySelectorAll('img[data-src]').forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
    }

    function initTutorial() {
        const modal = document.getElementById('tutorialModal');
        if (!modal) return;
        const dots  = modal.querySelectorAll('.tut-dot');
        const slides = modal.querySelectorAll('.tut-slide');
        const prevBtn = document.getElementById('tutPrev');
        const nextBtn = document.getElementById('tutNext');
        const pageLabel = document.getElementById('tutPage');
        let current = 0;
        const total = slides.length;

        function goTo(n) {
            slides[current].classList.remove('active');
            dots[current].classList.remove('active');
            current = n;
            slides[current].classList.add('active');
            dots[current].classList.add('active');
            prevBtn.disabled = current === 0;
            const isLast = current === total - 1;
            nextBtn.textContent = isLast ? '✓ 完成' : '下一頁 ▶';
            nextBtn.className = 'tut-btn' + (isLast ? ' finish' : '');
            pageLabel.textContent = `${current + 1} / ${total}`;
        }

        document.getElementById('tutorialBtn').addEventListener('click', () => {
            hydrateDeferredImages(modal);
            goTo(0);
            modal.style.display = 'flex';
            audio.init();
        });
        document.getElementById('tutClose').addEventListener('click', () => { modal.style.display = 'none'; });
        modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.style.display !== 'none') modal.style.display = 'none'; });
        prevBtn.addEventListener('click', () => { if (current > 0) goTo(current - 1); });
        nextBtn.addEventListener('click', () => { if (current < total - 1) goTo(current + 1); else modal.style.display = 'none'; });
        dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));
    }

    function initEvents() {
        function updateMusicControlsUI() {
            if (dom.soundToggle) {
                dom.soundToggle.classList.toggle('is-muted', !audio.enabled);
                dom.soundToggle.setAttribute('aria-expanded', dom.musicPanel && dom.musicPanel.classList.contains('open') ? 'true' : 'false');
            }
            if (dom.musicMuteToggle) {
                dom.musicMuteToggle.textContent = audio.enabled ? '🔊 已開啟' : '🔇 已靜音';
                dom.musicMuteToggle.style.opacity = audio.enabled ? '1' : '0.78';
            }
        }

        function setMusicPanelOpen(open) {
            if (!dom.musicPanel) return;
            dom.musicPanel.classList.toggle('open', open);
            dom.musicPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
            if (dom.soundToggle) dom.soundToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        setMusicPanelOpen(false);
        updateMusicControlsUI();

        // Pre-warm audio on first user interaction (unlocks AudioContext on iOS/Safari)
        const warmOnce = () => {
            audio.init();
            audio.warmUp();
            audio.bgPlay();
            document.removeEventListener('pointerdown', warmOnce);
            document.removeEventListener('touchstart', warmOnce);
        };
        document.addEventListener('pointerdown', warmOnce);
        document.addEventListener('touchstart', warmOnce, { passive: true });
        // Try immediate autoplay; if blocked, warmOnce fires on first tap
        setTimeout(() => { audio.init(); audio.bgPlay(); }, 0);

        // Volume sliders
        if (dom.bgVolume) dom.bgVolume.addEventListener('input', () => {
            const v = dom.bgVolume.value;
            if (dom.bgVolumeVal) dom.bgVolumeVal.textContent = v + '%';
            if (dom.bgMusic) dom.bgMusic.volume = v / 100;
            localStorage.setItem('bgVolume', v);
        });
        if (dom.sfxVolume) dom.sfxVolume.addEventListener('input', () => {
            if (dom.sfxVolumeVal) dom.sfxVolumeVal.textContent = dom.sfxVolume.value + '%';
            localStorage.setItem('sfxVolume', dom.sfxVolume.value);
        });

        let _resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(_resizeTimer);
            _resizeTimer = setTimeout(() => { if(state.gameActive || state.currentNote) { setupHDPI(); drawStaff(); } }, 100);
        });
        // Handle orientation change on mobile (debounced resize)
        if (screen.orientation) {
            screen.orientation.addEventListener('change', () => {
                setTimeout(() => { if(state.gameActive || state.currentNote) { setupHDPI(); drawStaff(); } }, 200);
            });
        } else {
            window.addEventListener('orientationchange', () => {
                setTimeout(() => { if(state.gameActive || state.currentNote) { setupHDPI(); drawStaff(); } }, 300);
            });
        }
        // Auto-select textbook level when grade changes
        dom.userGrade.addEventListener('change', () => {
            audio.init(); audio.playClick();
            if (dom.textbookMode) { dom.textbookMode.value = dom.userGrade.value; handleTextbookModeChange(); saveSettings(); }
            populateNameDropdown();
        });
        dom.userClass.addEventListener('change', () => {
            audio.init(); audio.playClick();
            populateNameDropdown();
        });
        dom.userName.addEventListener('change', () => {
            audio.init(); audio.playClick();
            if (dom.userName.value === '__other__') {
                showCustomName();
                dom.userId.readOnly = false;
                dom.userId.value = '';
            } else {
                hideCustomName();
                dom.userId.readOnly = true;
                const sel = dom.userName.selectedOptions[0];
                dom.userId.value = (sel && sel.dataset.seat) ? sel.dataset.seat : '';
            }
        });
        dom.soundToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            audio.init();
            audio.warmUp();
            const willOpen = !dom.musicPanel?.classList.contains('open');
            setMusicPanelOpen(willOpen);
            updateMusicControlsUI();
        });
        if (dom.musicMuteToggle) {
            dom.musicMuteToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                audio.init();
                audio.warmUp();
                audio.enabled = !audio.enabled;
                audio.bgSetMute(!audio.enabled);
                localStorage.setItem('musicGameSoundEnabled', audio.enabled);
                updateMusicControlsUI();
            });
        }
        document.addEventListener('click', (e) => {
            if (!dom.musicPanel || !dom.soundToggle) return;
            if (!dom.musicPanel.classList.contains('open')) return;
            if (dom.musicPanel.contains(e.target) || dom.soundToggle.contains(e.target)) return;
            setMusicPanelOpen(false);
            updateMusicControlsUI();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                setMusicPanelOpen(false);
                updateMusicControlsUI();
            }
        });

        // Mode card selection + clef sub-selector
        const clefSelectorRow = document.getElementById('clefSelectorRow');
        const clefSelBtns = document.querySelectorAll('.clef-sel-btn');
        const keysigSubRow = document.getElementById('keysigSubRow');
        const keysigGradeRow = document.getElementById('keysigGradeRow');
        const solfegeSubRow = document.getElementById('solfegeSubRow');
        const solfegeGradeRow = document.getElementById('solfegeGradeRow');

        // Helper to hide all sub-rows
        function hideAllSubRows() {
            if (clefSelectorRow) clefSelectorRow.style.display = 'none';
            if (dom.practiceDiffRow) dom.practiceDiffRow.style.display = 'none';
            if (keysigSubRow) keysigSubRow.style.display = 'none';
            if (keysigGradeRow) keysigGradeRow.style.display = 'none';
            if (solfegeSubRow) solfegeSubRow.style.display = 'none';
            if (solfegeGradeRow) solfegeGradeRow.style.display = 'none';
        }

        dom.modeCards.forEach(card => card.addEventListener('click', () => {
            audio.init(); audio.playClick('select');
            dom.modeCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const mode = card.dataset.mode;
            hideAllSubRows();

            if (mode === 'practice' || mode === 'noMiss') {
                state.currentMode = mode;
                state.modeConfig = MODE_CONFIG[mode];
                if (mode === 'practice' && dom.practiceDiffRow) dom.practiceDiffRow.style.display = '';
            } else if (mode === 'classic60') {
                const activeClef = document.querySelector('.clef-sel-btn.active');
                state.currentMode = activeClef ? activeClef.dataset.clef : 'classic60';
                state.modeConfig = MODE_CONFIG[state.currentMode];
                if (clefSelectorRow) clefSelectorRow.style.display = '';
            } else if (mode === 'keysig_practice') {
                // Default to practice; sub-row lets user toggle challenge
                const activeKsMode = document.querySelector('.ks-mode-btn.active');
                const isPractice = !activeKsMode || activeKsMode.dataset.ksmode === 'practice';
                state.currentMode = isPractice ? 'keysig_practice' : 'keysig60';
                state.modeConfig = MODE_CONFIG[state.currentMode];
                if (keysigSubRow) keysigSubRow.style.display = '';
            } else if (mode === 'solfege_practice') {
                const activeSolMode = document.querySelector('.sol-mode-btn.active');
                const isPractice = !activeSolMode || activeSolMode.dataset.solmode === 'practice';
                state.currentMode = isPractice ? 'solfege_practice' : 'solfege60';
                state.modeConfig = MODE_CONFIG[state.currentMode];
                if (solfegeSubRow) solfegeSubRow.style.display = '';
            }
            saveSettings();
        }));

        // Keysig sub-mode buttons (practice / challenge)
        document.querySelectorAll('.ks-mode-btn').forEach(btn => btn.addEventListener('click', () => {
            audio.init(); audio.playClick('select');
            document.querySelectorAll('.ks-mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentMode = btn.dataset.ksmode === 'challenge' ? 'keysig60' : 'keysig_practice';
            state.modeConfig = MODE_CONFIG[state.currentMode];
            saveSettings();
        }));
        // Keysig grade buttons
        document.querySelectorAll('.ks-grade-btn').forEach(btn => btn.addEventListener('click', () => {
            audio.init(); audio.playClick('select');
            document.querySelectorAll('.ks-grade-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.keysigGrade = parseInt(btn.dataset.grade);
            saveSettings();
        }));

        // Solfege sub-mode buttons (practice / challenge)
        document.querySelectorAll('.sol-mode-btn').forEach(btn => btn.addEventListener('click', () => {
            audio.init(); audio.playClick('select');
            document.querySelectorAll('.sol-mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentMode = btn.dataset.solmode === 'challenge' ? 'solfege60' : 'solfege_practice';
            state.modeConfig = MODE_CONFIG[state.currentMode];
            saveSettings();
        }));
        // Solfege grade buttons
        document.querySelectorAll('.sol-grade-btn').forEach(btn => btn.addEventListener('click', () => {
            audio.init(); audio.playClick('select');
            document.querySelectorAll('.sol-grade-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.solfegeGrade = parseInt(btn.dataset.grade);
            saveSettings();
        }));

        // Solfege answer buttons
        document.querySelectorAll('.solfege-btn').forEach(btn => btn.addEventListener('click', () => {
            if (!state.gameActive || state.answered) return;
            handleSolfegeAnswer(btn.dataset.sol);
        }));

        // Init keysig/solfege grade from student profile
        if (!state.keysigGrade) state.keysigGrade = parseInt(state.currentUser?.grade) || 1;
        if (!state.solfegeGrade) state.solfegeGrade = parseInt(state.currentUser?.grade) || 1;
        document.querySelectorAll('.ks-grade-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.grade) === state.keysigGrade));
        document.querySelectorAll('.sol-grade-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.grade) === state.solfegeGrade));

        clefSelBtns.forEach(btn => btn.addEventListener('click', () => {
            audio.init(); audio.playClick('select');
            clefSelBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentMode = btn.dataset.clef;
            state.modeConfig = MODE_CONFIG[state.currentMode];
            saveSettings();
        }));
        // Init visibility
        { const isChallenge = state.currentMode === 'classic60' || state.currentMode === 'bass60' || state.currentMode === 'mixed60';
          const isKeysig = state.currentMode === 'keysig_practice' || state.currentMode === 'keysig60';
          const isSolfege = state.currentMode === 'solfege_practice' || state.currentMode === 'solfege60';
          if (clefSelectorRow) clefSelectorRow.style.display = isChallenge ? '' : 'none';
          if (keysigSubRow) keysigSubRow.style.display = isKeysig ? '' : 'none';
          if (keysigGradeRow) keysigGradeRow.style.display = 'none';
          if (solfegeSubRow) solfegeSubRow.style.display = isSolfege ? '' : 'none';
          if (solfegeGradeRow) solfegeGradeRow.style.display = 'none';
          if (isChallenge) { clefSelBtns.forEach(b => b.classList.toggle('active', b.dataset.clef === state.currentMode));
              const challengeCard = document.querySelector('.mode-card[data-mode="classic60"]');
              if (challengeCard) { dom.modeCards.forEach(c => c.classList.remove('active')); challengeCard.classList.add('active'); }
          }
          if (isKeysig) {
              const ksCard = document.querySelector('.mode-card[data-mode="keysig_practice"]');
              if (ksCard) { dom.modeCards.forEach(c => c.classList.remove('active')); ksCard.classList.add('active'); }
              document.querySelectorAll('.ks-mode-btn').forEach(b => b.classList.toggle('active', (state.currentMode === 'keysig60') === (b.dataset.ksmode === 'challenge')));
          }
          if (isSolfege) {
              const solCard = document.querySelector('.mode-card[data-mode="solfege_practice"]');
              if (solCard) { dom.modeCards.forEach(c => c.classList.remove('active')); solCard.classList.add('active'); }
              document.querySelectorAll('.sol-mode-btn').forEach(b => b.classList.toggle('active', (state.currentMode === 'solfege60') === (b.dataset.solmode === 'challenge')));
          }
        }

        // Practice difficulty selector
        const diffBtns = document.querySelectorAll('.diff-btn');
        diffBtns.forEach(btn => btn.addEventListener('click', () => {
            audio.init(); audio.playClick('select');
            diffBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.practiceDiff = btn.dataset.diff;
            buildNoteButtons();
            saveSettings();
        }));
        if (dom.practiceDiffRow) dom.practiceDiffRow.style.display = state.currentMode === 'practice' ? '' : 'none';
        diffBtns.forEach(b => b.classList.toggle('active', b.dataset.diff === state.practiceDiff));
        
        dom.startBtn.addEventListener('click', () => {
            const gt = state.modeConfig && state.modeConfig.gameType;
            if (gt === 'keysig') startKeysigGame();
            else if (gt === 'solfege') startSolfegeGame();
            else startGame();
        }); 
        dom.endBtn.addEventListener('click', endGame); 
        dom.backToSetupBtn.addEventListener('click', () => { audio.playClick();
            dom.leaderboardLayout.classList.remove('view-only', 'practice-end');
            switchScreen('screen-hub');
        });
        document.getElementById('rankBackBtn')?.addEventListener('click', () => { audio.init(); audio.playClick();
            dom.leaderboardLayout.classList.remove('view-only', 'practice-end');
            switchScreen('screen-hub');
        });
        dom.viewRanksBtn?.addEventListener('click', () => { audio.init(); audio.playClick();
            dom.leaderboardLayout.classList.add('view-only');
            dom.reportGrid.innerHTML = '';
            dom.reportWeakness.innerHTML = '';
            const gf = document.getElementById('rankGameFilter');
            if (gf) { gf.value = 'game1'; const mfRow = dom.rankModeFilter?.closest?.('.rank-filter'); if (mfRow) mfRow.style.display = ''; }
            switchScreen('screen-leaderboard');
            loadRanks();
        });
        
        dom.revealBtn.addEventListener('click', () => { if (!state.gameActive || state.answered) return; const gt = state.modeConfig && state.modeConfig.gameType; if (gt === 'keysig') { state.answered = true; state.combo = 0; updateScoreboard(); if (_keysigCurrentQ) { dom.messageBox.textContent = `🔑 答案是 ${_keysigCurrentQ.correct.name}！請記下。`; } dom.messageBox.className = 'message-box warning'; enableGameControls(false); setTimeout(() => { dom.messageBox.className = 'message-box'; nextKeysigQuestion(); }, 2000); return; } if (gt === 'solfege') { state.answered = true; state.combo = 0; updateScoreboard(); if (state.currentNote) { const solName = getSolfege(state.currentNote.note, state._solfegeKeySig); dom.messageBox.textContent = `🎵 答案是 ${solName}！請記下。`; } dom.messageBox.className = 'message-box warning'; enableGameControls(false); setTimeout(() => { dom.messageBox.className = 'message-box'; nextSolfegeQuestion(); }, 2000); return; } state.answered = true; state.combo = 0; state.showAnswerHighlight = true; drawStaff(); updateScoreboard(); audio.playNote(state.currentNote.freqKey); const _sol3 = noteSol(state.currentNote); dom.messageBox.textContent = `🔊 答案是 ${state.currentNote.correctName}${_sol3?' = '+_sol3:''}，請聆聽並記下音位，然後作答下一題。`; dom.messageBox.className = 'message-box warning'; enableGameControls(false); setTimeout(() => { dom.messageBox.className = 'message-box'; nextQuestion(); }, 2500); });
        dom.skipBtn.addEventListener('click', () => { if (!state.gameActive || state.answered) return; state.answered = true; state.combo = 0; updateScoreboard(); dom.messageBox.textContent = '⏩ 已跳過本題，請作答下一題。'; dom.messageBox.className = 'message-box'; const gt = state.modeConfig && state.modeConfig.gameType; setTimeout(() => { if (gt === 'keysig') nextKeysigQuestion(); else if (gt === 'solfege') nextSolfegeQuestion(); else nextQuestion(); }, 400); });
        
        document.getElementById('rankGameFilter')?.addEventListener('change', () => {
            const gfVal = document.getElementById('rankGameFilter').value;
            const mfRow = dom.rankModeFilter?.closest?.('.rank-filter');
            if (mfRow) mfRow.style.display = gfVal === 'game1' ? '' : 'none';
            const dfWrap = document.getElementById('rankDiffFilterWrap');
            const dfSel = document.getElementById('rankDiffFilter');
            if (dfWrap && dfSel) {
                if (gfVal === 'game2') {
                    dfWrap.style.display = '';
                    dfSel.innerHTML = '<option value="節奏挑戰">節奏挑戰</option><option value="1分鐘挑戰">1分鐘挑戰</option><option value="時值辨別">時值辨別</option>';
                } else if (gfVal === 'game3') {
                    dfWrap.style.display = '';
                    dfSel.innerHTML = '<option value="0">全部難度</option><option value="Easy">Easy</option><option value="Normal">Normal</option><option value="Hard">Hard</option><option value="Expert">Expert</option>';
                } else {
                    dfWrap.style.display = 'none';
                    dfSel.innerHTML = '<option value="0">全部難度</option>';
                }
            }
            if (!state.allRanks.length) { loadRanks(); return; }
            renderRanks();
        });

        document.getElementById('rankDiffFilter')?.addEventListener('change', renderRanks);

        [dom.rankClassFilter, dom.rankGradeFilter, dom.rankModeFilter].forEach(f => f.addEventListener('change', renderRanks));
        const preventInput = () => state.inputFocused = true;
        const allowInput = () => state.inputFocused = false; 
        [dom.userId].forEach(el => { el.addEventListener('focus', preventInput); el.addEventListener('blur', allowInput); });
        
        document.addEventListener('keydown', (e) => { 
            if (state.inputFocused) return; 
            if (!state.gameActive) { 
                if (e.code === 'Enter' && dom.screenSetup.classList.contains('active')) { 
                    e.preventDefault(); 
                    dom.startBtn.click(); 
                } 
                return; 
            }
            const gt = state.modeConfig && state.modeConfig.gameType;
            if (gt === 'solfege') {
                // 1-7 for Do-Si
                const solMap = { '1':'Do','2':'Re','3':'Mi','4':'Fa','5':'Sol','6':'La','7':'Si' };
                const sol = solMap[e.key];
                if (sol) { e.preventDefault(); handleSolfegeAnswer(sol); }
                else if (e.code === 'Space') { e.preventDefault(); dom.skipBtn.click(); }
                return;
            }
            if (gt === 'keysig') {
                // No keyboard shortcuts for keysig MCQ (use mouse/touch)
                if (e.code === 'Space') { e.preventDefault(); dom.skipBtn.click(); }
                return;
            }
            const note = { '1':'C', '2':'D', '3':'E', '4':'F', '5':'G', '6':'A', '7':'B', 'Q':'C#','W':'D#','E':'F#','R':'G#','T':'A#', 'A':'D♭','S':'E♭','D':'G♭','F':'A♭','G':'B♭' }[e.key.toUpperCase()]; 
            if (note) { 
                e.preventDefault(); 
                const btn = noteBtnMap.get(note); if (btn && !btn.disabled) handleAnswer(note); 
            } else if (e.code === 'Space') { 
                e.preventDefault(); 
                dom.skipBtn.click(); 
            } else if (e.key.toUpperCase() === 'H') { 
                e.preventDefault(); 
                if (!dom.revealBtn.disabled) dom.revealBtn.click(); 
            } 
        });
    }

    // ==========================================
    // 👥 社交功能 (Social Features)
    // ==========================================
    function initSocialFeatures() {
        // Hub buttons
        document.getElementById('hubClassmatesBtn').addEventListener('click', () => {
            if (!state.currentUser || !state.currentUser.name) { alert('請先選擇你的身份！'); return; }
            document.getElementById('cmGrade').value = state.currentUser.grade || '6';
            document.getElementById('cmClass').value = state.currentUser.class || 'A';
            renderClassmateList();
            switchScreen('screen-classmates');
            // Batch-sync all profiles from GAS, then refresh the list
            const g = document.getElementById('cmGrade').value;
            const c = document.getElementById('cmClass').value;
            syncAllProfiles(g, c, () => renderClassmateList());
        });
        // Back buttons
        document.getElementById('classmatesBackBtn').addEventListener('click', () => switchScreen('screen-hub'));
        document.getElementById('viewProfileBackBtn').addEventListener('click', () => switchScreen('screen-classmates'));
        // Classmate filter changes
        document.getElementById('cmGrade').addEventListener('change', () => {
            renderClassmateList();
            const g = document.getElementById('cmGrade').value;
            const c = document.getElementById('cmClass').value;
            syncAllProfiles(g, c, () => renderClassmateList());
        });
        document.getElementById('cmClass').addEventListener('change', () => {
            renderClassmateList();
            const g = document.getElementById('cmGrade').value;
            const c = document.getElementById('cmClass').value;
            syncAllProfiles(g, c, () => renderClassmateList());
        });

        // Sync hub selections into classmate filters
        const cmGrade = document.getElementById('cmGrade');
        const cmClass = document.getElementById('cmClass');
        if (state.currentUser) {
            cmGrade.value = state.currentUser.grade || '6';
            cmClass.value = state.currentUser.class || 'A';
        }

    }

    let _viewingProfile = null;

    // ── Classmates Directory ──
    function renderClassmateList() {
        const grade = document.getElementById('cmGrade').value;
        const cls = document.getElementById('cmClass').value;
        const students = getStudentList(grade, cls);
        const list = document.getElementById('classmateList');
        const countEl = document.getElementById('cmCount');
        if (countEl) countEl.textContent = students.length ? `共 ${students.length} 位同學` : '';

        if (!students.length) {
            list.innerHTML = '<div class="cm-empty">這個班別暫時沒有同學資料 📭</div>';
            return;
        }

        const me = state.currentUser;
        list.innerHTML = students.map((name, i) => {
            const user = { name, grade, class: cls, seat: i + 1 };
            const p = loadProfile(user);
            const rs = _statsFromRanks(name, grade, cls);
            const played = rs ? rs.totalPlayed : p.stats.totalPlayed;
            const score  = rs ? rs.totalScore  : p.stats.totalScore;
            const combo  = rs ? rs.maxCombo    : p.stats.maxCombo;
            const avgAcc = rs ? rs.avgAccuracy : (p.stats.accuracyCount > 0 ? Math.round(p.stats.totalAccuracy / p.stats.accuracyCount) : 0);
            const avInfo = _avatarLookup(p.avatar);
            const isMe = me && me.name === name && me.grade == grade && me.class === cls;
            return `<div class="cm-card${isMe ? ' cm-me' : ''}" data-name="${escHtml(name)}" data-grade="${grade}" data-class="${cls}" data-seat="${i+1}">
                <div class="cm-avatar" style="background:${avInfo.bg}">${p.avatar}</div>
                <div class="cm-info">
                    <div class="cm-name">${escHtml(name)}${isMe ? ' <span class="cm-me-tag">我</span>' : ''}</div>
                    <div class="cm-detail">Lv.${p.level} · ${p.signature || '未設定簽名'}</div>
                    <div class="cm-stats"><span>🎮 ${played}次</span><span>🏆 ${score}分</span><span>🎯 ${avgAcc}%</span><span>🔥 ${combo}連擊</span></div>
                </div>
                <div class="cm-actions">
                    <button class="cm-view-btn" title="查看檔案">📋</button>
                </div>
            </div>`;
        }).join('');

        list.onclick = (e) => {
            const card = e.target.closest('.cm-card');
            if (!card) return;
            const name = card.dataset.name;
            const g = card.dataset.grade;
            const c = card.dataset.class;
            const s = card.dataset.seat;
            const user = { name, grade: g, class: c, seat: s };

            // Default: view profile
            openViewProfile(user);
        };
    }

    // ── View Other Profile ──
    function _renderViewProfile(user) {
        const p = loadProfile(user);
        const rs = _statsFromRanks(user.name, user.grade, user.class);
        const avInfo = _avatarLookup(p.avatar);

        const avEl = document.getElementById('vpAvatar');
        avEl.textContent = p.avatar;
        avEl.style.background = avInfo.bg;

        document.getElementById('vpName').textContent = (user.name || p.name) + ' 同學';
        document.getElementById('vpSig').textContent = p.signature || '尚未設定簽名';
        document.getElementById('vpMeta').textContent = `${user.grade ? (['','中一','中二','中三','中四','中五','中六'][user.grade] || '') : ''} ${user.class}班 · ${user.seat ? user.seat + '號' : ''}`;
        document.getElementById('vpLevel').textContent = 'Lv.' + p.level;
        const needed = _expForLevel(p.level);
        const expPct = Math.min(100, Math.round((p.exp / needed) * 100));
        document.getElementById('vpExpFill').style.width = expPct + '%';
        document.getElementById('vpExpText').textContent = `${p.exp} / ${needed} EXP`;

        const played = rs ? rs.totalPlayed : p.stats.totalPlayed;
        const cleared = p.stats.cleared || (rs ? rs.cleared : 0);
        const totalScore = rs ? rs.totalScore : p.stats.totalScore;
        const maxCombo = rs ? rs.maxCombo : p.stats.maxCombo;
        const avgAcc = rs ? rs.avgAccuracy : (p.stats.accuracyCount > 0 ? Math.round(p.stats.totalAccuracy / p.stats.accuracyCount) : 0);
        const fcCount = p.stats.fcCount || 0;
        const apCount = p.stats.apCount || 0;

        document.getElementById('vpTotalPlayed').textContent = played;
        document.getElementById('vpCleared').textContent = cleared;
        document.getElementById('vpTotalScore').textContent = totalScore;
        document.getElementById('vpAvgAccuracy').textContent = avgAcc + '%';
        document.getElementById('vpMaxCombo').textContent = maxCombo;
        document.getElementById('vpFCCount').textContent = fcCount;
        document.getElementById('vpAPCount').textContent = apCount;

        const gb = rs ? rs.gameBests : p.gameBests;
        document.getElementById('vpGame1').textContent = gb.game1 || '---';
        document.getElementById('vpGame2').textContent = gb.game2 || '---';
        document.getElementById('vpGame3').textContent = gb.game3 || '---';
        const vp4 = document.getElementById('vpGame4');
        if (vp4) vp4.textContent = gb.game4 || '---';
    }

    function openViewProfile(user) {
        _viewingProfile = user;
        _renderViewProfile(user);
        switchScreen('screen-view-profile');

        // Also sync from GAS for full profile (level, exp, etc.)
        syncProfileFromGAS(user).then(() => {
            if (_viewingProfile === user) _renderViewProfile(user);
        });
    }


    // Initialize on DOM ready.
    // When script.js is loaded dynamically (e.g. after bootstrap fetch), DOMContentLoaded has
    // already fired; we must run init immediately in that case or initHub never runs and name lists stay empty.
    function runAppInit() {
        // Render Lucide icons
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        initDOM();
        initState();
        initAudio();
        buildNoteButtons();
        const storedSound = localStorage.getItem('musicGameSoundEnabled');
        if (storedSound !== null) {
            audio.enabled = storedSound === 'true';
        }
        loadSavedSettings();
        // Populate student name dropdown for current grade/class
        populateNameDropdown();
        // Sync textbook mode to grade on first load if no saved settings override
        if (dom.textbookMode && dom.userGrade) { dom.textbookMode.value = dom.userGrade.value; handleTextbookModeChange(); }
        toggleCheckboxAppearance();
        enableGameControls(false);
        // Restore volume slider values
        const savedBg = localStorage.getItem('bgVolume');
        const savedSfx = localStorage.getItem('sfxVolume');
        if (savedBg && dom.bgVolume) { dom.bgVolume.value = savedBg; if (dom.bgVolumeVal) dom.bgVolumeVal.textContent = savedBg + '%'; }
        if (savedSfx && dom.sfxVolume) { dom.sfxVolume.value = savedSfx; if (dom.sfxVolumeVal) dom.sfxVolumeVal.textContent = savedSfx + '%'; }
        if (dom.bgMusic && dom.bgVolume) dom.bgMusic.volume = (parseInt(dom.bgVolume.value, 10) || 18) / 100;
        try { initEvents(); } catch(e) { console.error('initEvents error:', e); }
        try { initTutorial(); } catch(e) { console.error('initTutorial error:', e); }
        try { initHub(); } catch(e) { console.error('initHub error:', e); }
        try { initAppShell(); } catch(e) { console.error('initAppShell error:', e); }
        try { initLightbox(); } catch(e) { console.error('initLightbox error:', e); }
        // Prefetch ranks so opening 排行榜 feels instant
        setTimeout(() => { _paintRanksFromCache(); loadRanks(1); }, 300);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAppInit);
    } else {
        runAppInit();
    }

    // ==========================================
    // 📸 Image Lightbox
    // ==========================================
    function initLightbox() {
        const lb = document.getElementById('imgLightbox');
        const lbClose = document.getElementById('imgLightboxClose');
        const lbBackdrop = document.getElementById('imgLightboxBackdrop');
        if (!lb) return;
        const close = () => { lb.style.display = 'none'; };
        lbClose.addEventListener('click', close);
        lbBackdrop.addEventListener('click', close);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && lb.style.display !== 'none') close(); });
    }

    function openLightbox(src, title) {
        const lb = document.getElementById('imgLightbox');
        const img = document.getElementById('imgLightboxImg');
        const titleEl = document.getElementById('imgLightboxTitle');
        if (!lb || !img) return;
        img.src = src;
        if (titleEl && title) titleEl.textContent = title;
        lb.style.display = 'flex';
    }

    function initFullscreenToggle() {
        const btn = document.getElementById('hubFullscreenBtn');
        if (!btn) return;

        const root = document.documentElement;
        const canRequest = !!(root.requestFullscreen || root.webkitRequestFullscreen);
        const canExit = !!(document.exitFullscreen || document.webkitExitFullscreen);
        if (!canRequest || !canExit) {
            btn.hidden = true;
            return;
        }

        function isFullscreen() {
            return !!(document.fullscreenElement || document.webkitFullscreenElement);
        }

        function syncFullscreenUi() {
            const on = isFullscreen();
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.title = on ? '結束全螢幕' : '全螢幕';
            btn.setAttribute('aria-label', on ? '結束全螢幕' : '全螢幕');
            btn.textContent = on ? '⤡' : '⛶';
            document.body.classList.toggle('is-fullscreen', on);
        }

        btn.addEventListener('click', async () => {
            try {
                if (isFullscreen()) {
                    if (document.exitFullscreen) await document.exitFullscreen();
                    else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
                } else if (root.requestFullscreen) {
                    await root.requestFullscreen();
                } else if (root.webkitRequestFullscreen) {
                    await root.webkitRequestFullscreen();
                }
            } catch (err) {
                console.warn('Fullscreen failed:', err);
            }
            syncFullscreenUi();
        });

        document.addEventListener('fullscreenchange', syncFullscreenUi);
        document.addEventListener('webkitfullscreenchange', syncFullscreenUi);
        syncFullscreenUi();
    }

    function initHub() {
        const hubGrade = document.getElementById('hubGrade');
        const hubClass = document.getElementById('hubClass');
        const hubName  = document.getElementById('hubName');
        const hubSeat  = document.getElementById('hubSeat');
        const hubNameField = document.getElementById('hubNameField');

        let _hubCustomInput = null;
        let _hubIsGuest = false;

        function populateHub() {
            const grade = hubGrade.value, cls = hubClass.value;
            const students = getStudentList(grade, cls);
            const prev = hubName.value;
            const frag = document.createDocumentFragment();
            const first = document.createElement('option');
            first.value = ''; first.textContent = '請選擇姓名';
            frag.appendChild(first);
            students.forEach((n, i) => {
                const o = document.createElement('option');
                o.value = n; o.textContent = n; o.dataset.seat = i + 1;
                frag.appendChild(o);
            });
            const otherOpt = document.createElement('option');
            otherOpt.value = '__other__'; otherOpt.textContent = '✏️ 其他（自行填寫）';
            frag.appendChild(otherOpt);
            const guestOpt = document.createElement('option');
            guestOpt.value = '__guest__'; guestOpt.textContent = '🧪 訪客 / 測試人員';
            frag.appendChild(guestOpt);
            hubName.innerHTML = ''; hubName.appendChild(frag);
            if (prev && (students.includes(prev) || prev === '__other__' || prev === '__guest__')) { hubName.value = prev; }
            else { hubName.value = ''; hubSeat.value = ''; }
            _handleHubNameMode();
        }

        function _ensureHubCustomInput() {
            if (!_hubCustomInput) {
                const inp = document.createElement('input');
                inp.type = 'text'; inp.id = 'hubCustomNameInput'; inp.placeholder = '輸入你的名字';
                inp.autocomplete = 'off';
                inp.style.cssText = 'background:rgba(255,255,255,0.9); border:2px solid var(--primary-blue); border-radius:10px; outline:none; color:var(--text-dark); font-weight:800; width:100%; font-size:1rem; font-family:inherit; margin-top:6px; padding:8px 12px;';
                hubNameField.appendChild(inp);
                inp.addEventListener('input', () => { hubName.dispatchEvent(new Event('change')); });
                _hubCustomInput = inp;
            }
        }

        function _handleHubNameMode() {
            const val = hubName.value;
            _hubIsGuest = (val === '__guest__');
            if (val === '__other__') {
                _ensureHubCustomInput();
                _hubCustomInput.style.display = '';
                _hubCustomInput.placeholder = '輸入你的名字';
                _hubCustomInput.focus();
            } else if (_hubIsGuest) {
                // Guest mode: no name input needed, hide custom input
                if (_hubCustomInput) _hubCustomInput.style.display = 'none';
            } else if (_hubCustomInput) {
                _hubCustomInput.style.display = 'none';
            }
            // Guest mode: disable grade/class/seat
            hubGrade.closest('.hub-field').style.opacity = _hubIsGuest ? '0.4' : '';
            hubGrade.closest('.hub-field').style.pointerEvents = _hubIsGuest ? 'none' : '';
            hubClass.closest('.hub-field').style.opacity = _hubIsGuest ? '0.4' : '';
            hubClass.closest('.hub-field').style.pointerEvents = _hubIsGuest ? 'none' : '';
            hubSeat.closest('.hub-field').style.opacity = _hubIsGuest ? '0.4' : '';
            hubSeat.closest('.hub-field').style.pointerEvents = _hubIsGuest ? 'none' : '';
            if (_hubIsGuest) hubSeat.value = '';
        }

        function _getHubDisplayName() {
            const val = hubName.value;
            if (val === '__other__' || val === '__guest__') {
                return _hubCustomInput ? _hubCustomInput.value.trim() : '';
            }
            return val;
        }

        function syncFromHub() {
            // Mirror hub values → game-1 (existing) fields
            const displayName = _getHubDisplayName();
            if (dom.userGrade) dom.userGrade.value = hubGrade.value;
            if (dom.userClass) dom.userClass.value = hubClass.value;
            populateNameDropdown();
            if (hubName.value === '__other__' || hubName.value === '__guest__') {
                if (dom.userName) { dom.userName.value = '__other__'; showCustomName(); }
                if (_customNameInput && displayName) _customNameInput.value = displayName;
                if (_hubIsGuest && _customNameInput && !displayName) _customNameInput.value = '訪客';
            } else {
                if (dom.userName && hubName.value) dom.userName.value = hubName.value;
                hideCustomName();
            }
            if (dom.userId) dom.userId.value = _hubIsGuest ? '' : hubSeat.value;
            updateCurrentUserFromHub();
        }

        function updateCurrentUserFromHub() {
            const user = getHubUser();
            if (!user || !user.name) return;
            state.currentUser = {
                name: user.name,
                grade: parseInt(user.grade, 10) || 0,
                class: user.class || '',
                id: user.seat || ''
            };
        }

        hubGrade.addEventListener('change', () => { populateHub(); updateCurrentUserFromHub(); updateHubLockState(); });
        hubClass.addEventListener('change', () => { populateHub(); updateCurrentUserFromHub(); updateHubLockState(); });
        // Defensive: repopulate if user opens the name dropdown and it's still empty
        hubName.addEventListener('mousedown', () => { if (hubName.options.length <= 1) populateHub(); });
        hubName.addEventListener('focus',     () => { if (hubName.options.length <= 1) populateHub(); });
        hubName.addEventListener('change', () => {
            const sel = hubName.selectedOptions[0];
            hubSeat.value = (sel && sel.dataset.seat) ? sel.dataset.seat : '';
            _handleHubNameMode();
            // Show/hide player badge
            const badge = document.getElementById('hubPlayerBadge');
            const badgeText = document.getElementById('hubPlayerBadgeText');
            const loginCard = document.querySelector('.hub-login-card');
            const displayName = _getHubDisplayName();
            if ((hubName.value && hubName.value !== '__other__') || displayName) {
                if (badge && badgeText) {
                    if (_hubIsGuest) {
                        badgeText.textContent = '🧪 測試人員';
                    } else {
                        badgeText.textContent = `${hubGrade.options[hubGrade.selectedIndex].text} ${hubClass.value}班 · ${displayName || hubName.value} 同學`;
                    }
                    badge.classList.add('show');
                    if (loginCard) loginCard.classList.add('player-selected');
                }
            } else if (badge) {
                badge.classList.remove('show');
                if (loginCard) loginCard.classList.remove('player-selected');
            }
            updateCurrentUserFromHub();
            updateHubLockState();
            try {
                const u = getHubUser();
                if (u && u.name) updateHubAsideFromProfile(loadProfile(u));
            } catch (e) {}
        });

        populateHub();

        const asideProfileBtn = document.getElementById('hubAsideProfileBtn');
        if (asideProfileBtn) {
            asideProfileBtn.addEventListener('click', () => {
                const hubProfileBtn = document.getElementById('hubProfileBtn');
                if (hubProfileBtn) hubProfileBtn.click();
            });
        }

        window.addEventListener('musicapp:cloud-profile', (ev) => {
            const data = ev && ev.detail;
            if (!data) return;
            try {
                const u = getHubUser();
                if (!u || !u.name) return;
                const local = loadProfile(u);
                if (typeof data.exp === 'number' && data.exp > (local.exp || 0)) local.exp = data.exp;
                if (typeof data.level === 'number' && data.level > (local.level || 1)) local.level = data.level;
                if (data.gameBests && typeof data.gameBests === 'object') {
                    local.gameBests = Object.assign({}, local.gameBests || {}, data.gameBests);
                    Object.keys(data.gameBests).forEach((k) => {
                        local.gameBests[k] = Math.max(local.gameBests[k] || 0, data.gameBests[k] || 0);
                    });
                }
                saveProfile(local);
            } catch (e) {}
        });

        // Grade/class default from saved Game-1 settings
        const saved = localStorage.getItem('musicGameSettingsV4');
        if (saved) {
            try {
                const s = JSON.parse(saved);
                if (s.userGrade) hubGrade.value = s.userGrade;
                if (s.userClass) hubClass.value = s.userClass;
                populateHub();
                if (s.savedName) { hubName.value = s.savedName; const sel = hubName.selectedOptions[0]; if (sel && sel.dataset.seat) hubSeat.value = sel.dataset.seat; }
                _handleHubNameMode();
                hubName.dispatchEvent(new Event('change'));
            } catch(e) {}
        }

        function getHubUser() {
            if (isAppShell()) return getAppPlayerUser();
            const displayName = _getHubDisplayName();
            if (_hubIsGuest) {
                return { name: displayName || '訪客', grade: 0, class: '', seat: '' };
            }
            return { name: displayName || hubName.value, grade: parseInt(hubGrade.value), class: hubClass.value, seat: hubSeat.value };
        }

        function requireHubLogin(nameFieldEl) {
            if (isAppShell()) {
                if (window.MusicAppAuth && window.MusicAppAuth.required && !window.MusicAppAuth.signedIn) {
                    try {
                        window.dispatchEvent(new CustomEvent('musicapp:request-auth'));
                    } catch (e) {}
                    return false;
                }
                const user = getAppPlayerUser();
                state.currentUser = { name: user.name, grade: 0, class: 'App', id: '' };
                return true;
            }
            const val = hubName.value;
            if (!val) {
                if (nameFieldEl) { nameFieldEl.classList.add('error'); setTimeout(() => nameFieldEl.classList.remove('error'), 1200); }
                alert('❗ 請先完成身份：點開「③ 選擇姓名」選班上同學，或按「以訪客身分快速試玩」。');
                return false;
            }
            if ((val === '__other__') && !_getHubDisplayName()) {
                if (nameFieldEl) { nameFieldEl.classList.add('error'); setTimeout(() => nameFieldEl.classList.remove('error'), 1200); }
                alert('❗ 請輸入你的名字！');
                return false;
            }
            return true;
        }

        function updateHubLockState() {
            const hubScreen = document.getElementById('screen-hub');
            if (!hubScreen) return;
            if (isAppShell()) {
                hubScreen.classList.remove('hub-needs-login');
                document.querySelectorAll('#screen-hub .hub-game-card').forEach(c => c.classList.remove('is-locked'));
                return;
            }
            const val = hubName.value;
            const needs = !val || (val === '__other__' && !_getHubDisplayName());
            hubScreen.classList.toggle('hub-needs-login', needs);
            document.querySelectorAll('#screen-hub .hub-game-card').forEach(c => c.classList.toggle('is-locked', needs));
        }

        const hubQuickGuestBtn = document.getElementById('hubQuickGuestBtn');
        if (hubQuickGuestBtn) {
            hubQuickGuestBtn.addEventListener('click', (e) => {
                e.preventDefault();
                hubName.value = '__guest__';
                _handleHubNameMode();
                hubName.dispatchEvent(new Event('change'));
            });
        }

        // Game 1 entry — sync hub → setup then show setup
        const enterGame1El = document.getElementById('enterGame1');
        enterGame1El.addEventListener('click', () => {
            if (!requireHubLogin(hubNameField)) return;
            syncFromHub();
            // Auto-sync grade textbook level
            if (dom.textbookMode) { dom.textbookMode.value = hubGrade.value; handleTextbookModeChange(); }
            switchScreen('screen-setup');
        });
        enterGame1El.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                enterGame1El.click();
            }
        });

        const enterGame2El = document.getElementById('enterGame2');
        enterGame2El.addEventListener('click', () => {
            if (!requireHubLogin(hubNameField)) return;
            const user = getHubUser();
            state.currentUser = { name: user.name, grade: user.grade || 0, class: user.class || '', id: user.seat || '' };
            // Populate player badge on setup screen
            const badgeText = document.getElementById('g2PlayerBadgeText');
            if (badgeText) badgeText.textContent = `${user.grade ? ['','中一','中二','中三','中四','中五','中六'][user.grade] : ''}${user.class}班 · ${user.name} 同學`;

            let g2SelectedMode = 'practice';
            const g2ModeCards = document.querySelectorAll('#g2ModeCards .mode-card');
            g2ModeCards.forEach(c => {
                c.classList.toggle('active', c.dataset.mode === 'practice');
                c.onclick = () => {
                    g2ModeCards.forEach(x => x.classList.remove('active'));
                    c.classList.add('active');
                    g2SelectedMode = c.dataset.mode;
                };
            });

            document.getElementById('g2StartBtn').onclick = () => {
                if (g2SelectedMode === 'challenge') {
                    startRhythmChallenge(user);
                } else if (g2SelectedMode === '1min') {
                    _omLaunch(user);
                } else if (g2SelectedMode === 'duration') {
                    _durLaunch(user);
                } else {
                    enterRCGame(user);
                }
            };

            // Sub-buttons on 時值辨別 mode card
            const durHelpBtn = document.getElementById('durHelpBtn');
            const durRefBtn = document.getElementById('durRefBtn');
            if (durHelpBtn) durHelpBtn.onclick = (e) => {
                e.stopPropagation();
                const modal = document.getElementById('durHelpModal');
                if (modal) modal.style.display = 'flex';
            };
            if (durRefBtn) durRefBtn.onclick = (e) => {
                e.stopPropagation();
                const modal = document.getElementById('durRefModal');
                if (modal) {
                    hydrateDeferredImages(modal);
                    modal.style.display = 'flex';
                }
            };

            // durHelpModal close
            const durHelpClose = document.getElementById('durHelpClose');
            const durHelpModal = document.getElementById('durHelpModal');
            if (durHelpClose && durHelpModal) {
                durHelpClose.onclick = () => { durHelpModal.style.display = 'none'; };
                durHelpModal.onclick = (e) => { if (e.target === durHelpModal) durHelpModal.style.display = 'none'; };
            }

            // durRefModal close
            const durRefClose = document.getElementById('durRefClose');
            const durRefModal = document.getElementById('durRefModal');
            if (durRefClose && durRefModal) {
                durRefClose.onclick = () => { durRefModal.style.display = 'none'; };
                durRefModal.onclick = (e) => { if (e.target === durRefModal) durRefModal.style.display = 'none'; };
            }

            document.getElementById('g2BackToHubFromSetup').onclick = () => switchScreen('screen-hub');
            document.getElementById('g2SetupViewRanks').onclick = () => {
                dom.leaderboardLayout.classList.add('view-only');
                dom.reportGrid.innerHTML = ''; dom.reportWeakness.innerHTML = '';
                const gf = document.getElementById('rankGameFilter');
                if (gf) { gf.value = 'game2'; gf.dispatchEvent(new Event('change')); }
                loadRanks();
                switchScreen('screen-leaderboard');
            };
            switchScreen('screen-g2-setup');
        });
        enterGame2El.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                enterGame2El.click();
            }
        });

        const enterGame3El = document.getElementById('enterGame3');
        enterGame3El.addEventListener('click', () => {
            if (!requireHubLogin(hubNameField)) return;
            const user = getHubUser();
            state.currentUser = { name: user.name, grade: user.grade || 0, class: user.class || '', id: user.seat || '' };
            const badgeText = document.getElementById('g3PlayerBadgeText');
            if (badgeText) badgeText.textContent = `${user.grade ? ['','中一','中二','中三','中四','中五','中六'][user.grade] : ''}${user.class}班 · ${user.name} 同學`;
            let g3SelectedMode = 'practice';
            // Default practice grade to the student's own grade (clamped to p1–p6)
            const defaultGrade = Math.min(6, Math.max(1, parseInt(user.grade) || 1));
            let g3SelectedDiff = 'p' + defaultGrade;
            const g3DiffSel = document.getElementById('g3DiffSelector');
            const g3GradeSel = document.getElementById('g3PracticeGradeSelector');

            function _updateSelectors() {
                const isPractice = g3SelectedMode === 'practice';
                if (g3GradeSel) g3GradeSel.style.display = isPractice ? '' : 'none';
                if (g3DiffSel)  g3DiffSel.style.display  = isPractice ? 'none' : '';
            }

            document.querySelectorAll('#g3ModeCards .mode-card').forEach(c => {
                c.classList.toggle('active', c.dataset.mode === 'practice');
                c.onclick = () => {
                    g3SelectedMode = c.dataset.mode;
                    document.querySelectorAll('#g3ModeCards .mode-card').forEach(x => x.classList.remove('active'));
                    c.classList.add('active');
                    // Reset diff selection when switching modes
                    if (g3SelectedMode === 'practice') {
                        g3SelectedDiff = 'p' + defaultGrade;
                        document.querySelectorAll('#g3PracticeGradeCards .diff-card').forEach(x => x.classList.toggle('active', x.dataset.diff === g3SelectedDiff));
                    } else {
                        g3SelectedDiff = (defaultGrade === 1 || defaultGrade === 2) ? 'expert' : 'easy';
                        document.querySelectorAll('#g3DiffCards .diff-card').forEach(x => x.classList.toggle('active', x.dataset.diff === g3SelectedDiff));
                    }
                    _updateSelectors();
                };
            });

            // Practice grade card selection (p1–p6)
            document.querySelectorAll('#g3PracticeGradeCards .diff-card').forEach(c => {
                c.classList.toggle('active', c.dataset.diff === g3SelectedDiff);
                c.onclick = () => {
                    g3SelectedDiff = c.dataset.diff;
                    document.querySelectorAll('#g3PracticeGradeCards .diff-card').forEach(x => x.classList.remove('active'));
                    c.classList.add('active');
                };
            });

            // Challenge difficulty card selection
            document.querySelectorAll('#g3DiffCards .diff-card').forEach(c => {
                c.classList.toggle('active', c.dataset.diff === 'easy');
                c.onclick = () => {
                    g3SelectedDiff = c.dataset.diff;
                    document.querySelectorAll('#g3DiffCards .diff-card').forEach(x => x.classList.remove('active'));
                    c.classList.add('active');
                };
            });
            _updateSelectors();

            document.getElementById('g3StartBtn').onclick = () => startGame3(user, g3SelectedMode, g3SelectedDiff);
            document.getElementById('g3StudyBtn').onclick = () => openStudyScreen();
            document.getElementById('g3BackToHubFromSetup').onclick = () => switchScreen('screen-hub');
            document.getElementById('g3SetupViewRanks').onclick = () => {
                const layout = document.getElementById('g3LeaderboardLayout');
                if (layout) layout.classList.add('view-only');
                const backBtn = document.getElementById('g3ResultBack');
                if (backBtn) { backBtn.style.display = ''; backBtn.onclick = () => { backBtn.style.display = 'none'; switchScreen('screen-g3-setup'); }; }
                renderLocalRankList('game3', 'g3RankList', user, g3SelectedDiff);
                switchScreen('screen-game3-result');
            };
            switchScreen('screen-g3-setup');
        });
        enterGame3El.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                enterGame3El.click();
            }
        });

        // ── Game 4 Hub Entry ──
        const enterGame4El = document.getElementById('enterGame4');
        enterGame4El.addEventListener('click', () => {
            if (!requireHubLogin(hubNameField)) return;
            const user = getHubUser();
            state.currentUser = { name: user.name, grade: user.grade || 0, class: user.class || '', id: user.seat || '' };
            const badgeText = document.getElementById('g4PlayerBadgeText');
            if (badgeText) badgeText.textContent = `${user.grade ? ['','中一','中二','中三','中四','中五','中六'][user.grade] : ''}${user.class}班 · ${user.name} 同學`;

            let g4SelectedMode = 'practice';

            document.querySelectorAll('#g4ModeCards .mode-card').forEach(c => {
                c.classList.toggle('active', c.dataset.mode === 'practice');
                c.onclick = () => {
                    g4SelectedMode = c.dataset.mode;
                    document.querySelectorAll('#g4ModeCards .mode-card').forEach(x => x.classList.remove('active'));
                    c.classList.add('active');
                };
            });

            document.getElementById('g4StartBtn').onclick = () => startGame4(user, g4SelectedMode);

            // Study button — 樂器圖鑑（遊戲邏輯保留）
            document.getElementById('g4StudyBtn').onclick = () => {
                openInstrumentCodex('screen-g4-setup');
            };

            document.getElementById('g4BackToHubFromSetup').onclick = () => switchScreen('screen-hub');
            document.getElementById('g4SetupViewRanks').onclick = () => {
                const layout = document.getElementById('g4LeaderboardLayout');
                if (layout) layout.classList.add('view-only');
                const backBtn = document.getElementById('g4ResultBack');
                if (backBtn) { backBtn.style.display = ''; backBtn.onclick = () => { backBtn.style.display = 'none'; switchScreen('screen-g4-setup'); }; }
                renderLocalRankList('game4', 'g4RankList', user);
                switchScreen('screen-game4-result');
            };
            switchScreen('screen-g4-setup');
        });
        enterGame4El.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                enterGame4El.click();
            }
        });

        const enterCompositionStudioEl = document.getElementById('enterCompositionStudio');
        enterCompositionStudioEl?.addEventListener('click', () => {
            if (!requireHubLogin(hubNameField)) return;
            const user = getHubUser();
            state.currentUser = { name: user.name, grade: user.grade || 0, class: user.class || '', id: user.seat || '' };
            CompositionStudio.open();
            switchScreen('screen-composition-studio');
        });
        enterCompositionStudioEl?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                enterCompositionStudioEl.click();
            }
        });

        document.getElementById('hubViewRanksBtn').addEventListener('click', () => {
            dom.leaderboardLayout.classList.add('view-only');
            dom.reportGrid.innerHTML = ''; dom.reportWeakness.innerHTML = '';
            const gf = document.getElementById('rankGameFilter');
            if (gf) gf.value = 'game1';
            const mfRow = dom.rankModeFilter?.closest?.('.rank-filter');
            if (mfRow) mfRow.style.display = '';
            switchScreen('screen-leaderboard');
            loadRanks();
        });

        // ——— 個人檔案按鈕 ———
        document.getElementById('hubProfileBtn').addEventListener('click', () => {
            if (!requireHubLogin(hubNameField)) return;
            updateCurrentUserFromHub();
            if (!state.currentUser || !state.currentUser.name) return;
            renderProfileScreen(state.currentUser);
            switchScreen('screen-profile');
        });
        const hubViewRanksEl = document.getElementById('hubViewRanksBtn');
        const hubMobileRanksBtn = document.getElementById('hubMobileRanksBtn');
        const hubMobileProfileBtn = document.getElementById('hubMobileProfileBtn');
        if (hubMobileRanksBtn && hubViewRanksEl) hubMobileRanksBtn.addEventListener('click', () => hubViewRanksEl.click());
        if (hubMobileProfileBtn) hubMobileProfileBtn.addEventListener('click', () => document.getElementById('hubProfileBtn')?.click());
        document.getElementById('profileBackBtn').addEventListener('click', () => {
            if (isAppShell()) {
                refreshAppHomeProfile();
                switchScreen('screen-app-root');
                setAppTab('me');
            } else {
                switchScreen('screen-hub');
            }
        });

        initFullscreenToggle();

        // ——— 社交功能 Social Features ———
        initSocialFeatures();

        document.getElementById('backToHubFromSetup').addEventListener('click', () => {
            switchScreen('screen-hub');
        });

        updateHubLockState();
    }

    function openInstrumentCodex(backScreenId) {
        const backTo = backScreenId || (isAppShell() ? 'screen-app-root' : 'screen-g4-setup');
        let studyFamily = 'all';
        let studySearch = '';
        if (typeof renderG4Study === 'function') renderG4Study(studyFamily, studySearch);

        document.querySelectorAll('#screen-g4-study .study-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.cat === 'all');
            tab.onclick = () => {
                studyFamily = tab.dataset.cat;
                document.querySelectorAll('#screen-g4-study .study-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderG4Study(studyFamily, studySearch);
            };
        });

        const searchInput = document.getElementById('g4StudySearch');
        const searchClear = document.getElementById('g4StudySearchClear');
        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = () => {
                studySearch = searchInput.value;
                if (searchClear) searchClear.style.display = studySearch ? '' : 'none';
                renderG4Study(studyFamily, studySearch);
            };
        }
        if (searchClear) {
            searchClear.style.display = 'none';
            searchClear.onclick = () => {
                studySearch = '';
                if (searchInput) searchInput.value = '';
                searchClear.style.display = 'none';
                renderG4Study(studyFamily, studySearch);
            };
        }

        const studyBack = document.getElementById('g4StudyBack');
        if (studyBack) {
            studyBack.onclick = () => {
                switchScreen(backTo);
                if (isAppShell() && backTo === 'screen-app-root') setAppTab('codex');
            };
        }
        const studyStart = document.getElementById('g4StudyStartBtn');
        if (studyStart) {
            studyStart.onclick = () => {
                if (isAppShell()) {
                    switchScreen('screen-app-root');
                    setAppTab('games');
                } else {
                    switchScreen('screen-g4-setup');
                }
            };
        }
        switchScreen('screen-g4-study');
    }

    function setAppTab(tabId) {
        const id = tabId || 'games';
        document.querySelectorAll('.app-tab-panel').forEach((panel) => {
            const on = panel.dataset.appTab === id;
            panel.classList.toggle('active', on);
            panel.hidden = !on;
        });
        document.querySelectorAll('.app-tab-btn').forEach((btn) => {
            const on = btn.dataset.appTab === id;
            btn.classList.toggle('active', on);
            if (on) btn.setAttribute('aria-current', 'page');
            else btn.removeAttribute('aria-current');
        });
        if (id === 'me') refreshAppHomeProfile();
    }

    function refreshAppHomeProfile() {
        if (!isAppShell()) return;
        const user = getAppPlayerUser();
        state.currentUser = { name: user.name, grade: 0, class: 'App', id: '' };
        const p = loadProfile(user);
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('appHomeName', user.name);
        set('appHomeMeta', '本地進度會自動保存');
        set('appHomeLevel', String(p.level || 1));
        set('appHomeExp', String(p.exp || 0));
        const bests = p.gameBests || {};
        set('appMeBest1', String(bests.game1 || 0));
        set('appMeBest2', String(bests.game2 || 0));
        const av = document.getElementById('appHomeAvatar');
        if (av) av.textContent = p.avatar || '🎵';
    }

    function initAppShell() {
        if (!isAppShell()) return;
        document.documentElement.classList.add('app-shell');
        document.body.classList.add('app-shell', 'app-on-root');

        const hub = document.getElementById('screen-hub');
        const root = document.getElementById('screen-app-root');
        if (hub) hub.classList.remove('active');
        if (root) root.classList.add('active');

        // Ensure screen map includes app root (initDOM may have run already)
        if (dom.screenMap && root) dom.screenMap.set('screen-app-root', root);

        document.querySelectorAll('.app-tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => setAppTab(btn.dataset.appTab));
        });

        document.querySelectorAll('.app-game-row[data-launch]').forEach((row) => {
            row.addEventListener('click', () => {
                const target = document.getElementById(row.dataset.launch);
                if (target) target.click();
            });
        });

        document.getElementById('appOpenCodexBtn')?.addEventListener('click', () => {
            openInstrumentCodex('screen-app-root');
        });

        document.getElementById('appHomeProfileBtn')?.addEventListener('click', () => {
            if (!requireHubLogin()) return;
            renderProfileScreen(state.currentUser);
            switchScreen('screen-profile');
        });

        window.addEventListener('musicapp:social-auth', (ev) => {
            const u = ev && ev.detail;
            if (u && u.displayName) {
                try { localStorage.setItem('appPlayerName', u.displayName); } catch (e) {}
            }
            refreshAppHomeProfile();
            updateHubLockState();
        });

        setAppTab('games');
        refreshAppHomeProfile();
        updateHubLockState();

        try {
            if (window.AppThreeBg && typeof window.AppThreeBg.setActive === 'function') {
                window.AppThreeBg.setActive(true);
            }
        } catch (e) {}
    }

    // ==========================================
    // renderRanksForGame — Game 2/3 shared ranks (uses GAS data)
    // ==========================================
    function renderRanksForGame(gameKey) {
        if (!dom.rankList) return;
        const fC = dom.rankClassFilter ? dom.rankClassFilter.value : '0';
        const fG = dom.rankGradeFilter ? parseInt(dom.rankGradeFilter.value) : 0;
        const fD = document.getElementById('rankDiffFilter')?.value || '0';
        let data = state.allRanks.filter(r => r.game === gameKey || r.mode === gameKey);
        if (fC !== '0') data = data.filter(r => r.class === fC);
        if (fG !== 0) data = data.filter(r => parseInt(r.grade) === fG);
        if (fD !== '0') data = data.filter(r => (r.mode_name || '').includes(fD));
        data.sort((a,b) => (b.score||0) - (a.score||0));
        // Dedup: keep highest score per student (when filtering by difficulty, dedup per student+difficulty)
        const seen = new Set();
        const deduped = data.filter(r => {
            const diffKey = fD !== '0' ? `|${fD}` : '';
            const k = `${String(r.name||'').trim()}|${r.grade}|${r.class}|${String(r.id||r.seat||'').trim()}${diffKey}`;
            if (seen.has(k)) return false; seen.add(k); return true;
        });
        // Student rank hint
        const selfIndex = deduped.findIndex(isCurrentUserRecord);
        if (dom.studentRankHint) {
            if (state.currentUser?.name && selfIndex >= 0) {
                dom.studentRankHint.innerHTML = `🎯 ${escHtml(state.currentUser.name)} 同學目前排第 <strong>${selfIndex + 1}</strong> 名`;
                dom.studentRankHint.style.display = '';
            } else {
                dom.studentRankHint.style.display = 'none';
            }
        }
        if (!deduped.length) { dom.rankList.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);font-weight:800;">暫時未有紀錄，做第一個挑戰者！🚀</div>'; return; }
        const MAX_RENDER = 100;
        const displayList = deduped.slice(0, MAX_RENDER);
        dom.rankList.innerHTML = _rankRewardBanner() + displayList.map((item, i) => {
            const isSelf = isCurrentUserRecord(item);
            const cls = escHtml(item.class||''); const name = escHtml(item.name||'');
            const score = item.score || 0; const acc = item.accuracy || 0;
            const gradeTxt = item.grade ? `中${['','一','二','三','四','五','六'][item.grade]||item.grade}` : '';
            const seatTxt = (item.id || item.seat) ? `${item.id || item.seat}號` : '';
            // Extract difficulty label from mode_name (e.g. '節奏挑戰·Hard' → 'Hard')
            const diffPart = (item.mode_name || '').split('·')[1] || '';
            const diffColors = { Easy:'#4CAF50', Normal:'#2196F3', Hard:'#FF9800', Expert:'#E91E63' };
            const diffTag = diffPart ? `<span class="rank-tag" style="background:${diffColors[diffPart]||'#888'};color:#fff;">${diffPart}</span>` : '';
            return `<div class="rank-item ${i===0?'first':i===1?'second':i===2?'third':''} ${isSelf?'self':''}">
                <div class="rank-pos">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1+'.'}</div>
                <div class="rank-name">
                    <span class="rank-student-name">${name}</span>
                    <div class="rank-badges">
                        ${gradeTxt?`<span class="rank-tag rank-grade-tag">${gradeTxt}</span>`:''}
                        <span class="rank-tag rank-class-tag">${cls}班</span>
                        ${seatTxt?`<span class="rank-tag rank-seat-tag">${seatTxt}</span>`:''}
                        ${isSelf?'<span class="rank-tag" style="background:var(--primary-purple);color:#fff;">我</span>':''}
                        ${diffTag}
                        <span class="rank-tag" style="background:#CBD5E1;color:#333;">${acc}% 正確</span>
                    </div>
                </div>
                <div class="rank-score">${score}</div></div>`;
        }).join('') + (deduped.length > MAX_RENDER ? `<div style="text-align:center;padding:16px;color:var(--text-light);font-size:0.85rem;">顯示前 ${MAX_RENDER} 名（共 ${deduped.length} 人）</div>` : '');
    }

    function saveLocalRank(gameKey, user, score, accuracy, maxCombo, difficulty) {
        try {
            const all = JSON.parse(localStorage.getItem('musicGameRanks_' + gameKey) || '[]');
            const idx = all.findIndex(r => r.name === user.name && r.class === user.class && r.grade === user.grade && (r.difficulty || '') === (difficulty || ''));
            if (idx >= 0) { if (score > (all[idx].score || 0)) { all[idx].score = score; all[idx].accuracy = accuracy; all[idx].max_combo = maxCombo; } }
            else all.push({ name: user.name, grade: user.grade, class: user.class, id: user.seat || user.id || '', score, accuracy, max_combo: maxCombo, difficulty: difficulty || '' });
            localStorage.setItem('musicGameRanks_' + gameKey, JSON.stringify(all));
        } catch(e) {}
    }

    // ==========================================
    // 🎴 節奏卡練習模式 (40 rhythm cards quiz)
    // ==========================================
    // Each entry: { num, label (correct answer), level, distractors }
    // label uses ta/ti/ti-ti/ti-ri-ti-ri/ta-a/ta-a-a-a notation
    const RC_CARDS = [
        // Level 1 (01-12) — 基礎組合與休止符位移
        { num:1,  label:'ta ta ta ta',           level:1 },
        { num:2,  label:'ta ta ti-ti ta',         level:1 },
        { num:3,  label:'ta ti-ti ta ta',         level:1 },
        { num:4,  label:'ta ti-ti ti-ti ta',      level:1 },
        { num:5,  label:'ti-ti ti-ti 休 ta',      level:1 },
        { num:6,  label:'ta ta 休 ta',            level:1 },
        { num:7,  label:'ta 休 ta ti-ti',         level:1 },
        { num:8,  label:'ta-a ta-a',              level:1 },
        { num:9,  label:'ta ta ta-a',             level:1 },
        { num:10, label:'ti-ti ti-ti ta-a',       level:1 },
        { num:11, label:'ti-ti ti-ti ta ti-ti',   level:1 },
        { num:12, label:'ti-ti ta ti-ti ta',      level:1 },
        // Level 2 (13-24) — 十六分音符與前附點
        { num:13, label:'ta ti-ri-ti-ri ta ta',            level:2 },
        { num:14, label:'ti-ri-ti-ri ta ti-ri-ti-ri ta',   level:2 },
        { num:15, label:'ti-ti ti-ri-ti-ri ti-ti ti-ti',   level:2 },
        { num:16, label:'ti-ri-ti-ri ti-ti ta 休',         level:2 },
        { num:17, label:'ta ti-ri ta ta',                  level:2 },
        { num:18, label:'ti-ri ti-ri ti-ti ti-ti',         level:2 },
        { num:19, label:'ta-i ti ta ta',                   level:2 },
        { num:20, label:'ta-i ti ta-i ti',                 level:2 },
        { num:21, label:'ta-a-a ta',                       level:2 },
        { num:22, label:'ta ti-ti-ri ta ta',               level:2 },
        { num:23, label:'ti-ti-ri ta ti-ti-ri ta',         level:2 },
        { num:24, label:'ti-ti-ri ti-ti ti-ti ti-ti',      level:2 },
        // Level 3 (25-32) — 進階附點與切分節奏
        { num:25, label:'ti-ri ti-ti ti-ti-ri ti-ti',      level:3 },
        { num:26, label:'ti-ri ti-ti-ri ti-ti ta',         level:3 },
        { num:27, label:'ti-ri ta ti-ri-ti-ri ta',         level:3 },
        { num:28, label:'ti-ri-ti-ri ta ti-ti-ri ta',      level:3 },
        { num:29, label:'ti-ri ti-ri-ti-ri ta ta',         level:3 },
        { num:30, label:'ti ta-i ta ta',                   level:3 },
        { num:31, label:'ti ta-i ta-a',                    level:3 },
        { num:32, label:'ti-ti ti-ti ti ta-i',             level:3 },
        // Level 4 (33-40) — 複合切分與易混淆節奏
        { num:33, label:'ti ta ti ta ta',                  level:4 },
        { num:34, label:'ti ta ti ti-ti ta',               level:4 },
        { num:35, label:'ti ta ti ta-a',                   level:4 },
        { num:36, label:'ti-ti ta ri-ti-ri ta',            level:4 },
        { num:37, label:'ri-ti-ri ta ri-ti-ri ti-ti',      level:4 },
        { num:38, label:'ti-ti ri-ti-ri ti-ti ti-ti',      level:4 },
        { num:39, label:'ti-ri-ti ta ti-ri-ti ta',         level:4 },
        { num:40, label:'ti-ti ti-ri-ti ti-ti ti-ti',      level:4 },
    ];

    // ── Rhythm parser: label → tap onset positions (in beats) ──────────────
    function parseRhythmTaps(label) {
        const taps = [];
        let pos = 0;
        for (const tok of label.split(' ')) {
            switch (tok) {
                case '休':          pos += 1;    break;
                case 'ta':          taps.push(pos); pos += 1;    break;
                case 'ta-a':        taps.push(pos); pos += 2;    break;
                case 'ta-a-a':      taps.push(pos); pos += 3;    break;
                case 'ta-i':        taps.push(pos); pos += 1.5;  break;
                case 'ti':          taps.push(pos); pos += 0.5;  break;
                case 'ti-ti':       taps.push(pos); taps.push(pos + 0.5); pos += 1; break;
                case 'ti-ri-ti-ri': taps.push(pos); taps.push(pos+0.25); taps.push(pos+0.5); taps.push(pos+0.75); pos += 1; break;
                case 'ti-ri':       taps.push(pos); taps.push(pos+0.75); pos += 1; break;
                case 'ti-ti-ri':    taps.push(pos); taps.push(pos+0.5); taps.push(pos+0.75); pos += 1; break;
                case 'ti-ri-ti':    taps.push(pos); taps.push(pos+0.25); taps.push(pos+0.5); pos += 1; break;
                case 'ri-ti-ri':    taps.push(pos); taps.push(pos+0.25); taps.push(pos+0.75); pos += 1; break;
                default:            taps.push(pos); pos += 1;    break;
            }
        }
        return { taps, totalBeats: pos };
    }

    function getRhythmTokenDuration(token) {
        switch (token) {
            case '休': return 1;
            case 'ta': return 1;
            case 'ta-a': return 2;
            case 'ta-a-a': return 3;
            case 'ta-i': return 1.5;
            case 'ti': return 0.5;
            case 'ti-ti': return 1;
            case 'ti-ri-ti-ri': return 1;
            case 'ti-ri': return 1;
            case 'ti-ti-ri': return 1;
            case 'ti-ri-ti': return 1;
            case 'ri-ti-ri': return 1;
            default: return 1;
        }
    }

    function formatBeatValue(beats) {
        if (beats === 0.25) return '1/4 拍';
        if (beats === 0.5) return '半拍';
        if (beats === 1.5) return '1.5 拍';
        if (Number.isInteger(beats)) return `${beats} 拍`;
        return `${beats} 拍`;
    }

    function parseRhythmSegments(label) {
        const segments = [];
        let pos = 0;
        label.split(' ').forEach((token, index) => {
            const duration = getRhythmTokenDuration(token);
            segments.push({
                token,
                start: pos,
                duration,
                isRest: token === '休',
                index,
            });
            pos += duration;
        });
        return { segments, totalBeats: pos };
    }

    // Compound-token expansion map: token → [{label, offset, dur}, ...]
    const COMPOUND_TOKENS = {
        'ti-ti':       [{l:'ti',o:0,d:0.5},{l:'ti',o:0.5,d:0.5}],
        'ti-ri-ti-ri': [{l:'ti',o:0,d:0.25},{l:'ri',o:0.25,d:0.25},{l:'ti',o:0.5,d:0.25},{l:'ri',o:0.75,d:0.25}],
        'ti-ri':       [{l:'ti',o:0,d:0.75},{l:'ri',o:0.75,d:0.25}],
        'ti-ti-ri':    [{l:'ti',o:0,d:0.5},{l:'ti',o:0.5,d:0.25},{l:'ri',o:0.75,d:0.25}],
        'ti-ri-ti':    [{l:'ti',o:0,d:0.25},{l:'ri',o:0.25,d:0.25},{l:'ti',o:0.5,d:0.5}],
        'ri-ti-ri':    [{l:'ri',o:0,d:0.25},{l:'ti',o:0.25,d:0.5},{l:'ri',o:0.75,d:0.25}],
    };

    function parseRhythmUnits(label) {
        const { segments, totalBeats } = parseRhythmSegments(label);
        const units = [];

        segments.forEach((segment, segmentIndex) => {
            if (segment.isRest) return;
            const compound = COMPOUND_TOKENS[segment.token];
            if (compound) {
                compound.forEach(sub => {
                    units.push({
                        beatPos: segment.start + sub.o,
                        durationBeats: sub.d,
                        label: sub.l,
                        segmentIndex,
                    });
                });
                return;
            }
            units.push({
                beatPos: segment.start,
                durationBeats: segment.duration,
                label: segment.token,
                segmentIndex,
            });
        });

        return { units, segments, totalBeats };
    }

    // Friendly display names for tokens (used in value chips & game tokens)
    const TOKEN_DISPLAY = {
        'ta':'四分', 'ta-a':'二分', 'ta-a-a':'附點二分', 'ta-i':'附點四分',
        'ti':'八分', 'ti-ti':'兩個八分', 'ti-ri-ti-ri':'四個十六分',
        'ti-ri':'前附點', 'ti-ti-ri':'前八後十六', 'ti-ri-ti':'前十六後八',
        'ri-ti-ri':'小切分', '休':'休止符',
    };

    // Music note symbols for rhythm challenge display
    const TOKEN_NOTE_SYM = {
        'ta':          '𝅘𝅥',          // quarter note
        'ta-a':        '𝅗𝅥',          // half note
        'ta-a-a':      '𝅗𝅥.',         // dotted half
        'ta-i':        '𝅘𝅥.',         // dotted quarter
        'ti':          '♪',           // eighth note
        'ti-ti':       '♫',          // two eighths (beamed)
        'ti-ri-ti-ri': '𝅘𝅥𝅮𝅘𝅥𝅮𝅘𝅥𝅮𝅘𝅥𝅮',      // four sixteenths
        'ti-ri':       '♪.',          // dotted eighth + sixteenth
        'ti-ti-ri':    '♪𝅘𝅥𝅮𝅘𝅥𝅮',       // eighth + two sixteenths
        'ti-ri-ti':    '𝅘𝅥𝅮𝅘𝅥𝅮♪',       // two sixteenths + eighth
        'ri-ti-ri':    '𝅘𝅥𝅮♪𝅘𝅥𝅮',       // sixteenth + eighth + sixteenth
        '休':          '𝄾',           // quarter rest
    };

    function _rcRenderValueChips(card) {
        const row = document.getElementById('rcValueChipRow');
        if (!row) return;

        const { segments } = parseRhythmSegments(card.label);
        row.innerHTML = segments.map(segment => `
            <div class="rc-value-chip">
                <div class="rc-value-token">${escHtml(TOKEN_DISPLAY[segment.token] || segment.token)}</div>
                <div class="rc-value-note">${segment.isRest ? '休止 1 拍' : formatBeatValue(segment.duration)}</div>
            </div>`).join('');
    }

    function _rcRenderGameTokens(card) {
        const lbl = card.bars ? card.bars[0] : card.label;
        const { segments } = parseRhythmSegments(lbl);
        _rcRenderGameTokensFromSegs(segments);
    }

    function _rcRenderGameTokensFromSegs(segs) {
        const row = document.getElementById('rcGameTokenRow');
        if (!row) return;
        row.innerHTML = segs.map((segment, index) => `
            <div class="rc-game-token" data-segment-index="${index}">
                <div class="rc-game-token-text">${escHtml(TOKEN_DISPLAY[segment.token] || segment.token)}</div>
                <div class="rc-game-token-value">${segment.isRest ? '休止 1 拍' : formatBeatValue(segment.duration)}</div>
            </div>`).join('');
    }

    // ==========================================
    // 🎴 RC Canvas Game — 節奏識辨
    // ==========================================
    const WIN_PERFECT = 50;
    const WIN_GREAT   = 115;
    const WIN_GOOD    = 240;
    const REPS        = 4;

    /**
     * Input-latency compensation (ms).
     * Touch devices have ~30-50ms of inherent latency between the physical
     * tap and when the JS handler fires.  We subtract this from the raw
     * elapsed time so that "on-beat" feels correct to the player.
     * Positive = player's taps are treated as if they happened earlier.
     */
    const INPUT_LATENCY_MS = 30;

    /**
     * Human-variance helpers.
     * • Early taps get a wider window (humans naturally anticipate).
     * • Late taps use the base window.
     * • Judgment uses signed error so the bonus only applies to early hits.
     */
    const EARLY_LENIENCY = 1.25;   // early window is 25% wider

    function _compensatedError(rawElapsed, targetMs) {
        const compensated = rawElapsed - INPUT_LATENCY_MS;
        const signed = compensated - targetMs;          // negative = early
        const earlyMul = signed < 0 ? EARLY_LENIENCY : 1.0;
        return { abs: Math.abs(signed) / earlyMul, signed };
    }

    let rcGameState = {};

    // Best grade persistence per card
    function _rcGetBestGrades() {
        try { return JSON.parse(localStorage.getItem('rcBestGrades') || '{}'); } catch(e) { return {}; }
    }
    function _rcSaveBestGrade(cardNum, qualAcc, score) {
        const data = _rcGetBestGrades();
        const key = String(cardNum);
        const prev = data[key];
        if (!prev || score > prev.score) {
            data[key] = { qualAcc, score };
            localStorage.setItem('rcBestGrades', JSON.stringify(data));
        }
    }
    function _rcGetGradeBadge(cardNum) {
        const data = _rcGetBestGrades();
        const best = data[String(cardNum)];
        if (!best) return '';
        const qa = best.qualAcc;
        if (qa >= 90) return '<span class="rc-best-badge rc-best-s">★★★</span>';
        if (qa >= 75) return '<span class="rc-best-badge rc-best-a">★★</span>';
        if (qa >= 60) return '<span class="rc-best-badge rc-best-b">★</span>';
        return '<span class="rc-best-badge rc-best-c">·</span>';
    }

    // ── RC Challenge Mode — randomly generated rhythms ──
    // Lv1 basic: quarter + eighth note patterns
    // Lv2 medium: adds 16th note group (ti-ri-ti-ri) and dotted patterns
    // Lv3 advanced: adds mixed 16th combinations (ti-ti-ri, ti-ri-ti, ri-ti-ri)
    const CHALLENGE_TOKEN_SETS = {
        basic:    [{n:'ta',d:1},{n:'ta',d:1},{n:'ti-ti',d:1},{n:'ta-a',d:2},{n:'休',d:1}],
        medium:   [{n:'ta',d:1},{n:'ta',d:1},{n:'ti-ti',d:1},{n:'ta-a',d:2},{n:'休',d:1},
                   {n:'ti-ri-ti-ri',d:1},{n:'ta-i',d:1.5},{n:'ti',d:0.5}],
        advanced: [{n:'ta',d:1},{n:'ta',d:1},{n:'ti-ti',d:1},{n:'ta-a',d:2},{n:'休',d:1},
                   {n:'ti-ri-ti-ri',d:1},{n:'ta-i',d:1.5},{n:'ti',d:0.5},
                   {n:'ti-ti-ri',d:1},{n:'ti-ri-ti',d:1},{n:'ri-ti-ri',d:1},{n:'ta-a-a',d:3}],
    };

    // Tokens that must start at an integer beat position.
    // Beaming tokens: beam would cross a beat boundary if off-beat.
    // Long notes (ta-a, ta-a-a): a half/dotted-half starting on the "and" of a beat
    //   is non-standard notation in a children's rhythm exercise.
    const _BEAM_TOKENS = new Set(['ti-ti','ti-ri-ti-ri','ti-ri','ti-ti-ri','ti-ri-ti','ri-ti-ri',
                                   'ta-a','ta-a-a']);

    function _generateChallengeRhythm(diff) {
        const tokens = CHALLENGE_TOKEN_SETS[diff] || CHALLENGE_TOKEN_SETS.basic;
        const target = 4;
        let remaining = target;
        const parts = [];
        let safety = 0;
        while (remaining > 0.001 && safety++ < 200) {
            const pos = Math.round((target - remaining) * 1000) / 1000;
            const onBeat = Math.abs(pos - Math.round(pos)) < 0.01; // at integer beat?
            let eligible = tokens.filter(t => t.d <= remaining + 0.001);
            // At non-integer beat positions, only allow non-beaming tokens
            // to ensure beams never cross beat boundaries
            if (!onBeat) eligible = eligible.filter(t => !_BEAM_TOKENS.has(t.n));
            if (!eligible.length) break;
            const tok = eligible[Math.floor(Math.random() * eligible.length)];
            parts.push(tok.n);
            remaining = Math.round((remaining - tok.d) * 1000) / 1000;
        }
        return parts.join(' ');
    }

    const RC_CHALLENGE_COUNT = 5;

    function enterRCGame(user) {
        audio.init();
        audio.warmUp();
        audio.bgStop();
        _rcStopPreview();
        _rcRemoveGameKeyHandler();

        rcGameState = {
            _user: user,
            _card: rcGameState._card || null,
            _bpm: rcGameState._bpm || 60,
            _previewTimers: [],
            _judgeTimer: null,
        };

        const grade = user.grade || 6;
        const badge = document.getElementById('rcPlayerBadgeText');
        if (badge) badge.textContent = `${user.name} 同學 (${['','中一','中二','中三','中四','中五','中六'][grade]||grade})`;

        document.getElementById('rcLevelsBack').onclick = () => { audio.bgPlay(); switchScreen('screen-g2-setup'); };
        _rcRenderLevels();
        switchScreen('screen-rc-levels');
    }

    // ============================================================
    // 🏫 節奏挑戰 — 按年級自動難度 (Grade Rhythm Challenge)
    // ============================================================

    /**
     * Difficulty Map — per-grade config
     * measures: number of measures per round
     * bpm: metronome speed
     * tokenSet: which pool of rhythm tokens to draw from
     * winScale: multiplier on timing window (>1 = more lenient)
     */
    const GRADE_CHALLENGE_CONFIG = {
        1: { tokenSet: 'advanced', bpm: 96,  measures: 4, winScale: 1.0 },
        2: { tokenSet: 'advanced', bpm: 96,  measures: 4, winScale: 1.0 },
        3: { tokenSet: 'medium',   bpm: 72,  measures: 4, winScale: 1.2 },
        4: { tokenSet: 'medium',   bpm: 80,  measures: 4, winScale: 1.1 },
        5: { tokenSet: 'advanced', bpm: 88,  measures: 4, winScale: 1.0 },
        6: { tokenSet: 'advanced', bpm: 96,  measures: 4, winScale: 1.0 },
    };

    /* --- Measure generation --- */
    function _rchgGenerateMeasures(grade) {
        const cfg = GRADE_CHALLENGE_CONFIG[grade] || GRADE_CHALLENGE_CONFIG[6];
        const measures = [];
        for (let i = 0; i < cfg.measures; i++) {
            measures.push(_generateChallengeRhythm(cfg.tokenSet));
        }
        return { measures, bpm: cfg.bpm, winScale: cfg.winScale };
    }

    // ============================================================
    //  節奏挑戰 — DOM-based Rhythm Game
    // ============================================================

    const RCHAL_LEVELS = [
        { id: 1, name: '初級',  icon: '⭐',       bpm: 72,  tokenSet: 'basic',    bars: 16, winScale: 1.4, hpLoss: 10 },
        { id: 2, name: '中級',  icon: '⭐⭐',     bpm: 72,  tokenSet: 'medium',   bars: 16, winScale: 1.3, hpLoss: 12 },
        { id: 3, name: '高級',  icon: '⭐⭐⭐',   bpm: 72,  tokenSet: 'advanced', bars: 16, winScale: 1.2, hpLoss: 14 },
    ];

    const rchalState = {
        user: null,
        level: null,
        phase: 'idle',       // idle | select | preview | countdown | playing | done
        measures: [],
        taps: [],            // expected taps
        score: 0, combo: 0, maxCombo: 0, hp: 100,
        counts: { perfect: 0, great: 0, good: 0, miss: 0, wrong: 0 },
        startTime: 0,
        timers: [],
        stars: {},           // levelId → 0-3
        rowRanges: [],       // per-row y/h for highlighting
        restZones: [],       // [{idx, startMs, endMs}] for rest tap detection
        restNoteMap: {},     // restIdx → {el, bar, row}
    };

    function _rchalGetStars(lvl) { return rchalState.stars[lvl] || 0; }
    function _rchalSetStars(lvl, s) { rchalState.stars[lvl] = Math.max(rchalState.stars[lvl] || 0, s); }
    function _rchalIsUnlocked(lvl) { return true; }

    /* ── Launch from g2-setup ── */
    function startRhythmChallenge(user) {
        rchalState.user = user;
        audio.init(); audio.warmUp(); audio.bgStop();
        switchScreen('screen-rc-grade');
        _rchalShowSelect();
    }

    function _rchalExit() {
        _rchalCleanup();
        audio.bgPlay();
        switchScreen('screen-g2-setup');
    }

    function _rchalCleanup() {
        rchalState.timers.forEach(t => clearTimeout(t));
        rchalState.timers = [];
        rchalState.phase = 'idle';
        rchalState.noteMap = [];
        rchalState.missRafId && cancelAnimationFrame(rchalState.missRafId);
        rchalState.missRafId = 0;
        document.removeEventListener('keydown', _rchalKeyHandler);
        audio.stopAllTicks();
    }

    /* ── Level Select View (like g3 music terms setup) ── */
    function _rchalShowSelect() {
        _rchalCleanup();
        rchalState.phase = 'select';
        rchalState._selectedLevel = rchalState._selectedLevel || RCHAL_LEVELS[0];
        const container = document.getElementById('screen-rc-grade');
        const grade = rchalState.user ? rchalState.user.grade || 1 : 1;
        const gradeName = ['', '中一', '中二', '中三', '中四', '中五', '中六'][grade] || '';
        const userName = rchalState.user ? rchalState.user.name : '';

        container.innerHTML = `
            <div class="rchal-setup-wrap">
                <button class="rchal-setup-back" id="rchalExitBtn">← 返回主頁</button>
                <div class="rchal-setup-title-area">
                    <h1 class="rchal-setup-title">🥁 節奏挑戰</h1>
                    <div class="rchal-setup-subtitle">聽辨節拍 · 準確擊拍 · 計入排行榜</div>
                </div>
                <div class="rchal-setup-player">
                    <span class="rchal-setup-badge">👋 ${userName} 同學 (${gradeName})</span>
                </div>
                <div class="rchal-diff-section">
                    <div class="rchal-diff-title">🎯 選擇難度</div>
                    <div class="rchal-diff-cards" id="rchalDiffCards"></div>
                </div>
                <button class="rchal-setup-start" id="rchalSetupStart">🚀 開始練習</button>
                <button class="rchal-setup-ranks" id="rchalSetupRanks">🏆 查看排行榜</button>
            </div>
        `;
        document.getElementById('rchalExitBtn').onclick = _rchalExit;

        const diffGrid = document.getElementById('rchalDiffCards');
        const diffMeta = [
            { cls: 'rchal-diff-easy',   desc: '四分+八分音符<br>基本拍型' },
            { cls: 'rchal-diff-medium', desc: '+十六分音符組<br>附點節奏' },
            { cls: 'rchal-diff-hard',   desc: '+混合十六分<br>切分節奏' },
        ];
        RCHAL_LEVELS.forEach((lvl, i) => {
            const stars = _rchalGetStars(lvl.id);
            const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
            const isActive = rchalState._selectedLevel && rchalState._selectedLevel.id === lvl.id;
            const btn = document.createElement('button');
            btn.className = `rchal-diff-card ${diffMeta[i].cls}${isActive ? ' active' : ''}`;
            btn.innerHTML = `
                <div class="rchal-diff-stars-row">${lvl.icon}</div>
                <div class="rchal-diff-name">Lv.${lvl.id} ${lvl.name}</div>
                <div class="rchal-diff-desc">${lvl.bpm} BPM · ${lvl.bars}小節<br>${diffMeta[i].desc}</div>
                <div class="rchal-diff-record">${starStr}</div>
            `;
            btn.onclick = () => {
                rchalState._selectedLevel = lvl;
                diffGrid.querySelectorAll('.rchal-diff-card').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
            };
            diffGrid.appendChild(btn);
        });

        document.getElementById('rchalSetupStart').onclick = () => {
            if (rchalState._selectedLevel) _rchalStartLevel(rchalState._selectedLevel);
        };
        document.getElementById('rchalSetupRanks').onclick = () => {
            dom.leaderboardLayout.classList.add('view-only');
            dom.reportGrid.innerHTML = ''; dom.reportWeakness.innerHTML = '';
            const gf = document.getElementById('rankGameFilter');
            if (gf) { gf.value = 'game2'; gf.dispatchEvent(new Event('change')); }
            loadRanks();
            switchScreen('screen-leaderboard');
        };
    }

    /* ── Start a Level (preview phase — auto-show 16 bars) ── */
    function _rchalStartLevel(lvl) {
        _rchalCleanup();
        rchalState.user = state.currentUser;
        rchalState.level = lvl;
        rchalState.phase = 'preview';
        rchalState.score = 0; rchalState.combo = 0; rchalState.maxCombo = 0; rchalState.hp = 100;
        rchalState.counts = { perfect: 0, great: 0, good: 0, miss: 0, wrong: 0 };
        rchalState.restZones = []; rchalState.restNoteMap = {};
        _rchalLastTapMs = 0;

        // Generate measures
        const measures = [];
        for (let i = 0; i < lvl.bars; i++) {
            measures.push(_generateChallengeRhythm(lvl.tokenSet));
        }
        rchalState.measures = measures;

        const container = document.getElementById('screen-rc-grade');
        container.innerHTML = `
            <div class="rchal-header">
                <button class="rchal-exit" id="rchalExitBtn">✕</button>
                <div class="rchal-header-center">
                    <div class="rchal-title">Lv.${lvl.id} ${lvl.name}</div>
                    <div class="rchal-meta">${lvl.bpm} BPM · ${lvl.bars}小節</div>
                </div>
                <div class="rchal-score" id="rchalScore">0</div>
            </div>
            <div class="rchal-hp-wrap"><div class="rchal-hp-fill" id="rchalHpFill"></div></div>
            <div class="rchal-track" id="rchalTrack">
                <div class="rchal-notes" id="rchalNotes"></div>
            </div>
            <div class="rchal-feedback">
                <div class="rchal-combo" id="rchalCombo"></div>
                <div class="rchal-judgment" id="rchalJudgment"></div>
            </div>
            <div class="rchal-beats" id="rchalBeats">
                <div class="rchal-beat-dot beat-accent">1</div>
                <div class="rchal-beat-dot">2</div>
                <div class="rchal-beat-dot">3</div>
                <div class="rchal-beat-dot">4</div>
            </div>
            <div class="rchal-tap" id="rchalTap" style="opacity:0;pointer-events:none;">
                <span class="rchal-tap-emoji">🥁</span>
                <span class="rchal-tap-label">請在此擊拍</span>
            </div>
            <div class="rchal-status" id="rchalStatus">👀 請先審視節奏，然後按下方按鈕開始</div>
            <button class="rchal-ready-btn" id="rchalStartBtn">✋ Ready!</button>
            <div class="rchal-overlay" id="rchalOverlay" style="display:none;"></div>
        `;

        document.getElementById('rchalExitBtn').onclick = () => _rchalShowSelect();

        // Build taps for ALL bars (doesn't depend on DOM layout)
        _rchalBuildTaps(measures, lvl);

        // Auto-render 16 bars — use double rAF to ensure layout is computed
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                rchalState.noteMap = [];
                _rchalRenderNotes(measures, lvl.bars);
            });
        });

        // Ready button → 4 ready beats
        document.getElementById('rchalStartBtn').onclick = () => _rchalCountdown();

        // HP bar initial
        _rchalDrawHP();
    }

    /* ── Render notes via VexFlow — adaptive rows ── */
    function _rchalRenderNotes(measures, numBars) {
        const notesEl = document.getElementById('rchalNotes');
        if (!notesEl) return;
        notesEl.innerHTML = '';
        const trackEl = document.getElementById('rchalTrack');
        let W = trackEl.clientWidth;
        if (!W || W < 100) W = trackEl.getBoundingClientRect().width || window.innerWidth - 16;

        // Determine bars-per-row based on complexity
        const lvl = rchalState.level;
        const BARS_PER_ROW = (lvl && lvl.tokenSet === 'basic') ? 4 : 2;
        const numRows = Math.ceil(numBars / BARS_PER_ROW);
        const MIN_ROW_H = (lvl && lvl.tokenSet === 'basic') ? 150 : 180;
        const totalH = Math.max(numRows * MIN_ROW_H, 320);
        const ROW_H = totalH / numRows;

        if (typeof VexFlow === 'undefined') return;
        const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Annotation, Stem, Dot } = VexFlow;

        const renderer = new Renderer(notesEl, Renderer.Backends.SVG);
        renderer.resize(W, totalH);
        const context = renderer.getContext();

        const durMap = { 0.25: '16', 0.5: '8', 0.75: '8', 1: 'q', 1.5: 'q', 2: 'h', 3: 'h' };
        const dotSet = new Set([0.75, 1.5, 3]);
        const PAD = 4;
        const barW = (W - PAD * 2) / BARS_PER_ROW;

        const allNoteMap = [];
        const allRestMap = {};
        let tapIdx = 0;
        let restIdx = 0;

        // Store row boundaries for highlighting during play
        rchalState.rowRanges = [];

        measures.forEach((barLabel, bi) => {
            const row = Math.floor(bi / BARS_PER_ROW);
            const col = bi % BARS_PER_ROW;
            const x = PAD + col * barW;
            const y = row * ROW_H;

            // Track which row each bar belongs to
            if (!rchalState.rowRanges[row]) rchalState.rowRanges[row] = { startBar: bi, endBar: bi, y: y, h: ROW_H };
            rchalState.rowRanges[row].endBar = bi;

            const stave = new Stave(x, y + 40, barW);
            [0, 1, 3, 4].forEach(line => stave.setConfigForLine(line, { visible: false }));
            if (col === 0 && row === 0) stave.addTimeSignature('4/4');
            stave.setContext(context).draw();

            const vfNotes = [];
            const beamGroups = [];
            const noteGameMap = [];
            const barTapStart = tapIdx;
            let eighthRun = [];
            const flushEighthRun = () => {
                while (eighthRun.length >= 2) {
                    beamGroups.push(eighthRun.slice(0, 2));
                    eighthRun = eighthRun.slice(2);
                }
                eighthRun = [];
            };

            barLabel.split(' ').forEach(token => {
                const isRest = token === '休';
                const compound = COMPOUND_TOKENS[token];

                if (isRest) {
                    flushEighthRun();
                    const note = new StaveNote({ keys: ['b/4'], duration: 'qr' });
                    note.addModifier(new Annotation('休止').setVerticalJustification(3).setFont('Noto Sans TC', 9));
                    vfNotes.push(note);
                    noteGameMap.push({ rest: true, restIdx: restIdx });
                    restIdx++;
                } else if (compound) {
                    flushEighthRun();
                    const group = [];
                    compound.forEach(sub => {
                        const dur = durMap[sub.d];
                        if (!dur) return;
                        const note = new StaveNote({ keys: ['b/4'], duration: dur, stemDirection: Stem.UP });
                        if (dotSet.has(sub.d)) Dot.buildAndAttach([note], { all: true });
                        note.addModifier(new Annotation(sub.l).setVerticalJustification(3).setFont('Noto Sans TC', 9));
                        vfNotes.push(note);
                        group.push(note);
                        noteGameMap.push([tapIdx]);
                        tapIdx++;
                    });
                    if (group.length > 1) beamGroups.push(group);
                } else {
                    const tokenDur = getRhythmTokenDuration(token);
                    const dur = durMap[tokenDur];
                    if (!dur) return;
                    const note = new StaveNote({ keys: ['b/4'], duration: dur, stemDirection: Stem.UP });
                    if (dotSet.has(tokenDur)) Dot.buildAndAttach([note], { all: true });
                    note.addModifier(new Annotation(token).setVerticalJustification(3).setFont('Noto Sans TC', 9));
                    vfNotes.push(note);
                    noteGameMap.push([tapIdx]);
                    tapIdx++;
                    if (dur === '8') {
                        eighthRun.push(note);
                        while (eighthRun.length >= 2) {
                            beamGroups.push(eighthRun.slice(0, 2));
                            eighthRun = eighthRun.slice(2);
                        }
                    } else {
                        flushEighthRun();
                    }
                }
            });
            flushEighthRun();

            try {
            const nsx = stave.getNoteStartX();
            const voice = new Voice({ numBeats: 4, beatValue: 4 });
            voice.setMode(2);
            voice.addTickables(vfNotes);
            new Formatter().joinVoices([voice]).format([voice], Math.max(barW - (nsx - x) - 16, 40));
            const beams = [];
            beamGroups.forEach(g => {
                if (g.length < 2) { beams.push(null); return; }
                try {
                    const b = new Beam(g, false);
                    if (b.renderOptions) b.renderOptions.beamWidth = 3.5;
                    b.setContext(context);
                    beams.push(b);
                } catch (e) { beams.push(null); }
            });
            voice.draw(context, stave);
            beams.forEach(b => { if (b) { try { b.draw(); } catch (e) {} } });

            // Map beam SVG elements to their note indices
            const beamElMap = new Map();
            beamGroups.forEach((group, gi) => {
                const bEl = beams[gi] && beams[gi].attrs ? beams[gi].attrs.el : null;
                if (!bEl && beams[gi] && beams[gi].getSVGElement) {
                    beamElMap.set(gi, beams[gi].getSVGElement());
                } else if (bEl) {
                    beamElMap.set(gi, bEl);
                }
            });

            vfNotes.forEach((vfNote, vi) => {
                const gameIndices = noteGameMap[vi];
                const el = vfNote.getSVGElement ? vfNote.getSVGElement() : (vfNote.attrs && vfNote.attrs.el);
                // Map rest SVG elements
                if (gameIndices && gameIndices.rest) {
                    allRestMap[gameIndices.restIdx] = { el: el, bar: bi, row: row };
                    return;
                }
                if (!gameIndices || !gameIndices.length) return;
                // Find which beam group this note belongs to
                let beamEl = null;
                beamGroups.forEach((group, gi) => {
                    if (group.includes(vfNote)) beamEl = beamElMap.get(gi);
                });
                gameIndices.forEach(gi => {
                    allNoteMap[gi] = { el: el, bar: bi, row: row, beamEl: beamEl };
                });
            });
            } catch (err) {
                console.warn('[rchal] bar', bi, 'render failed:', err, '| tokens:', barLabel);
            }
        });

        rchalState.noteMap = allNoteMap;
        rchalState.restNoteMap = allRestMap;
        rchalState.trackW = W;
    }

    /* ── Build expected taps ── */
    function _rchalBuildTaps(measures, lvl) {
        rchalState.taps = [];
        const beatMs = 60000 / lvl.bpm;
        let beatCursor = 0;
        let tapIdx = 0;

        let restIdx = 0;
        measures.forEach((label, mIdx) => {
            const tokens = label.split(' ');
            tokens.forEach(token => {
                const dur = getRhythmTokenDuration(token);
                if (token === '休') {
                    rchalState.restZones.push({
                        idx: restIdx++,
                        startMs: beatCursor * beatMs,
                        endMs: (beatCursor + dur) * beatMs,
                    });
                    beatCursor += dur; return;
                }

                const compound = COMPOUND_TOKENS[token];
                if (compound) {
                    compound.forEach(sub => {
                        rchalState.taps.push({
                            idx: tapIdx,
                            beatPos: beatCursor + sub.o,
                            absTimeMs: (beatCursor + sub.o) * beatMs,
                            consumed: false, hit: false,
                        });
                        tapIdx++;
                    });
                } else {
                    rchalState.taps.push({
                        idx: tapIdx,
                        beatPos: beatCursor,
                        absTimeMs: beatCursor * beatMs,
                        consumed: false, hit: false,
                    });
                    tapIdx++;
                }
                beatCursor += dur;
            });
        });
    }

    /* ── Countdown — 4 Ready Beats with metronome ── */
    function _rchalCountdown() {
        if (rchalState.phase !== 'preview') return;
        rchalState.phase = 'countdown';
        const startBtn = document.getElementById('rchalStartBtn');
        if (startBtn) startBtn.style.display = 'none';
        const statusEl = document.getElementById('rchalStatus');

        // Keep overlay hidden so students can see the rhythm notes during count-in
        const overlay = document.getElementById('rchalOverlay');
        overlay.style.display = 'none';

        const lvl = rchalState.level;
        const beatMs = 60000 / lvl.bpm;
        const beatDots = document.querySelectorAll('#rchalBeats .rchal-beat-dot');

        let beat = 0;
        const totalBeats = 4;
        const tick = () => {
            if (beat >= totalBeats) {
                if (statusEl) statusEl.textContent = '';
                _rchalBeginPlay();
                return;
            }
            // Show beat number in the status bar (no overlay blur)
            if (statusEl) {
                statusEl.textContent = beat === 0 ? '🥁 Ready! 1' : `🥁 ${beat + 1}`;
                statusEl.style.fontWeight = '900';
                statusEl.style.fontSize = '1.4rem';
            }

            // Highlight beat dot
            beatDots.forEach((d, i) => d.classList.toggle('active', i === beat));

            // Play metronome tick sound via Web Audio
            if (audio.ctx && audio.ctx.state === 'suspended') {
                audio.ctx.resume().then(() => audio.scheduleTick(audio.ctx.currentTime + 0.01, beat === 0)).catch(() => {});
            } else {
                audio.resume();
                if (audio.ctx) audio.scheduleTick(audio.ctx.currentTime + 0.01, beat === 0);
            }

            beat++;
            rchalState.timers.push(setTimeout(tick, beatMs));
        };
        tick();
    }

    /* ── Begin Playing ── */
    function _rchalBeginPlay() {
        rchalState.phase = 'playing';
        rchalState.startTime = performance.now();
        markProfilePlayStart();
        rchalState.nextTapIdx = 0;
        const lvl = rchalState.level;
        const beatMs = 60000 / lvl.bpm;
        const totalBeats = lvl.bars * 4;
        const totalMs = totalBeats * beatMs;

        // Show tap zone
        const tapEl = document.getElementById('rchalTap');
        tapEl.style.opacity = '1';
        tapEl.style.pointerEvents = 'auto';
        tapEl.addEventListener('pointerdown', _rchalOnTap);
        tapEl.addEventListener('touchstart', (e) => { e.preventDefault(); _rchalOnTap(); }, { passive: false });

        // Keyboard
        document.addEventListener('keydown', _rchalKeyHandler);

        // Add row highlight overlay
        const trackEl = document.getElementById('rchalTrack');
        const rowHL = document.createElement('div');
        rowHL.id = 'rchalRowHL';
        rowHL.className = 'rchal-row-highlight';
        trackEl.appendChild(rowHL);

        // Schedule row highlighting + smooth auto-scroll to active row
        const rows = rchalState.rowRanges || [];
        let currentRow = -1;
        const updateRow = (barIdx) => {
            const newRow = rows.findIndex(r => r && barIdx >= r.startBar && barIdx <= r.endBar);
            const rowData = newRow >= 0 ? rows[newRow] : null;
            if (newRow !== currentRow && rowData) {
                currentRow = newRow;
                rowHL.style.top = rowData.y + 'px';
                rowHL.style.height = rowData.h + 'px';
                rowHL.style.opacity = '1';
                // Smooth scroll so the active row is visible near the top of the track
                const trackEl = document.getElementById('rchalTrack');
                if (trackEl) {
                    const targetScrollTop = Math.max(0, rowData.y - 8);
                    trackEl.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
                }
            }
        };
        updateRow(0);
        for (let b = 0; b < lvl.bars; b++) {
            const barStartMs = b * 4 * beatMs;
            rchalState.timers.push(setTimeout(() => {
                if (rchalState.phase !== 'playing') return;
                updateRow(b);
            }, barStartMs));
        }

        // Pre-schedule metronome via Web Audio for drift-free timing
        const beatDots = document.querySelectorAll('#rchalBeats .rchal-beat-dot');
        audio.resume();
        if (audio.ctx) {
            const baseTime = audio.ctx.currentTime + 0.02;
            for (let b = 0; b < totalBeats; b++) {
                const t = baseTime + (b * beatMs) / 1000;
                const beatInBar = b % 4;
                audio.scheduleTick(t, beatInBar === 0);
            }
        }
        // Beat dot visuals via setTimeout (visual only, ok to have slight drift)
        for (let b = 0; b < totalBeats; b++) {
            rchalState.timers.push(setTimeout(() => {
                if (rchalState.phase !== 'playing') return;
                const beatInBar = b % 4;
                beatDots.forEach((d, i) => d.classList.toggle('active', i === beatInBar));
            }, b * beatMs));
        }

        // Miss detection loop — uses nextTapIdx pointer for O(1) per frame
        const winLate = beatMs * 0.35 * lvl.winScale;
        const missCheck = () => {
            if (rchalState.phase !== 'playing') return;
            const elapsed = performance.now() - rchalState.startTime;
            const taps = rchalState.taps;
            while (rchalState.nextTapIdx < taps.length) {
                const tap = taps[rchalState.nextTapIdx];
                if (tap.consumed) { rchalState.nextTapIdx++; continue; }
                if (elapsed <= tap.absTimeMs + winLate) break;
                // Miss
                tap.consumed = true;
                tap.hit = false;
                rchalState.counts.miss++;
                rchalState.combo = 0;
                rchalState.hp = Math.max(0, rchalState.hp - lvl.hpLoss);
                _rchalDrawHP();
                _rchalShowJudgment('MISS', 'miss');
                audio.playHit('miss');
                document.getElementById('rchalCombo').textContent = '';
                const nm = rchalState.noteMap && rchalState.noteMap[tap.idx];
                if (nm && nm.el) {
                    _vfColorNote(nm.el, '#EF4444', 0.5);
                    if (nm.beamEl) _vfColorNote(nm.beamEl, '#EF4444', 0.5);
                }
                rchalState.nextTapIdx++;
                if (rchalState.hp <= 0) { _rchalFinish(); return; }
            }
            rchalState.missRafId = requestAnimationFrame(missCheck);
        };
        rchalState.missRafId = requestAnimationFrame(missCheck);

        // End timer
        rchalState.timers.push(setTimeout(() => _rchalFinish(), totalMs + beatMs * 0.5));
    }

    function _rchalKeyHandler(e) {
        if (e.code === 'Space' && rchalState.phase === 'playing') {
            e.preventDefault();
            _rchalOnTap();
        }
    }

    /* ── Tap Handler (optimized effects & scoring) ── */
    let _rchalLastTapMs = 0;
    function _rchalOnTap() {
        if (rchalState.phase !== 'playing') return;
        const now = performance.now();
        if (now - _rchalLastTapMs < 40) return; // debounce: ignore double-fire from touchstart+pointerdown
        _rchalLastTapMs = now;
        const elapsed = now - rchalState.startTime;
        const lvl = rchalState.level;
        const beatMs = 60000 / lvl.bpm;
        const winMs = beatMs * 0.35 * lvl.winScale;

        // Tap ripple effect
        const tapEl = document.getElementById('rchalTap');
        tapEl.classList.add('flash');
        setTimeout(() => tapEl.classList.remove('flash'), 80);

        // Spawn ripple ring
        const ripple = document.createElement('div');
        ripple.className = 'rchal-tap-ripple';
        tapEl.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);

        // Sequential matching: avoid "stealing" the next 16th note.
        const taps = rchalState.taps;
        while (rchalState.nextTapIdx < taps.length && taps[rchalState.nextTapIdx].consumed) {
            rchalState.nextTapIdx++;
        }

        // If player is already too late for pending taps, settle them as MISS now.
        // This keeps tap matching in-order and prevents late hits from consuming later notes.
        while (rchalState.nextTapIdx < taps.length) {
            const pending = taps[rchalState.nextTapIdx];
            if (elapsed <= pending.absTimeMs + winMs) break;
            pending.consumed = true;
            pending.hit = false;
            rchalState.counts.miss++;
            rchalState.combo = 0;
            rchalState.hp = Math.max(0, rchalState.hp - lvl.hpLoss);
            _rchalDrawHP();
            _rchalShowJudgment('MISS', 'miss');
            audio.playHit('miss');
            document.getElementById('rchalCombo').textContent = '';
            const missMap = rchalState.noteMap && rchalState.noteMap[pending.idx];
            if (missMap && missMap.el) {
                _vfColorNote(missMap.el, '#EF4444', 0.5);
                if (missMap.beamEl) _vfColorNote(missMap.beamEl, '#EF4444', 0.5);
            }
            rchalState.nextTapIdx++;
            if (rchalState.hp <= 0) { _rchalFinish(); return; }
        }

        let best = null;
        let bestDiff = Infinity;
        if (rchalState.nextTapIdx < taps.length) {
            const pending = taps[rchalState.nextTapIdx];
            const diff = elapsed - pending.absTimeMs;
            if (diff >= -winMs && diff <= winMs) {
                best = pending;
                bestDiff = Math.abs(diff);
            }
        }

        if (!best) {
            // Wrong tap: detect rest zone or generic wrong
            let isRestTap = false;
            let restZoneIdx = -1;
            const restTolerance = winMs * 0.6;
            for (let i = 0; i < rchalState.restZones.length; i++) {
                const rz = rchalState.restZones[i];
                if (elapsed >= rz.startMs - restTolerance && elapsed <= rz.endMs + restTolerance) {
                    isRestTap = true; restZoneIdx = rz.idx; break;
                }
            }
            rchalState.counts.wrong++;
            rchalState.combo = 0;
            document.getElementById('rchalCombo').textContent = '';
            const penalty = Math.ceil(lvl.hpLoss / 2);
            rchalState.hp = Math.max(0, rchalState.hp - penalty);
            _rchalDrawHP();
            if (isRestTap) {
                _rchalShowJudgment('休止符！✗', 'wrong');
                const rm = rchalState.restNoteMap && rchalState.restNoteMap[restZoneIdx];
                if (rm && rm.el) _vfColorNote(rm.el, '#EF4444', 0.7);
            } else {
                _rchalShowJudgment('禁錯！✗', 'wrong');
            }
            audio.playHit('wrong');
            const track = document.getElementById('rchalTrack');
            const float = document.createElement('div');
            float.className = 'rchal-score-float wrong';
            float.textContent = `\u2212${penalty} HP`;
            track.appendChild(float);
            setTimeout(() => float.remove(), 700);
            _rchalScreenShake();
            if (rchalState.hp <= 0) { _rchalFinish(); }
            return;
        }

        best.consumed = true;
        best.hit = true;
        if (best.idx === rchalState.nextTapIdx) rchalState.nextTapIdx++;
        const ratio = bestDiff / winMs;
        let judgment, jClass, points;
        if (ratio < 0.25) { judgment = 'PERFECT ✦'; jClass = 'perfect'; points = 300; }
        else if (ratio < 0.5) { judgment = 'GREAT'; jClass = 'great'; points = 200; }
        else { judgment = 'GOOD'; jClass = 'good'; points = 100; }

        rchalState.combo++;
        if (rchalState.combo > rchalState.maxCombo) rchalState.maxCombo = rchalState.combo;
        const mul = rchalState.combo >= 30 ? 4 : rchalState.combo >= 20 ? 3 : rchalState.combo >= 10 ? 2 : 1;
        const earned = points * mul;
        rchalState.score += earned;
        rchalState.counts[jClass]++;

        audio.playHit(jClass);

        // HP recovery
        if (jClass === 'perfect') rchalState.hp = Math.min(100, rchalState.hp + 5);
        else if (jClass === 'great') rchalState.hp = Math.min(100, rchalState.hp + 2);
        _rchalDrawHP();

        // Animated score counter
        const scoreEl = document.getElementById('rchalScore');
        scoreEl.textContent = rchalState.score;
        scoreEl.classList.add('rchal-score-pop');
        setTimeout(() => scoreEl.classList.remove('rchal-score-pop'), 200);

        _rchalShowJudgment(judgment, jClass);

        // Combo display with milestone effects
        const comboEl = document.getElementById('rchalCombo');
        if (rchalState.combo >= 2) {
            comboEl.textContent = `🔥 ${rchalState.combo} COMBO` + (mul > 1 ? ` ×${mul}` : '');
            comboEl.classList.add('rchal-combo-pop');
            setTimeout(() => comboEl.classList.remove('rchal-combo-pop'), 200);
        }

        // Screen flash on perfect
        if (jClass === 'perfect') {
            const container = document.getElementById('screen-rc-grade');
            container.classList.add('rchal-perfect-flash');
            setTimeout(() => container.classList.remove('rchal-perfect-flash'), 300);
        }

        // Mark note as hit (VexFlow SVG) with glow
        const nm = rchalState.noteMap && rchalState.noteMap[best.idx];
        if (nm && nm.el) {
            const color = jClass === 'perfect' ? '#10B981' : jClass === 'great' ? '#6366F1' : '#F59E0B';
            _vfColorNote(nm.el, color);
            if (nm.beamEl) _vfColorNote(nm.beamEl, color);
        }

        // Score float — position near the note's row
        const track = document.getElementById('rchalTrack');
        const float = document.createElement('div');
        float.className = 'rchal-score-float ' + jClass;
        float.textContent = `+${earned}`;
        if (nm && nm.row !== undefined && rchalState.rowRanges[nm.row]) {
            float.style.top = rchalState.rowRanges[nm.row].y + 'px';
        }
        track.appendChild(float);
        setTimeout(() => float.remove(), 700);
    }

    /* ── Screen shake for wrong taps ── */
    function _rchalScreenShake() {
        const track = document.getElementById('rchalTrack');
        if (!track) return;
        track.style.transition = 'transform 0.06s';
        track.style.transform = 'translateX(4px)';
        setTimeout(() => { track.style.transform = 'translateX(-4px)'; }, 60);
        setTimeout(() => { track.style.transform = ''; track.style.transition = ''; }, 120);
    }

    /* ── Helpers ── */
    function _rchalDrawHP() {
        const fill = document.getElementById('rchalHpFill');
        if (!fill) return;
        const pct = Math.max(0, rchalState.hp);
        fill.style.width = pct + '%';
        fill.className = 'rchal-hp-fill' + (pct > 50 ? '' : pct > 25 ? ' warn' : ' danger');
    }

    function _rchalShowJudgment(text, cls) {
        const el = document.getElementById('rchalJudgment');
        if (!el) return;
        // Reset animation by removing then re-adding class
        el.classList.remove('show');
        el.offsetHeight; // force reflow
        el.textContent = text;
        el.className = 'rchal-judgment show ' + cls;
        clearTimeout(rchalState._judgmentTimer);
        rchalState._judgmentTimer = setTimeout(() => el.classList.remove('show'), 500);
    }

    /* ── Finish ── */
    function _rchalFinish() {
        if (rchalState.phase === 'done') return;
        rchalState.phase = 'done';
        _rchalCleanup();
        const tapEl = document.getElementById('rchalTap');
        if (tapEl) { tapEl.style.opacity = '0.3'; tapEl.style.pointerEvents = 'none'; }

        const total = rchalState.taps.length || 1;
        const hitCount = rchalState.counts.perfect + rchalState.counts.great + rchalState.counts.good;
        const accuracy = Math.round(hitCount / total * 100);

        let stars = 0;
        if (accuracy >= 90 && rchalState.counts.miss <= 2) stars = 3;
        else if (accuracy >= 70) stars = 2;
        else if (accuracy >= 40) stars = 1;

        _rchalSetStars(rchalState.level.id, stars);

        // Save to leaderboard
        if (rchalState.user && rchalState.user.name) {
            saveLocalRank('rchal', rchalState.user, rchalState.score, accuracy, rchalState.maxCombo, 'Lv.' + rchalState.level.id);
            submitScoreToGAS('game2', rchalState.user, rchalState.score, accuracy, rchalState.maxCombo, '節奏挑戰·Lv.' + rchalState.level.id);
        }

        // Record to profile
        if (rchalState.user) {
            recordGameResult(rchalState.user, 'game2', rchalState.score, accuracy, rchalState.maxCombo, null, rchalState.counts);
        }

        let grade, gradeColor;
        if (accuracy >= 95) { grade = 'S'; gradeColor = '#F59E0B'; }
        else if (accuracy >= 85) { grade = 'A'; gradeColor = '#10B981'; }
        else if (accuracy >= 70) { grade = 'B'; gradeColor = '#3B82F6'; }
        else if (accuracy >= 50) { grade = 'C'; gradeColor = '#8B5CF6'; }
        else { grade = 'D'; gradeColor = '#EF4444'; }

        let msg;
        if (stars >= 3) msg = '準確完成。';
        else if (stars >= 2) msg = '很棒！再接再厲！✨';
        else if (stars >= 1) msg = '請繼續練習。';
        else msg = '請再作練習，以提升準確度。';

        const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
        const hpMsg = rchalState.hp <= 0 ? '💔 HP 歸零！' : `❤️ HP ${Math.round(rchalState.hp)}%`;

        // Show result after short delay
        setTimeout(() => {
            const container = document.getElementById('screen-rc-grade');
            container.innerHTML = `
                <div class="rchal-header">
                    <button class="rchal-exit" id="rchalExitBtn">✕</button>
                    <div class="rchal-header-center">
                        <div class="rchal-title">Lv.${rchalState.level.id} ${rchalState.level.name}</div>
                        <div class="rchal-meta">結果</div>
                    </div>
                    <div style="width:36px"></div>
                </div>
                <div class="rchal-result">
                    <div class="rchal-result-stars">${starStr}</div>
                    <div class="rchal-result-grade" style="color:${gradeColor}">${grade}</div>
                    <div class="rchal-result-score">${rchalState.score} 分</div>
                    <div class="rchal-result-stats">
                        <div class="rchal-stat perfect"><div class="rchal-stat-val">${rchalState.counts.perfect}</div><div class="rchal-stat-label">PERFECT</div></div>
                        <div class="rchal-stat great"><div class="rchal-stat-val">${rchalState.counts.great}</div><div class="rchal-stat-label">GREAT</div></div>
                        <div class="rchal-stat good"><div class="rchal-stat-val">${rchalState.counts.good}</div><div class="rchal-stat-label">GOOD</div></div>
                        <div class="rchal-stat miss"><div class="rchal-stat-val">${rchalState.counts.miss}</div><div class="rchal-stat-label">MISS</div></div>
                        <div class="rchal-stat wrong"><div class="rchal-stat-val">${rchalState.counts.wrong}</div><div class="rchal-stat-label">WRONG</div></div>
                    </div>
                    <div class="rchal-result-detail">準確度 ${accuracy}%　·　最高連擊 ${rchalState.maxCombo}　·　禁錯 ${rchalState.counts.wrong}</div>
                    <div class="rchal-result-detail">${hpMsg}</div>
                    <div class="rchal-result-msg">${msg}</div>
                    <div class="rchal-result-btns">
                        <button class="rchal-btn-retry" id="rchalRetry">🔄 再試一次</button>
                        <button class="rchal-btn-back" id="rchalBackToLevels">📋 選擇關卡</button>
                    </div>
                </div>
            `;
            document.getElementById('rchalExitBtn').onclick = () => _rchalShowSelect();
            document.getElementById('rchalRetry').onclick = () => _rchalStartLevel(rchalState.level);
            document.getElementById('rchalBackToLevels').onclick = () => _rchalShowSelect();
        }, 600);
    }

    // ══════════════════════════════════════════
    // ⏱️ 1分鐘挑戰 — Note Value Fill-in Game
    // ══════════════════════════════════════════
    const omState = {
        user: null, score: 0, correct: 0, wrong: 0, total: 0,
        timer: null, startTime: 0, duration: 60000,
        currentAnswer: null, locked: false
    };

    // Note value options: duration in quarter-note beats
    const OM_NOTE_OPTIONS = [
        { id: 'whole', beats: 4, label: '全音符',  vfDur: 'w' },
        { id: 'half',  beats: 2, label: '二分音符', vfDur: 'h' },
        { id: 'dotted-quarter', beats: 1.5, label: '附點四分', vfDur: 'q', dotted: true },
        { id: 'quarter', beats: 1, label: '四分音符', vfDur: 'q' },
        { id: 'eighth', beats: 0.5, label: '八分音符', vfDur: '8' },
        { id: '16th', beats: 0.25, label: '十六分音符', vfDur: '16' },
    ];

    // Note types that must only start on an integer beat position
    const _OM_INTEGER_BEAT_ONLY = new Set(['whole', 'half', 'dotted-quarter']);

    // Generate a random measure for a given time signature
    function _omGenerateMeasure(totalBeats) {
        const pool = OM_NOTE_OPTIONS.filter(n => n.beats <= totalBeats);
        let remaining = totalBeats;
        let pos = 0;
        const notes = [];
        let safety = 0;
        while (remaining > 0.001 && safety++ < 50) {
            const onBeat = Math.abs(pos - Math.round(pos)) < 0.01;
            let eligible = pool.filter(n => n.beats <= remaining + 0.001);
            if (!onBeat) eligible = eligible.filter(n => !_OM_INTEGER_BEAT_ONLY.has(n.id));
            if (!eligible.length) break;
            const pick = eligible[Math.floor(Math.random() * eligible.length)];
            notes.push({ ...pick });
            pos = Math.round((pos + pick.beats) * 1000) / 1000;
            remaining = Math.round((remaining - pick.beats) * 1000) / 1000;
        }
        // Must have at least 2 notes to blank one
        if (notes.length < 2) return _omGenerateMeasure(totalBeats);
        return notes;
    }

    // Render a measure with one note blanked, return the blanked note's info
    function _omRenderQuestion(container, timeSig, notes, blankIdx) {
        container.innerHTML = '';
        if (typeof VexFlow === 'undefined') return;
        requestAnimationFrame(() => {
            // Defer to after layout so clientWidth reflects the visible container size
            const { Renderer, Stave, StaveNote, Voice, Formatter, Stem, Dot } = VexFlow;

            const rawW = container.clientWidth || 340;
            const W = Math.min(rawW, 460);
            const H = 100;
            const renderer = new Renderer(container, Renderer.Backends.SVG);
            renderer.resize(W, H);
            const context = renderer.getContext();

            const stave = new Stave(0, 0, W - 4);
            stave.addClef('percussion');
            stave.addTimeSignature(timeSig);
            stave.setContext(context).draw();

            const durMap = { 4: 'w', 2: 'h', 1.5: 'q', 1: 'q', 0.5: '8', 0.25: '16' };
            const dotBeats = new Set([1.5]);
            const { Beam } = VexFlow;
            const beamGroups = [];
            const vfNotes = [];
            let eighthRun = [];
            const flushRun = () => {
                if (eighthRun.length > 1) beamGroups.push(eighthRun.slice());
                eighthRun = [];
            };

            notes.forEach((n, i) => {
                const dur = durMap[n.beats] || 'q';
                if (i === blankIdx) {
                    flushRun(); // break beam before blank note
                    const note = new StaveNote({ keys: ['b/4'], duration: dur, stemDirection: Stem.UP });
                    if (dotBeats.has(n.beats)) Dot.buildAndAttach([note], { all: true });
                    note.setStyle({ fillStyle: 'transparent', strokeStyle: 'transparent' });
                    note.setStemStyle({ fillStyle: 'transparent', strokeStyle: 'transparent' });
                    if (note.flag) note.flag.setStyle({ fillStyle: 'transparent', strokeStyle: 'transparent' });
                    vfNotes.push(note);
                    // blank note is NOT added to eighthRun — beam is broken after it too
                } else {
                    const note = new StaveNote({ keys: ['b/4'], duration: dur, stemDirection: Stem.UP });
                    if (dotBeats.has(n.beats)) Dot.buildAndAttach([note], { all: true });
                    vfNotes.push(note);
                    if (n.beats < 1) {
                        eighthRun.push(note);
                    } else {
                        flushRun();
                    }
                }
            });
            flushRun();

            const [num] = timeSig.split('/').map(Number);
            const voice = new Voice({ numBeats: num, beatValue: 4 });
            voice.setMode(2);
            voice.addTickables(vfNotes);
            const nsx = stave.getNoteStartX();
            new Formatter().joinVoices([voice]).format([voice], W - nsx - 20);
            const beams = [];
            beamGroups.forEach(g => {
                if (g.length < 2) return;
                try {
                    const b = new Beam(g, false);
                    if (b.renderOptions) b.renderOptions.beamWidth = 3.5;
                    b.setContext(context);
                    beams.push(b);
                } catch (e) { /* ignore */ }
            });
            voice.draw(context, stave);
            beams.forEach(b => { try { b.draw(); } catch (e) { /* ignore */ } });

            // Draw blank placeholder over the hidden note
            const blankNote = vfNotes[blankIdx];
            const bb = blankNote.getBoundingBox();
            if (bb) {
                const svg = container.querySelector('svg');
                const ns = 'http://www.w3.org/2000/svg';
                const rect = document.createElementNS(ns, 'rect');
                const pad = 6;
                rect.setAttribute('x', bb.x - pad);
                rect.setAttribute('y', bb.y - pad);
                rect.setAttribute('width', bb.w + pad * 2);
                rect.setAttribute('height', bb.h + pad * 2);
                rect.setAttribute('class', 'om-blank-rect');
                svg.appendChild(rect);

                // Question mark inside
                const txt = document.createElementNS(ns, 'text');
                txt.setAttribute('x', bb.x + bb.w / 2);
                txt.setAttribute('y', bb.y + bb.h / 2 + 5);
                txt.setAttribute('text-anchor', 'middle');
                txt.setAttribute('font-size', '18');
                txt.setAttribute('font-weight', '900');
                txt.setAttribute('fill', '#6366f1');
                txt.textContent = '？';
                svg.appendChild(txt);
            }
        });
    }

    // Render a small SVG note icon for option buttons
    function _omRenderNoteIcon(duration, dotted) {
        if (typeof VexFlow === 'undefined') return '';
        const { Renderer, Stave, StaveNote, Voice, Formatter, Stem, Dot } = VexFlow;
        const BarlineType = VexFlow.BarlineType || (VexFlow.Barline && VexFlow.Barline.type);

        const isRest = /r$/i.test(String(duration));
        const dStr = String(duration);
        const iconH = isRest && dStr === '16r' ? 96 : isRest ? 90 : 88;
        const staveY = isRest && dStr === '16r' ? 28 : isRest ? 24 : 6;

        const div = document.createElement('div');
        div.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:76px;height:' + iconH + 'px;';
        document.body.appendChild(div);

        const renderer = new Renderer(div, Renderer.Backends.SVG);
        renderer.resize(76, iconH);
        const context = renderer.getContext();

        const stave = new Stave(-14, staveY, 100);
        [0, 1, 2, 3, 4].forEach(line => stave.setConfigForLine(line, { visible: false }));
        if (BarlineType) {
            try {
                stave.setBegBarType(BarlineType.NONE);
                stave.setEndBarType(BarlineType.NONE);
            } catch (e) { /* ignore */ }
        }
        stave.setContext(context).draw();

        const noteStruct = { keys: [isRest ? 'b/4' : 'c/5'], duration };
        if (!isRest) noteStruct.stemDirection = Stem.DOWN;
        const note = new StaveNote(noteStruct);
        if (dotted) Dot.buildAndAttach([note], { all: true });
        if (isRest) {
            try {
                note.setStyle({ fillStyle: '#242424', strokeStyle: '#242424' });
            } catch (e) { /* ignore */ }
        }
        const voice = new Voice({ numBeats: 4, beatValue: 4 });
        voice.setMode(2);
        voice.addTickables([note]);
        new Formatter().joinVoices([voice]).format([voice], 56);
        voice.draw(context, stave);

        const svgEl = div.querySelector('svg');
        const svgHTML = svgEl ? svgEl.outerHTML : '';
        document.body.removeChild(div);
        return svgHTML;
    }

    function _omNextQuestion() {
        if (omState.locked) return;
        // Random time signature
        const timeSigs = ['2/4', '3/4', '4/4'];
        const timeSig = timeSigs[Math.floor(Math.random() * timeSigs.length)];
        const totalBeats = parseInt(timeSig);

        const notes = _omGenerateMeasure(totalBeats);
        const blankIdx = Math.floor(Math.random() * notes.length);
        omState.currentAnswer = notes[blankIdx];
        omState.total++;

        // Update time signature display
        const tsEl = document.getElementById('omTimeSig');
        if (tsEl) tsEl.textContent = timeSig;

        // Update question number
        const qnEl = document.getElementById('omQNum');
        if (qnEl) qnEl.textContent = `第 ${omState.total} 題`;

        // Render
        const wrap = document.getElementById('omStaffWrap');
        if (wrap) _omRenderQuestion(wrap, timeSig, notes, blankIdx);

        // Reset option states
        document.querySelectorAll('.om-opt-btn').forEach(b => {
            b.classList.remove('correct', 'wrong');
            b.disabled = false;
        });

        // Clear feedback
        const fb = document.getElementById('omFeedback');
        if (fb) { fb.className = 'om-feedback-text'; fb.textContent = ''; }
    }

    function _omHandleAnswer(optId) {
        if (omState.locked || !omState.currentAnswer) return;
        omState.locked = true;

        const isCorrect = optId === omState.currentAnswer.id;
        const fb = document.getElementById('omFeedback');

        // Highlight buttons
        document.querySelectorAll('.om-opt-btn').forEach(b => {
            b.disabled = true;
            if (b.dataset.id === omState.currentAnswer.id) {
                b.classList.add('correct');
            } else if (b.dataset.id === optId && !isCorrect) {
                b.classList.add('wrong');
            }
        });

        if (isCorrect) {
            omState.correct++;
            omState.score += 10;
            audio.playAnswer(true);
            if (fb) { fb.textContent = '✓ 回答正確。'; fb.className = 'om-feedback-text show correct'; }
            const scoreEl = document.getElementById('omScore');
            if (scoreEl) scoreEl.textContent = omState.score;
            // Float +10
            const floater = document.createElement('div');
            floater.className = 'om-score-float';
            floater.textContent = '+10';
            document.querySelector('.om-header').appendChild(floater);
            setTimeout(() => floater.remove(), 750);
        } else {
            omState.wrong++;
            audio.playAnswer(false);
            if (fb) { fb.textContent = '✗ 答錯了'; fb.className = 'om-feedback-text show wrong'; }
        }

        // Next question after brief delay
        setTimeout(() => {
            omState.locked = false;
            if (omState.timer) _omNextQuestion();
        }, 600);
    }

    function _omStartTimer() {
        omState.startTime = performance.now();
        const fill = document.getElementById('omTimerFill');
        const timeText = document.getElementById('omTimeLeft');

        function tick() {
            const elapsed = performance.now() - omState.startTime;
            const remaining = Math.max(0, omState.duration - elapsed);
            const pct = (remaining / omState.duration) * 100;
            if (fill) {
                fill.style.width = pct + '%';
                fill.classList.toggle('warn', pct < 40 && pct >= 15);
                fill.classList.toggle('danger', pct < 15);
            }
            if (timeText) timeText.textContent = Math.ceil(remaining / 1000) + 's';

            if (remaining <= 0) {
                _omEndGame();
                return;
            }
            omState.timer = requestAnimationFrame(tick);
        }
        omState.timer = requestAnimationFrame(tick);
    }

    function _omEndGame() {
        if (omState.timer) { cancelAnimationFrame(omState.timer); omState.timer = null; }
        omState.locked = true;

        // Disable option buttons
        document.querySelectorAll('.om-opt-btn').forEach(b => b.disabled = true);

        const container = document.getElementById('screen-rc-1min');
        const resultDiv = document.createElement('div');
        resultDiv.className = 'om-result';
        const emoji = omState.score >= 80 ? '🏆' : omState.score >= 50 ? '⭐' : '💪';
        const accuracy = omState.total > 0 ? Math.round((omState.correct / omState.total) * 100) : 0;

        // Submit to leaderboard
        if (omState.user && omState.user.name) {
            saveLocalRank('game2', omState.user, omState.score, accuracy, omState.correct, '1分鐘挑戰');
            submitScoreToGAS('game2', omState.user, omState.score, accuracy, omState.correct, '1分鐘挑戰');
        }

        resultDiv.innerHTML = `
            <div class="om-result-emoji">${emoji}</div>
            <div class="om-result-title">挑戰結束！</div>
            <div class="om-result-score">${omState.score}</div>
            <div class="om-result-label">最終得分</div>
            <div class="om-result-stats">
                <div class="om-result-stat"><div class="val">${omState.total}</div><div class="lbl">作答</div></div>
                <div class="om-result-stat"><div class="val" style="color:var(--primary-green-dark)">${omState.correct}</div><div class="lbl">答對</div></div>
                <div class="om-result-stat"><div class="val" style="color:var(--primary-red)">${omState.wrong}</div><div class="lbl">答錯</div></div>
            </div>
            <div class="om-result-btns">
                <button class="om-btn-retry" id="omRetry">🔄 再次練習</button>
                <button class="om-btn-ranks" id="omViewRanks">🏆 查看排行榜</button>
                <button class="om-btn-back" id="omBack">← 返回</button>
            </div>
        `;
        container.appendChild(resultDiv);
        document.getElementById('omRetry').onclick = () => _omLaunch(omState.user);
        document.getElementById('omViewRanks').onclick = () => {
            dom.leaderboardLayout.classList.add('view-only');
            dom.reportGrid.innerHTML = ''; dom.reportWeakness.innerHTML = '';
            const gf = document.getElementById('rankGameFilter');
            if (gf) { gf.value = 'game2'; gf.dispatchEvent(new Event('change')); }
            if (dom.rankGradeFilter && omState.user) dom.rankGradeFilter.value = String(omState.user.grade || 0);
            if (dom.rankClassFilter && omState.user) dom.rankClassFilter.value = String(omState.user.class || '0');
            loadRanks();
            switchScreen('screen-leaderboard');
        };
        document.getElementById('omBack').onclick = () => {
            resultDiv.remove();
            switchScreen('screen-g2-setup');
        };
    }

    function _omCleanup() {
        if (omState.timer) { cancelAnimationFrame(omState.timer); omState.timer = null; }
        omState.score = 0; omState.correct = 0; omState.wrong = 0;
        omState.total = 0; omState.currentAnswer = null; omState.locked = false;
    }

    // ══════════════════════════════════════════
    // 🎵 時值辨別 — Duration Recognition Game
    // ══════════════════════════════════════════
    const DUR_QUESTIONS = [
        { id: 'whole',       label: '全音符',       img: 'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p02.png', beats: 4,    isRest: false },
        { id: 'dot-half',    label: '附點二分音符', img: 'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p03.png', beats: 3,    isRest: false },
        { id: 'half',        label: '二分音符',     img: 'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p04.png', beats: 2,    isRest: false },
        { id: 'dot-quarter', label: '附點四分音符', img: 'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p05.png', beats: 1.5,  isRest: false },
        { id: 'quarter',     label: '四分音符',     img: 'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p06.png', beats: 1,    isRest: false },
        { id: 'dot-eighth',  label: '附點八分音符', img: 'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p07.png', beats: 0.75, isRest: false },
        { id: 'eighth',      label: '八分音符',     img: 'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p08.png', beats: 0.5,  isRest: false },
        { id: '16th',        label: '十六分音符',   img: 'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p09.png', beats: 0.25, isRest: false },
        { id: 'whole-r',     label: '全休止符',     img: 'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p18.png', beats: 4,    isRest: true },
        { id: 'half-r',      label: '二分休止符',   img: 'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p19.png', beats: 2,    isRest: true },
        { id: 'quarter-r',   label: '四分休止符',   img: 'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p20.png', beats: 1,    isRest: true },
        { id: 'eighth-r',    label: '八分休止符',   img: 'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p21.png', beats: 0.5,  isRest: true },
        { id: 'dot-quarter-r', label: '附點四分休止符', img: 'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p22.png', beats: 1.5, isRest: true },
    ];

    const durState = {
        user: null, score: 0, correct: 0, wrong: 0, total: 0,
        timer: null, startTime: 0, duration: 60000,
        currentQuestion: null, locked: false
    };

    function _durCleanup() {
        if (durState.timer) { cancelAnimationFrame(durState.timer); durState.timer = null; }
        durState.score = 0; durState.correct = 0; durState.wrong = 0;
        durState.total = 0; durState.currentQuestion = null; durState.locked = false;
    }

    function _durLaunch(user) {
        _durCleanup();
        durState.user = user;
        const container = document.getElementById('screen-g2-duration');

        container.innerHTML = `
            <div class="om-header">
                <button class="om-exit" id="durExitBtn">✕</button>
                <div class="om-header-center">
                    <div class="om-title">🎵 時值辨別</div>
                    <span class="om-time-left" id="durTimeLeft">60s</span>
                </div>
                <div class="om-score-wrap">
                    <div class="om-score-val" id="durScore">0</div>
                    <div class="om-score-label">得分</div>
                </div>
            </div>
            <div class="om-timer-wrap"><div class="om-timer-fill" id="durTimerFill"></div></div>
            <div class="om-qnum" id="durQNum" style="display:none;"></div>
            <div class="dur-img-wrap" id="durImgWrap" style="display:none;">
                <img id="durQuestionImg" src="" alt="音符/休止符">
            </div>
            <div class="om-feedback" id="durFeedbackWrap" style="display:none;"><div class="om-feedback-text" id="durFeedback"></div></div>
            <div class="om-prompt" id="durPrompt" style="display:none;">這是什麼音符/休止符？</div>
            <div class="dur-options-wrap" id="durOptions" style="display:none;"></div>
            <div class="dur-pregame" id="durPregame">
                <div class="dur-ref-mini">
                    <div class="dur-ref-mini-section">
                        <div class="dur-ref-heading">🎶 音符</div>
                        <div class="dur-ref-mini-list">
                            <div class="dur-ref-mini-row"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p02.png" alt="全音符"><span>全音符</span><b>4拍</b></div>
                            <div class="dur-ref-mini-row"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p03.png" alt="附點二分音符"><span>附點二分</span><b>3拍</b></div>
                            <div class="dur-ref-mini-row"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p04.png" alt="二分音符"><span>二分音符</span><b>2拍</b></div>
                            <div class="dur-ref-mini-row"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p05.png" alt="附點四分音符"><span>附點四分</span><b>1.5拍</b></div>
                            <div class="dur-ref-mini-row"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p06.png" alt="四分音符"><span>四分音符</span><b>1拍</b></div>
                            <div class="dur-ref-mini-row"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p07.png" alt="附點八分音符"><span>附點八分</span><b>¾拍</b></div>
                            <div class="dur-ref-mini-row"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p08.png" alt="八分音符"><span>八分音符</span><b>½拍</b></div>
                            <div class="dur-ref-mini-row"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p09.png" alt="十六分音符"><span>十六分</span><b>¼拍</b></div>
                        </div>
                    </div>
                    <div class="dur-ref-mini-section">
                        <div class="dur-ref-heading">🤫 休止符</div>
                        <div class="dur-ref-mini-list">
                            <div class="dur-ref-mini-row"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p18.png" alt="全休止符"><span>全休止符</span><b>4拍</b></div>
                            <div class="dur-ref-mini-row"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p19.png" alt="二分休止符"><span>二分休止</span><b>2拍</b></div>
                            <div class="dur-ref-mini-row"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p20.png" alt="四分休止符"><span>四分休止</span><b>1拍</b></div>
                            <div class="dur-ref-mini-row"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p21.png" alt="八分休止符"><span>八分休止</span><b>½拍</b></div>
                            <div class="dur-ref-mini-row"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rhythm-p22.png" alt="附點四分休止符"><span>附點四分休止</span><b>1.5拍</b></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="om-status" id="durStatus">準備好就按「開始」！</div>
            <button class="om-start-btn" id="durStartBtn">⏱️ 開始！</button>
        `;

        switchScreen('screen-g2-duration');

        document.getElementById('durExitBtn').onclick = () => {
            _durCleanup();
            switchScreen('screen-g2-setup');
        };

        document.getElementById('durStartBtn').onclick = () => {
            document.getElementById('durStartBtn').style.display = 'none';
            document.getElementById('durStatus').textContent = '';
            _durCountdown(() => {
                document.getElementById('durPregame').style.display = 'none';
                document.getElementById('durQNum').style.display = '';
                document.getElementById('durImgWrap').style.display = '';
                document.getElementById('durFeedbackWrap').style.display = '';
                document.getElementById('durPrompt').style.display = '';
                document.getElementById('durOptions').style.display = '';
                _durStartTimer();
                _durNextQuestion();
            });
        };
    }

    function _durCountdown(cb) {
        const container = document.getElementById('screen-g2-duration');
        let count = 3;
        const overlay = document.createElement('div');
        overlay.className = 'om-countdown';
        overlay.textContent = count;
        container.appendChild(overlay);

        const iv = setInterval(() => {
            count--;
            if (count <= 0) {
                clearInterval(iv);
                overlay.remove();
                cb();
            } else {
                overlay.textContent = count;
                overlay.style.animation = 'none';
                overlay.offsetHeight;
                overlay.style.animation = 'omPulse 0.6s ease';
            }
        }, 700);
    }

    function _durNextQuestion() {
        if (durState.locked) return;

        // Pick random question
        const q = DUR_QUESTIONS[Math.floor(Math.random() * DUR_QUESTIONS.length)];
        durState.currentQuestion = q;
        durState.total++;

        // Update question number
        const qnEl = document.getElementById('durQNum');
        if (qnEl) qnEl.textContent = `第 ${durState.total} 題`;

        // Display image
        const img = document.getElementById('durQuestionImg');
        if (img) img.src = q.img;

        // Generate 8 options: notes (left) + rests (right), 4 each
        // Always include the correct answer in its category
        const notePool = DUR_QUESTIONS.filter(d => !d.isRest);
        const restPool = DUR_QUESTIONS.filter(d => d.isRest);

        let noteOpts, restOpts;
        if (q.isRest) {
            // Correct is a rest — ensure it's in restOpts
            const restDistractors = restPool.filter(d => d.id !== q.id);
            _shuffleArr(restDistractors);
            restOpts = [q, ...restDistractors.slice(0, 3)];
            _shuffleArr(notePool);
            noteOpts = notePool.slice(0, 4);
        } else {
            // Correct is a note — ensure it's in noteOpts
            const noteDistractors = notePool.filter(d => d.id !== q.id);
            _shuffleArr(noteDistractors);
            noteOpts = [q, ...noteDistractors.slice(0, 3)];
            _shuffleArr(restPool);
            restOpts = restPool.slice(0, 4);
        }
        _shuffleArr(noteOpts);
        _shuffleArr(restOpts);

        const optContainer = document.getElementById('durOptions');
        optContainer.innerHTML = `
            <div class="dur-col">
                <div class="dur-col-label">🎶 音符</div>
                ${noteOpts.map(o => `<button class="dur-opt-btn" data-id="${o.id}">${o.label}</button>`).join('')}
            </div>
            <div class="dur-col">
                <div class="dur-col-label">🤫 休止符</div>
                ${restOpts.map(o => `<button class="dur-opt-btn" data-id="${o.id}">${o.label}</button>`).join('')}
            </div>
        `;

        // Bind clicks
        optContainer.querySelectorAll('.dur-opt-btn').forEach(btn => {
            btn.onclick = () => _durHandleAnswer(btn.dataset.id);
        });

        // Clear feedback
        const fb = document.getElementById('durFeedback');
        if (fb) { fb.className = 'om-feedback-text'; fb.textContent = ''; }
    }

    function _shuffleArr(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function _durHandleAnswer(optId) {
        if (durState.locked || !durState.currentQuestion) return;
        durState.locked = true;

        const correctId = durState.currentQuestion.id;
        const isCorrect = optId === correctId;
        const fb = document.getElementById('durFeedback');

        // Highlight buttons
        document.querySelectorAll('.dur-opt-btn').forEach(b => {
            b.disabled = true;
            if (b.dataset.id === correctId) {
                b.classList.add('correct');
            } else if (b.dataset.id === optId && !isCorrect) {
                b.classList.add('wrong');
            }
        });

        if (isCorrect) {
            durState.correct++;
            durState.score += 100;
            if (fb) { fb.textContent = '✓ 回答正確。'; fb.className = 'om-feedback-text show correct'; }
            const scoreEl = document.getElementById('durScore');
            if (scoreEl) scoreEl.textContent = durState.score;
            // Float +100
            const floater = document.createElement('div');
            floater.className = 'om-score-float';
            floater.textContent = '+100';
            document.querySelector('#screen-g2-duration .om-header').appendChild(floater);
            setTimeout(() => floater.remove(), 750);
        } else {
            durState.wrong++;
            if (fb) { fb.textContent = '✗ 答錯了'; fb.className = 'om-feedback-text show wrong'; }
        }

        // Next question after brief delay
        setTimeout(() => {
            durState.locked = false;
            if (durState.timer) _durNextQuestion();
        }, 600);
    }

    function _durStartTimer() {
        durState.startTime = performance.now();
        const fill = document.getElementById('durTimerFill');
        const timeText = document.getElementById('durTimeLeft');

        function tick() {
            const elapsed = performance.now() - durState.startTime;
            const remaining = Math.max(0, durState.duration - elapsed);
            const pct = (remaining / durState.duration) * 100;
            if (fill) {
                fill.style.width = pct + '%';
                fill.classList.toggle('warn', pct < 40 && pct >= 15);
                fill.classList.toggle('danger', pct < 15);
            }
            if (timeText) timeText.textContent = Math.ceil(remaining / 1000) + 's';

            if (remaining <= 0) {
                _durEndGame();
                return;
            }
            durState.timer = requestAnimationFrame(tick);
        }
        durState.timer = requestAnimationFrame(tick);
    }

    function _durEndGame() {
        if (durState.timer) { cancelAnimationFrame(durState.timer); durState.timer = null; }
        durState.locked = true;

        // Disable option buttons
        document.querySelectorAll('.dur-opt-btn').forEach(b => b.disabled = true);

        const container = document.getElementById('screen-g2-duration');
        const resultDiv = document.createElement('div');
        resultDiv.className = 'om-result';
        const emoji = durState.score >= 800 ? '🏆' : durState.score >= 500 ? '⭐' : '💪';
        const accuracy = durState.total > 0 ? Math.round((durState.correct / durState.total) * 100) : 0;

        // Submit to leaderboard
        if (durState.user && durState.user.name) {
            saveLocalRank('game2', durState.user, durState.score, accuracy, durState.correct, '時值辨別');
            submitScoreToGAS('game2', durState.user, durState.score, accuracy, durState.correct, '時值辨別');
        }

        resultDiv.innerHTML = `
            <div class="om-result-emoji">${emoji}</div>
            <div class="om-result-title">挑戰結束！</div>
            <div class="om-result-score">${durState.score}</div>
            <div class="om-result-label">最終得分</div>
            <div class="om-result-stats">
                <div class="om-result-stat"><div class="val">${durState.total}</div><div class="lbl">作答</div></div>
                <div class="om-result-stat"><div class="val" style="color:var(--primary-green-dark)">${durState.correct}</div><div class="lbl">答對</div></div>
                <div class="om-result-stat"><div class="val" style="color:var(--primary-red)">${durState.wrong}</div><div class="lbl">答錯</div></div>
            </div>
            <div class="om-result-btns">
                <button class="om-btn-retry" id="durRetry">🔄 再次練習</button>
                <button class="om-btn-ranks" id="durViewRanks">🏆 查看排行榜</button>
                <button class="om-btn-back" id="durBack">← 返回</button>
            </div>
        `;
        container.appendChild(resultDiv);
        document.getElementById('durRetry').onclick = () => _durLaunch(durState.user);
        document.getElementById('durViewRanks').onclick = () => {
            dom.leaderboardLayout.classList.add('view-only');
            dom.reportGrid.innerHTML = ''; dom.reportWeakness.innerHTML = '';
            const gf = document.getElementById('rankGameFilter');
            if (gf) { gf.value = 'game2'; gf.dispatchEvent(new Event('change')); }
            if (dom.rankGradeFilter && durState.user) dom.rankGradeFilter.value = String(durState.user.grade || 0);
            if (dom.rankClassFilter && durState.user) dom.rankClassFilter.value = String(durState.user.class || '0');
            loadRanks();
            switchScreen('screen-leaderboard');
        };
        document.getElementById('durBack').onclick = () => {
            resultDiv.remove();
            switchScreen('screen-g2-setup');
        };
    }

    function _omLaunch(user) {
        _omCleanup();
        omState.user = user;
        const container = document.getElementById('screen-rc-1min');

        // Pre-render note icons
        const noteIcons = {};
        OM_NOTE_OPTIONS.forEach(opt => { noteIcons[opt.id] = _omRenderNoteIcon(opt.vfDur, opt.dotted); });

        container.innerHTML = `
            <div class="om-header">
                <button class="om-exit" id="omExitBtn">✕</button>
                <div class="om-header-center">
                    <div class="om-title">⏱️ 1分鐘挑戰</div>
                    <span class="om-time-left" id="omTimeLeft">60s</span>
                </div>
                <div class="om-score-wrap">
                    <div class="om-score-val" id="omScore">0</div>
                    <div class="om-score-label">得分</div>
                </div>
            </div>
            <div class="om-timer-wrap"><div class="om-timer-fill" id="omTimerFill"></div></div>
            <div class="om-timesig-row"><span class="om-timesig-badge" id="omTimeSig">4/4</span></div>
            <div class="om-qnum" id="omQNum"></div>
            <div class="om-staff-wrap" id="omStaffWrap"></div>
            <div class="om-feedback"><div class="om-feedback-text" id="omFeedback"></div></div>
            <div class="om-prompt">空位是什麼音符？</div>
            <div class="om-options" id="omOptions">
                ${OM_NOTE_OPTIONS.map(opt => `
                    <button class="om-opt-btn" data-id="${opt.id}">
                        <div class="om-opt-icon">${noteIcons[opt.id]}</div>
                        <div class="om-opt-label">${opt.label}</div>
                    </button>
                `).join('')}
            </div>
            <div class="om-status" id="omStatus">準備好就按「開始」！</div>
            <button class="om-start-btn" id="omStartBtn">⏱️ 開始！</button>
        `;

        switchScreen('screen-rc-1min');

        document.getElementById('omExitBtn').onclick = () => {
            _omCleanup();
            switchScreen('screen-g2-setup');
        };

        // Bind option clicks
        document.querySelectorAll('.om-opt-btn').forEach(btn => {
            btn.onclick = () => _omHandleAnswer(btn.dataset.id);
            btn.disabled = true;
        });

        document.getElementById('omStartBtn').onclick = () => {
            document.getElementById('omStartBtn').style.display = 'none';
            document.getElementById('omStatus').textContent = '';
            // Countdown 3-2-1
            _omCountdown(() => {
                // Enable options and start
                document.querySelectorAll('.om-opt-btn').forEach(b => b.disabled = false);
                _omStartTimer();
                _omNextQuestion();
            });
        };
    }

    function _omCountdown(cb) {
        const container = document.getElementById('screen-rc-1min');
        let count = 3;
        const overlay = document.createElement('div');
        overlay.className = 'om-countdown';
        overlay.textContent = count;
        container.appendChild(overlay);

        const iv = setInterval(() => {
            count--;
            if (count <= 0) {
                clearInterval(iv);
                overlay.remove();
                cb();
            } else {
                overlay.textContent = count;
                overlay.style.animation = 'none';
                overlay.offsetHeight; // reflow
                overlay.style.animation = 'omPulse 0.6s ease';
            }
        }, 700);
    }

    function _rcRenderLevels() {
        const grid = document.getElementById('rcLevelGrid');
        if (!grid) return;

        grid.innerHTML = '';
        const cards = RC_CARDS;
        cards.forEach(card => {
            const num = String(card.num).padStart(2, '0');
            const el = document.createElement('div');
            el.className = 'rc-level-card';
            el.innerHTML = `<div class="rc-level-thumb"><img src="https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/rc-${num}.png" alt="節奏卡 ${card.num}" loading="lazy">${_rcGetGradeBadge(card.num)}<button class="rc-level-preview-btn" title="試聽節奏">▶</button></div>
                <div class="rc-level-copy">
                    <div class="rc-level-num">No.${card.num}</div>
                    <div class="rc-level-diff">${'⭐'.repeat(card.level)}</div>
                </div>`;
            el.querySelector('.rc-level-preview-btn').onclick = (e) => {
                e.stopPropagation();
                _rcPlayLevelPreview(card, e.currentTarget);
            };
            el.onclick = () => _openRCDetail(card, rcGameState._user);
            grid.appendChild(el);
        });
    }

    function _openRCDetail(card, user) {
        audio.bgStop();
        _rcStopPreview();
        _rcRemoveGameKeyHandler();

        // Default BPM based on difficulty level
        const defaultBpm = [75, 70, 65, 60][card.level - 1] || 60;

        rcGameState = {
            ...rcGameState,
            _user: user,
            _card: card,
            _bpm: defaultBpm,
            _previewTimers: [],
        };

        const num = String(card.num).padStart(2, '0');
        document.getElementById('rcDetailImg').src = `img/cards/rc-${num}.png`;
        document.getElementById('rcDetailNum').textContent = `節奏卡 No.${card.num}`;
        document.getElementById('rcDetailDiff').textContent = '⭐'.repeat(card.level);
        document.getElementById('rcDetailLabel').textContent = card.label;
        _rcRenderValueChips(card);

        const kodalyRow = document.getElementById('rcKodalyRow');
        kodalyRow.innerHTML = '';
        card.label.split(' ').forEach(tok => {
            const span = document.createElement('span');
            span.className = 'rg-kodaly-tok';
            if (tok === '休') span.classList.add('tok-rest');
            else if (tok.startsWith('ta-a')) span.classList.add('tok-ta2');
            else if (tok.startsWith('ti')) span.classList.add('tok-ti');
            else span.classList.add('tok-ta');
            span.textContent = tok;
            kodalyRow.appendChild(span);
        });

        document.querySelectorAll('.rc-speed-btn').forEach(btn => {
            const bpm = parseInt(btn.dataset.bpm || '60', 10);
            btn.classList.toggle('active', bpm === rcGameState._bpm);
            btn.onclick = () => {
                rcGameState._bpm = bpm;
                document.querySelectorAll('.rc-speed-btn').forEach(other => {
                    other.classList.toggle('active', parseInt(other.dataset.bpm || '60', 10) === bpm);
                });
            };
        });

        document.getElementById('rcDetailPreviewBtn').onclick = () => _rcPlayPreview(card);
        document.getElementById('rcDetailBack').onclick = () => {
            _rcStopPreview();
            audio.bgPlay();
            switchScreen('screen-rc-levels');
        };
        document.getElementById('rcDetailStartBtn').onclick = () => showRCReadPhase(card, rcGameState._bpm, user);
        document.querySelectorAll('#rcPreviewBeats .rc-beat-box').forEach(box => box.classList.remove('active'));
        switchScreen('screen-rc-detail');
    }

    async function _rcPlayPreview(card) {
        _rcStopPreview();
        audio.bgStop();
        if (!audio.ctx) {
            audio.init();
            audio.warmUp();
        }
        if (audio.ctx.state === 'suspended') await audio.ctx.resume();
        await audio.warmUp();

        const bpm = rcGameState._bpm || 60;
        const beatSec = 60 / bpm;
        const beatMs = beatSec * 1000;
        const { taps, totalBeats } = parseRhythmTaps(card.label);
        const btn = document.getElementById('rcDetailPreviewBtn');
        btn.textContent = '⏸ 停止';

        const now = audio.ctx.currentTime;
        // No prep clicks — start rhythm directly
        const beat0T = now + 0.05;
        taps.forEach(tap => audio.scheduleTick(beat0T + tap * beatSec, tap % 1 === 0));

        const totalBoxes = Math.ceil(totalBeats);
        for (let beat = 0; beat < totalBoxes; beat++) {
            const delay = beat * beatMs;
            const timerId = setTimeout(() => {
                const boxIdx = beat % 4;
                document.querySelectorAll('#rcPreviewBeats .rc-beat-box').forEach((el, idx) => {
                    el.classList.toggle('active', idx === boxIdx);
                });
            }, delay);
            rcGameState._previewTimers.push(timerId);
        }

        const endId = setTimeout(() => {
            document.querySelectorAll('#rcPreviewBeats .rc-beat-box').forEach(box => box.classList.remove('active'));
            btn.textContent = '▶ 再聽一次';
        }, (totalBoxes + 1) * beatMs);
        rcGameState._previewTimers.push(endId);
    }

    function _rcStopPreview() {
        if (Array.isArray(rcGameState._previewTimers)) {
            rcGameState._previewTimers.forEach(timerId => clearTimeout(timerId));
        }
        rcGameState._previewTimers = [];
        const btn = document.getElementById('rcDetailPreviewBtn');
        if (btn) btn.textContent = '▶ 聆聽節奏';
        document.querySelectorAll('#rcPreviewBeats .rc-beat-box').forEach(box => box.classList.remove('active'));
        // Reset any level-grid preview button
        if (rcGameState._levelPreviewBtn) {
            rcGameState._levelPreviewBtn.textContent = '▶';
            rcGameState._levelPreviewBtn.classList.remove('playing');
            rcGameState._levelPreviewBtn = null;
        }
    }

    async function _rcPlayLevelPreview(card, btn) {
        _rcStopPreview();
        if (!audio.ctx) { audio.init(); audio.warmUp(); }
        if (audio.ctx.state === 'suspended') await audio.ctx.resume();
        await audio.warmUp();

        const bpm = [75, 70, 65, 60][card.level - 1] || 65;
        const beatSec = 60 / bpm;
        const beatMs = beatSec * 1000;
        const { taps, totalBeats } = parseRhythmTaps(card.label);

        btn.textContent = '⏸';
        btn.classList.add('playing');
        rcGameState._levelPreviewBtn = btn;
        rcGameState._previewTimers = [];

        const now = audio.ctx.currentTime;
        // No prep clicks — start rhythm directly
        const beat0T = now + 0.05;
        taps.forEach(tap => audio.scheduleTick(beat0T + tap * beatSec, tap % 1 === 0));

        const endMs = Math.ceil(totalBeats) * beatMs;
        const endId = setTimeout(() => {
            btn.textContent = '▶';
            btn.classList.remove('playing');
            rcGameState._levelPreviewBtn = null;
        }, endMs);
        rcGameState._previewTimers.push(endId);
    }

    function showRCReadPhase(card, bpm, user) {
        _rcStopPreview();
        switchScreen('screen-rc-game');

        const msgEl = document.getElementById('rcMessageOverlay');
        if (msgEl) msgEl.style.display = 'none';

        const canvas    = document.getElementById('rcGameCanvas');
        const wrap      = canvas.parentElement;
        const overlay   = document.getElementById('rcReadOverlay');
        const vfDiv     = document.getElementById('rcOsmdContainer');

        const bars = card.bars && card.bars.length ? card.bars : [card.label || ''];

        // Back button during read phase
        document.getElementById('rcGameExit').onclick = () => {
            _rcStopPreview();
            if (vfDiv) { vfDiv.style.display = 'none'; vfDiv.innerHTML = ''; }
            canvas.style.display = '';
            wrap.style.overflowY = '';
            wrap.style.maxHeight = '';
            wrap.style.minHeight = '';
            wrap.style.webkitOverflowScrolling = '';
            overlay.style.display = 'none';
            audio.bgPlay();
            switchScreen('screen-rc-levels');
        };

        // Try VexFlow first; fall back to canvas if library not loaded
        const useVF = typeof VexFlow !== 'undefined' && vfDiv;

        if (useVF) {
            canvas.style.display = 'none';
            vfDiv.style.display = '';
            vfDiv.innerHTML = '';

            wrap.style.overflowY = 'auto';
            wrap.style.maxHeight = 'none';
            wrap.style.webkitOverflowScrolling = 'touch';

            // Delay render to ensure container has layout dimensions
            requestAnimationFrame(() => {
                try {
                    _renderVexFlowBars(bars, vfDiv);
                } catch (err) {
                    console.warn('VexFlow render failed, falling back to canvas:', err);
                    vfDiv.style.display = 'none';
                    _fallbackCanvasPreview(bars, canvas, wrap);
                }
            });
        } else {
            _fallbackCanvasPreview(bars, canvas, wrap);
        }

        overlay.style.display = '';
        document.getElementById('rcReadStartBtn').onclick = () => {
            overlay.style.display = 'none';
            if (vfDiv) { vfDiv.style.display = 'none'; vfDiv.innerHTML = ''; }
            canvas.style.display = '';
            wrap.style.overflowY = '';
            wrap.style.maxHeight = '';
            wrap.style.minHeight = '';
            wrap.style.webkitOverflowScrolling = '';
            canvas.style.width  = '';
            canvas.style.height = '';
            startRCGame(card, bpm, user);
        };
    }

    function _fallbackCanvasPreview(bars, canvas, wrap) {
        canvas.style.display = '';
        const screenH = window.innerHeight;
        const canvasAvailH = Math.round(screenH * 0.72);
        const idealROW_H = Math.floor((canvasAvailH - 60) / bars.length);
        const ROW_H = Math.max(124, Math.min(180, idealROW_H));
        const previewH = bars.length * ROW_H + 72;

        wrap.style.overflowY = 'auto';
        wrap.style.maxHeight = 'none';
        wrap.style.minHeight = Math.min(previewH, canvasAvailH) + 'px';
        wrap.style.webkitOverflowScrolling = 'touch';

        const dpr = window.devicePixelRatio || 1;
        const logW = wrap.clientWidth || 360;
        canvas.width  = logW * dpr;
        canvas.height = previewH * dpr;
        canvas.style.width  = logW + 'px';
        canvas.style.height = previewH + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        _rcDrawAllBarsPreview(bars, logW, previewH, ctx);
    }

    const STUDIO_RHYTHM_MEASURES_PER_ROW_MAX = 2;
    /** 可調：節奏譜每小節最小寬度（px），過窄時自動減少每行小節數。 */
    const STUDIO_RHYTHM_MIN_STAVE_WIDTH = 112;

    function _chunkBarsForStudioRhythm(bars, perRow) {
        const rows = [];
        const n = perRow || STUDIO_RHYTHM_MEASURES_PER_ROW_MAX;
        for (let i = 0; i < bars.length; i += n) {
            rows.push(bars.slice(i, i + n));
        }
        return rows;
    }

    function _computeRhythmMeasuresPerRow(barCount, containerWidth) {
        const W = Math.max(containerWidth || 360, 280);
        const LEFT_PAD = 10;
        const RIGHT_PAD = 10;
        const GAP = 4;
        const avail = W - LEFT_PAD - RIGHT_PAD;
        const maxPer = Math.min(STUDIO_RHYTHM_MEASURES_PER_ROW_MAX, Math.max(1, barCount));
        for (let p = maxPer; p >= 1; p--) {
            const staveW = (avail - GAP * (p - 1)) / p;
            if (staveW >= STUDIO_RHYTHM_MIN_STAVE_WIDTH) return p;
        }
        return 1;
    }

    /* ── VexFlow renderer for Kodály rhythm bars ── */
    function _renderVexFlowBars(bars, container) {
        const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Annotation, Stem, Dot } = VexFlow;
        const rhythmStem = typeof Stem !== 'undefined' && Stem.DOWN !== undefined ? Stem.DOWN : -1;

        container.innerHTML = '';

        const W = container.clientWidth || 360;
        const LEFT_PAD = 10;
        const RIGHT_PAD = 10;
        const GAP = 4;
        const avail = W - LEFT_PAD - RIGHT_PAD;
        const STAVE_H = 118;
        const perRow = _computeRhythmMeasuresPerRow(bars.length, W);
        const systems = _chunkBarsForStudioRhythm(bars, perRow);
        const totalH = systems.length * STAVE_H + 20;

        const renderer = new Renderer(container, Renderer.Backends.SVG);
        renderer.resize(W, totalH);
        const context = renderer.getContext();

        const BarlineType = VexFlow.BarlineType || (VexFlow.Barline && VexFlow.Barline.type);
        const totalMeasures = bars.length;

        const durMap = {
            0.25: '16',
            0.5:  '8',
            0.75: '8',
            1:    'q',
            1.5:  'q',
            2:    'h',
            3:    'h',
        };
        const dotSet3 = new Set([0.75, 1.5, 3]);

        let globalBi = 0;
        systems.forEach((rowBars, rowIdx) => {
            const nInRow = rowBars.length;
            const staveW = (avail - GAP * (nInRow - 1)) / nInRow;
            let x = LEFT_PAD;
            const y = rowIdx * STAVE_H + 10;

            rowBars.forEach(barLabel => {
                const stave = new Stave(x, y, staveW);
                [0, 1, 3, 4].forEach(line => stave.setConfigForLine(line, { visible: false }));
                if (globalBi === 0) stave.addTimeSignature('4/4');
                if (BarlineType) {
                    try {
                        stave.setBegBarType(BarlineType.NONE);
                        const isPieceEnd = globalBi === totalMeasures - 1;
                        stave.setEndBarType(isPieceEnd ? BarlineType.END : BarlineType.SINGLE);
                    } catch (e) { /* ignore */ }
                }
                stave.setContext(context).draw();

                const notes = [];
                const beamGroups = [];
                let eighthRun = [];
                let sixteenthRun = [];
                const flushEighthRun = () => {
                    while (eighthRun.length >= 2) {
                        beamGroups.push(eighthRun.slice(0, 2));
                        eighthRun = eighthRun.slice(2);
                    }
                    eighthRun = [];
                };
                const flushSixteenthRun = () => {
                    while (sixteenthRun.length >= 4) {
                        beamGroups.push(sixteenthRun.slice(0, 4));
                        sixteenthRun = sixteenthRun.slice(4);
                    }
                    if (sixteenthRun.length > 1) beamGroups.push([...sixteenthRun]);
                    sixteenthRun = [];
                };
                const flushAllSimpleRuns = () => { flushEighthRun(); flushSixteenthRun(); };

                barLabel.split(' ').forEach(token => {
                    const isRest = token === '休';
                    const compound = COMPOUND_TOKENS[token];

                    if (isRest) {
                        flushAllSimpleRuns();
                        const note = new StaveNote({ keys: ['b/4'], duration: 'qr' });
                        note.addModifier(new Annotation('休止')
                            .setVerticalJustification(3));
                        notes.push(note);
                    } else if (compound) {
                        flushAllSimpleRuns();
                        const group = [];
                        compound.forEach(sub => {
                            const dur = durMap[sub.d];
                            if (!dur) return;
                            const note = new StaveNote({
                                keys: ['b/4'],
                                duration: dur,
                                stemDirection: rhythmStem
                            });
                            if (dotSet3.has(sub.d)) Dot.buildAndAttach([note], { all: true });
                            note.addModifier(new Annotation(sub.l)
                                .setVerticalJustification(3));
                            notes.push(note);
                            group.push(note);
                        });
                        if (group.length > 1) beamGroups.push(group);
                    } else {
                        const tokenDur = getRhythmTokenDuration(token);
                        const dur = durMap[tokenDur];
                        if (!dur) return;
                        const note = new StaveNote({
                            keys: ['b/4'],
                            duration: dur,
                            stemDirection: rhythmStem
                        });
                        if (dotSet3.has(tokenDur)) Dot.buildAndAttach([note], { all: true });
                        note.addModifier(new Annotation(token)
                            .setVerticalJustification(3));
                        notes.push(note);
                        if (dur === '8') {
                            flushSixteenthRun();
                            eighthRun.push(note);
                            while (eighthRun.length >= 2) {
                                beamGroups.push(eighthRun.slice(0, 2));
                                eighthRun = eighthRun.slice(2);
                            }
                        } else if (dur === '16') {
                            flushEighthRun();
                            sixteenthRun.push(note);
                            while (sixteenthRun.length >= 4) {
                                beamGroups.push(sixteenthRun.slice(0, 4));
                                sixteenthRun = sixteenthRun.slice(4);
                            }
                        } else {
                            flushAllSimpleRuns();
                        }
                    }
                });
                flushAllSimpleRuns();

                const voice = new Voice({ numBeats: 4, beatValue: 4 });
                voice.setMode(2); // SOFT mode — allow incomplete bars
                voice.addTickables(notes);

                const fmtW = staveW - (globalBi === 0 ? 46 : 22);
                new Formatter().joinVoices([voice]).format([voice], Math.max(48, fmtW));
                beamGroups.forEach(g => {
                    if (g.length < 2) return;
                    const d0 = g[0].getStemDirection();
                    for (let bi = 1; bi < g.length; bi++) g[bi].setStemDirection(d0);
                });
                const beams = [];
                beamGroups.forEach(g => {
                    if (g.length < 2) return;
                    try {
                        const b = new Beam(g, false);
                        if (b.renderOptions) b.renderOptions.beamWidth = 3.5;
                        b.setContext(context);
                        beams.push(b);
                    } catch (e) { /* ignore */ }
                });
                voice.draw(context, stave);
                beams.forEach(b => { try { b.draw(); } catch (e) { /* ignore */ } });

                globalBi++;
                x += staveW + GAP;
            });
        });
    }

    /* ── VexFlow renderer for game-phase (single bar + scanner) ── */
    function _renderVexFlowGameBar(barLabel, container) {
        const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Annotation, Stem, Dot } = VexFlow;
        container.innerHTML = '';

        const W = container.clientWidth || 360;
        const STAVE_H = 140;
        const PAD_LEFT = 10, PAD_RIGHT = 10;
        const STAVE_W = W - PAD_LEFT - PAD_RIGHT;

        const renderer = new Renderer(container, Renderer.Backends.SVG);
        renderer.resize(W, STAVE_H);
        const context = renderer.getContext();

        const stave = new Stave(PAD_LEFT, 10, STAVE_W);
        [0, 1, 3, 4].forEach(line => stave.setConfigForLine(line, { visible: false }));
        stave.addTimeSignature('4/4');
        stave.setContext(context).draw();

        const durMap = { 0.25: '16', 0.5: '8', 0.75: '8', 1: 'q', 1.5: 'q', 2: 'h', 3: 'h' };
        const dotSet = new Set([0.75, 1.5, 3]);
        const vfNotes = [];
        const beamGroups = [];
        // Map: vfNotes index → array of game-note indices (for coloring)
        const vfToGame = [];
        let gameNoteIdx = 0;
        let eighthRun = [];
        const flushEighthRun = () => {
            while (eighthRun.length >= 2) {
                beamGroups.push(eighthRun.slice(0, 2));
                eighthRun = eighthRun.slice(2);
            }
            eighthRun = [];
        };

        barLabel.split(' ').forEach(token => {
            const isRest = token === '休';
            const compound = COMPOUND_TOKENS[token];

            if (isRest) {
                flushEighthRun();
                const note = new StaveNote({ keys: ['b/4'], duration: 'qr' });
                note.addModifier(new Annotation('休止').setVerticalJustification(3));
                vfNotes.push(note);
                vfToGame.push([]); // no game note for rests
            } else if (compound) {
                flushEighthRun();
                const group = [];
                compound.forEach(sub => {
                    const dur = durMap[sub.d];
                    if (!dur) return;
                    const note = new StaveNote({ keys: ['b/4'], duration: dur, stemDirection: Stem.UP });
                    if (dotSet.has(sub.d)) Dot.buildAndAttach([note], { all: true });
                    note.addModifier(new Annotation(sub.l).setVerticalJustification(3));
                    vfNotes.push(note);
                    group.push(note);
                    vfToGame.push([gameNoteIdx]);
                    gameNoteIdx++;
                });
                if (group.length > 1) beamGroups.push(group);
            } else {
                const tokenDur = getRhythmTokenDuration(token);
                const dur = durMap[tokenDur];
                if (!dur) return;
                const note = new StaveNote({ keys: ['b/4'], duration: dur, stemDirection: Stem.UP });
                if (dotSet.has(tokenDur)) Dot.buildAndAttach([note], { all: true });
                note.addModifier(new Annotation(token).setVerticalJustification(3));
                vfNotes.push(note);
                vfToGame.push([gameNoteIdx]);
                gameNoteIdx++;
                if (dur === '8') {
                    eighthRun.push(note);
                    while (eighthRun.length >= 2) {
                        beamGroups.push(eighthRun.slice(0, 2));
                        eighthRun = eighthRun.slice(2);
                    }
                } else {
                    flushEighthRun();
                }
            }
        });
        flushEighthRun();

        const voice = new Voice({ numBeats: 4, beatValue: 4 });
        voice.setMode(2);
        voice.addTickables(vfNotes);
        new Formatter().joinVoices([voice]).format([voice], STAVE_W - 60);
        beamGroups.forEach(g => {
            if (g.length < 2) return;
            const d0 = g[0].getStemDirection();
            for (let bi = 1; bi < g.length; bi++) g[bi].setStemDirection(d0);
        });
        const beams = [];
        beamGroups.forEach(g => {
            if (g.length < 2) return;
            try {
                const b = new Beam(g, false);
                if (b.renderOptions) b.renderOptions.beamWidth = 3.5;
                b.setContext(context);
                beams.push(b);
            } catch (e) { /* ignore */ }
        });
        voice.draw(context, stave);
        beams.forEach(b => { try { b.draw(); } catch (e) { /* ignore */ } });

        // Collect SVG elements and X positions
        const noteStartX = stave.getNoteStartX();
        const noteEndX = stave.getNoteEndX();
        const noteMap = []; // indexed by game-note index → {x, svgEl}
        vfNotes.forEach((vfNote, vi) => {
            const gameIndices = vfToGame[vi];
            if (!gameIndices || !gameIndices.length) return;
            const x = vfNote.getAbsoluteX();
            const el = vfNote.getSVGElement ? vfNote.getSVGElement() : (vfNote.attrs && vfNote.attrs.el);
            gameIndices.forEach(gi => {
                noteMap[gi] = { x, el };
            });
        });

        return { noteStartX, noteEndX, noteMap, staveH: STAVE_H };
    }

    /* ── Color a VexFlow SVG note element ── */
    function _vfColorNote(svgEl, color, opacity) {
        if (!svgEl) return;
        svgEl.querySelectorAll('path, rect, ellipse, line, circle, polygon').forEach(p => {
            p.setAttribute('fill', color);
            p.setAttribute('stroke', color);
        });
        svgEl.querySelectorAll('text').forEach(t => {
            t.setAttribute('fill', color);
        });
        if (opacity !== undefined) svgEl.style.opacity = opacity;
    }

    function _rcDrawAllBarsPreview(bars, W, totalH, ctx) {
        const n       = bars.length;
        const ROW_H   = (totalH - 28) / n;
        const headRx  = 10, headRy = 7;
        const stemH   = 42;
        const beamThick = 4.5, beamGap = 8;
        const barBeats = 4;
        const LABEL_W  = 48;
        const laneLeft  = LABEL_W;
        const laneRight = W - 16;
        const laneWidth = laneRight - laneLeft;

        // ── Background with soft gradient ──
        const bgGrad = ctx.createLinearGradient(0, 0, 0, totalH);
        bgGrad.addColorStop(0, '#F8FAFF');
        bgGrad.addColorStop(0.5, '#F0F4FF');
        bgGrad.addColorStop(1, '#E8EEFF');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, totalH);

        // Subtle decorative dots in background
        ctx.globalAlpha = 0.04;
        for (let dx = 0; dx < W; dx += 24) {
            for (let dy = 0; dy < totalH; dy += 24) {
                ctx.fillStyle = '#6366F1';
                ctx.beginPath();
                ctx.arc(dx, dy, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;

        // ── Title banner ──
        const titleY = 2;
        const titleH = 22;
        // Title pill background
        const titleText = '📖 請先審視節奏';
        ctx.font = '900 13px Nunito, sans-serif';
        const titleW = ctx.measureText(titleText).width + 28;
        ctx.fillStyle = 'rgba(99,102,241,0.08)';
        _roundRect(ctx, W / 2 - titleW / 2, titleY, titleW, titleH, 11);
        ctx.fill();
        ctx.strokeStyle = 'rgba(99,102,241,0.15)';
        ctx.lineWidth = 1;
        _roundRect(ctx, W / 2 - titleW / 2, titleY, titleW, titleH, 11);
        ctx.stroke();
        // Title text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(99,102,241,0.7)';
        ctx.fillText(titleText, W / 2, titleY + titleH / 2);

        bars.forEach((barLabel, bi) => {
            const rowTop = 28 + bi * ROW_H;
            const staffY = rowTop + ROW_H * 0.48;
            const beatX  = b => laneLeft + ((b + 0.5) / barBeats) * laneWidth;

            // ── Row card background ──
            const cardPad = 6;
            const cardY = rowTop + 1;
            const cardH = ROW_H - 4;
            // White card with rounded corners
            ctx.shadowColor = 'rgba(99,102,241,0.08)';
            ctx.shadowBlur = 12;
            ctx.shadowOffsetY = 3;
            ctx.fillStyle = bi % 2 === 0 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.6)';
            _roundRect(ctx, laneLeft - cardPad - 2, cardY, laneWidth + cardPad * 2 + 4, cardH, 12);
            ctx.fill();
            // Card border
            ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            ctx.strokeStyle = bi === 0 ? 'rgba(255,140,66,0.18)' : 'rgba(99,102,241,0.10)';
            ctx.lineWidth = 1.2;
            _roundRect(ctx, laneLeft - cardPad - 2, cardY, laneWidth + cardPad * 2 + 4, cardH, 12);
            ctx.stroke();

            // ── Bar number badge (pill) ──
            ctx.textAlign  = 'center';
            ctx.textBaseline = 'middle';
            const badgeCX = laneLeft / 2;
            const badgeCY = staffY - 10;
            const badgeW = 28, badgeH = 38, badgeR = 10;
            // Badge background
            const badgeGrad = ctx.createLinearGradient(badgeCX, badgeCY - badgeH / 2, badgeCX, badgeCY + badgeH / 2);
            if (bi === 0) {
                badgeGrad.addColorStop(0, 'rgba(255,160,80,0.22)');
                badgeGrad.addColorStop(1, 'rgba(255,120,50,0.12)');
            } else {
                badgeGrad.addColorStop(0, 'rgba(99,102,241,0.12)');
                badgeGrad.addColorStop(1, 'rgba(99,102,241,0.06)');
            }
            ctx.fillStyle = badgeGrad;
            _roundRect(ctx, badgeCX - badgeW / 2, badgeCY - badgeH / 2, badgeW, badgeH, badgeR);
            ctx.fill();
            ctx.strokeStyle = bi === 0 ? 'rgba(255,140,66,0.30)' : 'rgba(99,102,241,0.15)';
            ctx.lineWidth = 1;
            _roundRect(ctx, badgeCX - badgeW / 2, badgeCY - badgeH / 2, badgeW, badgeH, badgeR);
            ctx.stroke();
            // Number
            ctx.font = '900 15px Nunito, sans-serif';
            ctx.fillStyle = bi === 0 ? 'rgba(255,120,40,0.9)' : 'rgba(99,102,241,0.65)';
            ctx.fillText(String(bi + 1), badgeCX, badgeCY - 6);
            // "小節" label
            ctx.font = '800 8px Nunito, sans-serif';
            ctx.fillStyle = bi === 0 ? 'rgba(255,140,66,0.55)' : 'rgba(99,102,241,0.35)';
            ctx.fillText('小節', badgeCX, badgeCY + 11);

            // ── Staff line (thicker, subtle gradient illusion) ──
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(laneLeft - 2, staffY);
            ctx.lineTo(laneRight + 2, staffY);
            ctx.stroke();

            // ── Beat grid + count labels ──
            for (let b = 0; b < barBeats; b++) {
                const x = laneLeft + (b / barBeats) * laneWidth;
                // Beat separator line
                if (b === 0) {
                    ctx.strokeStyle = 'rgba(255,140,66,0.35)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([]);
                } else {
                    ctx.strokeStyle = 'rgba(99,102,241,0.08)';
                    ctx.lineWidth = 0.8;
                    ctx.setLineDash([4, 5]);
                }
                ctx.beginPath();
                ctx.moveTo(x, staffY - stemH - 8);
                ctx.lineTo(x, staffY + 36);
                ctx.stroke();
                ctx.setLineDash([]);

                // Beat number pill
                const numCX = x + (laneWidth / barBeats) / 2;
                const numY = staffY - stemH - 14;
                const numPW = 20, numPH = 16, numPR = 5;
                ctx.fillStyle = b === 0 ? 'rgba(255,140,66,0.12)' : 'rgba(59,130,246,0.07)';
                _roundRect(ctx, numCX - numPW / 2, numY - numPH / 2, numPW, numPH, numPR);
                ctx.fill();
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                ctx.font      = '900 13px Nunito, sans-serif';
                ctx.fillStyle = b === 0 ? 'rgba(255,140,66,0.8)' : 'rgba(59,130,246,0.55)';
                ctx.fillText(b + 1, numCX, numY);
            }
            // End barline
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(laneRight, staffY - stemH - 8);
            ctx.lineTo(laneRight, staffY + 36);
            ctx.stroke();

            // ── Parse bar ──
            const { units, segments } = parseRhythmUnits(barLabel);

            // ── Rests (refined sleeping character) ──
            segments.filter(s => s.isRest).forEach(s => {
                const cx = beatX(s.start);
                const rR = 15;
                ctx.globalAlpha = 0.8;
                // Shadow
                ctx.shadowColor = 'rgba(100,116,139,0.2)';
                ctx.shadowBlur = 8;
                // Rest body
                ctx.fillStyle = '#B8C4D0';
                ctx.beginPath(); ctx.arc(cx, staffY, rR, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
                // Night cap
                ctx.fillStyle = '#8B95A5';
                ctx.beginPath();
                ctx.moveTo(cx - 6, staffY - rR + 2);
                ctx.lineTo(cx + 9, staffY - rR - 7);
                ctx.lineTo(cx + 5, staffY - rR + 4);
                ctx.closePath(); ctx.fill();
                // Cap ball
                ctx.fillStyle = '#FFD700';
                ctx.beginPath(); ctx.arc(cx + 9, staffY - rR - 7, 2.5, 0, Math.PI * 2); ctx.fill();
                // Sleeping eyes
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(cx - 6, staffY - 2); ctx.lineTo(cx - 1, staffY - 2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx + 1, staffY - 2); ctx.lineTo(cx + 6, staffY - 2); ctx.stroke();
                // Blush
                ctx.fillStyle = 'rgba(255,150,150,0.30)';
                ctx.beginPath(); ctx.arc(cx - 7, staffY + 3, 3.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx + 7, staffY + 3, 3.5, 0, Math.PI * 2); ctx.fill();
                // Zzz
                ctx.fillStyle = 'rgba(107,114,128,0.55)';
                ctx.font = '800 11px Nunito'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
                ctx.fillText('z', cx + rR + 2, staffY - 4);
                ctx.font = '800 9px Nunito';
                ctx.fillText('z', cx + rR + 7, staffY - 10);
                ctx.font = '800 7px Nunito';
                ctx.fillText('z', cx + rR + 11, staffY - 15);
                // Label
                ctx.textAlign = 'center';
                ctx.font = '800 10px Nunito, sans-serif';
                ctx.fillStyle = 'rgba(100,116,139,0.6)';
                ctx.textBaseline = 'top';
                ctx.fillText('休止', cx, staffY + 16);
                ctx.globalAlpha = 1;
            });

            // ── Group notes by segment, split at beat boundaries ──
            const rawBySegment = {};
            units.forEach(u => {
                if (!rawBySegment[u.segmentIndex]) rawBySegment[u.segmentIndex] = [];
                rawBySegment[u.segmentIndex].push(u);
            });
            const segGroups = [];
            Object.values(rawBySegment).forEach(group => {
                group.sort((a, b) => a.beatPos - b.beatPos);
                let curBeat = Math.floor(group[0].beatPos + 0.001);
                let sub = [];
                group.forEach(note => {
                    const nb = Math.floor(note.beatPos + 0.001);
                    if (nb !== curBeat && sub.length > 0) { segGroups.push(sub); sub = []; curBeat = nb; }
                    sub.push(note);
                });
                if (sub.length > 0) segGroups.push(sub);
            });

            const NC = '#1E293B';
            segGroups.forEach(group => {
                const isBeamed = group.length > 1;

                group.forEach(note => {
                    const cx  = beatX(note.beatPos);
                    const dur = note.durationBeats;
                    const filled = dur <= 1;

                    // Notehead with shadow
                    ctx.shadowColor = 'rgba(30,41,59,0.14)';
                    ctx.shadowBlur  = 7;
                    ctx.save();
                    ctx.translate(cx, staffY);
                    ctx.rotate(-0.18);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, headRx, headRy, 0, 0, Math.PI * 2);
                    if (filled) { ctx.fillStyle = NC; ctx.fill(); }
                    else { ctx.strokeStyle = NC; ctx.lineWidth = 2.8; ctx.stroke(); }
                    ctx.restore();
                    ctx.shadowBlur = 0;

                    // Augmentation dot
                    if (dur === 0.75 || dur === 1.5 || dur === 3) {
                        ctx.beginPath();
                        ctx.arc(cx + headRx + 6, staffY - 2, 3, 0, Math.PI * 2);
                        ctx.fillStyle = NC; ctx.fill();
                    }

                    // Stem
                    if (dur < 4) {
                        const stemX = cx + headRx - 1;
                        ctx.strokeStyle = NC; ctx.lineWidth = 2.2;
                        ctx.beginPath();
                        ctx.moveTo(stemX, staffY - headRy + 2);
                        ctx.lineTo(stemX, staffY - stemH);
                        ctx.stroke();
                        // Isolated flag (8th / dotted-8th)
                        if (!isBeamed && (dur === 0.5 || dur === 0.75)) {
                            ctx.lineWidth = 2.2;
                            ctx.beginPath();
                            ctx.moveTo(stemX, staffY - stemH);
                            ctx.bezierCurveTo(stemX + 9, staffY - stemH + 6, stemX + 15, staffY - stemH + 14, stemX + 6, staffY - stemH + 24);
                            ctx.stroke();
                        }
                        // Double flag (16th)
                        if (!isBeamed && dur === 0.25) {
                            ctx.lineWidth = 2.2;
                            for (let f = 0; f < 2; f++) {
                                const fy = staffY - stemH + f * beamGap;
                                ctx.beginPath();
                                ctx.moveTo(stemX, fy);
                                ctx.bezierCurveTo(stemX + 9, fy + 6, stemX + 15, fy + 14, stemX + 6, fy + 24);
                                ctx.stroke();
                            }
                        }
                    }

                    // ── Kodály label (with pill background) ──
                    const labelY = staffY + 14;
                    const labelText = note.label;
                    ctx.font = '900 11.5px Nunito, sans-serif';
                    const lbW = ctx.measureText(labelText).width + 10;
                    const lbH = 16;
                    ctx.fillStyle = 'rgba(180,140,80,0.10)';
                    _roundRect(ctx, cx - lbW / 2, labelY - 2, lbW, lbH, 5);
                    ctx.fill();
                    ctx.fillStyle = 'rgba(120,80,40,0.88)';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(labelText, cx, labelY);

                    // Beat value
                    const vt = dur===0.25?'¼拍':dur===0.5?'½拍':dur===0.75?'¾拍':dur===1?'1拍':dur===1.5?'1½拍':dur===2?'2拍':dur===3?'3拍':`${dur}拍`;
                    ctx.font = '700 9px Nunito, sans-serif';
                    ctx.fillStyle = 'rgba(100,80,60,0.30)';
                    ctx.fillText(vt, cx, staffY + 30);
                });

                // ── Beams ──
                if (isBeamed && group.length > 1) {
                    const x1 = beatX(group[0].beatPos) + headRx - 1;
                    const x2 = beatX(group[group.length - 1].beatPos) + headRx - 1;
                    const bY  = staffY - stemH;
                    ctx.fillStyle = NC;
                    // Primary beam with rounded ends
                    _roundRect(ctx, x1, bY, x2 - x1, beamThick, 2);
                    ctx.fill();
                    // Secondary beam (16ths)
                    let si = 0;
                    while (si < group.length) {
                        if (group[si].durationBeats <= 0.25) {
                            let sj = si;
                            while (sj < group.length && group[sj].durationBeats <= 0.25) sj++;
                            if (sj - si >= 2) {
                                const rx1 = beatX(group[si].beatPos) + headRx - 1;
                                const rx2 = beatX(group[sj-1].beatPos) + headRx - 1;
                                _roundRect(ctx, rx1, bY + beamGap, rx2 - rx1, beamThick, 2);
                                ctx.fill();
                            } else {
                                const sx = beatX(group[si].beatPos) + headRx - 1;
                                if (si > 0) { _roundRect(ctx, sx - 12, bY + beamGap, 12, beamThick, 2); ctx.fill(); }
                                else { _roundRect(ctx, sx, bY + beamGap, 12, beamThick, 2); ctx.fill(); }
                            }
                            si = sj;
                        } else { si++; }
                    }
                }
            });

            // ── Row separator line between bars ──
            if (bi < n - 1) {
                const sepY = rowTop + ROW_H - 1;
                ctx.strokeStyle = 'rgba(99,102,241,0.06)';
                ctx.lineWidth = 1;
                ctx.setLineDash([6, 6]);
                ctx.beginPath();
                ctx.moveTo(laneLeft + 10, sepY);
                ctx.lineTo(laneRight - 10, sepY);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });
    }

    // Rounded rectangle helper
    function _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }

    function startRCGame(card, bpm, user) {
        _rcStopPreview();
        audio.init();
        audio.warmUp();
        audio.bgStop();
        if (!audio.ctx) return;
        if (audio.ctx.state === 'suspended') audio.ctx.resume();
        markProfilePlayStart();

        const beatSec = 60 / bpm;
        const beatMs = beatSec * 1000;

        // Multi-bar mode: card.bars = [label0, label1, label2, label3]
        let segments, totalBeats, barsSegments = null;
        const notes = [];
        if (card.bars && card.bars.length) {
            const barsData = card.bars.map(lbl => parseRhythmUnits(lbl));
            totalBeats   = 4; // each bar is always 4 beats
            segments     = barsData[0].segments;
            barsSegments = barsData.map(b => b.segments);
            let beatOffset = 0;
            barsData.forEach((barData, rep) => {
                barData.units.forEach(unit => {
                    notes.push({
                        beatPos:       unit.beatPos + beatOffset,
                        localBeatPos:  unit.beatPos,
                        durationBeats: unit.durationBeats,
                        label:         unit.label,
                        segmentIndex:  unit.segmentIndex,
                        repIndex:      rep,
                        state:         'waiting',
                        judgment:      null,
                    });
                });
                beatOffset += barData.totalBeats;
            });
        } else {
            const parsed = parseRhythmUnits(card.label);
            segments  = parsed.segments;
            totalBeats = parsed.totalBeats;
            for (let rep = 0; rep < REPS; rep++) {
                parsed.units.forEach(unit => {
                    notes.push({
                        beatPos:       unit.beatPos + rep * totalBeats,
                        localBeatPos:  unit.beatPos,
                        durationBeats: unit.durationBeats,
                        label:         unit.label,
                        segmentIndex:  unit.segmentIndex,
                        repIndex:      rep,
                        state:         'waiting',
                        judgment:      null,
                    });
                });
            }
        }

        const totalGameBeats = totalBeats * REPS;
        const nowAudio = audio.ctx.currentTime;
        const PREP_BEATS = 4;  // 4 prep beats for countdown
        const beat0T = nowAudio + PREP_BEATS * beatSec + 0.05;
        const perfZero = performance.now() + (beat0T - audio.ctx.currentTime) * 1000;

        // Schedule prep ticks (countdown)
        for (let pb = 0; pb < PREP_BEATS; pb++) {
            audio.scheduleTick(nowAudio + 0.05 + pb * beatSec, pb === 0);
        }
        // Schedule game ticks
        for (let beat = 0; beat < Math.ceil(totalGameBeats) + 3; beat++) {
            audio.scheduleTick(beat0T + beat * beatSec, beat % 4 === 0);
        }

        _rcRemoveGameKeyHandler();
        const keyHandler = (e) => {
            if (e.code !== 'Space') return;
            if (!document.getElementById('screen-rc-game').classList.contains('active')) return;
            e.preventDefault();
            if (rcGameState.phase === 'paused') _rcTogglePause();
            else onRCHit();
        };
        document.addEventListener('keydown', keyHandler);

        rcGameState = {
            ...rcGameState,
            _user: user,
            _card: card,
            _bpm: bpm,
            _previewTimers: [],
            _keyHandler: keyHandler,
            beatMs,
            beatSec,
            notes,
            segments,
            barsSegments,
            barBeats: totalBeats,
            totalGameBeats,
            perfZero,
            score: 0,
            combo: 0,
            maxCombo: 0,
            counts: { perfect: 0, great: 0, good: 0, miss: 0 },
            phase: 'countdown',
            animId: null,
            _prepBeats: PREP_BEATS,
            _lastBeatBox: -1,
            _lastRepIndex: -1,
            _activeSegmentIndex: -1,
            _judgeTimer: null,
        };

        document.getElementById('rcGameTitle').textContent = card.num
            ? `節奏卡 No.${card.num}`
            : '節奏挑戰';
        document.getElementById('rcGameBpm').textContent = `${bpm} BPM`;
        document.getElementById('rcGameScore').textContent = '0';
        document.getElementById('rcComboDisplay').textContent = '';
        document.getElementById('rcProgressFill').style.width = '0%';
        document.getElementById('rcPauseOverlay').style.display = 'none';
        document.getElementById('rcMessageOverlay').textContent = '';
        document.getElementById('rcMessageOverlay').style.display = 'none';
        document.getElementById('rcGamePattern').textContent = card.bars ? card.bars[0] : card.label;
        document.getElementById('rcGameRep').textContent = card.bars ? `小節 1 / ${REPS}` : `第 1 / ${REPS} 次`;

        // Show next-bar preview (shows bar[1] at game start so students can read ahead)
        const nextBarStrip = document.getElementById('rcNextBarStrip');
        const nextBarPat   = document.getElementById('rcNextBarPattern');
        if (nextBarStrip && nextBarPat) {
            if (card.bars && card.bars.length > 1) {
                nextBarPat.textContent = card.bars[1];
                nextBarStrip.style.display = '';
            } else {
                nextBarStrip.style.display = 'none';
            }
        }
        document.getElementById('rcMetronomeText').textContent = '依照節拍器';
        const metroArm = document.getElementById('rcMetroArm');
        if (metroArm) metroArm.className = 'rc-metro-arm';
        _rcRenderGameTokens(card);
        document.querySelectorAll('#rcGameTokenRow .rc-game-token').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('#rcGameBeats .rc-beat-box').forEach(box => box.classList.remove('active'));

        document.getElementById('rcHitPad').onclick = onRCHit;
        document.getElementById('rcGameExit').onclick = () => _rcTogglePause();
        document.getElementById('rcResumeBtn').onclick = () => _rcTogglePause();
        document.getElementById('rcPauseExitBtn').onclick = () => _rcExitGame();

        switchScreen('screen-rc-game');

        // Show countdown overlay (visual only — does NOT control phase transition)
        _rcShowCountdown(PREP_BEATS, beatMs, () => { /* overlay removed */ });

        // Set phase='playing' based on audio clock, WIN_GOOD ms early so the
        // first note's early-tap window is fully open when beat 0 arrives.
        const msUntilBeat0 = perfZero - performance.now();
        const msUntilPlay  = Math.max(0, msUntilBeat0 - WIN_GOOD);
        rcGameState._startTimer = setTimeout(() => {
            if (rcGameState.phase === 'countdown') rcGameState.phase = 'playing';
            // Show GO! exactly when tapping is allowed
            const msgEl = document.getElementById('rcMessageOverlay');
            if (msgEl) {
                msgEl.textContent = '🥁 GO!';
                msgEl.style.display = '';
                setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, WIN_GOOD * 2 + 80);
            }
        }, msUntilPlay);

        const canvas = document.getElementById('rcGameCanvas');
        const wrap = canvas.parentElement;
        const vfDiv = document.getElementById('rcOsmdContainer');
        const useVF = typeof VexFlow !== 'undefined' && vfDiv;

        if (useVF) {
            canvas.style.display = 'none';
            vfDiv.style.display = '';
            vfDiv.innerHTML = '';
            wrap.style.overflowY = 'hidden';

            // Create scanner line
            let scanner = wrap.querySelector('.rc-scanner');
            if (!scanner) {
                scanner = document.createElement('div');
                scanner.className = 'rc-scanner';
                wrap.appendChild(scanner);
            }
            scanner.style.display = '';

            // Render first bar
            const firstBarLabel = card.bars && card.bars.length ? card.bars[0] : card.label;
            try {
                const vfData = _renderVexFlowGameBar(firstBarLabel, vfDiv);
                rcGameState._vf = true;
                rcGameState._vfDiv = vfDiv;
                rcGameState._scanner = scanner;
                rcGameState._vfNoteStartX = vfData.noteStartX;
                rcGameState._vfNoteEndX = vfData.noteEndX;
                rcGameState._vfNoteMap = vfData.noteMap;
                rcGameState._vfStaveH = vfData.staveH;
                scanner.style.height = vfData.staveH + 'px';
            } catch (err) {
                console.warn('VexFlow game render failed, falling back to canvas:', err);
                vfDiv.style.display = 'none';
                scanner.style.display = 'none';
                canvas.style.display = '';
                rcGameState._vf = false;
                canvas.width = wrap.clientWidth || 360;
                canvas.height = wrap.clientHeight || 300;
                rcGameState.canvas = canvas;
                rcGameState.ctx = canvas.getContext('2d');
            }
        } else {
            rcGameState._vf = false;
            canvas.width = wrap.clientWidth || 360;
            canvas.height = wrap.clientHeight || 300;
            rcGameState.canvas = canvas;
            rcGameState.ctx = canvas.getContext('2d');
        }

        rcGameState.animId = requestAnimationFrame(_rcGameLoop);
    }

    // Countdown overlay for RC game
    function _rcShowCountdown(beats, beatMs, onDone) {
        const wrap = document.querySelector('.rc-canvas-wrap');
        if (!wrap) { onDone(); return; }
        let overlay = wrap.querySelector('.rc-countdown-overlay');
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.className = 'rc-countdown-overlay';
        overlay.innerHTML = `<div class="rc-countdown-label">預備</div><div class="rc-countdown-num" id="rcCdnNum">${beats}</div>`;
        wrap.appendChild(overlay);
        let count = beats;
        const numEl = overlay.querySelector('.rc-countdown-num');
        function tick() {
            if (count <= 0) {
                // Remove overlay immediately on beat 0 so canvas is fully visible
                overlay.remove();
                onDone();
                return;
            }
            numEl.textContent = count;
            numEl.style.animation = 'none';
            void numEl.offsetWidth;
            numEl.style.animation = 'rcCountPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';
            count--;
            setTimeout(tick, beatMs);
        }
        tick();
    }

    function _rcGameLoop() {
        if (rcGameState._vf) { _rcGameLoopVF(); return; }
        _rcGameLoopCanvas();
    }

    /* ── VexFlow game loop: scanner + SVG coloring ── */
    function _rcGameLoopVF() {
        const { notes, perfZero, beatMs, totalGameBeats, phase, barBeats, segments, barsSegments,
                _scanner, _vfNoteStartX, _vfNoteEndX, _vfNoteMap, _vfDiv } = rcGameState;
        if (!_scanner) return;

        const now = performance.now();
        const elapsed = now - perfZero;
        const currentRepIndex = Math.max(0, Math.min(REPS - 1, Math.floor(Math.max(elapsed, 0) / (barBeats * beatMs || 1))));
        const currentSegments = barsSegments ? barsSegments[currentRepIndex] : segments;
        const repStartMs = currentRepIndex * barBeats * beatMs;
        const repElapsed = elapsed - repStartMs;
        const repProgress = Math.max(0, Math.min(1, repElapsed / (barBeats * beatMs || 1)));

        // Scanner position: interpolate between noteStartX and noteEndX
        const scannerX = _vfNoteStartX + (_vfNoteEndX - _vfNoteStartX) * repProgress;
        _scanner.style.left = scannerX + 'px';

        // ── Miss detection ──
        notes.forEach(note => {
            if (note.state === 'waiting' && elapsed - INPUT_LATENCY_MS > note.beatPos * beatMs + WIN_GOOD) {
                note.state = 'miss';
                note.judgment = 'miss';
                rcGameState.counts.miss++;
                rcGameState.combo = 0;
                document.getElementById('rcComboDisplay').textContent = '';
                _rcShowJudgment('MISS', '#EF4444');
                // Color SVG note red (only if note belongs to current displayed bar)
                if (note.repIndex === currentRepIndex) {
                    const repNoteIdx = _rcLocalNoteIndex(note, notes, currentRepIndex);
                    if (_vfNoteMap[repNoteIdx]) {
                        _vfColorNote(_vfNoteMap[repNoteIdx].el, '#EF4444', 0.45);
                    }
                }
            }
        });

        // ── Bar/rep change: re-render VexFlow for new bar ──
        if (elapsed > 0) {
            const beatIdx = Math.floor(elapsed / beatMs) % 4;
            if (beatIdx !== rcGameState._lastBeatBox) {
                rcGameState._lastBeatBox = beatIdx;
                document.querySelectorAll('#rcGameBeats .rc-beat-box').forEach((box, idx) => {
                    box.classList.toggle('active', idx === beatIdx);
                });
                const arm = document.getElementById('rcMetroArm');
                const text = document.getElementById('rcMetronomeText');
                if (arm) {
                    arm.classList.remove('tick-left', 'tick-right');
                    void arm.offsetWidth;
                    arm.classList.add(beatIdx % 2 === 0 ? 'tick-left' : 'tick-right');
                }
                if (text) text.textContent = beatIdx === 0 ? '強拍！' : `第 ${beatIdx + 1} 拍`;
            }

            const repIndex = Math.min(REPS, currentRepIndex + 1);

            if (currentRepIndex !== rcGameState._lastRepIndex) {
                rcGameState._lastRepIndex = currentRepIndex;
                rcGameState._activeSegmentIndex = -1;

                // Re-render VexFlow for new bar
                const barLabel = barsSegments
                    ? (rcGameState._card.bars ? rcGameState._card.bars[currentRepIndex] : rcGameState._card.label)
                    : rcGameState._card.label;
                try {
                    const vfData = _renderVexFlowGameBar(barLabel, _vfDiv);
                    rcGameState._vfNoteStartX = vfData.noteStartX;
                    rcGameState._vfNoteEndX = vfData.noteEndX;
                    rcGameState._vfNoteMap = vfData.noteMap;
                } catch (err) { console.warn('VexFlow re-render failed:', err); }

                if (barsSegments) {
                    _rcRenderGameTokensFromSegs(barsSegments[currentRepIndex]);
                    document.querySelectorAll('#rcGameTokenRow .rc-game-token').forEach(el => el.classList.remove('active'));
                    const patEl = document.getElementById('rcGamePattern');
                    if (patEl && rcGameState._card.bars) patEl.textContent = rcGameState._card.bars[currentRepIndex];

                    const nextStrip = document.getElementById('rcNextBarStrip');
                    const nextPat   = document.getElementById('rcNextBarPattern');
                    if (nextStrip && nextPat) {
                        const nextIdx = currentRepIndex + 1;
                        if (nextIdx < rcGameState._card.bars.length) {
                            nextPat.textContent = rcGameState._card.bars[nextIdx];
                            nextStrip.style.display = '';
                        } else {
                            nextStrip.style.display = 'none';
                        }
                    }
                }
                document.getElementById('rcGameRep').textContent = barsSegments
                    ? `小節 ${repIndex} / ${REPS}`
                    : `第 ${repIndex} / ${REPS} 次`;
            }

            const beatInBar = (elapsed / beatMs) % barBeats;
            const activeSegmentIndex = currentSegments.findIndex(segment => beatInBar >= segment.start && beatInBar < segment.start + segment.duration);
            if (activeSegmentIndex !== rcGameState._activeSegmentIndex) {
                rcGameState._activeSegmentIndex = activeSegmentIndex;
                document.querySelectorAll('#rcGameTokenRow .rc-game-token').forEach(el => {
                    el.classList.toggle('active', parseInt(el.dataset.segmentIndex || '-1', 10) === activeSegmentIndex);
                });
            }
        }

        if (elapsed > 0 && totalGameBeats > 0) {
            const pct = Math.min(elapsed / (totalGameBeats * beatMs) * 100, 100);
            document.getElementById('rcProgressFill').style.width = pct + '%';
        }

        const allDone = notes.every(note => note.state !== 'waiting');
        const lastBeatMs = notes[notes.length - 1]?.beatPos * beatMs || 0;
        if (phase === 'playing' && allDone && elapsed > lastBeatMs + 800) {
            endRCGame();
            return;
        }

        rcGameState.animId = requestAnimationFrame(_rcGameLoop);
    }

    /* ── Helper: find local note index within current rep ── */
    function _rcLocalNoteIndex(note, notes, currentRepIndex) {
        let idx = 0;
        for (const n of notes) {
            if (n === note) return idx;
            if (n.repIndex === currentRepIndex) idx++;
            if (n.repIndex > currentRepIndex) break;
        }
        return -1;
    }

    /* ── Canvas fallback game loop (original) ── */
    function _rcGameLoopCanvas() {
        const { canvas, ctx, notes, perfZero, beatMs, totalGameBeats, phase, barBeats, segments, barsSegments } = rcGameState;
        if (!ctx || !canvas) return;

        const now = performance.now();
        const elapsed = now - perfZero;
        const width = canvas.width;
        const height = canvas.height;
        const beatCount = Math.max(4, Math.ceil(barBeats));
        const currentRepIndex = Math.max(0, Math.min(REPS - 1, Math.floor(Math.max(elapsed, 0) / (barBeats * beatMs || 1))));
        const currentSegments = barsSegments ? barsSegments[currentRepIndex] : segments;
        const repStartMs = currentRepIndex * barBeats * beatMs;
        const repElapsed = elapsed - repStartMs;
        const repProgress = Math.max(0, Math.min(1, repElapsed / (barBeats * beatMs || 1)));
        const laneLeft = 44;
        const laneRight = width - 44;
        const laneWidth = Math.max(120, laneRight - laneLeft);
        const laneTop = height * 0.28;
        const laneHeight = 120;
        const laneMid = laneTop + laneHeight / 2;
        const playheadX = laneLeft + laneWidth * repProgress;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        const staffY = laneTop + laneHeight * 0.50;
        const headRx = 9, headRy = 6.5;
        const stemH = 42;
        const beamThick = 5;
        const beamGap = 7;

        const beatX = b => laneLeft + (b / barBeats) * laneWidth;

        function beatLabel(pos) {
            const num = Math.floor(pos) + 1;
            const sub = Math.round((pos % 1) * 4);
            if (sub === 0) return String(num);
            if (sub === 1) return 'e';
            if (sub === 2) return '&';
            if (sub === 3) return 'a';
            return '';
        }

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(laneLeft - 4, staffY);
        ctx.lineTo(laneLeft + laneWidth + 4, staffY);
        ctx.stroke();

        const repNotes = notes.filter(n => n.repIndex === currentRepIndex);
        const labelPositions = new Set();
        repNotes.forEach(n => labelPositions.add(n.localBeatPos));
        segments.filter(s => s.isRest).forEach(s => labelPositions.add(s.start));
        for (let b = 0; b < barBeats; b++) labelPositions.add(b);

        for (let beat = 0; beat <= beatCount; beat++) {
            const x = beatX(beat);
            ctx.strokeStyle = (beat === 0 || beat === beatCount) ? '#000' : 'rgba(0,0,0,0.12)';
            ctx.lineWidth = (beat === 0 || beat === beatCount) ? 1.5 : 0.8;
            ctx.beginPath();
            ctx.moveTo(x, staffY - stemH - 10);
            ctx.lineTo(x, staffY + 10);
            ctx.stroke();
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const countY = staffY - stemH - 14;
        [...labelPositions].sort((a, b) => a - b).forEach(pos => {
            const lbl = beatLabel(pos);
            if (!lbl) return;
            const x = beatX(pos);
            const isMain = pos === Math.floor(pos);
            ctx.font = isMain ? '900 18px Nunito' : '800 15px Nunito';
            ctx.fillStyle = isMain ? 'rgba(59,130,246,0.9)' : 'rgba(59,130,246,0.5)';
            ctx.fillText(lbl, x, countY);
        });

        // Miss detection
        notes.forEach(note => {
            if (note.state === 'waiting' && elapsed - INPUT_LATENCY_MS > note.beatPos * beatMs + WIN_GOOD) {
                note.state = 'miss';
                note.judgment = 'miss';
                rcGameState.counts.miss++;
                rcGameState.combo = 0;
                document.getElementById('rcComboDisplay').textContent = '';
                _rcShowJudgment('MISS', '#EF4444');
            }
        });

        // Rests
        const curSegs = barsSegments ? barsSegments[currentRepIndex] : segments;
        curSegs.filter(seg => seg.isRest).forEach(seg => {
            const cx = beatX(seg.start);
            ctx.save();
            ctx.translate(cx, staffY);
            ctx.fillStyle = '#1E293B';
            ctx.beginPath();
            const s = 1.4;
            ctx.moveTo(-3*s, -16*s); ctx.lineTo(3*s, -10*s); ctx.lineTo(-2*s, -4*s); ctx.lineTo(4*s, 2*s);
            ctx.quadraticCurveTo(2*s, 7*s, -2*s, 8*s); ctx.quadraticCurveTo(2*s, 6*s, 1*s, 3*s);
            ctx.lineTo(-4*s, -3*s); ctx.lineTo(3*s, -9*s); ctx.lineTo(-3*s, -16*s);
            ctx.fill(); ctx.restore();
            ctx.textAlign = 'center'; ctx.font = '700 12px "Noto Sans TC", sans-serif';
            ctx.fillStyle = 'rgba(80,80,80,0.7)'; ctx.textBaseline = 'top';
            ctx.fillText('休止', cx, staffY + 14);
        });

        // Notes
        const segGroups = {};
        repNotes.forEach(note => { const key = note.segmentIndex; if (!segGroups[key]) segGroups[key] = []; segGroups[key].push(note); });

        function drawHead(cx, cy, filled, color) {
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.18);
            ctx.beginPath(); ctx.ellipse(0, 0, headRx, headRy, 0, 0, Math.PI * 2);
            if (filled) { ctx.fillStyle = color; ctx.fill(); }
            else { ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke(); }
            ctx.restore();
        }
        function noteColor(note) {
            if (note.state === 'hit') return '#10B981';
            if (note.state === 'miss') return '#EF4444';
            return '#1E293B';
        }

        Object.values(segGroups).forEach(group => {
            group.sort((a, b) => a.localBeatPos - b.localBeatPos);
            const isBeamed = group.length > 1;
            group.forEach((note) => {
                const cx = beatX(note.localBeatPos);
                const color = noteColor(note);
                const dur = note.durationBeats;
                ctx.globalAlpha = note.state === 'miss' ? 0.45 : 1;
                if (note.state === 'hit' && note.hitTime) {
                    const dt = now - note.hitTime;
                    if (dt < 300) { const ga = 0.35 * (1 - dt / 300); ctx.fillStyle = 'rgba(16,185,129,' + ga + ')'; ctx.beginPath(); ctx.arc(cx, staffY, headRx + 8, 0, Math.PI * 2); ctx.fill(); }
                }
                drawHead(cx, staffY, dur <= 1, color);
                if (dur === 0.75 || dur === 1.5 || dur === 3) { ctx.beginPath(); ctx.arc(cx + headRx + 5, staffY, 2.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
                if (dur < 4) {
                    const stemX = cx + headRx - 1;
                    ctx.strokeStyle = color; ctx.lineWidth = 1.8;
                    ctx.beginPath(); ctx.moveTo(stemX, staffY - headRy + 2); ctx.lineTo(stemX, staffY - stemH); ctx.stroke();
                    if (!isBeamed && dur === 0.5) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(stemX, staffY - stemH); ctx.quadraticCurveTo(stemX + 12, staffY - stemH + 10, stemX + 3, staffY - stemH + 22); ctx.quadraticCurveTo(stemX + 8, staffY - stemH + 14, stemX, staffY - stemH + 8); ctx.fill(); }
                    if (!isBeamed && dur === 0.25) { for (let f = 0; f < 2; f++) { const fy = staffY - stemH + f * (beamGap + 1); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(stemX, fy); ctx.quadraticCurveTo(stemX + 12, fy + 10, stemX + 3, fy + 20); ctx.quadraticCurveTo(stemX + 8, fy + 12, stemX, fy + 7); ctx.fill(); } }
                }
                ctx.fillStyle = note.state === 'hit' ? '#10B981' : '#3C3C3C';
                ctx.font = '600 13px "Noto Sans TC", Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillText(note.label, cx, staffY + 14);
                ctx.globalAlpha = 1;
            });
            if (isBeamed && group.length > 1) {
                const first = group[0], last = group[group.length - 1];
                const x1 = beatX(first.localBeatPos) + headRx - 1;
                const x2 = beatX(last.localBeatPos) + headRx - 1;
                const beamY = staffY - stemH;
                const bColor = group.some(n => n.state === 'hit') ? '#10B981' : group.some(n => n.state === 'miss') ? '#EF4444' : '#1E293B';
                ctx.globalAlpha = group.some(n => n.state === 'miss') ? 0.45 : 1;
                ctx.fillStyle = bColor;
                ctx.fillRect(x1, beamY, x2 - x1, beamThick);
                let si = 0;
                while (si < group.length) {
                    if (group[si].durationBeats <= 0.25) {
                        let sj = si;
                        while (sj < group.length && group[sj].durationBeats <= 0.25) sj++;
                        if (sj - si >= 2) { ctx.fillRect(beatX(group[si].localBeatPos) + headRx - 1, beamY + beamGap, beatX(group[sj-1].localBeatPos) + headRx - 1 - (beatX(group[si].localBeatPos) + headRx - 1), beamThick); }
                        else { const sx = beatX(group[si].localBeatPos) + headRx - 1; const stub = 12; if (si > 0) ctx.fillRect(sx - stub, beamY + beamGap, stub, beamThick); else ctx.fillRect(sx, beamY + beamGap, stub, beamThick); }
                        si = sj;
                    } else { si++; }
                }
                ctx.globalAlpha = 1;
            }
        });

        // Floating judgment text
        repNotes.filter(n => n.state === 'hit' && n.hitTime).forEach(note => {
            const age = now - note.hitTime; if (age > 600) return;
            const cx = beatX(note.localBeatPos);
            const floatY = staffY - stemH - 28 - (age / 600) * 24;
            ctx.globalAlpha = Math.max(0, 1 - age / 600);
            ctx.fillStyle = note.judgmentColor || '#10B981'; ctx.font = '900 15px Nunito'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            const jText = (note.judgment || '').toUpperCase();
            ctx.fillText(jText === 'PERFECT' ? '✦ PERFECT' : jText, cx, floatY);
            ctx.globalAlpha = 1;
        });

        // Playhead
        ctx.strokeStyle = 'rgba(59,130,246,0.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(playheadX, staffY - stemH - 16); ctx.lineTo(playheadX, staffY + 30); ctx.stroke();
        ctx.strokeStyle = 'rgba(59,130,246,0.15)'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(playheadX, staffY - stemH - 16); ctx.lineTo(playheadX, staffY + 30); ctx.stroke();
        ctx.fillStyle = 'rgba(59,130,246,0.8)';
        ctx.beginPath(); ctx.moveTo(playheadX, staffY + 32); ctx.lineTo(playheadX - 5, staffY + 39); ctx.lineTo(playheadX + 5, staffY + 39); ctx.closePath(); ctx.fill();

        if (elapsed > 0) {
            const beatIdx = Math.floor(elapsed / beatMs) % 4;
            if (beatIdx !== rcGameState._lastBeatBox) {
                rcGameState._lastBeatBox = beatIdx;
                document.querySelectorAll('#rcGameBeats .rc-beat-box').forEach((box, idx) => { box.classList.toggle('active', idx === beatIdx); });
                const arm = document.getElementById('rcMetroArm');
                const text = document.getElementById('rcMetronomeText');
                if (arm) { arm.classList.remove('tick-left', 'tick-right'); void arm.offsetWidth; arm.classList.add(beatIdx % 2 === 0 ? 'tick-left' : 'tick-right'); }
                if (text) text.textContent = beatIdx === 0 ? '強拍！' : `第 ${beatIdx + 1} 拍`;
            }
            const repIndex = Math.min(REPS, currentRepIndex + 1);
            if (currentRepIndex !== rcGameState._lastRepIndex) {
                rcGameState._lastRepIndex = currentRepIndex;
                rcGameState._activeSegmentIndex = -1;
                if (barsSegments) {
                    _rcRenderGameTokensFromSegs(barsSegments[currentRepIndex]);
                    document.querySelectorAll('#rcGameTokenRow .rc-game-token').forEach(el => el.classList.remove('active'));
                    const patEl = document.getElementById('rcGamePattern');
                    if (patEl && rcGameState._card.bars) patEl.textContent = rcGameState._card.bars[currentRepIndex];
                    const nextStrip = document.getElementById('rcNextBarStrip');
                    const nextPat   = document.getElementById('rcNextBarPattern');
                    if (nextStrip && nextPat) {
                        const nextIdx = currentRepIndex + 1;
                        if (nextIdx < rcGameState._card.bars.length) { nextPat.textContent = rcGameState._card.bars[nextIdx]; nextStrip.style.display = ''; }
                        else { nextStrip.style.display = 'none'; }
                    }
                }
                document.getElementById('rcGameRep').textContent = barsSegments ? `小節 ${repIndex} / ${REPS}` : `第 ${repIndex} / ${REPS} 次`;
            }
            const beatInBar = (elapsed / beatMs) % barBeats;
            const activeSegmentIndex = currentSegments.findIndex(segment => beatInBar >= segment.start && beatInBar < segment.start + segment.duration);
            if (activeSegmentIndex !== rcGameState._activeSegmentIndex) {
                rcGameState._activeSegmentIndex = activeSegmentIndex;
                document.querySelectorAll('#rcGameTokenRow .rc-game-token').forEach(el => { el.classList.toggle('active', parseInt(el.dataset.segmentIndex || '-1', 10) === activeSegmentIndex); });
            }
        }

        if (elapsed > 0 && totalGameBeats > 0) { const pct = Math.min(elapsed / (totalGameBeats * beatMs) * 100, 100); document.getElementById('rcProgressFill').style.width = pct + '%'; }

        const allDone = notes.every(note => note.state !== 'waiting');
        const lastBeatMs = notes[notes.length - 1]?.beatPos * beatMs || 0;
        if (phase === 'playing' && allDone && elapsed > lastBeatMs + 800) { endRCGame(); return; }

        rcGameState.animId = requestAnimationFrame(_rcGameLoop);
    }

    function onRCHit() {
        if (rcGameState.phase !== 'playing') return;

        audio.playTap();
        const now = performance.now();
        const elapsed = now - rcGameState.perfZero;

        const emoji = document.getElementById('rcHitEmoji');
        if (emoji) {
            emoji.style.transform = 'scale(0.7)';
            setTimeout(() => { emoji.style.transform = ''; }, 120);
        }

        let bestNote = null;
        let bestErr = Infinity;
        rcGameState.notes.forEach(note => {
            if (note.state !== 'waiting') return;
            const { abs } = _compensatedError(elapsed, note.beatPos * rcGameState.beatMs);
            if (abs < bestErr) {
                bestErr = abs;
                bestNote = note;
            }
        });

        if (!bestNote || bestErr > WIN_GOOD) {
            _rcShowJudgment('—', '#aaa');
            rcGameState.combo = 0;
            const comboEl = document.getElementById('rcComboDisplay');
            if (comboEl) { comboEl.textContent = ''; comboEl.style.fontSize = '1rem'; }
            // Screen shake on miss
            const canvasWrap = document.querySelector('.rc-canvas-wrap');
            if (canvasWrap) {
                canvasWrap.style.transition = 'transform 0.06s';
                canvasWrap.style.transform = 'translateX(4px)';
                setTimeout(() => { canvasWrap.style.transform = 'translateX(-4px)'; }, 60);
                setTimeout(() => { canvasWrap.style.transform = ''; canvasWrap.style.transition = ''; }, 120);
            }
            return;
        }

        bestNote.state = 'hit';
        bestNote.hitTime = performance.now();
        rcGameState.combo++;
        if (rcGameState.combo > rcGameState.maxCombo) rcGameState.maxCombo = rcGameState.combo;

        let label;
        let color;
        let pts;
        if (bestErr <= WIN_PERFECT) {
            label = 'PERFECT ✦';
            color = '#10B981';
            pts = 300;
            rcGameState.counts.perfect++;
        } else if (bestErr <= WIN_GREAT) {
            label = 'GREAT';
            color = '#3B82F6';
            pts = 200;
            rcGameState.counts.great++;
        } else {
            label = 'GOOD';
            color = '#ffb74d';
            pts = 100;
            rcGameState.counts.good++;
        }

        const mul = rcGameState.combo >= 20 ? 2.0 : rcGameState.combo >= 10 ? 1.5 : rcGameState.combo >= 5 ? 1.2 : 1.0;
        const earned = Math.round(pts * mul);
        rcGameState.score += earned;
        bestNote.judgment = label.split(' ')[0].toLowerCase();
        bestNote.judgmentColor = color;

        // VexFlow mode: color SVG note green
        if (rcGameState._vf && rcGameState._vfNoteMap) {
            const currentRepIndex = Math.max(0, Math.min(REPS - 1, Math.floor(Math.max(elapsed, 0) / (rcGameState.barBeats * rcGameState.beatMs || 1))));
            const repNoteIdx = _rcLocalNoteIndex(bestNote, rcGameState.notes, currentRepIndex);
            if (rcGameState._vfNoteMap[repNoteIdx]) {
                _vfColorNote(rcGameState._vfNoteMap[repNoteIdx].el, color, 1);
            }
        }

        document.getElementById('rcGameScore').textContent = rcGameState.score;
        // Combo display with milestone celebrations
        const combo = rcGameState.combo;
        const comboEl = document.getElementById('rcComboDisplay');
        if (combo >= 20) {
            comboEl.textContent = `🌟 ${combo} COMBO × 2.0`;
            comboEl.style.color = '#F59E0B';
            comboEl.style.fontSize = '1.3rem';
        } else if (combo >= 10) {
            comboEl.textContent = `🔥 ${combo} COMBO × 1.5`;
            comboEl.style.color = '#EF4444';
            comboEl.style.fontSize = '1.2rem';
        } else if (combo >= 5) {
            comboEl.textContent = `⚡ ${combo} COMBO × 1.2`;
            comboEl.style.color = '#3B82F6';
            comboEl.style.fontSize = '1.1rem';
        } else if (combo >= 2) {
            comboEl.textContent = `🎵 ${combo} COMBO`;
            comboEl.style.color = '#FF8C42';
            comboEl.style.fontSize = '1rem';
        } else {
            comboEl.textContent = '';
        }
        _rcShowJudgment(label + (mul > 1 ? ` ×${mul}` : ''), color);

        // Hit ripple on pad
        const pad = document.getElementById('rcHitPad');
        if (pad) {
            const rip = document.createElement('span');
            rip.className = 'rc-hit-ripple';
            rip.style.borderColor = color;
            rip.style.left = '50%';
            rip.style.top = '50%';
            pad.appendChild(rip);
            rip.addEventListener('animationend', () => rip.remove());
        }
        // Score float near combo
        const wrap = document.querySelector('.rc-canvas-wrap');
        if (wrap) {
            const sf = document.createElement('span');
            sf.className = 'rc-score-float';
            sf.textContent = '+' + earned;
            sf.style.color = color;
            sf.style.left = '50%';
            sf.style.bottom = '60px';
            wrap.appendChild(sf);
            sf.addEventListener('animationend', () => sf.remove());
        }
    }

    function _rcShowJudgment(text, color) {
        const el = document.getElementById('rcJudgmentFlash');
        if (!el) return;
        el.textContent = text;
        el.style.color = color;
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
        clearTimeout(rcGameState._judgeTimer);
        rcGameState._judgeTimer = setTimeout(() => el.classList.remove('show'), 380);
    }

    function _rcTogglePause() {
        const overlay = document.getElementById('rcPauseOverlay');
        if (rcGameState.phase === 'playing') {
            rcGameState.phase = 'paused';
            rcGameState._pauseStart = performance.now();
            overlay.style.display = 'flex';
            if (rcGameState.animId) {
                cancelAnimationFrame(rcGameState.animId);
                rcGameState.animId = null;
            }
        } else if (rcGameState.phase === 'paused') {
            const pausedDuration = performance.now() - (rcGameState._pauseStart || performance.now());
            rcGameState.perfZero += pausedDuration;
            rcGameState._pauseStart = null;
            rcGameState.phase = 'playing';
            overlay.style.display = 'none';
            rcGameState.animId = requestAnimationFrame(_rcGameLoop);
        }
    }

    function _rcExitGame() {
        if (rcGameState.animId) {
            cancelAnimationFrame(rcGameState.animId);
            rcGameState.animId = null;
        }
        if (rcGameState._startTimer) {
            clearTimeout(rcGameState._startTimer);
            rcGameState._startTimer = null;
        }
        _rcCleanupVF();
        _rcRemoveGameKeyHandler();
        audio.stopAllTicks();
        switchScreen('screen-rc-levels');
    }

    function _rcCleanupVF() {
        if (rcGameState._vf) {
            const vfDiv = document.getElementById('rcOsmdContainer');
            if (vfDiv) { vfDiv.style.display = 'none'; vfDiv.innerHTML = ''; }
            const scanner = rcGameState._scanner;
            if (scanner) scanner.style.display = 'none';
            const canvas = document.getElementById('rcGameCanvas');
            if (canvas) canvas.style.display = '';
            rcGameState._vf = false;
            rcGameState._vfNoteMap = null;
        }
    }

    function _rcRemoveGameKeyHandler() {
        if (rcGameState._keyHandler) {
            document.removeEventListener('keydown', rcGameState._keyHandler);
            rcGameState._keyHandler = null;
        }
    }

    function endRCGame() {
        rcGameState.phase = 'done';
        if (rcGameState.animId) {
            cancelAnimationFrame(rcGameState.animId);
            rcGameState.animId = null;
        }
        if (rcGameState._startTimer) {
            clearTimeout(rcGameState._startTimer);
            rcGameState._startTimer = null;
        }
        _rcCleanupVF();
        _rcRemoveGameKeyHandler();
        audio.stopAllTicks();

        const { counts, score, maxCombo, notes } = rcGameState;
        const total = notes.length || 1;
        const hitCount = counts.perfect + counts.great + counts.good;
        const accuracy = Math.round(hitCount / total * 100);
        const qualAcc = Math.round((counts.perfect + counts.great) / total * 100);

        let grade = '🌟 S';
        let gradeMsg = '準確完成。';
        let stars = 3;
        if (qualAcc < 100) { gradeMsg = '超級棒！幾乎完美！✨'; }
        if (qualAcc < 90) { grade = '🥇 A'; gradeMsg = '出色的節奏感！繼續挑戰！'; stars = 2; }
        if (qualAcc < 75) { grade = '🥈 B'; gradeMsg = '表現良好，請繼續練習。'; stars = 2; }
        if (qualAcc < 60) { grade = '🥉 C'; gradeMsg = '請繼續練習。'; stars = 1; }
        if (qualAcc < 40) { stars = 0; }

        // Render star rating
        const starsEl = document.getElementById('rcResultStars');
        starsEl.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const s = document.createElement('span');
            s.className = 'rc-star' + (i < stars ? ' rc-star-on' : '');
            s.textContent = i < stars ? '⭐' : '☆';
            s.style.animationDelay = (i * 0.15) + 's';
            starsEl.appendChild(s);
        }

        // Save best grade per card (only for real cards with a num)
        if (rcGameState._card.num) _rcSaveBestGrade(rcGameState._card.num, qualAcc, score);

        // Record to profile
        if (rcGameState._user) {
            recordGameResult(rcGameState._user, 'game2', score, accuracy, maxCombo, null, counts);
        }

        document.getElementById('rcResultGrade').textContent = grade;
        document.getElementById('rcResultTitle').textContent = gradeMsg;
        document.getElementById('rcResultAccuracy').textContent = `準確度 ${accuracy}%（${hitCount}/${total} 拍）`;
        // Stagger stat items appearance
        const statEls = document.querySelectorAll('#screen-rc-result .rc-stat-item');
        statEls.forEach((el, i) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(16px)';
            setTimeout(() => {
                el.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 200 + i * 100);
        });
        // Counting-up animation for score
        const scoreEl = document.getElementById('rcResScore');
        let countVal = 0;
        const countStep = Math.max(1, Math.ceil(score / 30));
        const countTimer = setInterval(() => {
            countVal = Math.min(countVal + countStep, score);
            scoreEl.textContent = countVal;
            if (countVal >= score) clearInterval(countTimer);
        }, 25);
        document.getElementById('rcResPerfect').textContent = counts.perfect;
        document.getElementById('rcResGreat').textContent = counts.great;
        document.getElementById('rcResGood').textContent = counts.good;
        document.getElementById('rcResMiss').textContent = counts.miss;
        document.getElementById('rcResCombo').textContent = maxCombo;
        document.getElementById('rcResultRecap').innerHTML = '';

        const barEl = document.getElementById('rcAccuracyBar');
        barEl.innerHTML = '';
        [
            { pct: counts.perfect / total * 100, color: '#53cf8a' },
            { pct: counts.great / total * 100, color: '#64b5f6' },
            { pct: counts.good / total * 100, color: '#ffb74d' },
            { pct: counts.miss / total * 100, color: '#ef5350' },
        ].forEach((seg, i) => {
            if (seg.pct <= 0) return;
            const div = document.createElement('div');
            div.className = 'rc-acc-seg';
            div.style.cssText = `width:0%;background:${seg.color};transition:width 0.6s cubic-bezier(.4,0,.2,1) ${0.3 + i * 0.1}s;`;
            barEl.appendChild(div);
            requestAnimationFrame(() => requestAnimationFrame(() => { div.style.width = seg.pct + '%'; }));
        });

        document.getElementById('rcResReplay').textContent = '🔄 再挑戰';
        document.getElementById('rcResReplay').onclick = () => startRCGame(rcGameState._card, rcGameState._bpm, rcGameState._user);
        document.getElementById('rcResBack').textContent  = '← 返回設定';
        document.getElementById('rcResBack').onclick     = () => _openRCDetail(rcGameState._card, rcGameState._user);
        const rankBtn = document.getElementById('rcResViewRank');
        if (rankBtn) rankBtn.style.display = 'none';

        switchScreen('screen-rc-result');
    }

    function renderLocalRankList(gameKey, listId, currentUser, difficulty) {
        const listEl = document.getElementById(listId);
        if (!listEl) return;
        const clsEl = document.getElementById(gameKey === 'game2' ? 'g2RankClass' : gameKey === 'game4' ? 'g4RankClass' : 'g3RankClass');
        const gradeEl = document.getElementById(gameKey === 'game2' ? 'g2RankGrade' : gameKey === 'game4' ? 'g4RankGrade' : 'g3RankGrade');
        // Prefer GAS data; fall back to localStorage if not yet loaded
        let data = state.allRanks.filter(r => r.game === gameKey);
        if (!data.length) data = JSON.parse(localStorage.getItem('musicGameRanks_' + gameKey) || '[]');
        if (clsEl && clsEl.value !== '0') data = data.filter(r => r.class === clsEl.value);
        if (gradeEl && parseInt(gradeEl.value) !== 0) data = data.filter(r => parseInt(r.grade) === parseInt(gradeEl.value));
        if (difficulty) data = data.filter(r => (r.mode_name || '').includes(DIFFICULTY_CONFIG[difficulty]?.label || '') || (r.difficulty || '') === difficulty);
        data.sort((a,b) => (b.score||0) - (a.score||0));
        const seen = new Set();
        data = data.filter(r => {
            const k = `${String(r.name||'').trim()}|${r.grade}|${r.class}|${String(r.id||r.seat||'').trim()}`;
            if (seen.has(k)) return false; seen.add(k); return true;
        });
        const hintId = gameKey === 'game4' ? 'g4RankHint' : gameKey === 'game3' ? 'g3RankHint' : null;
        const hintEl = hintId ? document.getElementById(hintId) : null;
        if (!data.length) {
            if (hintEl) hintEl.style.display = 'none';
            listEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-light);font-weight:800;">暫時未有紀錄🚀</div>'; return;
        }
        if (hintEl) {
            const selfIdx = data.findIndex(r => currentUser && String(r.name||'').trim() === String(currentUser.name||'').trim() && r.class === currentUser.class && String(r.grade) === String(currentUser.grade));
            if (currentUser?.name && selfIdx >= 0) {
                hintEl.innerHTML = `🎯 ${escHtml(currentUser.name)} 同學目前排第 <strong>${selfIdx + 1}</strong> 名`;
                hintEl.style.display = '';
            } else { hintEl.style.display = 'none'; }
        }
        listEl.innerHTML = _rankRewardBanner() + data.map((item,i) => {
            const isSelf = currentUser && String(item.name||'').trim() === String(currentUser.name||'').trim() && item.class === currentUser.class && String(item.grade) === String(currentUser.grade);
            const gradeTxt = item.grade ? `中${['','一','二','三','四','五','六'][item.grade]||item.grade}` : '';
            const seatTxt = (item.id || item.seat) ? `${item.id || item.seat}號` : '';
            return `<div class="rank-item ${i===0?'first':i===1?'second':i===2?'third':''} ${isSelf?'self':''}">
                <div class="rank-pos">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1+'.'}</div>
                <div class="rank-name"><span class="rank-student-name">${escHtml(item.name||'')}</span>
                <div class="rank-badges">
                    ${gradeTxt?`<span class="rank-tag rank-grade-tag">${gradeTxt}</span>`:''}
                    <span class="rank-tag rank-class-tag">${escHtml(item.class||'')}班</span>
                    ${seatTxt?`<span class="rank-tag rank-seat-tag">${seatTxt}</span>`:''}
                    ${isSelf?'<span class="rank-tag" style="background:var(--primary-purple)">我</span>':''}
                    <span class="rank-tag" style="background:#CBD5E1;color:#333;">${item.accuracy||0}% 正確</span>
                </div></div>
                <div class="rank-score">${item.score||0}</div></div>`;
        }).join('');
    }

    // ==========================================
    // 📖 Game 3 — 音樂術語辨識遊戲
    // ==========================================
    // ==========================================
    // 📖 Game 3 — Dynamic Question Generator
    // ==========================================
    // Hand-crafted special questions (key signatures, comparisons, symbol recognition)
    const G3_SPECIAL_Q = {
        easy: [
            { q: '「< 」漸強記號跟哪個術語一樣？', sym: '<', ans: 'cresc.', opts: ['cresc.','decresc.','f','p'], optImgMap: { 'cresc.': 'file:///Users/kenneth/.cursor/projects/Users-kenneth-Desktop-notes/assets/image-ed1c4dc1-77c4-498d-9fff-95295247aad9.png' }, isText: true, explain: '「<」形狀 = 聲音由小到大 = 漸強 = crescendo。' },
            { q: '「> 」漸弱記號跟哪個術語一樣？', sym: '>', ans: 'decresc.', opts: ['cresc.','decresc.','f','p'], isText: true, explain: '「>」形狀 = 聲音由大到小 = 漸弱 = decrescendo。' },
            { q: '以下力度術語由弱到強排序，緊接在「p」後面的是哪個？', sym: 'pp  p  _  mf  f  ff', ans: 'mp', opts: ['mf','mp','ff','pp'], isText: true, explain: '標準排序是 pp → p → mp → mf → f → ff，所以緊接在 p 後面的是 mp。' },
            { q: '以下哪個力度最弱？', sym: 'pp  p  mp', ans: 'pp', opts: ['pp','p','mp','mf'], isText: true, explain: 'pp = pianissimo = 很弱，是三者中最弱的。' },
            { q: '以下哪個力度最強？', sym: 'f  mf  ff', ans: 'ff', opts: ['f','mf','ff','mp'], isText: true, explain: 'ff = fortissimo = 很強，是三者中最強的。' },
            { q: 'C大調的調號有多少個升降號？', ans: '沒有（0個）', opts: ['沒有（0個）','1個升號','1個降號','2個升號'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-0n.png', ksCaption:'<strong class="ks-major">C大調 / a小調</strong>', explain: 'C大調是唯一沒有升降號的大調。' },
            // ── 強弱記號 Q1 ──
            { q: '在音樂中，「f」代表什麼意思？', sym: 'f', ans: '強（Forte）', opts: ['強（Forte）','弱（Piano）','中強（Mezzo-forte）','很強（Fortissimo）'], isText: true, explain: 'f = forte = 強，是最常見的力度記號之一。' },
            // ── 強弱記號 Q2 ──
            { q: '如果你要輕聲唱歌，應該看哪一個力度符號？', sym: 'pp  p  mf  f', ans: 'p', opts: ['p','f','mf','ff'], isText: true, explain: 'p = piano = 弱，代表要輕聲演奏或演唱。' },
            // ── 演奏方式 Q1 ──
            { q: '音符上方或下方有一個小圓點（ · ），代表要怎麼彈奏？', sym: '·', ans: '斷奏（Staccato）', opts: ['斷奏（Staccato）','連奏（Legato）','重音（Accent）','保持音（Tenuto）'], isText: true, explain: '小圓點 = staccato = 斷奏 / 跳音，要把音符彈得短促而分離。' },
            // ── 音樂常識 Q1 ──
            { q: '樂譜開頭那個像大「G」字的符號叫什麼？', sym: '𝄞', ans: '高音譜號（Treble Clef）', opts: ['高音譜號（Treble Clef）','低音譜號（Bass Clef）','中音譜號（Alto Clef）','調號'], isText: true, explain: '高音譜號（Treble Clef）是五線譜最常見的譜號，形狀像大寫 G，圈住第二線（G4）。' },
            // ── 音樂常識 Q2 ──
            { q: '在單線譜（Single-line staff）中，通常是用來練習節奏還是音高？', sym: '— —— — ——', ans: '節奏（Rhythm）', opts: ['節奏（Rhythm）','音高（Pitch）','力度（Dynamics）','音色（Timbre）'], isText: true, explain: '單線譜不標示音高，只顯示節奏型，常用於打擊樂或節奏練習。' },
            // ── 音樂常識 Q3 ──
            { q: '一個四分音符（♩）通常等於幾拍？', sym: '♩', ans: '一拍', opts: ['一拍','兩拍','半拍','四拍'], isText: true, explain: '四分音符是基本拍值單位，在 4/4 拍中等於一拍。' },
            // ── 音樂常識 Q4 ──
            { q: '音符後面跟著一個小圓點（附點），這個音符的長度會變長還是變短？', sym: '♩.', ans: '變長（增加原本音長的一半）', opts: ['變長（增加原本音長的一半）','變短（縮短一半）','長度不變','變成兩倍長'], isText: true, explain: '附點令音符延長原本音值的一半。例如附點四分音符 = 1½ 拍。' },
        ],
        normal: [
            { q: '以下哪個速度最慢？', sym: 'Andante · Allegro · Moderato', ans: 'Andante', opts: ['Andante','Allegro','Moderato','Adagio'], isText: true, explain: 'Adagio < Andante < Moderato < Allegro。Andante 是三者中最慢的。' },
            { q: '以下哪個速度最快？', sym: 'Adagio · Moderato · Allegro', ans: 'Allegro', opts: ['Adagio','Moderato','Allegro','Andante'], isText: true, explain: 'Allegro（快板）是三者中最快的。' },
            // ── 強弱記號 Q3 ──
            { q: '「mf」比「f」還要響亮嗎？', sym: 'mf  vs  f', ans: '不是，mf（中強）比 f 弱', opts: ['不是，mf（中強）比 f 弱','是，mf 比 f 強','兩者一樣響亮','mf 是速度術語，無法比較'], isText: true, explain: 'pp → p → mp → mf → f → ff，mf 排在 f 之前，所以比 f 弱。' },
            // ── 強弱記號 Q4 ──
            { q: '聲音由小漸漸變大，這個術語叫做什麼？', sym: '<', ans: '漸強（Crescendo）', opts: ['漸強（Crescendo）','漸弱（Decrescendo）','突強（Sforzando）','回原速（A tempo）'], isText: true, explain: '「<」形狀由窄到寬，代表聲音由弱漸強 = crescendo（漸強）。' },
            // ── 速度術語 Q1 ──
            { q: '「Allegro」在音樂中通常代表什麼樣的速度？', sym: 'Allegro', ans: '快板（快速、活潑地）', opts: ['快板（快速、活潑地）','慢板（很慢）','中板（適中）','急板（極快）'], isText: true, explain: 'Allegro = 快板，是最常見的速度術語之一，代表快速而活潑的速度。' },
            // ── 速度術語 Q3 ──
            { q: '如果曲子最後要「逐漸慢下來」，符號通常會寫成什麼？', sym: 'rit.', ans: 'rit.（Ritardando / 漸慢）', opts: ['rit.（Ritardando / 漸慢）','accel.（Accelerando / 漸快）','a tempo（回原速）','Presto（急板）'], isText: true, explain: 'rit. = ritardando = 漸慢，指示演奏者逐漸放慢速度。' },
            // ── 速度術語 Q4 ──
            { q: '「Moderato」的意思是？', sym: 'Moderato', ans: '中板（適中、中等速度）', opts: ['中板（適中、中等速度）','快板（快速）','慢板（很慢）','急板（極快）'], isText: true, explain: 'Moderato = 中板，速度適中，介乎快慢之間。' },
            // ── 演奏方式 Q3 ──
            { q: '「Fine」出現在樂譜末尾附近，代表什麼意思？', sym: 'Fine', ans: '樂曲結束', opts: ['樂曲結束','從頭再奏','重複演奏','從記號重奏'], isText: true, explain: 'Fine（讀作 fee-nay）= 終止，是樂曲結束的標記。' },
            // ── 演奏方式 Q4 ──
            { q: '兩道雙槓加上兩個圓點（ ‖: :‖ ），代表什麼指令？', sym: '‖: :‖', ans: '重複記號（重複演奏一段）', opts: ['重複記號（重複演奏一段）','樂曲結束','從頭再奏','速度加快'], isText: true, explain: '‖: :‖ = 反覆記號，要把括號內的樂段重複演奏一次。' },
            { q: '「rit.」和「accel.」是甚麼關係？', sym: 'rit. ↔ accel.', ans: '相反（漸慢 vs 漸快）', opts: ['相反（漸慢 vs 漸快）','意思一樣','一個是力度一個是速度','沒有關係'], isText: true, explain: 'rit. = 漸慢，accel. = 漸快，兩者相反。' },
            { q: '「反覆記號」的作用是甚麼？', sym: '|: :|', ans: '重複演奏一段', opts: ['樂曲結束','重複演奏一段','從頭再奏','從記號重奏'], isText: true, explain: '|: :| = 將括號內的樂段重複演奏一次。' },
            { q: '這個調號是哪個大調？', ans: 'G大調', opts: ['C大調','G大調','D大調','F大調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-1s.png', ksCaption:'<span class="ks-notes">升 Fa</span>', explain: 'G大調有1個升號，升Fa（F♯）。' },
            { q: 'G大調的關係小調是哪個？', ans: 'e小調', opts: ['a小調','e小調','b小調','d小調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-1s.png', ksCaption:'<strong class="ks-major">G大調</strong>', explain: 'G大調的關係小調是e小調。' },
            { q: '這個調號是哪個大調？', ans: 'F大調', opts: ['C大調','G大調','F大調','B♭大調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-1f.png', ksCaption:'<span class="ks-notes">降 Si</span>', explain: 'F大調有1個降號，降Si（B♭）。' },
            { q: 'F大調的關係小調是哪個？', ans: 'd小調', opts: ['a小調','d小調','g小調','e小調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-1f.png', ksCaption:'<strong class="ks-major">F大調</strong>', explain: 'F大調的關係小調是d小調。' },
        ],
        hard: [
            { q: '以下哪個速度最慢？', sym: 'Largo · Adagio · Presto', ans: 'Largo', opts: ['Largo','Adagio','Presto','Allegro'], isText: true, explain: 'Largo（廣板）是所有速度術語中最慢的之一。' },
            // ── 速度術語 Q2 ──
            { q: '慢板的義大利文術語是什麼？', sym: '慢板', ans: 'Adagio', opts: ['Adagio','Allegro','Moderato','Vivace'], isText: true, explain: 'Adagio = 柔板（很慢），是常見的慢速術語。Lento 同樣表示慢，但 Adagio 更常用。' },
            // ── 演奏方式 Q2 ──
            { q: '音符上面有一條橫線（ — ），代表保持音長並加重，這叫什麼？', sym: '—', ans: '保持音（Tenuto）', opts: ['保持音（Tenuto）','斷奏（Staccato）','延長號（Fermata）','重音（Accent）'], isText: true, explain: 'Tenuto（保持音）= 橫線符號，指示演奏者保持該音的完整時值，並稍作強調。' },
            { q: '以下哪個速度最快？', sym: 'Vivace · Allegro · Presto', ans: 'Presto', opts: ['Vivace','Allegro','Presto','Moderato'], isText: true, explain: 'Presto（急板）是三者中最快的。' },
            { q: '「D.C. al Fine」代表怎樣演奏？', sym: 'D.C. al Fine', ans: '從頭再奏至 Fine 結束', opts: ['從頭再奏至 Fine 結束','從記號重奏','直接結束','跳至尾聲'], isText: true, explain: 'D.C. = 從頭再奏，al Fine = 直到標記 Fine 處結束。' },
            { q: '「D.S. al Coda」代表怎樣演奏？', sym: 'D.S. al Coda', ans: '從記號重奏至 Coda 跳尾聲', opts: ['從記號重奏至 Coda 跳尾聲','從頭再奏','直接結束','重複一次'], isText: true, explain: 'D.S. = 從 Segno 記號重奏，al Coda = 到 Coda 記號跳尾聲。' },
            { q: '「molto」加在術語前代表甚麼？', sym: 'molto forte', ans: '非常（加強程度）', opts: ['非常（加強程度）','一點點','不太','稍微'], isText: true, explain: 'molto = 非常/很多，molto forte = 非常強。' },
            { q: '「poco a poco」代表甚麼？', sym: 'poco a poco', ans: '逐漸地', opts: ['突然','逐漸地','很快','一次過'], isText: true, explain: 'poco a poco = 一點一點地 = 逐漸地。' },
            { q: '這個調號是哪個大調？', ans: 'D大調', opts: ['D大調','A大調','E大調','G大調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-2s.png', ksCaption:'<span class="ks-notes">升 Fa、Do</span>', explain: 'D大調有2個升號。' },
            { q: 'D大調的關係小調是哪個？', ans: 'b小調', opts: ['e小調','b小調','f♯小調','g小調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-2s.png', ksCaption:'<strong class="ks-major">D大調</strong>', explain: 'D大調的關係小調是b小調。' },
            { q: '這個調號是哪個大調？', ans: 'B♭大調', opts: ['B♭大調','E♭大調','A♭大調','F大調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-2f.png', ksCaption:'<span class="ks-notes">降 Si、Mi</span>', explain: 'B♭大調有2個降號。' },
            { q: 'B♭大調的關係小調是哪個？', ans: 'g小調', opts: ['d小調','g小調','c小調','f小調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-2f.png', ksCaption:'<strong class="ks-major">B♭大調</strong>', explain: 'B♭大調的關係小調是g小調。' },
            { q: '這個調號是哪個大調？', ans: 'A大調', opts: ['A大調','E大調','D大調','G大調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-3s.png', ksCaption:'<span class="ks-notes">升 Fa、Do、Sol</span>', explain: 'A大調有3個升號。' },
            { q: 'A大調的關係小調是哪個？', ans: 'f♯小調', opts: ['b小調','f♯小調','c♯小調','e小調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-3s.png', ksCaption:'<strong class="ks-major">A大調</strong>', explain: 'A大調的關係小調是f♯小調。' },
            { q: '這個調號是哪個大調？', ans: 'E♭大調', opts: ['B♭大調','E♭大調','A♭大調','G大調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-3f.png', ksCaption:'<span class="ks-notes">降 Si、Mi、La</span>', explain: 'E♭大調有3個降號。' },
            { q: 'E♭大調的關係小調是哪個？', ans: 'c小調', opts: ['d小調','g小調','c小調','f小調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-3f.png', ksCaption:'<strong class="ks-major">E♭大調</strong>', explain: 'E♭大調的關係小調是c小調。' },
            { q: '這個調號是哪個大調？', ans: 'E大調', opts: ['D大調','E大調','A大調','B大調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-4s.png', ksCaption:'<span class="ks-notes">升 Fa Do Sol Re</span>', explain: '4個升號 = E大調。' },
            { q: '這個調號是哪個大調？', ans: 'A♭大調', opts: ['E♭大調','A♭大調','D♭大調','B♭大調'], ksImg:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-4f.png', ksCaption:'<span class="ks-notes">降 Si Mi La Re</span>', explain: 'A♭大調有4個降號。' },
        ]
    };

    // Grade ranges for each difficulty tier
    const G3_GRADE_RANGE = {
        easy:   [1, 2],   // 中一至中二
        normal: [1, 4],   // 中一至中四
        hard:   [3, 6],   // 小三至小六
        expert: [1, 6],   // 全部
        p1:     [1, 6],   // 中一：最難（全部術語）
        p2:     [1, 6],   // 中二：最難（全部術語）
        p3:     [1, 3],   // 中一至中三
        p4:     [1, 4],   // 中一至中四
        p5:     [1, 5],   // 中一至中五
        p6:     [1, 6],   // 中一至中六
    };

    // Distractor pools grouped by category
    const G3_DISTRACTOR_POOLS = {
        dynamics:     ['強','弱','中強','中弱','很強','很弱','漸強','漸弱','突強','強後即弱'],
        tempo:        ['廣板（極慢）','莊板（極慢）','柔板（很慢）','行板（中慢）','小行板（稍慢）','中板','小快板','快板','活潑地（快）','急板（極快）','漸慢','漸快','回原速','更快地'],
        articulation: ['連奏','斷奏','重音','持音（保持音值）','延長號','強奏'],
        form:         ['重複演奏一段','第一/二次結尾','從頭再奏','從記號重奏','樂曲結束'],
        expression:   ['如歌地','甜美地','有表情地','雄壯地','嬉戲地','平靜地'],
    };

    // Generate questions dynamically from FULL_TERMS_TABLE
    function g3GenerateQuestions(difficulty) {
        const [gradeMin, gradeMax] = G3_GRADE_RANGE[difficulty] || [1, 6];
        // Filter terms by grade range (exclude keysig — handled by special Q)
        const terms = FULL_TERMS_TABLE.filter(t =>
            t.grade >= gradeMin && t.grade <= gradeMax && t.cat !== 'keysig'
        );

        const questions = [];

        for (const t of terms) {
            const pool = G3_DISTRACTOR_POOLS[t.cat] || [];
            const distractors = pool.filter(d => d !== t.meaning);

            // --- Type 1: "What does [symbol] mean?" (術語→意思) ---
            if (distractors.length >= 3) {
                const shuffled = distractors.slice().sort(() => Math.random() - 0.5);
                const wrongOpts = shuffled.slice(0, 3);
                const allOpts = [t.meaning, ...wrongOpts].sort(() => Math.random() - 0.5);
                const qObj = {
                    q: `「${t.sym}」代表甚麼？`,
                    sym: t.sym,
                    ans: t.meaning,
                    opts: allOpts,
                };
                if (t.img) qObj.img = t.img;
                questions.push(qObj);
            }

            // --- Type 2: "Which term means [meaning]?" (意思→術語) — reverse ---
            // Only for terms with unique Italian names
            if (t.cat !== 'form' && t.name && distractors.length >= 2) {
                const sameCatTerms = terms.filter(x => x.cat === t.cat && x.name !== t.name);
                if (sameCatTerms.length >= 3) {
                    const wrongNames = sameCatTerms.sort(() => Math.random() - 0.5).slice(0, 3).map(x => x.name);
                    const allOpts = [t.name, ...wrongNames].sort(() => Math.random() - 0.5);
                    questions.push({
                        q: `哪個術語代表「${t.meaning}」？`,
                        sym: t.meaning,
                        ans: t.name,
                        opts: allOpts,
                        isText: true,
                    });
                }
            }
        }

        // Add special hand-crafted questions for this difficulty
        const specials = G3_SPECIAL_Q[difficulty] || [];
        // For normal: use easy + medium specials; for expert: use all
        let allSpecials = specials;
        if (difficulty === 'normal') allSpecials = (G3_SPECIAL_Q.easy || []).concat(specials);
        if (difficulty === 'expert') allSpecials = (G3_SPECIAL_Q.easy || []).concat(G3_SPECIAL_Q.normal || [], G3_SPECIAL_Q.hard || []);

        questions.push(...allSpecials);
        return questions;
    }

    const G3_DIFF_POOL = {
        easy:   () => g3GenerateQuestions('easy'),
        normal: () => g3GenerateQuestions('normal'),
        hard:   () => g3GenerateQuestions('hard'),
        expert: () => g3GenerateQuestions('expert'),
        p1:     () => g3GenerateQuestions('p1'),
        p2:     () => g3GenerateQuestions('p2'),
        p3:     () => g3GenerateQuestions('p3'),
        p4:     () => g3GenerateQuestions('p4'),
        p5:     () => g3GenerateQuestions('p5'),
        p6:     () => g3GenerateQuestions('p6'),
    };

    const TERMS_GRADE_BANK = { 1:'hard', 2:'hard', 3:'normal', 4:'normal', 5:'hard', 6:'hard' };

    // ==========================================
    // 📚 完整音樂術語參考表資料
    // ==========================================
    // Inline SVG snippets for form/記號 cards
    const FORM_SVG = {
        '‖: :‖': `<svg viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg" class="study-keysig-svg"><line x1="20" y1="8" x2="20" y2="44" stroke="#222" stroke-width="1.2"/><line x1="23" y1="8" x2="23" y2="44" stroke="#222" stroke-width="3.5"/><circle cx="28" cy="18" r="2.2" fill="#222"/><circle cx="28" cy="26" r="2.2" fill="#222"/><line x1="67" y1="8" x2="67" y2="44" stroke="#222" stroke-width="3.5"/><line x1="70" y1="8" x2="70" y2="44" stroke="#222" stroke-width="1.2"/><circle cx="62" cy="18" r="2.2" fill="#222"/><circle cx="62" cy="26" r="2.2" fill="#222"/></svg>`,
        '1.  2.': `<svg viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg" class="study-keysig-svg"><line x1="10" y1="8" x2="10" y2="34" stroke="#555" stroke-width="1.4"/><line x1="10" y1="8" x2="42" y2="8" stroke="#555" stroke-width="1.4"/><text x="14" y="22" font-size="12" font-weight="900" fill="#333" font-family="sans-serif">1.</text><line x1="48" y1="8" x2="48" y2="34" stroke="#555" stroke-width="1.4"/><line x1="48" y1="8" x2="80" y2="8" stroke="#555" stroke-width="1.4"/><text x="52" y="22" font-size="12" font-weight="900" fill="#333" font-family="sans-serif">2.</text></svg>`,
        'D.C.': `<svg viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg" class="study-keysig-svg"><text x="10" y="38" font-size="22" font-weight="900" fill="#5B2D8E" font-family="serif" font-style="italic">D.C.</text><path d="M 72 14 L 82 14 L 82 46 L 72 46" stroke="#5B2D8E" stroke-width="2" fill="none"/><line x1="82" y1="14" x2="82" y2="46" stroke="#5B2D8E" stroke-width="4"/></svg>`,
        'D.S.': `<svg viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg" class="study-keysig-svg"><text x="10" y="38" font-size="22" font-weight="900" fill="#C05B00" font-family="serif" font-style="italic">D.S.</text><text x="71" y="40" font-size="24" font-weight="900" fill="#C05B00" font-family="serif">𝄋</text></svg>`,
        'Fine': `<svg viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg" class="study-keysig-svg"><text x="12" y="40" font-size="26" font-weight="900" fill="#B00020" font-family="serif" font-style="italic">Fine</text><line x1="72" y1="10" x2="72" y2="46" stroke="#B00020" stroke-width="1.5"/><line x1="75" y1="10" x2="75" y2="46" stroke="#B00020" stroke-width="4"/></svg>`,
    };

    const FULL_TERMS_TABLE = [
        // 力度 (Dynamics)
        { cat:'dynamics', sym:'pp',        name:'Pianissimo',   meaning:'很弱',           grade:2, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-pp.png' },
        { cat:'dynamics', sym:'p',         name:'Piano',        meaning:'弱',             grade:1, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-p.png' },
        { cat:'dynamics', sym:'mp',        name:'Mezzo-piano',  meaning:'中弱',           grade:1, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-mp.png' },
        { cat:'dynamics', sym:'mf',        name:'Mezzo-forte',  meaning:'中強',           grade:1, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-mf.png' },
        { cat:'dynamics', sym:'f',         name:'Forte',        meaning:'強',             grade:1, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-f.png' },
        { cat:'dynamics', sym:'ff',        name:'Fortissimo',   meaning:'很強',           grade:2, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-ff.png' },
        { cat:'dynamics', sym:'sf',        name:'Sforzando',    meaning:'突強',           grade:4, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-sf.png' },
        { cat:'dynamics', sym:'fp',        name:'Forte-piano',  meaning:'強後即弱',       grade:5, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-fp.png' },
        { cat:'dynamics', sym:'cresc.',    name:'Crescendo',    meaning:'漸強',           grade:2, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-cresc.png' },
        { cat:'dynamics', sym:'decresc.',  name:'Decrescendo',  meaning:'漸弱',           grade:2, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-decresc.png' },
        // 速度 (Tempo)
        { cat:'tempo',    sym:'Largo',     name:'Largo',        meaning:'廣板（極慢）',   grade:5 },
        { cat:'tempo',    sym:'Grave',     name:'Grave',        meaning:'莊板（極慢）',   grade:6 },
        { cat:'tempo',    sym:'Adagio',    name:'Adagio',       meaning:'柔板（很慢）',   grade:3 },
        { cat:'tempo',    sym:'Andante',   name:'Andante',      meaning:'行板（中慢）',   grade:2 },
        { cat:'tempo',    sym:'Andantino', name:'Andantino',    meaning:'小行板（稍慢）', grade:6 },
        { cat:'tempo',    sym:'Moderato',  name:'Moderato',     meaning:'中板',           grade:3 },
        { cat:'tempo',    sym:'Allegretto',name:'Allegretto',   meaning:'小快板',         grade:6 },
        { cat:'tempo',    sym:'Allegro',   name:'Allegro',      meaning:'快板',           grade:2 },
        { cat:'tempo',    sym:'Vivace',    name:'Vivace',       meaning:'活潑地（快）',   grade:5 },
        { cat:'tempo',    sym:'Presto',    name:'Presto',       meaning:'急板（極快）',   grade:5 },
        { cat:'tempo',    sym:'rit.',      name:'Ritardando',   meaning:'漸慢',           grade:4 },
        { cat:'tempo',    sym:'accel.',    name:'Accelerando',  meaning:'漸快',           grade:4 },
        { cat:'tempo',    sym:'a tempo',   name:'A tempo',      meaning:'回原速',         grade:4 },
        { cat:'tempo',    sym:'più mosso', name:'Più mosso',    meaning:'更快地',         grade:6 },
        // 奏法 (Articulation)
        { cat:'articulation', sym:'⌢',   name:'Legato',    meaning:'連奏',             grade:2 },
        { cat:'articulation', sym:'·',   name:'Staccato',  meaning:'斷奏',             grade:2, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-art-staccato.png' },
        { cat:'articulation', sym:'>',   name:'Accent',    meaning:'重音',             grade:3, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-art-accent.png' },
        { cat:'articulation', sym:'—',   name:'Tenuto',    meaning:'持音（保持音值）', grade:5, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-art-tenuto.png' },
        { cat:'articulation', sym:'𝄐',   name:'Fermata',   meaning:'延長號',           grade:5, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-art-fermata.png' },
        { cat:'articulation', sym:'^',   name:'Marcato',   meaning:'強奏',             grade:6 },
        // 調號 (Key Signatures) — use extracted PDF images
        { cat:'keysig', sym:'0♯ 0♭', name:'C大調 / a小調', meaning:'無升降號',         grade:1, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-0n.png' },
        { cat:'keysig', sym:'1♯',    name:'G大調 / e小調', meaning:'升 Fa（F♯）',      grade:3, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-1s.png' },
        { cat:'keysig', sym:'2♯',    name:'D大調 / b小調', meaning:'升 Fa、Do',        grade:4, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-2s.png' },
        { cat:'keysig', sym:'3♯',    name:'A大調 / f♯小調',meaning:'升 Fa、Do、Sol',   grade:5, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-3s.png' },
        { cat:'keysig', sym:'4♯',    name:'E大調 / c♯小調',meaning:'升 Fa Do Sol Re', grade:6, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-4s.png' },
        { cat:'keysig', sym:'1♭',    name:'F大調 / d小調', meaning:'降 Si（B♭）',      grade:3, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-1f.png' },
        { cat:'keysig', sym:'2♭',    name:'B♭大調 / g小調',meaning:'降 Si、Mi',        grade:4, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-2f.png' },
        { cat:'keysig', sym:'3♭',    name:'E♭大調 / c小調',meaning:'降 Si、Mi、La',    grade:5, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-3f.png' },
        { cat:'keysig', sym:'4♭',    name:'A♭大調 / f小調',meaning:'降 Si Mi La Re',   grade:6, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/keysig-4f.png' },
        // 曲式記號 (Form/Repeat)
        { cat:'form', sym:'‖: :‖',  name:'反覆記號',  meaning:'重複演奏一段', grade:2, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-bar-repeat-start.png' },
        { cat:'form', sym:'1.  2.', name:'第一/二括', meaning:'第一/二次結尾',grade:3 },
        { cat:'form', sym:'D.C.',   name:'Da Capo',   meaning:'從頭再奏',     grade:4 },
        { cat:'form', sym:'D.S.',   name:'Dal Segno', meaning:'從記號重奏',   grade:4, img:'https://raw.githubusercontent.com/kennethchan6392-hash/notes/main/img/cards/sym-sym-segno.png' },
        { cat:'form', sym:'Fine',   name:'Fine',      meaning:'樂曲結束',     grade:4 },
        // 情緒/表情 (Expression/Character)
        { cat:'expression', sym:'cantabile',  name:'Cantabile',  meaning:'如歌地',   grade:5 },
        { cat:'expression', sym:'dolce',      name:'Dolce',      meaning:'甜美地',   grade:5 },
        { cat:'expression', sym:'espressivo', name:'Espressivo', meaning:'有表情地', grade:6 },
        { cat:'expression', sym:'maestoso',   name:'Maestoso',   meaning:'雄壯地',   grade:6 },
        { cat:'expression', sym:'giocoso',    name:'Giocoso',    meaning:'嬉戲地',   grade:6 },
        { cat:'expression', sym:'tranquillo', name:'Tranquillo', meaning:'平靜地',   grade:6 },
    ];

    const CAT_LABELS = { dynamics:'力度', tempo:'速度', articulation:'奏法', keysig:'調號', form:'記號', expression:'情緒' };

    let g3StudyActiveCat = 'all';
    let g3StudyActiveGrade = 0;

    function renderStudyGrid() {
        const grid = document.getElementById('g3TermsGrid');
        if (!grid) return;
        const filtered = FULL_TERMS_TABLE.filter(t =>
            (g3StudyActiveCat === 'all' || t.cat === g3StudyActiveCat) &&
            (g3StudyActiveGrade === 0 || t.grade === g3StudyActiveGrade)
        );
        if (filtered.length === 0) {
            grid.innerHTML = '<div class="study-terms-empty">此篩選條件下沒有術語 🎵</div>';
            return;
        }
        grid.innerHTML = filtered.map(t => {
            let visual = '';
            if (t.img) {
                visual = `<img src="${escHtml(t.img)}" class="study-term-img" alt="${escHtml(t.sym)}" loading="lazy">`;
            } else if (t.cat === 'form' && FORM_SVG[t.sym]) {
                visual = FORM_SVG[t.sym];
            } else {
                visual = `<div class="study-term-sym">${escHtml(t.sym)}</div>`;
            }
            const showSym = (t.img || t.cat === 'keysig' || t.cat === 'form') ? '' : '';
            const nameHtml = t.cat === 'keysig'
                ? `<div class="study-term-name study-ks-name"><strong>${escHtml(t.name)}</strong></div>`
                : `<div class="study-term-name">${escHtml(t.name)}</div>`;
            const meaningHtml = t.cat === 'keysig'
                ? `<div class="study-term-meaning study-ks-notes">${escHtml(t.meaning)}</div>`
                : `<div class="study-term-meaning">${escHtml(t.meaning)}</div>`;
            const speakKey = G3_PRONUNCIATION[t.name] || G3_PRONUNCIATION[t.sym] || '';
            const audioHtml = speakKey
                ? `<button class="study-audio-btn" data-speak="${escHtml(speakKey)}" title="播放發音">🔊</button>`
                : '';
            return `<div class="study-term-card cat-${escHtml(t.cat)}">
                ${audioHtml}
                ${visual}
                ${nameHtml}
                ${meaningHtml}
            </div>`;
        }).join('');
    }

    function openStudyScreen() {
        g3StudyActiveCat = 'all';
        g3StudyActiveGrade = 0;
        // Reset tab/grade button states
        document.querySelectorAll('.study-tab').forEach(b => b.classList.toggle('active', b.dataset.cat === 'all'));
        document.querySelectorAll('.study-grade-btn').forEach(b => b.classList.toggle('active', b.dataset.grade === '0'));
        renderStudyGrid();
        switchScreen('screen-g3-study');
    }

    // 🔊 Event delegation for study card audio buttons
    document.getElementById('g3TermsGrid').addEventListener('click', function(e) {
        const btn = e.target.closest('.study-audio-btn');
        if (!btn) return;
        const text = btn.dataset.speak;
        if (!text || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'it-IT';
        utter.rate = 0.85;
        btn.classList.add('playing');
        utter.onend = () => btn.classList.remove('playing');
        utter.onerror = () => btn.classList.remove('playing');
        window.speechSynthesis.speak(utter);
    });

    // Tab & grade filter listeners (set up once)
    document.querySelectorAll('.study-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            g3StudyActiveCat = btn.dataset.cat;
            document.querySelectorAll('.study-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderStudyGrid();
        });
    });
    document.querySelectorAll('.study-grade-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            g3StudyActiveGrade = Number(btn.dataset.grade);
            document.querySelectorAll('.study-grade-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderStudyGrid();
        });
    });
    document.getElementById('g3StudyBack').addEventListener('click', () => switchScreen('screen-g3-setup'));
    document.getElementById('g3StudyStartBtn').addEventListener('click', () => switchScreen('screen-g3-setup'));

    // Rank filter listeners — set up once (use current game state for user)
    document.getElementById('g3RankClass').addEventListener('change', () => renderLocalRankList('game3','g3RankList', g3State.user, g3State.difficulty));
    document.getElementById('g3RankGrade').addEventListener('change', () => renderLocalRankList('game3','g3RankList', g3State.user, g3State.difficulty));
    document.getElementById('g4RankClass').addEventListener('change', () => renderLocalRankList('game4','g4RankList', g4State?.user));
    document.getElementById('g4RankGrade').addEventListener('change', () => renderLocalRankList('game4','g4RankList', g4State?.user));

    let g3State = {};
    let g3TimerHandle = null;

    function makeKeySigSvg(count, type) {
        // Staff lines: 5 lines, y = 12 20 28 36 44 (gap=8), bottom=E4 top=F5
        // Sharp order F C G D A E B → positions on treble staff
        const sharpY = [12, 24,  8, 20, 32, 16, 28]; // F5 C5 G5 D5 A4 E5 B4
        // Flat order  B E A D G C F → positions on treble staff
        const flatY  = [28, 16, 32, 20, 36, 24, 40]; // B4 E5 A4 D5 G4 C5 F4
        const positions = type === 'sharp' ? sharpY : flatY;
        const sym = type === 'sharp' ? '\u266F' : '\u266D'; // ♯ or ♭
        const xStart = 26, xGap = 16;
        const W = Math.max(xStart + (count - 1) * xGap + 36, 80);
        const H = 60;
        const lineY = [12, 20, 28, 36, 44];
        const staff = lineY.map(y =>
            `<line x1="4" y1="${y}" x2="${W - 4}" y2="${y}" stroke="#555" stroke-width="1.3"/>`
        ).join('');
        const dy = type === 'sharp' ? 7 : 9; // baseline offset to centre on staff position
        const accs = Array.from({length: count}, (_, i) => {
            const x = xStart + i * xGap;
            const y = positions[i];
            return `<text x="${x}" y="${y + dy}" font-size="19" font-weight="900" fill="#1E293B" font-family="serif" text-anchor="middle">${sym}</text>`;
        }).join('');
        return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="keysig-quiz-svg">${staff}${accs}</svg>`;
    }

    // 🔊 Italian pronunciation map (symbol → full Italian word)
    const G3_PRONUNCIATION = {
        'f':'forte','p':'piano','mf':'mezzo forte','mp':'mezzo piano',
        'ff':'fortissimo','pp':'pianissimo','cresc.':'crescendo','decresc.':'decrescendo',
        'Forte':'forte','Piano':'piano','sfz':'sforzando','sf':'sforzando',
        'fp':'forte piano',
        'rit.':'ritardando','accel.':'accelerando',
        'D.C.':'Da Capo','D.S.':'Dal Segno','Fine':'fine',
        'a tempo':'a tempo','legato':'legato','cantabile':'cantabile',
        'staccato':'staccato','molto forte':'molto forte','poco a poco':'poco a poco',
        'Andante':'andante','Allegro':'allegro','Adagio':'adagio',
        'Moderato':'moderato','Presto':'presto','Largo':'largo',
        'Andantino':'andantino','Allegretto':'allegretto','Vivace':'vivace',
        'Grave':'grave','più mosso':'più mosso',
        'dolce':'dolce','espressivo':'espressivo','maestoso':'maestoso',
        'giocoso':'giocoso','tranquillo':'tranquillo',
        // Capitalized name lookups for study cards
        'Pianissimo':'pianissimo','Mezzo-piano':'mezzo piano','Mezzo-forte':'mezzo forte',
        'Fortissimo':'fortissimo','Sforzando':'sforzando','Forte-piano':'forte piano',
        'Crescendo':'crescendo','Decrescendo':'decrescendo',
        'Ritardando':'ritardando','Accelerando':'accelerando',
        'A tempo':'a tempo','Più mosso':'più mosso',
        'Legato':'legato','Staccato':'staccato','Accent':'accento',
        'Tenuto':'tenuto','Fermata':'fermata','Marcato':'marcato',
        'Da Capo':'da capo','Dal Segno':'dal segno',
        'Cantabile':'cantabile','Dolce':'dolce','Espressivo':'espressivo',
        'Maestoso':'maestoso','Giocoso':'giocoso','Tranquillo':'tranquillo',
        '第一/二括':'primo e secondo','反覆記號':'ripetizione',
    };

    let g3CurrentSym = null;

    function g3PlayAudio() {
        if (!g3CurrentSym) return;
        const text = G3_PRONUNCIATION[g3CurrentSym] || g3CurrentSym;
        // Only speak if it looks like a real word (not just symbols)
        if (!text || /^[<>·—𝜺𝐐|:\s‖]+$/.test(text)) return;
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'it-IT';
            utter.rate = 0.85;
            utter.pitch = 1;
            const btn = document.getElementById('g3AudioBtn');
            if (btn) btn.classList.add('playing');
            utter.onend = () => { if (btn) btn.classList.remove('playing'); };
            utter.onerror = () => { if (btn) btn.classList.remove('playing'); };
            window.speechSynthesis.speak(utter);
        }
    }

    document.getElementById('g3AudioBtn').addEventListener('click', g3PlayAudio);

    function startGame3(user, mode, difficulty) {
        mode = mode || 'challenge';
        difficulty = difficulty || 'easy';
        const isChallenge = mode === 'challenge';
        markProfilePlayStart();
        g3State = { user, mode, difficulty, score: 0, combo: 0, maxCombo: 0, qIdx: 0, wrong: 0, correct: 0, questions: [], totalTime: isChallenge ? 60 : Infinity, globalTimeLeft: isChallenge ? 60 : Infinity, mistakes: [] };
        if (g3TimerHandle) clearInterval(g3TimerHandle);
        audio.init(); audio.warmUp();

        const pool = (G3_DIFF_POOL[difficulty] || G3_DIFF_POOL.easy)();
        // For challenge mode, we need a large shuffled pool; recycle if needed
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        g3State.questions = pool;
        g3State._pool = pool; // keep reference for recycling

        const modeLabel = isChallenge ? '⏱️ 限時挑戰 (60秒)' : '📝 練習模式';
        const diffEmoji = (DIFFICULTY_CONFIG[difficulty] || {}).emoji || '';
        document.getElementById('g3User').textContent = `👋 ${user.name} 同學 — 術語識辨 ${modeLabel} ${diffEmoji}`;
        document.getElementById('g3EndBtn').onclick = () => endGame3();
        document.getElementById('g3BackBtn').onclick = () => { if (g3TimerHandle) clearInterval(g3TimerHandle); switchScreen('screen-hub'); };
        switchScreen('screen-game3');

        // Start global countdown for challenge mode
        if (isChallenge) {
            const timerEl = document.getElementById('g3Timer');
            const g3timerFill = document.getElementById('g3TimerFill');
            if (g3timerFill) { g3timerFill.style.width = '100%'; g3timerFill.classList.remove('urgent'); }
            const updateGlobalTimer = () => {
                if (timerEl) timerEl.textContent = g3State.globalTimeLeft + 's';
                const pct = (g3State.globalTimeLeft / g3State.totalTime) * 100;
                if (g3timerFill) { g3timerFill.style.width = pct + '%'; if (g3State.globalTimeLeft <= 10) g3timerFill.classList.add('urgent'); else g3timerFill.classList.remove('urgent'); }
                if (timerEl) { if (g3State.globalTimeLeft <= 10) timerEl.style.color = 'var(--primary-red)'; else timerEl.style.color = ''; }
            };
            updateGlobalTimer();
            g3TimerHandle = setInterval(() => {
                g3State.globalTimeLeft--;
                updateGlobalTimer();
                if (g3State.globalTimeLeft <= 0) {
                    clearInterval(g3TimerHandle); g3TimerHandle = null;
                    document.querySelectorAll('.quiz-opt-btn').forEach(b => b.disabled = true);
                    setTimeout(() => endGame3(), 400);
                }
            }, 1000);
        }
        renderG3Question();
    }

    function _getG3Question() {
        // Get next question, recycle pool if exhausted
        if (g3State.qIdx >= g3State.questions.length) {
            // Reshuffle and reset index
            const pool = g3State._pool.slice();
            for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
            g3State.questions = pool;
            g3State.qIdx = 0;
        }
        return g3State.questions[g3State.qIdx];
    }

    function renderG3Question() {
        const isChallenge = g3State.mode === 'challenge';
        // For challenge, check if time is up
        if (isChallenge && g3State.globalTimeLeft <= 0) { endGame3(); return; }
        // For practice, stop after 10 questions
        if (!isChallenge && g3State.qIdx >= 10) { endGame3(); return; }

        const q = _getG3Question();
        const totalAnswered = g3State.correct + g3State.wrong;
        if (isChallenge) {
            document.getElementById('g3Progress').textContent = `${totalAnswered}題`;
            document.getElementById('g3QNum').textContent = `已答 ${totalAnswered} 題`;
        } else {
            document.getElementById('g3Progress').textContent = `${g3State.qIdx+1}/10`;
            document.getElementById('g3QNum').textContent = `第 ${g3State.qIdx+1} 題 / 共 10 題`;
        }
        document.getElementById('g3Score').textContent = g3State.score;
        document.getElementById('g3Combo').textContent = g3State.combo;

        // Progress bar for practice mode only
        const g3pfill = document.getElementById('g3ProgressFill');
        if (g3pfill) g3pfill.style.width = (isChallenge ? 0 : (g3State.qIdx / 10) * 100) + '%';

        // Timer for practice mode (no per-question timer, show infinity)
        if (!isChallenge) {
            const timerEl = document.getElementById('g3Timer');
            const g3timerFill = document.getElementById('g3TimerFill');
            if (timerEl) timerEl.textContent = '∞';
            if (g3timerFill) g3timerFill.style.width = '100%';
        }

        document.getElementById('g3Question').textContent = q.q;
        // 🔊 Audio button: show only when there's a speakable term
        const audioBtn = document.getElementById('g3AudioBtn');
        const sym = q.sym || '';
        const hasSpeakable = sym && !/^[<>·—𝜺𝐐|:\s‖]+$/.test(sym) && (G3_PRONUNCIATION[sym] || /[a-zA-Z]/.test(sym));
        g3CurrentSym = hasSpeakable ? sym : null;
        if (audioBtn) audioBtn.classList.toggle('hidden', !hasSpeakable);

        document.getElementById('g3Visual').innerHTML = q.ksImg
            ? `<div class="ks-quiz-visual"><img src="${escHtml(q.ksImg)}" class="ks-card-img" alt="調號卡" loading="eager">${q.ksCaption ? `<div class="ks-quiz-caption">${q.ksCaption}</div>` : ''}</div>`
            : q.keySig
            ? makeKeySigSvg(q.keySig.count, q.keySig.type)
            : q.img
            ? `<img src="${escHtml(q.img)}" class="quiz-card-img" alt="${escHtml(q.sym || '')}" loading="eager">`
            : `<div class="term-display term-italic">${escHtml(q.sym || '')}</div>`;
        // Fallback: if card image fails to load, show the symbol as text
        const visualEl = document.getElementById('g3Visual');
        const imgEl = visualEl && visualEl.querySelector('img.quiz-card-img');
        if (imgEl) { const sym_ = q.sym || ''; imgEl.onerror = () => { imgEl.outerHTML = `<div class="term-display term-italic">${escHtml(sym_)}</div>`; }; }
        document.getElementById('g3Message').textContent = '📖 快速選出正確答案！';
        document.getElementById('g3Message').className = 'message-box';

        const optEl = document.getElementById('g3Options');
        optEl.innerHTML = '';
        const G3_LETTERS = ['A', 'B', 'C', 'D'];
        q.opts.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-opt-btn';
            btn.dataset.answer = opt;
            const optImg = q.optImgMap && q.optImgMap[opt];
            const optContent = optImg
                ? `<img src="${escHtml(optImg)}" class="quiz-opt-img" alt="${escHtml(opt)}" loading="eager">`
                : escHtml(opt);
            btn.innerHTML = `<span class="opt-letter">${G3_LETTERS[i]}</span><span class="opt-text">${optContent}</span>`;
            btn.addEventListener('click', () => handleG3Answer(opt, q.ans, btn, q));
            optEl.appendChild(btn);
        });
    }

    function handleG3Answer(chosen, correct, btn, q) {
        const isCorrect = chosen === correct;
        document.querySelectorAll('.quiz-opt-btn').forEach(b => b.disabled = true);
        const msgEl = document.getElementById('g3Message');
        if (isCorrect) {
            btn.classList.add('correct');
            g3State.combo++;
            g3State.correct++;
            if (g3State.combo > g3State.maxCombo) g3State.maxCombo = g3State.combo;
            let pts = 10;
            if (g3State.combo >= 5) pts += 10;
            g3State.score += pts;
            audio.playEffect && audio.playEffect('countdown');
            msgEl.textContent = `✅ 答對！+${pts} 分`;
            msgEl.className = 'message-box correct';
        } else {
            btn.classList.add('wrong');
            document.querySelectorAll('.quiz-opt-btn').forEach(b => { if (b.dataset.answer === correct) b.classList.add('correct'); });
            g3State.combo = 0; g3State.wrong++;
            g3State.mistakes.push({ q: q.q, sym: q.sym, chosen, correct, explain: q.explain || '' });
            audio.playEffect && audio.playEffect('wrong');
            const explainText = q.explain ? `　💡 ${q.explain}` : '';
            msgEl.textContent = `❌ 答錯！正確答案是「${correct}」${explainText}`;
            msgEl.className = 'message-box wrong';
        }
        document.getElementById('g3Score').textContent = g3State.score;
        document.getElementById('g3Combo').textContent = g3State.combo;
        g3State.qIdx++;
        const _isChallenge = g3State.mode === 'challenge';
        setTimeout(() => renderG3Question(), _isChallenge ? 980 : 1300);
    }

    function endGame3() {
        if (g3TimerHandle) { clearInterval(g3TimerHandle); g3TimerHandle = null; }
        const { user, score, wrong, maxCombo, mode, difficulty, correct: correctCount } = g3State;
        const totalAnswered = (correctCount || 0) + wrong;
        const correct = correctCount || 0;
        let finalScore = score;
        if (mode !== 'practice' && wrong === 0 && totalAnswered > 0) finalScore += 20; // all correct bonus
        g3State.score = finalScore;
        const accuracy = totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0;
        const diffLabel = (DIFFICULTY_CONFIG[difficulty] || {}).label || 'Easy';
        if (mode !== 'practice') {
            saveLocalRank('game3', user, finalScore, accuracy, maxCombo, difficulty);
            submitScoreToGAS('game3', user, finalScore, accuracy, maxCombo, '術語識辨·' + diffLabel);
            recordGameResult(user, 'game3', finalScore, accuracy, maxCombo, difficulty);
        } else {
            _consumeProfilePlaySecs();
        }

        const practiceNote = mode === 'practice' ? '<div style="text-align:center;color:var(--text-light);font-size:0.85rem;margin-top:6px;">📝 練習模式成績不計入排行榜</div>' : '';
        document.getElementById('g3ReportGrid').innerHTML = `
            <div class="report-item"><div class="report-label">答題數</div><div class="report-value">${totalAnswered}</div></div>
            <div class="report-item"><div class="report-label">得分</div><div class="report-value">${finalScore}</div></div>
            <div class="report-item"><div class="report-label">正確率</div><div class="report-value">${accuracy}%</div></div>
            <div class="report-item"><div class="report-label">答錯</div><div class="report-value" style="color:var(--primary-red)">${wrong}</div></div>
            <div class="report-item"><div class="report-label">最高連對</div><div class="report-value">${maxCombo}</div></div>` + practiceNote;
        document.getElementById('g3Weakness').innerHTML = wrong === 0
            ? '<div>🌟 全部答對！你是術語識辨小專家！🎉</div>'
            : `<div>請繼續練習。正確 ${correct}/${totalAnswered} 題。</div>`;

        // Render mistake review
        const g3MistakeEl = document.getElementById('g3MistakeReview');
        if (g3MistakeEl) {
            if (g3State.mistakes.length > 0) {
                g3MistakeEl.innerHTML = '<div class="mistake-review-title">📝 錯題回顧</div>' +
                    g3State.mistakes.map(m => `<div class="mistake-item">
                        <div class="mistake-q">${escHtml(m.q)}</div>
                        <div class="mistake-detail"><span class="mistake-wrong">你的答案：${escHtml(String(m.chosen))}</span> → <span class="mistake-correct">正確：${escHtml(String(m.correct))}</span></div>
                        ${m.explain ? `<div class="mistake-explain">💡 ${escHtml(m.explain)}</div>` : ''}
                    </div>`).join('');
            } else {
                g3MistakeEl.innerHTML = '';
            }
        }

        renderLocalRankList('game3', 'g3RankList', user, difficulty);
        if (mode !== 'practice') setTimeout(() => loadRanks(2, { force: true }).then(() => renderLocalRankList('game3', 'g3RankList', user, difficulty)).catch(()=>{}), 800);
        document.getElementById('g3PlayAgain').onclick = () => switchScreen('screen-g3-setup');
        document.getElementById('g3BackToHub').onclick = () => switchScreen('screen-g3-setup');
        const g3Layout = document.getElementById('g3LeaderboardLayout');
        if (g3Layout) g3Layout.classList.remove('view-only');
        const g3RBack = document.getElementById('g3ResultBack');
        if (g3RBack) g3RBack.style.display = 'none';
        switchScreen('screen-game3-result');
    }

    // ==========================================
    // 遊戲四：樂器識辨 (Instrument Identification)
    // ==========================================

    // 遊戲四樂器庫與部件標註由 data/instrument-bank.json / data/instrument-structure.json 提供，
    // 由 bootstrap-instruments.js 先 fetch 並設於 window 後再執行本檔。
    const INSTRUMENT_BANK = window.__INSTRUMENT_BANK__ || [];
    const INSTRUMENT_STRUCTURE = window.__INSTRUMENT_STRUCTURE__ || {};

    const INSTRUMENT_MAP = new Map(INSTRUMENT_BANK.map(i => [i.id, i]));  // O(1) lookup
    // Pre-index: instruments that have card/photo images (not SVG/emoji-only)
    const G4_IMG_POOL = INSTRUMENT_BANK.filter(i => i.img && /\.(png|jpg|jpeg|avif|webp)$/i.test(i.img));

    function g4SpinFrames(inst) {
        return inst && Array.isArray(inst.frames) && inst.frames.length > 1 ? inst.frames : null;
    }

    function g4SpinHtml(frames, imgClass) {
        const list = frames.map(f => String(f).replace(/[|"<>]/g, ''));
        const imgs = list.map((src, i) =>
            `<img class="${imgClass}${i ? '' : ' is-on'}" src="${src}" alt="" draggable="false" decoding="async">`
        ).join('');
        return `<div class="g4-spin">${imgs}</div>`;
    }

    function g4InstImgHtml(inst, imgClass, alt) {
        const frames = g4SpinFrames(inst);
        if (frames) return g4SpinHtml(frames, imgClass);
        if (!inst || !inst.img) return '';
        return `<img class="${imgClass}" src="${inst.img}" alt="${alt || ''}" loading="lazy">`;
    }

    function g4ClearSpins(root) {
        if (!root) return;
        root.querySelectorAll('.g4-spin').forEach(el => {
            if (el._spinTimer) clearInterval(el._spinTimer);
        });
    }

    function g4BindSpins(root) {
        if (!root) return;
        root.querySelectorAll('.g4-spin').forEach(el => {
            if (el.dataset.bound) return;
            el.dataset.bound = '1';
            const pics = [...el.querySelectorAll('img')];
            if (pics.length < 2) return;
            let idx = 0;
            let drag = false;
            let x0 = 0;
            let i0 = 0;
            let raf = 0;
            let lastX = 0;
            const show = (n) => {
                const next = ((n % pics.length) + pics.length) % pics.length;
                if (next === idx) return;
                pics[idx].classList.remove('is-on');
                idx = next;
                pics[idx].classList.add('is-on');
            };
            el.addEventListener('pointerdown', (e) => {
                drag = true;
                x0 = lastX = e.clientX;
                i0 = idx;
                el.classList.add('is-drag');
                try { el.setPointerCapture(e.pointerId); } catch (err) {}
            });
            el.addEventListener('pointermove', (e) => {
                if (!drag) return;
                lastX = e.clientX;
                if (raf) return;
                raf = requestAnimationFrame(() => {
                    raf = 0;
                    const w = Math.max(120, el.getBoundingClientRect().width);
                    show(i0 + Math.round((lastX - x0) / (w / pics.length)));
                });
            });
            const end = () => {
                drag = false;
                el.classList.remove('is-drag');
                if (raf) { cancelAnimationFrame(raf); raf = 0; }
            };
            el.addEventListener('pointerup', end);
            el.addEventListener('pointercancel', end);
        });
    }

    // Sound source descriptions per family (Q4: 靠甚麼發聲？)
    const SOUND_SOURCE_MAP = {
        strings:   '弓拉或撥動弦線',
        woodwind:  '吹氣通過管口或簧片',
        brass:     '嘴唇振動吹入管口',
        percussion:'敲擊使物體振動',
        keyboard:  '按鍵觸動機械或電路',
    };
    // Percussion instruments that have fixed pitch (Q3: 有固定音高嗎？)
    const PERCUSSION_HAS_PITCH = new Set(['timpani','xylophone','glockenspiel','marimba','vibraphone']);

    // Question type weights: [type, weight]
    const G4_Q_TYPES = [
        ['image-name',       0.30],  // 這是甚麼樂器？ (image → name)
        ['name-image',       0.25],  // 哪張是…？ (name → pick image)
        ['name-family',      0.27],  // 屬於哪個樂器家族？ (name → family)
        ['percussion-pitch', 0.08],  // 有固定音高嗎？ (percussion only)
        ['sound-source',     0.10],  // 靠甚麼方式發聲？ (image → sound method)
    ];

    let g4State = null;

    /** Weighted random pick from G4_Q_TYPES, returns type string */
    function pickG4Type() {
        const total = G4_Q_TYPES.reduce((s, t) => s + t[1], 0);
        let r = Math.random() * total;
        for (const [type, w] of G4_Q_TYPES) { r -= w; if (r <= 0) return type; }
        return G4_Q_TYPES[G4_Q_TYPES.length - 1][0];
    }

    /** Pick n distractor instrument objects for name-image type, prefer same-family */
    function pickImgDistractors(correct, pool, n) {
        const sameFamily = shuffle(pool.filter(p => p.id !== correct.id && p.family === correct.family));
        const diffFamily = shuffle(pool.filter(p => p.id !== correct.id && p.family !== correct.family));
        const result = [];
        for (const p of sameFamily) { if (result.length >= Math.min(2, n)) break; result.push(p); }
        for (const p of diffFamily) { if (result.length >= n) break; result.push(p); }
        return result.slice(0, n);
    }

    /** Generate balanced distractors — prefer same-family, then cross-family, guaranteed unique */
    function pickDistractors(correct, pool, field, n) {
        const answer = correct[field];
        const sameFamily = shuffle(pool.filter(p => p.family === correct.family && p[field] !== answer));
        const diffFamily = shuffle(pool.filter(p => p.family !== correct.family && p[field] !== answer));
        const seen = new Set([answer]);
        const wrongs = [];
        // Pick 1-2 from same family for plausible distractors
        for (const p of sameFamily) {
            if (wrongs.length >= Math.min(2, n)) break;
            if (!seen.has(p[field])) { seen.add(p[field]); wrongs.push(p[field]); }
        }
        // Fill rest from different families
        for (const p of diffFamily) {
            if (wrongs.length >= n) break;
            if (!seen.has(p[field])) { seen.add(p[field]); wrongs.push(p[field]); }
        }
        return wrongs.slice(0, n);
    }

    function generateG4Questions(count) {
        const pool = INSTRUMENT_BANK;
        const percPool = pool.filter(i => i.family === 'percussion');
        const imgPool = G4_IMG_POOL;
        const videoPool = pool.filter(i => i.video);
        const questions = [];
        const recentIds = [];
        const recentWindow = Math.min(8, Math.floor(pool.length * 0.5));
        const allSoundSources = Object.values(SOUND_SOURCE_MAP);

        for (let i = 0; i < count; i++) {
            const type = pickG4Type();
            let correct, safety = 0;

            // Select instrument based on type constraints
            if (type === 'percussion-pitch') {
                do { correct = percPool[Math.floor(Math.random() * percPool.length)]; safety++; }
                while (recentIds.includes(correct.id) && safety < 20);
            } else if (type === 'image-name' || type === 'sound-source') {
                do { correct = imgPool[Math.floor(Math.random() * imgPool.length)]; safety++; }
                while (recentIds.includes(correct.id) && safety < 30);
            } else if (type === 'listen-name') {
                const listenPool = videoPool.length ? videoPool : pool;
                do { correct = listenPool[Math.floor(Math.random() * listenPool.length)]; safety++; }
                while (recentIds.includes(correct.id) && safety < 30);
            } else {
                do { correct = pool[Math.floor(Math.random() * pool.length)]; safety++; }
                while (recentIds.includes(correct.id) && safety < 30);
            }

            recentIds.push(correct.id);
            if (recentIds.length > recentWindow) recentIds.shift();

            let opts, answerKey, imgOptions = null;
            if (type === 'listen-name') {
                answerKey = correct.nameZh;
                const wrongs = pickDistractors(correct, pool, 'nameZh', 3);
                opts = shuffle([answerKey, ...wrongs]);
            } else if (type === 'image-name') {
                answerKey = correct.nameZh;
                const wrongs = pickDistractors(correct, pool, 'nameZh', 3);
                opts = shuffle([answerKey, ...wrongs]);
            } else if (type === 'name-image') {
                answerKey = correct.id;
                const wrongInstrs = pickImgDistractors(correct, imgPool, 3);
                imgOptions = shuffle([correct, ...wrongInstrs]);
                opts = imgOptions.map(i => i.id);
            } else if (type === 'name-family') {
                answerKey = correct.familyZh;
                const allFamilies = ['弦樂', '木管', '銅管', '敲擊', '鍵盤'];
                const wrongFamilies = shuffle(allFamilies.filter(f => f !== answerKey));
                opts = shuffle([answerKey, ...wrongFamilies.slice(0, 3)]);
            } else if (type === 'percussion-pitch') {
                const hasPitch = PERCUSSION_HAS_PITCH.has(correct.id);
                answerKey = hasPitch ? '有固定音高' : '沒有固定音高';
                opts = ['有固定音高', '沒有固定音高'];
            } else { // sound-source
                answerKey = SOUND_SOURCE_MAP[correct.family];
                const wrongs = shuffle(allSoundSources.filter(s => s !== answerKey));
                opts = shuffle([answerKey, ...wrongs.slice(0, 3)]);
            }

            questions.push({ instrument: correct, type, answer: answerKey, options: opts, imgOptions });
        }
        return questions;
    }

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function startGame4(user, mode) {
        const count = mode === 'practice' ? 10 : 999;
        const questions = generateG4Questions(Math.min(count, 40));
        markProfilePlayStart();

        g4State = {
            user, mode,
            questions, currentIdx: 0,
            score: 0, combo: 0, maxCombo: 0,
            counts: { correct: 0, wrong: 0 },
            mistakes: [],
            familyStats: {
                strings: { correct: 0, total: 0 },
                woodwind: { correct: 0, total: 0 },
                brass: { correct: 0, total: 0 },
                percussion: { correct: 0, total: 0 },
                keyboard: { correct: 0, total: 0 },
            },
            startTime: Date.now(),
            timeLeft: mode === 'challenge' ? 60 : null,
            timerId: null,
            answered: false,
        };

        // HUD
        const gradeLabels = ['','中一','中二','中三','中四','中五','中六'];
        document.getElementById('g4User').textContent = `👋 ${gradeLabels[user.grade] || ''}${user.class}班 · ${user.name}`;
        document.getElementById('g4Score').textContent = '0';
        document.getElementById('g4Combo').textContent = '0';
        document.getElementById('g4Timer').textContent = mode === 'challenge' ? '60' : '--';
        document.getElementById('g4Message').textContent = '🎻 準備好就點選答案！';

        // Timer for challenge
        if (mode === 'challenge') {
            g4State.timerId = setInterval(() => {
                g4State.timeLeft--;
                document.getElementById('g4Timer').textContent = g4State.timeLeft;
                const pct = (g4State.timeLeft / 60) * 100;
                document.getElementById('g4TimerFill').style.width = pct + '%';
                if (g4State.timeLeft <= 10) {
                    document.getElementById('g4TimerFill').style.background = '#FF4A6B';
                }
                if (g4State.timeLeft <= 0) {
                    clearInterval(g4State.timerId);
                    g4State.timerId = null;
                    endGame4();
                }
            }, 1000);
        }

        document.getElementById('g4EndBtn').onclick = () => endGame4();
        document.getElementById('g4BackBtn').onclick = () => {
            if (g4State.timerId) clearInterval(g4State.timerId);
            if (g4State._nextTimer) clearTimeout(g4State._nextTimer);
            switchScreen('screen-hub');
        };

        switchScreen('screen-game4');
        renderG4Question();
    }

    function g4AdvanceNext() {
        if (!g4State || g4State._advancing) return;
        g4State._advancing = true;
        if (g4State._nextTimer) { clearTimeout(g4State._nextTimer); g4State._nextTimer = null; }
        g4State.currentIdx++;
        if (g4State.mode === 'challenge' && g4State.currentIdx >= g4State.questions.length) {
            const more = generateG4Questions(20);
            g4State.questions = g4State.questions.concat(more);
        }
        renderG4Question();
    }

    function renderG4Question() {
        if (!g4State || g4State.currentIdx >= g4State.questions.length) {
            endGame4();
            return;
        }
        g4State.answered = false;
        g4State._advancing = false;
        const q = g4State.questions[g4State.currentIdx];
        const total = g4State.mode === 'practice' ? g4State.questions.length : '∞';
        const num = g4State.currentIdx + 1;

        document.getElementById('g4QNum').textContent = `第 ${num} 題${g4State.mode === 'practice' ? ' / 共 ' + total + ' 題' : ''}`;
        const pct = g4State.mode === 'practice' ? (num / g4State.questions.length) * 100 : 0;
        document.getElementById('g4ProgressFill').style.width = pct + '%';
        document.getElementById('g4Progress').textContent = g4State.mode === 'practice' ? `${num}/${total}` : `已答 ${num - 1}`;

        const audioBtn = document.getElementById('g4AudioBtn');
        const visualEl = document.getElementById('g4Visual');
        g4ClearSpins(visualEl);
        const questionEl = document.getElementById('g4Question');

        // Reset audio btn
        audioBtn.style.display = 'none';
        audioBtn.onclick = null;

        // --- Audio helper ---
        const setupAudio = () => {
            audioBtn.style.display = '';
            audioBtn.onclick = () => {
                audio.playInstrumentSound(q.instrument.id);
                audioBtn.classList.add('playing');
                setTimeout(() => audioBtn.classList.remove('playing'), 600);
            };
            setTimeout(() => audio.playInstrumentSound(q.instrument.id), 300);
        };

        if (q.type === 'listen-name') {
            questionEl.textContent = '🎵 聽一聽，這是什麼樂器？';
            const videoSrc = q.instrument.video;
            visualEl.innerHTML = `
                <div class="g4-listen-placeholder" id="g4ListenPlaceholder">
                    <div class="g4-listen-icon">🎵</div>
                    <div class="g4-listen-hint">點擊播放演奏示範</div>
                </div>
                <div id="g4ListenFrame" style="display:none;text-align:center;"></div>
            `;
            const loadFrame = () => {
                const placeholder = document.getElementById('g4ListenPlaceholder');
                const frame = document.getElementById('g4ListenFrame');
                if (!frame) return;
                if (videoSrc) {
                    frame.innerHTML = `<iframe src="${videoSrc}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen style="width:100%;max-width:320px;height:180px;border-radius:12px;border:none;"></iframe>`;
                    frame.style.display = '';
                    if (placeholder) placeholder.style.display = 'none';
                }
            };
            const placeholderEl = document.getElementById('g4ListenPlaceholder');
            if (placeholderEl) placeholderEl.onclick = loadFrame;
            audioBtn.style.display = '';
            audioBtn.onclick = () => {
                const frame = document.getElementById('g4ListenFrame');
                if (frame && frame.querySelector('iframe')) {
                    const iframe = frame.querySelector('iframe');
                    const s = iframe.src; iframe.src = ''; iframe.src = s;
                } else {
                    loadFrame();
                }
                audioBtn.classList.add('playing');
                setTimeout(() => audioBtn.classList.remove('playing'), 3000);
            };
            setTimeout(loadFrame, 400);
        } else if (q.type === 'image-name') {
            questionEl.textContent = '🖼️ 這是甚麼樂器？';
            visualEl.innerHTML = g4InstImgHtml(q.instrument, 'g4-visual-img', '樂器圖片');
        } else if (q.type === 'name-image') {
            questionEl.textContent = `🎯「${q.instrument.nameZh}」是哪一種樂器？點選正確圖片！`;
            visualEl.innerHTML = `<div class="g4-visual-hint" style="font-size:1rem;font-weight:700;margin-top:6px;">${q.instrument.nameEn}</div>`;
        } else if (q.type === 'name-family') {
            questionEl.textContent = `「${q.instrument.nameZh}」屬於哪個樂器家族？`;
            visualEl.innerHTML = g4InstImgHtml(q.instrument, 'g4-visual-img', q.instrument.nameZh) +
                `<div class="g4-visual-hint" style="font-size:1.1rem;font-weight:700;margin-top:8px;">${q.instrument.nameEn}</div>` +
                `<div class="g4-visual-hint" style="margin-top:4px;">${q.instrument.desc}</div>`;
        } else if (q.type === 'percussion-pitch') {
            questionEl.textContent = `「${q.instrument.nameZh}」有固定音高嗎？`;
            visualEl.innerHTML = g4InstImgHtml(q.instrument, 'g4-visual-img', '樂器圖片');
        } else if (q.type === 'sound-source') {
            questionEl.textContent = `「${q.instrument.nameZh}」靠甚麼方式發聲？`;
            visualEl.innerHTML = g4InstImgHtml(q.instrument, 'g4-visual-img', '樂器圖片');
        }

        // Render options
        const optEl = document.getElementById('g4Options');
        optEl.innerHTML = '';

        if (q.type === 'name-image' && q.imgOptions) {
            optEl.classList.add('g4-img-opts');
            q.imgOptions.forEach(instr => {
                const btn = document.createElement('button');
                btn.className = 'quiz-opt-btn g4-img-opt-btn';
                btn.dataset.optVal = instr.id;
                btn.innerHTML = `<img src="${instr.img}" alt="樂器圖片" loading="lazy">`;
                btn.onclick = (e) => { e.stopPropagation(); handleG4Answer(instr.id, q.answer, btn, q); };
                optEl.appendChild(btn);
            });
        } else {
            optEl.classList.remove('g4-img-opts');
            q.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'quiz-opt-btn';
                btn.textContent = opt;
                btn.onclick = (e) => { e.stopPropagation(); handleG4Answer(opt, q.answer, btn, q); };
                optEl.appendChild(btn);
            });
        }
        g4BindSpins(visualEl);
    }

    function handleG4Answer(chosen, correct, btn, q) {
        if (!g4State || g4State.answered) return;
        g4State.answered = true;

        const isCorrect = chosen === correct;
        const family = q.instrument.family;
        g4State.familyStats[family].total++;

        // Highlight buttons
        document.querySelectorAll('#g4Options .quiz-opt-btn').forEach(b => {
            b.disabled = true;
            const bVal = b.dataset.optVal !== undefined ? b.dataset.optVal : b.textContent;
            if (bVal === correct) b.classList.add('correct');
            if (b === btn && !isCorrect) b.classList.add('wrong');
        });

        if (isCorrect) {
            g4State.counts.correct++;
            g4State.combo++;
            if (g4State.combo > g4State.maxCombo) g4State.maxCombo = g4State.combo;
            g4State.familyStats[family].correct++;
            const comboBonus = Math.floor(g4State.combo / 5) * 2;
            const pts = 10 + comboBonus;
            g4State.score += pts;
            document.getElementById('g4Message').textContent = `✅ 回答正確。+${pts}分`;
            audio.playEffect('countdown');
        } else {
            g4State.counts.wrong++;
            g4State.combo = 0;
            const qLabel = q.type === 'listen-name' ? `聽一聽，這是${q.instrument.nameZh}嗎？`
                : q.type === 'name-family' ? `${q.instrument.nameZh}屬於哪個樂器家族？`
                : q.type === 'percussion-pitch' ? `${q.instrument.nameZh}有固定音高嗎？`
                : q.type === 'sound-source' ? `${q.instrument.nameZh}靠甚麼方式發聲？`
                : q.type === 'name-image' ? `哪一張是「${q.instrument.nameZh}」？`
                : `這是甚麼樂器？（${q.instrument.desc}）`;
            const chosenLabel = q.type === 'name-image'
                ? (INSTRUMENT_BANK.find(i => i.id === chosen)?.nameZh || chosen) : chosen;
            const correctLabel = q.type === 'name-image' ? q.instrument.nameZh : correct;
            // For listen-name: stop video and reveal instrument image
            if (q.type === 'listen-name') {
                const frame = document.getElementById('g4ListenFrame');
                if (frame) { const iframe = frame.querySelector('iframe'); if (iframe) iframe.src = ''; }
                const visualEl2 = document.getElementById('g4Visual');
                if (visualEl2 && q.instrument.img) {
                    g4ClearSpins(visualEl2);
                    visualEl2.innerHTML = g4InstImgHtml(q.instrument, 'g4-visual-img', q.instrument.nameZh);
                    g4BindSpins(visualEl2);
                } else if (visualEl2) {
                    visualEl2.innerHTML = `<div class="g4-visual-hint" style="font-size:1.1rem;font-weight:700;">${q.instrument.nameZh}<br><span style="font-size:0.85rem;font-weight:400;color:var(--text-light)">${q.instrument.nameEn}</span></div>`;
                }
            }
            const explainMap = {
                'listen-name':      `正確答案是${q.instrument.nameZh}（${q.instrument.nameEn}）`,
                'name-family':      `${q.instrument.nameZh}（${q.instrument.nameEn}）屬於${q.instrument.familyZh}家族`,
                'percussion-pitch': `${q.instrument.nameZh}${PERCUSSION_HAS_PITCH.has(q.instrument.id) ? '有' : '沒有'}固定音高`,
                'sound-source':     `${q.instrument.nameZh}的發聲方式：${SOUND_SOURCE_MAP[q.instrument.family]}`,
                'image-name':       `正確答案是${q.instrument.nameZh}（${q.instrument.nameEn}）`,
                'name-image':       `正確答案是${q.instrument.nameZh}（${q.instrument.nameEn}）`,
            };
            g4State.mistakes.push({
                q: qLabel,
                chosen: chosenLabel, correct: correctLabel,
                explain: explainMap[q.type] || ''
            });
            const correctDisplay = q.type === 'name-image' ? q.instrument.nameZh : correct;
            document.getElementById('g4Message').textContent = `❌ 正確答案：${correctDisplay}`;
            audio.playEffect('wrong');
        }

        document.getElementById('g4Score').textContent = g4State.score;
        document.getElementById('g4Combo').textContent = g4State.combo;

        g4State._advancing = false;
        g4State._nextTimer = setTimeout(() => g4AdvanceNext(), isCorrect ? 1000 : 2000);
    }

    function endGame4() {
        if (!g4State) return;
        if (g4State.timerId) { clearInterval(g4State.timerId); g4State.timerId = null; }
        if (g4State._nextTimer) { clearTimeout(g4State._nextTimer); g4State._nextTimer = null; }

        const { user, mode, score, maxCombo, counts, familyStats, mistakes } = g4State;
        const totalAnswered = counts.correct + counts.wrong;
        const accuracy = totalAnswered > 0 ? Math.round((counts.correct / totalAnswered) * 100) : 0;
        const practiceNote = mode === 'practice' ? '<div class="report-item"><div class="report-label">模式</div><div class="report-value">📝 練習</div></div>' : '';

        document.getElementById('g4ReportGrid').innerHTML =
            `<div class="report-item"><div class="report-label">答對題數</div><div class="report-value">${counts.correct} / ${totalAnswered}</div></div>` +
            `<div class="report-item"><div class="report-label">準確率</div><div class="report-value">${accuracy}%</div></div>` +
            `<div class="report-item"><div class="report-label">總分</div><div class="report-value">${score}</div></div>` +
            `<div class="report-item"><div class="report-label">最高連對</div><div class="report-value">${maxCombo}</div></div>` + practiceNote;

        // Family breakdown
        const fbEl = document.getElementById('g4FamilyBreakdown');
        const families = [
            { key: 'strings', zh: '弦樂', color: '#E8739E' },
            { key: 'woodwind', zh: '木管', color: '#5DB85D' },
            { key: 'brass', zh: '銅管', color: '#F5A623' },
            { key: 'percussion', zh: '敲擊', color: '#4A90D9' },
            { key: 'keyboard', zh: '鍵盤', color: '#9B59B6' },
        ];
        let fbHtml = '<div style="font-weight:800;margin-bottom:8px;">🎼 各家族表現</div>';
        families.forEach(f => {
            const s = familyStats[f.key];
            if (s.total === 0) return;
            const pct = Math.round((s.correct / s.total) * 100);
            fbHtml += `<div class="g4-family-bar">
                <div class="g4-family-bar-label">${f.zh}</div>
                <div class="g4-family-bar-track"><div class="g4-family-bar-fill" style="width:${pct}%;background:${f.color};"></div></div>
                <div class="g4-family-bar-val">${pct}%</div>
            </div>`;
        });
        fbEl.innerHTML = fbHtml;

        // Weakness
        document.getElementById('g4Weakness').innerHTML = counts.wrong === 0
            ? '<div>🌟 全部答對！你是樂器識辨小專家！🎉</div>'
            : `<div>請繼續練習。正確 ${counts.correct}/${totalAnswered} 題。</div>`;

        // Mistake review
        const mistakeEl = document.getElementById('g4MistakeReview');
        if (mistakeEl) {
            if (mistakes.length > 0) {
                mistakeEl.innerHTML = '<div class="mistake-review-title">📝 錯題回顧</div>' +
                    mistakes.map(m => `<div class="mistake-item">
                        <div class="mistake-q">${escHtml(m.q)}</div>
                        <div class="mistake-detail"><span class="mistake-wrong">你的答案：${escHtml(String(m.chosen))}</span> → <span class="mistake-correct">正確：${escHtml(String(m.correct))}</span></div>
                        ${m.explain ? `<div class="mistake-explain">💡 ${escHtml(m.explain)}</div>` : ''}
                    </div>`).join('');
            } else {
                mistakeEl.innerHTML = '';
            }
        }

        // Save scores
        saveLocalRank('game4', user, score, accuracy, maxCombo);
        if (mode !== 'practice') {
            submitScoreToGAS('game4', user, score, accuracy, maxCombo, '樂器識辨·挑戰');
            recordGameResult(user, 'game4', score, accuracy, maxCombo, null, counts);
        } else {
            _consumeProfilePlaySecs();
        }

        renderLocalRankList('game4', 'g4RankList', user);
        if (mode !== 'practice') setTimeout(() => loadRanks(2, { force: true }).then(() => renderLocalRankList('game4', 'g4RankList', user)).catch(()=>{}), 800);
        document.getElementById('g4PlayAgain').onclick = () => switchScreen('screen-g4-setup');
        document.getElementById('g4BackToHub').onclick = () => switchScreen('screen-g4-setup');
        const g4Layout = document.getElementById('g4LeaderboardLayout');
        if (g4Layout) g4Layout.classList.remove('view-only');
        const g4RBack = document.getElementById('g4ResultBack');
        if (g4RBack) g4RBack.style.display = 'none';
        switchScreen('screen-game4-result');
    }

    // ── Game 4 Study Screen ──
    function renderG4Study(familyFilter, searchQuery) {
        const grid = document.getElementById('g4StudyGrid');
        if (!grid) return;
        let items = INSTRUMENT_BANK;
        if (familyFilter && familyFilter !== 'all') items = items.filter(i => i.family === familyFilter);
        if (searchQuery && searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            items = items.filter(i =>
                i.nameZh.toLowerCase().includes(q) ||
                i.nameEn.toLowerCase().includes(q) ||
                (i.desc && i.desc.toLowerCase().includes(q))
            );
        }

        grid.innerHTML = items.length === 0
            ? `<div class="g4-study-empty">😔 找不到符合的樂器，請嘗試其他關鍵字。</div>`
            : items.map(inst => {
            const isCard = inst.img && inst.img.includes('/cards/');
            const imgHtml = inst.img ? `<img src="${inst.img}" alt="${inst.nameEn}" class="g4-study-img" loading="lazy">` : `<div class="g4-study-emoji">🎵</div>`;
            return `
            <div class="g4-study-card${isCard ? ' has-card-img' : ''}" data-id="${inst.id}">
                ${imgHtml}
                <span class="g4-family-badge g4-family-${inst.family}">${inst.familyZh}</span>
                <div class="g4-study-name">${inst.nameZh}</div>
                <div class="g4-study-en">${inst.nameEn}</div>
                <div class="g4-study-desc">${inst.desc}</div>
                <button class="g4-study-listen" data-id="${inst.id}" data-name="${inst.nameEn}">🔊 讀音</button>
            </div>
        `}).join('');

        // Single delegated handler for entire grid
        grid.onclick = (e) => {
            const listenBtn = e.target.closest('.g4-study-listen');
            if (listenBtn) {
                e.stopPropagation();
                const instrName = listenBtn.dataset.name || INSTRUMENT_MAP?.get(listenBtn.dataset.id)?.nameEn || listenBtn.dataset.id;
                const utt = new SpeechSynthesisUtterance(instrName);
                utt.lang = 'en-US';
                speechSynthesis.cancel();
                speechSynthesis.speak(utt);
                listenBtn.textContent = '🔊 讀音中…';
                setTimeout(() => { listenBtn.textContent = '🔊 讀音'; }, 1200);
                return;
            }
            const card = e.target.closest('.g4-study-card');
            if (card) showInstrumentDetail(card.dataset.id);
        };
    }

    // ── Game 4 Instrument Detail Modal ──
    function showInstrumentDetail(instrId) {
        const inst = INSTRUMENT_MAP ? INSTRUMENT_MAP.get(instrId) : INSTRUMENT_BANK.find(i => i.id === instrId);
        if (!inst) return;

        closeInstrumentDetail();

        // ── Derived facts from existing data ──
        const playMap = { strings:'弓拉 / 撥弦', woodwind:'管口吹奏', brass:'振唇吹奏', percussion:'敲擊', keyboard:'鍵盤按壓' };
        const familyIconMap = { strings:'🎻', woodwind:'🎵', brass:'🎺', percussion:'🥁', keyboard:'🎹' };
        const TONE_MAP = {
            // Strings
            'violin':'明亮圓潤', 'viola':'溫暖深沉', 'cello':'豐厚溫暖', 'double-bass':'低沉渾厚',
            'harp':'清亮空靈', 'guitar':'溫暖木質', 'bass-guitar':'低沉有力',
            'ukulele':'清甜輕盈', 'banjo':'清脆明亮', 'mandolin':'清脆明亮',
            // Woodwind
            'flute':'清澈空靈', 'clarinet':'圓潤甜美', 'oboe':'尖銳穿透', 'bassoon':'低沉溫暖',
            'recorder':'清甜柔和', 'piccolo':'尖銳嘹亮', 'english-horn':'憂鬱溫柔',
            'alto-sax':'溫暖圓潤', 'tenor-sax':'低沉有力', 'soprano-sax':'明亮尖銳',
            'baritone-sax':'深沉渾厚', 'harmonica':'帶鼻音柔和', 'bagpipes':'嘹亮刺激',
            'pan-flute':'空靈悠遠',
            // Brass
            'trumpet':'明亮輝煌', 'trombone':'厚重莊嚴', 'french-horn':'柔和圓潤',
            'tuba':'低沉渾厚', 'cornet':'柔和甜美',
            // Percussion
            'timpani':'低沉有力', 'snare':'乾脆清晰', 'bass-drum':'低沉震撼',
            'xylophone':'清脆明亮', 'triangle':'清亮穿透', 'cymbals':'金屬嘹亮',
            'tambourine':'輕盈活潑', 'glockenspiel':'清脆如鐘', 'marimba':'溫暖木質',
            'vibraphone':'空靈顫動', 'drums':'有力多變', 'cajon':'乾脆溫暖',
            'maracas':'輕盈沙沙', 'egg-shakers':'輕柔沙沙', 'tubular-bells':'渾厚如鐘',
            'cabasa':'金屬沙沙', 'djembe':'豐富多變', 'castanets':'清脆短促',
            'congas':'溫暖渾厚', 'cowbell':'響亮持久', 'guiro':'沙沙刮擦',
            // Keyboard
            'piano':'豐富多變', 'organ':'厚重持久', 'harpsichord':'清脆明亮', 'accordion':'溫暖豐厚',
        };
        const sp = inst.synthParams || {};
        const freqHz = sp.freq || 0;
        const rangeLabel = freqHz >= 800 ? '高音域' : freqHz >= 400 ? '中高音域' : freqHz >= 200 ? '中音域' : freqHz >= 100 ? '中低音域' : '低音域';
        const toneLabel = TONE_MAP[inst.id] || '多元音色';
        const playLabel = playMap[inst.family] || '—';
        const familyIcon = familyIconMap[inst.family] || '🎵';

        const factsHtml = `
            <div class="g4-fact-card"><div class="g4-fact-icon">🎼</div><div class="g4-fact-label">族群</div><div class="g4-fact-val">${inst.familyZh}</div></div>
            <div class="g4-fact-card"><div class="g4-fact-icon">🤲</div><div class="g4-fact-label">演奏方式</div><div class="g4-fact-val">${playLabel}</div></div>
            <div class="g4-fact-card"><div class="g4-fact-icon">🎨</div><div class="g4-fact-label">音色特質</div><div class="g4-fact-val">${toneLabel}</div></div>
            <div class="g4-fact-card"><div class="g4-fact-icon">📊</div><div class="g4-fact-label">音域範圍</div><div class="g4-fact-val">${rangeLabel}</div></div>`;

        const hasVideo = Boolean(inst.video);
        const videoId = hasVideo ? (inst.video.match(/embed\/([^?]+)/) || [])[1] : '';
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
        const historyText = inst.history || inst.desc;

        const isCard = inst.img && inst.img.includes('/cards/');
        const imgHtml = inst.img
            ? g4InstImgHtml(inst, `g4-modal-img${isCard ? ' card-img' : ''}`, inst.nameEn)
            : `<div class="g4-modal-img-placeholder">🎵</div>`;

        const structData = INSTRUMENT_STRUCTURE[inst.id] || [];
        const wrappedImg = `<div class="g4-modal-img-wrap">${imgHtml}</div>`;
        const structToggle = structData.length
            ? `<button class="g4-modal-struct-toggle"><span class="struct-toggle-icon">🔬</span><span class="struct-toggle-text">顯示構造</span><span class="struct-toggle-arrow">›</span></button>`
            : '';

        const videoTabBtnHtml = hasVideo
            ? '<button class="g4-tab-btn" data-tab="video" role="tab">🎬 演奏</button>'
            : '';
        const videoPanelHtml = hasVideo
            ? `
                        <div class="g4-tab-panel" data-panel="video">
                            <div class="g4-modal-video-wrap g4-video-lazy" data-src="${inst.video}">
                                <div class="g4-video-poster" style="background-image:url(${thumbUrl})">
                                    <div class="g4-video-play">▶</div>
                                </div>
                            </div>
                        </div>`
            : '';

        function activateModalTab(box, tabName) {
            if (!box || !tabName) return;
            box.querySelectorAll('.g4-tab-btn').forEach(b => b.classList.remove('active'));
            box.querySelectorAll('.g4-tab-panel').forEach(p => p.classList.remove('active'));
            const activeBtn = box.querySelector(`.g4-tab-btn[data-tab="${tabName}"]`);
            const activePanel = box.querySelector(`[data-panel="${tabName}"]`);
            if (activeBtn) activeBtn.classList.add('active');
            if (activePanel) activePanel.classList.add('active');
        }

        const modal = document.createElement('div');
        modal.className = 'g4-instrument-modal';
        modal.id = 'g4InstrumentModal';
        modal.innerHTML = `
            <div class="g4-instrument-modal-box">
                <button class="g4-modal-close" id="g4ModalClose">✕</button>

                <div class="g4-modal-left">
                    ${wrappedImg}
                    ${structToggle}
                    <span class="g4-family-badge g4-family-${inst.family}">${inst.familyZh}</span>
                    <div class="g4-modal-name">${inst.nameZh}</div>
                    <div class="g4-modal-en">${inst.nameEn}</div>
                    <button class="g4-modal-listen" id="g4ModalListen">🔊 讀音</button>
                </div>

                <div class="g4-modal-right">
                    <nav class="g4-modal-tabs" role="tablist">
                        <button class="g4-tab-btn active" data-tab="intro" role="tab">📖 介紹</button>
                        <button class="g4-tab-btn" data-tab="history" role="tab">📜 歷史</button>
                        ${videoTabBtnHtml}
                    </nav>

                    <div class="g4-tab-panels">
                        <div class="g4-tab-panel active" data-panel="intro">
                            <div class="g4-intro-banner g4-intro-banner-${inst.family}">
                                <span class="g4-intro-banner-icon">${familyIcon}</span>
                                <span class="g4-intro-banner-txt">${inst.familyZh}樂器</span>
                                <span class="g4-intro-banner-dot">·</span>
                                <span class="g4-intro-banner-txt">${inst.nameEn}</span>
                            </div>
                            <p class="g4-panel-lead">${inst.desc}</p>
                            <div class="g4-facts-grid">${factsHtml}</div>
                        </div>

                        <div class="g4-tab-panel" data-panel="history">
                            <div class="g4-history-body">
                                <div class="g4-history-quote">${historyText}</div>
                            </div>
                        </div>

                        ${videoPanelHtml}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        g4BindSpins(modal);

        // Single delegated click handler for modal
        modal.onclick = (e) => {
            if (e.target === modal) { closeInstrumentDetail(); return; }
            if (e.target.closest('.g4-modal-close')) { closeInstrumentDetail(); return; }
            // Structure viewer (fullscreen lightbox)
            if (e.target.closest('.g4-modal-struct-toggle')) {
                openStructureViewer(inst, structData);
                return;
            }
            if (e.target.closest('.g4-modal-listen')) {
                const lb = e.target.closest('.g4-modal-listen');
                const utt = new SpeechSynthesisUtterance(inst.nameEn);
                utt.lang = 'en-US';
                speechSynthesis.cancel();
                speechSynthesis.speak(utt);
                lb.textContent = '🔊 讀音中…';
                setTimeout(() => { lb.textContent = '🔊 讀音'; }, 1200);
                return;
            }
            // Tab switching
            const tabBtn = e.target.closest('.g4-tab-btn');
            if (tabBtn) {
                const box = tabBtn.closest('.g4-instrument-modal-box');
                activateModalTab(box, tabBtn.dataset.tab);
                return;
            }
            // Lazy YouTube: click poster to load iframe
            const poster = e.target.closest('.g4-video-poster');
            if (poster) {
                const wrap = poster.closest('.g4-video-lazy');
                if (wrap) {
                    wrap.innerHTML = `<iframe src="${wrap.dataset.src}?autoplay=1" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                    wrap.classList.remove('g4-video-lazy');
                }
                return;
            }
        };
        modal._escHandler = (e) => { if (e.key === 'Escape') closeInstrumentDetail(); };
        document.addEventListener('keydown', modal._escHandler);
    }

    function openStructureViewer(inst, structData) {
        const existing = document.getElementById('g4StructLb');
        if (existing) existing.remove();

        // Default label offset from dot (in % units) based on side
        const LABEL_OFFSET = 12;
        function defaultLx(s) { return s.side === 'left' ? s.x - LABEL_OFFSET : s.x + LABEL_OFFSET; }
        function defaultLy(s) { return s.y; }

        // Working copy: dot at x,y; label at lx,ly (all in %)
        const positions = structData.map(s => ({
            x: s.x, y: s.y,
            lx: s.lx != null ? s.lx : defaultLx(s),
            ly: s.ly != null ? s.ly : defaultLy(s),
            side: s.side || 'right'
        }));
        // Snapshot for cancel
        const origPositions = positions.map(p => ({ ...p }));

        const partsListHtml = structData.map((s, i) =>
            `<button class="g4-struct-part-item" data-idx="${i}">` +
                `<span class="g4-struct-part-num">${i + 1}</span>` +
                `<span class="g4-struct-part-names">` +
                    `<span class="g4-struct-part-zh">${s.part}</span>` +
                    `<span class="g4-struct-part-en">${s.en}</span>` +
                `</span>` +
            `</button>`
        ).join('');

        const lb = document.createElement('div');
        lb.className = 'g4-struct-lb';
        lb.id = 'g4StructLb';
        lb.innerHTML = `
            <div class="g4-struct-wrap">
                <div class="g4-struct-panel-left">
                    <button class="g4-struct-lb-close" aria-label="關閉">✕</button>
                    <div class="g4-struct-lb-body">
                        <img src="${inst.img}" alt="${inst.nameEn}" class="g4-struct-lb-img" id="g4StructImg">
                        <div class="g4-anno-overlay" id="g4StructOverlay"></div>
                    </div>
                </div>
                <div class="g4-struct-panel-right">
                    <div class="g4-struct-panel-header">
                        <div class="g4-struct-panel-title">
                            <span class="g4-struct-panel-zh">${inst.nameZh}</span>
                            <span class="g4-struct-panel-en">${inst.nameEn}</span>
                        </div>
                        <span class="g4-struct-lb-badge">構造圖</span>
                    </div>
                    <div class="g4-struct-parts-list" id="g4StructPartsList">${partsListHtml}</div>
                    <div class="g4-struct-desc-box" id="g4StructDescBox">
                        <div class="g4-struct-desc-empty">👆 點擊紅點或部件名稱查看說明</div>
                    </div>
                    <div class="g4-struct-drag-bar" id="g4StructDragBar">
                        <button class="g4-struct-drag-btn" id="g4DragModeBtn">✥ 拖曳模式</button>
                        <button class="g4-struct-cancel-btn" id="g4CancelBtn" style="display:none">↩ 取消</button>
                        <button class="g4-struct-lock-btn" id="g4LockBtn" style="display:none">📋 複製座標</button>
                    </div>
                </div>
            </div>
            <div class="g4-struct-lb-hint" id="g4StructHint">點擊紅點或部件名稱可查看詳情 · 按 ESC 關閉</div>
        `;
        document.body.appendChild(lb);
        document.body.style.overflow = 'hidden';

        const img = lb.querySelector('#g4StructImg');
        const overlay = lb.querySelector('#g4StructOverlay');
        const descBox = lb.querySelector('#g4StructDescBox');
        const partsList = lb.querySelector('#g4StructPartsList');
        const dragModeBtn = lb.querySelector('#g4DragModeBtn');
        const cancelBtn = lb.querySelector('#g4CancelBtn');
        const lockBtn = lb.querySelector('#g4LockBtn');
        const hint = lb.querySelector('#g4StructHint');
        let activeIdx = -1;
        let dragMode = false;
        const frames = g4SpinFrames(inst);
        let frameIdx = 0;
        if (frames) {
            const body = lb.querySelector('.g4-struct-lb-body');
            body.classList.add('is-spin');
            img.classList.add('is-on');
            const pics = [img];
            frames.forEach((src, i) => {
                if (i === 0) return;
                const el = document.createElement('img');
                el.className = 'g4-struct-lb-img';
                el.alt = '';
                el.draggable = false;
                el.decoding = 'async';
                el.src = src;
                img.insertAdjacentElement('afterend', el);
                pics.push(el);
            });
            let rotDrag = false, rotX = 0, rotI = 0, raf = 0, lastX = 0;
            const showFrame = (n) => {
                const next = ((n % pics.length) + pics.length) % pics.length;
                if (next === frameIdx) return;
                pics[frameIdx].classList.remove('is-on');
                frameIdx = next;
                pics[frameIdx].classList.add('is-on');
                overlay.classList.toggle('is-back', frameIdx !== 0);
            };
            body.addEventListener('pointerdown', (e) => {
                if (dragMode) return;
                if (e.target.closest('.g4-anno-dot-wrap, .g4-anno-label-abs, .g4-struct-lb-close')) return;
                rotDrag = true;
                rotX = lastX = e.clientX;
                rotI = frameIdx;
                body.classList.add('is-drag');
                try { body.setPointerCapture(e.pointerId); } catch (err) {}
            });
            body.addEventListener('pointermove', (e) => {
                if (!rotDrag) return;
                lastX = e.clientX;
                if (raf) return;
                raf = requestAnimationFrame(() => {
                    raf = 0;
                    const w = Math.max(160, body.getBoundingClientRect().width);
                    showFrame(rotI + Math.round((lastX - rotX) / (w / pics.length)));
                });
            });
            const endRot = () => {
                rotDrag = false;
                body.classList.remove('is-drag');
                if (raf) { cancelAnimationFrame(raf); raf = 0; }
            };
            body.addEventListener('pointerup', endRot);
            body.addEventListener('pointercancel', endRot);
            hint.textContent = '左右拖動可以轉一圈 · 回到正面先顯示部件 · 按 ESC 關閉';
        }

        function focusPart(idx) {
            if (dragMode) return;
            if (activeIdx === idx) { clearFocus(); return; }
            activeIdx = idx;
            overlay.classList.add('has-focus');
            // Highlight dot
            overlay.querySelectorAll('.g4-anno-dot-wrap').forEach((el, i) => el.classList.toggle('focused', i === idx));
            // Highlight label
            overlay.querySelectorAll('.g4-anno-label-abs').forEach((el, i) => el.classList.toggle('focused', i === idx));
            // Highlight SVG line
            overlay.querySelectorAll('.g4-anno-svg-line').forEach((el, i) => el.classList.toggle('focused', i === idx));
            // Highlight parts list
            partsList.querySelectorAll('.g4-struct-part-item').forEach((el, i) => el.classList.toggle('active', i === idx));
            // Scroll active part into view
            const activeItem = partsList.querySelector('.g4-struct-part-item.active');
            if (activeItem) activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            const s = structData[idx];
            if (s) {
                descBox.innerHTML =
                    `<div class="g4-struct-desc-part">` +
                        `<span class="g4-struct-desc-zh">${s.part}</span>` +
                        `<span class="g4-struct-desc-en">${s.en}</span>` +
                    `</div>` +
                    `<p class="g4-struct-desc-text">${s.desc || '—'}</p>`;
            }
        }

        function clearFocus() {
            activeIdx = -1;
            overlay.classList.remove('has-focus');
            overlay.classList.remove('has-focus');
            overlay.querySelectorAll('.g4-anno-dot-wrap').forEach(el => el.classList.remove('focused'));
            overlay.querySelectorAll('.g4-anno-label-abs').forEach(el => el.classList.remove('focused'));
            overlay.querySelectorAll('.g4-anno-svg-line').forEach(el => el.classList.remove('focused'));
            partsList.querySelectorAll('.g4-struct-part-item').forEach(el => el.classList.remove('active'));
            descBox.innerHTML = `<div class="g4-struct-desc-empty">👆 點擊紅點或部件名稱查看說明</div>`;
        }

        function buildOverlay() {
            // Dots
            const dotsHtml = positions.map((p, i) =>
                `<div class="g4-anno-dot-wrap" data-idx="${i}" style="left:${p.x}%;top:${p.y}%;">` +
                    `<div class="g4-anno-dot"></div>` +
                `</div>`
            ).join('');
            // Labels (absolutely positioned in overlay)
            const labelsHtml = positions.map((p, i) =>
                `<div class="g4-anno-label-abs" data-idx="${i}" style="left:${p.lx}%;top:${p.ly}%;">` +
                    `<div class="g4-anno-tag"><span class="g4-anno-zh">${structData[i].part}</span><span class="g4-anno-en">${structData[i].en}</span></div>` +
                `</div>`
            ).join('');
            // SVG lines connecting dots to labels
            const svgLines = positions.map((p, i) =>
                `<line class="g4-anno-svg-line" data-idx="${i}" x1="${p.x}%" y1="${p.y}%" x2="${p.lx}%" y2="${p.ly}%"/>`
            ).join('');

            overlay.innerHTML =
                `<svg class="g4-anno-svg">${svgLines}</svg>` +
                dotsHtml + labelsHtml;
            overlay.classList.add('active');
            attachDragListeners();
        }

        function updatePositionDOM(idx) {
            const p = positions[idx];
            const dotEl = overlay.querySelector(`.g4-anno-dot-wrap[data-idx="${idx}"]`);
            const lblEl = overlay.querySelector(`.g4-anno-label-abs[data-idx="${idx}"]`);
            const lineEl = overlay.querySelector(`.g4-anno-svg-line[data-idx="${idx}"]`);
            if (dotEl) { dotEl.style.left = p.x + '%'; dotEl.style.top = p.y + '%'; }
            if (lblEl) { lblEl.style.left = p.lx + '%'; lblEl.style.top = p.ly + '%'; }
            if (lineEl) {
                lineEl.setAttribute('x1', p.x + '%');
                lineEl.setAttribute('y1', p.y + '%');
                lineEl.setAttribute('x2', p.lx + '%');
                lineEl.setAttribute('y2', p.ly + '%');
            }
        }

        function attachDragListeners() {
            overlay.querySelectorAll('.g4-anno-dot-wrap').forEach(el => {
                el.addEventListener('pointerdown', onDotPointerDown, { passive: false });
            });
            overlay.querySelectorAll('.g4-anno-label-abs').forEach(el => {
                el.addEventListener('pointerdown', onLabelPointerDown, { passive: false });
            });
        }

        function onDotPointerDown(e) {
            if (!dragMode) return;
            e.preventDefault();
            e.stopPropagation();
            const el = e.currentTarget;
            const idx = parseInt(el.dataset.idx);
            const rect = overlay.getBoundingClientRect();
            // Remember label offset from dot so it follows
            const offsetLx = positions[idx].lx - positions[idx].x;
            const offsetLy = positions[idx].ly - positions[idx].y;

            function onMove(ev) {
                const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
                const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
                positions[idx].x = Math.round(Math.max(0, Math.min(100, (cx - rect.left) / rect.width * 100)) * 10) / 10;
                positions[idx].y = Math.round(Math.max(0, Math.min(100, (cy - rect.top) / rect.height * 100)) * 10) / 10;
                positions[idx].lx = Math.round((positions[idx].x + offsetLx) * 10) / 10;
                positions[idx].ly = Math.round((positions[idx].y + offsetLy) * 10) / 10;
                updatePositionDOM(idx);
            }
            function onUp() {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
            }
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        }

        function onLabelPointerDown(e) {
            if (!dragMode) return;
            e.preventDefault();
            e.stopPropagation();
            const el = e.currentTarget;
            const idx = parseInt(el.dataset.idx);
            const rect = overlay.getBoundingClientRect();

            function onMove(ev) {
                const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
                const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
                positions[idx].lx = Math.round(Math.max(0, Math.min(100, (cx - rect.left) / rect.width * 100)) * 10) / 10;
                positions[idx].ly = Math.round(Math.max(0, Math.min(100, (cy - rect.top) / rect.height * 100)) * 10) / 10;
                updatePositionDOM(idx);
            }
            function onUp() {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
            }
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        }

        function enableDragMode() {
            dragMode = true;
            clearFocus();
            overlay.classList.add('drag-mode');
            dragModeBtn.textContent = '✓ 拖曳中…';
            dragModeBtn.classList.add('active');
            cancelBtn.style.display = '';
            lockBtn.style.display = '';
            hint.textContent = '拖曳紅點移動標記 · 拖曳文字方塊調整位置 · 完成後按「複製座標」';
            descBox.innerHTML = `<div class="g4-struct-desc-empty">🖱 拖曳紅點或文字方塊調整位置</div>`;
        }

        function cancelDrag() {
            // Restore all positions
            origPositions.forEach((o, i) => Object.assign(positions[i], o));
            positions.forEach((_, i) => updatePositionDOM(i));
            // Exit drag mode
            dragMode = false;
            overlay.classList.remove('drag-mode');
            dragModeBtn.textContent = '✥ 拖曳模式';
            dragModeBtn.classList.remove('active');
            cancelBtn.style.display = 'none';
            lockBtn.style.display = 'none';
            hint.textContent = '點擊紅點或部件名稱可查看詳情 · 按 ESC 關閉';
            descBox.innerHTML = `<div class="g4-struct-desc-empty">👆 點擊紅點或部件名稱查看說明</div>`;
        }

        function copyCoords() {
            const lines = positions.map((p, i) =>
                `{x:${Math.round(p.x)},y:${Math.round(p.y)},lx:${Math.round(p.lx)},ly:${Math.round(p.ly)}}  // ${structData[i].part}`
            ).join('\n');
            navigator.clipboard.writeText(lines).then(() => {
                lockBtn.textContent = '✅ 已複製！';
                setTimeout(() => { lockBtn.textContent = '📋 複製座標'; }, 2000);
            });
        }

        const onImgReady = () => { if (!overlay.childElementCount) buildOverlay(); };
        if (img.complete && img.naturalWidth) onImgReady();
        else img.addEventListener('load', onImgReady, { once: true });

        function closeLb() {
            lb.style.animation = 'g4ModalBgIn 0.18s ease reverse both';
            setTimeout(() => { lb.remove(); document.body.style.overflow = ''; }, 180);
            document.removeEventListener('keydown', escH);
        }

        dragModeBtn.addEventListener('click', (e) => { e.stopPropagation(); enableDragMode(); });
        cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); cancelDrag(); });
        lockBtn.addEventListener('click', (e) => { e.stopPropagation(); copyCoords(); });

        lb.onclick = (e) => {
            if (e.target === lb || e.target.closest('.g4-struct-lb-close')) { closeLb(); return; }
            if (dragMode) return;
            const dotWrap = e.target.closest('.g4-anno-dot-wrap');
            if (dotWrap) { focusPart(parseInt(dotWrap.dataset.idx)); return; }
            const labelEl = e.target.closest('.g4-anno-label-abs');
            if (labelEl) { focusPart(parseInt(labelEl.dataset.idx)); return; }
            const partItem = e.target.closest('.g4-struct-part-item');
            if (partItem) { focusPart(parseInt(partItem.dataset.idx)); return; }
        };

        const escH = (e) => { if (e.key === 'Escape') closeLb(); };
        document.addEventListener('keydown', escH);
    }

    function closeInstrumentDetail() {
        const modal = document.getElementById('g4InstrumentModal');
        if (!modal) return;
        g4ClearSpins(modal);
        // Stop YouTube video
        const iframe = modal.querySelector('iframe');
        if (iframe) iframe.src = '';
        // Remove escape listener
        if (modal._escHandler) document.removeEventListener('keydown', modal._escHandler);
        // Close animation
        const box = modal.querySelector('.g4-instrument-modal-box');
        if (box) box.style.animation = 'g4ModalBoxIn 0.18s ease reverse both';
        modal.style.animation = 'g4ModalBgIn 0.18s ease reverse both';
        setTimeout(() => { modal.remove(); document.body.style.overflow = ''; }, 180);
    }

    // 創作工作室 — 見 composition-studio.js（CompositionStudioFactory）；須先於 script.js 載入
    CompositionStudio = (typeof CompositionStudioFactory === 'function')
        ? CompositionStudioFactory({
            CONFIG,
            MAPS,
            getRhythmTokenDuration,
            beamTokens: _BEAM_TOKENS,
            parseRhythmTaps,
            renderVexFlowBars: _renderVexFlowBars,
            audio,
            getState: () => state,
            switchScreen,
            showToast: _showToast,
            gasPost: gasPostJson,
            renderNoteGlyph: _omRenderNoteIcon,
            keySignatures: KEY_SIGNATURES,
            openLightbox
        })
        : { open() { console.warn('composition-studio.js 未載入'); }, init() {} };
    try { CompositionStudio.init(); } catch (e) { console.error('CompositionStudio.init error:', e); }

})();
