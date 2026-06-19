import { readFileSync } from 'fs';
import { join } from 'path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { SiteMonitor } from './site-monitor';

export class WgsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const appName = this.node.tryGetContext('appName') ?? 'wgs';
    const instanceTypeName =
      this.node.tryGetContext('instanceType') ?? 't4g.small';
    const postgresEndpoint = this.node.tryGetContext('postgresEndpoint') as
      | string
      | undefined;
    const pgSecretArn = this.node.tryGetContext('pgSecretArn') as
      | string
      | undefined;

    if (!postgresEndpoint || !pgSecretArn) {
      throw new Error(
        'Set CDK context postgresEndpoint and pgSecretArn (see infra/cdk.json).',
      );
    }

    // --- Default VPC (no NAT, no extra cost) ---
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // --- S3 bucket ---
    const bucket = new s3.Bucket(this, 'AppBucket', {
      bucketName: undefined,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      lifecycleRules: [
        {
          id: 'ExpireMysqlBackups',
          prefix: 'backups/mysql/',
          expiration: cdk.Duration.days(30),
          enabled: true,
        },
        {
          id: 'ExpirePostgresqlBackups',
          prefix: 'backups/postgresql/',
          expiration: cdk.Duration.days(30),
          enabled: true,
        },
      ],
    });

    // Legacy MySQL secret (retained; app uses wgs/pg after PostgreSQL cutover)
    const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: `${appName}/db`,
      description: 'Legacy MySQL credentials (retained after PostgreSQL cutover)',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'wgds',
          dbname: 'white_glove_delivery',
        }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',
        passwordLength: 32,
      },
    });

    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: `${appName}/jwt`,
      description: 'JWT signing secret for White Glove Source API',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ app: appName }),
        generateStringKey: 'secret',
        excludeCharacters: '"@/\\\'',
        passwordLength: 64,
      },
    });

    // --- Security groups ---
    const instanceSg = new ec2.SecurityGroup(this, 'InstanceSg', {
      vpc,
      description: 'WGS EC2 - public HTTP/HTTPS',
      allowAllOutbound: true,
    });
    instanceSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');
    instanceSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');

    // --- IAM role ---
    const role = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'WGS EC2 instance profile - S3 + Secrets Manager + SSM',
    });
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'AmazonSSMManagedInstanceCore',
      ),
    );
    bucket.grantReadWrite(role);
    dbSecret.grantRead(role);
    jwtSecret.grantRead(role);
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [pgSecretArn],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'ec2:DescribeAddresses',
          'ec2:AssociateAddress',
          'ec2:DisassociateAddress',
        ],
        resources: ['*'],
      }),
    );

    const instanceProfile = new iam.InstanceProfile(this, 'InstanceProfile', {
      role,
    });

    // --- Elastic IP (association via user-data / promote-candidate.sh) ---
    const eip = new ec2.CfnEIP(this, 'AppElasticIp', {
      domain: 'vpc',
      tags: [{ key: 'Name', value: `${appName}-eip` }],
    });

    // --- EC2 (active instance; candidate launched via deploy/scripts/launch-candidate.sh) ---
    const ami = ec2.MachineImage.latestAmazonLinux2023({
      cpuType: ec2.AmazonLinuxCpuType.ARM_64,
    });

    const userDataScript = readFileSync(
      join(__dirname, '../../deploy/scripts/user-data.sh'),
      'utf8',
    );

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      `export AWS_REGION=${this.region}`,
      `export WGS_BUCKET=${bucket.bucketName}`,
      `export WGS_JWT_SECRET_ARN=${jwtSecret.secretArn}`,
      `export WGS_PG_RDS_ENDPOINT=${postgresEndpoint}`,
      `export WGS_PG_DB_SECRET_ARN=${pgSecretArn}`,
      userDataScript,
    );

    const instance = new ec2.Instance(this, 'AppInstance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(instanceTypeName),
      machineImage: ami,
      securityGroup: instanceSg,
      instanceProfile,
      userData,
      ssmSessionPermissions: true,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(30, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    cdk.Tags.of(instance).add('Name', `${appName}-app-active`);
    cdk.Tags.of(instance).add('wgs-role', 'active');
    cdk.Tags.of(instance).add('wgs-app', appName);

    // --- Outputs ---
    new cdk.CfnOutput(this, 'ElasticIp', {
      value: eip.ref,
      description: 'Public Elastic IP for HTTP access',
    });

    new cdk.CfnOutput(this, 'ElasticIpAllocationId', {
      value: eip.attrAllocationId,
      description: 'Allocation ID for EIP swap during blue/green promote',
    });

    new cdk.CfnOutput(this, 'HttpUrl', {
      value: `http://${eip.ref}`,
      description: 'Application URL (no domain yet)',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
    });

    new cdk.CfnOutput(this, 'InstanceId', {
      value: instance.instanceId,
      description: 'Active EC2 instance ID (wgs-role=active)',
    });

    new cdk.CfnOutput(this, 'PostgresEndpoint', {
      value: postgresEndpoint,
      description: 'RDS PostgreSQL endpoint hostname',
    });

    new cdk.CfnOutput(this, 'PgSecretArn', {
      value: pgSecretArn,
      description: 'PostgreSQL credentials secret (wgs/pg)',
    });

    new cdk.CfnOutput(this, 'RdsEndpoint', {
      value: postgresEndpoint,
      description: 'Deprecated alias for PostgresEndpoint',
    });

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: dbSecret.secretArn,
      description: 'Legacy MySQL secret (wgs/db)',
    });

    new cdk.CfnOutput(this, 'JwtSecretArn', {
      value: jwtSecret.secretArn,
    });

    new cdk.CfnOutput(this, 'InstanceSecurityGroupId', {
      value: instanceSg.securityGroupId,
      description: 'Security group for EC2 instances (active and candidate)',
    });

    new cdk.CfnOutput(this, 'InstanceProfileArn', {
      value: role.roleArn,
      description: 'IAM role ARN for EC2 instances (use with instance profile)',
    });

    new cdk.CfnOutput(this, 'InstanceProfileName', {
      value: instanceProfile.instanceProfileName,
      description: 'IAM instance profile for EC2 (active and candidate)',
    });

    new cdk.CfnOutput(this, 'AppName', {
      value: appName,
    });

    new cdk.CfnOutput(this, 'SsmConnectHint', {
      value: `aws ssm start-session --target ${instance.instanceId} --region ${this.region}`,
      description: 'Connect via Session Manager (no SSH key needed)',
    });

    // --- Site uptime monitoring (SNS + scheduled Lambda health check) ---
    const enableSiteMonitor =
      this.node.tryGetContext('enableSiteMonitor') !== 'false';
    const alertEmail =
      (this.node.tryGetContext('alertEmail') as string | undefined) ??
      process.env.ALERT_EMAIL;
    const alertPhone =
      (this.node.tryGetContext('alertPhone') as string | undefined) ??
      process.env.ALERT_PHONE;
    const monitorUrlOverride = this.node.tryGetContext('monitorUrl') as
      | string
      | undefined;
    const monitorScheduleMinutes = Number(
      this.node.tryGetContext('monitorScheduleMinutes') ?? 5,
    );

    if (enableSiteMonitor) {
      new SiteMonitor(this, 'SiteMonitor', {
        appName,
        monitorUrl:
          monitorUrlOverride ?? `http://${eip.ref}/api/health`,
        alertEmail: alertEmail || undefined,
        alertPhone: alertPhone || undefined,
        scheduleMinutes: monitorScheduleMinutes,
      });
    }
  }
}
