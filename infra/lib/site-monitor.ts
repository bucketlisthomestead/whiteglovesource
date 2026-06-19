import { join } from 'path';
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface SiteMonitorProps {
  /** Short app prefix used in resource names (e.g. wgs). */
  appName: string;
  /** Full URL to GET (expects HTTP 200 and JSON {"status":"ok"}). */
  monitorUrl: string;
  /** Email address for SNS alerts (requires inbox confirmation). */
  alertEmail?: string;
  /** E.164 phone number for optional SMS alerts (e.g. +15551234567). */
  alertPhone?: string;
  /** Health check interval in minutes (default 5). */
  scheduleMinutes?: number;
}

export class SiteMonitor extends Construct {
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: SiteMonitorProps) {
    super(scope, id);

    const scheduleMinutes = props.scheduleMinutes ?? 5;

    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `${props.appName}-site-alerts`,
      displayName: 'WGS Site Uptime Alerts',
    });

    if (props.alertEmail) {
      this.alertTopic.addSubscription(
        new subs.EmailSubscription(props.alertEmail),
      );
    }

    if (props.alertPhone) {
      this.alertTopic.addSubscription(
        new subs.SmsSubscription(props.alertPhone),
      );
    }

    const stateParam = new ssm.StringParameter(this, 'HealthState', {
      parameterName: `/${props.appName}/site-monitor/health-state`,
      stringValue: 'ok',
      description:
        'Last health check state (ok|down) for downtime/recovery alerts',
    });

    const logGroup = new logs.LogGroup(this, 'HealthCheckerLogs', {
      logGroupName: `/aws/lambda/${props.appName}-site-health-check`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const checker = new lambda.Function(this, 'HealthChecker', {
      functionName: `${props.appName}-site-health-check`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(
        join(__dirname, 'lambda', 'health-checker'),
      ),
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        ALERT_TOPIC_ARN: this.alertTopic.topicArn,
        MONITOR_URL: props.monitorUrl,
        STATE_PARAM_NAME: stateParam.parameterName,
      },
      logGroup,
    });

    this.alertTopic.grantPublish(checker);
    stateParam.grantRead(checker);
    stateParam.grantWrite(checker);

    new events.Rule(this, 'HealthCheckSchedule', {
      ruleName: `${props.appName}-site-health-check-schedule`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(scheduleMinutes)),
      targets: [new targets.LambdaFunction(checker)],
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'SNS topic ARN for site uptime alerts',
    });

    new cdk.CfnOutput(this, 'MonitorUrl', {
      value: props.monitorUrl,
      description: 'URL polled by the health checker Lambda',
    });

    let subscriptionHint = props.alertEmail
      ? `Confirm the SNS email subscription sent to ${props.alertEmail} before alerts will arrive.`
      : 'No alertEmail configured — add -c alertEmail=you@example.com and redeploy to subscribe.';
    if (props.alertPhone) {
      subscriptionHint += ` SMS to ${props.alertPhone} requires SNS sandbox verification (create-sms-sandbox-phone-number, then verify-sms-sandbox-phone-number with the OTP).`;
    }

    new cdk.CfnOutput(this, 'AlertSubscriptionHint', {
      value: subscriptionHint,
      description: 'SNS subscription setup reminder',
    });
  }
}
