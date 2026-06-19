import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { SiteMonitor } from './site-monitor';

export class WgsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const appName = this.node.tryGetContext('appName') ?? 'wgs';
    const pgInstanceIdentifier =
      (this.node.tryGetContext('pgInstanceIdentifier') as string | undefined) ??
      'wgs-postgres';
    const pgSecretArn =
      (this.node.tryGetContext('pgSecretArn') as string | undefined) ??
      'arn:aws:secretsmanager:us-east-1:536579406753:secret:wgs/pg-ZHlJGW';
    const pgEndpoint =
      (this.node.tryGetContext('pgEndpoint') as string | undefined) ??
      'wgs-postgres.cttrtjhyp7dk.us-east-1.rds.amazonaws.com';
    const pgRdsSecurityGroupId =
      (this.node.tryGetContext('pgRdsSecurityGroupId') as string | undefined) ??
      'sg-0e17293e5284fcbac';
    const pgSubnetGroupName =
      (this.node.tryGetContext('pgSubnetGroupName') as string | undefined) ??
      'wgsstack-dbinstancesubnetgroup5ef3ca8a-7gox0h5xob7u';

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

    // Legacy MySQL secret (retained after MySQL RDS decommission)
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

    // --- PostgreSQL (production RDS adopted from pre-CDK provisioning) ---
    const pgSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'PgSecret',
      pgSecretArn,
    );

    const pgRdsSg = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'PgRdsSg',
      pgRdsSecurityGroupId,
    );

    rds.SubnetGroup.fromSubnetGroupName(
      this,
      'DbInstanceSubnetGroup',
      pgSubnetGroupName,
    );

    const pgInstance = rds.DatabaseInstance.fromDatabaseInstanceAttributes(
      this,
      'PgDbInstance',
      {
        instanceIdentifier: pgInstanceIdentifier,
        instanceEndpointAddress: pgEndpoint,
        port: 5432,
        securityGroups: [pgRdsSg],
      },
    );

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
    pgSecret.grantRead(role);
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

    // EC2 instances are launched via deploy/scripts/launch-candidate.sh (blue/green).

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
      value: 'see deploy/.deploy-state.json (wgs-role=active tag)',
      description: 'Active EC2 instance ID (blue/green; not managed by this stack)',
    });

    new cdk.CfnOutput(this, 'PostgresEndpoint', {
      value: pgInstance.dbInstanceEndpointAddress,
      description: 'RDS PostgreSQL endpoint hostname',
    });

    new cdk.CfnOutput(this, 'PgSecretArn', {
      value: pgSecret.secretArn,
      description: 'PostgreSQL credentials secret (wgs/pg)',
    });

    new cdk.CfnOutput(this, 'PgInstanceIdentifier', {
      value: pgInstanceIdentifier,
      description: 'RDS PostgreSQL instance identifier',
    });

    new cdk.CfnOutput(this, 'RdsEndpoint', {
      value: pgInstance.dbInstanceEndpointAddress,
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
      value: `aws ssm start-session --target <active-instance-id> --region ${this.region}`,
      description: 'Connect via Session Manager (resolve active id from wgs-role=active tag)',
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
