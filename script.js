const STORAGE_KEYS = {
    transactions: "expense-tracker-transactions",
    budget: "expense-tracker-budget",
};

const DEFAULT_CATEGORY = "General";
const CATEGORY_OPTIONS = [
    "Housing",
    "Food",
    "Transport",
    "Utilities",
    "Health",
    "Entertainment",
    "Salary",
    "Savings",
    "Shopping",
    DEFAULT_CATEGORY,
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

const balanceEl = document.getElementById("balance");
const incomeAmountEl = document.getElementById("income-amount");
const expenseAmountEl = document.getElementById("expense-amount");
const transactionCountEl = document.getElementById("transaction-count");
const transactionListEl = document.getElementById("transaction-list");
const transactionFormEl = document.getElementById("transaction-form");
const descriptionEl = document.getElementById("description");
const amountEl = document.getElementById("amount");
const categoryEl = document.getElementById("category");
const transactionDateEl = document.getElementById("transaction-date");
const searchInputEl = document.getElementById("search-input");
const filterCategoryEl = document.getElementById("filter-category");
const emptyStateEl = document.getElementById("empty-state");
const monthSpentEl = document.getElementById("month-spent");
const largestExpenseEl = document.getElementById("largest-expense");
const categoryBreakdownEl = document.getElementById("category-breakdown");
const activeFilterLabelEl = document.getElementById("active-filter-label");
const budgetInputEl = document.getElementById("budget-input");
const saveBudgetBtnEl = document.getElementById("save-budget-btn");
const budgetProgressBarEl = document.getElementById("budget-progress-bar");
const budgetStatusEl = document.getElementById("budget-status");
const budgetRemainingEl = document.getElementById("budget-remaining");

let transactions = loadTransactions();
let monthlyBudget = loadBudget();
let filters = {
    search: "",
    category: "all",
};

transactionDateEl.value = getTodayDate();
budgetInputEl.value = monthlyBudget ? monthlyBudget.toFixed(2) : "";

transactionFormEl.addEventListener("submit", addTransaction);
searchInputEl.addEventListener("input", handleSearch);
filterCategoryEl.addEventListener("change", handleCategoryFilter);
saveBudgetBtnEl.addEventListener("click", saveBudget);
transactionListEl.addEventListener("click", handleTransactionListClick);

renderCategoryOptions();
render();

function loadTransactions() {
    const savedTransactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions)) || [];

    return savedTransactions.map((transaction) => ({
        id: transaction.id || Date.now() + Math.random(),
        description: String(transaction.description || "").trim(),
        amount: Number(transaction.amount) || 0,
        category: normalizeCategory(transaction.category),
        date: isValidDate(transaction.date) ? transaction.date : getTodayDate(),
    }));
}

function loadBudget() {
    const savedBudget = Number(localStorage.getItem(STORAGE_KEYS.budget));
    return Number.isFinite(savedBudget) && savedBudget > 0 ? savedBudget : 0;
}

function addTransaction(event) {
    event.preventDefault();

    const description = descriptionEl.value.trim();
    const amount = Number.parseFloat(amountEl.value);
    const category = normalizeCategory(categoryEl.value);
    const date = transactionDateEl.value;

    if (!description || !Number.isFinite(amount) || amount === 0 || !isValidDate(date)) {
        return;
    }

    transactions.unshift({
        id: Date.now(),
        description,
        amount,
        category,
        date,
    });

    persistTransactions();
    transactionFormEl.reset();
    categoryEl.value = DEFAULT_CATEGORY;
    transactionDateEl.value = getTodayDate();
    render();
}

function saveBudget() {
    const amount = Number.parseFloat(budgetInputEl.value);

    if (!Number.isFinite(amount) || amount <= 0) {
        monthlyBudget = 0;
        localStorage.removeItem(STORAGE_KEYS.budget);
        budgetInputEl.value = "";
        renderBudget(getCurrentMonthExpenses());
        return;
    }

    monthlyBudget = amount;
    localStorage.setItem(STORAGE_KEYS.budget, String(monthlyBudget));
    renderBudget(getCurrentMonthExpenses());
}

function handleSearch(event) {
    filters.search = event.target.value.trim().toLowerCase();
    render();
}

function handleCategoryFilter(event) {
    filters.category = event.target.value;
    render();
}

function handleTransactionListClick(event) {
    const deleteButton = event.target.closest(".delete-btn");

    if (!deleteButton) {
        return;
    }

    const transactionId = Number(deleteButton.dataset.id);
    transactions = transactions.filter((transaction) => transaction.id !== transactionId);
    persistTransactions();
    render();
}

function persistTransactions() {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
}

function render() {
    renderCategoryOptions();
    const filteredTransactions = getFilteredTransactions();

    renderSummary();
    renderTransactionList(filteredTransactions);
    renderInsights(filteredTransactions);
    renderBudget(getCurrentMonthExpenses());
}

function renderSummary() {
    const balance = transactions.reduce((total, transaction) => total + transaction.amount, 0);
    const income = transactions
        .filter((transaction) => transaction.amount > 0)
        .reduce((total, transaction) => total + transaction.amount, 0);
    const expenses = transactions
        .filter((transaction) => transaction.amount < 0)
        .reduce((total, transaction) => total + transaction.amount, 0);

    balanceEl.textContent = formatCurrency(balance);
    incomeAmountEl.textContent = formatCurrency(income);
    expenseAmountEl.textContent = formatCurrency(Math.abs(expenses));
    transactionCountEl.textContent = String(transactions.length);
}

function renderTransactionList(filteredTransactions) {
    transactionListEl.innerHTML = "";

    if (!filteredTransactions.length) {
        emptyStateEl.hidden = false;
        return;
    }

    emptyStateEl.hidden = true;

    filteredTransactions.forEach((transaction) => {
        const item = document.createElement("li");
        const transactionType = transaction.amount >= 0 ? "income" : "expense";

        item.className = `transaction ${transactionType}`;
        item.innerHTML = `
            <div class="transaction-main">
                <div class="transaction-copy">
                    <strong>${escapeHtml(transaction.description)}</strong>
                    <div class="transaction-meta">
                        <span class="category-pill">${escapeHtml(transaction.category)}</span>
                        <span>${formatDate(transaction.date)}</span>
                    </div>
                </div>
                <div class="transaction-side">
                    <span class="transaction-amount ${transactionType}">
                        ${transaction.amount >= 0 ? "+" : "-"}${formatCurrency(Math.abs(transaction.amount))}
                    </span>
                    <button class="delete-btn" type="button" data-id="${transaction.id}" aria-label="Delete transaction">
                        Delete
                    </button>
                </div>
            </div>
        `;

        transactionListEl.appendChild(item);
    });
}

function renderInsights(filteredTransactions) {
    const monthTransactions = getCurrentMonthTransactions();
    const currentMonthExpenses = Math.abs(
        monthTransactions
            .filter((transaction) => transaction.amount < 0)
            .reduce((total, transaction) => total + transaction.amount, 0)
    );

    const expenseTransactions = monthTransactions.filter((transaction) => transaction.amount < 0);
    const largestExpense = expenseTransactions.reduce((largest, transaction) => {
        return Math.abs(transaction.amount) > Math.abs(largest.amount) ? transaction : largest;
    }, { amount: 0 });

    const expenseBreakdown = getExpenseBreakdown(filteredTransactions);
    const activeCategoryLabel =
        filters.category === "all" ? "Showing all" : `Filter: ${filters.category}`;

    monthSpentEl.textContent = formatCurrency(currentMonthExpenses);
    largestExpenseEl.textContent = formatCurrency(Math.abs(largestExpense.amount));
    activeFilterLabelEl.textContent = activeCategoryLabel;

    categoryBreakdownEl.innerHTML = "";

    if (!expenseBreakdown.length) {
        categoryBreakdownEl.innerHTML = "<p class=\"breakdown-empty\">No expense data for this filter.</p>";
        return;
    }

    expenseBreakdown.slice(0, 4).forEach(([category, total]) => {
        const row = document.createElement("div");
        row.className = "breakdown-row";
        row.innerHTML = `
            <span>${escapeHtml(category)}</span>
            <strong>${formatCurrency(total)}</strong>
        `;
        categoryBreakdownEl.appendChild(row);
    });
}

function renderBudget(currentMonthExpenses) {
    const progress = monthlyBudget > 0 ? Math.min((currentMonthExpenses / monthlyBudget) * 100, 100) : 0;
    budgetProgressBarEl.style.width = `${progress}%`;

    if (monthlyBudget <= 0) {
        budgetStatusEl.textContent = "No budget set yet";
        budgetRemainingEl.textContent = "Add a target to track monthly spending";
        return;
    }

    const remaining = monthlyBudget - currentMonthExpenses;
    const statusText = remaining >= 0 ? "Under budget" : "Budget exceeded";

    budgetStatusEl.textContent = `${statusText} • ${Math.round(progress)}% used`;
    budgetRemainingEl.textContent =
        remaining >= 0
            ? `${formatCurrency(remaining)} left`
            : `${formatCurrency(Math.abs(remaining))} over`;
}

function renderCategoryOptions() {
    const categories = new Set(CATEGORY_OPTIONS);
    transactions.forEach((transaction) => categories.add(normalizeCategory(transaction.category)));

    filterCategoryEl.innerHTML = '<option value="all">All categories</option>';

    [...categories]
        .sort((first, second) => first.localeCompare(second))
        .forEach((category) => {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = category;
            filterCategoryEl.appendChild(option);
        });

    filterCategoryEl.value = categories.has(filters.category) ? filters.category : "all";
    filters.category = filterCategoryEl.value;
}

function getFilteredTransactions() {
    return transactions.filter((transaction) => {
        const matchesSearch =
            !filters.search || transaction.description.toLowerCase().includes(filters.search);
        const matchesCategory =
            filters.category === "all" || transaction.category === filters.category;

        return matchesSearch && matchesCategory;
    });
}

function getCurrentMonthTransactions() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return transactions.filter((transaction) => {
        const date = new Date(`${transaction.date}T00:00:00`);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
}

function getCurrentMonthExpenses() {
    return Math.abs(
        getCurrentMonthTransactions()
            .filter((transaction) => transaction.amount < 0)
            .reduce((total, transaction) => total + transaction.amount, 0)
    );
}

function getExpenseBreakdown(sourceTransactions) {
    const categoryTotals = sourceTransactions.reduce((totals, transaction) => {
        if (transaction.amount >= 0) {
            return totals;
        }

        const category = normalizeCategory(transaction.category);
        totals[category] = (totals[category] || 0) + Math.abs(transaction.amount);
        return totals;
    }, {});

    return Object.entries(categoryTotals).sort((first, second) => second[1] - first[1]);
}

function normalizeCategory(category) {
    if (!category) {
        return DEFAULT_CATEGORY;
    }

    return String(category).trim() || DEFAULT_CATEGORY;
}

function isValidDate(value) {
    return Boolean(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function getTodayDate() {
    return new Date().toISOString().split("T")[0];
}

function formatCurrency(number) {
    return currencyFormatter.format(number);
}

function formatDate(dateString) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(`${dateString}T00:00:00`));
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}