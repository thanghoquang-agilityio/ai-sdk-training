import { isToolUIPart, type UIMessage } from "ai";
import {
  asRecord,
  asRecordArray,
  asOptionalString,
  isBalanceLikeRecord,
  isRequestLikeRecord,
} from "./utils";
import { getToolName, getFriendlyToolLabelByName } from "./tool";
import {
  getSelfRequestRowActions,
  getTeamRequestRowActions,
  getBalanceRowActions,
  getRequestRowActionBuilder,
} from "./cells";
import {
  buildMembersTableModel,
  getRequestTableModel,
  getBalanceTableModel,
  type ToolOutputTableModel,
} from "./named-tables";
import {
  collectRecordCollections,
  getCollectionId,
  getCollectionTitle,
  getGenericTableModel,
} from "./generic-table";

function getDynamicToolOutputTables(output: unknown, toolName: string | null) {
  const collections = collectRecordCollections(output);
  if (collections.length === 0) {
    return [] as ToolOutputTableModel[];
  }

  const idCollisionCount = new Map<string, number>();

  return collections
    .map((collection, index) => {
      const baseId = getCollectionId(collection.path, toolName);
      const collisionCount = idCollisionCount.get(baseId) ?? 0;
      idCollisionCount.set(baseId, collisionCount + 1);

      const id =
        collisionCount === 0 ? baseId : `${baseId}-${collisionCount + 1}`;
      const title = getCollectionTitle(collection.path, toolName);
      const rows = collection.rows;

      if (rows.every(isBalanceLikeRecord)) {
        return getBalanceTableModel({
          id,
          title,
          payload: { balances: rows },
          getRowActions: getBalanceRowActions,
          emptyLabel: "No records found.",
        });
      }

      if (rows.every(isRequestLikeRecord)) {
        return getRequestTableModel({
          id,
          title,
          payload: { requests: rows },
          showEmployee: rows.some((row) => Boolean(asOptionalString(row.employeeName))),
          getRowActions: getRequestRowActionBuilder(toolName),
          emptyLabel: "No records found.",
        });
      }

      return getGenericTableModel({
        id,
        title: title || `${getFriendlyToolLabelByName(toolName)} ${index + 1}`,
        rows,
        emptyLabel: "No records found.",
      });
    })
    .filter((table): table is ToolOutputTableModel => table !== null);
}

export function getToolOutputTables(part: UIMessage["parts"][number]) {
  if (!isToolUIPart(part) || part.state !== "output-available" || part.preliminary) {
    return [] as ToolOutputTableModel[];
  }

  const toolName = getToolName(part);
  const output = asRecord(part.output);
  const dynamicTables = getDynamicToolOutputTables(part.output, toolName);

  if (!toolName) {
    return dynamicTables;
  }

  if (!output) {
    return dynamicTables;
  }

  switch (toolName) {
    case "list_employees": {
      const table = buildMembersTableModel({
        id: "all-employees",
        title: "Project members",
        memberRows: asRecordArray(output.employees),
        emptyLabel: "No employees found.",
      });
      return table ? [table] : dynamicTables;
    }

    case "list_team_members": {
      const table = buildMembersTableModel({
        id: "team-members",
        title: "Team members",
        memberRows: asRecordArray(output.members),
        emptyLabel: "No team members found.",
      });
      return table ? [table] : dynamicTables;
    }

    case "list_my_time_off_requests": {
      const requests = getRequestTableModel({
        id: "my-time-off-requests",
        title: "My time-off requests",
        payload: output,
        showEmployee: false,
        getRowActions: getSelfRequestRowActions,
        emptyLabel: "No time-off requests found.",
      });
      return requests ? [requests] : dynamicTables;
    }

    case "list_team_time_off_requests": {

      const requests = getRequestTableModel({
        id: "team-time-off-requests",
        title: "Team time-off requests",
        payload: output,
        showEmployee: true,
        getRowActions: getTeamRequestRowActions,
        emptyLabel: "No team requests found.",
      });
      return requests ? [requests] : dynamicTables;
    }

    case "get_my_time_off_balance": {
      const tables = [
        getBalanceTableModel({
          id: "my-time-off-balance",
          title: "My leave balance",
          payload: output,
          getRowActions: getBalanceRowActions,
          emptyLabel: "No balance data found.",
        }),
        getRequestTableModel({
          id: "my-upcoming-requests",
          title: "Upcoming requests",
          payload: {
            requests: output.upcomingRequests,
          },
          showEmployee: false,
          getRowActions: getSelfRequestRowActions,
          emptyLabel: "No upcoming requests.",
        }),
      ].filter((table): table is ToolOutputTableModel => table !== null);

      return tables.length > 0 ? tables : dynamicTables;
    }

    case "submit_my_time_off_request": {
      const balance = asRecord(output.balance);
      if (!balance) return dynamicTables;

      const tables = [
        getBalanceTableModel({
          id: "updated-time-off-balance",
          title: "Updated leave balance",
          payload: balance,
          getRowActions: getBalanceRowActions,
          emptyLabel: "No balance data found.",
        }),
        getRequestTableModel({
          id: "updated-upcoming-requests",
          title: "Upcoming requests",
          payload: {
            requests: balance.upcomingRequests,
          },
          showEmployee: false,
          getRowActions: getSelfRequestRowActions,
          emptyLabel: "No upcoming requests.",
        }),
      ].filter((table): table is ToolOutputTableModel => table !== null);

      return tables.length > 0 ? tables : dynamicTables;
    }

    case "cancel_my_time_off_request": {
      const table = getRequestTableModel({
        id: "my-cancelled-requests",
        title: "Cancelled requests",
        payload: asRecord(output.cancelledRequests) ?? {},
        showEmployee: false,
        getRowActions: getSelfRequestRowActions,
        emptyLabel: "No cancelled requests.",
      });
      return table ? [table] : dynamicTables;
    }

    case "search_leave_policy":
      return [];

    case "approve_team_time_off_request":
    case "reject_team_time_off_request": {
      const reviewedEmployeeRequests = asRecord(output.reviewedEmployeeRequests);
      const pendingTeamRequests = asRecord(output.pendingTeamRequests);

      if (reviewedEmployeeRequests || pendingTeamRequests) {
        const tables: ToolOutputTableModel[] = [];

        if (reviewedEmployeeRequests) {
          const table = getRequestTableModel({
            id: "reviewed-employee-requests",
            title: `${reviewedEmployeeRequests.query ?? "Employee"}'s requests`,
            payload: reviewedEmployeeRequests,
            showEmployee: true,
            getRowActions: getTeamRequestRowActions,
            emptyLabel: "No requests found.",
          });
          if (table) tables.push(table);
        }

        if (pendingTeamRequests) {
          const table = getRequestTableModel({
            id: "pending-team-requests",
            title: "Pending team requests",
            payload: pendingTeamRequests,
            showEmployee: true,
            getRowActions: getTeamRequestRowActions,
            emptyLabel: "No pending team requests.",
          });
          if (table) tables.push(table);
        }

        return tables.length > 0 ? tables : dynamicTables;
      }

      const teamRequests = asRecord(output.teamRequests);
      if (!teamRequests) return dynamicTables;

      const requests = getRequestTableModel({
        id: "team-time-off-requests",
        title: "Team time-off requests",
        payload: teamRequests,
        showEmployee: true,
        getRowActions: getTeamRequestRowActions,
        emptyLabel: "No team requests found.",
      });
      return requests ? [requests] : dynamicTables;
    }

    default:
      return dynamicTables;
  }
}
