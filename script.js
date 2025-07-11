const STORAGE_KEYS = {
  entries: 'savingTrackerEntries',
  goals: 'savingTrackerGoals',
  theme: 'savingTrackerTheme',
  view: 'savingTrackerView'
};

const goalForm = document.getElementById('goal-form');
const goalsContainer = document.getElementById('goals-container');
const entryForm = document.getElementById('entry-form');
const entriesList = document.getElementById('entries-list');
const entriesToggle = document.getElementById('entries-toggle');
const entriesContent = document.getElementById('entries-content');
const savingsSection = document.getElementById('savings-section');
const savingsGoalName = document.getElementById('savings-goal-name');
const targetsList = document.getElementById('targets-list');
const notificationEl = document.getElementById('notification');
const themeToggle = document.querySelector('.theme-toggle');
const viewToggle = document.querySelector('.view-toggle');
let currentGoalId = null;
let chart = null;

function loadData(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return data && Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(`Error loading ${key}:`, e);
    showNotification('Failed to load data.');
    return [];
  }
}

let entries = loadData(STORAGE_KEYS.entries);
let goals = loadData(STORAGE_KEYS.goals);

const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌸';

const savedView = localStorage.getItem(STORAGE_KEYS.view) || 'desktop';
document.documentElement.setAttribute('data-view', savedView);
viewToggle.textContent = savedView === 'mobile' ? '🖥️' : '📱';

themeToggle.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem(STORAGE_KEYS.theme, newTheme);
  themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌸';
  showNotification(`Switched to ${newTheme} mode`);
  if ('vibrate' in navigator) navigator.vibrate(50);
  updateChart();
});

viewToggle.addEventListener('click', () => {
  const currentView = document.documentElement.getAttribute('data-view') || 'desktop';
  const newView = currentView === 'desktop' ? 'mobile' : 'desktop';
  document.documentElement.setAttribute('data-view', newView);
  localStorage.setItem(STORAGE_KEYS.view, newView);
  viewToggle.textContent = newView === 'mobile' ? '🖥️' : '📱';
  showNotification(`Switched to ${newView} view`);
  if ('vibrate' in navigator) navigator.vibrate(50);
  updateChart();
});

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(entries));
    localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(goals));
  } catch (e) {
    console.error('Error saving data:', e);
    showNotification('Failed to save data. Check storage limits.');
  }
}

function formatDate(date) {
  if (!date) return 'Invalid Date';
  if (!(date instanceof Date)) date = new Date(date);
  return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

let lastNotification = 0;
function showNotification(message) {
  const now = Date.now();
  if (now - lastNotification < 1000) return;
  lastNotification = now;
  notificationEl.textContent = message;
  notificationEl.classList.add('show');
  setTimeout(() => notificationEl.classList.remove('show'), 3000);
}

function showFormError(message, formId) {
  const existingError = document.querySelector(`#${formId} .form-error`);
  if (existingError) existingError.remove();
  const errorEl = document.createElement('div');
  errorEl.className = 'form-error';
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-describedby', `${formId}-error`);
  errorEl.id = `${formId}-error`;
  errorEl.textContent = message;
  document.getElementById(formId).prepend(errorEl);
  setTimeout(() => errorEl.remove(), 4000);
  if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
}

function getWeekStartEnd(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getNextMonthStart(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calculateWeeksUntil(deadline, now = new Date()) {
  const target = new Date(deadline);
  if (target <= now) return 0;
  const diffMs = target - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.ceil(diffDays / 7));
}

function calculateMonthsUntil(deadline, now = new Date()) {
  const target = new Date(deadline);
  if (target <= now) return 0;
  const yearsDiff = target.getFullYear() - now.getFullYear();
  const monthsDiff = target.getMonth() - now.getMonth();
  let totalMonths = yearsDiff * 12 + monthsDiff;
  if (target.getDate() < now.getDate()) totalMonths--;
  return Math.max(1, totalMonths);
}

function calculateSavingsForGoal(goalId) {
  return entries
    .filter(e => e.goalId === goalId)
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
}

function calculateWeeklySavings(goal) {
  const now = new Date();
  const { start, end } = getWeekStartEnd(now);
  return entries
    .filter(e => e.goalId === goal.id && new Date(e.date) >= start && new Date(e.date) <= end)
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
}

function calculateMonthlySavings(goal) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return entries
    .filter(e => e.goalId === goal.id && new Date(e.date) >= start && new Date(e.date) <= end)
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
}

function calculateTargets(goal) {
  const saved = calculateSavingsForGoal(goal.id);
  const remaining = Math.max(0, goal.target - saved);
  if (remaining <= 0) return { weekly: 0, monthly: 0 };

  const now = new Date();
  const weeksLeft = calculateWeeksUntil(goal.deadline, now);
  const monthsLeft = calculateMonthsUntil(goal.deadline, now);

  return {
    weekly: weeksLeft > 0 ? remaining / weeksLeft : remaining,
    monthly: monthsLeft > 0 ? remaining / monthsLeft : remaining
  };
}

function updateSavingsTarget(goal) {
  targetsList.innerHTML = '';
  if (!goal) {
    targetsList.innerHTML = '<p style="color: var(--text-light); text-align: center;">No goal selected.</p>';
    return;
  }

  const now = new Date();
  const { end: weekEnd } = getWeekStartEnd(now);
  const monthEnd = getNextMonthStart(now);

  try {
    const targets = calculateTargets(goal);
    const weeklySaved = calculateWeeklySavings(goal);
    const monthlySaved = calculateMonthlySavings(goal);
    const weeklyRemaining = targets.weekly - weeklySaved;
    const monthlyRemaining = targets.monthly - monthlySaved;

    const targetEl = document.createElement('div');
    targetEl.className = 'target';
    targetEl.innerHTML = `
      <h4>${goal.name}</h4>
      <div>
        Weekly Target: $${targets.weekly.toFixed(2)}<br>
        Saved: $${weeklySaved.toFixed(2)}<br>
        <span class="${weeklyRemaining <= 0 ? 'status-met' : 'status-unmet'}" aria-label="${weeklyRemaining <= 0 ? 'Weekly target met' : `Weekly target remaining: $${weeklyRemaining.toFixed(2)} by ${formatDate(weekEnd)}`}">
          ${weeklyRemaining <= 0 ? 'Weekly target met!' : `Need $${weeklyRemaining.toFixed(2)} more by <span class="deadline-text">${formatDate(weekEnd)}</span>`}
        </span>
      </div>
      <div>
        Monthly Target: $${targets.monthly.toFixed(2)}<br>
        Saved: $${monthlySaved.toFixed(2)}<br>
        <span class="${monthlyRemaining <= 0 ? 'status-met' : 'status-unmet'}" aria-label="${monthlyRemaining <= 0 ? 'Monthly target met' : `Monthly target remaining: $${monthlyRemaining.toFixed(2)} by ${formatDate(monthEnd)}`}">
          ${monthlyRemaining <= 0 ? 'Monthly target met!' : `Need $${monthlyRemaining.toFixed(2)} more by <span class="deadline-text">${formatDate(monthEnd)}</span>`}
        </span>
      </div>
    `;
    targetsList.appendChild(targetEl);
  } catch (e) {
    console.error(`Error processing goal ${goal.id}:`, e);
    showNotification(`Error updating targets for ${goal.name}.`);
  }
}

function updateChart() {
  if (chart) chart.destroy();
  const ctx = document.getElementById('savings-chart')?.getContext('2d');
  if (!ctx || !currentGoalId) return;

  const goalEntries = entries.filter(e => e.goalId === currentGoalId);
  if (!goalEntries.length) {
    ctx.canvas.parentNode.innerHTML = '<p style="color: var(--text-light); text-align: center;">No savings added yet.</p>';
    return;
  }

  const categorySums = goalEntries.reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + (parseFloat(entry.amount) || 0);
    return acc;
  }, {});

  const labels = Object.keys(categorySums);
  const data = Object.values(categorySums);
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  const colors = isDarkMode
    ? ['#4fc3f7', '#66bb6a', '#ffca28', '#ab47bc', '#ff7043']
    : ['#0288d1', '#2ecc71', '#fbc02d', '#8e24aa', '#f4511e'];

  chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels.length ? labels : ['No Data'],
      datasets: [{
        data: data.length ? data : [1],
        backgroundColor: data.length ? colors.slice(0, labels.length) : ['#ccc'],
        borderColor: isDarkMode ? '#333' : '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: isDarkMode ? '#e0f7fa' : '#1a237e',
            font: { size: 12 }
          }
        },
        title: {
          display: true,
          text: `${goals.find(g => g.id === currentGoalId)?.name || 'Savings'} by Category`,
          color: isDarkMode ? '#e0f7fa' : '#1a237e',
          font: { size: 14 }
        }
      }
    }
  });
}

function renderEntries() {
  entriesList.innerHTML = '';
  if (!currentGoalId) {
    entriesList.innerHTML = '<p style="color: var(--text-light); text-align: center;">Select a goal to view entries.</p>';
    return;
  }

  const goalEntries = entries.filter(e => e.goalId === currentGoalId);
  if (!goalEntries.length) {
    entriesList.innerHTML = '<p style="color: var(--text-light); text-align: center;">No savings added yet.</p>';
    return;
  }

  goalEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

  goalEntries.forEach(entry => {
    const entryEl = document.createElement('div');
    entryEl.className = 'entry';
    entryEl.dataset.id = entry.id;
    entryEl.innerHTML = `
      <div class="entry-main">
        <span>${formatDate(entry.date)} - $${(parseFloat(entry.amount) || 0).toFixed(2)}</span>
        <button class="delete-btn" data-id="${entry.id}" aria-label="Delete entry">Delete</button>
      </div>
      <div class="entry-details">
        Category: ${entry.category}<br>
        Notes: ${entry.notes || ''}
      </div>
    `;
    entriesList.appendChild(entryEl);

    let startX = 0;
    let moved = false;
    entryEl.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      moved = false;
    });

    entryEl.addEventListener('touchmove', e => {
      const diffX = e.touches[0].clientX - startX;
      if (Math.abs(diffX) > 50) {
        moved = true;
        entryEl.classList.toggle('swipe-left', diffX < -50);
      }
    });

    entryEl.addEventListener('touchend', () => {
      if (moved && entryEl.classList.contains('swipe-left')) {
        if (confirm('Are you sure you want to delete this entry?')) {
          deleteEntry(entry.id);
        }
        entryEl.classList.remove('swipe-left');
      }
    });

    entryEl.querySelector('.entry-main').addEventListener('click', e => {
      if (!e.target.classList.contains('delete-btn') && !moved) {
        const details = entryEl.querySelector('.entry-details');
        details.classList.toggle('show');
      }
    });
  });

  updateChart();
  updateSavingsTarget(goals.find(g => g.id === currentGoalId));
}

function addEntry(date, amount, category, notes) {
  entries.push({
    id: Date.now().toString(),
    date,
    amount: parseFloat(amount),
    goalId: currentGoalId,
    category,
    notes
  });
  saveData();
  renderEntries();
  renderGoals();
  showNotification('Entry added!');
}

function deleteEntry(id) {
  entries = entries.filter(e => e.id !== id);
  saveData();
  renderEntries();
  renderGoals();
  showNotification('Entry deleted!');
}

function renderGoals() {
  goalsContainer.innerHTML = '';
  if (!goals.length) {
    goalsContainer.innerHTML = '<p style="color: var(--text-light); text-align: center;">No goals yet. Add one above!</p>';
    return;
  }

  goals.forEach(goal => {
    const totalSaved = calculateSavingsForGoal(goal.id);
    const progressPercent = Math.min((totalSaved / goal.target) * 100, 100);

    const goalEl = document.createElement('div');
    goalEl.className = 'goal';
    goalEl.dataset.id = goal.id;
    goalEl.innerHTML = `
      <h3>${goal.name}</h3>
      <div class="progress-bar" aria-label="Progress toward goal ${goal.name}">
        <div class="progress-bar-fill" style="width: 0;" role="progressbar" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
      <div class="progress-text">$${totalSaved.toFixed(2)} saved of $${parseFloat(goal.target).toFixed(2)} (${progressPercent.toFixed(1)}%)</div>
      <div>Deadline: ${formatDate(goal.deadline)}</div>
      <div class="goal-actions">
        <button class="delete-btn" data-id="${goal.id}" aria-label="Delete goal">Delete</button>
      </div>
    `;
    goalsContainer.appendChild(goalEl);

    const progressBar = goalEl.querySelector('.progress-bar-fill');
    animateProgressBar(progressBar, progressPercent, goal);

    goalEl.addEventListener('click', e => {
      if (e.target.classList.contains('delete-btn')) return;
      currentGoalId = goal.id;
      savingsGoalName.textContent = goal.name;
      savingsSection.style.display = 'block';
      savingsSection.scrollIntoView({ behavior: 'smooth' });
      renderEntries();
    });
  });
}

function addGoal(name, target, deadline) {
  goals.push({
    id: Date.now().toString(),
    name,
    target: parseFloat(target),
    deadline,
    createdAt: new Date().toISOString()
  });
  saveData();
  renderGoals();
  showNotification('Goal added!');
}

function deleteGoal(id) {
  if (!confirm('Are you sure you want to delete this goal?')) return;
  entries = entries.filter(e => e.goalId !== id);
  goals = goals.filter(g => g.id !== id);
  if (currentGoalId === id) {
    currentGoalId = null;
    savingsSection.style.display = 'none';
  }
  saveData();
  renderGoals();
  renderEntries();
  showNotification('Goal deleted!');
}

function animateProgressBar(bar, percent, goal) {
  bar.style.width = '0%';
  bar.className = 'progress-bar-fill';

  let milestoneReached = null;
  const clampedPercent = Math.min(Math.max(percent, 0), 100);

  if (clampedPercent >= 100) {
    bar.classList.add('milestone-100');
    milestoneReached = '100% — Goal Achieved!';
  } else if (clampedPercent >= 75) {
    bar.classList.add('milestone-75');
    milestoneReached = '75% Milestone reached!';
  } else if (clampedPercent >= 50) {
    bar.classList.add('milestone-50');
    milestoneReached = '50% Milestone reached!';
  } else if (clampedPercent >= 25) {
    bar.classList.add('milestone-25');
    milestoneReached = '25% Milestone reached!';
  }

  setTimeout(() => {
    requestAnimationFrame(() => {
      bar.style.width = `${clampedPercent}%`;
    });
  }, 100);

  if (milestoneReached) {
    const lastMilestoneKey = `milestone_${goal.id}`;
    const lastMilestone = sessionStorage.getItem(lastMilestoneKey) || '0';
    const milestones = { '0': 0, '25': 25, '50': 50, '75': 75, '100': 100 };
    const milestoneLevel = Object.keys(milestones).find(k => milestoneReached.includes(k));

    if (milestoneLevel && milestones[milestoneLevel] > milestones[lastMilestone]) {
      sessionStorage.setItem(lastMilestoneKey, milestoneLevel);
      showNotification(`${goal.name}: ${milestoneReached}`);
    }
  }
}

goalForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('goal-name').value.trim();
  const target = document.getElementById('goal-target').value;
  const deadline = document.getElementById('goal-deadline').value;

  if (!name) {
    showFormError('Please enter a goal name.', 'goal-form');
    return;
  }
  if (!target || parseFloat(target) <= 0) {
    showFormError('Please enter a positive target amount.', 'goal-form');
    return;
  }
  if (!deadline) {
    showFormError('Please select a valid deadline.', 'goal-form');
    return;
  }

  const today = new Date().setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline).setHours(0, 0, 0, 0);
  if (deadlineDate < today) {
    showFormError('Deadline must be in the future.', 'goal-form');
    return;
  }

  addGoal(name, target, deadline);
  goalForm.reset();
  if ('vibrate' in navigator) navigator.vibrate(50);
});

entryForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!currentGoalId) {
    showFormError('Please select a goal first.', 'entry-form');
    return;
  }

  const date = document.getElementById('entry-date').value;
  const amount = document.getElementById('entry-amount').value;
  const category = document.getElementById('entry-category').value;
  const notes = document.getElementById('entry-notes').value;

  if (!date) {
    showFormError('Please select a valid date.', 'entry-form');
    return;
  }
  if (!amount || parseFloat(amount) <= 0) {
    showFormError('Please enter a positive amount.', 'entry-form');
    return;
  }
  if (!category) {
    showFormError('Please select a category.', 'entry-form');
    return;
  }

  addEntry(date, amount, category, notes);
  entryForm.reset();
  if ('vibrate' in navigator) navigator.vibrate(50);
});

entriesList.addEventListener('click', e => {
  if (e.target.classList.contains('delete-btn')) {
    const id = e.target.dataset.id;
    if (confirm('Are you sure you want to delete this entry?')) {
      deleteEntry(id);
    }
  }
});

entriesToggle.addEventListener('click', () => {
  entriesContent.classList.toggle('show');
  entriesToggle.classList.toggle('collapsed');
});

goalsContainer.addEventListener('click', e => {
  if (e.target.classList.contains('delete-btn')) {
    const id = e.target.dataset.id;
    deleteGoal(id);
  }
});

document.querySelectorAll('button').forEach(button => {
  button.addEventListener('click', e => {
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    button.style.setProperty('--x', `${x}px`);
    button.style.setProperty('--y', `${y}px`);
  });
});

renderGoals();