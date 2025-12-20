let bible_win, title_win, hymn_win;
function openwindow() {
  bible_win = window.open(
    "./popwindow/bible.html",
    "bible_win",
    "width=600,height=600"
  );
  title_win = window.open(
    "./popwindow/title.html",
    "title_win",
    "width=600,height=600"
  );
  hymn_win = window.open(
    "./popwindow/hymn.html",
    "hymn_win",
    "width=600,height=600"
  );
}
openwindow();

//事前に記憶する配列
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
// 韓国語の略称
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

//データ読み込みエリア //
let bible = []; //聖書用リスト
let hymn = []; //讃美歌用リスト
let TitleList = {};
let servicerList = {};

// 歌詞データを一時保存する変数
let currentLyricsSections = [];
let currentTitleInfo = null;

// ★ヘルパー関数: CSV読み込みをPromise化（待機可能にする）
function loadCSVAsync(url) {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.open("get", url, true);
    req.onload = () => {
      if (req.status >= 200 && req.status < 300) {
        resolve(req.responseText);
      } else {
        reject(req.statusText);
      }
    };
    req.onerror = () => reject(req.statusText);
    req.send(null);
  });
}

// ★進捗更新用関数
function updateProgress(percent, message) {
  const bar = document.getElementById("progress-bar");
  const detail = document.getElementById("loading-detail");
  if (bar) bar.style.width = percent + "%";
  if (detail) detail.innerText = message;
}

// ★メインの読み込み関数（async/awaitに変更）
async function loadInitialData() {
  const overlay = document.getElementById("loading-overlay");

  // 1. 初期状態 (0%)
  updateProgress(5, "接続を開始します...");

  const urlParams = new URLSearchParams(window.location.search);
  const churchName = urlParams.get("church");
  const GAS_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbyWVCbzcHS9n1ZzL21kLOLmjOJJT7s1U0qksIksyAbBYoA_k7iMKnQneYt1oveRwpBz/exec";

  try {
    // 2. Google Sheets データ取得 (30%まで)
    if (churchName) {
      updateProgress(15, `設定データを取得中 (${churchName})...`);
      const apiUrl = `${GAS_WEB_APP_URL}?church=${encodeURIComponent(
        churchName
      )}`;

      const response = await fetch(apiUrl);
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
      } else {
        console.log(`APIエラー: ${response.status}`);
      }
    } else {
      console.log("現在のURLには 'church' パラメータが見つかりません。");
    }

    // 3. 聖書データ読み込み (30% -> 60%)
    updateProgress(40, "聖書データを読み込んでいます...");
    const bibleData = await loadCSVAsync("./Data.csv");
    convertbibleCSVtoArray(bibleData);

    // 4. 讃美歌データ読み込み (60% -> 90%)
    updateProgress(75, "讃美歌データを読み込んでいます...");
    const hymnData = await loadCSVAsync("./hymn.csv");
    converthymnCSVtoArray(hymnData);

    // 5. 完了 (100%)
    updateProgress(100, "準備完了！");

    // 少し待ってからフェードアウト
    setTimeout(() => {
      if (overlay) overlay.classList.add("hidden");
    }, 800);
  } catch (error) {
    console.error("Error loading initial data:", error);
    updateProgress(100, "エラーが発生しました");
    if (document.getElementById("loading-text")) {
      document.getElementById("loading-text").innerText = "読み込み失敗";
      document.getElementById("loading-text").style.color = "#e53935";
    }
    alert("データの読み込みに失敗しました。再読み込みしてください。");
  }
}

function convertbibleCSVtoArray(str) {
  let tmp = str.split("\n");
  for (let i = 0; i < tmp.length; ++i) {
    bible[i] = tmp[i].split(",");
  }
}

function converthymnCSVtoArray(str) {
  let tmp = str.split("\n");
  document.getElementById("hymn").disabled = true;
  const hymnlist = document.getElementById("hymnlist");
  for (let i = 1; i < tmp.length; ++i) {
    hymn[i] = tmp[i].split(",");
    let option = document.createElement("option");
    option.value = hymn[i][0].trim();
    hymnlist.appendChild(option);
  }
  document.getElementById("hymn").disabled = false;
}

// === 歌詞表示用ロジック ===

async function recievehymn(value) {
  const lyricsArea = document.getElementById("lyrics_area");
  const outputDiv = hymn_win
    ? hymn_win.document.getElementById("output")
    : null;

  if (!value) {
    if (lyricsArea) lyricsArea.innerHTML = "";
    if (outputDiv) outputDiv.innerHTML = "";
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

    // 入力チェック（競合対策）
    const currentInput = document.getElementById("prehymn").value.trim();
    if (value !== currentInput) return;

    if (response.ok) {
      const text = await response.text();

      // HTML誤検知対策
      if (text.trim().startsWith("<")) throw new Error("Invalid content");

      currentLyricsSections = parseLyrics(text);

      if (lyricsArea) {
        // ★変更点: タイトルボタンを追加し、class="lyric-btn" を適用
        let buttonsHTML = `<button onclick="showTitleInPopup(); updateActiveButton(this);" class="lyric-btn" id="btn-title">タイトル</button>`;

        currentLyricsSections.forEach((sec, index) => {
          // ★変更点: 各ボタンにも class="lyric-btn" と updateActiveButton を追加
          buttonsHTML += `<button onclick="showLyricsVerse(${index}); updateActiveButton(this);" class="lyric-btn">${sec.label}</button>`;
        });
        lyricsArea.innerHTML = buttonsHTML;

        // 初期表示としてタイトルを表示し、ボタンをアクティブにする
        showTitleInPopup();
        const titleBtn = document.getElementById("btn-title");
        if (titleBtn) updateActiveButton(titleBtn);
      } else {
        showTitleInPopup();
      }
    } else {
      throw new Error("Lyrics file not found");
    }
  } catch (e) {
    if (lyricsArea)
      lyricsArea.innerHTML =
        "<span style='color:gray; font-size:0.8rem;'>※歌詞なし</span>";
    showTitleInPopup();
  }
}

// ★追加: ルビ変換関数
// 漢字(ふりがな) のパターンを検出し、<ruby>タグに変換します
function convertRuby(text) {
  // 漢字（一-龠々）の直後に (ひらがなorカタカナor長音) がある場合をマッチ
  // 必要に応じて正規表現の範囲は調整してください
  return text.replace(
    /([一-龠々]+)\(([ぁ-んァ-ヶー]+)\)/g,
    "<ruby>$1<rt>$2</rt></ruby>"
  );
}

// script.js 内の parseLyrics を修正

function parseLyrics(text) {
  const regex = /\[(.*?)\]/g;
  let match;
  let lastIndex = 0;
  const sections = [];
  let currentLabel = null;

  // 内部関数: コンテンツを処理してHTML化する
  const processContent = (rawText) => {
    // ★修正: 前後の空白・改行を削除して、意図しない空行を防ぐ
    rawText = rawText.trim();
    if (!rawText) return "";

    // 1. ルビ変換を実行
    let processed = convertRuby(rawText);

    // 2. 改行コードで分割し、各行をdivで囲む
    return processed
      .split(/\r\n|\n/)
      .map((line) => {
        // 空行（歌詞の間のスペース）の場合
        if (!line.trim()) return '<div style="min-height: 1.2em;">&nbsp;</div>';

        // 通常行
        return `<div style="white-space: nowrap; text-align: center; margin: 2px 0;">${line}</div>`;
      })
      .join("");
  };

  while ((match = regex.exec(text)) !== null) {
    if (currentLabel) {
      sections.push({
        label: currentLabel,
        content: processContent(text.substring(lastIndex, match.index)),
      });
    }
    currentLabel = match[1];
    lastIndex = regex.lastIndex;
  }
  if (currentLabel) {
    sections.push({
      label: currentLabel,
      content: processContent(text.substring(lastIndex)),
    });
  }
  return sections;
}

// ★変更: showLyricsVerse
// parseLyricsで既にHTML化（行ごとのdiv化）が済んでいるため、シンプルに表示するだけにする
function showLyricsVerse(index) {
  if (!hymn_win || hymn_win.closed || !currentTitleInfo) return;

  // 既にHTMLタグ(rubyやdiv)が含まれた文字列
  const contentHtml = currentLyricsSections[index].content;
  const doc = hymn_win.document;

  const headerHtml = `
    <div style="flex: 0 0 auto; width: 100%; text-align: center; padding: 10px; background: rgba(255,255,255,0.9); border-bottom: 2px solid #ccc;">
      <span style="font-size: 4rem; font-weight: bold;">${currentTitleInfo[0]} ${currentTitleInfo[2]}/${currentTitleInfo[1]}</span>
    </div>
  `;

  const bodyHtml = `
    <div id="lyric-container" style="flex: 1; width: 100%; height: 100%; overflow: hidden; display: flex; justify-content: center; align-items: center;">
      <div id="lyric-text" style="display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; line-height: 1.5;">
        ${contentHtml}
      </div>
    </div>
  `;

  doc.getElementById("output").innerHTML = `
    <div style="display: flex; flex-direction: column; height: 100vh; width: 100%; margin: 0; padding: 0;">
      ${headerHtml}
      ${bodyHtml}
    </div>
  `;

  // フォントサイズ調整実行
  const container = doc.getElementById("lyric-container");
  const textEl = doc.getElementById("lyric-text");

  // 少し待ってから調整（レンダリング待ち）
  setTimeout(() => {
    adjustFontSizeForLyrics(container, textEl);
  }, 10);

  hymn_win.onresize = function () {
    adjustFontSizeForLyrics(container, textEl);
  };
}

// script.js 内の adjustFontSizeForLyrics を修正

function adjustFontSizeForLyrics(container, element) {
  if (!container || !element) return;

  const cWidth = container.clientWidth;
  const cHeight = container.clientHeight;
  if (cWidth === 0 || cHeight === 0) return;

  // ★修正: 開始サイズ（最大サイズ）を15から8に下げる
  // これにより、短い歌詞（アーメンなど）でも巨大になりすぎないようにする
  let size = 8;
  element.style.fontSize = size + "rem";

  const minSize = 0.5;

  let loopCount = 0;
  // コンテナに収まるまで縮小する
  while (
    (element.scrollWidth > cWidth || element.scrollHeight > cHeight) &&
    size > minSize &&
    loopCount < 100
  ) {
    size -= 0.5;
    element.style.fontSize = size + "rem";
    loopCount++;
  }
}

function showTitleInPopup() {
  if (!hymn_win || hymn_win.closed || !currentTitleInfo) return;
  const doc = hymn_win.document;
  let wrap = "<div><p id='title'>" + currentTitleInfo[0] + "番</p>";
  wrap += "<p id='ch'><<" + currentTitleInfo[1] + ">></p>";
  wrap += "<p id='jp'><<" + currentTitleInfo[2] + ">></p>";
  wrap += "</div>";
  doc.getElementById("output").innerHTML = wrap;
}

// === 以下、既存ロジック（変更なし） ===

let abbre = "";
let syou = "";
let setu = "";
let disp_worship_font = 4.0;
let disp_jtitle_font = 5.0;
let disp_ctitle_font = 5.0;
let disp_person_font = 5.0;

function memobible(num) {
  abbre = num;
  document.getElementById("syou").value = "";
  document.getElementById("setu").value = "";
  countVersesInChapter(); // ★書簡変更時はクリアされるので再計算（表示消去）
}
function memosyou(num) {
  syou = num;
  document.getElementById("setu").value = "";
  countVersesInChapter(); // ★章入力時に再計算
}
function memosetu(num) {
  setu = num;
}

// ★追加：選択中の章の節数をカウントして表示
function countVersesInChapter() {
  const display = document.getElementById("verse_count_display");
  const syouInput = document.getElementById("syou").value;

  if (!display) return;

  // 章が未入力の場合は表示を消して終了
  if (abbre === "" || !syouInput) {
    display.innerText = "";
    return;
  }

  const bookName = Abbre[abbre];
  // 検索用のプレフィックスを作成（例: "創1:"）
  const targetPrefix = bookName + syouInput + ":";

  let count = 0;
  // bible配列を走査してカウント
  // bible[n][3] に日本語のリファレンスが入っている (例: "創1:1")
  for (let i = 1; i < bible.length; i++) {
    if (bible[i] && bible[i][3]) {
      if (bible[i][3].indexOf(targetPrefix) === 0) {
        count++;
      }
    }
  }

  if (count > 0) {
    display.innerText = "この章の節数: " + count;
  } else {
    display.innerText = "";
  }
}

function checkwindow(win_name) {
  if (win_name == "bible_win") {
    if (bible_win.closed) {
      bible_win = window.open(
        "./popwindow/bible.html",
        "bible_win",
        "width=500,height=500"
      );
      bible_win.onload = () => {
        commit();
        showBible();
      };
    } else bible_win.focus();
  } else if (win_name == "title_win") {
    if (title_win.closed) {
      title_win = window.open(
        "./popwindow/title.html",
        "title_win",
        "width=500,height=500"
      );
      title_win.onload = () => {
        commit();
      };
    } else title_win.focus();
  } else if (win_name == "hymn_win") {
    if (hymn_win.closed)
      hymn_win = window.open(
        "./popwindow/hymn.html",
        "hymn_win",
        "width=500,height=500"
      );
    else hymn_win.focus();
  }
}

function showBible() {
  let where = Abbre[abbre] + syou + ":" + setu;
  let flag = false;
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
        "</u></b></div>";
      result +=
        '<div class="target_jp" id="jp' +
        setu +
        '">' +
        bible[n][4] +
        "</div></div>";
      result +=
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
        "</u></b></div>";
      result +=
        '<div class="target_ch" id="ch' +
        setu +
        '">' +
        bible[n][2] +
        "</div></div></div><br>";

      if (bible_win && bible_win.document.getElementById("out")) {
        bible_win.document.getElementById("out").innerHTML = result;
      }
    }
    if (flag) break;
  }
  if (!flag && bible_win && bible_win.document.getElementById("out"))
    bible_win.document.getElementById("out").innerHTML = "";
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

  let output =
    '<div id="thema"><div id="worship">' +
    worship +
    '</div><div id="thema-jp">' +
    thema_ja +
    '</div><div id="thema-ch">' +
    thema_ch +
    "</div></div>";
  output +=
    '<div id="people"><div id="speech">' +
    speech +
    "<br>" +
    translator +
    "</div>";
  output += '<div id="hymn">';
  output += hymn_1nd != "" ? "讃美歌：" + hymn_1nd : "";
  output += hymn_2nd != "" ? "/" + hymn_2nd : "";
  output += "</div></div>";

  if (bible_win && bible_win.document.getElementById("title")) {
    bible_win.document.getElementById("title").innerHTML = output;
  }

  if (title_win) {
    if (title_win.document.getElementById("worship"))
      title_win.document.getElementById("worship").innerHTML =
        document.getElementById("worship").value;
    if (title_win.document.getElementById("thema_ja"))
      title_win.document.getElementById("thema_ja").innerHTML =
        document.getElementById("jtitle").value;
    if (title_win.document.getElementById("thema_ch"))
      title_win.document.getElementById("thema_ch").innerHTML =
        document.getElementById("ctitle").value;
    if (title_win.document.getElementById("speech"))
      title_win.document.getElementById("speech").innerHTML =
        "説教者：" + document.getElementById("speecher").value;
    if (title_win.document.getElementById("translator"))
      title_win.document.getElementById("translator").innerHTML =
        "通訳者：" + document.getElementById("translator").value;

    const hymn1 = document.getElementById("hymn").value;
    const hymn2 = document.getElementById("hymn2nd").value;
    let hymnText = "讃美歌：" + hymn1;
    hymnText += hymn2 != "" ? "/" + hymn2 : "";
    if (title_win.document.getElementById("hymn"))
      title_win.document.getElementById("hymn").innerHTML = hymnText;
  }

  document.cookie = "worship=" + document.getElementById("worship").value;
  document.cookie = "jtitle=" + document.getElementById("jtitle").value;
  document.cookie = "ctitle=" + document.getElementById("ctitle").value;
  document.cookie = "speecher=" + document.getElementById("speecher").value;
  document.cookie = "translator=" + document.getElementById("translator").value;

  fontsizecommit();
}

const input_ranges = document.querySelectorAll(".change_size");
for (let n = 0; n < input_ranges.length; n++) {
  input_ranges[n].addEventListener("input", () => {
    fontsizecommit();
  });
}

function fontsizecommit() {
  if (title_win) {
    if (title_win.document.getElementById("worship"))
      title_win.document.getElementById("worship").style.fontSize =
        disp_worship_font + "em";
    if (title_win.document.getElementById("thema_ja"))
      title_win.document.getElementById("thema_ja").style.fontSize =
        disp_jtitle_font + "em";
    if (title_win.document.getElementById("thema_ch"))
      title_win.document.getElementById("thema_ch").style.fontSize =
        disp_ctitle_font + "em";
    if (title_win.document.getElementById("speech"))
      title_win.document.getElementById("speech").style.fontSize =
        disp_person_font + "em";
    if (title_win.document.getElementById("translator"))
      title_win.document.getElementById("translator").style.fontSize =
        disp_person_font + "em";
    if (title_win.document.getElementById("hymn"))
      title_win.document.getElementById("hymn").style.fontSize =
        disp_person_font + "em";
  }
}

// クッキーに保存した情報を再入力
let r = document.cookie.split(";");

r.forEach((value, num, array) => {
  let content = value.split("=");
  if (content[0].replace(" ", "") == "worship")
    document.getElementById("worship").value = content[1];
  if (content[0].replace(" ", "") == "jtitle")
    document.getElementById("jtitle").value = content[1];
  if (content[0].replace(" ", "") == "ctitle")
    document.getElementById("ctitle").value = content[1];
  if (content[0].replace(" ", "") == "speecher")
    document.getElementById("speecher").value = content[1];
  if (content[0].replace(" ", "") == "translator")
    document.getElementById("translator").value = content[1];
  if (content[0].replace(" ", "") == "hymn")
    document.getElementById("hymn").value = content[1];
  if (content[0].replace(" ", "") == "hymn2nd")
    document.getElementById("hymn2nd").value = content[1];
});
document.cookie = "";
setTimeout(commit, 2000);

const switch_lang = document.querySelectorAll(".switch");
switch_lang[0].click();
let lang_type_id = "ja_ot";

switch_lang[0].addEventListener("click", (e) => {
  document.getElementById("ot").innerHTML = "旧約";
  document.getElementById("nt").innerHTML = "新約";
});
switch_lang[1].addEventListener("click", (e) => {
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
  countVersesInChapter(); // ★履歴呼び出し時に再計算
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
    searchInput.focus();
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
  if (bible_win) bible_win.close();
  if (title_win) title_win.close();
  if (hymn_win) hymn_win.close();
});

// ★ボタンのハイライト切り替え用関数
function updateActiveButton(activeBtn) {
  // すべての歌詞ボタンから active クラスを削除
  const buttons = document.querySelectorAll(".lyric-btn");
  buttons.forEach((btn) => btn.classList.remove("active"));

  // クリックされたボタンに active クラスを追加
  if (activeBtn) {
    activeBtn.classList.add("active");
  }
}

loadInitialData();
