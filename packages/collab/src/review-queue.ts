/**
 * Review queue — submit agent-generated code for human review.
 *
 * Phase 27: Enables collaborative code review within agent-workbench.
 * Users can submit diffs/changes for peer review, and reviewers can
 * approve, reject, or request changes.
 *
 * ## Usage
 *
 * ```ts
 * import { ReviewQueue } from "@agent-workbench/collab";
 *
 * const reviews = new ReviewQueue({ eventBus });
 *
 * // Submit a change for review
 * const item = reviews.submit("session-123", "alice", {
 *   title: "Refactor auth middleware",
 *   description: "Simplified token validation per team discussion",
 *   diffContent: "@@ -10,7 +10,7 @@@",
 *   filePath: "packages/auth/src/auth-middleware.ts",
 * });
 *
 * // Review it
 * reviews.approve(item.id, "bob", "Looks good!");
 *
 * // Check pending
 * const pending = reviews.listPending();
 * ```
 */

import type { EventBus } from "@agent-workbench/events";
import { EventName } from "@agent-workbench/events";

// ── Types ──────────────────────────────────────────────────────────────────

/** The possible states of a review item. */
export type ReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested";

/** A single review item in the queue. */
export interface ReviewItem {
  readonly id: string;
  readonly sessionId: string;
  readonly title: string;
  readonly description: string;
  /** The code diff content (unified diff format). */
  readonly diffContent: string;
  /** The file path being reviewed (or "multiple" for multi-file). */
  readonly filePath: string;
  readonly status: ReviewStatus;
  readonly submittedBy: string;
  readonly submittedAt: string;
  readonly reviewedBy?: string;
  readonly reviewedAt?: string;
  readonly reviewComment?: string;
}

/** Options when submitting a new review. */
export interface SubmitReviewOptions {
  readonly title: string;
  readonly description?: string;
  readonly diffContent: string;
  readonly filePath: string;
}

// ── ReviewQueue ────────────────────────────────────────────────────────────

const STORE_PREFIX = "rev_";

/**
 * In-memory review queue.
 *
 * Stores review submissions and their lifecycle states.
 * Emits events on the EventBus for SSE delivery to subscribers.
 * Expired/completed reviews are cleaned up periodically.
 */
export class ReviewQueue {
  /** Map<reviewId, ReviewItem> */
  private readonly items = new Map<string, ReviewItem>();
  /** Map<sessionId, Set<reviewId>> — session index */
  private readonly sessionIndex = new Map<string, Set<string>>();
  private readonly eventBus: EventBus | undefined;
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;

  /**
   * How long after resolution (approved/rejected/changes_requested) to keep
   * the review before auto-cleanup. Default: 7 days.
   */
  private readonly retentionMs: number;

  constructor(options?: {
    eventBus?: EventBus | undefined;
    /** How long to keep resolved reviews before cleanup. Default: 7 days. */
    retentionMs?: number;
    /** Auto-start cleanup. Default: true. */
    autoCleanup?: boolean;
  }) {
    this.eventBus = options?.eventBus;
    this.retentionMs = options?.retentionMs ?? 7 * 24 * 60 * 60 * 1000;
    if (options?.autoCleanup !== false) {
      this.startCleanup();
    }
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  /**
   * Submit a new review item.
   *
   * Emits `review.submitted` on the event bus.
   */
  submit(
    sessionId: string,
    submittedBy: string,
    options: SubmitReviewOptions,
  ): ReviewItem {
    const id = this.generateId();
    const now = new Date().toISOString();

    const item: ReviewItem = {
      id,
      sessionId,
      title: options.title,
      description: options.description ?? "",
      diffContent: options.diffContent,
      filePath: options.filePath,
      status: "pending",
      submittedBy,
      submittedAt: now,
    };

    this.items.set(id, item);

    // Index by session
    let sessionReviews = this.sessionIndex.get(sessionId);
    if (!sessionReviews) {
      sessionReviews = new Set();
      this.sessionIndex.set(sessionId, sessionReviews);
    }
    sessionReviews.add(id);

    this.emit(EventName.REVIEW_SUBMITTED, {
      reviewId: id,
      sessionId,
      title: options.title,
      filePath: options.filePath,
      submittedBy,
    });

    return item;
  }

  /**
   * Approve a review item.
   *
   * Emits `review.approved` on the event bus.
   * Returns null if the review is not found.
   */
  approve(
    reviewId: string,
    reviewerId: string,
    comment?: string,
  ): ReviewItem | null {
    return this.transition(reviewId, "approved", reviewerId, comment);
  }

  /**
   * Reject a review item.
   *
   * Emits `review.rejected` on the event bus.
   * Returns null if the review is not found.
   */
  reject(
    reviewId: string,
    reviewerId: string,
    comment?: string,
  ): ReviewItem | null {
    return this.transition(reviewId, "rejected", reviewerId, comment);
  }

  /**
   * Request changes on a review item.
   *
   * Emits `review.changes_requested` on the event bus.
   * Returns null if the review is not found.
   */
  requestChanges(
    reviewId: string,
    reviewerId: string,
    comment: string,
  ): ReviewItem | null {
    if (!comment || comment.trim().length === 0) {
      throw new Error("Comment is required when requesting changes.");
    }
    return this.transition(reviewId, "changes_requested", reviewerId, comment);
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  /** Get a single review item by ID. */
  get(reviewId: string): ReviewItem | undefined {
    return this.items.get(reviewId);
  }

  /** List all review items for a session, newest first. */
  listBySession(sessionId: string): readonly ReviewItem[] {
    const reviewIds = this.sessionIndex.get(sessionId);
    if (!reviewIds) return [];
    return Array.from(reviewIds)
      .map((id) => this.items.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  /** List all pending (unreviewed) items, newest first. */
  listPending(): readonly ReviewItem[] {
    return Array.from(this.items.values())
      .filter((item) => item.status === "pending")
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  /** List all items, optionally filtered by status. */
  listAll(status?: ReviewStatus): readonly ReviewItem[] {
    let items = Array.from(this.items.values());
    if (status) {
      items = items.filter((item) => item.status === status);
    }
    return items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  /** Count pending reviews. */
  get pendingCount(): number {
    let count = 0;
    for (const item of this.items.values()) {
      if (item.status === "pending") count++;
    }
    return count;
  }

  /** Total reviews ever submitted (including resolved). */
  get totalSubmitted(): number {
    return this.items.size;
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  /** Start periodic cleanup of old resolved reviews. */
  startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.removeExpired();
    }, 300_000); // every 5 minutes
  }

  /** Stop periodic cleanup. */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /** Remove resolved reviews older than the retention period. */
  private removeExpired(): void {
    const cutoff = Date.now() - this.retentionMs;
    const expired: string[] = [];

    for (const [id, item] of this.items) {
      if (item.status !== "pending") {
        const resolvedAt = item.reviewedAt
          ? new Date(item.reviewedAt).getTime()
          : Date.now();
        if (resolvedAt < cutoff) {
          expired.push(id);
        }
      }
    }

    for (const id of expired) {
      const item = this.items.get(id);
      if (item) {
        this.items.delete(id);
        this.removeFromIndex(id, item.sessionId);
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Transition a review to a new status. */
  private transition(
    reviewId: string,
    status: "approved" | "rejected" | "changes_requested",
    reviewerId: string,
    comment?: string,
  ): ReviewItem | null {
    const item = this.items.get(reviewId);
    if (!item) return null;

    const now = new Date().toISOString();
    const updated: ReviewItem = {
      ...item,
      status,
      reviewedBy: reviewerId,
      reviewedAt: now,
    };
    // Only set comment if provided (exactOptionalPropertyTypes compat)
    if (comment !== undefined) {
      (updated as unknown as Record<string, unknown>).reviewComment = comment;
    }
    this.items.set(reviewId, updated);

    const eventName =
      status === "approved"
        ? EventName.REVIEW_APPROVED
        : status === "rejected"
          ? EventName.REVIEW_REJECTED
          : EventName.REVIEW_CHANGES_REQUESTED;

    this.emit(eventName, {
      reviewId,
      sessionId: item.sessionId,
      title: item.title,
      status,
      reviewedBy: reviewerId,
      comment,
    });

    return updated;
  }

  /** Generate a unique review ID. */
  private generateId(): string {
    const entropy = crypto.randomUUID().replace(/-/g, "");
    const suffix = Buffer.from(entropy, "hex")
      .toString("base64url")
      .slice(0, 22);
    const candidate = `${STORE_PREFIX}${suffix}`;
    if (this.items.has(candidate)) {
      return this.generateId();
    }
    return candidate;
  }

  /** Remove a review ID from the session index. */
  private removeFromIndex(reviewId: string, sessionId: string): void {
    const sessionReviews = this.sessionIndex.get(sessionId);
    if (!sessionReviews) return;
    sessionReviews.delete(reviewId);
    if (sessionReviews.size === 0) {
      this.sessionIndex.delete(sessionId);
    }
  }

  /** Emit an event if EventBus is configured. */
  private emit(type: string, payload: Record<string, unknown>): void {
    if (!this.eventBus) return;
    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);
    this.eventBus.publish({
      id: ulid,
      type,
      timestamp: new Date().toISOString(),
      payload,
    });
  }
}
