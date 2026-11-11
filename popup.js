const API_URL = "https://open.er-api.com/v6/latest/USD";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 часов
const POPULAR = ["USD", "EUR", "RUB", "GBP", "CNY", "JPY", "CHF", "TRY", "KZT", "UAH", "BYN", "PLN"];

const $ = (id) => document.getElementById(id);
const amountEl = $("amount");
const fromEl = $("from");
const toEl = $("to");
const resultEl = $("result");
const rateEl = $("rate");
const statusEl = $("status");

let rates = null;

const names = (() => {
  try { return new Intl.DisplayNames(["ru"], { type: "currency" }); }
  catch { return null; }
})();

function currencyLabel(code) {
  const name = names ? names.of(code) : "";
  return name && name !== code ? `${code} — ${name}` : code;
}

async function loadRates() {
  const cached = (await chrome.storage.local.get("cache")).cache;
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    statusEl.textContent = "Курсы обновлены: " + new Date(cached.fetchedAt).toLocaleString("ru-RU");
    return cached.rates;
  }
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    if (data.result !== "success") throw new Error("API error");
    await chrome.storage.local.set({ cache: { fetchedAt: Date.now(), rates: data.rates } });
    statusEl.textContent = "Курсы обновлены: " + new Date().toLocaleString("ru-RU");
    return data.rates;
  } catch (e) {
    if (cached) {
      statusEl.textContent = "Нет сети — показаны сохранённые курсы от " +
        new Date(cached.fetchedAt).toLocaleString("ru-RU");
      return cached.rates;
    }
    statusEl.textContent = "Не удалось загрузить курсы. Проверьте интернет.";
    return null;
  }
}

function fillSelects() {
  const codes = Object.keys(rates);
  const popular = POPULAR.filter((c) => rates[c]);
  const others = codes.filter((c) => !popular.includes(c)).sort();
  for (const sel of [fromEl, toEl]) {
    sel.innerHTML = "";
    for (const code of [...popular, ...others]) {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = currencyLabel(code);
      sel.appendChild(opt);
    }
  }
}

function parseAmount() {
  const v = parseFloat(amountEl.value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

function fmt(n, max = 4) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: max });
}

function convert() {
  if (!rates) return;
  const amount = parseAmount();
  const from = fromEl.value;
  const to = toEl.value;
  const unit = rates[to] / rates[from];
  rateEl.textContent = `1 ${from} = ${fmt(unit, 6)} ${to}`;
  if (amount === null) { resultEl.textContent = "—"; return; }
  resultEl.textContent = `${fmt(amount * unit, 2)} ${to}`;
}

function saveState() {
  chrome.storage.local.set({ state: { from: fromEl.value, to: toEl.value, amount: amountEl.value } });
}

async function init() {
  rates = await loadRates();
  if (!rates) { resultEl.textContent = "Нет данных"; return; }
  fillSelects();
  const { state } = await chrome.storage.local.get("state");
  fromEl.value = state?.from && rates[state.from] ? state.from : "USD";
  toEl.value = state?.to && rates[state.to] ? state.to : "RUB";
  if (state?.amount) amountEl.value = state.amount;
  convert();
  amountEl.select();
}

for (const el of [amountEl, fromEl, toEl]) {
  el.addEventListener("input", () => { convert(); saveState(); });
}
$("swap").addEventListener("click", () => {
  [fromEl.value, toEl.value] = [toEl.value, fromEl.value];
  convert();
  saveState();
});

init();
