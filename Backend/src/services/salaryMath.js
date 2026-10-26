'use strict';

/**
 * Calculates per-lead payout rate based on live calendar days in the specified month.
 * Formula: monthlySalary / (calendarDays * dailyLeadGoal)
 */
function calculateLeadMetrics(monthlySalary, dailyLeadGoal, date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed (0 = Jan, 9 = Oct)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const salary = Number(monthlySalary) || 0;
  const goal = Number(dailyLeadGoal) || 1;

  const dailyAllocation = salary / daysInMonth;
  const perLeadValue = dailyAllocation / goal;

  return {
    year,
    month: month + 1, // 1-indexed for DB/Display
    daysInMonth,
    monthlySalary: salary,
    dailyLeadGoal: goal,
    dailyAllocation: Number(dailyAllocation.toFixed(2)),
    perLeadValue: Number(perLeadValue.toFixed(4))
  };
}

module.exports = {
  calculateLeadMetrics
};
