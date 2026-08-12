/* LIONS reporting-lag completion multipliers — shared across dashboards.
 *
 * Estimated final = reported value x multiplier[age], where age = months since the month ended
 * (age 0 = newest/least-complete month; ages 0-7 = the last 8 months, older months assumed final).
 * Derived by chain-ladder from the May-2026 vs June-2026 vintage pair; vintage-agnostic (the dashboards
 * compute age from whatever cube is loaded). To refine the estimates across ALL dashboards, edit the
 * arrays here only. Reference: completion_multipliers.csv / Completion_Multipliers_2026.md.
 */
window.LIONS_MULT = {
  criminal: {
    cases_filed:      [1.3018, 1.0759, 1.0437, 1.0274, 1.0227, 1.0170, 1.0131, 1.0118],
    cases_terminated: [2.9339, 1.9899, 1.6706, 1.4302, 1.2480, 1.1781, 1.1360, 1.0995]
  },
  civil: {
    cases_filed:      [1.6598, 1.1815, 1.0872, 1.0611, 1.0438, 1.0358, 1.0313, 1.0273],
    cases_terminated: [1.7179, 1.2881, 1.1729, 1.1248, 1.0884, 1.0563, 1.0393, 1.0305]
  }
};
