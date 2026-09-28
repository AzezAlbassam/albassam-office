// Reference yields checked on 2026-09-25/28 by independent research
// and a second fact-check pass. Examples to try in the calculator,
// not recommendations. Trailing-12-month unless noted.

export const PRESETS = {
  saudi: [
    { label: "Saudi Aramco (2222)", yieldPct: 5.27, freq: "Quarterly", asOf: "2026-09-28", note: "Base dividend only" },
    { label: "stc (7010)", yieldPct: 5.10, freq: "Quarterly", asOf: "2026-09-28" },
    { label: "Saudi National Bank (1180)", yieldPct: 5.72, freq: "Twice a year", asOf: "2026-09-26" },
    { label: "Saudi Awwal Bank (1060)", yieldPct: 6.02, freq: "Twice a year", asOf: "2026-09-28" },
    { label: "Riyad Bank (1010)", yieldPct: 5.24, freq: "Twice a year", asOf: "2026-09-28", note: "Bonus-adjusted" },
    { label: "Jarir (4190)", yieldPct: 5.85, freq: "Quarterly", asOf: "2026-09-28" },
    { label: "SABIC (2010)", yieldPct: 4.65, freq: "Twice a year", asOf: "2026-09-28", note: "Forward, after the 2026 cut" },
    { label: "Saudi Electricity (5110)", yieldPct: 4.43, freq: "Once a year", asOf: "2026-09-28" },
    { label: "Alinma (1150)", yieldPct: 4.08, freq: "Quarterly", asOf: "2026-09-28", note: "Forward" },
    { label: "Al Rajhi Bank (1120)", yieldPct: 3.78, freq: "Twice a year", asOf: "2026-09-28", note: "Bonus-adjusted" },
    { label: "Almarai (2280)", yieldPct: 2.65, freq: "Once a year", asOf: "2026-09-28" },
    { label: "Al Rajhi REIT (4340)", yieldPct: 6.90, freq: "Quarterly", asOf: "2026-09-28" },
    { label: "Jadwa REIT Saudi (4342)", yieldPct: 9.06, freq: "Quarterly", asOf: "2026-09-28" },
  ],
  us: [
    { label: "SCHD", yieldPct: 3.17, freq: "Quarterly", asOf: "2026-09-25" },
    { label: "SPYD", yieldPct: 4.46, freq: "Quarterly", asOf: "2026-09-25" },
    { label: "HDV", yieldPct: 3.01, freq: "Monthly", asOf: "2026-09-25" },
    { label: "VYM", yieldPct: 2.33, freq: "Quarterly", asOf: "2026-09-25" },
    { label: "DGRO", yieldPct: 1.95, freq: "Quarterly", asOf: "2026-09-25" },
    { label: "VIG", yieldPct: 1.53, freq: "Quarterly", asOf: "2026-09-25" },
    { label: "JEPI", yieldPct: 8.08, freq: "Monthly, varies", asOf: "2026-09-25", note: "Option income, varies a lot" },
    { label: "JEPQ", yieldPct: 11.05, freq: "Monthly, varies", asOf: "2026-09-25", note: "Option income, varies a lot" },
    { label: "DIVO", yieldPct: 5.10, freq: "Monthly", asOf: "2026-09-25" },
    { label: "Realty Income (O)", yieldPct: 5.86, freq: "Monthly", asOf: "2026-09-25" },
    { label: "Main Street Capital (MAIN)", yieldPct: 5.77, freq: "Monthly", asOf: "2026-09-25", note: "Regular monthly only" },
    { label: "SPY", yieldPct: 0.98, freq: "Quarterly", asOf: "2026-09-25" },
    { label: "QQQ", yieldPct: 0.42, freq: "Quarterly", asOf: "2026-09-25" },
  ],
  sukuk: [
    { label: "Albilad Saudi Sovereign Sukuk ETF (9403)", yieldPct: 3.69, freq: "About monthly", asOf: "2026-09-28" },
  ],
  cash: [],
};
