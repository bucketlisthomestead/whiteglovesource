# White Glove Moving Service — AWS CDK

Shared **RDS MySQL 8.0**, **blue/green EC2** deployments, Elastic IP, S3, and Secrets Manager.

Estimated cost: **~$35–45/month** (EC2 + RDS + EBS + Elastic IP + S3; no NAT, ALB, or ECS).

## Architecture

| Component | Choice |
|-----------|--------|
| Compute | EC2 `t4g.small` (ARM, Amazon Linux 2023), active + on-demand candidate |
| Network | Default VPC, public subnet for EC2, RDS in private/public subnet (no public access) |
| App runtime | Docker Compose on EC2 (nginx + NestJS API only) |
| Database | **RDS MySQL 8.0** `db.t4g.micro` (single-AZ; optional Multi-AZ via context) |
| Static + API | nginx → NestJS API |
| Object storage | S3 (`content/`, `uploads/`, `backups/mysql/`) |
| Secrets | Secrets Manager (`wgs/db`, `wgs/jwt`) |
| Admin access | SSM Session Manager (no open SSH) |
| Uptime alerts | EventBridge + Lambda health check → SNS (email/SMS) |
| Deploy model | Blue/green: candidate EC2 → Playwright smoke → Elastic IP swap |

```
                    +------------------+
                    |   Elastic IP     |
                    +--------+---------+
                             |
              +--------------+--------------+
              | active EC2   | candidate EC2|
              | (wgs-role=   | (wgs-role=   |
              |  active)     |  candidate)  |
              +------+-------+------+-------+
                     |              |
                     +------+-------+
                            |
                     +------v-------+
                     |  RDS MySQL   |
                     |  (private)   |
                     +--------------+
                            |
                     +------v-------+
                     |  S3 bucket   |
                     +--------------+
```

## Prerequisites

- AWS account with CLI configured (`aws configure`)
- Node.js 20+ and npm
- Docker (local builds for deploy script)
- AWS CDK CLI (installed via `npm install` in this folder)
- `jq` (for deploy scripts)

## First-time setup

```bash
cd infra
npm install
npx cdk bootstrap    # once per account/region
```

Optional context overrides (in `cdk.json` or CLI):

```bash
npx cdk deploy -c region=us-east-1 -c instanceType=t4g.small -c rdsInstanceType=db.t4g.micro
npx cdk deploy -c rdsMultiAz=true   # optional Multi-AZ (~2x RDS cost)
```

### Site uptime monitoring

The stack includes a budget-friendly AWS-native monitor: EventBridge schedule → Lambda HTTP health check → SNS email/SMS alerts. No load balancer or domain required — it polls the Elastic IP `/api/health` endpoint directly.

Deploy with an alert email (recommended):

```bash
cd infra
npm run build
AWS_PROFILE=wgs-deploy npx cdk deploy -c alertEmail=you@example.com
```

Optional SMS (E.164 format):

```bash
AWS_PROFILE=wgs-deploy npx cdk deploy -c alertEmail=you@example.com -c alertPhone=+15551234567
```

You can also set `ALERT_EMAIL` / `ALERT_PHONE` environment variables at deploy time instead of `-c` context.

| Context | Purpose |
|---------|---------|
| `alertEmail` | SNS email subscription (required for email alerts) |
| `alertPhone` | Optional SNS SMS subscription (`+1...` E.164) |
| `monitorUrl` | Override health URL (default: `HttpUrl` + `/api/health`) |
| `monitorScheduleMinutes` | Check interval in minutes (default `5`) |
| `enableSiteMonitor=false` | Disable monitoring resources |

**After deploy:** AWS sends a confirmation email to `alertEmail`. Open it and click **Confirm subscription** — alerts are not delivered until confirmed.

**SMS setup (US accounts, 2025+):** Email alerts work immediately after subscription confirmation. SMS has extra AWS prerequisites — see below.

### Why sandbox phone verification fails

Amazon SNS sends SMS through **AWS End User Messaging SMS** (Pinpoint SMS Voice v2). Every outbound SMS needs an **origination identity** — the number or sender ID the recipient sees as the sender.

For **US destinations** (+1), AWS does **not** allow generic/shared sender IDs. You must provision one of:

| Type | Typical use | Provision time | Registration |
|------|-------------|----------------|----------------|
| **Toll-free (TFN)** | OTP, alerts, low volume | Minutes to get number | **Required** — up to ~15 business days |
| **10DLC** | A2P / marketing / alerts | 7–10 days after brand+campaign approval | Brand + campaign registration first |
| **Short code** | High volume | 8–12 weeks | Expensive; overkill for uptime alerts |
| **Simulator** | API testing only | Instant | Cannot verify real phones or deliver to carriers |

The SNS SMS **sandbox** still requires a real US origination identity before it can send the OTP to verify `+13363466777`. Sandbox limits *who* you can text (up to 10 verified numbers); it does **not** waive the origination requirement.

**Checked on account `536579406753` (`wgs-deploy`, `us-east-1`):**

- Sandbox: **yes** (`IsInSandbox: true`)
- Sandbox destination `+13363466777`: **Pending** (OTP never sent — no origination identity)
- Origination phone numbers / sender IDs / registrations: **none**

### Minimum fix: toll-free number (recommended for low-volume alerts)

Fastest path for a single admin alert phone. Expect **~2–3 weeks** end-to-end (number provision + TFN registration approval).

**Console (us-east-1):**

1. Open [AWS End User Messaging SMS](https://console.aws.amazon.com/sms-voice/home?region=us-east-1) → **Phone numbers** → **Request originator**.
2. Country **United States**, type **Toll-free**, capabilities **SMS**, message type **Transactional**.
3. Complete the request; note the number when status becomes **Active**.
4. **Registrations** → select the TFN → **Begin registration** → use case *One-time passwords* or *Account notifications* (match your alert text). Submit; wait for approval (AWS docs: up to 15 business days).
5. Open the phone number → **Resource policy** tab. If created via console, SNS permission is usually pre-added. If created via CLI/API, add a policy allowing `sns.amazonaws.com` → `sms-voice:SendTextMessage` ([AWS re:Post example](https://repost.aws/articles/ARq-jq4ZWQTJqRg5_B4fqFZw/the-provided-number-does-not-exist-or-does-not-belong-to-the-account-error-when-trying-to-send-messages-via-sns-or-pinpoint-even-though-the-required-origination-identity-is-acquired-in-the-account)).
6. [SNS console](https://console.aws.amazon.com/sns/v3/home?region=us-east-1) → **Text messaging (SMS)** → **Sandbox destination phone numbers** → add `+13363466777` → enter OTP → **Verified**.
7. Optionally raise **Text messaging preferences** monthly spend limit above `$1` (current account limit) so alerts are not blocked.
8. After sandbox testing, request **production access** (SNS → Text messaging → **Exit SMS sandbox**) via AWS Support to text unverified numbers.

**CLI checks:**

```bash
export AWS_PROFILE=wgs-deploy AWS_REGION=us-east-1

aws sns get-sms-sandbox-account-status
aws sns list-sms-sandbox-phone-numbers
aws sns get-sms-attributes

aws pinpoint-sms-voice-v2 describe-phone-numbers
aws pinpoint-sms-voice-v2 describe-registrations
```

**Alternative: 10DLC** — End User Messaging → **Registrations** → register brand, then campaign, then request a 10DLC number. Better for higher volume; slower initial setup.

### Is SMS viable without buying/registering a number?

**No, not for US real phones.** There is no free shared origination identity for SNS sandbox OTPs to `+1` numbers. Simulator numbers only talk to other simulator destinations inside AWS.

**Practical alternatives for WGS uptime alerts:**

- **Email only (recommended):** Deploy with `-c alertEmail=...` only. Confirms in inbox; no SMS registration.
- **Email → phone:** Most carriers offer `you@txt.att.net`-style gateways; brittle, undocumented, not recommended for production monitoring.
- **Third-party SMS** (Twilio, etc.): Still requires number registration under US A2P rules; does not avoid compliance, only moves it off AWS.

SMS is viable on this account **after** TFN or 10DLC registration completes. For rare downtime alerts, **email-only is the low-friction choice**; add SMS only if the registration wait and ~$2/mo number lease are acceptable.

Stack outputs: **AlertTopicArn**, **MonitorUrl**, **AlertSubscriptionHint**.

## Deploy infrastructure

```bash
cd infra
npm run build
npx cdk deploy
```

Note the outputs:

| Output | Purpose |
|--------|---------|
| **ElasticIp** / **HttpUrl** | Live site URL |
| **RdsEndpoint** | RDS hostname (also in `wgs/db` secret after attach) |
| **DbSecretArn**, **JwtSecretArn** | Credentials |
| **InstanceId** | Active EC2 (`wgs-role=active`) |
| **BucketName** | S3 bucket |
| **InstanceSecurityGroupId**, **InstanceProfileName** | Used by `launch-candidate.sh` |

The EC2 user-data script installs Docker, writes `/opt/wgs/.env` from Secrets Manager + RDS endpoint, associates the Elastic IP (active only), and starts Compose if the app tarball is present.

### First boot on empty RDS

Set `TYPEORM_SYNCHRONIZE=true` for the first deploy only (creates schema + seed):

```bash
# On active instance via SSM, before or after first app deploy:
echo 'TYPEORM_SYNCHRONIZE=true' >> /opt/wgs/.env
# Restart API after deploy, then set back to false
```

Or export on candidate launch: `TYPEORM_SYNCHRONIZE=true ./deploy/scripts/launch-candidate.sh`

## Migrate existing Docker MySQL to RDS

If production still runs MySQL in Docker on the active instance:

```bash
chmod +x deploy/scripts/*.sh deploy/scripts/lib/*.sh
./deploy/scripts/migrate-docker-mysql-to-rds.sh
```

Then deploy CDK with RDS, remove Docker MySQL from compose, and redeploy the app.

## Blue/green application deploy

**Recommended for production app updates (zero user-facing downtime).** The live Elastic IP stays on the active instance while the candidate is built and verified; traffic only moves at promotion after health checks pass.

```bash
chmod +x deploy/scripts/*.sh deploy/scripts/lib/*.sh

# Full pipeline: launch candidate → SSM deploy → health wait → Playwright smoke → EIP swap
./deploy/scripts/blue-green-deploy.sh

# Or step by step:
./deploy/scripts/launch-candidate.sh
./deploy/scripts/push-and-deploy-ssm.sh <candidate-instance-id>
./deploy/scripts/verify-candidate.sh <candidate-public-ip>
./deploy/scripts/promote-candidate.sh
```

Flags:

- `blue-green-deploy.sh --skip-verify` — skip Playwright gate
- `promote-candidate.sh --terminate-old` — terminate retired instance (default: stop for rollback)

Deployment state is stored in `deploy/.deploy-state.json` (gitignored). Instances are tagged `wgs-role=active|c candidate|retired`.

### Rollback

If the old instance was stopped (default):

1. Start the retired instance.
2. Run `promote-candidate.sh` logic in reverse: disassociate EIP from new active, associate to retired, swap tags.

Or redeploy to the retired instance and promote again.

## Deploy application code (single instance / in-place)

```bash
./deploy/scripts/push-and-deploy-ssm.sh <instance-id>
```

Builds frontend/backend, uploads tarball to S3, runs Docker Compose on the target instance via SSM.

### Downtime expectations

| Method | Command | User-facing downtime |
|--------|---------|-------------------|
| **Blue/green (recommended)** | `blue-green-deploy.sh` | None during app deploy; EIP swap at promote is typically a few seconds |
| **In-place** | `push-and-deploy-ssm.sh <active-id>` | **~30s–2min** while the API container restarts (nginx returns **502** until `/api/health` is OK) |

The in-place script now **builds images first** while old containers serve traffic, then recreates only the `api` container, waits for `http://127.0.0.1/api/health`, and updates `nginx` only if its image changed.

**Elastic IP:** moves only on CDK instance replacement (user-data retry), `promote-candidate.sh`, or drift recovery on the **active** instance — **not** during routine candidate deploys. Earlier versions re-associated the EIP at the end of every SSM deploy, which could steal the live IP when deploying to a candidate.

For zero-downtime app deploys, always use:

```bash
./deploy/scripts/blue-green-deploy.sh
```

Do **not** run `push-and-deploy-ssm.sh` against the live active instance unless you accept a brief outage window.

## Playwright deploy smoke

Lightweight gate (no Mailpit); used by `verify-candidate.sh`:

```bash
BASE_URL=http://<candidate-ip> npm run test:deploy-smoke
```

Env overrides: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`.

## Environment variables

Production `.env` is generated on the instance from Secrets Manager. See `deploy/.env.production.example`.

| Variable | Purpose |
|----------|---------|
| `DB_HOST` | RDS endpoint hostname |
| `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | TypeORM MySQL |
| `TYPEORM_SYNCHRONIZE` | `true` only for empty RDS first boot |
| `JWT_SECRET` | API auth |
| `STORAGE_BACKEND` | `s3` on EC2 |
| `S3_BUCKET`, `AWS_REGION` | S3 CMS + document storage |

## MySQL backups

Cron on EC2 runs `backup-mysql-to-s3.sh` daily (03:15 UTC). Dumps RDS via `mysqldump` to `s3://<bucket>/backups/mysql/` (30-day lifecycle).

### Restore from S3 backup

```bash
# On an EC2 instance with mariadb105 client (via SSM)
source /opt/wgs/.env
aws s3 cp s3://<BucketName>/backups/mysql/white_glove_delivery-YYYYMMDDTHHMMSSZ.sql.gz /tmp/restore.sql.gz
gunzip /tmp/restore.sql.gz
mysql -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD" "$DB_DATABASE" < /tmp/restore.sql
```

## Security

- RDS security group: inbound **3306 only from EC2 instance security group**
- EC2: HTTP/HTTPS public; **no public MySQL**
- RDS: `publiclyAccessible: false`
- Secrets Manager: RDS password + JWT; IAM role on EC2 for read access

## Useful commands

```bash
cd infra && npx cdk synth
npx cdk diff
aws ssm start-session --target <InstanceId>
sudo tail -f /var/log/wgs-user-data.log
docker logs -f wgs-api
```

## Teardown

```bash
cd infra && npx cdk destroy
```

S3 bucket and RDS snapshot use `RETAIN` / snapshot policies — delete manually if needed.

## Cost notes

| Item | Approx. monthly |
|------|-----------------|
| t4g.small EC2 (on-demand) | ~$12 |
| db.t4g.micro RDS (single-AZ, 20 GB) | ~$12–15 |
| 30 GB gp3 EBS (per instance) | ~$2.50 each |
| Elastic IP (attached) | ~$0 |
| S3 + Secrets Manager | ~$1–3 |
| Site monitor (Lambda + EventBridge + SNS email) | ~$0 (within free tier) |
| Site monitor SMS (optional) | ~$0.00645/msg (US) |
| **Total (one active EC2 + RDS)** | **~$35–45** |
| Candidate EC2 during deploy | +~$12 prorated for deploy window |

Use Reserved Instances or Savings Plans to reduce EC2/RDS cost further.

Third-party uptime services (UptimeRobot, Pingdom, etc.) are optional alternatives but not required for this stack.
