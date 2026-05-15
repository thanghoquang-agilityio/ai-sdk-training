import { Observable } from "rxjs";
import { tap, catchError } from "rxjs";
import { EventType, type BaseEvent, type RunAgentInput } from "@ag-ui/core";
import { Middleware, verifyEvents, type AbstractAgent } from "@ag-ui/client";

export class ErrorBoundaryMiddleware extends Middleware {
  run(input: RunAgentInput, next: AbstractAgent): Observable<BaseEvent> {
    return this.runNext(input, next).pipe(
      catchError(
        (err) =>
          new Observable<BaseEvent>((observer) => {
            observer.next({
              type: EventType.RUN_ERROR,
              message: err instanceof Error ? err.message : String(err),
            });
            observer.complete();
          }),
      ),
    );
  }
}

export class MetricsMiddleware extends Middleware {
  run(input: RunAgentInput, next: AbstractAgent): Observable<BaseEvent> {
    const startTime = Date.now();
    let eventCount = 0;
    return this.runNext(input, next).pipe(
      tap({
        next: () => { eventCount++; },
        complete: () => {
          console.log(
            `[ag-ui:metrics] runId=${input.runId} events=${eventCount} duration=${Date.now() - startTime}ms`,
          );
        },
      }),
    );
  }
}

export class LoggingMiddleware extends Middleware {
  constructor(private readonly label = "ag-ui") {
    super();
  }

  run(input: RunAgentInput, next: AbstractAgent): Observable<BaseEvent> {
    return this.runNext(input, next).pipe(
      tap((event) => {
        if (process.env.NODE_ENV === "development") {
          console.log(`[${this.label}] runId=${input.runId} type=${event.type}`);
        }
      }),
    );
  }
}

// Validates that events are emitted in the correct AG-UI protocol order.
// Wraps the entire stream so any sequencing violation surfaces as a hard error
// in development rather than silently producing a corrupt event sequence.
export class VerifyEventsMiddleware extends Middleware {
  run(input: RunAgentInput, next: AbstractAgent): Observable<BaseEvent> {
    return this.runNext(input, next).pipe(verifyEvents());
  }
}
