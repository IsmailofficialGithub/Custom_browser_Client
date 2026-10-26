import { renderIcons } from './icons.js';

let currentMonth = '';
let currentPage = 1;
const pageSize = 10;
let isLoading = false;

export async function fetchAndRenderEarnings() {
  const session = await window.api.getSession();
  if (!session || !session.token) {
    renderEmptyState('Please sign in to view your approved leads and earnings.');
    return;
  }

  const tableBody = document.getElementById('earningsTableBody');
  const refreshBtn = document.getElementById('refreshEarningsBtn');
  if (refreshBtn) refreshBtn.classList.add('spinning');
  isLoading = true;

  try {
    const data = await window.api.fetchOperatorEarnings(session.token, {
      month: currentMonth,
      page: currentPage,
      limit: pageSize
    });

    if (!data || !data.success) {
      renderEmptyState(data?.message || 'Failed to load earnings.');
      return;
    }

    // 1. Populate Month Selector (preserve selected)
    const select = document.getElementById('earningsMonthSelect');
    if (select && data.availableMonths && data.availableMonths.length > 0) {
      const activeVal = data.selectedMonth;
      select.innerHTML = data.availableMonths
        .map((m) => `<option value="${m.value}" ${m.value === activeVal ? 'selected' : ''}>${m.label}</option>`)
        .join('');
      currentMonth = activeVal;
    }

    // 2. Render Metric Cards
    const curSymbol = `${data.metrics.currency || 'PKR'} `;
    const perLeadVal = (data.metrics.perLeadValue || 0).toFixed(4);
    const totalEarned = (data.summary.totalEarned || 0).toFixed(2);
    const approvedCount = data.summary.approvedCount || 0;
    const monthlyTarget = data.metrics.monthlyTarget || 0;
    const baseSalary = (data.metrics.monthlySalary || 0).toFixed(2);

    const elPerLead = document.getElementById('statPerLead');
    if (elPerLead) elPerLead.textContent = `${curSymbol}${perLeadVal}`;

    const elTotalEarned = document.getElementById('statTotalEarned');
    if (elTotalEarned) elTotalEarned.textContent = `${curSymbol}${totalEarned}`;

    const elApprovedCount = document.getElementById('statApprovedCount');
    if (elApprovedCount) elApprovedCount.textContent = `${approvedCount}`;

    const elMonthlyTarget = document.getElementById('statMonthlyTarget');
    if (elMonthlyTarget) elMonthlyTarget.textContent = `${approvedCount} / ${monthlyTarget}`;

    const elSalaryHint = document.getElementById('statSalaryHint');
    if (elSalaryHint) elSalaryHint.textContent = `Base Salary: ${curSymbol}${baseSalary}`;

    // 3. Render Approved Leads Table
    if (!data.leads || data.leads.length === 0) {
      renderEmptyState('No approved leads found for this month.');
    } else {
      let rowsHtml = '';
      for (const lead of data.leads) {
        const subDate = new Date(lead.submittedAt);
        const formattedDate = subDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const formattedTime = subDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });

        const durationMins = Math.floor(lead.videoDuration / 60);
        const durationSecs = lead.videoDuration % 60;
        const durFormatted = `${durationMins}:${durationSecs.toString().padStart(2, '0')}`;

        const pay = Number(lead.calculatedPay || 0).toFixed(2);

        rowsHtml += `
          <tr>
            <td style="font-family: var(--font-mono); color: var(--text);">
              <div>${formattedDate}</div>
              <div style="font-size: 11px; color: var(--dim);">${formattedTime}</div>
            </td>
            <td style="font-family: var(--font-mono); color: var(--muted);">${durFormatted}</td>
            <td style="font-weight: 600; color: #10b981; font-family: var(--font-mono);">
              +${curSymbol}${pay}
            </td>
            <td>
              <span class="badge badge-success" style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.25);">
                <i data-lucide="check-circle-2" style="width:12px;height:12px;"></i>
                Approved
              </span>
            </td>
            <td style="text-align: right;">
              ${
                lead.videoUrl
                  ? `<a href="http://localhost:50052${lead.videoUrl}" target="_blank" class="btn btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;font-size:11px;text-decoration:none;">
                      <i data-lucide="play" style="width:11px;height:11px;"></i>
                      <span>Proof</span>
                    </a>`
                  : `<span style="color:var(--dim);font-size:11px;">None</span>`
              }
            </td>
          </tr>
        `;
      }
      if (tableBody) tableBody.innerHTML = rowsHtml;
    }

    // 4. Update Pagination Controls
    const pagination = data.pagination;
    const pageIndicator = document.getElementById('earningsPageIndicator');
    if (pageIndicator) {
      pageIndicator.textContent = `Page ${pagination.page} of ${pagination.totalPages} (${pagination.totalCount} approved leads)`;
    }

    const prevBtn = document.getElementById('earningsPrevBtn');
    if (prevBtn) prevBtn.disabled = !pagination.hasPrev;

    const nextBtn = document.getElementById('earningsNextBtn');
    if (nextBtn) nextBtn.disabled = !pagination.hasNext;

    currentPage = pagination.page;
  } catch (err) {
    renderEmptyState(`Error loading earnings: ${err.message}`);
  } finally {
    isLoading = false;
    if (refreshBtn) refreshBtn.classList.remove('spinning');
    renderIcons();
  }
}

function renderEmptyState(message) {
  const tableBody = document.getElementById('earningsTableBody');
  if (tableBody) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">
          <div class="empty-state" style="padding: 36px 16px; text-align: center; color: var(--dim);">
            <i data-lucide="badge-dollar-sign" style="width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.5;"></i>
            <p style="color: var(--muted); font-weight: 500;">${message}</p>
          </div>
        </td>
      </tr>
    `;
  }
  const pageIndicator = document.getElementById('earningsPageIndicator');
  if (pageIndicator) pageIndicator.textContent = 'Page 1 of 1 (0 approved leads)';
  const prevBtn = document.getElementById('earningsPrevBtn');
  if (prevBtn) prevBtn.disabled = true;
  const nextBtn = document.getElementById('earningsNextBtn');
  if (nextBtn) nextBtn.disabled = true;
  renderIcons();
}

export function initEarningsUi() {
  // Listen for tab navigation to earnings
  window.addEventListener('tab-changed', (e) => {
    if (e.detail?.tab === 'earnings') {
      fetchAndRenderEarnings();
    }
  });

  // Month selector change
  const select = document.getElementById('earningsMonthSelect');
  if (select) {
    select.addEventListener('change', () => {
      currentMonth = select.value;
      currentPage = 1;
      fetchAndRenderEarnings();
    });
  }

  // Refresh button
  const refreshBtn = document.getElementById('refreshEarningsBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchAndRenderEarnings();
    });
  }

  // Pagination Next / Prev buttons
  const prevBtn = document.getElementById('earningsPrevBtn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1 && !isLoading) {
        currentPage--;
        fetchAndRenderEarnings();
      }
    });
  }

  const nextBtn = document.getElementById('earningsNextBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (!isLoading) {
        currentPage++;
        fetchAndRenderEarnings();
      }
    });
  }
}
