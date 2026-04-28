import { formatHumanDateRange } from "@/utils/date";
import { SLACK_API_POST_MESSAGE } from "./constants";

async function postSlackMessage(text: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN || process.env.SLACK_USER_TOKEN;
  const channel = process.env.SLACK_DEFAULT_CHANNEL;
  if (!token || !channel) return;

  await fetch(SLACK_API_POST_MESSAGE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, text }),
  });
}

export async function notifyTimeOffApproved(
  employeeName: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  const dateRange = formatHumanDateRange(startDate, endDate);
  await postSlackMessage(`${employeeName} will be off ${dateRange}`);
}
