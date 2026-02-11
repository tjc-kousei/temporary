let display_win; // 統合されたウィンドウ

// ウィンドウオープン
function openwindow() {
  display_win = window.open(
    "./popwindow/display.html",
    "display_win",
    "width=800,height=600"
  );
}
openwindow();

// === データ定義 ===
let Abbre = [
  "創",
  "出エジ",
  "レビ",
  "民",
  "申",
  "ヨシュ",
  "士",
  "ルツ",
  "サム上",
  "サム下",
  "列王上",
  "列王下",
  "歴代上",
  "歴代下",
  "エズ",
  "ネヘ",
  "エス",
  "ヨブ",
  "詩",
  "箴",
  "伝",
  "雅",
  "イザ",
  "エレ",
  "哀",
  "エゼ",
  "ダニ",
  "ホセ",
  "ヨエ",
  "アモ",
  "オバ",
  "ヨナ",
  "ミカ",
  "ナホ",
  "ハバ",
  "ゼパ",
  "ハガ",
  "ゼカ",
  "マラ",
  "マタ",
  "マル",
  "ルカ",
  "ヨハ",
  "使徒",
  "ロマ",
  "Ⅰコリ",
  "Ⅱコリ",
  "ガラ",
  "エペ",
  "ピリ",
  "コロ",
  "Ⅰテサ",
  "Ⅱテサ",
  "Ⅰテモ",
  "Ⅱテモ",
  "テト",
  "ピレ",
  "ヘブ",
  "ヤコ",
  "Ⅰペテ",
  "Ⅱペテ",
  "Ⅰヨハ",
  "Ⅱヨハ",
  "Ⅲヨハ",
  "ユダ",
  "黙",
];
let en = [
  "Gen.",
  "Ex.",
  "Lev.",
  "Num.",
  "Deut.",
  "Josh.",
  "Judg.",
  "Ruth",
  "1Sam.",
  "2Sam.",
  "1Kgs.",
  "2Kgs.",
  "1Chr.",
  "2Chr.",
  "Ezra",
  "Neh.",
  "Esth.",
  "Job",
  "Ps.",
  "Prov.",
  "Eccl.",
  "Song",
  "Is.",
  "Jer.",
  "Lam.",
  "Ezek.",
  "Dan.",
  "Hos.",
  "Joel",
  "Amos",
  "Obad.",
  "Jon.",
  "Mic.",
  "Nah.",
  "Hab.",
  "Zeph.",
  "Hag.",
  "Zech.",
  "Mal.",
  "Mt.",
  "Mk.",
  "Lk.",
  "Jn.",
  "Acts",
  "Rom.",
  "1Cor.",
  "2Cor.",
  "Gal.",
  "Eph.",
  "Phil.",
  "Col.",
  "1Thes.",
  "2Thes.",
  "1Tim.",
  "2Tim.",
  "Tit.",
  "Phlm.",
  "Heb.",
  "Jas.",
  "1Pet.",
  "2Pet.",
  "1Jn.",
  "2Jn.",
  "3Jn.",
  "Jude",
  "Rev.",
];
let kr = [
  "창",
  "출",
  "레",
  "민",
  "신",
  "수",
  "사",
  "룻",
  "삼상",
  "삼하",
  "왕상",
  "왕하",
  "대상",
  "대하",
  "스",
  "느",
  "에",
  "욥",
  "시",
  "잠",
  "전",
  "아",
  "사",
  "렘",
  "애",
  "겔",
  "단",
  "호",
  "욜",
  "암",
  "옵",
  "욘",
  "미",
  "나",
  "합",
  "습",
  "학",
  "슥",
  "말",
  "마",
  "막",
  "눅",
  "요",
  "행",
  "롬",
  "고전",
  "고후",
  "갈",
  "엡",
  "빌",
  "골",
  "살전",
  "살후",
  "딤전",
  "딤후",
  "딛",
  "몬",
  "히",
  "약",
  "벧전",
  "벧후",
  "요일",
  "요이",
  "요삼",
  "유",
  "계",
];

let bible = [];
let hymn = [];
let servicerList = {};
let currentLyricsSections = [];
let currentTitleInfo = null;
let currentMode = "bible";

// フル名称データ (略称に対応するフル名称)
const FullNameJP = ["創世記","出エジプト記","レビ記","民数記","申命記","ヨシュア記","士師記","ルツ記","サムエル記上","サムエル記下","列王記上","列王記下","歴代志上","歴代志下","エズラ記","ネヘミヤ記","エステル記","ヨブ記","詩篇","箴言","伝道の書","雅歌","イザヤ書","エレミヤ書","哀歌","エゼキエル書","ダニエル書","ホセア書","ヨエル書","アモス書","オバデア書","ヨナ書","ミカ書","ナホム書","ハバクク書","ゼパニヤ書","ハガイ書","ゼカリヤ書","マラキ書","マタイによる福音書","マルコによる福音書","ルカによる福音書","ヨハネによる福音書","使徒行伝","ローマ人への手紙","コリント人への第一の手紙","コリント人への第二の手紙","ガラテヤ人への手紙","エペソ人への手紙","ピリピ人への手紙","コロサイ人への手紙","テサロニケ人への第一の手紙","テサロニケ人への第二の手紙","テモテへの第一の手紙","テモテへの第二の手紙","テトスへの手紙","ピレモンへの手紙","ヘブル人への手紙","ヤコブの手紙","ペテロの第一の手紙","ペテロの第二の手紙","ヨハネの第一の手紙","ヨハネの第二の手紙","ヨハネの第三の手紙","ユダの手紙","ヨハネの黙示録"];
const FullNameCH = ["创世记","出埃及记","利未记","民数记","申命记","约书亚记","士师记","路得记","撒母耳记上","撒母耳记下","列王纪上","列王纪下","历代志上","历代志下","以斯拉记","尼希米记","以斯帖记","约伯记","诗篇","箴言","传道书","雅歌","以赛亚书","耶利米书","耶利米哀歌","以西结书","但以理书","何西阿书","约珥书","阿摩司书","俄巴底亚书","约拿书","弥迦书","那鸿书","哈巴谷书","西番雅书","哈该书","撒迦利亚书","玛拉基书","马太福音","马可福音","路加福音","约翰福音","使徒行传","罗马书","哥林多前书","哥林多后书","加拉太书","以弗所书","腓立比书","歌罗西书","帖撒罗尼迦前书","帖撒罗尼迦后书","提摩太前书","提摩太后书","提多书","腓利门书","希伯来书","雅各书","彼得前书","彼得后书","约翰一书","约翰二书","约翰三书","犹大书","启示录"];

// 1. IndexedDB 制御
let db;
const request = indexedDB.open("TJC_Meeting_DB", 1);
request.onupgradeneeded = (e) => {
  db = e.target.result;
  db.createObjectStore("servicers", { keyPath: "id", autoIncrement: true });
};
request.onsuccess = (e) => {
  db = e.target.result;
  updateDatalistFromDB();
};

function openServicerManager() {
  const modal = document.getElementById("servicerManagerModal");
  if (modal) {
    modal.style.display = "block";
    loadServicersList();
  }
}
function closeServicerManager() { document.getElementById("servicerManagerModal").style.display = "none"; }

function addServicerToDB() {
  const name = document.getElementById("newServicerName").value.trim();
  const role = document.getElementById("newServicerRole").value;
  if (!name) return;
  const transaction = db.transaction(["servicers"], "readwrite");
  transaction.objectStore("servicers").add({ name, role });
  transaction.oncomplete = () => {
    document.getElementById("newServicerName").value = "";
    loadServicersList();
  };
}

function loadServicersList() {
  const container = document.getElementById("servicerListTable");
  container.innerHTML = "";
  db.transaction("servicers").objectStore("servicers").getAll().onsuccess = (e) => {
    e.target.result.forEach(s => {
      container.innerHTML += `<div class="servicer-item">
        <span>[${s.role === 'sekkyou' ? '説教' : '通訳'}] ${s.name}</span>
        <button onclick="deleteServicer(${s.id})" class="del-btn">削除</button>
      </div>`;
    });
  };
}

function deleteServicer(id) {
  const transaction = db.transaction(["servicers"], "readwrite");
    transaction.objectStore("servicers").delete(id);

    transaction.oncomplete = () => {
        loadServicersList();     // モーダル内リスト更新
        updateDatalistFromDB();  // 入力欄の候補（datalist/select）を更新
    };
}

// モードに合わせてUIを更新（ボタンの色など）
function updateModeUI(mode) {
  const btnTitle = document.getElementById("btn-mode-title");
  const btnBible = document.getElementById("btn-mode-bible");
  const cardHymn = document.querySelector(".hymn-card");

  if (btnTitle) btnTitle.classList.remove("primary");
  if (btnBible) btnBible.classList.remove("primary");
  if (cardHymn) cardHymn.style.border = "none";

  if (mode === "title") {
    if (btnTitle) btnTitle.classList.add("primary");
  } else if (mode === "bible") {
    if (btnBible) btnBible.classList.add("primary");
  } else if (mode === "hymn") {
    if (cardHymn) cardHymn.style.border = "3px solid #FF8C00";
  }
}

// 画面切り替え
function switchScreen(mode) {
  if (!display_win || display_win.closed) {
    openwindow();
    return;
  }

  currentMode = mode;
  display_win.document.body.className = mode + "-mode";

  updateModeUI(mode);

  if (mode === "bible" && display_win.fitHeader) {
    setTimeout(() => {
      display_win.fitHeader();
      display_win.fitTextToContainer();
    }, 50);
  }
}

function loadCSVAsync(url) {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.open("get", url, true);
    req.onload = () =>
      req.status >= 200 && req.status < 300
        ? resolve(req.responseText)
        : reject(req.statusText);
    req.onerror = () => reject(req.statusText);
    req.send(null);
  });
}

function updateProgress(percent, message) {
  const bar = document.getElementById("progress-bar");
  const detail = document.getElementById("loading-detail");
  if (bar) bar.style.width = percent + "%";
  if (detail) detail.innerText = message;
}

// GASから取得した一時的なデータを保持する変数
let tempGASData = null;

async function loadInitialData() {
  const overlay = document.getElementById("loading-overlay");
  updateProgress(5, "接続を開始します...");
  const urlParams = new URLSearchParams(window.location.search);
  const churchName = urlParams.get("church");
  const GAS_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbyWVCbzcHS9n1ZzL21kLOLmjOJJT7s1U0qksIksyAbBYoA_k7iMKnQneYt1oveRwpBz/exec";

  try {
    if (churchName) {
      updateProgress(15, `設定データを取得中 (${churchName})...`);
      const response = await fetch(
        `${GAS_WEB_APP_URL}?church=${encodeURIComponent(churchName)}`
      );
      if (response.ok) {
        recievedData = await response.json();
        if (recievedData) {
          servicerList = recievedData;

          tempGASData = recievedData; // データを一時保存
        // 登録ボタンをUI上に表示させる（ID: gas-import-btn はHTMLに作成）
        const importBtn = document.getElementById("gas-import-btn");
        if (importBtn) importBtn.style.display = "inline-block";

          const sekkyoulist = document.getElementById("sekkyoulist");
          const tuyakulist = document.getElementById("tuyakulist");
          for (const keys in servicerList) {
            for (const key in servicerList[keys]) {
              if (servicerList[keys][key].role == "sekkyou") {
                let sekkyou = document.createElement("option");
                sekkyou.value = servicerList[keys][key].name;
                sekkyoulist.appendChild(sekkyou);
              } else if (servicerList[keys][key].role == "tuyaku") {
                let tuyaku = document.createElement("option");
                tuyaku.value = servicerList[keys][key].name;
                tuyakulist.appendChild(tuyaku);
              }
            }
          }
        }
      }
    }
    updateProgress(40, "聖書データを読み込んでいます...");
    const bibleData = await loadCSVAsync("./Data.csv");
    convertbibleCSVtoArray(bibleData);
    updateProgress(75, "讃美歌データを読み込んでいます...");
    const hymnData = await loadCSVAsync("./hymn.csv");
    converthymnCSVtoArray(hymnData);
    updateProgress(100, "準備完了！");
    setTimeout(() => {
      if (overlay) overlay.classList.add("hidden");
    }, 800);
  } catch (error) {
    console.error(error);
    updateProgress(100, "エラーが発生しました");
    alert("データの読み込みに失敗しました。");
  }
}

// ボタンクリックで呼ばれる一括登録関数
function importGASDataToDB() {
  if (!tempGASData) return;
  if (!confirm("GASから取得した名簿をブラウザのデータベースに登録しますか？")) return;

  const transaction = db.transaction(["servicers"], "readwrite");
  const store = transaction.objectStore("servicers");

  // すでに登録されている名前を取得して重複を避ける（任意）
  store.getAll().onsuccess = (e) => {
    const existingNames = e.target.result.map(s => s.name);

    // GASデータの階層構造に合わせてループ（servicerList[keys][key] の構造を想定）
    for (const keys in tempGASData) {
      for (const key in tempGASData[keys]) {
        const item = tempGASData[keys][key];
        // 重複していなければ追加
        if (!existingNames.includes(item.name)) {
          store.add({ name: item.name, role: item.role });
        }
      }
    }
  };

  transaction.oncomplete = () => {
    alert("一括登録が完了しました。");
    updateDatalistFromDB(); // リストを更新
    document.getElementById("gas-import-btn").style.display = "none"; // ボタンを隠す
  };
}

function convertbibleCSVtoArray(str) {
  let tmp = str.split("\n");
  for (let i = 0; i < tmp.length; ++i) bible[i] = tmp[i].split(",");
}

function converthymnCSVtoArray(str) {
  let tmp = str.split("\n");
  const hymnlist = document.getElementById("hymnlist");
  for (let i = 1; i < tmp.length; ++i) {
    hymn[i] = tmp[i].split(",");
    let option = document.createElement("option");
    option.value = hymn[i][0].trim();
    hymnlist.appendChild(option);
  }
}

async function recievehymn(value) {
  const lyricsArea = document.getElementById("lyrics_area");
  if (!lyricsArea) return;

  // 1. 操作パネル（手元）のボタンをクリア
  lyricsArea.innerHTML = "";
  currentTitleInfo = null;
  currentLyricsSections = [];

  // 2. スクリーン表示側（display.html）の内容もクリア
  if (display_win && !display_win.closed) {
    const doc = display_win.document;
    const hOutput = doc.getElementById("h_output");
    const hBgNum = doc.getElementById("h_bg_number");
    if (hOutput) hOutput.innerHTML = "";
    if (hBgNum) hBgNum.innerText = "";
  }

  // 入力が空、または存在しない場合はここで終了（画面は空白のまま）
  if (!value) return;

  // 3. hymn.csv から該当する讃美歌情報を探す
  for (let n = 1; n < hymn.length; n++) {
    if (hymn[n][0].trim() === value.trim()) {
      currentTitleInfo = hymn[n];
      break;
    }
  }

  // リストに存在しない場合は終了
  if (!currentTitleInfo) return;

  try {
    const response = await fetch(`./lyrics/${value}.txt`);
    if (response.ok) {
      const text = await response.text();
      currentLyricsSections = parseLyrics(text);

      if (currentLyricsSections.length > 0) {
        // ボタンの生成
        let buttonsHTML = `<button onclick="switchScreen('hymn'); showTitleInPopup(); updateActiveButton(this);" class="lyric-btn" id="btn-title">タイトル</button>`;
        currentLyricsSections.forEach((sec, index) => {
          buttonsHTML += `<button onclick="switchScreen('hymn'); showLyricsVerse(${index}); updateActiveButton(this);" class="lyric-btn">${sec.label}</button>`;
        });
        lyricsArea.innerHTML = buttonsHTML;

        // 正常なデータがある時のみ、スクリーンにタイトルを表示
        switchScreen("hymn");
        showTitleInPopup();
        const titleBtn = document.getElementById("btn-title");
        if (titleBtn) updateActiveButton(titleBtn);
      }
    }
  } catch (e) {
    console.warn("歌詞の取得に失敗しました:", value);
  }
}

function convertRuby(text) {
  return text.replace(
    /([一-龠々]+)\(([ぁ-んァ-ヶー]+)\)/g,
    "<ruby>$1<rt>$2</rt></ruby>"
  );
}

function parseLyrics(text) {
  const regex = /\[(.*?)\]/g;
  let match,
    lastIndex = 0,
    currentLabel = null;
  const sections = [];
  const processContent = (rawText) => {
    rawText = rawText.trim();
    if (!rawText) return "";
    let processed = convertRuby(rawText);
    return processed
      .split(/\r\n|\n/)
      .map((line) => {
        if (!line.trim()) return '<div style="min-height: 1.2em;">&nbsp;</div>';
        return `<div style="white-space: nowrap; text-align: center; margin: 2px 0;">${line}</div>`;
      })
      .join("");
  };
  while ((match = regex.exec(text)) !== null) {
    if (currentLabel)
      sections.push({
        label: currentLabel,
        content: processContent(text.substring(lastIndex, match.index)),
      });
    currentLabel = match[1];
    lastIndex = regex.lastIndex;
  }
  if (currentLabel)
    sections.push({
      label: currentLabel,
      content: processContent(text.substring(lastIndex)),
    });
  return sections;
}

function showLyricsVerse(index) {
  if (!display_win || display_win.closed || !currentTitleInfo) return;
  if (currentMode !== "hymn") switchScreen("hymn");

  const contentHtml = currentLyricsSections[index].content;
  const verseLabel = currentLyricsSections[index].label;

  const doc = display_win.document;
  const outputDiv = doc.getElementById("h_output");
  const bgNumDiv = doc.getElementById("h_bg_number");

  if (bgNumDiv) bgNumDiv.innerText = verseLabel; // 背景番号更新

  if (!outputDiv) return;

  const headerHtml = `
    <div style="flex: 0 0 auto; width: 100%; text-align: center; padding: 10px; background: rgba(255,255,255,0.9); border-bottom: 2px solid #ccc;">
      <span style="font-size: 4rem; font-weight: bold;">${currentTitleInfo[0]} ${currentTitleInfo[2]}/${currentTitleInfo[1]}</span>
    </div>
  `;
  const bodyHtml = `
    <div id="lyric-container" style="flex: 1; width: 100%; height: 100%; overflow: hidden; display: flex; justify-content: center; align-items: center;">
      <div id="lyric-text" style="display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; line-height: 1.5;">${contentHtml}</div>
    </div>
  `;
  outputDiv.innerHTML = `<div style="display: flex; flex-direction: column; height: 100vh; width: 100%;">${headerHtml}${bodyHtml}</div>`;
  setTimeout(
    () =>
      adjustFontSizeForLyrics(
        doc.getElementById("lyric-container"),
        doc.getElementById("lyric-text")
      ),
    10
  );
  display_win.onresize = () => {
    if (currentMode === "hymn")
      adjustFontSizeForLyrics(
        doc.getElementById("lyric-container"),
        doc.getElementById("lyric-text")
      );
  };
}

function adjustFontSizeForLyrics(container, element) {
  if (!container || !element) return;
  let size = 8,
    loopCount = 0;
  element.style.fontSize = size + "rem";
  while (
    (element.scrollWidth > container.clientWidth ||
      element.scrollHeight > container.clientHeight) &&
    size > 0.5 &&
    loopCount < 100
  ) {
    size -= 0.5;
    element.style.fontSize = size + "rem";
    loopCount++;
  }
}

function showTitleInPopup() {
  if (!display_win || display_win.closed || !currentTitleInfo) return;
  if (currentMode !== "hymn") switchScreen("hymn");
  const doc = display_win.document;
  const outputDiv = doc.getElementById("h_output");
  const bgNumDiv = doc.getElementById("h_bg_number");

  if (bgNumDiv) bgNumDiv.innerText = ""; // 背景番号クリア

  let wrap = "<div><p id='h_title_text'>" + currentTitleInfo[0] + "番</p>";
  wrap += "<p id='h_ch_text'><<" + currentTitleInfo[1] + ">></p>";
  wrap += "<p id='h_jp_text'><<" + currentTitleInfo[2] + ">></p>";
  wrap += "</div>";
  if (outputDiv) outputDiv.innerHTML = wrap;
}

let abbre = "",
  syou = "",
  setu = "";
let disp_worship_font = 4.0,
  disp_jtitle_font = 5.0,
  disp_ctitle_font = 5.0,
  disp_person_font = 5.0;

function memobible(num) {
  abbre = num;
  document.getElementById("syou").value = "";
  document.getElementById("setu").value = "";
  countVersesInChapter();
}
function memosyou(num) {
  syou = num;
  document.getElementById("setu").value = "";
  countVersesInChapter();
}
function memosetu(num) {
  setu = num;
}

function countVersesInChapter() {
  const display = document.getElementById("verse_count_display");
  const syouInput = document.getElementById("syou").value;
  if (!display) return;
  if (abbre === "" || !syouInput) {
    display.innerText = "";
    return;
  }
  const prefix = Abbre[abbre] + syouInput + ":";
  let count = 0;
  for (let i = 1; i < bible.length; i++)
    if (bible[i] && bible[i][3] && bible[i][3].indexOf(prefix) === 0) count++;
  display.innerText = count > 0 ? "この章の節数: " + count : "";
}

function checkwindow(mode) {
  let targetMode = "bible";
  if (mode === "bible_win" || mode === "bible") targetMode = "bible";
  if (mode === "title_win" || mode === "title") targetMode = "title";
  if (mode === "hymn_win" || mode === "hymn") targetMode = "hymn";

  if (display_win && !display_win.closed) {
    switchScreen(targetMode);
    if (targetMode === "bible") showBible();
    if (targetMode === "title") commit();
    display_win.focus();
  } else {
    openwindow();
    display_win.onload = () => {
      switchScreen(targetMode);
      if (targetMode === "bible") showBible();
      if (targetMode === "title") commit();
    };
    display_win.focus();
  }
}

function showBible() {
  if (!display_win || display_win.closed) return;
  let where = Abbre[abbre] + syou + ":" + setu;
  const outDiv = display_win.document.getElementById("b_out");
  for (let n = 1; n < bible.length; n++) {
    if (bible[n][3] == where) {
      // 導入：箇所表示をクラス化して赤色に (target_ref_jp/ch)
      outDiv.innerHTML = `<div id="master">
        <div id="jp">
          <div><b class="target_ref_jp">${bible[n][3]}</b> / ${kr[abbre]}${syou}:${setu}</div>
          <div class="target_jp">${bible[n][4]}</div>
        </div>
        <div id="ch">
          <div><b class="target_ref_ch">${bible[n][1]}</b> / ${en[abbre]}${syou}:${setu}</div>
          <div class="target_ch">${bible[n][2]}</div>
        </div>
      </div>`;
      break;
    }
  }
  commit();
}

function commit() {
  // 入力値の取得
  const worship = document.getElementById("worship").value;
  const thema_ja = document.getElementById("jtitle").value;
  const thema_ch = document.getElementById("ctitle").value;

  const speech =
    document.getElementById("speecher").value != ""
      ? "説教者：" + document.getElementById("speecher").value
      : "";
  const translator =
    document.getElementById("translator").value != ""
      ? "通訳者：" + document.getElementById("translator").value
      : "";
  const hymn_1nd = document.getElementById("hymn").value;
  const hymn_2nd = document.getElementById("hymn2nd").value;
  let hymnText = "讃美歌：" + hymn_1nd;
  hymnText += hymn_2nd != "" ? "/" + hymn_2nd : "";

  if (!display_win || display_win.closed) return;
  const doc = display_win.document;

  const bibleHeader = doc.getElementById("b_header");
  if (bibleHeader) {
    let output =
      '<div id="b_thema"><div id="b_worship">' +
      worship +
      '</div><div id="b_thema-jp">' +
      thema_ja +
      '</div><div id="b_thema-ch">' +
      thema_ch +
      "</div></div>" +
      '<div id="b_people"><div id="b_speech">' +
      speech +
      "<br>" +
      translator +
      "</div>" +
      '<div id="b_hymn">';
    output += hymn_1nd != "" ? "讃美歌：" + hymn_1nd : "";
    output += hymn_2nd != "" ? "/" + hymn_2nd : "";
    output += "</div></div>";
    bibleHeader.innerHTML = output;
  }

  if (doc.getElementById("t_worship"))
    doc.getElementById("t_worship").innerHTML = worship;
  if (doc.getElementById("t_thema_ja"))
    doc.getElementById("t_thema_ja").innerHTML = thema_ja;
  if (doc.getElementById("t_thema_ch"))
    doc.getElementById("t_thema_ch").innerHTML = thema_ch;
  if (doc.getElementById("t_speech"))
    doc.getElementById("t_speech").innerHTML = speech;
  if (doc.getElementById("t_translator"))
    doc.getElementById("t_translator").innerHTML = translator;
  if (doc.getElementById("t_hymn"))
    doc.getElementById("t_hymn").innerHTML = hymnText;

  const tickerJp = doc.getElementById('ticker-jp');
  const tickerCh = doc.getElementById('ticker-ch');

  if (tickerJp && tickerCh) {
    if (abbre !== "" && syou !== "") {
      tickerJp.innerText = `${FullNameJP[abbre]} ${syou}章 ${setu}節`;
      tickerCh.innerText = `${FullNameCH[abbre]} ${syou}章 ${setu}節`;
    } else {
      tickerJp.innerText = "";
      tickerCh.innerText = "";
    }
  }

  saveCookies();
  fontsizecommit();
}

function saveCookies() {
  document.cookie = "worship=" + document.getElementById("worship").value;
  document.cookie = "jtitle=" + document.getElementById("jtitle").value;
  document.cookie = "ctitle=" + document.getElementById("ctitle").value;
  document.cookie = "speecher=" + document.getElementById("speecher").value;
  document.cookie = "translator=" + document.getElementById("translator").value;
  document.cookie = "hymn=" + document.getElementById("hymn").value;
  document.cookie = "hymn2nd=" + document.getElementById("hymn2nd").value;
}

const input_ranges = document.querySelectorAll(".change_size");
for (let n = 0; n < input_ranges.length; n++) {
  input_ranges[n].addEventListener("input", () => fontsizecommit());
}

function fontsizecommit() {
  if (!display_win || display_win.closed) return;
  const doc = display_win.document;
  const setSize = (id, size) => {
    const el = doc.getElementById(id);
    if (el) el.style.fontSize = size + "em";
  };
  setSize("t_worship", disp_worship_font);
  setSize("t_thema_ja", disp_jtitle_font);
  setSize("t_thema_ch", disp_ctitle_font);
  setSize("t_speech", disp_person_font);
  setSize("t_translator", disp_person_font);
  setSize("t_hymn", disp_person_font);
}

let r = document.cookie.split(";");
r.forEach((value) => {
  let content = value.split("=");
  let key = content[0].trim();
  let val = content[1];
  if (key == "worship") document.getElementById("worship").value = val;
  if (key == "jtitle") document.getElementById("jtitle").value = val;
  if (key == "ctitle") document.getElementById("ctitle").value = val;
  if (key == "speecher") document.getElementById("speecher").value = val;
  if (key == "translator") document.getElementById("translator").value = val;
  if (key == "hymn") document.getElementById("hymn").value = val;
  if (key == "hymn2nd") document.getElementById("hymn2nd").value = val;
});
document.cookie = "";
setTimeout(commit, 2000);

const switch_lang = document.querySelectorAll(".switch");
switch_lang[0].click();
let lang_type_id = "ja_ot";
switch_lang[0].addEventListener("click", () => {
  document.getElementById("ot").innerHTML = "旧約";
  document.getElementById("nt").innerHTML = "新約";
});
switch_lang[1].addEventListener("click", () => {
  document.getElementById("ot").innerHTML = "旧约";
  document.getElementById("nt").innerHTML = "新约";
});

function active_abbre(type) {
  if (switch_lang[0].checked) {
    const id_name = "ja_" + type;
    document.getElementById(id_name).style.left = "0";
    lang_type_id = id_name;
  }
  if (switch_lang[1].checked) {
    const id_name = "ch_" + type;
    document.getElementById(id_name).style.left = "0";
    lang_type_id = id_name;
  }
}
document.querySelectorAll(".modal_abbre_btn").forEach((ele) => {
  ele.addEventListener("click", (e) => {
    if (e.target.className == "modal_abbre_btn") ele.style.left = "-100%";
  });
});

function abbre_btn(num, value) {
  memobible(num);
  document.getElementById("abbre_memo").innerHTML = value;
  document.getElementById(lang_type_id).style.left = "-100%";
}

function display_history(element, index) {
  if (index == 0) return;
  const arr = element[index].value.split(",");
  abbre = arr[0];
  syou = arr[1];
  setu = arr[2];
  const text = element[index].innerHTML;
  abbre_btn(abbre, text);
  document.getElementById("syou").value = syou;
  document.getElementById("setu").value = setu;
  showBible();
  element[0].selected = true;
  countVersesInChapter();
}
function append_history() {
  const history = document.getElementById("history");
  const option = document.createElement("option");
  option.value = abbre + "," + syou + "," + setu;
  option.innerHTML = document.getElementById("abbre_memo").innerHTML;
  option.label =
    document.getElementById("abbre_memo").innerHTML + " " + syou + ":" + setu;
  for (let n = 1; n < history.length; n++) {
    if (history[n].label == option.label) {
      history[n].remove();
      break;
    }
  }
  history[0].after(option);
}
function clear_history() {
  document.getElementById(
    "history"
  ).innerHTML = `<option value="">履歴</option>`;
}

const bibleSearchModal = document.getElementById("bibleSearchModal");
const openSearchModalBtn = document.getElementById("openSearchModalBtn");
const closeSearchModalBtn = document.getElementById("closeSearchModalBtn");
const searchInput = document.getElementById("searchInput");
const executeSearchBtn = document.getElementById("executeSearchBtn");
const searchResultsDiv = document.getElementById("searchResults");

function openBibleSearchModal() {
  if (bibleSearchModal) bibleSearchModal.style.display = "block";
  if (searchInput) {
    searchInput.value = "";
  }
  if (searchResultsDiv)
    searchResultsDiv.innerHTML =
      "<p>検索キーワードを入力して「検索」ボタンを押してください。</p>";
  if (
    typeof bible === "undefined" ||
    !Array.isArray(bible) ||
    bible.length === 0
  ) {
    if (searchResultsDiv)
      searchResultsDiv.innerHTML =
        '<p style="color: red; font-weight: bold;">エラー: 聖書データが正しく読み込まれていません。</p>';
    if (searchInput) searchInput.disabled = true;
    if (executeSearchBtn) executeSearchBtn.disabled = true;
  } else {
    if (searchInput) searchInput.disabled = false;
    if (executeSearchBtn) executeSearchBtn.disabled = false;
  }
}
function closeBibleSearchModal() {
  if (bibleSearchModal) bibleSearchModal.style.display = "none";
}

function performSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    searchResultsDiv.innerHTML = "<p>検索キーワードを入力してください。</p>";
    return;
  }
  const lowerCaseQuery = query.toLowerCase();
  const results = bible.filter((rowArray) => {
    const chineseReference = (rowArray[2] || "").toLowerCase();
    const japaneseReference = (rowArray[4] || "").toLowerCase();
    return (
      chineseReference.includes(lowerCaseQuery) ||
      japaneseReference.includes(lowerCaseQuery)
    );
  });
  displayResults(results, query);
}

function displayResults(results, query) {
  searchResultsDiv.innerHTML = "";
  if (results.length === 0) {
    searchResultsDiv.innerHTML =
      "<p>「" +
      escapeHTML(query) +
      "」に一致する情報は見つかりませんでした。</p>";
    return;
  }
  const highlight = (text, queryToHighlight) => {
    if (!text || !queryToHighlight) return escapeHTML(text || "");
    const regex = new RegExp("(" + escapeRegExp(queryToHighlight) + ")", "gi");
    return escapeHTML(text).replace(regex, '<span class="highlight">$1</span>');
  };
  results.forEach((rowArray) => {
    const resultItem = document.createElement("div");
    resultItem.className = "result-item";
    const chFullText = rowArray[1] || "";
    const chReference = rowArray[2] || "";
    const jpFullText = rowArray[3] || "";
    const jpReference = rowArray[4] || "";
    let displayReferenceText =
      chReference && jpReference
        ? chReference === jpReference
          ? chReference
          : `${chReference} / ${jpReference}`
        : chReference || jpReference || "参照情報なし";
    let contentHTML = `<p class="verse-ref">${highlight(
      displayReferenceText,
      query
    )}</p>`;
    if (jpFullText)
      contentHTML += `<p><span class="lang-label">日本語:</span> ${highlight(
        jpFullText,
        query
      )}</p>`;
    if (chFullText)
      contentHTML += `<p><span class="lang-label">中文:</span> ${highlight(
        chFullText,
        query
      )}</p>`;
    resultItem.innerHTML = contentHTML;
    searchResultsDiv.appendChild(resultItem);
  });
}

function escapeHTML(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[&<>"']/g, function (match) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[match];
  });
}
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (openSearchModalBtn)
  openSearchModalBtn.addEventListener("click", openBibleSearchModal);
if (closeSearchModalBtn)
  closeSearchModalBtn.addEventListener("click", closeBibleSearchModal);
if (executeSearchBtn) executeSearchBtn.addEventListener("click", performSearch);
if (searchInput) {
  searchInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      performSearch();
    }
  });
}
window.addEventListener("click", function (event) {
  if (event.target === bibleSearchModal) closeBibleSearchModal();
});
window.addEventListener("keydown", function (event) {
  if (
    event.key === "Escape" &&
    bibleSearchModal &&
    bibleSearchModal.style.display === "block"
  )
    closeBibleSearchModal();
});
window.onbeforeunload = function (e) {
  e.returnValue = "本当にページを閉じますか？";
};
window.addEventListener("unload", (e) => {
  if (display_win) display_win.close();
});

function updateActiveButton(activeBtn) {
  const buttons = document.querySelectorAll(".lyric-btn");
  buttons.forEach((btn) => btn.classList.remove("active"));
  if (activeBtn) activeBtn.classList.add("active");
}
// 入力候補（datalist）を最新の状態に更新する関数
function updateDatalistFromDB() {
  const sekkyoulist = document.getElementById("sekkyoulist");
  const tuyakulist = document.getElementById("tuyakulist");
  const sekkyouSelect = document.getElementById("sekkyouSelect");
  const tuyakuSelect = document.getElementById("tuyakuSelect");

  // 一旦クリア
  if (sekkyoulist) sekkyoulist.innerHTML = "";
  if (tuyakulist) tuyakulist.innerHTML = "";
  if (sekkyouSelect) sekkyouSelect.innerHTML = '<option value="">選択</option>';
  if (tuyakuSelect) tuyakuSelect.innerHTML = '<option value="">選択</option>';

  const transaction = db.transaction("servicers", "readonly");
  const store = transaction.objectStore("servicers");

  store.getAll().onsuccess = (e) => {
    const data = e.target.result;
    data.forEach(s => {
      // datalist用のoption作成
      const dlOption = document.createElement("option");
      dlOption.value = s.name;

      // select用のoption作成
      const selOption = document.createElement("option");
      selOption.value = s.name;
      selOption.innerText = s.name;

      if (s.role === 'sekkyou') {
        if (sekkyoulist) sekkyoulist.appendChild(dlOption);
        if (sekkyouSelect) sekkyouSelect.appendChild(selOption);
      } else if (s.role === 'tuyaku') {
        if (tuyakulist) tuyakulist.appendChild(dlOption);
        if (tuyakuSelect) tuyakuSelect.appendChild(selOption);
      }
    });
  };
}
// HTML側に onchange="syncSelectToInput('speecher', this)" のように記述
function syncSelectToInput(inputId, selectElement) {
  if (selectElement.value) {
      document.getElementById(inputId).value = selectElement.value;
      commit(); // 変更を即座に反映
      selectElement.selectedIndex = 0; // 選択後は「選択」に戻す
  }
}
// 4. バックアップ
function exportServicers() {
  db.transaction("servicers").objectStore("servicers").getAll().onsuccess = (e) => {
    const blob = new Blob([JSON.stringify(e.target.result)], {type: "application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "servicer_list_backup.json";
    a.click();
  };
}

function importServicers(event) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = JSON.parse(e.target.result);
    const tx = db.transaction(["servicers"], "readwrite");
    data.forEach(s => tx.objectStore("servicers").put({ name: s.name, role: s.role }));
    tx.oncomplete = () => { alert("インポート完了"); loadServicersList(); };
  };
  reader.readAsText(event.target.files[0]);
}

loadInitialData();