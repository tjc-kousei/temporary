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
  if (!value) {
    if (lyricsArea) lyricsArea.innerHTML = "";
    return;
  }
  currentTitleInfo = null;
  for (let n = 1; n < hymn.length; n++) {
    if (hymn[n][0].trim() === value.trim()) {
      currentTitleInfo = hymn[n];
      break;
    }
  }
  if (!currentTitleInfo) return;
  try {
    const response = await fetch(`./lyrics/${value}.txt`);
    if (response.ok) {
      const text = await response.text();
      currentLyricsSections = parseLyrics(text);
      if (lyricsArea) {
        let buttonsHTML = `<button onclick="switchScreen('hymn'); showTitleInPopup(); updateActiveButton(this);" class="lyric-btn" id="btn-title">タイトル</button>`;
        currentLyricsSections.forEach((sec, index) => {
          buttonsHTML += `<button onclick="switchScreen('hymn'); showLyricsVerse(${index}); updateActiveButton(this);" class="lyric-btn">${sec.label}</button>`;
        });
        lyricsArea.innerHTML = buttonsHTML;

        // ▼▼▼ 追加: 読み込み完了時に自動でタイトルを表示し、ボタンもActiveにする ▼▼▼
        switchScreen("hymn"); // 画面をHymnモードへ
        showTitleInPopup(); // スクリーンにタイトルを表示
        const titleBtn = document.getElementById("btn-title");
        if (titleBtn) updateActiveButton(titleBtn); // 手元のボタンをActive表示
        // ▲▲▲ 追加終わり ▲▲▲
      }
    } else {
      throw new Error("File not found");
    }
  } catch (e) {
    if (lyricsArea)
      lyricsArea.innerHTML =
        "<span style='color:gray; font-size:0.8rem;'>※歌詞なし</span>";
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
  } else {
    openwindow();
    display_win.onload = () => {
      switchScreen(targetMode);
      if (targetMode === "bible") showBible();
      if (targetMode === "title") commit();
    };
  }
}

function showBible() {
  if (display_win && !display_win.closed && currentMode !== "bible")
    switchScreen("bible");
  let where = Abbre[abbre] + syou + ":" + setu;
  let flag = false;
  if (!display_win || display_win.closed) return;
  const outDiv = display_win.document.getElementById("b_out");

  for (let n = 1; n < bible.length; n++) {
    if (bible[n] && bible[n][3] && where == bible[n][3]) {
      flag = true;
      let result =
        '<div id="master"><div id="jp"><div id="setu' +
        setu +
        '"><b><u id="' +
        setu +
        '">' +
        bible[n][3] +
        " / " +
        kr[abbre] +
        syou +
        ":" +
        setu +
        "</u></b></div>" +
        '<div class="target_jp" id="jp' +
        setu +
        '">' +
        bible[n][4] +
        "</div></div>" +
        '<div id="ch"><div id="setu' +
        setu +
        '"><b><u id="' +
        setu +
        '">' +
        bible[n][1] +
        "/" +
        en[abbre] +
        syou +
        ":" +
        setu +
        "</u></b></div>" +
        '<div class="target_ch" id="ch' +
        setu +
        '">' +
        bible[n][2] +
        "</div></div></div><br>";
      if (outDiv) outDiv.innerHTML = result;
    }
    if (flag) break;
  }
  if (!flag && outDiv) outDiv.innerHTML = "";
  commit();
}

function commit() {
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

  if (!display_win || display_win.closed) {
    saveCookies();
    return;
  }
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

loadInitialData();
