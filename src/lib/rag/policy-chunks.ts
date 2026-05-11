export type PolicyChunk = {
  id: string;
  title: string;
  body: string;
};

export const POLICY_CHUNKS: PolicyChunk[] = [
  {
    id: "annual-entitlement",
    title: "Annual Leave Entitlement",
    body: `Full-time employees are entitled to 12 days of paid annual leave per calendar year. Leave accrues at 1 day per month starting from the first day of employment. Employees who join after the 15th of the month do not accrue leave for that partial month. Annual leave may be taken in full-day or half-day increments. Employees should request annual leave at least 3 business days in advance for short requests (1–2 days) and at least 2 weeks in advance for requests of 3 or more consecutive days.`,
  },
  {
    id: "sick-entitlement",
    title: "Sick Leave Entitlement",
    body: `Employees are entitled to 12 days of paid sick leave per calendar year. Sick leave is non-accruing — it resets to the full 12 days on January 1 each year regardless of how much was used. Unused sick leave does not carry over. Sick leave can be taken in half-day increments. Employees must notify their manager as early as possible on the first day of absence. Sick leave taken for reasons other than genuine illness may be reclassified as personal or unpaid leave.`,
  },
  {
    id: "personal-entitlement",
    title: "Personal Leave Entitlement",
    body: `Employees are entitled to 4 days of paid personal leave per calendar year for personal matters such as family obligations, household emergencies, or personal appointments that cannot be scheduled outside working hours. Personal leave must be approved by the employee's direct manager. It can be taken in half-day increments. Personal leave does not carry over to the following year. Same-day personal leave is permitted for genuine urgent situations; the employee must notify their manager before or at the start of the working day.`,
  },
  {
    id: "unpaid-leave",
    title: "Unpaid Leave",
    body: `Employees who have exhausted all paid leave entitlements may apply for unpaid leave for up to 30 consecutive calendar days per year. Unpaid leave requires approval from the direct manager and HR. Applications must be submitted at least 5 business days in advance except in documented emergencies. During unpaid leave, health insurance and social insurance contributions continue but are calculated on the reduced salary. Unpaid leave longer than 30 days requires CEO or equivalent approval and is considered on a case-by-case basis. Unpaid leave does not count toward leave accrual for the month in which it falls.`,
  },
  {
    id: "carryover",
    title: "Leave Carryover Rules",
    body: `Up to 5 unused annual leave days may be carried over to the following calendar year, but must be used by March 31. Any carried-over days not used by March 31 are forfeited without compensation. Sick leave and personal leave do not carry over under any circumstances. Employees who are unable to use their annual leave due to business requirements (e.g., project deadlines or mandatory coverage) may request an extension of the carryover period; this requires written approval from the manager and HR before December 31. Employees leaving the company are paid out for accrued but unused annual leave up to a maximum of 12 days.`,
  },
  {
    id: "half-day",
    title: "Half-Day Leave",
    body: `All leave types (annual, sick, personal) can be taken as a half-day. The morning half is defined as the working hours before the lunch break (typically 08:00–12:00) and the afternoon half as the hours after (13:00–17:00). Half-day leaves are deducted as 0.5 days from the applicable leave balance. When requesting a half-day, employees must specify whether it is a morning or afternoon half. Half-day sick leave follows the same notification rules as full-day sick leave. Half-day requests are subject to manager approval and team coverage considerations.`,
  },
  {
    id: "medical-certificate",
    title: "Medical Certificate Requirements",
    body: `For sick leave of 1–2 days, no documentation is required, but the employee must notify their manager promptly. For sick leave of 3 or more consecutive days, a medical certificate from a licensed physician or hospital must be submitted to HR within 3 business days of returning to work. The certificate must include the diagnosis or nature of illness, the recommended rest period, and the physician's license number. Failure to provide the required certificate may result in the sick leave being reclassified as unpaid leave. Recurring sick leave patterns (e.g., 10 or more instances per year) may trigger a wellness consultation with HR.`,
  },
  {
    id: "notice-period",
    title: "Leave Notice Periods",
    body: `Annual leave of 1–2 days: submit request at least 3 business days in advance. Annual leave of 3–5 days: at least 2 weeks in advance. Annual leave of more than 5 days: at least 4 weeks in advance. Personal leave: at least 1 business day in advance; same-day requests accepted only for genuine emergencies. Sick leave: notify manager at the start of the working day or as soon as reasonably possible. Unpaid leave: at least 5 business days in advance except for documented emergencies. Compassionate/emergency leave: notify manager as soon as possible with no minimum advance notice.`,
  },
  {
    id: "approval-process",
    title: "Leave Approval Process",
    body: `All leave requests must be submitted through the Leave Management System. The employee's direct manager is the primary approver. Managers must respond to leave requests within 2 business days of submission. If a manager is unavailable (e.g., on leave themselves), the request escalates automatically to the manager's manager. Managers may deny leave requests citing business needs, but must provide a written reason. Employees may appeal denied requests to HR within 5 business days. Leave taken without approval is subject to disciplinary action. Approved leave can be cancelled by the employee before the start date; cancellation after the start date requires manager and HR approval.`,
  },
  {
    id: "probation",
    title: "Leave During Probation Period",
    body: `Employees in their probation period (typically 2 months) accrue leave at the standard rate but are restricted in how much they can take. During probation, employees may take sick leave as needed with manager notification. Annual and personal leave requests during probation require explicit manager approval and are generally discouraged except for emergencies. Employees who resign or are terminated during probation are not entitled to payout for accrued but unused leave. Upon successful completion of probation, all accrued leave becomes fully accessible with no restrictions.`,
  },
  {
    id: "public-holidays",
    title: "Public Holidays and Leave",
    body: `Public holidays are not deducted from any leave balance — they are additional days off. The company observes all Vietnamese national public holidays as defined by the Labor Law (approximately 11 days per year), including New Year's Day (1 Jan), Vietnamese New Year/Tet (3–5 days), Hung Kings Commemoration (10/3 lunar), Liberation Day (30 Apr), International Labor Day (1 May), National Day (2–3 Sep), and Christmas (25 Dec, optional). When a public holiday falls on a weekend, the following Monday is taken as a substitute day off. Leave taken immediately before or after a public holiday follows standard notice-period rules.`,
  },
  {
    id: "emergency-compassionate",
    title: "Emergency and Compassionate Leave",
    body: `Employees are entitled to up to 3 days of paid compassionate leave per event for: the death of an immediate family member (spouse, child, parent, parent-in-law); the critical illness requiring hospitalization of a spouse or child; a natural disaster or fire directly affecting the employee's home. Additional days beyond the 3-day entitlement may be taken as annual or unpaid leave. Evidence (e.g., death certificate, hospital admission paper) must be provided within 5 business days. Emergency leave for unexpected urgent situations is evaluated case-by-case. Employees should notify their manager as soon as possible and submit documentation upon return.`,
  },
  {
    id: "overlap-coverage",
    title: "Simultaneous Leave and Team Coverage Policy",
    body: `To ensure team coverage, managers may limit how many team members can be on leave simultaneously. As a default guideline, no more than 30% of a team's headcount should be on approved leave at the same time during peak periods. During critical project phases, product launches, or audits, managers may impose temporary leave restrictions. Employees are encouraged to check team leave calendars before submitting requests to avoid conflicts. When requests from multiple employees overlap, priority is generally given to the request submitted first, or the request involving the most sensitive personal circumstances at manager discretion. Leave requests that would leave a team without key coverage may be deferred or partially approved.`,
  },
  {
    id: "cancellation",
    title: "Cancelling Approved Leave",
    body: `Approved leave can be cancelled by the employee at any time before the leave start date without penalty; the leave days are returned to the employee's balance. Cancellation of leave that has already started requires manager approval and HR notification. If a manager needs to recall an employee from approved leave due to urgent business needs, the employee must be given at least 24 hours notice where possible, and any travel or accommodation costs directly incurred as a result of the recall are reimbursable by the company. Repeated last-minute cancellations of approved leave may be flagged for review.`,
  },
];
