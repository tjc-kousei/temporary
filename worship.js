const WORSHIP_ENDPOINT = "https://tjckousei.com/api/v1/worship/index.php";

const fallbackWorshipOptions = [
  { value: "安息日礼拝", label: "通常礼拝" },
  { value: "金曜日礼拝", label: "通常礼拝" },
  { value: "火曜日礼拝", label: "通常礼拝" },
  { value: "水曜日礼拝", label: "通常礼拝" },
  { value: "春季霊恩会", label: "特別礼拝" },
  { value: "秋季霊恩会ー", label: "特別礼拝" },
  { value: "教員講習会", label: "講習・霊修会" },
  { value: "学生霊恩会", label: "特別礼拝" }
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderWorshipOptions(options) {
  const worshipList = document.getElementById("worshiplist");
  if (!worshipList) return;

  const normalized = Array.isArray(options) ? options : [];
  worshipList.innerHTML = normalized
    .filter((item) => item && item.value)
    .map((item) => {
      const value = escapeHtml(item.value);
      const label = escapeHtml(item.label || "");
      return `<option value="${value}">${label}</option>`;
    })
    .join("");
}

async function loadWorshipOptions() {
  renderWorshipOptions(fallbackWorshipOptions);

  try {
    const response = await fetch(WORSHIP_ENDPOINT, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || !Array.isArray(payload.options)) {
      throw new Error("Invalid response format");
    }

    renderWorshipOptions(payload.options);
  } catch (error) {
    console.warn("礼拝種類設定の取得に失敗したため、ローカル設定を使用します。", error);
  }
}

loadWorshipOptions();
