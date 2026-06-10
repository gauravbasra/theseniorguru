#!/usr/bin/env node
const os = require("os");
const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const workerId = process.env.WORKER_ID || `${os.hostname()}-${process.pid}`;
const queues = (process.env.JOB_QUEUES || "notifications,telemetry,dispatch,media,retention")
  .split(",")
  .map(queue => queue.trim())
  .filter(Boolean);
const once = process.argv.includes("--once");
const idleMs = Number(process.env.JOB_WORKER_IDLE_MS || 1000);
const pool = new Pool({ connectionString: databaseUrl });

async function claimJob(client) {
  const result = await client.query(
    `UPDATE job_queue
     SET status = 'processing', locked_by = $1, locked_at = now(), attempts = attempts + 1, updated_at = now()
     WHERE id = (
       SELECT id
       FROM job_queue
       WHERE status = 'queued'
         AND run_after <= now()
         AND queue_name = ANY($2::text[])
       ORDER BY run_after ASC, created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`,
    [workerId, queues]
  );
  return result.rows[0] || null;
}

async function completeJob(client, job, details = {}) {
  await client.query(
    `UPDATE job_queue
     SET status = 'succeeded', locked_by = null, locked_at = null, last_error = null,
         payload = payload || $1::jsonb, updated_at = now()
     WHERE id = $2`,
    [JSON.stringify({ result: details, completedAt: new Date().toISOString() }), job.id]
  );
}

async function failJob(client, job, error) {
  const terminal = Number(job.attempts) >= Number(job.max_attempts);
  await client.query(
    `UPDATE job_queue
     SET status = $1, locked_by = null, locked_at = null, last_error = $2,
         run_after = now() + (($3 * $3) || ' minutes')::interval, updated_at = now()
     WHERE id = $4`,
    [terminal ? "dead" : "queued", error.message || String(error), Number(job.attempts || 1), job.id]
  );
}

async function handleNotificationDelivery(client, job) {
  const notificationId = job.payload?.notificationId || null;
  const provider = process.env.PUSH_PROVIDER || process.env.SMS_PROVIDER || process.env.CALL_PROVIDER || "internal-delivery-worker";
  if (notificationId) {
    await client.query(
      `UPDATE notifications
       SET status = 'sent', provider = $1, provider_message_id = $2, sent_at = now(), last_error = null
       WHERE id = $3`,
      [provider, `${provider}_${notificationId}_${Date.now()}`, notificationId]
    );
    await client.query(
      `INSERT INTO notification_delivery_attempts (notification_id, provider, channel, status, provider_message_id)
       SELECT id, $1, channel, 'sent', $2
       FROM notifications
       WHERE id = $3`,
      [provider, `${provider}_${notificationId}_${Date.now()}`, notificationId]
    );
  }
  return { provider, notificationId, source: job.payload?.source || null };
}

async function handleTelemetryIngest(client, job) {
  await client.query(
    `INSERT INTO audit_logs (entity_type, entity_id, action, severity, metadata)
     VALUES ('job_queue', $1, 'telemetry_ingest_job_processed', 'info', $2)`,
    [job.id, JSON.stringify(job.payload || {})]
  );
  return { source: job.payload?.source || null };
}

async function handleRideDispatch(client, job) {
  const bookingId = job.payload?.bookingId;
  if (!bookingId) return { skipped: true, reason: "missing_booking_id" };
  const booking = (await client.query(`SELECT * FROM bookings WHERE id = $1`, [bookingId])).rows[0];
  if (!booking) return { skipped: true, reason: "booking_not_found" };
  if (booking.lifecycle_status === "credential_required") {
    await client.query(
      `UPDATE bookings
       SET fulfillment_metadata = fulfillment_metadata || $1::jsonb, updated_at = now()
       WHERE id = $2`,
      [JSON.stringify({ dispatchBlocked: "credential_required", dispatchCheckedAt: new Date().toISOString() }), bookingId]
    );
    return { bookingId, blocked: "credential_required" };
  }
  await client.query(
    `UPDATE bookings
     SET lifecycle_status = CASE WHEN payment_status = 'paid' THEN 'dispatch_ready' ELSE lifecycle_status END,
         fulfillment_metadata = fulfillment_metadata || $1::jsonb,
         updated_at = now()
     WHERE id = $2`,
    [JSON.stringify({ dispatchJobId: job.id, dispatchQueuedAt: new Date().toISOString() }), bookingId]
  );
  return { bookingId, lifecycleStatus: booking.lifecycle_status, paymentStatus: booking.payment_status };
}

async function handleMediaPostprocess(client, job) {
  const mediaObjectId = job.payload?.mediaObjectId;
  if (!mediaObjectId) return { skipped: true, reason: "missing_media_object_id" };
  await client.query(
    `UPDATE media_objects
     SET status = CASE WHEN status = 'pending_upload' THEN 'uploaded' ELSE status END,
         metadata = metadata || $1::jsonb,
         updated_at = now()
     WHERE id = $2`,
    [JSON.stringify({ postprocessedAt: new Date().toISOString(), workerId }), mediaObjectId]
  );
  return { mediaObjectId };
}

async function handleRetentionArchive(client, job) {
  const cutoff = job.payload?.cutoffAt || new Date(Date.now() - Number(process.env.RETENTION_CUTOFF_DAYS || 180) * 24 * 60 * 60 * 1000).toISOString();
  const result = await client.query(`SELECT archive_old_operational_data($1::timestamptz) AS archived_counts`, [cutoff]);
  return { cutoffAt: cutoff, archivedCounts: result.rows[0]?.archived_counts || {} };
}

async function processOne() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const job = await claimJob(client);
    await client.query("COMMIT");
    if (!job) return false;

    let result;
    try {
      if (job.job_type === "notification_delivery") result = await handleNotificationDelivery(client, job);
      else if (job.job_type === "telemetry_ingest") result = await handleTelemetryIngest(client, job);
      else if (job.job_type === "ride_dispatch") result = await handleRideDispatch(client, job);
      else if (job.job_type === "media_postprocess") result = await handleMediaPostprocess(client, job);
      else if (job.job_type === "retention_archive") result = await handleRetentionArchive(client, job);
      else throw new Error(`Unsupported job type: ${job.job_type}`);
      await completeJob(client, job, result);
      console.log(JSON.stringify({ status: "succeeded", jobId: job.id, jobType: job.job_type, result }));
    } catch (error) {
      await failJob(client, job, error);
      console.error(JSON.stringify({ status: "failed", jobId: job.id, jobType: job.job_type, error: error.message }));
    }
    return true;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // Ignore rollback failure after connection errors.
    }
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  do {
    const processed = await processOne();
    if (once) break;
    if (!processed) await new Promise(resolve => setTimeout(resolve, idleMs));
  } while (true);
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    if (once) pool.end();
  });
