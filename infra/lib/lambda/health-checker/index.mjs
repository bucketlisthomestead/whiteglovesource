import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import {
  GetParameterCommand,
  PutParameterCommand,
  SSMClient,
} from '@aws-sdk/client-ssm';

const sns = new SNSClient({});
const ssm = new SSMClient({});

const TOPIC_ARN = process.env.ALERT_TOPIC_ARN;
const MONITOR_URL = process.env.MONITOR_URL;
const STATE_PARAM_NAME = process.env.STATE_PARAM_NAME;
const TIMEOUT_MS = 15_000;

async function getWasDown() {
  try {
    const res = await ssm.send(
      new GetParameterCommand({ Name: STATE_PARAM_NAME }),
    );
    return res.Parameter?.Value === 'down';
  } catch (err) {
    if (err.name === 'ParameterNotFound') {
      return false;
    }
    throw err;
  }
}

async function setState(state) {
  await ssm.send(
    new PutParameterCommand({
      Name: STATE_PARAM_NAME,
      Value: state,
      Type: 'String',
      Overwrite: true,
    }),
  );
}

async function publishAlert(subject, message) {
  if (!TOPIC_ARN) {
    console.warn('ALERT_TOPIC_ARN not set; skipping SNS publish');
    return;
  }
  await sns.send(
    new PublishCommand({
      TopicArn: TOPIC_ARN,
      Subject: subject,
      Message: message,
    }),
  );
}

export async function handler() {
  let healthy = false;
  let details = '';

  try {
    const response = await fetch(MONITOR_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    const bodyText = await response.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = null;
    }

    if (response.status === 200 && body?.status === 'ok') {
      healthy = true;
    } else {
      details = `HTTP ${response.status}\nResponse: ${bodyText.slice(0, 500)}`;
    }
  } catch (err) {
    details = err instanceof Error ? err.message : String(err);
  }

  const wasDown = await getWasDown();
  const timestamp = new Date().toISOString();

  console.log(
    JSON.stringify({
      monitorUrl: MONITOR_URL,
      healthy,
      wasDown,
      details: details || undefined,
      timestamp,
    }),
  );

  if (!healthy) {
    await setState('down');
    if (!wasDown) {
      await publishAlert(
        '[WGS] Site DOWN',
        [
          'White Glove Moving Service health check failed.',
          '',
          `URL: ${MONITOR_URL}`,
          `Time: ${timestamp}`,
          '',
          details || 'Unknown error',
        ].join('\n'),
      );
    }
    return { healthy: false, alerted: !wasDown };
  }

  if (wasDown) {
    await publishAlert(
      '[WGS] Site RECOVERED',
      [
        'White Glove Moving Service health check recovered.',
        '',
        `URL: ${MONITOR_URL}`,
        `Time: ${timestamp}`,
      ].join('\n'),
    );
  }

  await setState('ok');
  return { healthy: true, recovered: wasDown };
}
