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

//データ読み込みエリア //
let bible = []; //聖書用リスト
let hymn = []; //讃美歌用リスト
let TitleList = {};
let servicerList = {}; // To store data from servicer.json

async function loadInitialData() {
  try {
    // Load Bible CSV
    // Bible CSVの読み込み
    let bibleReq = new XMLHttpRequest();
    bibleReq.open("get", "./Data.csv", true);
    bibleReq.send(null);
    bibleReq.onload = function(){
        convertbibleCSVtoArray(bibleReq.responseText);
    }

    // Hymn CSVの読み込み
    let hymnReq = new XMLHttpRequest();
    hymnReq.open("get", "./hymn.csv", true);
    hymnReq.send(null);
    hymnReq.onload = function(){
      converthymnCSVtoArray(hymnReq.responseText);
    }

    // Load Servicer JSON
    // if (data.servicerJson) {
    //   servicerList = data.servicerJson;
    //   const sekkyoulist = document.getElementById("sekkyoulist");
    //   const tuyakulist = document.getElementById("tuyakulist");

    //   //奉仕人員読み込み
    //   for (const keys in servicerList) {
    //     for (const key in servicerList[keys]) {
    //       if (servicerList[keys][key].role == "sekkyou") {
    //         let sekkyou = document.createElement("option");
    //         sekkyou.value = servicerList[keys][key].name;
    //         sekkyoulist.appendChild(sekkyou);
    //       } else if (servicerList[keys][key].role == "tuyaku") {
    //         let tuyaku = document.createElement("option");
    //         tuyaku.value = servicerList[keys][key].name;
    //         tuyakulist.appendChild(tuyaku);
    //       }
    //     }
    //   }
    // }

    // Load Title JSON
    // if (data.titleJson) {
    //   TitleList = data.titleJson;
    //   let input = document.getElementById("speecher");
    //   input.addEventListener("input", (e) => getTitle(e.target));
    //   getTitle(input);
    // }
  } catch (error) {
    console.error("Error loading initial data:", error);
    alert("データの読み込みに失敗しました。");
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

// Get the church keyword from the URL
// const currentPath = window.location.pathname;
// const pathSegments = currentPath.split("/");
// const MyChurch = pathSegments[pathSegments.indexOf("church") + 1];

// if (MyChurch) {
//   loadInitialData(MyChurch);
// } else {
//   console.error("Church keyword not found in URL");
// }

// データ読み込みエリア //

//関数群
// 讃美歌タイトル出力
function recievehymn(value) {
  if (value == "") hymn_win.document.getElementById("output").innerHTML = "";
  else
    try {
      let tar = hymn_win.document.getElementById("output");
      for (let n = 1; n < hymn.length; n++)
        if (hymn[n][0].includes(value)) {
          let wrap = "<div><p id='title'>" + hymn[n][0] + "番</p>";
          wrap += "<p id='ch'><<" + hymn[n][1] + ">></p>";
          wrap += "<p id='jp'><<" + hymn[n][2] + ">></p>";
          wrap += "</div>";
          tar.innerHTML = wrap;
          return;
        }
    } catch (e) {
      console.log(e);
    }
}

function getTitle(e) {
  const jtitlelist = document.getElementById("jtitlelist");
  const ctitlelist = document.getElementById("ctitlelist");
  jtitlelist.innerHTML = "";
  ctitlelist.innerHTML = "";
  if (e.value.length <= 4) return;
  for (const keys in TitleList) {
    if (e.value == keys) {
      for (const key in TitleList[keys]) {
        const joption = document.createElement("option");
        const coption = document.createElement("option");
        joption.value = TitleList[keys][key].japanese;
        joption.innerHTML = TitleList[keys][key].date;
        jtitlelist.appendChild(joption);
        coption.value = TitleList[keys][key].chinese;
        coption.innerHTML = TitleList[keys][key].date;
        ctitlelist.appendChild(coption);
      }
    }
  }
}

//記憶するための変数
let abbre = "";
let syou = "";
let setu = "";
let j_title_font = 4.0; //日本語タイトル文字サイズ
let c_title_font = 4.0; //中国語タイトル文字サイズ
let person_font = 2.7; //奉仕者文字サイズ
let bible_font = 3.7; //聖書文字サイズ
let worship_font = 2.4; //礼拝種類文字サイズ
let disp_worship_font = 4.0; //表示礼拝種類文字サイズ
let disp_jtitle_font = 5.0; //表示日本語タイトル
let disp_ctitle_font = 5.0; //表示中国語タイトル
let disp_person_font = 5.0; //表示奉仕者タイトル

// 聖書箇所記憶
function memobible(num) {
  abbre = num;
  document.getElementById("syou").value = "";
  document.getElementById("setu").value = "";
}
function memosyou(num) {
  syou = num;
  document.getElementById("setu").value = "";
}
function memosetu(num) {
  setu = num;
}

// 別窓のチェック
function checkwindow(win_name) {
  if (win_name == "bible_win") {
    if (bible_win.closed) {
      bible_win = window.open(
        "/popwindow/bible.html",
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
        "/popwindow/title.html",
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
        "/popwindow/hymn.html",
        "hymn_win",
        "width=500,height=500"
      );
    else hymn_win.focus();
  }
}

//聖書表示
function showBible() {
  let where = Abbre[abbre] + syou + ":" + setu;
  let flag = false;
  for (let n = 1; n < bible.length; n++) {
    // Adjusted loop condition
    if (bible[n] && bible[n][3] && where == bible[n][3]) {
      // Added check for bible[n] and bible[n][3]
      flag = true;
      let result =
        '<div id="master"><div id="jp"><div id="setu' +
        setu +
        '"><b><u id="' +
        setu +
        '">' +
        bible[n][3] +
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
      bible_win.document.getElementById("out").innerHTML = result;
    }
    if (flag) break;
  }
  if (!flag) bible_win.document.getElementById("out").innerHTML = "";
}

// 情報を記入
function commit() {
  //聖書表示
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
  if (bible_win && bible_win.document.getElementById("title")) {
    bible_win.document.getElementById("title").innerHTML = output;
  }

  //タイトルのみ
  if (title_win) {
    title_win.document.getElementById("worship").innerHTML =
      document.getElementById("worship").value;
    title_win.document.getElementById("thema_ja").innerHTML =
      document.getElementById("jtitle").value;
    title_win.document.getElementById("thema_ch").innerHTML =
      document.getElementById("ctitle").value;
    title_win.document.getElementById("speech").innerHTML =
      "説教者：" + document.getElementById("speecher").value;
    title_win.document.getElementById("translator").innerHTML =
      "通訳者：" + document.getElementById("translator").value;
    const hymn1 = document.getElementById("hymn").value;
    const hymn2 = document.getElementById("hymn2nd").value;
    title_win.document.getElementById("hymn").innerHTML = "讃美歌：" + hymn1;
    title_win.document.getElementById("hymn").innerHTML +=
      hymn2 != "" ? "/" + hymn2 : "";
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
  if (bible_win && bible_win.document.getElementById("worship"))
    bible_win.document.getElementById("worship").style.fontSize =
      worship_font + "em";
  if (bible_win && bible_win.document.getElementById("thema-jp"))
    bible_win.document.getElementById("thema-jp").style.fontSize =
      j_title_font + "em";
  if (bible_win && bible_win.document.getElementById("thema-ch"))
    bible_win.document.getElementById("thema-ch").style.fontSize =
      c_title_font + "em";
  if (bible_win && bible_win.document.getElementById("people"))
    bible_win.document.getElementById("people").style.fontSize =
      person_font + "em";
  if (bible_win && bible_win.document.getElementById("out"))
    bible_win.document.getElementById("out").style.fontSize = bible_font + "em";

  if (title_win) {
    title_win.document.getElementById("worship").style.fontSize =
      disp_worship_font + "em";
    title_win.document.getElementById("thema_ja").style.fontSize =
      disp_jtitle_font + "em";
    title_win.document.getElementById("thema_ch").style.fontSize =
      disp_ctitle_font + "em";
    title_win.document.getElementById("speech").style.fontSize =
      disp_person_font + "em";
    title_win.document.getElementById("translator").style.fontSize =
      disp_person_font + "em";
    title_win.document.getElementById("hymn").style.fontSize =
      disp_person_font + "em";
  }
}

//設定関連

//関数群 ここまで

// クッキーに保存した情報を再入力
let r = document.cookie.split(";"); //split(';')を使用しデータを1つずつに分ける

r.forEach((value, num, array) => {
  let content = value.split("="); //split('=')を使用しcookie名と値に分ける

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

// 言語切り替え
const switch_lang = document.querySelectorAll(".switch");
switch_lang[0].click();
// 直近の種類 デフォルトを日本語にする
let lang_type_id = "ja_ot";

switch_lang[0].addEventListener("click", (e) => {
  const ot = document.getElementById("ot");
  const nt = document.getElementById("nt");
  ot.innerHTML = "旧約";
  nt.innerHTML = "新約";
});
switch_lang[1].addEventListener("click", (e) => {
  const ot = document.getElementById("ot");
  const nt = document.getElementById("nt");
  ot.innerHTML = "旧约";
  nt.innerHTML = "新约";
});

// モーダル出現させる
function active_abbre(type) {
  // 日本語が選択されている時
  if (switch_lang[0].checked) {
    const id_name = "ja_" + type;
    document.getElementById(id_name).style.left = "0";
    lang_type_id = id_name;
  }

  // 中国語が選択されている時
  if (switch_lang[1].checked) {
    const id_name = "ch_" + type;
    document.getElementById(id_name).style.left = "0";
    lang_type_id = id_name;
  }
}
// モーダルの余白部分をクリックすると抜け出す機能
document.querySelectorAll(".modal_abbre_btn").forEach((ele) => {
  ele.addEventListener("click", (e) => {
    if (e.target.className == "modal_abbre_btn") ele.style.left = "-100%";
  });
});

// 書簡のボタン
function abbre_btn(num, value) {
  memobible(num);
  document.getElementById("abbre_memo").innerHTML = value;
  document.getElementById(lang_type_id).style.left = "-100%";
}

// 履歴ボタン用
function display_history(element, index) {
  // ”履歴”を選択した時強制脱出
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
  // 選択肢を”履歴”に戻す
  element[0].selected = true;
}
// 履歴に追加する記憶ボタン
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
// 履歴削除
function clear_history() {
  const history = document.getElementById("history");
  history.innerHTML = `<option value="">履歴</option>`;
}

// Modify saving functions to use fetch
// async function saveTitle() {
//   const speecher = document.getElementById("speecher").value;
//   const jtitle = document.getElementById("jtitle").value;
//   const ctitle = document.getElementById("ctitle").value;
//   if (speecher !== "" && jtitle !== "" && ctitle !== "") {
//     let date = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }); // Use ja-JP for Japanese formatting
//     if (!TitleList[speecher]) {
//       TitleList[speecher] = [];
//     }

//     // Check for duplicates before adding
//     const isDuplicate = TitleList[speecher].some(
//       (item) => item.japanese === jtitle || item.chinese === ctitle
//     );

//     if (isDuplicate) {
//       alert(`【${speecher}】のタイトルは既に存在します`);
//       return;
//     }

//     TitleList[speecher].push({
//       date: date,
//       japanese: jtitle,
//       chinese: ctitle,
//     });

//     try {
//       const response = await fetch(`/api/church/${MyChurch}/save-title`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(TitleList),
//       });
//       const result = await response.json();
//       if (result.success) {
//         alert(`【${speecher}】に【${jtitle}】と【${ctitle}】を保存しました`);
//       } else {
//         alert(`タイトルの保存に失敗しました: ${result.message}`);
//       }
//     } catch (error) {
//       console.error("Error saving title data:", error);
//       alert("タイトルの保存中にエラーが発生しました。");
//     }
//   } else {
//     alert(`日本語タイトル、中国語タイトル、説教者を全て記入してください`);
//   }
// }

// --- 聖句検索モーダル関連 ---
const bibleSearchModal = document.getElementById("bibleSearchModal");
const openSearchModalBtn = document.getElementById("openSearchModalBtn");
const closeSearchModalBtn = document.getElementById("closeSearchModalBtn"); // モーダルの閉じるボタン
const searchInput = document.getElementById("searchInput");
const executeSearchBtn = document.getElementById("executeSearchBtn");
const searchResultsDiv = document.getElementById("searchResults");

// モーダルを開く関数
function openBibleSearchModal() {
  if (bibleSearchModal) bibleSearchModal.style.display = "block";
  if (searchInput) {
    searchInput.value = ""; // 検索窓をクリア
    searchInput.focus(); // 検索窓にフォーカス
  }
  if (searchResultsDiv)
    searchResultsDiv.innerHTML =
      "<p>検索キーワードを入力して「検索」ボタンを押してください。</p>";

  if (searchResultsDiv) {
    // bible変数の存在と形式をチェック
    if (
      typeof bible === "undefined" ||
      !Array.isArray(bible) ||
      bible.length === 0
    ) {
      searchResultsDiv.innerHTML =
        '<p style="color: red; font-weight: bold;">エラー: 聖書データが正しく読み込まれていません。管理者にお問い合わせください。</p>';
      console.error(
        "Error: 'bible' variable is not defined, not an array, or is empty."
      );
      // 必要であれば検索機能自体を無効化
      if (searchInput) searchInput.disabled = true;
      if (executeSearchBtn) executeSearchBtn.disabled = true;
      return;
    } else {
      // データが正常なら検索機能を有効化 (以前無効化されていた場合のため)
      if (searchInput) searchInput.disabled = false;
      if (executeSearchBtn) executeSearchBtn.disabled = false;
      searchResultsDiv.innerHTML =
        "<p>検索キーワードを入力して「検索」ボタンを押してください。</p>";
    }
  }
}

// モーダルを閉じる関数
function closeBibleSearchModal() {
  if (bibleSearchModal) bibleSearchModal.style.display = "none";
}

// 検索を実行する関数
function performSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    searchResultsDiv.innerHTML = "<p>検索キーワードを入力してください。</p>";
    return;
  }

  // bible変数が利用可能か再度チェック (念のため)
  if (
    typeof bible === "undefined" ||
    !Array.isArray(bible) ||
    bible.length === 0
  ) {
    searchResultsDiv.innerHTML =
      '<p style="color: red; font-weight: bold;">エラー: 聖書データが利用できません。</p>';
    console.error("Error during search: 'bible' variable is not available.");
    return;
  }

  const lowerCaseQuery = query.toLowerCase();
  const results = bible.filter((rowArray) => {
    // 新しいCSV構造と検索対象インデックスに基づく:
    // インデックス 2: 'ch' (中国語の略称/参照)
    // インデックス 4: 'jp' (日本語の略称/参照)
    const chineseReference = (rowArray[2] || "").toLowerCase();
    const japaneseReference = (rowArray[4] || "").toLowerCase();

    return (
      chineseReference.includes(lowerCaseQuery) ||
      japaneseReference.includes(lowerCaseQuery)
    );
  });

  displayResults(results, query);
}

/// 検索結果を表示する関数
function displayResults(results, query) {
  searchResultsDiv.innerHTML = ""; // 前回の結果をクリア

  if (results.length === 0) {
    searchResultsDiv.innerHTML =
      "<p>「" +
      escapeHTML(query) +
      "」に一致する情報は見つかりませんでした。</p>";
    return;
  }

  const highlight = (text, queryToHighlight) => {
    if (!text || !queryToHighlight) return escapeHTML(text || "");
    // queryToHighlight を RegExp でエスケープすることを忘れないでください
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

    let displayReferenceText = "";
    if (chReference && jpReference) {
      displayReferenceText =
        chReference === jpReference
          ? chReference
          : `${chReference} / ${jpReference}`;
    } else {
      displayReferenceText = chReference || jpReference || "参照情報なし";
    }

    let contentHTML = `<p class="verse-ref">${highlight(
      displayReferenceText,
      query
    )}</p>`; // 検索語を参照情報内でハイライト

    if (jpFullText) {
      // 日本語全文情報を優先的に表示
      contentHTML += `<p><span class="lang-label">日本語:</span> ${highlight(
        jpFullText,
        query
      )}</p>`;
    }
    if (chFullText) {
      contentHTML += `<p><span class="lang-label">中文:</span> ${highlight(
        chFullText,
        query
      )}</p>`;
    }

    // もし全文情報がなく、参照情報のみの場合のフォールバック (基本的には上記でカバーされるはず)
    if (!jpFullText && !chFullText && (jpReference || chReference)) {
      // displayReferenceTextが既に表示されているので、追加の表示は不要かもしれません。
      // もし参照情報のみを再度表示したい場合はここに追加します。
    } else if (!jpFullText && !chFullText && !jpReference && !chReference) {
      contentHTML = `<p>表示できる情報がありません。</p>`; // データが完全に空の場合
    }

    resultItem.innerHTML = contentHTML;
    searchResultsDiv.appendChild(resultItem);
  });
}

// HTML特殊文字をエスケープするヘルパー関数
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

// 正規表現の特殊文字をエスケープするヘルパー関数
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $&はマッチした部分文字列全体を意味します
}

// --- イベントリスナーの設定 ---
if (openSearchModalBtn) {
  openSearchModalBtn.addEventListener("click", openBibleSearchModal);
}

if (closeSearchModalBtn) {
  closeSearchModalBtn.addEventListener("click", closeBibleSearchModal);
}

if (executeSearchBtn) {
  executeSearchBtn.addEventListener("click", performSearch);
}

// 検索入力欄でEnterキーを押したときにも検索を実行
if (searchInput) {
  searchInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault(); // フォーム送信などのデフォルト動作を抑制
      performSearch();
    }
  });
}

// モーダル外（背景）クリックでモーダルを閉じる
window.addEventListener("click", function (event) {
  if (event.target === bibleSearchModal) {
    closeBibleSearchModal();
  }
});

// Escapeキーでモーダルを閉じる
window.addEventListener("keydown", function (event) {
  if (
    event.key === "Escape" &&
    bibleSearchModal &&
    bibleSearchModal.style.display === "block"
  ) {
    closeBibleSearchModal();
  }
});

window.onbeforeunload = function (e) {
  e.returnValue = "本当にページを閉じますか？";
};
window.addEventListener("unload", (e) => {
  if (bible_win) bible_win.close();
  if (title_win) title_win.close();
  if (hymn_win) hymn_win.close();
});


loadInitialData();